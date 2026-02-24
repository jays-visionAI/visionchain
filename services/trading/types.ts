/**
 * VisionDEX Trading Arena - Type Definitions
 * 
 * All interfaces for the trading engine, agents, orders, trades, and market data.
 */

import { Timestamp } from 'firebase/firestore';

// ─── Agent Types ───────────────────────────────────────────────────────────

export type AgentRole = 'trader' | 'market_maker';
export type AgentStatus = 'active' | 'paused' | 'stopped';
export type TradingFrequency = 'high' | 'medium' | 'low';

export type StrategyPreset =
    | 'momentum' | 'value' | 'scalper' | 'contrarian' | 'grid'
    | 'breakout' | 'twap' | 'sentiment' | 'random' | 'dca'
    | 'trading_bull' | 'trading_bear' | 'custom';

export interface TradingConfig {
    basePrice: number;
    spreadPercent: number;
    priceRangePercent: number;
    trendBias: number;           // -1.0 ~ +1.0
    trendSpeed: number;          // 0.01 ~ 0.1
    layerCount: number;
    layerSpacing: number;        // %
    inventoryTarget: number;     // 0.0 ~ 1.0
}

export interface AgentStrategy {
    preset: StrategyPreset;
    prompt: string;
    riskLevel: number;           // 1-10
    tradingFrequency: TradingFrequency;
    maxPositionPercent: number;  // 0-100
}

export interface AgentBalances {
    USDT: number;
    VCN: number;
}

export interface AgentPerformance {
    initialValueUSDT: number;
    currentValueUSDT: number;
    totalPnL: number;
    totalPnLPercent: number;
    winCount: number;
    lossCount: number;
    totalTrades: number;
    bestTrade: number;
    worstTrade: number;
    maxDrawdown: number;
}

export interface RecentTradeEntry {
    timestamp: number;
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    reasoning: string;
}

