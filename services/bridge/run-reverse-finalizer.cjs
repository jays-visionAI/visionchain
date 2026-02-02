/**
 * Reverse Bridge Finalizer (Vision → Sepolia)
 * 
 * Monitors Sepolia MessageInbox for pending messages
 * Finalizes after challenge period and triggers mint on Sepolia
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const config = {
    dstRpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    dstMessageInbox: process.env.SRC_MESSAGE_INBOX,   // Sepolia MessageInbox
    dstEqualizer: process.env.SRC_EQUALIZER,          // Sepolia Equalizer
    finalizerPrivateKey: process.env.FINALIZER_PRIVATE_KEY,
    pollIntervalMs: 30000  // 30 seconds
};

const MESSAGE_INBOX_ABI = [
    "function getPendingCount() view returns (uint256)",
    "function pendingMessages(uint256 index) view returns (bytes32)",
    "function getMessage(bytes32 messageHash) view returns (tuple(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, uint256 submittedAt, uint256 challengePeriodEnd, uint8 state, address challenger, bytes32 challengeId))",
    "function finalize(bytes32 messageHash) external",
    "function getTimeRemaining(bytes32 messageHash) view returns (uint256)"
];

const EQUALIZER_ABI = [
    "function executeMint(bytes32 messageHash) external"
];

class ReverseBridgeFinalizer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(config.dstRpc);
        this.signer = new ethers.Wallet(config.finalizerPrivateKey, this.provider);

        this.messageInbox = new ethers.Contract(
            config.dstMessageInbox,
            MESSAGE_INBOX_ABI,
            this.signer
        );

        this.equalizer = new ethers.Contract(
            config.dstEqualizer,
            EQUALIZER_ABI,
            this.signer
        );
    }

    async start() {
        console.log("=== Reverse Bridge Finalizer (Vision → Sepolia) ===");
        console.log(`Finalizer Address: ${this.signer.address}`);
        console.log(`Sepolia MessageInbox: ${config.dstMessageInbox}`);
        console.log(`Sepolia Equalizer: ${config.dstEqualizer}`);
        console.log(`\nPolling every ${config.pollIntervalMs / 1000}s for pending messages...\n`);

        this.poll();
    }

    async poll() {
        while (true) {
            try {
                await this.checkAndFinalize();
            } catch (error) {
                console.error(`Error: ${error.message}`);
            }
            await new Promise(r => setTimeout(r, config.pollIntervalMs));
        }
    }

    async checkAndFinalize() {
        const count = await this.messageInbox.getPendingCount();

        if (count === 0n) {
            console.log(`[${new Date().toISOString()}] No pending messages on Sepolia`);
            return;
        }

        console.log(`\n[${new Date().toISOString()}] Checking ${count} pending messages on Sepolia...`);

        for (let i = 0n; i < count; i++) {
            const messageHash = await this.messageInbox.pendingMessages(i);
            const message = await this.messageInbox.getMessage(messageHash);

            // Only PENDING state (1)
            if (message.state !== 1) continue;

            const timeRemaining = await this.messageInbox.getTimeRemaining(messageHash);

            if (timeRemaining === 0n) {
                console.log(`\nFinalizing on Sepolia: ${messageHash.slice(0, 20)}...`);
                console.log(`  Recipient: ${message.recipient}`);
                console.log(`  Amount: ${ethers.formatEther(message.amount)}`);

                await this.finalizeAndMint(messageHash);
            } else {
                console.log(`  ${messageHash.slice(0, 12)}... - ${timeRemaining}s remaining`);
            }
        }
    }

    async finalizeAndMint(messageHash) {
        try {
            console.log("  Step 1: Finalize...");
            const tx1 = await this.messageInbox.finalize(messageHash, { gasLimit: 300000 });
            await tx1.wait();
            console.log(`  Finalized: ${tx1.hash}`);

            console.log("  Step 2: Mint on Sepolia...");
            const tx2 = await this.equalizer.executeMint(messageHash, { gasLimit: 500000 });
            await tx2.wait();
            console.log(`  SUCCESS! Tokens minted: ${tx2.hash}`);

        } catch (error) {
            console.error(`  Failed: ${error.message}`);
        }
    }
}

const finalizer = new ReverseBridgeFinalizer();
finalizer.start().catch(console.error);
