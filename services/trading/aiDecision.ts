/**
 * VisionDEX Trading Arena - AI Decision Module (Hybrid)
 *
 * Hybrid approach:
 * - Preset strategies (10 types): Deterministic algorithms (no LLM, no cost, instant)
 * - Custom prompt agents: DeepSeek LLM (user writes their own strategy prompt)
 * - MM agents: Always deterministic (mathematical order placement)
 */

import {
    TradingAgent, AITradeDecision, AIMMDecision,
    MarketDataForAgent, MMConfig, TRADING_LIMITS,
} from './types';
import { buildAgentPrompt, getStrategyPrompt, COMMON_PROMPT_SUFFIX } from './strategies';

// ─── Deterministic Strategy Algorithms ─────────────────────────────────────

/**
 * Execute a preset strategy deterministically (no LLM needed).
 * Fast, free, predictable.
 */
export function executePresetStrategy(
    agent: TradingAgent,
    marketData: MarketDataForAgent
): AITradeDecision {
    const preset = agent.strategy.preset;
    const { currentPrice, avgPrice20, bestBid, bestAsk, change24h,
        usdtBalance, vcnBalance, spread, bidDepth, askDepth } = marketData;

    switch (preset) {
        case 'momentum':
            return strategyMomentum(agent, marketData);
        case 'value':
            return strategyValue(agent, marketData);
        case 'scalper':
            return strategyScalper(agent, marketData);
        case 'contrarian':
            return strategyContrarian(agent, marketData);
        case 'grid':
            return strategyGrid(agent, marketData);
        case 'breakout':
            return strategyBreakout(agent, marketData);
        case 'twap':
            return strategyTWAP(agent, marketData);
        case 'sentiment':
            return strategySentiment(agent, marketData);
        case 'random':
            return strategyRandom(agent, marketData);
        case 'dca':
            return strategyDCA(agent, marketData);
        default:
            return { action: 'hold', orderType: 'limit', amount: 0, price: 0, reasoning: 'Unknown preset' };
    }
}

// ── Individual Strategy Implementations ────────────────────────────────────

function strategyMomentum(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const priceDiff = ((md.currentPrice - md.avgPrice20) / md.avgPrice20) * 100;
    const maxPct = agent.strategy.maxPositionPercent / 100;

    if (priceDiff > 3) {
        // Strong uptrend -> market buy
        const amount = Math.round((md.usdtBalance * maxPct * 0.6) / md.bestAsk);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Uptrend but insufficient balance');
        return { action: 'buy', orderType: 'market', amount, price: 0, reasoning: `Uptrend +${priceDiff.toFixed(1)}%, market buy` };
    } else if (priceDiff < -3) {
        // Strong downtrend -> market sell
        const amount = Math.round(md.vcnBalance * maxPct * 0.6);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Downtrend but no VCN');
        return { action: 'sell', orderType: 'market', amount, price: 0, reasoning: `Downtrend ${priceDiff.toFixed(1)}%, market sell` };
    } else if (priceDiff > 1) {
        // Weak uptrend -> limit buy at mid price
        const amount = Math.round((md.usdtBalance * maxPct * 0.3) / md.currentPrice);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Weak trend, small balance');
        const price = round4((md.bestBid + md.currentPrice) / 2);
        return { action: 'buy', orderType: 'limit', amount, price, reasoning: `Mild uptrend +${priceDiff.toFixed(1)}%, limit buy` };
    }
    return hold(`Trend unclear (${priceDiff.toFixed(1)}%)`);
}

function strategyValue(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const dropFromAvg = ((md.avgPrice20 - md.currentPrice) / md.avgPrice20) * 100;
    const maxPct = agent.strategy.maxPositionPercent / 100;

    if (dropFromAvg > 15) {
        // Deeply undervalued -> limit buy below current
        const amount = Math.round((md.usdtBalance * maxPct * 0.5) / md.currentPrice);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Undervalued but no USDT');
        const price = round4(md.currentPrice * 0.995);
        return { action: 'buy', orderType: 'limit', amount, price, reasoning: `${dropFromAvg.toFixed(1)}% below avg, value buy` };
    } else if (dropFromAvg < -50) {
        // 50%+ profit -> sell some
        const amount = Math.round(md.vcnBalance * maxPct * 0.3);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Profit target but no VCN');
        const price = round4(md.currentPrice * 1.005);
        return { action: 'sell', orderType: 'limit', amount, price, reasoning: `+${Math.abs(dropFromAvg).toFixed(1)}% from avg, taking profit` };
    }
    return hold('Waiting for value opportunity');
}

