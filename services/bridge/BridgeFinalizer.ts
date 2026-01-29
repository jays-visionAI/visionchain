/**
 * Bridge Finalizer Service
 * 
 * Finalizes messages after challenge period ends.
 * Can be run by anyone - uses gas from runner's wallet.
 */

import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';

interface FinalizerConfig {
    dstRpc: string;
    dstMessageInbox: string;
    dstEqualizer: string;
    finalizerPrivateKey: string;
    pollIntervalMs: number;
}

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

export class BridgeFinalizer {
    private config: FinalizerConfig;
    private provider: JsonRpcProvider;
    private signer: Wallet;
    private messageInbox: Contract;
    private equalizer: Contract;
    private isRunning: boolean = false;

    constructor(config: FinalizerConfig) {
        this.config = config;
        this.provider = new JsonRpcProvider(config.dstRpc);
        this.signer = new Wallet(config.finalizerPrivateKey, this.provider);

        this.messageInbox = new Contract(
            config.dstMessageInbox,
            MESSAGE_INBOX_ABI,
            this.signer
        );

        this.equalizer = new Contract(
            config.dstEqualizer,
            EQUALIZER_ABI,
            this.signer
        );
    }

    async start() {
        console.log('Bridge Finalizer starting...');
        console.log(`MessageInbox: ${this.config.dstMessageInbox}`);

        this.isRunning = true;
        this.monitorLoop();
    }

    async stop() {
        this.isRunning = false;
        console.log('Bridge Finalizer stopped');
    }

    private async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkAndFinalize();
            } catch (error) {
                console.error('Error in finalizer loop:', error);
            }

            await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
        }
    }

    private async checkAndFinalize() {
        const count = await this.messageInbox.getPendingCount();

        if (count === 0n) return;

        console.log(`\nChecking ${count} pending messages for finalization...`);

        for (let i = 0n; i < count; i++) {
            const messageHash = await this.messageInbox.pendingMessages(i);
            const message = await this.messageInbox.getMessage(messageHash);

            // Only check PENDING state (1)
            if (message.state !== 1) continue;

            const timeRemaining = await this.messageInbox.getTimeRemaining(messageHash);

            if (timeRemaining === 0n) {
                console.log(`\nFinalizing message: ${messageHash.slice(0, 10)}...`);
                console.log(`  Recipient: ${message.recipient}`);
                console.log(`  Amount: ${ethers.formatEther(message.amount)}`);

                await this.finalizeAndMint(messageHash);
            } else {
                console.log(`Message ${messageHash.slice(0, 10)}... - ${timeRemaining}s remaining`);
            }
        }
    }

    private async finalizeAndMint(messageHash: string) {
        try {
            // Step 1: Finalize in MessageInbox
            console.log('Step 1: Finalizing in MessageInbox...');
            const finalizeTx = await this.messageInbox.finalize(messageHash, { gasLimit: 300000 });
            await finalizeTx.wait();
            console.log('Finalized');

            // Step 2: Execute Mint in Equalizer
            console.log('Step 2: Executing mint...');
            const mintTx = await this.equalizer.executeMint(messageHash, { gasLimit: 500000 });
            await mintTx.wait();
            console.log('Minted successfully!');

        } catch (error) {
            console.error('Failed to finalize/mint:', error);
        }
    }
}

// Standalone runner
if (require.main === module) {
    const config: FinalizerConfig = {
        dstRpc: process.env.VISION_RPC || 'http://localhost:8545',
        dstMessageInbox: process.env.DST_INBOX || '0x...',
        dstEqualizer: process.env.DST_EQUALIZER || '0x...',
        finalizerPrivateKey: process.env.FINALIZER_PRIVATE_KEY || '',
        pollIntervalMs: 60000  // 1 minute
    };

    const finalizer = new BridgeFinalizer(config);

    finalizer.start().catch(console.error);

    process.on('SIGINT', () => {
        finalizer.stop();
        process.exit(0);
    });
}

export default BridgeFinalizer;
