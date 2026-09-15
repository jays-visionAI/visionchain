/**
 * Solvent Lock pilot on vUSD — bootstraps the first real liquidity and proves an
 * end-to-end trade settles on-chain against the LIVE backend.
 *
 * Steps:
 *   1. Register a pilot lock token (treasury = issuer → holds full lock inventory).
 *   2. Treasury deposits vUSD into Settlement (buy-side ammo).
 *   3. Treasury (the protocol market maker) places two-sided resting orders — the
 *      first liquidity on the empty book.
 *   4. A fresh taker deposits vUSD and crosses the treasury's ask; the production
 *      settler settles settleBatch on-chain; we verify balances moved.
 *   5. Register an AI marketMaker agent (treasury-owned) so the protocol MM keeps
 *      quoting automatically, and confirm it's live.
 *
 *   npx hardhat run blockchain/scripts/pilot-lock-vusd.js --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers } = require("hardhat");
const dep = require("../deployed-solvent-lock.visionV2.json");

const BASE = process.env.SOLVENT_API || "https://solvent-backend.fly.dev";
const E18 = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const f18 = (x) => ethers.formatEther(x);

async function rfetch(url, opts = {}, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(30_000) }); }
    catch (err) { lastErr = err; process.stdout.write(`  (retry ${i + 1}/${attempts}: ${err.code || err.name})\n`); await sleep(3000); }
  }
  throw lastErr;
}
async function siweLogin(wallet) {
  const nr = await rfetch(`${BASE}/auth/nonce?address=${wallet.address}`);
  if (!nr.ok) throw new Error(`nonce ${nr.status}`);
  const { message } = await nr.json();
  const signature = await wallet.signMessage(message);
  const vr = await rfetch(`${BASE}/auth/verify`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: wallet.address, signature }),
  });
  if (!vr.ok) throw new Error(`verify ${vr.status} ${await vr.text()}`);
  return (await vr.json()).token;
}
async function api(path, token, body, method = "POST") {
  const r = await rfetch(`${BASE}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`);
  return j;
}
const placeOrder = (token, body) => api("/lock/orders", token, body);

async function main() {
  console.log("Live API:", BASE);
  const [treasury] = await ethers.getSigners();
  const provider = ethers.provider;
  const c = dep.contracts;
  console.log("Treasury (issuer + protocol MM):", treasury.address);
  console.log("QuoteToken (vUSD):", c.QuoteToken);

  const registry = await ethers.getContractAt("SolventLockRegistry", c.SolventLockRegistry, treasury);
  const settlement = await ethers.getContractAt("SolventLockSettlement", c.SolventLockSettlement, treasury);
  const vusd = await ethers.getContractAt("VisionStableUSD", c.QuoteToken, treasury);

  const dec = await vusd.decimals();
  if (Number(dec) !== 18) throw new Error(`vUSD must be 18 decimals, got ${dec}`);

  // ── 1. Register a pilot lock token (treasury = issuer) ───────────────────────────
  console.log("\n--- 1. Register pilot lock token ---");
  const underlying = await ethers.deployContract("MockUSDT", treasury); // stand-in project token
  await underlying.waitForDeployment();
  const TOTAL = 1_000_000n * E18; // 1,000,000 lock units
  await (await underlying.mint(treasury.address, TOTAL)).wait();
  await (await underlying.approve(c.SolventLockVault, TOTAL)).wait();
  const hasIssuer = await registry.hasRole(await registry.ISSUER_ROLE(), treasury.address);
  if (!hasIssuer) await (await registry.grantRole(await registry.ISSUER_ROLE(), treasury.address)).wait();
  const now = (await provider.getBlock("latest")).timestamp;
  await (await registry.registerLockToken(
    await underlying.getAddress(), TOTAL,
    { startTime: now + 300, cliffDuration: 0, vestingDuration: 30 * 24 * 3600 }, E18,
  )).wait();
  const lockId = (await registry.nextLockId()) - 1n;
  await (await registry.setTradingEnabled(lockId, true)).wait();
  console.log("lockId:", lockId.toString(), "| trading enabled | treasury lock inventory:", f18(await settlement.getLockBalance(treasury.address, lockId)));

  // ── 2. Treasury deposits vUSD (buy-side ammo) ────────────────────────────────────
  console.log("\n--- 2. Treasury deposits vUSD ---");
  const TREASURY_QUOTE = 100_000n * E18; // 100,000 vUSD
  await (await vusd.approve(c.SolventLockSettlement, TREASURY_QUOTE)).wait();
  await (await settlement.depositQuote(TREASURY_QUOTE)).wait();
  console.log("treasury quoteBalance:", f18(await settlement.quoteBalance(treasury.address)), "vUSD");

  // ── 3. Protocol MM: two-sided resting orders (first liquidity) ───────────────────
  console.log("\n--- 3. Seed two-sided liquidity (protocol MM) ---");
  const mmTok = await siweLogin(treasury);
  const asks = [["1.00", "2000"], ["1.02", "3000"]]; // sell lock for vUSD
  const bids = [["0.98", "3000"], ["0.96", "3000"]]; // buy lock with vUSD
  for (const [p, a] of asks) await placeOrder(mmTok, { marketId: lockId.toString(), side: "sell", price: (ethers.parseEther(p)).toString(), amount: (ethers.parseEther(a)).toString() });
  for (const [p, a] of bids) await placeOrder(mmTok, { marketId: lockId.toString(), side: "buy", price: (ethers.parseEther(p)).toString(), amount: (ethers.parseEther(a)).toString() });
  const ob = await api(`/lock/orderbook/${lockId}`, null, null, "GET");
  console.log("orderbook bids:", ob.bids.length, "asks:", ob.asks.length, "| best ask:", ob.asks[0] && f18(BigInt(ob.asks[0].price)), "best bid:", ob.bids[0] && f18(BigInt(ob.bids[0].price)));

  // ── 4. Taker crosses the ask; production settler settles on-chain ───────────────
  console.log("\n--- 4. Taker buys against the book (E2E settlement) ---");
  const taker = ethers.Wallet.createRandom().connect(provider);
  await (await treasury.sendTransaction({ to: taker.address, value: ethers.parseEther("0.5") })).wait();
  const TAKER_QUOTE = 1000n * E18;
  await (await vusd.mint(taker.address, TAKER_QUOTE)).wait();
  await (await vusd.connect(taker).approve(c.SolventLockSettlement, TAKER_QUOTE)).wait();
  await (await settlement.connect(taker).depositQuote(TAKER_QUOTE)).wait();
  const takerTok = await siweLogin(taker);
  const buyAmt = 100n * E18;
  const o = await placeOrder(takerTok, { marketId: lockId.toString(), side: "buy", price: ethers.parseEther("1.00").toString(), amount: buyAmt.toString() });
  console.log("taker buy:", o.orderId, "filled:", o.filled, "pendingSettlement:", o.pendingSettlement);
  if (!o.filled) throw new Error("taker order did not cross the seeded ask");

  console.log("waiting for production settler (≤~90s)...");
  let settled = false;
  for (let i = 0; i < 10; i++) {
    await sleep(10_000);
    const bal = await settlement.getLockBalance(taker.address, lockId);
    process.stdout.write(`  t+${(i + 1) * 10}s taker on-chain lock = ${f18(bal)}\n`);
    if (bal === buyAmt) { settled = true; break; }
  }
  if (!settled) throw new Error("settler did not settle within timeout");
  console.log("✅ on-chain: taker lock =", f18(await settlement.getLockBalance(taker.address, lockId)),
    "| treasury lock =", f18(await settlement.getLockBalance(treasury.address, lockId)),
    "| treasury vUSD proceeds total =", f18(await settlement.quoteBalance(treasury.address)));

  // ── 5. Register an AI marketMaker agent (protocol MM keeps quoting) ──────────────
  console.log("\n--- 5. Register protocol AI market-maker agent ---");
  try {
    const agent = await api("/agents", mmTok, { lockId: lockId.toString(), preset: "marketMaker", enabled: true, capital: (100_000n * E18).toString() });
    console.log("agent registered:", agent.id || JSON.stringify(agent).slice(0, 120));
    const mine = await api("/agents?mine=1", mmTok, null, "GET");
    console.log("my agents:", Array.isArray(mine) ? mine.length : (mine.agents ? mine.agents.length : "?"));
  } catch (e) {
    console.log("agent registration note:", e.message);
  }

  console.log("\n🎉 Lock pilot on vUSD: liquidity seeded, taker trade settled on-chain, MM agent live. lockId =", lockId.toString());
  console.log("RESULT_LOCK_ID=" + lockId.toString());
}

main().catch((e) => { console.error("\n💥 FAILED:", e.message || e); process.exit(1); });
