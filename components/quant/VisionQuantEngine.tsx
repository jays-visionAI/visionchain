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

import { t, isKorean } from '../../services/localeUtil';
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
import type { StrategyTemplate, StrategyParameter, ExceptionRule, StrategyBlogContent, BudgetConfig, PaperAgent, PaperTrade, DecisionLogEntry, Competition, PerformanceReport, ReportPeriod } from '../../services/quant/types';
import { addRewardPoints, getRPConfig, getFirebaseAuth } from '../../services/firebaseService';
import { createPaperAgent, subscribeToPaperAgents, updatePaperAgentStatus, deletePaperAgent, updatePaperAgentConfig, getActiveCompetitions, joinCompetition, fetchPaperReport, subscribeToPaperTrades, subscribeToDecisionLogs, sendAgentSetupNotification, subscribeToDailyPnl } from '../../services/quant/paperTradingService';
import { type SupportedExchange } from '../../services/quant/exchangeKeyService';
import { lazy, onCleanup } from 'solid-js';
const QuantReportLazy = lazy(() => import('./QuantReport'));
const QuantArenaLazy = lazy(() => import('./QuantArenaLeaderboard'));

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

type QuantTab = 'strategies' | 'agents' | 'arena' | 'signals' | 'reports';

// ─── Decision Log Timeline (inline component) ─────────────────────────

