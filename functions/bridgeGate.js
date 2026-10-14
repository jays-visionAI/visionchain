/**
 * Bridge payout gate.
 *
 * P0 SECURITY. Two scheduled relayers poll the `transactions` collection and
 * pay out a document's `value` to its `recipient`:
 *
 *   executeSepoliaBridgeTransfer      mints VCN on Sepolia
 *   executeVisionChainBridgeTransfer  sends native VCN from the executor wallet
 *   finalizeAndMint                   mints VCN on Sepolia
 *
 * Those documents are not trustworthy input. `firestore.rules` grants
 * `allow read, write: if true` on that collection, so an anonymous caller can
 * create one, and nothing checked the source chain — which made a forged
 * document a mint, or a direct withdrawal from the executor wallet. This
 * module makes the source chain the authority and the document merely a
 * pointer to it.
 *
 * No event ABI is involved, deliberately. The only producer of a payable
 * bridge record is the agent gateway, which calls
 *
 *     lockVCN(bytes32 intentHash, address recipient, uint256 destChainId)
 *
 * with `value: amountWei`, and records the hash only after the lock is mined.
 * So the lock transaction itself carries everything that matters: its `value`
 * IS the locked amount and its calldata names the recipient. A forged record
 * cannot point at such a transaction, and a real one always can.
 *
 * It lives in its own file so it can be tested without loading index.js (which
 * initialises Firebase and registers every function on require). See
 * test/bridgeGate.test.cjs.
 */

/**
 * Addresses that may legitimately hold a lock. Keep this in step with the
 * `lockVCN` call sites in index.js; an address missing here holds payouts
 * rather than losing them, which is the safe direction to be wrong in.
 *
 * As checked against https://rpc.visionchain.co on 2026-10-14, this address
 * has NO CODE on chain 3151909 — it is an anvil-deterministic address left
 * over from a local deployment, and the chain has been reset since. So no
 * bridge can verify today, which is correct: there is no lock contract to
 * lock into. When the bridge is redeployed, put the new address here.
 */
const DEFAULT_LOCK_CONTRACTS = [
  "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
];

const LOCK_VCN_ABI = [
  "function lockVCN(bytes32 intentHash, address recipient, uint256 destChainId) payable",
];

/** The collection of locks already paid. One document per lock, id = lock hash. */
const CONSUMED_COLLECTION = "bridge_locks_consumed";

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Thrown when a record cannot be matched to a real lock. Not a transient failure. */
class BridgeUnverified extends Error {
  /** @param {string} reason why the record was not payable */
  constructor(reason) {
    super(`BRIDGE_UNVERIFIED: ${reason}`);
    this.name = "BridgeUnverified";
    /** Lets the relayers tell "held" apart from "retry me". */
    this.unverified = true;
  }
}

/**
 * Build the gate against injected dependencies, so a test can supply a fake
 * chain and a fake Firestore.
 *
 * @param {object} deps injected dependencies
 * @param {object} deps.ethers the ethers module
 * @param {function} deps.getProvider returns a provider for the SOURCE chain
 * @param {object} deps.db a Firestore instance
 * @param {function} deps.timestamp returns the value to stamp a claim with
 * @param {string[]} [deps.lockContracts] addresses allowed to hold a lock
 * @param {object} [deps.logger] console-like
 * @return {object} `{ readBridgeLock, consumeBridgeLock, releaseBridgeLock, authorizeBridgePayout }`
 */
