/**
 * E2E smoke test for the Solvent Lock market on a LIVE network (visionV2).
 *
 * Exercises the full lifecycle against real RPC / real block time:
 *   issuer registers (escrow) -> admin enables -> buyer deposits quote ->
 *   settler settles a trade -> wait for real vesting -> buyer claims underlying.
 *
 * Unlike the unit test, time cannot be fast-forwarded, so vesting is set long
 * (30 min) and we verify a PARTIAL claim that grows with real wall-clock time.
 *
 * Usage:
 *   npx hardhat run blockchain/scripts/smoke-solvent-lock.js --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers, network } = require("hardhat");
const dep = require("../deployed-solvent-lock.visionV2.json");

const E18 = 10n ** 18n;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ok(label, cond, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${label}${detail ? "  " + detail : ""}`);
  if (!cond) throw new Error(`Assertion failed: ${label} ${detail}`);
}

async function fundGas(deployer, to, vcn) {
  const tx = await deployer.sendTransaction({ to, value: vcn });
  await tx.wait();
}

async function main() {
  console.log("Network:", network.name, "chainId:", network.config.chainId);
  const [deployer] = await ethers.getSigners();
  console.log("Deployer/admin/settler/feeCollector:", deployer.address);

  const c = dep.contracts;
  const registry = await ethers.getContractAt("SolventLockRegistry", c.SolventLockRegistry, deployer);
  const settlement = await ethers.getContractAt("SolventLockSettlement", c.SolventLockSettlement, deployer);
  const vault = await ethers.getContractAt("SolventLockVault", c.SolventLockVault, deployer);
  const quote = await ethers.getContractAt("MockUSDT", c.QuoteToken, deployer);

  // ── Actors: fresh issuer + buyer wallets, gas-funded by deployer ────────────
  const provider = ethers.provider;
  const issuer = ethers.Wallet.createRandom().connect(provider);
  const buyer = ethers.Wallet.createRandom().connect(provider);
  console.log("\nIssuer:", issuer.address);
  console.log("Buyer: ", buyer.address);

  console.log("\n--- Funding actors with gas (VCN) ---");
  await fundGas(deployer, issuer.address, ethers.parseEther("0.5"));
  await fundGas(deployer, buyer.address, ethers.parseEther("0.5"));
  console.log("funded 0.5 VCN each");

  // ── 1. Underlying token: fresh MockUSDT, mint 1000 to issuer ─────────────────
  console.log("\n--- Deploying underlying (MockUSDT) + minting to issuer ---");
  const underlying = await ethers.deployContract("MockUSDT", deployer);
  await underlying.waitForDeployment();
  const underlyingAddr = await underlying.getAddress();
  const TOTAL = 1000n * E18;
  await (await underlying.mint(issuer.address, TOTAL)).wait();
  console.log("underlying:", underlyingAddr, "minted", ethers.formatEther(TOTAL));

  // ── 2. Grant ISSUER_ROLE ─────────────────────────────────────────────────────
  console.log("\n--- Granting ISSUER_ROLE ---");
  await (await registry.grantRole(await registry.ISSUER_ROLE(), issuer.address)).wait();

  // ── 3. Register lock token (escrow full supply), SHORT-ish start, LONG vest ──
  console.log("\n--- Registering lock token ---");
  await (await underlying.connect(issuer).approve(c.SolventLockVault, TOTAL)).wait();
  const now = (await provider.getBlock("latest")).timestamp;
  const vesting = { startTime: now + 5, cliffDuration: 0, vestingDuration: 1800 }; // start in 5s, 30min linear
  await (await registry.connect(issuer).registerLockToken(underlyingAddr, TOTAL, vesting, E18)).wait();
  const lockId = (await registry.nextLockId()) - 1n;
  console.log("lockId:", lockId.toString());
  ok("issuer credited full lock supply", (await settlement.getLockBalance(issuer.address, lockId)) === TOTAL);
  ok("underlying escrowed in vault", (await vault.escrowed(lockId)) === TOTAL);

  // ── 4. Enable trading ──────────────────────────────────────────────────────
  console.log("\n--- Enabling trading ---");
  await (await registry.setTradingEnabled(lockId, true)).wait();
  ok("registry reports tradable", await registry.isTradable(lockId));

  // ── 5. Buyer deposits quote ──────────────────────────────────────────────────
  console.log("\n--- Buyer deposits quote (USDT) ---");
  const BUYER_QUOTE = 100n * E18;
  await (await quote.mint(buyer.address, BUYER_QUOTE)).wait();
  await (await quote.connect(buyer).approve(c.SolventLockSettlement, BUYER_QUOTE)).wait();
  await (await settlement.connect(buyer).depositQuote(BUYER_QUOTE)).wait();
  ok("buyer quote deposited", (await settlement.quoteBalance(buyer.address)) === BUYER_QUOTE);

  // ── 6. Settle a trade: issuer sells 500 lock to buyer for 50 quote + fees ────
  console.log("\n--- settleBatch: issuer -> buyer, 500 lock @ 50 quote ---");
  const lockAmount = 500n * E18;
  const quoteAmount = 50n * E18;
  const buyerFee = (quoteAmount * 5n) / 10000n;   // 0.05% taker
  const sellerFee = (quoteAmount * 2n) / 10000n;  // 0.02% maker
  const trade = {
    buyer: buyer.address, seller: issuer.address, lockId,
    lockAmount, quoteAmount, buyerFee, sellerFee,
  };
  await (await settlement.settleBatch(1, [trade])).wait();

  ok("buyer lock balance == 500", (await settlement.getLockBalance(buyer.address, lockId)) === lockAmount);
  ok("issuer lock balance == 500", (await settlement.getLockBalance(issuer.address, lockId)) === TOTAL - lockAmount);
  ok("buyer quote debited quote+fee",
    (await settlement.quoteBalance(buyer.address)) === BUYER_QUOTE - quoteAmount - buyerFee);
  ok("seller quote credited quote-fee",
    (await settlement.quoteBalance(issuer.address)) === quoteAmount - sellerFee);
  ok("feeCollector got total fee",
    (await settlement.quoteBalance(deployer.address)) === buyerFee + sellerFee,
    `= ${ethers.formatEther(buyerFee + sellerFee)} quote`);

  // ── 7. Wait for real vesting, then buyer claims a PARTIAL amount ─────────────
  console.log("\n--- Waiting ~20s for real-time vesting to accrue ---");
  await sleep(20_000);
  const f = await settlement.vestedFraction(lockId);
  const claimableBefore = await settlement.claimable(buyer.address, lockId);
  console.log("vestedFraction:", ethers.formatEther(f), " buyer claimable:", ethers.formatEther(claimableBefore));
  ok("vesting has started (fraction > 0)", f > 0n);
  ok("buyer has a positive, partial claim", claimableBefore > 0n && claimableBefore < lockAmount,
    `claimable=${ethers.formatEther(claimableBefore)} < 500`);

  console.log("\n--- Buyer claims ---");
  const before = await underlying.balanceOf(buyer.address);
  await (await settlement.connect(buyer).claim(lockId)).wait();
  const after = await underlying.balanceOf(buyer.address);
  const received = after - before;
  const escrowAfter = await vault.escrowed(lockId);
  console.log("buyer received underlying:", ethers.formatEther(received));
  ok("buyer received real underlying", received > 0n);
  ok("received <= sold lock (no over-claim)", received <= lockAmount);
  ok("vault escrow decreased by received", escrowAfter === TOTAL - received,
    `escrow=${ethers.formatEther(escrowAfter)}`);

  console.log("\n🎉 E2E smoke test passed on", network.name);
  console.log("Summary:");
  console.log("  lockId:", lockId.toString());
  console.log("  underlying:", underlyingAddr);
  console.log("  trade: issuer sold 500 lock to buyer for 50 quote (fees routed to collector)");
  console.log("  vesting: real-time partial claim succeeded, escrow conserved");
}

main().catch((e) => {
  console.error("\n💥 SMOKE TEST FAILED:", e.message || e);
  process.exit(1);
});
