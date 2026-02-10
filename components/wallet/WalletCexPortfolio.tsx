import { createSignal, Show, For, onMount, createEffect, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import {
    RefreshCw,
    Plus,
    Trash2,
    AlertCircle,
    ChevronRight,
    Eye,
    EyeOff,
    Shield,
    Check,
    X,
    TrendingUp,
    TrendingDown,
    Key,
    HelpCircle,
    Copy,
    ExternalLink
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import {
    listCexApiKeys,
    registerCexApiKey,
    deleteCexApiKey,
    getCexPortfolio,
    syncCexPortfolio,
    formatKrw,
    formatUsd,
    getCoinIconUrl,
    getRelativeTime,
    type CexCredential,
    type AggregatedPortfolio,
    type CexPortfolioSnapshot,
    type CexAsset
} from '../../services/cexService';

// SVG Icons (no emoji/emoticon usage)
const UpbitIcon = () => (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none">
        <circle cx="12" cy="12" r="10" fill="#093687" />
        <path d="M7 14L12 7L17 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

const BithumbIcon = () => (
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none">
        <circle cx="12" cy="12" r="10" fill="#F37021" />
        <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">B</text>
    </svg>
);

const EmptyPortfolioIcon = () => (
    <svg viewBox="0 0 120 120" class="w-24 h-24 text-gray-600 opacity-50" fill="none" stroke="currentColor" stroke-width="1">
        <rect x="20" y="30" width="80" height="60" rx="8" />
        <line x1="30" y1="50" x2="90" y2="50" stroke-dasharray="4 4" />
        <line x1="30" y1="65" x2="70" y2="65" stroke-dasharray="4 4" />
        <circle cx="75" cy="45" r="12" fill="none" stroke-width="1.5" />
        <path d="M75 39v12M69 45h12" stroke-width="1.5" stroke-linecap="round" />
    </svg>
);

// Donut Chart SVG Component
const DonutChart = (props: { assets: CexAsset[], size?: number }) => {
    const size = props.size || 160;
    const radius = 55;
    const centerX = size / 2;
    const centerY = size / 2;
    const strokeWidth = 20;

    const COLORS = [
        '#22d3ee', // cyan
        '#a855f7', // purple
        '#3b82f6', // blue
        '#f59e0b', // amber
        '#10b981', // emerald
        '#ef4444', // red
        '#ec4899', // pink
        '#6366f1', // indigo
    ];

    const segments = createMemo(() => {
        const topAssets = props.assets.slice(0, 8);
        const total = topAssets.reduce((s, a) => s + (a.allocationPercent || 0), 0);
        let offset = 0;
        return topAssets.map((asset, i) => {
            const pct = total > 0 ? (asset.allocationPercent / total) * 100 : 0;
            const dashArray = (pct / 100) * (2 * Math.PI * radius);
            const gap = (2 * Math.PI * radius) - dashArray;
            const seg = {
                color: COLORS[i % COLORS.length],
                dashArray: `${dashArray} ${gap}`,
                dashOffset: -offset,
                currency: asset.currency,
                pct,
            };
            offset += dashArray;
            return seg;
        });
    });

    return (
        <div class="relative flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="transform -rotate-90">
                {/* Background ring */}
                <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" stroke-width={strokeWidth} />
                {/* Segments */}
                <For each={segments()}>
                    {(seg) => (
                        <circle
                            cx={centerX}
                            cy={centerY}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            stroke-width={strokeWidth}
                            stroke-dasharray={seg.dashArray}
                            stroke-dashoffset={seg.dashOffset}
                            stroke-linecap="butt"
                            class="transition-all duration-700"
                        />
                    )}
                </For>
            </svg>
            {/* Center text */}
            <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Assets</span>
                <span class="text-xl font-black text-white">{props.assets.length}</span>
            </div>
        </div>
    );
};

// Skeleton loader
const SkeletonRow = () => (
    <div class="flex items-center gap-3 p-3 animate-pulse">
        <div class="w-8 h-8 rounded-full bg-white/5" />
        <div class="flex-1 space-y-2">
            <div class="w-16 h-3 bg-white/5 rounded" />
            <div class="w-24 h-2 bg-white/5 rounded" />
        </div>
        <div class="space-y-2 text-right">
            <div class="w-20 h-3 bg-white/5 rounded ml-auto" />
            <div class="w-14 h-2 bg-white/5 rounded ml-auto" />
        </div>
    </div>
);

const WalletCexPortfolio = (): JSX.Element => {
    // === State ===
    const [credentials, setCredentials] = createSignal<CexCredential[]>([]);
    const [portfolios, setPortfolios] = createSignal<CexPortfolioSnapshot[]>([]);
    const [aggregated, setAggregated] = createSignal<AggregatedPortfolio | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [isSyncing, setIsSyncing] = createSignal(false);
    const [error, setError] = createSignal('');

    // Modal state
    const [showAddModal, setShowAddModal] = createSignal(false);
    const [addExchange, setAddExchange] = createSignal<'upbit' | 'bithumb'>('upbit');
    const [addAccessKey, setAddAccessKey] = createSignal('');
    const [addSecretKey, setAddSecretKey] = createSignal('');
    const [addLabel, setAddLabel] = createSignal('');
    const [isRegistering, setIsRegistering] = createSignal(false);
    const [showSecretKey, setShowSecretKey] = createSignal(false);
    const [registerError, setRegisterError] = createSignal('');
    const [registerSuccess, setRegisterSuccess] = createSignal('');

    // IP Guide modal
    const [showIpGuide, setShowIpGuide] = createSignal(false);
    const [ipCopied, setIpCopied] = createSignal(false);
    const STATIC_IP = '34.22.69.189';

    const copyIpAddress = async () => {
        try {
            await navigator.clipboard.writeText(STATIC_IP);
            setIpCopied(true);
            setTimeout(() => setIpCopied(false), 2000);
        } catch (e) {
            console.error('Copy failed:', e);
        }
    };

    // Delete confirmation
    const [deletingId, setDeletingId] = createSignal<string | null>(null);

    // View mode
    const [viewCurrency, setViewCurrency] = createSignal<'krw' | 'usd'>('krw');

    // === Data Loading ===
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
            console.error('[CEX] Load failed:', err);
            setError(err.message || 'Failed to load portfolio data.');
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        loadData();
    });

    // === Actions ===
    const handleRegister = async () => {
        if (!addAccessKey().trim() || !addSecretKey().trim()) {
            setRegisterError('Please fill in both Access Key and Secret Key.');
            return;
        }
        setIsRegistering(true);
        setRegisterError('');
        setRegisterSuccess('');
        try {
            const result = await registerCexApiKey({
                exchange: addExchange(),
                accessKey: addAccessKey(),
                secretKey: addSecretKey(),
                label: addLabel() || undefined,
            });
            setRegisterSuccess(`${result.label} connected successfully!`);
            setAddAccessKey('');
            setAddSecretKey('');
            setAddLabel('');
            // Reload data
            await loadData();
            // Close modal after delay
            setTimeout(() => {
                setShowAddModal(false);
                setRegisterSuccess('');
            }, 1500);
        } catch (err: any) {
            console.error('[CEX] Register failed:', err);
            setRegisterError(err.message || 'Failed to register API key.');
        } finally {
            setIsRegistering(false);
        }
    };

    const handleDelete = async (credentialId: string) => {
        try {
            await deleteCexApiKey(credentialId);
            setDeletingId(null);
            await loadData();
        } catch (err: any) {
            console.error('[CEX] Delete failed:', err);
            setError(err.message || 'Failed to delete API key.');
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const creds = credentials();
            await Promise.all(creds.map((c) => syncCexPortfolio(c.id)));
            await loadData();
        } catch (err: any) {
            console.error('[CEX] Sync failed:', err);
            setError(err.message || 'Sync failed.');
        } finally {
            setIsSyncing(false);
        }
    };

    const hasCredentials = createMemo(() => credentials().length > 0);
    const displayAssets = createMemo(() => {
        const agg = aggregated();
        return agg?.assets || [];
    });

    // Derive KRW/USD exchange rate from aggregated data (no hardcoding)
    const krwToUsdRate = createMemo(() => {
        const agg = aggregated();
        if (agg && agg.totalValueKrw > 0 && agg.totalValueUsd > 0) {
            return agg.totalValueKrw / agg.totalValueUsd;
        }
        return 0; // Fallback: only show KRW if rate unavailable
    });

    const convertKrwToUsd = (krwValue: number): number => {
        const rate = krwToUsdRate();
        return rate > 0 ? krwValue / rate : 0;
    };

    // === Render ===
    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <WalletViewHeader
                    tag="Exchange Portfolio"
                    title="CEX"
                    titleAccent="PORTFOLIO"
                    description="Connect your exchange accounts and view your complete portfolio with AI-powered analysis."
                    rightElement={
                        <div class="flex items-center gap-2">
                            <Show when={hasCredentials()}>
                                <button
                                    onClick={handleSync}
                                    disabled={isSyncing()}
                                    class="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50"
                                >
                                    <RefreshCw class={`w-3.5 h-3.5 ${isSyncing() ? 'animate-spin' : ''}`} />
                                    Sync
                                </button>
                            </Show>
                            <button
                                onClick={() => {
                                    setShowAddModal(true);
                                    setRegisterError('');
                                    setRegisterSuccess('');
                                    setShowSecretKey(false);
                                }}
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg transition-all text-xs font-bold"
                            >
                                <Plus class="w-3.5 h-3.5" />
                                Connect
                            </button>
                            <button
                                onClick={() => setShowIpGuide(true)}
                                class="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-lg transition-all text-xs font-bold text-gray-400 hover:text-white"
                                title="IP Setup Guide"
                            >
                                <HelpCircle class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    }
                />

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

                {/* Loading State */}
                <Show when={isLoading()}>
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <For each={[1, 2, 3, 4]}>
                                {() => (
                                    <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04] animate-pulse">
                                        <div class="w-16 h-2 bg-white/5 rounded mb-3" />
                                        <div class="w-24 h-5 bg-white/5 rounded" />
                                    </div>
                                )}
                            </For>
                        </div>
                        <div class="bg-[#111113]/60 rounded-2xl border border-white/[0.04] p-4">
                            <For each={[1, 2, 3]}>{() => <SkeletonRow />}</For>
                        </div>
                    </div>
                </Show>

                {/* Empty State */}
                <Show when={!isLoading() && !hasCredentials()}>
                    <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                        <EmptyPortfolioIcon />
                        <h3 class="text-lg font-black text-white mt-6 mb-2">No Exchanges Connected</h3>
                        <p class="text-sm text-gray-500 text-center max-w-sm mb-8">
                            Connect your exchange API keys to view your complete portfolio, get AI analysis, and track your investments.
                        </p>

                        {/* Exchange Cards */}
                        <div class="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
                            <button
                                onClick={() => { setAddExchange('upbit'); setShowAddModal(true); setRegisterError(''); setRegisterSuccess(''); }}
                                class="flex-1 flex items-center gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-cyan-500/20 rounded-2xl transition-all group"
                            >
                                <div class="p-2.5 bg-[#093687]/20 rounded-xl"><UpbitIcon /></div>
                                <div class="text-left">
                                    <div class="text-sm font-black text-white">Upbit</div>
                                    <div class="text-[10px] text-gray-500">Korean Exchange</div>
                                </div>
                                <ChevronRight class="w-4 h-4 text-gray-600 ml-auto group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                            </button>
                            <button
                                onClick={() => { setAddExchange('bithumb'); setShowAddModal(true); setRegisterError(''); setRegisterSuccess(''); }}
                                class="flex-1 flex items-center gap-3 p-4 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-orange-500/20 rounded-2xl transition-all group"
                            >
                                <div class="p-2.5 bg-[#F37021]/20 rounded-xl"><BithumbIcon /></div>
                                <div class="text-left">
                                    <div class="text-sm font-black text-white">Bithumb</div>
                                    <div class="text-[10px] text-gray-500">Korean Exchange</div>
                                </div>
                                <ChevronRight class="w-4 h-4 text-gray-600 ml-auto group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                            </button>
                        </div>

                        {/* Security Notice */}
                        <div class="flex items-start gap-2.5 mt-8 px-4 py-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl max-w-lg">
                            <Shield class="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <p class="text-[11px] text-cyan-400 font-bold mb-0.5">End-to-End Encrypted</p>
                                <p class="text-[10px] text-gray-500 leading-relaxed">
                                    Your API keys are encrypted with AES-256-GCM and stored securely on our servers. We only require read-only permissions.
                                </p>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* Portfolio Dashboard (when connected) */}
                <Show when={!isLoading() && hasCredentials()}>
                    {/* Connected Exchanges */}
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest">Connected Exchanges</h3>
                            <div class="flex items-center gap-1 text-[10px] text-gray-600">
                                <Show when={aggregated()?.lastUpdated}>
                                    Updated {getRelativeTime(aggregated()?.lastUpdated || null)}
                                </Show>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <For each={credentials()}>
                                {(cred) => {
                                    const snapshot = portfolios().find(p => p.credentialId === cred.id);
                                    return (
                                        <div class="flex items-center gap-3 p-3 bg-[#111113]/60 rounded-2xl border border-white/[0.04] hover:border-white/[0.08] transition-all group">
                                            <div class={`p-2 rounded-xl ${cred.exchange === 'upbit' ? 'bg-[#093687]/15' : 'bg-[#F37021]/15'}`}>
                                                {cred.exchange === 'upbit' ? <UpbitIcon /> : <BithumbIcon />}
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <div class="text-sm font-bold text-white truncate">{cred.label}</div>
                                                <div class="flex items-center gap-2 mt-0.5">
                                                    <span class={`inline-flex items-center gap-1 text-[10px] font-bold ${cred.status === 'active' ? 'text-green-400' : cred.status === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                                                        <span class={`w-1.5 h-1.5 rounded-full ${cred.status === 'active' ? 'bg-green-400' : cred.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                                                        {cred.status === 'active' ? 'Active' : cred.status === 'error' ? 'Error' : 'Validating'}
                                                    </span>
                                                    <Show when={snapshot}>
                                                        <span class="text-[10px] text-gray-600">
                                                            {viewCurrency() === 'krw'
                                                                ? formatKrw(snapshot!.totalValueKrw)
                                                                : formatUsd(snapshot!.totalValueUsd)}
                                                        </span>
                                                    </Show>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Show when={deletingId() === cred.id} fallback={
                                                    <button
                                                        onClick={() => setDeletingId(cred.id)}
                                                        class="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 class="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                                                    </button>
                                                }>
                                                    <div class="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleDelete(cred.id)}
                                                            class="p-1 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors"
                                                        >
                                                            <Check class="w-3 h-3 text-red-400" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingId(null)}
                                                            class="p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                                        >
                                                            <X class="w-3 h-3 text-gray-400" />
                                                        </button>
                                                    </div>
                                                </Show>
                                            </div>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>

                    {/* Portfolio Stats */}
                    <Show when={aggregated()}>
                        {(agg) => (
                            <>
                                {/* Currency toggle + Stats */}
                                <div class="flex items-center gap-2 justify-end">
                                    <button
                                        onClick={() => setViewCurrency('krw')}
                                        class={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${viewCurrency() === 'krw' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        KRW
                                    </button>
                                    <button
                                        onClick={() => setViewCurrency('usd')}
                                        class={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${viewCurrency() === 'usd' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        USD
                                    </button>
                                </div>

                                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Total Value */}
                                    <div class="p-4 bg-gradient-to-br from-cyan-500/8 to-transparent rounded-2xl border border-cyan-500/10">
                                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Value</div>
                                        <div class="text-lg font-black text-white">
                                            {viewCurrency() === 'krw' ? formatKrw(agg().totalValueKrw) : formatUsd(agg().totalValueUsd)}
                                        </div>
                                    </div>
                                    {/* P&L */}
                                    <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total P&L</div>
                                        <div class="flex items-center gap-1">
                                            {(() => {
                                                const totalPL = portfolios().reduce((sum, p) => sum + (p.totalProfitLoss || 0), 0);
                                                const isPositive = totalPL >= 0;
                                                return (
                                                    <>
                                                        {isPositive
                                                            ? <TrendingUp class="w-3.5 h-3.5 text-green-400" />
                                                            : <TrendingDown class="w-3.5 h-3.5 text-red-400" />
                                                        }
                                                        <span class={`text-lg font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                                            {viewCurrency() === 'krw' ? formatKrw(Math.abs(totalPL)) : formatUsd(convertKrwToUsd(Math.abs(totalPL)))}
                                                        </span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    {/* Asset Count */}
                                    <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Assets</div>
                                        <div class="text-lg font-black text-white">{agg().assets.length}</div>
                                    </div>
                                    {/* Exchanges */}
                                    <div class="p-4 bg-[#111113]/60 rounded-2xl border border-white/[0.04]">
                                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Exchanges</div>
                                        <div class="text-lg font-black text-white">{credentials().length}</div>
                                    </div>
                                </div>

                                {/* Chart + Asset List */}
                                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Allocation Chart */}
                                    <div class="bg-[#111113]/60 rounded-2xl border border-white/[0.04] p-6">
                                        <h4 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-6">Allocation</h4>
                                        <div class="flex justify-center mb-6">
                                            <DonutChart assets={displayAssets()} size={160} />
                                        </div>
                                        {/* Legend */}
                                        <div class="space-y-2">
                                            <For each={displayAssets().slice(0, 6)}>
                                                {(asset, i) => {
                                                    const COLORS = ['#22d3ee', '#a855f7', '#3b82f6', '#f59e0b', '#10b981', '#ef4444'];
                                                    return (
                                                        <div class="flex items-center gap-2">
                                                            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i() % COLORS.length] }} />
                                                            <span class="text-xs text-gray-400 flex-1">{asset.currency}</span>
                                                            <span class="text-xs font-bold text-white">{asset.allocationPercent?.toFixed(1)}%</span>
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>

                                    {/* Asset Table */}
                                    <div class="lg:col-span-2 bg-[#111113]/60 rounded-2xl border border-white/[0.04] overflow-hidden">
                                        <div class="flex items-center justify-between p-4 border-b border-white/[0.04]">
                                            <h4 class="text-xs font-black text-gray-500 uppercase tracking-widest">Holdings</h4>
                                            <span class="text-[10px] text-gray-600">{displayAssets().length} assets</span>
                                        </div>

                                        {/* Table Header */}
                                        <div class="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-bold text-gray-600 uppercase tracking-wider border-b border-white/[0.02]">
                                            <div class="col-span-4">Asset</div>
                                            <div class="col-span-2 text-right">Price</div>
                                            <div class="col-span-2 text-right">Balance</div>
                                            <div class="col-span-2 text-right">Value</div>
                                            <div class="col-span-2 text-right">P&L</div>
                                        </div>

                                        {/* Asset Rows */}
                                        <div class="divide-y divide-white/[0.02]">
                                            <For each={displayAssets()} fallback={
                                                <div class="p-8 text-center text-sm text-gray-500">No assets found. Sync your exchange to load data.</div>
                                            }>
                                                {(asset) => {
                                                    const iconUrl = getCoinIconUrl(asset.currency);
                                                    const isProfit = asset.profitLoss >= 0;
                                                    return (
                                                        <div class="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors">
                                                            {/* Asset info */}
                                                            <div class="col-span-6 sm:col-span-4 flex items-center gap-3">
                                                                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                                    <Show when={iconUrl} fallback={
                                                                        <span class="text-xs font-black text-gray-400">{asset.currency.slice(0, 2)}</span>
                                                                    }>
                                                                        <img src={iconUrl} alt={asset.currency} class="w-6 h-6 rounded-full" />
                                                                    </Show>
                                                                </div>
                                                                <div class="min-w-0">
                                                                    <div class="text-sm font-bold text-white truncate">{asset.currency}</div>
                                                                    <Show when={asset.sources && asset.sources.length > 0}>
                                                                        <div class="flex items-center gap-1 mt-0.5">
                                                                            <For each={asset.sources}>
                                                                                {(src) => (
                                                                                    <span class="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-gray-500 capitalize">{src}</span>
                                                                                )}
                                                                            </For>
                                                                        </div>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                            {/* Price */}
                                                            <div class="hidden sm:block col-span-2 text-right">
                                                                <span class="text-xs text-gray-400">
                                                                    {viewCurrency() === 'krw'
                                                                        ? formatKrw(asset.currentPrice)
                                                                        : formatUsd(asset.currentPriceUsd)}
                                                                </span>
                                                            </div>
                                                            {/* Balance */}
                                                            <div class="hidden sm:block col-span-2 text-right">
                                                                <span class="text-xs text-white font-bold">
                                                                    {asset.balance < 0.001
                                                                        ? asset.balance.toFixed(8)
                                                                        : asset.balance < 1
                                                                            ? asset.balance.toFixed(4)
                                                                            : asset.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                            {/* Value */}
                                                            <div class="col-span-3 sm:col-span-2 text-right">
                                                                <span class="text-xs font-bold text-white">
                                                                    {viewCurrency() === 'krw'
                                                                        ? formatKrw(asset.valueKrw)
                                                                        : formatUsd(asset.valueUsd)}
                                                                </span>
                                                            </div>
                                                            {/* P&L */}
                                                            <div class="col-span-3 sm:col-span-2 text-right">
                                                                <div class={`text-xs font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {isProfit ? '+' : ''}{asset.profitLossPercent?.toFixed(2)}%
                                                                </div>
                                                                <div class={`text-[10px] ${isProfit ? 'text-green-400/60' : 'text-red-400/60'}`}>
                                                                    {viewCurrency() === 'krw'
                                                                        ? formatKrw(Math.abs(asset.profitLoss))
                                                                        : formatUsd(convertKrwToUsd(Math.abs(asset.profitLoss)))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </Show>
                </Show>

                {/* Add Exchange Modal */}
                <Show when={showAddModal()}>
                    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
                        <div class="w-full max-w-md bg-[#111113] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl">
                            {/* Header */}
                            <div class="flex items-center justify-between p-5 border-b border-white/[0.04]">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-cyan-500/10 rounded-xl">
                                        <Key class="w-5 h-5 text-cyan-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-black text-white">Connect Exchange</h3>
                                        <p class="text-[10px] text-gray-500">Enter your API credentials</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowAddModal(false)} class="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                    <X class="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Body */}
                            <div class="p-5 space-y-4">
                                {/* Exchange Selection */}
                                <div>
                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Exchange</label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setAddExchange('upbit')}
                                            class={`flex items-center gap-2 p-3 rounded-xl border transition-all ${addExchange() === 'upbit' ? 'bg-[#093687]/10 border-[#093687]/30' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'}`}
                                        >
                                            <UpbitIcon />
                                            <span class={`text-xs font-bold ${addExchange() === 'upbit' ? 'text-white' : 'text-gray-400'}`}>Upbit</span>
                                        </button>
                                        <button
                                            onClick={() => setAddExchange('bithumb')}
                                            class={`flex items-center gap-2 p-3 rounded-xl border transition-all ${addExchange() === 'bithumb' ? 'bg-[#F37021]/10 border-[#F37021]/30' : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'}`}
                                        >
                                            <BithumbIcon />
                                            <span class={`text-xs font-bold ${addExchange() === 'bithumb' ? 'text-white' : 'text-gray-400'}`}>Bithumb</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Label */}
                                <div>
                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Label (Optional)</label>
                                    <input
                                        type="text"
                                        value={addLabel()}
                                        onInput={(e) => setAddLabel(e.currentTarget.value)}
                                        placeholder={`My ${addExchange() === 'upbit' ? 'Upbit' : 'Bithumb'}`}
                                        class="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors"
                                    />
                                </div>

                                {/* Access Key */}
                                <div>
                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Access Key</label>
                                    <input
                                        type="text"
                                        value={addAccessKey()}
                                        onInput={(e) => setAddAccessKey(e.currentTarget.value)}
                                        placeholder="Enter your Access Key"
                                        class="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                                        spellcheck={false}
                                        autocomplete="off"
                                    />
                                </div>

                                {/* Secret Key */}
                                <div>
                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                        Secret Key
                                        <button onClick={() => setShowSecretKey(!showSecretKey())} class="text-gray-600 hover:text-gray-400 transition-colors">
                                            {showSecretKey() ? <EyeOff class="w-3 h-3" /> : <Eye class="w-3 h-3" />}
                                        </button>
                                    </label>
                                    <input
                                        type={showSecretKey() ? 'text' : 'password'}
                                        value={addSecretKey()}
                                        onInput={(e) => setAddSecretKey(e.currentTarget.value)}
                                        placeholder="Enter your Secret Key"
                                        class="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 transition-colors font-mono"
                                        spellcheck={false}
                                        autocomplete="off"
                                    />
                                </div>

                                {/* Security Note */}
                                <div class="flex items-start gap-2 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                                    <Shield class="w-3.5 h-3.5 text-cyan-400 mt-0.5 flex-shrink-0" />
                                    <p class="text-[10px] text-gray-500 leading-relaxed">
                                        Keys are encrypted with AES-256-GCM and never stored in plaintext. Only read-only access is required.
                                    </p>
                                </div>

                                {/* Error / Success */}
                                <Show when={registerError()}>
                                    <div class="flex items-center gap-2 p-3 bg-red-500/8 border border-red-500/15 rounded-xl">
                                        <AlertCircle class="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                        <span class="text-xs text-red-300">{registerError()}</span>
                                    </div>
                                </Show>
                                <Show when={registerSuccess()}>
                                    <div class="flex items-center gap-2 p-3 bg-green-500/8 border border-green-500/15 rounded-xl">
                                        <Check class="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                        <span class="text-xs text-green-300">{registerSuccess()}</span>
                                    </div>
                                </Show>
                            </div>

                            {/* Footer */}
                            <div class="flex items-center gap-3 p-5 border-t border-white/[0.04]">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    class="flex-1 px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl text-sm font-bold text-gray-400 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRegister}
                                    disabled={isRegistering() || !addAccessKey().trim() || !addSecretKey().trim()}
                                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl text-sm font-black text-black transition-colors"
                                >
                                    <Show when={isRegistering()} fallback={<>Connect</>}>
                                        <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                                        Validating...
                                    </Show>
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* IP Setup Guide Modal */}
                <Show when={showIpGuide()}>
                    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowIpGuide(false); }}>
                        <div class="w-full max-w-lg bg-[#111113] border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] overflow-y-auto">
                            {/* Header */}
                            <div class="flex items-center justify-between p-5 border-b border-white/[0.04] sticky top-0 bg-[#111113] z-10">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-amber-500/10 rounded-xl">
                                        <Shield class="w-5 h-5 text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 class="text-sm font-black text-white">IP Whitelist Setup Guide</h3>
                                        <p class="text-[10px] text-gray-500">Required for API Key registration</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowIpGuide(false)} class="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                                    <X class="w-4 h-4 text-gray-500" />
                                </button>
                            </div>

                            {/* Body */}
                            <div class="p-5 space-y-5">
                                {/* Static IP Card */}
                                <div class="p-4 bg-gradient-to-br from-cyan-500/8 to-purple-500/5 rounded-2xl border border-cyan-500/15">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Vision Chain Server IP</div>
                                    <div class="flex items-center gap-3">
                                        <code class="text-2xl font-black text-white tracking-wider flex-1">{STATIC_IP}</code>
                                        <button
                                            onClick={copyIpAddress}
                                            class={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${ipCopied()
                                                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                                                    : 'bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white border border-white/[0.08]'
                                                }`}
                                        >
                                            {ipCopied() ? <Check class="w-3.5 h-3.5" /> : <Copy class="w-3.5 h-3.5" />}
                                            {ipCopied() ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                    <p class="text-[10px] text-gray-500 mt-2">Copy this IP address and add it to your exchange API whitelist.</p>
                                </div>

                                {/* Why IP Whitelist */}
                                <div class="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                                    <div class="flex items-start gap-2.5">
                                        <AlertCircle class="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p class="text-xs font-bold text-amber-400 mb-1">Why is this required?</p>
                                            <p class="text-[11px] text-gray-400 leading-relaxed">
                                                Korean exchanges (Upbit, Bithumb) require IP whitelisting for security. Only requests from whitelisted IPs can access your account data. Our server uses a fixed IP to securely fetch your portfolio.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Upbit Guide */}
                                <div class="space-y-3">
                                    <div class="flex items-center gap-2">
                                        <div class="p-1.5 bg-[#093687]/20 rounded-lg"><UpbitIcon /></div>
                                        <h4 class="text-sm font-black text-white">Upbit Setup</h4>
                                    </div>
                                    <div class="space-y-2 pl-2">
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                                            <p class="text-xs text-gray-400">Open API Management page at <a href="https://upbit.com/mypage/open_api_management" target="_blank" rel="noopener" class="text-cyan-400 hover:underline inline-flex items-center gap-0.5">upbit.com <ExternalLink class="w-2.5 h-2.5" /></a></p>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                                            <p class="text-xs text-gray-400">Click <span class="font-bold text-white">"Open API Key"</span> and select <span class="font-bold text-white">"Balance inquiry"</span> permission only.</p>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                                            <p class="text-xs text-gray-400">In the <span class="font-bold text-white">"IP Address"</span> field, enter: <code class="px-1.5 py-0.5 bg-white/5 rounded text-cyan-400 font-mono text-[11px]">{STATIC_IP}</code></p>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-cyan-500/15 text-cyan-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                                            <p class="text-xs text-gray-400">Complete verification and copy the <span class="font-bold text-white">Access Key</span> and <span class="font-bold text-white">Secret Key</span>.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div class="border-t border-white/[0.04]" />

                                {/* Bithumb Guide */}
                                <div class="space-y-3">
                                    <div class="flex items-center gap-2">
                                        <div class="p-1.5 bg-[#F37021]/20 rounded-lg"><BithumbIcon /></div>
                                        <h4 class="text-sm font-black text-white">Bithumb Setup</h4>
                                    </div>
                                    <div class="space-y-2 pl-2">
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                                            <p class="text-xs text-gray-400">Go to API Management at <a href="https://www.bithumb.com/api_support/management_api" target="_blank" rel="noopener" class="text-orange-400 hover:underline inline-flex items-center gap-0.5">bithumb.com <ExternalLink class="w-2.5 h-2.5" /></a></p>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                                            <p class="text-xs text-gray-400">Click <span class="font-bold text-white">"API Key"</span> and select <span class="font-bold text-white">"Account Info"</span> permission only.</p>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                                            <p class="text-xs text-gray-400">In <span class="font-bold text-white">"Allowed IPs"</span>, enter: <code class="px-1.5 py-0.5 bg-white/5 rounded text-orange-400 font-mono text-[11px]">{STATIC_IP}</code></p>
                                        </div>
                                        <div class="flex items-start gap-3">
                                            <span class="w-5 h-5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                                            <p class="text-xs text-gray-400">Complete registration and copy the <span class="font-bold text-white">API Key</span> and <span class="font-bold text-white">Secret Key</span>.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Security note */}
                                <div class="flex items-start gap-2.5 p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                                    <Shield class="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p class="text-[11px] text-green-400 font-bold mb-0.5">Security Best Practice</p>
                                        <p class="text-[10px] text-gray-500 leading-relaxed">
                                            Always grant only <span class="text-white font-bold">read-only (balance inquiry)</span> permissions. Never enable withdrawal or trading permissions for third-party services.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div class="p-5 border-t border-white/[0.04] sticky bottom-0 bg-[#111113]">
                                <button
                                    onClick={() => { setShowIpGuide(false); setShowAddModal(true); setRegisterError(''); setRegisterSuccess(''); }}
                                    class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 rounded-xl text-sm font-black text-black transition-colors"
                                >
                                    <Key class="w-4 h-4" />
                                    Connect Exchange Now
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default WalletCexPortfolio;
