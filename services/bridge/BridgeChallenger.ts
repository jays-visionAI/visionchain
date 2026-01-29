/**
 * Bridge Challenger Service
 * 
 * Monitors pending messages in MessageInbox and challenges invalid ones.
 * Validates against source chain Lock events.
 */

import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';

interface ChallengerConfig {
    srcChainId: number;
    dstChainId: number;
    srcRpc: string;
    dstRpc: string;
    srcVaultContract: string;
    dstMessageInbox: string;
    dstChallengeManager: string;
    challengerPrivateKey: string;
    pollIntervalMs: number;
}

interface PendingMessage {
    messageHash: string;
    srcChainId: bigint;
    dstChainId: bigint;
    token: string;
    amount: bigint;
    recipient: string;
    intentHash: string;
    submittedAt: bigint;
    challengePeriodEnd: bigint;
    state: number;
}

// Challenge types matching ChallengeManager.sol
enum ChallengeType {
    LOCK_NOT_EXISTS = 0,
    INTENT_MISMATCH = 1,
    NONCE_REUSE = 2,
    EXPIRY_EXCEEDED = 3,
    AMOUNT_MISMATCH = 4,
    RECIPIENT_MISMATCH = 5
}

const MESSAGE_INBOX_ABI = [
    "function getPendingCount() view returns (uint256)",
    "function pendingMessages(uint256 index) view returns (bytes32)",
    "function getMessage(bytes32 messageHash) view returns (tuple(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, uint256 submittedAt, uint256 challengePeriodEnd, uint8 state, address challenger, bytes32 challengeId))"
];

const CHALLENGE_MANAGER_ABI = [
    "function submitChallenge(bytes32 messageHash, uint8 challengeType, bytes calldata evidence) external returns (bytes32)",
    "function deposits(address) view returns (uint256)",
    "function challengeDeposit() view returns (uint256)"
];

const VAULT_ABI = [
    "function getLockedAmount(address user, bytes32 intentHash) view returns (uint256)"
];

export class BridgeChallenger {
    private config: ChallengerConfig;
    private srcProvider: JsonRpcProvider;
    private dstProvider: JsonRpcProvider;
    private signer: Wallet;
    private messageInbox: Contract;
    private challengeManager: Contract;
    private vaultContract: Contract;
    private isRunning: boolean = false;
    private checkedMessages: Set<string> = new Set();

    constructor(config: ChallengerConfig) {
        this.config = config;
        this.srcProvider = new JsonRpcProvider(config.srcRpc);
        this.dstProvider = new JsonRpcProvider(config.dstRpc);
        this.signer = new Wallet(config.challengerPrivateKey, this.dstProvider);

        this.messageInbox = new Contract(
            config.dstMessageInbox,
            MESSAGE_INBOX_ABI,
            this.dstProvider
        );

        this.challengeManager = new Contract(
            config.dstChallengeManager,
            CHALLENGE_MANAGER_ABI,
            this.signer
        );

        this.vaultContract = new Contract(
            config.srcVaultContract,
            VAULT_ABI,
            this.srcProvider
        );
    }

    async start() {
        console.log('Bridge Challenger starting...');
        console.log(`Monitoring MessageInbox: ${this.config.dstMessageInbox}`);

        this.isRunning = true;

        // Check deposit
        await this.ensureDeposit();

        // Start monitoring loop
        this.monitorLoop();
    }

    async stop() {
        this.isRunning = false;
        console.log('Bridge Challenger stopped');
    }

    private async ensureDeposit() {
        const required = await this.challengeManager.challengeDeposit();
        const current = await this.challengeManager.deposits(this.signer.address);

        if (current < required) {
            console.log(`Insufficient deposit. Required: ${ethers.formatEther(required)}, Current: ${ethers.formatEther(current)}`);
            console.log('Please deposit funds to ChallengeManager');
        } else {
            console.log(`Deposit OK: ${ethers.formatEther(current)} ETH`);
        }
    }

    private async monitorLoop() {
        while (this.isRunning) {
            try {
                await this.checkPendingMessages();
            } catch (error) {
                console.error('Error in monitor loop:', error);
            }

            await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
        }
    }

    private async checkPendingMessages() {
        const count = await this.messageInbox.getPendingCount();

        if (count === 0n) return;

        console.log(`\nChecking ${count} pending messages...`);

        for (let i = 0n; i < count; i++) {
            const messageHash = await this.messageInbox.pendingMessages(i);

            // Skip if already checked recently
            if (this.checkedMessages.has(messageHash)) continue;

            const message = await this.messageInbox.getMessage(messageHash);

            // Only check PENDING state (0)
            if (message.state !== 1) continue;

            await this.validateMessage(messageHash, message);
            this.checkedMessages.add(messageHash);
        }
    }

    private async validateMessage(messageHash: string, message: PendingMessage) {
        console.log(`\nValidating message: ${messageHash.slice(0, 10)}...`);
        console.log(`  Recipient: ${message.recipient}`);
        console.log(`  Amount: ${ethers.formatEther(message.amount)}`);

        // Check 1: Lock exists on source chain
        const lockedAmount = await this.vaultContract.getLockedAmount(
            message.recipient,
            message.intentHash
        );

        if (lockedAmount === 0n) {
            console.log('INVALID: Lock does not exist on source chain!');
            await this.submitChallenge(messageHash, ChallengeType.LOCK_NOT_EXISTS, 'No lock found');
            return;
        }

        // Check 2: Amount matches
        if (lockedAmount !== message.amount) {
            console.log(`INVALID: Amount mismatch! Locked: ${lockedAmount}, Claimed: ${message.amount}`);
            await this.submitChallenge(messageHash, ChallengeType.AMOUNT_MISMATCH, `Expected ${lockedAmount}, got ${message.amount}`);
            return;
        }

        console.log('Message validated OK');
    }

    private async submitChallenge(
        messageHash: string,
        challengeType: ChallengeType,
        reason: string
    ) {
        console.log(`Submitting challenge: ${ChallengeType[challengeType]}`);

        try {
            const evidence = ethers.toUtf8Bytes(reason);

            const tx = await this.challengeManager.submitChallenge(
                messageHash,
                challengeType,
                evidence,
                { gasLimit: 500000 }
            );

            console.log(`Challenge tx submitted: ${tx.hash}`);
            const receipt = await tx.wait();
            console.log(`Challenge confirmed in block ${receipt.blockNumber}`);

        } catch (error) {
            console.error('Failed to submit challenge:', error);
        }
    }
}

// Standalone runner
if (require.main === module) {
    const config: ChallengerConfig = {
        srcChainId: 11155111,
        dstChainId: 1337,
        srcRpc: process.env.SEPOLIA_RPC || 'https://rpc.sepolia.org',
        dstRpc: process.env.VISION_RPC || 'http://localhost:8545',
        srcVaultContract: process.env.SRC_VAULT || '0x...',
        dstMessageInbox: process.env.DST_INBOX || '0x...',
        dstChallengeManager: process.env.DST_CHALLENGE_MANAGER || '0x...',
        challengerPrivateKey: process.env.CHALLENGER_PRIVATE_KEY || '',
        pollIntervalMs: 30000  // 30 seconds
    };

    const challenger = new BridgeChallenger(config);

    challenger.start().catch(console.error);

    process.on('SIGINT', () => {
        challenger.stop();
        process.exit(0);
    });
}

export default BridgeChallenger;
