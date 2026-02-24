/**
 * VisionDEX Trading Terminal - Axiom Trade Inspired
 *
 * Layout:
 * ┌─────────────────────────── Top Bar (Token Info) ──────────────────────────────┐
 * ├──── Chart Toolbar ────┬──────────────────────────┬── Buy/Sell Volume ─────────┤
 * │                       │                          │                            │
 * │   TradingView         │   Order Book             │   Buy / Sell Panel         │
 * │   Lightweight Charts  │                          │   (Market/Limit/Adv)       │
 * │   (Candlestick)       │                          │                            │
 * │                       │                          ├── Agent Performance ────────┤
 * │                       │                          │                            │
 * ├──── Bottom Tabs ──────┴──────────────────────────┤   Leaderboard              │
 * │ Trades | Orders | Leaderboard | Engine Status    │   Engine Status            │
 * └──────────────────────────────────────────────────┴────────────────────────────┘
 */
import { createSignal, createEffect, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import { createChart, CandlestickSeries, HistogramSeries, ColorType } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, HistogramData, Time } from 'lightweight-charts';
import './trading-terminal.css';
import './my-agent-panel.css';
import './user-trade-panel.css';
import MyAgentPanel from './MyAgentPanel';
import UserTradePanel from './UserTradePanel';

// ─── API Config ────────────────────────────────────────────────────────────

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

interface MarketData {
    lastPrice: number;
    previousPrice: number;
    changePercent24h: number;
    change24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    quoteVolume24h: number;
    trades24h: number;
    bestBid: number;
    bestAsk: number;
    spreadPercent: number;
    activeAgents: number;
    totalAgents: number;
    openOrders: number;
}

interface OrderBookEntry { price: number; amount: number; total?: number; }
interface Trade {
    price: number; amount: number; total: number;
    takerSide: string; reasoning?: string;
    makerAgentId?: string; takerAgentId?: string;
    timestamp?: any;
}
interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
interface LeaderboardEntry {
    rank: number; agentName: string; strategyPreset: string;
    pnlPercent: number; pnlAbsolute: number; totalTrades: number; winRate: number;
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const ChartIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 12V5l2.5 3.5L7 3l2.5 4.5L12 4v8H2z" stroke="currentColor" stroke-width="1.3" fill="none" />
    </svg>
);
const SettingsIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2" />
        <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.8 2.8l1.4 1.4M9.8 9.8l1.4 1.4M11.2 2.8l-1.4 1.4M4.2 9.8l-1.4 1.4" stroke="currentColor" stroke-width="1" />
    </svg>
);
const RefreshIcon = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M7 2l3 0 0 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

// ─── Utility ───────────────────────────────────────────────────────────────

function fmt(n: number, d = 4) { return n?.toFixed(d) ?? '0'; }
function fmtK(n: number) {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString();
}
function fmtVol(n: number) {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString();
}
function timeAgo(ts: any) {
    if (!ts) return '';
    const sec = ts._seconds || ts.seconds || Math.floor(ts / 1000);
    const diff = Math.floor(Date.now() / 1000) - sec;
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
}

// ─── TradingView Chart Component ───────────────────────────────────────────