function strategyScalper(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const maxPct = agent.strategy.maxPositionPercent / 100;
    const spreadPct = md.spread;

    // Scalper likes wide spreads
    if (spreadPct > 0.3) {
        // Place limit buy just above best bid
        if (md.usdtBalance > 100) {
            const amount = Math.round((md.usdtBalance * maxPct) / md.currentPrice);
            if (amount < TRADING_LIMITS.minOrderAmount) return hold('Too small');
            const price = round4(md.bestBid + (md.bestAsk - md.bestBid) * 0.3);
            return { action: 'buy', orderType: 'limit', amount, price, reasoning: `Scalp buy in spread (${spreadPct.toFixed(2)}%)` };
        }
    }

    // If holding VCN, place sell above current
    if (md.vcnBalance > TRADING_LIMITS.minOrderAmount) {
        const amount = Math.round(md.vcnBalance * maxPct);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Small VCN position');
        const price = round4(md.currentPrice * 1.005);
        return { action: 'sell', orderType: 'limit', amount, price, reasoning: 'Scalp sell +0.5% above current' };
    }

    return hold('No scalp opportunity');
}

function strategyContrarian(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const maxPct = agent.strategy.maxPositionPercent / 100;

    if (md.change24h > 5) {
        // Overbought -> sell
        const amount = Math.round(md.vcnBalance * maxPct * 0.5);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Overbought but no VCN');
        const price = round4(md.currentPrice * 1.002);
        return { action: 'sell', orderType: 'limit', amount, price, reasoning: `Overbought (+${md.change24h.toFixed(1)}%), contrarian sell` };
    } else if (md.change24h < -5) {
        // Oversold -> buy
        const amount = Math.round((md.usdtBalance * maxPct * 0.5) / md.currentPrice);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Oversold but no USDT');
        const price = round4(md.currentPrice * 0.998);
        return { action: 'buy', orderType: 'limit', amount, price, reasoning: `Oversold (${md.change24h.toFixed(1)}%), contrarian buy` };
    }
    return hold('Waiting for extreme move');
}

function strategyGrid(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const maxPct = agent.strategy.maxPositionPercent / 100;
    // Grid: alternate buy/sell based on rounding of price to grid level
    const gridStep = md.currentPrice * 0.01; // 1% grid
    const gridLevel = Math.floor(md.currentPrice / gridStep);

    if (gridLevel % 2 === 0) {
        // Even grid level -> buy below
        const amount = Math.round((md.usdtBalance * maxPct) / md.currentPrice);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Grid level even, no USDT');
        const price = round4(md.currentPrice * 0.99);
        return { action: 'buy', orderType: 'limit', amount, price, reasoning: `Grid buy at level ${gridLevel}, -1%` };
    } else {
        // Odd grid level -> sell above
        const amount = Math.round(md.vcnBalance * maxPct);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Grid level odd, no VCN');
        const price = round4(md.currentPrice * 1.01);
        return { action: 'sell', orderType: 'limit', amount, price, reasoning: `Grid sell at level ${gridLevel}, +1%` };
    }
}

function strategyBreakout(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const maxPct = agent.strategy.maxPositionPercent / 100;
    const priceDiff = ((md.currentPrice - md.avgPrice20) / md.avgPrice20) * 100;

    // Breakout needs strong move (>2% above avg = upward breakout)
    if (priceDiff > 2) {
        const amount = Math.round((md.usdtBalance * maxPct * 0.8) / md.bestAsk);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Breakout detected but no USDT');
        return { action: 'buy', orderType: 'market', amount, price: 0, reasoning: `Upward breakout +${priceDiff.toFixed(1)}%, aggressive buy` };
    } else if (priceDiff < -2) {
        const amount = Math.round(md.vcnBalance * maxPct * 0.8);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Breakdown detected but no VCN');
        return { action: 'sell', orderType: 'market', amount, price: 0, reasoning: `Breakdown ${priceDiff.toFixed(1)}%, aggressive sell` };
    }
    return hold('No breakout signal');
}

function strategyTWAP(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const slicePercent = 0.04; // 4% per round
    const amount = Math.round((md.usdtBalance * slicePercent) / md.bestAsk);
    if (amount < TRADING_LIMITS.minOrderAmount) return hold('TWAP: insufficient USDT');

    // TWAP slightly prefers limit when spread is wide
    if (md.spread > 0.5) {
        const price = round4(md.bestBid + (md.bestAsk - md.bestBid) * 0.4);
        return { action: 'buy', orderType: 'limit', amount, price, reasoning: `TWAP slice buy, wide spread ${md.spread.toFixed(2)}%` };
    }
    return { action: 'buy', orderType: 'market', amount, price: 0, reasoning: 'TWAP slice buy, tight spread' };
}

