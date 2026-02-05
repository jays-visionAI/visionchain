/**
 * Vision Chain v2 - Direct Deployment (without hardhat network)
 * 
 * Uses ethers.js directly to deploy contracts
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CHAIN_ID = 3151909;

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Contract Deployment");
    console.log("=".repeat(60) + "\n");

    // Connect to network
    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("Deployer:", wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log("Native VCN Balance:", ethers.formatEther(balance), "VCN\n");

    if (balance < ethers.parseEther("100")) {
        throw new Error("Insufficient Native VCN for deployment");
    }

    const deployedAddresses = {};

    // ============ 1. Deploy VCNToken ============
    console.log("1. Deploying VCNToken (ERC-20)...");
    const vcnTokenPath = path.join(__dirname, '../artifacts/contracts/VCNToken.sol/VCNToken.json');
    const vcnTokenArtifact = JSON.parse(fs.readFileSync(vcnTokenPath, 'utf8'));

    const vcnTokenFactory = new ethers.ContractFactory(vcnTokenArtifact.abi, vcnTokenArtifact.bytecode, wallet);
    const vcnToken = await vcnTokenFactory.deploy(wallet.address, wallet.address);
    await vcnToken.waitForDeployment();
    deployedAddresses.VCN_TOKEN = await vcnToken.getAddress();
    console.log("   VCNToken:", deployedAddresses.VCN_TOKEN);

    // ============ 2. Deploy VCNPaymasterNative ============
    console.log("\n2. Deploying VCNPaymasterNative...");
    const paymasterPath = path.join(__dirname, '../artifacts/contracts/VCNPaymasterNative.sol/VCNPaymasterNative.json');
    const paymasterArtifact = JSON.parse(fs.readFileSync(paymasterPath, 'utf8'));

    // Paymaster needs signers array and required signatures count
    const signers = [wallet.address]; // Admin is the initial signer
    const requiredSignatures = 1;

    const paymasterFactory = new ethers.ContractFactory(paymasterArtifact.abi, paymasterArtifact.bytecode, wallet);
    const paymaster = await paymasterFactory.deploy(signers, requiredSignatures);
    await paymaster.waitForDeployment();
    deployedAddresses.PAYMASTER = await paymaster.getAddress();
    console.log("   VCNPaymasterNative:", deployedAddresses.PAYMASTER);

    // Fund paymaster
    console.log("   Funding Paymaster with 1000 VCN...");
    const fundTx = await wallet.sendTransaction({
        to: deployedAddresses.PAYMASTER,
        value: ethers.parseEther("1000")
    });
    await fundTx.wait();
    console.log("   Paymaster funded!");

    // ============ 3. Deploy BridgeStaking ============
    console.log("\n3. Deploying BridgeStaking...");
    const stakingPath = path.join(__dirname, '../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json');
    const stakingArtifact = JSON.parse(fs.readFileSync(stakingPath, 'utf8'));

    const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, wallet);
    const staking = await stakingFactory.deploy(deployedAddresses.VCN_TOKEN);
    await staking.waitForDeployment();
    deployedAddresses.BRIDGE_STAKING = await staking.getAddress();
    console.log("   BridgeStaking:", deployedAddresses.BRIDGE_STAKING);

    // Set APY
    console.log("   Setting target APY to 12%...");
    const setApyTx = await staking.setTargetAPY(1200);
    await setApyTx.wait();

    // ============ 4. Restore Snapshot ============
    console.log("\n4. Restoring balances from snapshot...");
    const snapshotPath = path.join(__dirname, '../../snapshots/vcn-snapshot.json');

    if (!fs.existsSync(snapshotPath)) {
        console.log("   WARNING: Snapshot file not found, skipping");
    } else {
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        const balances = snapshot.balances;

        const deployerLower = wallet.address.toLowerCase();
        const addressesToRestore = Object.entries(balances).filter(
            ([addr]) => addr.toLowerCase() !== deployerLower
        );

        console.log(`   Found ${addressesToRestore.length} addresses to restore`);

        let restored = 0;
        for (const [address, amount] of addressesToRestore) {
            try {
                const tx = await vcnToken.transfer(address, amount);
                await tx.wait();
                restored++;
                if (restored % 10 === 0) {
                    console.log(`   Restored ${restored}/${addressesToRestore.length}...`);
                }
            } catch (err) {
                console.log(`   Failed: ${address} - ${err.message.slice(0, 50)}`);
            }
        }
        console.log(`   Snapshot restoration complete! (${restored}/${addressesToRestore.length})`);
    }

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("  Deployment Summary");
    console.log("=".repeat(60));
    console.log(JSON.stringify(deployedAddresses, null, 2));

    console.log("\n=== Update .env files ===");
    console.log(`NEXT_PUBLIC_VCN_TOKEN_ADDRESS=${deployedAddresses.VCN_TOKEN}`);
    console.log(`NEXT_PUBLIC_PAYMASTER_ADDRESS=${deployedAddresses.PAYMASTER}`);
    console.log(`NEXT_PUBLIC_BRIDGE_STAKING_ADDRESS=${deployedAddresses.BRIDGE_STAKING}`);

    // Save deployment
    const deploymentPath = path.join(__dirname, '../deployments/visionV2.json');
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
        addresses: deployedAddresses
    }, null, 2));
    console.log(`\nDeployment saved to: ${deploymentPath}`);

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
