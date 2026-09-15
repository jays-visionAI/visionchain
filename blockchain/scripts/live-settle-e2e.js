/**
 * LIVE settlement E2E against the deployed Fly backend + visionV2 testnet.
 *
 * Proves the full production path: on-chain setup -> SIWE auth to the live API ->
 * place crossing orders -> the PRODUCTION settler picks up the fill and settles
 * settleBatch on-chain within its cycle -> verify on-chain balances moved.
 *
 *   npx hardhat run blockchain/scripts/live-settle-e2e.js --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers } = require("hardhat");
const dep = require("../deployed-solvent-lock.visionV2.json");

const BASE = process.env.SOLVENT_API || "https://solvent-backend.fly.dev";
const E18 = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** fetch with retries on transient network errors (connect timeouts to fly.dev). */
async function rfetch(url, opts = {}, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      lastErr = err;
      process.stdout.write(`  (retry ${i + 1}/${attempts} after network error: ${err.code || err.name})\n`);
      await sleep(3000);
    }
  }
  throw lastErr;
}

async function siweLogin(wallet) {
  const nr = await rfetch(`${BASE}/auth/nonce?address=${wallet.address}`);
  if (!nr.ok) throw new Error(`nonce ${nr.status}`);
  const { message } = await nr.json();
  const signature = await wallet.signMessage(message); // EIP-191, matches viem verifyMessage
  const vr = await rfetch(`${BASE}/auth/verify`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: wallet.address, signature }),
  });
  if (!vr.ok) throw new Error(`verify ${vr.status} ${await vr.text()}`);
  return (await vr.json()).token;
}

async function placeOrder(token, body) {
  const r = await rfetch(`${BASE}/lock/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`order ${r.status} ${JSON.stringify(j)}`);
  return j;
}

async function main() {
  console.log("Live API:", BASE);
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  const c = dep.contracts;

  const registry = await ethers.getContractAt("SolventLockRegistry", c.SolventLockRegistry, deployer);
  const settlement = await ethers.getContractAt("SolventLockSettlement", c.SolventLockSettlement, deployer);
  const quote = await ethers.getContractAt("MockUSDT", c.QuoteToken, deployer);

  // Actors.
  const seller = ethers.Wallet.createRandom().connect(provider); // issuer => holds lock
  const buyer = ethers.Wallet.createRandom().connect(provider);
  console.log("Seller(issuer):", seller.address);
  console.log("Buyer:", buyer.address);

  console.log("\n--- Fund gas ---");
  for (const a of [seller.address, buyer.address]) {
    await (await deployer.sendTransaction({ to: a, value: ethers.parseEther("0.5") })).wait();
  }

  // On-chain setup: register a lock token with seller as issuer.
  console.log("\n--- Register lock token (seller = issuer) ---");
  const underlying = await ethers.deployContract("MockUSDT", deployer);
  await underlying.waitForDeployment();
  const TOTAL = 1000n * E18;
  await (await underlying.mint(seller.address, TOTAL)).wait();
  await (await underlying.connect(seller).approve(c.SolventLockVault, TOTAL)).wait();
  await (await registry.grantRole(await registry.ISSUER_ROLE(), seller.address)).wait();
  // Generous startTime buffer: the proxy can take tens of seconds between reading
  // `now` and the register tx mining, and startTime must be >= block.timestamp at
  // execution. Vesting timing is irrelevant to this settlement test (no claim).
  const now = (await provider.getBlock("latest")).timestamp;
  await (await registry.connect(seller).registerLockToken(
    await underlying.getAddress(), TOTAL,
    { startTime: now + 300, cliffDuration: 0, vestingDuration: 3600 }, E18,
  )).wait();
  const lockId = (await registry.nextLockId()) - 1n;
  console.log("lockId:", lockId.toString());
  await (await registry.setTradingEnabled(lockId, true)).wait();

  // Buyer deposits quote on-chain.
  console.log("\n--- Buyer deposits quote ---");
  const BUYER_QUOTE = 200n * E18;
  await (await quote.mint(buyer.address, BUYER_QUOTE)).wait();
  await (await quote.connect(buyer).approve(c.SolventLockSettlement, BUYER_QUOTE)).wait();
  await (await settlement.connect(buyer).depositQuote(BUYER_QUOTE)).wait();

  // SIWE auth to the LIVE backend.
  console.log("\n--- SIWE login (live) ---");
  const sellerTok = await siweLogin(seller);
  const buyerTok = await siweLogin(buyer);
  console.log("both authenticated");

  // Place crossing orders: seller sells 100 lock @ 1 quote, buyer buys 100 @ 1.
  console.log("\n--- Place crossing orders (live API) ---");
  const price = 1n * E18;
  const amount = 100n * E18;
  const o1 = await placeOrder(sellerTok, { marketId: lockId.toString(), side: "sell", price: price.toString(), amount: amount.toString() });
  console.log("seller order:", o1.orderId);
  const o2 = await placeOrder(buyerTok, { marketId: lockId.toString(), side: "buy", price: price.toString(), amount: amount.toString() });
  console.log("buyer order:", o2.orderId, "filled:", o2.filled, "pendingSettlement:", o2.pendingSettlement);
  if (!o2.filled) throw new Error("orders did not cross");

  // Wait for the PRODUCTION settler to settle on-chain (cycle = 60s).
  console.log("\n--- Waiting for production settler to settle on-chain (≤~80s) ---");
  let settled = false;
  for (let i = 0; i < 9; i++) {
    await sleep(10_000);
    const bal = await settlement.getLockBalance(buyer.address, lockId);
    process.stdout.write(`  t+${(i + 1) * 10}s buyer on-chain lock balance = ${ethers.formatEther(bal)}\n`);
    if (bal === amount) { settled = true; break; }
  }
  if (!settled) throw new Error("settler did not settle within timeout");

  // Verify final on-chain state.
  const buyerLock = await settlement.getLockBalance(buyer.address, lockId);
  const sellerLock = await settlement.getLockBalance(seller.address, lockId);
  const sellerQuote = await settlement.quoteBalance(seller.address);
  console.log("\n--- Verified on-chain ---");
  console.log("buyer lock:", ethers.formatEther(buyerLock), "(expect 100)");
  console.log("seller lock:", ethers.formatEther(sellerLock), "(expect 900)");
  console.log("seller quote proceeds:", ethers.formatEther(sellerQuote), "(≈100 minus maker fee)");

  if (buyerLock !== amount) throw new Error("buyer lock mismatch");
  if (sellerLock !== TOTAL - amount) throw new Error("seller lock mismatch");
  if (sellerQuote <= 0n) throw new Error("seller received no quote");

  console.log("\n🎉 LIVE settlement E2E passed — production backend matched + settled on-chain.");
}

main().catch((e) => { console.error("\n💥 FAILED:", e.message || e); process.exit(1); });