function strategySentiment(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const maxPct = agent.strategy.maxPositionPercent / 100;
    // Simulate sentiment with volume imbalance as proxy
    const volumeRatio = md.bidDepth > 0 ? md.askDepth / md.bidDepth : 1;

    if (volumeRatio < 0.7) {
        // More buying pressure (bid depth >> ask depth) -> bullish
        const amount = Math.round((md.usdtBalance * maxPct * 0.4) / md.currentPrice);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Bullish sentiment but no USDT');
        return { action: 'buy', orderType: 'limit', amount, price: round4(md.currentPrice * 0.998), reasoning: 'Bullish order flow (bid depth > ask)' };
    } else if (volumeRatio > 1.5) {
        // More selling pressure -> bearish
        const amount = Math.round(md.vcnBalance * maxPct * 0.4);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Bearish sentiment but no VCN');
        return { action: 'sell', orderType: 'limit', amount, price: round4(md.currentPrice * 1.002), reasoning: 'Bearish order flow (ask depth > bid)' };
    }
    return hold('Neutral sentiment');
}

function strategyRandom(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const r = Math.random();
    const maxPct = agent.strategy.maxPositionPercent / 100;
    const sizePct = 0.05 + Math.random() * 0.10; // 5-15%

    if (r < 0.33) {
        const amount = Math.round((md.usdtBalance * Math.min(sizePct, maxPct)) / md.currentPrice);
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Random: no USDT');
        const useLimit = Math.random() > 0.5;
        const price = useLimit ? round4(md.currentPrice * (0.99 + Math.random() * 0.02)) : 0;
        return { action: 'buy', orderType: useLimit ? 'limit' : 'market', amount, price, reasoning: 'Random buy' };
    } else if (r < 0.66) {
        const amount = Math.round(md.vcnBalance * Math.min(sizePct, maxPct));
        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Random: no VCN');
        const useLimit = Math.random() > 0.5;
        const price = useLimit ? round4(md.currentPrice * (0.99 + Math.random() * 0.02)) : 0;
        return { action: 'sell', orderType: useLimit ? 'limit' : 'market', amount, price, reasoning: 'Random sell' };
    }
    return hold('Random hold');
}

function strategyDCA(agent: TradingAgent, md: MarketDataForAgent): AITradeDecision {
    const slicePercent = 0.015; // 1.5% per round
    const amount = Math.round((md.usdtBalance * slicePercent) / md.bestAsk);
    if (amount < TRADING_LIMITS.minOrderAmount) return hold('DCA: insufficient USDT');
    return { action: 'buy', orderType: 'market', amount, price: 0, reasoning: 'DCA: systematic buy' };
}

// ── Utility ────────────────────────────────────────────────────────────────

function hold(reasoning: string): AITradeDecision {
    return { action: 'hold', orderType: 'limit', amount: 0, price: 0, reasoning };
}

function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

// ─── DeepSeek LLM Decision (for custom prompt agents only) ─────────────────

/**
 * Ask DeepSeek to make a trade decision for a custom-prompt agent.
 * Only called when agent.strategy.preset === 'custom'.
 */
export async function getCustomAgentDecision(
    agent: TradingAgent,
    marketData: MarketDataForAgent,
    apiKey: string,
): Promise<AITradeDecision> {
    // Dynamic import to avoid bundling axios in frontend
    const axios = (await import('axios')).default;

    const strategyPrompt = agent.strategy.prompt || '';
    if (!strategyPrompt.trim()) {
        return hold('No custom prompt configured');
    }

    const dataMap: Record<string, string | number> = {
        currentPrice: marketData.currentPrice.toFixed(4),
        change24h: marketData.change24h.toFixed(2),
        avgPrice20: marketData.avgPrice20.toFixed(4),
        bestBid: marketData.bestBid.toFixed(4),
        bestAsk: (marketData.bestAsk === Infinity ? marketData.currentPrice * 1.005 : marketData.bestAsk).toFixed(4),
        spread: marketData.spread.toFixed(3),
        bidDepth: Math.round(marketData.bidDepth).toLocaleString(),
        askDepth: Math.round(marketData.askDepth).toLocaleString(),
        usdtBalance: marketData.usdtBalance.toFixed(2),
        vcnBalance: Math.round(marketData.vcnBalance).toLocaleString(),
        makerFee: marketData.makerFee,
        takerFee: marketData.takerFee,
        myOpenOrders: marketData.myOpenOrders.length > 0
            ? JSON.stringify(marketData.myOpenOrders)
            : 'None',
        recentTrades: marketData.recentTrades.slice(0, 10).map(t =>
            `${t.side.toUpperCase()} ${t.amount} @ ${t.price.toFixed(4)}`
        ).join(', ') || 'None',
    };

    const fullPrompt = buildAgentPrompt(strategyPrompt, dataMap);

    try {
        const response = await axios.post(
            'https://api.deepseek.com/chat/completions',
            {
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: 'You are a cryptocurrency trading agent. Respond ONLY with valid JSON.' },
                    { role: 'user', content: fullPrompt },
                ],
                temperature: 0.3 + (agent.strategy.riskLevel * 0.05),
                max_tokens: 256,
            },
            {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 15000,
            },
        );

        const text = response.data?.choices?.[0]?.message?.content || '';
        return parseAIResponse(text, agent, marketData);
    } catch (error: any) {
        console.error(`[DeepSeek] Error for agent ${agent.name}:`, error?.message || error);
        return hold('DeepSeek API error');
    }
}

