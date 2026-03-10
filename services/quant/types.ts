/**
 * Vision Quant Engine - Type Definitions
 *
 * All interfaces for strategy modules, agent configuration, signals, and risk management.
 */

// ─── Strategy Types ────────────────────────────────────────────────────────

export type StrategyCategory = 'trend_following' | 'mean_reversion' | 'multi_signal' | 'breakout' | 'risk_overlay' | 'turtle_trading' | 'momentum_swing' | 'williams' | 'stage_analysis'
    | 'futures_trend' | 'futures_mean_reversion' | 'futures_breakout' | 'futures_arbitrage' | 'futures_scalping';

export type MarketType = 'spot' | 'futures';

export type RiskLevel = 'low' | 'medium' | 'medium_high' | 'high';

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type Exchange = 'upbit' | 'bithumb' | 'coinone' | 'binance' | 'bybit' | 'bitget' | 'okx' | 'kucoin' | 'mexc' | 'bitkub' | 'coinbase' | 'bitflyer' | 'gmo' | 'coincheck' | 'cryptocom';

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

export interface FuturesConfig {
    defaultLeverage: number;
    maxLeverage: number;
    marginType: 'cross' | 'isolated';
    supportedDirections: ('long' | 'short' | 'both');
    autoDeleverage: boolean;
    liquidationBuffer: number; // % buffer before liquidation price
}

export interface StrategyTemplate {
    id: string;
    name: string;
    nameKo: string;
    category: StrategyCategory;
    marketType: MarketType;
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
    // Futures-specific
    maxLeverage?: number;
    futuresConfig?: FuturesConfig;
}

// ─── Unified Agent Status (10-State Lifecycle) ─────────────────────────────

/**
 * 10-State Agent Lifecycle
 *
 * draft              → 설정 중 (실행 불가)
 * ready              → 설정 완료, 시작 대기
 * active             → 정상 운영 중 (시장 감시 + 매매)
 * paused_by_user     → 사용자 임의 일시정지
 * paused_by_risk     → Risk Engine 강제 정지 (손실 한도 등)
 * paused_by_system   → Kill Switch, API 에러, 잔고 부족
 * stopping           → 포지션 청산 중 (종료 과정)
 * stopped            → 포지션 0, 정상 종료
 * error              → 복구 불가 시스템 에러
 * terminated         → 파기/아카이브
 */
export type UnifiedAgentStatus =
    | 'draft'
    | 'ready'
    | 'active'
    | 'paused_by_user'
    | 'paused_by_risk'
    | 'paused_by_system'
    | 'stopping'
    | 'stopped'
    | 'error'
    | 'terminated';

/** Backward-compat alias for legacy code that still references 'running' */
export type LegacyAgentStatus = UnifiedAgentStatus | 'running' | 'paused' | 'completed';

/** Alias kept for old QuantAgent references */
export type AgentStatus = UnifiedAgentStatus;

/** Execution mode - set at creation time, immutable */
export type ExecutionMode = 'paper' | 'live';

// ─── Risk Status (Real-time per-agent risk tracking) ───────────────────────

/**
 * Tracked per evaluation cycle, persisted in Firestore agent document.
 * Risk Engine reads these values to enforce Layer 2 (Session Limits).
 */
export interface RiskStatus {
    /** Today's realized + unrealized PnL as % of starting value */
    dailyPnl: number;
    /** This week's cumulative PnL as % */
    weeklyPnl: number;
    /** Current streak of consecutive losing trades */
    consecutiveLosses: number;
    /** Number of trades executed today */
    todayTradeCount: number;
    /** ISO timestamp of last losing trade */
    lastLossAt: string | null;
    /** ISO timestamp when cooldown expires (null if not in cooldown) */
    cooldownUntil: string | null;
    /** Reason for current pause (null if active) */
    pauseReason: string | null;
    /** Date string (YYYY-MM-DD) for daily reset tracking */
    dailyResetDate: string;
    /** ISO week string for weekly reset tracking */
    weeklyResetWeek: string;
}

export const DEFAULT_RISK_STATUS: RiskStatus = {
    dailyPnl: 0,
    weeklyPnl: 0,
    consecutiveLosses: 0,
    todayTradeCount: 0,
    lastLossAt: null,
    cooldownUntil: null,
    pauseReason: null,
    dailyResetDate: new Date().toISOString().split('T')[0],
    weeklyResetWeek: '',
};

// ─── Decision Log ──────────────────────────────────────────────────────────

/** Logged for every evaluation cycle (including no-trade decisions) */
export interface DecisionLogEntry {
    id: string;
    agentId: string;
    userId: string;
    timestamp: string;

    /** Signal Engine output */
    signal: {
        side: 'buy' | 'sell' | 'none';
        asset: string;
        reason: string;
        strength: number;
        indicators?: Record<string, number>;
    };

