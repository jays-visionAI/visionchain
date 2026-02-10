// Deploy BridgeStaking V2 (with stakeFor/unstakeFor delegation functions)
// Usage: npx hardhat run scripts/deployBridgeStakingV2.js --network visionV2
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    console.log("Deployer:", deployer.address);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

    console.log("\nDeploying BridgeStaking V2 to Vision Chain...");
    const BridgeStaking = await hre.ethers.getContractFactory("BridgeStaking");
    const staking = await BridgeStaking.deploy(VCN_TOKEN);
    await staking.waitForDeployment();

    const address = await staking.getAddress();
    console.log("\n=== Deployment Complete ===");
    console.log("BridgeStaking V2:", address);
    console.log("VCN Token:", VCN_TOKEN);

    // Verify deployment
    const minStake = await staking.MINIMUM_STAKE();
    console.log("Min Stake:", hre.ethers.formatEther(minStake), "VCN");

    // Set target APY (12% = 1200 basis points)
    console.log("\nSetting target APY to 12%...");
    const apyTx = await staking.setTargetAPY(1200);
    await apyTx.wait();
    console.log("APY set to 12%");

    console.log("\n=== UPDATE THESE ADDRESSES ===");
    console.log("Old Contract: 0xc351628EB244ec633d5f21fBD6621e1a683B1181");
    console.log("New Contract:", address);
    console.log("\nUpdate in:");
    console.log("  1. ValidatorStaking.tsx (BRIDGE_STAKING_ADDRESS)");
    console.log("  2. functions/index.js (BRIDGE_STAKING_ADDRESS in handleStaking)");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
