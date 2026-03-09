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
    getStrategyById,
    getRiskLevelColor,
    getRiskLevelLabel,
    getCategoryLabel,
    getCategoryLabelKo,
} from '../../services/quant/strategyRegistry';
import type { StrategyTemplate, StrategyParameter, ExceptionRule, StrategyBlogContent } from '../../services/quant/types';
import { addRewardPoints, getRPConfig, getFirebaseAuth } from '../../services/firebaseService';

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

type QuantTab = 'strategies' | 'agents' | 'signals';

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
    const [viewCurrency, setViewCurrency] = createSignal<'krw' | 'usd'>('krw');

    // === Setup State ===
    const [setupMode, setSetupMode] = createSignal<'simple' | 'advanced'>('simple');
    const [selectedAssets, setSelectedAssets] = createSignal<string[]>([]);
    const [selectedExchange, setSelectedExchange] = createSignal<string>('');
    const [riskProfile, setRiskProfile] = createSignal<'conservative' | 'balanced' | 'aggressive'>('balanced');
    const [customParams, setCustomParams] = createSignal<Record<string, number | string | boolean>>({});

    // === Confirm State ===
    const [acceptedTerms, setAcceptedTerms] = createSignal(false);
    const [acceptedBeta, setAcceptedBeta] = createSignal(false);

    // === Derived ===
    const displayAssets = createMemo(() => aggregated()?.assets || []);
    const hasCredentials = createMemo(() => credentials().length > 0);

    const filteredStrategies = createMemo(() => {
        const strategies = getSignalStrategies();
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

    onMount(() => { loadData(); });

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
                            {(['strategies', 'agents', 'signals'] as QuantTab[]).map(tab => (
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
                                    <span class="capitalize">{tab}</span>
                                </button>
                            ))}
                        </div>

                        {/* ═══ STRATEGIES TAB ═══ */}
                        <Show when={activeTab() === 'strategies'}>
                            {/* Category Filters */}
                            <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'premium', label: 'Premium' },
                                    { id: 'trend_following', label: 'Trend' },
                                    { id: 'mean_reversion', label: 'Mean Reversion' },
                                    { id: 'multi_signal', label: 'Multi-Signal' },
                                    { id: 'breakout', label: 'Breakout' },
                                    { id: 'turtle_trading', label: 'Turtle' },
                                    { id: 'momentum_swing', label: 'Momentum' },
                                    { id: 'williams', label: 'Williams' },
                                    { id: 'stage_analysis', label: 'Stage' },
                                ].map(cat => (
                                    <button
                                        onClick={() => setCategoryFilter(cat.id)}
                                        class={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap border ${categoryFilter() === cat.id
                                            ? cat.id === 'premium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
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
                                        <div class={`bg-[#111113]/60 rounded-2xl border ${strategy.premium ? 'border-amber-500/15 hover:border-amber-500/30 ring-1 ring-amber-500/5' : 'border-white/[0.04] hover:border-white/[0.1]'} transition-all group overflow-hidden`}>
                                            {/* Premium Banner */}
                                            <Show when={strategy.premium}>
                                                <div class="flex items-center justify-between px-4 py-1.5 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border-b border-amber-500/10">
                                                    <div class="flex items-center gap-1.5">
                                                        <svg viewBox="0 0 24 24" class="w-3 h-3 text-amber-400" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                                        <span class="text-[9px] font-black text-amber-400 uppercase tracking-widest">Premium Strategy</span>
                                                    </div>
                                                    <span class="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full">FREE (Limited)</span>
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
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Max Position</span>
                                        <span class="text-xs font-bold text-white">{selectedStrategy()!.riskRules.maxPositionPct}%</span>
                                    </div>
                                    <div class="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                                        <span class="text-[10px] text-gray-500 uppercase tracking-wider">Daily Loss Limit</span>
                                        <span class="text-xs font-bold text-red-400">{selectedStrategy()!.riskRules.dailyDrawdownLimit}%</span>
                                    </div>
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
                                    disabled={!acceptedTerms() || !acceptedBeta() || selectedAssets().length === 0}
                                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-sm font-black text-black transition-colors"
                                    onClick={() => {
                                        // TODO: Create agent via backend
                                        console.log('[Quant] Creating agent:', {
                                            strategy: selectedStrategy()!.id,
                                            assets: selectedAssets(),
                                            params: customParams(),
                                        });

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
                                    <Play class="w-4 h-4" />
                                    Create Agent
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
