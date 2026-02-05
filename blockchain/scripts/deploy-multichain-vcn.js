/**
 * Multi-Chain VCN Token Deployment Script
 * 
 * Deploys VCN Token to:
 * - Polygon Amoy (Chain ID: 80002)
 * - Base Sepolia (Chain ID: 84532)
 * 
 * Prerequisites:
 * - Hardhat configured with multiple networks
 * - Private key with funds on each testnet
 * 
 * Usage:
 * npx hardhat run scripts/deploy-multichain-vcn.js --network polygon_amoy
 * npx hardhat run scripts/deploy-multichain-vcn.js --network base_sepolia
 */

const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();

    console.log("=".repeat(60));
    console.log("Multi-Chain VCN Token Deployment");
    console.log("=".repeat(60));
    console.log(`Network: ${hre.network.name}`);
    console.log(`Chain ID: ${(await deployer.provider.getNetwork()).chainId}`);
    console.log(`Deployer: ${deployer.address}`);

    const balance = await deployer.provider.getBalance(deployer.address);
    console.log(`Balance: ${hre.ethers.formatEther(balance)} Native Token`);
    console.log("=".repeat(60));

    // Bridge relayer address (same as Sepolia deployment)
    const BRIDGE_RELAYER = "0x5B913E69f8f7e36e9EB9A9c64bD7f730F2a1DF99";

    console.log("\nDeploying VCN Token...");
    console.log(`  Admin: ${deployer.address}`);
    console.log(`  Bridge Relayer: ${BRIDGE_RELAYER}`);

    // Deploy VCN Token (using VCNTokenSepolia contract - same code for all chains)
    const VCNToken = await hre.ethers.getContractFactory("contracts/VCNTokenSepolia.sol:VCNToken");
    const vcnToken = await VCNToken.deploy(deployer.address, BRIDGE_RELAYER);
    await vcnToken.waitForDeployment();

    const vcnAddress = await vcnToken.getAddress();
    console.log(`\n✅ VCN Token deployed: ${vcnAddress}`);

    // Verify deployment
    const name = await vcnToken.name();
    const symbol = await vcnToken.symbol();
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);

    // Output for updating Bridge.tsx
    console.log("\n" + "=".repeat(60));
    console.log("UPDATE Bridge.tsx with this address:");
    console.log("=".repeat(60));

    const chainId = (await deployer.provider.getNetwork()).chainId;
    if (Number(chainId) === 80002) {
        console.log(`[POLYGON_AMOY_CHAIN_ID]: '${vcnAddress}',`);
    } else if (Number(chainId) === 84532) {
        console.log(`[BASE_SEPOLIA_CHAIN_ID]: '${vcnAddress}',`);
    }

    console.log("\nDeployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
