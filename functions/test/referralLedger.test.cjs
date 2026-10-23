/**
 * Tests for the referral ledger (functions/referralLedger.js): the two
 * callables that write the referral count, duplicate-phone flags and referral
 * reward totals onto OTHER users' documents, which the browser used to write
 * itself.
 *
 * The cases that matter are the ones a forger would try: crediting a referrer
 * twice, from an old account, or by naming them; claiming somebody else's
 * node purchase; inflating the amount; and blocking an unrelated account by
 * phone. And the real flows still crediting what they should.
 *
 * Firestore is the real emulator, driven through the Admin SDK, because the
 * queries (phone `in`, referral code) and the transactions are what is under
 * test. The chain and Auth are fakes; real ethers signs messages and encodes
 * the LicenseMinted log, so a wrong event layout or message fails here the way
 * it would in production.
 *
 * Run (needs functions/node_modules and Java):
 *   npx firebase emulators:exec --only firestore --project demo-referrals \
 *     'node functions/test/referralLedger.test.cjs'
 */

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("FIRESTORE_EMULATOR_HOST is not set. Run this under `firebase emulators:exec` (see the header);\n" +
    "it writes to Firestore and must never run against a real project.");
  process.exit(2);
}

const admin = require("firebase-admin");
const { ethers } = require("ethers");
const {
  createReferralLedger,
  nodePurchaseMessage,
  phoneVariants,
  SIGNUP_COLLECTION,
  PURCHASE_CLAIMS_COLLECTION,
  REWARDS_COLLECTION,
  SIGNUP_WINDOW_MS,
} = require("../referralLedger");

const PROJECT = "demo-referrals";
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const { FieldValue } = admin.firestore;

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const NOW = Date.parse("2026-10-20T00:00:00Z");
const LICENSE = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const OTHER_CONTRACT = "0x28F40F9Da1c6D3c38fFDC1Fba80364B6bb21A1E3";

/** Auth accounts by uid: how long ago each was created. */
const AUTH = {};
/** Receipts by lowercased tx hash. */
const RECEIPTS = {};
let rpcDown = false;

const ledger = createReferralLedger({
  db,
  FieldValue,
  HttpsError,
  ethers,
  now: () => NOW,
  getAuthUser: async (uid) => {
    if (!AUTH[uid]) throw new Error("auth/user-not-found");
    return { uid, metadata: { creationTime: new Date(NOW - AUTH[uid]).toUTCString() } };
  },
  getProvider: () => ({
    getTransactionReceipt: async (hash) => {
      if (rpcDown) throw new Error("ECONNREFUSED");
      return RECEIPTS[hash.toLowerCase()] || null;
    },
  }),
});

const licenseIface = new ethers.Interface([
  "event LicenseMinted(address indexed owner, uint256 indexed tokenId, uint8 tier, uint256 multiplier)",
]);

let txCounter = 0;
/**
 * Puts a purchase receipt on the fake chain.
 * @return {string} its tx hash
 */
function purchase({ owner, tier = 0, status = 1, address = LICENSE, mints = 1 }) {
  const hash = "0x" + (++txCounter).toString(16).padStart(64, "0");
  const logs = [];
  for (let i = 0; i < mints; i++) {
    const { data, topics } = licenseIface.encodeEventLog("LicenseMinted", [owner, 100 + i, tier, tier === 1 ? 12 : 1]);
    logs.push({ address, data, topics });
  }
  RECEIPTS[hash] = { status, logs };
  return hash;
}

/** A signed-in caller, as a callable sees it. */
function caller(email, uid = email, data = {}) {
  return { auth: { uid, token: { email } }, data };
}

async function clearFirestore() {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  const res = await fetch(`http://${host}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
  if (!res.ok) throw new Error(`could not clear the emulator: ${res.status}`);
}

const user = async (email) => (await db.doc(`users/${email}`).get()).data();
const seed = (path, data) => db.doc(path).set(data);
const rejects = (p, code) => assert.rejects(p, (e) => {
  assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`);
  return true;
});

const cases = [];
const test = (name, fn) => cases.push([name, fn]);

// ============================== completeSignup ==============================

test("signup: no auth is refused", () => rejects(ledger.completeSignup({ data: {} }), "unauthenticated"));

