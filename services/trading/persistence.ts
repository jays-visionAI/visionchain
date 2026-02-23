/**
 * VisionDEX Trading Arena - Firestore Persistence Layer
 * 
 * Handles reading/writing trading data to/from Firestore.
 * Used by both:
 *   - Cloud Functions (server-side, firebase-admin)
 *   - Frontend (client-side, firebase/firestore)
 *
 * This module provides abstract functions that work with both SDKs.
 */

import {
    TradingAgent, DexOrder, DexTrade, MarketState, OHLCVCandle,
    CandleInterval, TRADING_PAIR, INITIAL_BALANCES, AgentRole,
    AgentPerformance, LeaderboardEntry, RoundResult,
} from './types';

// ─── Firestore Collection Paths ────────────────────────────────────────────

export const COLLECTIONS = {
    agents: 'dex/agents/list',
    orders: 'dex/orders/list',
    trades: 'dex/trades/list',
    market: 'dex/market',
    candles: (interval: CandleInterval) => `dex/candles/${interval}`,
    leaderboard: 'dex/leaderboard/list',
    rounds: 'dex/rounds/log',
    settings: 'dex/settings',
} as const;

export const MARKET_DOC_ID = 'VCN-USDT';
export const SETTINGS_DOC_ID = 'config';

// ─── Agent Serialization ───────────────────────────────────────────────────

/**
 * Convert TradingAgent to Firestore-safe plain object
 */
export function agentToFirestore(agent: TradingAgent): Record<string, any> {
    return {
        id: agent.id,
        ownerUid: agent.ownerUid,
        name: agent.name,
        role: agent.role,
        strategy: {
            preset: agent.strategy.preset,
            prompt: agent.strategy.prompt,
            riskLevel: agent.strategy.riskLevel,
            tradingFrequency: agent.strategy.tradingFrequency,
            maxPositionPercent: agent.strategy.maxPositionPercent,
        },
        ...(agent.mmConfig ? { mmConfig: agent.mmConfig } : {}),
        balances: { USDT: agent.balances.USDT, VCN: agent.balances.VCN },
        performance: { ...agent.performance },
        recentTrades: agent.recentTrades.slice(0, 10),
        status: agent.status,
        lastTradeAt: agent.lastTradeAt,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
    };
}

/**
 * Convert Firestore document to TradingAgent
 */
export function agentFromFirestore(data: Record<string, any>): TradingAgent {
    return {
        id: data.id,
        ownerUid: data.ownerUid,
        name: data.name,
        role: data.role || 'trader',
        strategy: {
            preset: data.strategy?.preset || 'custom',
            prompt: data.strategy?.prompt || '',
            riskLevel: data.strategy?.riskLevel || 5,
            tradingFrequency: data.strategy?.tradingFrequency || 'medium',
            maxPositionPercent: data.strategy?.maxPositionPercent || 30,
        },
        mmConfig: data.mmConfig || undefined,
        balances: {
            USDT: data.balances?.USDT || 0,
            VCN: data.balances?.VCN || 0,
        },
        performance: {
            initialValueUSDT: data.performance?.initialValueUSDT || 0,
            currentValueUSDT: data.performance?.currentValueUSDT || 0,
            totalPnL: data.performance?.totalPnL || 0,
            totalPnLPercent: data.performance?.totalPnLPercent || 0,
            winCount: data.performance?.winCount || 0,
            lossCount: data.performance?.lossCount || 0,
            totalTrades: data.performance?.totalTrades || 0,
            bestTrade: data.performance?.bestTrade || 0,
            worstTrade: data.performance?.worstTrade || 0,
            maxDrawdown: data.performance?.maxDrawdown || 0,
        },
        recentTrades: data.recentTrades || [],
        status: data.status || 'active',
        lastTradeAt: data.lastTradeAt || null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

// ─── Trade Serialization ───────────────────────────────────────────────────

export function tradeToFirestore(trade: DexTrade): Record<string, any> {
    return {
        id: trade.id,
        pair: trade.pair,
        price: trade.price,
        amount: trade.amount,
        total: trade.total,
        takerSide: trade.takerSide,
        makerAgentId: trade.makerAgentId,
        makerUid: trade.makerUid,
        makerOrderId: trade.makerOrderId,
        makerFee: trade.makerFee,
        takerAgentId: trade.takerAgentId,
        takerUid: trade.takerUid,
        takerOrderId: trade.takerOrderId,
        takerFee: trade.takerFee,
        timestamp: trade.timestamp,
    };
}

// ─── Initial Performance ───────────────────────────────────────────────────

export function createInitialPerformance(role: AgentRole, initialPrice: number): AgentPerformance {
    const balances = INITIAL_BALANCES[role];
    const initialValue = balances.USDT + (balances.VCN * initialPrice);

    return {
        initialValueUSDT: initialValue,
        currentValueUSDT: initialValue,
        totalPnL: 0,
        totalPnLPercent: 0,
        winCount: 0,
        lossCount: 0,
        totalTrades: 0,
        bestTrade: 0,
        worstTrade: 0,
        maxDrawdown: 0,
    };
}

// ─── Candle Serialization ──────────────────────────────────────────────────

export function candleToFirestore(candle: OHLCVCandle): Record<string, any> {
    return {
        t: candle.t,
        o: candle.o,
        h: candle.h,
        l: candle.l,
        c: candle.c,
        v: candle.v,
        qv: candle.qv,
        n: candle.n,
    };
}

// ─── Round Result Serialization ────────────────────────────────────────────

export function roundResultToFirestore(result: RoundResult): Record<string, any> {
    return {
        roundNumber: result.roundNumber,
        timestamp: result.timestamp,
        durationMs: result.durationMs,
        mmOrdersPlaced: result.mmOrdersPlaced,
        agentsQueried: result.agentsQueried,
        agentsSkipped: result.agentsSkipped,
        decisions: result.decisions,
        tradesExecuted: result.tradesExecuted,
        totalVolume: result.totalVolume,
        priceOpen: result.priceOpen,
        priceClose: result.priceClose,
        priceChange: result.priceChange,
        priceChangePercent: result.priceChangePercent,
        errors: result.errors.slice(0, 10),
    };
}