function TVChart(props: {
    candles: Candle[];
    interval: string;
    onIntervalChange: (iv: string) => void;
}) {
    let chartContainerRef: HTMLDivElement | undefined;
    let chart: IChartApi | undefined;
    let candleSeries: ISeriesApi<'Candlestick'> | undefined;
    let volumeSeries: ISeriesApi<'Histogram'> | undefined;

    const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

    onMount(() => {
        if (!chartContainerRef) return;

        chart = createChart(chartContainerRef, {
            layout: {
                background: { type: ColorType.Solid, color: '#0b0b10' },
                textColor: '#71717a',
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.03)' },
                horzLines: { color: 'rgba(255,255,255,0.03)' },
            },
            crosshair: {
                mode: 0,
                vertLine: { color: 'rgba(99,102,241,0.3)', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
                horzLine: { color: 'rgba(99,102,241,0.3)', width: 1, style: 2, labelBackgroundColor: '#6366f1' },
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.06)',
                scaleMargins: { top: 0.1, bottom: 0.25 },
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.06)',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        const ro = new ResizeObserver(entries => {
            if (entries.length && chart) {
                const { width, height } = entries[0].contentRect;
                chart.applyOptions({ width, height });
            }
        });
        ro.observe(chartContainerRef);

        onCleanup(() => {
            ro.disconnect();
            chart?.remove();
        });
    });

    createEffect(() => {
        const c = props.candles;
        if (!c || c.length === 0 || !candleSeries || !volumeSeries) return;

        const candleData: CandlestickData<Time>[] = c.map(k => ({
            time: (k.t / 1000) as Time,
            open: k.o,
            high: k.h,
            low: k.l,
            close: k.c,
        }));

        const volData: HistogramData<Time>[] = c.map(k => ({
            time: (k.t / 1000) as Time,
            value: k.v,
            color: k.c >= k.o ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)',
        }));

        candleSeries.setData(candleData);
        volumeSeries.setData(volData);
        chart?.timeScale().fitContent();
    });

    return (
        <div class="tv-chart-wrapper">
            <div class="tv-chart-toolbar">
                <div class="tv-intervals">
                    <For each={intervals}>
                        {(iv) => (
                            <button
                                class={`tv-interval-btn ${props.interval === iv ? 'active' : ''}`}
                                onClick={() => props.onIntervalChange(iv)}
                            >{iv}</button>
                        )}
                    </For>
                </div>
                <div class="tv-chart-info">
                    <span class="tv-powered">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1" /><path d="M4 10V6l2 2 2-4 2 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />"</svg>
                        Lightweight Charts
                    </span>
                </div>
            </div>
            <div class="tv-chart-container" ref={chartContainerRef} />
        </div>
    );
}

// ─── Order Book ────────────────────────────────────────────────────────────

