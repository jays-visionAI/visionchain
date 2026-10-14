/**
 * Tests for the bridge payout gate.
 *
 * The gate is the only thing standing between a writable Firestore collection
 * and a mint, so the cases that matter are the refusals: a record naming a
 * transaction that does not exist, one naming a transaction to the wrong
 * contract, one naming a reverted lock, and the same lock presented twice.
 *
 * The chain and Firestore are fakes. Real ethers does the ABI decoding, so a
 * wrong calldata layout fails here the way it would in production.
 *
 * Run: node functions/test/bridgeGate.test.cjs
 */

const assert = require("node:assert/strict");
const { ethers } = require("ethers");
const {
  createBridgeGate,
  checkBridgeContracts,
  BridgeUnverified,
  CONSUMED_COLLECTION,
} = require("../bridgeGate");

const LOCK_CONTRACT = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
const OTHER_CONTRACT = "0x28F40F9Da1c6D3c38fFDC1Fba80364B6bb21A1E3";
const RECIPIENT = "0x6605Acc98E5F9dE16D82885ad84a25D95C94F794";
const INTENT = "0x" + "11".repeat(32);
const LOCK_HASH = "0x" + "ab".repeat(32);
const OTHER_HASH = "0x" + "cd".repeat(32);

const lockIface = new ethers.Interface([
  "function lockVCN(bytes32 intentHash, address recipient, uint256 destChainId) payable",
]);

/** A lockVCN transaction as the chain would return it. */
function lockTx({ to = LOCK_CONTRACT, value = ethers.parseEther("100"), recipient = RECIPIENT, data } = {}) {
  return {
    to,
    value,
    data: data ?? lockIface.encodeFunctionData("lockVCN", [INTENT, recipient, 11155111n]),
  };
}

/** An in-memory Firestore with the one operation the gate depends on: create-if-absent. */
function fakeDb() {
  const store = new Map();
  return {
    store,
    collection(name) {
      return {
        doc(id) {
          const key = `${name}/${id}`;
          return {
            async create(data) {
              if (store.has(key)) {
                const err = new Error("ALREADY_EXISTS: document already exists");
                err.code = 6;
                throw err;
              }
              store.set(key, data);
            },
            async delete() {
              store.delete(key);
            },
          };
        },
      };
    },
  };
}

/**
 * @param {object} chain map of hash -> { tx, receipt }, or a thrown error
 * @return {object} the gate plus its fake db
 */
function gateOver(chain, { throws = false } = {}) {
  const db = fakeDb();
  const gate = createBridgeGate({
    ethers,
    db,
    timestamp: () => "T",
    lockContracts: [LOCK_CONTRACT],
    logger: { error() {} },
    getProvider: () => ({
      async getTransaction(hash) {
        if (throws) throw new Error("ECONNREFUSED");
        return chain[hash]?.tx ?? null;
      },
      async getTransactionReceipt(hash) {
        if (throws) throw new Error("ECONNREFUSED");
        return chain[hash]?.receipt ?? null;
      },
    }),
  });
  return { gate, db };
}

const chainWithGoodLock = {
  [LOCK_HASH]: { tx: lockTx(), receipt: { status: 1 } },
};

let passed = 0;
const checks = [];
/**
 * @param {string} name what is being asserted
 * @param {function} fn the assertion
 */
function check(name, fn) {
  checks.push([name, fn]);
}

// ---------------------------------------------------------------- refusals

check("a record naming no real transaction is refused", async () => {
  const { gate } = gateOver({});
  const r = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "SEPOLIA_MINT");
  assert.equal(r.ok, false);
  assert.match(r.reason, /no such transaction/);
});

check("a forged record is refused even when it claims a huge amount", async () => {
  const { gate } = gateOver({});
  const r = await gate.authorizeBridgePayout(
    { lockTxHash: LOCK_HASH, amount: ethers.parseEther("1000000").toString(), recipient: RECIPIENT },
    "SEPOLIA_MINT",
  );
  assert.equal(r.ok, false);
});

check("a hash-shaped string that is not a hash is refused", async () => {
  const { gate } = gateOver(chainWithGoodLock);
  for (const bad of [undefined, null, "", "0x123", "not-a-hash", LOCK_HASH + "ff", 42]) {
    const r = await gate.readBridgeLock(bad);
    assert.equal(r.ok, false, `accepted ${JSON.stringify(bad)}`);
    assert.match(r.reason, /not a transaction hash/);
  }
});

check("a lock sent to some other contract is refused", async () => {
  const { gate } = gateOver({
    [LOCK_HASH]: { tx: lockTx({ to: OTHER_CONTRACT }), receipt: { status: 1 } },
  });
  const r = await gate.readBridgeLock(LOCK_HASH);
  assert.equal(r.ok, false);
  assert.match(r.reason, /not sent to a bridge lock contract/);
});

check("a reverted lock is refused", async () => {
  const { gate } = gateOver({ [LOCK_HASH]: { tx: lockTx(), receipt: { status: 0 } } });
  const r = await gate.readBridgeLock(LOCK_HASH);
  assert.equal(r.ok, false);
  assert.match(r.reason, /reverted/);
});

