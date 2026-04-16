/**
 * Vision Chain v2 - Deploy Additional Contracts (root project, OZ 5.x)
 * 
 * Deploys contracts from /contracts directory that were lost after chain reset:
 * 1. VisionAgentSBT (EIP-5192 SoulBound Token)
 * 2. StorageRegistry
 * 3. StorageProof
 * 4. StorageRewards
 * 
 * Usage: PRIVATE_KEY=0x... npx hardhat run scripts/deploy-additional-v2.cjs --network visionchain --config hardhat.config.cjs
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Additional Contract Deployment");
    console.log("=".repeat(60) + "\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Native VCN Balance:", hre.ethers.formatEther(balance), "VCN\n");

    if (balance < hre.ethers.parseEther("10")) {
        throw new Error("Insufficient Native VCN for deployment (need at least 10 VCN)");
    }

    const deployedAddresses = {};

    // ============ 1. Deploy VisionAgentSBT ============
    console.log("1. Deploying VisionAgentSBT (EIP-5192)...");
    try {
        const AgentSBT = await hre.ethers.getContractFactory("VisionAgentSBT");
        const agentSBT = await AgentSBT.deploy({ gasLimit: 8000000 });
        await agentSBT.waitForDeployment();
        deployedAddresses.AGENT_SBT = await agentSBT.getAddress();
        console.log("   VisionAgentSBT:", deployedAddresses.AGENT_SBT);
    } catch (err) {
        console.error("   FAILED:", err.message.slice(0, 200));
    }

    // ============ 2. Deploy StorageRegistry ============
    console.log("\n2. Deploying StorageRegistry...");
    try {
        const StorageRegistry = await hre.ethers.getContractFactory("StorageRegistry");
        const storageRegistry = await StorageRegistry.deploy({ gasLimit: 8000000 });
        await storageRegistry.waitForDeployment();
        deployedAddresses.STORAGE_REGISTRY = await storageRegistry.getAddress();
        console.log("   StorageRegistry:", deployedAddresses.STORAGE_REGISTRY);
    } catch (err) {
        console.error("   FAILED:", err.message.slice(0, 200));
    }

    // ============ 3. Deploy StorageProof ============
    console.log("\n3. Deploying StorageProof...");
    try {
        const StorageProof = await hre.ethers.getContractFactory("StorageProof");
        const storageProof = await StorageProof.deploy({ gasLimit: 8000000 });
        await storageProof.waitForDeployment();
        deployedAddresses.STORAGE_PROOF = await storageProof.getAddress();
        console.log("   StorageProof:", deployedAddresses.STORAGE_PROOF);
    } catch (err) {
        console.error("   FAILED:", err.message.slice(0, 200));
    }

    // ============ 4. Deploy StorageRewards ============
    console.log("\n4. Deploying StorageRewards...");
    try {
        const StorageRewards = await hre.ethers.getContractFactory("StorageRewards");
        const storageRewards = await StorageRewards.deploy({ gasLimit: 8000000 });
        await storageRewards.waitForDeployment();
        deployedAddresses.STORAGE_REWARDS = await storageRewards.getAddress();
        console.log("   StorageRewards:", deployedAddresses.STORAGE_REWARDS);
    } catch (err) {
        console.error("   FAILED:", err.message.slice(0, 200));
    }

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("  Deployment Summary");
    console.log("=".repeat(60));
    console.log(JSON.stringify(deployedAddresses, null, 2));

    console.log("\n=== Update functions/index.js ===");
    if (deployedAddresses.AGENT_SBT) console.log(`AGENT_SBT_ADDRESS = "${deployedAddresses.AGENT_SBT}";`);
    if (deployedAddresses.STORAGE_REGISTRY) console.log(`STORAGE_REGISTRY_ADDRESS = "${deployedAddresses.STORAGE_REGISTRY}";`);
    if (deployedAddresses.STORAGE_PROOF) console.log(`STORAGE_PROOF_ADDRESS = "${deployedAddresses.STORAGE_PROOF}";`);
    if (deployedAddresses.STORAGE_REWARDS) console.log(`STORAGE_REWARDS_ADDRESS = "${deployedAddresses.STORAGE_REWARDS}";`);

    // Save to file
    const deploymentPath = path.join(__dirname, "../deployments/additional-v2.json");
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: 3151909,
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        addresses: deployedAddresses
    }, null, 2));
    console.log(`\nDeployment saved to: ${deploymentPath}`);

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
