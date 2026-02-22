/**
 * Vision Node - Storage Service
 *
 * High-level API for storing and retrieving files.
 * Combines chunk manager + storage engine to provide:
 *   - File upload (auto chunk + hash + store)
 *   - File download (reassemble from chunks)
 *   - File delete
 *   - Storage stats
 */

import { chunkData, generateCID, sha256, type ChunkResult } from './chunkManager.js';
import { storageEngine, type StorageStats } from './storage.js';
import { createHash, randomUUID } from 'crypto';

export interface UploadResult {
    success: boolean;
    fileKey: string;
    cid: string;
    merkleRoot: string;
    totalSize: number;
    chunkCount: number;
    error?: string;
}

export interface DownloadResult {
    success: boolean;
    data?: Buffer;
    merkleRoot?: string;
    error?: string;
}

class StorageService {
    /**
     * Start the storage service
     */
    async start(): Promise<void> {
        await storageEngine.start();
    }

    /**
     * Stop the storage service
     */
    async stop(): Promise<void> {
        await storageEngine.stop();
    }

    /**
     * Upload (store) a file
     */
    upload(data: Buffer, metadata?: Record<string, unknown>): UploadResult {
        try {
            // Chunk the data
            const result: ChunkResult = chunkData(data);
            const fileKey = `file_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

            // Store each chunk
            for (let i = 0; i < result.chunks.length; i++) {
                const stored = storageEngine.putChunk(
                    result.chunkInfos[i].hash,
                    result.chunks[i],
                    fileKey,
                    i
                );

                if (!stored) {
                    // Rollback: delete any chunks already stored
                    storageEngine.deleteFile(fileKey);
                    return {
                        success: false,
                        fileKey: '',
                        cid: '',
                        merkleRoot: '',
                        totalSize: 0,
                        chunkCount: 0,
                        error: `Failed to store chunk ${i}`,
                    };
                }
            }

            // Register the file
            storageEngine.registerFile(fileKey, result.merkleRoot, result.totalSize, result.chunks.length, metadata);

            const cid = generateCID(result.merkleRoot);
            console.log(
                `[Storage] Uploaded ${fileKey} (${result.chunks.length} chunks, ${formatSize(result.totalSize)}, CID: ${cid.slice(0, 24)}...)`
            );

            return {
                success: true,
                fileKey,
                cid,
                merkleRoot: result.merkleRoot,
                totalSize: result.totalSize,
                chunkCount: result.chunks.length,
            };
        } catch (err) {
            return {
                success: false,
                fileKey: '',
                cid: '',
                merkleRoot: '',
                totalSize: 0,
                chunkCount: 0,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Download (retrieve) a file by reassembling its chunks
     */
    download(fileKey: string): DownloadResult {
        try {
            const chunks = storageEngine.getFileChunks(fileKey);
            if (chunks.length === 0) {
                return { success: false, error: 'File not found' };
            }

            // Read and reassemble chunks in order
            const buffers: Buffer[] = [];
            for (const chunk of chunks) {
                const data = storageEngine.getChunk(chunk.hash);
                if (!data) {
                    return { success: false, error: `Missing chunk: ${chunk.hash.slice(0, 12)}...` };
                }
                buffers.push(data);
            }

            const assembled = Buffer.concat(buffers);
            return {
                success: true,
                data: assembled,
            };
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }

    /**
     * Delete a file and all its chunks
     */
    delete(fileKey: string): boolean {
        const count = storageEngine.deleteFile(fileKey);
        console.log(`[Storage] Deleted ${fileKey} (${count} chunks)`);
        return count > 0;
    }

    /**
     * List all stored files
     */
    listFiles() {
        return storageEngine.listFiles();
    }

    /**
     * Check if a chunk exists
     */
    hasChunk(hash: string): boolean {
        return storageEngine.hasChunk(hash);
    }

    /**
     * Get a chunk's data by hash (for P2P sharing)
     */
    getChunk(hash: string): Buffer | null {
        return storageEngine.getChunk(hash);
    }

    /**
     * Get storage statistics
     */
    getStats(): StorageStats {
        return storageEngine.getStats();
    }
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

export const storageService = new StorageService();
