/**
 * Vision Quant Engine - Type Definitions
 *
 * All interfaces for strategy modules, agent configuration, signals, and risk management.
 */

// ─── Strategy Types ────────────────────────────────────────────────────────

export type StrategyCategory = 'trend_following' | 'mean_reversion' | 'multi_signal' | 'breakout' | 'risk_overlay' | 'turtle_trading' | 'momentum_swing' | 'williams' | 'stage_analysis';

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

export interface BudgetConfig {
    /** Total budget the agent is allowed to use (in currency units) */
    totalBudget: number;
    totalBudgetEnabled: boolean;

    /** Max amount to allocate to a single asset */
    perAssetBudget: number;
    perAssetBudgetEnabled: boolean;

    /** Max amount for a single order */
    maxOrderSize: number;
    maxOrderSizeEnabled: boolean;

    /** Daily total trading volume limit */
    dailyTradingLimit: number;
    dailyTradingLimitEnabled: boolean;

    /** Currency unit for all budget values */
    currency: 'KRW' | 'USD';
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
    totalBudget: 0,
    totalBudgetEnabled: false,
    perAssetBudget: 0,
    perAssetBudgetEnabled: false,
    maxOrderSize: 100000,
    maxOrderSizeEnabled: false,
    dailyTradingLimit: 1000000,
    dailyTradingLimitEnabled: false,
    currency: 'KRW',
};

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

export interface StrategyBlogContent {
    heroImage: string;
    traderName: string;
    traderTitle: string;
    origin: string;
    sections: {
        heading: string;
        body: string;
    }[];
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
    premium?: boolean;
    blogContent?: StrategyBlogContent;
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
    budgetConfig: BudgetConfig;
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

// ─── Performance Report Types ──────────────────────────────────────────────

export type ReportPeriod = 'weekly' | 'monthly' | 'annual';

/** Individual trade record for report */
export interface TradeRecord {
    id: string;
    asset: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    value: number;
    fee: number;
    pnl: number;
    pnlPercent: number;
    strategy: string;
    timestamp: string;
    holdingPeriod?: number; // hours
}

/** Daily P&L data point for equity curve */
export interface DailyPnL {
    date: string;
    pnl: number;
    pnlPercent: number;
    cumulativePnl: number;
    cumulativeReturn: number;
    portfolioValue: number;
    benchmark: number; // BTC return for comparison
}

/** Per-asset performance breakdown */
export interface AssetPerformance {
    asset: string;
    trades: number;
    winRate: number;
    totalPnl: number;
    totalReturn: number;
    avgHoldingPeriod: number; // hours
    bestTrade: number;
    worstTrade: number;
    sharpeRatio: number;
    allocation: number; // % of portfolio
}

/** Strategy-level performance */
export interface StrategyPerformance {
    strategyId: string;
    strategyName: string;
    trades: number;
    winRate: number;
    totalPnl: number;
    totalReturn: number;
    profitFactor: number;
    avgWin: number;
    avgLoss: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    signalsGenerated: number;
    signalsExecuted: number;
    signalsSkipped: number;
}

/** Drawdown analysis */
export interface DrawdownEvent {
    startDate: string;
    endDate: string | null; // null if ongoing
    depth: number; // max drawdown %
    duration: number; // days
    recovery: number | null; // days to recover, null if not recovered
    peakValue: number;
    troughValue: number;
}

/** Risk metrics for reports */
export interface RiskMetrics {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    maxDrawdownDuration: number; // days
    volatility: number; // annualized
    beta: number; // vs BTC
    alpha: number; // vs BTC
    var95: number; // Value at Risk 95%
    var99: number;
    winRate: number;
    profitFactor: number;
    avgWinLossRatio: number;
    expectancy: number; // avg pnl per trade
    kellyFraction: number;
}

/** Monthly return entry for heatmap */
export interface MonthlyReturn {
    year: number;
    month: number;
    return: number;
    trades: number;
}

/** The main report data structure */
export interface PerformanceReport {
    // Meta
    reportId: string;
    userId: string;
    period: ReportPeriod;
    tradingMode: 'live' | 'paper';
    startDate: string;
    endDate: string;
    generatedAt: string;
    currency: 'KRW' | 'USD';

    // Summary KPIs
    summary: {
        startingCapital: number;
        endingCapital: number;
        netPnl: number;
        totalReturn: number;
        annualizedReturn: number;
        totalTrades: number;
        winningTrades: number;
        losingTrades: number;
        winRate: number;
        bestDay: { date: string; pnl: number; pnlPercent: number };
        worstDay: { date: string; pnl: number; pnlPercent: number };
        avgDailyReturn: number;
        totalFees: number;
        netAfterFees: number;
    };

    // Detailed data
    dailyPnl: DailyPnL[];
    trades: TradeRecord[];
    assetPerformance: AssetPerformance[];
    strategyPerformance: StrategyPerformance[];
    riskMetrics: RiskMetrics;
    drawdowns: DrawdownEvent[];
    monthlyReturns: MonthlyReturn[];

    // Benchmark comparison
    benchmarks: {
        btcReturn: number;
        ethReturn: number;
        marketAvg: number;
        outperformance: number; // vs BTC
    };
}
