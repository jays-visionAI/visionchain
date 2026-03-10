import { createSignal, Show, For, onMount, createMemo, createEffect } from 'solid-js';
import type { JSX } from 'solid-js';
import {
    RefreshCw,
    AlertCircle,
    ChevronRight,
    ChevronLeft,
    TrendingUp,
    TrendingDown,
    X,
    Check,
    Settings,
    Play,
    Pause,
    Square,
    Copy as CopyIcon,
    Filter,
    Clock,
    Zap,
    Shield,
    Activity,
    BarChart3,
    Users,
    ArrowRight,
    Info,
    CheckCircle,
    AlertTriangle,
    Eye
} from 'lucide-solid';
import { WalletViewHeader } from '../wallet/WalletViewHeader';
import {
    listCexApiKeys,
    getCexPortfolio,
    formatKrw,
    formatUsd,
    type CexCredential,
    type AggregatedPortfolio,
    type CexPortfolioSnapshot,
    type CexAsset
} from '../../services/cexService';
import {
    STRATEGY_TEMPLATES,
    getSignalStrategies,
    getSpotStrategies,
    getFuturesStrategies,
    getStrategyById,
    getRiskLevelColor,
    getRiskLevelLabel,
    getCategoryLabel,
    getCategoryLabelKo,
} from '../../services/quant/strategyRegistry';
import { DEFAULT_BUDGET_CONFIG, PAPER_TRADING_SEED } from '../../services/quant/types';
import type { StrategyTemplate, StrategyParameter, ExceptionRule, StrategyBlogContent, BudgetConfig, PaperAgent } from '../../services/quant/types';
import { addRewardPoints, getRPConfig, getFirebaseAuth } from '../../services/firebaseService';
import { createPaperAgent, subscribeToPaperAgents, updatePaperAgentStatus, deletePaperAgent } from '../../services/quant/paperTradingService';
import { lazy, onCleanup } from 'solid-js';
const QuantReportLazy = lazy(() => import('./QuantReport'));

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const QuantIcon = () => (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 3v18h18" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M7 16l4-8 4 4 5-9" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="7" cy="16" r="1.5" fill="currentColor" />
        <circle cx="11" cy="8" r="1.5" fill="currentColor" />
        <circle cx="15" cy="12" r="1.5" fill="currentColor" />
        <circle cx="20" cy="3" r="1.5" fill="currentColor" />
    </svg>
);

const BotIcon = () => (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="8" width="18" height="12" rx="3" />
        <path d="M12 8V5" stroke-linecap="round" />
        <circle cx="12" cy="3" r="2" />
        <circle cx="9" cy="14" r="1.5" fill="currentColor" />
        <circle cx="15" cy="14" r="1.5" fill="currentColor" />
        <path d="M9 18h6" stroke-linecap="round" />
    </svg>
);

const StrategyIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M4 6h16M4 12h10M4 18h6" stroke-linecap="round" />
    </svg>
);

const UpbitIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none">
        <circle cx="12" cy="12" r="10" fill="#093687" />
        <path d="M7 14L12 7L17 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

const BithumbIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none">
        <circle cx="12" cy="12" r="10" fill="#F37021" />
        <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">B</text>
    </svg>
);


// ─── Tab Types ──────────────────────────────────────────────────────────────

type QuantTab = 'strategies' | 'agents' | 'signals' | 'reports';

// ─── Main Component ─────────────────────────────────────────────────────────

