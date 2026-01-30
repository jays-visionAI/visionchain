/**
 * Bridge TSS Signer Runner
 * 
 * Connects Sepolia → Vision Chain
 * Listens for Lock events on Sepolia and submits to Vision MessageInbox
 */

const { ethers, Contract, Wallet } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Configuration from .env
const config = {
    srcChainId: 11155111,  // Sepolia
    dstChainId: 1337,      // Vision
    srcRpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    dstRpc: process.env.VISION_RPC || 'https://api.visionchain.co/rpc-proxy',
    srcIntentCommitment: process.env.SRC_INTENT_COMMITMENT,
    dstMessageInbox: process.env.DST_MESSAGE_INBOX,
    tssPrivateKey: process.env.TSS_PRIVATE_KEY,
    requiredConfirmations: 3
};

// ABI fragments
const INTENT_ABI = [
    "event IntentCreated(bytes32 indexed intentHash, address indexed user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 expiry)",
    "function getIntent(bytes32 intentHash) view returns (tuple(address user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 expiry, uint256 nonce, uint8 status))"
];

const MESSAGE_INBOX_ABI = [
    "function submitPending(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, bytes calldata tssSignature) external returns (bytes32)",
    "function messageExists(bytes32 messageHash) view returns (bool)"
];

class BridgeSigner {
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

        this.processedIntents = new Set();
    }

    async start() {
        console.log("=== Bridge TSS Signer Started ===");
        console.log(`TSS Address: ${this.signer.address}`);
        console.log(`Sepolia IntentCommitment: ${config.srcIntentCommitment}`);
        console.log(`Vision MessageInbox: ${config.dstMessageInbox}`);
        console.log("\nListening for IntentCreated events on Sepolia...\n");

        this.intentContract.on('IntentCreated', async (intentHash, user, srcChainId, dstChainId, token, amount, recipient, expiry, event) => {
            console.log(`\n[${new Date().toISOString()}] New Intent Detected!`);
            console.log(`  IntentHash: ${intentHash}`);
            console.log(`  User: ${user}`);
            console.log(`  Amount: ${ethers.formatEther(amount)}`);
            console.log(`  Recipient: ${recipient}`);

            await this.processIntent({
                intentHash,
                user,
                srcChainId: Number(srcChainId),
                dstChainId: Number(dstChainId),
                token,
                amount,
                recipient,
                expiry: Number(expiry),
                blockNumber: event.log.blockNumber
            });
        });

        // Keep alive
        process.on('SIGINT', () => {
            console.log("\nShutting down...");
            process.exit(0);
        });
    }

    async processIntent(intent) {
        if (this.processedIntents.has(intent.intentHash)) {
            console.log("  Already processed, skipping");
            return;
        }

        try {
            // Wait for confirmations
            console.log(`  Waiting for ${config.requiredConfirmations} confirmations...`);
            await this.waitForConfirmations(intent.blockNumber);

            // Sign the message
            const signature = await this.signIntent(intent);
            console.log("  Signed");

            // Submit to MessageInbox
            console.log("  Submitting to Vision MessageInbox...");
            const tx = await this.messageInbox.submitPending(
                intent.srcChainId,
                intent.dstChainId,
                intent.token,
                intent.amount,
                intent.recipient,
                intent.intentHash,
                signature,
                { gasLimit: 500000 }
            );

            console.log(`  Tx: ${tx.hash}`);
            await tx.wait();
            console.log("  SUCCESS! Message now pending on Vision Chain");

            this.processedIntents.add(intent.intentHash);

        } catch (error) {
            console.error(`  Error: ${error.message}`);
        }
    }

    async waitForConfirmations(blockNumber) {
        while (true) {
            const current = await this.srcProvider.getBlockNumber();
            if (current - blockNumber >= config.requiredConfirmations) {
                return;
            }
            await new Promise(r => setTimeout(r, 5000));
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

// Run
const signer = new BridgeSigner();
signer.start().catch(console.error);
