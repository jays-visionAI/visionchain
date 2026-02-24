/**
 * VisionDEX - Trading Pairs List View
 *
 * Shows all available trading pairs with real-time market data.
 * Clicking a pair navigates to /dex/:pair for the full trading terminal.
 */
import { createSignal, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import { A } from '@solidjs/router';
import DexLoginButton from './DexLoginButton';
import './dex-markets.css';

// ─── API ───────────────────────────────────────────────────────────────────

function getApiUrl() {
    if (window.location.hostname.includes('staging') || window.location.hostname === 'localhost') {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/tradingArenaAPI';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/tradingArenaAPI';
}

async function apiCall(action: string, body: Record<string, any> = {}) {
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
    });
    return res.json();
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface PairData {
    pair: string;
    baseSymbol: string;
    quoteSymbol: string;
    lastPrice: number;
    previousPrice: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    quoteVolume24h: number;
    trades24h: number;
    activeAgents: number;
    totalAgents: number;
    sparkline?: number[];
}

interface LeaderboardEntry {
    rank: number;
    agentName: string;
    strategyPreset: string;
    pnlPercent: number;
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
        <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
);

const TrendUpIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 9l3-3 2 2 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M8 3h3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

const TrendDownIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M1 3l3 3 2-2 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M8 9h3V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

const AgentsIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="5" cy="4" r="2" stroke="currentColor" stroke-width="1.2" />
        <path d="M1 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="1.2" fill="none" />
        <circle cx="10" cy="5" r="1.5" stroke="currentColor" stroke-width="1" />
        <path d="M13 12c0-1.7-1.3-3-3-3" stroke="currentColor" stroke-width="1" fill="none" />
    </svg>
);

const FireIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 1c0 2-2 3-2 5s1 3 2 4c1-1 2-2 2-4s-2-3-2-5z" stroke="currentColor" stroke-width="1.2" fill="none" />
        <path d="M5 8c0 1 .9 2 2 2s2-1 2-2" stroke="currentColor" stroke-width="1" fill="none" />
    </svg>
);

const ChartIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="8" width="2.5" height="5" rx="0.5" fill="currentColor" opacity="0.3" />
        <rect x="4.5" y="5" width="2.5" height="8" rx="0.5" fill="currentColor" opacity="0.5" />
        <rect x="8" y="2" width="2.5" height="11" rx="0.5" fill="currentColor" opacity="0.7" />
        <rect x="11.5" y="6" width="1.5" height="7" rx="0.5" fill="currentColor" />
    </svg>
);

// ─── Utility ───────────────────────────────────────────────────────────────

function fmt(n: number, d = 4) { return n?.toFixed(d) ?? '0'; }
function fmtK(n: number) {
    if (!n && n !== 0) return '$0';
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString();
}

// ─── Mini Sparkline (SVG) ──────────────────────────────────────────────────

function Sparkline(props: { data: number[]; positive: boolean }) {
    const svgPath = createMemo(() => {
        const d = props.data;
        if (!d || d.length < 2) return '';
        const w = 80;
        const h = 28;
        const mn = Math.min(...d);
        const mx = Math.max(...d);
        const range = mx - mn || 1;
        const points = d.map((v, i) => {
            const x = (i / (d.length - 1)) * w;
            const y = h - ((v - mn) / range) * h;
            return `${x},${y}`;
        });
        return `M${points.join('L')}`;
    });

    return (
        <svg width="80" height="28" viewBox="0 0 80 28" class="sparkline-svg">
            <path d={svgPath()} fill="none" stroke={props.positive ? '#22c55e' : '#ef4444'} stroke-width="1.5" />
        </svg>
    );
}

// ─── Market Stats Cards ────────────────────────────────────────────────────

