/**
 * Volatility Overlay - Layer 3 Risk Engine
 *
 * ATR-based position sizing that automatically scales order sizes
 * based on current market volatility. In extreme volatility, trading
 * is halted completely.
 *
 * Volatility Buckets:
 *   Low     (ATR ratio < 1.0x)  → 100% position size
 *   Mid     (1.0x - 1.5x)      → 70% position size
 *   High    (1.5x - 2.5x)      → 40% position size
 *   Extreme (> 2.5x)           → 0% (HALT all trading)
 */

const { atr, sma } = require("./indicators");

// ATR ratio thresholds for each bucket
const BUCKET_THRESHOLDS = {
    LOW: 1.0,
    MID: 1.5,
    HIGH: 2.5,
};

// Position scale factors per bucket
const SCALE_FACTORS = {
    low: 1.0,
    mid: 0.7,
    high: 0.4,
    extreme: 0.0,
};

/**
 * Calculate the current volatility bucket and position scale factor.
 *
 * @param {number[]} closes - Close price history (at least 30 candles)
 * @param {number[]} highs - High price history (optional, approximated from closes)
 * @param {number[]} lows - Low price history (optional, approximated from closes)
 * @param {number} atrPeriod - ATR calculation period (default: 14)
 * @returns {{ bucket: string, scale: number, atrValue: number, atrAvg: number, atrRatio: number }}
 */
function getVolatilityBucket(closes, highs = null, lows = null, atrPeriod = 14) {
    const currentATR = atr(highs, lows, closes, atrPeriod);
    if (currentATR === null) {
        return { bucket: "low", scale: 1.0, atrValue: 0, atrAvg: 0, atrRatio: 0 };
    }

    // Calculate long-term ATR average (use 3x ATR period for baseline)
    const longPeriod = atrPeriod * 3;
    if (closes.length < longPeriod + 1) {
        return { bucket: "low", scale: 1.0, atrValue: currentATR, atrAvg: currentATR, atrRatio: 1.0 };
    }

    // Average ATR over the longer period as baseline
    const baselineCloses = closes.slice(0, -atrPeriod);
    const baselineATR = atr(
        highs ? highs.slice(0, -atrPeriod) : null,
        lows ? lows.slice(0, -atrPeriod) : null,
        baselineCloses,
        atrPeriod
    );

    if (!baselineATR || baselineATR === 0) {
        return { bucket: "low", scale: 1.0, atrValue: currentATR, atrAvg: 0, atrRatio: 1.0 };
    }

    const atrRatio = currentATR / baselineATR;

    let bucket, scale;
    if (atrRatio >= BUCKET_THRESHOLDS.HIGH) {
        bucket = "extreme";
        scale = SCALE_FACTORS.extreme;
    } else if (atrRatio >= BUCKET_THRESHOLDS.MID) {
        bucket = "high";
        scale = SCALE_FACTORS.high;
    } else if (atrRatio >= BUCKET_THRESHOLDS.LOW) {
        bucket = "mid";
        scale = SCALE_FACTORS.mid;
    } else {
        bucket = "low";
        scale = SCALE_FACTORS.low;
    }

    return { bucket, scale, atrValue: currentATR, atrAvg: baselineATR, atrRatio };
}

/**
 * Scale an order size based on current volatility.
 * Returns 0 if volatility is extreme (halt trading).
 *
 * @param {number} orderSize - Original order size
 * @param {number[]} closes - Close price history
 * @param {number[]} highs - Optional high prices
 * @param {number[]} lows - Optional low prices
 * @returns {{ scaledSize: number, bucket: string, scale: number, halted: boolean }}
 */
function scaleOrderSize(orderSize, closes, highs = null, lows = null) {
    const vol = getVolatilityBucket(closes, highs, lows);
    return {
        scaledSize: orderSize * vol.scale,
        bucket: vol.bucket,
        scale: vol.scale,
        halted: vol.scale === 0,
        atrRatio: vol.atrRatio,
    };
}

module.exports = { getVolatilityBucket, scaleOrderSize, SCALE_FACTORS, BUCKET_THRESHOLDS };
