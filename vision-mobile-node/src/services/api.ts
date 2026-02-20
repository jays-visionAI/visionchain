/**
 * Vision Mobile Node - API Client
 *
 * Communicates with the agentGateway Cloud Function.
 * All mobile_node.* actions go through this client.
 */

import { getApiUrl } from './config';

export interface RegisterResponse {
    success: boolean;
    node_id: string;
    api_key: string;
    wallet_address: string;
    referral_code: string;
    already_registered?: boolean;
    error?: string;
}

export interface StatusResponse {
    success: boolean;
    node_id: string;
    status: string;
    current_mode: string;
    weight: number;
    pending_reward: string;
    claimed_reward: string;
    total_earned: string;
    total_uptime_seconds: number;
    today_uptime_seconds: number;
    current_streak: number;
    last_heartbeat: string | null;
    referral_code: string;
    referral_count: number;
    error?: string;
}

export interface HeartbeatResponse {
    success: boolean;
    mode: string;
    weight: number;
    session_uptime: number;
    pending_reward: string;
    error?: string;
}

export interface AttestationResponse {
    success: boolean;
    attestations_accepted: number;
    bonus_weight: number;
    error?: string;
}

export interface LeaderboardEntry {
    rank: number;
    node_id: string;
    email_masked: string;
    total_uptime_seconds: number;
    weight: number;
    total_earned: string;
}

export interface LeaderboardResponse {
    success: boolean;
    leaderboard: LeaderboardEntry[];
    total_nodes: number;
    error?: string;
}

/**
 * Core API function - sends actions to agentGateway
 */
const api = async <T = Record<string, unknown>>(
    action: string,
    body: Record<string, unknown> = {},
    apiKey?: string,
): Promise<T> => {
    const payload: Record<string, unknown> = { action, ...body };
    if (apiKey) {
        payload.api_key = apiKey;
    }

    const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return response.json() as Promise<T>;
};

/**
 * Register a new mobile node
 */
export const register = async (
    email: string,
    referralCode?: string,
): Promise<RegisterResponse> => {
    return api<RegisterResponse>('mobile_node.register', {
        email,
        device_type: 'android',
        ...(referralCode ? { referral_code: referralCode } : {}),
    });
};

/**
 * Send heartbeat signal
 */
export const sendHeartbeat = async (
    apiKey: string,
    mode: string,
): Promise<HeartbeatResponse> => {
    return api<HeartbeatResponse>(
        'mobile_node.heartbeat',
        { mode, device_type: 'android' },
        apiKey,
    );
};

/**
 * Get node status
 */
export const getStatus = async (apiKey: string): Promise<StatusResponse> => {
    return api<StatusResponse>('mobile_node.status', {}, apiKey);
};

/**
 * Claim pending rewards
 */
export const claimReward = async (
    apiKey: string,
): Promise<{ success: boolean; claimed: string; tx_hash?: string; error?: string }> => {
    return api('mobile_node.claim_reward', {}, apiKey);
};

/**
 * Submit block attestations (Block Observer results)
 */
export const submitAttestation = async (
    apiKey: string,
    attestations: Array<{
        block_number: number;
        block_hash: string;
        signer_valid: boolean;
        parent_hash_valid: boolean;
        timestamp_valid: boolean;
    }>,
): Promise<AttestationResponse> => {
    return api<AttestationResponse>(
        'mobile_node.submit_attestation',
        { attestations },
        apiKey,
    );
};

/**
 * Get leaderboard
 */
export const getLeaderboard = async (): Promise<LeaderboardResponse> => {
    return api<LeaderboardResponse>('mobile_node.leaderboard');
};
