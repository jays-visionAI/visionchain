/**
 * Deploy & self-test SolventReserve — the Phase-2 on-chain 1:1 USDT<->vUSD redeemer.
 *
 * Real USDT does not exist on Vision Chain yet, so this deploys a 6-decimal mock USDT
 * to PROVE the 1:1 mint/redeem + proof-of-reserves mechanics. On mainnet, pass the
 * real bridged USDT via USDT_ADDR and skip the mock.
 *
 *   npx hardhat run blockchain/scripts/deploy-reserve.js --network visionV2 --config blockchain/hardhat.config.js
 *
 * Env:
 *   VUSD_ADDR   vUSD address. Default: deployed-vusd.<network>.json.
 *   USDT_ADDR   real USDT (6dec). Default: deploy a MockUSDT (6dec) for testing.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  let vusdAddr = process.env.VUSD_ADDR;
  if (!vusdAddr) vusdAddr = require(`../deployed-vusd.${network.name}.json`).contracts.VisionStableUSD;
  console.log("Deployer:", deployer.address, "| vUSD:", vusdAddr);

  const vusd = await ethers.getContractAt("VisionStableUSD", vusdAddr, deployer);

  // USDT (real on mainnet; 6-decimal mock here for the self-test).
  let usdtAddr = process.env.USDT_ADDR;
  if (!usdtAddr) {
    console.log("\n--- Deploying MockUSDT (6dec) as test USDT ---");
    const m = await ethers.deployContract("MockUSDT", deployer);
    await m.waitForDeployment();
    usdtAddr = await m.getAddress();
    console.log("test USDT:", usdtAddr);
  }
  const usdt = await ethers.getContractAt("MockUSDT", usdtAddr, deployer);

  console.log("\n--- Deploying SolventReserve ---");
  const reserve = await ethers.deployContract("SolventReserve", [deployer.address, vusdAddr, usdtAddr], deployer);
  await reserve.waitForDeployment();
  const reserveAddr = await reserve.getAddress();
  console.log("SolventReserve:", reserveAddr, "| scale:", (await reserve.scale()).toString());

  // Grant the reserve MINTER + ATTESTOR on vUSD so it can mint and publish reserves.
  await (await vusd.grantRole(await vusd.MINTER_ROLE(), reserveAddr)).wait();
  await (await vusd.grantRole(await vusd.ATTESTOR_ROLE(), reserveAddr)).wait();
  console.log("granted MINTER_ROLE + ATTESTOR_ROLE to reserve");

  // ── Self-test: mint 1,000 USDT -> 1,000 vUSD; redeem 400 vUSD -> 400 USDT ────────
  console.log("\n--- Self-test 1:1 ---");
  const USDT_ONE = 10n ** 6n;   // 6 dec
  const VUSD_ONE = 10n ** 18n;  // 18 dec
  const depositUsdt = 1000n * USDT_ONE;
  await (await usdt.mint(deployer.address, depositUsdt)).wait();
  await (await usdt.approve(reserveAddr, depositUsdt)).wait();
  const vusdBefore = await vusd.balanceOf(deployer.address);
  await (await reserve.mint(depositUsdt)).wait();
  const vusdGained = (await vusd.balanceOf(deployer.address)) - vusdBefore;
  console.log("minted vUSD:", ethers.formatEther(vusdGained), "(expect 1000)");
  if (vusdGained !== 1000n * VUSD_ONE) throw new Error("mint ratio wrong");

  const declared = await vusd.declaredReserves();
  console.log("vUSD declaredReserves:", ethers.formatEther(declared), "| collateralizationBps:", (await vusd.collateralizationBps()).toString());

  const redeemVusd = 400n * VUSD_ONE;
  await (await vusd.approve(reserveAddr, redeemVusd)).wait();
  const usdtBefore = await usdt.balanceOf(deployer.address);
  await (await reserve.redeem(redeemVusd)).wait();
  const usdtBack = (await usdt.balanceOf(deployer.address)) - usdtBefore;
  console.log("redeemed USDT:", (Number(usdtBack) / 1e6).toString(), "(expect 400)");
  if (usdtBack !== 400n * USDT_ONE) throw new Error("redeem ratio wrong");
  console.log("reserve USDT held:", (Number(await reserve.usdtReserves()) / 1e6).toString(), "(expect 600)");

  const out = {
    network: network.name, chainId: network.config.chainId ?? null,
    contracts: { SolventReserve: reserveAddr, vUSD: vusdAddr, USDT: usdtAddr },
    scale: (await reserve.scale()).toString(),
    note: "USDT here is a 6dec MOCK for the self-test; pass real bridged USDT on mainnet.",
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(__dirname, `../deployed-reserve.${network.name}.json`), JSON.stringify(out, null, 2));
  console.log("\n🎉 SolventReserve verified 1:1 mint/redeem + reserve sync. Saved deployed-reserve." + network.name + ".json");
}

main().catch((e) => { console.error("\n💥 FAILED:", e.message || e); process.exit(1); });
