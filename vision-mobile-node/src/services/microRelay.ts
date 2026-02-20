/**
 * Vision Mobile Node - Micro Relay Service
 *
 * When on WiFi, this service acts as a lightweight relay node:
 * 1. Receives pending transactions from the network
 * 2. Forwards them to Authority Nodes
 * 3. Relays on-chain messenger messages to nearby peers
 *
 * This reduces latency for users by providing geographically
 * distributed relay points, and earns the node +0.1x weight.
 *
 * Phase 1: HTTP polling relay (simple, reliable)
 * Phase 2: WebSocket-based P2P relay (future)
 */

import { getApiUrl } from './config';

export interface RelayStats {
    isRunning: boolean;
    messagesRelayed: number;
    transactionsRelayed: number;
    lastRelayTime: number | null;
    bytesRelayed: number;
}

type RelayCallback = (stats: RelayStats) => void;

class MicroRelay {
    private timer: ReturnType<typeof setInterval> | null = null;
    private apiKey: string | null = null;
    private listeners: RelayCallback[] = [];
    private stats: RelayStats = {
        isRunning: false,
        messagesRelayed: 0,
        transactionsRelayed: 0,
        lastRelayTime: null,
        bytesRelayed: 0,
    };

    // Relay interval: check for pending messages every 30 seconds
    private readonly RELAY_INTERVAL_MS = 30 * 1000;

    /**
     * Start the relay service
     */
    start(apiKey: string): void {
        if (this.stats.isRunning) {
            return;
        }

        this.apiKey = apiKey;
        this.stats.isRunning = true;

        // Start polling for relay tasks
        this.timer = setInterval(() => this.relayLoop(), this.RELAY_INTERVAL_MS);

        // Run immediately
        this.relayLoop();

        this.notifyListeners();
        console.log('[MicroRelay] Started');
    }

    /**
     * Stop the relay service
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.stats.isRunning = false;
        this.notifyListeners();
        console.log('[MicroRelay] Stopped');
    }

    /**
     * Main relay loop
     * Polls the backend for pending relay tasks and executes them
     */
    private async relayLoop(): Promise<void> {
        if (!this.apiKey) {
            return;
        }

        try {
            // Request pending relay tasks from the backend
            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mobile_node.relay_poll',
                    api_key: this.apiKey,
                }),
            });

            const result = await response.json();

            if (result.success && result.tasks && result.tasks.length > 0) {
                for (const task of result.tasks) {
                    await this.executeRelayTask(task);
                }
            }
        } catch (err) {
            // Silent fail on relay - it's non-critical
            console.debug('[MicroRelay] Poll error (non-critical):', err);
        }
    }

    /**
     * Execute a single relay task
     */
    private async executeRelayTask(task: {
        type: string;
        target_url: string;
        payload: string;
        task_id: string;
    }): Promise<void> {
        try {
            // Forward the payload to the target
            const response = await fetch(task.target_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: task.payload,
            });

            if (response.ok) {
                // Report relay completion
                await this.reportRelayComplete(task.task_id);

                // Update stats
                if (task.type === 'message') {
                    this.stats.messagesRelayed++;
                } else {
                    this.stats.transactionsRelayed++;
                }
                this.stats.bytesRelayed += task.payload.length;
                this.stats.lastRelayTime = Date.now();

                console.log(`[MicroRelay] Relayed ${task.type} (${task.payload.length} bytes)`);
                this.notifyListeners();
            }
        } catch (err) {
            console.debug(`[MicroRelay] Relay task ${task.task_id} failed:`, err);
        }
    }

    /**
     * Report successful relay completion to backend
     */
    private async reportRelayComplete(taskId: string): Promise<void> {
        try {
            await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mobile_node.relay_complete',
                    api_key: this.apiKey,
                    task_id: taskId,
                }),
            });
        } catch {
            // Non-critical
        }
    }

    getStats(): RelayStats {
        return { ...this.stats };
    }

    onChange(callback: RelayCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notifyListeners(): void {
        const stats = this.getStats();
        this.listeners.forEach(cb => cb(stats));
    }
}

export const microRelay = new MicroRelay();
