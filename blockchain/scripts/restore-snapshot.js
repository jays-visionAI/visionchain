/**
 * Vision Chain v2 - Complete Snapshot Restoration
 * VCNToken and Paymaster already deployed
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const ADMIN_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const CHAIN_ID = 3151909;

// Deployed addresses
const DEPLOYED = {
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    PAYMASTER: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Snapshot Restoration");
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("Deployer:", wallet.address);
    console.log("VCN Token:", DEPLOYED.VCN_TOKEN);
    console.log("Paymaster:", DEPLOYED.PAYMASTER);

    // Load VCN Token contract
    const vcnTokenPath = path.join(__dirname, '../artifacts/contracts/VCNToken.sol/VCNToken.json');
    const vcnTokenArtifact = JSON.parse(fs.readFileSync(vcnTokenPath, 'utf8'));
    const vcnToken = new ethers.Contract(DEPLOYED.VCN_TOKEN, vcnTokenArtifact.abi, wallet);

    // Check current balance
    const deployerBalance = await vcnToken.balanceOf(wallet.address);
    console.log("\nDeployer VCN Balance:", ethers.formatEther(deployerBalance), "VCN");

    // Restore Snapshot
    console.log("\n=== Restoring balances from snapshot ===");
    const snapshotPath = path.join(__dirname, '../../snapshots/vcn-snapshot.json');

    if (!fs.existsSync(snapshotPath)) {
        console.log("ERROR: Snapshot file not found at", snapshotPath);
        return;
    }

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const balances = snapshot.balances;

    const deployerLower = wallet.address.toLowerCase();
    const addressesToRestore = Object.entries(balances).filter(
        ([addr]) => addr.toLowerCase() !== deployerLower
    );

    console.log(`Found ${addressesToRestore.length} addresses to restore\n`);

    let restored = 0;
    let failed = 0;

    for (const [address, amount] of addressesToRestore) {
        try {
            console.log(`[${restored + failed + 1}/${addressesToRestore.length}] Transferring to ${address.slice(0, 10)}...`);
            const tx = await vcnToken.transfer(address, amount);
            await tx.wait();
            restored++;
            console.log(`   OK: ${ethers.formatEther(amount)} VCN`);
        } catch (err) {
            failed++;
            console.log(`   FAILED: ${err.message.slice(0, 80)}`);
        }
    }

    console.log("\n" + "=".repeat(60));
    console.log("  Restoration Complete");
    console.log("=".repeat(60));
    console.log(`Restored: ${restored}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${addressesToRestore.length}`);

    // Final balance check
    const finalBalance = await vcnToken.balanceOf(wallet.address);
    console.log(`\nDeployer remaining balance: ${ethers.formatEther(finalBalance)} VCN`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