function OrderBook(props: { bids: OrderBookEntry[]; asks: OrderBookEntry[]; lastPrice: number; spread: number }) {
    const maxBid = createMemo(() => Math.max(...(props.bids.map(b => b.amount) || [1]), 1));
    const maxAsk = createMemo(() => Math.max(...(props.asks.map(a => a.amount) || [1]), 1));

    return (
        <div class="ob-container">
            <div class="ob-header">
                <span>Price</span>
                <span>Amount</span>
                <span>Total</span>
            </div>
            <div class="ob-asks">
                <For each={[...(props.asks || [])].reverse().slice(0, 12)}>
                    {(ask) => (
                        <div class="ob-row ob-ask">
                            <div class="ob-depth-bar" style={{ width: `${Math.min((ask.amount / maxAsk()) * 100, 100)}%` }} />
                            <span class="ob-price">{fmt(ask.price)}</span>
                            <span class="ob-amt">{fmtVol(ask.amount)}</span>
                            <span class="ob-total">{fmtVol(ask.amount * ask.price)}</span>
                        </div>
                    )}
                </For>
            </div>
            <div class="ob-mid">
                <span class={`ob-mid-price ${props.lastPrice >= (props.bids[0]?.price || 0) ? 'up' : 'dn'}`}>
                    {fmt(props.lastPrice)}
                </span>
                <span class="ob-spread-val">Spread: {props.spread?.toFixed(3)}%</span>
            </div>
            <div class="ob-bids">
                <For each={(props.bids || []).slice(0, 12)}>
                    {(bid) => (
                        <div class="ob-row ob-bid">
                            <div class="ob-depth-bar" style={{ width: `${Math.min((bid.amount / maxBid()) * 100, 100)}%` }} />
                            <span class="ob-price">{fmt(bid.price)}</span>
                            <span class="ob-amt">{fmtVol(bid.amount)}</span>
                            <span class="ob-total">{fmtVol(bid.amount * bid.price)}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

// ─── Bottom Tabs ───────────────────────────────────────────────────────────

function BottomTabs(props: { trades: Trade[]; leaderboard: LeaderboardEntry[]; market: MarketData | null }) {
    const [tab, setTab] = createSignal<'trades' | 'orders' | 'leaderboard' | 'engine'>('trades');

    return (
        <div class="bt-container">
            <div class="bt-tabs">
                <button class={`bt-tab ${tab() === 'trades' ? 'active' : ''}`} onClick={() => setTab('trades')}>
                    Trades
                </button>
                <button class={`bt-tab ${tab() === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
                    Orders
                </button>
                <button class={`bt-tab ${tab() === 'leaderboard' ? 'active' : ''}`} onClick={() => setTab('leaderboard')}>
                    Top Agents
                </button>
                <button class={`bt-tab ${tab() === 'engine' ? 'active' : ''}`} onClick={() => setTab('engine')}>
                    Engine
                </button>
            </div>
            <div class="bt-content">
                <Show when={tab() === 'trades'}>
                    <div class="bt-table">
                        <div class="bt-thead">
                            <span>Side</span><span>Price</span><span>Amount</span><span>Total USD</span><span>Agent</span><span>Time</span>
                        </div>
                        <div class="bt-tbody">
                            <For each={(props.trades || []).slice(0, 25)}>
                                {(t) => (
                                    <div class={`bt-row ${t.takerSide === 'buy' ? 'row-buy' : 'row-sell'}`} title={t.reasoning || ''}>
                                        <span class={`bt-side ${t.takerSide}`}>{t.takerSide === 'buy' ? 'Buy' : 'Sell'}</span>
                                        <span class="bt-price">{fmt(t.price)}</span>
                                        <span>{fmtVol(t.amount)}</span>
                                        <span>{fmtK(t.total)}</span>
                                        <span class="bt-agent">{t.takerAgentId?.replace('default-', '') || '-'}</span>
                                        <span class="bt-time">{timeAgo(t.timestamp)}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
                <Show when={tab() === 'orders'}>
                    <div class="bt-empty">
                        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="4" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" /><path d="M10 13h12M10 17h8M10 21h10" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-linecap="round" /></svg>
                        <span>Open orders will appear here</span>
                    </div>
                </Show>
                <Show when={tab() === 'leaderboard'}>
                    <div class="bt-table">
                        <div class="bt-thead">
                            <span>#</span><span>Agent</span><span>Strategy</span><span>PnL %</span><span>Win Rate</span><span>Trades</span>
                        </div>
                        <div class="bt-tbody">
                            <For each={(props.leaderboard || []).slice(0, 10)}>
                                {(e) => (
                                    <div class="bt-row">
                                        <span class="bt-rank">{e.rank}</span>
                                        <span class="bt-agent-name">{e.agentName}</span>
                                        <span class="bt-strat">{e.strategyPreset}</span>
                                        <span class={e.pnlPercent >= 0 ? 'clr-green' : 'clr-red'}>
                                            {e.pnlPercent >= 0 ? '+' : ''}{e.pnlPercent.toFixed(2)}%
                                        </span>
                                        <span>{e.winRate?.toFixed(1) || '0'}%</span>
                                        <span>{e.totalTrades}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
                <Show when={tab() === 'engine'}>
                    <div class="bt-engine">
                        <Show when={props.market}>
                            {(m) => (
                                <div class="engine-grid">
                                    <div class="engine-card">
                                        <span class="engine-label">Active Agents</span>
                                        <span class="engine-val">{m().activeAgents} / {m().totalAgents}</span>
                                    </div>
                                    <div class="engine-card">
                                        <span class="engine-label">Open Orders</span>
                                        <span class="engine-val">{m().openOrders}</span>
                                    </div>
                                    <div class="engine-card">
                                        <span class="engine-label">Bid/Ask Spread</span>
                                        <span class="engine-val">{m().spreadPercent?.toFixed(3)}%</span>
                                    </div>
                                    <div class="engine-card">
                                        <span class="engine-label">24h Volume</span>
                                        <span class="engine-val">{fmtK(m().quoteVolume24h)}</span>
                                    </div>
                                    <div class="engine-card">
                                        <span class="engine-label">24h Trades</span>
                                        <span class="engine-val">{fmtVol(m().trades24h)}</span>
                                    </div>
                                    <div class="engine-card">
                                        <span class="engine-label">Status</span>
                                        <span class="engine-val engine-running">
                                            <span class="status-dot" /> Running
                                        </span>
                                    </div>
                                </div>
                            )}
                        </Show>
                    </div>
                </Show>
            </div>
        </div>
    );
}

function RightSidebar(props: { market: MarketData | null; leaderboard: LeaderboardEntry[] }) {
    const [panelMode, setPanelMode] = createSignal<'agent' | 'trade'>('agent');

    const TradeIcon = () => (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M2 10l4-6 3 3 3-5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M10 2h2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
    );
    const AgentIcon = () => (
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="4" width="8" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2" />
            <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r="0.8" fill="currentColor" />
            <path d="M7 1.5v2.5M5 4V3M9 4V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
        </svg>
    );

    return (
        <div class="rs-container">
            {/* Mode Toggle */}
            <div class="rs-mode-toggle-bar">
                <button
                    class={`rs-mode-btn ${panelMode() === 'agent' ? 'active' : ''}`}
                    onClick={() => setPanelMode('agent')}
                >
                    <AgentIcon /> AI Agent
                </button>
                <button
                    class={`rs-mode-btn ${panelMode() === 'trade' ? 'active' : ''}`}
                    onClick={() => setPanelMode('trade')}
                >
                    <TradeIcon /> Trade
                </button>
            </div>

            {/* Buy/Sell Volume Summary (always visible) */}
            <Show when={props.market}>
                {(m) => (
                    <div class="rs-vol-bar">
                        <div class="rs-vol-item">
                            <span class="rs-vol-label">Volume</span>
                            <span class="rs-vol-val">{fmtK(m().quoteVolume24h)}</span>
                        </div>
                    </div>
                )}
            </Show>

            {/* ── Agent Mode ── */}
            <Show when={panelMode() === 'agent'}>
                <MyAgentPanel currentPrice={props.market?.lastPrice || 0.10} />
            </Show>

            {/* ── Trade Mode ── */}
            <Show when={panelMode() === 'trade'}>
                <UserTradePanel market={props.market} />
            </Show>

            {/* Token Info (always visible) */}
            <div class="rs-token-info">
                <div class="rs-ti-header">
                    <span>Token Info</span>
                    <button class="rs-ti-refresh"><RefreshIcon /></button>
                </div>
                <div class="rs-ti-grid">
                    <Show when={props.market}>
                        {(m) => (<>
                            <div class="rs-ti-item">
                                <span class="rs-ti-label">Agents</span>
                                <span class="rs-ti-val">{m().activeAgents}</span>
                            </div>
                            <div class="rs-ti-item">
                                <span class="rs-ti-label">Open Orders</span>
                                <span class="rs-ti-val">{m().openOrders}</span>
                            </div>
                            <div class="rs-ti-item">
                                <span class="rs-ti-label">24h Trades</span>
                                <span class="rs-ti-val">{fmtVol(m().trades24h)}</span>
                            </div>
                            <div class="rs-ti-item">
                                <span class="rs-ti-label">Spread</span>
                                <span class="rs-ti-val">{m().spreadPercent?.toFixed(3)}%</span>
                            </div>
                        </>)}
                    </Show>
                </div>
            </div>

            {/* Top 3 Leaderboard */}
            <div class="rs-top3">
                <div class="rs-top3-header">Top Agents</div>
                <For each={(props.leaderboard || []).slice(0, 5)}>
                    {(e) => (
                        <div class="rs-top3-row">
                            <span class="rs-top3-rank">#{e.rank}</span>
                            <span class="rs-top3-name">{e.agentName}</span>
                            <span class={`rs-top3-pnl ${e.pnlPercent >= 0 ? 'clr-green' : 'clr-red'}`}>
                                {e.pnlPercent >= 0 ? '+' : ''}{e.pnlPercent.toFixed(2)}%
                            </span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

// ─── Main Trading Terminal ─────────────────────────────────────────────────

export default function TradingTerminal() {
    const [market, setMarket] = createSignal<MarketData | null>(null);
    const [bids, setBids] = createSignal<OrderBookEntry[]>([]);
    const [asks, setAsks] = createSignal<OrderBookEntry[]>([]);
    const [trades, setTrades] = createSignal<Trade[]>([]);
    const [candles, setCandles] = createSignal<Candle[]>([]);
    const [leaderboard, setLeaderboard] = createSignal<LeaderboardEntry[]>([]);
    const [interval, setInterval_] = createSignal('1h');
    const [loading, setLoading] = createSignal(true);

    let pollTimer: any;

    async function fetchAll() {
        try {
            const [mkt, ob, trd, cnd, lb] = await Promise.all([
                apiCall('getMarket'),
                apiCall('getOrderBook'),
                apiCall('getRecentTrades', { limit: 30 }),
                apiCall('getCandles', { interval: interval(), limit: 200 }),
                apiCall('getLeaderboard', { limit: 10 }),
            ]);
            if (mkt.success && mkt.market) setMarket(mkt.market);
            if (ob.success) { setBids(ob.bids || []); setAsks(ob.asks || []); }
            if (trd.success) setTrades(trd.trades || []);
            if (cnd.success) setCandles(cnd.candles || []);
            if (lb.success) setLeaderboard(lb.leaderboard || []);
            setLoading(false);
        } catch (e) { console.error('[DEX] fetch error:', e); }
    }

    function changeInterval(iv: string) {
        setInterval_(iv);
        apiCall('getCandles', { interval: iv, limit: 200 }).then(r => r.success && setCandles(r.candles || []));
    }

    onMount(() => { fetchAll(); pollTimer = window.setInterval(fetchAll, 10000); });
    onCleanup(() => { if (pollTimer) clearInterval(pollTimer); });

    const priceUp = createMemo(() => {
        const m = market(); return m ? m.lastPrice >= m.previousPrice : true;
    });

    return (
        <div class="dex-root">
            {/* ── Top Bar ──────────────────────────────────────────────── */}
            <header class="dex-header">
                <div class="dex-h-left">
                    <div class="dex-h-pair">
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                            <circle cx="11" cy="11" r="9" fill="url(#g1)" />
                            <text x="11" y="15" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold">V</text>
                            <defs><linearGradient id="g1" x1="0" y1="0" x2="22" y2="22"><stop stop-color="#818cf8" /><stop offset="1" stop-color="#6366f1" /></linearGradient></defs>
                        </svg>
                        <span class="dex-h-symbol">VCN/USDT</span>
                    </div>
                    <Show when={market()}>
                        {(m) => (
                            <div class="dex-h-stats">
                                <span class={`dex-h-price ${priceUp() ? 'up' : 'dn'}`}>
                                    ${fmt(m().lastPrice)}
                                </span>
                                <div class="dex-h-meta">
                                    <div class="dex-h-kv"><span class="k">Price</span><span>${fmt(m().lastPrice)}</span></div>
                                    <div class="dex-h-kv"><span class="k">24h</span><span class={m().changePercent24h >= 0 ? 'clr-green' : 'clr-red'}>{m().changePercent24h >= 0 ? '+' : ''}{m().changePercent24h?.toFixed(2)}%</span></div>
                                    <div class="dex-h-kv"><span class="k">High</span><span>{fmt(m().high24h)}</span></div>
                                    <div class="dex-h-kv"><span class="k">Low</span><span>{fmt(m().low24h)}</span></div>
                                    <div class="dex-h-kv"><span class="k">Volume</span><span>{fmtK(m().quoteVolume24h)}</span></div>
                                    <div class="dex-h-kv"><span class="k">Agents</span><span>{m().activeAgents}</span></div>
                                </div>
                            </div>
                        )}
                    </Show>
                </div>
            </header>

            {/* ── Main Layout ──────────────────────────────────────────── */}
            <div class="dex-main">
                {/* Left + Center: Chart, OrderBook, BottomTabs */}
                <div class="dex-left">
                    <div class="dex-chart-area">
                        {/* Chart */}
                        <div class="dex-chart-panel">
                            <TVChart candles={candles()} interval={interval()} onIntervalChange={changeInterval} />
                        </div>
                        {/* Order Book */}
                        <div class="dex-ob-panel">
                            <div class="dex-ob-title">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <rect x="1" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1" />
                                    <rect x="8" y="1" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1" />
                                </svg>
                                Order Book
                            </div>
                            <OrderBook bids={bids()} asks={asks()} lastPrice={market()?.lastPrice || 0} spread={market()?.spreadPercent || 0} />
                        </div>
                    </div>
                    {/* Bottom Tabs */}
                    <BottomTabs trades={trades()} leaderboard={leaderboard()} market={market()} />
                </div>

                {/* Right Sidebar */}
                <div class="dex-right">
                    <RightSidebar market={market()} leaderboard={leaderboard()} />
                </div>
            </div>

            {/* Loading overlay */}
            <Show when={loading()}>
                <div class="dex-loading-overlay">
                    <div class="dex-spinner" />
                    <span>Connecting to VisionDEX...</span>
                </div>
            </Show>
        </div>
    );
}
