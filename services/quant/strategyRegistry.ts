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

    // ─── Module 7: Turtle Trading (Richard Dennis) ──────────────────────
    {
        id: 'turtle_trading_crypto_v1',
        name: 'Turtle Trading Crypto',
        nameKo: '터틀 트레이딩 크립토',
        category: 'turtle_trading',
        description: 'Adapted from Richard Dennis & William Eckhardt\'s legendary Turtle Trading system (1983). Uses Donchian Channel breakouts with ATR-based position sizing (N-Unit system). The original Turtles risked 1% per trade using volatility-normalized position sizes. Crypto adaptation uses tighter risk (0.5-1%) due to higher market volatility. Dual system: System 1 (20-period breakout) for quick entries, System 2 (55-period) for trend confirmation.',
        descriptionKo: 'Richard Dennis와 William Eckhardt의 전설적인 터틀 트레이딩 시스템(1983)을 암호화폐에 맞게 변환한 전략입니다. 돈치안 채널 돌파와 ATR 기반 포지션 사이징(N-Unit 시스템)을 사용합니다. 크립토 시장의 높은 변동성에 맞게 리스크를 0.5-1%로 조정했습니다.',
        shortDescription: 'Richard Dennis Turtle system with ATR position sizing for crypto',
        shortDescriptionKo: 'ATR 포지션 사이징 기반 Richard Dennis 터틀 시스템',
        favorableMarket: 'Markets with strong directional trends and breakout continuation',
        favorableMarketKo: '강한 방향성 추세와 돌파 지속이 나타나는 시장',
        weakMarket: 'Choppy range-bound markets generating frequent false breakouts',
        weakMarketKo: '빈번한 거짓 돌파가 발생하는 혼조세 횡보 시장',
        riskLevel: 'medium_high',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH', 'KRW-SOL'],
        recommendedTimeframe: '4h',
        entryRules: [
            { indicator: 'donchian', condition: 'breakout_high', value: 20 },
            { indicator: 'donchian', condition: 'breakout_high_confirm', value: 55 },
            { indicator: 'atr', condition: 'position_size_n_unit', value: 14 },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.2 },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'atr_multiple', value: 2.0 },
            { type: 'trailing_stop', mode: 'atr_multiple', value: 2.5 },
        ],
        riskRules: {
            maxPositionPct: 10,
            dailyDrawdownLimit: 2.5,
            weeklyDrawdownLimit: 6,
            maxCorrelatedPositions: 3,
        },
        exceptions: [
            'skip_if_daily_loss_limit',
            'pause_if_extreme_volatility',
            'skip_chase_buy_after_spike',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'system1_period', label: 'System 1 Breakout Period', labelKo: '시스템1 돌파 기간', type: 'number', value: 20, min: 10, max: 30, step: 1, group: 'entry' },
            { key: 'system2_period', label: 'System 2 Breakout Period', labelKo: '시스템2 돌파 기간', type: 'number', value: 55, min: 40, max: 70, step: 1, group: 'entry' },
            { key: 'atr_period', label: 'ATR Period (N)', labelKo: 'ATR 기간 (N)', type: 'number', value: 14, min: 10, max: 20, step: 1, group: 'entry' },
            { key: 'risk_per_trade', label: 'Risk Per Trade %', labelKo: '거래당 리스크 %', type: 'number', value: 0.75, min: 0.25, max: 2.0, step: 0.25, group: 'risk' },
            { key: 'pyramid_max', label: 'Max Pyramid Units', labelKo: '최대 피라미딩 단위', type: 'number', value: 3, min: 1, max: 4, step: 1, group: 'risk' },
            { key: 'pyramid_atr_step', label: 'Pyramid ATR Step', labelKo: '피라미딩 ATR 간격', type: 'number', value: 0.5, min: 0.25, max: 1.0, step: 0.25, group: 'entry' },
            { key: 'atr_stop', label: 'ATR Stop Multiple', labelKo: 'ATR 손절 배수', type: 'number', value: 2.0, min: 1.5, max: 3.0, step: 0.1, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 10, min: 5, max: 20, step: 1, group: 'risk' },
        ],
        userCount: 756,
        avgReturn30d: 5.1,
        premium: true,
        blogContent: {
            heroImage: '/images/quant/turtle_trading_hero.png',
            traderName: 'Richard Dennis',
            traderTitle: 'The Prince of the Pit',
            origin: 'Chicago Board of Trade, 1983',
            sections: [
                {
                    heading: 'The Turtle Experiment That Changed Trading Forever',
                    body: 'In 1983, legendary commodities trader Richard Dennis made a bet with his partner William Eckhardt: could trading be taught, or was it an innate talent? Dennis recruited 23 ordinary people -- including a security guard, a pianist, and a professional Dungeons & Dragons player -- and taught them a complete trading system in just two weeks. These "Turtles" went on to earn over $175 million in profits over the next five years, conclusively proving that systematic trading could be learned and replicated.',
                },
                {
                    heading: 'How the Turtle System Works',
                    body: 'The Turtle system is elegantly simple. It uses two Donchian Channel breakout systems: System 1 enters on a 20-period high breakout for quick trades, while System 2 uses a 55-period breakout for catching major trends. The revolutionary insight was the N-Unit position sizing system: each position is sized based on the market\'s current volatility (ATR), so every trade carries approximately the same dollar risk regardless of the asset\'s price or volatility. When a trade moves in your favor, you add more units (pyramiding) at each 0.5 ATR interval, up to a maximum of 4 units.',
                },
                {
                    heading: 'Crypto Adaptation',
                    body: 'Cryptocurrency markets exhibit 2-3x the volatility of traditional futures markets. Our crypto-adapted version uses tighter risk parameters (0.5-1% per trade vs the original 1-2%), a maximum of 3 pyramid units instead of 4, and applies a volatility overlay that reduces position size or blocks trading entirely during extreme volatility spikes. The 24/7 nature of crypto markets means the system captures more breakout opportunities but also requires robust automated stop management.',
                },
                {
                    heading: 'Key Parameters Explained',
                    body: 'System 1 Period (20): The number of bars to look back for the highest high. A breakout above this level triggers entry. System 2 Period (55): The longer-term confirmation system, used when System 1 signals are less reliable. ATR Period (14): The lookback period for calculating market volatility, which directly determines your position size. Risk Per Trade (0.75%): The maximum percentage of your account you can lose on a single trade.',
                },
            ],
        },
    },

    // ─── Module 8: Williams Volatility Breakout (Larry Williams) ─────────
    {
        id: 'williams_volatility_breakout_v1',
        name: 'Williams Volatility Breakout',
        nameKo: '윌리엄스 변동성 돌파',
        category: 'williams',
        description: 'Based on Larry Williams\' volatility breakout methodology that won the 1987 World Cup Trading Championship (11,376% return in 12 months). Enters when today\'s price exceeds yesterday\'s close + (yesterday\'s range x K-factor). Uses Williams %R for overbought/oversold confirmation and the Ultimate Oscillator for momentum validation. Crypto-adapted with 24/7 market support and tighter K-factor range.',
        descriptionKo: '1987년 세계 트레이딩 챔피언십 우승자 Larry Williams의 변동성 돌파 전략을 기반으로 합니다 (12개월 11,376% 수익). 당일 가격이 전일 종가 + (전일 변동폭 x K팩터)를 초과할 때 진입합니다. Williams %R과 Ultimate Oscillator로 확인합니다.',
        shortDescription: 'Larry Williams championship-winning volatility breakout system',
        shortDescriptionKo: 'Larry Williams 챔피언십 우승 변동성 돌파 시스템',
        favorableMarket: 'High-momentum markets with strong intraday volatility expansion',
        favorableMarketKo: '강한 장중 변동성 확장이 나타나는 고모멘텀 시장',
        weakMarket: 'Low-volatility sideways markets where range stays compressed',
        weakMarketKo: '변동폭이 축소된 저변동성 횡보 시장',
        riskLevel: 'medium_high',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH'],
        recommendedTimeframe: '1d',
        entryRules: [
            { indicator: 'williams_vb', condition: 'price_above_open_plus_range_k', value: 0.5 },
            { indicator: 'williams_r', condition: 'not_overbought', value: -20 },
            { indicator: 'ultimate_oscillator', condition: 'above_threshold', value: 50 },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.1 },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'percentage', value: 3 },
            { type: 'take_profit', mode: 'percentage', value: 6 },
            { type: 'trailing_stop', mode: 'percentage', value: 2 },
        ],
        riskRules: {
            maxPositionPct: 12,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
        },
        exceptions: [
            'skip_if_daily_loss_limit',
            'skip_if_spread_too_wide',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'k_factor', label: 'K-Factor', labelKo: 'K팩터', type: 'number', value: 0.5, min: 0.3, max: 0.8, step: 0.05, group: 'entry' },
            { key: 'williams_r_period', label: 'Williams %R Period', labelKo: 'Williams %R 기간', type: 'number', value: 14, min: 7, max: 21, step: 1, group: 'entry' },
            { key: 'williams_r_overbought', label: '%R Overbought Level', labelKo: '%R 과매수 레벨', type: 'number', value: -20, min: -10, max: -30, step: 5, group: 'filter' },
            { key: 'uo_fast', label: 'Ultimate Osc Fast', labelKo: 'UO 빠른 기간', type: 'number', value: 7, min: 5, max: 10, step: 1, group: 'entry' },
            { key: 'uo_mid', label: 'Ultimate Osc Mid', labelKo: 'UO 중간 기간', type: 'number', value: 14, min: 10, max: 20, step: 1, group: 'entry' },
            { key: 'uo_slow', label: 'Ultimate Osc Slow', labelKo: 'UO 느린 기간', type: 'number', value: 28, min: 20, max: 40, step: 1, group: 'entry' },
            { key: 'stop_loss', label: 'Stop Loss %', labelKo: '손절률 %', type: 'number', value: 3, min: 1.5, max: 6, step: 0.5, group: 'exit' },
            { key: 'take_profit', label: 'Take Profit %', labelKo: '익절률 %', type: 'number', value: 6, min: 3, max: 15, step: 0.5, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 12, min: 5, max: 25, step: 1, group: 'risk' },
        ],
        userCount: 634,
        avgReturn30d: 4.8,
        premium: true,
        blogContent: {
            heroImage: '/images/quant/williams_breakout_hero.png',
            traderName: 'Larry Williams',
            traderTitle: 'World Cup Trading Champion',
            origin: 'Robbins World Cup Trading Championship, 1987',
            sections: [
                {
                    heading: 'The Man Who Turned $10,000 Into $1.1 Million in 12 Months',
                    body: 'In 1987, Larry Williams entered the Robbins World Cup Trading Championship with $10,000 and turned it into $1,147,607 in just 12 months -- an astonishing 11,376% return that remains one of the most remarkable verified trading performances in history. His daughter, actress Michelle Williams, later replicated his success by winning the same competition. Williams developed several widely-used technical indicators including Williams %R, the Ultimate Oscillator, and the Williams VIX Fix.',
                },
                {
                    heading: 'The Volatility Breakout Concept',
                    body: 'Williams observed that large price moves tend to begin with an expansion of volatility beyond the previous day\'s range. The core formula is deceptively simple: Entry Price = Previous Close + (Previous Range x K-Factor). The K-Factor (typically 0.5) determines how much of yesterday\'s range the price must exceed to trigger a buy. A lower K-Factor means earlier entries (catching more moves but with more false signals), while a higher K-Factor waits for stronger confirmation. Williams %R oscillator then confirms that the breakout isn\'t occurring in already-overbought territory.',
                },
                {
                    heading: 'Crypto Adaptation',
                    body: 'Crypto markets are uniquely suited to volatility breakout strategies because they exhibit strong momentum characteristics and 24/7 trading. Our adaptation uses rolling 24-hour periods instead of traditional daily bars, applies the K-Factor range of 0.3-0.8 (tested across multiple crypto cycles), and adds the Ultimate Oscillator as a momentum filter to reduce whipsaw entries. The strategy operates on daily timeframe to capture significant moves while avoiding intraday noise.',
                },
                {
                    heading: 'Key Parameters Explained',
                    body: 'K-Factor (0.5): The sensitivity knob. At 0.5, price must exceed 50% of yesterday\'s range above the close to trigger entry. Lower values catch more moves but risk more false signals. Williams %R Period (14): Momentum oscillator lookback. Values above -20 indicate overbought conditions where entries are skipped. Ultimate Oscillator Periods (7/14/28): A triple-timeframe momentum indicator that must be above 50 to confirm bullish pressure across short, medium, and long-term cycles.',
                },
            ],
        },
    },

    // ─── Module 9: Minervini VCP Momentum (Mark Minervini) ──────────────
    {
        id: 'minervini_vcp_momentum_v1',
        name: 'Minervini VCP Momentum',
        nameKo: '미너비니 VCP 모멘텀',
        category: 'momentum_swing',
        description: 'Based on Mark Minervini\'s SEPA methodology (2x US Investing Champion). Identifies Stage 2 uptrends using his Trend Template: price above 50/150/200 SMA, 200 SMA rising for 1+ month, price within 25% of 52-week high and 30%+ above 52-week low. Entry on Volatility Contraction Patterns (VCP) where each pullback is shallower than the last, signaling exhaustion of sellers. Adapted for 24/7 crypto using rolling-period equivalents.',
        descriptionKo: 'Mark Minervini의 SEPA 전략(2회 미국 투자 챔피언)을 기반으로 합니다. Trend Template으로 Stage 2 상승추세를 식별합니다: 50/150/200 SMA 위 가격, 200 SMA 1개월+ 상승, 52주 고점 25% 이내, 52주 저점 30%+ 위. VCP(변동성 축소 패턴)에서 진입합니다.',
        shortDescription: 'Mark Minervini\'s SEPA Trend Template + VCP breakout for crypto',
        shortDescriptionKo: 'Mark Minervini SEPA Trend Template + VCP 돌파 크립토 버전',
        favorableMarket: 'Strong bull markets with sector rotation and momentum leadership',
        favorableMarketKo: '섹터 로테이션과 모멘텀 리더십이 나타나는 강한 상승장',
        weakMarket: 'Bear markets or distribution phases where breakouts fail consistently',
        weakMarketKo: '돌파가 지속적으로 실패하는 약세장 또는 분산 국면',
        riskLevel: 'medium',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH', 'KRW-SOL', 'KRW-AVAX'],
        recommendedTimeframe: '1d',
        entryRules: [
            { indicator: 'sma', condition: 'price_above', value: 50 },
            { indicator: 'sma', condition: 'price_above', value: 150 },
            { indicator: 'sma', condition: 'price_above', value: 200 },
            { indicator: 'sma', condition: 'sma_50_above_150_above_200' },
            { indicator: 'sma', condition: 'sma_200_rising_30d' },
            { indicator: 'vcp', condition: 'volatility_contraction_breakout' },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.5 },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'percentage', value: 7 },
            { type: 'trailing_stop', mode: 'percentage', value: 5 },
        ],
        riskRules: {
            maxPositionPct: 15,
            dailyDrawdownLimit: 3,
            weeklyDrawdownLimit: 7,
            maxConsecutiveLosses: 3,
        },
        exceptions: [
            'skip_if_daily_loss_limit',
            'pause_after_consecutive_losses',
            'skip_chase_buy_after_spike',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'sma_fast', label: 'Fast SMA', labelKo: '빠른 SMA', type: 'number', value: 50, min: 20, max: 50, step: 5, group: 'entry' },
            { key: 'sma_mid', label: 'Mid SMA', labelKo: '중간 SMA', type: 'number', value: 150, min: 100, max: 150, step: 10, group: 'entry' },
            { key: 'sma_slow', label: 'Slow SMA', labelKo: '느린 SMA', type: 'number', value: 200, min: 150, max: 250, step: 10, group: 'entry' },
            { key: 'high_proximity_pct', label: 'Max Distance from High %', labelKo: '최고가 대비 최대 이격률 %', type: 'number', value: 25, min: 10, max: 40, step: 5, group: 'filter' },
            { key: 'low_distance_pct', label: 'Min Distance from Low %', labelKo: '최저가 대비 최소 이격률 %', type: 'number', value: 30, min: 15, max: 50, step: 5, group: 'filter' },
            { key: 'vcp_contractions', label: 'VCP Min Contractions', labelKo: 'VCP 최소 축소 횟수', type: 'number', value: 2, min: 2, max: 5, step: 1, group: 'entry' },
            { key: 'breakout_volume', label: 'Breakout Volume Multiple', labelKo: '돌파 거래량 배수', type: 'number', value: 1.5, min: 1.2, max: 3.0, step: 0.1, group: 'filter' },
            { key: 'stop_loss', label: 'Stop Loss %', labelKo: '손절률 %', type: 'number', value: 7, min: 3, max: 10, step: 0.5, group: 'exit' },
            { key: 'trailing_stop', label: 'Trailing Stop %', labelKo: '추적매도 %', type: 'number', value: 5, min: 3, max: 10, step: 0.5, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 15, min: 5, max: 30, step: 1, group: 'risk' },
        ],
        userCount: 892,
        avgReturn30d: 4.2,
        premium: true,
        blogContent: {
            heroImage: '/images/quant/minervini_vcp_hero.png',
            traderName: 'Mark Minervini',
            traderTitle: '2x U.S. Investing Champion',
            origin: 'U.S. Investing Championship, 1997 & 2021',
            sections: [
                {
                    heading: 'From High School Dropout to Two-Time Trading Champion',
                    body: 'Mark Minervini achieved what most traders only dream of: he compounded his personal account at an average annual return of 220% over five years, turning $100,000 into over $30 million. He won the U.S. Investing Championship in both 1997 (155% return) and 2021 (334.8% return). His SEPA (Specific Entry Point Analysis) methodology, detailed in his books "Trade Like a Stock Market Wizard" and "Think & Trade Like a Champion," has become one of the most respected growth stock trading frameworks in existence.',
                },
                {
                    heading: 'The Trend Template & VCP Pattern',
                    body: 'Minervini\'s edge comes from two core concepts. First, the Trend Template identifies assets in a confirmed Stage 2 uptrend: price must be above the 50, 150, and 200 SMA, the 50 SMA must be above the 150 SMA which must be above the 200 SMA, and the 200 SMA must have been rising for at least 1 month. Second, the VCP (Volatility Contraction Pattern) identifies the optimal entry point within that trend: look for a series of consolidations where each pullback is shallower than the last (e.g., 25% -> 15% -> 8%), signaling that sellers are being exhausted. Enter on a breakout from the final contraction with above-average volume.',
                },
                {
                    heading: 'Crypto Adaptation',
                    body: 'Applying Minervini\'s framework to crypto requires adapting the time periods for 24/7 markets. We use rolling-period equivalents: the 50/150/200 SMA correspond to roughly 50/150/200 daily candles. Since crypto has no "52-week" highs in the traditional sense, we use rolling 365-day highs and lows. The VCP detection algorithm identifies progressively tighter consolidations with a minimum of 2 contractions before signaling a valid setup. Position is entered only when breakout volume exceeds 1.5x the 20-day average.',
                },
                {
                    heading: 'Key Parameters Explained',
                    body: 'SMA Stack (50/150/200): Three moving averages that must be in proper bullish alignment. Max Distance from High (25%): Price must be within 25% of its rolling high, confirming it\'s near strength, not deeply corrected. Min Distance from Low (30%): Price must be at least 30% above its rolling low, confirming the uptrend is established. VCP Min Contractions (2): At least 2 progressively tighter pullbacks must occur before a breakout is valid. Stop Loss (7%): Strict maximum loss -- if price drops 7% from entry, the position is closed immediately.',
                },
            ],
        },
    },

    // ─── Module 10: Livermore Trend Pyramid (Jesse Livermore) ────────────
    {
        id: 'livermore_trend_pyramid_v1',
        name: 'Livermore Trend Pyramid',
        nameKo: '리버모어 추세 피라미드',
        category: 'stage_analysis',
        description: 'Inspired by Jesse Livermore\'s trend trading principles from "Reminiscences of a Stock Operator" and his personal trading records. The strategy waits for the "path of least resistance" -- entering only when price breaks key resistance on heavy volume after a base-building period. Uses Livermore\'s pyramid technique: add to winners in 1/2-unit increments at confirmed higher lows, never average down on losers. Strict 10% stop-loss rule from his later career discipline. Adapted for crypto using rolling 200-period regime detection.',
        descriptionKo: 'Jesse Livermore의 "어느 주식투자자의 회상"과 매매 기록에서 영감을 받은 전략입니다. "최소 저항선의 방향"을 기다려 기반 형성 후 키 저항선을 강한 거래량으로 돌파할 때만 진입합니다. Livermore의 피라미딩: 확인된 더 높은 저점에서 1/2 단위씩 추가, 손실 포지션에는 절대 물타기 금지.',
        shortDescription: 'Jesse Livermore\'s trend following with pyramiding on confirmed breakouts',
        shortDescriptionKo: '확인된 돌파에서 피라미딩하는 Jesse Livermore 추세추종',
        favorableMarket: 'Clear trending markets with well-defined support/resistance and high volume breakouts',
        favorableMarketKo: '명확한 지지/저항과 거래량 돌파가 나타나는 확실한 추세 시장',
        weakMarket: 'Directionless markets with frequent false breakouts and low conviction',
        weakMarketKo: '빈번한 거짓 돌파와 낮은 확신의 방향 없는 시장',
        riskLevel: 'medium_high',
        recommendedAssets: ['KRW-BTC', 'KRW-ETH'],
        recommendedTimeframe: '1d',
        entryRules: [
            { indicator: 'price_structure', condition: 'base_building_complete', value: 30 },
            { indicator: 'resistance', condition: 'key_level_breakout' },
            { indicator: 'volume', condition: 'gte_ma_ratio', value: 1.5 },
            { indicator: 'ema_trend', condition: 'price_above', value: 200 },
        ],
        exitRules: [
            { type: 'stop_loss', mode: 'percentage', value: 10 },
            { type: 'trailing_stop', mode: 'percentage', value: 8 },
        ],
        riskRules: {
            maxPositionPct: 20,
            dailyDrawdownLimit: 4,
            weeklyDrawdownLimit: 8,
        },
        exceptions: [
            'skip_if_daily_loss_limit',
            'pause_if_extreme_volatility',
            'reduce_position_in_downtrend',
        ],
        volatilityOverlay: {
            enabled: true,
            window: 20,
            targetBucket: { low: 1.0, mid: 0.7, high: 0.4, extreme: 0.0 },
        },
        parameters: [
            { key: 'base_min_days', label: 'Min Base Duration', labelKo: '최소 기반 형성 기간', type: 'number', value: 30, min: 14, max: 60, step: 1, group: 'entry' },
            { key: 'breakout_volume', label: 'Breakout Volume Ratio', labelKo: '돌파 거래량 비율', type: 'number', value: 1.5, min: 1.2, max: 3.0, step: 0.1, group: 'filter' },
            { key: 'trend_ema', label: 'Trend EMA', labelKo: '추세 EMA', type: 'number', value: 200, min: 100, max: 300, step: 10, group: 'entry' },
            { key: 'pyramid_enabled', label: 'Enable Pyramiding', labelKo: '피라미딩 활성화', type: 'boolean', value: true, group: 'risk' },
            { key: 'pyramid_increments', label: 'Pyramid Increments', labelKo: '피라미딩 단계', type: 'number', value: 3, min: 1, max: 4, step: 1, group: 'risk' },
            { key: 'pyramid_confirm_higher_low', label: 'Confirm Higher Low', labelKo: '더 높은 저점 확인', type: 'boolean', value: true, group: 'entry' },
            { key: 'stop_loss', label: 'Stop Loss %', labelKo: '손절률 %', type: 'number', value: 10, min: 5, max: 15, step: 0.5, group: 'exit' },
            { key: 'trailing_stop', label: 'Trailing Stop %', labelKo: '추적매도 %', type: 'number', value: 8, min: 5, max: 15, step: 0.5, group: 'exit' },
            { key: 'max_position', label: 'Max Position %', labelKo: '최대 포지션 %', type: 'number', value: 20, min: 10, max: 30, step: 1, group: 'risk' },
        ],
        userCount: 543,
        avgReturn30d: 5.6,
        premium: true,
        blogContent: {
            heroImage: '/images/quant/livermore_pyramid_hero.png',
            traderName: 'Jesse Livermore',
            traderTitle: 'The Great Bear of Wall Street',
            origin: 'Wall Street, Early 20th Century',
            sections: [
                {
                    heading: 'The Greatest Trader Who Ever Lived',
                    body: 'Jesse Livermore is widely considered the greatest speculator in stock market history. Starting from nothing as a 14-year-old quote boy in a Boston brokerage, he amassed fortunes multiple times -- most famously making $100 million (equivalent to ~$1.5 billion today) by short-selling during the 1929 crash. His trading philosophy, immortalized in Edwin Lefevre\'s "Reminiscences of a Stock Operator," has influenced virtually every trend-following trader who came after him. His core maxim: "There is only one side of the market, and it is not the bull side or the bear side, but the right side."',
                },
                {
                    heading: 'The Path of Least Resistance & Pyramiding',
                    body: 'Livermore traded exclusively in the direction of the "path of least resistance" -- the prevailing market trend. His strategy involved three key elements: First, identify a base-building period where an asset consolidates after a decline, forming a foundation for future moves. Second, wait patiently for a decisive breakout above key resistance on unusually heavy volume -- this confirms institutional participation. Third, pyramid into the position: start with a partial position, then add in 1/2-unit increments each time the market confirms a higher low. Critically, Livermore never averaged down on losing positions -- a discipline that separated him from most traders of his era.',
                },
                {
                    heading: 'Crypto Adaptation',
                    body: 'Livermore\'s principles translate remarkably well to cryptocurrency because crypto markets are driven by similar human psychology, trend dynamics, and volume patterns. Our adaptation uses a minimum 30-day base formation period detection, identifies key resistance levels algorithmically using pivot point analysis, and requires breakout volume of at least 1.5x the 20-day average. The pyramiding system adds in 3 increments at confirmed higher lows, and a 200-period EMA serves as the regime filter -- ensuring all positions are aligned with the major trend direction.',
                },
                {
                    heading: 'Key Parameters Explained',
                    body: 'Min Base Duration (30 days): How long price must consolidate before a breakout is considered significant. Longer bases typically lead to stronger breakouts. Breakout Volume Ratio (1.5x): Volume on the breakout day must be at least 50% above the 20-day average, confirming conviction. Pyramid Increments (3): Positions are built in 3 stages -- initial entry, first add at confirmed higher low, second add at next confirmed higher low. Stop Loss (10%): Livermore\'s later career discipline -- wider than most strategies, but compensated by pyramiding only into confirmed winners. Trailing Stop (8%): Locks in profits while allowing the trend room to breathe.',
                },
            ],
        },
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
        case 'turtle_trading': return 'Turtle Trading';
        case 'momentum_swing': return 'Momentum Swing';
        case 'williams': return 'Williams System';
        case 'stage_analysis': return 'Stage Analysis';
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
        case 'turtle_trading': return '터틀 트레이딩';
        case 'momentum_swing': return '모멘텀 스윙';
        case 'williams': return '윌리엄스 시스템';
        case 'stage_analysis': return '단계 분석';
        default: return category;
    }
}
