// scripts/deployBridgeStaking.js
// Phase 2: Deploy BridgeStaking contract

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying BridgeStaking with:", deployer.address);

    // VCN Token address (from Phase 1 deployment)
    const VCN_TOKEN = process.env.VCN_TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    // Deploy BridgeStaking
    const BridgeStaking = await hre.ethers.getContractFactory("BridgeStaking");
    const staking = await BridgeStaking.deploy(VCN_TOKEN);
    await staking.waitForDeployment();

    const stakingAddress = await staking.getAddress();
    console.log("BridgeStaking deployed to:", stakingAddress);

    // Get ChallengeManager address (if deployed)
    const CHALLENGE_MANAGER = process.env.CHALLENGE_MANAGER_ADDRESS;
    if (CHALLENGE_MANAGER) {
        // Set staking in ChallengeManager
        const ChallengeManager = await hre.ethers.getContractFactory("ChallengeManager");
        const manager = ChallengeManager.attach(CHALLENGE_MANAGER);
        await manager.setBridgeStaking(stakingAddress);
        console.log("BridgeStaking linked to ChallengeManager");

        // Set bridge in BridgeStaking  
        await staking.setBridge(CHALLENGE_MANAGER);
        console.log("ChallengeManager set as bridge in BridgeStaking");
    }

    console.log("\n=== Phase 2 Deployment Complete ===");
    console.log("BridgeStaking:", stakingAddress);
    console.log("VCN Token:", VCN_TOKEN);
    console.log("\nParameters:");
    console.log("- Minimum Stake: 10,000 VCN");
    console.log("- Cooldown: 7 days");
    console.log("- Slash %: 50%");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
