/**
 * Chain Adapter - Standard Interface for Cross-Chain Execution
 * 
 * Purpose: Abstract chain-specific differences so that the Paymaster
 * can interact with any EVM chain through a unified API.
 */

export interface ChainAdapterConfig {
    chainId: number;
    rpcUrl: string;
    rpcUrls?: string[];  // Multiple RPC endpoints for multi-source gas
    wsUrl?: string;
    confirmations: number;
    feeModel: 'EIP1559' | 'LEGACY';
}

export interface GasQuote {
    gasLimit: bigint;
    maxFeePerGas: bigint;      // For EIP-1559
    maxPriorityFeePerGas: bigint;
    legacyGasPrice?: bigint;   // For Legacy chains
    estimatedCostWei: bigint;
    sourceCount: number;       // Number of sources used
    variance: number;          // Variance % between sources
}

export interface TxReceipt {
    txHash: string;
    blockNumber: number;
    status: 'SUCCESS' | 'REVERTED';
    gasUsed: bigint;
    effectiveGasPrice: bigint;
}

/**
 * IChainAdapter - Standard interface that all chain adapters must implement
 */
export interface IChainAdapter {
    readonly chainId: number;

    // Connectivity
    getBlockNumber(): Promise<number>;
    isHealthy(): Promise<boolean>;

    // Gas Estimation (Multi-source internally)
    getGasQuote(tx: { to: string; data: string; value?: bigint }): Promise<GasQuote>;
    getMultiSourceGasPrice(): Promise<{ median: bigint; sources: bigint[]; variance: number }>;

    // Execution
    estimateGas(tx: { to: string; data: string; value?: bigint }): Promise<bigint>;
    sendRawTransaction(signedTx: string): Promise<string>; // Returns txHash
    getTransactionReceipt(txHash: string): Promise<TxReceipt | null>;

    // Event Subscription (Polling fallback if WS unavailable)
    subscribeLogs(filter: { address?: string; topics?: string[] }, callback: (log: any) => void): () => void; // Returns unsubscribe fn
}

/**
 * EVMChainAdapter - Default implementation for standard EVM chains
 * Supports multi-source gas price aggregation with median
 */
export class EVMChainAdapter implements IChainAdapter {
    readonly chainId: number;
    private rpcUrls: string[];
    private confirmations: number;
    private feeModel: 'EIP1559' | 'LEGACY';

    constructor(config: ChainAdapterConfig) {
        this.chainId = config.chainId;
        this.rpcUrls = config.rpcUrls || [config.rpcUrl];
        this.confirmations = config.confirmations;
        this.feeModel = config.feeModel;
    }

    private async rpcCall(method: string, params: any[] = [], rpcUrl?: string): Promise<any> {
        const url = rpcUrl || this.rpcUrls[0];
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
        });
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        return json.result;
    }

    /**
     * Multi-Source Gas Price Aggregation
     * Queries all configured RPCs and returns median to defend against oracle manipulation
     */
    async getMultiSourceGasPrice(): Promise<{ median: bigint; sources: bigint[]; variance: number }> {
        const prices: bigint[] = [];

        // Query all RPC sources in parallel
        const results = await Promise.allSettled(
            this.rpcUrls.map(url => this.rpcCall('eth_gasPrice', [], url))
        );

        for (const result of results) {
            if (result.status === 'fulfilled') {
                prices.push(BigInt(result.value));
            }
        }

        if (prices.length === 0) {
            throw new Error('No gas price sources available');
        }

        // Sort and get median
        const sorted = [...prices].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / BigInt(2)
            : sorted[mid];

        // Calculate variance (max - min) / median * 100
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const variance = prices.length > 1
            ? Number((max - min) * BigInt(100) / median)
            : 0;

        return { median, sources: prices, variance };
    }

    async getBlockNumber(): Promise<number> {
        const hex = await this.rpcCall('eth_blockNumber');
        return parseInt(hex, 16);
    }

    async isHealthy(): Promise<boolean> {
        try {
            const block = await this.getBlockNumber();
            return block > 0;
        } catch {
            return false;
        }
    }

    async getGasQuote(tx: { to: string; data: string; value?: bigint }): Promise<GasQuote> {
        const gasLimit = await this.estimateGas(tx);
        const { median: gasPrice, sources, variance } = await this.getMultiSourceGasPrice();

        if (this.feeModel === 'EIP1559') {
            const priorityFee = BigInt('1500000000'); // 1.5 Gwei default tip
            const maxFee = gasPrice * BigInt(2) + priorityFee;

            return {
                gasLimit,
                maxFeePerGas: maxFee,
                maxPriorityFeePerGas: priorityFee,
                estimatedCostWei: gasLimit * maxFee,
                sourceCount: sources.length,
                variance
            };
        } else {
            return {
                gasLimit,
                maxFeePerGas: gasPrice,
                maxPriorityFeePerGas: BigInt(0),
                legacyGasPrice: gasPrice,
                estimatedCostWei: gasLimit * gasPrice,
                sourceCount: sources.length,
                variance
            };
        }
    }

    async estimateGas(tx: { to: string; data: string; value?: bigint }): Promise<bigint> {
        const hex = await this.rpcCall('eth_estimateGas', [{
            to: tx.to,
            data: tx.data,
            value: tx.value ? '0x' + tx.value.toString(16) : '0x0'
        }]);
        return BigInt(hex);
    }

    async sendRawTransaction(signedTx: string): Promise<string> {
        return await this.rpcCall('eth_sendRawTransaction', [signedTx]);
    }

    async getTransactionReceipt(txHash: string): Promise<TxReceipt | null> {
        const receipt = await this.rpcCall('eth_getTransactionReceipt', [txHash]);
        if (!receipt) return null;

        return {
            txHash: receipt.transactionHash,
            blockNumber: parseInt(receipt.blockNumber, 16),
            status: receipt.status === '0x1' ? 'SUCCESS' : 'REVERTED',
            gasUsed: BigInt(receipt.gasUsed),
            effectiveGasPrice: BigInt(receipt.effectiveGasPrice || receipt.gasPrice)
        };
    }

    subscribeLogs(filter: { address?: string; topics?: string[] }, callback: (log: any) => void): () => void {
        // Polling-based fallback (for chains without WS)
        let running = true;
        let lastBlock = 0;

        const poll = async () => {
            if (!running) return;
            try {
                const currentBlock = await this.getBlockNumber();
                if (currentBlock > lastBlock) {
                    const logs = await this.rpcCall('eth_getLogs', [{
                        fromBlock: '0x' + (lastBlock + 1).toString(16),
                        toBlock: '0x' + currentBlock.toString(16),
                        address: filter.address,
                        topics: filter.topics
                    }]);
                    logs.forEach(callback);
                    lastBlock = currentBlock;
                }
            } catch (e) {
                console.error('[ChainAdapter] Log polling error:', e);
            }
            setTimeout(poll, 5000); // 5s interval
        };

        this.getBlockNumber().then(b => { lastBlock = b; poll(); });

        return () => { running = false; };
    }
}
