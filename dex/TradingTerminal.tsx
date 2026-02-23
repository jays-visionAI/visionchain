/**
 * VisionDEX Trading Terminal - Main Component
 *
 * Axiom Trade inspired 3-column layout:
 * - Left: Candlestick chart + recent trades
 * - Center: Order book with depth visualization
 * - Right: Agent watch panel + leaderboard
 */
import { createSignal, createEffect, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import './trading-terminal.css';

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

interface OrderBookEntry {
    price: number;
    amount: number;
    agentId?: string;
}

interface Trade {
    price: number;
    amount: number;
    total: number;
    takerSide: string;
    reasoning?: string;
    makerAgentId?: string;
    takerAgentId?: string;
    timestamp?: any;
}

interface Candle {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
}

interface LeaderboardEntry {
    rank: number;
    agentName: string;
    strategyPreset: string;
    pnlPercent: number;
    pnlAbsolute: number;
    totalTrades: number;
    winRate: number;
}

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const ChartIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 14V5l3 4 3-7 3 5 3-4v11H2z" stroke="currentColor" stroke-width="1.5" fill="none" />
    </svg>
);

const BookIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1.2" />
        <rect x="9" y="2" width="5" height="12" rx="1" stroke="currentColor" stroke-width="1.2" />
        <line x1="4" y1="5" x2="5.5" y2="5" stroke="currentColor" stroke-width="1" />
        <line x1="4" y1="7" x2="6" y2="7" stroke="currentColor" stroke-width="1" />
        <line x1="11" y1="5" x2="12.5" y2="5" stroke="currentColor" stroke-width="1" />
        <line x1="11" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1" />
    </svg>
);

const AgentIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5" r="3" stroke="currentColor" stroke-width="1.2" />
        <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" stroke-width="1.2" fill="none" />
    </svg>
);

const RefreshIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 7A5 5 0 1 1 7 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        <path d="M7 2l3 0 0 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);

const TrophyIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2h6v4c0 1.7-1.3 3-3 3S4 7.7 4 6V2z" stroke="currentColor" stroke-width="1.2" />
        <path d="M4 3H2.5C2.2 3 2 3.2 2 3.5v1C2 5.3 2.7 6 3.5 6H4" stroke="currentColor" stroke-width="1" />
        <path d="M10 3h1.5c.3 0 .5.2.5.5v1c0 .8-.7 1.5-1.5 1.5H10" stroke="currentColor" stroke-width="1" />
        <line x1="7" y1="9" x2="7" y2="11" stroke="currentColor" stroke-width="1.2" />
        <line x1="5" y1="11.5" x2="9" y2="11.5" stroke="currentColor" stroke-width="1.2" />
    </svg>
);

const ArrowUpIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2.5 4.5L5 2l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
);

const ArrowDownIcon = () => (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 8V2M2.5 5.5L5 8l2.5-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
);

// ─── Utility ───────────────────────────────────────────────────────────────

function formatNum(n: number, dec = 4) { return n?.toFixed(dec) ?? '0'; }
function formatK(n: number) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
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

// ─── SVG Candlestick Chart ─────────────────────────────────────────────────