const DecisionLogTimeline = (props: { agentId: string }) => {
    const [logs, setLogs] = createSignal<DecisionLogEntry[]>([]);
    const [loading, setLoading] = createSignal(true);

    onMount(() => {
        const unsub = subscribeToDecisionLogs(props.agentId, (entries) => {
            setLogs(entries);
            setLoading(false);
        }, 15);
        onCleanup(unsub);
    });

    return (
        <Show when={!loading()} fallback={
            <div class="text-[10px] text-gray-600 py-3">Loading decision logs...</div>
        }>
            <Show when={logs().length > 0} fallback={
                <div class="text-[10px] text-gray-600 py-3">No decision logs yet. Logs appear after the agent processes its first evaluation cycle.</div>
            }>
                <div class="space-y-1.5 max-h-[200px] overflow-y-auto" style="scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;">
                    <For each={logs()}>
                        {(log) => {
                            const isApproved = () => log.risk?.approved !== false;
                            const isNoSignal = () => log.signal?.side === 'none';
                            const timeStr = () => {
                                try { return new Date(log.timestamp).toLocaleTimeString(); } catch { return '-'; }
                            };
                            return (
                                <div class={`flex items-center gap-2 p-2 rounded-lg border transition-all ${isNoSignal()
                                        ? 'bg-white/[0.01] border-white/[0.03]'
                                        : isApproved()
                                            ? log.signal?.side === 'buy'
                                                ? 'bg-green-500/[0.04] border-green-500/10'
                                                : 'bg-red-500/[0.04] border-red-500/10'
                                            : 'bg-orange-500/[0.04] border-orange-500/10'
                                    }`}>
                                    {/* Side badge */}
                                    <div class={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-black ${isNoSignal() ? 'bg-gray-700 text-gray-400' :
                                            !isApproved() ? 'bg-orange-500/20 text-orange-400' :
                                                log.signal?.side === 'buy' ? 'bg-green-500/20 text-green-400' :
                                                    'bg-red-500/20 text-red-400'
                                        }`}>
                                        {isNoSignal() ? '-' : !isApproved() ? 'X' : log.signal?.side === 'buy' ? 'B' : 'S'}
                                    </div>
                                    {/* Info */}
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-1.5">
                                            <span class="text-[10px] font-bold text-white truncate">
                                                {isNoSignal() ? 'No Signal' : log.signal?.asset?.replace('KRW-', '') || '-'}
                                            </span>
                                            <Show when={!isApproved()}>
                                                <span class="text-[8px] text-orange-400 px-1 py-0.5 bg-orange-500/10 rounded">
                                                    {log.risk?.layer || 'Blocked'}
                                                </span>
                                            </Show>
                                            <Show when={isApproved() && log.execution}>
                                                <span class="text-[8px] text-cyan-400 px-1 py-0.5 bg-cyan-500/10 rounded">Executed</span>
                                            </Show>
                                        </div>
                                        <div class="text-[8px] text-gray-600 truncate mt-0.5">
                                            {!isApproved() ? (log.risk?.rejectReason || 'Blocked') : (log.signal?.reason || '-')}
                                        </div>
                                    </div>
                                    {/* Time + PnL */}
                                    <div class="text-right flex-shrink-0">
                                        <Show when={log.execution?.pnl !== undefined && log.execution?.pnl !== null}>
                                            <div class={`text-[10px] font-bold ${(log.execution?.pnlPercent || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                                                }`}>
                                                {(log.execution?.pnlPercent || 0) >= 0 ? '+' : ''}{(log.execution?.pnlPercent || 0).toFixed(2)}%
                                            </div>
                                        </Show>
                                        <div class="text-[8px] text-gray-600">{timeStr()}</div>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </Show>
    );
};

// ─── Trade Toast Notification Component ─────────────────────────────────────

interface ToastItem {
    id: number;
    trade: PaperTrade;
    exiting: boolean;
}

const TradeToast = (props: { toasts: ToastItem[]; onDismiss: (id: number) => void }) => {
    return (
        <div class="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2 pointer-events-none" style="max-width: 320px;">
            <For each={props.toasts}>
                {(toast) => {
                    const isBuy = () => toast.trade.side === 'buy';
                    const pnlStr = () => {
                        if (toast.trade.side === 'buy') return '';
                        const sign = toast.trade.pnl >= 0 ? '+' : '';
                        return `${sign}${toast.trade.pnlPercent.toFixed(2)}%`;
                    };
                    return (
                        <div
                            class={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl transition-all duration-500 ${
                                toast.exiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'
                            } ${
                                isBuy()
                                    ? 'bg-green-950/80 border-green-500/20'
                                    : toast.trade.pnl >= 0
                                        ? 'bg-green-950/80 border-green-500/20'
                                        : 'bg-red-950/80 border-red-500/20'
                            }`}
                            onClick={() => props.onDismiss(toast.id)}
                        >
                            <div class={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isBuy() ? 'bg-green-500/20' : 'bg-red-500/20'
                            }`}>
                                <svg viewBox="0 0 24 24" class={`w-4 h-4 ${isBuy() ? 'text-green-400' : 'text-red-400'}`} fill="none" stroke="currentColor" stroke-width="2.5">
                                    {isBuy()
                                        ? <path d="M12 19V5m-7 7l7-7 7 7" stroke-linecap="round" stroke-linejoin="round" />
                                        : <path d="M12 5v14m7-7l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round" />
                                    }
                                </svg>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2">
                                    <span class={`text-xs font-black ${isBuy() ? 'text-green-400' : 'text-red-400'}`}>
                                        {isBuy() ? 'BUY' : 'SELL'}
                                    </span>
                                    <span class="text-xs font-bold text-white">
                                        {toast.trade.asset.replace('KRW-', '')}
                                    </span>
                                    <Show when={!isBuy() && pnlStr()}>
                                        <span class={`text-[10px] font-bold ${toast.trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {pnlStr()}
                                        </span>
                                    </Show>
                                </div>
                                <div class="text-[10px] text-gray-400 mt-0.5">
                                    {toast.trade.quantity.toFixed(4)} @ {toast.trade.price.toLocaleString()}
                                </div>
                            </div>
                        </div>
                    );
                }}
            </For>
        </div>
    );
};

// ─── Trade History Panel Component ──────────────────────────────────────────

const TradeHistoryPanel = (props: { agentId: string; seedCurrency: string }) => {
    const [trades, setTrades] = createSignal<PaperTrade[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [sideFilter, setSideFilter] = createSignal<'all' | 'buy' | 'sell'>('all');

    onMount(() => {
        const unsub = subscribeToPaperTrades(props.agentId, (t) => {
            setTrades(t);
            setLoading(false);
        }, 50);
        onCleanup(unsub);
    });

    const filtered = createMemo(() => {
        const f = sideFilter();
        if (f === 'all') return trades();
        return trades().filter(t => t.side === f);
    });

    const formatVal = (v: number) => {
        if (props.seedCurrency === 'KRW') {
            if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(1)}\u{B9CC}`;
            return Math.round(v).toLocaleString();
        }
        return `$${v.toFixed(2)}`;
    };

    return (
        <div>
            <div class="flex items-center justify-between mb-2">
                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Trade History</div>
                <div class="flex gap-1">
                    {(['all', 'buy', 'sell'] as const).map(f => (
                        <button
                            onClick={() => setSideFilter(f)}
                            class={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                                sideFilter() === f
                                    ? f === 'buy' ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                                      : f === 'sell' ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                      : 'bg-white/[0.06] text-white border border-white/[0.08]'
                                    : 'text-gray-600 hover:text-gray-400 border border-transparent'
                            }`}
                        >
                            {f === 'all' ? 'All' : f === 'buy' ? 'Buy' : 'Sell'}
                        </button>
                    ))}
                </div>
            </div>
            <Show when={!loading()} fallback={
                <div class="text-[10px] text-gray-600 py-3">Loading trades...</div>
            }>
                <Show when={filtered().length > 0} fallback={
                    <div class="text-[10px] text-gray-600 py-3">No trades yet.</div>
                }>
                    <div class="max-h-[240px] overflow-y-auto space-y-1" style="scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;">
                        <For each={filtered()}>
                            {(trade) => (
                                <div class="flex items-center gap-2 p-2 rounded-lg bg-white/[0.015] border border-white/[0.03] hover:border-white/[0.06] transition-all">
                                    <div class={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-[8px] font-black ${
                                        trade.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        {trade.side === 'buy' ? 'B' : 'S'}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-1.5">
                                            <span class="text-[10px] font-bold text-white">{trade.asset.replace('KRW-', '')}</span>
                                            <span class="text-[9px] text-gray-500">{trade.quantity.toFixed(4)}</span>
                                            <span class="text-[9px] text-gray-600">@</span>
                                            <span class="text-[9px] text-gray-400">{trade.price.toLocaleString()}</span>
                                        </div>
                                        <div class="text-[8px] text-gray-600 mt-0.5">
                                            {new Date(trade.timestamp).toLocaleString()}
                                            {trade.fee > 0 && <span class="ml-2">Fee: {formatVal(trade.fee)}</span>}
                                        </div>
                                    </div>
                                    <div class="text-right flex-shrink-0">
                                        <Show when={trade.side === 'sell'}>
                                            <div class={`text-[10px] font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                                            </div>
                                            <div class={`text-[8px] ${trade.pnl >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                                                {trade.pnl >= 0 ? '+' : ''}{formatVal(trade.pnl)}
                                            </div>
                                        </Show>
                                        <Show when={trade.side === 'buy'}>
                                            <div class="text-[10px] font-bold text-gray-400">{formatVal(trade.value)}</div>
                                        </Show>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

// ─── PnL Dashboard Component ────────────────────────────────────────────────

const PnLDashboard = (props: { agentId: string; seed: number; seedCurrency: string }) => {
    const [snapshots, setSnapshots] = createSignal<{ date: string; totalValue: number; totalPnl: number; totalPnlPercent: number; btcPrice?: number }[]>([]);
    const [loading, setLoading] = createSignal(true);

    onMount(() => {
        const unsub = subscribeToDailyPnl(props.agentId, (s) => {
            setSnapshots(s);
            setLoading(false);
        });
        onCleanup(unsub);
    });

    const chartData = createMemo(() => {
        const data = snapshots();
        if (data.length === 0) return null;
        const values = data.map(d => d.totalPnlPercent || 0);
        const minVal = Math.min(0, ...values);
        const maxVal = Math.max(0, ...values);
        const range = maxVal - minVal || 1;
        return { data, values, minVal, maxVal, range };
    });

    const stats = createMemo(() => {
        const data = snapshots();
        if (data.length === 0) return null;
        const last = data[data.length - 1];
        const maxDD = data.reduce((dd, d) => Math.min(dd, d.totalPnlPercent || 0), 0);
        const returns = data.map(d => d.totalPnlPercent || 0);
        const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((s, r) => s + (r - avg) ** 2, 0) / returns.length;
        const vol = Math.sqrt(variance);
        const sharpe = vol > 0 ? (avg / vol) * Math.sqrt(252) : 0;
        return {
            totalReturn: last.totalPnlPercent || 0,
            maxDrawdown: maxDD,
            sharpe,
            days: data.length,
        };
    });

    return (
        <div>
            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Equity Curve</div>
            <Show when={!loading()} fallback={
                <div class="text-[10px] text-gray-600 py-3">Loading PnL data...</div>
            }>
                <Show when={chartData()} fallback={
                    <div class="text-[10px] text-gray-600 py-3">No PnL data yet. Data appears after the first daily snapshot.</div>
                }>
                    {(cd) => {
                        const d = cd();
                        const W = 400;
                        const H = 120;
                        const PAD = 2;
                        const points = d.values.map((v, i) => {
                            const x = PAD + (i / Math.max(d.values.length - 1, 1)) * (W - PAD * 2);
                            const y = H - PAD - ((v - d.minVal) / d.range) * (H - PAD * 2);
                            return `${x},${y}`;
                        });
                        const zeroY = H - PAD - ((0 - d.minVal) / d.range) * (H - PAD * 2);
                        const path = `M${points.join(' L')}`;
                        const areaPath = `${path} L${PAD + ((d.values.length - 1) / Math.max(d.values.length - 1, 1)) * (W - PAD * 2)},${zeroY} L${PAD},${zeroY} Z`;
                        const lastVal = d.values[d.values.length - 1];
                        const lineColor = lastVal >= 0 ? '#4ade80' : '#f87171';
                        const fillColor = lastVal >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)';

                        return (
                            <div class="space-y-3">
                                <div class="bg-white/[0.02] rounded-xl border border-white/[0.04] p-3">
                                    <svg viewBox={`0 0 ${W} ${H}`} class="w-full" style="height: 120px;" preserveAspectRatio="none">
                                        {/* Zero line */}
                                        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="4,4" />
                                        {/* Area fill */}
                                        <path d={areaPath} fill={fillColor} />
                                        {/* Line */}
                                        <path d={path} fill="none" stroke={lineColor} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                        {/* End dot */}
                                        <circle cx={parseFloat(points[points.length - 1].split(',')[0])} cy={parseFloat(points[points.length - 1].split(',')[1])} r="3" fill={lineColor} />
                                    </svg>
                                    <div class="flex justify-between mt-1">
                                        <span class="text-[8px] text-gray-600">{d.data[0].date}</span>
                                        <span class="text-[8px] text-gray-600">{d.data[d.data.length - 1].date}</span>
                                    </div>
                                </div>

                                <Show when={stats()}>
                                    {(s) => (
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div class="p-2 bg-white/[0.02] rounded-lg">
                                                <div class="text-[9px] text-gray-500 mb-0.5">Total Return</div>
                                                <div class={`text-[11px] font-black ${s().totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {s().totalReturn >= 0 ? '+' : ''}{s().totalReturn.toFixed(2)}%
                                                </div>
                                            </div>
                                            <div class="p-2 bg-white/[0.02] rounded-lg">
                                                <div class="text-[9px] text-gray-500 mb-0.5">Max Drawdown</div>
                                                <div class="text-[11px] font-black text-red-400">
                                                    {s().maxDrawdown.toFixed(2)}%
                                                </div>
                                            </div>
                                            <div class="p-2 bg-white/[0.02] rounded-lg">
                                                <div class="text-[9px] text-gray-500 mb-0.5">Sharpe Ratio</div>
                                                <div class={`text-[11px] font-black ${s().sharpe >= 1 ? 'text-green-400' : s().sharpe >= 0 ? 'text-white' : 'text-red-400'}`}>
                                                    {s().sharpe.toFixed(2)}
                                                </div>
                                            </div>
                                            <div class="p-2 bg-white/[0.02] rounded-lg">
                                                <div class="text-[9px] text-gray-500 mb-0.5">Days Running</div>
                                                <div class="text-[11px] font-black text-white">{s().days}</div>
                                            </div>
                                        </div>
                                    )}
                                </Show>
                            </div>
                        );
                    }}
                </Show>
            </Show>
        </div>
    );
};

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
    const [successToast, setSuccessToast] = createSignal<string | null>(null);
    const [tradeToasts, setTradeToasts] = createSignal<ToastItem[]>([]);
    let tradeToastCounter = 0;
    let prevTradeCount = 0;
    const [activeCompetitions, setActiveCompetitions] = createSignal<Competition[]>([]);
    const [expandedAgentId, setExpandedAgentId] = createSignal<string | null>(null);
    const [reportData, setReportData] = createSignal<PerformanceReport | null>(null);
    const [reportLoading, setReportLoading] = createSignal(false);
    const [reportAgentId, setReportAgentId] = createSignal<string | null>(null);

    // === Confirm State ===
    const [acceptedTerms, setAcceptedTerms] = createSignal(false);
    const [acceptedBeta, setAcceptedBeta] = createSignal(false);

    // === Exchange Key State (Live Trading) ===
    // Exchange keys are now managed via CEX Portfolio; live trading uses credentials directly.

    // === Signals Tab State ===
    const [signalTrades, setSignalTrades] = createSignal<PaperTrade[]>([]);
    const [signalFilter, setSignalFilter] = createSignal<'all' | 'buy' | 'sell'>('all');
    const [signalAgentFilter, setSignalAgentFilter] = createSignal<string>('all');

    // Exchange metadata for UI
    const EXCHANGE_LIST = [
        {
            group: 'KRW', exchanges: [
                { id: 'upbit' as SupportedExchange, name: 'Upbit', nameKo: '업비트', color: '#093687', futures: false },
                { id: 'bithumb' as SupportedExchange, name: 'Bithumb', nameKo: '빗썸', color: '#F37021', futures: false },
                { id: 'coinone' as SupportedExchange, name: 'Coinone', nameKo: '코인원', color: '#0066FF', futures: false },
            ]
        },
        {
            group: 'USDT', exchanges: [
                { id: 'binance' as SupportedExchange, name: 'Binance', nameKo: '바이낸스', color: '#F3BA2F', futures: true },
                { id: 'bybit' as SupportedExchange, name: 'Bybit', nameKo: '바이비트', color: '#FF9800', futures: true },
                { id: 'bitget' as SupportedExchange, name: 'Bitget', nameKo: '비트겟', color: '#00B897', futures: true, passphrase: true },
                { id: 'okx' as SupportedExchange, name: 'OKX', nameKo: 'OKX', color: '#FFFFFF', futures: true, passphrase: true },
                { id: 'kucoin' as SupportedExchange, name: 'KuCoin', nameKo: '쿠코인', color: '#24AE8F', futures: true, passphrase: true },
                { id: 'mexc' as SupportedExchange, name: 'MEXC', nameKo: 'MEXC', color: '#00B6A0', futures: true },
                { id: 'cryptocom' as SupportedExchange, name: 'Crypto.com', nameKo: '크립토닷컴', color: '#103F68', futures: false, passphrase: true },
            ]
        },
        {
            group: 'THB', exchanges: [
                { id: 'bitkub' as SupportedExchange, name: 'Bitkub', nameKo: '비트쿱', color: '#00A651', futures: false },
            ]
        },
        {
            group: 'USD', exchanges: [
                { id: 'coinbase' as SupportedExchange, name: 'Coinbase', nameKo: '코인베이스', color: '#0052FF', futures: false },
            ]
        },
        {
            group: 'JPY', exchanges: [
                { id: 'bitflyer' as SupportedExchange, name: 'bitFlyer', nameKo: '비트플라이어', color: '#FF9900', futures: false },
                { id: 'gmo' as SupportedExchange, name: 'GMO Coin', nameKo: 'GMO 코인', color: '#003C8F', futures: false },
                { id: 'coincheck' as SupportedExchange, name: 'Coincheck', nameKo: '코인체크', color: '#26C6DA', futures: false },
            ]
        },
    ];

    const selectedExchangeMeta = createMemo(() => {
        const exId = selectedExchange();
        if (!exId) return null;
        for (const g of EXCHANGE_LIST) {
            const found = g.exchanges.find(e => e.id === exId);
            if (found) return found;
        }
        return null;
    });

    // Registered exchanges from CEX Portfolio credentials (active only)
    const registeredExchanges = createMemo(() => {
        return credentials().filter(c => c.status === 'active');
    });

    // Selected credential for live trading
    const selectedCredential = createMemo(() => {
        const ex = selectedExchange();
        if (!ex) return null;
        return registeredExchanges().find(c => c.exchange === ex) || null;
    });

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
            warnings.push(t('Total budget exceeds portfolio value.', '전체 운용 한도가 보유 자산을 초과합니다.'));
        }
        if (cfg.totalBudgetEnabled && cfg.perAssetBudgetEnabled && cfg.perAssetBudget > cfg.totalBudget && cfg.totalBudget > 0) {
            warnings.push(t('Per-asset limit exceeds total budget.', '종목당 한도가 전체 한도보다 큽니다.'));
        }
        if (cfg.perAssetBudgetEnabled && cfg.maxOrderSizeEnabled && cfg.maxOrderSize > cfg.perAssetBudget && cfg.perAssetBudget > 0) {
            warnings.push(t('Max order size exceeds per-asset limit.', '1회 주문 한도가 종목당 한도보다 큽니다.'));
        }
        if (cfg.dailyTradingLimitEnabled && cfg.maxOrderSizeEnabled && cfg.dailyTradingLimit < cfg.maxOrderSize) {
            warnings.push(t('Daily trading limit is below max order size.', '일일 거래 한도가 1회 주문 한도보다 작습니다.'));
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
        return strategies;
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

        // Load active competitions
        getActiveCompetitions().then(comps => {
            setActiveCompetitions(comps);
        }).catch(() => { /* silent */ });
    });

    // === Signals Tab: Subscribe to all agents' trades ===
    {
        let tradeUnsubs: (() => void)[] = [];
        createEffect(() => {
            const agents = paperAgents();
            // Cleanup previous subscriptions
            tradeUnsubs.forEach(u => u());
            tradeUnsubs = [];
            if (agents.length === 0) { setSignalTrades([]); return; }

            const allTrades: Record<string, PaperTrade[]> = {};
            const mergeAndSet = () => {
                const merged = Object.values(allTrades).flat()
                    .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
                setSignalTrades(merged);
            };

            for (const agent of agents) {
                allTrades[agent.id] = [];
                const unsub = subscribeToPaperTrades(agent.id, (trades) => {
                    allTrades[agent.id] = trades;
                    mergeAndSet();
                }, 30);
                tradeUnsubs.push(unsub);
            }
        });
        onCleanup(() => tradeUnsubs.forEach(u => u()));

        // Watch for new trades and show toast
        createEffect(() => {
            const currentTrades = signalTrades();
            if (prevTradeCount > 0 && currentTrades.length > prevTradeCount) {
                const newCount = currentTrades.length - prevTradeCount;
                const newest = currentTrades.slice(0, Math.min(newCount, 3));
                for (const trade of newest) {
                    const id = ++tradeToastCounter;
                    setTradeToasts(prev => [...prev.slice(-2), { id, trade, exiting: false }]);
                    setTimeout(() => {
                        setTradeToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
                        setTimeout(() => {
                            setTradeToasts(prev => prev.filter(t => t.id !== id));
                        }, 500);
                    }, 4000);
                }
            }
            prevTradeCount = currentTrades.length;
        });
    }

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
        setSelectedExchange('');
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
                            <h3 class="text-lg font-black text-white mt-6 mb-2">{t('Connect Exchange First', '거래소 연결이 필요합니다')}</h3>
                            <p class="text-sm text-gray-500 text-center max-w-sm mb-6">
                                {t('To use Vision Quant Engine, connect your exchange first in CEX Portfolio.', 'Vision Quant Engine을 사용하려면 먼저 CEX Portfolio에서 거래소를 연결하세요.')}
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
                                <div class="text-lg font-black text-cyan-400">{paperAgents().filter(a => a.status === 'running').length}</div>
                            </div>
                            <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Today P&L</div>
                                <div class="text-lg font-black text-gray-500">--</div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div class="relative">
                            {/* Right fade indicator for scroll hint */}
                            <div class="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#070708] to-transparent z-10 pointer-events-none md:hidden" />
                            <div
                                class="flex items-center gap-1 overflow-x-auto scrollbar-hide scroll-smooth border-b border-white/[0.06] pb-0 -mx-1 px-1"
                                style="-webkit-overflow-scrolling: touch;"
                            >
                                {(['strategies', 'agents', 'arena', 'signals', 'reports'] as QuantTab[]).map(tab => (
                                    <button
                                        onClick={() => setActiveTab(tab)}
                                        class={`flex items-center justify-center gap-1.5 px-4 py-3 whitespace-nowrap text-xs font-bold transition-all relative flex-shrink-0 ${activeTab() === tab
                                            ? tab === 'arena'
                                                ? 'text-cyan-400'
                                                : 'text-white'
                                            : 'text-gray-500 hover:text-gray-300'
                                            }`}
                                    >
                                        {tab === 'strategies' && <StrategyIcon />}
                                        {tab === 'agents' && <BotIcon />}
                                        {tab === 'arena' && (
                                            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                                <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                                                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                            </svg>
                                        )}
                                        {tab === 'signals' && <Activity class="w-4 h-4" />}
                                        {tab === 'reports' && <BarChart3 class="w-4 h-4" />}
                                        <span class="capitalize">{tab === 'arena' ? 'Arena' : tab}</span>
                                        {/* Active underline indicator */}
                                        <Show when={activeTab() === tab}>
                                            <div class={`absolute bottom-0 left-2 right-2 h-[2px] rounded-full ${tab === 'arena' ? 'bg-cyan-400' : 'bg-white'}`} />
                                        </Show>
                                    </button>
                                ))}
                            </div>
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
                                                        <h4 class="text-sm font-black text-white truncate">{isKorean() ? strategy.nameKo : strategy.name}</h4>
                                                        <p class="text-[10px] text-gray-500 mt-0.5">{isKorean() ? strategy.name : strategy.nameKo}</p>
                                                    </div>
                                                    <span class={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getRiskLevelColor(strategy.riskLevel)}`}>
                                                        {getRiskLevelLabel(strategy.riskLevel)}
                                                    </span>
                                                </div>

                                                <p class="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-3">
                                                    {isKorean() ? strategy.shortDescriptionKo : strategy.shortDescription}
                                                </p>

                                                {/* Tags */}
                                                <div class="flex items-center gap-2 flex-wrap">
                                                    <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-white/[0.04] text-gray-400 border border-white/[0.06]">
                                                        {isKorean() ? getCategoryLabelKo(strategy.category) : getCategoryLabel(strategy.category)}
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
                                        <p class="text-xs text-gray-500 text-center max-w-sm mb-4">
                                            Trading Agent is a bot that automatically monitors the market and executes trades based on a strategy you configure.
                                        </p>
                                        <div class="w-full max-w-sm space-y-2 mb-5">
                                            <div class="flex items-start gap-2.5 p-2.5 bg-white/[0.02] rounded-lg">
                                                <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span class="text-[9px] font-black text-cyan-400">1</span>
                                                </div>
                                                <div>
                                                    <div class="text-[11px] font-bold text-white">Select Strategy</div>
                                                    <div class="text-[10px] text-gray-500">Strategies tab where you can browse and choose a strategy</div>
                                                </div>
                                            </div>
                                            <div class="flex items-start gap-2.5 p-2.5 bg-white/[0.02] rounded-lg">
                                                <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span class="text-[9px] font-black text-cyan-400">2</span>
                                                </div>
                                                <div>
                                                    <div class="text-[11px] font-bold text-white">Configure Agent</div>
                                                    <div class="text-[10px] text-gray-500">Set target assets, parameters, and trading budget</div>
                                                </div>
                                            </div>
                                            <div class="flex items-start gap-2.5 p-2.5 bg-white/[0.02] rounded-lg">
                                                <div class="w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <span class="text-[9px] font-black text-cyan-400">3</span>
                                                </div>
                                                <div>
                                                    <div class="text-[11px] font-bold text-white">Deploy & Monitor</div>
                                                    <div class="text-[10px] text-gray-500">Agent starts monitoring and trading here in the Agents tab</div>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setActiveTab('strategies')}
                                            class="px-5 py-2.5 text-xs font-bold text-black bg-cyan-500 hover:bg-cyan-400 rounded-xl transition-all"
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
                                                    case 'running': case 'active': return 'bg-green-400';
                                                    case 'paused': case 'paused_by_user': return 'bg-yellow-400';
                                                    case 'paused_by_risk': return 'bg-red-400';
                                                    case 'paused_by_system': return 'bg-orange-400';
                                                    case 'stopped': case 'stopping': return 'bg-red-400';
                                                    case 'error': return 'bg-red-500';
                                                    case 'completed': case 'terminated': return 'bg-gray-400';
                                                    default: return 'bg-gray-400';
                                                }
                                            };

                                            const isExpanded = () => expandedAgentId() === agent.id;
                                            const strategyInfo = () => getStrategyById(agent.strategyId);

                                            return (
                                                <div class="bg-[#111113]/60 rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-all overflow-hidden">
                                                    {/* Card Header - clickable to expand */}
                                                    <div class="p-5 cursor-pointer" onClick={() => setExpandedAgentId(isExpanded() ? null : agent.id)}>
                                                        {/* Header */}
                                                        <div class="flex items-start justify-between mb-4">
                                                            <div>
                                                                <div class="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <div class={`w-2 h-2 rounded-full ${statusColor()} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
                                                                    <span class="text-xs font-black text-white">{agent.strategyName}</span>
                                                                    <span class={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${agent.tradingMode === 'live' ? 'bg-cyan-500/15 border border-cyan-500/20 text-cyan-400' : 'bg-amber-500/15 border border-amber-500/20 text-amber-400'}`}>{agent.tradingMode === 'live' ? 'Live' : 'Paper'}</span>
                                                                    <Show when={agent.tradingMode === 'live' && (agent as any).exchange}>
                                                                        <span class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-white/[0.06] border border-white/[0.08] text-gray-400">{(agent as any).exchange}</span>
                                                                    </Show>
                                                                </div>
                                                                <div class="text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap">
                                                                    <span>{agent.selectedAssets.join(', ')}</span>
                                                                    <span class="text-gray-700">&middot;</span>
                                                                    <span>{agent.status === 'running' || agent.status === 'active' ? 'Running' : agent.status === 'paused' || agent.status === 'paused_by_user' ? 'Paused' : agent.status === 'paused_by_risk' ? 'Risk Paused' : agent.status === 'paused_by_system' ? 'System Paused' : agent.status === 'stopped' ? 'Stopped' : agent.status === 'error' ? 'Error' : 'Completed'}</span>
                                                                    <Show when={(agent as any).riskStatus?.pauseReason}>
                                                                        <span class="text-[9px] text-red-400 font-bold">({(agent as any).riskStatus.pauseReason})</span>
                                                                    </Show>
                                                                    <Show when={agent.tradingMode === 'live' && (agent as any).lastHeartbeatAt}>
                                                                        {(() => {
                                                                            const ms = Date.now() - new Date((agent as any).lastHeartbeatAt).getTime();
                                                                            const sec = Math.floor(ms / 1000);
                                                                            const label = sec < 60 ? `${sec}s ago` : sec < 3600 ? `${Math.floor(sec / 60)}m ago` : `${Math.floor(sec / 3600)}h ago`;
                                                                            return <span class={`text-[9px] ${sec > 300 ? 'text-red-400' : 'text-green-400/70'}`}>{label}</span>;
                                                                        })()}
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                            <div class="flex items-center gap-3">
                                                                <div class="text-right">
                                                                    <div class={`text-sm font-black ${agent.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {pnlLabel()} ({agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnlPercent.toFixed(2)}%)
                                                                    </div>
                                                                    <div class="text-[10px] text-gray-500">P&L</div>
                                                                </div>
                                                                <ChevronRight class={`w-4 h-4 text-gray-500 transition-transform ${isExpanded() ? 'rotate-90' : ''}`} />
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
                                                        <div class="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                                                            {/* Delete - always available with confirmation */}
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm(t(`Are you sure you want to delete this agent?\n\nStrategy: ${agent.strategyName}\nStatus: ${agent.status}\n\nThis action cannot be undone.`, `정말 이 에이전트를 삭제하시겠습니까?\n\n전략: ${agent.strategyName}\n상태: ${agent.status}\n\n삭제 후 복구할 수 없습니다.`))) {
                                                                        if (agent.status === 'running' || agent.status === 'active') {
                                                                            updatePaperAgentStatus(agent.id, 'stopped').then(() => {
                                                                                deletePaperAgent(agent.id);
                                                                            });
                                                                        } else {
                                                                            deletePaperAgent(agent.id);
                                                                        }
                                                                    }
                                                                }}
                                                                class="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.06] hover:border-red-500/20 rounded-lg text-[10px] font-bold text-gray-500 hover:text-red-400 transition-colors"
                                                            >
                                                                <svg viewBox="0 0 24 24" class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                                </svg>
                                                                Delete
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setExpandedAgentId(isExpanded() ? null : agent.id); }}
                                                                class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${isExpanded() ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-gray-400'}`}
                                                            >
                                                                <Settings class="w-3 h-3" />
                                                                Config
                                                            </button>
                                                            <div class="ml-auto text-[9px] text-gray-600">
                                                                Created {new Date(agent.createdAt).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* ═══ Expanded Config Panel ═══ */}
                                                    <Show when={isExpanded()}>
                                                        <div class="border-t border-white/[0.04] p-5 space-y-4 bg-white/[0.01]">
                                                            {/* Strategy Info */}
                                                            <div>
                                                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Strategy</div>
                                                                <div class="flex items-center gap-2 text-xs text-white">
                                                                    <span class="font-bold">{agent.strategyName}</span>
                                                                    <Show when={strategyInfo()}>
                                                                        <span class="text-[10px] text-gray-500">({strategyInfo()!.nameKo})</span>
                                                                    </Show>
                                                                </div>
                                                                <Show when={strategyInfo()}>
                                                                    <p class="text-[10px] text-gray-500 mt-1 leading-relaxed">{strategyInfo()!.shortDescriptionKo}</p>
                                                                </Show>
                                                            </div>

                                                            {/* Selected Assets */}
                                                            <div>
                                                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Target Assets</div>
                                                                <div class="flex flex-wrap gap-1.5">
                                                                    <For each={agent.selectedAssets}>
                                                                        {(asset) => (
                                                                            <span class="px-2 py-1 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/15 rounded-lg">
                                                                                {asset.replace('KRW-', '')}
                                                                            </span>
                                                                        )}
                                                                    </For>
                                                                </div>
                                                            </div>

                                                            {/* Risk Profile - Editable */}
                                                            <div>
                                                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                    Risk Profile
                                                                    <Show when={agent.status !== 'running' && agent.status !== 'active'}>
                                                                        <span class="text-[8px] font-normal text-cyan-400/60">(click to change)</span>
                                                                    </Show>
                                                                </div>
                                                                <div class="flex gap-2">
                                                                    {(['conservative', 'balanced', 'aggressive'] as const).map(rp => (
                                                                        <button
                                                                            onClick={() => {
                                                                                if (agent.status === 'running' || agent.status === 'active') return;
                                                                                updatePaperAgentConfig(agent.id, { riskProfile: rp }).then(() => {
                                                                                    setSuccessToast(`Risk Profile changed to ${rp}`);
                                                                                    setTimeout(() => setSuccessToast(null), 3000);
                                                                                });
                                                                            }}
                                                                            disabled={agent.status === 'running' || agent.status === 'active'}
                                                                            class={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${agent.riskProfile === rp
                                                                                ? rp === 'conservative' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                                                                                    : rp === 'balanced' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25'
                                                                                        : 'bg-red-500/15 text-red-400 border-red-500/25'
                                                                                : (agent.status === 'running' || agent.status === 'active')
                                                                                    ? 'text-gray-700 border-white/[0.03] cursor-not-allowed'
                                                                                    : 'text-gray-500 border-white/[0.04] hover:border-white/[0.1] cursor-pointer'}`}
                                                                        >
                                                                            {rp === 'conservative' ? 'Conservative' : rp === 'balanced' ? 'Balanced' : 'Aggressive'}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Parameters */}
                                                            <Show when={agent.params && Object.keys(agent.params).length > 0}>
                                                                <div>
                                                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Parameters</div>
                                                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                        <For each={Object.entries(agent.params)}>
                                                                            {([key, value]) => {
                                                                                const paramInfo = strategyInfo()?.parameters.find(p => p.key === key);
                                                                                return (
                                                                                    <div class="p-2 bg-white/[0.02] rounded-lg">
                                                                                        <div class="text-[9px] text-gray-500 truncate">{paramInfo?.labelKo || paramInfo?.label || key}</div>
                                                                                        <div class="text-[11px] font-bold text-white">{String(value)}</div>
                                                                                    </div>
                                                                                );
                                                                            }}
                                                                        </For>
                                                                    </div>
                                                                </div>
                                                            </Show>

                                                            {/* Budget Config - Editable when not running */}
                                                            <Show when={agent.budgetConfig}>
                                                                <div>
                                                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                        Budget Settings
                                                                        <Show when={agent.status !== 'running' && agent.status !== 'active'}>
                                                                            <span class="text-[8px] font-normal text-cyan-400/60">(editable)</span>
                                                                        </Show>
                                                                    </div>
                                                                    <div class="grid grid-cols-2 gap-2">
                                                                        {/* Total Budget */}
                                                                        <div class="p-2 bg-white/[0.02] rounded-lg">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Total Budget {agent.budgetConfig.totalBudgetEnabled ? '' : '(off)'}</div>
                                                                            <Show when={agent.status !== 'running' && agent.status !== 'active'}
                                                                                fallback={<div class="text-[11px] font-bold text-white">{agent.budgetConfig.currency === 'KRW' ? '\u20a9' : '$'}{agent.budgetConfig.totalBudget.toLocaleString()}</div>}>
                                                                                <input
                                                                                    type="number"
                                                                                    value={agent.budgetConfig.totalBudget}
                                                                                    onBlur={(e) => {
                                                                                        const val = Number(e.currentTarget.value);
                                                                                        if (val !== agent.budgetConfig.totalBudget) {
                                                                                            updatePaperAgentConfig(agent.id, {
                                                                                                budgetConfig: { ...agent.budgetConfig, totalBudget: val, totalBudgetEnabled: val > 0 }
                                                                                            }).then(() => {
                                                                                                setSuccessToast('Budget updated');
                                                                                                setTimeout(() => setSuccessToast(null), 2000);
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                    class="w-full bg-transparent text-[11px] font-bold text-white outline-none border-b border-cyan-500/30 focus:border-cyan-500 pb-0.5 transition-colors"
                                                                                />
                                                                            </Show>
                                                                        </div>
                                                                        {/* Max Order */}
                                                                        <div class="p-2 bg-white/[0.02] rounded-lg">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Max Order {agent.budgetConfig.maxOrderSizeEnabled ? '' : '(off)'}</div>
                                                                            <Show when={agent.status !== 'running' && agent.status !== 'active'}
                                                                                fallback={<div class="text-[11px] font-bold text-white">{agent.budgetConfig.currency === 'KRW' ? '\u20a9' : '$'}{agent.budgetConfig.maxOrderSize.toLocaleString()}</div>}>
                                                                                <input
                                                                                    type="number"
                                                                                    value={agent.budgetConfig.maxOrderSize}
                                                                                    onBlur={(e) => {
                                                                                        const val = Number(e.currentTarget.value);
                                                                                        if (val !== agent.budgetConfig.maxOrderSize) {
                                                                                            updatePaperAgentConfig(agent.id, {
                                                                                                budgetConfig: { ...agent.budgetConfig, maxOrderSize: val, maxOrderSizeEnabled: val > 0 }
                                                                                            }).then(() => {
                                                                                                setSuccessToast('Budget updated');
                                                                                                setTimeout(() => setSuccessToast(null), 2000);
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                    class="w-full bg-transparent text-[11px] font-bold text-white outline-none border-b border-cyan-500/30 focus:border-cyan-500 pb-0.5 transition-colors"
                                                                                />
                                                                            </Show>
                                                                        </div>
                                                                        {/* Daily Limit */}
                                                                        <div class="p-2 bg-white/[0.02] rounded-lg">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Daily Limit {agent.budgetConfig.dailyTradingLimitEnabled ? '' : '(off)'}</div>
                                                                            <Show when={agent.status !== 'running' && agent.status !== 'active'}
                                                                                fallback={<div class="text-[11px] font-bold text-white">{agent.budgetConfig.currency === 'KRW' ? '\u20a9' : '$'}{agent.budgetConfig.dailyTradingLimit.toLocaleString()}</div>}>
                                                                                <input
                                                                                    type="number"
                                                                                    value={agent.budgetConfig.dailyTradingLimit}
                                                                                    onBlur={(e) => {
                                                                                        const val = Number(e.currentTarget.value);
                                                                                        if (val !== agent.budgetConfig.dailyTradingLimit) {
                                                                                            updatePaperAgentConfig(agent.id, {
                                                                                                budgetConfig: { ...agent.budgetConfig, dailyTradingLimit: val, dailyTradingLimitEnabled: val > 0 }
                                                                                            }).then(() => {
                                                                                                setSuccessToast('Budget updated');
                                                                                                setTimeout(() => setSuccessToast(null), 2000);
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                    class="w-full bg-transparent text-[11px] font-bold text-white outline-none border-b border-cyan-500/30 focus:border-cyan-500 pb-0.5 transition-colors"
                                                                                />
                                                                            </Show>
                                                                        </div>
                                                                        {/* Per Asset */}
                                                                        <div class="p-2 bg-white/[0.02] rounded-lg">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Per Asset {agent.budgetConfig.perAssetBudgetEnabled ? '' : '(off)'}</div>
                                                                            <Show when={agent.status !== 'running' && agent.status !== 'active'}
                                                                                fallback={<div class="text-[11px] font-bold text-white">{agent.budgetConfig.currency === 'KRW' ? '\u20a9' : '$'}{agent.budgetConfig.perAssetBudget.toLocaleString()}</div>}>
                                                                                <input
                                                                                    type="number"
                                                                                    value={agent.budgetConfig.perAssetBudget}
                                                                                    onBlur={(e) => {
                                                                                        const val = Number(e.currentTarget.value);
                                                                                        if (val !== agent.budgetConfig.perAssetBudget) {
                                                                                            updatePaperAgentConfig(agent.id, {
                                                                                                budgetConfig: { ...agent.budgetConfig, perAssetBudget: val, perAssetBudgetEnabled: val > 0 }
                                                                                            }).then(() => {
                                                                                                setSuccessToast('Budget updated');
                                                                                                setTimeout(() => setSuccessToast(null), 2000);
                                                                                            });
                                                                                        }
                                                                                    }}
                                                                                    class="w-full bg-transparent text-[11px] font-bold text-white outline-none border-b border-cyan-500/30 focus:border-cyan-500 pb-0.5 transition-colors"
                                                                                />
                                                                            </Show>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </Show>

                                                            {/* Positions */}
                                                            <Show when={agent.positions && agent.positions.length > 0}>
                                                                <div>
                                                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Open Positions</div>
                                                                    <div class="space-y-1.5">
                                                                        <For each={agent.positions}>
                                                                            {(pos) => (
                                                                                <div class="flex items-center justify-between p-2 bg-white/[0.02] rounded-lg">
                                                                                    <div>
                                                                                        <span class="text-[11px] font-bold text-white">{pos.asset.replace('KRW-', '')}</span>
                                                                                        <span class="text-[9px] text-gray-500 ml-1.5">qty: {pos.quantity.toFixed(4)}</span>
                                                                                    </div>
                                                                                    <div class={`text-[11px] font-bold ${pos.unrealizedPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                                        {pos.unrealizedPnl >= 0 ? '+' : ''}{pos.unrealizedPnlPercent.toFixed(2)}%
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </For>
                                                                    </div>
                                                                </div>
                                                            </Show>

                                                            {/* ── Risk Dashboard ── */}
                                                            <Show when={agent.riskStatus}>
                                                                <div>
                                                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Risk Status</div>
                                                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                        {/* Daily Drawdown */}
                                                                        <div class="p-2.5 bg-white/[0.02] rounded-xl">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Daily PnL</div>
                                                                            <div class={`text-sm font-black ${(agent.riskStatus?.dailyPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                                {(agent.riskStatus?.dailyPnl || 0) >= 0 ? '+' : ''}{(agent.riskStatus?.dailyPnl || 0).toFixed(2)}%
                                                                            </div>
                                                                            <div class="mt-1.5 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                                                                <div
                                                                                    class={`h-full rounded-full transition-all ${(agent.riskStatus?.dailyPnl || 0) >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                                                                                    style={`width: ${Math.min(Math.abs(agent.riskStatus?.dailyPnl || 0) / 5 * 100, 100)}%`}
                                                                                />
                                                                            </div>
                                                                            <div class="text-[8px] text-gray-600 mt-0.5">Limit: -{Number(agent.params?.daily_drawdown_limit || 5)}%</div>
                                                                        </div>
                                                                        {/* Weekly Drawdown */}
                                                                        <div class="p-2.5 bg-white/[0.02] rounded-xl">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Weekly PnL</div>
                                                                            <div class={`text-sm font-black ${(agent.riskStatus?.weeklyPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                                {(agent.riskStatus?.weeklyPnl || 0) >= 0 ? '+' : ''}{(agent.riskStatus?.weeklyPnl || 0).toFixed(2)}%
                                                                            </div>
                                                                            <div class="mt-1.5 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                                                                <div
                                                                                    class={`h-full rounded-full transition-all ${(agent.riskStatus?.weeklyPnl || 0) >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'}`}
                                                                                    style={`width: ${Math.min(Math.abs(agent.riskStatus?.weeklyPnl || 0) / 10 * 100, 100)}%`}
                                                                                />
                                                                            </div>
                                                                            <div class="text-[8px] text-gray-600 mt-0.5">Limit: -{Number(agent.params?.weekly_drawdown_limit || 10)}%</div>
                                                                        </div>
                                                                        {/* Consecutive Losses */}
                                                                        <div class="p-2.5 bg-white/[0.02] rounded-xl">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Consecutive Losses</div>
                                                                            <div class={`text-sm font-black ${(agent.riskStatus?.consecutiveLosses || 0) >= 3 ? 'text-red-400' : 'text-white'}`}>
                                                                                {agent.riskStatus?.consecutiveLosses || 0}
                                                                            </div>
                                                                            <div class="text-[8px] text-gray-600 mt-1">
                                                                                {(agent.riskStatus?.consecutiveLosses || 0) >= 3 ? 'Cooldown active' : 'Normal'}
                                                                            </div>
                                                                        </div>
                                                                        {/* Today Trades */}
                                                                        <div class="p-2.5 bg-white/[0.02] rounded-xl">
                                                                            <div class="text-[9px] text-gray-500 mb-1">Today Trades</div>
                                                                            <div class="text-sm font-black text-white">
                                                                                {agent.riskStatus?.todayTradeCount || 0} / {Number(agent.params?.max_daily_trades || 6)}
                                                                            </div>
                                                                        </div>
                                                                        {/* Cooldown Timer */}
                                                                        <Show when={agent.riskStatus?.cooldownUntil}>
                                                                            <div class="p-2.5 bg-red-500/[0.06] rounded-xl border border-red-500/10">
                                                                                <div class="text-[9px] text-red-400 mb-1">Cooldown Until</div>
                                                                                <div class="text-[11px] font-bold text-red-300">
                                                                                    {new Date(agent.riskStatus!.cooldownUntil!).toLocaleTimeString()}
                                                                                </div>
                                                                            </div>
                                                                        </Show>
                                                                        {/* Pause Reason */}
                                                                        <Show when={agent.riskStatus?.pauseReason}>
                                                                            <div class="p-2.5 bg-orange-500/[0.06] rounded-xl border border-orange-500/10 col-span-2 sm:col-span-3">
                                                                                <div class="text-[9px] text-orange-400 mb-1">Pause Reason</div>
                                                                                <div class="text-[10px] text-orange-300">{agent.riskStatus?.pauseReason}</div>
                                                                            </div>
                                                                        </Show>
                                                                    </div>
                                                                </div>
                                                            </Show>

                                                            {/* ── Decision Log Timeline ── */}
                                                            <div>
                                                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Recent Decisions</div>
                                                                <DecisionLogTimeline agentId={agent.id} />
                                                            </div>

                                                            {/* ── Trade History Panel ── */}
                                                            <TradeHistoryPanel agentId={agent.id} seedCurrency={agent.seedCurrency} />

                                                            {/* ── PnL Dashboard ── */}
                                                            <PnLDashboard agentId={agent.id} seed={agent.seed} seedCurrency={agent.seedCurrency} />

                                                            {/* Edit hint */}
                                                            <Show when={agent.status === 'paused'}>
                                                                <div class="flex items-center gap-2 px-3 py-2 bg-cyan-500/[0.06] border border-cyan-500/15 rounded-xl">
                                                                    <Info class="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                                                    <p class="text-[10px] text-cyan-300/70">{t('To change settings, go to the Strategies tab and set up the same strategy again. You can stop and delete the existing agent and create a new one.', 'Agent가 일시정지 상태일 때 설정을 변경하려면 Strategy 탭에서 동일 전략을 새로 Setup 하세요. 기존 Agent를 Stop 후 삭제하고 새로 생성할 수 있습니다.')}</p>
                                                                </div>
                                                            </Show>

                                                            {/* Agent ID & Metadata */}
                                                            <div class="flex items-center justify-between pt-2 border-t border-white/[0.03]">
                                                                <div class="text-[9px] text-gray-600 font-mono">{agent.id}</div>
                                                                <div class="text-[9px] text-gray-600">Updated: {new Date(agent.updatedAt).toLocaleString()}</div>
                                                            </div>
                                                        </div>
                                                    </Show>
                                                </div>
                                            );
                                        }}
                                    </For>
                                </Show>
                            </div>
                        </Show>

                        {/* ═══ ARENA TAB ═══ */}
                        <Show when={activeTab() === 'arena'}>
                            <QuantArenaLazy />
                        </Show>

                        {/* ═══ SIGNALS TAB ═══ */}
                        <Show when={activeTab() === 'signals'}>
                            <div class="space-y-4">
                                {/* Filters */}
                                <div class="flex items-center gap-3 flex-wrap">
                                    <div class="flex gap-1.5 bg-[#0a0a0b] rounded-xl p-1 border border-white/[0.04]">
                                        {(['all', 'buy', 'sell'] as const).map(f => (
                                            <button
                                                onClick={() => setSignalFilter(f)}
                                                class={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${signalFilter() === f
                                                    ? f === 'buy' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                        : f === 'sell' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                                            : 'bg-white/[0.06] text-white border border-white/10'
                                                    : 'text-gray-500 hover:text-gray-300'
                                                    }`}
                                            >
                                                {f === 'all' ? 'ALL' : f.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                    <select
                                        value={signalAgentFilter()}
                                        onChange={(e) => setSignalAgentFilter(e.currentTarget.value)}
                                        class="bg-[#0a0a0b] border border-white/[0.06] rounded-xl px-3 py-1.5 text-[11px] text-gray-300 font-bold outline-none"
                                    >
                                        <option value="all">All Agents</option>
                                        <For each={paperAgents()}>
                                            {(agent) => (
                                                <option value={agent.id}>{agent.strategyName}</option>
                                            )}
                                        </For>
                                    </select>
                                    <span class="text-[10px] text-gray-600 ml-auto">
                                        {signalTrades().length} signals
                                    </span>
                                </div>

                                {/* Signal Feed */}
                                <Show when={signalTrades().length > 0} fallback={
                                    <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                                        <Activity class="w-6 h-6 text-gray-600" />
                                        <h3 class="text-base font-black text-white mt-4 mb-2">No Signals Yet</h3>
                                        <p class="text-xs text-gray-500 text-center max-w-sm">
                                            {t('Activate an agent to see real-time signals here. Set up a strategy in the Strategies tab to create an agent.', 'Agent를 활성화하면 실시간 시그널이 여기에 표시됩니다. Strategies 탭에서 전략을 설정하고 Agent를 생성하세요.')}
                                        </p>
                                    </div>
                                }>
                                    <div class="space-y-2 max-h-[600px] overflow-y-auto pr-1" style="scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;">
                                        <For each={
                                            signalTrades()
                                                .filter(t => signalFilter() === 'all' || t.side === signalFilter())
                                                .filter(t => signalAgentFilter() === 'all' || t.agentId === signalAgentFilter())
                                        }>
                                            {(trade) => {
                                                const agent = () => paperAgents().find(a => a.id === trade.agentId);
                                                const timeAgo = () => {
                                                    const diff = Date.now() - new Date(trade.timestamp).getTime();
                                                    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
                                                    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                                                    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                                                    return `${Math.floor(diff / 86400000)}d ago`;
                                                };
                                                return (
                                                    <div class="flex items-center gap-3 p-3 bg-[#111113]/60 rounded-2xl border border-white/[0.04] hover:border-white/[0.08] transition-all">
                                                        {/* Direction Badge */}
                                                        <div class={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${trade.side === 'buy'
                                                            ? 'bg-green-500/15 border border-green-500/20'
                                                            : 'bg-red-500/15 border border-red-500/20'
                                                            }`}>
                                                            {trade.side === 'buy'
                                                                ? <TrendingUp class="w-4 h-4 text-green-400" />
                                                                : <TrendingDown class="w-4 h-4 text-red-400" />
                                                            }
                                                        </div>

                                                        {/* Trade Info */}
                                                        <div class="flex-1 min-w-0">
                                                            <div class="flex items-center gap-2">
                                                                <span class={`text-[10px] font-black uppercase ${trade.side === 'buy' ? 'text-green-400' : 'text-red-400'
                                                                    }`}>{trade.side}</span>
                                                                <span class="text-xs font-bold text-white">{trade.asset?.replace('KRW-', '')}</span>
                                                                <span class="text-[9px] text-gray-600">@{Number(trade.price).toLocaleString()}</span>
                                                            </div>
                                                            <div class="flex items-center gap-2 mt-0.5">
                                                                <span class="text-[9px] text-gray-500 truncate">{trade.signal || trade.strategy}</span>
                                                                <Show when={agent()}>
                                                                    <span class="text-[8px] text-gray-600 px-1.5 py-0.5 bg-white/[0.03] rounded">{agent()?.strategyName}</span>
                                                                </Show>
                                                            </div>
                                                        </div>

                                                        {/* PnL & Time */}
                                                        <div class="text-right flex-shrink-0">
                                                            <Show when={trade.side === 'sell' && trade.pnl !== undefined}>
                                                                <div class={`text-xs font-bold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                                                    }`}>
                                                                    {trade.pnl >= 0 ? '+' : ''}{trade.pnlPercent?.toFixed(2)}%
                                                                </div>
                                                            </Show>
                                                            <Show when={trade.side === 'buy'}>
                                                                <div class="text-[10px] text-gray-500">
                                                                    {Number(trade.value).toLocaleString()} {trade.asset?.startsWith('KRW') ? 'KRW' : 'USDT'}
                                                                </div>
                                                            </Show>
                                                            <div class="text-[9px] text-gray-600 mt-0.5">{timeAgo()}</div>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </Show>
                            </div>
                        </Show>

                        {/* ═══ REPORTS TAB ═══ */}
                        <Show when={activeTab() === 'reports'}>
                            <Show when={!reportData()}>
                                {/* Agent selector for reports */}
                                <div class="space-y-4">
                                    <div class="flex items-center justify-between">
                                        <h3 class="text-sm font-black text-white">Select Agent for Report</h3>
                                    </div>
                                    <Show when={paperAgents().length > 0} fallback={
                                        <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                                            <svg viewBox="0 0 24 24" class="w-6 h-6 text-gray-600 mb-4" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                            <h3 class="text-base font-black text-white mb-2">No Agents</h3>
                                            <p class="text-xs text-gray-500 text-center max-w-sm">
                                                {t('First set up a strategy in the Strategies tab and create an agent. Trading reports will be available once enough data is collected.', '먼저 Strategies 탭에서 전략을 설정하고 에이전트를 생성하세요. 트레이딩 데이터가 쌓이면 리포트를 확인할 수 있습니다.')}
                                            </p>
                                        </div>
                                    }>
                                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <For each={paperAgents()}>
                                                {(agent) => {
                                                    const isLoading = () => reportLoading() && reportAgentId() === agent.id;
                                                    return (
                                                        <button
                                                            onClick={async () => {
                                                                setReportAgentId(agent.id);
                                                                setReportLoading(true);
                                                                const report = await fetchPaperReport(agent.id, 'weekly');
                                                                setReportData(report);
                                                                setReportLoading(false);
                                                            }}
                                                            disabled={reportLoading()}
                                                            class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.06] hover:border-cyan-500/30 transition-all text-left"
                                                        >
                                                            <div class="flex items-center gap-2 mb-2">
                                                                <div class={`w-2 h-2 rounded-full ${agent.status === 'running' ? 'bg-green-400 animate-pulse' : agent.status === 'paused' ? 'bg-yellow-400' : 'bg-gray-400'}`} />
                                                                <span class="text-xs font-black text-white">{agent.strategyName}</span>
                                                                <span class={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${agent.tradingMode === 'live' ? 'bg-cyan-500/15 border border-cyan-500/20 text-cyan-400' : 'bg-amber-500/15 border border-amber-500/20 text-amber-400'}`}>{agent.tradingMode === 'live' ? 'Live' : 'Paper'}</span>
                                                            </div>
                                                            <div class="flex items-center justify-between">
                                                                <div class="text-[10px] text-gray-500">
                                                                    {agent.selectedAssets.slice(0, 3).join(', ')}{agent.selectedAssets.length > 3 ? ` +${agent.selectedAssets.length - 3}` : ''}
                                                                </div>
                                                                <div class={`text-xs font-bold ${agent.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {agent.totalPnl >= 0 ? '+' : ''}{agent.totalPnlPercent.toFixed(2)}%
                                                                </div>
                                                            </div>
                                                            <div class="text-[10px] text-gray-600 mt-1">{agent.totalTrades} trades | {new Date(agent.createdAt).toLocaleDateString()}</div>
                                                            <Show when={isLoading()}>
                                                                <div class="mt-2 h-1 bg-white/[0.03] rounded-full overflow-hidden">
                                                                    <div class="h-full w-1/3 bg-cyan-400/50 rounded-full animate-pulse" />
                                                                </div>
                                                            </Show>
                                                        </button>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </Show>
                            <Show when={reportData()}>
                                <QuantReportLazy
                                    report={reportData()}
                                    onBack={() => { setReportData(null); setReportAgentId(null); }}
                                />
                            </Show>
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
                                                                                {t('Past performance does not guarantee future returns. Strategy effectiveness may vary depending on market conditions.', '과거 성과는 미래 수익을 보장하지 않습니다. 시장 상황에 따라 전략의 유효성이 달라질 수 있습니다.')}
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
                                        <h3 class="text-sm font-black text-white">Create Agent: {selectedStrategy()!.name}</h3>
                                        <p class="text-[10px] text-gray-500">Configure your trading agent's assets, parameters, and budget</p>
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
                                                                                                {t('Simulated trading to test strategies. No real assets used.', '모의 거래로 전략 테스트. 실제 자산 사용 없음.')}
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
                                                                                                {t('Automated trading with real exchange assets.', '실제 거래소 자산으로 자동 매매.')}
                                            </p>
                                        </button>
                                    </div>
                                    <Show when={tradingMode() === 'paper'}>
                                        <div class="mt-2 space-y-2">
                                            {/* Fixed Seed Info */}
                                            <div class="p-3 bg-amber-500/[0.06] rounded-xl border border-amber-500/15">
                                                <div class="flex items-center gap-2 mb-1.5">
                                                    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" />
                                                    </svg>
                                                    <span class="text-[11px] font-bold text-amber-400">Fixed Seed Capital</span>
                                                </div>
                                                <div class="flex items-center gap-3">
                                                    <div class="flex-1 p-2 bg-black/30 rounded-lg">
                                                        <div class="text-[9px] text-gray-500 mb-0.5">KRW Exchanges</div>
                                                        <div class="text-sm font-black text-white">10,000,000 <span class="text-[9px] text-gray-400 font-normal">KRW</span></div>
                                                    </div>
                                                    <div class="flex-1 p-2 bg-black/30 rounded-lg">
                                                        <div class="text-[9px] text-gray-500 mb-0.5">USDT Exchanges</div>
                                                        <div class="text-sm font-black text-white">10,000 <span class="text-[9px] text-gray-400 font-normal">USDT</span></div>
                                                    </div>
                                                </div>
                                                <div class="text-[9px] text-amber-400/60 mt-1.5">All participants start with the same seed capital for fair competition.</div>
                                            </div>

                                            {/* Competition Auto-Join Banner */}
                                            <Show when={activeCompetitions().length > 0}>
                                                {(() => {
                                                    const strategy = selectedStrategy()!;
                                                    const matchComp = activeCompetitions().find(c =>
                                                        c.division === (strategy.marketType === 'futures' ? 'futures' : 'spot')
                                                    ) || activeCompetitions()[0];
                                                    if (!matchComp) return null;
                                                    const isSpot = matchComp.division !== 'futures';
                                                    return (
                                                        <div class={`p-3 rounded-xl border ${isSpot ? 'bg-emerald-500/[0.06] border-emerald-500/15' : 'bg-purple-500/[0.06] border-purple-500/15'}`}>
                                                            <div class="flex items-center gap-2 mb-1">
                                                                <svg viewBox="0 0 24 24" class={`w-3.5 h-3.5 ${isSpot ? 'text-emerald-400' : 'text-purple-400'}`} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                                                    <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                                                                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                                                </svg>
                                                                <span class={`text-[11px] font-bold ${isSpot ? 'text-emerald-400' : 'text-purple-400'}`}>{matchComp.title} - {isSpot ? 'Spot Division' : 'Futures Division'}</span>
                                                                <span class={`ml-auto text-[9px] font-bold ${isSpot ? 'text-emerald-400/70 bg-emerald-500/10' : 'text-purple-400/70 bg-purple-500/10'} px-1.5 py-0.5 rounded`}>
                                                                    ~{new Date(matchComp.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            </div>
                                                            <p class="text-[10px] text-gray-400 leading-relaxed">
                                                                Creating a paper agent will automatically enroll you in the {isSpot ? 'Spot' : 'Futures'} Division. Compete for 1,000 VCN prize pool!
                                                            </p>
                                                        </div>
                                                    );
                                                })()}
                                            </Show>

                                            <div class="flex items-center gap-1.5 p-2 bg-amber-500/5 rounded-lg border border-amber-500/10">
                                                <AlertTriangle class="w-3 h-3 text-amber-400 flex-shrink-0" />
                                                <span class="text-[10px] text-amber-400">{t('Paper trading does not execute real orders. It is simulated based on market prices.', '모의 거래는 실제 주문을 실행하지 않으며, 시장 가격 기반으로 시뮬레이션됩니다.')}</span>
                                            </div>
                                        </div>
                                    </Show>

                                    {/* ═══ LIVE MODE: Registered Exchange Selector ═══ */}
                                    <Show when={tradingMode() === 'live'}>
                                        <div class="mt-2 space-y-3">
                                            {/* Registered Exchanges from CEX Portfolio */}
                                            <Show when={registeredExchanges().length > 0}>
                                                <div>
                                                    <div class="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M2 10h20" /><path d="M12 17v4" /><path d="M8 21h8" />
                                                        </svg>
                                                        Connected Exchange
                                                    </div>
                                                    <div class="grid grid-cols-1 gap-1.5">
                                                        <For each={registeredExchanges()}>
                                                            {(cred) => {
                                                                const meta = () => {
                                                                    for (const g of EXCHANGE_LIST) {
                                                                        const found = g.exchanges.find(e => e.id === cred.exchange);
                                                                        if (found) return found;
                                                                    }
                                                                    return null;
                                                                };
                                                                const isSelected = () => selectedExchange() === cred.exchange;
                                                                return (
                                                                    <button
                                                                        onClick={() => setSelectedExchange(cred.exchange)}
                                                                        class={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${isSelected()
                                                                            ? 'bg-cyan-500/10 border border-cyan-500/25'
                                                                            : 'bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.1]'}`}
                                                                    >
                                                                        {/* Checkbox */}
                                                                        <div class={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center transition-all ${isSelected()
                                                                            ? 'bg-cyan-500 border-cyan-500'
                                                                            : 'border-gray-600 bg-transparent'}`}>
                                                                            <Show when={isSelected()}>
                                                                                <svg viewBox="0 0 24 24" class="w-3 h-3 text-black" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                                                                    <polyline points="20 6 9 17 4 12" />
                                                                                </svg>
                                                                            </Show>
                                                                        </div>
                                                                        <div class="w-3 h-3 rounded-full flex-shrink-0" style={`background:${meta()?.color || '#666'}`} />
                                                                        <div class="flex-1 min-w-0">
                                                                            <div class={`text-[11px] font-bold ${isSelected() ? 'text-white' : 'text-gray-400'}`}>{meta()?.name || cred.exchange}</div>
                                                                            <div class="text-[9px] text-gray-600">{cred.label}</div>
                                                                        </div>
                                                                        <Show when={meta()?.futures}>
                                                                            <span class="text-[7px] font-bold text-purple-400 bg-purple-400/10 px-1 py-0.5 rounded">F</span>
                                                                        </Show>
                                                                    </button>
                                                                );
                                                            }}
                                                        </For>
                                                    </div>
                                                </div>
                                            </Show>

                                            {/* No Exchange Connected */}
                                            <Show when={registeredExchanges().length === 0}>
                                                <div class="p-4 bg-amber-500/[0.04] rounded-xl border border-amber-500/15 text-center">
                                                    <svg viewBox="0 0 24 24" class="w-5 h-5 text-amber-400 mx-auto mb-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                                    </svg>
                                                    <div class="text-[11px] font-bold text-amber-400 mb-1">{t('Exchange Connection Required', '거래소 연결이 필요합니다')}</div>
                                                    <div class="text-[10px] text-gray-500 leading-relaxed">
                                                        {t('Please register an exchange API in CEX Portfolio first. Only connected exchanges can be used for Live Trading.', 'CEX Portfolio에서 먼저 거래소 API를 등록하세요. 등록된 거래소만 Live Trading에 사용할 수 있습니다.')}
                                                    </div>
                                                </div>
                                            </Show>

                                            {/* Live Trading Warning */}
                                            <div class="flex items-center gap-1.5 p-2 bg-red-500/5 rounded-lg border border-red-500/10">
                                                <AlertTriangle class="w-3 h-3 text-red-400 flex-shrink-0" />
                                                <span class="text-[10px] text-red-400">{t('Live Trading uses real assets. Please test thoroughly with Paper Trading first.', 'Live Trading은 실제 자산으로 거래합니다. 충분한 Paper Trading 테스트 후 사용하세요.')}</span>
                                            </div>
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
                                <Show when={tradingMode() !== 'paper'}>
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
                                                        <div class="text-xs font-bold text-white">{t('Total Budget Limit', '전체 운용 한도')}</div>
                                                        <div class="text-[10px] text-gray-500">{t('Maximum total amount the agent can use', '에이전트가 사용할 최대 총 금액')}</div>
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
                                                                placeholder={t('Enter amount', '금액 입력')}
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
                                                        <div class="text-xs font-bold text-white">{t('Per Asset Limit', '종목당 운용 한도')}</div>
                                                        <div class="text-[10px] text-gray-500">{t('Maximum amount to invest per individual coin', '개별 코인에 투입할 최대 금액')}</div>
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
                                                                placeholder={t('Enter amount', '금액 입력')}
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
                                                            <div class="text-xs font-bold text-white">{t('Max Order Size', '1회 주문 최대 금액')}</div>
                                                            <div class="text-[10px] text-gray-500">{t('Maximum amount per single order', '한 번 주문에 넣을 수 있는 최대 금액')}</div>
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
                                                                    placeholder={t('Enter amount', '금액 입력')}
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
                                                            <div class="text-xs font-bold text-white">{t('Daily Trading Limit', '일일 거래 한도')}</div>
                                                            <div class="text-[10px] text-gray-500">{t('Maximum total trading amount per day', '하루 총 거래 금액 상한')}</div>
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
                                                                    placeholder={t('Enter amount', '금액 입력')}
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
                                            <span class="text-[10px] text-amber-400">{t('Per-asset allocation exceeds 25%, which may increase risk.', '종목당 비중이 25%를 초과하여 리스크가 커질 수 있습니다.')}</span>
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
                                    disabled={selectedAssets().length === 0 || (tradingMode() === 'live' && !selectedExchange())}
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
                                        <h3 class="text-sm font-black text-white">Confirm Agent Creation</h3>
                                        <p class="text-[10px] text-gray-500">Review settings before deploying your trading agent</p>
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
                                    <Show when={tradingMode() === 'live' && selectedExchange()}>
                                        <div class="flex items-center justify-between p-3 bg-cyan-500/[0.04] rounded-xl border border-cyan-500/10">
                                            <span class="text-[10px] text-gray-500 uppercase tracking-wider">Exchange</span>
                                            <span class="text-xs font-bold text-cyan-400">{selectedExchangeMeta()?.name || selectedExchange()}</span>
                                        </div>
                                    </Show>
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

                                    {/* Paper Trading Seed & Competition Info */}
                                    <Show when={tradingMode() === 'paper'}>
                                        {(() => {
                                            const creds = credentials();
                                            const firstCred = creds[0];
                                            const isKrw = !firstCred || firstCred.exchange === 'upbit' || firstCred.exchange === 'bithumb';
                                            const seedAmount = isKrw ? '10,000,000 KRW' : '10,000 USDT';
                                            return (
                                                <div class="flex items-center justify-between p-3 bg-amber-500/[0.05] rounded-xl border border-amber-500/15">
                                                    <span class="text-[10px] text-gray-500 uppercase tracking-wider">Seed Capital (Fixed)</span>
                                                    <span class="text-xs font-black text-amber-400">{seedAmount}</span>
                                                </div>
                                            );
                                        })()}
                                    </Show>

                                    {/* Competition Auto-Join Banner in Confirm */}
                                    <Show when={tradingMode() === 'paper' && activeCompetitions().length > 0}>
                                        {(() => {
                                            const strategy = selectedStrategy()!;
                                            const matchComp = activeCompetitions().find(c =>
                                                c.division === (strategy.marketType === 'futures' ? 'futures' : 'spot')
                                            ) || activeCompetitions()[0];
                                            if (!matchComp) return null;
                                            const isSpot = matchComp.division !== 'futures';
                                            return (
                                                <div class={`p-3 rounded-xl border ${isSpot ? 'bg-emerald-500/[0.04] border-emerald-500/15' : 'bg-purple-500/[0.04] border-purple-500/15'}`}>
                                                    <div class="flex items-center gap-2 mb-1">
                                                        <svg viewBox="0 0 24 24" class={`w-3.5 h-3.5 ${isSpot ? 'text-emerald-400' : 'text-purple-400'}`} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                                                            <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
                                                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                                                        </svg>
                                                        <span class={`text-[10px] font-bold ${isSpot ? 'text-emerald-400' : 'text-purple-400'}`}>
                                                            Auto-enrolled: {matchComp.title} ({isSpot ? 'Spot Division' : 'Futures Division'})
                                                        </span>
                                                    </div>
                                                    <p class="text-[9px] text-gray-500">
                                                        Prize Pool: 1,000 VCN | Ends {new Date(matchComp.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                                    </p>
                                                </div>
                                            );
                                        })()}
                                    </Show>
                                </div>

                                {/* Legal Checkboxes */}
                                <div class="space-y-3">
                                    <label class="flex items-start gap-3 cursor-pointer group">
                                        <div
                                            onClick={() => setAcceptedTerms(!acceptedTerms())}
                                            class={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${acceptedTerms() ? 'bg-cyan-500 border-cyan-500' : 'bg-gray-500/40 border-gray-400 group-hover:border-gray-300'
                                                }`}
                                        >
                                            <Show when={acceptedTerms()}>
                                                <Check class="w-3 h-3 text-black" />
                                            </Show>
                                        </div>
                                        <span class="text-[11px] text-gray-400 leading-relaxed">
                                                                                        {t('[Required] I have reviewed the strategy configuration.', '[필수] 본 전략 설정 내용을 확인했습니다.')}
                                        </span>
                                    </label>
                                    <label class="flex items-start gap-3 cursor-pointer group">
                                        <div
                                            onClick={() => setAcceptedBeta(!acceptedBeta())}
                                            class={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all flex-shrink-0 ${acceptedBeta() ? 'bg-cyan-500 border-cyan-500' : 'bg-gray-500/40 border-gray-400 group-hover:border-gray-300'
                                                }`}
                                        >
                                            <Show when={acceptedBeta()}>
                                                <Check class="w-3 h-3 text-black" />
                                            </Show>
                                        </div>
                                        <span class="text-[11px] text-gray-400 leading-relaxed">
                                                                                        {t('[Required] I understand the operating principles and risks of automated trading strategies. Due to the nature of the beta service, losses may occur from order delays, execution errors, strategy malfunctions, or sudden market changes. I acknowledge that I am responsible for the results of automated trading, and Vision Chain is not liable for any such losses.', '[필수] 본인은 자동매매 전략의 작동 원리와 위험성을 이해하였으며, 베타 서비스 특성상 주문 지연, 체결 오차, 전략 오작동 또는 시장 급변에 따른 손실이 발생할 수 있음을 인지합니다. 이에 따라 자동매매 운용 결과에 대한 책임은 본인에게 있으며, 비전체인은 해당 손실에 대해 책임지지 않습니다.')}
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

                                                const comp = activeCompetitions().find(c =>
                                                    c.division === (strategy.marketType === 'futures' ? 'futures' : 'spot')
                                                ) || activeCompetitions()[0] || null;
                                                const agent = await createPaperAgent({
                                                    strategyId: strategy.id,
                                                    strategyName: strategy.name,
                                                    selectedAssets: selectedAssets(),
                                                    params: customParams(),
                                                    budgetConfig: budgetConfig(),
                                                    riskProfile: riskProfile(),
                                                    seedCurrency,
                                                    competitionId: comp?.id,
                                                });

                                                // Auto-join competition if active
                                                if (comp) {
                                                    try {
                                                        await joinCompetition(comp.id, agent);
                                                        console.log('[Quant] Auto-joined competition:', comp.id);
                                                    } catch (joinErr) {
                                                        console.warn('[Quant] Failed to join competition:', joinErr);
                                                    }
                                                }

                                                console.log('[Quant] Paper agent created successfully');
                                                sendAgentSetupNotification(agent).catch(() => {});
                                                setSuccessToast(`Trading Agent "${strategy.name}" has been created and deployed.`);
                                                setTimeout(() => setSuccessToast(null), 5000);
                                            } catch (err) {
                                                console.error('[Quant] Failed to create paper agent:', err);
                                                setSuccessToast(null);
                                            } finally {
                                                setCreatingAgent(false);
                                            }
                                        } else {
                                            // Live Trading Agent
                                            setCreatingAgent(true);
                                            try {
                                                const strategy = selectedStrategy()!;
                                                // Derive seedCurrency from selected exchange (registered via CEX Portfolio)
                                                const ex = selectedExchange();
                                                const cred = selectedCredential();
                                                const krwExchanges = ['upbit', 'bithumb', 'coinone'];
                                                const seedCurrency = krwExchanges.includes(ex) ? 'KRW' as const : 'USDT' as const;

                                                const liveAgent = await createPaperAgent({
                                                    strategyId: strategy.id,
                                                    strategyName: strategy.name,
                                                    selectedAssets: selectedAssets(),
                                                    params: customParams(),
                                                    budgetConfig: budgetConfig(),
                                                    riskProfile: riskProfile(),
                                                    seedCurrency,
                                                    tradingMode: 'live',
                                                    exchange: ex || undefined,
                                                    exchangeAccountId: cred?.id || undefined,
                                                });

                                                console.log('[Quant] Live agent created successfully');
                                                sendAgentSetupNotification(liveAgent).catch(() => {});
                                                setSuccessToast(`Live Agent "${strategy.name}" has been created and deployed.`);
                                                setTimeout(() => setSuccessToast(null), 5000);
                                            } catch (err) {
                                                console.error('[Quant] Failed to create live agent:', err);
                                                setSuccessToast(null);
                                            } finally {
                                                setCreatingAgent(false);
                                            }
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
                                    {creatingAgent() ? 'Creating Agent...' : tradingMode() === 'paper' ? 'Create Paper Agent' : 'Create Live Agent'}
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Success Toast */}
                <Show when={successToast()}>
                    <div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div class="flex items-center gap-3 px-5 py-3.5 bg-green-500/15 border border-green-500/25 rounded-2xl backdrop-blur-xl shadow-2xl">
                            <div class="p-1.5 bg-green-500/20 rounded-lg">
                                <CheckCircle class="w-4 h-4 text-green-400" />
                            </div>
                            <div>
                                <div class="text-xs font-bold text-green-400">Agent Created Successfully</div>
                                <div class="text-[10px] text-green-300/70">{successToast()}</div>
                            </div>
                            <button onClick={() => setSuccessToast(null)} class="ml-2 p-1 hover:bg-white/5 rounded-lg">
                                <X class="w-3 h-3 text-green-400/50" />
                            </button>
                        </div>
                    </div>
                </Show>

                {/* Trade Toast Notifications */}
                <TradeToast
                    toasts={tradeToasts()}
                    onDismiss={(id) => setTradeToasts(prev => prev.filter(t => t.id !== id))}
                />

            </div>
        </div>
    );
};

export default VisionQuantEngine;
