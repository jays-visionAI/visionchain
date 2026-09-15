/**
 * LIVE spot settlement E2E against the deployed Fly backend + DEXSettlement on
 * visionV2. Proves: on-chain deposit (base+quote) -> SIWE auth to the live API ->
 * crossing spot orders -> the PRODUCTION spot settler settles to DEXSettlement ->
 * verify on-chain internal balances moved (two-token).
 *
 *   npx hardhat run blockchain/scripts/live-spot-e2e.js --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers } = require("hardhat");
const dep = require("../deployed-solvent-spot.visionV2.json");

const BASE = process.env.SOLVENT_API || "https://solvent-backend.fly.dev";
const E18 = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rfetch(url, opts = {}, attempts = 6) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) }); }
    catch (e) { last = e; await sleep(3000); }
  }
  throw last;
}
async function siwe(wallet) {
  const { message } = await (await rfetch(`${BASE}/auth/nonce?address=${wallet.address}`)).json();
  const signature = await wallet.signMessage(message);
  const r = await rfetch(`${BASE}/auth/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: wallet.address, signature }) });
  if (!r.ok) throw new Error("verify " + r.status);
  return (await r.json()).token;
}
async function order(token, body) {
  const r = await rfetch(`${BASE}/spot/orders`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error("order " + r.status + " " + JSON.stringify(j));
  return j;
}

async function main() {
  console.log("Live API:", BASE);
  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;
  const c = dep.contracts;
  const dex = await ethers.getContractAt("DEXSettlement", c.SpotDex, deployer);
  const base = await ethers.getContractAt("MockUSDT", c.BaseToken, deployer);
  const quote = await ethers.getContractAt("MockUSDT", c.QuoteToken, deployer);

  const seller = ethers.Wallet.createRandom().connect(provider); // holds base, sells
  const buyer = ethers.Wallet.createRandom().connect(provider);  // holds quote, buys
  console.log("Seller:", seller.address, "\nBuyer: ", buyer.address);

  console.log("\n--- Fund gas ---");
  for (const a of [seller.address, buyer.address]) await (await deployer.sendTransaction({ to: a, value: ethers.parseEther("0.5") })).wait();

  // On-chain deposits into DEXSettlement (internal ledger). Mint, approve, deposit.
  console.log("\n--- Deposits ---");
  const SELL_BASE = 100n * E18, BUY_QUOTE = 500n * E18;
  await (await base.mint(seller.address, SELL_BASE)).wait();
  await (await base.connect(seller).approve(c.SpotDex, SELL_BASE)).wait();
  await (await dex.connect(seller).deposit(c.BaseToken, SELL_BASE)).wait();
  await (await quote.mint(buyer.address, BUY_QUOTE)).wait();
  await (await quote.connect(buyer).approve(c.SpotDex, BUY_QUOTE)).wait();
  await (await dex.connect(buyer).deposit(c.QuoteToken, BUY_QUOTE)).wait();
  console.log("seller base in DEX:", ethers.formatEther(await dex.getBalance(seller.address, c.BaseToken)));
  console.log("buyer quote in DEX:", ethers.formatEther(await dex.getBalance(buyer.address, c.QuoteToken)));

  // SIWE to live backend.
  console.log("\n--- SIWE login (live) ---");
  const sTok = await siwe(seller), bTok = await siwe(buyer);
  console.log("authenticated");

  // Crossing spot orders on market 1: seller sells 50 base @ 2 quote, buyer buys 50 @ 2.
  console.log("\n--- Crossing spot orders (live) ---");
  const price = 2n * E18, amount = 50n * E18;
  await order(sTok, { marketId: "1", side: "sell", price: price.toString(), amount: amount.toString() });
  const o2 = await order(bTok, { marketId: "1", side: "buy", price: price.toString(), amount: amount.toString() });
  console.log("buyer order filled:", o2.filled, "pendingSettlement:", o2.pendingSettlement);
  if (!o2.filled) throw new Error("orders did not cross");

  // Wait for the PRODUCTION spot settler to settle on DEXSettlement (~60s cycle).
  console.log("\n--- Waiting for production spot settler (≤~90s) ---");
  let ok = false;
  for (let i = 0; i < 10; i++) {
    await sleep(10000);
    const buyerBase = await dex.getBalance(buyer.address, c.BaseToken);
    process.stdout.write(`  t+${(i + 1) * 10}s buyer base in DEX = ${ethers.formatEther(buyerBase)}\n`);
    if (buyerBase === amount) { ok = true; break; }
  }
  if (!ok) throw new Error("spot settler did not settle in time");

  const buyerBase = await dex.getBalance(buyer.address, c.BaseToken);
  const sellerQuote = await dex.getBalance(seller.address, c.QuoteToken);
  console.log("\n--- Verified on-chain (DEXSettlement internal ledger) ---");
  console.log("buyer base:", ethers.formatEther(buyerBase), "(expect 50)");
  console.log("seller quote proceeds:", ethers.formatEther(sellerQuote), "(~100 minus maker fee)");
  if (buyerBase !== amount) throw new Error("buyer base mismatch");
  if (sellerQuote <= 0n) throw new Error("seller received no quote");

  console.log("\n🎉 LIVE SPOT E2E passed — production backend matched + settled to DEXSettlement.");
}

main().catch((e) => { console.error("\n💥 FAILED:", e.message || e); process.exit(1); });
