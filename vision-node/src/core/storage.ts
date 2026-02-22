/**
 * Vision Node - Storage Engine
 *
 * File-system based storage with SQLite index for chunk metadata.
 * Handles put/get/delete of chunks, LRU eviction, and capacity management.
 *
 * Directory layout:
 *   ~/.visionnode/storage/
 *     chunks/
 *       ab/cd/abcdef1234...    (chunk files, organized by hash prefix)
 *     index.db                 (SQLite metadata)
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';
import { configManager } from '../config/nodeConfig.js';
import { sha256, verifyChunk, type ChunkInfo } from './chunkManager.js';

export interface StoredChunk {
    hash: string;
    size: number;
    fileKey: string;        // which file this chunk belongs to
    chunkIndex: number;     // index within the file
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
}

export interface StorageStats {
    isRunning: boolean;
    totalChunks: number;
    totalSizeBytes: number;
    maxSizeBytes: number;
    usagePercent: number;
    totalFiles: number;
}

type StorageCallback = (stats: StorageStats) => void;

class StorageEngine {
    private db: Database.Database | null = null;
    private storagePath: string = '';
    private chunksPath: string = '';
    private maxSizeBytes: number = 0;
    private running = false;
    private listeners: StorageCallback[] = [];

    /**
     * Initialize and start the storage engine
     */
    async start(): Promise<void> {
        if (this.running) return;

        const config = configManager.get();
        this.storagePath = config.storagePath;
        this.chunksPath = join(this.storagePath, 'chunks');
        this.maxSizeBytes = config.storageMaxGB * 1024 * 1024 * 1024;

        // Create directories
        if (!existsSync(this.storagePath)) {
            mkdirSync(this.storagePath, { recursive: true });
        }
        if (!existsSync(this.chunksPath)) {
            mkdirSync(this.chunksPath, { recursive: true });
        }

        // Open SQLite database
        const dbPath = join(this.storagePath, 'index.db');
        this.db = new Database(dbPath);

        // Enable WAL mode for better concurrent performance
        this.db.pragma('journal_mode = WAL');

        // Create tables
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS chunks (
                hash TEXT PRIMARY KEY,
                size INTEGER NOT NULL,
                file_key TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                last_accessed INTEGER NOT NULL,
                access_count INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS files (
                file_key TEXT PRIMARY KEY,
                merkle_root TEXT NOT NULL,
                total_size INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                metadata TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_file_key ON chunks(file_key);
            CREATE INDEX IF NOT EXISTS idx_chunks_last_accessed ON chunks(last_accessed);
            CREATE INDEX IF NOT EXISTS idx_files_merkle_root ON files(merkle_root);
        `);

        this.running = true;
        console.log(`[Storage] Started (${this.getStats().totalChunks} chunks, ${this.formatSize(this.getStats().totalSizeBytes)})`);
        this.notify();
    }

    /**
     * Stop the storage engine
     */
    async stop(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        this.running = false;
        console.log('[Storage] Stopped');
    }

    /**
     * Store a chunk on disk and index it
     */
    putChunk(hash: string, data: Buffer, fileKey: string, chunkIndex: number): boolean {
        if (!this.db || !this.running) return false;

        // Verify hash
        const actualHash = sha256(data);
        if (actualHash !== hash) {
            console.warn(`[Storage] Hash mismatch: expected ${hash}, got ${actualHash}`);
            return false;
        }

        // Check if we have space (evict if needed)
        const currentSize = this.getTotalSize();
        if (currentSize + data.length > this.maxSizeBytes) {
            const freed = this.evictLRU(data.length);
            if (freed < data.length) {
                console.warn('[Storage] Not enough space even after eviction');
                return false;
            }
        }

        // Write chunk file
        const chunkPath = this.getChunkPath(hash);
        const chunkDir = join(chunkPath, '..');
        if (!existsSync(chunkDir)) {
            mkdirSync(chunkDir, { recursive: true });
        }
        writeFileSync(chunkPath, data);

        // Index in SQLite
        const now = Date.now();
        this.db.prepare(`
            INSERT OR REPLACE INTO chunks (hash, size, file_key, chunk_index, created_at, last_accessed, access_count)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        `).run(hash, data.length, fileKey, chunkIndex, now, now);

        this.notify();
        return true;
    }

    /**
     * Retrieve a chunk from disk
     */
    getChunk(hash: string): Buffer | null {
        if (!this.db || !this.running) return null;

        const chunkPath = this.getChunkPath(hash);
        if (!existsSync(chunkPath)) {
            return null;
        }

        // Update access stats
        this.db.prepare(`
            UPDATE chunks SET last_accessed = ?, access_count = access_count + 1
            WHERE hash = ?
        `).run(Date.now(), hash);

        return readFileSync(chunkPath);
    }

    /**
     * Delete a specific chunk
     */
    deleteChunk(hash: string): boolean {
        if (!this.db || !this.running) return false;

        const chunkPath = this.getChunkPath(hash);
        if (existsSync(chunkPath)) {
            unlinkSync(chunkPath);
        }

        this.db.prepare('DELETE FROM chunks WHERE hash = ?').run(hash);
        this.notify();
        return true;
    }

    /**
     * Register a complete file in the index
     */
    registerFile(fileKey: string, merkleRoot: string, totalSize: number, chunkCount: number, metadata?: Record<string, unknown>): void {
        if (!this.db) return;

        this.db.prepare(`
            INSERT OR REPLACE INTO files (file_key, merkle_root, total_size, chunk_count, created_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(fileKey, merkleRoot, totalSize, chunkCount, Date.now(), metadata ? JSON.stringify(metadata) : null);
    }

    /**
     * Delete all chunks belonging to a file
     */
    deleteFile(fileKey: string): number {
        if (!this.db || !this.running) return 0;

        const chunks = this.db.prepare('SELECT hash FROM chunks WHERE file_key = ?').all(fileKey) as { hash: string }[];

        for (const chunk of chunks) {
            const chunkPath = this.getChunkPath(chunk.hash);
            if (existsSync(chunkPath)) {
                unlinkSync(chunkPath);
            }
        }

        this.db.prepare('DELETE FROM chunks WHERE file_key = ?').run(fileKey);
        this.db.prepare('DELETE FROM files WHERE file_key = ?').run(fileKey);
        this.notify();
        return chunks.length;
    }

    /**
     * Get all chunk hashes for a file
     */
    getFileChunks(fileKey: string): StoredChunk[] {
        if (!this.db) return [];

        return this.db.prepare(
            'SELECT hash, size, file_key, chunk_index, created_at, last_accessed, access_count FROM chunks WHERE file_key = ? ORDER BY chunk_index'
        ).all(fileKey) as StoredChunk[];
    }

    /**
     * Check if a chunk exists
     */
    hasChunk(hash: string): boolean {
        if (!this.db) return false;

        const row = this.db.prepare('SELECT 1 FROM chunks WHERE hash = ?').get(hash);
        return !!row;
    }

    /**
     * Evict least recently used chunks to free up space
     */
    private evictLRU(bytesNeeded: number): number {
        if (!this.db) return 0;

        let freed = 0;
        const candidates = this.db.prepare(
            'SELECT hash, size FROM chunks ORDER BY last_accessed ASC LIMIT 100'
        ).all() as { hash: string; size: number }[];

        for (const candidate of candidates) {
            if (freed >= bytesNeeded) break;

            this.deleteChunk(candidate.hash);
            freed += candidate.size;
            console.log(`[Storage] Evicted chunk ${candidate.hash.slice(0, 12)}... (${this.formatSize(candidate.size)})`);
        }

        return freed;
    }

    /**
     * Get file path for a chunk (organized by hash prefix for filesystem efficiency)
     */
    private getChunkPath(hash: string): string {
        const prefix1 = hash.slice(0, 2);
        const prefix2 = hash.slice(2, 4);
        return join(this.chunksPath, prefix1, prefix2, hash);
    }

    /**
     * Get total stored size from SQLite
     */
    private getTotalSize(): number {
        if (!this.db) return 0;
        const row = this.db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM chunks').get() as { total: number };
        return row.total;
    }

    /**
     * Get current storage stats
     */
    getStats(): StorageStats {
        if (!this.db) {
            return {
                isRunning: false,
                totalChunks: 0,
                totalSizeBytes: 0,
                maxSizeBytes: this.maxSizeBytes,
                usagePercent: 0,
                totalFiles: 0,
            };
        }

        const chunkStats = this.db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size), 0) as total FROM chunks').get() as { count: number; total: number };
        const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };

        return {
            isRunning: this.running,
            totalChunks: chunkStats.count,
            totalSizeBytes: chunkStats.total,
            maxSizeBytes: this.maxSizeBytes,
            usagePercent: this.maxSizeBytes > 0 ? Math.round((chunkStats.total / this.maxSizeBytes) * 100) : 0,
            totalFiles: fileCount.count,
        };
    }

    /**
     * List all stored files
     */
    listFiles(): Array<{ fileKey: string; merkleRoot: string; totalSize: number; chunkCount: number; createdAt: number }> {
        if (!this.db) return [];
        return this.db.prepare(
            'SELECT file_key AS fileKey, merkle_root AS merkleRoot, total_size AS totalSize, chunk_count AS chunkCount, created_at AS createdAt FROM files ORDER BY created_at DESC'
        ).all() as any[];
    }

    /**
     * Subscribe to stats changes
     */
    onChange(callback: StorageCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notify(): void {
        const stats = this.getStats();
        this.listeners.forEach(cb => cb(stats));
    }

    private formatSize(bytes: number): string {
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
    }
}

export const storageEngine = new StorageEngine();
