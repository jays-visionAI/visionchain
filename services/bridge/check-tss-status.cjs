/**
 * Check TSS Balance on Sepolia
 * Make sure TSS has enough ETH for gas fees
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

async function checkTSSBalance() {
    const sepoliaRpc = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
    const tssPrivateKey = process.env.TSS_PRIVATE_KEY;

    if (!tssPrivateKey) {
        console.error("ERROR: TSS_PRIVATE_KEY not found in .env");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(sepoliaRpc);
    const wallet = new ethers.Wallet(tssPrivateKey, provider);

    console.log("=== TSS Wallet Status ===\n");
    console.log(`Address: ${wallet.address}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Sepolia ETH: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther("0.01")) {
        console.log("\n⚠️  WARNING: Low balance! Need at least 0.01 ETH for gas fees.");
        console.log("Get free Sepolia ETH from: https://sepoliafaucet.com/");
    } else {
        console.log("\n✅ Sufficient balance for bridge operations.");
    }

    // Check Vision Chain balance too
    const visionRpc = process.env.VISION_RPC || 'https://api.visionchain.co/rpc-proxy';
    const visionProvider = new ethers.JsonRpcProvider(visionRpc);
    const visionBalance = await visionProvider.getBalance(wallet.address);
    console.log(`\nVision VCN: ${ethers.formatEther(visionBalance)} VCN`);
}

checkTSSBalance().catch(console.error);
