#!/usr/bin/env node
/**
 * Behavioural checks for the Firestore rules that guard server-owned data,
 * against the real Firestore emulator.
 *
 *   npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
 *   npx firebase emulators:exec --only firestore --project demo-rules \
 *     'node scripts/check-firestore-rules.mjs'
 *
 * `--legacy-peer-deps` is needed: the package's peer range conflicts with this
 * repo's tree. `firebase` itself is already a dependency here. Run it on the
 * emulator's default port (8080) unless you also move the emulator.
 *
 * It runs the same cases against the ruleset in the working tree and against
 * that ruleset with every pending rules patch in docs/pending/ applied — each
 * one alone, then all of them, which is the ruleset to deploy. A patch that is
 * already in the working tree is recognised and skipped; once every patch has
 * landed there is a single pass, and that is the signal they all have.
 *
 * Why this exists. Two collections were open to clients and should not be:
 *
 *   transactions  (firestore-transactions.patch) shipped as
 *                 `allow read, write: if true`, so an anonymous caller could
 *                 create a document in it, and two scheduled relayers pay out
 *                 a document's `value` to its `recipient`. Unpatched: 5/14.
 *   agents        (firestore-agents.patch) had no rule, so the catch-all let
 *                 any signed-in user read every agent's plaintext API key and
 *                 rewrite the scope and identity the Agent Gateway enforces.
 *                 `fee_reconciliation`, the gateway's ledger of uncollected
 *                 fees, was open the same way. Unpatched: 8/23.
 *
 * Rules are also deploy-or-nothing — `firebase deploy --only firestore:rules`
 * replaces the live ruleset wholesale — so a change here is verified before it
 * is deployed, not after.
 *
 * The emulator needs Java. Both npm packages are dev-only and deliberately not
 * added to package.json; install them with --no-save when you need to run this.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = join(ROOT, 'firestore.rules');
const PENDING = join(ROOT, 'docs/pending');

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
const { initializeTestEnvironment } = testing;
const { doc, collection, setDoc, updateDoc, getDoc, getDocs, deleteDoc, getCountFromServer, setLogLevel } = firestoreSdk;
// Every expected denial is otherwise also logged by the SDK as an error.
setLogLevel('silent');

const HOST = '127.0.0.1';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080);

/** Every patch in docs/pending/ that edits firestore.rules, in name order. */
function rulesPatches() {
    if (!existsSync(PENDING)) return [];
    return readdirSync(PENDING)
        .filter((f) => f.endsWith('.patch'))
        .map((f) => join(PENDING, f))
        .filter((p) => readFileSync(p, 'utf8').includes('+++ b/firestore.rules'))
        .sort();
}

/**
 * Run `git apply` against a scratch copy of a ruleset — the same tool the
 * patches are landed with, so "applies here" means "applies there".
 *
 * @param {string} rules the ruleset source to start from
 * @param {string[]} args extra `git apply` arguments (e.g. --check, -R)
 * @param {string[]} patches patch files, applied in order
 * @return {string|null} the resulting source, or null if any patch did not apply
 */
