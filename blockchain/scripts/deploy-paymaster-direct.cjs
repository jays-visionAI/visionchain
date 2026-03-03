/**
 * Direct VCNPaymasterV2 deployment using pre-compiled artifact
 * No Hardhat Runtime required - uses ethers.js directly
 * 
 * Usage: node blockchain/scripts/deploy-paymaster-direct.cjs
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
    const RPC_URL = "https://api.visionchain.co/rpc-proxy";
    const ADMIN_PK = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    // EntryPoint v0.7 address (standard)
    const ENTRY_POINT_ADDRESS = "0x0000000071727de22e5e9d8baf0edac6f37a0521";

    console.log("=== VCNPaymasterV2 Direct Deployment ===\n");

    // 1. Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PK, provider);

    console.log("Deployer:", wallet.address);
    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "VCN\n");

    // 2. Load pre-compiled artifact
    const artifactPath = path.join(__dirname, 'artifacts/contracts/VCNPaymasterV2.sol/VCNPaymasterV2.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    console.log("Artifact loaded. Bytecode length:", artifact.bytecode.length, "chars");

    // 3. Deploy
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log("\nDeploying VCNPaymasterV2...");
    console.log("  EntryPoint:", ENTRY_POINT_ADDRESS);
    console.log("  VerifyingSigner:", wallet.address);

    const paymaster = await factory.deploy(ENTRY_POINT_ADDRESS, wallet.address, {
        gasLimit: 5000000,
        gasPrice: ethers.parseUnits("1", "gwei")
    });

    console.log("  Tx hash:", paymaster.deploymentTransaction().hash);
    console.log("  Waiting for confirmation...");

    await paymaster.waitForDeployment();
    const address = await paymaster.getAddress();

    console.log("\n>>> VCNPaymasterV2 DEPLOYED:", address);
    console.log("--------------------------------------------");

    // 4. Fund the paymaster with 100 VCN
    console.log("\nFunding paymaster with 100 VCN...");
    const fundTx = await wallet.sendTransaction({
        to: address,
        value: ethers.parseEther("100"),
        gasLimit: 100000,
        gasPrice: ethers.parseUnits("1", "gwei")
    });
    await fundTx.wait();
    console.log("  Funded! Tx:", fundTx.hash);

    // 5. Verify
    const paymasterBalance = await provider.getBalance(address);
    console.log("  Paymaster balance:", ethers.formatEther(paymasterBalance), "VCN");

    const code = await provider.getCode(address);
    console.log("  Contract code:", code.length > 4 ? "VERIFIED" : "FAILED");

    // 6. Query owner
    const contract = new ethers.Contract(address, artifact.abi, provider);
    const owner = await contract.owner();
    const signer = await contract.verifyingSigner();
    console.log("  Owner:", owner);
    console.log("  VerifyingSigner:", signer);

    console.log("\n=== UPDATE contractService.ts ===");
    console.log(`VCN_PAYMASTER: "${address}",`);
    console.log("\nDone!");
}

main().catch(console.error);
