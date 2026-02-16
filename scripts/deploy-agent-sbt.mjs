/**
 * Deploy VisionAgentSBT contract using ethers.js directly.
 * Usage: PRIVATE_KEY=0x... node scripts/deploy-agent-sbt.mjs
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
    console.error("Usage: VCN_EXECUTOR_PK=0x... node scripts/deploy-agent-sbt.mjs");
    process.exit(1);
}

async function main() {
    // Load compiled artifact
    const artifactPath = join(__dirname, '..', 'artifacts', 'contracts', 'VisionAgentSBT.sol', 'VisionAgentSBT.json');
    const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    // Deploy with explicit gas settings for Vision Chain
    console.log("Deploying VisionAgentSBT...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const gasOpts = {
        gasLimit: 5000000,
        gasPrice: ethers.parseUnits("1", "gwei"),
    };
    const contract = await factory.deploy(gasOpts);
    console.log("Tx hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("\n=== DEPLOYED ===");
    console.log("VisionAgentSBT:", address);
    console.log("Add to functions/index.js as AGENT_SBT_ADDRESS");

    // Verify
    const name = await contract.name();
    const symbol = await contract.symbol();
    console.log(`Name: ${name}, Symbol: ${symbol}`);
}

main().catch((err) => {
    console.error("Deploy failed:", err.message);
    process.exit(1);
});
