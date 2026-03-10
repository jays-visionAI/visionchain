/**
 * Exception Rules - Pre-trade Safety Checks
 *
 * Implements the 8 "Things We Never Do" from Vision Quant Engine USP.
 * Each rule returns { blocked: boolean, reason: string } if the trade should be skipped.
 *
 * Rules:
 * 1. Chase-buy block (price already surged)
 * 2. Spread guard (abnormal bid-ask spread) - requires live spread data
 * 3. Exchange delay guard (API latency) - requires latency measurement
 * 4. Extreme volatility halt - handled by Volatility Overlay
 * 5. Daily loss limit halt - handled by checkRiskLimits
 * 6. Consecutive loss pause - handled by checkRiskLimits
 * 7. Downtrend position reduction (200 EMA slope negative)
 * 8. News crash detect (sudden price drop)
 */

const { ema, sma } = require("./indicators");

/**
 * Rule 1: Chase-buy Block
 * Skip if price has risen more than threshold in last N periods.
 * Prevents buying into a pump.
 *
 * @param {number} currentPrice
 * @param {number[]} closes - Recent close history
 * @param {number} threshold - Max allowed rise % in lookback (default: 15%)
 * @param {number} lookback - Number of periods to check (default: 24 = ~24 hours)
 */
function chaseBuyBlock(currentPrice, closes, threshold = 15, lookback = 24) {
    if (!closes || closes.length < lookback) return { blocked: false };
    const pastPrice = closes[closes.length - lookback];
    if (!pastPrice || pastPrice <= 0) return { blocked: false };

    const changePct = ((currentPrice - pastPrice) / pastPrice) * 100;
    if (changePct > threshold) {
        return { blocked: true, reason: `Chase-buy blocked: +${changePct.toFixed(1)}% in ${lookback} periods (limit: ${threshold}%)` };
    }
    return { blocked: false };
}

/**
 * Rule 2: Spread Guard
 * Skip if bid-ask spread is abnormally wide.
 * (Requires live order book data - returns unblocked if no spread data)
 *
 * @param {number} bidPrice
 * @param {number} askPrice
 * @param {number} maxSpreadPct - Maximum spread % (default: 1%)
 */
function spreadGuard(bidPrice, askPrice, maxSpreadPct = 1.0) {
    if (!bidPrice || !askPrice || bidPrice <= 0) return { blocked: false };
    const spreadPct = ((askPrice - bidPrice) / bidPrice) * 100;
    if (spreadPct > maxSpreadPct) {
        return { blocked: true, reason: `Spread guard: ${spreadPct.toFixed(2)}% spread (limit: ${maxSpreadPct}%)` };
    }
    return { blocked: false };
}

/**
 * Rule 3: Exchange Delay Guard
 * Skip if API response time exceeds threshold.
 *
 * @param {number} latencyMs - API response time in ms
 * @param {number} maxLatencyMs - Maximum acceptable latency (default: 3000ms)
 */
function exchangeDelayGuard(latencyMs, maxLatencyMs = 3000) {
    if (latencyMs === null || latencyMs === undefined) return { blocked: false };
    if (latencyMs > maxLatencyMs) {
        return { blocked: true, reason: `Exchange delay: ${latencyMs}ms (limit: ${maxLatencyMs}ms)` };
    }
    return { blocked: false };
}

/**
 * Rule 7: Downtrend Position Reduction
 * Reduce position size if the long-term trend is bearish.
 * Returns a scale factor (0.0 - 1.0).
 *
 * @param {number[]} closes
 * @param {number} emaPeriod - EMA period to check trend (default: 200)
 * @returns {{ scale: number, inDowntrend: boolean, reason: string }}
 */
