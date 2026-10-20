/**
 * Referral and signup bookkeeping on OTHER users' documents.
 *
 * P0 SECURITY. Signup, invitation activation and node purchases used to do
 * this from the browser, writing straight onto someone else's users document:
 *
 *   userRegister / activateAccountWithToken   referrer's referralCount + 1
 *   userRegister                              phoneDuplicateBlocked: true on
 *                                             every account sharing the phone
 *   processReferralRewards                    referrers' totalRewardsVCN/USD,
 *                                             amount taken from the caller
 *   getUserData                               referralCode on any email
 *
 * firestore.rules allowed each of those to any signed-in user, so anyone could
 * add 1 to anyone's referralCount, raise anyone's reward totals by any amount,
 * or set anyone's phoneDuplicateBlocked — a transfer block, so a griefing
 * tool. The rules no longer allow any of them; these two callables do the
 * writes instead, and each derives what it writes from something the caller
 * cannot choose:
 *
 *   completeSignup             once per account, only right after the Auth
 *                              account was created; the referrer comes from
 *                              resolving the referral code here, and the phone
 *                              from the caller's own stored document.
 *   creditNodePurchaseReferral once per purchase transaction; the purchase
 *                              and its tier come from the chain, the buyer is
 *                              proven by a signature from the buying wallet,
 *                              and the amount is the tier's price.
 *
 * (getUserData now fills in a missing referralCode only on the caller's own
 * document, which the owner may write, so it needs nothing here.)
 *
 * It lives in its own file so it can be tested without loading index.js (which
 * initialises Firebase and registers every function on require). See
 * test/referralLedger.test.cjs.
 */

/**
 * One document per account that went through completeSignup, id = lowercased
 * email. It is the server's record of who referred whom: the users document's
 * own `referrerId` is owner-writable, so a buyer could point it anywhere.
 * Server-only (firestore.rules lists it as a reward ledger).
 */
const SIGNUP_COLLECTION = "signup_records";

/** One document per node purchase already credited, id = lowercased tx hash. */
const PURCHASE_CLAIMS_COLLECTION = "referral_purchase_claims";

/** The reward records the admin console lists. Server-only now too. */
const REWARDS_COLLECTION = "referral_rewards";

/**
 * How long after the Auth account was created completeSignup still runs.
 * Accounts that existed before it did were credited by the old client code,
 * so crediting them again would count them twice; and a long-lived account
 * that could call it would be a free +1 for anyone it names. Both flows call
 * it seconds after createUserWithEmailAndPassword.
 */
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

/**
 * The node license contract the wallet buys from (ADDRESSES.NODE_LICENSE in
 * services/contractService.ts).
 *
 * As checked against https://api.visionchain.co/rpc-proxy on 2026-10-20, this
 * address has NO CODE on chain 3151909: it is the anvil/Hardhat address of the
 * fifth contract account #0 deploys, left over from a local deployment, like
 * the bridge lock address in bridgeGate.js. A purchase sent to it is a plain
 * call to an empty account: it succeeds, mints nothing and emits no
 * LicenseMinted, so no purchase verifies today and no reward is credited. That
 * is correct — there is no license to reward. When the contract is deployed,
 * put its address here and in contractService.ts.
 */
const DEFAULT_NODE_LICENSE_ADDRESSES = ["0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"];

const LICENSE_ABI = [
  "event LicenseMinted(address indexed owner, uint256 indexed tokenId, uint8 tier, uint256 multiplier)",
];

/**
 * Referral base per license tier, in VCN: the price contractService.ts
 * approves for each tier (the same figures the client used to send). Keyed by
 * the contract's NodeTier enum. FOUNDER (2) is handed out by the owner for
 * free and earns nothing. If the contract's price changes (setPrice), change
 * it here too: a purchase cannot have paid more than the client approved.
 */
const NODE_TIER_PRICE_VCN = { 0: 70000, 1: 500000 };

const REFERRAL_EVENT = "token_sale";
const DEFAULT_RATES = { tier1Rate: 0.10, tier2Rate: 0.02 };

const TX_HASH = /^0x[0-9a-f]{64}$/;
const MAX_CODE_LENGTH = 64;

/**
 * What the buyer's wallet signs to claim a purchase for their account. The
 * client builds the same string (nodePurchaseReferralMessage in
 * services/firebaseService.ts); the test checks the two agree.
 *
 * @param {string} txHash the purchase transaction hash
 * @param {string} email the buyer's account
 * @return {string} the message
 */
function nodePurchaseMessage(txHash, email) {
  return `Vision Chain referral claim\nNode purchase: ${String(txHash).toLowerCase()}\nAccount: ${String(email).toLowerCase()}`;
}

