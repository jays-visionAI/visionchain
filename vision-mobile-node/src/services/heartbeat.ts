/**
 * Vision Mobile Node - Heartbeat Service
 *
 * Manages periodic heartbeat signals to the backend.
 * Adapts interval based on network state (WiFi vs Cellular).
 * Runs in background via Android Foreground Service.
 */

import { sendHeartbeat, HeartbeatResponse } from './api';
import { networkAdapter, ContributionLevel } from './networkAdapter';

type HeartbeatCallback = (data: HeartbeatData) => void;

export interface HeartbeatData {
    isRunning: boolean;
    mode: string;
    weight: number;
    intervalMs: number;
    lastHeartbeat: number | null;
    nextHeartbeat: number | null;
    sessionUptimeSeconds: number;
    pendingReward: string;
    consecutiveFailures: number;
}

class HeartbeatService {
    private timer: ReturnType<typeof setInterval> | null = null;
    private apiKey: string | null = null;
    private sessionStart: number = 0;
    private listeners: HeartbeatCallback[] = [];
    private data: HeartbeatData = {
        isRunning: false,
        mode: 'offline',
        weight: 0,
        intervalMs: 0,
        lastHeartbeat: null,
        nextHeartbeat: null,
        sessionUptimeSeconds: 0,
        pendingReward: '0',
        consecutiveFailures: 0,
    };

    /**
     * Start heartbeat service
     */
    start(apiKey: string): void {
        if (this.data.isRunning) {
            return;
        }

        this.apiKey = apiKey;
        this.sessionStart = Date.now();
        this.data.isRunning = true;

        // Get initial network state and start beating
        const level = networkAdapter.getContributionLevel();
        this.adjustInterval(level);

        // Listen for network changes
        networkAdapter.onChange((newLevel: ContributionLevel) => {
            console.log(`[Heartbeat] Network changed to ${newLevel.mode}, adjusting interval`);
            this.adjustInterval(newLevel);
        });

        // Send first heartbeat immediately
        this.beat();

        console.log('[Heartbeat] Service started');
    }

    /**
     * Stop heartbeat service
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.data.isRunning = false;
        this.notifyListeners();
        console.log('[Heartbeat] Service stopped');
    }

    /**
     * Adjust heartbeat interval based on contribution level
     */
    private adjustInterval(level: ContributionLevel): void {
        // Clear existing timer
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.data.mode = level.mode;
        this.data.weight = level.weight;
        this.data.intervalMs = level.heartbeatIntervalMs;

        if (level.mode === 'offline' || level.heartbeatIntervalMs === 0) {
            this.data.nextHeartbeat = null;
            this.notifyListeners();
            return;
        }

        // Set new interval
        this.timer = setInterval(() => this.beat(), level.heartbeatIntervalMs);
        this.data.nextHeartbeat = Date.now() + level.heartbeatIntervalMs;
        this.notifyListeners();
    }

    /**
     * Send a single heartbeat
     */
    private async beat(): Promise<void> {
        if (!this.apiKey) {
            return;
        }

        const mode = networkAdapter.getMode();
        if (mode === 'offline') {
            return;
        }

        try {
            // Map network mode to server-expected format
            // Server expects: 'wifi_full' or 'cellular_min'
            // networkAdapter returns: 'wifi' or 'cellular'
            const apiMode = mode === 'wifi' ? 'wifi_full' : 'cellular_min';
            const result: HeartbeatResponse = await sendHeartbeat(this.apiKey, apiMode);

            if (result.success) {
                this.data.lastHeartbeat = Date.now();
                this.data.pendingReward = result.pending_reward || this.data.pendingReward;
                this.data.weight = result.weight || this.data.weight;
                this.data.consecutiveFailures = 0;

                console.log(
                    `[Heartbeat] OK - mode: ${mode}, weight: ${result.weight}x, reward: ${result.pending_reward}`,
                );
            } else {
                this.data.consecutiveFailures++;
                console.warn('[Heartbeat] Failed:', result.error);
            }
        } catch (err) {
            this.data.consecutiveFailures++;
            console.error('[Heartbeat] Error:', err);
        }

        // Update session uptime
        this.data.sessionUptimeSeconds = Math.floor(
            (Date.now() - this.sessionStart) / 1000,
        );

        // Update next heartbeat time
        if (this.data.intervalMs > 0) {
            this.data.nextHeartbeat = Date.now() + this.data.intervalMs;
        }

        this.notifyListeners();
    }

    /**
     * Get current heartbeat data
     */
    getData(): HeartbeatData {
        // Recalculate session uptime
        if (this.data.isRunning) {
            this.data.sessionUptimeSeconds = Math.floor(
                (Date.now() - this.sessionStart) / 1000,
            );
        }
        return { ...this.data };
    }

    /**
     * Subscribe to heartbeat updates
     */
    onChange(callback: HeartbeatCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notifyListeners(): void {
        const data = this.getData();
        this.listeners.forEach(cb => cb(data));
    }
}

export const heartbeatService = new HeartbeatService();
