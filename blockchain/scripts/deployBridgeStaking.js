// Deploy BridgeStaking using Hardhat's HRE but connect to custom network
const hre = require("hardhat");

async function main() {
    // Get contract factory from HRE (compiles if needed)
    const BridgeStaking = await hre.ethers.getContractFactory("BridgeStaking");

    // Vision Testnet config - connect manually
    const RPC_URL = "https://api.visionchain.co/rpc-proxy";
    const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    // Create custom provider and signer
    const provider = new hre.ethers.JsonRpcProvider(RPC_URL);
    const wallet = new hre.ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", hre.ethers.formatEther(balance), "VCN");

    // Connect factory to custom signer
    const connectedFactory = BridgeStaking.connect(wallet);

    console.log("\nDeploying BridgeStaking to Vision Testnet...");
    const staking = await connectedFactory.deploy(VCN_TOKEN, {
        gasLimit: 5000000,
        gasPrice: hre.ethers.parseUnits("1", "gwei")
    });

    console.log("Tx hash:", staking.deploymentTransaction().hash);
    await staking.waitForDeployment();

    const address = await staking.getAddress();
    console.log("\n=== Deployment Complete ===");
    console.log("BridgeStaking:", address);
    console.log("VCN Token:", VCN_TOKEN);

    // Verify deployment
    const minStake = await staking.MINIMUM_STAKE();
    console.log("Min Stake:", hre.ethers.formatEther(minStake), "VCN");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
