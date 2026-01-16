const { ethers } = require('ethers');

async function main() {
    const SEQUENCER_URL = 'https://api.visionchain.co/rpc/submit';
    console.log(`🚀 Testing Vision Shared Sequencer at ${SEQUENCER_URL}`);

    // 1. Create a random wallet (Simulator)
    const wallet = ethers.Wallet.createRandom();
    console.log(`👤 Simulated User: ${wallet.address}`);

    // 2. Create a dummy transaction
    const tx = {
        to: "0x0000000000000000000000000000000000000000",
        value: ethers.parseEther("1.0"),
        gasLimit: 21000,
        gasPrice: ethers.parseUnits("1", "gwei"),
        nonce: 0,
        chainId: 3151909 // Vision Testnet ChainID
    };

    // 3. Sign it
    const signedTx = await wallet.signTransaction(tx);
    console.log(`✍️ Signed Tx: ${signedTx.substring(0, 20)}...`);

    // 4. Submit to Shared Sequencer
    try {
        const response = await fetch(SEQUENCER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chainId: 3151909,
                signedTx: signedTx,
                type: 'evm'
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Sequencer Response:", JSON.stringify(data, null, 2));

        if (data.status === 'sequenced') {
            console.log("🎉 SUCCESS: Transaction successfully ingested by Shared Sequencer!");
        } else {
            console.log("⚠️ WARNING: Unexpected status.");
        }

    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

main();