/**
 * The stored formats one phone number may appear in, for an exact `in` query.
 * Ported from searchUsersByPhone's first phase in services/firebaseService.ts,
 * which is what signup used. Two differences, both deliberate: the
 * "010-xxxx-xxxx" forms are added only for Korean numbers (the client added
 * them for any number of 10+ digits, so a US number could match a Korean one,
 * and a match here blocks transfers); and the suffix scan of every user that
 * the client fell back to is not ported, for the same reason.
 *
 * @param {string} phone the phone as stored on the users document
 * @return {string[]} at most 30 variants (Firestore's `in` limit)
 */
function phoneVariants(phone) {
  const stored = String(phone || "").trim();
  const digits = stored.replace(/\D/g, "");
  if (digits.length < 8) return [];

  const out = new Set([stored, stored.replace(/-/g, ""), digits]);
  if (digits.startsWith("82")) {
    const national = digits.slice(2);
    out.add("0" + national);
    out.add(national);
    out.add("+82" + national);
    out.add("+82-" + national);
  }
  if (digits.startsWith("0")) {
    out.add("+82" + digits.slice(1));
    out.add("82" + digits.slice(1));
  }
  const korean = digits.startsWith("8210") || digits.startsWith("010") || digits.startsWith("10");
  if (korean && digits.length >= 10) {
    const last8 = digits.slice(-8);
    out.add("010-" + last8.slice(0, 4) + "-" + last8.slice(4));
    out.add("010" + last8);
  }
  return [...out].filter(Boolean).slice(0, 30);
}

/**
 * A reward rate from the admin-set config, or the default when it is not a
 * fraction. referral_configs is admin-write-only in firestore.rules; the
 * bound is there so a typo cannot pay out several times a purchase.
 *
 * @param {*} value the configured rate
 * @param {number} fallback the default
 * @return {number} a rate in [0, 1]
 */
function rate(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
}

/** @param {number} x an amount @return {number} it, to 6 decimal places */
function round6(x) {
  return Math.round(x * 1e6) / 1e6;
}

/**
 * @param {object} deps
 * @param {object} deps.db an Admin SDK Firestore instance
 * @param {object} deps.FieldValue admin.firestore.FieldValue
 * @param {Function} deps.HttpsError firebase-functions' HttpsError
 * @param {object} deps.ethers ethers v6
 * @param {function(): object} deps.getProvider a Vision Chain JSON-RPC provider
 * @param {function(string): Promise<object>} deps.getAuthUser admin.auth().getUser
 * @param {function(): number} [deps.now] the clock, in ms
 * @param {string[]} [deps.nodeLicenseAddresses] contracts whose LicenseMinted counts
 * @return {{completeSignup: Function, creditNodePurchaseReferral: Function}}
 */
