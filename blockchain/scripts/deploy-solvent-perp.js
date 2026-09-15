/**
 * Deploy SolventPerp and configure an initial market.
 *
 * Usage:
 *   # local dry-run:
 *   npx hardhat run blockchain/scripts/deploy-solvent-perp.js --config blockchain/hardhat.config.js
 *   # testnet:
 *   npx hardhat run blockchain/scripts/deploy-solvent-perp.js --network visionV2 --config blockchain/hardhat.config.js
 *
 * Env (optional — default to deployer for single-operator bootstrap):
 *   COLLATERAL_TOKEN  collateral/USDT ERC20. Default: Lock market's QuoteToken if present, else deploy MockUSDT.
 *   SETTLER_ADDR      backend settler (calls settleBatch). Default: deployer.
 *   ORACLE_ADDR       mark-price poster. Default: deployer.
 *   FEE_COLLECTOR     fee recipient. Default: deployer.
 *   PERP_MARKET_ID    market to configure. Default: 1.
 *   PERP_MARK_PRICE   initial mark price (1e18). Default: 100e18.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

function tryLoadLockDeploy() {
  try {
    return require(`../deployed-solvent-lock.${network.name}.json`);
  } catch {
    return null;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const settler = process.env.SETTLER_ADDR || deployer.address;
  const oracle = process.env.ORACLE_ADDR || deployer.address;
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;
  const marketId = BigInt(process.env.PERP_MARKET_ID || "1");
  const markPrice = BigInt(process.env.PERP_MARK_PRICE || (100n * 10n ** 18n).toString());

  console.log("Network:", network.name, "chainId:", network.config.chainId ?? "(in-process)");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "VCN");

  // Collateral: prefer the Lock market's QuoteToken for a unified USDT, else deploy MockUSDT.
  let collateral = process.env.COLLATERAL_TOKEN;
  if (!collateral) {
    const lock = tryLoadLockDeploy();
    if (lock?.contracts?.QuoteToken) {
      collateral = lock.contracts.QuoteToken;
      console.log("\nReusing Lock QuoteToken as collateral:", collateral);
    } else {
      console.log("\n--- Deploying MockUSDT (collateral) ---");
      const mock = await ethers.deployContract("MockUSDT");
      await mock.waitForDeployment();
      collateral = await mock.getAddress();
      console.log("MockUSDT:", collateral);
    }
  } else {
    console.log("\nUsing collateral token:", collateral);
  }

  console.log("\n--- Deploying SolventPerp ---");
  const perp = await ethers.deployContract("SolventPerp", [
    deployer.address, settler, oracle, collateral, feeCollector,
  ]);
  await perp.waitForDeployment();
  const perpAddr = await perp.getAddress();
  console.log("SolventPerp:", perpAddr);

  console.log("\n--- Configuring market", marketId.toString(), "---");
  // 5% maintenance / 10% initial (=> up to 10x leverage).
  await (await perp.configureMarket(marketId, 500, 1000)).wait();
  console.log("market configured: maintenance 5%, initial 10%");
  await (await perp.setMarkPrice(marketId, markPrice)).wait();
  console.log("mark price set:", ethers.formatEther(markPrice));

  const out = {
    network: network.name,
    chainId: network.config.chainId ?? null,
    deployer: deployer.address,
    settler, oracle, feeCollector,
    contracts: { CollateralToken: collateral, SolventPerp: perpAddr },
    market: { id: marketId.toString(), maintenanceMarginBps: 500, initialMarginBps: 1000, markPrice: markPrice.toString() },
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, `../deployed-solvent-perp.${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outPath);
  console.log(JSON.stringify(out, null, 2));

  // Sanity: market active + mark set.
  const m = await perp.markets(marketId);
  if (!m.active) throw new Error("market not active");
  if (m.markPrice !== markPrice) throw new Error("mark price mismatch");
  console.log("\n✅ Perp deployed & market live. Next: deposit collateral, settle a trade.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