function CandlestickChart(props: { candles: Candle[] }) {
    const W = 720;
    const H = 300;
    const PAD = { top: 20, right: 60, bottom: 30, left: 10 };

    const chartData = createMemo(() => {
        const c = props.candles;
        if (!c || c.length === 0) return null;

        const allPrices = c.flatMap(k => [k.h, k.l]);
        const minP = Math.min(...allPrices);
        const maxP = Math.max(...allPrices);
        const range = maxP - minP || 0.001;

        const chartW = W - PAD.left - PAD.right;
        const chartH = H - PAD.top - PAD.bottom;
        const barW = Math.max(2, Math.min(12, chartW / c.length - 2));

        const scaleY = (p: number) => PAD.top + chartH - ((p - minP) / range) * chartH;

        const bars = c.map((k, i) => {
            const x = PAD.left + (i / c.length) * chartW + barW / 2;
            const isGreen = k.c >= k.o;
            const bodyTop = scaleY(Math.max(k.o, k.c));
            const bodyBot = scaleY(Math.min(k.o, k.c));

            return {
                x, isGreen,
                wickTop: scaleY(k.h),
                wickBot: scaleY(k.l),
                bodyTop,
                bodyHeight: Math.max(1, bodyBot - bodyTop),
                barW,
            };
        });

        // Y-axis labels
        const steps = 5;
        const labels = Array.from({ length: steps + 1 }, (_, i) => {
            const p = minP + (range * i) / steps;
            return { y: scaleY(p), label: p.toFixed(4) };
        });

        return { bars, labels, minP, maxP };
    });

    return (
        <div class="dex-chart-container">
            <Show when={chartData()} fallback={
                <div class="dex-chart-empty">Loading chart data...</div>
            }>
                {(data) => (
                    <svg viewBox={`0 0 ${W} ${H}`} class="dex-chart-svg">
                        {/* Grid lines */}
                        <For each={data().labels}>
                            {(label) => (
                                <>
                                    <line x1={PAD.left} y1={label.y} x2={W - PAD.right} y2={label.y} stroke="rgba(255,255,255,0.06)" stroke-width="0.5" />
                                    <text x={W - PAD.right + 5} y={label.y + 3} fill="rgba(255,255,255,0.4)" font-size="9" font-family="monospace">{label.label}</text>
                                </>
                            )}
                        </For>
                        {/* Candles */}
                        <For each={data().bars}>
                            {(bar) => (
                                <>
                                    <line x1={bar.x} y1={bar.wickTop} x2={bar.x} y2={bar.wickBot}
                                        stroke={bar.isGreen ? '#22c55e' : '#ef4444'} stroke-width="1" />
                                    <rect x={bar.x - bar.barW / 2} y={bar.bodyTop}
                                        width={bar.barW} height={bar.bodyHeight}
                                        fill={bar.isGreen ? '#22c55e' : '#ef4444'}
                                        rx="0.5" />
                                </>
                            )}
                        </For>
                    </svg>
                )}
            </Show>
        </div>
    );
}

// ─── Order Book Component ──────────────────────────────────────────────────

