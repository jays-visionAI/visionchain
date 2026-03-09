import { createSignal, createResource, Show, For, createMemo } from 'solid-js';
import {
    Search,
    RefreshCw,
    TrendingUp,
    TrendingDown,
    Users,
    Database,
    Shield,
    ChevronDown,
    ChevronUp,
    Copy,
    ExternalLink,
    ArrowUpDown,
    Filter,
    BarChart3,
    Clock
} from 'lucide-solid';
import { getFirebaseApp } from '../../services/firebaseService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { formatKrw, formatUsd } from '../../services/cexService';

// ===== Types =====
interface CexCredential {
    id: string;
    exchange: string;
    label: string;
    status: string;
    registeredAt: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: string;
}

interface QuantAgentInfo {
    name: string;
    strategy: string;
    status: string;
    assets: string[];
    startedAt: string | null;
}

interface CexUserSummary {
    email: string;
    name: string;
    walletAddress: string;
    exchanges: string[];
    exchangeCount: number;
    credentials: CexCredential[];
    totalValueKrw: number;
    totalValueUsd: number;
    assetCount: number;
    lastSync: string | null;
    registeredAt: string | null;
    status: string;
    multiExchange: boolean;
    quantStatus: 'active' | 'paused' | 'none';
    quantAgents: QuantAgentInfo[];
    activityStatus: 'active' | 'idle' | 'at_risk';
    syncCount30d: number;
}

interface TopCoin {
    symbol: string;
    holders: number;
    totalValueKrw: number;
    totalBalance: number;
}

interface StrategyUsage {
    name: string;
    users: number;
    active: number;
}

interface CexStats {
    overview: {
        totalUsers: number;
        activeUsers: number;
        inactiveUsers: number;
        totalCredentials: number;
        totalAumKrw: number;
        totalAumUsd: number;
        recentRegistrations: number;
        todayRegistrations: number;
        multiExchangeUsers: number;
        quantActiveUsers: number;
        weeklyActiveUsers: number;
        monthlyActiveUsers: number;
        atRiskUsers: number;
    };
    exchangeBreakdown: Record<string, { connections: number; active: number }>;
    topCoins: TopCoin[];
    sizeDistribution: {
        under1m: number;
        m1to5m: number;
        m5to10m: number;
        m10to50m: number;
        m50to100m: number;
        over100m: number;
    };
    strategyUsage: StrategyUsage[];
    users: CexUserSummary[];
}

// ===== Fetch Function =====
async function fetchCexStats(): Promise<CexStats> {
    const functions = getFunctions(getFirebaseApp(), 'asia-northeast3');
    const fn = httpsCallable(functions, 'getAdminCexStats');
    const result = await fn();
    return result.data as CexStats;
}

