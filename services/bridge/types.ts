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

// Contract addresses (deployed)
export const BRIDGE_CONTRACTS = {
    // Sepolia (Source Chain)
    sepolia: {
        chainId: 11155111,
        rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
        intentCommitment: '0x26Ad5a840F8828ecDF5563fFcf0A1a9ea318Dc0b',
        messageInbox: '0xd84967816156F91349c295eF3e61d1aDc3dC7641',
        challengeManager: '0x2855AfE6CAd2384A51baC518f57B4039FDad8aD6',
        equalizer: '0x6e6E465594cED9cA33995939b9579a8A29194983'
    },
    // Vision Testnet (Destination Chain)
    vision: {
        chainId: 1337,
        rpc: 'https://api.visionchain.co/rpc-proxy',
        intentCommitment: '0x47c05BCCA7d57c87083EB4e586007530eE4539e9',
        messageInbox: '0x408F924BAEC71cC3968614Cb2c58E155A35e6890',
        challengeManager: '0x773330693cb7d5D233348E25809770A32483A940',
        equalizer: '0x52173b6ac069619c206b9A0e75609fC92860AB2A'
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
