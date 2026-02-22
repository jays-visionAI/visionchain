/**
 * Vision Node - Heartbeat Service
 *
 * Sends periodic heartbeats to the backend to maintain node status.
 * Desktop nodes always use 'wifi_full' mode (no cellular restriction).
 */

import { configManager } from '../config/nodeConfig.js';
import { gatewayClient } from '../api/gateway.js';

export interface HeartbeatStats {
    isRunning: boolean;
    lastHeartbeat: number;
    totalHeartbeats: number;
    consecutiveFailures: number;
    weight: number;
    pendingReward: number;
    uptimeHours: number;
}

type HeartbeatCallback = (stats: HeartbeatStats) => void;

class HeartbeatService {
    private timer: ReturnType<typeof setInterval> | null = null;
    private listeners: HeartbeatCallback[] = [];
    private stats: HeartbeatStats = {
        isRunning: false,
        lastHeartbeat: 0,
        totalHeartbeats: 0,
        consecutiveFailures: 0,
        weight: 0,
        pendingReward: 0,
        uptimeHours: 0,
    };

    /**
     * Start the heartbeat service
     */
    start(): void {
        if (this.stats.isRunning) {
            return;
        }

        const config = configManager.get();
        if (!config.apiKey) {
            console.error('[Heartbeat] Cannot start: no API key configured');
            return;
        }

        this.stats.isRunning = true;
        console.log(`[Heartbeat] Started (interval: ${config.heartbeatIntervalMs / 1000}s)`);

        // Send first heartbeat immediately
        this.beat();

        // Then periodically
        this.timer = setInterval(() => this.beat(), config.heartbeatIntervalMs);
        this.notify();
    }

    /**
     * Stop the heartbeat service
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.stats.isRunning = false;
        console.log('[Heartbeat] Stopped');
        this.notify();
    }

    /**
     * Send a single heartbeat
     */
    async beat(): Promise<void> {
        try {
            const result = await gatewayClient.heartbeat();

            if (result.success) {
                this.stats.lastHeartbeat = Date.now();
                this.stats.totalHeartbeats++;
                this.stats.consecutiveFailures = 0;
                this.stats.weight = result.weight ?? this.stats.weight;
                this.stats.pendingReward = result.pending_reward ?? this.stats.pendingReward;
                this.stats.uptimeHours = result.uptime_hours ?? this.stats.uptimeHours;

                console.log(
                    `[Heartbeat] OK #${this.stats.totalHeartbeats} - weight: ${this.stats.weight}x, reward: ${this.stats.pendingReward} VCN`
                );
            } else {
                this.stats.consecutiveFailures++;
                console.warn(`[Heartbeat] Failed (${this.stats.consecutiveFailures}x): ${result.error}`);
            }
        } catch (err) {
            this.stats.consecutiveFailures++;
            console.error('[Heartbeat] Error:', err);
        }

        this.notify();
    }

    /**
     * Get current stats
     */
    getStats(): HeartbeatStats {
        return { ...this.stats };
    }

    /**
     * Subscribe to stats changes
     */
    onChange(callback: HeartbeatCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notify(): void {
        const stats = this.getStats();
        this.listeners.forEach(cb => cb(stats));
    }
}

export const heartbeatService = new HeartbeatService();
