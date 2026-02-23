/**
 * VisionDEX Trading Arena - Order Book & Matching Engine
 * 
 * Price-Time Priority matching with Maker/Taker distinction.
 * MM agents place orders first, then regular agents interact.
 */

import {
    DexOrder, DexTrade, OrderBookSnapshot, OrderBookLevel,
    OrderSide, FEE_RATES, TRADING_PAIR, TRADING_LIMITS,
} from './types';
import { Timestamp } from 'firebase/firestore';

// ─── In-Memory Order Book ──────────────────────────────────────────────────

interface InternalOrder {
    id: string;
    agentId: string;
    ownerUid: string;
    side: OrderSide;
    price: number;
    remainingAmount: number;
    isMMOrder: boolean;
    timestamp: number;
}

export class OrderBook {
    private bids: InternalOrder[] = [];   // Buy orders, sorted high -> low
    private asks: InternalOrder[] = [];   // Sell orders, sorted low -> high
    private lastPrice: number;

    constructor(initialPrice: number) {
        this.lastPrice = initialPrice;
    }

    getLastPrice(): number {
        return this.lastPrice;
    }

    getBestBid(): number {
        return this.bids.length > 0 ? this.bids[0].price : 0;
    }

    getBestAsk(): number {
        return this.asks.length > 0 ? this.asks[0].price : Infinity;
    }

    getSpread(): number {
        const bestBid = this.getBestBid();
        const bestAsk = this.getBestAsk();
        if (bestBid === 0 || bestAsk === Infinity) return 0;
        return bestAsk - bestBid;
    }

    getSpreadPercent(): number {
        const spread = this.getSpread();
        if (spread === 0) return 0;
        return (spread / this.lastPrice) * 100;
    }

    getBidDepth(): number {
        return this.bids.reduce((sum, o) => sum + o.remainingAmount, 0);
    }

    getAskDepth(): number {
        return this.asks.reduce((sum, o) => sum + o.remainingAmount, 0);
    }

    getOpenOrderCount(): number {
        return this.bids.length + this.asks.length;
    }

    /**
     * Cancel all orders for a specific agent (used by MM agents each round)
     */
    cancelAgentOrders(agentId: string): string[] {
        const cancelledIds: string[] = [];

        const bidsBefore = this.bids.length;
        this.bids = this.bids.filter(o => {
            if (o.agentId === agentId) {
                cancelledIds.push(o.id);
                return false;
            }
            return true;
        });

        const asksBefore = this.asks.length;
        this.asks = this.asks.filter(o => {
            if (o.agentId === agentId) {
                cancelledIds.push(o.id);
                return false;
            }
            return true;
        });

        return cancelledIds;
    }

    /**
     * Remove expired orders
     */
    removeExpiredOrders(nowMs: number): string[] {
        const expiryThreshold = nowMs - TRADING_LIMITS.orderExpiryMs;
        const expired: string[] = [];

        this.bids = this.bids.filter(o => {
            if (o.timestamp < expiryThreshold && !o.isMMOrder) {
                expired.push(o.id);
                return false;
            }
            return true;
        });

        this.asks = this.asks.filter(o => {
            if (o.timestamp < expiryThreshold && !o.isMMOrder) {
                expired.push(o.id);
                return false;
            }
            return true;
        });

        return expired;
    }

    /**
     * Add a limit order to the book (Maker - pending until matched)
     * Returns: order ID if added to book, null if would cross (should be treated as taker)
     */
    addLimitOrder(order: InternalOrder): 'added' | 'crosses' {
        if (order.side === 'buy') {
            // Buy limit: if price >= best ask, it crosses -> taker
            if (this.asks.length > 0 && order.price >= this.asks[0].price) {
                return 'crosses';
            }
            // Insert sorted (high -> low)
            const idx = this.bids.findIndex(o => o.price < order.price);
            if (idx === -1) {
                this.bids.push(order);
            } else {
                this.bids.splice(idx, 0, order);
            }
            return 'added';
        } else {
            // Sell limit: if price <= best bid, it crosses -> taker
            if (this.bids.length > 0 && order.price <= this.bids[0].price) {
                return 'crosses';
            }
            // Insert sorted (low -> high)
            const idx = this.asks.findIndex(o => o.price > order.price);
            if (idx === -1) {
                this.asks.push(order);
            } else {
                this.asks.splice(idx, 0, order);
            }
            return 'added';
        }
    }

