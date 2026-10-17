#!/usr/bin/env node
/**
 * Behavioural checks for the `transactions` rules, against the real Firestore
 * emulator.
 *
 *   npm i --no-save --legacy-peer-deps @firebase/rules-unit-testing
 *   npx firebase emulators:exec --only firestore --project demo-rules \
 *     'node scripts/check-firestore-rules.mjs'
 *
 * `--legacy-peer-deps` is needed: the package's peer range conflicts with this
 * repo's tree. `firebase` itself is already a dependency here. Run it on the
 * emulator's default port (8080) unless you also move the emulator.
 *
 * It runs the same cases against two rulesets: the one in the working tree,
 * and the one produced by applying docs/pending/firestore-transactions.patch.
 * If the patch is already applied they are the same file and both passes are
 * identical — that is the signal that the change has landed.
 *
 * Why this exists. `transactions` shipped as `allow read, write: if true`, so
 * an anonymous caller could create a document in it, and two scheduled
 * relayers pay out a document's `value` to its `recipient`. Measured against
 * the unpatched rules this suite scores 5/14: every one of the nine denials is
 * allowed, including "anonymous creates a Bridge work order". Rules are also
 * deploy-or-nothing — `firebase deploy --only firestore:rules` replaces the
 * live ruleset wholesale — so a change here is verified before it is deployed,
 * not after.
 *
 * The emulator needs Java. Both npm packages are dev-only and deliberately not
 * added to package.json; install them with --no-save when you need to run this.
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RULES = join(ROOT, 'firestore.rules');
const PATCH = join(ROOT, 'docs/pending/firestore-transactions.patch');

let testing;
let firestoreSdk;
try {
    testing = await import('@firebase/rules-unit-testing');
    firestoreSdk = await import('firebase/firestore');
} catch {
    console.error(
        'Missing dev dependencies. Run:\n' +
        '  npm i --no-save @firebase/rules-unit-testing firebase\n',
    );
    process.exit(2);
}
const { initializeTestEnvironment, assertFails, assertSucceeds } = testing;
const { doc, setDoc, updateDoc, getDoc, deleteDoc } = firestoreSdk;

const HOST = '127.0.0.1';
const PORT = Number(process.env.FIRESTORE_EMULATOR_PORT || 8080);

/** The ruleset with the pending patch applied, or null if it will not apply. */
function patchedRules() {
    if (!existsSync(PATCH)) return null;
    const dir = mkdtempSync(join(tmpdir(), 'rules-'));
    const copy = join(dir, 'firestore.rules');
    try {
        execFileSync('cp', [RULES, copy]);
        execFileSync('patch', ['-s', '-p1', copy, PATCH], { cwd: dir });
        return readFileSync(copy, 'utf8');
    } catch {
        return null; // already applied, or drifted
    }
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

    const anon = env.unauthenticatedContext().firestore();
    const user = env.authenticatedContext('u1', { email: 'u1@example.com' }).firestore();
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

    // Seeded the way the server does it, with rules off.
    await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'transactions/bridge1'), BRIDGE_DOC);
        await setDoc(doc(ctx.firestore(), 'transactions/send1'), SEND_DOC);
    });

    // --- the hole ---
    await expect('anonymous creates a Bridge work order', 'deny', () => setDoc(doc(anon, 'transactions/forged'), BRIDGE_DOC));
    await expect('anonymous creates any record', 'deny', () => setDoc(doc(anon, 'transactions/forged2'), SEND_DOC));
    await expect('signed-in user creates a Bridge work order', 'deny', () => setDoc(doc(user, 'transactions/forged3'), BRIDGE_DOC));
    await expect("signed-in user rewrites a bridge's amount", 'deny', () => updateDoc(doc(user, 'transactions/bridge1'), { value: '999999999' }));
    await expect("signed-in user rewrites a bridge's recipient", 'deny', () => updateDoc(doc(user, 'transactions/bridge1'), { recipient: '0x000000000000000000000000000000000000dEaD' }));
    await expect('signed-in user re-arms a completed bridge', 'deny', () => updateDoc(doc(user, 'transactions/bridge1'), { bridgeStatus: 'PENDING' }));
    await expect('anonymous deletes a receipt', 'deny', () => deleteDoc(doc(anon, 'transactions/send1')));
    await expect('signed-in user deletes a receipt', 'deny', () => deleteDoc(doc(user, 'transactions/send1')));
    await expect('signed-in user turns a Send record into a Bridge order', 'deny', () => updateDoc(doc(user, 'transactions/send1'), { type: 'Bridge', bridgeStatus: 'LOCKED' }));

    // --- what must keep working ---
    await expect('the explorer reads without a login', 'allow', () => getDoc(doc(anon, 'transactions/send1')));
    await expect('signed-in user writes an ordinary history record', 'allow', () => setDoc(doc(user, 'transactions/send2'), SEND_DOC));
    await expect('signed-in user writes an untyped history record', 'allow', () => setDoc(doc(user, 'transactions/untyped1'), UNTYPED_DOC));
    await expect('signed-in user writes the reverse-bridge receipt', 'allow', () => setDoc(doc(user, 'transactions/rev1'), REVERSE_DOC));
    await expect('signed-in user hides a bridge from the Agent Desk', 'allow', () => updateDoc(doc(user, 'transactions/bridge1'), { hiddenFromDesk: true, hiddenAt: '2026-10-14' }));

    await env.cleanup();
    return results;
}

const working = readFileSync(RULES, 'utf8');
const patched = patchedRules();

const passes = patched && patched !== working
    ? [['working tree (patch NOT applied)', working], ['with docs/pending patch applied', patched]]
    : [['working tree', working]];

let exit = 0;
for (const [label, rules] of passes) {
    const results = await runCases(rules);
    const bad = results.filter((r) => !r.ok);
    console.log(`\n=== ${label} — ${results.length - bad.length}/${results.length} as intended`);
    for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'DIFF'} ${r.name}: wanted ${r.want}, got ${r.got}`);
    // Only the final ruleset has to be clean; an unpatched first pass is the
    // negative control and is expected to fail.
    if (label !== 'working tree (patch NOT applied)' && bad.length) exit = 1;
}

if (passes.length === 1) {
    console.log('\n(no pending patch to compare against — the working tree is the only ruleset)');
}
process.exit(exit);