function createBridgeGate({
  ethers,
  getProvider,
  db,
  timestamp,
  lockContracts = DEFAULT_LOCK_CONTRACTS,
  logger = console,
}) {
  const allowedLockTargets = lockContracts.map((a) => a.toLowerCase());
  const lockIface = new ethers.Interface(LOCK_VCN_ABI);

  /**
   * Read the authoritative terms of a bridge from its source-chain lock.
   *
   * @param {string} lockTxHash lock transaction hash on the source chain
   * @return {Promise<object>} `{ ok, amountWei, recipient, intentHash, reason, retryable }`
   */
  async function readBridgeLock(lockTxHash) {
    if (typeof lockTxHash !== "string" || !TX_HASH.test(lockTxHash)) {
      return { ok: false, reason: `not a transaction hash: ${lockTxHash}` };
    }

    let tx;
    let receipt;
    try {
      const provider = getProvider();
      [tx, receipt] = await Promise.all([
        provider.getTransaction(lockTxHash),
        provider.getTransactionReceipt(lockTxHash),
      ]);
    } catch (err) {
      // An unreachable RPC is not evidence of forgery. Say so, so the caller
      // holds the record for the next run instead of marking it bogus.
      return { ok: false, retryable: true, reason: `source chain unreachable: ${err.message}` };
    }

    if (!tx || !receipt) {
      return { ok: false, reason: "no such transaction on the source chain" };
    }
    if (Number(receipt.status) !== 1) {
      return { ok: false, reason: "the lock transaction reverted" };
    }
    if (!allowedLockTargets.includes(String(tx.to || "").toLowerCase())) {
      return { ok: false, reason: `not sent to a bridge lock contract (to=${tx.to})` };
    }

    let decoded;
    try {
      decoded = lockIface.decodeFunctionData("lockVCN", tx.data);
    } catch (err) {
      return { ok: false, reason: "the transaction is not a lockVCN call" };
    }
    if (BigInt(tx.value) === 0n) {
      return { ok: false, reason: "the lock transaction locked nothing" };
    }

    return {
      ok: true,
      amountWei: BigInt(tx.value),
      recipient: decoded[1],
      intentHash: decoded[0],
    };
  }

  /**
   * Claim a lock for exactly one payout. The document id IS the lock hash and
   * `create` fails when it already exists, so two relayers racing the same
   * lock — or two records naming it, which is what the client's duplicate
   * bridge write produced — cannot both pay.
   *
   * @param {string} lockTxHash the lock being claimed
   * @param {object} context what is being paid, for the audit trail
   * @return {Promise<object>} `{ ok, reason }`
   */
  async function consumeBridgeLock(lockTxHash, context) {
    try {
      await db.collection(CONSUMED_COLLECTION).doc(String(lockTxHash).toLowerCase()).create({
        ...context,
        consumedAt: timestamp(),
      });
      return { ok: true };
    } catch (err) {
      if (err.code === 6 || /ALREADY_EXISTS/i.test(err.message || "")) {
        return { ok: false, reason: "this lock has already been paid out" };
      }
      throw err;
    }
  }

  /**
   * Give a claimed lock back, for the paths that claim one and then do not
   * pay: the "simulate" branches in index.js return a fake hash when the
   * destination contract is unconfigured or the wallet is out of gas. Without
   * this, such a run would consume the lock and the real payout could never
   * be made.
   *
   * @param {string} lockTxHash the lock to release
   * @return {Promise<void>} nothing
   */
  async function releaseBridgeLock(lockTxHash) {
    try {
      await db.collection(CONSUMED_COLLECTION).doc(String(lockTxHash).toLowerCase()).delete();
    } catch (err) {
      logger.error(`[Bridge Gate] could not release lock ${lockTxHash}: ${err.message}`);
    }
  }

  /**
   * The one gate every bridge payout passes through: read the lock, then claim
   * it so it pays exactly once.
   *
   * The record's own `amount` and `recipient` are not consulted at all — the
   * payout is the lock's. That is not just stricter, it is the only coherent
   * reading: `amount` arrives as wei from one caller, as decimal VCN ("100.0")
   * from another, and as "1e+21" from a third, so no comparison against it
   * means the same thing twice. Pointing a forged record at someone else's
   * real lock therefore gains nothing: the payout goes to that lock's own
   * recipient, once.
   *
   * @param {object} bridge normalized bridge record (needs `lockTxHash`)
   * @param {string} kind payout kind, recorded on the claim
   * @return {Promise<object>} `{ ok, amountWei, recipient, reason, retryable }`
   */
  async function authorizeBridgePayout(bridge, kind) {
    const verified = await readBridgeLock(bridge.lockTxHash);
    if (!verified.ok) return verified;

    const claim = await consumeBridgeLock(bridge.lockTxHash, {
      kind: kind,
      intentHash: bridge.intentHash || verified.intentHash || null,
      amountWei: verified.amountWei.toString(),
      recipient: verified.recipient,
      dstChainId: bridge.dstChainId || null,
    });
    if (!claim.ok) return claim;

    return { ok: true, amountWei: verified.amountWei, recipient: verified.recipient };
  }

  return { readBridgeLock, consumeBridgeLock, releaseBridgeLock, authorizeBridgePayout };
}

/**
 * Does this chain actually have the contracts a bridge needs?
 *
 * P0 SECURITY / MONEY LOSS. Both bridge entry points (the paymaster handler
 * and the agent gateway's `bridge.initiate`) do this, in this order:
 *
 *   1. permit + transferFrom(user -> executor, amount + 1 VCN fee)
 *   2. commitIntent(...) on 0x009326c3…
 *
 * Step 2 is sent to the BridgeStaking contract, which has no `commitIntent`
 * — verified on chain: its code carries `totalStaked()` and
 * `MINIMUM_STAKE()` and no `commitIntent` selector, and it is not a proxy. So
 * step 2 always reverts, AFTER step 1 has taken the user's VCN. The user is
 * charged and gets nothing, with no refund path. That is how 40 VCN went
 * missing.
 *
 * `commitIntent` is not merely pointed at the wrong address: nothing on the
 * chain implements it. The frontend's own address for it
 * (0x7F5883b2…, components/Bridge.tsx) has no code either. So this cannot be
 * fixed by correcting an address — the contracts have to be redeployed. Until
 * then the honest behaviour is to refuse the bridge before taking anything.
 *
 * The check reads code rather than calling: a call can revert for business
 * reasons, which would look the same as a missing function. A Solidity
 * dispatcher embeds each selector as a PUSH4 constant, so the selector's
 * presence in the deployed code is a sound existence test — confirmed by the
 * positive controls above.
 *
 * @param {object} deps injected dependencies
 * @param {object} deps.ethers the ethers module
 * @param {function} deps.getProvider returns a provider for the chain
 * @param {object} deps.contracts `{ label: { address, signature } }` to require
 * @return {Promise<object>} `{ ok, missing: [{ label, address, why }] }`
 */
async function checkBridgeContracts({ ethers, getProvider, contracts }) {
  const provider = getProvider();
  const missing = [];

  for (const [label, { address, signature }] of Object.entries(contracts)) {
    let code;
    try {
      code = await provider.getCode(address);
    } catch (err) {
      return { ok: false, unknown: true, missing: [{ label, address, why: `chain unreachable: ${err.message}` }] };
    }
    if (!code || code === "0x") {
      missing.push({ label, address, why: "no contract deployed at this address" });
      continue;
    }
    if (signature) {
      const selector = ethers.id(signature).slice(2, 10);
      if (!code.includes(selector)) {
        missing.push({ label, address, why: `deployed code does not implement ${signature}` });
      }
    }
  }

  return { ok: missing.length === 0, missing };
}

module.exports = {
  createBridgeGate,
  checkBridgeContracts,
  BridgeUnverified,
  DEFAULT_LOCK_CONTRACTS,
  CONSUMED_COLLECTION,
};
