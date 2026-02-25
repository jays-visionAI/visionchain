/**
 * VisionDEX Trading Engine - Micro-Round Architecture
 *
 * Separated from index.js for maintainability.
 * Runs ~25 micro-rounds per 1-minute invocation (~2s each).
 * - Preset strategies: deterministic algorithm (free, instant)
 * - Custom prompt agents: DeepSeek LLM (first micro-round only)
 * - Trading agents: deterministic refresh every 5 micro-rounds
 */

const DEX_FEE_RATES = {
    makerFeeRate: 0.0002,
    takerFeeRate: 0.0005,
    tradingMakerFeeRate: 0.0,
    tradingTakerFeeRate: 0.0001,
};
const DEX_PAIR = "VCN-USDT";
const DEX_MIN_ORDER = 100;

// ─── Order Book ────────────────────────────────────────────────────────────

class CloudOrderBook {
    constructor(lastPrice) {
        this.bids = [];
        this.asks = [];
        this.lastPrice = lastPrice || 0.10;
    }

    addLimitOrder(order) {
        if (order.side === "buy") {
            if (this.asks.length > 0 && order.price >= this.asks[0].price) return "crosses";
            const idx = this.bids.findIndex((o) => o.price < order.price);
            if (idx === -1) this.bids.push(order);
            else this.bids.splice(idx, 0, order);
            return "added";
        } else {
            if (this.bids.length > 0 && order.price <= this.bids[0].price) return "crosses";
            const idx = this.asks.findIndex((o) => o.price > order.price);
            if (idx === -1) this.asks.push(order);
            else this.asks.splice(idx, 0, order);
            return "added";
        }
    }

    executeMarketOrder(takerOrderId, takerAgentId, takerUid, side, amount, limitPrice) {
        const fills = [];
        let remaining = amount;
        const bookSide = side === "buy" ? this.asks : this.bids;

        while (remaining > 0 && bookSide.length > 0) {
            const top = bookSide[0];
            if (limitPrice != null) {
                if (side === "buy" && top.price > limitPrice) break;
                if (side === "sell" && top.price < limitPrice) break;
            }
            if (top.ownerUid === takerUid && !top.isTradingOrder) {
                bookSide.shift(); continue;
            }

            const fillAmount = Math.min(remaining, top.remainingAmount);
            const fillTotal = fillAmount * top.price;
            const makerFeeRate = top.isTradingOrder ? DEX_FEE_RATES.tradingMakerFeeRate : DEX_FEE_RATES.makerFeeRate;

            fills.push({
                makerOrderId: top.id, makerAgentId: top.agentId, makerUid: top.ownerUid,
                takerOrderId, takerAgentId, takerUid, takerSide: side,
                price: top.price, amount: fillAmount, total: fillTotal,
                makerFee: fillTotal * makerFeeRate, takerFee: fillTotal * DEX_FEE_RATES.takerFeeRate,
            });

            top.remainingAmount -= fillAmount;
            remaining -= fillAmount;
            if (top.remainingAmount <= 0) bookSide.shift();
        }

        if (fills.length > 0) this.lastPrice = fills[fills.length - 1].price;
        return fills;
    }

    cancelAgentOrders(agentId) {
        this.bids = this.bids.filter((o) => o.agentId !== agentId);
        this.asks = this.asks.filter((o) => o.agentId !== agentId);
    }

    getBestBid() {
        return this.bids.length > 0 ? this.bids[0].price : 0;
    }
    getBestAsk() {
        return this.asks.length > 0 ? this.asks[0].price : this.lastPrice * 1.005;
    }
    getSpreadPct() {
        const b = this.getBestBid(); const a = this.getBestAsk();
        return b > 0 ? ((a - b) / this.lastPrice * 100).toFixed(3) : "0";
    }
    getBidDepth() {
        return this.bids.reduce((s, o) => s + o.remainingAmount, 0);
    }
    getAskDepth() {
        return this.asks.reduce((s, o) => s + o.remainingAmount, 0);
    }
    getOpenCount() {
        return this.bids.length + this.asks.length;
    }
}

// ─── Trading Order Generation ───────────────────────────────────────────────────

