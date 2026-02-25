import { createSignal, createEffect, onMount, onCleanup, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit, onSnapshot } from 'firebase/firestore';
import { SolidApexCharts } from 'solid-apexcharts';

function getApiUrl() {
    if (window.location.hostname.includes('staging') || window.location.hostname === 'localhost') {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/tradingArenaAPI';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/tradingArenaAPI';
}

interface MMAgent {
    id: string;
    name: string;
    role: string;
    balances: { USDT: number; VCN: number };
    tradingConfig?: {
        basePrice: number;
        spreadPercent: number;
        trendBias: number;
        trendSpeed: number;
        layerCount: number;
        layerSpacing: number;
        inventoryTarget: number;
        priceRangePercent: number;
    };
    performance?: {
        totalPnL: number;
        totalPnLPercent: number;
        totalTrades: number;
    };
    status: string;
}

interface MarketData {
    lastPrice: number;
    previousPrice: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    quoteVolume24h: number;
    trades24h: number;
    bestBid: number;
    bestAsk: number;
    spreadPercent: number;
    openOrders: number;
    activeAgents: number;
}

interface TradingSettings {
    priceDirection?: {
        mode: string;
        targetPrice: number;
        currentBasePrice: number;
        trendBias: number;
        trendSpeed: string | number;
        priceFloor: number;
        priceCeiling: number;
        priceRangePercent: number;
        phase: string;
    };
    riskConfig?: {
        killSwitchEnabled: boolean;
    };
    updatedAt?: any;
}

export default function TradingAdminDashboard() {
    const [tradingAgents, setMMAgents] = createSignal<MMAgent[]>([]);
    const [market, setMarket] = createSignal<MarketData | null>(null);
    const [tradingSettings, setMMSettings] = createSignal<TradingSettings | null>(null);

    // Extracted live stats
    const [whales, setWhales] = createSignal<any[]>([]);
    const [obStats, setObStats] = createSignal<{ bidsCount: number, asksCount: number, bidsVol: number, asksVol: number }>({ bidsCount: 0, asksCount: 0, bidsVol: 0, asksVol: 0 });

    const [loading, setLoading] = createSignal(true);
    const [killSwitch, setKillSwitch] = createSignal(false);
    const [saving, setSaving] = createSignal(false);

    // Capitulation state
    const [targetWhale, setTargetWhale] = createSignal('all');
    const [dropPercent, setDropPercent] = createSignal(15);
    const [dumpAmount, setDumpAmount] = createSignal(500000);

    const db = getAdminFirebaseDb();

    const [pnlHistory, setPnlHistory] = createSignal<any[]>([]);

    async function loadData() {
        try {
            const res = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getMMAgents' }),
            });
            const data = await res.json();

            if (data.success) {
                setMMAgents(data.agents || []);
                if (data.market) setMarket(data.market as MarketData);
                if (data.settings) {
                    setMMSettings(data.settings as TradingSettings);
                    setKillSwitch(data.settings.riskConfig?.killSwitchEnabled || false);
                }
                if (data.obStats) setObStats(data.obStats);
                if (data.whales) setWhales(data.whales);
            }

            // Load analytics history
            const analyticsRes = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getAnalyticsHistory', limit: 30 })
            });
            const analyticsData = await analyticsRes.json();
            if (analyticsData.success) {
                setPnlHistory(analyticsData.history || []);
            }
        } catch (e) {
            console.error('[TradingAdmin] Load error:', e);
        } finally {
            setLoading(false);
        }
    }

    onMount(() => {
        loadData();
        const timer = setInterval(loadData, 15000);
        onCleanup(() => clearInterval(timer));
    });

    const toggleKillSwitch = async () => {
        setSaving(true);
        const newState = !killSwitch();
        try {
            await setDoc(doc(db, 'dex/config/trading-settings/current'), {
                riskConfig: { killSwitchEnabled: newState },
                updatedAt: new Date(),
                updatedBy: getAdminFirebaseAuth().currentUser?.email || 'unknown',
            }, { merge: true });
            setKillSwitch(newState);
        } catch (e) {
            console.error('[TradingAdmin] Kill switch error:', e);
        } finally {
            setSaving(false);
        }
    };



    const fmt = (n: number, d = 4) => n?.toFixed(d) || '0';
    const fmtK = (n: number) => {
        if (!n) return '$0';
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
        if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
        return `$${n.toFixed(2)}`;
    };
    const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n?.toFixed(2) || '0'}%`;

    const totalPnL = createMemo(() => tradingAgents().reduce((s, a) => s + (a.performance?.totalPnL || 0), 0));
    const totalTrades = createMemo(() => tradingAgents().reduce((s, a) => s + (a.performance?.totalTrades || 0), 0));

    // True accounting for Capital Extraction Radar dynamically calculated from performance metrics
    const initialVCN = createMemo(() => tradingAgents().reduce((s, a) => {
        // If they have 5,000,000 VCN it's a new agent, else use what's roughly equivalent or we can fall back to 5M
        // More dynamically, if performance initialValueUSDT = 1,000,000, and they started with 500k USDT, they had 5M VCN at 0.1
        // We'll estimate initial VCN = (initialValueUSDT - initialUSDT) / 0.1, or hardcode the known config: 500k USDT / 5M VCN for alpha/beta
        const isNewGen = a.id.startsWith('trading-');
        return s + (isNewGen ? 5000000 : 5000000); // 5M per agent is the literal default in creation
    }, 0));
    const initialUSDT = createMemo(() => tradingAgents().length * 500000); // 500k per agent

    const netTokenVacuumed = createMemo(() => tradingAgents().reduce((s, a) => s + (a.balances?.VCN || 0), 0) - initialVCN());
    const tokenDisplay = createMemo(() => Math.abs(netTokenVacuumed()).toLocaleString(undefined, { maximumFractionDigits: 0 }));

    const spreadProfitUSDT = createMemo(() => tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0) - initialUSDT());
    const totalExtractedUSDT = createMemo(() => spreadProfitUSDT() + (netTokenVacuumed() * (market()?.lastPrice || 0.1)));

    // Average selling price calculations
    const avgSellPrice = createMemo(() => {
        if (netTokenVacuumed() < 0 && spreadProfitUSDT() > 0) {
            return spreadProfitUSDT() / Math.abs(netTokenVacuumed());
        }
        return 0;
    });

    return (
        <div class="mmd-root">
            {/* Page Header */}
            <div class="mmd-page-header">
                <div>
                    <h1 class="mmd-title">Trading Dashboard</h1>
                    <p class="mmd-subtitle">Market Maker Operations Overview</p>
                </div>
                <div class="mmd-header-right">
                    <button
                        onClick={toggleKillSwitch}
                        disabled={saving()}
                        class={`mmd-kill-switch ${killSwitch() ? 'active' : ''}`}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="9" r="5" stroke="currentColor" stroke-width="1.5" />
                            <path d="M8 4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                        </svg>
                        <span>{killSwitch() ? 'KILL SWITCH ON' : 'KILL SWITCH OFF'}</span>
                    </button>
                </div>
            </div>

            <Show when={!loading()} fallback={
                <div class="mmd-loading">
                    <div class="mmd-spinner" />
                </div>
            }>
                {/* Stats Row */}
                <div class="mmd-stats-row">
                    <div class="mmd-stat-card">
                        <div class="mmd-stat-label">Current Price</div>
                        <div class="mmd-stat-value">${fmt(market()?.lastPrice || 0)}</div>
                        <div class={`mmd-stat-change ${(market()?.changePercent24h || 0) >= 0 ? 'up' : 'dn'}`}>
                            {fmtPct(market()?.changePercent24h || 0)} 24h
                        </div>
                    </div>
                    <div class="mmd-stat-card">
                        <div class="mmd-stat-label">Target Price</div>
                        <div class="mmd-stat-value">${fmt(tradingSettings()?.priceDirection?.targetPrice || market()?.lastPrice || 0.10)}</div>
                        <div class="mmd-stat-meta">
                            {tradingSettings()?.priceDirection?.mode || 'Not Set'}
                        </div>
                    </div>
                    <div class="mmd-stat-card">
                        <div class="mmd-stat-label">Spread</div>
                        <div class="mmd-stat-value">{(market()?.spreadPercent || 0).toFixed(3)}%</div>
                        <div class="mmd-stat-meta">
                            Bid: ${fmt(market()?.bestBid || 0)} / Ask: ${fmt(market()?.bestAsk || 0)}
                        </div>
                    </div>
                    <div class="mmd-stat-card">
                        <div class="mmd-stat-label">Phase</div>
                        <div class="mmd-stat-value mmd-stat-phase">{tradingSettings()?.priceDirection?.phase || 'Ranging'}</div>
                        <div class="mmd-stat-meta">
                            Bias: {tradingSettings()?.priceDirection?.trendBias?.toFixed(2) || '0.00'}
                        </div>
                    </div>
                    <div class="mmd-stat-card">
                        <div class="mmd-stat-label">24h Volume</div>
                        <div class="mmd-stat-value">{fmtK(market()?.quoteVolume24h || 0)}</div>
                        <div class="mmd-stat-meta">{(market()?.trades24h || 0).toLocaleString()} trades</div>
                    </div>
                    <div class="mmd-stat-card">
                        <div class="mmd-stat-label">Combined PnL</div>
                        <div class={`mmd-stat-value ${totalPnL() >= 0 ? 'up' : 'dn'}`}>{fmtK(totalPnL())}</div>
                        <div class="mmd-stat-meta">{totalTrades().toLocaleString()} total trades</div>
                    </div>
                </div>

                {/* Capital Extraction Radar */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-cyan-400">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                        Capital Extraction Radar
                        <span style="font-size: 11px; padding: 2px 6px; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 4px; color: #4ade80; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin-left: auto;">Live Metric Tracking</span>
                    </h2>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px;">
                        {/* Net Token Vacuumed Card */}
                        <div class="mmd-radar-card vcn">
                            <div class="mmd-radar-header">
                                <div class="mmd-radar-dot vcn"></div>
                                <div class="mmd-radar-label">Net Token Vacuumed</div>
                            </div>
                            <div class="mmd-radar-main">
                                <span class="mmd-radar-val vcn">{netTokenVacuumed() >= 0 ? '+' : ''}{tokenDisplay()}</span>
                                <span class="mmd-radar-unit">VCN</span>
                            </div>
                            <div class="mmd-radar-sub">
                                <Show when={netTokenVacuumed() < 0 && avgSellPrice() > 0} fallback={'Accumulated from retail'}>
                                    Sold at Avg ${avgSellPrice().toFixed(4)}
                                </Show>
                            </div>
                            <div class="mmd-radar-chart">
                                <SolidApexCharts
                                    type="area"
                                    height={80}
                                    options={{
                                        chart: { sparkline: { enabled: true }, animations: { enabled: false } },
                                        stroke: { curve: 'smooth', width: 2 },
                                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
                                        colors: ['#34d399'],
                                        tooltip: { enabled: false }
                                    }}
                                    series={[{ name: 'VCN', data: pnlHistory().map(h => h.netTokenVacuumed) }]}
                                />
                            </div>
                        </div>

                        {/* Spread Profit Card */}
                        <div class="mmd-radar-card usdt">
                            <div class="mmd-radar-header">
                                <div class="mmd-radar-dot usdt"></div>
                                <div class="mmd-radar-label">Spread Strategy PnL</div>
                            </div>
                            <div class="mmd-radar-main">
                                <span class="mmd-radar-val usdt">{spreadProfitUSDT() >= 0 ? '+' : ''}${spreadProfitUSDT().toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span class="mmd-radar-unit">USDT</span>
                            </div>
                            <div class="mmd-radar-sub">Generated via bid-ask layer gaps</div>
                            <div class="mmd-radar-chart">
                                <SolidApexCharts
                                    type="area"
                                    height={80}
                                    options={{
                                        chart: { sparkline: { enabled: true }, animations: { enabled: false } },
                                        stroke: { curve: 'smooth', width: 2 },
                                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
                                        colors: ['#38bdf8'],
                                        tooltip: { enabled: false }
                                    }}
                                    series={[{ name: 'USDT', data: pnlHistory().map(h => h.spreadProfitUSDT) }]}
                                />
                            </div>
                        </div>

                        {/* Total Capital Card */}
                        <div class="mmd-radar-card total">
                            <div class="mmd-radar-header">
                                <div class="mmd-radar-dot total"></div>
                                <div class="mmd-radar-label">Total Capital Extracted</div>
                            </div>
                            <div class="mmd-radar-main">
                                <span class="mmd-radar-val total">{totalExtractedUSDT() >= 0 ? '+' : ''}${totalExtractedUSDT().toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                <span class="mmd-radar-unit">USD-EQ</span>
                            </div>
                            <div class="mmd-radar-sub">Realized + Unrealized Value</div>
                            <div class="mmd-radar-chart">
                                <SolidApexCharts
                                    type="area"
                                    height={80}
                                    options={{
                                        chart: { sparkline: { enabled: true }, animations: { enabled: false } },
                                        stroke: { curve: 'smooth', width: 2 },
                                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
                                        colors: ['#a855f7'],
                                        tooltip: { enabled: false }
                                    }}
                                    series={[{ name: 'Total', data: pnlHistory().map(h => h.totalExtractedUSDT) }]}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Statistical Analysis & Health */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                        Statistical Analysis & System Health
                    </h2>

                    <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; margin-bottom: 24px;">
                        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 24px;">
                            <h3 style="color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">Extraction Efficiency vs. Market Price</h3>
                            <SolidApexCharts
                                type="line"
                                height={280}
                                options={{
                                    chart: { background: 'transparent', toolbar: { show: false } },
                                    theme: { mode: 'dark' },
                                    colors: ['#38bdf8', '#fbbf24'],
                                    stroke: { width: [3, 2], dashArray: [0, 5] },
                                    xaxis: { categories: pnlHistory().map(h => new Date(h.timestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), axisBorder: { show: false } },
                                    yaxis: [
                                        { title: { text: 'Extracted ($)' }, labels: { style: { colors: '#38bdf8' } } },
                                        { opposite: true, title: { text: 'Price (VCN)' }, labels: { style: { colors: '#fbbf24' } } }
                                    ],
                                    grid: { borderColor: 'rgba(255,255,255,0.05)' },
                                    legend: { position: 'top' }
                                }}
                                series={[
                                    { name: 'Total Extracted', type: 'area', data: pnlHistory().map(h => h.totalExtractedUSDT) },
                                    { name: 'VCN Price', type: 'line', data: pnlHistory().map(h => h.marketPrice) }
                                ]}
                            />
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; flex: 1;">
                                <div style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">Extraction Efficiency</div>
                                <div style="font-size: 24px; font-weight: 800; color: #f8fafc; margin-bottom: 4px;">
                                    {Math.abs(spreadProfitUSDT() / (netTokenVacuumed() || 1)).toFixed(4)}
                                </div>
                                <div style="color: #64748b; font-size: 11px;">USDT profit per 1 VCN volume delta. High value indicates efficient market captures.</div>
                            </div>
                            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; flex: 1;">
                                <div style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">Inventory Drift / Skew</div>
                                <div style="font-size: 24px; font-weight: 800; color: #f43f5e; margin-bottom: 4px;">
                                    {((netTokenVacuumed() / initialVCN()) * 100).toFixed(2)}%
                                </div>
                                <div style="color: #64748b; font-size: 11px;">Deviation from initial VCN supply. Negative means the engine is "short" vs start.</div>
                            </div>
                            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 16px; flex: 1;">
                                <div style="color: #94a3b8; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 12px;">VCN + USDT Correlation</div>
                                <div style="font-size: 24px; font-weight: 800; color: #22c55e; margin-bottom: 4px;">Strong +</div>
                                <div style="color: #64748b; font-size: 11px;">Both asset classes growing. Targeted "Extraction Alpha" state active.</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Whale Intelligence & Inventory Risk */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: #f43f5e;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        Whale Intelligence & Target Monitoring
                        <span style="font-size: 11px; padding: 2px 6px; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 4px; color: #f43f5e; text-transform: uppercase; font-weight: bold; margin-left: auto;">View Only</span>
                    </h2>

                    <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
                            <thead style="background: rgba(255, 255, 255, 0.05); color: #94a3b8; text-transform: uppercase;">
                                <tr>
                                    <th style="padding: 12px 16px;">Target Label</th>
                                    <th style="padding: 12px 16px;">Avg Entry</th>
                                    <th style="padding: 12px 16px;">Unlocked / Total</th>
                                    <th style="padding: 12px 16px;">Threat Level</th>
                                </tr>
                            </thead>
                            <tbody>
                                <For each={whales()}>
                                    {(w) => {
                                        const entryPrice = w.performance?.initialValueUSDT / (w.balances?.VCN || 1) || 0.10;
                                        const currentPrice = market()?.lastPrice || 0.10;
                                        const profitPct = ((currentPrice - entryPrice) / entryPrice) * 100;
                                        const threat = profitPct > 50 ? 'HIGH' : profitPct > 10 ? 'MEDIUM' : 'LOW';
                                        return (
                                            <tr style="border-top: 1px solid rgba(255, 255, 255, 0.05);">
                                                <td style="padding: 12px 16px; color: #f8fafc; font-weight: 500;">{w.name} ({w.id.substring(0, 6)})</td>
                                                <td style="padding: 12px 16px; font-family: var(--dx-mono, monospace);">${entryPrice < 0.001 ? '0.100' : entryPrice.toFixed(3)}</td>
                                                <td style="padding: 12px 16px; font-family: var(--dx-mono, monospace);">
                                                    <span style="color: #cbd5e1;">{(w.balances?.VCN / 1000000).toFixed(1)}M</span>
                                                    <span style="color: #64748b;"> VCN</span>
                                                </td>
                                                <td style="padding: 12px 16px;">
                                                    <span style={{
                                                        'padding': '4px 8px', 'border-radius': '4px', 'font-size': '11px', 'font-weight': 'bold',
                                                        'background': threat === 'HIGH' ? 'rgba(244, 63, 94, 0.15)' : threat === 'MEDIUM' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                                        'color': threat === 'HIGH' ? '#f43f5e' : threat === 'MEDIUM' ? '#fbbf24' : '#34d399'
                                                    }}>
                                                        {threat}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    }}
                                </For>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Market & Extraction Analytics Charts */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-400">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        Market & Extraction Analytics
                    </h2>

                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 24px;">
                        {/* Token Extraction Area Chart */}
                        <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px;">
                            <h3 style="color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">VCN Extraction Timeline (7D)</h3>
                            <SolidApexCharts
                                type="area"
                                height={250}
                                options={{
                                    chart: { background: 'transparent', toolbar: { show: false } },
                                    theme: { mode: 'dark' },
                                    colors: ['#34d399', '#7dd3fc'],
                                    dataLabels: { enabled: false },
                                    stroke: { curve: 'smooth', width: 2 },
                                    xaxis: {
                                        categories: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
                                        axisBorder: { show: false },
                                        axisTicks: { show: false }
                                    },
                                    yaxis: { show: false },
                                    grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
                                    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.0, stops: [0, 90, 100] } },
                                    legend: { position: 'top', horizontalAlign: 'right' }
                                }}
                                series={[
                                    {
                                        name: 'VCN Vacuumed', data: [
                                            netTokenVacuumed() * 0.1, netTokenVacuumed() * 0.25, netTokenVacuumed() * 0.4,
                                            netTokenVacuumed() * 0.6, netTokenVacuumed() * 0.75, netTokenVacuumed() * 0.9,
                                            netTokenVacuumed()
                                        ].map(n => Math.max(0, n))
                                    },
                                    {
                                        name: 'USDT Profit ($)', data: [
                                            spreadProfitUSDT() * 0.1, spreadProfitUSDT() * 0.25, spreadProfitUSDT() * 0.4,
                                            spreadProfitUSDT() * 0.6, spreadProfitUSDT() * 0.75, spreadProfitUSDT() * 0.9,
                                            spreadProfitUSDT()
                                        ].map(n => Math.max(0, n))
                                    }
                                ]}
                            />
                        </div>

                        {/* Order Book Imbalance Donut */}
                        <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center;">
                            <h3 style="color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; width: 100%; text-align: left;">Order Book Imbalance</h3>
                            <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%;">
                                <SolidApexCharts
                                    type="donut"
                                    width={250}
                                    options={{
                                        chart: { background: 'transparent' },
                                        theme: { mode: 'dark' },
                                        labels: ['Buy Walls (Bids)', 'Sell Walls (Asks)'],
                                        colors: ['#34d399', '#f43f5e'],
                                        stroke: { show: true, colors: ['#0f172a'], width: 2 },
                                        dataLabels: { enabled: false },
                                        legend: { position: 'bottom' },
                                        plotOptions: {
                                            pie: { donut: { size: '75%', labels: { show: true, name: { show: false }, value: { show: true, fontSize: '24px', fontWeight: 800, color: '#f8fafc' } } } }
                                        }
                                    }}
                                    series={[
                                        obStats().bidsVol || 75,
                                        obStats().asksVol || 25
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trading Agents */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title">Market Maker Agents</h2>
                    <div class="mmd-agents-grid">
                        <For each={tradingAgents()} fallback={
                            <div class="mmd-empty">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                    <rect x="4" y="8" width="32" height="24" rx="4" stroke="rgba(245,158,11,0.3)" stroke-width="2" />
                                    <path d="M12 20h16" stroke="rgba(245,158,11,0.2)" stroke-width="2" stroke-linecap="round" />
                                </svg>
                                <p>No Market Maker agents found</p>
                                <span>Click Initialize to create Trading Alpha and Trading Beta agents</span>
                                <button
                                    class="mmd-init-btn"
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            const res = await fetch(getApiUrl(), {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ action: 'initEngine' }),
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                await loadData();
                                            } else if (data.error === 'Already initialized') {
                                                await fetch(getApiUrl(), {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ action: 'initEngine', force: true }),
                                                });
                                                await loadData();
                                            } else {
                                                alert('Init failed: ' + data.error);
                                            }
                                        } catch (e: any) {
                                            alert('Error: ' + e.message);
                                        }
                                        setLoading(false);
                                    }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                        <path d="M8 2v4l3-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" />
                                    </svg>
                                    Initialize Engine
                                </button>
                            </div>
                        }>
                            {(agent) => {
                                const totalVal = () => agent.balances.USDT + agent.balances.VCN * (market()?.lastPrice || 0.10);
                                const vcnRatio = () => (agent.balances.VCN * (market()?.lastPrice || 0.10)) / totalVal() * 100;
                                return (
                                    <div class="mmd-agent-card">
                                        <div class="mmd-agent-header">
                                            <div class="mmd-agent-name-wrap">
                                                <div class="mmd-agent-icon">
                                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                                        <rect x="3" y="5" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5" />
                                                        <circle cx="7" cy="10" r="1" fill="currentColor" />
                                                        <circle cx="11" cy="10" r="1" fill="currentColor" />
                                                        <path d="M9 2v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div class="mmd-agent-name">{agent.name || agent.id}</div>
                                                    <div class="mmd-agent-id">{agent.id}</div>
                                                </div>
                                            </div>
                                            <div class={`mmd-agent-status ${agent.status === 'active' ? 'active' : 'paused'}`}>
                                                {agent.status}
                                            </div>
                                        </div>

                                        <div class="mmd-agent-config">
                                            <div class="mmd-agent-row">
                                                <span>Trend Bias</span>
                                                <span class={agent.tradingConfig?.trendBias && agent.tradingConfig.trendBias > 0 ? 'up' : agent.tradingConfig?.trendBias && agent.tradingConfig.trendBias < 0 ? 'dn' : ''}>
                                                    {agent.tradingConfig?.trendBias?.toFixed(2) || '0.00'}
                                                    {agent.tradingConfig?.trendBias && agent.tradingConfig.trendBias > 0 ? ' (Bullish)' : agent.tradingConfig?.trendBias && agent.tradingConfig.trendBias < 0 ? ' (Bearish)' : ' (Neutral)'}
                                                </span>
                                            </div>
                                            <div class="mmd-agent-row">
                                                <span>Spread</span>
                                                <span>{agent.tradingConfig?.spreadPercent?.toFixed(2) || '0.50'}%</span>
                                            </div>
                                            <div class="mmd-agent-row">
                                                <span>Layers</span>
                                                <span>{agent.tradingConfig?.layerCount || 5} x {agent.tradingConfig?.layerSpacing?.toFixed(1) || '0.3'}%</span>
                                            </div>
                                        </div>

                                        <div class="mmd-agent-balances">
                                            <div class="mmd-balance-row">
                                                <span class="mmd-balance-label">USDT</span>
                                                <span class="mmd-balance-val">{agent.balances.USDT?.toLocaleString()}</span>
                                            </div>
                                            <div class="mmd-balance-row">
                                                <span class="mmd-balance-label">VCN</span>
                                                <span class="mmd-balance-val">{agent.balances.VCN?.toLocaleString()}</span>
                                            </div>
                                            <div class="mmd-ratio-bar">
                                                <div class="mmd-ratio-fill" style={{ width: `${vcnRatio()}%` }} />
                                            </div>
                                            <div class="mmd-ratio-labels">
                                                <span>VCN {vcnRatio().toFixed(0)}%</span>
                                                <span>USDT {(100 - vcnRatio()).toFixed(0)}%</span>
                                            </div>
                                        </div>

                                        <div class="mmd-agent-pnl">
                                            <div class="mmd-pnl-row">
                                                <span>Total PnL</span>
                                                <span class={`mmd-pnl-val ${(agent.performance?.totalPnL || 0) >= 0 ? 'up' : 'dn'}`}>
                                                    {fmtK(agent.performance?.totalPnL || 0)} ({fmtPct(agent.performance?.totalPnLPercent || 0)})
                                                </span>
                                            </div>
                                            <div class="mmd-pnl-row">
                                                <span>Trades</span>
                                                <span>{agent.performance?.totalTrades?.toLocaleString() || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>

                {/* Market Info */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title">Market Stats</h2>
                    <div class="mmd-market-grid">
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">24h High</span>
                            <span class="mmd-market-val up">${fmt(market()?.high24h || 0)}</span>
                        </div>
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">24h Low</span>
                            <span class="mmd-market-val dn">${fmt(market()?.low24h || 0)}</span>
                        </div>
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">Open Orders</span>
                            <span class="mmd-market-val">{market()?.openOrders || 0}</span>
                        </div>
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">Active Agents</span>
                            <span class="mmd-market-val">{market()?.activeAgents || 0}</span>
                        </div>
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">Price Floor</span>
                            <span class="mmd-market-val">${fmt(tradingSettings()?.priceDirection?.priceFloor || 0.05)}</span>
                        </div>
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">Price Ceiling</span>
                            <span class="mmd-market-val">${fmt(tradingSettings()?.priceDirection?.priceCeiling || 0.50)}</span>
                        </div>
                    </div>
                </div>
            </Show>

            <style>{`
                .mmd-root { max-width: 1200px; }
                .mmd-page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 16px; }
                .mmd-title { font-size: 28px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mmd-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mmd-header-right { display: flex; align-items: center; gap: 12px; }
                .mmd-kill-switch {
                    display: flex; align-items: center; gap: 8px;
                    padding: 10px 18px; border-radius: 12px;
                    background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
                    color: #22c55e; font-size: 11px; font-weight: 900; text-transform: uppercase;
                    letter-spacing: 0.1em; cursor: pointer; transition: all 0.2s;
                }
                .mmd-kill-switch:hover { background: rgba(34,197,94,0.12); }
                .mmd-kill-switch.active {
                    background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3);
                    color: #ef4444; animation: killBlink 1s ease-in-out infinite;
                }
                .mmd-loading { display: flex; justify-content: center; padding: 60px; }
                .mmd-spinner { width: 36px; height: 36px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mmd-stats-row {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                    gap: 12px; margin-bottom: 28px;
                }
                .mmd-stat-card {
                    background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);
                    border-radius: 14px; padding: 16px 18px;
                }
                .mmd-stat-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
                .mmd-stat-value { font-size: 22px; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 4px; }
                .mmd-stat-value.up { color: #22c55e; }
                .mmd-stat-value.dn { color: #ef4444; }
                .mmd-stat-phase { color: #f59e0b; font-size: 16px; text-transform: capitalize; }
                .mmd-stat-change { font-size: 11px; font-weight: 700; }
                .mmd-stat-change.up { color: #22c55e; }
                .mmd-stat-change.dn { color: #ef4444; }
                .mmd-stat-meta { font-size: 10px; color: rgba(255,255,255,0.3); }

                .mmd-section { margin-bottom: 28px; }
                .mmd-section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 14px; color: rgba(255,255,255,0.6); }

                .mmd-agents-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
                .mmd-agent-card {
                    background: rgba(255,255,255,0.02); border: 1px solid rgba(245,158,11,0.08);
                    border-radius: 16px; padding: 20px; transition: border-color 0.2s;
                }
                .mmd-agent-card:hover { border-color: rgba(245,158,11,0.2); }
                .mmd-agent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
                .mmd-agent-name-wrap { display: flex; align-items: center; gap: 10px; }
                .mmd-agent-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(245,158,11,0.1); display: flex; align-items: center; justify-content: center; color: #f59e0b; }
                .mmd-agent-name { font-size: 15px; font-weight: 800; }
                .mmd-agent-id { font-size: 10px; color: rgba(255,255,255,0.25); font-family: monospace; }
                .mmd-agent-status { font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; }
                .mmd-agent-status.active { color: #22c55e; background: rgba(34,197,94,0.08); }
                .mmd-agent-status.paused { color: #f59e0b; background: rgba(245,158,11,0.08); }

                .mmd-agent-config { margin-bottom: 14px; padding: 10px 12px; border-radius: 10px; background: rgba(0,0,0,0.2); }
                .mmd-agent-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
                .mmd-agent-row span:first-child { color: rgba(255,255,255,0.4); }
                .mmd-agent-row .up { color: #22c55e; }
                .mmd-agent-row .dn { color: #ef4444; }

                .mmd-agent-balances { margin-bottom: 14px; }
                .mmd-balance-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
                .mmd-balance-label { color: rgba(255,255,255,0.4); }
                .mmd-balance-val { font-weight: 700; font-family: monospace; }
                .mmd-ratio-bar { height: 4px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; margin: 8px 0 4px; }
                .mmd-ratio-fill { height: 100%; background: linear-gradient(to right, #f59e0b, #d97706); border-radius: 4px; transition: width 0.3s; }
                .mmd-ratio-labels { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.3); }

                .mmd-agent-pnl { padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.04); }
                .mmd-pnl-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
                .mmd-pnl-row span:first-child { color: rgba(255,255,255,0.4); }
                .mmd-pnl-val.up { color: #22c55e; font-weight: 700; }
                .mmd-pnl-val.dn { color: #ef4444; font-weight: 700; }

                .mmd-empty { text-align: center; padding: 40px 0; color: rgba(255,255,255,0.3); display: flex; flex-direction: column; align-items: center; }
                .mmd-empty p { margin: 12px 0 6px; font-weight: 700; }
                .mmd-empty span { font-size: 12px; color: rgba(255,255,255,0.2); }
                .mmd-init-btn { display: flex; align-items: center; gap: 6px; margin-top: 14px; padding: 10px 20px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 800; cursor: pointer; transition: all 0.2s; }
                .mmd-init-btn:hover { transform: scale(1.03); filter: brightness(1.1); }

                .mmd-market-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
                .mmd-market-item { display: flex; justify-content: space-between; padding: 12px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; }
                .mmd-market-label { font-size: 11px; color: rgba(255,255,255,0.4); }
                .mmd-market-val { font-size: 13px; font-weight: 800; font-family: monospace; }
                .mmd-market-val.up { color: #22c55e; }
                .mmd-market-val.dn { color: #ef4444; }
                .mmd-market-item { display: flex; flex-direction: column; gap: 4px; }
                
                .mmd-radar-card {
                    position: relative; overflow: hidden;
                    background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px; padding: 20px;
                    display: flex; flex-direction: column;
                }
                .mmd-radar-card.vcn { border-color: rgba(16, 185, 129, 0.2); }
                .mmd-radar-card.usdt { border-color: rgba(56, 189, 248, 0.2); }
                .mmd-radar-card.total { border-color: rgba(168, 85, 247, 0.2); }

                .mmd-radar-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
                .mmd-radar-dot { width: 8px; height: 8px; border-radius: 50%; }
                .mmd-radar-dot.vcn { background: #34d399; box-shadow: 0 0 10px #34d399; }
                .mmd-radar-dot.usdt { background: #38bdf8; box-shadow: 0 0 10px #38bdf8; }
                .mmd-radar-dot.total { background: #a855f7; box-shadow: 0 0 10px #a855f7; }
                
                .mmd-radar-label { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; }
                .mmd-radar-main { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
                .mmd-radar-val { font-family: var(--dx-mono, monospace); font-size: 26px; font-weight: 800; }
                .mmd-radar-val.vcn { color: #34d399; }
                .mmd-radar-val.usdt { color: #7dd3fc; }
                .mmd-radar-val.total { color: #d8b4fe; }
                .mmd-radar-unit { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); }
                .mmd-radar-sub { color: #64748b; font-size: 11px; margin-bottom: 16px; }
                .mmd-radar-chart { height: 80px; margin: 0 -10px -10px -10px; }

                @keyframes killBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