/**
 * Main entry point: decide whether to use algorithm or LLM
 */
export async function getAgentDecision(
    agent: TradingAgent,
    marketData: MarketDataForAgent,
    deepseekApiKey: string,
): Promise<AITradeDecision> {
    // Custom prompt agents -> DeepSeek LLM
    if (agent.strategy.preset === 'custom' && agent.strategy.prompt?.trim()) {
        return getCustomAgentDecision(agent, marketData, deepseekApiKey);
    }

    // Preset strategies -> deterministic algorithm (no cost, instant)
    return executePresetStrategy(agent, marketData);
}

/**
 * Parse and validate the DeepSeek JSON response
 */
function parseAIResponse(
    text: string,
    agent: TradingAgent,
    marketData: MarketDataForAgent
): AITradeDecision {
    try {
        let jsonStr = text.trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);
        const action = ['buy', 'sell', 'hold'].includes(parsed.action) ? parsed.action : 'hold';
        const orderType = ['limit', 'market'].includes(parsed.orderType) ? parsed.orderType : 'limit';

        if (action === 'hold') return hold(parsed.reasoning || 'Hold');

        let amount = Math.max(0, Number(parsed.amount) || 0);
        const maxPercent = agent.strategy.maxPositionPercent / 100;

        if (action === 'buy') {
            const maxBuy = (marketData.usdtBalance * maxPercent) / (marketData.bestAsk || marketData.currentPrice);
            amount = Math.min(amount, maxBuy);
        } else {
            amount = Math.min(amount, marketData.vcnBalance * maxPercent);
        }

        if (amount < TRADING_LIMITS.minOrderAmount) return hold('Insufficient balance for minimum order');
        amount = Math.round(amount);

        let price = Number(parsed.price) || 0;
        if (orderType === 'limit' && price > 0) {
            price = Math.max(marketData.currentPrice * 0.90, Math.min(marketData.currentPrice * 1.10, price));
            price = round4(price);
        } else if (orderType === 'market') {
            price = 0;
        }

        return { action, orderType, amount, price, reasoning: (parsed.reasoning || '').substring(0, 200) };
    } catch {
        return hold('Parse error');
    }
}

// ─── MM Agent Deterministic Orders ─────────────────────────────────────────

/**
 * Generate MM orders deterministically (never uses LLM).
 */
export function generateMMOrders(
    agent: TradingAgent,
    currentPrice: number
): AIMMDecision {
    const config = agent.mmConfig;
    if (!config) return { orders: [] };

    const orders: AIMMDecision['orders'] = [];

    let basePrice = config.basePrice * (1 + config.trendBias * config.trendSpeed);
    const minAllowed = config.basePrice * (1 - config.priceRangePercent / 100);
    const maxAllowed = config.basePrice * (1 + config.priceRangePercent / 100);
    basePrice = Math.max(minAllowed, Math.min(maxAllowed, basePrice));
    config.basePrice = basePrice;

    const halfSpread = (config.spreadPercent / 100) / 2;
    const layerSpacing = config.layerSpacing / 100;
    const totalValue = agent.balances.USDT + (agent.balances.VCN * currentPrice);
    const vcnRatio = (agent.balances.VCN * currentPrice) / totalValue;
    const rebalanceFactor = (vcnRatio - config.inventoryTarget) * 2;

    for (let i = 0; i < config.layerCount; i++) {
        const buyPrice = basePrice * (1 - halfSpread - (i * layerSpacing));
        const buyAmountPercent = (0.02 + (i * 0.005)) * (1 - rebalanceFactor * 0.5);
        const buyAmount = Math.round(agent.balances.USDT * buyAmountPercent / buyPrice);
        if (buyAmount >= TRADING_LIMITS.minOrderAmount) {
            orders.push({ side: 'buy', price: round4(buyPrice), amount: buyAmount });
        }

        const sellPrice = basePrice * (1 + halfSpread + (i * layerSpacing));
        const sellAmountPercent = (0.02 + (i * 0.005)) * (1 + rebalanceFactor * 0.5);
        const sellAmount = Math.round(agent.balances.VCN * sellAmountPercent);
        if (sellAmount >= TRADING_LIMITS.minOrderAmount) {
            orders.push({ side: 'sell', price: round4(sellPrice), amount: sellAmount });
        }
    }

    return { orders };
}
