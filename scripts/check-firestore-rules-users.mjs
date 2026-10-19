#!/usr/bin/env node
/**
 * Behavioural checks for the `users` (and `admins`) rules, against the real
 * Firestore emulator.
 *
 *   npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
 *   npx firebase emulators:exec --only firestore --project demo-rules \
 *     'node scripts/check-firestore-rules-users.mjs'
 *
 * Why this exists. Admin used to be `role: "admin"` on the caller's own users
 * document, and the rules let a signed-in user write any field of their own
 * document — and, through the catch-all, anyone else's. So any account could
 * make itself an admin. Admin is now the `admin` custom claim; these cases pin
 * down that no client can grant itself a privilege key, that the catch-all no
 * longer writes users documents, and that every write the app does today on
 * a users document still goes through (see the comment on `match
 * /users/{email}` in firestore.rules for the inventory).
 *
 * It runs the cases against three rulesets:
 *
 *   1. the working tree — must be clean;
 *   2. the working tree with every pending rules patch in docs/pending/
 *      applied (patches already in the working tree are skipped) — must be
 *      clean too, which is what lets this change and those land in any order.
 *      EXTRA_PATCHES (colon-separated paths) adds patches from elsewhere;
 *   3. the ruleset at BASELINE_REF (default 8de290a, before this change) — the
 *      negative control; it is expected to fail and never fails the run.
 *
 * RULES_FILE=<path> runs the cases against that one ruleset instead, with
 * no other passes (for mutation-testing the rules).
 *
 * It is a separate script from check-firestore-rules.mjs so that the two can
 * change independently. The emulator needs Java.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = join(ROOT, 'firestore.rules');
const PENDING = join(ROOT, 'docs/pending');
const BASELINE_REF = process.env.BASELINE_REF || '8de290a';

let testing;
let firestoreSdk;
try {
    testing = await import('@firebase/rules-unit-testing');
    firestoreSdk = await import('firebase/firestore');
} catch {
    console.error(
        'Missing dev dependencies. Run:\n' +
        '  npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing\n',
    );
    process.exit(2);
}
const { initializeTestEnvironment, assertFails, assertSucceeds } = testing;
const { doc, setDoc, updateDoc, getDoc, deleteDoc, increment, setLogLevel } = firestoreSdk;
// Every expected denial is otherwise also logged by the SDK as an error.
setLogLevel('silent');

const HOST = '127.0.0.1';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080);

/**
 * Apply patches with `git apply` to a scratch copy of a ruleset.
 *
 * @param {string} rules the ruleset source
 * @param {string[]} args extra `git apply` arguments
 * @param {string[]} patches patch files, in order
 * @return {string|null} the result, or null if any patch did not apply
 */
