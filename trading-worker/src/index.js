/**
 * Vision Quant Engine - Live Trading Worker
 *
 * Entry point for Railway deployment.
 * Always-on process that:
 * 1. Connects to Firestore (Firebase Admin SDK)
 * 2. Watches for active live agents in real-time
 * 3. Subscribes to exchange WebSockets for price data
 * 4. Evaluates signals using the Signal Engine
 * 5. Executes orders via exchange REST APIs
 * 6. Updates agent state in Firestore
 *
 * Architecture:
 *   Firestore (agent configs) ←→ Worker ←→ Exchange APIs
 *   Frontend reads Firestore in real-time via onSnapshot
 */

const { initFirebase, getDb } = require("./firestoreClient");
const { ema, sma, rsi, macd, bollinger, atr, obv, williamsR, ultimateOscillator, donchianChannel, vwap, zScore } = require("./indicators");
const {
    fetchCandles, fetchPrices, placeOrder, placeFuturesOrder,
    fetchFundingRate, fetchFuturesCandles, toExchangeMarket,
} = require("./exchangeAdapter");
const { scaleOrderSize } = require("./volatilityOverlay");
const { checkAllExceptions } = require("./exceptionRules");
const crypto = require("crypto");

// ─── Constants ──────────────────────────────────────────────────────────────

const LOOP_INTERVAL_MS = 10_000;  // 10 seconds between evaluation cycles
const AGENT_RELOAD_MS = 60_000;   // Reload agents every 60 seconds
const CANDLE_REFRESH_MS = 300_000; // Refresh candle data every 5 minutes

// ─── AES Decryption (mirrors functions/index.js) ────────────────────────────

function getEncryptionKey() {
    const projectId = process.env.FIREBASE_PROJECT_ID || "vision-chain";
    return crypto.createHash("sha256").update(projectId + "_exchange_key_salt_v1").digest();
}