check("a transaction to the lock contract that is not a lockVCN call is refused", async () => {
  const { gate } = gateOver({
    [LOCK_HASH]: { tx: lockTx({ data: "0xdeadbeef" }), receipt: { status: 1 } },
  });
  const r = await gate.readBridgeLock(LOCK_HASH);
  assert.equal(r.ok, false);
  assert.match(r.reason, /not a lockVCN call/);
});

check("a lock that locked nothing is refused", async () => {
  const { gate } = gateOver({
    [LOCK_HASH]: { tx: lockTx({ value: 0n }), receipt: { status: 1 } },
  });
  const r = await gate.readBridgeLock(LOCK_HASH);
  assert.equal(r.ok, false);
  assert.match(r.reason, /locked nothing/);
});

// ------------------------------------------------------------- the real thing

check("a real lock pays the chain's amount and the chain's recipient", async () => {
  const { gate } = gateOver(chainWithGoodLock);
  const r = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "SEPOLIA_MINT");
  assert.equal(r.ok, true);
  assert.equal(r.amountWei, ethers.parseEther("100"));
  assert.equal(r.recipient.toLowerCase(), RECIPIENT.toLowerCase());
});

check("the record's own amount and recipient are ignored", async () => {
  const { gate } = gateOver(chainWithGoodLock);
  const r = await gate.authorizeBridgePayout({
    lockTxHash: LOCK_HASH,
    amount: ethers.parseEther("999999").toString(),
    recipient: "0x000000000000000000000000000000000000dEaD",
  }, "SEPOLIA_MINT");
  assert.equal(r.ok, true);
  assert.equal(r.amountWei, ethers.parseEther("100"));
  assert.notEqual(r.recipient.toLowerCase(), "0x000000000000000000000000000000000000dead");
});

check("an amount of 1000 VCN or more does not throw (the 1e+21 case)", async () => {
  const { gate } = gateOver({
    [LOCK_HASH]: { tx: lockTx({ value: ethers.parseEther("1000") }), receipt: { status: 1 } },
  });
  const r = await gate.authorizeBridgePayout(
    { lockTxHash: LOCK_HASH, amount: String(1000 * 1e18) }, // "1e+21"
    "SEPOLIA_MINT",
  );
  assert.equal(r.ok, true);
  assert.equal(r.amountWei, ethers.parseEther("1000"));
});

// --------------------------------------------------------------- pay once

check("the same lock cannot be paid twice", async () => {
  const { gate } = gateOver(chainWithGoodLock);
  const first = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "SEPOLIA_MINT");
  assert.equal(first.ok, true);
  const second = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "SEPOLIA_MINT");
  assert.equal(second.ok, false);
  assert.match(second.reason, /already been paid out/);
});

check("two records naming one lock cannot both pay (the duplicate client write)", async () => {
  // The client wrote transactions/{commitTx} while the server wrote
  // transactions/{lockTx}; both carried lockTxHash, so both pointed here.
  const { gate } = gateOver(chainWithGoodLock);
  const a = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH, intentHash: "server" }, "SEPOLIA_MINT");
  const b = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH, intentHash: "client" }, "SEPOLIA_MINT");
  assert.equal(a.ok, true);
  assert.equal(b.ok, false);
});

check("the claim is case-insensitive about the hash", async () => {
  const { gate } = gateOver({
    [LOCK_HASH]: { tx: lockTx(), receipt: { status: 1 } },
    [LOCK_HASH.toUpperCase().replace("0X", "0x")]: { tx: lockTx(), receipt: { status: 1 } },
  });
  assert.equal((await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "A")).ok, true);
  const upper = LOCK_HASH.toUpperCase().replace("0X", "0x");
  const second = await gate.authorizeBridgePayout({ lockTxHash: upper }, "A");
  assert.equal(second.ok, false, "the same lock in upper case got paid again");
});

check("a released lock becomes payable again (the simulate branches)", async () => {
  const { gate, db } = gateOver(chainWithGoodLock);
  assert.equal((await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "A")).ok, true);
  await gate.releaseBridgeLock(LOCK_HASH);
  assert.equal(db.store.size, 0, "release left the claim behind");
  assert.equal((await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "A")).ok, true);
});

check("a claim records what was paid, not what was asked for", async () => {
  const { gate, db } = gateOver(chainWithGoodLock);
  await gate.authorizeBridgePayout(
    { lockTxHash: LOCK_HASH, amount: "999", dstChainId: 11155111 },
    "SEPOLIA_MINT",
  );
  const claim = db.store.get(`${CONSUMED_COLLECTION}/${LOCK_HASH.toLowerCase()}`);
  assert.equal(claim.amountWei, ethers.parseEther("100").toString());
  assert.equal(claim.kind, "SEPOLIA_MINT");
  assert.equal(claim.consumedAt, "T");
});

// ------------------------------------------------- a dead RPC is not a forgery

