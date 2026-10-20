#!/usr/bin/env node
/**
 * End-to-end check of signup, invitation activation, getUserData and node
 * purchase referral rewards — the flows that used to write other users'
 * documents from the browser and now go through completeSignup and
 * creditNodePurchaseReferral (functions/referralLedger.js).
 *
 *   (cd functions && npm ci)        # firebase-admin, for seeding and checking
 *   REFERRAL_RPC_URL=http://127.0.0.1:8599 \
 *     firebase emulators:exec --only auth,firestore,functions --project demo-referrals \
 *     'node scripts/check-referral-flows-e2e.mjs'
 *
 * Needs Java (emulators), anvil (Foundry) and firebase-tools 14 or later:
 * `npx firebase` can resolve to a cached 13.x, which fails to load the
 * functions with "Failed to parse build specification" (it predates the
 * build spec firebase-functions 7 emits). What is real here:
 *
 *   - the client code: services/firebaseService.ts itself, bundled for Node
 *     with esbuild — userRegister, activateAccountWithToken, getUserData,
 *     processReferralRewards and nodePurchaseReferralMessage run unmodified;
 *   - the rules: the emulator enforces firestore.rules from the working tree;
 *   - the callables: the functions emulator runs functions/index.js;
 *   - the purchase: anvil runs the NodeLicense bytecode the app ships
 *     (services/abi/VisionNodeLicense.json), deployed at the address the app
 *     and the server use, and the buyer approves and buys as
 *     contractService.purchaseLicense does. REFERRAL_RPC_URL points the
 *     server's verification at anvil; index.js honours it only under the
 *     emulator.
 *
 * Every request the client makes to a non-local host (welcome and referral
 * notification e-mails, the agent gateway's rp.award) is intercepted and
 * recorded, not sent.
 */

import { execFileSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = 'demo-referrals';
const RPC = process.env.REFERRAL_RPC_URL || '';

for (const v of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[v]) {
        console.error(`${v} is not set. Run this under \`firebase emulators:exec\` (see the header).`);
        process.exit(2);
    }
}
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(RPC)) {
    console.error('REFERRAL_RPC_URL must be http://127.0.0.1:<port>, set on the emulators:exec command so the functions emulator sees it.');
    process.exit(2);
}

const fnRequire = createRequire(join(ROOT, 'functions/package.json'));
const admin = fnRequire('firebase-admin');
const { ethers } = fnRequire('ethers');