function decryptApiKey(ciphertext) {
    const key = getEncryptionKey();
    const [ivHex, encrypted] = ciphertext.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// ─── Signal Engine (simplified - mirrors functions/index.js) ────────────────

function evaluateSignals(agent, prices, priceHistory, volumeHistory) {
    const signals = [];
    const params = agent.params || {};
    const closes = {};
    const volumes = {};

    for (const asset of (agent.selectedAssets || [])) {
        closes[asset] = priceHistory[asset] || [];
        volumes[asset] = volumeHistory[asset] || [];

        const price = prices[asset];
        if (!price) continue;

        const strategyId = agent.strategyId || "";

        // ── DCA: time-based buy, no candle history required ──
        if (strategyId.includes("dca")) {
            const intervalStr = params.dca_interval || "4h";
            const intervalMs = {
                "1h": 3600000, "4h": 14400000, "12h": 43200000,
                "1d": 86400000, "7d": 604800000,
            }[intervalStr] || 14400000;
            const lastBuy = agent.lastDcaBuyAt ? new Date(agent.lastDcaBuyAt).getTime() : 0;
            const elapsed = Date.now() - lastBuy;
            if (elapsed >= intervalMs) {
                signals.push({ asset, side: "buy", reason: `DCA: ${intervalStr} interval elapsed`, isDca: true });
            }
            continue; // DCA doesn't use technical signals
        }

        const c = closes[asset];
        if (c.length < 30) continue;

        // Spot strategies
        if (strategyId.includes("trend") && !strategyId.includes("futures")) {
            const fastPeriod = Number(params.fast_ema) || 12;
            const slowPeriod = Number(params.slow_ema) || 26;
            const emaFast = ema(c, fastPeriod);
            const emaSlow = ema(c, slowPeriod);
            if (emaFast && emaSlow && emaFast > emaSlow && price > emaSlow) {
                signals.push({ asset, side: "buy", reason: `EMA ${fastPeriod} > ${slowPeriod}` });
            }
        }

        if (strategyId.includes("bollinger") || strategyId.includes("mean_reversion")) {
            const bbStd = Number(params.bb_stddev) || 2;
            const bb = bollinger(c, 20, bbStd);
            if (bb && price <= bb.lower) {
                signals.push({ asset, side: "buy", reason: `Price <= BB Lower (${bbStd}σ)` });
            }
        }

        if (strategyId.includes("rsi") || strategyId.includes("reversal")) {
            const rsiVal = rsi(c, Number(params.rsi_period) || 14);
            const entryLevel = Number(params.rsi_entry) || 30;
            if (rsiVal !== null && rsiVal <= entryLevel) {
                signals.push({ asset, side: "buy", reason: `RSI ${rsiVal.toFixed(1)} <= ${entryLevel}` });
            }
        }

        if (strategyId.includes("breakout") || strategyId.includes("donchian")) {
            const period = Number(params.donchian_period) || 20;
            if (c.length >= period) {
                const high = Math.max(...c.slice(-period));
                if (price >= high) {
                    signals.push({ asset, side: "buy", reason: `Donchian ${period}d breakout` });
                }
            }
        }

        // ── Multi-Factor Quant Guard ──
        if (strategyId.includes("multi_factor") || strategyId.includes("quant_guard")) {
            let factors = 0;
            const ema50 = ema(c, 50);
            const ema200 = ema(c, 200);
            // Factor 1: Trend (price > EMA50 > EMA200)
            if (ema50 && ema200 && price > ema50 && ema50 > ema200) factors++;
            // Factor 2: Momentum (RSI between 40-60 recovering)
            const rsiVal = rsi(c, 14);
            if (rsiVal !== null && rsiVal > 40 && rsiVal < 65) factors++;
            // Factor 3: Volume (OBV rising)
            const v = volumes[asset];
            if (v && v.length >= 20) {
                const obvCurrent = obv(c, v);
                const obvPrev = obv(c.slice(0, -5), v.slice(0, -5));
                if (obvCurrent !== null && obvPrev !== null && obvCurrent > obvPrev) factors++;
            }
            // Factor 4: Volatility (ATR not extreme)
            const atrVal = atr(null, null, c, 14);
            const sma20 = sma(c, 20);
            if (atrVal && sma20 && (atrVal / sma20) < 0.05) factors++;
            // Require at least 3 of 4 factors
            if (factors >= 3) {
                signals.push({ asset, side: "buy", reason: `Multi-Factor: ${factors}/4 confirmed` });
            }
        }

        // ── Turtle Trading Crypto ──
        if (strategyId.includes("turtle")) {
            const entry = Number(params.donchian_period) || 20;
            const exitP = Number(params.exit_period) || 10;
            if (c.length >= entry) {
                const entryHigh = Math.max(...c.slice(-entry));
                const exitLow = Math.min(...c.slice(-exitP));
                const atrVal = atr(null, null, c, 14);
                if (price >= entryHigh && atrVal) {
                    // ATR-based N-unit sizing: smaller positions when ATR is high
                    signals.push({ asset, side: "buy", reason: `Turtle: ${entry}d breakout`, atrUnit: atrVal });
                }
                // Exit: price below exit-period low
                for (const pos of (agent.positions || [])) {
                    if (pos.asset === asset && price <= exitLow) {
                        signals.push({ asset, side: "sell", reason: `Turtle exit: below ${exitP}d low` });
                    }
                }
            }
        }

        // ── Williams Volatility Breakout ──
        if (strategyId.includes("williams") || strategyId.includes("volatility_breakout")) {
            const wrVal = williamsR(null, null, c, Number(params.williams_period) || 14);
            const uoVal = ultimateOscillator(null, null, c);
            if (wrVal !== null && uoVal !== null) {
                // Buy: Williams %R < -80 (oversold) AND Ultimate Oscillator > 30 (not dying)
                if (wrVal < -80 && uoVal > 30) {
                    signals.push({ asset, side: "buy", reason: `Williams: %R=${wrVal.toFixed(1)}, UO=${uoVal.toFixed(1)}` });
                }
                // Sell: Williams %R > -20 (overbought)
                for (const pos of (agent.positions || [])) {
                    if (pos.asset === asset && wrVal > -20) {
                        signals.push({ asset, side: "sell", reason: `Williams exit: %R=${wrVal.toFixed(1)} overbought` });
                    }
                }
            }
        }

        // ── Minervini VCP Momentum ──
        if (strategyId.includes("minervini") || strategyId.includes("vcp")) {
            const ema50 = ema(c, 50);
            const ema150 = ema(c, 150);
            const ema200 = ema(c, 200);
            const rsiVal = rsi(c, 14);
            if (ema50 && ema150 && ema200) {
                // SEPA Trend Template: price > EMA50 > EMA150 > EMA200, all rising
                const trendTemplate = price > ema50 && ema50 > ema150 && ema150 > ema200;
                // VCP: volatility contracting (recent range < older range)
                const recentRange = c.length >= 10 ? (Math.max(...c.slice(-10)) - Math.min(...c.slice(-10))) / sma(c, 10) : 999;
                const olderRange = c.length >= 30 ? (Math.max(...c.slice(-30, -10)) - Math.min(...c.slice(-30, -10))) / sma(c.slice(0, -10), 20) : 0;
                const vcpContracting = recentRange < olderRange * 0.7;
                if (trendTemplate && vcpContracting && rsiVal > 50) {
                    signals.push({ asset, side: "buy", reason: `Minervini VCP: trend confirmed, volatility contracting` });
                }
            }
        }

        // ── Livermore Trend Pyramid ──
        if (strategyId.includes("livermore") || strategyId.includes("pyramid")) {
            const ema20 = ema(c, 20);
            const ema50 = ema(c, 50);
            if (ema20 && ema50 && price > ema20 && ema20 > ema50) {
                // Check for confirmed higher lows (last 3 swing lows rising)
                const lows = [];
                for (let i = 2; i < Math.min(c.length - 1, 60); i++) {
                    if (c[c.length - i] < c[c.length - i - 1] && c[c.length - i] < c[c.length - i + 1]) {
                        lows.push(c[c.length - i]);
                    }
                    if (lows.length >= 3) break;
                }
                const higherLows = lows.length >= 2 && lows[0] > lows[1];
                // Pyramiding: add to existing position if already in profit
                const existingPos = (agent.positions || []).find(p => p.asset === asset);
                if (higherLows) {
                    if (!existingPos) {
                        signals.push({ asset, side: "buy", reason: `Livermore: higher lows confirmed, initial entry` });
                    } else if (existingPos.unrealizedPnlPercent > 2) {
                        signals.push({ asset, side: "buy", reason: `Livermore: pyramid add (+${existingPos.unrealizedPnlPercent?.toFixed(1)}% profit)` });
                    }
                }
            }
            // Exit: price below EMA50
            const ema50exit = ema(c, 50);
            if (ema50exit && price < ema50exit) {
                for (const pos of (agent.positions || [])) {
                    if (pos.asset === asset) {
                        signals.push({ asset, side: "sell", reason: `Livermore exit: below EMA50` });
                    }
                }
            }
        }

        // Futures strategies
        if (strategyId.includes("futures")) {
            const leverage = Number(params.leverage) || 3;
            const fastP = Number(params.fast_ema) || 20;
            const slowP = Number(params.slow_ema) || 50;
            const emaF = ema(c, fastP);
            const emaS = ema(c, slowP);

            if (strategyId.includes("leveraged_trend")) {
                if (emaF && emaS) {
                    if (emaF > emaS && price > emaS) {
                        signals.push({ asset, side: "buy", reason: `Futures LONG: EMA cross up (${leverage}x)`, leverage, direction: "long" });
                    } else if (emaF < emaS && price < emaS) {
                        signals.push({ asset, side: "sell", reason: `Futures SHORT: EMA cross down (${leverage}x)`, leverage, direction: "short" });
                    }
                }
            }

            if (strategyId.includes("scalper")) {
                const rsiVal = rsi(c, 14);
                if (rsiVal && rsiVal <= 30) {
                    signals.push({ asset, side: "buy", reason: `Scalper LONG: RSI ${rsiVal.toFixed(1)}`, leverage: Number(params.leverage) || 2, direction: "long" });
                } else if (rsiVal && rsiVal >= 70) {
                    signals.push({ asset, side: "sell", reason: `Scalper SHORT: RSI ${rsiVal.toFixed(1)}`, leverage: Number(params.leverage) || 2, direction: "short" });
                }
            }

            // ── Funding Rate Arbitrage ──
            if (strategyId.includes("funding") || strategyId.includes("arbitrage")) {
                // Market-neutral: profit from funding rate payments
                // If funding rate is extremely positive, short perp to collect funding
                // Note: actual funding rate data should come from exchange
                const fundingThreshold = Number(params.funding_threshold) || 0.03; // 3% annualized
                signals.push({ asset, side: "buy", reason: `Funding Arb: monitor mode`, leverage: 1, direction: "long", fundingArb: true });
            }

            // ── Short Squeeze Hunter ──
            if (strategyId.includes("short_squeeze") || strategyId.includes("squeeze")) {
                const rsiVal = rsi(c, 14);
                const atrVal = atr(null, null, c, 14);
                const sma20 = sma(c, 20);
                // Look for: oversold RSI + high ATR (volatility) + price near resistance
                const nearResistance = c.length >= 20 && price >= Math.max(...c.slice(-20)) * 0.98;
                if (rsiVal && rsiVal < 35 && atrVal && sma20 && (atrVal / sma20) > 0.03 && nearResistance) {
                    const sqLev = Number(params.leverage) || 5;
                    signals.push({ asset, side: "buy", reason: `Squeeze Hunter: RSI=${rsiVal.toFixed(1)}, high ATR, near resistance`, leverage: sqLev, direction: "long" });
                }
            }

            // ── Long-Short Balance ──
            if (strategyId.includes("long_short") || strategyId.includes("balance")) {
                // Pairs/mean-reversion: use Z-score of price ratio
                if (c.length >= 30) {
                    const zVal = zScore(c, 20);
                    const entryZ = Number(params.entry_zscore) || 2.0;
                    const exitZ = Number(params.exit_zscore) || 0.5;
                    if (zVal !== null) {
                        if (zVal < -entryZ) {
                            signals.push({ asset, side: "buy", reason: `L/S Balance: Z=${zVal.toFixed(2)} < -${entryZ} (long)`, leverage: Number(params.leverage) || 1, direction: "long" });
                        } else if (zVal > entryZ) {
                            signals.push({ asset, side: "sell", reason: `L/S Balance: Z=${zVal.toFixed(2)} > ${entryZ} (short)`, leverage: Number(params.leverage) || 1, direction: "short" });
                        }
                        // Exit when Z returns to mean
                        for (const pos of (agent.positions || [])) {
                            if (pos.asset === asset && Math.abs(zVal) < exitZ) {
                                signals.push({ asset, side: "sell", reason: `L/S Balance exit: Z=${zVal.toFixed(2)} mean reverted` });
                            }
                        }
                    }
                }
            }
        }

        // Exit checks for existing positions
        for (const pos of (agent.positions || [])) {
            if (pos.asset !== asset) continue;
            const exitPct = prices[asset] && pos.avgEntryPrice
                ? ((prices[asset] - pos.avgEntryPrice) / pos.avgEntryPrice) * 100 : 0;

            const stopLoss = Number(params.stop_loss) || 5;
            const takeProfit = Number(params.take_profit) || 10;

            if (exitPct <= -stopLoss) {
                signals.push({ asset, side: "sell", reason: `Stop loss: ${exitPct.toFixed(1)}%` });
            } else if (exitPct >= takeProfit) {
                signals.push({ asset, side: "sell", reason: `Take profit: ${exitPct.toFixed(1)}%` });
            }
        }
    }

    return signals;
}

// ─── Risk Engine Checks ─────────────────────────────────────────────────────

function checkRiskLimits(agent) {
    const params = agent.params || {};
    const rs = agent.riskStatus || {
        dailyPnl: 0, weeklyPnl: 0, consecutiveLosses: 0,
        todayTradeCount: 0, cooldownUntil: null,
        dailyResetDate: "", weeklyResetWeek: "",
    };

    const today = new Date().toISOString().split("T")[0];
    const currentWeek = `${new Date().getFullYear()}-W${Math.ceil((new Date().getDate()) / 7)}`;

    if (rs.dailyResetDate !== today) {
        rs.dailyPnl = 0;
        rs.todayTradeCount = 0;
        rs.dailyResetDate = today;
    }
    if (rs.weeklyResetWeek !== currentWeek) {
        rs.weeklyPnl = 0;
        rs.weeklyResetWeek = currentWeek;
    }

    // Cooldown
    if (rs.cooldownUntil && Date.now() < new Date(rs.cooldownUntil).getTime()) {
        return { blocked: true, reason: "Cooldown active", rs };
    } else if (rs.cooldownUntil) {
        rs.cooldownUntil = null;
        rs.consecutiveLosses = 0;
    }

    // Daily loss
    const dailyLimit = Number(params.daily_loss_limit) || 2;
    if (rs.dailyPnl <= -dailyLimit) {
        return { blocked: true, reason: `Daily loss ${rs.dailyPnl.toFixed(2)}% >= -${dailyLimit}%`, rs, shouldPause: true };
    }

    // Weekly loss
    const weeklyLimit = Number(params.weekly_loss_limit) || 5;
    if (rs.weeklyPnl <= -weeklyLimit) {
        return { blocked: true, reason: `Weekly loss ${rs.weeklyPnl.toFixed(2)}% >= -${weeklyLimit}%`, rs, shouldPause: true };
    }

    // Consecutive losses
    const maxConsec = Number(params.consecutive_loss_pause) || 2;
    if (rs.consecutiveLosses >= maxConsec) {
        const cooldownHours = Number(params.cooldown_after_loss_hours) || 6;
        rs.cooldownUntil = new Date(Date.now() + cooldownHours * 3600000).toISOString();
        return { blocked: true, reason: `${rs.consecutiveLosses} consecutive losses`, rs, shouldPause: true };
    }

    return { blocked: false, rs };
}

// ─── Main Loop ──────────────────────────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  Vision Quant Engine - Live Trading Worker v1.0");
    console.log("═══════════════════════════════════════════════════════");

    const db = initFirebase();

    // State
    let agents = [];
    let lastAgentLoad = 0;
    let candleCache = {};       // { [exchange]: { [market]: { closes, volumes, fetchedAt } } }
    let exchangeKeys = {};      // { [keyId]: { accessKey, secretKey, passphrase } }

    // ── Agent loader ──
    async function loadAgents() {
        try {
            const snap = await db.collection("paperAgents")
                .where("tradingMode", "==", "live")
                .where("status", "in", ["running", "active"])
                .get();
            agents = snap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));
            lastAgentLoad = Date.now();
            console.log(`[Worker] Loaded ${agents.length} active live agents`);
        } catch (err) {
            console.error("[Worker] Failed to load agents:", err.message);
        }
    }

    // ── Exchange key loader ──
    async function loadExchangeKey(keyId) {
        if (exchangeKeys[keyId]) return exchangeKeys[keyId];
        try {
            const snap = await db.collection("exchangeKeys").doc(keyId).get();
            if (!snap.exists || !snap.data()?.isValid) return null;
            const data = snap.data();
            exchangeKeys[keyId] = {
                accessKey: decryptApiKey(data.encryptedKey),
                secretKey: decryptApiKey(data.encryptedSecret),
                passphrase: data.encryptedPassphrase ? decryptApiKey(data.encryptedPassphrase) : null,
                exchange: data.exchange,
            };
            return exchangeKeys[keyId];
        } catch (err) {
            console.error(`[Worker] Failed to load key ${keyId}:`, err.message);
            return null;
        }
    }

    // ── Kill Switch checker ──
    async function isKillSwitchActive() {
        try {
            const snap = await db.doc("quantEngine/config").get();
            return snap.exists && snap.data()?.globalPause === true;
        } catch {
            return false;
        }
    }

    // ── Candle fetcher with cache ──
    async function getCandleData(exchange, market, isFutures = false) {
        const cacheKey = `${exchange}:${market}`;
        const cached = candleCache[cacheKey];
        if (cached && Date.now() - cached.fetchedAt < CANDLE_REFRESH_MS) {
            return { closes: cached.closes, volumes: cached.volumes };
        }

        const data = isFutures
            ? await fetchFuturesCandles(exchange, market, 100)
            : await fetchCandles(exchange, market, 100);

        if (data.closes.length > 0) {
            candleCache[cacheKey] = { ...data, fetchedAt: Date.now() };
        }
        return data;
    }

    // ── Decision Log Writer ──
    async function writeDecisionLogs(db, agent, entries) {
        if (!entries || entries.length === 0) return;
        try {
            const batch = db.batch();
            const now = new Date().toISOString();
            for (const entry of entries) {
                const logId = `dl_${agent.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                const docRef = db.collection("decisionLogs").doc(logId);
                batch.set(docRef, {
                    id: logId,
                    agentId: agent.id,
                    userId: agent.userId,
                    strategyId: agent.strategyId,
                    exchange: agent.exchange || "upbit",
                    timestamp: now,
                    signal: entry.signal || { side: "none", asset: "-", reason: "", strength: 0 },
                    risk: entry.risk || { approved: true },
                    execution: entry.execution || null,
                    marketSnapshot: entry.marketSnapshot || {},
                    volatilityOverlay: entry.volatilityOverlay || null,
                    exceptionRules: entry.exceptionRules || null,
                });
            }
            await batch.commit();
        } catch (err) {
            console.warn(`[Worker] Decision log write failed: ${err.message}`);
        }
    }

    // ── Daily PnL Snapshot Writer ──
    async function writeDailyPnlSnapshot(db, agent, totalValue, totalPnl, totalPnlPercent) {
        try {
            const today = new Date().toISOString().split("T")[0];
            const snapshotId = `${agent.id}_${today}`;
            const docRef = db.collection("paperDailyPnl").doc(snapshotId);
            const existing = await docRef.get();

            if (existing.exists) {
                // Update existing snapshot for today
                await docRef.update({
                    portfolioValue: totalValue,
                    pnl: totalPnl,
                    pnlPercent: totalPnlPercent,
                    cumulativePnl: totalPnl,
                    cumulativeReturn: totalPnlPercent,
                    updatedAt: new Date().toISOString(),
                });
            } else {
                // Find yesterday's snapshot for cumulative calculation
                let prevCumulativePnl = 0;
                const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
                const prevSnap = await db.collection("paperDailyPnl")
                    .doc(`${agent.id}_${yesterday}`).get();
                if (prevSnap.exists) {
                    prevCumulativePnl = prevSnap.data().cumulativePnl || 0;
                }

                const dailyPnl = totalPnl - prevCumulativePnl;
                const dailyPnlPercent = agent.seed > 0 ? (dailyPnl / agent.seed) * 100 : 0;

                // Fetch BTC benchmark
                let benchmark = 0;
                try {
                    const axios = require("axios");
                    const btcResp = await axios.get(
                        "https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=2",
                        { timeout: 5000 }
                    );
                    if (btcResp.data && btcResp.data.length >= 2) {
                        const btcToday = btcResp.data[0].trade_price;
                        const btcYesterday = btcResp.data[1].trade_price;
                        benchmark = btcYesterday > 0
                            ? ((btcToday - btcYesterday) / btcYesterday) * 100 : 0;
                    }
                } catch { /* silent */ }

                await docRef.set({
                    agentId: agent.id,
                    userId: agent.userId,
                    date: today,
                    pnl: dailyPnl,
                    pnlPercent: dailyPnlPercent,
                    cumulativePnl: totalPnl,
                    cumulativeReturn: totalPnlPercent,
                    portfolioValue: totalValue,
                    benchmark,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        } catch (err) {
            console.warn(`[Worker] Daily PnL snapshot failed: ${err.message}`);
        }
    }

    // ── Main evaluation cycle ──
    async function runCycle() {
        // Kill Switch
        if (await isKillSwitchActive()) {
            console.log("[Worker] HALTED - Global Kill Switch active");
            return;
        }

        // Reload agents periodically
        if (Date.now() - lastAgentLoad > AGENT_RELOAD_MS || agents.length === 0) {
            await loadAgents();
        }

        if (agents.length === 0) return;

        // Group agents by exchange
        const byExchange = {};
        for (const agent of agents) {
            const exchange = agent.exchange || "upbit";
            if (!byExchange[exchange]) byExchange[exchange] = [];
            byExchange[exchange].push(agent);
        }

        // Process each exchange group
        for (const [exchange, exchangeAgents] of Object.entries(byExchange)) {
            // Collect all raw asset symbols for this exchange
            const allAssets = new Set();
            for (const agent of exchangeAgents) {
                for (const asset of (agent.selectedAssets || [])) allAssets.add(asset);
                for (const pos of (agent.positions || [])) allAssets.add(pos.asset);
            }
            const rawAssets = [...allAssets];

            // Convert raw assets to exchange-specific market codes
            // e.g., "BTC" -> "KRW-BTC" (upbit), "BTCUSDT" (binance)
            const assetToMarket = {};  // BTC -> KRW-BTC
            const marketToAsset = {};  // KRW-BTC -> BTC
            const defaultQuote = exchange === "upbit" || exchange === "bithumb" || exchange === "coinone" ? "KRW" : "USDT";

            for (const asset of rawAssets) {
                let market;
                // Only consider as pre-formatted if it has a separator or is long enough (e.g., BTCUSDT=7 chars)
                if (asset.includes("-") || asset.includes("_") || (asset.length >= 6 && (asset.endsWith("USDT") || asset.endsWith("KRW")))) {
                    // Already formatted (KRW-BTC, BTCUSDT, etc.)
                    market = asset;
                } else {
                    // Bare symbol (BTC, ETH, USDT) -> needs conversion
                    market = toExchangeMarket(exchange, `${defaultQuote}-${asset}`);
                }
                assetToMarket[asset] = market;
                marketToAsset[market] = asset;
            }

            const markets = Object.values(assetToMarket);

            // Fetch prices (using exchange-formatted market codes)
            const rawPrices = await fetchPrices(exchange, markets);
            if (Object.keys(rawPrices).length === 0) {
                console.warn(`[Worker] No prices for ${exchange}, skipping`);
                continue;
            }

            // Map prices back to original asset names
            const prices = {};
            for (const [market, price] of Object.entries(rawPrices)) {
                const asset = marketToAsset[market] || market;
                prices[asset] = price;
            }

            // Fetch candle data (using exchange-formatted market codes)
            const priceHistory = {};
            const volumeHistory = {};
            for (const asset of rawAssets) {
                const market = assetToMarket[asset];
                const data = await getCandleData(exchange, market, false);
                priceHistory[asset] = data.closes;
                volumeHistory[asset] = data.volumes;
                await new Promise(r => setTimeout(r, 100)); // Rate limit
            }

            // Process each agent
            for (const agent of exchangeAgents) {
                try {
                    // Risk checks
                    const riskResult = checkRiskLimits(agent);
                    if (riskResult.blocked) {
                        if (riskResult.shouldPause) {
                            await agent.ref.update({
                                status: "paused_by_risk",
                                riskStatus: { ...riskResult.rs, pauseReason: riskResult.reason },
                                updatedAt: new Date().toISOString(),
                            });
                            console.log(`[Worker] Agent ${agent.id} RISK PAUSED: ${riskResult.reason}`);
                        }
                        // Still update portfolio values
                        const positions = (agent.positions || []).map(pos => {
                            const cp = prices[pos.asset] || pos.currentPrice;
                            return { ...pos, currentPrice: cp, value: pos.quantity * cp };
                        });
                        const totalValue = agent.cashBalance + positions.reduce((s, p) => s + p.value, 0);
                        await agent.ref.update({ positions, totalValue, updatedAt: new Date().toISOString(), riskStatus: riskResult.rs });
                        continue;
                    }

                    const rs = riskResult.rs;

                    // Signal evaluation
                    const signals = evaluateSignals(agent, prices, priceHistory, volumeHistory);
                    const decisionLogs = []; // Collect decision log entries for this cycle

                    if (signals.length === 0) {
                        // Heartbeat update
                        const positions = (agent.positions || []).map(pos => {
                            const cp = prices[pos.asset] || pos.currentPrice;
                            const value = pos.quantity * cp;
                            const unrealizedPnl = value - (pos.quantity * pos.avgEntryPrice);
                            const unrealizedPnlPercent = pos.avgEntryPrice > 0
                                ? ((cp - pos.avgEntryPrice) / pos.avgEntryPrice) * 100 : 0;
                            return { ...pos, currentPrice: cp, value, unrealizedPnl, unrealizedPnlPercent };
                        });
                        const totalValue = agent.cashBalance + positions.reduce((s, p) => s + p.value, 0);
                        const totalPnl = totalValue - agent.seed;
                        const totalPnlPercent = agent.seed > 0 ? (totalPnl / agent.seed) * 100 : 0;

                        await agent.ref.update({
                            positions, totalValue, totalPnl, totalPnlPercent,
                            riskStatus: rs, lastHeartbeatAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                        });

                        // Decision log: no signal
                        decisionLogs.push({
                            signal: { side: "none", asset: "-", reason: "No signals generated", strength: 0 },
                            risk: { approved: true },
                            marketSnapshot: { price: 0 },
                        });

                        // Write decision logs + daily PnL snapshot
                        await writeDecisionLogs(db, agent, decisionLogs);
                        await writeDailyPnlSnapshot(db, agent, totalValue, totalPnl, totalPnlPercent);
                        continue;
                    }

                    // Execute signals
                    let { cashBalance, positions = [], totalTrades: agentTotalTrades = 0,
                        winningTrades = 0, losingTrades = 0, bestTrade = 0, worstTrade = 0 } = agent;

                    const maxDailyTrades = Number(agent.params?.max_daily_trades) || 6;
                    const FEE_RATE = 0.0005;
                    const isFuturesStrategy = (agent.strategyId || "").includes("futures");

                    for (const signal of signals) {
                        const { asset, side, reason, leverage: sigLeverage, direction, atrUnit, isDca } = signal;
                        const price = prices[asset];
                        if (!price || price <= 0) continue;

                        const assetCloses = priceHistory[asset] || [];

                        // Price spike check (3% for live)
                        if (assetCloses.length >= 2) {
                            const prevPrice = assetCloses[assetCloses.length - 2];
                            const changePct = Math.abs((price - prevPrice) / prevPrice) * 100;
                            if (changePct > 3) continue;
                        }

                        if (side === "buy" && rs.todayTradeCount >= maxDailyTrades) continue;

                        if (side === "buy") {
                            let exceptions = { blocked: false, reasons: [], downtrendScale: 1.0 };
                            let volResult = { scaledSize: 0, scale: 1.0, bucket: "n/a", halted: false };
                            let orderBudget;

                            if (isDca) {
                                // ── DCA: simple percentage-of-seed sizing, skip exceptions & vol overlay ──
                                const orderPct = Number(agent.params?.order_pct) || 2;
                                orderBudget = agent.seed * (orderPct / 100);
                                orderBudget = Math.min(orderBudget, cashBalance * 0.95);
                                volResult.scaledSize = orderBudget;
                            } else {
                                // ── Exception Rules check ──
                                exceptions = checkAllExceptions({
                                    currentPrice: price,
                                    closes: assetCloses,
                                    params: agent.params || {},
                                });
                                if (exceptions.blocked) {
                                    console.log(`[Worker] Agent ${agent.id} signal BLOCKED: ${exceptions.reasons.join("; ")}`);
                                    decisionLogs.push({
                                        signal: { side, asset, reason, strength: 50 },
                                        risk: { approved: false, layer: "Exception", rejectReason: exceptions.reasons.join("; ") },
                                        marketSnapshot: { price },
                                    });
                                    continue;
                                }

                                orderBudget = cashBalance * 0.10;
                                const budgetConfig = agent.budgetConfig || {};
                                if (budgetConfig.maxOrderSizeEnabled && budgetConfig.maxOrderSize > 0) {
                                    orderBudget = Math.min(orderBudget, budgetConfig.maxOrderSize);
                                }
                                const maxPosPct = Number(agent.params?.max_position) || 10;
                                const totalVal = cashBalance + positions.reduce((s, p) => s + (p.value || 0), 0);
                                if (totalVal > 0) orderBudget = Math.min(orderBudget, totalVal * maxPosPct / 100);
                                orderBudget = Math.min(orderBudget, cashBalance * 0.90);

                                // ── Volatility Overlay (Layer 3) ──
                                volResult = scaleOrderSize(orderBudget, assetCloses);
                                if (volResult.halted) {
                                    console.log(`[Worker] Agent ${agent.id} HALTED by Volatility Overlay: ${asset} bucket=${volResult.bucket}`);
                                    decisionLogs.push({
                                        signal: { side, asset, reason, strength: 50 },
                                        risk: { approved: false, layer: "L3_Volatility", rejectReason: `Extreme volatility (bucket=${volResult.bucket}, ATR ratio=${volResult.atrRatio?.toFixed(2)})` },
                                        marketSnapshot: { price },
                                    });
                                    continue;
                                }
                                orderBudget = volResult.scaledSize;
                            }

                            // ── Downtrend reduction ──
                            if (exceptions.downtrendScale < 1.0) {
                                orderBudget *= exceptions.downtrendScale;
                            }

                            // ── Turtle ATR-based N-unit sizing ──
                            if (atrUnit && atrUnit > 0) {
                                const dollarVol = atrUnit * 1; // 1 unit
                                const accountRisk = totalVal * 0.01; // 1% risk per trade
                                const turtleBudget = accountRisk / (atrUnit / price);
                                orderBudget = Math.min(orderBudget, turtleBudget);
                            }

                            const minOrder = agent.seedCurrency === "KRW" ? 5000 : 5;
                            if (orderBudget < minOrder) continue;

                            const limitPrice = price * 0.999;
                            const fee = orderBudget * FEE_RATE;
                            const netAmount = orderBudget - fee;
                            const quantity = netAmount / limitPrice;

                            // Attempt real order if exchange key is available
                            let orderResult = { success: true, orderId: `sim_${Date.now()}` };
                            if (agent.exchangeAccountId) {
                                const keyData = await loadExchangeKey(agent.exchangeAccountId);
                                if (keyData) {
                                    if (isFuturesStrategy) {
                                        const futuresConfig = agent.futuresConfig || {};
                                        orderResult = await placeFuturesOrder(
                                            keyData.exchange, keyData.accessKey, keyData.secretKey, keyData.passphrase,
                                            asset, side, quantity, limitPrice,
                                            sigLeverage || futuresConfig.defaultLeverage || 3,
                                            futuresConfig.marginType || "isolated"
                                        );
                                    } else {
                                        orderResult = await placeOrder(
                                            keyData.exchange, keyData.accessKey, keyData.secretKey, keyData.passphrase,
                                            asset, side, quantity, limitPrice
                                        );
                                    }
                                }
                            }

                            if (!orderResult.success) {
                                console.error(`[Worker] Order failed for ${agent.id}: ${orderResult.error}`);
                                continue;
                            }

                            cashBalance -= orderBudget;
                            positions.push({
                                asset, quantity, avgEntryPrice: limitPrice, currentPrice: price,
                                value: netAmount, unrealizedPnl: 0, unrealizedPnlPercent: 0,
                                orderId: orderResult.orderId,
                                leverage: isFuturesStrategy ? (sigLeverage || 3) : undefined,
                                direction: isFuturesStrategy ? (direction || "long") : undefined,
                            });
                            agentTotalTrades++;
                            rs.todayTradeCount++;

                            // Decision log: buy executed
                            decisionLogs.push({
                                signal: { side, asset, reason, strength: 60 },
                                risk: { approved: true },
                                execution: { orderId: orderResult.orderId, executedPrice: limitPrice, executedQty: quantity, fee },
                                marketSnapshot: { price },
                                volatilityOverlay: { bucket: volResult.bucket, scale: volResult.scale },
                                exceptionRules: exceptions.reasons.length > 0 ? { active: exceptions.reasons, downtrendScale: exceptions.downtrendScale } : undefined,
                            });

                            // Record trade
                            const tradeId = `lt_${agent.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                            await db.collection("paperTrades").doc(tradeId).set({
                                id: tradeId, agentId: agent.id, userId: agent.userId,
                                asset, side: "buy", price: limitPrice, quantity,
                                value: orderBudget, fee, pnl: 0, pnlPercent: 0,
                                strategy: agent.strategyName, signal: reason,
                                balanceAfter: cashBalance, executionType: "limit",
                                orderId: orderResult.orderId,
                                leverage: isFuturesStrategy ? sigLeverage : undefined,
                                exchange: agent.exchange || "upbit",
                                timestamp: new Date().toISOString(),
                            });

                        } else if (side === "sell") {
                            const posIdx = positions.findIndex(p => p.asset === asset);
                            if (posIdx === -1) continue;

                            const pos = positions[posIdx];
                            const limitPrice = price * 1.001;
                            const sellValue = pos.quantity * limitPrice;
                            const fee = sellValue * FEE_RATE;
                            const netProceeds = sellValue - fee;
                            const costBasis = pos.quantity * pos.avgEntryPrice;
                            const tradePnl = netProceeds - costBasis;
                            const tradePnlPct = costBasis > 0 ? (tradePnl / costBasis) * 100 : 0;

                            // Attempt real order
                            let orderResult = { success: true, orderId: `sim_${Date.now()}` };
                            if (agent.exchangeAccountId) {
                                const keyData = await loadExchangeKey(agent.exchangeAccountId);
                                if (keyData) {
                                    if (isFuturesStrategy) {
                                        orderResult = await placeFuturesOrder(
                                            keyData.exchange, keyData.accessKey, keyData.secretKey, keyData.passphrase,
                                            asset, side, pos.quantity, limitPrice,
                                            pos.leverage || 3, agent.futuresConfig?.marginType || "isolated"
                                        );
                                    } else {
                                        orderResult = await placeOrder(
                                            keyData.exchange, keyData.accessKey, keyData.secretKey, keyData.passphrase,
                                            asset, side, pos.quantity, limitPrice
                                        );
                                    }
                                }
                            }

                            if (!orderResult.success) {
                                console.error(`[Worker] Sell order failed for ${agent.id}: ${orderResult.error}`);
                                continue;
                            }

                            cashBalance += netProceeds;
                            positions.splice(posIdx, 1);
                            agentTotalTrades++;
                            rs.todayTradeCount++;

                            if (tradePnl >= 0) {
                                winningTrades++;
                                rs.consecutiveLosses = 0;
                            } else {
                                losingTrades++;
                                rs.consecutiveLosses++;
                                rs.lastLossAt = new Date().toISOString();
                                rs.dailyPnl += tradePnlPct;
                                rs.weeklyPnl += tradePnlPct;
                            }
                            if (tradePnlPct > bestTrade) bestTrade = tradePnlPct;
                            if (tradePnlPct < worstTrade) worstTrade = tradePnlPct;

                            const tradeId = `lt_${agent.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
                            await db.collection("paperTrades").doc(tradeId).set({
                                id: tradeId, agentId: agent.id, userId: agent.userId,
                                asset, side: "sell", price: limitPrice, quantity: pos.quantity,
                                value: sellValue, fee, pnl: tradePnl, pnlPercent: tradePnlPct,
                                strategy: agent.strategyName, signal: reason,
                                balanceAfter: cashBalance, executionType: "limit",
                                orderId: orderResult.orderId,
                                exchange: agent.exchange || "upbit",
                                timestamp: new Date().toISOString(),
                            });

                            // Decision log: sell executed
                            decisionLogs.push({
                                signal: { side, asset, reason, strength: 60 },
                                risk: { approved: true },
                                execution: { orderId: orderResult.orderId, executedPrice: limitPrice, executedQty: pos.quantity, fee, pnl: tradePnl, pnlPercent: tradePnlPct },
                                marketSnapshot: { price },
                            });
                        }
                    }

                    // Update agent state
                    const updatedPositions = positions.map(pos => {
                        const cp = prices[pos.asset] || pos.currentPrice;
                        const value = pos.quantity * cp;
                        const unrealizedPnl = value - (pos.quantity * pos.avgEntryPrice);
                        const unrealizedPnlPercent = pos.avgEntryPrice > 0
                            ? ((cp - pos.avgEntryPrice) / pos.avgEntryPrice) * 100 : 0;
                        return { ...pos, currentPrice: cp, value, unrealizedPnl, unrealizedPnlPercent };
                    });

                    const totalValue = cashBalance + updatedPositions.reduce((s, p) => s + p.value, 0);
                    const totalPnl = totalValue - agent.seed;
                    const totalPnlPercent = agent.seed > 0 ? (totalPnl / agent.seed) * 100 : 0;
                    const winRate = agentTotalTrades > 0 ? (winningTrades / agentTotalTrades) * 100 : 0;

                    // Track if any DCA buy was executed this cycle
                    const dcaBuyExecuted = signals.some(s => s.isDca && s.side === "buy") && agentTotalTrades > (agent.totalTrades || 0);

                    await agent.ref.update({
                        cashBalance,
                        positions: updatedPositions,
                        totalValue, totalPnl, totalPnlPercent,
                        totalTrades: agentTotalTrades,
                        winningTrades, losingTrades, winRate,
                        bestTrade, worstTrade,
                        riskStatus: rs,
                        lastHeartbeatAt: new Date().toISOString(),
                        lastTradeAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        ...(dcaBuyExecuted ? { lastDcaBuyAt: new Date().toISOString() } : {}),
                    });

                    // Write decision logs + daily PnL snapshot
                    await writeDecisionLogs(db, agent, decisionLogs);
                    await writeDailyPnlSnapshot(db, agent, totalValue, totalPnl, totalPnlPercent);

                } catch (agentErr) {
                    console.error(`[Worker] Agent ${agent.id} error:`, agentErr.message);
                    try {
                        await agent.ref.update({
                            status: "error",
                            riskStatus: { ...(agent.riskStatus || {}), pauseReason: `Runtime error: ${agentErr.message}` },
                            updatedAt: new Date().toISOString(),
                        });
                    } catch {
                        // Agent update also failed
                    }
                }
            }
        }
    }

    // ── Start loop ──
    console.log("[Worker] Starting main loop...");
    await loadAgents();

    let lastCycleAt = null;
    let cycleCount = 0;
    const startedAt = new Date().toISOString();

    setInterval(async () => {
        try {
            await runCycle();
            lastCycleAt = new Date().toISOString();
            cycleCount++;
        } catch (err) {
            console.error("[Worker] Cycle error:", err.message);
        }
    }, LOOP_INTERVAL_MS);

    // Run first cycle immediately
    try {
        await runCycle();
        lastCycleAt = new Date().toISOString();
        cycleCount++;
    } catch (err) {
        console.error("[Worker] Initial cycle error:", err.message);
    }

    console.log(`[Worker] Running. Cycle interval: ${LOOP_INTERVAL_MS / 1000}s`);

    // ── HTTP Health Check (required for Cloud Run) ──
    const http = require("http");
    const PORT = process.env.PORT || 8080;

    const server = http.createServer(async (req, res) => {
        if (req.url === "/health" || req.url === "/") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                service: "vision-quant-live-worker",
                version: "1.0.0",
                agents: agents.length,
                cycleCount,
                lastCycleAt,
                startedAt,
                uptimeSeconds: Math.floor(process.uptime()),
            }));
        } else {
            res.writeHead(404);
            res.end("Not found");
        }
    });

    server.listen(PORT, () => {
        console.log(`[Worker] Health check server on port ${PORT}`);
    });
}

// ── Entry Point ──
main().catch(err => {
    console.error("[Worker] Fatal error:", err);
    process.exit(1);
});
