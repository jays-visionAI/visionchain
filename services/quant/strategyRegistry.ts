/**
 * Vision Quant Engine - Strategy Registry
 *
 * 6 built-in strategy templates based on research-backed methodologies.
 * Each strategy is designed for explainability, controllability, and risk engine compatibility.
 */

import type { StrategyTemplate } from './types';

export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
    // ─── Module 1: Conservative Trend Core ──────────────────────────────
    {
        id: 'conservative_trend_core_v1',
        name: 'Conservative Trend Core',
        nameKo: '보수적 추세추종',
        category: 'trend_following',
        description: 'Time-series momentum strategy using EMA crossover with volume and volatility filters. Enters only when the long-term trend is confirmed and market conditions are favorable. Designed for capital preservation with moderate upside capture.',
        descriptionKo: 'EMA 크로스오버에 거래량 및 변동성 필터를 결합한 추세추종 전략입니다. 장기 추세가 확인되고 시장 조건이 우호적일 때만 진입합니다. 적당한 수익 추구와 함께 자본 보존에 초점을 맞춥니다.',
        shortDescription: 'EMA crossover trend following with volume confirmation',
        shortDescriptionKo: '거래량 확인 기반 EMA 크로스오버 추세추종',
        favorableMarket: 'Strong trending markets with clear directional momentum',
        favorableMarketKo: '명확한 방향성 모멘텀이 있는 강한 추세 시장',
        weakMarket: 'Choppy sideways markets with frequent whipsaws',
        weakMarketKo: '빈번한 속임수 신호가 나타나는 혼조세 횡보 시장',
        riskLevel: 'low',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH'],
        recommendedTimeframe: '4h',
        entryRules: [
            { indicator: 'ema_cross', condition: 'fast_above_slow', fast: 20, slow: 50 },
            { indicator: 'ema_trend', condition: 'price_above', value: 200 },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.1 },
            { indicator: 'atr', condition: 'not_extreme_spike' },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'percentage', value: 4 },
            { type: 'take_profit', mode: 'percentage', value: 8 },
            { type: 'trailing_stop', mode: 'percentage', value: 2.5 },
        ],
        riskRules: {
            maxPositionPct: 15,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
        },
        exceptions: [
            'skip_if_daily_loss_limit',
            'skip_if_spread_too_wide',
            'skip_chase_buy_after_spike',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'fast_ema', label: 'Fast EMA', labelKo: '빠른 EMA', type: 'number', value: 20, min: 5, max: 50, step: 1, group: 'entry' },
            { key: 'slow_ema', label: 'Slow EMA', labelKo: '느린 EMA', type: 'number', value: 50, min: 20, max: 100, step: 1, group: 'entry' },
            { key: 'trend_ema', label: 'Trend EMA', labelKo: '추세 EMA', type: 'number', value: 200, min: 100, max: 300, step: 10, group: 'entry' },
            { key: 'volume_ratio', label: 'Min Volume Ratio', labelKo: '최소 거래량 비율', type: 'number', value: 1.1, min: 1.0, max: 3.0, step: 0.1, group: 'filter' },
            { key: 'stop_loss', label: 'Stop Loss %', labelKo: '손절률 %', type: 'number', value: 4, min: 1, max: 10, step: 0.5, group: 'exit' },
            { key: 'take_profit', label: 'Take Profit %', labelKo: '익절률 %', type: 'number', value: 8, min: 3, max: 20, step: 0.5, group: 'exit' },
            { key: 'trailing_stop', label: 'Trailing Stop %', labelKo: '추적매도 %', type: 'number', value: 2.5, min: 1, max: 5, step: 0.5, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 15, min: 5, max: 30, step: 1, group: 'risk' },
        ],
        userCount: 1842,
        avgReturn30d: 3.2,
    },

    // ─── Module 2: Bollinger Mean Reversion Guarded ─────────────────────
    {
        id: 'bollinger_mean_reversion_v1',
        name: 'Bollinger Mean Reversion Guarded',
        nameKo: '볼린저 평균회귀 가드',
        category: 'mean_reversion',
        description: 'Enters when price bounces back from the lower Bollinger Band with RSI recovery confirmation. A trend filter prevents entries during strong downtrends. Designed for ranging markets with established support levels.',
        descriptionKo: '가격이 볼린저 밴드 하단에서 반등하고 RSI 회복이 확인될 때 진입합니다. 추세 필터가 강한 하락추세에서의 진입을 방지합니다. 지지선이 형성된 횡보 시장에 적합합니다.',
        shortDescription: 'Bollinger Band reversal with RSI and trend guard',
        shortDescriptionKo: 'RSI + 추세필터 결합 볼린저 밴드 반전',
        favorableMarket: 'Range-bound markets with clear support/resistance',
        favorableMarketKo: '지지/저항이 명확한 횡보 시장',
        weakMarket: 'Strong directional trends where price keeps breaking bands',
        weakMarketKo: '가격이 계속 밴드를 돌파하는 강한 추세 시장',
        riskLevel: 'medium',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH', 'KRW-XRP'],
        recommendedTimeframe: '4h',
        entryRules: [
            { indicator: 'bollinger', condition: 'price_reentered_lower', value: 20 },
            { indicator: 'rsi', condition: 'recovery_from_oversold', value: 30 },
            { indicator: 'ema_trend', condition: 'not_strong_downtrend', value: 100 },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'percentage', value: 3 },
            { type: 'band_exit', value: 0, partial: true },
        ],
        riskRules: {
            maxPositionPct: 12,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
        },
        exceptions: [
            'reduce_position_in_downtrend',
            'pause_on_news_crash',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'bb_length', label: 'Bollinger Length', labelKo: '볼린저 기간', type: 'number', value: 20, min: 10, max: 40, step: 1, group: 'entry' },
            { key: 'bb_stddev', label: 'Std Deviation', labelKo: '표준편차', type: 'number', value: 2, min: 1.5, max: 3, step: 0.1, group: 'entry' },
            { key: 'rsi_length', label: 'RSI Length', labelKo: 'RSI 기간', type: 'number', value: 14, min: 7, max: 21, step: 1, group: 'entry' },
            { key: 'rsi_oversold', label: 'RSI Oversold', labelKo: 'RSI 과매도', type: 'number', value: 30, min: 20, max: 40, step: 1, group: 'entry' },
            { key: 'trend_filter_ema', label: 'Trend Filter EMA', labelKo: '추세필터 EMA', type: 'number', value: 100, min: 50, max: 200, step: 10, group: 'filter' },
            { key: 'stop_loss', label: 'Stop Loss %', labelKo: '손절률 %', type: 'number', value: 3, min: 1, max: 8, step: 0.5, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 12, min: 5, max: 25, step: 1, group: 'risk' },
        ],
        userCount: 1156,
        avgReturn30d: 2.1,
    },

    // ─── Module 3: RSI Reversal Filtered ────────────────────────────────
    {
        id: 'rsi_reversal_filtered_v1',
        name: 'RSI Reversal Filtered',
        nameKo: 'RSI 반전 필터형',
        category: 'mean_reversion',
        description: 'A safer version of the classic RSI strategy. Never enters on RSI signal alone - requires MACD histogram improvement or short-term price recovery as confirmation. Includes scale-in logic and consecutive loss pause.',
        descriptionKo: '클래식 RSI 전략의 안전 버전입니다. RSI 신호만으로는 절대 진입하지 않으며 MACD 히스토그램 개선 또는 단기 가격 반등 확인이 필요합니다. 분할 진입과 연속 손실 시 중단 기능을 포함합니다.',
        shortDescription: 'RSI oversold entry with MACD confirmation filter',
        shortDescriptionKo: 'MACD 확인 필터 결합 RSI 과매도 진입',
        favorableMarket: 'Markets with periodic oversold bounces and mean-reverting behavior',
        favorableMarketKo: '주기적 과매도 반등과 평균회귀 행태가 나타나는 시장',
        weakMarket: 'Persistent downtrend where RSI stays oversold for extended periods',
        weakMarketKo: 'RSI가 장기간 과매도 상태를 유지하는 지속적 하락추세',
        riskLevel: 'medium',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH'],
        recommendedTimeframe: '4h',
        entryRules: [
            { indicator: 'rsi', condition: 'below_then_recover', value: 28 },
            { indicator: 'rsi', condition: 'cross_above', value: 32 },
            { indicator: 'macd', condition: 'histogram_improving' },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'percentage', value: 2.8 },
            { type: 'take_profit', mode: 'percentage', value: 5.5 },
        ],
        riskRules: {
            maxPositionPct: 10,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
            maxConsecutiveLosses: 3,
        },
        exceptions: [
            'pause_after_consecutive_losses',
            'skip_if_daily_loss_limit',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'rsi_length', label: 'RSI Length', labelKo: 'RSI 기간', type: 'number', value: 14, min: 7, max: 21, step: 1, group: 'entry' },
            { key: 'rsi_entry', label: 'Entry RSI', labelKo: '진입 RSI', type: 'number', value: 28, min: 20, max: 35, step: 1, group: 'entry' },
            { key: 'rsi_recovery', label: 'Recovery RSI', labelKo: '회복 RSI', type: 'number', value: 32, min: 28, max: 40, step: 1, group: 'entry' },
            { key: 'macd_fast', label: 'MACD Fast', labelKo: 'MACD 빠른선', type: 'number', value: 12, min: 8, max: 16, step: 1, group: 'entry' },
            { key: 'macd_slow', label: 'MACD Slow', labelKo: 'MACD 느린선', type: 'number', value: 26, min: 20, max: 34, step: 1, group: 'entry' },
            { key: 'stop_loss', label: 'Stop Loss %', labelKo: '손절률 %', type: 'number', value: 2.8, min: 1, max: 6, step: 0.2, group: 'exit' },
            { key: 'take_profit', label: 'Take Profit %', labelKo: '익절률 %', type: 'number', value: 5.5, min: 3, max: 12, step: 0.5, group: 'exit' },
            { key: 'max_scale_in', label: 'Max Scale-in', labelKo: '최대 분할진입', type: 'number', value: 2, min: 1, max: 4, step: 1, group: 'risk' },
        ],
        userCount: 2310,
        avgReturn30d: 1.8,
    },

    // ─── Module 4: Donchian Breakout Swing ──────────────────────────────
    {
        id: 'donchian_breakout_swing_v1',
        name: 'Donchian Breakout Swing',
        nameKo: '돈치안 돌파 스윙',
        category: 'breakout',
        description: 'Captures strong breakouts above N-period highs with volume confirmation. Only enters long when the market is above the long-term trend. ATR-based stop provides dynamic risk management.',
        descriptionKo: 'N봉 최고가 상향 돌파를 거래량 확인과 함께 포착합니다. 시장이 장기 추세 위에 있을 때만 매수 진입합니다. ATR 기반 손절로 동적 리스크 관리를 제공합니다.',
        shortDescription: 'N-period high breakout with volume and trend confirmation',
        shortDescriptionKo: 'N봉 최고가 돌파 + 거래량/추세 확인',
        favorableMarket: 'Markets transitioning from consolidation to strong trends',
        favorableMarketKo: '횡보에서 강한 추세로 전환하는 시장',
        weakMarket: 'Low-volume consolidation with false breakouts',
        weakMarketKo: '거래량이 낮은 횡보에서 거짓 돌파가 빈번한 시장',
        riskLevel: 'medium_high',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH', 'KRW-SOL'],
        recommendedTimeframe: '4h',
        entryRules: [
            { indicator: 'donchian', condition: 'breakout_high', value: 20 },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.3 },
            { indicator: 'ema_trend', condition: 'price_above', value: 200 },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'atr_multiple', value: 1.8 },
            { type: 'trailing_stop', mode: 'atr_multiple', value: 2.0 },
        ],
        riskRules: {
            maxPositionPct: 12,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
            maxCorrelatedPositions: 3,
        },
        exceptions: [
            'pause_if_extreme_volatility',
            'skip_chase_buy_after_spike',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'donchian_period', label: 'Donchian Period', labelKo: '돈치안 기간', type: 'number', value: 20, min: 10, max: 55, step: 1, group: 'entry' },
            { key: 'volume_ratio', label: 'Volume Confirmation', labelKo: '거래량 확인비율', type: 'number', value: 1.3, min: 1.0, max: 3.0, step: 0.1, group: 'filter' },
            { key: 'atr_stop', label: 'ATR Stop Multiple', labelKo: 'ATR 손절 배수', type: 'number', value: 1.8, min: 1.0, max: 3.0, step: 0.1, group: 'exit' },
            { key: 'trailing_atr', label: 'Trailing ATR Multiple', labelKo: '추적매도 ATR 배수', type: 'number', value: 2.0, min: 1.0, max: 4.0, step: 0.1, group: 'exit' },
            { key: 'max_positions', label: 'Max Simultaneous', labelKo: '최대 동시포지션', type: 'number', value: 3, min: 1, max: 5, step: 1, group: 'risk' },
        ],
        userCount: 987,
        avgReturn30d: 4.5,
    },

    // ─── Module 5: Multi-Factor Quant Guard ─────────────────────────────
    {
        id: 'multi_factor_quant_guard_v1',
        name: 'Multi-Factor Quant Guard',
        nameKo: '멀티팩터 퀀트가드',
        category: 'multi_signal',
        description: 'Vision Chain\'s flagship strategy combining trend, momentum, volume, and volatility filters. Requires multiple confirmations before entry, significantly reducing false signals. ATR-based dynamic exit management.',
        descriptionKo: '비전체인의 대표 전략으로 추세, 모멘텀, 거래량, 변동성 필터를 결합합니다. 진입 전 여러 조건의 확인을 요구하여 거짓 신호를 크게 줄입니다. ATR 기반 동적 청산 관리를 제공합니다.',
        shortDescription: 'Trend + Momentum + Volume + Volatility multi-factor strategy',
        shortDescriptionKo: '추세 + 모멘텀 + 거래량 + 변동성 멀티팩터 전략',
        favorableMarket: 'Markets with clear trend recovery after pullbacks',
        favorableMarketKo: '조정 후 명확한 추세 회복이 나타나는 시장',
        weakMarket: 'Rapid trend reversals without pullback patterns',
        weakMarketKo: '조정 패턴 없이 빠르게 추세가 반전되는 시장',
        riskLevel: 'medium',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH'],
        recommendedTimeframe: '4h',
        entryRules: [
            { indicator: 'ema_trend', condition: 'price_above', value: 200 },
            { indicator: 'ema_cross', condition: 'fast_above_slow', fast: 20, slow: 50 },
            { indicator: 'rsi', condition: 'cross_above', value: 40 },
            { indicator: 'macd', condition: 'histogram_improving' },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.2 },
            { indicator: 'atr', condition: 'below_ceiling' },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'atr_multiple', value: 1.6 },
            { type: 'take_profit', mode: 'atr_multiple', value: 3.0 },
            { type: 'trailing_stop', mode: 'percentage', value: 2.0 },
        ],
        riskRules: {
            maxPositionPct: 15,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
            maxCorrelatedPositions: 2,
        },
        exceptions: [
            'skip_if_spread_too_wide',
            'skip_if_exchange_latency_abnormal',
            'pause_if_extreme_volatility',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'trend_ema', label: 'Trend EMA', labelKo: '추세 EMA', type: 'number', value: 200, min: 100, max: 300, step: 10, group: 'entry' },
            { key: 'fast_ema', label: 'Pullback Fast EMA', labelKo: '조정 빠른 EMA', type: 'number', value: 20, min: 10, max: 30, step: 1, group: 'entry' },
            { key: 'slow_ema', label: 'Pullback Slow EMA', labelKo: '조정 느린 EMA', type: 'number', value: 50, min: 30, max: 80, step: 1, group: 'entry' },
            { key: 'rsi_threshold', label: 'RSI Recovery Threshold', labelKo: 'RSI 회복 임계값', type: 'number', value: 40, min: 30, max: 50, step: 1, group: 'entry' },
            { key: 'volume_spike', label: 'Volume Spike Ratio', labelKo: '거래량 급증 비율', type: 'number', value: 1.2, min: 1.0, max: 2.0, step: 0.1, group: 'filter' },
            { key: 'atr_stop', label: 'ATR Stop Multiple', labelKo: 'ATR 손절 배수', type: 'number', value: 1.6, min: 1.0, max: 3.0, step: 0.1, group: 'exit' },
            { key: 'atr_profit', label: 'ATR Profit Multiple', labelKo: 'ATR 익절 배수', type: 'number', value: 3.0, min: 2.0, max: 5.0, step: 0.1, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 15, min: 5, max: 30, step: 1, group: 'risk' },
        ],
        userCount: 1248,
        avgReturn30d: 3.8,
    },

    // ─── Module 6: Volatility Target Overlay ────────────────────────────
    {
        id: 'volatility_target_overlay_v1',
        name: 'Volatility Target Overlay',
        nameKo: '변동성 타기팅 오버레이',
        category: 'risk_overlay',
        description: 'Not a signal generator - this is a risk control layer that sits on top of all other strategies. Adjusts position sizes based on realized volatility and enforces drawdown kill switches. Applied by default to all strategies.',
        descriptionKo: '시그널 생성기가 아닌 모든 전략 위에 적용되는 리스크 제어 레이어입니다. 실현 변동성 기반으로 포지션 크기를 조절하고 손실한도 도달 시 거래를 중단합니다. 모든 전략에 기본 적용됩니다.',
        shortDescription: 'Risk control overlay for position sizing and drawdown protection',
        shortDescriptionKo: '포지션 크기 조절 및 손실보호용 리스크 제어 오버레이',
        favorableMarket: 'Applied across all market conditions as a protective layer',
        favorableMarketKo: '보호 레이어로 모든 시장 상황에 적용됨',
        weakMarket: 'May reduce position size excessively in volatile but profitable trends',
        weakMarketKo: '변동성이 높지만 수익성 있는 추세에서 포지션을 과도하게 축소할 수 있음',
        riskLevel: 'low',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH'],
        recommendedTimeframe: '4h',
        entryRules: [],
        exitRules: [],
        riskRules: {
            maxPositionPct: 15,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
        },
        exceptions: [
            'pause_if_extreme_volatility',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'vol_window', label: 'Volatility Window', labelKo: '변동성 윈도우', type: 'number', value: 20, min: 10, max: 60, step: 5, group: 'risk' },
            { key: 'low_vol_size', label: 'Low Vol Size %', labelKo: '저변동성 크기 %', type: 'number', value: 100, min: 50, max: 100, step: 5, group: 'risk' },
            { key: 'mid_vol_size', label: 'Mid Vol Size %', labelKo: '중변동성 크기 %', type: 'number', value: 70, min: 30, max: 90, step: 5, group: 'risk' },
            { key: 'high_vol_size', label: 'High Vol Size %', labelKo: '고변동성 크기 %', type: 'number', value: 40, min: 10, max: 60, step: 5, group: 'risk' },
            { key: 'daily_dd_kill', label: 'Daily Drawdown Kill %', labelKo: '일일 손실한도 %', type: 'number', value: 3, min: 1, max: 10, step: 0.5, group: 'risk' },
            { key: 'weekly_dd_kill', label: 'Weekly Drawdown Kill %', labelKo: '주간 손실한도 %', type: 'number', value: 7, min: 3, max: 15, step: 0.5, group: 'risk' },
        ],
        userCount: 3200,
    },
];

