// Setup BridgeStaking V2 - Set APY + Transfer Ownership
const { ethers } = require("ethers");
const readline = require("readline");

const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const CONTRACT = "0xf3c337cA02f3370f85F54e9644890a497cFD762D";
const PAYMASTER = "0x08A1B183a53a0f8f1D875945D504272738E3AF34";

const ABI = [
    "function setTargetAPY(uint256) external",
    "function transferOwnership(address) external",
    "function owner() view returns (address)",
    "function targetAPY() view returns (uint256)"
];

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, a => r(a.trim())));

    console.log("=== Setup BridgeStaking V2 ===");
    console.log("Contract:", CONTRACT);

    const pk = await ask("Paste owner private key (0xAFf8... wallet): ");
    rl.close();

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(pk, provider);
    console.log("Wallet:", await wallet.getAddress());

    const staking = new ethers.Contract(CONTRACT, ABI, wallet);

    // Check current state
    const currentOwner = await staking.owner();
    console.log("Current owner:", currentOwner);
    const currentAPY = await staking.targetAPY();
    console.log("Current APY:", currentAPY.toString(), "bps");

    // Set APY 12%
    if (currentAPY === 0n) {
        console.log("\nSetting APY to 12% (1200 bps)...");
        const tx1 = await staking.setTargetAPY(1200, { gasLimit: 100000, gasPrice: ethers.parseUnits("1", "gwei") });
        console.log("Tx:", tx1.hash);
        await tx1.wait();
        console.log("APY set!");
    }

    // Transfer ownership
    console.log(`\nTransferring ownership to Paymaster (${PAYMASTER})...`);
    const tx2 = await staking.transferOwnership(PAYMASTER, { gasLimit: 100000, gasPrice: ethers.parseUnits("1", "gwei") });
    console.log("Tx:", tx2.hash);
    await tx2.wait();
    console.log("Ownership transferred!");

    // Verify
    const newOwner = await staking.owner();
    const newAPY = await staking.targetAPY();
    console.log("\n=== Verified ===");
    console.log("Owner:", newOwner);
    console.log("APY:", newAPY.toString(), "bps");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
