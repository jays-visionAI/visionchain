const hre = require("hardhat");

async function main() {
    const NETWORK = hre.network.name;
    console.log(`🚀 Deploying Vision Spoke (Vault) to ${NETWORK}...`);

    const [deployer] = await hre.ethers.getSigners();
    console.log("Account:", deployer.address);

    // 1. Deploy Mock Token (if needed) for testing
    // In production, we would use an existing token like USDC
    const VCNToken = await hre.ethers.getContractFactory("VCNToken");
    const mockToken = await VCNToken.deploy(deployer.address, deployer.address);
    await mockToken.waitForDeployment();
    const tokenAddress = await mockToken.getAddress();
    console.log(`🔸 Mock Token deployed at: ${tokenAddress}`);

    // 2. Deploy Vault
    // Note: '3151909' is the Chain ID of the HOME network (Vision Chain)
    const VisionVault = await hre.ethers.getContractFactory("VisionVault");
    const vault = await VisionVault.deploy(tokenAddress, 3151909);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`✅ VisionVault deployed at: ${vaultAddress}`);

    console.log(`\nConfig Info:`);
    console.log(`SPOKE_TOKEN=${tokenAddress}`);
    console.log(`SPOKE_VAULT=${vaultAddress}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
