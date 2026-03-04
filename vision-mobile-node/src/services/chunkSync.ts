/**
 * Vision Mobile Node - Chunk Sync Service
 *
 * Periodic sync with the backend chunk registry:
 *   1. Register locally stored chunks (so the network knows we have them)
 *   2. Pull replication assignments (under-replicated chunks to fetch)
 *   3. Download assigned chunks from staging area
 *
 * Only runs when on WiFi.
 */

import { chunkStorage } from './chunkStorage';
import { networkAdapter } from './networkAdapter';
import { getApiUrl } from './config';

type SyncCallback = (stats: ChunkSyncStats) => void;

export interface ChunkSyncStats {
    isRunning: boolean;
    lastSync: number;
    chunksRegistered: number;
    chunksFetched: number;
    syncErrors: number;
}

class ChunkSyncService {
    private timer: ReturnType<typeof setInterval> | null = null;
    private apiKey: string | null = null;
    private nodeId: string | null = null;
    private listeners: SyncCallback[] = [];
    private stats: ChunkSyncStats = {
        isRunning: false,
        lastSync: 0,
        chunksRegistered: 0,
        chunksFetched: 0,
        syncErrors: 0,
    };

    // Sync every 2 minutes on WiFi
    private readonly SYNC_INTERVAL_MS = 2 * 60 * 1000;

    /**
     * Start the chunk sync service
     */
    start(apiKey: string, nodeId: string): void {
        if (this.stats.isRunning) return;

        this.apiKey = apiKey;
        this.nodeId = nodeId;
        this.stats.isRunning = true;

        // First sync immediately
        this.sync();

        // Then periodically
        this.timer = setInterval(() => this.sync(), this.SYNC_INTERVAL_MS);

        this.notify();
        console.log('[ChunkSync] Started');
    }

    /**
     * Stop the chunk sync service
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.stats.isRunning = false;
        this.notify();
        console.log('[ChunkSync] Stopped');
    }

    /**
     * Perform a full sync cycle
     */
    private async sync(): Promise<void> {
        // Only sync on WiFi
        if (networkAdapter.getMode() !== 'wifi') return;
        if (!this.apiKey || !this.nodeId) return;

        try {
            await this.registerLocalChunks();
            await this.fetchAssignments();
            this.stats.lastSync = Date.now();
        } catch (err) {
            this.stats.syncErrors++;
            console.warn('[ChunkSync] Sync error:', err);
        }

        this.notify();
    }

    /**
     * Register locally stored chunks with the backend
     */
    private async registerLocalChunks(): Promise<void> {
        const storedChunks = chunkStorage.getStoredChunks();
        if (storedChunks.length === 0) return;

        // Register in batches of 200
        for (let i = 0; i < storedChunks.length; i += 200) {
            const batch = storedChunks.slice(i, i + 200);

            try {
                await fetch(getApiUrl(), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'chunk.register',
                        node_id: this.nodeId,
                        chunks: batch,
                    }),
                });
                this.stats.chunksRegistered = storedChunks.length;
            } catch {
                // Non-critical, will retry next cycle
            }
        }
    }

    /**
     * Fetch and store under-replicated chunks assigned to this node
     */
    private async fetchAssignments(): Promise<void> {
        const storageStats = chunkStorage.getStats();
        const remainingCapacity = storageStats.maxSizeBytes - storageStats.totalSizeBytes;

        if (remainingCapacity < 1024 * 1024) return; // Less than 1MB remaining

        try {
            const resp = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chunk.assignments',
                    node_id: this.nodeId,
                    capacity: remainingCapacity,
                }),
            });

            if (!resp.ok) return;
            const data = (await resp.json()) as { assignments?: Array<{ hash: string; file_key?: string; index?: number }> };
            const assignments = data.assignments || [];

            // Download up to 5 chunks per sync cycle (to avoid overloading)
            for (const a of assignments.slice(0, 5)) {
                if (chunkStorage.hasChunk(a.hash)) continue;

                try {
                    const chunkResp = await fetch(getApiUrl(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'chunk.fetch_staging',
                            hash: a.hash,
                        }),
                    });

                    if (chunkResp.ok) {
                        const chunkData = (await chunkResp.json()) as { data?: string };
                        if (chunkData.data) {
                            const stored = await chunkStorage.storeChunk(
                                a.hash,
                                chunkData.data,
                                a.file_key || '',
                                a.index || 0,
                            );
                            if (stored) {
                                this.stats.chunksFetched++;
                                console.log(`[ChunkSync] Fetched chunk: ${a.hash.slice(0, 12)}...`);
                            }
                        }
                    }
                } catch {
                    // Skip individual chunk failures
                }
            }
        } catch {
            // Will retry next cycle
        }
    }

    getStats(): ChunkSyncStats {
        return { ...this.stats };
    }

    onChange(callback: SyncCallback): () => void {
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

export const chunkSync = new ChunkSyncService();
