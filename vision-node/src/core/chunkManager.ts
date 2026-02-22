/**
 * Vision Node - Chunk Manager
 *
 * Handles splitting files into 256KB chunks, SHA-256 hashing,
 * and Merkle Tree construction for data integrity verification.
 */

import { createHash } from 'crypto';

export const CHUNK_SIZE = 256 * 1024; // 256KB

export interface ChunkInfo {
    index: number;
    hash: string;       // SHA-256 hex
    size: number;       // bytes
    offset: number;     // byte offset in original file
}

export interface ChunkResult {
    chunks: Buffer[];
    chunkInfos: ChunkInfo[];
    merkleRoot: string;
    totalSize: number;
}

/**
 * Split data into fixed-size chunks and compute hashes
 */
export function chunkData(data: Buffer): ChunkResult {
    const chunks: Buffer[] = [];
    const chunkInfos: ChunkInfo[] = [];
    let offset = 0;

    while (offset < data.length) {
        const end = Math.min(offset + CHUNK_SIZE, data.length);
        const chunk = data.subarray(offset, end);
        const hash = sha256(chunk);

        chunks.push(Buffer.from(chunk));
        chunkInfos.push({
            index: chunks.length - 1,
            hash,
            size: chunk.length,
            offset,
        });

        offset = end;
    }

    const merkleRoot = computeMerkleRoot(chunkInfos.map(c => c.hash));

    return {
        chunks,
        chunkInfos,
        merkleRoot,
        totalSize: data.length,
    };
}

/**
 * Compute SHA-256 hash of a buffer
 */
export function sha256(data: Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

/**
 * Compute Merkle Tree root from leaf hashes
 *
 * Tree structure:
 *        root
 *       /    \
 *     h01    h23
 *    / \    / \
 *   h0  h1 h2  h3
 */
export function computeMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) {
        return sha256(Buffer.alloc(0));
    }

    if (hashes.length === 1) {
        return hashes[0];
    }

    // Build tree bottom-up
    let level = [...hashes];

    while (level.length > 1) {
        const next: string[] = [];

        for (let i = 0; i < level.length; i += 2) {
            if (i + 1 < level.length) {
                // Hash pair
                const combined = level[i] + level[i + 1];
                next.push(sha256(Buffer.from(combined, 'hex')));
            } else {
                // Odd element, promote
                next.push(level[i]);
            }
        }

        level = next;
    }

    return level[0];
}

/**
 * Verify a chunk against its expected hash
 */
export function verifyChunk(chunk: Buffer, expectedHash: string): boolean {
    return sha256(chunk) === expectedHash;
}

/**
 * Generate a content ID (CID) for addressing
 * Format: vcn://<merkle_root_first_16_chars>
 */
export function generateCID(merkleRoot: string): string {
    return `vcn://${merkleRoot}`;
}

/**
 * Parse a CID back to merkle root hash
 */
export function parseCID(cid: string): string | null {
    if (!cid.startsWith('vcn://')) return null;
    return cid.slice(6);
}
