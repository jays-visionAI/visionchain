/**
 * Vision Mobile Node - Chunk Storage Service
 *
 * Stores and serves file chunks on the mobile device filesystem.
 * Uses react-native-fs for file I/O instead of AsyncStorage (which is
 * not suitable for large binary data).
 *
 * Features:
 *   - Store/retrieve chunks by hash (content-addressable)
 *   - LRU eviction when storage limit reached
 *   - Index persisted to AsyncStorage (metadata only)
 *   - WiFi-only: paused when on cellular/offline
 *
 * Directory layout:
 *   <DocumentDir>/vision_chunks/
 *     <hash_prefix>/<full_hash>    (raw binary chunk files)
 */

import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from './config';

const CHUNKS_DIR = `${RNFS.DocumentDirectoryPath}/vision_chunks`;
const INDEX_KEY = '@vmn_chunk_index';

export interface ChunkMeta {
    hash: string;
    fileKey: string;
    chunkIndex: number;
    size: number;
    createdAt: number;
    lastAccessed: number;
}

export interface ChunkStorageStats {
    isRunning: boolean;
    totalChunks: number;
    totalSizeBytes: number;
    maxSizeBytes: number;
    usagePercent: number;
    chunksServed: number;
}

type StatsCallback = (stats: ChunkStorageStats) => void;

class ChunkStorageService {
    private index: Map<string, ChunkMeta> = new Map();
    private listeners: StatsCallback[] = [];
    private stats: ChunkStorageStats = {
        isRunning: false,
        totalChunks: 0,
        totalSizeBytes: 0,
        maxSizeBytes: CONFIG.MAX_CHUNK_STORAGE_MB * 1024 * 1024,
        usagePercent: 0,
        chunksServed: 0,
    };

    /**
     * Start the chunk storage service
     */
    async start(maxSizeMb?: number): Promise<void> {
        if (this.stats.isRunning) return;

        if (maxSizeMb) {
            this.stats.maxSizeBytes = maxSizeMb * 1024 * 1024;
        }

        // Ensure chunks directory exists
        const exists = await RNFS.exists(CHUNKS_DIR);
        if (!exists) {
            await RNFS.mkdir(CHUNKS_DIR);
        }

        // Load index from AsyncStorage
        await this.loadIndex();

        this.stats.isRunning = true;
        this.recalcStats();
        this.notify();

        console.log(
            `[ChunkStorage] Started (${this.index.size} chunks, ${(this.stats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB)`,
        );
    }

    /**
     * Stop and persist index
     */
    async stop(): Promise<void> {
        await this.saveIndex();
        this.stats.isRunning = false;
        this.notify();
        console.log('[ChunkStorage] Stopped');
    }

    /**
     * Store a chunk (base64 encoded data from backend)
     */
    async storeChunk(
        hash: string,
        base64Data: string,
        fileKey: string = '',
        chunkIndex: number = 0,
    ): Promise<boolean> {
        if (!this.stats.isRunning) return false;

        // Already stored?
        if (this.index.has(hash)) return true;

        const dataSize = Math.ceil(base64Data.length * 0.75); // estimate decoded size

        // Check capacity
        if (this.stats.totalSizeBytes + dataSize > this.stats.maxSizeBytes) {
            // Try eviction
            const freed = await this.evictLRU(dataSize);
            if (!freed) return false;
        }

        try {
            const chunkPath = this.getChunkPath(hash);
            const dir = chunkPath.substring(0, chunkPath.lastIndexOf('/'));
            const dirExists = await RNFS.exists(dir);
            if (!dirExists) await RNFS.mkdir(dir);

            await RNFS.writeFile(chunkPath, base64Data, 'base64');

            const meta: ChunkMeta = {
                hash,
                fileKey,
                chunkIndex,
                size: dataSize,
                createdAt: Date.now(),
                lastAccessed: Date.now(),
            };

            this.index.set(hash, meta);
            this.recalcStats();
            this.notify();

            return true;
        } catch (err) {
            console.warn('[ChunkStorage] Failed to store chunk:', err);
            return false;
        }
    }