export interface TradingAgent {
    id: string;
    ownerUid: string;
    name: string;
    role: AgentRole;
    strategy: AgentStrategy;
    tradingConfig?: TradingConfig;
    balances: AgentBalances;
    performance: AgentPerformance;
    recentTrades: RecentTradeEntry[];
    status: AgentStatus;
    lastTradeAt: Timestamp | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ─── Order Types ───────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderRole = 'maker' | 'taker' | 'pending';
export type OrderStatus = 'open' | 'partial' | 'filled' | 'cancelled' | 'expired';

export interface DexOrder {
    id: string;
    agentId: string;
    ownerUid: string;
    pair: string;
    side: OrderSide;
    type: OrderType;
    role: OrderRole;
    price: number;
    amount: number;
    filledAmount: number;
    remainingAmount: number;
    status: OrderStatus;
    fee: number;
    feeRate: number;
    reasoning: string;
    expiresAt: Timestamp;
    createdAt: Timestamp;
}

// ─── Trade Types ───────────────────────────────────────────────────────────

export interface DexTrade {
    id: string;
    pair: string;
    price: number;
    amount: number;
    total: number;
    takerSide: OrderSide;
    makerAgentId: string;
    makerUid: string;
    makerOrderId: string;
    makerFee: number;
    takerAgentId: string;
    takerUid: string;
    takerOrderId: string;
    takerFee: number;
    timestamp: Timestamp;
}

// ─── Market Types ──────────────────────────────────────────────────────────

export interface MarketState {
    pair: string;
    lastPrice: number;
    previousPrice: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    quoteVolume24h: number;
    trades24h: number;
    bestBid: number;
    bestAsk: number;
    spread: number;
    spreadPercent: number;
    makerVolume24h: number;
    takerVolume24h: number;
    totalFees24h: number;
    openOrders: number;
    activeAgents: number;
    totalAgents: number;
    updatedAt: Timestamp;
}

export interface OHLCVCandle {
    t: number;    // Unix timestamp (interval start)
    o: number;    // Open
    h: number;    // High
    l: number;    // Low
    c: number;    // Close
    v: number;    // Volume (VCN)
    qv: number;   // Quote Volume (USDT)
    n: number;    // Number of trades
}

export type CandleInterval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

// ─── AI Decision Types ─────────────────────────────────────────────────────

export interface AITradeDecision {
    action: 'buy' | 'sell' | 'hold';
    orderType: OrderType;
    amount: number;
    price: number;
    reasoning: string;
}

export interface AIMMDecision {
    orders: Array<{
        side: OrderSide;
        price: number;
        amount: number;
    }>;
}

export interface MarketDataForAgent {
    currentPrice: number;
    change24h: number;
    avgPrice20: number;
    bestBid: number;
    bestAsk: number;
    spread: number;
    bidDepth: number;
    askDepth: number;
    recentTrades: Array<{
        price: number;
        amount: number;
        side: OrderSide;
        timestamp: number;
    }>;
    myOpenOrders: Array<{
        side: OrderSide;
        price: number;
        amount: number;
        remainingAmount: number;
    }>;
    usdtBalance: number;
    vcnBalance: number;
    makerFee: string;
    takerFee: string;
}

// ─── Fee Structure ─────────────────────────────────────────────────────────

export const FEE_RATES = {
    makerFeeRate: 0.0002,     // 0.02%
    takerFeeRate: 0.0005,     // 0.05%
    tradingMakerFeeRate: 0.0000,   // 0% (Trading maker exempt)
    tradingTakerFeeRate: 0.0001,   // 0.01%
} as const;

// ─── Constants ─────────────────────────────────────────────────────────────

export const TRADING_PAIR = 'VCN-USDT';

export const INITIAL_BALANCES = {
    trader: { USDT: 10_000, VCN: 100_000 },
    market_maker: { USDT: 500_000, VCN: 5_000_000 },
} as const;

export const TRADING_LIMITS = {
    maxAgentsPerUser: 3,
    maxOrderPercent: 0.50,          // 50% of balance
    mmMaxOrderPercent: 0.05,        // 5% per layer
    orderExpiryMs: 60 * 60 * 1000,  // 1 hour
    maxPromptLength: 2000,
    roundIntervalMs: 2 * 60 * 1000, // 2 minutes
    maxPriceChangePerRound: 0.03,   // 3%
    maxPriceChangePerDay: 0.15,     // 15%
    minOrderAmount: 100,            // 100 VCN minimum
    minPriceUnit: 0.0001,           // USDT
} as const;

// ─── Order Book Types ──────────────────────────────────────────────────────

export interface OrderBookLevel {
    price: number;
    amount: number;
    total: number;       // cumulative
    orderCount: number;
    orders: Array<{
        orderId: string;
        agentId: string;
        amount: number;
        isTradingOrder: boolean;
    }>;
}

export interface OrderBookSnapshot {
    pair: string;
    bids: OrderBookLevel[];  // sorted high -> low
    asks: OrderBookLevel[];  // sorted low -> high
    lastPrice: number;
    spread: number;
    spreadPercent: number;
    timestamp: number;
}

// ─── Leaderboard Types ─────────────────────────────────────────────────────

export interface LeaderboardEntry {
    agentId: string;
    agentName: string;
    ownerUid: string;
    role: AgentRole;
    strategyPreset: StrategyPreset;
    pnlPercent: number;
    pnlAbsolute: number;
    winRate: number;
    totalTrades: number;
    rank: number;
}

// ─── Engine Types ──────────────────────────────────────────────────────────

export interface RoundResult {
    roundNumber: number;
    timestamp: number;
    durationMs: number;
    mmOrdersPlaced: number;
    agentsQueried: number;
    agentsSkipped: number;
    decisions: { buy: number; sell: number; hold: number };
    tradesExecuted: number;
    totalVolume: number;
    priceOpen: number;
    priceClose: number;
    priceChange: number;
    priceChangePercent: number;
    errors: string[];
}