    /** Risk Engine verdict */
    risk: {
        approved: boolean;
        layer?: string;          // 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
        rejectReason?: string;
    };

    /** Execution result (only when risk approved and trade executed) */
    execution?: {
        orderId: string;
        executedPrice: number;
        executedQty: number;
        fee: number;
        slippage?: number;
    };

    /** Market snapshot at evaluation time */
    marketSnapshot: {
        price: number;
        spread?: number;
        volume24h?: number;
    };
}

// ─── Legacy Agent Type (DEPRECATED) ────────────────────────────────────────

/**
 * @deprecated Use PaperAgent instead. This type was defined for frontend use
 * but was never connected to the backend engine. Kept for reference only.
 */
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

// ─── Trading Agent Types ───────────────────────────────────────────────────

/**
 * Backward-compatible status type.
 * Includes legacy values ('running', 'paused', 'completed') for existing Firestore data
 * plus all new UnifiedAgentStatus values.
 */
export type PaperAgentStatus = UnifiedAgentStatus | 'running' | 'paused' | 'completed';

/** Fixed seed amounts for paper trading */
export const PAPER_TRADING_SEED = {
    KRW: 10_000_000,   // 1천만원
    USDT: 10_000,       // 10,000 USDT
} as const;

export interface PaperPosition {
    asset: string;
    quantity: number;
    avgEntryPrice: number;
    currentPrice: number;
    value: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
}

/**
 * Primary Agent entity - stored in Firestore `paperAgents` collection.
 * Extended with Risk Engine support (riskStatus) and Live mode fields.
 * All new fields are optional to maintain backward compatibility with existing documents.
 */
export interface PaperAgent {
    id: string;
    userId: string;
    userEmail: string;
    displayName: string;

    // Strategy config
    strategyId: string;
    strategyName: string;
    selectedAssets: string[];
    params: Record<string, number | string | boolean>;
    budgetConfig: BudgetConfig;
    riskProfile: 'conservative' | 'balanced' | 'aggressive';

    // Trading mode
    tradingMode: 'paper' | 'live';

    // Execution mode (immutable after creation)
    executionMode?: ExecutionMode;

    // Seed
    seed: number;
    seedCurrency: 'KRW' | 'USDT';

    // Portfolio state
    cashBalance: number;
    positions: PaperPosition[];
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;

    // Stats
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    bestTrade: number;
    worstTrade: number;

    // Status (10-State Lifecycle)
    status: PaperAgentStatus;
    competitionId: string | null;

    // ─── NEW: Risk Engine State ─────────────────────────────────
    /** Real-time risk tracking, updated every evaluation cycle */
    riskStatus?: RiskStatus;

    // ─── NEW: Live Mode fields ──────────────────────────────────
    /** Which exchange this agent trades on (defaults to 'upbit') */
    exchange?: Exchange;
    /** Reference to encrypted API key in exchangeKeys collection */
    exchangeAccountId?: string;
    /** Futures-specific config (leverage, margin type, etc.) */
    futuresConfig?: FuturesConfig;
    /** Last time the engine successfully processed this agent */
    lastHeartbeatAt?: string;

    // Timestamps
    createdAt: string;
    updatedAt: string;
    lastTradeAt: string | null;
}

export interface PaperTrade {
    id: string;
    agentId: string;
    userId: string;
    asset: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    value: number;
    fee: number;
    pnl: number;
    pnlPercent: number;
    strategy: string;
    signal: string;
    balanceAfter: number;
    timestamp: string;
}

// ─── Competition Types ─────────────────────────────────────────────────────

export type CompetitionStatus = 'upcoming' | 'active' | 'completed';
export type CompetitionDivision = 'spot' | 'futures';

export interface CompetitionPrize {
    rankMin: number;
    rankMax: number;
    reward: string;
    label: string;
}

export interface Competition {
    id: string;
    title: string;
    description: string;
    division: CompetitionDivision;
    startDate: string;
    endDate: string;
    status: CompetitionStatus;
    seed: number;
    seedCurrency: 'KRW' | 'USDT';
    participantCount: number;
    prizes: CompetitionPrize[];
    rules: string[];
    createdAt: string;
}

export interface CompetitionEntry {
    userId: string;
    userEmail: string;
    displayName: string;
    agentId: string;
    strategyName: string;
    selectedAssets: string[];
    currentValue: number;
    currentPnl: number;
    currentPnlPercent: number;
    totalTrades: number;
    winRate: number;
    rank: number;
    joinedAt: string;
    updatedAt: string;
}

// ─── Signal Types ──────────────────────────────────────────────────────────

export type SignalType = 'entry_long' | 'exit_long' | 'entry_short' | 'exit_short' | 'scale_in' | 'partial_exit' | 'stop_loss' | 'take_profit' | 'trailing_stop' | 'liquidation_warning';

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
