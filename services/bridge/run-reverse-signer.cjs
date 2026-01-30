/**
 * Reverse Bridge TSS Signer (Vision → Sepolia)
 * 
 * Listens for IntentCommitted events on Vision Chain
 * and submits to Sepolia MessageInbox
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const config = {
    srcChainId: 1337,       // Vision (source)
    dstChainId: 11155111,   // Sepolia (destination)
    srcRpc: process.env.VISION_RPC || 'https://api.visionchain.co/rpc-proxy',
    dstRpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    srcIntentCommitment: process.env.DST_INTENT_COMMITMENT,  // Vision IntentCommitment
    dstMessageInbox: process.env.SRC_MESSAGE_INBOX,          // Sepolia MessageInbox
    tssPrivateKey: process.env.TSS_PRIVATE_KEY,
    requiredConfirmations: 1,  // Vision is faster
    pollIntervalMs: 10000
};

const INTENT_ABI = [
    "event IntentCommitted(bytes32 indexed intentHash, address indexed user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry)"
];

const MESSAGE_INBOX_ABI = [
    "function submitPending(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, bytes calldata tssSignature) external returns (bytes32)"
];

class ReverseSignerPolling {
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
        console.log("=== Reverse Bridge TSS Signer (Vision → Sepolia) ===");
        console.log(`TSS Address: ${this.signer.address}`);
        console.log(`Vision IntentCommitment: ${config.srcIntentCommitment}`);
        console.log(`Sepolia MessageInbox: ${config.dstMessageInbox}`);
        console.log(`Poll Interval: ${config.pollIntervalMs / 1000}s`);

        this.lastProcessedBlock = await this.srcProvider.getBlockNumber() - 5;
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
            console.log(`[${new Date().toISOString()}] No new blocks on Vision`);
            return;
        }

        console.log(`[${new Date().toISOString()}] Checking Vision blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);

        const filter = this.intentContract.filters.IntentCommitted();
        const events = await this.intentContract.queryFilter(
            filter,
            this.lastProcessedBlock + 1,
            currentBlock
        );

        if (events.length > 0) {
            console.log(`Found ${events.length} IntentCommitted events!`);

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

            // Submit to Sepolia
            console.log("  Submitting to Sepolia...");
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

const signer = new ReverseSignerPolling();
signer.start().catch(console.error);
