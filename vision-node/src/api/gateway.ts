/**
 * Vision Node - API Gateway Client
 *
 * Communicates with the agentGateway Cloud Function backend.
 * Handles node registration, heartbeat, and status.
 */

import { configManager, type NodeConfig } from '../config/nodeConfig.js';
import { randomBytes, createHash } from 'crypto';
import { hostname as osHostname, cpus as osCpus, totalmem, freemem } from 'os';

interface ApiResponse {
    success: boolean;
    error?: string;
    [key: string]: unknown;
}

interface RegisterResponse extends ApiResponse {
    api_key?: string;
    node_id?: string;
    wallet_address?: string;
}

interface HeartbeatResponse extends ApiResponse {
    weight?: number;
    pending_reward?: number;
    uptime_hours?: number;
}

interface StatusResponse extends ApiResponse {
    node_id?: string;
    status?: string;
    uptime_hours?: number;
    total_heartbeats?: number;
    pending_reward?: number;
    rank?: number;
}

export class GatewayClient {
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        const config = configManager.get();
        this.apiUrl = config.apiUrl;
        this.apiKey = config.apiKey;
    }

    /**
     * Refresh internal state from config
     */
    refresh(): void {
        const config = configManager.get();
        this.apiUrl = config.apiUrl;
        this.apiKey = config.apiKey;
    }

    /**
     * Register a new node with the backend
     */
    async register(email: string, referralCode?: string): Promise<RegisterResponse> {
        const deviceId = this.generateDeviceId();

        const body: Record<string, unknown> = {
            action: 'mobile_node.register',
            email,
            device_id: deviceId,
            device_type: 'desktop',
            platform: process.platform,
            node_class: configManager.get().nodeClass,
            version: '1.0.0',
        };

        if (referralCode) {
            body.referral_code = referralCode;
        }

        const result = await this.call(body);
        return result as RegisterResponse;
    }

    /**
     * Send heartbeat to the backend
     */
    async heartbeat(storageStats?: {
        totalSizeBytes: number;
        maxSizeBytes: number;
        chunkCount: number;
    }): Promise<HeartbeatResponse> {
        const config = configManager.get();
        const body: Record<string, unknown> = {
            action: 'mobile_node.heartbeat',
            api_key: this.apiKey,
            mode: 'wifi_full', // Desktop nodes always use full mode
            platform: process.platform,
            node_class: config.nodeClass,
            storage_max_gb: config.storageMaxGB,
            version: '1.0.0',
            system_info: this.getSystemInfo(),
        };

        if (storageStats) {
            body.storage_stats = storageStats;
        }

        const result = await this.call(body);
        return result as HeartbeatResponse;
    }

    /**
     * Get node status from the backend
     */
    async status(): Promise<StatusResponse> {
        const body = {
            action: 'mobile_node.status',
            api_key: this.apiKey,
        };

        const result = await this.call(body);
        return result as StatusResponse;
    }

    /**
     * Claim pending rewards
     */
    async claimReward(): Promise<ApiResponse> {
        const body = {
            action: 'mobile_node.claim_reward',
            api_key: this.apiKey,
        };

        return this.call(body);
    }

    /**
     * Core API call method
     */
    private async call(body: Record<string, unknown>): Promise<ApiResponse> {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'VisionNode/1.0.0',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text();
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${text}`,
                };
            }

            return (await response.json()) as ApiResponse;
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Generate a deterministic device ID for this machine
     */
    private generateDeviceId(): string {
        const info = getOsInfo();
        const raw = `${info.hostname}-${info.platform}-${info.arch}-vision-node`;
        return createHash('sha256').update(raw).digest('hex').slice(0, 32);
    }

    /**
     * Get system info for heartbeat
     */
    private getSystemInfo(): Record<string, unknown> {
        const os = getOsInfo();
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            hostname: os.hostname,
            cpus: os.cpuCount,
            totalMemoryMB: os.totalMemoryMB,
            freeMemoryMB: os.freeMemoryMB,
            uptime: process.uptime(),
        };
    }
}

/**
 * Helper to get OS info
 */
function getOsInfo() {
    return {
        hostname: osHostname(),
        platform: process.platform,
        arch: process.arch,
        cpuCount: osCpus().length,
        totalMemoryMB: Math.round(totalmem() / (1024 * 1024)),
        freeMemoryMB: Math.round(freemem() / (1024 * 1024)),
    };
}

export const gatewayClient = new GatewayClient();
