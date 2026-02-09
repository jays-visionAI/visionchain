
const { ethers } = require('ethers');

// Configuration
// Admin Private Key (VerifyingSigner & Deployer)
// IMPORTANT: This key MUST match the 'signer' that the Backend uses to sign Paymaster requests.
// For MVP/Testnet, we assume Admin = Backend Signer.
const ADMIN_PK = process.env.VISION_ADMIN_PK;
const RPC_URL = "https://api.visionchain.co/rpc-proxy";

// EntryPoint v0.7 Address (Standard)
const ENTRY_POINT_ADDRESS = "0x0000000071727de22e5e9d8baf0edac6f37a0521";

// VCNPaymasterV2 Artifact (compiled ABI/Bytecode)
// Since we don't have the hardhat 'artifacts' accessible easily in this script context 
// if compile hasn't run, we will assume we can use the Hardhat Runtime Environment if run via 'npx hardhat run'.
// BUT, to be robust for the user's environment, we will try to use 'hre' if available, or fetch artifacts if pre-compiled.

async function main() {
    // We expect this script to be run via `npx hardhat run scripts/deploy_paymaster_v2.cjs`
    // This injects `hre` into the global scope.
    const hre = require("hardhat");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying VCNPaymasterV2 with account:", deployer.address);

    const verifyingSigner = deployer.address; // Admin as verifying signer for now
    console.log("Using EntryPoint:", ENTRY_POINT_ADDRESS);
    console.log("Using VerifyingSigner:", verifyingSigner);

    // 1. Get Factory
    const PaymasterFactory = await hre.ethers.getContractFactory("VCNPaymasterV2");

    // 2. Deploy
    // Constructor: (IEntryPoint _entryPoint, address _verifyingSigner)
    const paymaster = await PaymasterFactory.deploy(ENTRY_POINT_ADDRESS, verifyingSigner);

    console.log("Deploying... (Waiting for confirmation)");
    await paymaster.waitForDeployment();

    const address = await paymaster.getAddress();
    console.log("\n>>> VCNPaymasterV2 Deployed Address:", address);
    console.log("----------------------------------------------------");

    // 3. Initial Top-up (Deposit)
    console.log("Attempting initial top-up (0.1 ETH)...");
    try {
        // Send ETH directly to paymaster (triggering receive() -> depositTo)
        const tx = await deployer.sendTransaction({
            to: address,
            value: hre.ethers.parseEther("0.1")
        });
        await tx.wait();
        console.log("Top-up successful! Hash:", tx.hash);
    } catch (e) {
        console.warn("Top-up failed (might need manual deposit later):", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