function OrderBook(props: { bids: OrderBookEntry[], asks: OrderBookEntry[], lastPrice: number }) {
    const maxBidAmt = createMemo(() => Math.max(...(props.bids.map(b => b.amount) || [1]), 1));
    const maxAskAmt = createMemo(() => Math.max(...(props.asks.map(a => a.amount) || [1]), 1));

    return (
        <div class="dex-orderbook">
            <div class="dex-ob-header">
                <span>Price (USDT)</span>
                <span>Amount (VCN)</span>
            </div>
            {/* Asks (sells) - reversed so lowest ask is at bottom */}
            <div class="dex-ob-asks">
                <For each={[...(props.asks || [])].reverse().slice(0, 10)}>
                    {(ask) => (
                        <div class="dex-ob-row dex-ob-ask">
                            <div class="dex-ob-depth" style={{ width: `${(ask.amount / maxAskAmt()) * 100}%` }} />
                            <span class="dex-ob-price">{formatNum(ask.price)}</span>
                            <span class="dex-ob-amount">{formatK(ask.amount)}</span>
                        </div>
                    )}
                </For>
            </div>
            {/* Spread / Last Price */}
            <div class="dex-ob-spread">
                <span class="dex-ob-last-price">{formatNum(props.lastPrice)}</span>
                <span class="dex-ob-spread-label">Last Price</span>
            </div>
            {/* Bids (buys) */}
            <div class="dex-ob-bids">
                <For each={(props.bids || []).slice(0, 10)}>
                    {(bid) => (
                        <div class="dex-ob-row dex-ob-bid">
                            <div class="dex-ob-depth" style={{ width: `${(bid.amount / maxBidAmt()) * 100}%` }} />
                            <span class="dex-ob-price">{formatNum(bid.price)}</span>
                            <span class="dex-ob-amount">{formatK(bid.amount)}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

// ─── Trade Log Component ───────────────────────────────────────────────────

function TradeLog(props: { trades: Trade[] }) {
    return (
        <div class="dex-tradelog">
            <div class="dex-tradelog-header">
                <span>Price</span>
                <span>Amount</span>
                <span>Time</span>
            </div>
            <div class="dex-tradelog-body">
                <For each={(props.trades || []).slice(0, 20)}>
                    {(trade) => (
                        <div class={`dex-tradelog-row ${trade.takerSide === 'buy' ? 'dex-trade-buy' : 'dex-trade-sell'}`}
                            title={trade.reasoning || ''}>
                            <span class="dex-tl-price">{formatNum(trade.price)}</span>
                            <span class="dex-tl-amount">{formatK(trade.amount)}</span>
                            <span class="dex-tl-time">{timeAgo(trade.timestamp)}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
}

// ─── Leaderboard Component ─────────────────────────────────────────────────

function Leaderboard(props: { entries: LeaderboardEntry[] }) {
    return (
        <div class="dex-leaderboard">
            <For each={(props.entries || []).slice(0, 10)}>
                {(entry) => (
                    <div class="dex-lb-row">
                        <div class="dex-lb-rank">
                            <Show when={entry.rank <= 3} fallback={<span class="dex-lb-rank-num">{entry.rank}</span>}>
                                <span class={`dex-lb-medal dex-lb-medal-${entry.rank}`}>
                                    {entry.rank === 1 ? 'I' : entry.rank === 2 ? 'II' : 'III'}
                                </span>
                            </Show>
                        </div>
                        <div class="dex-lb-info">
                            <span class="dex-lb-name">{entry.agentName}</span>
                            <span class="dex-lb-strat">{entry.strategyPreset}</span>
                        </div>
                        <div class={`dex-lb-pnl ${entry.pnlPercent >= 0 ? 'dex-pnl-pos' : 'dex-pnl-neg'}`}>
                            {entry.pnlPercent >= 0 ? '+' : ''}{entry.pnlPercent.toFixed(2)}%
                        </div>
                    </div>
                )}
            </For>
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
    const [selectedInterval, setSelectedInterval] = createSignal('1h');
    const [loading, setLoading] = createSignal(true);
    const [lastUpdate, setLastUpdate] = createSignal(Date.now());

    let pollTimer: any;

    async function fetchAll() {
        try {
            const [mkt, ob, trd, cnd, lb] = await Promise.all([
                apiCall('getMarket'),
                apiCall('getOrderBook'),
                apiCall('getRecentTrades', { limit: 30 }),
                apiCall('getCandles', { interval: selectedInterval(), limit: 100 }),
                apiCall('getLeaderboard', { limit: 10 }),
            ]);

            if (mkt.success && mkt.market) setMarket(mkt.market);
            if (ob.success) { setBids(ob.bids || []); setAsks(ob.asks || []); }
            if (trd.success) setTrades(trd.trades || []);
            if (cnd.success) setCandles(cnd.candles || []);
            if (lb.success) setLeaderboard(lb.leaderboard || []);

            setLastUpdate(Date.now());
            setLoading(false);
        } catch (e) {
            console.error('[TradingTerminal] Fetch error:', e);
        }
    }

    onMount(() => {
        fetchAll();
        pollTimer = setInterval(fetchAll, 10000); // refresh every 10s
    });

    onCleanup(() => {
        if (pollTimer) clearInterval(pollTimer);
    });

    const priceUp = createMemo(() => {
        const m = market();
        return m ? m.lastPrice >= m.previousPrice : true;
    });

    const intervals = ['1m', '5m', '15m', '1h', '4h', '1d'];

    return (
        <div class="dex-terminal">
            {/* Top Bar */}
            <header class="dex-topbar">
                <div class="dex-topbar-left">
                    <h1 class="dex-pair-title">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <circle cx="10" cy="10" r="8" stroke="url(#vcnGrad)" stroke-width="2" />
                            <text x="10" y="13" text-anchor="middle" fill="url(#vcnGrad)" font-size="8" font-weight="bold">V</text>
                            <defs><linearGradient id="vcnGrad" x1="0" y1="0" x2="20" y2="20"><stop stop-color="#818cf8" /><stop offset="1" stop-color="#6366f1" /></linearGradient></defs>
                        </svg>
                        VCN/USDT
                    </h1>
                    <Show when={market()}>
                        {(m) => (
                            <div class="dex-topbar-stats">
                                <span class={`dex-price-main ${priceUp() ? 'dex-green' : 'dex-red'}`}>
                                    {formatNum(m().lastPrice)}
                                </span>
                                <span class={`dex-change ${m().changePercent24h >= 0 ? 'dex-green' : 'dex-red'}`}>
                                    {m().changePercent24h >= 0 ? '+' : ''}{m().changePercent24h?.toFixed(2)}%
                                </span>
                                <div class="dex-stat-group">
                                    <div class="dex-stat"><span class="dex-stat-label">24h High</span><span>{formatNum(m().high24h)}</span></div>
                                    <div class="dex-stat"><span class="dex-stat-label">24h Low</span><span>{formatNum(m().low24h)}</span></div>
                                    <div class="dex-stat"><span class="dex-stat-label">Volume</span><span>{formatK(m().volume24h)}</span></div>
                                    <div class="dex-stat"><span class="dex-stat-label">Trades</span><span>{formatK(m().trades24h)}</span></div>
                                    <div class="dex-stat"><span class="dex-stat-label">Agents</span><span>{m().activeAgents}/{m().totalAgents}</span></div>
                                </div>
                            </div>
                        )}
                    </Show>
                </div>
                <div class="dex-topbar-right">
                    <button class="dex-btn-refresh" onClick={fetchAll} title="Refresh">
                        <RefreshIcon />
                    </button>
                </div>
            </header>

            {/* Main Grid */}
            <div class="dex-grid">
                {/* Left: Chart + Trades */}
                <div class="dex-col-chart">
                    <div class="dex-panel">
                        <div class="dex-panel-header">
                            <div class="dex-panel-title"><ChartIcon /> Chart</div>
                            <div class="dex-interval-tabs">
                                <For each={intervals}>
                                    {(iv) => (
                                        <button
                                            class={`dex-interval-btn ${selectedInterval() === iv ? 'active' : ''}`}
                                            onClick={() => { setSelectedInterval(iv); apiCall('getCandles', { interval: iv, limit: 100 }).then(r => r.success && setCandles(r.candles || [])); }}
                                        >{iv}</button>
                                    )}
                                </For>
                            </div>
                        </div>
                        <CandlestickChart candles={candles()} />
                    </div>
                    <div class="dex-panel dex-panel-trades">
                        <div class="dex-panel-header">
                            <div class="dex-panel-title">
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12l3-4 2 2 3-5 2 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
                                Recent Trades
                            </div>
                        </div>
                        <TradeLog trades={trades()} />
                    </div>
                </div>

                {/* Center: Order Book */}
                <div class="dex-col-book">
                    <div class="dex-panel dex-panel-full">
                        <div class="dex-panel-header">
                            <div class="dex-panel-title"><BookIcon /> Order Book</div>
                            <Show when={market()}>
                                {(m) => <span class="dex-spread-badge">Spread: {m().spreadPercent?.toFixed(3)}%</span>}
                            </Show>
                        </div>
                        <OrderBook bids={bids()} asks={asks()} lastPrice={market()?.lastPrice || 0} />
                    </div>
                </div>

                {/* Right: Leaderboard + Agent Info */}
                <div class="dex-col-agents">
                    <div class="dex-panel">
                        <div class="dex-panel-header">
                            <div class="dex-panel-title"><TrophyIcon /> Leaderboard</div>
                        </div>
                        <Leaderboard entries={leaderboard()} />
                    </div>
                    <div class="dex-panel dex-panel-engine">
                        <div class="dex-panel-header">
                            <div class="dex-panel-title"><AgentIcon /> Engine Status</div>
                        </div>
                        <Show when={market()}>
                            {(m) => (
                                <div class="dex-engine-info">
                                    <div class="dex-engine-row">
                                        <span>Active Agents</span>
                                        <span class="dex-engine-val">{m().activeAgents}</span>
                                    </div>
                                    <div class="dex-engine-row">
                                        <span>Open Orders</span>
                                        <span class="dex-engine-val">{m().openOrders}</span>
                                    </div>
                                    <div class="dex-engine-row">
                                        <span>Bid/Ask Spread</span>
                                        <span class="dex-engine-val">{m().spreadPercent?.toFixed(3)}%</span>
                                    </div>
                                    <div class="dex-engine-row">
                                        <span>24h Volume</span>
                                        <span class="dex-engine-val">${formatK(m().quoteVolume24h)}</span>
                                    </div>
                                    <div class="dex-engine-status">
                                        <div class="dex-status-dot" />
                                        <span>Engine Running</span>
                                    </div>
                                </div>
                            )}
                        </Show>
                    </div>
                </div>
            </div>

            {/* Loading overlay */}
            <Show when={loading()}>
                <div class="dex-loading">
                    <div class="dex-spinner" />
                    <span>Connecting to VisionDEX...</span>
                </div>
            </Show>
        </div>
    );
}
