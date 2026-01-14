const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting Vision Chain Interop Deployment...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy Vision Equalizer (Center of the Universe) on Vision Chain
    // Note: This script assumes it's running against the Vision Testnet (3151909)
    const VisionEqualizer = await hre.ethers.getContractFactory("VisionEqualizer");
    const equalizer = await VisionEqualizer.deploy();
    await equalizer.waitForDeployment();
    console.log("✅ VisionEqualizer deployed to:", await equalizer.getAddress());

    // 2. (Simulation) Deploy a Mock Token + VisionVault on the SAME chain 
    // just to verify the logic, although in reality Vaults go on OTHER chains.
    const VCNToken = await hre.ethers.getContractFactory("VCNToken");
    // Assuming VCNToken is already compiled from previous tasks
    // Deploying a fresh one for the Vault test
    const mockUSDT = await VCNToken.deploy(deployer.address, deployer.address);
    await mockUSDT.waitForDeployment();
    console.log("🔸 Mock USDT (for Vault) deployed to:", await mockUSDT.getAddress());

    const VisionVault = await hre.ethers.getContractFactory("VisionVault");
    const vault = await VisionVault.deploy(await mockUSDT.getAddress(), 11155111); // Mock Sepolia ChainID
    await vault.waitForDeployment();
    console.log("✅ VisionVault (Mock Sepolia) deployed to:", await vault.getAddress());

    console.log("🎉 Interop System Deployed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