test("signup: a new account with a referral code adds exactly 1 to the referrer", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referralCount: 4 });
  await seed("users/new@x.com", { email: "new@x.com", referrerId: "ref@x.com" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  assert.equal(r.credited, true);
  assert.equal(r.referrer, "ref@x.com");
  assert.equal((await user("ref@x.com")).referralCount, 5);
  const rec = (await db.doc(`${SIGNUP_COLLECTION}/new@x.com`).get()).data();
  assert.equal(rec.referrer, "ref@x.com");
  assert.equal(rec.referralCode, "REF001");
});

test("signup: calling again does not count the referral again", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referralCount: 0 });
  await seed("users/new@x.com", { email: "new@x.com" });
  AUTH["new@x.com"] = 5000;
  await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  const again = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  assert.equal(again.credited, false);
  assert.equal(again.alreadyRecorded, true);
  assert.equal((await user("ref@x.com")).referralCount, 1);
});

test("signup: five concurrent calls count the referral once", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referralCount: 0 });
  await seed("users/new@x.com", { email: "new@x.com" });
  AUTH["new@x.com"] = 5000;
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }))));
  assert.equal(results.filter((r) => r.credited).length, 1);
  assert.equal((await user("ref@x.com")).referralCount, 1);
});

test("signup: an account older than the signup window is refused and writes nothing", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referralCount: 0 });
  await seed("users/old@x.com", { email: "old@x.com", phone: "+82-10-1111-2222" });
  await seed("users/victim@x.com", { email: "victim@x.com", phone: "+82-10-1111-2222" });
  AUTH["old@x.com"] = SIGNUP_WINDOW_MS + 1000;
  await rejects(ledger.completeSignup(caller("old@x.com", "old@x.com", { referralCode: "REF001" })), "failed-precondition");
  assert.equal((await user("ref@x.com")).referralCount, 0);
  assert.equal((await user("victim@x.com")).phoneDuplicateBlocked, undefined);
  assert.equal((await db.doc(`${SIGNUP_COLLECTION}/old@x.com`).get()).exists, false);
});

test("signup: an unknown code credits nobody, and a real code later does not either", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referralCount: 0 });
  await seed("users/new@x.com", { email: "new@x.com" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "NOPE" }));
  assert.equal(r.credited, true); // the signup is recorded…
  assert.equal(r.referrer, ""); // …with no referrer
  await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  assert.equal((await user("ref@x.com")).referralCount, 0);
});

test("signup: an account cannot refer itself", async () => {
  await seed("users/new@x.com", { email: "new@x.com", referralCode: "SELF01", referralCount: 0 });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "SELF01" }));
  assert.equal(r.referrer, "");
  assert.equal((await user("new@x.com")).referralCount, 0);
});

test("signup: the referrer's own referrer becomes the grand-referrer (from its signup record)", async () => {
  await seed("users/gr@x.com", { email: "gr@x.com", referralCode: "GR0001", referralCount: 1 });
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referrerId: "forged@x.com" });
  await seed(`${SIGNUP_COLLECTION}/ref@x.com`, { referrer: "gr@x.com", grandReferrer: "" });
  await seed("users/new@x.com", { email: "new@x.com", referrerId: "REF001", grandReferrerId: "junk" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  assert.equal(r.grandReferrer, "gr@x.com");
  assert.equal((await user("gr@x.com")).referralCount, 1, "only the direct referrer is counted");
  const doc = await user("new@x.com");
  assert.equal(doc.referrerId, "ref@x.com", "the document now names the credited referrer, not the code");
  assert.equal(doc.grandReferrerId, "gr@x.com");
});

test("signup: a legacy referrer's grand-referrer comes from its users document", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referrerId: "GR@x.com" });
  await seed("users/new@x.com", { email: "new@x.com" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  assert.equal(r.grandReferrer, "gr@x.com");
});