function createReferralLedger({
  db,
  FieldValue,
  HttpsError,
  ethers,
  getProvider,
  getAuthUser,
  now = () => Date.now(),
  nodeLicenseAddresses = DEFAULT_NODE_LICENSE_ADDRESSES,
}) {
  const users = db.collection("users");
  const licenseIface = new ethers.Interface(LICENSE_ABI);
  const licenseMinted = licenseIface.getEvent("LicenseMinted").topicHash;
  const licenses = new Set(nodeLicenseAddresses.map((a) => a.toLowerCase()));

  /**
   * @param {object} request a callable request
   * @return {string} the caller's lowercased email, from the verified token
   */
  function callerEmail(request) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Login required.");
    const email = request.auth.token?.email?.toLowerCase();
    if (!email) throw new HttpsError("failed-precondition", "User email missing from auth token.");
    return email;
  }

  /**
   * @param {string} code a referral code
   * @return {Promise<object|null>} the users document that owns it
   */
  async function findByReferralCode(code) {
    if (!code || code.length > MAX_CODE_LENGTH) return null;
    const snap = await users.where("referralCode", "==", code).limit(1).get();
    return snap.empty ? null : snap.docs[0];
  }

  /**
   * Who referred `email`, and who referred them. The signup record is the
   * server's own; accounts from before it existed fall back to the users
   * document's referrerId / grandReferrerId, which activateAccountWithToken
   * used to fill with the referral code rather than an email.
   *
   * @param {string} email a lowercased account email
   * @return {Promise<{referrer: string, grandReferrer: string}>} lowercased, '' if none
   */
  async function referrersOf(email) {
    const record = await db.collection(SIGNUP_COLLECTION).doc(email).get();
    let referrer;
    let grandReferrer;
    if (record.exists) {
      ({ referrer = "", grandReferrer = "" } = record.data());
    } else {
      const user = await users.doc(email).get();
      referrer = String(user.data()?.referrerId || "").trim();
      grandReferrer = String(user.data()?.grandReferrerId || "").trim();
      if (referrer && !referrer.includes("@")) {
        const owner = await findByReferralCode(referrer);
        referrer = owner ? owner.id : "";
      }
    }
    // The fallback fields are owner-writable; a "/" would make them a path.
    referrer = referrer.includes("/") ? "" : referrer.toLowerCase();
    grandReferrer = grandReferrer.includes("/") ? "" : grandReferrer.toLowerCase();
    if (referrer === email) referrer = "";
    if (!referrer || grandReferrer === email || grandReferrer === referrer) grandReferrer = "";
    return { referrer, grandReferrer };
  }

  /**
   * Accounts that hold the same phone number, as signup's duplicate check
   * found them: archived accounts never, and once the owner has chosen a
   * primary account for the number, only that one.
   *
   * @param {string} email the new account, left out
   * @param {string} phone its stored phone
   * @return {Promise<object[]>} document snapshots
   */
  async function phoneSharers(email, phone) {
    const variants = phoneVariants(phone);
    if (!variants.length) return [];
    const snap = await users.where("phone", "in", variants).get();
    const active = snap.docs.filter((d) =>
      d.id.toLowerCase() !== email && d.data().accountStatus !== "archived");
    const primary = active.filter((d) => d.data().isPhonePrimary === true);
    return primary.length ? primary : active;
  }

  /**
   * completeSignup: the referral credit and the duplicate-phone flagging that
   * signup and invitation activation used to write from the browser.
   *
   * request.data: { referralCode?: string } — the code the user signed up
   * with (activation passes its partnerCode). The referrer is whoever owns
   * that code now; the caller cannot name an account directly.
   *
   * @param {object} request the callable request
   * @return {Promise<object>} { credited, alreadyRecorded, referrer,
   *   grandReferrer, phoneDuplicate }
   */
  async function completeSignup(request) {
    const email = callerEmail(request);
    const recordRef = db.collection(SIGNUP_COLLECTION).doc(email);

    const summary = (r, credited) => ({
      credited,
      alreadyRecorded: !credited,
      referrer: r.referrer || "",
      grandReferrer: r.grandReferrer || "",
      phoneDuplicate: (r.phoneSharers || []).length > 0,
    });

    const existing = await recordRef.get();
    if (existing.exists) return summary(existing.data(), false);

    const authUser = await getAuthUser(request.auth.uid);
    const created = Date.parse(authUser?.metadata?.creationTime || "");
    if (!Number.isFinite(created) || now() - created > SIGNUP_WINDOW_MS) {
      throw new HttpsError("failed-precondition", "Signup bookkeeping runs once, right after the account is created.");
    }

    const code = String(request.data?.referralCode || "").trim();
    const owner = await findByReferralCode(code);
    let referrer = owner ? owner.id.toLowerCase() : "";
    if (referrer === email) referrer = "";
    let grandReferrer = referrer ? (await referrersOf(referrer)).referrer : "";
    if (grandReferrer === email) grandReferrer = "";

    const callerRef = users.doc(email);
    const caller = await callerRef.get();
    const phone = caller.exists ? String(caller.data().phone || "") : "";
    const sharers = phone ? await phoneSharers(email, phone) : [];

    return db.runTransaction(async (tx) => {
      const again = await tx.get(recordRef);
      if (again.exists) return summary(again.data(), false);

      const record = {
        email,
        referralCode: owner ? code : "",
        referrer,
        grandReferrer,
        phone,
        phoneSharers: sharers.map((d) => d.id),
        createdAt: FieldValue.serverTimestamp(),
      };
      tx.create(recordRef, record);

      if (referrer) {
        tx.update(owner.ref, { referralCount: FieldValue.increment(1) });
      }

      const blockedAt = new Date(now()).toISOString();
      for (const d of sharers) {
        tx.set(d.ref, { phoneDuplicateBlocked: true, phoneDuplicateBlockedAt: blockedAt }, { merge: true });
      }

      if (caller.exists && (referrer || sharers.length)) {
        tx.set(callerRef, {
          // The relationship that was credited, so the document agrees with
          // the record (activation used to store the code here, not an email).
          ...(referrer ? { referrerId: referrer, grandReferrerId: grandReferrer } : {}),
          ...(sharers.length ? { phoneDuplicateBlocked: true, phoneDuplicateBlockedAt: blockedAt } : {}),
        }, { merge: true });
      }

      return summary(record, true);
    });
  }

  /**
   * The license a transaction bought, from the chain.
   *
   * @param {string} txHash a lowercased transaction hash
   * @return {Promise<{owner: string, tier: number, tokenId: string}>} the mint
   */
  async function readNodePurchase(txHash) {
    let receipt;
    try {
      receipt = await getProvider().getTransactionReceipt(txHash);
    } catch (e) {
      throw new HttpsError("unavailable", "Could not reach Vision Chain to verify the purchase. Try again.");
    }
    if (!receipt) throw new HttpsError("not-found", "That transaction is not on chain (yet).");
    if (receipt.status !== 1) throw new HttpsError("failed-precondition", "That transaction reverted.");

    const mints = (receipt.logs || []).filter((l) =>
      licenses.has(String(l.address).toLowerCase()) && l.topics?.[0] === licenseMinted);
    if (mints.length !== 1) {
      throw new HttpsError("failed-precondition", "That transaction did not buy a node license.");
    }
    const ev = licenseIface.parseLog(mints[0]);
    return { owner: ev.args.owner, tier: Number(ev.args.tier), tokenId: ev.args.tokenId.toString() };
  }

  /**
   * creditNodePurchaseReferral: the referral rewards for a node purchase,
   * which processReferralRewards used to write from the buyer's browser with
   * an amount the browser chose.
   *
   * request.data: { txHash: string, signature: string } — the purchase
   * transaction, and the buying wallet's signature over
   * nodePurchaseMessage(txHash, caller's email). The signature is what ties a
   * purchase on chain to this account; without it anyone could claim someone
   * else's purchase for their own referrer, and the buyer's real referrer would
   * then be refused.
   *
   * @param {object} request the callable request
   * @return {Promise<object>} { credited, amountVcn, rewards: [{to, tier, amount}] }
   */
  async function creditNodePurchaseReferral(request) {
    const email = callerEmail(request);
    const txHash = String(request.data?.txHash || "").toLowerCase();
    const signature = String(request.data?.signature || "");
    if (!TX_HASH.test(txHash)) throw new HttpsError("invalid-argument", "txHash must be a transaction hash.");
    if (!signature) throw new HttpsError("invalid-argument", "signature is required.");

    const claimRef = db.collection(PURCHASE_CLAIMS_COLLECTION).doc(txHash);
    if ((await claimRef.get()).exists) return { credited: false, alreadyCredited: true };

    const purchase = await readNodePurchase(txHash);

    let signer;
    try {
      signer = ethers.verifyMessage(nodePurchaseMessage(txHash, email), signature);
    } catch (e) {
      throw new HttpsError("invalid-argument", "signature is not a valid wallet signature.");
    }
    if (signer.toLowerCase() !== purchase.owner.toLowerCase()) {
      throw new HttpsError("permission-denied", "That purchase was not made by this account's wallet.");
    }

    const price = NODE_TIER_PRICE_VCN[purchase.tier];
    if (!price) throw new HttpsError("failed-precondition", "This license tier earns no referral reward.");

    const config = (await db.collection("referral_configs").doc("global").get()).data() || {};
    const enabled = !Array.isArray(config.enabledEvents) || config.enabledEvents.includes(REFERRAL_EVENT);
    const rates = [rate(config.tier1Rate, DEFAULT_RATES.tier1Rate), rate(config.tier2Rate, DEFAULT_RATES.tier2Rate)];

    const { referrer, grandReferrer } = enabled ? await referrersOf(email) : { referrer: "", grandReferrer: "" };

    return db.runTransaction(async (tx) => {
      if ((await tx.get(claimRef)).exists) return { credited: false, alreadyCredited: true };

      // Reads before writes: only referrers that still have an account earn.
      const tiers = [];
      for (const [i, to] of [referrer, grandReferrer].entries()) {
        if (!to) continue;
        const ref = users.doc(to);
        if ((await tx.get(ref)).exists) tiers.push({ to, ref, tier: i + 1, rate: rates[i] });
      }

      const timestamp = new Date(now()).toISOString();
      const rewards = [];
      for (const t of tiers) {
        const amount = round6(price * t.rate);
        if (amount <= 0) continue;
        tx.set(db.collection(REWARDS_COLLECTION).doc(`${txHash}_${t.tier}`), {
          userId: t.to,
          fromUserId: email,
          amount,
          currency: "VCN",
          tier: t.tier,
          event: REFERRAL_EVENT,
          percentage: t.rate,
          status: "pending",
          timestamp,
          txHash,
        });
        tx.update(t.ref, { totalRewardsVCN: FieldValue.increment(amount) });
        rewards.push({ to: t.to, tier: t.tier, amount });
      }

      tx.create(claimRef, {
        buyer: email,
        wallet: purchase.owner,
        tokenId: purchase.tokenId,
        licenseTier: purchase.tier,
        amountVcn: price,
        rewards,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { credited: true, amountVcn: price, rewards };
    });
  }

  return { completeSignup, creditNodePurchaseReferral };
}

module.exports = {
  createReferralLedger,
  nodePurchaseMessage,
  phoneVariants,
  SIGNUP_COLLECTION,
  PURCHASE_CLAIMS_COLLECTION,
  REWARDS_COLLECTION,
  SIGNUP_WINDOW_MS,
  NODE_TIER_PRICE_VCN,
  DEFAULT_NODE_LICENSE_ADDRESSES,
};
