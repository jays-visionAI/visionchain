/**
 * Check TSS signer wallet balances on both chains
 */

const { ethers } = require('ethers');

const TSS_KEY = '0x78ef903e82813aebe7ff3dfb46581520435c70f8b05d8fa1d728a2bebc3179b0';

async function checkBalances() {
    const wallet = new ethers.Wallet(TSS_KEY);
    console.log("=== TSS Signer Wallet Check ===\n");
    console.log(`Address: ${wallet.address}\n`);

    // Vision Chain
    console.log("1. Vision Chain...");
    try {
        const provider = new ethers.JsonRpcProvider('https://api.visionchain.co/rpc-proxy');
        const balance = await provider.getBalance(wallet.address);
        console.log(`   Balance: ${ethers.formatEther(balance)} VCN`);
        console.log(`   Status: ${balance > 0n ? 'HAS GAS' : 'NEEDS GAS'}\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}\n`);
    }

    // Sepolia
    console.log("2. Sepolia...");
    try {
        const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
        const balance = await provider.getBalance(wallet.address);
        console.log(`   Balance: ${ethers.formatEther(balance)} ETH`);
        console.log(`   Status: ${balance > 0n ? 'HAS GAS' : 'NEEDS GAS'}\n`);
    } catch (e) {
        console.log(`   Error: ${e.message}\n`);
    }

    console.log("=== Check Complete ===");
}

checkBalances();
