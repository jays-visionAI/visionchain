const hre = require("hardhat");

async function main() {
    console.log("🚀 Deploying Vision Equalizer (Hub) to VCN...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Account:", deployer.address);

    const VisionEqualizer = await hre.ethers.getContractFactory("VisionEqualizer");
    const equalizer = await VisionEqualizer.deploy();
    await equalizer.waitForDeployment();

    const address = await equalizer.getAddress();
    console.log("✅ VisionEqualizer deployed to:", address);

    // Output for saving
    console.log(`\nCopy this address to your Relayer Config: HUB_ADDRESS=${address}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
