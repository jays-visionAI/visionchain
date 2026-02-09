/**
 * Vision Chain v2 - Deploy BridgeStaking
 * VCNToken and Paymaster already deployed
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
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    PAYMASTER: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - BridgeStaking Deployment");
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("Deployer:", wallet.address);
    console.log("VCN Token:", DEPLOYED.VCN_TOKEN);

    const balance = await provider.getBalance(wallet.address);
    console.log("Native VCN Balance:", ethers.formatEther(balance), "VCN\n");

    // Deploy BridgeStaking
    console.log("1. Deploying BridgeStaking...");
    const stakingPath = path.join(__dirname, '../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json');
    const stakingArtifact = JSON.parse(fs.readFileSync(stakingPath, 'utf8'));

    const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, wallet);
    const staking = await stakingFactory.deploy(DEPLOYED.VCN_TOKEN);
    await staking.waitForDeployment();
    const stakingAddress = await staking.getAddress();
    console.log("   BridgeStaking:", stakingAddress);

    // Set APY to 12%
    console.log("\n2. Setting target APY to 12%...");
    const setApyTx = await staking.setTargetAPY(1200);
    await setApyTx.wait();
    console.log("   APY set!");

    // Whitelist staking contract in paymaster
    console.log("\n3. Whitelisting BridgeStaking in Paymaster...");
    const paymasterPath = path.join(__dirname, '../artifacts/contracts/VCNPaymasterNative.sol/VCNPaymasterNative.json');
    const paymasterArtifact = JSON.parse(fs.readFileSync(paymasterPath, 'utf8'));
    const paymaster = new ethers.Contract(DEPLOYED.PAYMASTER, paymasterArtifact.abi, wallet);

    const whitelistTx = await paymaster.setWhitelistedContract(stakingAddress, true);
    await whitelistTx.wait();
    console.log("   Whitelisted!");

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("  Deployment Complete");
    console.log("=".repeat(60));
    console.log({
        VCN_TOKEN: DEPLOYED.VCN_TOKEN,
        PAYMASTER: DEPLOYED.PAYMASTER,
        BRIDGE_STAKING: stakingAddress
    });

    console.log("\n=== Update .env files ===");
    console.log(`NEXT_PUBLIC_VCN_TOKEN_ADDRESS=${DEPLOYED.VCN_TOKEN}`);
    console.log(`NEXT_PUBLIC_PAYMASTER_ADDRESS=${DEPLOYED.PAYMASTER}`);
    console.log(`NEXT_PUBLIC_BRIDGE_STAKING_ADDRESS=${stakingAddress}`);

    // Save deployment
    const deploymentPath = path.join(__dirname, '../deployments/visionV2.json');
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
        addresses: {
            VCN_TOKEN: DEPLOYED.VCN_TOKEN,
            PAYMASTER: DEPLOYED.PAYMASTER,
            BRIDGE_STAKING: stakingAddress
        }
    }, null, 2));
    console.log(`\nDeployment saved to: ${deploymentPath}`);

    return stakingAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
