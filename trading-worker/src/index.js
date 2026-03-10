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
const { ema, sma, rsi, macd, bollinger } = require("./indicators");
const {
    fetchCandles, fetchPrices, placeOrder, placeFuturesOrder,
    fetchFundingRate, fetchFuturesCandles, toExchangeMarket,
} = require("./exchangeAdapter");
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

        const c = closes[asset];
        if (c.length < 30) continue;

        const price = prices[asset];
        if (!price) continue;

        const strategyId = agent.strategyId || "";

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
            // Collect all markets for this exchange
            const allMarkets = new Set();
            for (const agent of exchangeAgents) {
                for (const asset of (agent.selectedAssets || [])) allMarkets.add(asset);
                for (const pos of (agent.positions || [])) allMarkets.add(pos.asset);
            }
            const markets = [...allMarkets];

            // Fetch prices
            const prices = await fetchPrices(exchange, markets);
            if (Object.keys(prices).length === 0) {
                console.warn(`[Worker] No prices for ${exchange}, skipping`);
                continue;
            }

            // Fetch candle data
            const priceHistory = {};
            const volumeHistory = {};
            for (const market of markets) {
                const isFutures = exchange !== "upbit" && exchange !== "bithumb" && exchange !== "coinone";
                const data = await getCandleData(exchange, market, false);
                priceHistory[market] = data.closes;
                volumeHistory[market] = data.volumes;
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
                        continue;
                    }

                    // Execute signals
                    let { cashBalance, positions = [], totalTrades: agentTotalTrades = 0,
                        winningTrades = 0, losingTrades = 0, bestTrade = 0, worstTrade = 0 } = agent;

                    const maxDailyTrades = Number(agent.params?.max_daily_trades) || 6;
                    const FEE_RATE = 0.0005;
                    const isFuturesStrategy = (agent.strategyId || "").includes("futures");

                    for (const signal of signals) {
                        const { asset, side, reason, leverage: sigLeverage, direction } = signal;
                        const price = prices[asset];
                        if (!price || price <= 0) continue;

                        // Price spike check (3% for live)
                        const assetCloses = priceHistory[asset] || [];
                        if (assetCloses.length >= 2) {
                            const prevPrice = assetCloses[assetCloses.length - 2];
                            const changePct = Math.abs((price - prevPrice) / prevPrice) * 100;
                            if (changePct > 3) continue;
                        }

                        if (side === "buy" && rs.todayTradeCount >= maxDailyTrades) continue;

                        if (side === "buy") {
                            let orderBudget = cashBalance * 0.10;
                            const budgetConfig = agent.budgetConfig || {};
                            if (budgetConfig.maxOrderSizeEnabled && budgetConfig.maxOrderSize > 0) {
                                orderBudget = Math.min(orderBudget, budgetConfig.maxOrderSize);
                            }
                            const maxPosPct = Number(agent.params?.max_position) || 10;
                            const totalVal = cashBalance + positions.reduce((s, p) => s + (p.value || 0), 0);
                            if (totalVal > 0) orderBudget = Math.min(orderBudget, totalVal * maxPosPct / 100);
                            orderBudget = Math.min(orderBudget, cashBalance * 0.90);

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
                    });

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

    setInterval(async () => {
        try {
            await runCycle();
        } catch (err) {
            console.error("[Worker] Cycle error:", err.message);
        }
    }, LOOP_INTERVAL_MS);

    // Run first cycle immediately
    try {
        await runCycle();
    } catch (err) {
        console.error("[Worker] Initial cycle error:", err.message);
    }

    console.log(`[Worker] Running. Cycle interval: ${LOOP_INTERVAL_MS / 1000}s`);
}

// ── Entry Point ──
main().catch(err => {
    console.error("[Worker] Fatal error:", err);
    process.exit(1);
});