function generateTradingOrders(agent, currentPrice, tradingAdmin, engineBasePrice, roundNumber) {
    const agentCfg = agent.tradingConfig || {};

    // Merge: Trading Admin settings override agent-level config
    const pd = tradingAdmin?.priceDirection || {};
    const sc = tradingAdmin?.spreadConfig || {};
    const ic = tradingAdmin?.inventoryConfig || {};
    const ao = tradingAdmin?.agentOverrides?.[agent.id] || {};

    // If agent is disabled via admin override, skip
    if (ao.enabled === false) return { orders: [], marketAction: null };

    // ── Price Direction ──
    const targetPrice = pd.targetPrice || agentCfg.basePrice || currentPrice;
    const priceFloor = pd.priceFloor ?? agentCfg.basePrice * 0.5 ?? currentPrice * 0.5;
    const priceCeiling = pd.priceCeiling ?? agentCfg.basePrice * 2 ?? currentPrice * 2;
    const priceRangePct = pd.priceRangePercent ?? agentCfg.priceRangePercent ?? 20;

    // Use engineBasePrice (which accumulates floating point changes) instead of currentPrice
    let basePrice = engineBasePrice || currentPrice;
    const minP = targetPrice * (1 - priceRangePct / 100);
    const maxP = targetPrice * (1 + priceRangePct / 100);
    basePrice = Math.max(Math.max(minP, priceFloor), Math.min(Math.min(maxP, priceCeiling), basePrice));

    // ── Movement & Volume Strategy ──
    const movementStyle = pd.movementStyle || "gradual";
    let volumeIntensity = pd.volumeIntensity || 0.5; // 0.0 to 1.0

    // Apply Natural Volume Cycle or Schedule if enabled
    if (pd.volumeCycleEnabled) {
        const currentHour = new Date().getUTCHours();
        let multiplier = 1.0;

        if (pd.volumeSchedule && typeof pd.volumeSchedule[currentHour] === "number") {
            // 1. Precise Schedule Lookup
            multiplier = pd.volumeSchedule[currentHour];
        } else {
            // 2. Fallback to Sine-wave Cycle if Schedule is not set
            const peakHour = pd.volumeCyclePeakHour || 12; // UTC Peak
            const diff = Math.abs(currentHour - peakHour);
            const cyclicDist = Math.min(diff, 24 - diff);
            multiplier = 0.3 + 0.7 * (1 - cyclicDist / 12);
        }

        // Apply +/- 10% random jitter as requested
        const jitter = 0.9 + Math.random() * 0.2;
        volumeIntensity *= (multiplier * jitter);
    }

    // ── Spread & Layers ──
    const baseSpreadPct = ao.spreadOverride ?? sc.baseSpread ?? agentCfg.spreadPercent ?? 1.0;
    const bidMult = sc.bidSpreadMultiplier ?? 1.0;
    const askMult = sc.askSpreadMultiplier ?? 1.0;
    const layerCount = sc.layerCount ?? agentCfg.layerCount ?? 5;
    const layerSpacingPct = sc.layerSpacing ?? agentCfg.layerSpacing ?? 0.3;
    const layerAmountPct = (sc.layerAmountPercent ?? 3.0) / 100;
    const layerPattern = sc.layerAmountPattern || "flat";

    // Dynamic spread: widen when volatile
    let effectiveSpread = baseSpreadPct;
    if (sc.dynamicSpreadEnabled && sc.dynamicSpreadRange) {
        const dist = Math.abs(currentPrice - targetPrice) / currentPrice;
        const dynMin = sc.dynamicSpreadRange.min || 0.2;
        const dynMax = sc.dynamicSpreadRange.max || 2.0;
        effectiveSpread = Math.max(dynMin, Math.min(dynMax, baseSpreadPct * (1 + dist * 5)));
    }

    const halfBidSpread = (effectiveSpread / 100 * bidMult) / 2;
    const halfAskSpread = (effectiveSpread / 100 * askMult) / 2;
    const layerSpacing = layerSpacingPct / 100;

    // ── Inventory Management ──
    const totalVal = agent.balances.USDT + agent.balances.VCN * currentPrice;
    if (totalVal <= 0) return { orders: [], marketAction: null };
    const vcnRatio = (agent.balances.VCN * currentPrice) / totalVal;

    // Default targets based on agent role if admin hasn't overridden
    let defaultInventoryTarget = 0.5;
    if (agent.strategy?.preset === "trading_bull") defaultInventoryTarget = 0.6; // Wants more VCN
    if (agent.strategy?.preset === "trading_bear") defaultInventoryTarget = 0.4; // Wants more USDT

    const inventoryTarget = ic.targetRatio ?? agentCfg.inventoryTarget ?? defaultInventoryTarget;
    const skewIntensity = ic.skewIntensity ?? 0.3;
    const rebal = (vcnRatio - inventoryTarget) * 2 * skewIntensity;

    // ── Role-based Bias ──
    // This allows one agent to be bullish and another bearish even with a global bias
    let localBias = pd.trendBias || 0;
    if (agent.strategy?.preset === "trading_bull") localBias += 0.10;
    if (agent.strategy?.preset === "trading_bear") localBias -= 0.10;
    localBias = Math.max(-1, Math.min(1, localBias));

    // ── Price Drift Calculation (CRITICAL: This moves the engineBasePrice) ──
    const trendSpeedVal = (typeof pd.trendSpeed === "number") ? pd.trendSpeed : 0.0002;
    const diff = targetPrice - basePrice;

    // Factor 1: Gravity towards targetPrice
    const driftDelta = diff * trendSpeedVal * (0.5 + 0.5 * Math.abs(localBias));
    // Factor 2: Direct push from bias
    const biasDrift = localBias * trendSpeedVal * basePrice * 0.4;

    const finalDrift = driftDelta + biasDrift;
    basePrice += finalDrift;

    // Consistency check: ensure price doesn't teleport
    if (Math.abs(finalDrift) / basePrice > 0.01) {
        basePrice = basePrice * (1 + (finalDrift > 0 ? 0.01 : -0.01));
    }

    // ── Layer Pattern Multipliers ──
    function getPatternMult(i, total) {
        switch (layerPattern) {
            case "increasing": return Math.pow(1.5, i);
            case "decreasing": return Math.max(0.1, 2.0 - i * 0.3);
            case "bell": {
                const mid = (total - 1) / 2;
                return 1.0 + 1.0 * (1 - Math.pow(Math.abs(i - mid) / Math.max(mid, 1), 2));
            }
            default: return 1.0 + i * 0.2;
        }
    }

    // ── Organic Market Action Generation (Pushing Price & Volume) ──
    let marketAction = null;

    // 1. Price Pushing Action (when aggressive mode AND there is a target or bias)
    if (movementStyle === "aggressive" && (Math.abs(targetPrice - currentPrice) / currentPrice > 0.01 || Math.abs(pd.trendBias || 0) > 0.05)) {
        const pushChance = 0.4;
        if (Math.random() < pushChance) {
            // Prefer target direction if set, otherwise use bias direction
            const side = Math.abs(targetPrice - currentPrice) / currentPrice > 0.01 ?
                (targetPrice - currentPrice > 0 ? "buy" : "sell") :
                ((pd.trendBias || 0) > 0 ? "buy" : "sell");
            const amount = Math.round(agent.balances[side === "buy" ? "USDT" : "VCN"] * 0.05 * (0.5 + Math.random()));
            if (amount >= DEX_MIN_ORDER) {
                marketAction = { side, amount, type: "market", reasoning: "PUSH_TO_TARGET" };
            }
        }
    }

    // 2. Organic Volume (Self-Trading / Wash)
    // This creates "ticks" in the chart without moving the price much
    if (!marketAction && volumeIntensity > 0) {
        const volumeChance = volumeIntensity * 0.8;
        if (Math.random() < volumeChance) {
            // Bias the organic volume direction toward the trend
            const biasedRoll = Math.random() + (pd.trendBias || 0) * 0.3;
            const side = biasedRoll > 0.5 ? "buy" : "sell";
            const amount = Math.round(DEX_MIN_ORDER * (1 + Math.random() * 5 * volumeIntensity));
            marketAction = { side, amount, type: "market", reasoning: "ORGANIC_VOLUME" };
        }
    }

    // Update the parent's engineBasePrice tracking
    if (engineBasePrice !== undefined) {
        // We accumulate the price change so it persists across agent iterations in this round
        return { orders: generateLayers(), marketAction: null, updatedBasePrice: basePrice };
    }

    function generateLayers() {
        const orders = [];
        const steps = layerCount;
        for (let i = 1; i <= steps; i++) {
            const patternMult = getPatternMult(i, steps);

            // Bid (Buy) Side
            const bidPrice = basePrice * (1 - (baseSpreadPct * i * bidMult) / 100);
            const bidAmount = Math.round(DEX_MIN_ORDER * (1 + Math.random()) * patternMult * volumeIntensity);
            if (bidPrice > 0 && bidAmount > 0) orders.push({ side: "buy", price: bidPrice, amount: bidAmount });

            // Ask (Sell) Side
            const askPrice = basePrice * (1 + (baseSpreadPct * i * askMult) / 100);
            const askAmount = Math.round(DEX_MIN_ORDER * (1 + Math.random()) * patternMult * volumeIntensity);
            if (askPrice > 0 && askAmount > 0) orders.push({ side: "sell", price: askPrice, amount: askAmount });
        }
        return orders;
    }
    return { orders: generateLayers(), marketAction: null };
}

