/**
 * Deploy Vision USD (vUSD) — the RWA-style, USD-pegged settlement asset for Solvent.
 *
 * Usage:
 *   # local dry-run:
 *   npx hardhat run scripts/deploy-vusd.js --config blockchain/hardhat.config.js
 *   # Vision Chain v2:
 *   npx hardhat run scripts/deploy-vusd.js --network visionV2 --config blockchain/hardhat.config.js
 *
 * Env (optional):
 *   VUSD_ADMIN        admin/treasury (DEFAULT_ADMIN/MINTER/PAUSER/ATTESTOR). Default: deployer.
 *   VUSD_MINT         initial pilot supply minted to admin, in whole vUSD. Default: 10000000 (10M).
 *
 * After deploy, redeploy the markets against it:
 *   QUOTE_TOKEN=<vUSD> npx hardhat run scripts/deploy-solvent-lock.js  --network visionV2 --config blockchain/hardhat.config.js
 *   QUOTE_TOKEN=<vUSD> npx hardhat run scripts/deploy-solvent-perp.js  --network visionV2 --config blockchain/hardhat.config.js
 *   QUOTE_TOKEN=<vUSD> npx hardhat run scripts/deploy-solvent-spot.js  --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

const DECIMALS = 18; // matches the backend's 1e18 fixed-point quote scale

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.VUSD_ADMIN || deployer.address;
  const mintWhole = BigInt(process.env.VUSD_MINT || "10000000"); // 10M vUSD default
  const mintUnits = mintWhole * 10n ** BigInt(DECIMALS);

  console.log("Network:", network.name, "chainId:", network.config.chainId ?? "(in-process)");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "VCN");
  console.log("Admin/Treasury:", admin);
  console.log("Initial pilot mint:", mintWhole.toString(), "vUSD");

  console.log("\n--- Deploying VisionStableUSD (vUSD) ---");
  const vusd = await ethers.deployContract("VisionStableUSD", [admin]);
  await vusd.waitForDeployment();
  const vusdAddr = await vusd.getAddress();
  console.log("VisionStableUSD:", vusdAddr);

  // Pilot issuance to the treasury (seeds MM agents + a capped faucet). Only works if
  // the deployer holds MINTER_ROLE — true when admin == deployer (the default).
  if (admin.toLowerCase() === deployer.address.toLowerCase() && mintUnits > 0n) {
    console.log("\n--- Minting pilot supply to treasury ---");
    await (await vusd.mint(admin, mintUnits)).wait();
    console.log("Minted:", mintWhole.toString(), "vUSD to", admin);
  } else {
    console.log("\n(skip mint — admin is not deployer; mint manually with MINTER_ROLE)");
  }

  // Pilot honesty: reserves are 0 (unbacked) until real USDT is custodied (Phase 2).
  console.log("declaredReserves: 0 (pilot — UNBACKED until USDT custody; do not take retail real money yet)");

  const out = {
    network: network.name,
    chainId: network.config.chainId ?? null,
    deployer: deployer.address,
    admin,
    contracts: { VisionStableUSD: vusdAddr },
    decimals: DECIMALS,
    initialMintWhole: mintWhole.toString(),
    phase: "pilot-unbacked",
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, `../deployed-vusd.${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outPath);
  console.log(JSON.stringify(out, null, 2));

  // Sanity.
  const sym = await vusd.symbol();
  const dec = await vusd.decimals();
  const supply = await vusd.totalSupply();
  if (sym !== "vUSD" || Number(dec) !== DECIMALS) throw new Error("metadata mismatch");
  console.log(`\n✅ ${sym} (${dec} dec) deployed. totalSupply=${supply} units.`);
  console.log("Next: redeploy Lock/Perp/Spot with QUOTE_TOKEN=" + vusdAddr);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
