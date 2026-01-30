/**
 * Send VCN to TSS wallet for bridge operations
 */

const { ethers } = require('ethers');

const VISION_RPC = 'https://api.visionchain.co/rpc-proxy';
const TSS_ADDRESS = '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794';
const AMOUNT = '100'; // 100 VCN

// Admin/funding wallet private key - you'll need to provide this
const FUNDING_KEY = process.env.ADMIN_PRIVATE_KEY || '';

async function sendVCN() {
    if (!FUNDING_KEY) {
        console.log("Error: ADMIN_PRIVATE_KEY environment variable required");
        console.log("\nUsage:");
        console.log("  ADMIN_PRIVATE_KEY=0x... node send-vcn-to-tss.cjs");
        return;
    }

    const provider = new ethers.JsonRpcProvider(VISION_RPC);
    const wallet = new ethers.Wallet(FUNDING_KEY, provider);

    console.log("=== Send VCN to TSS Wallet ===\n");
    console.log(`From: ${wallet.address}`);
    console.log(`To: ${TSS_ADDRESS}`);
    console.log(`Amount: ${AMOUNT} VCN\n`);

    // Check sender balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`Sender Balance: ${ethers.formatEther(balance)} VCN`);

    if (balance < ethers.parseEther(AMOUNT)) {
        console.log("Error: Insufficient balance");
        return;
    }

    // Send transaction
    console.log("\nSending...");
    const tx = await wallet.sendTransaction({
        to: TSS_ADDRESS,
        value: ethers.parseEther(AMOUNT),
        gasLimit: 21000
    });

    console.log(`Tx Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);

    // Check new balance
    const newBalance = await provider.getBalance(TSS_ADDRESS);
    console.log(`\nTSS Wallet New Balance: ${ethers.formatEther(newBalance)} VCN`);
    console.log("\n=== Done ===");
}

sendVCN().catch(console.error);