// ─── Preset Strategy Algorithms ────────────────────────────────────────────

function executePresetAlgorithm(preset, agent, md) {
    const maxPct = (agent.strategy?.maxPositionPercent || 30) / 100;
    const cp = md.currentPrice;
    const avg = md.avgPrice20 || cp;
    const priceDiff = avg > 0 ? ((cp - avg) / avg) * 100 : 0;
    const r4 = (n) => Math.round(n * 10000) / 10000;
    const h = (r) => ({ action: "hold", orderType: "limit", amount: 0, price: 0, reasoning: r });

    switch (preset) {
        case "momentum": {
            if (priceDiff > 3) {
                const a = Math.round((md.usdtBalance * maxPct * 0.6) / md.bestAsk); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "market", amount: a, price: 0, reasoning: `Uptrend +${priceDiff.toFixed(1)}%` } : h("Uptrend, low bal");
            }
            if (priceDiff < -3) {
                const a = Math.round(md.vcnBalance * maxPct * 0.6); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "market", amount: a, price: 0, reasoning: `Downtrend ${priceDiff.toFixed(1)}%` } : h("Downtrend, no VCN");
            }
            if (priceDiff > 1) {
                const a = Math.round((md.usdtBalance * maxPct * 0.3) / cp); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "limit", amount: a, price: r4((md.bestBid + cp) / 2), reasoning: `Mild up +${priceDiff.toFixed(1)}%` } : h("Mild, small");
            }
            return h(`Unclear (${priceDiff.toFixed(1)}%)`);
        }
        case "value": {
            const drop = avg > 0 ? ((avg - cp) / avg) * 100 : 0;
            if (drop > 15) {
                const a = Math.round((md.usdtBalance * maxPct * 0.5) / cp); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "limit", amount: a, price: r4(cp * 0.995), reasoning: `${drop.toFixed(1)}% below avg` } : h("Undervalued, no USDT");
            }
            if (drop < -50) {
                const a = Math.round(md.vcnBalance * maxPct * 0.3); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "limit", amount: a, price: r4(cp * 1.005), reasoning: `+${Math.abs(drop).toFixed(1)}% profit` } : h("No VCN");
            }
            return h("Waiting for value");
        }
        case "scalper": {
            const sp = parseFloat(md.spread) || 0;
            if (sp > 0.3 && md.usdtBalance > 100) {
                const a = Math.round((md.usdtBalance * maxPct) / cp); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "limit", amount: a, price: r4(md.bestBid + (md.bestAsk - md.bestBid) * 0.3), reasoning: `Scalp, spread ${sp.toFixed(2)}%` } : h("Small");
            }
            if (md.vcnBalance > DEX_MIN_ORDER) {
                const a = Math.round(md.vcnBalance * maxPct); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "limit", amount: a, price: r4(cp * 1.005), reasoning: "Scalp sell" } : h("Small VCN");
            }
            return h("No scalp opp");
        }
        case "contrarian": {
            const ch = md.change24h || 0;
            if (ch > 5) {
                const a = Math.round(md.vcnBalance * maxPct * 0.5); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "limit", amount: a, price: r4(cp * 1.002), reasoning: `Overbought +${ch.toFixed(1)}%` } : h("OB no VCN");
            }
            if (ch < -5) {
                const a = Math.round((md.usdtBalance * maxPct * 0.5) / cp); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "limit", amount: a, price: r4(cp * 0.998), reasoning: `Oversold ${ch.toFixed(1)}%` } : h("OS no USDT");
            }
            return h("Waiting extreme");
        }
        case "grid": {
            const gl = Math.floor(cp / (cp * 0.01));
            if (gl % 2 === 0) {
                const a = Math.round((md.usdtBalance * maxPct) / cp); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "limit", amount: a, price: r4(cp * 0.99), reasoning: `Grid buy lv${gl}` } : h("Grid no USDT");
            }
            const a = Math.round(md.vcnBalance * maxPct); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "limit", amount: a, price: r4(cp * 1.01), reasoning: `Grid sell lv${gl}` } : h("Grid no VCN");
        }
        case "breakout": {
            if (priceDiff > 2) {
                const a = Math.round((md.usdtBalance * maxPct * 0.8) / md.bestAsk); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "market", amount: a, price: 0, reasoning: `Breakout +${priceDiff.toFixed(1)}%` } : h("BO no USDT");
            }
            if (priceDiff < -2) {
                const a = Math.round(md.vcnBalance * maxPct * 0.8); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "market", amount: a, price: 0, reasoning: `Breakdown ${priceDiff.toFixed(1)}%` } : h("BD no VCN");
            }
            return h("No breakout");
        }
        case "twap": {
            const a = Math.round((md.usdtBalance * 0.04) / md.bestAsk);
            if (a < DEX_MIN_ORDER) return h("TWAP no USDT");
            return parseFloat(md.spread) > 0.5 ?
                { action: "buy", orderType: "limit", amount: a, price: r4(md.bestBid + (md.bestAsk - md.bestBid) * 0.4), reasoning: "TWAP limit" } :
                { action: "buy", orderType: "market", amount: a, price: 0, reasoning: "TWAP market" };
        }
        case "sentiment": {
            const vr = md.bidDepth > 0 ? md.askDepth / md.bidDepth : 1;
            if (vr < 0.7) {
                const a = Math.round((md.usdtBalance * maxPct * 0.4) / cp); return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "limit", amount: a, price: r4(cp * 0.998), reasoning: "Bullish flow" } : h("Bull no USDT");
            }
            if (vr > 1.5) {
                const a = Math.round(md.vcnBalance * maxPct * 0.4); return a >= DEX_MIN_ORDER ? { action: "sell", orderType: "limit", amount: a, price: r4(cp * 1.002), reasoning: "Bearish flow" } : h("Bear no VCN");
            }
            return h("Neutral");
        }
        case "random": {
            const rnd = Math.random(); const sz = 0.05 + Math.random() * 0.10;
            if (rnd < 0.33) {
                const a = Math.round((md.usdtBalance * Math.min(sz, maxPct)) / cp); if (a < DEX_MIN_ORDER) return h("Rnd no USDT"); const lim = Math.random() > 0.5; return { action: "buy", orderType: lim ? "limit" : "market", amount: a, price: lim ? r4(cp * (0.99 + Math.random() * 0.02)) : 0, reasoning: "Random buy" };
            }
            if (rnd < 0.66) {
                const a = Math.round(md.vcnBalance * Math.min(sz, maxPct)); if (a < DEX_MIN_ORDER) return h("Rnd no VCN"); const lim = Math.random() > 0.5; return { action: "sell", orderType: lim ? "limit" : "market", amount: a, price: lim ? r4(cp * (0.99 + Math.random() * 0.02)) : 0, reasoning: "Random sell" };
            }
            return h("Random hold");
        }
        case "dca": {
            const a = Math.round((md.usdtBalance * 0.015) / md.bestAsk);
            return a >= DEX_MIN_ORDER ? { action: "buy", orderType: "market", amount: a, price: 0, reasoning: "DCA buy" } : h("DCA no USDT");
        }
        default: return h("Unknown: " + preset);
    }
}