test("signup: a grand-referrer that is the new account itself is dropped", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", referrerId: "new@x.com" });
  await seed("users/new@x.com", { email: "new@x.com" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com", "new@x.com", { referralCode: "REF001" }));
  assert.equal(r.referrer, "ref@x.com");
  assert.equal(r.grandReferrer, "");
});

test("signup: a shared phone flags every account holding it, in any stored format, and the new one", async () => {
  await seed("users/a@x.com", { email: "a@x.com", phone: "010-1234-5678" });
  await seed("users/b@x.com", { email: "b@x.com", phone: "+821012345678" });
  await seed("users/c@x.com", { email: "c@x.com", phone: "01012345678" });
  await seed("users/archived@x.com", { email: "archived@x.com", phone: "+82-10-1234-5678", accountStatus: "archived" });
  await seed("users/other@x.com", { email: "other@x.com", phone: "+82-10-9999-0000" });
  await seed("users/new@x.com", { email: "new@x.com", phone: "+82-10-1234-5678" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com"));
  assert.equal(r.phoneDuplicate, true);
  for (const e of ["a@x.com", "b@x.com", "c@x.com", "new@x.com"]) {
    assert.equal((await user(e)).phoneDuplicateBlocked, true, `${e} should be flagged`);
  }
  for (const e of ["archived@x.com", "other@x.com"]) {
    assert.equal((await user(e)).phoneDuplicateBlocked, undefined, `${e} should not be flagged`);
  }
});

test("signup: a non-Korean number does not match a Korean one with the same last 8 digits", async () => {
  // searchUsersByPhone added "010-xxxx-xxxx" forms for any 10+ digit number.
  await seed("users/kr@x.com", { email: "kr@x.com", phone: "010-1234-5678" });
  await seed("users/new@x.com", { email: "new@x.com", phone: "+14151234 5678".replace(" ", "") });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com"));
  assert.equal(r.phoneDuplicate, false);
  assert.equal((await user("kr@x.com")).phoneDuplicateBlocked, undefined);
});

test("signup: once the number has a primary account, only that one is flagged", async () => {
  await seed("users/primary@x.com", { email: "primary@x.com", phone: "+82-10-1234-5678", isPhonePrimary: true });
  await seed("users/second@x.com", { email: "second@x.com", phone: "+82-10-1234-5678", isPhonePrimary: false, accountStatus: "secondary" });
  await seed("users/new@x.com", { email: "new@x.com", phone: "+82-10-1234-5678" });
  AUTH["new@x.com"] = 5000;
  await ledger.completeSignup(caller("new@x.com"));
  assert.equal((await user("primary@x.com")).phoneDuplicateBlocked, true);
  assert.equal((await user("second@x.com")).phoneDuplicateBlocked, undefined);
});

test("signup: no duplicate, no flags (and none on the new account)", async () => {
  await seed("users/other@x.com", { email: "other@x.com", phone: "+82-10-9999-0000" });
  await seed("users/new@x.com", { email: "new@x.com", phone: "+82-10-1234-5678" });
  AUTH["new@x.com"] = 5000;
  const r = await ledger.completeSignup(caller("new@x.com"));
  assert.equal(r.phoneDuplicate, false);
  assert.equal((await user("new@x.com")).phoneDuplicateBlocked, undefined);
  assert.equal((await user("other@x.com")).phoneDuplicateBlocked, undefined);
});

test("signup: the phone comes from the caller's stored document, not the request", async () => {
  await seed("users/victim@x.com", { email: "victim@x.com", phone: "+82-10-5555-6666" });
  await seed("users/new@x.com", { email: "new@x.com", phone: "+82-10-1234-5678" });
  AUTH["new@x.com"] = 5000;
  await ledger.completeSignup(caller("new@x.com", "new@x.com", { phone: "+82-10-5555-6666" }));
  assert.equal((await user("victim@x.com")).phoneDuplicateBlocked, undefined);
});

test("phoneVariants: short numbers match nothing", () => {
  assert.deepEqual(phoneVariants("12345"), []);
  assert.deepEqual(phoneVariants(""), []);
});

// ========================= creditNodePurchaseReferral =======================

/** Buyer `buyer@x.com` referred by ref@x.com, who was referred by gr@x.com. */
async function seedReferralChain() {
  await seed("users/gr@x.com", { email: "gr@x.com", totalRewardsVCN: 0 });
  await seed("users/ref@x.com", { email: "ref@x.com", totalRewardsVCN: 5 });
  await seed("users/buyer@x.com", { email: "buyer@x.com", referrerId: "ref@x.com", grandReferrerId: "gr@x.com" });
  await seed(`${SIGNUP_COLLECTION}/buyer@x.com`, { referrer: "ref@x.com", grandReferrer: "gr@x.com" });
  await seed("referral_configs/global", { tier1Rate: 0.1, tier2Rate: 0.02, enabledEvents: ["token_sale", "staking"] });
}
const buyerWallet = ethers.Wallet.createRandom();
const claim = async (email, hash, wallet = buyerWallet, signedFor = email) =>
  ledger.creditNodePurchaseReferral(caller(email, email, {
    txHash: hash,
    signature: await wallet.signMessage(nodePurchaseMessage(hash, signedFor)),
  }));

test("purchase: no auth is refused", () =>
  rejects(ledger.creditNodePurchaseReferral({ data: { txHash: "0x" + "0".repeat(64), signature: "0x" } }), "unauthenticated"));

test("purchase: a malformed tx hash is refused", () =>
  rejects(ledger.creditNodePurchaseReferral(caller("buyer@x.com", "b", { txHash: "0x1234", signature: "0x" })), "invalid-argument"));

test("purchase: a validator purchase credits 10% and 2% of 70,000 VCN, once", async () => {
  await seedReferralChain();
  const hash = purchase({ owner: buyerWallet.address, tier: 0 });
  const r = await claim("buyer@x.com", hash);
  assert.equal(r.credited, true);
  assert.equal(r.amountVcn, 70000);
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 7005);
  assert.equal((await user("gr@x.com")).totalRewardsVCN, 1400);
  const t1 = (await db.doc(`${REWARDS_COLLECTION}/${hash}_1`).get()).data();
  assert.deepEqual([t1.userId, t1.fromUserId, t1.amount, t1.tier, t1.status, t1.txHash],
    ["ref@x.com", "buyer@x.com", 7000, 1, "pending", hash]);
  const t2 = (await db.doc(`${REWARDS_COLLECTION}/${hash}_2`).get()).data();
  assert.deepEqual([t2.userId, t2.amount, t2.tier], ["gr@x.com", 1400, 2]);

  const again = await claim("buyer@x.com", hash);
  assert.equal(again.credited, false);
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 7005);
});

test("purchase: concurrent claims of one purchase credit it once", async () => {
  await seedReferralChain();
  const hash = purchase({ owner: buyerWallet.address, tier: 0 });
  const results = await Promise.all(Array.from({ length: 4 }, () => claim("buyer@x.com", hash)));
  assert.equal(results.filter((r) => r.credited).length, 1);
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 7005);
});

