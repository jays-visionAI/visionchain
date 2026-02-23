/**
 * VisionDEX Trading Arena - OHLCV Candle Generator
 *
 * Generates and updates candlestick data from trade executions.
 * Supports multiple intervals: 1m, 5m, 15m, 1h, 4h, 1d.
 */

import { OHLCVCandle, CandleInterval, DexTrade } from './types';

// ─── Interval Durations (ms) ───────────────────────────────────────────────

const INTERVAL_MS: Record<CandleInterval, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
};

export const ALL_INTERVALS: CandleInterval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];

// ─── Candle Manager ────────────────────────────────────────────────────────

export class CandleManager {
    // In-memory candle store: interval -> timestamp -> candle
    private candles: Map<CandleInterval, Map<number, OHLCVCandle>> = new Map();
    private maxCandlesPerInterval = 1500;

    constructor() {
        for (const interval of ALL_INTERVALS) {
            this.candles.set(interval, new Map());
        }
    }

    /**
     * Get the start timestamp of the candle that contains the given time
     */
    private getCandleStart(timestamp: number, interval: CandleInterval): number {
        const ms = INTERVAL_MS[interval];
        return Math.floor(timestamp / ms) * ms;
    }

    /**
     * Process a list of trades and update candles for all intervals
     */
    processTrades(trades: Array<{ price: number; amount: number; total: number; timestamp: number }>) {
        for (const trade of trades) {
            for (const interval of ALL_INTERVALS) {
                this.addTradeToCandle(trade, interval);
            }
        }
    }

    /**
     * Add a single trade to a specific interval candle
     */
    private addTradeToCandle(
        trade: { price: number; amount: number; total: number; timestamp: number },
        interval: CandleInterval
    ) {
        const candleStart = this.getCandleStart(trade.timestamp, interval);
        const intervalMap = this.candles.get(interval)!;

        let candle = intervalMap.get(candleStart);

        if (!candle) {
            candle = {
                t: candleStart,
                o: trade.price,
                h: trade.price,
                l: trade.price,
                c: trade.price,
                v: 0,
                qv: 0,
                n: 0,
            };
            intervalMap.set(candleStart, candle);

            // Prune old candles if exceeding limit
            if (intervalMap.size > this.maxCandlesPerInterval) {
                const keys = Array.from(intervalMap.keys()).sort((a, b) => a - b);
                const toRemove = keys.length - this.maxCandlesPerInterval;
                for (let i = 0; i < toRemove; i++) {
                    intervalMap.delete(keys[i]);
                }
            }
        }

        // Update OHLCV
        candle.h = Math.max(candle.h, trade.price);
        candle.l = Math.min(candle.l, trade.price);
        candle.c = trade.price;
        candle.v += trade.amount;
        candle.qv += trade.total;
        candle.n += 1;
    }

    /**
     * Get candles for a specific interval, sorted by timestamp
     */
    getCandles(interval: CandleInterval, limit?: number): OHLCVCandle[] {
        const intervalMap = this.candles.get(interval);
        if (!intervalMap) return [];

        const sorted = Array.from(intervalMap.values())
            .sort((a, b) => a.t - b.t);

        if (limit) {
            return sorted.slice(-limit);
        }
        return sorted;
    }

    /**
     * Get the current (latest) candle for an interval
     */
    getCurrentCandle(interval: CandleInterval): OHLCVCandle | null {
        const candles = this.getCandles(interval);
        return candles.length > 0 ? candles[candles.length - 1] : null;
    }

    /**
     * Fill in empty candles (no trades) with the last close price
     * Call this at the end of each round to ensure continuous candles
     */
    fillGaps(currentPrice: number, nowMs: number) {
        for (const interval of ALL_INTERVALS) {
            const candleStart = this.getCandleStart(nowMs, interval);
            const intervalMap = this.candles.get(interval)!;

            if (!intervalMap.has(candleStart)) {
                // Get previous candle's close
                const sorted = Array.from(intervalMap.keys()).sort((a, b) => a - b);
                let prevClose = currentPrice;
                if (sorted.length > 0) {
                    const prevCandle = intervalMap.get(sorted[sorted.length - 1]);
                    if (prevCandle) prevClose = prevCandle.c;
                }

                // Create a flat candle (no trades in this period)
                intervalMap.set(candleStart, {
                    t: candleStart,
                    o: prevClose,
                    h: prevClose,
                    l: prevClose,
                    c: prevClose,
                    v: 0,
                    qv: 0,
                    n: 0,
                });
            }
        }
    }

    /**
     * Load historical candles from Firestore
     */
    loadCandles(interval: CandleInterval, candles: OHLCVCandle[]) {
        const intervalMap = this.candles.get(interval)!;
        for (const candle of candles) {
            intervalMap.set(candle.t, candle);
        }
    }

    /**
     * Get candles that were modified since a given timestamp
     * (for efficient Firestore writes)
     */
    getModifiedCandles(interval: CandleInterval, sinceTrades: Array<{ timestamp: number }>): OHLCVCandle[] {
        if (sinceTrades.length === 0) return [];

        const modified = new Set<number>();
        for (const trade of sinceTrades) {
            modified.add(this.getCandleStart(trade.timestamp, interval));
        }

        const intervalMap = this.candles.get(interval)!;
        const result: OHLCVCandle[] = [];
        Array.from(modified).forEach(ts => {
            const candle = intervalMap.get(ts);
            if (candle) result.push(candle);
        });

        return result;
    }

    /**
     * Calculate Simple Moving Average from candles
     */
    getSMA(interval: CandleInterval, period: number): number | null {
        const candles = this.getCandles(interval);
        if (candles.length < period) return null;

        const recent = candles.slice(-period);
        const sum = recent.reduce((s, c) => s + c.c, 0);
        return sum / period;
    }

    /**
     * Get recent trade average price (from most recent candles)
     */
    getAvgPrice(count: number = 20): number {
        const candles = this.getCandles('1m', count);
        if (candles.length === 0) return 0;

        const tradedCandles = candles.filter(c => c.n > 0);
        if (tradedCandles.length === 0) {
            return candles[candles.length - 1].c;
        }

        const weightedSum = tradedCandles.reduce((sum, c) => sum + c.c * c.n, 0);
        const totalTrades = tradedCandles.reduce((sum, c) => sum + c.n, 0);
        return weightedSum / totalTrades;
    }

    /**
     * Serialize all candles for Firestore batch write
     */
    serializeForFirestore(): Record<CandleInterval, OHLCVCandle[]> {
        const result: Record<string, OHLCVCandle[]> = {};
        for (const interval of ALL_INTERVALS) {
            result[interval] = this.getCandles(interval);
        }
        return result as Record<CandleInterval, OHLCVCandle[]>;
    }
}
