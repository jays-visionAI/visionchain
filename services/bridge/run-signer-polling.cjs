/**
 * Bridge TSS Signer - Polling Version
 * 
 * Uses block polling instead of event filters to avoid public RPC limitations
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const config = {
    srcChainId: 11155111,
    dstChainId: 1337,
    srcRpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    dstRpc: process.env.VISION_RPC || 'https://api.visionchain.co/rpc-proxy',
    srcIntentCommitment: process.env.SRC_INTENT_COMMITMENT,
    dstMessageInbox: process.env.DST_MESSAGE_INBOX,
    tssPrivateKey: process.env.TSS_PRIVATE_KEY,
    requiredConfirmations: 3,
    pollIntervalMs: 15000  // 15 seconds
};

const INTENT_ABI = [
    "event IntentCommitted(bytes32 indexed intentHash, address indexed user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry)"
];

const MESSAGE_INBOX_ABI = [
    "function submitPending(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, bytes calldata tssSignature) external returns (bytes32)"
];

class BridgeSignerPolling {
    constructor() {
        this.srcProvider = new ethers.JsonRpcProvider(config.srcRpc);
        this.dstProvider = new ethers.JsonRpcProvider(config.dstRpc);
        this.signer = new ethers.Wallet(config.tssPrivateKey, this.dstProvider);

        this.intentContract = new ethers.Contract(
            config.srcIntentCommitment,
            INTENT_ABI,
            this.srcProvider
        );

        this.messageInbox = new ethers.Contract(
            config.dstMessageInbox,
            MESSAGE_INBOX_ABI,
            this.signer
        );

        this.lastProcessedBlock = 0;
        this.processedIntents = new Set();
    }

    async start() {
        console.log("=== Bridge TSS Signer (Polling) Started ===");
        console.log(`TSS Address: ${this.signer.address}`);
        console.log(`Sepolia IntentCommitment: ${config.srcIntentCommitment}`);
        console.log(`Vision MessageInbox: ${config.dstMessageInbox}`);
        console.log(`Poll Interval: ${config.pollIntervalMs / 1000}s`);

        // Start from current block
        this.lastProcessedBlock = await this.srcProvider.getBlockNumber() - 10;
        console.log(`Starting from block: ${this.lastProcessedBlock}\n`);

        this.poll();
    }

    async poll() {
        while (true) {
            try {
                await this.checkNewEvents();
            } catch (error) {
                console.error(`Poll error: ${error.message}`);
            }
            await new Promise(r => setTimeout(r, config.pollIntervalMs));
        }
    }

    async checkNewEvents() {
        const currentBlock = await this.srcProvider.getBlockNumber();

        if (currentBlock <= this.lastProcessedBlock) {
            console.log(`[${new Date().toISOString()}] No new blocks`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Checking blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);

        const filter = this.intentContract.filters.IntentCommitted();
        const events = await this.intentContract.queryFilter(
            filter,
            this.lastProcessedBlock + 1,
            currentBlock
        );

        if (events.length > 0) {
            console.log(`Found ${events.length} IntentCreated events!`);

            for (const event of events) {
                await this.processEvent(event);
            }
        }

        this.lastProcessedBlock = currentBlock;
    }

    async processEvent(event) {
        const intentHash = event.args[0];

        if (this.processedIntents.has(intentHash)) {
            return;
        }

        console.log(`\nProcessing Intent: ${intentHash.slice(0, 20)}...`);
        console.log(`  User: ${event.args[1]}`);
        console.log(`  Amount: ${ethers.formatEther(event.args[5])}`);
        console.log(`  Recipient: ${event.args[6]}`);

        try {
            // Wait for confirmations
            const confirmed = await this.waitForConfirmations(event.blockNumber);
            if (!confirmed) return;

            // Sign
            const signature = await this.signIntent({
                intentHash,
                srcChainId: Number(event.args[2]),
                dstChainId: Number(event.args[3]),
                token: event.args[4],
                amount: event.args[5],
                recipient: event.args[6]
            });
            console.log("  Signed");

            // Submit
            console.log("  Submitting to Vision...");
            const tx = await this.messageInbox.submitPending(
                Number(event.args[2]),
                Number(event.args[3]),
                event.args[4],
                event.args[5],
                event.args[6],
                intentHash,
                signature,
                { gasLimit: 500000 }
            );

            console.log(`  Tx: ${tx.hash}`);
            await tx.wait();
            console.log("  SUCCESS!");

            this.processedIntents.add(intentHash);

        } catch (error) {
            console.error(`  Error: ${error.message}`);
        }
    }

    async waitForConfirmations(blockNumber) {
        console.log(`  Waiting for ${config.requiredConfirmations} confirmations...`);
        for (let i = 0; i < 60; i++) {  // Max 5 min wait
            const current = await this.srcProvider.getBlockNumber();
            if (current - blockNumber >= config.requiredConfirmations) {
                console.log(`  Confirmed`);
                return true;
            }
            await new Promise(r => setTimeout(r, 5000));
        }
        console.log("  Timeout waiting for confirmations");
        return false;
    }

    async signIntent(intent) {
        const messageHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'uint256', 'address', 'uint256', 'address', 'bytes32'],
                [intent.srcChainId, intent.dstChainId, intent.token, intent.amount, intent.recipient, intent.intentHash]
            )
        );
        return await this.signer.signMessage(ethers.getBytes(messageHash));
    }
}

const signer = new BridgeSignerPolling();
signer.start().catch(console.error);