test("purchase: an enterprise purchase is worth 500,000 VCN", async () => {
  await seedReferralChain();
  const r = await claim("buyer@x.com", purchase({ owner: buyerWallet.address, tier: 1 }));
  assert.equal(r.amountVcn, 500000);
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 50005);
  assert.equal((await user("gr@x.com")).totalRewardsVCN, 10000);
});

test("purchase: a founder license (free) earns nothing", async () => {
  await seedReferralChain();
  await rejects(claim("buyer@x.com", purchase({ owner: buyerWallet.address, tier: 2 })), "failed-precondition");
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 5);
});

test("purchase: someone else's purchase cannot be claimed for your referrer", async () => {
  await seedReferralChain();
  await seed("users/thief@x.com", { email: "thief@x.com" });
  await seed(`${SIGNUP_COLLECTION}/thief@x.com`, { referrer: "ref@x.com", grandReferrer: "" });
  const thiefWallet = ethers.Wallet.createRandom();
  const hash = purchase({ owner: buyerWallet.address, tier: 0 });
  await rejects(claim("thief@x.com", hash, thiefWallet), "permission-denied");
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 5);
  // …and the real buyer can still claim it.
  assert.equal((await claim("buyer@x.com", hash)).credited, true);
});

test("purchase: the buyer's signature for one account does not work for another", async () => {
  await seedReferralChain();
  await seed("users/alt@x.com", { email: "alt@x.com" });
  await seed(`${SIGNUP_COLLECTION}/alt@x.com`, { referrer: "gr@x.com", grandReferrer: "" });
  const hash = purchase({ owner: buyerWallet.address, tier: 0 });
  await rejects(claim("alt@x.com", hash, buyerWallet, "buyer@x.com"), "permission-denied");
});

test("purchase: a garbage signature is refused", async () => {
  await seedReferralChain();
  const hash = purchase({ owner: buyerWallet.address, tier: 0 });
  await rejects(ledger.creditNodePurchaseReferral(caller("buyer@x.com", "b", { txHash: hash, signature: "0xdeadbeef" })), "invalid-argument");
});

test("purchase: a transaction that is not on chain is not found", async () => {
  await seedReferralChain();
  await rejects(claim("buyer@x.com", "0x" + "f".repeat(64)), "not-found");
});

test("purchase: a reverted transaction earns nothing", async () => {
  await seedReferralChain();
  await rejects(claim("buyer@x.com", purchase({ owner: buyerWallet.address, status: 0 })), "failed-precondition");
});