function StatsBar(props: { market: PairData | null; agents: number }) {
    return (
        <div class="dm-stats-bar">
            <div class="dm-stat-card">
                <div class="dm-stat-icon">
                    <ChartIcon />
                </div>
                <div class="dm-stat-content">
                    <span class="dm-stat-label">Total Volume</span>
                    <span class="dm-stat-value">{fmtK(props.market?.quoteVolume24h || 0)}</span>
                </div>
            </div>
            <div class="dm-stat-card">
                <div class="dm-stat-icon">
                    <FireIcon />
                </div>
                <div class="dm-stat-content">
                    <span class="dm-stat-label">24h Trades</span>
                    <span class="dm-stat-value">{(props.market?.trades24h || 0).toLocaleString()}</span>
                </div>
            </div>
            <div class="dm-stat-card">
                <div class="dm-stat-icon">
                    <AgentsIcon />
                </div>
                <div class="dm-stat-content">
                    <span class="dm-stat-label">Active Agents</span>
                    <span class="dm-stat-value">{props.agents}</span>
                </div>
            </div>
            <div class="dm-stat-card">
                <div class="dm-stat-icon active">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5" />
                        <circle cx="7" cy="7" r="2" fill="currentColor" />
                    </svg>
                </div>
                <div class="dm-stat-content">
                    <span class="dm-stat-label">Engine</span>
                    <span class="dm-stat-value dm-stat-active">
                        <span class="dm-dot" /> Running
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function DEXMarkets() {
    const [market, setMarket] = createSignal<PairData | null>(null);
    const [leaderboard, setLeaderboard] = createSignal<LeaderboardEntry[]>([]);
    const [search, setSearch] = createSignal('');
    const [loading, setLoading] = createSignal(true);
    const [candles, setCandles] = createSignal<number[]>([]);

    let pollTimer: any;

    async function fetchData() {
        try {
            const [mkt, lb, cnd] = await Promise.all([
                apiCall('getMarket'),
                apiCall('getLeaderboard', { limit: 5 }),
                apiCall('getCandles', { interval: '1h', limit: 24 }),
            ]);
            if (mkt.success && mkt.market) {
                const m = mkt.market;
                setMarket({
                    pair: 'VCN-USDT',
                    baseSymbol: 'VCN',
                    quoteSymbol: 'USDT',
                    lastPrice: m.lastPrice,
                    previousPrice: m.previousPrice,
                    changePercent24h: m.changePercent24h,
                    high24h: m.high24h,
                    low24h: m.low24h,
                    volume24h: m.volume24h,
                    quoteVolume24h: m.quoteVolume24h,
                    trades24h: m.trades24h,
                    activeAgents: m.activeAgents,
                    totalAgents: m.totalAgents,
                });
            }
            if (lb.success) setLeaderboard(lb.leaderboard || []);
            if (cnd.success && cnd.candles) {
                setCandles(cnd.candles.map((c: any) => c.c));
            }
            setLoading(false);
        } catch (e) { console.error('[DEXMarkets]', e); }
    }

    onMount(() => { fetchData(); pollTimer = window.setInterval(fetchData, 15000); });
    onCleanup(() => { if (pollTimer) clearInterval(pollTimer); });

    const isPositive = createMemo(() => (market()?.changePercent24h || 0) >= 0);

    // Available pairs (currently only VCN/USDT, expandable later)
    const pairs = createMemo(() => {
        const m = market();
        if (!m) return [];
        const list = [m];
        const q = search().toLowerCase();
        if (q) return list.filter(p =>
            p.pair.toLowerCase().includes(q) ||
            p.baseSymbol.toLowerCase().includes(q)
        );
        return list;
    });

    return (
        <div class="dm-root">
            {/* Header */}
            <div class="dm-header">
                <div class="dm-header-left">
                    <div class="dm-logo">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="14" r="12" fill="url(#dmg)" />
                            <text x="14" y="18" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold">V</text>
                            <defs><linearGradient id="dmg" x1="0" y1="0" x2="28" y2="28"><stop stop-color="#818cf8" /><stop offset="1" stop-color="#6366f1" /></linearGradient></defs>
                        </svg>
                        <div class="dm-logo-text">
                            <h1>VisionDEX</h1>
                            <span>AI-Powered Trading Arena</span>
                        </div>
                    </div>
                </div>
                <div class="dm-header-right">
                    <div class="dm-search">
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Search pairs..."
                            value={search()}
                            onInput={(e) => setSearch(e.currentTarget.value)}
                        />
                    </div>
                    <DexLoginButton />
                </div>
            </div>

            {/* Stats Bar */}
            <StatsBar market={market()} agents={market()?.activeAgents || 0} />

            {/* Main Content */}
            <div class="dm-content">
                {/* Pairs Table */}
                <div class="dm-pairs-section">
                    <div class="dm-section-header">
                        <h2>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                            </svg>
                            Markets
                        </h2>
                        <div class="dm-filter-tabs">
                            <button class="dm-filter active">All</button>
                            <button class="dm-filter">Hot</button>
                            <button class="dm-filter">New</button>
                        </div>
                    </div>

                    {/* Table Header */}
                    <div class="dm-table-header">
                        <span class="dm-th-pair">Pair</span>
                        <span class="dm-th">Price</span>
                        <span class="dm-th">24h Change</span>
                        <span class="dm-th">24h High</span>
                        <span class="dm-th">24h Low</span>
                        <span class="dm-th">Volume</span>
                        <span class="dm-th">Chart</span>
                        <span class="dm-th">Agents</span>
                        <span class="dm-th-action">Trade</span>
                    </div>

                    {/* Table Body */}
                    <Show when={!loading()} fallback={
                        <div class="dm-loading-rows">
                            <div class="dm-skeleton-row" /><div class="dm-skeleton-row" /><div class="dm-skeleton-row" />
                        </div>
                    }>
                        <div class="dm-table-body">
                            <For each={pairs()}>
                                {(pair) => (
                                    <A href={`/dex/${pair.pair}`} class="dm-pair-row">
                                        <div class="dm-pair-info">
                                            <div class="dm-pair-icon">
                                                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                                    <circle cx="14" cy="14" r="12" fill="url(#p1)" />
                                                    <text x="14" y="18" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">{pair.baseSymbol[0]}</text>
                                                    <defs><linearGradient id="p1" x1="0" y1="0" x2="28" y2="28"><stop stop-color="#818cf8" /><stop offset="1" stop-color="#4f46e5" /></linearGradient></defs>
                                                </svg>
                                            </div>
                                            <div class="dm-pair-names">
                                                <span class="dm-pair-base">{pair.baseSymbol}</span>
                                                <span class="dm-pair-quote">/ {pair.quoteSymbol}</span>
                                            </div>
                                        </div>

                                        <span class="dm-cell dm-price">${fmt(pair.lastPrice)}</span>

                                        <span class={`dm-cell dm-change ${isPositive() ? 'positive' : 'negative'}`}>
                                            {isPositive() ? <TrendUpIcon /> : <TrendDownIcon />}
                                            {isPositive() ? '+' : ''}{pair.changePercent24h?.toFixed(2)}%
                                        </span>

                                        <span class="dm-cell">{fmt(pair.high24h)}</span>
                                        <span class="dm-cell">{fmt(pair.low24h)}</span>
                                        <span class="dm-cell dm-volume">{fmtK(pair.quoteVolume24h)}</span>

                                        <span class="dm-cell dm-sparkline">
                                            <Sparkline data={candles()} positive={isPositive()} />
                                        </span>

                                        <span class="dm-cell dm-agents">
                                            <AgentsIcon />
                                            {pair.activeAgents}
                                        </span>

                                        <span class="dm-cell dm-trade-btn">
                                            Trade
                                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                                <path d="M3 1l5 4-5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                        </span>
                                    </A>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>

                {/* Sidebar: Top Agents */}
                <div class="dm-sidebar">
                    <div class="dm-sb-card">
                        <h3>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M4 2h6v4c0 1.7-1.3 3-3 3S4 7.7 4 6V2z" stroke="currentColor" stroke-width="1.2" />
                                <line x1="7" y1="9" x2="7" y2="11" stroke="currentColor" stroke-width="1.2" />
                                <line x1="5" y1="11.5" x2="9" y2="11.5" stroke="currentColor" stroke-width="1.2" />
                            </svg>
                            Top Agents
                        </h3>
                        <div class="dm-sb-list">
                            <For each={leaderboard()}>
                                {(entry) => (
                                    <div class="dm-sb-row">
                                        <span class="dm-sb-rank">#{entry.rank}</span>
                                        <div class="dm-sb-info">
                                            <span class="dm-sb-name">{entry.agentName}</span>
                                            <span class="dm-sb-strat">{entry.strategyPreset}</span>
                                        </div>
                                        <span class={`dm-sb-pnl ${entry.pnlPercent >= 0 ? 'positive' : 'negative'}`}>
                                            {entry.pnlPercent >= 0 ? '+' : ''}{entry.pnlPercent.toFixed(2)}%
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    <Show when={market()}>
                        {(m) => (
                            <div class="dm-sb-card dm-sb-highlight">
                                <div class="dm-sb-hl-header">
                                    <span>VCN/USDT</span>
                                    <span class={`dm-sb-hl-change ${isPositive() ? 'positive' : 'negative'}`}>
                                        {isPositive() ? '+' : ''}{m().changePercent24h?.toFixed(2)}%
                                    </span>
                                </div>
                                <div class="dm-sb-hl-price">${fmt(m().lastPrice)}</div>
                                <Sparkline data={candles()} positive={isPositive()} />
                                <A href="/dex/VCN-USDT" class="dm-sb-trade-btn">
                                    Open Trading Terminal
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M3 1l6 5-6 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                    </svg>
                                </A>
                            </div>
                        )}
                    </Show>
                </div>
            </div>

            {/* Loading */}
            <Show when={loading()}>
                <div class="dm-overlay">
                    <div class="dm-spinner" />
                    <span>Loading VisionDEX...</span>
                </div>
            </Show>
        </div>
    );
}