function gitApply(rules, args, patches) {
    const dir = mkdtempSync(join(tmpdir(), 'rules-'));
    const file = join(dir, 'firestore.rules');
    writeFileSync(file, rules);
    // Stop git from discovering a repository above the scratch dir, which
    // would make it resolve the patch's paths from that repository's root.
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(dir) };
    try {
        for (const p of patches) execFileSync('git', ['apply', ...args, p], { cwd: dir, env, stdio: 'pipe' });
        return readFileSync(file, 'utf8');
    } catch {
        return null;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

/** @return {'pending'|'applied'|'drifted'} where a patch stands against `rules` */
function patchState(rules, patch) {
    if (gitApply(rules, ['--check'], [patch]) !== null) return 'pending';
    if (gitApply(rules, ['--check', '-R'], [patch]) !== null) return 'applied';
    return 'drifted';
}

const BRIDGE_DOC = {
    hash: '0xaa',
    from_addr: '0x1111111111111111111111111111111111111111',
    recipient: '0x2222222222222222222222222222222222222222',
    to_addr: 'bridge:sepolia',
    value: '1000000',
    type: 'Bridge',
    bridgeStatus: 'LOCKED',
    challengeEndTime: 1,
    timestamp: 1,
};
const SEND_DOC = { hash: '0xbb', from_addr: '0x1111111111111111111111111111111111111111', value: '5', type: 'Send', timestamp: 1 };
/** Most history records carry no `type` at all — the common case. */
const UNTYPED_DOC = { hash: '0xcc', value: '1', timestamp: 1 };
const REVERSE_DOC = { hash: '0xdd', value: '7', type: 'ReverseBridge', bridgeStatus: 'COMPLETED', timestamp: 1 };

/** Shaped like system.register writes it; the key and private key are fakes. */
const AGENT_DOC = {
    agentName: 'alice',
    ownerEmail: 'owner@example.com',
    apiKey: 'vcn_rules_test_not_a_real_key',
    privateKey: 'not-a-real-ciphertext',
    walletAddress: '0x3333333333333333333333333333333333333333',
    status: 'active',
    sbtStatus: 'completed',
    sbtTokenId: 7,
    hosting: { enabled: true, allowed_actions: ['social.profile'] },
};
const FEE_DOC = {
    kind: 'uncollected',
    action: 'transfer.send',
    payer: '0x3333333333333333333333333333333333333333',
    amount_vcn: '0.1',
    action_executed: true,
    status: 'open',
};

/** Must not be caught by the `agents` rule: its collection is `dex`. */
const DEX_AGENT_DOC = { id: 'mm-alpha', role: 'market_maker' };

/** Admin by the rules' own `isAdmin()` email list. */
const ADMIN_EMAIL = 'jays@visai.io';

/**
 * Classify one request. A rejection that is not a permission denial (say
 * NOT_FOUND) is reported as an error, not counted as a denial — otherwise a
 * case that never reached the rules would look like it passed.
 *
 * @return {Promise<string>} 'allow', 'deny' or 'error (<code>)'
 */
async function outcome(fn) {
    try {
        await fn();
        return 'allow';
    } catch (err) {
        const code = String(err?.code || '').toLowerCase();
        const message = String(err?.message || '').toLowerCase();
        if (code === 'permission-denied' || message.includes('permission_denied') || message.includes('permission denied')) return 'deny';
        return `error (${err?.code || err?.message})`;
    }
}

/**
 * @param {string} rules the ruleset source to load
 * @return {Promise<Array<{group: string, name: string, want: string, got: string, ok: boolean}>>} one row per case
 */
async function runCases(rules) {
    const env = await initializeTestEnvironment({
        projectId: 'demo-rules',
        firestore: { rules, host: HOST, port: PORT },
    });
    await env.clearFirestore();

    const anon = env.unauthenticatedContext().firestore();
    const user = env.authenticatedContext('u1', { email: 'u1@example.com' }).firestore();
    const owner = env.authenticatedContext('owner1', { email: AGENT_DOC.ownerEmail }).firestore();
    const admin = env.authenticatedContext('admin1', { email: ADMIN_EMAIL }).firestore();
    const results = [];

    // Re-seeded before every case, the way the server writes these documents
    // (rules off), so a write the unpatched rules let through — a delete,
    // say — cannot change what the next case sees.
    const reseed = () => env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await setDoc(doc(db, 'transactions/bridge1'), BRIDGE_DOC);
        await setDoc(doc(db, 'transactions/send1'), SEND_DOC);
        await setDoc(doc(db, 'agents/alice'), AGENT_DOC);
        await setDoc(doc(db, 'agents/alice/transactions/t1'), { type: 'transfer', amount: '1', timestamp: 1 });
        await setDoc(doc(db, 'agents/alice/authority_delegations/d1'), { delegate: AGENT_DOC.walletAddress, scope: ['transfer.send'], status: 'active' });
        await setDoc(doc(db, 'fee_reconciliation/f1'), FEE_DOC);
        await setDoc(doc(db, 'dex/agents/list/mm-alpha'), DEX_AGENT_DOC);
    });
    const expect = async (group, name, want, fn) => {
        await reseed();
        const got = await outcome(fn);
        results.push({ group, name, want, got, ok: got === want });
    };

    // --- transactions: the hole ---
    const tx = (name, want, fn) => expect('transactions', name, want, fn);
    await tx('anonymous creates a Bridge work order', 'deny', () => setDoc(doc(anon, 'transactions/forged'), BRIDGE_DOC));
    await tx('anonymous creates any record', 'deny', () => setDoc(doc(anon, 'transactions/forged2'), SEND_DOC));
    await tx('signed-in user creates a Bridge work order', 'deny', () => setDoc(doc(user, 'transactions/forged3'), BRIDGE_DOC));
    await tx("signed-in user rewrites a bridge's amount", 'deny', () => updateDoc(doc(user, 'transactions/bridge1'), { value: '999999999' }));
    await tx("signed-in user rewrites a bridge's recipient", 'deny', () => updateDoc(doc(user, 'transactions/bridge1'), { recipient: '0x000000000000000000000000000000000000dEaD' }));
    await tx('signed-in user re-arms a completed bridge', 'deny', () => updateDoc(doc(user, 'transactions/bridge1'), { bridgeStatus: 'PENDING' }));
    await tx('anonymous deletes a receipt', 'deny', () => deleteDoc(doc(anon, 'transactions/send1')));
    await tx('signed-in user deletes a receipt', 'deny', () => deleteDoc(doc(user, 'transactions/send1')));
    await tx('signed-in user turns a Send record into a Bridge order', 'deny', () => updateDoc(doc(user, 'transactions/send1'), { type: 'Bridge', bridgeStatus: 'LOCKED' }));

    // --- transactions: what must keep working ---
    await tx('the explorer reads without a login', 'allow', () => getDoc(doc(anon, 'transactions/send1')));
    await tx('signed-in user writes an ordinary history record', 'allow', () => setDoc(doc(user, 'transactions/send2'), SEND_DOC));
    await tx('signed-in user writes an untyped history record', 'allow', () => setDoc(doc(user, 'transactions/untyped1'), UNTYPED_DOC));
    await tx('signed-in user writes the reverse-bridge receipt', 'allow', () => setDoc(doc(user, 'transactions/rev1'), REVERSE_DOC));
    await tx('signed-in user hides a bridge from the Agent Desk', 'allow', () => updateDoc(doc(user, 'transactions/bridge1'), { hiddenFromDesk: true, hiddenAt: '2026-10-14' }));

    const ag = (name, want, fn) => expect('agents', name, want, fn);

    // --- agents: the hole ---
    await ag('signed-in user reads an agent (its plaintext apiKey)', 'deny', () => getDoc(doc(user, 'agents/alice')));
    await ag('signed-in user lists every agent', 'deny', () => getDocs(collection(user, 'agents')));
    await ag('signed-in user counts agents', 'deny', () => getCountFromServer(collection(user, 'agents')));
    await ag("the agent's own owner reads it (no client feature does)", 'deny', () => getDoc(doc(owner, 'agents/alice')));
    await ag("signed-in user widens an agent's declared scope", 'deny', () => updateDoc(doc(user, 'agents/alice'), { 'hosting.allowed_actions': ['social.profile', 'transfer.send', 'bridge.initiate'] }));
    await ag("signed-in user rewrites an agent's identity (sbtStatus, status)", 'deny', () => updateDoc(doc(user, 'agents/alice'), { sbtStatus: 'completed', status: 'active' }));
    await ag('signed-in user points an agent at another wallet', 'deny', () => updateDoc(doc(user, 'agents/alice'), { walletAddress: '0x000000000000000000000000000000000000dEaD' }));
    await ag('signed-in user plants an agent with a key of its choosing', 'deny', () => setDoc(doc(user, 'agents/forged'), { ...AGENT_DOC, agentName: 'forged', apiKey: 'vcn_chosen_by_attacker' }));
    await ag('signed-in user deletes an agent', 'deny', () => deleteDoc(doc(user, 'agents/alice')));
    await ag("signed-in user reads an agent's transactions", 'deny', () => getDoc(doc(user, 'agents/alice/transactions/t1')));
    await ag('signed-in user grants itself an authority delegation', 'deny', () => setDoc(doc(user, 'agents/alice/authority_delegations/evil'), { delegate: '0x000000000000000000000000000000000000dEaD', scope: ['*'], status: 'active' }));
    await ag('anonymous reads an agent', 'deny', () => getDoc(doc(anon, 'agents/alice')));
    await ag('signed-in user reads the fee ledger', 'deny', () => getDoc(doc(user, 'fee_reconciliation/f1')));
    await ag('signed-in user writes a fee ledger entry', 'deny', () => setDoc(doc(user, 'fee_reconciliation/f2'), FEE_DOC));
    await ag('signed-in user marks a fee debt settled', 'deny', () => updateDoc(doc(user, 'fee_reconciliation/f1'), { status: 'settled' }));
    await ag('admin writes the fee ledger from the browser', 'deny', () => setDoc(doc(admin, 'fee_reconciliation/f3'), FEE_DOC));

    // --- agents: what must keep working ---
    await ag('admin reads an agent', 'allow', () => getDoc(doc(admin, 'agents/alice')));
    await ag('admin lists agents (the agent table)', 'allow', () => getDocs(collection(admin, 'agents')));
    await ag('admin counts agents (the dashboard)', 'allow', () => getCountFromServer(collection(admin, 'agents')));
    await ag("admin reads an agent's transactions", 'allow', () => getDoc(doc(admin, 'agents/alice/transactions/t1')));
    await ag('admin deletes an agent (the agent table)', 'allow', () => deleteDoc(doc(admin, 'agents/alice')));
    await ag('admin reads the fee ledger', 'allow', () => getDoc(doc(admin, 'fee_reconciliation/f1')));
    await ag('signed-in user reads dex/agents/list (collection `dex`, unaffected)', 'allow', () => getDoc(doc(user, 'dex/agents/list/mm-alpha')));

    await env.cleanup();
    return results;
}

