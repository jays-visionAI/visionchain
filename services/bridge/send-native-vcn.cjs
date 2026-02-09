/**
 * Send native VCN from admin wallet to TSS wallet
 */

const { ethers } = require('ethers');

const VISION_RPC = 'https://api.visionchain.co/rpc-proxy';
const TSS_ADDRESS = '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794';

// From .env
const ADMIN_KEY = process.env.VISION_ADMIN_PK;

async function sendNativeVCN() {
    const provider = new ethers.JsonRpcProvider(VISION_RPC);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("=== Send Native VCN ===\n");
    console.log(`From: ${wallet.address}`);
    console.log(`To: ${TSS_ADDRESS}`);

    // Check sender balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`\nSender Balance: ${ethers.formatEther(balance)} VCN`);

    if (balance === 0n) {
        console.log("Error: Sender has no native VCN!");
        return;
    }

    // Send 10 VCN (or less if not enough)
    const amount = balance < ethers.parseEther('10')
        ? balance - ethers.parseEther('0.01')  // Leave some for gas
        : ethers.parseEther('10');

    if (amount <= 0n) {
        console.log("Error: Not enough balance to send");
        return;
    }

    console.log(`Amount: ${ethers.formatEther(amount)} VCN`);
    console.log("\nSending...");

    const tx = await wallet.sendTransaction({
        to: TSS_ADDRESS,
        value: amount,
        gasLimit: 21000
    });

    console.log(`Tx Hash: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Confirmed in block ${receipt.blockNumber}`);

    // Check new balance
    const newBalance = await provider.getBalance(TSS_ADDRESS);
    console.log(`\nTSS New Balance: ${ethers.formatEther(newBalance)} VCN`);
    console.log("\n=== Done ===");
}

sendNativeVCN().catch(console.error);
