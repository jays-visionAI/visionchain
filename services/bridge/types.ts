/**
 * Bridge Types
 * 
 * Shared types for Vision Bridge services.
 */

export interface BridgeIntent {
    user: string;
    srcChainId: number;
    dstChainId: number;
    token: string;
    amount: bigint;
    recipient: string;
    nonce: bigint;
    expiry: number;
}

export interface BridgeMessage {
    messageHash: string;
    srcChainId: number;
    dstChainId: number;
    token: string;
    amount: bigint;
    recipient: string;
    intentHash: string;
    submittedAt: number;
    challengePeriodEnd: number;
    state: MessageState;
}

export enum MessageState {
    NONE = 0,
    PENDING = 1,
    CHALLENGED = 2,
    FINALIZED = 3,
    REVERTED = 4
}

export enum ChallengeType {
    LOCK_NOT_EXISTS = 0,
    INTENT_MISMATCH = 1,
    NONCE_REUSE = 2,
    EXPIRY_EXCEEDED = 3,
    AMOUNT_MISMATCH = 4,
    RECIPIENT_MISMATCH = 5
}

export interface Challenge {
    challengeId: string;
    messageHash: string;
    challengeType: ChallengeType;
    challenger: string;
    evidence: string;
    submittedAt: number;
    status: ChallengeStatus;
    resolution: string;
}

export enum ChallengeStatus {
    PENDING = 0,
    RESOLVED_VALID = 1,
    RESOLVED_INVALID = 2
}

// Contract addresses (to be updated after deployment)
export const BRIDGE_CONTRACTS = {
    // Sepolia (Source)
    sepolia: {
        chainId: 11155111,
        vault: '0x...', // TBD after deployment
        intentCommitment: '0x...'
    },
    // Vision Testnet (Destination)
    vision: {
        chainId: 1337,
        messageInbox: '0x...',
        challengeManager: '0x...',
        equalizer: '0x...'
    },
    // Polygon Amoy (Future)
    amoy: {
        chainId: 80002,
        vault: '0x...'
    },
    // Base Sepolia (Future)
    baseSepolia: {
        chainId: 84532,
        vault: '0x...'
    }
};

// Challenge period configuration
export const CHALLENGE_PERIODS = {
    small: 10 * 60,      // 10 minutes (< 1000 VCN)
    medium: 30 * 60,     // 30 minutes (1000-10000 VCN)
    large: 2 * 60 * 60   // 2 hours (> 10000 VCN)
};

export const AMOUNT_THRESHOLDS = {
    small: 1000n * 10n ** 18n,   // 1000 VCN
    medium: 10000n * 10n ** 18n  // 10000 VCN
};