function gitApply(rules, args, patches) {
    const dir = mkdtempSync(join(tmpdir(), 'rules-'));
    writeFileSync(join(dir, 'firestore.rules'), rules);
    // Stop git from finding a repository above the scratch dir.
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) };
    try {
        for (const p of patches) execFileSync('git', ['apply', ...args, p], { cwd: dir, env, stdio: 'pipe' });
        return readFileSync(join(dir, 'firestore.rules'), 'utf8');
    } catch {
        return null;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/** Pending rules patches not yet in `rules`, or null if one has drifted. */
function pendingPatches(rules) {
    const found = existsSync(PENDING)
        ? readdirSync(PENDING).filter((f) => f.endsWith('.patch')).sort().map((f) => join(PENDING, f))
        : [];
    const extra = (process.env.EXTRA_PATCHES || '').split(':').filter(Boolean).map((p) => resolve(p));
    const out = [];
    for (const p of [...found, ...extra]) {
        if (!readFileSync(p, 'utf8').includes('+++ b/firestore.rules')) continue;
        if (gitApply(rules, ['--check', '-R'], [p]) !== null) continue; // already in
        out.push(p);
    }
    return out;
}

function baselineRules() {
    try {
        return execFileSync('git', ['show', `${BASELINE_REF}:firestore.rules`], { cwd: ROOT, stdio: 'pipe' }).toString();
    } catch {
        return null;
    }
}

/**
 * @param {string} rules the ruleset source to load
 * @return {Promise<Array<{name: string, want: string, got: string, ok: boolean}>>} one row per case
 */
async function runCases(rules) {
    const env = await initializeTestEnvironment({
        projectId: 'demo-rules',
        firestore: { rules, host: HOST, port: PORT },
    });
    await env.clearFirestore();

    const as = (uid, token) => env.authenticatedContext(uid, token).firestore();
    const anon = env.unauthenticatedContext().firestore();
    const u1 = as('u1', { email: 'u1@example.com' });
    const u2 = as('u2', { email: 'u2@example.com' });
    const u3 = as('u3', { email: 'u3@example.com' }); // signing up: no document yet
    const selfPromoted = as('fake', { email: 'fake@example.com' }); // wrote role: 'admin' before the fix
    const partner = as('p1', { email: 'partner@example.com' });
    const partner2 = as('p2', { email: 'partner2@example.com' });
    const claimAdmin = as('boss', { email: 'boss@example.com', admin: true }); // not on the rules' email list
    const listAdmin = as('jays', { email: 'jays@visai.io' }); // on the email list, no claim yet
    const results = [];

    const expect = async (name, want, fn) => {
        let got;
        try {
            await (want === 'allow' ? assertSucceeds(fn()) : assertFails(fn()));
            got = want;
        } catch {
            got = want === 'allow' ? 'deny' : 'allow';
        }
        results.push({ name, want, got, ok: got === want });
    };

    await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'users/u1@example.com'), {
            email: 'u1@example.com', role: 'user', name: 'U1', phone: '+821000000001',
            referralCode: 'U1CODE', referralCount: 2, totalRewardsVCN: 5, totalRewardsUSD: 0,
            phoneDuplicateBlocked: true,
        });
        await setDoc(doc(db, 'users/u2@example.com'), {
            email: 'u2@example.com', role: 'user', name: 'U2', referralCode: 'U2CODE', referralCount: 0, totalRewardsVCN: 0,
        });
        await setDoc(doc(db, 'users/nocode@example.com'), { email: 'nocode@example.com', role: 'user' });
        await setDoc(doc(db, 'users/fake@example.com'), { email: 'fake@example.com', role: 'admin', isAdmin: true });
        await setDoc(doc(db, 'users/partner@example.com'), { email: 'partner@example.com', role: 'partner', partnerCode: 'P1' });
        await setDoc(doc(db, 'users/partner2@example.com'), { email: 'partner2@example.com', role: 'partner', partnerCode: 'P2' });
        await setDoc(doc(db, 'config/rp_rewards'), { rate: 1 });
    });

    const users = (db, email) => doc(db, `users/${email}`);

    // --- the hole: a client granting itself a privilege ---
    await expect('user sets own role to admin', 'deny', () => updateDoc(users(u1, 'u1@example.com'), { role: 'admin' }));
    await expect('user sets own role to partner', 'deny', () => updateDoc(users(u1, 'u1@example.com'), { role: 'partner' }));
    await expect('user sets own isAdmin', 'deny', () => updateDoc(users(u1, 'u1@example.com'), { isAdmin: true }));
    await expect('user grants itself permissions', 'deny', () => updateDoc(users(u1, 'u1@example.com'), { permissions: ['admin'] }));
    await expect('user overwrites own doc wholesale with role admin', 'deny', () => setDoc(users(u1, 'u1@example.com'), { email: 'u1@example.com', role: 'admin' }));
    await expect('user signs up with role admin', 'deny', () => setDoc(users(u3, 'u3@example.com'), { email: 'u3@example.com', role: 'admin' }));
    await expect('user signs up with isAdmin', 'deny', () => setDoc(users(u3, 'u3@example.com'), { email: 'u3@example.com', role: 'user', isAdmin: true }));
    await expect('user creates admins/{own uid}', 'deny', () => setDoc(doc(u1, 'admins/u1'), { email: 'u1@example.com' }));
    await expect('user creates admins/{own email}', 'deny', () => setDoc(doc(u1, 'admins/u1@example.com'), { email: 'u1@example.com' }));
    await expect('a stored role: admin does not make an admin (config write)', 'deny', () => setDoc(doc(selfPromoted, 'config/rp_rewards'), { rate: 1000 }));
    await expect("a stored role: admin does not make an admin (another user's doc)", 'deny', () => updateDoc(users(selfPromoted, 'u2@example.com'), { role: 'partner' }));

    // --- the hole: writing someone else's document ---
    await expect("user edits another user's profile", 'deny', () => updateDoc(users(u1, 'u2@example.com'), { name: 'pwned' }));
    await expect("user sets another user's role to admin", 'deny', () => updateDoc(users(u1, 'u2@example.com'), { role: 'admin' }));
    await expect("user deletes another user's doc", 'deny', () => deleteDoc(users(u1, 'u2@example.com')));
    await expect("user creates someone else's doc", 'deny', () => setDoc(users(u1, 'stranger@example.com'), { email: 'stranger@example.com', role: 'user', status: 'PendingActivation' }));
    await expect("user adds 100 to another user's referralCount", 'deny', () => updateDoc(users(u1, 'u2@example.com'), { referralCount: 100 }));
    await expect('user sneaks role admin into a referralCount bump', 'deny', () => updateDoc(users(u1, 'u2@example.com'), { referralCount: 1, role: 'admin' }));
    await expect("user lowers another user's reward total", 'deny', () => updateDoc(users(u2, 'u1@example.com'), { totalRewardsVCN: 0 }));
    await expect("user clears another user's phone block", 'deny', () => updateDoc(users(u3, 'u1@example.com'), { phoneDuplicateBlocked: false }));
    await expect("user replaces another user's referralCode", 'deny', () => updateDoc(users(u1, 'u2@example.com'), { referralCode: 'MINE' }));
    await expect('partner creates an invitation stub with role admin', 'deny', () => setDoc(users(partner, 'evil@example.com'), { email: 'evil@example.com', role: 'admin', partnerCode: 'P1', status: 'PendingActivation', createdAt: '2026-10-19' }));
    await expect('partner creates a stub carrying extra fields', 'deny', () => setDoc(users(partner, 'evil2@example.com'), { email: 'evil2@example.com', role: 'user', partnerCode: 'P1', status: 'PendingActivation', createdAt: '2026-10-19', referralCount: 100 }));
    await expect('anonymous writes a users doc', 'deny', () => setDoc(users(anon, 'u1@example.com'), { role: 'admin' }));

    // --- what the app does today and must keep doing ---
    await expect('user reads another user (leaderboards, referrals)', 'allow', () => getDoc(users(u1, 'u2@example.com')));
    await expect('user updates own profile', 'allow', () => updateDoc(users(u1, 'u1@example.com'), { name: 'U1 renamed', bio: 'hi', photoURL: 'https://x/p.png', phone: '+821000000009', updatedAt: '2026-10-19' }));
    await expect('user records own wallet creation (updateWalletStatus)', 'allow', () => setDoc(users(u1, 'u1@example.com'), { walletReady: true, walletAddress: '0x1111111111111111111111111111111111111111', status: 'WalletCreated', isVerified: true, updatedAt: '2026-10-19' }, { merge: true }));
    await expect("user resolves own phone block (resolvePhoneAccounts)", 'allow', () => setDoc(users(u1, 'u1@example.com'), { isPhonePrimary: true, phoneOwnerGroup: 'g1', accountStatus: 'active', phoneDuplicateBlocked: false, phoneDuplicateResolvedAt: '2026-10-19' }, { merge: true }));
    await expect("activation merges role 'user' back in", 'allow', () => setDoc(users(u1, 'u1@example.com'), { role: 'user', status: 'Registered', updatedAt: '2026-10-19' }, { merge: true }));
    await expect('user overwrites own doc wholesale, role unchanged', 'allow', () => setDoc(users(u1, 'u1@example.com'), { email: 'u1@example.com', role: 'user', name: 'U1', referralCode: 'U1CODE', referralCount: 2, totalRewardsVCN: 5, totalRewardsUSD: 0 }));
    await expect('partner drops own role to user', 'allow', () => updateDoc(users(partner2, 'partner2@example.com'), { role: 'user' }));
    await expect("signup creates own doc with role 'user' (userRegister)", 'allow', () => setDoc(users(u3, 'u3@example.com'), {
        email: 'u3@example.com', phone: '+821000000001', role: 'user', status: 'PendingVerification', accountOrigin: 'self-signup',
        referralCode: 'U3CODE', referrerId: 'u1@example.com', grandReferrerId: '', referralCount: 0, totalRewardsVCN: 0, totalRewardsUSD: 0,
        phoneDuplicateBlocked: true, phoneDuplicateBlockedAt: '2026-10-19', createdAt: '2026-10-19', cohortDate: '2026-10-19', updatedAt: '2026-10-19',
    }));
    await expect("signup adds 1 to the referrer's referralCount", 'allow', () => updateDoc(users(u3, 'u1@example.com'), { referralCount: 3 }));
    await expect('signup flags another account sharing the phone', 'allow', () => setDoc(users(u3, 'u2@example.com'), { phoneDuplicateBlocked: true, phoneDuplicateBlockedAt: '2026-10-19' }, { merge: true }));
    await expect("node purchase raises the referrer's reward total", 'allow', () => updateDoc(users(u3, 'u1@example.com'), { totalRewardsVCN: 15 }));
    await expect('getUserData fills in a missing referralCode', 'allow', () => setDoc(users(u1, 'nocode@example.com'), { referralCode: 'NEWCODE' }, { merge: true }));
    await expect("signup writes the referrer's contacts", 'allow', () => setDoc(doc(u3, 'users/u1@example.com/contacts/c1'), { internalName: 'u3', email: 'u3@example.com', createdAt: '2026-10-19' }));
    await expect('partner creates an invitation stub (manualInviteUser)', 'allow', () => setDoc(users(partner, 'invited@example.com'), { email: 'invited@example.com', role: 'user', partnerCode: 'P1', status: 'PendingActivation', createdAt: '2026-10-19' }));
    await expect('user creates own doc without a role', 'allow', () => setDoc(users(as('u4', { email: 'u4@example.com' }), 'u4@example.com'), { email: 'u4@example.com' }));
    await expect('user deletes own doc', 'allow', () => deleteDoc(users(as('u4', { email: 'u4@example.com' }), 'u4@example.com')));

    // --- admin, via the custom claim ---
    await expect("claim admin sets a user's role to partner", 'allow', () => setDoc(users(claimAdmin, 'u2@example.com'), { role: 'partner', updatedAt: '2026-10-19' }, { merge: true }));
    await expect("claim admin bumps a user's adminSentTotal", 'allow', () => updateDoc(users(claimAdmin, 'u2@example.com'), { adminSentTotal: increment(100) }));
    await expect('claim admin pre-registers an invitee', 'allow', () => setDoc(users(claimAdmin, 'invitee@example.com'), { email: 'invitee@example.com', role: 'user', partnerCode: 'P1', status: 'PendingActivation', createdAt: '2026-10-19' }));
    await expect('claim admin writes config/rp_rewards', 'allow', () => setDoc(doc(claimAdmin, 'config/rp_rewards'), { rate: 2 }));
    await expect("email-list admin (no claim yet) sets a user's role", 'allow', () => updateDoc(users(listAdmin, 'u2@example.com'), { role: 'user' }));

    await env.cleanup();
    return results;
}

const working = readFileSync(process.env.RULES_FILE || RULES, 'utf8');
const single = Boolean(process.env.RULES_FILE);
const patches = single ? [] : pendingPatches(working);
const patched = patches.length ? gitApply(working, [], patches) : null;
const baseline = single ? null : baselineRules();

const passes = [[single ? process.env.RULES_FILE : 'working tree', working, true]];
if (patches.length) {
    if (patched === null) {
        console.error(`Pending patches do not apply on top of the working tree: ${patches.map((p) => basename(p)).join(', ')}`);
        process.exit(1);
    }
    passes.push([`with pending patches applied (${patches.map((p) => basename(p)).join(', ')})`, patched, true]);
}
if (baseline && baseline !== working) passes.push([`before this change (${BASELINE_REF}) — negative control`, baseline, false]);

let exit = 0;
for (const [label, rules, mustPass] of passes) {
    const results = await runCases(rules);
    const bad = results.filter((r) => !r.ok);
    console.log(`\n=== ${label} — ${results.length - bad.length}/${results.length} as intended`);
    for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'DIFF'} ${r.name}: wanted ${r.want}, got ${r.got}`);
    if (mustPass && bad.length) exit = 1;
}
process.exit(exit);