    /**
     * Execute a taker order against the book.
     * Returns list of fills (trades).
     */
    executeMarketOrder(
        takerOrderId: string,
        takerAgentId: string,
        takerUid: string,
        side: OrderSide,
        amount: number,
        limitPrice?: number  // for limit orders that cross
    ): MatchResult[] {
        const fills: MatchResult[] = [];
        let remaining = amount;

        // Buy taker -> match against asks (lowest first)
        // Sell taker -> match against bids (highest first)
        const bookSide = side === 'buy' ? this.asks : this.bids;

        while (remaining > 0 && bookSide.length > 0) {
            const topOrder = bookSide[0];

            // For limit orders crossing: check price boundary
            if (limitPrice !== undefined) {
                if (side === 'buy' && topOrder.price > limitPrice) break;
                if (side === 'sell' && topOrder.price < limitPrice) break;
            }

            // Same owner wash trading check
            if (topOrder.ownerUid === takerUid && !topOrder.isMMOrder) {
                bookSide.shift();
                continue;
            }

            const fillAmount = Math.min(remaining, topOrder.remainingAmount);
            const fillPrice = topOrder.price; // Always maker's price

            // Calculate fees
            const fillTotal = fillAmount * fillPrice;
            const isMakerMM = topOrder.isMMOrder;
            const makerFeeRate = isMakerMM ? FEE_RATES.mmMakerFeeRate : FEE_RATES.makerFeeRate;
            const takerFeeRate = isMakerMM ? FEE_RATES.takerFeeRate : FEE_RATES.takerFeeRate;

            fills.push({
                makerOrderId: topOrder.id,
                makerAgentId: topOrder.agentId,
                makerUid: topOrder.ownerUid,
                takerOrderId,
                takerAgentId,
                takerUid,
                takerSide: side,
                price: fillPrice,
                amount: fillAmount,
                total: fillTotal,
                makerFee: fillTotal * makerFeeRate,
                takerFee: fillTotal * takerFeeRate,
                makerFeeRate,
                takerFeeRate,
            });

            topOrder.remainingAmount -= fillAmount;
            remaining -= fillAmount;

            if (topOrder.remainingAmount <= 0) {
                bookSide.shift();
            }
        }

        // Update last price if any fills occurred
        if (fills.length > 0) {
            this.lastPrice = fills[fills.length - 1].price;
        }

        return fills;
    }

    /**
     * Get a snapshot of the order book for UI rendering
     */
    getSnapshot(levels: number = 15): OrderBookSnapshot {
        const aggregateLevels = (orders: InternalOrder[], maxLevels: number): OrderBookLevel[] => {
            const levelMap = new Map<number, OrderBookLevel>();

            for (const order of orders) {
                const roundedPrice = Math.round(order.price * 10000) / 10000;
                const existing = levelMap.get(roundedPrice);
                if (existing) {
                    existing.amount += order.remainingAmount;
                    existing.orderCount++;
                    existing.orders.push({
                        orderId: order.id,
                        agentId: order.agentId,
                        amount: order.remainingAmount,
                        isMMOrder: order.isMMOrder,
                    });
                } else {
                    levelMap.set(roundedPrice, {
                        price: roundedPrice,
                        amount: order.remainingAmount,
                        total: 0,
                        orderCount: 1,
                        orders: [{
                            orderId: order.id,
                            agentId: order.agentId,
                            amount: order.remainingAmount,
                            isMMOrder: order.isMMOrder,
                        }],
                    });
                }
            }

            const sorted = Array.from(levelMap.values()).slice(0, maxLevels);

            // Calculate cumulative totals
            let cumulative = 0;
            for (const level of sorted) {
                cumulative += level.amount;
                level.total = cumulative;
            }

            return sorted;
        };

        return {
            pair: TRADING_PAIR,
            bids: aggregateLevels(this.bids, levels),
            asks: aggregateLevels(this.asks, levels),
            lastPrice: this.lastPrice,
            spread: this.getSpread(),
            spreadPercent: this.getSpreadPercent(),
            timestamp: Date.now(),
        };
    }

    /**
     * Get orders for a specific agent (for "my open orders")
     */
    getAgentOrders(agentId: string): Array<{ side: OrderSide; price: number; amount: number; remainingAmount: number }> {
        const result: Array<{ side: OrderSide; price: number; amount: number; remainingAmount: number }> = [];

        for (const o of this.bids) {
            if (o.agentId === agentId) {
                result.push({ side: 'buy', price: o.price, amount: o.remainingAmount, remainingAmount: o.remainingAmount });
            }
        }
        for (const o of this.asks) {
            if (o.agentId === agentId) {
                result.push({ side: 'sell', price: o.price, amount: o.remainingAmount, remainingAmount: o.remainingAmount });
            }
        }

        return result;
    }

    /**
     * Load orders from Firestore on startup
     */
    loadOrders(orders: Array<{ id: string; agentId: string; ownerUid: string; side: OrderSide; price: number; remainingAmount: number; isMMOrder: boolean; createdAt: number }>) {
        for (const o of orders) {
            const internal: InternalOrder = {
                id: o.id,
                agentId: o.agentId,
                ownerUid: o.ownerUid,
                side: o.side,
                price: o.price,
                remainingAmount: o.remainingAmount,
                isMMOrder: o.isMMOrder,
                timestamp: o.createdAt,
            };

            if (o.side === 'buy') {
                const idx = this.bids.findIndex(b => b.price < o.price);
                if (idx === -1) this.bids.push(internal);
                else this.bids.splice(idx, 0, internal);
            } else {
                const idx = this.asks.findIndex(a => a.price > o.price);
                if (idx === -1) this.asks.push(internal);
                else this.asks.splice(idx, 0, internal);
            }
        }
    }
}

// ─── Match Result ──────────────────────────────────────────────────────────

export interface MatchResult {
    makerOrderId: string;
    makerAgentId: string;
    makerUid: string;
    takerOrderId: string;
    takerAgentId: string;
    takerUid: string;
    takerSide: OrderSide;
    price: number;
    amount: number;
    total: number;
    makerFee: number;
    takerFee: number;
    makerFeeRate: number;
    takerFeeRate: number;
}
