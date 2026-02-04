/**
 * Vision Chain v2 Contract Deployment (Native VCN)
 * 
 * Deploys core contracts for Vision Chain with VCN as native token.
 * 
 * Usage: npx hardhat run scripts/deploy-native-vcn.js --network visionV2
 */

const hre = require("hardhat");

async function main() {
    console.log("\n=== Vision Chain v2 Contract Deployment ===");
    console.log("Native VCN Edition\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Check native VCN balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer VCN Balance:", hre.ethers.formatEther(balance), "VCN\n");

    if (balance < hre.ethers.parseEther("10")) {
        throw new Error("Insufficient VCN for deployment gas (need at least 10 VCN)");
    }

    const deployedAddresses = {};

    // 1. Deploy VCNVestingNative
    console.log("1. Deploying VCNVestingNative...");
    const VCNVesting = await hre.ethers.getContractFactory("VCNVestingNative");
    const vesting = await VCNVesting.deploy(deployer.address);
    await vesting.waitForDeployment();
    deployedAddresses.VCN_VESTING = await vesting.getAddress();
    console.log("   VCNVestingNative:", deployedAddresses.VCN_VESTING);

    // 2. Deploy VisionNodeLicenseNative
    console.log("2. Deploying VisionNodeLicenseNative...");
    const NodeLicense = await hre.ethers.getContractFactory("VisionNodeLicenseNative");
    const nodeLicense = await NodeLicense.deploy(deployer.address); // Treasury
    await nodeLicense.waitForDeployment();
    deployedAddresses.NODE_LICENSE = await nodeLicense.getAddress();
    console.log("   VisionNodeLicenseNative:", deployedAddresses.NODE_LICENSE);

    // 3. Deploy VisionMiningPoolNative
    console.log("3. Deploying VisionMiningPoolNative...");
    const MiningPool = await hre.ethers.getContractFactory("VisionMiningPoolNative");
    const miningPool = await MiningPool.deploy(
        deployedAddresses.NODE_LICENSE,
        deployer.address // Oracle
    );
    await miningPool.waitForDeployment();
    deployedAddresses.MINING_POOL = await miningPool.getAddress();
    console.log("   VisionMiningPoolNative:", deployedAddresses.MINING_POOL);

    // Summary
    console.log("\n=== Deployment Summary ===");
    console.log(JSON.stringify(deployedAddresses, null, 2));

    console.log("\n=== Update services/contractService.ts ===");
    console.log("const ADDRESSES = {");
    console.log(`    // Vision Chain v2 - VCN Native (Chain ID: 1337)`);
    console.log(`    VCN_VESTING: "${deployedAddresses.VCN_VESTING}",`);
    console.log(`    NODE_LICENSE: "${deployedAddresses.NODE_LICENSE}",`);
    console.log(`    MINING_POOL: "${deployedAddresses.MINING_POOL}",`);
    console.log("};");

    console.log("\n=== Token Information ===");
    console.log("- Native Token: VCN (gas currency)");
    console.log("- All contracts accept native VCN via msg.value");
    console.log("- No ERC-20 VCN token needed");

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
