/**
 * Vision Node - Chunk Registry Client
 *
 * Integrates with the backend Chunk Registry for:
 * - Registering locally stored chunks with the network
 * - Receiving replication assignments (under-replicated chunks to fetch)
 * - Responding to Storage Proof challenges
 * - Syncing chunk status with the backend
 *
 * Runs periodically alongside heartbeats.
 */

import { createHash } from 'crypto';
import { configManager } from '../config/nodeConfig.js';
import { storageService } from './storageService.js';
import { storageEngine } from './storage.js';

interface ChunkRegistryStats {
    isRunning: boolean;
    lastSync: number;
    totalChunksRegistered: number;
    pendingAssignments: number;
    proofsCompleted: number;
    proofsPassed: number;
    proofsFailed: number;
    replicationHealth: number; // 0-100%
}

interface ProofChallenge {
    challenge_id: string;
    chunk_hash: string;
    offset: number;
    read_bytes: number;
}

interface ChunkAssignment {
    hash: string;
    file_key: string;
    size: number;
    current_replicas: number;
    target_replicas: number;
}

class ChunkRegistryClient {
    private timer: ReturnType<typeof setInterval> | null = null;
    private syncIntervalMs = 60_000; // Sync every 60 seconds
    private stats: ChunkRegistryStats = {
        isRunning: false,
        lastSync: 0,
        totalChunksRegistered: 0,
        pendingAssignments: 0,
        proofsCompleted: 0,
        proofsPassed: 0,
        proofsFailed: 0,
        replicationHealth: 0,
    };

    /**
     * Start the chunk registry sync service
     */
    start(): void {
        if (this.stats.isRunning) return;

        this.stats.isRunning = true;
        console.log('[ChunkRegistry] Started');

        // Initial sync after 10 seconds (give heartbeat time to register)
        setTimeout(() => this.sync(), 10_000);

        // Periodic sync
        this.timer = setInterval(() => this.sync(), this.syncIntervalMs);
    }

    /**
     * Stop the chunk registry sync service
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.stats.isRunning = false;
        console.log('[ChunkRegistry] Stopped');
    }

    /**
     * Full sync cycle: register chunks, get assignments, handle proofs
     */
    async sync(): Promise<void> {
        try {
            const config = configManager.get();
            if (!config.apiKey || !config.nodeId) {
                return;
            }

            // 1. Register locally stored chunks with backend
            await this.registerLocalChunks();

            // 2. Check for replication assignments
            await this.checkAssignments();

            // 3. Request and respond to proof challenges
            await this.handleProofChallenges();

            this.stats.lastSync = Date.now();

        } catch (err) {
            console.error('[ChunkRegistry] Sync error:', err);
        }
    }

    /**
     * Register local chunks with the backend Chunk Registry
     */
    private async registerLocalChunks(): Promise<void> {
        const config = configManager.get();
        const storageStats = storageService.getStats();

        if (storageStats.totalChunks === 0) return;

        // Get all local file metadata and their chunks
        const files = storageService.listFiles();
        const chunks: Array<{ hash: string; file_key: string; size: number; index: number }> = [];

        for (const file of files) {
            const fileChunks = storageEngine.getFileChunks(file.fileKey);
            for (const chunk of fileChunks) {
                chunks.push({
                    hash: chunk.hash,
                    file_key: file.fileKey,
                    size: chunk.size,
                    index: chunk.chunkIndex,
                });
            }
        }

        if (chunks.length === 0) return;

        // Send in batches of 100
        for (let i = 0; i < chunks.length; i += 100) {
            const batch = chunks.slice(i, i + 100);
            try {
                const resp = await this.callBackend('storage_node.register_chunks', {
                    node_id: config.nodeId,
                    chunks: batch,
                });

                if (resp.success) {
                    this.stats.totalChunksRegistered = chunks.length;
                    console.log(`[ChunkRegistry] Registered ${resp.registered || batch.length} chunks`);
                }
            } catch (err) {
                console.error('[ChunkRegistry] Register chunks error:', err);
            }
        }
    }

    /**
     * Check for under-replicated chunks we should store
     */
    private async checkAssignments(): Promise<void> {
        const config = configManager.get();

        try {
            const resp = await this.callBackend('storage_node.get_assignments', {
                node_id: config.nodeId,
                capacity_mb: config.storageMaxGB * 1024,
                node_class: config.nodeClass,
            });

            if (resp.success && resp.assignments) {
                const assignments = resp.assignments as ChunkAssignment[];
                this.stats.pendingAssignments = assignments.length;

                if (assignments.length > 0) {
                    console.log(`[ChunkRegistry] ${assignments.length} chunks need replication`);
                }

                // In future: fetch these chunks from peers via P2P
                // For now, just log them
            }
        } catch (err) {
            console.error('[ChunkRegistry] Check assignments error:', err);
        }
    }

    /**
     * Request proof challenges and respond to them
     */
    private async handleProofChallenges(): Promise<void> {
        const config = configManager.get();

        try {
            // 1. Request challenges
            const challengeResp = await this.callBackend('storage_node.proof_challenge', {
                node_id: config.nodeId,
            });

            if (!challengeResp.success || !challengeResp.challenges) return;

            const challenges = challengeResp.challenges as ProofChallenge[];
            if (challenges.length === 0) return;

            console.log(`[ChunkRegistry] Received ${challenges.length} proof challenges`);

            // 2. Generate proofs
            const responses: Array<{ challenge_id: string; proof_hash: string }> = [];

            for (const challenge of challenges) {
                try {
                    const chunk = storageService.getChunk(challenge.chunk_hash);
                    if (!chunk) {
                        console.warn(`[ChunkRegistry] Missing chunk for proof: ${challenge.chunk_hash.slice(0, 16)}...`);
                        continue;
                    }

                    // Read the requested bytes at offset and hash them
                    const start = Math.min(challenge.offset, chunk.length - 1);
                    const end = Math.min(start + challenge.read_bytes, chunk.length);
                    const slice = chunk.subarray(start, end);

                    const proofHash = createHash('sha256')
                        .update(slice)
                        .digest('hex');

                    responses.push({
                        challenge_id: challenge.challenge_id,
                        proof_hash: proofHash,
                    });
                } catch (err) {
                    console.error(`[ChunkRegistry] Proof generation error:`, err);
                }
            }

            if (responses.length === 0) return;

            // 3. Submit proofs
            const proofResp = await this.callBackend('storage_node.proof_response', {
                node_id: config.nodeId,
                responses,
            });

            if (proofResp.success) {
                const passed = (proofResp.passed as number) || 0;
                const failed = (proofResp.failed as number) || 0;
                this.stats.proofsCompleted += passed + failed;
                this.stats.proofsPassed += passed;
                this.stats.proofsFailed += failed;
                this.stats.replicationHealth = this.stats.proofsCompleted > 0
                    ? Math.round((this.stats.proofsPassed / this.stats.proofsCompleted) * 100)
                    : 100;

                console.log(`[ChunkRegistry] Proof results: ${passed} passed, ${failed} failed`);
            }
        } catch (err) {
            console.error('[ChunkRegistry] Proof challenge error:', err);
        }
    }

    /**
     * Call the backend agentGateway
     */
    private async callBackend(action: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
        const config = configManager.get();

        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'VisionNode/1.0.0',
            },
            body: JSON.stringify({
                action,
                api_key: config.apiKey,
                ...params,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return (await response.json()) as Record<string, unknown>;
    }

    /**
     * Get current stats
     */
    getStats(): ChunkRegistryStats {
        return { ...this.stats };
    }
}

export const chunkRegistry = new ChunkRegistryClient();
