/**
 * VisionDEX Trading Arena - Main Trading Engine
 *
 * Orchestrates each trading round:
 * 1. Trading agents place layered orders (Maker)
 * 2. Regular agents get AI decisions
 * 3. Orders matched via order book
 * 4. Balances updated, candles generated
 * 5. Price feed updated (-> vcnPriceService)
 */

import {
    TradingAgent, DexOrder, DexTrade, MarketState,
    AITradeDecision, AIMMDecision, MarketDataForAgent,
    FEE_RATES, TRADING_PAIR, TRADING_LIMITS, INITIAL_BALANCES,
    OrderSide, RoundResult,
} from './types';
import { OrderBook, MatchResult } from './orderbook';
import { CandleManager, ALL_INTERVALS } from './candles';
import { getAgentDecision, generateTradingOrders } from './aiDecision';
import { Timestamp } from 'firebase/firestore';

// ─── Trading Engine ────────────────────────────────────────────────────────

export class TradingEngine {
    private orderBook: OrderBook;
    private candleManager: CandleManager;
    private roundNumber: number = 0;
    private agents: Map<string, TradingAgent> = new Map();
    private recentTrades: Array<{ price: number; amount: number; side: OrderSide; timestamp: number }> = [];

    constructor(initialPrice: number) {
        this.orderBook = new OrderBook(initialPrice);
        this.candleManager = new CandleManager();
    }

    getOrderBook(): OrderBook {
        return this.orderBook;
    }

    getCandleManager(): CandleManager {
        return this.candleManager;
    }

    getCurrentPrice(): number {
        return this.orderBook.getLastPrice();
    }

    getRoundNumber(): number {
        return this.roundNumber;
    }

    /**
     * Register an agent with the engine
     */
    registerAgent(agent: TradingAgent) {
        this.agents.set(agent.id, agent);
    }

    /**
     * Remove an agent
     */
    removeAgent(agentId: string) {
        this.agents.delete(agentId);
        this.orderBook.cancelAgentOrders(agentId);
    }

    /**
     * Get all registered agents
     */
    getAgents(): TradingAgent[] {
        return Array.from(this.agents.values());
    }

    /**
     * Get a specific agent
     */
    getAgent(agentId: string): TradingAgent | undefined {
        return this.agents.get(agentId);
    }

    /**
     * Build market data snapshot for AI agents
     */
    private buildMarketData(agent: TradingAgent): MarketDataForAgent {
        const currentPrice = this.orderBook.getLastPrice();
        const avgPrice20 = this.candleManager.getAvgPrice(20) || currentPrice;

        // Calculate 24h change from candles
        const dailyCandles = this.candleManager.getCandles('1h', 24);
        let change24h = 0;
        if (dailyCandles.length > 0) {
            const oldPrice = dailyCandles[0].o;
            if (oldPrice > 0) {
                change24h = ((currentPrice - oldPrice) / oldPrice) * 100;
            }
        }

        return {
            currentPrice,
            change24h,
            avgPrice20,
            bestBid: this.orderBook.getBestBid(),
            bestAsk: this.orderBook.getBestAsk() === Infinity ? currentPrice * 1.005 : this.orderBook.getBestAsk(),
            spread: this.orderBook.getSpreadPercent(),
            bidDepth: this.orderBook.getBidDepth(),
            askDepth: this.orderBook.getAskDepth(),
            recentTrades: this.recentTrades.slice(-20),
            myOpenOrders: this.orderBook.getAgentOrders(agent.id),
            usdtBalance: agent.balances.USDT,
            vcnBalance: agent.balances.VCN,
            makerFee: '0.02%',
            takerFee: '0.05%',
        };
    }

