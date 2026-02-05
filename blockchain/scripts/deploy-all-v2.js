/**
 * Vision Chain v2 - Full Contract Deployment
 * 
 * Deploys:
 * 1. VCNToken (ERC-20)
 * 2. VCNPaymasterNative (gas sponsorship)
 * 3. BridgeStaking
 * 4. Restores balances from snapshot
 * 
 * Usage: npx hardhat run scripts/deploy-all-v2.js --network visionV2
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Full Contract Deployment");
    console.log("=".repeat(60) + "\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Check native VCN balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer Native VCN Balance:", hre.ethers.formatEther(balance), "VCN\n");

    if (balance < hre.ethers.parseEther("100")) {
        throw new Error("Insufficient Native VCN for deployment (need at least 100 VCN)");
    }

    const deployedAddresses = {};

    // ============ 1. Deploy VCNToken ============
    console.log("1. Deploying VCNToken (ERC-20)...");
    const VCNToken = await hre.ethers.getContractFactory("VCNToken");
    const vcnToken = await VCNToken.deploy(deployer.address, deployer.address);
    await vcnToken.waitForDeployment();
    deployedAddresses.VCN_TOKEN = await vcnToken.getAddress();
    console.log("   VCNToken:", deployedAddresses.VCN_TOKEN);

    // ============ 2. Deploy VCNPaymasterNative ============
    console.log("\n2. Deploying VCNPaymasterNative...");
    const Paymaster = await hre.ethers.getContractFactory("VCNPaymasterNative");
    const paymaster = await Paymaster.deploy(deployedAddresses.VCN_TOKEN);
    await paymaster.waitForDeployment();
    deployedAddresses.PAYMASTER = await paymaster.getAddress();
    console.log("   VCNPaymasterNative:", deployedAddresses.PAYMASTER);

    // Fund paymaster with native VCN (1000 VCN for gas sponsorship)
    console.log("   Funding Paymaster with 1000 VCN...");
    const fundTx = await deployer.sendTransaction({
        to: deployedAddresses.PAYMASTER,
        value: hre.ethers.parseEther("1000")
    });
    await fundTx.wait();
    console.log("   Paymaster funded!");

    // ============ 3. Deploy BridgeStaking ============
    console.log("\n3. Deploying BridgeStaking...");
    const BridgeStaking = await hre.ethers.getContractFactory("BridgeStaking");
    const staking = await BridgeStaking.deploy(deployedAddresses.VCN_TOKEN);
    await staking.waitForDeployment();
    deployedAddresses.BRIDGE_STAKING = await staking.getAddress();
    console.log("   BridgeStaking:", deployedAddresses.BRIDGE_STAKING);

    // Set target APY to 12%
    console.log("   Setting target APY to 12%...");
    const setApyTx = await staking.setTargetAPY(1200);
    await setApyTx.wait();

    // ============ 4. Restore Snapshot Balances ============
    console.log("\n4. Restoring balances from snapshot...");

    const snapshotPath = path.join(__dirname, "../../snapshots/vcn-snapshot.json");
    if (!fs.existsSync(snapshotPath)) {
        console.log("   WARNING: Snapshot file not found, skipping balance restoration");
    } else {
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
        const balances = snapshot.balances;

        // Skip deployer address (already has initial supply)
        const deployerLower = deployer.address.toLowerCase();
        const addressesToRestore = Object.entries(balances).filter(
            ([addr]) => addr.toLowerCase() !== deployerLower
        );

        console.log(`   Found ${addressesToRestore.length} addresses to restore`);

        // Batch transfer (max 20 per batch to avoid gas limits)
        const BATCH_SIZE = 20;
        for (let i = 0; i < addressesToRestore.length; i += BATCH_SIZE) {
            const batch = addressesToRestore.slice(i, i + BATCH_SIZE);
            console.log(`   Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(addressesToRestore.length / BATCH_SIZE)}...`);

            for (const [address, amount] of batch) {
                try {
                    const tx = await vcnToken.transfer(address, amount);
                    await tx.wait();
                } catch (err) {
                    console.log(`   Failed to transfer to ${address}: ${err.message}`);
                }
            }
        }
        console.log("   Snapshot restoration complete!");
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

    // Save to file
    const deploymentPath = path.join(__dirname, "../deployments/visionV2.json");
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: 3151909,
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
