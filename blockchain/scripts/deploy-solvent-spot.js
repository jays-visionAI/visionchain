/**
 * Deploy DEXSettlement (the hybrid spot DEX) for Solvent's Spot market and a
 * mintable base token, reusing the existing Lock/Perp MockUSDT as the quote.
 *
 *   npx hardhat run blockchain/scripts/deploy-solvent-spot.js --network visionV2 --config blockchain/hardhat.config.js
 *
 * Env (optional, default to single-operator bootstrap):
 *   QUOTE_TOKEN    quote ERC20. Default: Lock market's MockUSDT if present, else deploy one.
 *   BASE_TOKEN     base ERC20. Default: deploy a fresh mintable mock ("sVCN").
 *   SETTLER_ADDR   backend settler (settleBatch). Default: deployer.
 *   FEE_COLLECTOR  fee recipient. Default: deployer.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function tryLoad(name) {
  try { return require(`../${name}`); } catch { return null; }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const settler = process.env.SETTLER_ADDR || deployer.address;
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;

  console.log("Network:", network.name, "chainId:", network.config.chainId ?? "(in-process)");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "VCN");

  // Quote: reuse the Lock market's MockUSDT for a unified quote across markets.
  let quote = process.env.QUOTE_TOKEN;
  if (!quote) {
    const lock = tryLoad(`deployed-solvent-lock.${network.name}.json`);
    if (lock?.contracts?.QuoteToken) { quote = lock.contracts.QuoteToken; console.log("\nReusing Lock QuoteToken as quote:", quote); }
    else { const m = await ethers.deployContract("MockUSDT"); await m.waitForDeployment(); quote = await m.getAddress(); console.log("\nDeployed quote MockUSDT:", quote); }
  } else { console.log("\nUsing quote token:", quote); }

  // Base: a fresh mintable mock representing the traded asset (e.g. sVCN).
  let base = process.env.BASE_TOKEN;
  if (!base) {
    console.log("\n--- Deploying base token (MockUSDT instance as sVCN) ---");
    const b = await ethers.deployContract("MockUSDT");
    await b.waitForDeployment();
    base = await b.getAddress();
    console.log("base token:", base);
  } else { console.log("\nUsing base token:", base); }

  console.log("\n--- Deploying DEXSettlement (spot) ---");
  const dex = await ethers.deployContract("DEXSettlement", [deployer.address, settler, feeCollector]);
  await dex.waitForDeployment();
  const dexAddr = await dex.getAddress();
  console.log("DEXSettlement:", dexAddr);

  const out = {
    network: network.name,
    chainId: network.config.chainId ?? null,
    deployer: deployer.address,
    settler, feeCollector,
    contracts: { SpotDex: dexAddr, BaseToken: base, QuoteToken: quote },
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, `../deployed-solvent-spot.${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outPath);
  console.log(JSON.stringify(out, null, 2));

  // Sanity: settler role present.
  const SETTLER_ROLE = await dex.SETTLER_ROLE();
  if (!(await dex.hasRole(SETTLER_ROLE, settler))) throw new Error("settler role not set");
  console.log("\n✅ Spot DEX deployed. base/quote set, settler has SETTLER_ROLE.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