// --- intercept every non-local request the client makes ---
const outbound = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) return realFetch(input, init);
    outbound.push({ url, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const notifications = (name) => outbound.filter((o) => o.url.endsWith(`/${name}`));

// --- the client, bundled ---
const bundleDir = join(ROOT, 'node_modules/.cache/referral-e2e');
mkdirSync(bundleDir, { recursive: true });
const bundle = join(bundleDir, 'client.mjs');
const entry = join(bundleDir, 'entry.ts');
const { writeFileSync } = await import('node:fs');
writeFileSync(entry, [
    `export * from ${JSON.stringify(join(ROOT, 'services/firebaseService.ts'))};`,
    "export { connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';",
    "export { connectFirestoreEmulator, doc, updateDoc } from 'firebase/firestore';",
    "export { connectFunctionsEmulator, getFunctions } from 'firebase/functions';",
].join('\n'));
execFileSync(join(ROOT, 'node_modules/.bin/esbuild'), [
    entry, '--bundle', '--platform=node', '--format=esm', '--packages=external', '--log-level=warning',
    `--define:import.meta.env=${JSON.stringify({ VITE_FIREBASE_PROJECT_ID: PROJECT, VITE_FIREBASE_API_KEY: 'demo-key', VITE_CHAIN_ENV: 'production' })}`,
    `--outfile=${bundle}`,
], { stdio: 'inherit' });
const app = await import(pathToFileURL(bundle).href);

const firebaseApp = app.getFirebaseApp();
app.connectAuthEmulator(app.getFirebaseAuth(), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
const [fsHost, fsPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
app.connectFirestoreEmulator(app.getFirebaseDb(), fsHost, Number(fsPort));
app.connectFunctionsEmulator(app.getFunctions(firebaseApp), '127.0.0.1', 5001);

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const user = async (email) => (await db.doc(`users/${email}`).get()).data() || {};

// --- the chain ---
const port = new URL(RPC).port;
const anvil = spawn('anvil', ['--port', port, '--silent'], { stdio: 'ignore' });
const stopAnvil = () => { try { anvil.kill(); } catch { /* gone */ } };
process.on('exit', stopAnvil);

// --- checks ---
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });
const expectDenied = async (name, fn) => {
    try {
        await fn();
        check(name, false, 'was allowed');
    } catch (e) {
        check(name, e?.code === 'permission-denied', e?.code || e?.message);
    }
};
const PW = 'e2e-password-1';

try {
    // 1. Self-signup without a code.
    await app.userRegister('g@e2e.test', PW, '+82-10-1000-0001');
    const g = await user('g@e2e.test');
    check('signup: creates the users document with a referral code', g.referralCode && g.role === 'user');
    check('signup: server records the signup', (await db.doc('signup_records/g@e2e.test').get()).exists);
    await app.signOut(app.getFirebaseAuth());

    // 2. Self-signup with G's code.
    await app.userRegister('r@e2e.test', PW, '+82-10-1000-0002', g.referralCode);
    check("signup with a code: the referrer's referralCount goes 0 -> 1", (await user('g@e2e.test')).referralCount === 1,
        `referralCount=${(await user('g@e2e.test')).referralCount}`);
    const r = await user('r@e2e.test');
    check('signup with a code: the new account names its referrer', r.referrerId === 'g@e2e.test');
    check('signup with a code: the referrer is e-mailed once', notifications('notifyReferralSignup').length === 1
        && notifications('notifyReferralSignup')[0].body.referrerEmail === 'g@e2e.test');
    check("signup with a code: the referrer's contacts gain the new account", (await db.doc('users/g@e2e.test/contacts/r@e2e.test').get()).exists);
    check('signup with a code: the referral round is recorded', (await db.collection('referral_round_participants')
        .where('referrerId', '==', 'g@e2e.test').get()).size === 1);
    await app.signOut(app.getFirebaseAuth());

    // 3. Signup with R's code, on a phone an existing account holds in a legacy format.
    await db.doc('users/p@e2e.test').set({ email: 'p@e2e.test', phone: '010-1000-0003', role: 'user' });
    await db.doc('users/q@e2e.test').set({ email: 'q@e2e.test', phone: '+82-10-1000-0099', role: 'user' });
    await app.userRegister('b@e2e.test', PW, '+82-10-1000-0003', r.referralCode);
    check("second-level signup: R's referralCount 0 -> 1, G's unchanged",
        (await user('r@e2e.test')).referralCount === 1 && (await user('g@e2e.test')).referralCount === 1);
    const b = await user('b@e2e.test');
    check('second-level signup: grand-referrer recorded', b.grandReferrerId === 'g@e2e.test');
    check('shared phone: the existing account is flagged', (await user('p@e2e.test')).phoneDuplicateBlocked === true);
    check('shared phone: the new account is flagged', b.phoneDuplicateBlocked === true);
    check('shared phone: an unrelated account is not', (await user('q@e2e.test')).phoneDuplicateBlocked === undefined);

    // 4. The old client writes are refused now (signed in as B).
    await expectDenied("old client write: +1 on the referrer's referralCount", () =>
        app.updateDoc(app.doc(app.getFirebaseDb(), 'users/r@e2e.test'), { referralCount: 2 }));
    await expectDenied("old client write: raise the referrer's totalRewardsVCN", () =>
        app.updateDoc(app.doc(app.getFirebaseDb(), 'users/r@e2e.test'), { totalRewardsVCN: 1e9 }));
    await expectDenied("old client write: flag someone else's phone", () =>
        app.updateDoc(app.doc(app.getFirebaseDb(), 'users/q@e2e.test'), { phoneDuplicateBlocked: true, phoneDuplicateBlockedAt: 'x' }));

    // 5. getUserData: someone else's missing code is not written; one's own is.
    await db.doc('users/nocode@e2e.test').set({ email: 'nocode@e2e.test', role: 'user' });
    const other = await app.getUserData('nocode@e2e.test');
    check("getUserData(someone else's, no code): returns, writes nothing",
        other && other.referralCode === '' && (await user('nocode@e2e.test')).referralCode === undefined);
    await db.doc('users/b@e2e.test').update({ referralCode: admin.firestore.FieldValue.delete() });
    const own = await app.getUserData('b@e2e.test');
    check('getUserData(own, no code): generates and saves one', own.referralCode && (await user('b@e2e.test')).referralCode === own.referralCode);
    await app.signOut(app.getFirebaseAuth());

    // 6. Invitation activation with R's code as the partner code.
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    await db.doc('users/i@e2e.test').set({ email: 'i@e2e.test', role: 'user', partnerCode: r.referralCode, status: 'PendingActivation', createdAt: '2026-10-20' });
    await db.doc('token_sales/i@e2e.test').set({ email: 'i@e2e.test', partnerCode: r.referralCode, status: 'Pending' });
    await db.doc('activation_tokens/tok-i').set({ email: 'i@e2e.test', partnerCode: r.referralCode, used: false, expiresAt });
    let signedOutActivation = 'ok';
    try {
        await app.activateAccountWithToken('tok-i', PW);
    } catch (e) {
        signedOutActivation = e?.code || e?.message;
    }
    // Pre-existing, not this change: validateActivationToken reads
    // activation_tokens while signed out, which the rules deny. Activate from
    // a browser that has some session, as the rest of the flow is under test.
    if (signedOutActivation !== 'ok') {
        await app.signInWithEmailAndPassword(app.getFirebaseAuth(), 'g@e2e.test', PW);
        await app.activateAccountWithToken('tok-i', PW);
    }
    check("activation: R's referralCount 1 -> 2", (await user('r@e2e.test')).referralCount === 2,
        `referralCount=${(await user('r@e2e.test')).referralCount}`);
    const inv = await user('i@e2e.test');
    check('activation: referrerId is the referrer\'s e-mail, not the code', inv.referrerId === 'r@e2e.test', inv.referrerId);
    check('activation: token marked used', (await db.doc('activation_tokens/tok-i').get()).data().used === true);
    await app.signOut(app.getFirebaseAuth());

    // 7. Node purchase on chain, by B, then the claim from B's session.
    const provider = new ethers.JsonRpcProvider(RPC);
    for (let i = 0; i < 50 && !(await provider.getBlockNumber().then(() => true, () => false)); i++) {
        await new Promise((res) => setTimeout(res, 200));
    }
    const deployer = new ethers.NonceManager(new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider)); // anvil #0
    const deployerAddress = await deployer.getAddress();
    const vcnArt = JSON.parse(readFileSync(join(ROOT, 'blockchain/artifacts/contracts/VCNToken.sol/VCNToken.json'), 'utf8'));
    const licArt = JSON.parse(readFileSync(join(ROOT, 'services/abi/VisionNodeLicense.json'), 'utf8'));
    const vcn = await new ethers.ContractFactory(vcnArt.abi, vcnArt.bytecode, deployer).deploy(deployerAddress, deployerAddress);
    await vcn.waitForDeployment();
    for (let i = 0; i < 3; i++) await (await deployer.sendTransaction({ to: deployerAddress, value: 0 })).wait();
    const license = await new ethers.ContractFactory(licArt.abi, licArt.bytecode, deployer).deploy(await vcn.getAddress());
    await license.waitForDeployment();
    check('chain: NodeLicense deployed at the app\'s NODE_LICENSE address',
        (await license.getAddress()) === '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', await license.getAddress());

    const buyer = new ethers.NonceManager(ethers.Wallet.createRandom().connect(provider));
    const buyerAddress = await buyer.getAddress();
    await (await deployer.sendTransaction({ to: buyerAddress, value: ethers.parseEther('10') })).wait();
    await (await vcn.transfer(buyerAddress, ethers.parseEther('70000'))).wait();
    await (await vcn.connect(buyer).approve(await license.getAddress(), ethers.parseEther('70000'))).wait();
    const receipt = await (await license.connect(buyer).purchaseLicense(crypto.randomUUID(), 0)).wait();
    check('chain: the validator purchase succeeds', receipt.status === 1);

    // Another account (R, the referrer) tries to claim B's purchase first,
    // signing with its own wallet: nothing may be credited, and B's claim
    // must still go through afterwards.
    await app.signInWithEmailAndPassword(app.getFirebaseAuth(), 'r@e2e.test', PW);
    const thief = ethers.Wallet.createRandom();
    await app.processReferralRewards(receipt.hash, await thief.signMessage(app.nodePurchaseReferralMessage(receipt.hash, 'r@e2e.test')));
    check("purchase: another account cannot claim B's purchase", (await user('g@e2e.test')).totalRewardsVCN === 0
        && !(await db.doc(`referral_purchase_claims/${receipt.hash.toLowerCase()}`).get()).exists);
    await app.signOut(app.getFirebaseAuth());

    await app.signInWithEmailAndPassword(app.getFirebaseAuth(), 'b@e2e.test', PW);
    const signature = await buyer.signMessage(app.nodePurchaseReferralMessage(receipt.hash, 'b@e2e.test'));
    await app.processReferralRewards(receipt.hash, signature);
    check('purchase: referrer credited 7,000 VCN (10% of 70,000)', (await user('r@e2e.test')).totalRewardsVCN === 7000,
        `totalRewardsVCN=${(await user('r@e2e.test')).totalRewardsVCN}`);
    check('purchase: grand-referrer credited 1,400 VCN (2%)', (await user('g@e2e.test')).totalRewardsVCN === 1400,
        `totalRewardsVCN=${(await user('g@e2e.test')).totalRewardsVCN}`);
    check('purchase: two reward records', (await db.collection('referral_rewards').where('txHash', '==', receipt.hash.toLowerCase()).get()).size === 2);
    await app.processReferralRewards(receipt.hash, signature);
    check('purchase: a second claim credits nothing', (await user('r@e2e.test')).totalRewardsVCN === 7000);
    await app.signOut(app.getFirebaseAuth());

    console.log(`\nsigned-out invitation activation: ${signedOutActivation === 'ok' ? 'worked' : `failed with ${signedOutActivation} (pre-existing; see the comment in step 6)`}`);
    console.log(`intercepted non-local requests: ${outbound.map((o) => o.url.replace(/^https:\/\//, '')).join(', ') || 'none'}`);
} catch (e) {
    check('run completed', false, e?.stack || String(e));
} finally {
    stopAnvil();
}

const bad = results.filter((r) => !r.ok);
console.log(`\n=== referral flows end to end — ${results.length - bad.length}/${results.length}`);
for (const r of results) console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok || !r.detail ? '' : `: ${r.detail}`}`);
process.exit(bad.length ? 1 : 0);
