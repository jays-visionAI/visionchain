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

module.exports = { ema, sma, rsi, macd, bollinger, atr, obv, williamsR, ultimateOscillator, donchianChannel, vwap, zScore };

// ─── ATR (Average True Range) ────────────────────────────────────────────────
function atr(highs, lows, closes, period = 14) {
    if (!closes || closes.length < period + 1) return null;
    // If we don't have separate H/L arrays, approximate from closes
    const h = highs && highs.length === closes.length ? highs : closes.map((c, i) => c * 1.005);
    const l = lows && lows.length === closes.length ? lows : closes.map((c, i) => c * 0.995);

    const trs = [];
    for (let i = 1; i < closes.length; i++) {
        const tr = Math.max(
            h[i] - l[i],
            Math.abs(h[i] - closes[i - 1]),
            Math.abs(l[i] - closes[i - 1])
        );
        trs.push(tr);
    }
    if (trs.length < period) return null;

    // Simple average for first ATR, then EMA-smoothed
    let atrVal = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) {
        atrVal = (atrVal * (period - 1) + trs[i]) / period;
    }
    return atrVal;
}

// ─── OBV (On-Balance Volume) ─────────────────────────────────────────────────
function obv(closes, volumes) {
    if (!closes || !volumes || closes.length < 2) return null;
    const len = Math.min(closes.length, volumes.length);
    let obvVal = 0;
    for (let i = 1; i < len; i++) {
        if (closes[i] > closes[i - 1]) obvVal += volumes[i];
        else if (closes[i] < closes[i - 1]) obvVal -= volumes[i];
    }
    return obvVal;
}

// ─── Williams %R ─────────────────────────────────────────────────────────────
function williamsR(highs, lows, closes, period = 14) {
    if (!closes || closes.length < period) return null;
    const h = highs && highs.length === closes.length ? highs : closes;
    const l = lows && lows.length === closes.length ? lows : closes;

    const recentH = Math.max(...h.slice(-period));
    const recentL = Math.min(...l.slice(-period));
    const currentC = closes[closes.length - 1];

    if (recentH === recentL) return -50; // flat
    return ((recentH - currentC) / (recentH - recentL)) * -100;
}

// ─── Ultimate Oscillator ────────────────────────────────────────────────────
function ultimateOscillator(highs, lows, closes, p1 = 7, p2 = 14, p3 = 28) {
    if (!closes || closes.length < p3 + 1) return null;
    const h = highs && highs.length === closes.length ? highs : closes.map(c => c * 1.003);
    const l = lows && lows.length === closes.length ? lows : closes.map(c => c * 0.997);

    const bps = [], trs = [];
    for (let i = 1; i < closes.length; i++) {
        const tl = Math.min(l[i], closes[i - 1]);
        const th = Math.max(h[i], closes[i - 1]);
        bps.push(closes[i] - tl);
        trs.push(th - tl);
    }

    const sumSlice = (arr, len) => arr.slice(-len).reduce((a, b) => a + b, 0);
    const avg1 = sumSlice(bps, p1) / sumSlice(trs, p1);
    const avg2 = sumSlice(bps, p2) / sumSlice(trs, p2);
    const avg3 = sumSlice(bps, p3) / sumSlice(trs, p3);

    return 100 * ((4 * avg1) + (2 * avg2) + avg3) / 7;
}

// ─── Donchian Channel ────────────────────────────────────────────────────────
function donchianChannel(highs, lows, period = 20) {
    if (!highs || !lows || highs.length < period) return null;
    const upper = Math.max(...highs.slice(-period));
    const lower = Math.min(...lows.slice(-period));
    return { upper, lower, middle: (upper + lower) / 2 };
}

// ─── VWAP (Volume-Weighted Average Price) ────────────────────────────────────
function vwap(highs, lows, closes, volumes) {
    if (!closes || !volumes || closes.length < 2) return null;
    const len = Math.min(closes.length, volumes.length);
    let cumPV = 0, cumV = 0;
    for (let i = 0; i < len; i++) {
        const typical = ((highs ? highs[i] : closes[i]) + (lows ? lows[i] : closes[i]) + closes[i]) / 3;
        cumPV += typical * volumes[i];
        cumV += volumes[i];
    }
    return cumV > 0 ? cumPV / cumV : null;
}

// ─── Z-Score ─────────────────────────────────────────────────────────────────
function zScore(values, period = 20) {
    if (!values || values.length < period) return null;
    const slice = values.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);
    if (sd === 0) return 0;
    return (values[values.length - 1] - mean) / sd;
}
