/**
 * Deploy the Solvent Lock market: Registry + Settlement + Vault, fully wired.
 *
 * Usage:
 *   # local dry-run (in-process hardhat network, safe):
 *   npx hardhat run scripts/deploy-solvent-lock.js --config blockchain/hardhat.config.js
 *
 *   # Vision Chain testnet / mainnet (needs PRIVATE_KEY funded with VCN for gas):
 *   npx hardhat run scripts/deploy-solvent-lock.js --network visionchain --config blockchain/hardhat.config.js
 *
 * Env (optional — default to deployer for a single-operator bootstrap):
 *   QUOTE_TOKEN    existing quote/USDT ERC20 address. If unset, deploys a MockUSDT.
 *   SETTLER_ADDR   backend settler wallet (calls settleBatch). Default: deployer.
 *   FEE_COLLECTOR  fee recipient. Default: deployer.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const settler = process.env.SETTLER_ADDR || deployer.address;
  const feeCollector = process.env.FEE_COLLECTOR || deployer.address;

  console.log("Network:", network.name, "chainId:", network.config.chainId ?? "(in-process)");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "VCN");
  console.log("Settler:", settler);
  console.log("FeeCollector:", feeCollector);

  // 1. Quote token (USDT). Reuse existing, or deploy a MockUSDT for testnet.
  let quoteAddr = process.env.QUOTE_TOKEN;
  if (!quoteAddr) {
    console.log("\n--- Deploying MockUSDT (quote token) ---");
    const mock = await ethers.deployContract("MockUSDT");
    await mock.waitForDeployment();
    quoteAddr = await mock.getAddress();
    console.log("MockUSDT:", quoteAddr);
  } else {
    console.log("\nUsing existing quote token:", quoteAddr);
  }

  // 2. Deploy the three Lock contracts.
  console.log("\n--- Deploying SolventLockRegistry ---");
  const registry = await ethers.deployContract("SolventLockRegistry", [deployer.address]);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("SolventLockRegistry:", registryAddr);

  console.log("\n--- Deploying SolventLockSettlement ---");
  const settlement = await ethers.deployContract("SolventLockSettlement", [
    deployer.address, settler, quoteAddr, feeCollector,
  ]);
  await settlement.waitForDeployment();
  const settlementAddr = await settlement.getAddress();
  console.log("SolventLockSettlement:", settlementAddr);

  console.log("\n--- Deploying SolventLockVault ---");
  const vault = await ethers.deployContract("SolventLockVault", [deployer.address]);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("SolventLockVault:", vaultAddr);

  // 3. Wire the three together (order matters: grant roles before registry uses them).
  console.log("\n--- Wiring ---");
  await (await registry.setWiring(settlementAddr, vaultAddr)).wait();
  console.log("registry.setWiring -> settlement, vault");

  await (await settlement.setVault(vaultAddr)).wait();
  console.log("settlement.setVault -> vault");

  await (await settlement.grantRegistry(registryAddr)).wait();
  console.log("settlement.grantRegistry -> registry (REGISTRY_ROLE)");

  await (await vault.grantRegistry(registryAddr)).wait();
  console.log("vault.grantRegistry -> registry (REGISTRY_ROLE)");

  await (await vault.grantSettler(settlementAddr)).wait();
  console.log("vault.grantSettler -> settlement (SETTLER_ROLE)");

  // 4. Persist deployment record.
  const out = {
    network: network.name,
    chainId: network.config.chainId ?? null,
    deployer: deployer.address,
    settler,
    feeCollector,
    contracts: {
      QuoteToken: quoteAddr,
      SolventLockRegistry: registryAddr,
      SolventLockSettlement: settlementAddr,
      SolventLockVault: vaultAddr,
    },
    deployedAt: new Date().toISOString(),
  };
  const outPath = path.join(__dirname, `../deployed-solvent-lock.${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log("\nSaved:", outPath);
  console.log(JSON.stringify(out, null, 2));

  // 5. Post-deploy sanity: wiring sticks.
  if (!(await registry.wired())) throw new Error("registry not wired");
  console.log("\n✅ Wiring verified. Next: grant ISSUER_ROLE, register a lock token, enable trading.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
