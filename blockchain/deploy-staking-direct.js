// Direct deployment script using ethers v6
const ethers = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
    // Vision Testnet config
    const RPC_URL = "https://api.visionchain.co/rpc-proxy";
    const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    console.log("Connecting to Vision Testnet...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);
    console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "VCN");

    // Load compiled artifact
    const artifactPath = path.join(__dirname, "artifacts/contracts/BridgeStaking.sol/BridgeStaking.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    console.log("\nDeploying BridgeStaking...");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(VCN_TOKEN, {
        gasLimit: 5000000,
        gasPrice: ethers.parseUnits("1", "gwei")
    });

    console.log("Tx hash:", contract.deploymentTransaction().hash);
    console.log("Waiting for confirmation...");

    await contract.waitForDeployment();
    const address = await contract.getAddress();

    console.log("\n=== Deployment Complete ===");
    console.log("BridgeStaking deployed to:", address);
    console.log("VCN Token:", VCN_TOKEN);

    return address;
}

main()
    .then(address => {
        console.log("\nSuccess! Contract at:", address);
        process.exit(0);
    })
    .catch(err => {
        console.error("Error:", err.message);
        process.exit(1);
    });