// ===== Helpers =====
function getRelativeTime(isoString: string | null): string {
    if (!isoString) return 'Never';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function formatCompactKrw(value: number): string {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return value.toLocaleString();
}

function exchangeLabel(ex: string): string {
    const map: Record<string, string> = { upbit: 'Upbit', bithumb: 'Bithumb' };
    return map[ex] || ex;
}

// ===== SVG Icons =====
function ExchangeIcon(props: { exchange: string; class?: string }) {
    return (
        <svg class={props.class || "w-4 h-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <Show when={props.exchange === 'upbit'}>
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
                <line x1="12" y1="22" x2="12" y2="15.5" />
                <polyline points="22 8.5 12 15.5 2 8.5" />
            </Show>
            <Show when={props.exchange === 'bithumb'}>
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12h8M12 8v8" />
            </Show>
        </svg>
    );
}

// ===== Component =====
const AdminCexPortfolio = () => {
    const [data, { refetch }] = createResource(fetchCexStats);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [statusFilter, setStatusFilter] = createSignal<'all' | 'active' | 'inactive'>('all');
    const [sortField, setSortField] = createSignal<'totalValueKrw' | 'assetCount' | 'lastSync' | 'registeredAt'>('totalValueKrw');
    const [sortDir, setSortDir] = createSignal<'asc' | 'desc'>('desc');
    const [expandedUser, setExpandedUser] = createSignal<string | null>(null);
    const [activeTab, setActiveTab] = createSignal<'overview' | 'activity' | 'quant'>('overview');
    const [multiOnly, setMultiOnly] = createSignal(false);
    const [quantOnly, setQuantOnly] = createSignal(false);
    const [activityFilter, setActivityFilter] = createSignal<'all' | 'active' | 'idle' | 'at_risk'>('all');

    const stats = createMemo(() => data());

    const filteredUsers = createMemo(() => {
        const d = stats();
        if (!d) return [];
        let users = d.users;

        // Search
        const q = searchQuery().toLowerCase();
        if (q) {
            users = users.filter(u =>
                u.email.toLowerCase().includes(q) ||
                u.name.toLowerCase().includes(q) ||
                u.walletAddress.toLowerCase().includes(q)
            );
        }

        // Status filter
        if (statusFilter() !== 'all') {
            users = users.filter(u => u.status === statusFilter());
        }

        // Multi-exchange filter
        if (multiOnly()) {
            users = users.filter(u => u.multiExchange);
        }

        // Quant filter
        if (quantOnly()) {
            users = users.filter(u => u.quantStatus === 'active');
        }

        // Activity filter
        if (activityFilter() !== 'all') {
            users = users.filter(u => u.activityStatus === activityFilter());
        }

        // Sort
        const field = sortField();
        const dir = sortDir() === 'asc' ? 1 : -1;
        users = [...users].sort((a, b) => {
            if (field === 'totalValueKrw') return (a.totalValueKrw - b.totalValueKrw) * dir;
            if (field === 'assetCount') return (a.assetCount - b.assetCount) * dir;
            if (field === 'lastSync') {
                const aTime = a.lastSync ? new Date(a.lastSync).getTime() : 0;
                const bTime = b.lastSync ? new Date(b.lastSync).getTime() : 0;
                return (aTime - bTime) * dir;
            }
            if (field === 'registeredAt') {
                const aTime = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
                const bTime = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
                return (aTime - bTime) * dir;
            }
            return 0;
        });

        return users;
    });

    const handleSort = (field: typeof sortField extends () => infer T ? T : never) => {
        if (sortField() === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(() => field);
            setSortDir('desc');
        }
    };

    const toggleExpand = (email: string) => {
        setExpandedUser(e => e === email ? null : email);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // ===== Render =====
    return (
        <div class="p-6 max-w-7xl mx-auto text-white">
            {/* Header */}
            <header class="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                <div>
                    <h1 class="text-4xl font-black italic tracking-tighter mb-2">CEX PORTFOLIO</h1>
                    <div class="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">
                        <Shield class="w-3 h-3 text-amber-500" />
                        <span>Exchange Integration & Activity Analytics</span>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        onClick={() => refetch()}
                        class="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-400 hover:text-white transition-all"
                        title="Refresh"
                    >
                        <RefreshCw class={`w-5 h-5 ${data.loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* Tab Bar */}
            <div class="flex items-center gap-1 bg-[#0a0a0b] border border-white/5 rounded-xl p-1 mb-8">
                {([
                    { id: 'overview' as const, label: 'Overview', icon: () => <BarChart3 class="w-4 h-4" /> },
                    { id: 'activity' as const, label: 'User Activity', icon: () => <Clock class="w-4 h-4" /> },
                    { id: 'quant' as const, label: 'Quant Analytics', icon: () => <TrendingUp class="w-4 h-4" /> },
                ] as const).map(tab => (
                    <button
                        onClick={() => setActiveTab(tab.id)}
                        class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                        classList={{
                            'bg-white/[0.08] text-white border border-white/10': activeTab() === tab.id,
                            'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03] border border-transparent': activeTab() !== tab.id,
                        }}
                    >
                        {tab.icon()}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Loading */}
            <Show when={data.loading && !stats()}>
                <div class="flex items-center justify-center py-32">
                    <div class="text-center">
                        <div class="w-12 h-12 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                        <p class="text-gray-500 text-sm">Loading CEX statistics...</p>
                    </div>
                </div>
            </Show>

            {/* Error */}
            <Show when={data.error}>
                <div class="rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                    <p class="text-red-400 font-bold mb-2">Failed to load statistics</p>
                    <p class="text-gray-500 text-sm">{data.error?.message}</p>
                    <button
                        onClick={() => refetch()}
                        class="mt-4 px-6 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm transition-all"
                    >
                        Retry
                    </button>
                </div>
            </Show>

            {/* Stats Content */}
            <Show when={stats()}>
                {(d) => {
                    const overview = () => d().overview;
                    const exchangeBreakdown = () => d().exchangeBreakdown;
                    const topCoins = () => d().topCoins;
                    const sizeDist = () => d().sizeDistribution;
                    const strategyUsage = () => d().strategyUsage || [];

                    return (
                        <>
                            {/* ===== KPI Cards (always visible) ===== */}
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                {/* Total Users */}
                                <div class="rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-5">
                                    <div class="flex items-center gap-2 mb-3">
                                        <Users class="w-4 h-4 text-amber-400" />
                                        <span class="text-[10px] font-black uppercase tracking-widest text-amber-400/60">Connected Users</span>
                                    </div>
                                    <div class="text-3xl font-black text-white mb-1">{overview().totalUsers}</div>
                                    <div class="flex items-center gap-2 text-[10px]">
                                        <span class="text-green-400">{overview().activeUsers} active</span>
                                        <span class="text-gray-600">|</span>
                                        <span class="text-red-400/60">{overview().inactiveUsers} inactive</span>
                                    </div>
                                </div>

                                {/* Total AUM */}
                                <div class="rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-5">
                                    <div class="flex items-center gap-2 mb-3">
                                        <Database class="w-4 h-4 text-emerald-400" />
                                        <span class="text-[10px] font-black uppercase tracking-widest text-emerald-400/60">Total AUM</span>
                                    </div>
                                    <div class="text-2xl font-black text-white mb-1">{formatCompactKrw(overview().totalAumKrw)}</div>
                                    <div class="text-[10px] text-gray-500">{formatUsd(overview().totalAumUsd)}</div>
                                </div>

                                {/* Multi-Exchange Users (NEW) */}
                                <div class="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 p-5">
                                    <div class="flex items-center gap-2 mb-3">
                                        <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                                        </svg>
                                        <span class="text-[10px] font-black uppercase tracking-widest text-cyan-400/60">Multi-Exchange</span>
                                    </div>
                                    <div class="text-3xl font-black text-white mb-1">{overview().multiExchangeUsers || 0}</div>
                                    <div class="text-[10px] text-gray-500">
                                        {overview().totalUsers > 0 ? Math.round((overview().multiExchangeUsers || 0) / overview().totalUsers * 100) : 0}% of users
                                    </div>
                                </div>

                                {/* Quant Active (NEW) */}
                                <div class="rounded-2xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 p-5">
                                    <div class="flex items-center gap-2 mb-3">
                                        <svg class="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                                        </svg>
                                        <span class="text-[10px] font-black uppercase tracking-widest text-red-400/60">Quant Active</span>
                                    </div>
                                    <div class="text-3xl font-black text-white mb-1">{overview().quantActiveUsers || 0}</div>
                                    <div class="text-[10px] text-gray-500">Running Quant Engine</div>
                                </div>

                                {/* Weekly Active */}
                                <div class="rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 p-5">
                                    <div class="flex items-center gap-2 mb-3">
                                        <Clock class="w-4 h-4 text-blue-400" />
                                        <span class="text-[10px] font-black uppercase tracking-widest text-blue-400/60">Weekly Active</span>
                                    </div>
                                    <div class="text-3xl font-black text-white mb-1">{overview().weeklyActiveUsers || 0}</div>
                                    <div class="text-[10px] text-gray-500">Synced in last 7 days</div>
                                </div>

                                {/* At Risk */}
                                <div class="rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 p-5">
                                    <div class="flex items-center gap-2 mb-3">
                                        <svg class="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                        <span class="text-[10px] font-black uppercase tracking-widest text-orange-400/60">At Risk</span>
                                    </div>
                                    <div class="text-3xl font-black text-white mb-1">{overview().atRiskUsers || 0}</div>
                                    <div class="text-[10px] text-gray-500">30+ days no sync</div>
                                </div>
                            </div>

                            {/* ===== TAB: OVERVIEW ===== */}
                            <Show when={activeTab() === 'overview'}>

                                {/* ===== Exchange Breakdown + Size Distribution ===== */}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    {/* Exchange Breakdown */}
                                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                            <BarChart3 class="w-4 h-4 text-cyan-400" />
                                            Exchange Breakdown
                                        </h3>
                                        <div class="space-y-3">
                                            <For each={Object.entries(exchangeBreakdown())}>
                                                {([exchange, info]) => {
                                                    const exInfo = info as { connections: number; active: number };
                                                    const pct = overview().totalCredentials > 0 ?
                                                        (exInfo.connections / overview().totalCredentials * 100) : 0;
                                                    return (
                                                        <div>
                                                            <div class="flex items-center justify-between mb-1">
                                                                <div class="flex items-center gap-2">
                                                                    <ExchangeIcon exchange={exchange} class="w-4 h-4 text-cyan-400" />
                                                                    <span class="text-sm font-bold text-white">{exchangeLabel(exchange)}</span>
                                                                </div>
                                                                <div class="flex items-center gap-3">
                                                                    <span class="text-xs text-gray-400">
                                                                        {exInfo.connections} connections
                                                                    </span>
                                                                    <span class="text-xs text-green-400/60">
                                                                        {exInfo.active} active
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                                                                <div
                                                                    class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>

                                    {/* Asset Size Distribution */}
                                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                            <BarChart3 class="w-4 h-4 text-emerald-400" />
                                            Asset Size Distribution
                                        </h3>
                                        <div class="space-y-2">
                                            {(() => {
                                                const dist = sizeDist();
                                                const total = overview().totalUsers || 1;
                                                const bars = [
                                                    { label: '< 100만', value: dist.under1m, color: 'from-gray-500 to-gray-600' },
                                                    { label: '100만~500만', value: dist.m1to5m, color: 'from-blue-500 to-blue-600' },
                                                    { label: '500만~1000만', value: dist.m5to10m, color: 'from-cyan-500 to-cyan-600' },
                                                    { label: '1000만~5000만', value: dist.m10to50m, color: 'from-emerald-500 to-emerald-600' },
                                                    { label: '5000만~1억', value: dist.m50to100m, color: 'from-amber-500 to-amber-600' },
                                                    { label: '> 1억', value: dist.over100m, color: 'from-red-500 to-red-600' },
                                                ];
                                                return (
                                                    <For each={bars}>
                                                        {(bar) => (
                                                            <div class="flex items-center gap-3">
                                                                <span class="text-[11px] text-gray-400 w-24 text-right shrink-0">{bar.label}</span>
                                                                <div class="flex-1 h-5 bg-white/5 rounded-md overflow-hidden relative">
                                                                    <div
                                                                        class={`h-full bg-gradient-to-r ${bar.color} rounded-md transition-all`}
                                                                        style={{ width: `${Math.max((bar.value / total) * 100, bar.value > 0 ? 4 : 0)}%` }}
                                                                    />
                                                                    <Show when={bar.value > 0}>
                                                                        <span class="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-white drop-shadow">
                                                                            {bar.value}
                                                                        </span>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </For>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* ===== Top Coins ===== */}
                                <Show when={topCoins().length > 0}>
                                    <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6 mb-8">
                                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                            <TrendingUp class="w-4 h-4 text-amber-400" />
                                            Top Coins (by Value)
                                        </h3>
                                        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <For each={topCoins().slice(0, 10)}>
                                                {(coin, i) => (
                                                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all">
                                                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 text-[10px] font-black shrink-0">
                                                            {i() + 1}
                                                        </div>
                                                        <div class="min-w-0">
                                                            <div class="text-sm font-black text-white truncate">{coin.symbol}</div>
                                                            <div class="text-[10px] text-gray-500">
                                                                {coin.holders} holders
                                                            </div>
                                                            <div class="text-[10px] text-amber-400/60">
                                                                {formatCompactKrw(coin.totalValueKrw)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                </Show>

                                {/* ===== User Table ===== */}
                                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                    {/* Table Header with Search & Filter */}
                                    <div class="p-4 border-b border-white/5 flex flex-col md:flex-row gap-3">
                                        <div class="flex-1 relative group">
                                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-cyan-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="Search by email, name, or wallet..."
                                                value={searchQuery()}
                                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                                class="w-full pl-10 pr-4 py-3 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div class="relative group">
                                            <Filter class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <select
                                                value={statusFilter()}
                                                onChange={(e) => setStatusFilter(e.currentTarget.value as any)}
                                                class="pl-10 pr-8 py-3 bg-[#0B0E14] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all cursor-pointer appearance-none"
                                            >
                                                <option value="all">All Status</option>
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>
                                        <div class="text-xs text-gray-500 self-center">
                                            {filteredUsers().length} / {stats()?.users.length || 0} users
                                        </div>
                                    </div>

                                    {/* Column Headers */}
                                    <div class="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white/[0.01]">
                                        <div class="col-span-3">User</div>
                                        <div class="col-span-2">Exchanges</div>
                                        <div
                                            class="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort('totalValueKrw')}
                                        >
                                            Portfolio
                                            <ArrowUpDown class="w-3 h-3" />
                                        </div>
                                        <div
                                            class="col-span-1 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort('assetCount')}
                                        >
                                            Assets
                                            <ArrowUpDown class="w-3 h-3" />
                                        </div>
                                        <div
                                            class="col-span-2 flex items-center gap-1 cursor-pointer hover:text-white transition-colors"
                                            onClick={() => handleSort('lastSync')}
                                        >
                                            Last Sync
                                            <ArrowUpDown class="w-3 h-3" />
                                        </div>
                                        <div class="col-span-1">Status</div>
                                        <div class="col-span-1"></div>
                                    </div>

                                    {/* User Rows */}
                                    <div class="divide-y divide-white/5">
                                        <Show when={filteredUsers().length === 0}>
                                            <div class="p-12 text-center text-gray-500">
                                                <Database class="w-8 h-8 mx-auto mb-3 opacity-30" />
                                                <p class="text-sm">No users found</p>
                                            </div>
                                        </Show>

                                        <For each={filteredUsers()}>
                                            {(user) => {
                                                const isExpanded = () => expandedUser() === user.email;
                                                return (
                                                    <>
                                                        <div
                                                            class="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-white/[0.02] transition-all cursor-pointer items-center"
                                                            onClick={() => toggleExpand(user.email)}
                                                        >
                                                            {/* User Info */}
                                                            <div class="col-span-3">
                                                                <div class="text-sm font-bold text-white truncate">{user.email}</div>
                                                                <Show when={user.name}>
                                                                    <div class="text-[10px] text-gray-500 truncate">{user.name}</div>
                                                                </Show>
                                                            </div>

                                                            {/* Exchanges */}
                                                            <div class="col-span-2 flex items-center gap-1">
                                                                <For each={user.exchanges}>
                                                                    {(ex) => (
                                                                        <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold
                                                                        ${ex === 'upbit' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}
                                                                    `}>
                                                                            {exchangeLabel(ex)}
                                                                        </span>
                                                                    )}
                                                                </For>
                                                            </div>

                                                            {/* Portfolio Value */}
                                                            <div class="col-span-2">
                                                                <div class="text-sm font-black text-white">{formatCompactKrw(user.totalValueKrw)}</div>
                                                                <div class="text-[10px] text-gray-500">{formatUsd(user.totalValueUsd)}</div>
                                                            </div>

                                                            {/* Asset Count */}
                                                            <div class="col-span-1">
                                                                <span class="text-sm font-bold text-gray-300">{user.assetCount}</span>
                                                            </div>

                                                            {/* Last Sync */}
                                                            <div class="col-span-2">
                                                                <div class="flex items-center gap-1">
                                                                    <Clock class="w-3 h-3 text-gray-600" />
                                                                    <span class="text-xs text-gray-400">{getRelativeTime(user.lastSync)}</span>
                                                                </div>
                                                            </div>

                                                            {/* Status */}
                                                            <div class="col-span-1">
                                                                <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black
                                                                ${user.status === 'active'
                                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'}
                                                            `}>
                                                                    <div class={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                                                                    {user.status}
                                                                </span>
                                                            </div>

                                                            {/* Expand */}
                                                            <div class="col-span-1 flex justify-end">
                                                                {isExpanded()
                                                                    ? <ChevronUp class="w-4 h-4 text-gray-500" />
                                                                    : <ChevronDown class="w-4 h-4 text-gray-500" />
                                                                }
                                                            </div>
                                                        </div>

                                                        {/* Expanded Detail */}
                                                        <Show when={isExpanded()}>
                                                            <div class="bg-white/[0.01] border-t border-white/5 px-6 py-4">
                                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    {/* Wallet Address */}
                                                                    <div>
                                                                        <div class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                                            Wallet Address
                                                                        </div>
                                                                        <Show when={user.walletAddress} fallback={
                                                                            <span class="text-xs text-gray-600">Not created</span>
                                                                        }>
                                                                            <div class="flex items-center gap-2">
                                                                                <code class="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded font-mono">
                                                                                    {user.walletAddress.slice(0, 10)}...{user.walletAddress.slice(-8)}
                                                                                </code>
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(user.walletAddress); }}
                                                                                    class="p-1 hover:bg-white/10 rounded transition-colors"
                                                                                    title="Copy"
                                                                                >
                                                                                    <Copy class="w-3 h-3 text-gray-500" />
                                                                                </button>
                                                                                <a
                                                                                    href={`https://visionscan.org/address/${user.walletAddress}`}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    class="p-1 hover:bg-white/10 rounded transition-colors"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    <ExternalLink class="w-3 h-3 text-gray-500" />
                                                                                </a>
                                                                            </div>
                                                                        </Show>
                                                                    </div>

                                                                    {/* Registration Date */}
                                                                    <div>
                                                                        <div class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                                            CEX Registration
                                                                        </div>
                                                                        <span class="text-xs text-gray-400">
                                                                            {user.registeredAt
                                                                                ? new Date(user.registeredAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                                                                                : 'Unknown'}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Credentials Detail */}
                                                                <div class="mt-4">
                                                                    <div class="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                                                        API Keys ({user.credentials.length})
                                                                    </div>
                                                                    <div class="space-y-2">
                                                                        <For each={user.credentials}>
                                                                            {(cred) => (
                                                                                <div class="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                                                                    <ExchangeIcon
                                                                                        exchange={cred.exchange}
                                                                                        class={`w-4 h-4 ${cred.exchange === 'upbit' ? 'text-blue-400' : 'text-orange-400'}`}
                                                                                    />
                                                                                    <div class="flex-1">
                                                                                        <span class="text-xs font-bold text-white">{cred.label || exchangeLabel(cred.exchange)}</span>
                                                                                    </div>
                                                                                    <div class="flex items-center gap-2 text-[10px]">
                                                                                        <span class={`px-2 py-0.5 rounded-full font-bold
                                                                                        ${cred.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}
                                                                                    `}>
                                                                                            {cred.status}
                                                                                        </span>
                                                                                        <span class="text-gray-500">
                                                                                            Sync: {cred.lastSyncStatus}
                                                                                        </span>
                                                                                        <span class="text-gray-600">
                                                                                            {getRelativeTime(cred.lastSyncAt)}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </For>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Show>
                                                    </>
                                                );
                                            }}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* ===== TAB: USER ACTIVITY ===== */}
                            <Show when={activeTab() === 'activity'}>
                                {/* Activity Filters */}
                                <div class="flex items-center gap-3 mb-6">
                                    {(['all', 'active', 'idle', 'at_risk'] as const).map(s => (
                                        <button
                                            onClick={() => setActivityFilter(s)}
                                            class="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border"
                                            classList={{
                                                'bg-white/[0.08] text-white border-white/10': activityFilter() === s,
                                                'text-gray-500 hover:text-gray-300 border-transparent hover:bg-white/[0.03]': activityFilter() !== s,
                                            }}
                                        >
                                            {s === 'all' ? 'All' : s === 'active' ? 'Active (7d)' : s === 'idle' ? 'Idle (7-30d)' : 'At Risk (30d+)'}
                                        </button>
                                    ))}
                                    <div class="ml-auto text-xs text-gray-500">{filteredUsers().length} users</div>
                                </div>

                                {/* Activity Table */}
                                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                    <div class="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white/[0.01]">
                                        <div class="col-span-3">User</div>
                                        <div class="col-span-2">Exchanges</div>
                                        <div class="col-span-2">AUM</div>
                                        <div class="col-span-1">Syncs</div>
                                        <div class="col-span-2">Quant</div>
                                        <div class="col-span-2">Status</div>
                                    </div>
                                    <div class="divide-y divide-white/5">
                                        <Show when={filteredUsers().length === 0}>
                                            <div class="p-12 text-center text-gray-500">
                                                <Database class="w-8 h-8 mx-auto mb-3 opacity-30" />
                                                <p class="text-sm">No users match the filter</p>
                                            </div>
                                        </Show>
                                        <For each={filteredUsers()}>
                                            {(user) => (
                                                <div class="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                                                    <div class="col-span-3">
                                                        <div class="text-sm font-bold text-white truncate">{user.email}</div>
                                                        <Show when={user.name}><div class="text-[10px] text-gray-500 truncate">{user.name}</div></Show>
                                                    </div>
                                                    <div class="col-span-2 flex items-center gap-1 flex-wrap">
                                                        <For each={user.exchanges}>
                                                            {(ex) => (
                                                                <span class={`px-2 py-0.5 rounded-md text-[10px] font-bold ${ex === 'upbit' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                                                                    {exchangeLabel(ex)}
                                                                </span>
                                                            )}
                                                        </For>
                                                        <Show when={user.multiExchange}>
                                                            <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">MULTI</span>
                                                        </Show>
                                                    </div>
                                                    <div class="col-span-2">
                                                        <div class="text-sm font-black text-white">{formatCompactKrw(user.totalValueKrw)}</div>
                                                        <div class="text-[10px] text-gray-500">{formatUsd(user.totalValueUsd)}</div>
                                                    </div>
                                                    <div class="col-span-1">
                                                        <span class="text-sm font-bold text-gray-300">{user.syncCount30d}</span>
                                                        <span class="text-[10px] text-gray-600 ml-1">/30d</span>
                                                    </div>
                                                    <div class="col-span-2">
                                                        <Show when={user.quantStatus !== 'none'} fallback={<span class="text-[10px] text-gray-600">None</span>}>
                                                            <div class="flex items-center gap-1">
                                                                <div class={`w-1.5 h-1.5 rounded-full ${user.quantStatus === 'active' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                                                                <span class="text-[10px] font-bold text-gray-300">{user.quantAgents[0]?.strategy || 'Custom'}</span>
                                                            </div>
                                                            <span class={`text-[9px] font-bold ${user.quantStatus === 'active' ? 'text-green-400' : 'text-yellow-400'}`}>
                                                                {user.quantStatus.toUpperCase()}
                                                            </span>
                                                        </Show>
                                                    </div>
                                                    <div class="col-span-2">
                                                        <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black
                                                            ${user.activityStatus === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                                user.activityStatus === 'idle' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                                                    'bg-red-500/10 text-red-400 border border-red-500/20'}
                                                        `}>
                                                            <div class={`w-1.5 h-1.5 rounded-full ${user.activityStatus === 'active' ? 'bg-green-400' :
                                                                    user.activityStatus === 'idle' ? 'bg-yellow-400' : 'bg-red-400'
                                                                }`} />
                                                            {user.activityStatus === 'active' ? 'Active' : user.activityStatus === 'idle' ? 'Idle' : 'At Risk'}
                                                        </span>
                                                        <div class="text-[9px] text-gray-600 mt-0.5">{getRelativeTime(user.lastSync)}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* ===== TAB: QUANT ANALYTICS ===== */}
                            <Show when={activeTab() === 'quant'}>
                                {/* Strategy Usage */}
                                <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6 mb-8">
                                    <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                                        <BarChart3 class="w-4 h-4 text-purple-400" />
                                        Strategy Usage
                                    </h3>
                                    <Show when={strategyUsage().length > 0} fallback={
                                        <div class="py-8 text-center text-gray-600 text-sm">No Quant Engine usage data yet</div>
                                    }>
                                        <div class="space-y-3">
                                            <For each={strategyUsage()}>
                                                {(s) => {
                                                    const maxUsers = Math.max(...strategyUsage().map(x => x.users), 1);
                                                    return (
                                                        <div class="flex items-center gap-3">
                                                            <span class="text-xs text-gray-400 w-40 text-right shrink-0 truncate">{s.name}</span>
                                                            <div class="flex-1 h-6 bg-white/5 rounded-md overflow-hidden relative">
                                                                <div
                                                                    class="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-md transition-all"
                                                                    style={{ width: `${Math.max((s.users / maxUsers) * 100, 8)}%` }}
                                                                />
                                                                <span class="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-white drop-shadow">
                                                                    {s.users} users ({s.active} active)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </Show>
                                </div>

                                {/* Quant Users Table */}
                                <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                                    <div class="p-4 border-b border-white/5">
                                        <h3 class="text-sm font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                                            <Users class="w-4 h-4 text-cyan-400" />
                                            Quant Engine Users
                                        </h3>
                                    </div>
                                    <div class="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500 bg-white/[0.01]">
                                        <div class="col-span-3">User</div>
                                        <div class="col-span-2">Exchange</div>
                                        <div class="col-span-3">Strategy</div>
                                        <div class="col-span-2">Assets</div>
                                        <div class="col-span-2">Status</div>
                                    </div>
                                    <div class="divide-y divide-white/5">
                                        {(() => {
                                            const quantUsers = (stats()?.users || []).filter(u => u.quantStatus !== 'none');
                                            if (quantUsers.length === 0) {
                                                return (
                                                    <div class="p-12 text-center text-gray-600">
                                                        <Database class="w-8 h-8 mx-auto mb-3 opacity-30" />
                                                        <p class="text-sm">No users using Quant Engine yet</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <For each={quantUsers}>
                                                    {(user) => (
                                                        <For each={user.quantAgents}>
                                                            {(agent) => (
                                                                <div class="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-white/[0.02] transition-all items-center">
                                                                    <div class="col-span-3">
                                                                        <div class="text-sm font-bold text-white truncate">{user.email}</div>
                                                                    </div>
                                                                    <div class="col-span-2">
                                                                        <For each={user.exchanges}>
                                                                            {(ex) => (
                                                                                <span class={`px-2 py-0.5 rounded-md text-[10px] font-bold ${ex === 'upbit' ? 'bg-blue-500/10 text-blue-400' : 'bg-orange-500/10 text-orange-400'}`}>
                                                                                    {exchangeLabel(ex)}
                                                                                </span>
                                                                            )}
                                                                        </For>
                                                                    </div>
                                                                    <div class="col-span-3">
                                                                        <div class="text-xs font-bold text-gray-200 truncate">{agent.strategy}</div>
                                                                        <div class="text-[10px] text-gray-500">{agent.name}</div>
                                                                    </div>
                                                                    <div class="col-span-2">
                                                                        <div class="text-[10px] text-gray-400 truncate">{agent.assets?.join(', ') || '-'}</div>
                                                                    </div>
                                                                    <div class="col-span-2">
                                                                        <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black
                                                                            ${agent.status === 'active' ? 'bg-green-500/10 text-green-400' :
                                                                                agent.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400' :
                                                                                    'bg-red-500/10 text-red-400'}
                                                                        `}>
                                                                            <div class={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-green-400' :
                                                                                    agent.status === 'paused' ? 'bg-yellow-400' : 'bg-red-400'
                                                                                }`} />
                                                                            {agent.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </For>
                                                    )}
                                                </For>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </Show>
                        </>
                    );
                }}
            </Show>
        </div>
    );
};

export default AdminCexPortfolio;