function downtrendReduction(closes, emaPeriod = 200) {
    if (!closes || closes.length < emaPeriod) return { scale: 1.0, inDowntrend: false };

    const currentEma = ema(closes, emaPeriod);
    const prevEma = ema(closes.slice(0, -1), emaPeriod);
    const currentPrice = closes[closes.length - 1];

    if (currentEma === null || prevEma === null) return { scale: 1.0, inDowntrend: false };

    // Price below 200 EMA AND EMA slope is negative
    const slopeNegative = currentEma < prevEma;
    const priceBelowEma = currentPrice < currentEma;

    if (priceBelowEma && slopeNegative) {
        // How far below EMA determines reduction
        const deviationPct = ((currentEma - currentPrice) / currentEma) * 100;
        let scale = 1.0;
        if (deviationPct > 10) scale = 0.25;
        else if (deviationPct > 5) scale = 0.5;
        else scale = 0.75;

        return {
            scale,
            inDowntrend: true,
            reason: `Downtrend: price ${deviationPct.toFixed(1)}% below EMA${emaPeriod}, scale=${(scale * 100).toFixed(0)}%`,
        };
    }

    return { scale: 1.0, inDowntrend: false };
}

/**
 * Rule 8: News Crash Detect
 * Skip if price dropped more than threshold in a short time.
 * Detects sudden, violent drops that may indicate news events or flash crashes.
 *
 * @param {number} currentPrice
 * @param {number[]} closes - Recent close history (should be short-interval, e.g., 5m candles)
 * @param {number} threshold - Max allowed drop % (default: 5%)
 * @param {number} lookback - Number of short-interval candles (default: 12 = ~1 hour of 5m candles)
 */
function newsCrashDetect(currentPrice, closes, threshold = 5, lookback = 12) {
    if (!closes || closes.length < lookback) return { blocked: false };
    const recentHigh = Math.max(...closes.slice(-lookback));
    if (recentHigh <= 0) return { blocked: false };

    const dropPct = ((recentHigh - currentPrice) / recentHigh) * 100;
    if (dropPct > threshold) {
        return { blocked: true, reason: `Crash detected: -${dropPct.toFixed(1)}% in ${lookback} periods (limit: ${threshold}%)` };
    }
    return { blocked: false };
}

/**
 * Run all applicable exception rules for a BUY signal.
 * Returns { blocked, reasons[], downtrendScale }
 *
 * @param {object} opts
 * @param {number} opts.currentPrice
 * @param {number[]} opts.closes
 * @param {object} opts.params - Agent params for customizing thresholds
 * @param {number} [opts.bidPrice]
 * @param {number} [opts.askPrice]
 * @param {number} [opts.latencyMs]
 */
function checkAllExceptions(opts) {
    const { currentPrice, closes, params = {}, bidPrice, askPrice, latencyMs } = opts;
    const reasons = [];
    let downtrendScale = 1.0;

    // Rule 1: Chase-buy
    const chaseThreshold = Number(params.chase_buy_threshold) || 15;
    const chase = chaseBuyBlock(currentPrice, closes, chaseThreshold);
    if (chase.blocked) reasons.push(chase.reason);

    // Rule 2: Spread guard
    const maxSpread = Number(params.max_spread_pct) || 1.0;
    const spread = spreadGuard(bidPrice, askPrice, maxSpread);
    if (spread.blocked) reasons.push(spread.reason);

    // Rule 3: Exchange delay
    const maxLatency = Number(params.max_exchange_latency_ms) || 3000;
    const delay = exchangeDelayGuard(latencyMs, maxLatency);
    if (delay.blocked) reasons.push(delay.reason);

    // Rule 7: Downtrend reduction
    const downtrend = downtrendReduction(closes);
    if (downtrend.inDowntrend) {
        downtrendScale = downtrend.scale;
        reasons.push(downtrend.reason);
    }

    // Rule 8: News crash detect
    const crashThreshold = Number(params.crash_detect_threshold) || 5;
    const crash = newsCrashDetect(currentPrice, closes, crashThreshold);
    if (crash.blocked) reasons.push(crash.reason);

    // blocked = any hard block (excluding downtrend which only reduces size)
    const hardBlocked = chase.blocked || spread.blocked || delay.blocked || crash.blocked;

    return {
        blocked: hardBlocked,
        reasons,
        downtrendScale,
    };
}

module.exports = {
    chaseBuyBlock,
    spreadGuard,
    exchangeDelayGuard,
    downtrendReduction,
    newsCrashDetect,
    checkAllExceptions,
};
