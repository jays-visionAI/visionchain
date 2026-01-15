import { getFirebaseDb } from '../firebaseService';
import { collection, addDoc } from 'firebase/firestore';
import { FeeQuote } from './types';

// Mock Oracle for conversion
const MOCK_ORACLE_PRICE = {
    'VCN': 1.0, // Base
    'USDT': 0.15, // 1 VCN = 0.15 USDT
    'ETH': 0.0003 // 1 VCN = 0.0003 ETH
};

export const FeeEngine = {
    /**
     * Generate a Fee Quote with Surcharge & Buffer
     * Formula: BaseGas * GasPrice * (1 + Buffer) + Surcharge
     * SLO: < 800ms
     */
    generateQuote: async (
        dappId: string,
        userId: string,
        chainId: number,
        tokenIn: string, // Token user wants to pay with (or 'SPONSORED')
        estimatedGas: bigint
    ): Promise<FeeQuote> => {
        const startTime = Date.now();

        // 1. Get Base Metrics (Mock)
        // In prod, fetch from Redis/RPC
        const gasPriceById = { 1: 20000000000n, 9999: 1000000000n }; // wei
        const baseGasPrice = gasPriceById[chainId] || 1000000000n;

        // 2. Calculate Base Cost (in Native Gas Token)
        const baseCostNative = estimatedGas * baseGasPrice;

        // 3. Apply Buffer (Dynamic based on volatility - Mock 5%)
        const bufferPercent = 5n;
        const bufferedCost = baseCostNative * (100n + bufferPercent) / 100n;
        const bufferAmount = bufferedCost - baseCostNative;

        // 4. Apply Surcharge (Service Fee - Mock 20%)
        const surchargePercent = 20n;
        const surchargeAmount = baseCostNative * surchargePercent / 100n;

        // 5. Total Required in Native (Wei)
        const totalNative = bufferedCost + surchargeAmount;

        // 6. Token Conversion (if not Sponsored)
        // Simple Oracle logic
        let totalMaxTokenIn = totalNative; // Default if Native

        if (tokenIn !== 'NATIVE') {
            // Apply Oracle Rate
            // e.g., if paying in USDT, convert Wei -> USDT
            // 1 Native (ETH) = 3000 USDT (Mock)
            // This part is skipped for purely Sponsorship logic, but critical for Token Paymaster
            // For now, assume 1:1 for simplicity or implement mock rate
            totalMaxTokenIn = totalNative;
        }

        // 7. Create Quote Object
        const quote: FeeQuote = {
            quoteId: `qt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            dappId,
            userId,
            chainId,
            tokenIn,
            totalMaxTokenIn,
            baseCost: baseCostNative,
            surcharge: surchargeAmount,
            buffer: bufferAmount,
            expiry: Date.now() + 60000, // 1 min expiry
            status: 'PENDING'
        };

        // 8. Log "FeeQuoted" Event (Async to meet SLO)
        // We calculate latency to ensure SLO adherence
        const latency = Date.now() - startTime;
        if (latency > 800) {
            console.warn(`[FeeEngine] SLO Warning: Quote took ${latency}ms (>800ms)`);
        }

        const db = getFirebaseDb();
        // Fire-and-forget log
        addDoc(collection(db, 'paymaster_events'), {
            type: 'QUOTE',
            quoteId: quote.quoteId,
            chainId,
            amount: totalMaxTokenIn.toString(),
            token: tokenIn,
            timestamp: Date.now(),
            latency
        }).catch(err => console.error("Event Log Failed", err));

        return quote;
    }
};
