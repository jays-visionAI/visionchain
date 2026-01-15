/**
 * Bridge Adapter - Standard State Machine for Cross-Chain Messaging
 * 
 * Purpose: Provide a unified interface for routing assets/messages
 * between Vision Chain and any target chain, regardless of the
 * underlying bridge protocol (LayerZero, Axelar, etc.).
 */

export type BridgeState =
    | 'IDLE'
    | 'ROUTE_QUOTED'
    | 'SOURCE_LOCKED'
    | 'SOURCE_SENT'
    | 'DEST_SUBMITTED'
    | 'DEST_CONFIRMED'
    | 'FAILED'
    | 'RETRYING';

export interface BridgeQuote {
    quoteId: string;
    sourceChainId: number;
    destChainId: number;
    token: string;
    amount: bigint;
    estimatedFee: bigint;
    estimatedTime: number; // seconds
    expiresAt: number;     // timestamp
}

export interface BridgeTransfer {
    transferId: string;
    quoteId: string;
    state: BridgeState;
    sourceTxHash?: string;
    destTxHash?: string;
    attempts: number;
    createdAt: number;
    updatedAt: number;
    error?: string;
}

/**
 * IBridgeAdapter - Standard interface for all bridge implementations
 */
export interface IBridgeAdapter {
    readonly protocol: string; // e.g., 'LayerZero', 'Axelar', 'Vision-Native'

    // Quoting
    getQuote(params: {
        sourceChainId: number;
        destChainId: number;
        token: string;
        amount: bigint;
    }): Promise<BridgeQuote>;

    // Execution
    initiateBridge(quote: BridgeQuote): Promise<BridgeTransfer>;

    // Monitoring
    getTransferStatus(transferId: string): Promise<BridgeTransfer>;

    // Recovery
    retryTransfer(transferId: string): Promise<BridgeTransfer>;
}

/**
 * MockBridgeAdapter - Simulation for testing
 */
export class MockBridgeAdapter implements IBridgeAdapter {
    readonly protocol = 'Mock';
    private transfers: Map<string, BridgeTransfer> = new Map();

    async getQuote(params: {
        sourceChainId: number;
        destChainId: number;
        token: string;
        amount: bigint;
    }): Promise<BridgeQuote> {
        return {
            quoteId: `quote_${Date.now()}`,
            sourceChainId: params.sourceChainId,
            destChainId: params.destChainId,
            token: params.token,
            amount: params.amount,
            estimatedFee: BigInt(1000000000000000), // 0.001 ETH
            estimatedTime: 120, // 2 minutes
            expiresAt: Date.now() + 300000 // 5 min validity
        };
    }

    async initiateBridge(quote: BridgeQuote): Promise<BridgeTransfer> {
        const transfer: BridgeTransfer = {
            transferId: `transfer_${Date.now()}`,
            quoteId: quote.quoteId,
            state: 'SOURCE_SENT',
            sourceTxHash: `0x${Math.random().toString(16).slice(2)}`,
            attempts: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.transfers.set(transfer.transferId, transfer);

        // Simulate async confirmation
        setTimeout(() => {
            const t = this.transfers.get(transfer.transferId);
            if (t) {
                t.state = 'DEST_CONFIRMED';
                t.destTxHash = `0x${Math.random().toString(16).slice(2)}`;
                t.updatedAt = Date.now();
            }
        }, 3000);

        return transfer;
    }

    async getTransferStatus(transferId: string): Promise<BridgeTransfer> {
        const transfer = this.transfers.get(transferId);
        if (!transfer) throw new Error('Transfer not found');
        return transfer;
    }

    async retryTransfer(transferId: string): Promise<BridgeTransfer> {
        const transfer = this.transfers.get(transferId);
        if (!transfer) throw new Error('Transfer not found');
        transfer.state = 'RETRYING';
        transfer.attempts++;
        transfer.updatedAt = Date.now();

        setTimeout(() => {
            transfer.state = 'DEST_CONFIRMED';
            transfer.updatedAt = Date.now();
        }, 2000);

        return transfer;
    }
}
