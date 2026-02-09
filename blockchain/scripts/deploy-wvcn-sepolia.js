/**
 * Deploy VCN Token to Sepolia
 * Same ticker (VCN) across all chains for consistency
 * 
 * Usage: npx hardhat run scripts/deploy-wvcn-sepolia.js --network sepolia
 */
const hre = require("hardhat");

async function main() {
    console.log("\n=== Deploying VCN Token to Sepolia ===\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

    // Bridge Relayer address (Firebase Cloud Function's wallet)
    const BRIDGE_RELAYER = "0xc6176B597d40f9Db62ED60149FB7625CCa56990b";

    console.log("Bridge Relayer:", BRIDGE_RELAYER);

    // Deploy VCN Token (using VCNTokenSepolia.sol which has contract name VCNToken)
    const VCNToken = await hre.ethers.getContractFactory("VCNToken");
    const vcn = await VCNToken.deploy(deployer.address, BRIDGE_RELAYER);
    await vcn.waitForDeployment();

    const vcnAddress = await vcn.getAddress();
    console.log("\nVCN Token deployed to:", vcnAddress);

    // Verify roles
    const BRIDGE_ROLE = await vcn.BRIDGE_ROLE();
    const MINTER_ROLE = await vcn.MINTER_ROLE();

    console.log("\nRole Verification:");
    console.log("- Relayer has BRIDGE_ROLE:", await vcn.hasRole(BRIDGE_ROLE, BRIDGE_RELAYER));
    console.log("- Relayer has MINTER_ROLE:", await vcn.hasRole(MINTER_ROLE, BRIDGE_RELAYER));

    console.log("\n=== Deployment Complete ===");
    console.log("\nIMPORTANT: Update Firebase Functions with this VCN address:");
    console.log(`SEPOLIA_VCN_ADDRESS = "${vcnAddress}"`);
    console.log("\nThen redeploy bridgeRelayer function.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });

