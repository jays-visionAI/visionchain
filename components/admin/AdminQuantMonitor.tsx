import { createSignal, onMount, onCleanup, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb } from '../../services/firebaseService';
import { collection, query, orderBy, limit, onSnapshot, where, getDocs } from 'firebase/firestore';

interface AgentRow {
    id: string;
    userId: string;
    userEmail: string;
    strategyName: string;
    strategyId: string;
    tradingMode: string;
    exchange: string;
    status: string;
    selectedAssets: string[];
    seed: number;
    seedCurrency: string;
    totalValue: number;
    totalPnl: number;
    totalPnlPercent: number;
    totalTrades: number;
    winRate: number;
    cashBalance: number;
    riskProfile: string;
    riskStatus?: { pauseReason?: string; dailyPnl?: number; consecutiveLosses?: number };
    lastHeartbeatAt?: string;
    createdAt: string;
    updatedAt: string;
}

interface TradeRow {
    id: string;
    agentId: string;
    userId: string;
    asset: string;
    side: string;
    price: number;
    quantity: number;
    value: number;
    pnl: number;
    pnlPercent: number;
    fee: number;
    timestamp: string;
}

const AdminQuantMonitor = () => {
    const [agents, setAgents] = createSignal<AgentRow[]>([]);
    const [recentTrades, setRecentTrades] = createSignal<TradeRow[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [statusFilter, setStatusFilter] = createSignal<'all' | 'running' | 'paused' | 'stopped'>('all');
    const [modeFilter, setModeFilter] = createSignal<'all' | 'paper' | 'live'>('all');
    const [expandedAgent, setExpandedAgent] = createSignal<string | null>(null);

    const db = getAdminFirebaseDb();

    onMount(() => {
        // Subscribe to all agents
        const agentQ = query(collection(db, 'paperAgents'), orderBy('updatedAt', 'desc'), limit(200));
        const unsubAgents = onSnapshot(agentQ, (snap) => {
            setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AgentRow)));
            setLoading(false);
        }, (err) => {
            console.error('[AdminQuantMonitor] agents:', err);
            setLoading(false);
        });

        // Subscribe to recent trades (global, last 50)
        const tradeQ = query(collection(db, 'paperTrades'), orderBy('timestamp', 'desc'), limit(50));
        const unsubTrades = onSnapshot(tradeQ, (snap) => {
            setRecentTrades(snap.docs.map(d => ({ id: d.id, ...d.data() } as TradeRow)));
        });

        onCleanup(() => { unsubAgents(); unsubTrades(); });
    });

    // KPIs
    const kpis = createMemo(() => {
        const a = agents();
        const running = a.filter(x => x.status === 'running' || x.status === 'active');
        const liveAgents = a.filter(x => x.tradingMode === 'live');
        const totalAUM = a.reduce((s, x) => s + (x.totalValue || 0), 0);
        const totalTrades = a.reduce((s, x) => s + (x.totalTrades || 0), 0);
        const avgPnl = a.length > 0 ? a.reduce((s, x) => s + (x.totalPnlPercent || 0), 0) / a.length : 0;
        const riskPaused = a.filter(x => x.status === 'paused_by_risk' || x.riskStatus?.pauseReason);
        const uniqueUsers = new Set(a.map(x => x.userId)).size;
        return { total: a.length, running: running.length, live: liveAgents.length, totalAUM, totalTrades, avgPnl, riskPaused: riskPaused.length, uniqueUsers };
    });

    const filtered = createMemo(() => {
        let list = agents();
        const sf = statusFilter();
        const mf = modeFilter();
        if (sf !== 'all') {
            if (sf === 'running') list = list.filter(a => a.status === 'running' || a.status === 'active');
            else if (sf === 'paused') list = list.filter(a => a.status?.includes('paused'));
            else list = list.filter(a => a.status === sf);
        }
        if (mf !== 'all') list = list.filter(a => a.tradingMode === mf);
        return list;
    });

    const fmtKRW = (v: number) => {
        if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
        if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(0)}만`;
        return Math.round(v).toLocaleString();
    };

    const timeAgo = (ts: string) => {
        if (!ts) return '-';
        const ms = Date.now() - new Date(ts).getTime();
        const sec = Math.floor(ms / 1000);
        if (sec < 60) return `${sec}s`;
        if (sec < 3600) return `${Math.floor(sec / 60)}m`;
        if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
        return `${Math.floor(sec / 86400)}d`;
    };

    return (
        <div style="max-width: 1200px;">
            {/* Header */}
            <div style="margin-bottom: 28px;">
                <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 6px;">Quant Monitor</h1>
                <p style="font-size: 13px; color: rgba(255,255,255,0.35); margin: 0;">Real-time monitoring of all user Quant agents and trades</p>
            </div>

            <Show when={!loading()} fallback={
                <div style="display: flex; justify-content: center; padding: 60px;">
                    <div style="width: 24px; height: 24px; border: 3px solid rgba(6,182,212,0.2); border-top-color: rgb(6,182,212); border-radius: 50%; animation: qm-spin 0.8s linear infinite;" />
                </div>
            }>
                {/* KPI Cards */}
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
                    {[
                        { label: 'Total Agents', value: String(kpis().total), sub: `${kpis().uniqueUsers} users`, color: '' },
                        { label: 'Running', value: String(kpis().running), sub: `${kpis().live} live`, color: kpis().running > 0 ? 'color: #4ade80;' : '' },
                        { label: 'Total AUM', value: `₩${fmtKRW(kpis().totalAUM)}`, sub: `${kpis().totalTrades.toLocaleString()} trades`, color: '' },
                        { label: 'Avg Return', value: `${kpis().avgPnl >= 0 ? '+' : ''}${kpis().avgPnl.toFixed(2)}%`, sub: `${kpis().riskPaused} risk-paused`, color: kpis().avgPnl >= 0 ? 'color: #4ade80;' : 'color: #f87171;' },
                    ].map(k => (
                        <div style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px;">
                            <div style="font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">{k.label}</div>
                            <div style={`font-size: 22px; font-weight: 900; font-family: monospace; ${k.color}`}>{k.value}</div>
                            <div style="font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 2px;">{k.sub}</div>
                        </div>
                    ))}
                </div>

                {/* Risk Alerts */}
                <Show when={agents().filter(a => a.riskStatus?.pauseReason).length > 0}>
                    <div style="margin-bottom: 20px; padding: 14px 18px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 14px;">
                        <div style="font-size: 11px; font-weight: 800; color: #f87171; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                            Risk Alerts
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <For each={agents().filter(a => a.riskStatus?.pauseReason)}>
                                {(a) => (
                                    <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                        <div>
                                            <span style="font-size: 11px; font-weight: 800; color: white;">{a.userEmail?.split('@')[0] || a.userId.slice(0, 8)}</span>
                                            <span style="font-size: 10px; color: rgba(255,255,255,0.35); margin-left: 8px;">{a.strategyName}</span>
                                        </div>
                                        <span style="font-size: 10px; color: #f87171; font-weight: 700;">{a.riskStatus?.pauseReason}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>

                {/* Two-column layout: Agents + Trade Feed */}
                <div style="display: grid; grid-template-columns: 1fr 380px; gap: 16px; align-items: start;">

                    {/* Agent Table */}
                    <div>
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                            <div style="font-size: 13px; font-weight: 800; color: rgba(255,255,255,0.5);">Agents ({filtered().length})</div>
                            <div style="display: flex; gap: 6px;">
                                {(['all', 'running', 'paused', 'stopped'] as const).map(f => (
                                    <button
                                        onClick={() => setStatusFilter(f)}
                                        style={`padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; border: 1px solid; cursor: pointer; transition: all 0.2s; ${
                                            statusFilter() === f
                                                ? 'background: rgba(6,182,212,0.1); color: rgb(6,182,212); border-color: rgba(6,182,212,0.2);'
                                                : 'background: transparent; color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.06);'
                                        }`}
                                    >
                                        {f === 'all' ? 'All' : f === 'running' ? 'Running' : f === 'paused' ? 'Paused' : 'Stopped'}
                                    </button>
                                ))}
                                <span style="width: 1px; background: rgba(255,255,255,0.06); margin: 0 2px;" />
                                {(['all', 'paper', 'live'] as const).map(f => (
                                    <button
                                        onClick={() => setModeFilter(f)}
                                        style={`padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; border: 1px solid; cursor: pointer; transition: all 0.2s; ${
                                            modeFilter() === f
                                                ? 'background: rgba(6,182,212,0.1); color: rgb(6,182,212); border-color: rgba(6,182,212,0.2);'
                                                : 'background: transparent; color: rgba(255,255,255,0.3); border-color: rgba(255,255,255,0.06);'
                                        }`}
                                    >
                                        {f === 'all' ? 'All' : f === 'paper' ? 'Paper' : 'Live'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Show when={filtered().length > 0} fallback={
                            <div style="padding: 40px; text-align: center; color: rgba(255,255,255,0.2); font-size: 12px;">No agents matching filter.</div>
                        }>
                            <div style="display: flex; flex-direction: column; gap: 6px; max-height: 600px; overflow-y: auto;">
                                <For each={filtered()}>
                                    {(agent) => {
                                        const isExp = () => expandedAgent() === agent.id;
                                        const statusColor = () => {
                                            if (agent.status === 'running' || agent.status === 'active') return '#4ade80';
                                            if (agent.status?.includes('paused')) return '#f59e0b';
                                            if (agent.status === 'stopped') return '#6b7280';
                                            return '#ef4444';
                                        };
                                        return (
                                            <div style={`background: rgba(255,255,255,0.02); border: 1px solid ${isExp() ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.04)'}; border-radius: 12px; transition: all 0.2s; overflow: hidden;`}>
                                                <div
                                                    onClick={() => setExpandedAgent(isExp() ? null : agent.id)}
                                                    style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer;"
                                                >
                                                    <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                                                        <div style={`width: 7px; height: 7px; border-radius: 50%; background: ${statusColor()}; flex-shrink: 0;`} />
                                                        <div style="min-width: 0;">
                                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                                <span style="font-size: 12px; font-weight: 800; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;">
                                                                    {agent.userEmail?.split('@')[0] || agent.userId?.slice(0, 8) || '?'}
                                                                </span>
                                                                <span style={`font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 3px; text-transform: uppercase; ${
                                                                    agent.tradingMode === 'live'
                                                                        ? 'background: rgba(239,68,68,0.12); color: #f87171;'
                                                                        : 'background: rgba(6,182,212,0.1); color: rgb(6,182,212);'
                                                                }`}>{agent.tradingMode}</span>
                                                            </div>
                                                            <div style="font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 1px;">
                                                                {agent.strategyName}
                                                                <Show when={agent.exchange}><span style="margin-left: 6px; color: rgba(255,255,255,0.2);">{agent.exchange}</span></Show>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style="display: flex; align-items: center; gap: 16px;">
                                                        <div style="text-align: right;">
                                                            <div style={`font-size: 12px; font-weight: 900; font-family: monospace; ${agent.totalPnlPercent >= 0 ? 'color: #4ade80;' : 'color: #f87171;'}`}>
                                                                {agent.totalPnlPercent >= 0 ? '+' : ''}{(agent.totalPnlPercent || 0).toFixed(2)}%
                                                            </div>
                                                            <div style="font-size: 9px; color: rgba(255,255,255,0.25);">{agent.totalTrades || 0} trades</div>
                                                        </div>
                                                        <div style="font-size: 9px; color: rgba(255,255,255,0.2);">{timeAgo(agent.lastHeartbeatAt || agent.updatedAt)}</div>
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"
                                                            style={`transition: transform 0.2s; ${isExp() ? 'transform: rotate(90deg);' : ''}`}>
                                                            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
                                                        </svg>
                                                    </div>
                                                </div>

                                                {/* Expanded details */}
                                                <Show when={isExp()}>
                                                    <div style="padding: 0 16px 14px; border-top: 1px solid rgba(255,255,255,0.03);">
                                                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0;">
                                                            <div style="padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                                                <div style="font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase;">Seed</div>
                                                                <div style="font-size: 11px; font-weight: 800; color: white; font-family: monospace;">
                                                                    {agent.seedCurrency === 'KRW' ? '₩' : '$'}{fmtKRW(agent.seed)}
                                                                </div>
                                                            </div>
                                                            <div style="padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                                                <div style="font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase;">Value</div>
                                                                <div style="font-size: 11px; font-weight: 800; color: white; font-family: monospace;">
                                                                    {agent.seedCurrency === 'KRW' ? '₩' : '$'}{fmtKRW(agent.totalValue || 0)}
                                                                </div>
                                                            </div>
                                                            <div style="padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                                                <div style="font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase;">Win Rate</div>
                                                                <div style="font-size: 11px; font-weight: 800; color: white; font-family: monospace;">{(agent.winRate || 0).toFixed(1)}%</div>
                                                            </div>
                                                            <div style="padding: 8px; background: rgba(0,0,0,0.2); border-radius: 8px;">
                                                                <div style="font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase;">Risk</div>
                                                                <div style={`font-size: 11px; font-weight: 800; font-family: monospace; ${
                                                                    agent.riskProfile === 'aggressive' ? 'color: #f87171;' : agent.riskProfile === 'balanced' ? 'color: rgb(6,182,212);' : 'color: #60a5fa;'
                                                                }`}>{agent.riskProfile || '-'}</div>
                                                            </div>
                                                        </div>
                                                        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                                                            <For each={agent.selectedAssets || []}>
                                                                {(asset) => (
                                                                    <span style="padding: 2px 6px; font-size: 9px; font-weight: 800; background: rgba(6,182,212,0.08); color: rgb(6,182,212); border: 1px solid rgba(6,182,212,0.12); border-radius: 4px;">
                                                                        {asset.replace('KRW-', '')}
                                                                    </span>
                                                                )}
                                                            </For>
                                                        </div>
                                                        <Show when={agent.riskStatus?.pauseReason}>
                                                            <div style="padding: 8px 10px; background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.12); border-radius: 8px; margin-bottom: 8px;">
                                                                <span style="font-size: 10px; color: #f87171; font-weight: 700;">Risk Paused: {agent.riskStatus?.pauseReason}</span>
                                                            </div>
                                                        </Show>
                                                        <div style="display: flex; justify-content: space-between; font-size: 9px; color: rgba(255,255,255,0.15); font-family: monospace;">
                                                            <span>{agent.id}</span>
                                                            <span>Created: {new Date(agent.createdAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </Show>
                                            </div>
                                        );
                                    }}
                                </For>
                            </div>
                        </Show>
                    </div>

                    {/* Trade Feed */}
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; padding: 16px;">
                        <div style="font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px;">
                            Recent Trades
                        </div>
                        <Show when={recentTrades().length > 0} fallback={
                            <div style="padding: 30px; text-align: center; color: rgba(255,255,255,0.15); font-size: 11px;">No trades yet.</div>
                        }>
                            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 520px; overflow-y: auto;">
                                <For each={recentTrades()}>
                                    {(trade) => (
                                        <div style="display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.02);">
                                            <div style={`width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 900; flex-shrink: 0; ${
                                                trade.side === 'buy'
                                                    ? 'background: rgba(74,222,128,0.15); color: #4ade80;'
                                                    : 'background: rgba(248,113,113,0.15); color: #f87171;'
                                            }`}>
                                                {trade.side === 'buy' ? 'B' : 'S'}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="display: flex; align-items: center; gap: 4px;">
                                                    <span style="font-size: 10px; font-weight: 800; color: white;">{trade.asset?.replace('KRW-', '')}</span>
                                                    <span style="font-size: 9px; color: rgba(255,255,255,0.2);">@{trade.price?.toLocaleString()}</span>
                                                </div>
                                                <div style="font-size: 8px; color: rgba(255,255,255,0.15); margin-top: 1px;">
                                                    {timeAgo(trade.timestamp)} ago
                                                </div>
                                            </div>
                                            <Show when={trade.side === 'sell'}>
                                                <span style={`font-size: 10px; font-weight: 800; font-family: monospace; ${trade.pnl >= 0 ? 'color: #4ade80;' : 'color: #f87171;'}`}>
                                                    {trade.pnl >= 0 ? '+' : ''}{(trade.pnlPercent || 0).toFixed(2)}%
                                                </span>
                                            </Show>
                                            <Show when={trade.side === 'buy'}>
                                                <span style="font-size: 9px; color: rgba(255,255,255,0.2); font-family: monospace;">₩{fmtKRW(trade.value || 0)}</span>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </Show>
                    </div>
                </div>
            </Show>

            <style>{`
                @keyframes qm-spin { to { transform: rotate(360deg); } }
                @media (max-width: 900px) {
                    div[style*="grid-template-columns: 1fr 380px"] { grid-template-columns: 1fr !important; }
                    div[style*="grid-template-columns: repeat(4, 1fr)"] { grid-template-columns: repeat(2, 1fr) !important; }
                }
            `}</style>
        </div>
    );
};

export default AdminQuantMonitor;