test("purchase: a LicenseMinted from any other contract earns nothing", async () => {
  await seedReferralChain();
  await rejects(claim("buyer@x.com", purchase({ owner: buyerWallet.address, address: OTHER_CONTRACT })), "failed-precondition");
});

test("purchase: a transaction minting two licenses is refused rather than guessed at", async () => {
  await seedReferralChain();
  await rejects(claim("buyer@x.com", purchase({ owner: buyerWallet.address, mints: 2 })), "failed-precondition");
});

test("purchase: an unreachable chain is retryable, not a refusal", async () => {
  await seedReferralChain();
  const hash = purchase({ owner: buyerWallet.address });
  rpcDown = true;
  try {
    await rejects(claim("buyer@x.com", hash), "unavailable");
  } finally {
    rpcDown = false;
  }
  assert.equal((await claim("buyer@x.com", hash)).credited, true);
});

test("purchase: the referrer comes from the signup record, not the buyer's own document", async () => {
  await seedReferralChain();
  await seed("users/alt@x.com", { email: "alt@x.com", totalRewardsVCN: 0 });
  await db.doc("users/buyer@x.com").update({ referrerId: "alt@x.com", grandReferrerId: "alt@x.com" });
  await claim("buyer@x.com", purchase({ owner: buyerWallet.address }));
  assert.equal((await user("alt@x.com")).totalRewardsVCN, 0);
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 7005);
});

test("purchase: a legacy buyer whose referrerId is a referral code pays that code's owner", async () => {
  await seed("users/ref@x.com", { email: "ref@x.com", referralCode: "REF001", totalRewardsVCN: 0 });
  await seed("users/legacy@x.com", { email: "legacy@x.com", referrerId: "REF001" });
  const r = await claim("legacy@x.com", purchase({ owner: buyerWallet.address }));
  assert.deepEqual(r.rewards, [{ to: "ref@x.com", tier: 1, amount: 7000 }]);
});

test("purchase: an out-of-range rate in the config falls back to the default", async () => {
  await seedReferralChain();
  await seed("referral_configs/global", { tier1Rate: 1000, tier2Rate: -1, enabledEvents: ["token_sale"] });
  await claim("buyer@x.com", purchase({ owner: buyerWallet.address }));
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 7005);
  assert.equal((await user("gr@x.com")).totalRewardsVCN, 1400);
});

test("purchase: with token_sale disabled nothing is credited, and the purchase is settled", async () => {
  await seedReferralChain();
  await seed("referral_configs/global", { tier1Rate: 0.1, tier2Rate: 0.02, enabledEvents: ["staking"] });
  const hash = purchase({ owner: buyerWallet.address });
  const r = await claim("buyer@x.com", hash);
  assert.deepEqual(r.rewards, []);
  assert.equal((await user("ref@x.com")).totalRewardsVCN, 5);
  assert.equal((await db.doc(`${PURCHASE_CLAIMS_COLLECTION}/${hash}`).get()).exists, true);
});

test("purchase: a referrer with no account is skipped", async () => {
  await seedReferralChain();
  await db.doc("users/gr@x.com").delete();
  const r = await claim("buyer@x.com", purchase({ owner: buyerWallet.address }));
  assert.deepEqual(r.rewards.map((x) => x.to), ["ref@x.com"]);
});

test("purchase: the client's message is the server's message", () => {
  const src = readFileSync(join(__dirname, "../../services/firebaseService.ts"), "utf8");
  const m = src.match(/nodePurchaseReferralMessage = \(txHash: string, email: string\): string =>\s*`([^`]*)`/);
  assert.ok(m, "nodePurchaseReferralMessage not found in services/firebaseService.ts");
  const hash = "0x" + "AB".repeat(32);
  const client = m[1]
    .replace("${txHash.toLowerCase()}", hash.toLowerCase())
    .replace("${email.toLowerCase()}", "buyer@x.com")
    .replace(/\\n/g, "\n");
  assert.equal(client, nodePurchaseMessage(hash, "Buyer@X.com"));
});

// ================================== runner ==================================

(async () => {
  let failed = 0;
  for (const [name, fn] of cases) {
    await clearFirestore();
    try {
      await fn();
      console.log(`  ok    ${name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL  ${name}\n        ${e.message.split("\n").join("\n        ")}`);
    }
  }
  console.log(`\n${cases.length - failed}/${cases.length} passed`);
  process.exit(failed ? 1 : 0);
})();
