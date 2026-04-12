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

    // Register 'jays' (Deployer) -> Prefers Vision Chain (1337) + VCN Token
    const VCN_TOKEN = "0x76c3C3A9BdfbfBC22e9F92b602D86B46Db021c33";
    await registry.registerProfile("jays", 1337, VCN_TOKEN);
    console.log("   - Registered '@jays' -> Vision / VCN");

    console.log("\n🎉 Registry Ready!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
