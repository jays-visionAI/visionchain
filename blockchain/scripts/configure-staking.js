/**
 * Vision Chain v2 - Set APY and Whitelist Staking
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const ADMIN_KEY = process.env.VISION_ADMIN_PK;
const CHAIN_ID = 3151909;

// Deployed addresses
const DEPLOYED = {
    VCN_TOKEN: "0x76c3C3A9BdfbfBC22e9F92b602D86B46Db021c33",
    PAYMASTER: "0x1F62fd30715131be3DA6C162678aBAFED075c77f",
    BRIDGE_STAKING: "0xc351628EB244ec633d5f21fBD6621e1a683B1181"
};

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Configure Staking");
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("Deployer:", wallet.address);

    // Load BridgeStaking
    const stakingPath = path.join(__dirname, '../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json');
    const stakingArtifact = JSON.parse(fs.readFileSync(stakingPath, 'utf8'));
    const staking = new ethers.Contract(DEPLOYED.BRIDGE_STAKING, stakingArtifact.abi, wallet);

    // Check owner
    console.log("1. Checking owner...");
    const stakingOwner = await staking.owner();
    console.log("   BridgeStaking owner:", stakingOwner);

    // Set APY
    console.log("\n2. Setting target APY to 12%...");
    try {
        const tx = await staking.setTargetAPY(1200);
        await tx.wait();
        console.log("   APY set!");
    } catch (err) {
        console.log("   Error:", err.message.slice(0, 100));
    }

    // Check current APY
    console.log("\n3. Checking current APY...");
    const currentAPY = await staking.targetAPY();
    console.log("   Current APY:", currentAPY.toString(), "basis points");

    // Whitelist in paymaster
    console.log("\n4. Whitelisting BridgeStaking in Paymaster...");
    const paymasterPath = path.join(__dirname, '../artifacts/contracts/VCNPaymasterNative.sol/VCNPaymasterNative.json');
    const paymasterArtifact = JSON.parse(fs.readFileSync(paymasterPath, 'utf8'));
    const paymaster = new ethers.Contract(DEPLOYED.PAYMASTER, paymasterArtifact.abi, wallet);

    try {
        const whitelistTx = await paymaster.setWhitelistedContract(DEPLOYED.BRIDGE_STAKING, true);
        await whitelistTx.wait();
        console.log("   Whitelisted!");
    } catch (err) {
        console.log("   Error:", err.message.slice(0, 100));
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("  Configuration Complete");
    console.log("=".repeat(60));
    console.log(DEPLOYED);

    // Save deployment
    const deploymentPath = path.join(__dirname, '../deployments/visionV2.json');
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
        addresses: DEPLOYED
    }, null, 2));
    console.log(`\nDeployment saved to: ${deploymentPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
