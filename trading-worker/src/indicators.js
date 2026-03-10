/**
 * Technical Indicators (standalone for worker)
 *
 * Pure functions - no external dependencies.
 * Mirrors the TechIndicators object in functions/index.js.
 */

function ema(closes, period) {
    if (!closes || closes.length < period) return null;
    const k = 2 / (period + 1);
    let emaVal = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
        emaVal = closes[i] * k + emaVal * (1 - k);
    }
    return emaVal;
}

function sma(closes, period) {
    if (!closes || closes.length < period) return null;
    const slice = closes.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(closes, period = 14) {
    if (!closes || closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
    if (!closes || closes.length < slow + signal) return null;
    const emaFast = ema(closes, fast);
    const emaSlow = ema(closes, slow);
    if (emaFast === null || emaSlow === null) return null;
    const macdLine = emaFast - emaSlow;

    // Approximate signal line
    const macdValues = [];
    for (let i = slow; i <= closes.length; i++) {
        const slice = closes.slice(0, i);
        const f = ema(slice, fast);
        const s = ema(slice, slow);
        if (f !== null && s !== null) macdValues.push(f - s);
    }

    if (macdValues.length < signal) return { macdLine, signalLine: 0, histogram: macdLine };
    const signalLine = macdValues.slice(-signal).reduce((a, b) => a + b, 0) / signal;
    return { macdLine, signalLine, histogram: macdLine - signalLine };
}

function bollinger(closes, period = 20, stddev = 2) {
    if (!closes || closes.length < period) return null;
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    return { upper: mean + sd * stddev, middle: mean, lower: mean - sd * stddev };
}

module.exports = { ema, sma, rsi, macd, bollinger };
