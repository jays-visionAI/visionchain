/**
 * Nonce Manager - Transaction Relay & Retry Module
 * 
 * Purpose: Manage nonces for relay accounts to prevent tx collisions,
 * implement gas-bumping retries for stuck transactions, and handle
 * tx replacement (speed-up) logic.
 */

import { IChainAdapter, GasQuote } from './ChainAdapter';

export interface PendingTx {
    nonce: number;
    txHash: string;
    gasQuote: GasQuote;
    submittedAt: number;
    attempts: number;
    status: 'PENDING' | 'CONFIRMED' | 'REPLACED' | 'FAILED';
}

export interface NonceManagerConfig {
    relayAccountAddress: string;
    maxPendingTxs: number;       // Max concurrent pending txs
    confirmationTimeout: number; // ms before attempting retry
    maxRetries: number;
    gasBumpPercent: number;      // e.g., 15 for 15% gas bump
}

export class NonceManager {
    private chainAdapter: IChainAdapter;
    private config: NonceManagerConfig;
    private currentNonce: number = -1;
    private pendingTxs: Map<number, PendingTx> = new Map();
    private initialized: boolean = false;

    constructor(chainAdapter: IChainAdapter, config: NonceManagerConfig) {
        this.chainAdapter = chainAdapter;
        this.config = config;
    }

    /**
     * Initialize by fetching the current on-chain nonce
     */
    async initialize(): Promise<void> {
        // In real implementation, call eth_getTransactionCount
        // For now, mock starting at 0
        this.currentNonce = 0;
        this.initialized = true;
        console.log(`[NonceManager] Initialized. Starting nonce: ${this.currentNonce}`);
    }

    /**
     * Get the next available nonce for a new transaction
     */
    async getNextNonce(): Promise<number> {
        if (!this.initialized) await this.initialize();

        // Check for gaps in pending txs (replaced/failed)
        for (const [nonce, tx] of this.pendingTxs) {
            if (tx.status === 'REPLACED' || tx.status === 'FAILED') {
                this.pendingTxs.delete(nonce);
                return nonce; // Reuse this nonce
            }
        }

        // Check pending count limit
        const pendingCount = Array.from(this.pendingTxs.values())
            .filter(tx => tx.status === 'PENDING').length;

        if (pendingCount >= this.config.maxPendingTxs) {
            throw new Error(`Max pending transactions reached (${this.config.maxPendingTxs})`);
        }

        return this.currentNonce++;
    }

    /**
     * Track a submitted transaction
     */
    trackTx(nonce: number, txHash: string, gasQuote: GasQuote): void {
        this.pendingTxs.set(nonce, {
            nonce,
            txHash,
            gasQuote,
            submittedAt: Date.now(),
            attempts: 1,
            status: 'PENDING'
        });
    }

    /**
     * Confirm a transaction (called when receipt is received)
     */
    confirmTx(nonce: number): void {
        const tx = this.pendingTxs.get(nonce);
        if (tx) {
            tx.status = 'CONFIRMED';
            // Clean up old confirmed txs periodically
        }
    }

    /**
     * Check for stuck transactions and attempt gas-bumped replacements
     */
    async checkStuckTransactions(): Promise<void> {
        const now = Date.now();

        for (const [nonce, tx] of this.pendingTxs) {
            if (tx.status !== 'PENDING') continue;

            const elapsed = now - tx.submittedAt;
            if (elapsed > this.config.confirmationTimeout) {
                // Check if already confirmed
                const receipt = await this.chainAdapter.getTransactionReceipt(tx.txHash);
                if (receipt) {
                    tx.status = 'CONFIRMED';
                    continue;
                }

                // Needs retry with gas bump
                if (tx.attempts < this.config.maxRetries) {
                    console.log(`[NonceManager] Tx ${tx.txHash} stuck. Attempting gas bump retry...`);
                    tx.attempts++;
                    tx.submittedAt = now;

                    // Calculate bumped gas
                    const bumpMultiplier = BigInt(100 + this.config.gasBumpPercent);
                    tx.gasQuote.maxFeePerGas = (tx.gasQuote.maxFeePerGas * bumpMultiplier) / BigInt(100);
                    tx.gasQuote.maxPriorityFeePerGas = (tx.gasQuote.maxPriorityFeePerGas * bumpMultiplier) / BigInt(100);

                    // In real implementation, re-sign and send replacement tx here
                    console.log(`[NonceManager] Gas bumped to ${tx.gasQuote.maxFeePerGas}`);
                } else {
                    console.error(`[NonceManager] Tx ${tx.txHash} failed after ${tx.attempts} attempts.`);
                    tx.status = 'FAILED';
                }
            }
        }
    }

    /**
     * Get current pending transaction count
     */
    getPendingCount(): number {
        return Array.from(this.pendingTxs.values())
            .filter(tx => tx.status === 'PENDING').length;
    }

    /**
     * Get nonce gap (difference between local and on-chain nonce)
     */
    async getNonceGap(): Promise<number> {
        // In real implementation, compare with eth_getTransactionCount
        return 0; // Mock
    }
}
