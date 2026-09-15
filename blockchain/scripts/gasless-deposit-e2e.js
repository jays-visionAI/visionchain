/**
 * Full gasless trading E2E — proves a signature-only wallet (like the Vision Chain
 * native wallet) can LOGIN, DEPOSIT, and TRADE to on-chain settlement WITHOUT ever
 * holding VCN gas or sending a transaction. The wallet only ever SIGNS.
 *
 *   npx hardhat run blockchain/scripts/gasless-deposit-e2e.js --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers } = require("hardhat");
const lock = require("../deployed-solvent-lock.visionV2.json");
const vdep = require("../deployed-vusd.visionV2.json");

const BASE = process.env.SOLVENT_API || "https://solvent-backend.fly.dev";
const E18 = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rfetch(url, opts = {}, attempts = 6) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url, { ...opts, signal: AbortSignal.timeout(30_000) }); }
    catch (e) { last = e; process.stdout.write(`  (retry ${i + 1}: ${e.code || e.name})\n`); await sleep(3000); }
  }
  throw last;
}
async function jget(path, token) {
  const r = await rfetch(`${BASE}${path}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`);
  return j;
}
async function jpost(path, token, body) {
  const r = await rfetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${path} ${r.status} ${JSON.stringify(j)}`);
  return j;
}
async function siwe(wallet) {
  const { message } = await jget(`/auth/nonce?address=${wallet.address}`);
  const signature = await wallet.signMessage(message);
  return (await jpost(`/auth/verify`, null, { address: wallet.address, signature })).token;
}

async function main() {
  console.log("Live API:", BASE);
  const [treasury] = await ethers.getSigners();
  const provider = ethers.provider;
  const c = lock.contracts;
  const registry = await ethers.getContractAt("SolventLockRegistry", c.SolventLockRegistry, treasury);
  const settlement = await ethers.getContractAt("SolventLockSettlement", c.SolventLockSettlement, treasury);
  const vusd = await ethers.getContractAt("VisionStableUSD", vdep.contracts.VisionStableUSD, treasury);

  // The "Vision wallet" user — NEVER funded with VCN, NEVER sends a tx.
  const user = ethers.Wallet.createRandom().connect(provider);
  const gas0 = await provider.getBalance(user.address);
  console.log("User (signature-only):", user.address, "| VCN gas:", ethers.formatEther(gas0));
  if (gas0 !== 0n) throw new Error("user should start with 0 VCN");

  // Treasury mints vUSD to the user (treasury pays gas; user just holds the token).
  const DEPOSIT = 5000n * E18;
  await (await vusd.mint(user.address, DEPOSIT)).wait();
  console.log("user vUSD wallet balance:", ethers.formatEther(await vusd.balanceOf(user.address)));

  // Treasury sets up a tradeable lock + a resting ask (the counterparty liquidity).
  console.log("\n[setup] treasury registers a lock + seeds an ask");
  const underlying = await ethers.deployContract("MockUSDT", treasury);
  await underlying.waitForDeployment();
  const TOTAL = 100_000n * E18;
  await (await underlying.mint(treasury.address, TOTAL)).wait();
  await (await underlying.approve(c.SolventLockVault, TOTAL)).wait();
  if (!(await registry.hasRole(await registry.ISSUER_ROLE(), treasury.address)))
    await (await registry.grantRole(await registry.ISSUER_ROLE(), treasury.address)).wait();
  const now = (await provider.getBlock("latest")).timestamp;
  await (await registry.registerLockToken(await underlying.getAddress(), TOTAL,
    { startTime: now + 300, cliffDuration: 0, vestingDuration: 30 * 24 * 3600 }, E18)).wait();
  const lockId = (await registry.nextLockId()) - 1n;
  await (await registry.setTradingEnabled(lockId, true)).wait();
  const treTok = await siwe(treasury);
  await jpost("/lock/orders", treTok, { marketId: lockId.toString(), side: "sell", price: ethers.parseEther("1.0").toString(), amount: ethers.parseEther("1000").toString() });
  console.log("  lockId", lockId.toString(), "ask seeded @ 1.0");

  // ── The gasless user journey (only signatures, never a tx, never any VCN) ────────
  console.log("\n1) SIWE login (sign only, no gas)");
  const token = await siwe(user);

  console.log("2) sign EIP-2612 permit (no gas)");
  const p = await jget(`/lock/permit-params?amount=${DEPOSIT.toString()}`, token);
  const sig = await user.signTypedData(p.domain, p.types, p.message);
  const sg = ethers.Signature.from(sig);

  console.log("3) relay gasless deposit (settler pays gas)");
  const res = await jpost(`/lock/deposit-permit`, token, { amount: DEPOSIT.toString(), deadline: p.deadline, v: sg.v, r: sg.r, s: sg.s });
  const credited = await settlement.quoteBalance(user.address);
  console.log("   tx:", res.hash, "| user Settlement quoteBalance:", ethers.formatEther(credited), "vUSD");
  if (credited !== DEPOSIT) throw new Error("deposit not credited 1:1");

  console.log("4) place a buy order against the seeded ask (Bearer token, no gas)");
  const buyAmt = 100n * E18;
  const o = await jpost("/lock/orders", token, { marketId: lockId.toString(), side: "buy", price: ethers.parseEther("1.0").toString(), amount: buyAmt.toString() });
  console.log("   filled:", o.filled, "pendingSettlement:", o.pendingSettlement);
  if (!o.filled) throw new Error("buy did not cross the ask");

  console.log("5) wait for production settler to settle on-chain (≤~90s)");
  let ok = false;
  for (let i = 0; i < 10; i++) {
    await sleep(10_000);
    const bal = await settlement.getLockBalance(user.address, lockId);
    process.stdout.write(`   t+${(i + 1) * 10}s user lock = ${ethers.formatEther(bal)}\n`);
    if (bal === buyAmt) { ok = true; break; }
  }
  if (!ok) throw new Error("settler did not settle in time");

  const gas1 = await provider.getBalance(user.address);
  console.log("\n--- Result ---");
  console.log("user lock balance:", ethers.formatEther(await settlement.getLockBalance(user.address, lockId)), "(expect 100)");
  console.log("user remaining vUSD ledger:", ethers.formatEther(await settlement.quoteBalance(user.address)));
  console.log("user VCN gas (start -> end):", ethers.formatEther(gas0), "->", ethers.formatEther(gas1));
  if (gas1 !== 0n) throw new Error("user paid gas — not gasless!");

  console.log("\n🎉 FULLY GASLESS: a signature-only wallet logged in, deposited, traded, and settled on-chain — ZERO VCN, ZERO transactions sent by the user. Vision-wallet-ready.");
}
main().catch((e) => { console.error("\n💥 FAILED:", e.message || e); process.exit(1); });
