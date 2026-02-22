/**
 * Deploy Storage contracts (StorageRegistry, StorageProof, StorageRewards)
 * using ethers.js directly against Vision Chain RPC.
 *
 * Usage: VCN_EXECUTOR_PK=0x... node scripts/deploy_storage.mjs
 *
 * Compile first: npx hardhat compile
 */
import 'dotenv/config';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const PRIVATE_KEY = process.env.VCN_EXECUTOR_PK || process.env.EXECUTOR_PK || process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("Error: VCN_EXECUTOR_PK or PRIVATE_KEY env variable required");
    console.error("Usage: VCN_EXECUTOR_PK=0x... node scripts/deploy_storage.mjs");
    process.exit(1);
}

const GAS_OPTS = {
    gasLimit: 6000000,
    gasPrice: ethers.parseUnits("1", "gwei"),
};

async function deployContract(name, wallet) {
    const artifactPath = join(__dirname, '..', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

    console.log(`\nDeploying ${name}...`);
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(GAS_OPTS);
    console.log("Tx hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`${name} deployed to:`, address);
    return { address, contract };
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "VCN");

    // 1. StorageRegistry
    const registry = await deployContract("StorageRegistry", wallet);

    // 2. StorageProof
    const proof = await deployContract("StorageProof", wallet);

    // 3. StorageRewards
    const rewards = await deployContract("StorageRewards", wallet);

    // Summary
    console.log("\n=== Deployment Complete ===");
    console.log("StorageRegistry:", registry.address);
    console.log("StorageProof:   ", proof.address);
    console.log("StorageRewards: ", rewards.address);

    console.log("\n# Add to .env / functions config:");
    console.log(`STORAGE_REGISTRY_ADDRESS=${registry.address}`);
    console.log(`STORAGE_PROOF_ADDRESS=${proof.address}`);
    console.log(`STORAGE_REWARDS_ADDRESS=${rewards.address}`);
}

main().catch((err) => {
    console.error("Deploy failed:", err.message);
    process.exit(1);
});