/** e.g. "transactions 14/14 · agents 23/23" */
function groupSummary(results) {
    const groups = [...new Set(results.map((r) => r.group))];
    return groups.map((g) => {
        const rows = results.filter((r) => r.group === g);
        return `${g} ${rows.filter((r) => r.ok).length}/${rows.length}`;
    }).join(' · ');
}

const working = readFileSync(RULES, 'utf8');
const patches = rulesPatches().map((path) => ({ path, name: basename(path), state: patchState(working, path) }));
const pending = patches.filter((p) => p.state === 'pending');

let exit = 0;
for (const p of patches) {
    console.log(`${p.name}: ${p.state}`);
    if (p.state === 'drifted') exit = 1; // applies neither way: it no longer matches firestore.rules
}

// The first pass is the negative control and is expected to fail while any
// patch is pending; each patch alone shows what it fixes by itself; only the
// last pass — the ruleset that would be deployed — has to be clean.
const passes = [{ label: pending.length ? 'working tree (pending patches NOT applied)' : 'working tree', rules: working, detail: true }];
if (pending.length > 1) {
    for (const p of pending) passes.push({ label: `+ ${p.name} alone`, rules: gitApply(working, [], [p.path]), detail: false });
}
if (pending.length) {
    passes.push({ label: `+ ${pending.map((p) => p.name).join(' + ')}`, rules: gitApply(working, [], pending.map((p) => p.path)), detail: true });
}

for (const [i, { label, rules, detail }] of passes.entries()) {
    const final = i === passes.length - 1;
    if (rules === null) {
        console.log(`\n=== ${label} — does not apply`);
        exit = 1;
        continue;
    }
    const results = await runCases(rules);
    const bad = results.filter((r) => !r.ok);
    console.log(`\n=== ${label} — ${results.length - bad.length}/${results.length} as intended (${groupSummary(results)})`);
    if (detail) for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'DIFF'} [${r.group}] ${r.name}: wanted ${r.want}, got ${r.got}`);
    if (final && bad.length) exit = 1;
}

if (!pending.length) {
    console.log('\n(no pending rules patch — the working tree is the only ruleset)');
}
process.exit(exit);
