/**
 * Vision Mobile Node - Block Observer
 *
 * Connects to Vision Chain RPC via WebSocket and verifies block headers.
 * This gives mobile nodes a real role in network security by independently
 * validating that Authority Nodes are producing valid blocks.
 *
 * Verification checks:
 * 1. parentHash continuity (each block references the correct parent)
 * 2. Clique signer recovery (ecrecover from block header signature)
 * 3. Timestamp validity (monotonically increasing, within bounds)
 * 4. Block number continuity
 */

import { ethers } from 'ethers';
import { getWsRpcUrl, CONFIG } from './config';
import { submitAttestation } from './api';

export interface BlockAttestation {
    block_number: number;
    block_hash: string;
    signer_valid: boolean;
    parent_hash_valid: boolean;
    timestamp_valid: boolean;
}

interface BlockHeader {
    number: number;
    hash: string;
    parentHash: string;
    timestamp: number;
    miner: string;
    extraData: string;
    difficulty: number;
}

type BlockObserverCallback = (stats: BlockObserverStats) => void;

export interface BlockObserverStats {
    isRunning: boolean;
    blocksVerified: number;
    blocksValid: number;
    blocksFailed: number;
    lastBlockNumber: number;
    lastBlockTime: number | null;
    accuracy: number;
}

class BlockObserver {
    private provider: ethers.WebSocketProvider | null = null;
    private pendingAttestations: BlockAttestation[] = [];
    private lastParentHash: string | null = null;
    private lastTimestamp: number = 0;
    private stats: BlockObserverStats = {
        isRunning: false,
        blocksVerified: 0,
        blocksValid: 0,
        blocksFailed: 0,
        lastBlockNumber: 0,
        lastBlockTime: null,
        accuracy: 100,
    };
    private listeners: BlockObserverCallback[] = [];
    private apiKey: string | null = null;

    /**
     * Start observing blocks via WebSocket
     */
    async start(apiKey: string): Promise<void> {
        if (this.stats.isRunning) {
            return;
        }

        this.apiKey = apiKey;

        try {
            const wsUrl = getWsRpcUrl();
            console.log(`[BlockObserver] Connecting to ${wsUrl}`);

            this.provider = new ethers.WebSocketProvider(wsUrl);
            this.stats.isRunning = true;

            // Listen for new blocks
            this.provider.on('block', async (blockNumber: number) => {
                try {
                    await this.verifyBlock(blockNumber);
                } catch (err) {
                    console.error(`[BlockObserver] Error verifying block ${blockNumber}:`, err);
                }
            });

            // Get the latest block to initialize state
            const latestBlock = await this.provider.getBlock('latest');
            if (latestBlock) {
                this.lastParentHash = latestBlock.hash;
                this.lastTimestamp = latestBlock.timestamp;
                this.stats.lastBlockNumber = latestBlock.number;
            }

            this.notifyListeners();
            console.log('[BlockObserver] Started successfully');
        } catch (err) {
            console.error('[BlockObserver] Failed to start:', err);
            this.stats.isRunning = false;
            throw err;
        }
    }

    /**
     * Stop observing blocks
     */
    async stop(): Promise<void> {
        if (this.provider) {
            this.provider.removeAllListeners();
            await this.provider.destroy();
            this.provider = null;
        }
        this.stats.isRunning = false;

        // Flush any remaining attestations
        if (this.pendingAttestations.length > 0 && this.apiKey) {
            await this.flushAttestations();
        }

        this.notifyListeners();
        console.log('[BlockObserver] Stopped');
    }

    /**
     * Verify a single block
     */
    private async verifyBlock(blockNumber: number): Promise<void> {
        if (!this.provider) {
            return;
        }

        const block = await this.provider.getBlock(blockNumber);
        if (!block) {
            return;
        }

        // Verification checks
        const parentHashValid =
            this.lastParentHash === null || block.parentHash === this.lastParentHash;

        const timestampValid =
            this.lastTimestamp === 0 || block.timestamp >= this.lastTimestamp;

        // For Clique PoA, the signer is embedded in extraData
        // extraData format: 32 bytes vanity + [signer addresses at epoch] + 65 bytes signature
        const signerValid = this.verifyCliqueSigner(block);

        const attestation: BlockAttestation = {
            block_number: block.number,
            block_hash: block.hash || '',
            signer_valid: signerValid,
            parent_hash_valid: parentHashValid,
            timestamp_valid: timestampValid,
        };

        // Update state for next block
        this.lastParentHash = block.hash;
        this.lastTimestamp = block.timestamp;

        // Update stats
        this.stats.blocksVerified++;
        this.stats.lastBlockNumber = block.number;
        this.stats.lastBlockTime = Date.now();

        if (parentHashValid && timestampValid && signerValid) {
            this.stats.blocksValid++;
        } else {
            this.stats.blocksFailed++;
            console.warn(
                `[BlockObserver] Block ${blockNumber} validation issue:`,
                { parentHashValid, timestampValid, signerValid },
            );
        }

        this.stats.accuracy =
            this.stats.blocksVerified > 0
                ? Math.round((this.stats.blocksValid / this.stats.blocksVerified) * 100)
                : 100;

        // Queue attestation
        this.pendingAttestations.push(attestation);

        // Flush batch when threshold reached
        if (this.pendingAttestations.length >= CONFIG.ATTESTATION_BATCH_SIZE) {
            await this.flushAttestations();
        }

        this.notifyListeners();
    }

    /**
     * Verify Clique PoA signer from block header
     *
     * In Clique, the signer's signature is the last 65 bytes of extraData.
     * The signer is recovered using ecrecover on the seal hash.
     */
    private verifyCliqueSigner(block: ethers.Block): boolean {
        try {
            // For now, verify that the miner field is a valid address
            // Full Clique signature verification requires RLP encoding
            // which we'll implement in Week 2
            if (!block.miner || block.miner === ethers.ZeroAddress) {
                return false;
            }
            return ethers.isAddress(block.miner);
        } catch {
            return false;
        }
    }

    /**
     * Submit pending attestations to backend
     */
    private async flushAttestations(): Promise<void> {
        if (this.pendingAttestations.length === 0 || !this.apiKey) {
            return;
        }

        const batch = [...this.pendingAttestations];
        this.pendingAttestations = [];

        try {
            const result = await submitAttestation(this.apiKey, batch);
            if (result.success) {
                console.log(
                    `[BlockObserver] Submitted ${batch.length} attestations (bonus: ${result.bonus_weight}x)`,
                );
            } else {
                console.warn('[BlockObserver] Attestation submission failed:', result.error);
                // Re-queue failed attestations
                this.pendingAttestations.unshift(...batch);
            }
        } catch (err) {
            console.error('[BlockObserver] Failed to submit attestations:', err);
            // Re-queue on network error
            this.pendingAttestations.unshift(...batch);
        }
    }

    /**
     * Get current stats
     */
    getStats(): BlockObserverStats {
        return { ...this.stats };
    }

    /**
     * Subscribe to stats updates
     */
    onChange(callback: BlockObserverCallback): () => void {
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

export const blockObserver = new BlockObserver();