    /**
     * Retrieve a chunk as base64 string
     */
    async getChunk(hash: string): Promise<string | null> {
        const meta = this.index.get(hash);
        if (!meta) return null;

        try {
            const chunkPath = this.getChunkPath(hash);
            const exists = await RNFS.exists(chunkPath);
            if (!exists) {
                this.index.delete(hash);
                this.recalcStats();
                return null;
            }

            const data = await RNFS.readFile(chunkPath, 'base64');
            meta.lastAccessed = Date.now();
            this.stats.chunksServed++;

            return data;
        } catch {
            return null;
        }
    }

    /**
     * Check if a chunk exists locally
     */
    hasChunk(hash: string): boolean {
        return this.index.has(hash);
    }

    /**
     * Get list of all stored chunk hashes with metadata
     */
    getStoredChunks(): Array<{ hash: string; file_key: string; size: number; index: number }> {
        return Array.from(this.index.values()).map(m => ({
            hash: m.hash,
            file_key: m.fileKey,
            size: m.size,
            index: m.chunkIndex,
        }));
    }

    /**
     * Evict LRU chunks to free space
     */
    private async evictLRU(bytesNeeded: number): Promise<boolean> {
        const sorted = Array.from(this.index.values()).sort(
            (a, b) => a.lastAccessed - b.lastAccessed,
        );

        let freed = 0;
        for (const meta of sorted) {
            if (freed >= bytesNeeded) break;

            try {
                const chunkPath = this.getChunkPath(meta.hash);
                await RNFS.unlink(chunkPath);
            } catch { /* file may not exist */ }

            freed += meta.size;
            this.index.delete(meta.hash);
            console.log(`[ChunkStorage] Evicted: ${meta.hash.slice(0, 12)}...`);
        }

        this.recalcStats();
        return freed >= bytesNeeded;
    }

    /**
     * Get file path for a chunk (organized by hash prefix)
     */
    private getChunkPath(hash: string): string {
        const prefix = hash.substring(0, 2);
        return `${CHUNKS_DIR}/${prefix}/${hash}`;
    }

    /**
     * Recalculate stats from index
     */
    private recalcStats(): void {
        let totalSize = 0;
        for (const meta of this.index.values()) {
            totalSize += meta.size;
        }
        this.stats.totalChunks = this.index.size;
        this.stats.totalSizeBytes = totalSize;
        this.stats.usagePercent = this.stats.maxSizeBytes > 0
            ? Math.round((totalSize / this.stats.maxSizeBytes) * 100)
            : 0;
    }

    /**
     * Persist chunk index (metadata only, not data)
     */
    private async saveIndex(): Promise<void> {
        try {
            const data = Array.from(this.index.values());
            await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(data));
        } catch (err) {
            console.warn('[ChunkStorage] Failed to save index:', err);
        }
    }

    /**
     * Load chunk index from AsyncStorage
     */
    private async loadIndex(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(INDEX_KEY);
            if (!raw) return;

            const entries: ChunkMeta[] = JSON.parse(raw);
            let validCount = 0;

            for (const meta of entries) {
                // Verify chunk file still exists
                const chunkPath = this.getChunkPath(meta.hash);
                const exists = await RNFS.exists(chunkPath);
                if (exists) {
                    this.index.set(meta.hash, meta);
                    validCount++;
                }
            }

            console.log(`[ChunkStorage] Loaded ${validCount}/${entries.length} chunks from index`);
        } catch (err) {
            console.warn('[ChunkStorage] Failed to load index:', err);
        }
    }

    getStats(): ChunkStorageStats {
        return { ...this.stats };
    }

    onChange(callback: StatsCallback): () => void {
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

export const chunkStorage = new ChunkStorageService();