// ─── DeepSeek LLM Decision ────────────────────────────────────────────────

async function callDeepSeek(agent, md, deepseekKey, axiosLib) {
    if (!deepseekKey || !agent.strategy?.prompt?.trim()) {
        return { action: "hold", orderType: "limit", amount: 0, price: 0, reasoning: "No key/prompt" };
    }

    const prompt = `${agent.strategy.prompt}

주문 유형:
- "limit" (Maker): 지정가, 수수료 0.02%
- "market" (Taker): 시장가, 수수료 0.05%

시장: 가격=${md.currentPrice.toFixed(4)}, 24h=${md.change24h.toFixed(2)}%, Bid=${md.bestBid.toFixed(4)}, Ask=${md.bestAsk.toFixed(4)}, Spread=${md.spread}%, 매수량=${Math.round(md.bidDepth)}, 매도량=${Math.round(md.askDepth)}, USDT=${md.usdtBalance.toFixed(2)}, VCN=${Math.round(md.vcnBalance)}

JSON만: {"action":"buy"|"sell"|"hold","orderType":"limit"|"market","amount":숫자,"price":숫자,"reasoning":"근거"}`;

    try {
        const resp = await axiosLib.post("https://api.deepseek.com/chat/completions", {
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a crypto trading agent. Respond ONLY with valid JSON." },
                { role: "user", content: prompt },
            ],
            temperature: 0.3 + (agent.strategy.riskLevel || 5) * 0.05,
            max_tokens: 256,
        }, { headers: { Authorization: `Bearer ${deepseekKey}` }, timeout: 15000 });

        const text = resp.data?.choices?.[0]?.message?.content || "";
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) return { action: "hold", orderType: "limit", amount: 0, price: 0, reasoning: "Parse fail" };

        const p = JSON.parse(m[0]);
        const action = ["buy", "sell", "hold"].includes(p.action) ? p.action : "hold";
        if (action === "hold") return { action: "hold", orderType: "limit", amount: 0, price: 0, reasoning: p.reasoning || "Hold" };

        const orderType = ["limit", "market"].includes(p.orderType) ? p.orderType : "limit";
        const maxPct = (agent.strategy.maxPositionPercent || 30) / 100;
        let amount = Math.max(0, Number(p.amount) || 0);
        if (action === "buy") amount = Math.min(amount, (md.usdtBalance * maxPct) / (md.bestAsk || md.currentPrice));
        else amount = Math.min(amount, md.vcnBalance * maxPct);
        if (amount < DEX_MIN_ORDER) return { action: "hold", orderType: "limit", amount: 0, price: 0, reasoning: "Below min" };
        amount = Math.round(amount);

        let price = Number(p.price) || 0;
        if (orderType === "limit" && price > 0) price = Math.round(Math.max(md.currentPrice * 0.9, Math.min(md.currentPrice * 1.1, price)) * 10000) / 10000;
        else if (orderType === "market") price = 0;

        return { action, orderType, amount, price, reasoning: (p.reasoning || "").substring(0, 200) };
    } catch (err) {
        console.warn(`[TradingEngine] DeepSeek error ${agent.name}:`, err.message);
        return { action: "hold", orderType: "limit", amount: 0, price: 0, reasoning: "DeepSeek error" };
    }
}