/**
 * Get a strategy template by ID
 */
export function getStrategyById(id: string): StrategyTemplate | undefined {
    return STRATEGY_TEMPLATES.find(s => s.id === id);
}

/**
 * Get all signal-generating strategies (excludes risk overlay)
 */
export function getSignalStrategies(): StrategyTemplate[] {
    return STRATEGY_TEMPLATES.filter(s => s.category !== 'risk_overlay');
}

/**
 * Get the volatility overlay template
 */
export function getVolatilityOverlay(): StrategyTemplate | undefined {
    return STRATEGY_TEMPLATES.find(s => s.category === 'risk_overlay');
}

/**
 * Get strategies by category
 */
export function getStrategiesByCategory(category: string): StrategyTemplate[] {
    return STRATEGY_TEMPLATES.filter(s => s.category === category);
}

/**
 * Get risk level color class
 */
export function getRiskLevelColor(level: string): string {
    switch (level) {
        case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20';
        case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        case 'medium_high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
        case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
        default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
}

/**
 * Get risk level label
 */
export function getRiskLevelLabel(level: string): string {
    switch (level) {
        case 'low': return 'Low';
        case 'medium': return 'Medium';
        case 'medium_high': return 'Medium-High';
        case 'high': return 'High';
        default: return level;
    }
}

/**
 * Get category label
 */
export function getCategoryLabel(category: string): string {
    switch (category) {
        case 'trend_following': return 'Trend Following';
        case 'mean_reversion': return 'Mean Reversion';
        case 'multi_signal': return 'Multi-Signal';
        case 'breakout': return 'Breakout';
        case 'risk_overlay': return 'Risk Overlay';
        default: return category;
    }
}

export function getCategoryLabelKo(category: string): string {
    switch (category) {
        case 'trend_following': return '추세추종';
        case 'mean_reversion': return '평균회귀';
        case 'multi_signal': return '멀티시그널';
        case 'breakout': return '돌파';
        case 'risk_overlay': return '리스크 오버레이';
        default: return category;
    }
}
