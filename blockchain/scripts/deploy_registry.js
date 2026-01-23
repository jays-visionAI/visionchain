const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting Deployment of Vision Profile Registry...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("🔑 Deploying with account:", deployer.address);

    const VisionProfileRegistry = await hre.ethers.getContractFactory("VisionProfileRegistry");
    const registry = await VisionProfileRegistry.deploy();
    await registry.waitForDeployment();

    const registryAddr = await registry.getAddress();
    console.log(`✅ VisionProfileRegistry deployed to: ${registryAddr}`);

    // --- Seed Initial Data (Mock) ---
    console.log("\n🌱 Seeding Mock Profiles...");

    // Register 'jays' (Deployer) -> Prefers Vision Chain (3151909) + VCN Token
    const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
    await registry.registerProfile("jays", 3151909, VCN_TOKEN);
    console.log("   - Registered '@jays' -> Vision / VCN");

    console.log("\n🎉 Registry Ready!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
