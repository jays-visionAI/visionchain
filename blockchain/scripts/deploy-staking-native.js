/**
 * Deploy BridgeStakingNative to Vision Chain v2
 * 
 * Usage: npx hardhat run scripts/deploy-staking-native.js --network visionV2
 */

const hre = require("hardhat");

async function main() {
    console.log("\n=== BridgeStakingNative Deployment ===\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Check native VCN balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer VCN Balance:", hre.ethers.formatEther(balance), "VCN\n");

    if (balance < hre.ethers.parseEther("10")) {
        throw new Error("Insufficient VCN for deployment gas (need at least 10 VCN)");
    }

    // Deploy BridgeStakingNative
    console.log("1. Deploying BridgeStakingNative...");
    const BridgeStaking = await hre.ethers.getContractFactory("BridgeStakingNative");
    const staking = await BridgeStaking.deploy();
    await staking.waitForDeployment();

    const stakingAddress = await staking.getAddress();
    console.log("   BridgeStakingNative:", stakingAddress);

    // Set target APY to 12%
    console.log("\n2. Setting target APY to 12%...");
    const setApyTx = await staking.setTargetAPY(1200); // 12% = 1200 basis points
    await setApyTx.wait();
    console.log("   APY set to 12%");

    // Fund reward pool with initial VCN (optional)
    const INITIAL_FUND = hre.ethers.parseEther("100"); // 100 VCN
    if (balance > INITIAL_FUND + hre.ethers.parseEther("50")) {
        console.log("\n3. Funding reward pool with 100 VCN...");
        const fundTx = await staking.fundRewardPool({ value: INITIAL_FUND });
        await fundTx.wait();
        console.log("   Reward pool funded with 100 VCN");
    }

    // Summary
    console.log("\n=== Deployment Summary ===");
    console.log({
        BridgeStakingNative: stakingAddress,
        TargetAPY: "12%",
        MinimumStake: "10,000 VCN",
        CooldownPeriod: "7 days"
    });

    console.log("\n=== Update .env files ===");
    console.log(`NEXT_PUBLIC_BRIDGE_STAKING_ADDRESS=${stakingAddress}`);

    console.log("\n=== Update ValidatorStaking.tsx ===");
    console.log(`const BRIDGE_STAKING_ADDRESS = "${stakingAddress}";`);

    return { stakingAddress };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
