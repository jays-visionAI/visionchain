/**
 * Deploy DEXSettlement + MockUSDT to Vision Chain v2
 *
 * Usage:
 *   npx hardhat run scripts/deploy-dex.js --network visionV2
 */
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "VCN");

    // 1. Deploy MockUSDT
    console.log("\n--- Deploying MockUSDT ---");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    const usdtAddr = await mockUSDT.getAddress();
    console.log("MockUSDT deployed:", usdtAddr);

    // 2. Deploy DEXSettlement
    //    admin = deployer, settler = deployer, feeCollector = deployer
    console.log("\n--- Deploying DEXSettlement ---");
    const DEXSettlement = await ethers.getContractFactory("DEXSettlement");
    const dex = await DEXSettlement.deploy(
        deployer.address,   // admin
        deployer.address,   // settler (engine will use this wallet)
        deployer.address    // fee collector
    );
    await dex.waitForDeployment();
    const dexAddr = await dex.getAddress();
    console.log("DEXSettlement deployed:", dexAddr);

    // 3. Save addresses
    const addresses = {
        MockUSDT: usdtAddr,
        DEXSettlement: dexAddr,
        deployer: deployer.address,
        network: "visionV2",
        chainId: 3151909,
        deployedAt: new Date().toISOString(),
    };

    const outPath = path.join(__dirname, "../deployed-dex.json");
    fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
    console.log("\nAddresses saved to:", outPath);
    console.log(JSON.stringify(addresses, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
