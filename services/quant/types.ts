/**
 * Vision Quant Engine - Type Definitions
 *
 * All interfaces for strategy modules, agent configuration, signals, and risk management.
 */

// ─── Strategy Types ────────────────────────────────────────────────────────

export type StrategyCategory = 'trend_following' | 'mean_reversion' | 'multi_signal' | 'breakout' | 'risk_overlay';

export type RiskLevel = 'low' | 'medium' | 'medium_high' | 'high';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type Exchange = 'upbit' | 'bithumb' | 'binance' | 'bybit' | 'bitget' | 'okx' | 'kucoin' | 'mexc' | 'bitkub';

export interface EntryRule {
    indicator: string;
    condition: string;
    value?: number;
    fast?: number;
    slow?: number;
}

export interface ExitRule {
    type: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'band_exit';
    mode?: 'percentage' | 'atr_multiple';
    value: number;
    partial?: boolean; // partial exit
}

export interface RiskRules {
    maxPositionPct: number;
    dailyDrawdownLimit: number;
    weeklyDrawdownLimit: number;
    maxCorrelatedPositions?: number;
    maxConsecutiveLosses?: number;
}

export interface VolatilityOverlayConfig {
    enabled: boolean;
    window: number;
    targetBucket: {
        low: number;    // 100% size
        mid: number;    // 70% size
        high: number;   // 40% size
        extreme: number; // 0% = block
    };
}

export type ExceptionRule =
    | 'skip_if_spread_too_wide'
    | 'skip_if_exchange_latency_abnormal'
    | 'pause_if_extreme_volatility'
    | 'skip_if_daily_loss_limit'
    | 'skip_chase_buy_after_spike'
    | 'reduce_position_in_downtrend'
    | 'pause_on_news_crash'
    | 'pause_after_consecutive_losses';

export interface StrategyParameter {
    key: string;
    label: string;
    labelKo: string;
    type: 'number' | 'select' | 'boolean';
    value: number | string | boolean;
    min?: number;
    max?: number;
    step?: number;
    options?: { value: string | number; label: string }[];
    group: 'entry' | 'exit' | 'risk' | 'filter';
}

export interface StrategyTemplate {
    id: string;
    name: string;
    nameKo: string;
    category: StrategyCategory;
    description: string;
    descriptionKo: string;
    shortDescription: string;
    shortDescriptionKo: string;
    favorableMarket: string;
    favorableMarketKo: string;
    weakMarket: string;
    weakMarketKo: string;
    riskLevel: RiskLevel;
    recommendedAssets: string[];
    recommendedTimeframe: Timeframe;
    entryRules: EntryRule[];
    exitRules: ExitRule[];
    riskRules: RiskRules;
    exceptions: ExceptionRule[];
    volatilityOverlay: VolatilityOverlayConfig;
    parameters: StrategyParameter[];
    userCount: number;
    avgReturn30d?: number;
}

// ─── Agent Types ───────────────────────────────────────────────────────────

export type AgentStatus = 'draft' | 'pending_confirmation' | 'ready' | 'active' | 'paused' | 'stopped' | 'error';

export interface QuantAgent {
    id: string;
    userId: string;
    name: string;
    exchange: Exchange;
    exchangeAccountId: string;
    selectedAssets: string[];
    strategyTemplateId: string;
    strategyName: string;
    customizedParameters: Record<string, number | string | boolean>;
    riskLimits: RiskRules;
    exceptionRules: ExceptionRule[];
    volatilityOverlay: VolatilityOverlayConfig;
    status: AgentStatus;
    legalAcceptanceTimestamp: string | null;
    betaWarningAck: boolean;
    createdAt: string;
    updatedAt: string;
    // Performance
    todayPnl: number;
    todayPnlPercent: number;
    cumulativePnl: number;
    cumulativePnlPercent: number;
    lastSignalAt: string | null;
    lastOrderAt: string | null;
    totalSignals: number;
    executedSignals: number;
    skippedSignals: number;
}

// ─── Signal Types ──────────────────────────────────────────────────────────

export type SignalType = 'entry_long' | 'exit_long' | 'scale_in' | 'partial_exit' | 'stop_loss' | 'take_profit' | 'trailing_stop';

export type SignalAction = 'executed' | 'skipped' | 'pending';

export interface QuantSignal {
    id: string;
    agentId: string;
    exchange: Exchange;
    asset: string;
    strategyName: string;
    signalType: SignalType;
    action: SignalAction;
    reason: string;
    skipReason?: string;
    price: number;
    amount?: number;
    timestamp: string;
    indicators: Record<string, number>;
}

// ─── Investor Persona ──────────────────────────────────────────────────────

export type InvestorPersona = 'safety_first' | 'balanced_swing' | 'active_opportunist' | 'custom_quant';

export interface PersonaRecommendation {
    persona: InvestorPersona;
    personaLabel: string;
    personaLabelKo: string;
    description: string;
    descriptionKo: string;
    recommendedStrategies: string[];
    riskOverlayStrength: 'strong' | 'medium' | 'light';
}

// ─── Leaderboard ───────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    nickname: string;
    strategyName: string;
    runDuration: number; // days
    cumulativeReturn: number;
    todayReturn: number;
    followerCount: number;
    isPublic: boolean;
}
