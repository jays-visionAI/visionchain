/**
 * Check all balances including tokens
 */

const { ethers } = require('ethers');

const VISION_RPC = 'https://api.visionchain.co/rpc-proxy';
const TSS_ADDRESS = '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794';

// Known token contract on Vision Chain
const VCN_TOKEN = '0x746a48E39dC57Ff14B872B8979E20efE5E5100B1';

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
];

async function checkAll() {
    console.log("=== Full Balance Check ===\n");
    console.log(`Address: ${TSS_ADDRESS}\n`);

    const provider = new ethers.JsonRpcProvider(VISION_RPC);

    // Native VCN
    const nativeBalance = await provider.getBalance(TSS_ADDRESS);
    console.log(`Native VCN: ${ethers.formatEther(nativeBalance)}`);

    // VCN Token (if different)
    try {
        const token = new ethers.Contract(VCN_TOKEN, ERC20_ABI, provider);
        const tokenBalance = await token.balanceOf(TSS_ADDRESS);
        const symbol = await token.symbol();
        const decimals = await token.decimals();
        console.log(`${symbol} Token: ${ethers.formatUnits(tokenBalance, decimals)}`);
    } catch (e) {
        console.log(`Token check error: ${e.message}`);
    }

    console.log("\n=== Done ===");
}

checkAll();