// ─── Main Engine Runner ────────────────────────────────────────────────────

async function runMicroRoundEngine(admin, db, getApiKey) {
    const axios = require("axios");
    const invocationStart = Date.now();
    const MAX_MS = 48000;
    const MICRO_MS = 2000;

    console.log("[TradingEngine] Micro-round cycle starting...");

    // Load phase
    const deepseekKey = (await getApiKey("deepseek")) || process.env.DEEPSEEK_API_KEY || "";

    const settingsSnap = await db.doc("dex/settings/config/main").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.paused) {
        console.log("[TradingEngine] Paused."); return;
    }

    // ── Load Trading Admin Settings from Firestore ──
    let tradingAdmin = null;
    let mmKillSwitch = false;
    try {
        const mmSnap = await db.doc("dex/config/trading-settings/current").get();
        if (mmSnap.exists) {
            tradingAdmin = mmSnap.data();
            mmKillSwitch = tradingAdmin?.riskConfig?.killSwitchEnabled === true;
            console.log(`[TradingEngine] Trading Admin loaded - Kill Switch: ${mmKillSwitch}, Mode: ${tradingAdmin?.priceDirection?.mode || "default"}, Spread: ${tradingAdmin?.spreadConfig?.baseSpread || "default"}%`);
        }
    } catch (e) {
        console.warn("[TradingEngine] Trading Admin settings load failed:", e.message);
    }

    if (mmKillSwitch) {
        console.log("[TradingEngine] Trading KILL SWITCH is ON - Trading agents will not place orders.");
    }

    const roundRef = db.doc("dex/settings/config/roundCounter");
    const roundSnap = await roundRef.get();
    let roundNumber = roundSnap.exists ? roundSnap.data().current || 0 : 0;

    const marketSnap = await db.doc(`dex/market/data/${DEX_PAIR}`).get();
    const marketData = marketSnap.exists ? marketSnap.data() : { lastPrice: settings.initialPrice || 0.10 };
    const sessionOpen = marketData.lastPrice || 0.10;

    const agentsSnap = await db.collection("dex/agents/list").where("status", "==", "active").get();
    if (agentsSnap.empty) {
        console.log("[TradingEngine] No agents."); return;
    }

    const agents = [];
    agentsSnap.forEach((doc) => agents.push({ id: doc.id, ...doc.data() }));
    const agentMap = {};
    agents.forEach((a) => {
        agentMap[a.id] = a;
    });

    const tradingAgents = agents.filter((a) => a.role === "market_maker");
    const presetAgents = agents.filter((a) => a.role === "trader" && a.strategy?.preset !== "custom");
    const customAgents = agents.filter((a) => a.role === "trader" && a.strategy?.preset === "custom" && a.strategy?.prompt?.trim());

    // Build order book
    const orderBook = new CloudOrderBook(sessionOpen);
    const openSnap = await db.collection("dex/orders/list").where("status", "in", ["open", "partial"]).get();
    openSnap.forEach((doc) => {
        const o = doc.data();
        if (!o.agentId) return;
        orderBook.addLimitOrder({
            id: doc.id, agentId: o.agentId, ownerUid: o.ownerUid,
            side: o.side, price: o.price, remainingAmount: o.remainingAmount || o.amount,
            isTradingOrder: !!tradingAgents.find((trading) => trading.id === o.agentId), timestamp: Date.now(),
        });
    });

    // Cancel old Trading orders
    const cb = db.batch();
    for (const trading of tradingAgents) {
        const old = await db.collection("dex/orders/list").where("agentId", "==", trading.id).where("status", "in", ["open", "partial"]).get();
        old.forEach((d) => cb.update(d.ref, { status: "cancelled" }));
    }
    // Increment round counter here once instead of inside loop for performance
    roundNumber++;
    await cb.commit();

    // Custom agents: DeepSeek once
    const customDecs = [];
    if (customAgents.length > 0 && deepseekKey) {
        const ps = customAgents.map(async (ag) => {
            const md = mkSnap(orderBook, marketData, ag);
            const dec = await callDeepSeek(ag, md, deepseekKey, axios);
            return { agent: ag, decision: dec };
        });
        customDecs.push(...(await Promise.all(ps)));
    }

    const allFills = [];
    const microPrices = [];
    let totalMicro = 0;
    const totalDec = { buy: 0, sell: 0, hold: 0 };

    // ── Circuit Breaker State ──
    let tradingPaused = mmKillSwitch; // start paused if kill switch is on
    const cbThreshold = tradingAdmin?.riskConfig?.circuitBreaker?.priceChangeThreshold || 5; // percent

    // ── Persistent Base Price Tracking ──
    let engineBasePrice = tradingAdmin?.priceDirection?.currentBasePrice || sessionOpen || 0.1000;

    // Auto-sync base price if it drifts more than 5% from actual market price (prevents sticking to old values)
    if (Math.abs(engineBasePrice - sessionOpen) / sessionOpen > 0.05) {
        console.log(`[TradingEngine] Base price was out of sync (${engineBasePrice.toFixed(4)} vs ${sessionOpen.toFixed(4)}). Resetting to market.`);
        engineBasePrice = sessionOpen;
    }

    const pd = tradingAdmin?.priceDirection || {};
    const trendBias = pd.trendBias || 0;
    const speedMap = { slow: 0.00005, medium: 0.0002, fast: 0.0005 };
    const trendSpeedVal = (typeof pd.trendSpeed === "number") ? pd.trendSpeed : speedMap[pd.trendSpeed || "medium"];

    let volumeIntensity = pd.volumeIntensity || 0.5;
    if (pd.volumeCycleEnabled) {
        const currentHour = new Date().getUTCHours();
        let multiplier = 1.0;
        if (pd.volumeSchedule && typeof pd.volumeSchedule[currentHour] === "number") {
            multiplier = pd.volumeSchedule[currentHour];
        } else {
            const peakHour = pd.volumeCyclePeakHour || 12;
            const diff = Math.abs(currentHour - peakHour);
            const cyclicDist = Math.min(diff, 24 - diff);
            multiplier = 0.3 + 0.7 * (1 - cyclicDist / 12);
        }
        const jitter = 0.9 + Math.random() * 0.2;
        volumeIntensity *= (multiplier * jitter);
    }

    // ── Capitulation Engine (Flash Crash / Liquidate targets) ──
    const cap = tradingAdmin?.capitulation;
    let capitulationTriggered = false;
    const capFills = [];
    if (cap?.active === true && tradingAgents.length > 0 && !tradingPaused) {
        console.log(`[TradingEngine] Executing Capitulation flash-crash! Target UID: ${cap.targetUid || "any"}, Drop: ${cap.dropPercent}%`);
        const dropRatio = (parseFloat(cap.dropPercent) || 10) / 100;
        const targetPrice = engineBasePrice * (1 - dropRatio);
        const dumpAmount = parseFloat(cap.dumpAmount) || 500000;
        const mmAlpha = tradingAgents[0];

        // Massive market sell command directly into the orderbook bypassing standard checks
        // We simulate this by continuously taking active bids until amount is depleted or basePrice is hit.
        // For simplicity, we fire an execDec as a massive market sell.
        const mf = execDec(orderBook, mmAlpha, { action: "sell", amount: dumpAmount, orderType: "market", reasoning: "CAPITULATION_DUMP" }, roundNumber, Date.now());
        capFills.push(...mf);

        // Ensure price is forced down to target level so subsequent Trading ticks recreate walls at the absolute bottom
        engineBasePrice = Math.max(0.0001, targetPrice);
        orderBook.lastPrice = Math.max(0.0001, targetPrice);

        capitulationTriggered = true;
    }

    // ── Micro-Round Loop ──
    while (Date.now() - invocationStart < MAX_MS) {
        const ms = Date.now();
        roundNumber++;
        totalMicro++;
        const mf = [];

        // Circuit breaker check: pause Trading if price moved too far from session open
        if (!tradingPaused && sessionOpen > 0) {
            const pctChange = Math.abs(orderBook.lastPrice - sessionOpen) / sessionOpen * 100;
            if (pctChange > cbThreshold) {
                tradingPaused = true;
                console.log(`[TradingEngine] Circuit breaker triggered: ${pctChange.toFixed(2)}% change exceeds ${cbThreshold}% threshold`);
            }
        }

        for (const trading of tradingAgents) {
            // 1. Generate & Update Orderbook Walls
            orderBook.cancelAgentOrders(trading.id);
            const { orders, marketAction, updatedBasePrice } = generateTradingOrders(trading, orderBook.lastPrice, tradingAdmin, engineBasePrice, roundNumber);

            // Update the shared engineBasePrice for the next agent/round
            if (updatedBasePrice) engineBasePrice = updatedBasePrice;

            // Clamp to floor/ceiling if set
            const priceFloor = pd.priceFloor || 0.0001;
            const priceCeiling = pd.priceCeiling || engineBasePrice * 10;
            engineBasePrice = Math.max(priceFloor, Math.min(priceCeiling, engineBasePrice));

            for (const trading of tradingAgents) {
                // 1. Generate & Update Orderbook Walls
                orderBook.cancelAgentOrders(trading.id);
                const { orders, marketAction } = generateTradingOrders(trading, orderBook.lastPrice, tradingAdmin, engineBasePrice, roundNumber);

                for (const mo of orders) {
                    orderBook.addLimitOrder({
                        id: `trading-${trading.id}-${roundNumber}-${Math.random().toString(36).substr(2, 4)}`,
                        agentId: trading.id, ownerUid: trading.ownerUid,
                        side: mo.side, price: mo.price, remainingAmount: mo.amount,
                        isTradingOrder: true, timestamp: ms,
                    });
                }

                // 2. Execute Coordinated Market Action (Price Pushing or Organic Volume)
                if (marketAction) {
                    mf.push(...execDec(orderBook, trading, marketAction, roundNumber, ms));
                }

                // 3. Dual-Pressure logic:
                // Bullish agents (Alpha) mainly buy, Bearish agents (Beta) mainly sell.
                // Power balance is dictated by global trendBias.
                const isBullAgent = trading.strategy?.preset === "trading_bull";
                const isBearAgent = trading.strategy?.preset === "trading_bear";

                let actionSide = null;
                if (isBullAgent && (trendBias > -0.2 || Math.random() < 0.3)) actionSide = "buy";
                if (isBearAgent && (trendBias < 0.2 || Math.random() < 0.3)) actionSide = "sell";

                // If global bias is extreme, everyone follows it
                if (trendBias > 0.6) actionSide = "buy";
                if (trendBias < -0.6) actionSide = "sell";

                if (actionSide && Math.random() < (0.1 + Math.abs(trendBias) * 0.4)) {
                    // Use local volume intensity (scaled by cycle/schedule)
                    const currentHour = new Date().getUTCHours();
                    const multiplier = (pd.volumeSchedule && pd.volumeSchedule[currentHour]) || 1.0;
                    const vIntensity = (pd.volumeIntensity || 0.5) * multiplier;

                    const biasAmount = Math.round(DEX_MIN_ORDER * (2 + Math.random() * 8 * Math.abs(trendBias || 0.3)) * (0.5 + vIntensity * 0.5));
                    const biasAction = { action: actionSide, amount: biasAmount, orderType: "market", reasoning: "ROLE_BASED_PRESSURE" };
                    mf.push(...execDec(orderBook, trading, biasAction, roundNumber, ms));
                }
            }
        }

        // Custom: first micro only
        if (totalMicro === 1) {
            for (const { agent, decision } of customDecs) {
                totalDec[decision.action]++;
                if (decision.action === "hold") continue;
                mf.push(...execDec(orderBook, agent, decision, roundNumber, ms));
            }
        }

        // Preset agents: 50-80% random each micro
        const cnt = Math.max(3, Math.floor(presetAgents.length * (0.5 + Math.random() * 0.3)));
        const sel = [...presetAgents].sort(() => Math.random() - 0.5).slice(0, cnt);
        for (const ag of sel) {
            const md = mkSnap(orderBook, marketData, ag);
            const dec = executePresetAlgorithm(ag.strategy.preset, ag, md);
            totalDec[dec.action]++;
            if (dec.action === "hold") continue;
            mf.push(...execDec(orderBook, ag, dec, roundNumber, ms));
        }

        // Update in-memory balances
        for (const f of mf) {
            const mk = agentMap[f.makerAgentId];
            const tk = agentMap[f.takerAgentId];
            if (f.takerSide === "buy") {
                if (tk) {
                    tk.balances.USDT -= (f.total + f.takerFee); tk.balances.VCN += f.amount;
                }
                if (mk) {
                    mk.balances.VCN -= f.amount; mk.balances.USDT += (f.total - f.makerFee);
                }
            } else {
                if (tk) {
                    tk.balances.VCN -= f.amount; tk.balances.USDT += (f.total - f.takerFee);
                }
                if (mk) {
                    mk.balances.USDT -= (f.total + f.makerFee); mk.balances.VCN += f.amount;
                }
            }
        }

        allFills.push(...mf);
        microPrices.push({ p: orderBook.lastPrice, t: ms });

        const el = Date.now() - ms;
        if (el < MICRO_MS) await new Promise((r) => setTimeout(r, MICRO_MS - el));
    }

    // ── Firestore Write Phase ──
    const fp = orderBook.lastPrice;
    const tv = allFills.reduce((s, f) => s + f.total, 0);
    const vcnV = allFills.reduce((s, f) => s + f.amount, 0);
    const pH = Math.max(sessionOpen, ...microPrices.map((p) => p.p));
    const pL = Math.min(sessionOpen, ...microPrices.map((p) => p.p));

    const wb = db.batch();
    let bc = 0;

    // Trades (limited to satisfy Batch 500 limit: trades + candles + market + admin + agents)
    // We prioritize the most recent 100 trades to stay well within limits
    const tradeLimit = Math.min(allFills.length, 100);
    for (const f of allFills.slice(-tradeLimit)) {
        const tid = `t-${roundNumber}-${Math.random().toString(36).substr(2, 8)}`;
        wb.set(db.doc(`dex/trades/list/${tid}`), {
            id: tid, pair: DEX_PAIR, price: f.price, amount: f.amount, total: f.total,
            takerSide: f.takerSide, makerAgentId: f.makerAgentId, makerUid: f.makerUid,
            makerOrderId: f.makerOrderId, makerFee: f.makerFee,
            takerAgentId: f.takerAgentId, takerUid: f.takerUid,
            takerOrderId: f.takerOrderId, takerFee: f.takerFee,
            reasoning: f.reasoning || "",
            timestamp: admin.firestore.Timestamp.fromMillis(f.time || Date.now()),
        });
        bc++;
    }

    // Trading final orders (skip if kill switch or circuit breaker paused)
    if (!tradingPaused) {
        for (const trading of tradingAgents) {
            const { orders } = generateTradingOrders(trading, fp, tradingAdmin, engineBasePrice, roundNumber);
            for (const mo of orders) {
                if (bc >= 380) break;
                const oid = `trading-${trading.id}-${roundNumber}-${Math.random().toString(36).substr(2, 4)}`;
                wb.set(db.doc(`dex/orders/list/${oid}`), {
                    id: oid, agentId: trading.id, ownerUid: trading.ownerUid, pair: DEX_PAIR,
                    side: mo.side, type: "limit", role: "pending",
                    price: mo.price, amount: mo.amount, filledAmount: 0, remainingAmount: mo.amount,
                    status: "open", fee: 0, feeRate: 0, reasoning: "Trading",
                    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 120000),
                    createdAt: admin.firestore.Timestamp.now(),
                });
                bc++;
            }
        }
    }

    // Save persist engineBasePrice back to config
    if (tradingAdmin?.priceDirection || capitulationTriggered) {
        const updates = {};
        if (tradingAdmin?.priceDirection) updates["priceDirection.currentBasePrice"] = engineBasePrice;
        if (capitulationTriggered) {
            updates["capitulation.active"] = false;
            updates["capitulation.lastExecutedAt"] = admin.firestore.Timestamp.now();
        }
        wb.update(db.doc("dex/config/trading-settings/current"), updates);
        bc++;
    }

    // Agent balances
    for (const ag of agents) {
        if (bc >= 470) break;
        const val = ag.balances.USDT + ag.balances.VCN * fp;
        const iv = ag.performance?.initialValueUSDT || val;
        wb.update(db.doc(`dex/agents/list/${ag.id}`), {
            "balances.USDT": ag.balances.USDT, "balances.VCN": ag.balances.VCN,
            "performance.currentValueUSDT": val, "performance.totalPnL": val - iv,
            "performance.totalPnLPercent": iv > 0 ? ((val - iv) / iv) * 100 : 0,
            "updatedAt": admin.firestore.Timestamp.now(),
        });
        bc++;
    }

    // Market state
    wb.set(db.doc(`dex/market/data/${DEX_PAIR}`), {
        pair: DEX_PAIR, lastPrice: fp, previousPrice: sessionOpen,
        change24h: fp - sessionOpen,
        changePercent24h: sessionOpen > 0 ? ((fp - sessionOpen) / sessionOpen) * 100 : 0,
        high24h: Math.max(marketData.high24h || 0, pH),
        low24h: Math.min(marketData.low24h || pH, pL),
        volume24h: (marketData.volume24h || 0) + vcnV,
        quoteVolume24h: (marketData.quoteVolume24h || 0) + tv,
        trades24h: (marketData.trades24h || 0) + allFills.length,
        bestBid: orderBook.getBestBid(), bestAsk: orderBook.getBestAsk(),
        spread: orderBook.getBestAsk() - orderBook.getBestBid(),
        spreadPercent: parseFloat(orderBook.getSpreadPct()),
        openOrders: orderBook.getOpenCount(),
        activeAgents: agents.filter((a) => a.status === "active").length,
        totalAgents: agents.length,
        updatedAt: admin.firestore.Timestamp.now(),
    }, { merge: true });
    bc++;

    // ─── Order Book Snapshot (for fast API reads) ───
    const obBids = orderBook.bids.slice(0, 20).map((o) => ({
        price: o.price,
        amount: o.remainingAmount || o.amount,
        agentId: o.agentId || "",
    }));
    const obAsks = orderBook.asks.slice(0, 20).map((o) => ({
        price: o.price,
        amount: o.remainingAmount || o.amount,
        agentId: o.agentId || "",
    }));
    wb.set(db.doc(`dex/orderbook/data/${DEX_PAIR}`), {
        bids: obBids,
        asks: obAsks,
        lastPrice: fp,
        spreadPercent: parseFloat(orderBook.getSpreadPct()),
        updatedAt: admin.firestore.Timestamp.now(),
    });

    // Candles
    try {
        const iMs = { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 };
        const intervals = ["1m", "5m", "15m", "1h", "4h", "1d"];
        const candleRefs = intervals.map((iv) => {
            const cs = Math.floor(invocationStart / iMs[iv]) * iMs[iv];
            return db.doc(`dex/candles/${iv}/${iv}-${cs}`);
        });

        // Fetch existing candles in one call to preserve 'Open' prices and accumulate volume correctly
        const candleSnaps = await db.getAll(...candleRefs);

        for (let i = 0; i < intervals.length; i++) {
            const iv = intervals[i];
            const snap = candleSnaps[i];
            const cs = Math.floor(invocationStart / iMs[iv]) * iMs[iv];

            if (snap.exists) {
                const ex = snap.data();
                wb.set(candleRefs[i], {
                    t: cs,
                    o: ex.o || sessionOpen,
                    h: Math.max(ex.h || sessionOpen, pH),
                    l: Math.min(ex.l || sessionOpen, pL),
                    c: fp,
                    v: (ex.v || 0) + vcnV,
                    qv: (ex.qv || 0) + tv,
                    n: (ex.n || 0) + allFills.length,
                    updatedAt: admin.firestore.Timestamp.now(),
                }, { merge: true });
            } else {
                wb.set(candleRefs[i], {
                    t: cs, o: sessionOpen, h: Math.max(sessionOpen, pH), l: Math.min(sessionOpen, pL), c: fp, v: vcnV, qv: tv, n: allFills.length,
                    updatedAt: admin.firestore.Timestamp.now(),
                });
            }
            bc++;
        }
        console.log(`[TradingEngine] Incremental candles (${intervals.join(",")}) added to batch. Total Ops: ${bc}`);
    } catch (err) {
        console.error("[TradingEngine] Error writing candles:", err);
    }

    // Round log
    wb.set(db.doc(`dex/rounds/log/${roundNumber}`), {
        roundNumber, timestamp: invocationStart, durationMs: Date.now() - invocationStart,
        microRounds: totalMicro, agents: agents.length,
        decisions: totalDec, tradesExecuted: allFills.length, totalVolume: tv,
        priceOpen: sessionOpen, priceClose: fp,
        priceChangePercent: sessionOpen > 0 ? ((fp - sessionOpen) / sessionOpen) * 100 : 0,
    });
    wb.set(roundRef, { current: roundNumber }, { merge: true });

    await wb.commit();

    console.log(
        `[TradingEngine] Done: ${totalMicro} micro-rounds, ${allFills.length} trades, ` +
        `$${tv.toFixed(2)} vol, ${sessionOpen.toFixed(4)}->${fp.toFixed(4)} [${Date.now() - invocationStart}ms]`,
    );
}

