// Direct deployment script using ethers
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    // Load contract artifact (artifacts are in project root, not blockchain folder)
    const artifactPath = path.join(__dirname, '../../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // Connect to network
    const RPC_URL = "https://api.visionchain.co/rpc-proxy";
    const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("Deploying BridgeStaking...");
    console.log("Deployer:", wallet.address);

    // Deploy contract
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(VCN_TOKEN);

    console.log("Tx hash:", contract.deploymentTransaction().hash);
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log("BridgeStaking deployed to:", address);

    // Set initial APY (12% = 1200 basis points)
    console.log("Setting target APY to 12%...");
    const setApyTx = await contract.setTargetAPY(1200);
    await setApyTx.wait();
    console.log("APY set successfully!");

    console.log("\n=== Deployment Complete ===");
    console.log("Contract Address:", address);
    console.log("VCN Token:", VCN_TOKEN);
    console.log("Target APY: 12%");
}

main().catch(console.error);
