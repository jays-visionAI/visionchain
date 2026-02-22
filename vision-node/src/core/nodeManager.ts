/**
 * Vision Node - Node Manager
 *
 * Manages the overall node lifecycle: start, stop, and status.
 * Coordinates heartbeat, storage, and block observer services.
 */

import { configManager, type NodeClass } from '../config/nodeConfig.js';
import { heartbeatService } from './heartbeat.js';
import { storageService } from './storageService.js';
import { mkdirSync, existsSync } from 'fs';
import { cpus, totalmem, freemem, platform, arch, hostname } from 'os';

export interface NodeStatus {
    isRunning: boolean;
    nodeId: string;
    nodeClass: NodeClass;
    email: string;
    environment: string;
    platform: string;
    startedAt: number;
    uptimeSeconds: number;
    heartbeat: {
        isRunning: boolean;
        lastHeartbeat: number;
        totalHeartbeats: number;
        weight: number;
        pendingReward: number;
    };
    system: {
        hostname: string;
        platform: string;
        arch: string;
        cpus: number;
        totalMemoryMB: number;
        freeMemoryMB: number;
    };
    storage: {
        path: string;
        maxGB: number;
        usedBytes: number;
        totalChunks: number;
        totalFiles: number;
        usagePercent: number;
    };
}

class NodeManager {
    private running = false;
    private startedAt = 0;

    /**
     * Start the node
     */
    async start(): Promise<void> {
        if (this.running) {
            console.log('[Node] Already running');
            return;
        }

        const config = configManager.get();

        // Ensure storage directory exists
        if (!existsSync(config.storagePath)) {
            mkdirSync(config.storagePath, { recursive: true });
        }

        this.running = true;
        this.startedAt = Date.now();

        console.log(`[Node] Starting Vision Node (${config.nodeClass})`);
        console.log(`[Node] ID: ${config.nodeId || 'pending registration'}`);
        console.log(`[Node] Storage: ${config.storagePath} (max ${config.storageMaxGB}GB)`);
        console.log(`[Node] API: ${config.environment}`);

        // Start storage engine
        await storageService.start();

        // Start heartbeat
        heartbeatService.start();

        console.log('[Node] All services started');
    }

    /**
     * Stop the node
     */
    async stop(): Promise<void> {
        if (!this.running) {
            return;
        }

        console.log('[Node] Stopping...');
        heartbeatService.stop();
        await storageService.stop();
        this.running = false;
        console.log('[Node] Stopped');
    }

    /**
     * Get current node status
     */
    getStatus(): NodeStatus {
        const config = configManager.get();
        const hbStats = heartbeatService.getStats();

        return {
            isRunning: this.running,
            nodeId: config.nodeId,
            nodeClass: config.nodeClass,
            email: config.email,
            environment: config.environment,
            platform: process.platform,
            startedAt: this.startedAt,
            uptimeSeconds: this.running ? Math.floor((Date.now() - this.startedAt) / 1000) : 0,
            heartbeat: {
                isRunning: hbStats.isRunning,
                lastHeartbeat: hbStats.lastHeartbeat,
                totalHeartbeats: hbStats.totalHeartbeats,
                weight: hbStats.weight,
                pendingReward: hbStats.pendingReward,
            },
            system: {
                hostname: hostname(),
                platform: platform(),
                arch: arch(),
                cpus: cpus().length,
                totalMemoryMB: Math.round(totalmem() / (1024 * 1024)),
                freeMemoryMB: Math.round(freemem() / (1024 * 1024)),
            },
            storage: {
                path: config.storagePath,
                maxGB: config.storageMaxGB,
                usedBytes: storageService.getStats().totalSizeBytes,
                totalChunks: storageService.getStats().totalChunks,
                totalFiles: storageService.getStats().totalFiles,
                usagePercent: storageService.getStats().usagePercent,
            },
        };
    }

    /**
     * Auto-detect node class based on system resources
     */
    detectNodeClass(): NodeClass {
        const cpuCount = cpus().length;
        const totalMemMB = Math.round(totalmem() / (1024 * 1024));

        // Full: 4+ cores, 4GB+ RAM
        if (cpuCount >= 4 && totalMemMB >= 4096) {
            return 'full';
        }

        // Standard: 2+ cores, 1GB+ RAM
        if (cpuCount >= 2 && totalMemMB >= 1024) {
            return 'standard';
        }

        // Lite: everything else
        return 'lite';
    }

    isRunning(): boolean {
        return this.running;
    }
}

export const nodeManager = new NodeManager();