check("an unreachable chain is retryable, and claims nothing", async () => {
  const { gate, db } = gateOver(chainWithGoodLock, { throws: true });
  const r = await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "SEPOLIA_MINT");
  assert.equal(r.ok, false);
  assert.equal(r.retryable, true);
  assert.equal(db.store.size, 0, "a dead RPC consumed the lock");
});

check("a refusal never consumes the lock", async () => {
  const { gate, db } = gateOver({ [OTHER_HASH]: { tx: lockTx(), receipt: { status: 1 } } });
  await gate.authorizeBridgePayout({ lockTxHash: LOCK_HASH }, "SEPOLIA_MINT");
  assert.equal(db.store.size, 0);
});

// ------------------------------------------------- the pre-transfer preflight

/**
 * @param {object} codeByAddress address (lowercased) -> deployed code
 * @return {function} a getProvider for checkBridgeContracts
 */
function chainWithCode(codeByAddress) {
  return () => ({
    async getCode(address) {
      return codeByAddress[address.toLowerCase()] ?? "0x";
    },
  });
}

/** Code that dispatches a function: the selector appears as a PUSH4 constant. */
function codeImplementing(...signatures) {
  return "0x6080604052" + signatures.map((s) => "63" + ethers.id(s).slice(2, 10)).join("") + "00";
}

const INTENT_SIG = "commitIntent(address,uint256,uint256)";
const LOCK_SIG = "lockVCN(bytes32,address,uint256)";
const INTENT_ADDR = "0x009326c391012593Aeca601B09c02545E00Aa818";
const LOCK_ADDR = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

const PREFLIGHT_CONTRACTS = {
  IntentCommitment: { address: INTENT_ADDR, signature: INTENT_SIG },
  VisionBridgeSecure: { address: LOCK_ADDR, signature: LOCK_SIG },
};

check("the preflight refuses when the intent contract has no code", async () => {
  const r = await checkBridgeContracts({
    ethers,
    getProvider: chainWithCode({ [LOCK_ADDR.toLowerCase()]: codeImplementing(LOCK_SIG) }),
    contracts: PREFLIGHT_CONTRACTS,
  });
  assert.equal(r.ok, false);
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].label, "IntentCommitment");
  assert.match(r.missing[0].why, /no contract deployed/);
});

check("the preflight refuses a deployed contract that lacks the function", async () => {
  // This is the live case: 0x0093… IS BridgeStaking, so it has code, but no
  // commitIntent. Taking the user's VCN and then calling it is the 40 VCN bug.
  const r = await checkBridgeContracts({
    ethers,
    getProvider: chainWithCode({
      [INTENT_ADDR.toLowerCase()]: codeImplementing("totalStaked()", "MINIMUM_STAKE()"),
      [LOCK_ADDR.toLowerCase()]: codeImplementing(LOCK_SIG),
    }),
    contracts: PREFLIGHT_CONTRACTS,
  });
  assert.equal(r.ok, false);
  assert.equal(r.missing[0].label, "IntentCommitment");
  assert.match(r.missing[0].why, /does not implement commitIntent/);
});

check("the preflight passes when both contracts are there", async () => {
  const r = await checkBridgeContracts({
    ethers,
    getProvider: chainWithCode({
      [INTENT_ADDR.toLowerCase()]: codeImplementing(INTENT_SIG),
      [LOCK_ADDR.toLowerCase()]: codeImplementing(LOCK_SIG),
    }),
    contracts: PREFLIGHT_CONTRACTS,
  });
  assert.equal(r.ok, true, JSON.stringify(r.missing));
});

check("the preflight reports both when both are missing", async () => {
  const r = await checkBridgeContracts({
    ethers,
    getProvider: chainWithCode({}),
    contracts: PREFLIGHT_CONTRACTS,
  });
  assert.equal(r.ok, false);
  assert.equal(r.missing.length, 2);
});

check("an unreachable chain does not read as 'contracts missing'", async () => {
  const r = await checkBridgeContracts({
    ethers,
    getProvider: () => ({ async getCode() { throw new Error("ECONNREFUSED"); } }),
    contracts: PREFLIGHT_CONTRACTS,
  });
  assert.equal(r.ok, false);
  assert.equal(r.unknown, true);
  assert.match(r.missing[0].why, /chain unreachable/);
});

// ------------------------------------------------------------------ the error

check("BridgeUnverified is distinguishable from a transient failure", () => {
  const err = new BridgeUnverified("no such transaction on the source chain");
  assert.equal(err.unverified, true);
  assert.match(err.message, /^BRIDGE_UNVERIFIED: /);
  assert.equal(new Error("gas too low").unverified, undefined);
});

(async () => {
  for (const [name, fn] of checks) {
    try {
      await fn();
      passed += 1;
      console.log(`  ok  ${name}`);
    } catch (err) {
      console.error(`FAIL  ${name}\n      ${err.message}`);
      process.exitCode = 1;
    }
  }
  console.log(`\n${passed}/${checks.length} checks passed`);
})();
