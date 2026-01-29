/**
 * Bridge TSS Signer Service
 * 
 * Listens for Lock events on source chain and submits signed messages
 * to MessageInbox for pending state.
 */

import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';

// Types
interface LockEvent {
    user: string;
    token: string;
    amount: bigint;
    intentHash: string;
    srcChainId: number;
    dstChainId: number;
    blockNumber: number;
    txHash: string;
}

interface BridgeConfig {
    srcChainId: number;
    dstChainId: number;
    srcRpc: string;
    dstRpc: string;
    srcBridgeContract: string;
    dstMessageInbox: string;
    tssPrivateKey: string;  // In production: use TSS/MPC
    requiredConfirmations: number;
}

// ABI fragments
const VAULT_ABI = [
    "event Locked(address indexed user, address indexed token, uint256 amount, bytes32 indexed intentHash, uint256 dstChainId)",
    "function getLockedAmount(address user, bytes32 intentHash) view returns (uint256)"
];

const MESSAGE_INBOX_ABI = [
    "function submitPending(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, bytes calldata tssSignature) external returns (bytes32)"
];

export class BridgeTSSSigner {
    private config: BridgeConfig;
    private srcProvider: JsonRpcProvider;
    private dstProvider: JsonRpcProvider;
    private signer: Wallet;
    private vaultContract: Contract;
    private messageInbox: Contract;
    private processedEvents: Set<string> = new Set();
    private isRunning: boolean = false;

    constructor(config: BridgeConfig) {
        this.config = config;
        this.srcProvider = new JsonRpcProvider(config.srcRpc);
        this.dstProvider = new JsonRpcProvider(config.dstRpc);
        this.signer = new Wallet(config.tssPrivateKey, this.dstProvider);

        this.vaultContract = new Contract(
            config.srcBridgeContract,
            VAULT_ABI,
            this.srcProvider
        );

        this.messageInbox = new Contract(
            config.dstMessageInbox,
            MESSAGE_INBOX_ABI,
            this.signer
        );
    }

    async start() {
        console.log('Bridge TSS Signer starting...');
        console.log(`Source Chain: ${this.config.srcChainId}`);
        console.log(`Dest Chain: ${this.config.dstChainId}`);

        this.isRunning = true;

        // Listen for Lock events
        this.vaultContract.on('Locked', async (user, token, amount, intentHash, dstChainId, event) => {
            if (!this.isRunning) return;

            const lockEvent: LockEvent = {
                user,
                token,
                amount,
                intentHash,
                srcChainId: this.config.srcChainId,
                dstChainId: Number(dstChainId),
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
            };

            await this.handleLockEvent(lockEvent);
        });

        console.log('Listening for Lock events...');
    }

    async stop() {
        this.isRunning = false;
        this.vaultContract.removeAllListeners();
        console.log('Bridge TSS Signer stopped');
    }

    private async handleLockEvent(event: LockEvent) {
        const eventId = `${event.txHash}-${event.intentHash}`;

        // Idempotency check
        if (this.processedEvents.has(eventId)) {
            console.log(`Event already processed: ${eventId}`);
            return;
        }

        console.log(`\nNew Lock Event detected:`);
        console.log(`  User: ${event.user}`);
        console.log(`  Amount: ${ethers.formatEther(event.amount)} tokens`);
        console.log(`  Intent: ${event.intentHash}`);
        console.log(`  Block: ${event.blockNumber}`);

        try {
            // Wait for confirmations
            await this.waitForConfirmations(event.blockNumber);

            // Verify lock still exists (not reverted)
            const lockedAmount = await this.vaultContract.getLockedAmount(event.user, event.intentHash);
            if (lockedAmount < event.amount) {
                console.log(`Lock reverted or insufficient. Skipping.`);
                return;
            }

            // Generate TSS signature (simplified - in production use MPC)
            const signature = await this.signMessage(event);

            // Submit to MessageInbox
            await this.submitPending(event, signature);

            this.processedEvents.add(eventId);
            console.log(`Successfully submitted to pending`);

        } catch (error) {
            console.error(`Error processing lock event:`, error);
        }
    }

    private async waitForConfirmations(blockNumber: number) {
        const required = this.config.requiredConfirmations;
        console.log(`Waiting for ${required} confirmations...`);

        while (true) {
            const currentBlock = await this.srcProvider.getBlockNumber();
            const confirmations = currentBlock - blockNumber;

            if (confirmations >= required) {
                console.log(`Confirmed: ${confirmations} blocks`);
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    private async signMessage(event: LockEvent): Promise<string> {
        // In production: This would use TSS/MPC with threshold signing
        // For now: Simple ECDSA signature

        const messageHash = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['uint256', 'uint256', 'address', 'uint256', 'address', 'bytes32'],
                [event.srcChainId, event.dstChainId, event.token, event.amount, event.user, event.intentHash]
            )
        );

        return await this.signer.signMessage(ethers.getBytes(messageHash));
    }

    private async submitPending(event: LockEvent, signature: string) {
        console.log('Submitting to MessageInbox...');

        const tx = await this.messageInbox.submitPending(
            event.srcChainId,
            event.dstChainId,
            event.token,
            event.amount,
            event.user,
            event.intentHash,
            signature,
            { gasLimit: 500000 }
        );

        console.log(`Tx submitted: ${tx.hash}`);
        const receipt = await tx.wait();
        console.log(`Tx confirmed in block ${receipt.blockNumber}`);
    }
}

// Standalone runner
if (require.main === module) {
    const config: BridgeConfig = {
        srcChainId: 11155111,  // Sepolia
        dstChainId: 1337,      // Vision local
        srcRpc: process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org',
        dstRpc: process.env.VISION_RPC || 'http://localhost:8545',
        srcBridgeContract: process.env.SRC_VAULT || '0x...',
        dstMessageInbox: process.env.DST_INBOX || '0x...',
        tssPrivateKey: process.env.TSS_PRIVATE_KEY || '',
        requiredConfirmations: 12
    };

    const signer = new BridgeTSSSigner(config);

    signer.start().catch(console.error);

    process.on('SIGINT', () => {
        signer.stop();
        process.exit(0);
    });
}

export default BridgeTSSSigner;