function mkSnap(ob, md, ag) {
    return {
        currentPrice: ob.lastPrice, avgPrice20: md.lastPrice || ob.lastPrice,
        change24h: md.changePercent24h || 0,
        bestBid: ob.getBestBid(), bestAsk: ob.getBestAsk(), spread: ob.getSpreadPct(),
        bidDepth: ob.getBidDepth(), askDepth: ob.getAskDepth(),
        usdtBalance: ag.balances?.USDT || 0, vcnBalance: ag.balances?.VCN || 0,
        openOrders: "None", recentTradesStr: "None",
    };
}

function execDec(ob, ag, dec, rn, ts) {
    const oid = `ord-${ag.id}-${rn}-${Math.random().toString(36).substr(2, 4)}`;
    let fills = [];
    const side = dec.action || dec.side;
    const orderType = dec.orderType || dec.type;

    if (orderType === "market") {
        fills = ob.executeMarketOrder(oid, ag.id, ag.ownerUid, side, dec.amount);
    } else {
        const r = ob.addLimitOrder({
            id: oid, agentId: ag.id, ownerUid: ag.ownerUid,
            side: side, price: dec.price, remainingAmount: dec.amount,
            isTradingOrder: false, timestamp: ts,
        });
        if (r === "crosses") fills = ob.executeMarketOrder(oid, ag.id, ag.ownerUid, side, dec.amount, dec.price);
    }
    return fills.map((f) => ({ ...f, reasoning: dec.reasoning, time: ts }));
}

module.exports = { runMicroRoundEngine };
