import { createSignal, createEffect, onMount, onCleanup, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit, onSnapshot } from 'firebase/firestore';

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
    mmConfig?: {
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

interface MMSettings {
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

export default function MMAdminDashboard() {
    const [mmAgents, setMMAgents] = createSignal<MMAgent[]>([]);
    const [market, setMarket] = createSignal<MarketData | null>(null);
    const [mmSettings, setMMSettings] = createSignal<MMSettings | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [killSwitch, setKillSwitch] = createSignal(false);
    const [saving, setSaving] = createSignal(false);

    const db = getAdminFirebaseDb();

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
                    setMMSettings(data.settings as MMSettings);
                    setKillSwitch(data.settings.riskConfig?.killSwitchEnabled || false);
                }
            }
        } catch (e) {
            console.error('[MMAdmin] Load error:', e);
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
            await setDoc(doc(db, 'dex/config/mm-settings/current'), {
                riskConfig: { killSwitchEnabled: newState },
                updatedAt: new Date(),
                updatedBy: getAdminFirebaseAuth().currentUser?.email || 'unknown',
            }, { merge: true });
            setKillSwitch(newState);
        } catch (e) {
            console.error('[MMAdmin] Kill switch error:', e);
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

    const totalPnL = createMemo(() => mmAgents().reduce((s, a) => s + (a.performance?.totalPnL || 0), 0));
    const totalTrades = createMemo(() => mmAgents().reduce((s, a) => s + (a.performance?.totalTrades || 0), 0));

    return (
        <div class="mmd-root">
            {/* Page Header */}
            <div class="mmd-page-header">
                <div>
                    <h1 class="mmd-title">MM Dashboard</h1>
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
                        <div class="mmd-stat-value">${fmt(mmSettings()?.priceDirection?.targetPrice || market()?.lastPrice || 0.10)}</div>
                        <div class="mmd-stat-meta">
                            {mmSettings()?.priceDirection?.mode || 'Not Set'}
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
                        <div class="mmd-stat-value mmd-stat-phase">{mmSettings()?.priceDirection?.phase || 'Ranging'}</div>
                        <div class="mmd-stat-meta">
                            Bias: {mmSettings()?.priceDirection?.trendBias?.toFixed(2) || '0.00'}
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

                {/* MM Agents */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title">Market Maker Agents</h2>
                    <div class="mmd-agents-grid">
                        <For each={mmAgents()} fallback={
                            <div class="mmd-empty">
                                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                    <rect x="4" y="8" width="32" height="24" rx="4" stroke="rgba(245,158,11,0.3)" stroke-width="2" />
                                    <path d="M12 20h16" stroke="rgba(245,158,11,0.2)" stroke-width="2" stroke-linecap="round" />
                                </svg>
                                <p>No Market Maker agents found</p>
                                <span>Click Initialize to create MM Alpha and MM Beta agents</span>
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
                                                <span class={agent.mmConfig?.trendBias && agent.mmConfig.trendBias > 0 ? 'up' : agent.mmConfig?.trendBias && agent.mmConfig.trendBias < 0 ? 'dn' : ''}>
                                                    {agent.mmConfig?.trendBias?.toFixed(2) || '0.00'}
                                                    {agent.mmConfig?.trendBias && agent.mmConfig.trendBias > 0 ? ' (Bullish)' : agent.mmConfig?.trendBias && agent.mmConfig.trendBias < 0 ? ' (Bearish)' : ' (Neutral)'}
                                                </span>
                                            </div>
                                            <div class="mmd-agent-row">
                                                <span>Spread</span>
                                                <span>{agent.mmConfig?.spreadPercent?.toFixed(2) || '0.50'}%</span>
                                            </div>
                                            <div class="mmd-agent-row">
                                                <span>Layers</span>
                                                <span>{agent.mmConfig?.layerCount || 5} x {agent.mmConfig?.layerSpacing?.toFixed(1) || '0.3'}%</span>
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
                            <span class="mmd-market-val">${fmt(mmSettings()?.priceDirection?.priceFloor || 0.05)}</span>
                        </div>
                        <div class="mmd-market-item">
                            <span class="mmd-market-label">Price Ceiling</span>
                            <span class="mmd-market-val">${fmt(mmSettings()?.priceDirection?.priceCeiling || 0.50)}</span>
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

                @keyframes killBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