    /**
     * Execute one full trading round.
     * This is the main function called by Cloud Scheduler every 2 minutes.
     */
    async executeRound(apiKey: string): Promise<RoundResult> {
        const startTime = Date.now();
        this.roundNumber++;

        const result: RoundResult = {
            roundNumber: this.roundNumber,
            timestamp: startTime,
            durationMs: 0,
            mmOrdersPlaced: 0,
            agentsQueried: 0,
            agentsSkipped: 0,
            decisions: { buy: 0, sell: 0, hold: 0 },
            tradesExecuted: 0,
            totalVolume: 0,
            priceOpen: this.orderBook.getLastPrice(),
            priceClose: 0,
            priceChange: 0,
            priceChangePercent: 0,
            errors: [],
        };

        const allTrades: MatchResult[] = [];

        try {
            // Step 0: Clean expired orders
            this.orderBook.removeExpiredOrders(startTime);

            // Step 1: Trading agents place layered orders (Maker)
            const tradingAgents = Array.from(this.agents.values()).filter(a => a.role === 'market_maker' && a.status === 'active');
            for (const mmAgent of tradingAgents) {
                try {
                    // Cancel previous Trading orders
                    this.orderBook.cancelAgentOrders(mmAgent.id);

                    // Generate new orders deterministically
                    const mmDecision = generateTradingOrders(mmAgent, this.orderBook.getLastPrice());

                    // Place each order as a maker
                    for (const order of mmDecision.orders) {
                        if (order.amount < TRADING_LIMITS.minOrderAmount) continue;

                        const orderId = `trading-${mmAgent.id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
                        this.orderBook.addLimitOrder({
                            id: orderId,
                            agentId: mmAgent.id,
                            ownerUid: mmAgent.ownerUid,
                            side: order.side,
                            price: order.price,
                            remainingAmount: order.amount,
                            isTradingOrder: true,
                            timestamp: startTime,
                        });
                        result.mmOrdersPlaced++;
                    }
                } catch (e: any) {
                    result.errors.push(`Trading ${mmAgent.name}: ${e.message}`);
                }
            }

            // Step 2: Regular agents AI decisions (parallel, batched)
            const regularAgents = Array.from(this.agents.values()).filter(a =>
                a.role === 'trader' && a.status === 'active'
            );

            // Skip agents based on trading frequency
            const activeAgents = regularAgents.filter(agent => {
                if (agent.strategy.tradingFrequency === 'low' && this.roundNumber % 3 !== 0) {
                    result.agentsSkipped++;
                    return false;
                }
                if (agent.strategy.tradingFrequency === 'medium' && this.roundNumber % 2 !== 0) {
                    result.agentsSkipped++;
                    return false;
                }
                return true;
            });

            // Get AI decisions in parallel (batch of 10)
            const batchSize = 10;
            const decisions: Array<{ agent: TradingAgent; decision: AITradeDecision }> = [];

            for (let i = 0; i < activeAgents.length; i += batchSize) {
                const batch = activeAgents.slice(i, i + batchSize);
                const batchPromises = batch.map(async (agent) => {
                    try {
                        const marketData = this.buildMarketData(agent);
                        const decision = await getAgentDecision(agent, marketData, apiKey);
                        return { agent, decision };
                    } catch (e: any) {
                        result.errors.push(`Agent ${agent.name}: ${e.message}`);
                        return { agent, decision: { action: 'hold' as const, orderType: 'limit' as const, amount: 0, price: 0, reasoning: 'Error' } };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                decisions.push(...batchResults);
                result.agentsQueried += batch.length;
            }

            // Step 3: Process decisions -> place orders or execute
            for (const { agent, decision } of decisions) {
                result.decisions[decision.action]++;

                if (decision.action === 'hold') continue;

                const orderId = `ord-${agent.id}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

                if (decision.orderType === 'market') {
                    // Taker: execute immediately against the book
                    const fills = this.orderBook.executeMarketOrder(
                        orderId, agent.id, agent.ownerUid,
                        decision.action as OrderSide, decision.amount
                    );
                    allTrades.push(...fills);
                } else {
                    // Limit order: try to add to book
                    const addResult = this.orderBook.addLimitOrder({
                        id: orderId,
                        agentId: agent.id,
                        ownerUid: agent.ownerUid,
                        side: decision.action as OrderSide,
                        price: decision.price,
                        remainingAmount: decision.amount,
                        isTradingOrder: false,
                        timestamp: startTime,
                    });

                    if (addResult === 'crosses') {
                        // Limit order crosses -> becomes taker
                        const fills = this.orderBook.executeMarketOrder(
                            orderId, agent.id, agent.ownerUid,
                            decision.action as OrderSide, decision.amount,
                            decision.price // limit price
                        );
                        allTrades.push(...fills);
                    }
                    // If 'added', it stays in the book as a maker (pending)
                }

                // Store reasoning in agent's recent trades
                if (decision.action !== 'hold') {
                    this.updateAgentRecentTrade(agent, decision);
                }
            }

            // Step 4: Process all fills -> update balances
            for (const fill of allTrades) {
                this.processTradeResult(fill);
                result.tradesExecuted++;
                result.totalVolume += fill.total;
            }

            // Step 5: Update candles
            const tradeTimestamps = allTrades.map(t => ({
                price: t.price,
                amount: t.amount,
                total: t.total,
                timestamp: startTime,
            }));
            this.candleManager.processTrades(tradeTimestamps);
            this.candleManager.fillGaps(this.orderBook.getLastPrice(), startTime);

            // Store recent trades for market data
            for (const fill of allTrades) {
                this.recentTrades.push({
                    price: fill.price,
                    amount: fill.amount,
                    side: fill.takerSide,
                    timestamp: startTime,
                });
            }
            // Keep only last 100 trades
            if (this.recentTrades.length > 100) {
                this.recentTrades = this.recentTrades.slice(-100);
            }

        } catch (e: any) {
            result.errors.push(`Engine error: ${e.message}`);
        }

        // Finalize result
        result.priceClose = this.orderBook.getLastPrice();
        result.priceChange = result.priceClose - result.priceOpen;
        result.priceChangePercent = result.priceOpen > 0
            ? ((result.priceClose - result.priceOpen) / result.priceOpen) * 100
            : 0;
        result.durationMs = Date.now() - startTime;

        console.log(
            `[TradingEngine] Round #${result.roundNumber}: ` +
            `${result.tradesExecuted} trades, ` +
            `$${result.totalVolume.toFixed(2)} volume, ` +
            `${result.priceOpen.toFixed(4)} -> ${result.priceClose.toFixed(4)} ` +
            `(${result.priceChangePercent >= 0 ? '+' : ''}${result.priceChangePercent.toFixed(2)}%) ` +
            `[${result.durationMs}ms]`
        );

        return result;
    }

    /**
     * Process a single fill: update buyer and seller balances
     */
    private processTradeResult(fill: MatchResult) {
        const maker = this.agents.get(fill.makerAgentId);
        const taker = this.agents.get(fill.takerAgentId);

        if (fill.takerSide === 'buy') {
            // Taker buys: taker pays USDT, receives VCN
            //              maker sells: maker pays VCN, receives USDT
            if (taker) {
                taker.balances.USDT -= (fill.total + fill.takerFee);
                taker.balances.VCN += fill.amount;
            }
            if (maker) {
                maker.balances.VCN -= fill.amount;
                maker.balances.USDT += (fill.total - fill.makerFee);
            }
        } else {
            // Taker sells: taker pays VCN, receives USDT
            //              maker buys: maker pays USDT, receives VCN
            if (taker) {
                taker.balances.VCN -= fill.amount;
                taker.balances.USDT += (fill.total - fill.takerFee);
            }
            if (maker) {
                maker.balances.USDT -= (fill.total + fill.makerFee);
                maker.balances.VCN += fill.amount;
            }
        }

        // Update performance stats
        const currentPrice = this.orderBook.getLastPrice();
        for (const agent of [maker, taker]) {
            if (!agent) continue;
            agent.performance.totalTrades++;
            const totalValue = agent.balances.USDT + (agent.balances.VCN * currentPrice);
            agent.performance.currentValueUSDT = totalValue;
            agent.performance.totalPnL = totalValue - agent.performance.initialValueUSDT;
            agent.performance.totalPnLPercent = agent.performance.initialValueUSDT > 0
                ? (agent.performance.totalPnL / agent.performance.initialValueUSDT) * 100
                : 0;
            agent.lastTradeAt = Timestamp.now();
            agent.updatedAt = Timestamp.now();
        }
    }

    /**
     * Store recent trade info on the agent
     */
    private updateAgentRecentTrade(agent: TradingAgent, decision: AITradeDecision) {
        const entry = {
            timestamp: Date.now(),
            side: decision.action as 'buy' | 'sell',
            amount: decision.amount,
            price: decision.price || this.orderBook.getLastPrice(),
            reasoning: decision.reasoning,
        };

        agent.recentTrades = [entry, ...agent.recentTrades].slice(0, 10);
    }

    /**
     * Build current market state for Firestore
     */
    buildMarketState(): MarketState {
        const currentPrice = this.orderBook.getLastPrice();
        const dailyCandles = this.candleManager.getCandles('1h', 24);

        let high24h = currentPrice;
        let low24h = currentPrice;
        let volume24h = 0;
        let quoteVolume24h = 0;
        let trades24h = 0;

        for (const candle of dailyCandles) {
            high24h = Math.max(high24h, candle.h);
            low24h = Math.min(low24h, candle.l);
            volume24h += candle.v;
            quoteVolume24h += candle.qv;
            trades24h += candle.n;
        }

        const previousPrice = dailyCandles.length > 0 ? dailyCandles[0].o : currentPrice;
        const change24h = currentPrice - previousPrice;
        const changePercent24h = previousPrice > 0 ? (change24h / previousPrice) * 100 : 0;

        const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'active').length;
        const totalAgents = this.agents.size;

        return {
            pair: TRADING_PAIR,
            lastPrice: currentPrice,
            previousPrice,
            change24h,
            changePercent24h,
            high24h,
            low24h,
            volume24h,
            quoteVolume24h,
            trades24h,
            bestBid: this.orderBook.getBestBid(),
            bestAsk: this.orderBook.getBestAsk() === Infinity ? 0 : this.orderBook.getBestAsk(),
            spread: this.orderBook.getSpread(),
            spreadPercent: this.orderBook.getSpreadPercent(),
            makerVolume24h: 0, // TODO: track separately
            takerVolume24h: 0,
            totalFees24h: 0,
            openOrders: this.orderBook.getOpenOrderCount(),
            activeAgents,
            totalAgents,
            updatedAt: Timestamp.now(),
        };
    }

    /**
     * Build leaderboard sorted by PnL%
     */
    buildLeaderboard() {
        const agents = Array.from(this.agents.values())
            .filter(a => a.role === 'trader')
            .sort((a, b) => b.performance.totalPnLPercent - a.performance.totalPnLPercent);

        return agents.map((agent, idx) => ({
            agentId: agent.id,
            agentName: agent.name,
            ownerUid: agent.ownerUid,
            role: agent.role,
            strategyPreset: agent.strategy.preset,
            pnlPercent: agent.performance.totalPnLPercent,
            pnlAbsolute: agent.performance.totalPnL,
            winRate: agent.performance.totalTrades > 0
                ? (agent.performance.winCount / agent.performance.totalTrades) * 100
                : 0,
            totalTrades: agent.performance.totalTrades,
            rank: idx + 1,
        }));
    }
}
