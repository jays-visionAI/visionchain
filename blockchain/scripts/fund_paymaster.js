const { ethers } = require("ethers");

async function main() {
    // 1. Setup Provider (Use Localhost RPC as we are running this on the server or locally)
    // NOTE: If running from your Mac, point to the remote RPC
    const provider = new ethers.JsonRpcProvider("https://rpc.visionchain.co");

    // 2. Setup Admin Wallet
    // Set VISION_ADMIN_PK environment variable before running
    const adminPrivateKey = process.env.VISION_ADMIN_PK;
    const adminWallet = new ethers.Wallet(adminPrivateKey, provider);

    console.log(`💰 Funding from Admin: ${adminWallet.address}`);
    const balance = await provider.getBalance(adminWallet.address);
    console.log(`   Balance: ${ethers.formatEther(balance)} POL`);

    // 3. Define Targets
    const targets = [
        {
            name: "Paymaster (Relayer)",
            address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Account #1
            amount: "100.0" // POL (Gas)
        },
        {
            name: "Treasury (Fee Collector)",
            address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", // Account #2
            amount: "10.0" // POL (Just initial dust)
        }
    ];

    // 4. Execute Transfers
    for (const target of targets) {
        console.log(`\n🚀 Funding ${target.name} (${target.address})...`);
        const currentBal = await provider.getBalance(target.address);
        console.log(`   Current Balance: ${ethers.formatEther(currentBal)} POL`);

        const tx = await adminWallet.sendTransaction({
            to: target.address,
            value: ethers.parseEther(target.amount)
        });

        console.log(`   Sent ${target.amount} POL. Tx: ${tx.hash}`);
        await tx.wait();
        console.log("   ✅ Confirmed.");
    }

    console.log("\n✅ All funding complete.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