const VisionQuantEngine = (): JSX.Element => {
    // === Data State ===
    const [credentials, setCredentials] = createSignal<CexCredential[]>([]);
    const [portfolios, setPortfolios] = createSignal<CexPortfolioSnapshot[]>([]);
    const [aggregated, setAggregated] = createSignal<AggregatedPortfolio | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [error, setError] = createSignal('');

    // === UI State ===
    const [activeTab, setActiveTab] = createSignal<QuantTab>('strategies');
    const [selectedStrategy, setSelectedStrategy] = createSignal<StrategyTemplate | null>(null);
    const [showDetail, setShowDetail] = createSignal(false);
    const [showSetup, setShowSetup] = createSignal(false);
    const [showConfirm, setShowConfirm] = createSignal(false);
    const [categoryFilter, setCategoryFilter] = createSignal('all');
    const [marketFilter, setMarketFilter] = createSignal<'all' | 'spot' | 'futures'>('all');
    const [viewCurrency, setViewCurrency] = createSignal<'krw' | 'usd'>('krw');

    // === Setup State ===
    const [setupMode, setSetupMode] = createSignal<'simple' | 'advanced'>('simple');
    const [selectedAssets, setSelectedAssets] = createSignal<string[]>([]);
    const [selectedExchange, setSelectedExchange] = createSignal<string>('');
    const [riskProfile, setRiskProfile] = createSignal<'conservative' | 'balanced' | 'aggressive'>('balanced');
    const [customParams, setCustomParams] = createSignal<Record<string, number | string | boolean>>({});
    const [budgetConfig, setBudgetConfig] = createSignal<BudgetConfig>({ ...DEFAULT_BUDGET_CONFIG });
    const [tradingMode, setTradingMode] = createSignal<'live' | 'paper'>('paper');

    // === Paper Agents State ===
    const [paperAgents, setPaperAgents] = createSignal<PaperAgent[]>([]);
    const [agentsLoading, setAgentsLoading] = createSignal(true);
    const [creatingAgent, setCreatingAgent] = createSignal(false);

    // === Confirm State ===
    const [acceptedTerms, setAcceptedTerms] = createSignal(false);
    const [acceptedBeta, setAcceptedBeta] = createSignal(false);

    // === Budget Helpers ===
    const totalPortfolioValue = createMemo(() => {
        const agg = aggregated();
        return agg?.totalValueKrw || 0;
    });

    const totalPortfolioValueUsd = createMemo(() => {
        const agg = aggregated();
        return agg?.totalValueUsd || 0;
    });

    const budgetPctOfTotal = (amount: number) => {
        const total = budgetConfig().currency === 'KRW' ? totalPortfolioValue() : totalPortfolioValueUsd();
        if (total <= 0 || amount <= 0) return 0;
        return Math.min((amount / total) * 100, 100);
    };

    const formatBudgetValue = (v: number) => {
        if (budgetConfig().currency === 'KRW') {
            if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
            if (v >= 10000) return `${(v / 10000).toFixed(0)}만`;
            return v.toLocaleString();
        }
        if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
        return `$${v.toLocaleString()}`;
    };

    const budgetCurrencySymbol = () => budgetConfig().currency === 'KRW' ? '₩' : '$';

    const updateBudgetField = <K extends keyof BudgetConfig>(key: K, value: BudgetConfig[K]) => {
        setBudgetConfig(prev => ({ ...prev, [key]: value }));
    };

    const budgetPresets = createMemo(() => {
        if (budgetConfig().currency === 'KRW') {
            return [500000, 1000000, 2000000, 5000000, 10000000];
        }
        return [500, 1000, 2000, 5000, 10000];
    });

    const budgetValidationWarnings = createMemo(() => {
        const cfg = budgetConfig();
        const warnings: string[] = [];
        const totalRef = cfg.currency === 'KRW' ? totalPortfolioValue() : totalPortfolioValueUsd();

        if (cfg.totalBudgetEnabled && cfg.totalBudget > totalRef && totalRef > 0) {
            warnings.push('전체 운용 한도가 보유 자산을 초과합니다.');
        }
        if (cfg.totalBudgetEnabled && cfg.perAssetBudgetEnabled && cfg.perAssetBudget > cfg.totalBudget && cfg.totalBudget > 0) {
            warnings.push('종목당 한도가 전체 한도보다 큽니다.');
        }
        if (cfg.perAssetBudgetEnabled && cfg.maxOrderSizeEnabled && cfg.maxOrderSize > cfg.perAssetBudget && cfg.perAssetBudget > 0) {
            warnings.push('1회 주문 한도가 종목당 한도보다 큽니다.');
        }
        if (cfg.dailyTradingLimitEnabled && cfg.maxOrderSizeEnabled && cfg.dailyTradingLimit < cfg.maxOrderSize) {
            warnings.push('일일 거래 한도가 1회 주문 한도보다 작습니다.');
        }
        return warnings;
    });

    // === Derived ===
    const displayAssets = createMemo(() => aggregated()?.assets || []);
    const hasCredentials = createMemo(() => credentials().length > 0);

    const filteredStrategies = createMemo(() => {
        let strategies = getSignalStrategies();
        // Market type filter
        if (marketFilter() === 'spot') strategies = strategies.filter(s => s.marketType === 'spot');
        else if (marketFilter() === 'futures') strategies = strategies.filter(s => s.marketType === 'futures');
        // Category filter
        if (categoryFilter() === 'all') return strategies;
        if (categoryFilter() === 'premium') return strategies.filter(s => s.premium);
        return strategies.filter(s => s.category === categoryFilter());
    });

    const krwToUsdRate = createMemo(() => {
        const agg = aggregated();
        if (agg && agg.totalValueKrw > 0 && agg.totalValueUsd > 0) {
            return agg.totalValueKrw / agg.totalValueUsd;
        }
        return 0;
    });

    // === Load CEX Data ===
    const loadData = async () => {
        setIsLoading(true);
        setError('');
        try {
            const [creds, portfolio] = await Promise.all([
                listCexApiKeys(),
                getCexPortfolio(),
            ]);
            setCredentials(creds);
            setPortfolios(portfolio.portfolios);
            setAggregated(portfolio.aggregated);
        } catch (err: any) {
            console.error('[Quant] Load failed:', err);
            setError(err.message || 'Failed to load portfolio data.');
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        loadData();

        // Subscribe to paper agents (realtime)
        const unsub = subscribeToPaperAgents((agents) => {
            setPaperAgents(agents);
            setAgentsLoading(false);
        });
        onCleanup(unsub);
    });

    // === Setup Helpers ===
    const toggleAsset = (currency: string) => {
        const current = selectedAssets();
        if (current.includes(currency)) {
            setSelectedAssets(current.filter(a => a !== currency));
        } else {
            setSelectedAssets([...current, currency]);
        }
    };

    const openSetup = (strategy: StrategyTemplate) => {
        setSelectedStrategy(strategy);
        setShowDetail(false);
        setShowSetup(true);
        setSelectedAssets([]);
        setAcceptedTerms(false);
        setAcceptedBeta(false);
        setBudgetConfig({ ...DEFAULT_BUDGET_CONFIG });
        setTradingMode('paper');
        // Initialize params from strategy defaults
        const params: Record<string, number | string | boolean> = {};
        strategy.parameters.forEach(p => { params[p.key] = p.value; });
        setCustomParams(params);
    };

    const openDetail = (strategy: StrategyTemplate) => {
        setSelectedStrategy(strategy);
        setShowDetail(true);
        setShowSetup(false);
    };

    // === Render ===
    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <WalletViewHeader
                    tag="QUANT"
                    title="Vision"
                    titleAccent="Quant Engine"
                    description="Apply verified strategy modules to your CEX assets and monitor signals in real-time."
                />

                {/* Beta Warning Banner */}
                <div class="flex items-start gap-3 px-4 py-3 bg-amber-500/[0.06] border border-amber-500/15 rounded-2xl">
                    <AlertTriangle class="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p class="text-xs font-bold text-amber-400 mb-0.5">Beta Service Notice</p>
                        <p class="text-[10px] text-amber-400/70 leading-relaxed">
                            본 서비스는 베타로 제공됩니다. 자동매매 전략은 시장 상황, 거래소 상태, 유동성, 슬리피지, 시스템 지연 등에 따라 예상과 다르게 동작할 수 있습니다. 자동매매로 인해 발생하는 손실에 대해 비전체인은 책임지지 않습니다.
                        </p>
                    </div>
                </div>

                {/* Error Banner */}
                <Show when={error()}>
                    <div class="flex items-center gap-3 px-4 py-3 bg-red-500/8 border border-red-500/15 rounded-2xl">
                        <AlertCircle class="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span class="text-xs text-red-300">{error()}</span>
                        <button onClick={() => setError('')} class="ml-auto text-red-400 hover:text-red-300">
                            <X class="w-3.5 h-3.5" />
                        </button>
                    </div>
                </Show>

                {/* Loading */}
                <Show when={isLoading()}>
                    <div class="flex items-center justify-center py-20">
                        <div class="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
                    </div>
                </Show>

                <Show when={!isLoading()}>
                    {/* No exchange connected */}
                    <Show when={!hasCredentials()}>
                        <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                            <QuantIcon />
                            <h3 class="text-lg font-black text-white mt-6 mb-2">Connect Exchange First</h3>
                            <p class="text-sm text-gray-500 text-center max-w-sm mb-6">
                                Vision Quant Engine을 사용하려면 먼저 CEX Portfolio에서 거래소를 연결하세요.
                            </p>
                        </div>
                    </Show>

                    <Show when={hasCredentials()}>
                        {/* Quick Stats */}
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Strategies</div>
                                <div class="text-lg font-black text-white">{getSignalStrategies().length}</div>
                            </div>
                            <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tradable Assets</div>
                                <div class="text-lg font-black text-white">{displayAssets().length}</div>
                            </div>
                            <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Active Agents</div>
                                <div class="text-lg font-black text-cyan-400">0</div>
                            </div>
                            <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Today P&L</div>
                                <div class="text-lg font-black text-gray-500">--</div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div class="flex items-center gap-1 bg-[#111113]/40 rounded-xl p-1 border border-white/[0.04]">
                            {(['strategies', 'agents', 'signals', 'reports'] as QuantTab[]).map(tab => (
                                <button
                                    onClick={() => setActiveTab(tab)}
                                    class={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab() === tab
                                        ? 'bg-white/[0.08] text-white shadow-lg'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                                        }`}
                                >
                                    {tab === 'strategies' && <StrategyIcon />}
                                    {tab === 'agents' && <BotIcon />}
                                    {tab === 'signals' && <Activity class="w-4 h-4" />}
                                    {tab === 'reports' && <BarChart3 class="w-4 h-4" />}
                                    <span class="capitalize">{tab}</span>
                                </button>
                            ))}
                        </div>

                        {/* ═══ STRATEGIES TAB ═══ */}
                        <Show when={activeTab() === 'strategies'}>
                            {/* Market Type Toggle */}
                            <div class="flex items-center gap-1.5 mb-3 bg-[#111113]/60 p-1 rounded-xl border border-white/[0.04] w-fit">
                                {(['all', 'spot', 'futures'] as const).map(m => (
                                    <button
                                        onClick={() => { setMarketFilter(m); setCategoryFilter('all'); }}
                                        class={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${marketFilter() === m
                                            ? m === 'futures'
                                                ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                            : 'text-gray-500 hover:text-gray-300 border border-transparent'
                                            }`}
                                    >
                                        {m === 'all' ? 'All' : m === 'spot' ? 'Spot' : 'Futures'}
                                        <span class="ml-1 text-[9px] opacity-60">
                                            {m === 'all' ? getSignalStrategies().length : m === 'spot' ? getSpotStrategies().length : getFuturesStrategies().length}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Category Filters */}
                            <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'premium', label: 'Premium' },
                                    ...(marketFilter() !== 'futures' ? [
                                        { id: 'trend_following', label: 'Trend' },
                                        { id: 'mean_reversion', label: 'Mean Reversion' },
                                        { id: 'multi_signal', label: 'Multi-Signal' },
                                        { id: 'breakout', label: 'Breakout' },
                                        { id: 'turtle_trading', label: 'Turtle' },
                                        { id: 'momentum_swing', label: 'Momentum' },
                                        { id: 'williams', label: 'Williams' },
                                        { id: 'stage_analysis', label: 'Stage' },
                                    ] : []),
                                    ...(marketFilter() !== 'spot' ? [
                                        { id: 'futures_trend', label: 'F-Trend' },
                                        { id: 'futures_mean_reversion', label: 'F-Mean Rev' },
                                        { id: 'futures_breakout', label: 'F-Breakout' },
                                        { id: 'futures_arbitrage', label: 'F-Arb' },
                                        { id: 'futures_scalping', label: 'F-Scalp' },
                                    ] : []),
                                ].map(cat => (
                                    <button
                                        onClick={() => setCategoryFilter(cat.id)}
                                        class={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap border ${categoryFilter() === cat.id
                                            ? cat.id === 'premium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                : cat.id.startsWith('futures_') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                            : 'bg-white/[0.02] text-gray-500 border-white/[0.04] hover:text-white hover:border-white/[0.1]'
                                            }`}
                                    >
                                        {cat.id === 'premium' && (
                                            <svg viewBox="0 0 24 24" class="w-3 h-3 inline mr-1 -mt-0.5" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                        )}
                                        {cat.label}
                                    </button>
                                ))}
                            </div>

                            {/* Strategy Cards */}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <For each={filteredStrategies()}>
                                    {(strategy) => (
                                        <div class={`bg-[#111113]/60 rounded-2xl border ${strategy.premium ? 'border-amber-500/15 hover:border-amber-500/30 ring-1 ring-amber-500/5' : strategy.marketType === 'futures' ? 'border-purple-500/10 hover:border-purple-500/25' : 'border-white/[0.04] hover:border-white/[0.1]'} transition-all group overflow-hidden`}>
                                            {/* Futures Banner */}
                                            <Show when={strategy.marketType === 'futures' && !strategy.premium}>
                                                <div class="flex items-center justify-between px-4 py-1.5 bg-gradient-to-r from-purple-500/10 via-purple-400/5 to-transparent border-b border-purple-500/10">
                                                    <div class="flex items-center gap-1.5">
                                                        <svg viewBox="0 0 24 24" class="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20M5 20V8l5-6 5 6v12M15 20V4l5 6v10" /><circle cx="10" cy="13" r="2" /><circle cx="17.5" cy="11" r="1.5" /></svg>
                                                        <span class="text-[9px] font-black text-purple-400 uppercase tracking-widest">Futures Strategy</span>
                                                    </div>
                                                    <Show when={strategy.maxLeverage}>
                                                        <span class="text-[8px] font-bold text-purple-300 bg-purple-400/10 px-1.5 py-0.5 rounded-full">Up to {strategy.maxLeverage}x</span>
                                                    </Show>
                                                </div>
                                            </Show>
                                            {/* Premium Banner */}
                                            <Show when={strategy.premium}>
                                                <div class="flex items-center justify-between px-4 py-1.5 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border-b border-amber-500/10">
                                                    <div class="flex items-center gap-1.5">
                                                        <svg viewBox="0 0 24 24" class="w-3 h-3 text-amber-400" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                                        <span class="text-[9px] font-black text-amber-400 uppercase tracking-widest">{strategy.marketType === 'futures' ? 'Premium Futures' : 'Premium Strategy'}</span>
                                                    </div>
                                                    <Show when={strategy.marketType === 'futures' && strategy.maxLeverage}>
                                                        <span class="text-[8px] font-bold text-purple-300 bg-purple-400/10 px-1.5 py-0.5 rounded-full">Up to {strategy.maxLeverage}x</span>
                                                    </Show>
                                                    <Show when={strategy.marketType !== 'futures'}>
                                                        <span class="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">FREE (Limited)</span>
                                                    </Show>
                                                </div>
                                            </Show>
                                            {/* Card Header */}
                                            <div class="p-4 pb-3">
                                                <div class="flex items-start justify-between mb-2">
                                                    <div class="flex-1 min-w-0">
                                                        <h4 class="text-sm font-black text-white truncate">{strategy.name}</h4>
                                                        <p class="text-[10px] text-gray-500 mt-0.5">{strategy.nameKo}</p>
                                                    </div>
                                                    <span class={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getRiskLevelColor(strategy.riskLevel)}`}>
                                                        {getRiskLevelLabel(strategy.riskLevel)}
                                                    </span>
                                                </div>

                                                <p class="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-3">
                                                    {strategy.shortDescriptionKo}
                                                </p>

                                                {/* Tags */}
                                                <div class="flex items-center gap-2 flex-wrap">
                                                    <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                                                        {getCategoryLabelKo(strategy.category)}
                                                    </span>
                                                    <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                                                        {strategy.recommendedTimeframe.toUpperCase()}
                                                    </span>
                                                    <For each={strategy.recommendedAssets.slice(0, 2)}>
                                                        {(asset) => (
                                                            <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-cyan-500/5 text-cyan-400/70 border border-cyan-500/10">
                                                                {asset.replace('KRW-', '')}
                                                            </span>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>

                                            {/* Card Footer */}
                                            <div class="flex items-center justify-between px-4 py-3 bg-white/[0.01] border-t border-white/[0.03]">
                                                <div class="flex items-center gap-3">
                                                    <div class="flex items-center gap-1 text-[10px] text-gray-500">
                                                        <Users class="w-3 h-3" />
                                                        <span>{strategy.userCount.toLocaleString()}</span>
                                                    </div>
                                                    <Show when={strategy.avgReturn30d !== undefined}>
                                                        <div class={`flex items-center gap-0.5 text-[10px] font-bold ${(strategy.avgReturn30d || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {(strategy.avgReturn30d || 0) >= 0 ? <TrendingUp class="w-3 h-3" /> : <TrendingDown class="w-3 h-3" />}
                                                            <span>{(strategy.avgReturn30d || 0) >= 0 ? '+' : ''}{strategy.avgReturn30d}%</span>
                                                            <span class="text-gray-600 font-normal">30d</span>
                                                        </div>
                                                    </Show>
                                                </div>
                                                <div class="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openDetail(strategy)}
                                                        class="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-all border border-white/[0.04]"
                                                    >
                                                        Detail
                                                    </button>
                                                    <button
                                                        onClick={() => openSetup(strategy)}
                                                        class="px-2.5 py-1.5 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg transition-all border border-cyan-500/20"
                                                    >
                                                        Setup
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>

                        {/* ═══ AGENTS TAB ═══ */}
                        <Show when={activeTab() === 'agents'}>
                            <div class="space-y-4">
                                {/* Loading */}
                                <Show when={agentsLoading()}>
                                    <div class="flex items-center justify-center py-16">
                                        <div class="animate-spin w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full" />
                                    </div>
                                </Show>

                                {/* No agents */}
                                <Show when={!agentsLoading() && paperAgents().length === 0}>
                                    <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                                        <BotIcon />
                                        <h3 class="text-base font-black text-white mt-4 mb-2">No Active Agents</h3>
                                        <p class="text-xs text-gray-500 text-center max-w-sm">
                                            전략 탭에서 전략을 선택하고 에이전트를 생성하여 자동매매를 시작하세요.
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('strategies')}
                                            class="mt-4 px-4 py-2 text-xs font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 rounded-xl transition-all border border-cyan-500/20"
                                        >
                                            Browse Strategies
                                        </button>
                                    </div>
                                </Show>

                                {/* Agent List */}
                                <Show when={!agentsLoading() && paperAgents().length > 0}>
                                    <For each={paperAgents()}>
                                        {(agent) => {
                                            const seedLabel = () => agent.seedCurrency === 'KRW'
                                                ? `\u20a9${agent.seed.toLocaleString()}`
                                                : `$${agent.seed.toLocaleString()}`;
                                            const valueLabel = () => agent.seedCurrency === 'KRW'
                                                ? `\u20a9${Math.round(agent.totalValue).toLocaleString()}`
                                                : `$${agent.totalValue.toLocaleString()}`;
                                            const pnlLabel = () => {
                                                const sign = agent.totalPnl >= 0 ? '+' : '';
                                                return agent.seedCurrency === 'KRW'
                                                    ? `${sign}\u20a9${Math.round(agent.totalPnl).toLocaleString()}`
                                                    : `${sign}$${agent.totalPnl.toFixed(2)}`;
                                            };
                                            const statusColor = () => {
                                                switch (agent.status) {
                                                    case 'running': return 'bg-green-400';
                                                    case 'paused': return 'bg-yellow-400';
                                                    case 'stopped': return 'bg-red-400';
                                                    case 'completed': return 'bg-gray-400';
                                                }
                                            };

                                            return (
                                                <div class="p-5 bg-[#111113]/60 rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-all">
                                                    {/* Header */}
                                                    <div class="flex items-start justify-between mb-4">
                                                        <div>
                                                            <div class="flex items-center gap-2 mb-1">
                                                                <div class={`w-2 h-2 rounded-full ${statusColor()} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
                                                                <span class="text-xs font-black text-white">{agent.strategyName}</span>
                                                                <span class="px-1.5 py-0.5 bg-amber-500/15 border border-amber-500/20 rounded text-[8px] font-black text-amber-400 uppercase tracking-wider">Paper</span>
                                                            </div>
                                                            <div class="text-[10px] text-gray-500">
                                                                {agent.selectedAssets.join(', ')} · {agent.status === 'running' ? 'Running' : agent.status === 'paused' ? 'Paused' : agent.status === 'stopped' ? 'Stopped' : 'Completed'}
                                                            </div>
                                                        </div>
                                                        <div class="text-right">
                                                            <div class={`text-sm font-black ${agent.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {pnlLabel()} ({agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnlPercent.toFixed(2)}%)
                                                            </div>
                                                            <div class="text-[10px] text-gray-500">P&L</div>
                                                        </div>
                                                    </div>

                                                    {/* Stats Grid */}
                                                    <div class="grid grid-cols-4 gap-3 mb-4">
                                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                                            <div class="text-[9px] text-gray-500 uppercase mb-0.5">Seed</div>
                                                            <div class="text-[11px] font-bold text-white">{seedLabel()}</div>
                                                        </div>
                                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                                            <div class="text-[9px] text-gray-500 uppercase mb-0.5">Value</div>
                                                            <div class="text-[11px] font-bold text-white">{valueLabel()}</div>
                                                        </div>
                                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                                            <div class="text-[9px] text-gray-500 uppercase mb-0.5">Trades</div>
                                                            <div class="text-[11px] font-bold text-white">{agent.totalTrades}</div>
                                                        </div>
                                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                                            <div class="text-[9px] text-gray-500 uppercase mb-0.5">Win Rate</div>
                                                            <div class="text-[11px] font-bold text-white">{agent.winRate.toFixed(1)}%</div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div class="flex items-center gap-2">
                                                        <Show when={agent.status === 'running'}>
                                                            <button
                                                                onClick={() => updatePaperAgentStatus(agent.id, 'paused')}
                                                                class="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 rounded-lg text-[10px] font-bold text-yellow-400 transition-colors"
                                                            >
                                                                <Pause class="w-3 h-3" />
                                                                Pause
                                                            </button>
                                                        </Show>
                                                        <Show when={agent.status === 'paused'}>
                                                            <button
                                                                onClick={() => updatePaperAgentStatus(agent.id, 'running')}
                                                                class="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-[10px] font-bold text-green-400 transition-colors"
                                                            >
                                                                <Play class="w-3 h-3" />
                                                                Resume
                                                            </button>
                                                        </Show>
                                                        <Show when={agent.status === 'running' || agent.status === 'paused'}>
                                                            <button
                                                                onClick={() => updatePaperAgentStatus(agent.id, 'stopped')}
                                                                class="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[10px] font-bold text-red-400 transition-colors"
                                                            >
                                                                <Square class="w-3 h-3" />
                                                                Stop
                                                            </button>
                                                        </Show>
                                                        <Show when={agent.status === 'stopped' || agent.status === 'completed'}>
                                                            <button
                                                                onClick={() => deletePaperAgent(agent.id)}
                                                                class="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg text-[10px] font-bold text-gray-400 transition-colors"
                                                            >
                                                                <X class="w-3 h-3" />
                                                                Delete
                                                            </button>
                                                        </Show>
                                                        <div class="ml-auto text-[9px] text-gray-600">
                                                            Created {new Date(agent.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </Show>
                            </div>
                        </Show>

                        {/* ═══ SIGNALS TAB ═══ */}
                        <Show when={activeTab() === 'signals'}>
                            <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                                <Activity class="w-6 h-6 text-gray-600" />
                                <h3 class="text-base font-black text-white mt-4 mb-2">No Signals Yet</h3>
                                <p class="text-xs text-gray-500 text-center max-w-sm">
                                    에이전트가 활성화되면 실시간 시그널이 여기에 표시됩니다.
                                </p>
                            </div>
                        </Show>

                        {/* ═══ REPORTS TAB ═══ */}
                        <Show when={activeTab() === 'reports'}>
                            <QuantReportLazy onBack={() => setActiveTab('strategies')} />
                        </Show>
                    </Show>
                </Show>

                {/* ═══ STRATEGY DETAIL MODAL ═══ */}
                <Show when={showDetail() && selectedStrategy()}>
                    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowDetail(false); }}>
                        <div class="w-full max-w-lg max-h-[85vh] bg-[#111113] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            {/* Detail Header */}
                            <div class="flex items-center justify-between p-5 border-b border-white/[0.04] flex-shrink-0">
                                <div>
                                    <h3 class="text-sm font-black text-white">{selectedStrategy()!.name}</h3>
                                    <p class="text-[10px] text-gray-500 mt-0.5">{selectedStrategy()!.nameKo}</p>
                                </div>
                                <button onClick={() => setShowDetail(false)} class="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                    <X class="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Detail Body */}
                            <div class="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                                {/* Premium Notice */}
                                <Show when={selectedStrategy()!.premium}>
                                    <div class="p-4 bg-gradient-to-br from-amber-500/[0.08] via-amber-400/[0.04] to-transparent rounded-2xl border border-amber-500/15">
                                        <div class="flex items-center gap-2 mb-2">
                                            <svg viewBox="0 0 24 24" class="w-4 h-4 text-amber-400" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            <span class="text-xs font-black text-amber-400">Premium Strategy</span>
                                        </div>
                                        <p class="text-[11px] text-amber-300/70 leading-relaxed mb-2">
                                            This premium strategy is currently available <span class="text-emerald-400 font-bold">free of charge</span> during our early access period. In the future, Premium strategies will require a paid subscription or eligible user level (Level 5+) to access for free.
                                        </p>
                                        <div class="flex items-center gap-3 text-[10px]">
                                            <div class="flex items-center gap-1 text-amber-400/60">
                                                <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                                <span>Early Access</span>
                                            </div>
                                            <div class="flex items-center gap-1 text-amber-400/60">
                                                <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                                <span>Level 5+ for free access</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                {/* Blog Content for Premium Strategies */}
                                <Show when={selectedStrategy()!.blogContent}>
                                    {(() => {
                                        const blog = selectedStrategy()!.blogContent!;
                                        return (
                                            <div class="space-y-4">
                                                {/* Hero Image */}
                                                <div class="relative rounded-xl overflow-hidden">
                                                    <img src={blog.heroImage} alt={blog.traderName} class="w-full h-44 object-cover" />
                                                    <div class="absolute inset-0 bg-gradient-to-t from-[#111113] via-transparent to-transparent" />
                                                    <div class="absolute bottom-3 left-4">
                                                        <div class="text-xs font-black text-white">{blog.traderName}</div>
                                                        <div class="text-[10px] text-gray-400 italic">{blog.traderTitle}</div>
                                                        <div class="text-[9px] text-gray-500 mt-0.5">{blog.origin}</div>
                                                    </div>
                                                </div>

                                                {/* Blog Sections */}
                                                <For each={blog.sections}>
                                                    {(section) => (
                                                        <div class="group">
                                                            <h5 class="text-[12px] font-black text-white mb-2 leading-snug">{section.heading}</h5>
                                                            <p class="text-[11px] text-gray-400 leading-relaxed">{section.body}</p>
                                                        </div>
                                                    )}
                                                </For>

                                                {/* Divider */}
                                                <div class="border-t border-white/[0.04]" />
                                            </div>
                                        );
                                    })()}
                                </Show>

                                {/* Description */}
                                <div>
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description</h4>
                                    <p class="text-xs text-gray-300 leading-relaxed">{selectedStrategy()!.descriptionKo}</p>
                                </div>

                                {/* Market Conditions */}
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="p-3 bg-green-500/5 rounded-xl border border-green-500/10">
                                        <div class="text-[10px] font-bold text-green-400 mb-1 flex items-center gap-1">
                                            <TrendingUp class="w-3 h-3" /> Favorable
                                        </div>
                                        <p class="text-[10px] text-gray-400">{selectedStrategy()!.favorableMarketKo}</p>
                                    </div>
                                    <div class="p-3 bg-red-500/5 rounded-xl border border-red-500/10">
                                        <div class="text-[10px] font-bold text-red-400 mb-1 flex items-center gap-1">
                                            <TrendingDown class="w-3 h-3" /> Weak
                                        </div>
                                        <p class="text-[10px] text-gray-400">{selectedStrategy()!.weakMarketKo}</p>
                                    </div>
                                </div>

                                {/* Parameters */}
                                <div>
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Default Parameters</h4>
                                    <div class="grid grid-cols-2 gap-2">
                                        <For each={selectedStrategy()!.parameters}>
                                            {(param) => (
                                                <div class="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                                                    <span class="text-[10px] text-gray-400">{param.labelKo}</span>
                                                    <span class="text-[10px] font-bold text-white">{String(param.value)}</span>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                {/* Exceptions */}
                                <div>
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Exception Rules</h4>
                                    <div class="space-y-1.5">
                                        <For each={selectedStrategy()!.exceptions}>
                                            {(exception) => (
                                                <div class="flex items-center gap-2 text-[10px] text-gray-400">
                                                    <Shield class="w-3 h-3 text-amber-400 flex-shrink-0" />
                                                    <span>{exception.replace(/_/g, ' ')}</span>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                {/* Risk Notice */}
                                <div class="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                                    <div class="flex items-center gap-1.5 mb-1">
                                        <AlertTriangle class="w-3 h-3 text-amber-400" />
                                        <span class="text-[10px] font-bold text-amber-400">Risk Notice</span>
                                    </div>
                                    <p class="text-[10px] text-amber-400/60 leading-relaxed">
                                        과거 성과는 미래 수익을 보장하지 않습니다. 시장 상황에 따라 전략의 유효성이 달라질 수 있습니다.
                                    </p>
                                </div>
                            </div>

                            {/* Detail Footer */}
                            <div class="flex items-center gap-3 p-5 border-t border-white/[0.04] flex-shrink-0">
                                <button onClick={() => setShowDetail(false)} class="flex-1 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors">
                                    Close
                                </button>
                                <button
                                    onClick={() => openSetup(selectedStrategy()!)}
                                    class="flex-1 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 rounded-xl text-sm font-black text-black transition-colors"
                                >
                                    Setup Strategy
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ═══ STRATEGY SETUP MODAL ═══ */}
                <Show when={showSetup() && selectedStrategy()}>
                    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowSetup(false); }}>
                        <div class="w-full max-w-2xl max-h-[90vh] bg-[#111113] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            {/* Setup Header */}
                            <div class="flex items-center justify-between p-5 border-b border-white/[0.04] flex-shrink-0">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-cyan-500/10 rounded-xl">
                                        <Settings class="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-black text-white">Setup: {selectedStrategy()!.name}</h3>
                                        <p class="text-[10px] text-gray-500">Select assets and configure parameters</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowSetup(false)} class="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                    <X class="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Setup Body */}
                            <div class="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                                {/* Mode Toggle */}
                                <div class="flex items-center gap-2 bg-white/[0.02] rounded-xl p-1 border border-white/[0.04]">
                                    <button
                                        onClick={() => setSetupMode('simple')}
                                        class={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${setupMode() === 'simple' ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Simple Mode
                                    </button>
                                    <button
                                        onClick={() => setSetupMode('advanced')}
                                        class={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${setupMode() === 'advanced' ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        Advanced Mode
                                    </button>
                                </div>

                                {/* Trading Mode Selection */}
                                <div>
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                                        </svg>
                                        Trading Mode
                                    </h4>
                                    <div class="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setTradingMode('paper')}
                                            class={`p-4 rounded-xl border text-left transition-all ${tradingMode() === 'paper'
                                                ? 'bg-amber-500/[0.06] border-amber-500/20'
                                                : 'bg-white/[0.01] border-white/[0.04] hover:border-white/[0.1]'}`}
                                        >
                                            <div class="flex items-center gap-2 mb-1.5">
                                                <div class={`w-2 h-2 rounded-full ${tradingMode() === 'paper' ? 'bg-amber-400' : 'bg-gray-600'}`} />
                                                <span class={`text-xs font-black ${tradingMode() === 'paper' ? 'text-amber-400' : 'text-gray-400'}`}>Paper Trading</span>
                                            </div>
                                            <p class="text-[10px] text-gray-500 leading-relaxed">
                                                모의 거래로 전략 테스트. 실제 자산 사용 없음.
                                            </p>
                                        </button>
                                        <button
                                            onClick={() => setTradingMode('live')}
                                            class={`p-4 rounded-xl border text-left transition-all ${tradingMode() === 'live'
                                                ? 'bg-cyan-500/[0.06] border-cyan-500/20'
                                                : 'bg-white/[0.01] border-white/[0.04] hover:border-white/[0.1]'}`}
                                        >
                                            <div class="flex items-center gap-2 mb-1.5">
                                                <div class={`w-2 h-2 rounded-full ${tradingMode() === 'live' ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                                                <span class={`text-xs font-black ${tradingMode() === 'live' ? 'text-cyan-400' : 'text-gray-400'}`}>Live Trading</span>
                                            </div>
                                            <p class="text-[10px] text-gray-500 leading-relaxed">
                                                실제 거래소 자산으로 자동 매매.
                                            </p>
                                        </button>
                                    </div>
                                    <Show when={tradingMode() === 'paper'}>
                                        <div class="flex items-center gap-1.5 mt-2 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                            <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
                                            <span class="text-[10px] text-amber-400">모의 거래는 실제 주문을 실행하지 않으며, 시장 가격 기반으로 시뮬레이션됩니다.</span>
                                        </div>
                                    </Show>
                                </div>

                                {/* Asset Selection from CEX Portfolio */}
                                <div>
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">
                                        Select Assets
                                        <span class="text-gray-600 font-normal ml-1">({selectedAssets().length} selected)</span>
                                    </h4>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                        <For each={displayAssets()} fallback={
                                            <div class="col-span-2 text-center text-xs text-gray-500 py-4">No assets available</div>
                                        }>
                                            {(asset) => {
                                                const isSelected = () => selectedAssets().includes(asset.currency);
                                                return (
                                                    <button
                                                        onClick={() => toggleAsset(asset.currency)}
                                                        class={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${isSelected()
                                                            ? 'bg-cyan-500/10 border-cyan-500/20'
                                                            : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1]'
                                                            }`}
                                                    >
                                                        <div class={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected() ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600'
                                                            }`}>
                                                            <Show when={isSelected()}>
                                                                <Check class="w-3 h-3 text-black" />
                                                            </Show>
                                                        </div>
                                                        <div class="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                                                            <span class="text-[9px] font-black text-gray-400">{asset.currency.slice(0, 2)}</span>
                                                        </div>
                                                        <div class="flex-1 min-w-0">
                                                            <div class="text-xs font-bold text-white">{asset.currency}</div>
                                                            <div class="text-[10px] text-gray-500">
                                                                {formatKrw(asset.valueKrw)}
                                                            </div>
                                                        </div>
                                                        <div class={`text-[10px] font-bold ${asset.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                            {asset.profitLoss >= 0 ? '+' : ''}{asset.profitLossPercent?.toFixed(1)}%
                                                        </div>
                                                    </button>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </div>

                                <Show when={setupMode() === 'simple'}>
                                    {/* Risk Profile */}
                                    <div>
                                        <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Risk Profile</h4>
                                        <div class="grid grid-cols-3 gap-2">
                                            {([
                                                { id: 'conservative' as const, label: 'Conservative', labelKo: '안정형', color: 'green' },
                                                { id: 'balanced' as const, label: 'Balanced', labelKo: '균형형', color: 'yellow' },
                                                { id: 'aggressive' as const, label: 'Aggressive', labelKo: '적극형', color: 'orange' },
                                            ]).map(profile => (
                                                <button
                                                    onClick={() => setRiskProfile(profile.id)}
                                                    class={`p-3 rounded-xl border text-center transition-all ${riskProfile() === profile.id
                                                        ? `bg-${profile.color}-500/10 border-${profile.color}-500/20`
                                                        : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1]'
                                                        }`}
                                                >
                                                    <div class={`text-xs font-bold ${riskProfile() === profile.id ? 'text-white' : 'text-gray-400'}`}>
                                                        {profile.label}
                                                    </div>
                                                    <div class="text-[10px] text-gray-500 mt-0.5">{profile.labelKo}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </Show>

                                <Show when={setupMode() === 'advanced'}>
                                    {/* Advanced Parameters */}
                                    <div>
                                        <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Parameters</h4>
                                        <div class="space-y-3">
                                            <For each={selectedStrategy()!.parameters}>
                                                {(param) => (
                                                    <div class="flex items-center justify-between gap-4">
                                                        <div class="flex-1 min-w-0">
                                                            <div class="text-[11px] font-bold text-gray-300">{param.labelKo}</div>
                                                            <div class="text-[9px] text-gray-600">{param.label}</div>
                                                        </div>
                                                        <Show when={param.type === 'number'}>
                                                            <div class="flex items-center gap-2">
                                                                <input
                                                                    type="range"
                                                                    min={param.min}
                                                                    max={param.max}
                                                                    step={param.step}
                                                                    value={Number(customParams()[param.key] ?? param.value)}
                                                                    onInput={(e) => {
                                                                        setCustomParams(prev => ({ ...prev, [param.key]: Number(e.currentTarget.value) }));
                                                                    }}
                                                                    class="w-24 accent-cyan-400"
                                                                />
                                                                <span class="text-xs font-bold text-white w-12 text-right">
                                                                    {customParams()[param.key] ?? param.value}
                                                                </span>
                                                            </div>
                                                        </Show>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                </Show>

                                {/* ═══ BUDGET ALLOCATION SECTION ═══ */}
                                <div>
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" /><path d="M6 16h4" />
                                        </svg>
                                        Budget Allocation
                                        <span class="text-[9px] font-normal text-gray-600 ml-auto">
                                            총 자산: {budgetConfig().currency === 'KRW' ? formatKrw(totalPortfolioValue()) : formatUsd(totalPortfolioValueUsd())}
                                        </span>
                                    </h4>

                                    {/* Currency Toggle */}
                                    <div class="flex items-center gap-1 mb-4 bg-white/[0.02] rounded-lg p-0.5 border border-white/[0.04] w-fit">
                                        <button
                                            onClick={() => updateBudgetField('currency', 'KRW')}
                                            class={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${budgetConfig().currency === 'KRW' ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >KRW (원)</button>
                                        <button
                                            onClick={() => updateBudgetField('currency', 'USD')}
                                            class={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${budgetConfig().currency === 'USD' ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                        >USD ($)</button>
                                    </div>

                                    <div class="space-y-4">
                                        {/* Total Budget */}
                                        <div class={`p-4 rounded-xl border transition-all ${budgetConfig().totalBudgetEnabled ? 'bg-cyan-500/[0.04] border-cyan-500/15' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                                            <div class="flex items-center justify-between mb-2">
                                                <div>
                                                    <div class="text-xs font-bold text-white">전체 운용 한도</div>
                                                    <div class="text-[10px] text-gray-500">에이전트가 사용할 최대 총 금액</div>
                                                </div>
                                                <button
                                                    onClick={() => updateBudgetField('totalBudgetEnabled', !budgetConfig().totalBudgetEnabled)}
                                                    class={`relative w-10 h-5 rounded-full transition-colors ${budgetConfig().totalBudgetEnabled ? 'bg-cyan-500' : 'bg-gray-700'}`}
                                                >
                                                    <div class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${budgetConfig().totalBudgetEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                            <Show when={budgetConfig().totalBudgetEnabled}>
                                                <div class="mt-3 space-y-2">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs text-gray-500 w-4 flex-shrink-0">{budgetCurrencySymbol()}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={budgetConfig().totalBudget || ''}
                                                            onInput={(e) => updateBudgetField('totalBudget', Number(e.currentTarget.value) || 0)}
                                                            placeholder="금액 입력"
                                                            class="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
                                                        />
                                                        <Show when={budgetConfig().totalBudget > 0}>
                                                            <span class="text-[10px] text-cyan-400 font-bold whitespace-nowrap">
                                                                {budgetPctOfTotal(budgetConfig().totalBudget).toFixed(1)}%
                                                            </span>
                                                        </Show>
                                                    </div>
                                                    <div class="flex items-center gap-1.5 flex-wrap">
                                                        <For each={budgetPresets()}>
                                                            {(preset) => (
                                                                <button
                                                                    onClick={() => updateBudgetField('totalBudget', preset)}
                                                                    class={`px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${budgetConfig().totalBudget === preset ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-white/[0.02] text-gray-500 border-white/[0.04] hover:text-white'}`}
                                                                >
                                                                    {formatBudgetValue(preset)}
                                                                </button>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>

                                        {/* Per Asset Budget */}
                                        <div class={`p-4 rounded-xl border transition-all ${budgetConfig().perAssetBudgetEnabled ? 'bg-cyan-500/[0.04] border-cyan-500/15' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                                            <div class="flex items-center justify-between mb-2">
                                                <div>
                                                    <div class="text-xs font-bold text-white">종목당 운용 한도</div>
                                                    <div class="text-[10px] text-gray-500">개별 코인에 투입할 최대 금액</div>
                                                </div>
                                                <button
                                                    onClick={() => updateBudgetField('perAssetBudgetEnabled', !budgetConfig().perAssetBudgetEnabled)}
                                                    class={`relative w-10 h-5 rounded-full transition-colors ${budgetConfig().perAssetBudgetEnabled ? 'bg-cyan-500' : 'bg-gray-700'}`}
                                                >
                                                    <div class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${budgetConfig().perAssetBudgetEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                            <Show when={budgetConfig().perAssetBudgetEnabled}>
                                                <div class="mt-3 space-y-2">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs text-gray-500 w-4 flex-shrink-0">{budgetCurrencySymbol()}</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={budgetConfig().perAssetBudget || ''}
                                                            onInput={(e) => updateBudgetField('perAssetBudget', Number(e.currentTarget.value) || 0)}
                                                            placeholder="금액 입력"
                                                            class="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
                                                        />
                                                        <Show when={budgetConfig().perAssetBudget > 0 && budgetConfig().totalBudgetEnabled && budgetConfig().totalBudget > 0}>
                                                            <span class="text-[10px] text-gray-400 font-bold whitespace-nowrap">
                                                                전체의 {((budgetConfig().perAssetBudget / budgetConfig().totalBudget) * 100).toFixed(0)}%
                                                            </span>
                                                        </Show>
                                                    </div>
                                                    <div class="flex items-center gap-1.5 flex-wrap">
                                                        <For each={budgetPresets().map(p => Math.round(p / 5))}>
                                                            {(preset) => (
                                                                <button
                                                                    onClick={() => updateBudgetField('perAssetBudget', preset)}
                                                                    class={`px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${budgetConfig().perAssetBudget === preset ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' : 'bg-white/[0.02] text-gray-500 border-white/[0.04] hover:text-white'}`}
                                                                >
                                                                    {formatBudgetValue(preset)}
                                                                </button>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>

                                        {/* Advanced-only: Max Order Size & Daily Limit */}
                                        <Show when={setupMode() === 'advanced'}>
                                            {/* Max Order Size */}
                                            <div class={`p-4 rounded-xl border transition-all ${budgetConfig().maxOrderSizeEnabled ? 'bg-purple-500/[0.04] border-purple-500/15' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                                                <div class="flex items-center justify-between mb-2">
                                                    <div>
                                                        <div class="text-xs font-bold text-white">1회 주문 최대 금액</div>
                                                        <div class="text-[10px] text-gray-500">한 번 주문에 넣을 수 있는 최대 금액</div>
                                                    </div>
                                                    <button
                                                        onClick={() => updateBudgetField('maxOrderSizeEnabled', !budgetConfig().maxOrderSizeEnabled)}
                                                        class={`relative w-10 h-5 rounded-full transition-colors ${budgetConfig().maxOrderSizeEnabled ? 'bg-purple-500' : 'bg-gray-700'}`}
                                                    >
                                                        <div class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${budgetConfig().maxOrderSizeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                    </button>
                                                </div>
                                                <Show when={budgetConfig().maxOrderSizeEnabled}>
                                                    <div class="mt-3">
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-xs text-gray-500 w-4 flex-shrink-0">{budgetCurrencySymbol()}</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={budgetConfig().maxOrderSize || ''}
                                                                onInput={(e) => updateBudgetField('maxOrderSize', Number(e.currentTarget.value) || 0)}
                                                                placeholder="금액 입력"
                                                                class="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
                                                            />
                                                        </div>
                                                    </div>
                                                </Show>
                                            </div>

                                            {/* Daily Trading Limit */}
                                            <div class={`p-4 rounded-xl border transition-all ${budgetConfig().dailyTradingLimitEnabled ? 'bg-purple-500/[0.04] border-purple-500/15' : 'bg-white/[0.01] border-white/[0.04]'}`}>
                                                <div class="flex items-center justify-between mb-2">
                                                    <div>
                                                        <div class="text-xs font-bold text-white">일일 거래 한도</div>
                                                        <div class="text-[10px] text-gray-500">하루 총 거래 금액 상한</div>
                                                    </div>
                                                    <button
                                                        onClick={() => updateBudgetField('dailyTradingLimitEnabled', !budgetConfig().dailyTradingLimitEnabled)}
                                                        class={`relative w-10 h-5 rounded-full transition-colors ${budgetConfig().dailyTradingLimitEnabled ? 'bg-purple-500' : 'bg-gray-700'}`}
                                                    >
                                                        <div class={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${budgetConfig().dailyTradingLimitEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                    </button>
                                                </div>
                                                <Show when={budgetConfig().dailyTradingLimitEnabled}>
                                                    <div class="mt-3">
                                                        <div class="flex items-center gap-2">
                                                            <span class="text-xs text-gray-500 w-4 flex-shrink-0">{budgetCurrencySymbol()}</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={budgetConfig().dailyTradingLimit || ''}
                                                                onInput={(e) => updateBudgetField('dailyTradingLimit', Number(e.currentTarget.value) || 0)}
                                                                placeholder="금액 입력"
                                                                class="flex-1 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
                                                            />
                                                        </div>
                                                    </div>
                                                </Show>
                                            </div>
                                        </Show>

                                        {/* Validation Warnings */}
                                        <Show when={budgetValidationWarnings().length > 0}>
                                            <div class="space-y-1.5">
                                                <For each={budgetValidationWarnings()}>
                                                    {(warning) => (
                                                        <div class="flex items-center gap-1.5 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                                            <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
                                                            <span class="text-[10px] text-amber-400">{warning}</span>
                                                        </div>
                                                    )}
                                                </For>
                                            </div>
                                        </Show>
                                    </div>
                                </div>

                                {/* Risk Summary Panel */}
                                <div class="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
                                    <h4 class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <Shield class="w-3.5 h-3.5 text-cyan-400" />
                                        Risk Summary
                                    </h4>
                                    <div class="grid grid-cols-2 gap-2">
                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                            <div class="text-[9px] text-gray-600 mb-0.5">Max Position</div>
                                            <div class="text-xs font-bold text-white">{selectedStrategy()!.riskRules.maxPositionPct}%</div>
                                        </div>
                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                            <div class="text-[9px] text-gray-600 mb-0.5">Daily Loss Limit</div>
                                            <div class="text-xs font-bold text-white">{selectedStrategy()!.riskRules.dailyDrawdownLimit}%</div>
                                        </div>
                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                            <div class="text-[9px] text-gray-600 mb-0.5">Weekly Loss Limit</div>
                                            <div class="text-xs font-bold text-white">{selectedStrategy()!.riskRules.weeklyDrawdownLimit}%</div>
                                        </div>
                                        <div class="p-2.5 bg-white/[0.02] rounded-lg">
                                            <div class="text-[9px] text-gray-600 mb-0.5">Vol Overlay</div>
                                            <div class="text-xs font-bold text-cyan-400">Enabled</div>
                                        </div>
                                        <Show when={budgetConfig().totalBudgetEnabled}>
                                            <div class="p-2.5 bg-cyan-500/[0.04] rounded-lg border border-cyan-500/10">
                                                <div class="text-[9px] text-gray-600 mb-0.5">Total Budget</div>
                                                <div class="text-xs font-bold text-cyan-400">{budgetCurrencySymbol()}{budgetConfig().totalBudget.toLocaleString()}</div>
                                            </div>
                                        </Show>
                                        <Show when={budgetConfig().perAssetBudgetEnabled}>
                                            <div class="p-2.5 bg-cyan-500/[0.04] rounded-lg border border-cyan-500/10">
                                                <div class="text-[9px] text-gray-600 mb-0.5">Per Asset</div>
                                                <div class="text-xs font-bold text-cyan-400">{budgetCurrencySymbol()}{budgetConfig().perAssetBudget.toLocaleString()}</div>
                                            </div>
                                        </Show>
                                    </div>
                                    <Show when={selectedAssets().length > 0 && Number(customParams()['max_position'] || selectedStrategy()!.riskRules.maxPositionPct) > 25}>
                                        <div class="flex items-center gap-1.5 mt-3 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                            <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
                                            <span class="text-[10px] text-amber-400">종목당 비중이 25%를 초과하여 리스크가 커질 수 있습니다.</span>
                                        </div>
                                    </Show>
                                </div>
                            </div>

                            {/* Setup Footer */}
                            <div class="flex items-center gap-3 p-5 border-t border-white/[0.04] flex-shrink-0">
                                <button onClick={() => setShowSetup(false)} class="flex-1 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors">
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { setShowSetup(false); setShowConfirm(true); }}
                                    disabled={selectedAssets().length === 0}
                                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-sm font-black text-black transition-colors"
                                >
                                    Review & Confirm
                                    <ArrowRight class="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ═══ CONFIRM MODAL ═══ */}
                <Show when={showConfirm() && selectedStrategy()}>
                    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
                        <div class="w-full max-w-md max-h-[85vh] bg-[#111113] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                            {/* Confirm Header */}
                            <div class="flex items-center justify-between p-5 border-b border-white/[0.04] flex-shrink-0">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-green-500/10 rounded-xl">
                                        <CheckCircle class="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-black text-white">Confirm Strategy</h3>
                                        <p class="text-[10px] text-gray-500">Review and create your agent</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowConfirm(false)} class="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                    <X class="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Confirm Body */}
                            <div class="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                                {/* Summary */}
                                <div class="space-y-2">
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Strategy</span>
                                        <span class="text-xs font-bold text-white">{selectedStrategy()!.name}</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Assets</span>
                                        <span class="text-xs font-bold text-cyan-400">{selectedAssets().join(', ')}</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Timeframe</span>
                                        <span class="text-xs font-bold text-white">{selectedStrategy()!.recommendedTimeframe.toUpperCase()}</span>
                                    </div>
                                    <div class={`flex items-center justify-between p-3 rounded-xl ${tradingMode() === 'paper' ? 'bg-amber-500/[0.04] border border-amber-500/10' : 'bg-cyan-500/[0.04] border border-cyan-500/10'}`}>
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Trading Mode</span>
                                        <span class={`text-xs font-black uppercase tracking-wider ${tradingMode() === 'paper' ? 'text-amber-400' : 'text-cyan-400'}`}>
                                            {tradingMode() === 'paper' ? 'Paper Trading' : 'Live Trading'}
                                        </span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Max Position</span>
                                        <span class="text-xs font-bold text-white">{selectedStrategy()!.riskRules.maxPositionPct}%</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Daily Loss Limit</span>
                                        <span class="text-xs font-bold text-red-400">{selectedStrategy()!.riskRules.dailyDrawdownLimit}%</span>
                                    </div>
                                    <Show when={budgetConfig().totalBudgetEnabled}>
                                        <div class="flex items-center justify-between p-3 bg-cyan-500/[0.03] rounded-xl border border-cyan-500/10">
                                            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Total Budget</span>
                                            <div class="text-right">
                                                <span class="text-xs font-bold text-cyan-400">{budgetCurrencySymbol()}{budgetConfig().totalBudget.toLocaleString()}</span>
                                                <div class="text-[9px] text-gray-500">전체 자산의 {budgetPctOfTotal(budgetConfig().totalBudget).toFixed(1)}%</div>
                                            </div>
                                        </div>
                                    </Show>
                                    <Show when={budgetConfig().perAssetBudgetEnabled}>
                                        <div class="flex items-center justify-between p-3 bg-cyan-500/[0.03] rounded-xl border border-cyan-500/10">
                                            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Per Asset Limit</span>
                                            <span class="text-xs font-bold text-cyan-400">{budgetCurrencySymbol()}{budgetConfig().perAssetBudget.toLocaleString()}</span>
                                        </div>
                                    </Show>
                                    <Show when={budgetConfig().maxOrderSizeEnabled}>
                                        <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Max Order Size</span>
                                            <span class="text-xs font-bold text-white">{budgetCurrencySymbol()}{budgetConfig().maxOrderSize.toLocaleString()}</span>
                                        </div>
                                    </Show>
                                    <Show when={budgetConfig().dailyTradingLimitEnabled}>
                                        <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Daily Trading Limit</span>
                                            <span class="text-xs font-bold text-white">{budgetCurrencySymbol()}{budgetConfig().dailyTradingLimit.toLocaleString()}</span>
                                        </div>
                                    </Show>
                                </div>

                                {/* Legal Checkboxes */}
                                <div class="space-y-3">
                                    <label class="flex items-start gap-3 cursor-pointer group">
                                        <div
                                            onClick={() => setAcceptedTerms(!acceptedTerms())}
                                            class={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${acceptedTerms() ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600 group-hover:border-gray-400'
                                                }`}
                                        >
                                            <Show when={acceptedTerms()}>
                                                <Check class="w-3 h-3 text-black" />
                                            </Show>
                                        </div>
                                        <span class="text-[11px] text-gray-400 leading-relaxed">
                                            [필수] 본 전략 설정 내용을 확인했습니다.
                                        </span>
                                    </label>
                                    <label class="flex items-start gap-3 cursor-pointer group">
                                        <div
                                            onClick={() => setAcceptedBeta(!acceptedBeta())}
                                            class={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${acceptedBeta() ? 'bg-cyan-500 border-cyan-500' : 'border-gray-600 group-hover:border-gray-400'
                                                }`}
                                        >
                                            <Show when={acceptedBeta()}>
                                                <Check class="w-3 h-3 text-black" />
                                            </Show>
                                        </div>
                                        <span class="text-[11px] text-gray-400 leading-relaxed">
                                            [필수] 본인은 자동매매 전략의 작동 원리와 위험성을 이해하였으며, 베타 서비스 특성상 주문 지연, 체결 오차, 전략 오작동 또는 시장 급변에 따른 손실이 발생할 수 있음을 인지합니다. 이에 따라 자동매매 운용 결과에 대한 책임은 본인에게 있으며, 비전체인은 해당 손실에 대해 책임지지 않습니다.
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* Confirm Footer */}
                            <div class="flex items-center gap-3 p-5 border-t border-white/[0.04] flex-shrink-0">
                                <button
                                    onClick={() => { setShowConfirm(false); setShowSetup(true); }}
                                    class="flex-1 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    disabled={!acceptedTerms() || !acceptedBeta() || selectedAssets().length === 0 || creatingAgent()}
                                    class={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black transition-colors ${tradingMode() === 'paper'
                                        ? 'bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black'
                                        : 'bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black'
                                        }`}
                                    onClick={async () => {
                                        if (tradingMode() === 'paper') {
                                            // Create Paper Trading Agent in Firestore
                                            setCreatingAgent(true);
                                            try {
                                                const strategy = selectedStrategy()!;
                                                // Determine seed currency based on exchange
                                                const creds = credentials();
                                                const firstCred = creds[0];
                                                const isKrw = !firstCred || firstCred.exchange === 'upbit' || firstCred.exchange === 'bithumb';
                                                const seedCurrency = isKrw ? 'KRW' as const : 'USDT' as const;

                                                await createPaperAgent({
                                                    strategyId: strategy.id,
                                                    strategyName: strategy.name,
                                                    selectedAssets: selectedAssets(),
                                                    params: customParams(),
                                                    budgetConfig: budgetConfig(),
                                                    riskProfile: riskProfile(),
                                                    seedCurrency,
                                                });

                                                console.log('[Quant] Paper agent created successfully');
                                            } catch (err) {
                                                console.error('[Quant] Failed to create paper agent:', err);
                                            } finally {
                                                setCreatingAgent(false);
                                            }
                                        } else {
                                            // Live trading - TODO
                                            console.log('[Quant] Live agent creation not yet implemented');
                                        }

                                        // Award quant_strategy_setup RP (fire-and-forget)
                                        const email = getFirebaseAuth().currentUser?.email;
                                        if (email) {
                                            getRPConfig().then(rpCfg => {
                                                addRewardPoints(email, rpCfg.quant_strategy_setup, 'quant_strategy_setup', `Setup ${selectedStrategy()!.name}`).catch(() => { });
                                            }).catch(() => { });
                                        }

                                        setShowConfirm(false);
                                        setActiveTab('agents');
                                    }}
                                >
                                    <Show when={creatingAgent()}>
                                        <div class="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                                    </Show>
                                    <Show when={!creatingAgent()}>
                                        <Play class="w-4 h-4" />
                                    </Show>
                                    {creatingAgent() ? 'Creating...' : tradingMode() === 'paper' ? 'Start Paper Trading' : 'Create Agent'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

            </div>
        </div>
    );
};

export default VisionQuantEngine;
