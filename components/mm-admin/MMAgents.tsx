import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

interface MMAgent {
    id: string;
    name: string;
    role: string;
    status: string;
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
        winRate: number;
    };
}

interface AgentOverride {
    enabled: boolean;
    trendBiasOverride?: number;
    spreadOverride?: number;
    note?: string;
}

export default function MMAgents() {
    const [agents, setAgents] = createSignal<MMAgent[]>([]);
    const [overrides, setOverrides] = createSignal<Record<string, AgentOverride>>({});
    const [price, setPrice] = createSignal(0.10);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saved, setSaved] = createSignal(false);
    const [selectedAgent, setSelectedAgent] = createSignal<string | null>(null);
    const db = getAdminFirebaseDb();

    onMount(async () => {
        try {
            const [settingsSnap, marketSnap, agentsSnap] = await Promise.all([
                getDoc(doc(db, 'dex/config/mm-settings')),
                getDoc(doc(db, 'dex/market/data/VCN-USDT')),
                getDocs(query(collection(db, 'dex/agents/list'), where('role', '==', 'market_maker'))),
            ]);
            if (settingsSnap.exists() && settingsSnap.data().agentOverrides) setOverrides(settingsSnap.data().agentOverrides);
            if (marketSnap.exists()) setPrice(marketSnap.data().lastPrice || 0.10);
            const a: MMAgent[] = [];
            agentsSnap.forEach(d => a.push({ id: d.id, ...d.data() } as any));
            setAgents(a);
        } catch (e) { console.error('[MMAgents] Load:', e); }
        finally { setLoading(false); }
    });

    const updateOverride = (agentId: string, key: keyof AgentOverride, value: any) => {
        setOverrides(prev => ({
            ...prev,
            [agentId]: { ...(prev[agentId] || { enabled: true }), [key]: value }
        }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const operator = getAdminFirebaseAuth().currentUser?.email || 'unknown';
            await setDoc(doc(db, 'dex/config/mm-settings'), { agentOverrides: overrides(), updatedAt: new Date(), updatedBy: operator }, { merge: true });
            await addDoc(collection(db, 'dex/config/mm-audit-log'), { type: 'agent_overrides', overrides: overrides(), operator, timestamp: new Date() });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error('[MMAgents] Save:', e); }
        finally { setSaving(false); }
    };

    const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(0);

    const totalPnL = createMemo(() => agents().reduce((s, a) => s + (a.performance?.totalPnL || 0), 0));
    const totalTrades = createMemo(() => agents().reduce((s, a) => s + (a.performance?.totalTrades || 0), 0));

    return (
        <div class="mma-root">
            <div class="mma-header">
                <div><h1 class="mma-title">MM Agents</h1><p class="mma-subtitle">Configure and monitor market maker agents</p></div>
                <button onClick={handleSave} disabled={saving()} class={`mma-save ${saved() ? 'saved' : ''}`}>
                    <Show when={saving()} fallback={<span>{saved() ? 'Saved' : 'Save Overrides'}</span>}><div class="mma-spin" /><span>Saving...</span></Show>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="mma-loading"><div class="mma-spin" /></div>}>
                {/* Summary */}
                <div class="mma-summary">
                    <div class="mma-summary-item"><span class="mma-sum-label">Active</span><span class="mma-sum-val">{agents().filter(a => a.status === 'active').length}/{agents().length}</span></div>
                    <div class="mma-summary-item"><span class="mma-sum-label">Combined PnL</span><span class={`mma-sum-val ${totalPnL() >= 0 ? 'up' : 'dn'}`}>${fmtK(totalPnL())}</span></div>
                    <div class="mma-summary-item"><span class="mma-sum-label">Total Trades</span><span class="mma-sum-val">{totalTrades().toLocaleString()}</span></div>
                </div>

                {/* Agents */}
                <Show when={agents().length > 0} fallback={
                    <div class="mma-empty">
                        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                            <rect x="8" y="12" width="32" height="28" rx="4" stroke="rgba(245,158,11,0.3)" stroke-width="2.5" />
                            <circle cx="18" cy="26" r="3" fill="rgba(245,158,11,0.2)" />
                            <circle cx="30" cy="26" r="3" fill="rgba(245,158,11,0.2)" />
                            <path d="M24 6v6" stroke="rgba(245,158,11,0.3)" stroke-width="2.5" stroke-linecap="round" />
                            <circle cx="24" cy="6" r="2" fill="rgba(245,158,11,0.3)" />
                        </svg>
                        <h3>No MM Agents Found</h3>
                        <p>Market maker agents need to be created with role: "market_maker" in the trading engine.</p>
                    </div>
                }>
                    <div class="mma-agents">
                        <For each={agents()}>
                            {(agent) => {
                                const override = () => overrides()[agent.id] || { enabled: true };
                                const isSelected = () => selectedAgent() === agent.id;
                                const vcnVal = () => agent.balances.VCN * price();
                                const totalVal = () => agent.balances.USDT + vcnVal();
                                const vcnPct = () => totalVal() > 0 ? (vcnVal() / totalVal()) * 100 : 50;
                                return (
                                    <div class={`mma-agent ${isSelected() ? 'expanded' : ''} ${override().enabled === false ? 'disabled' : ''}`}>
                                        {/* Agent Header */}
                                        <div class="mma-agent-header" onClick={() => setSelectedAgent(isSelected() ? null : agent.id)}>
                                            <div class="mma-agent-left">
                                                <div class="mma-agent-icon">
                                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                                        <rect x="4" y="6" width="12" height="10" rx="2" stroke="currentColor" stroke-width="1.5" />
                                                        <circle cx="8" cy="11" r="1.2" fill="currentColor" />
                                                        <circle cx="12" cy="11" r="1.2" fill="currentColor" />
                                                        <path d="M10 3v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <div class="mma-agent-name">{agent.name || agent.id}</div>
                                                    <div class="mma-agent-id">{agent.id}</div>
                                                </div>
                                            </div>
                                            <div class="mma-agent-right">
                                                <div class={`mma-agent-status ${agent.status === 'active' ? 'active' : 'paused'}`}>{agent.status}</div>
                                                <div class={`mma-agent-pnl ${(agent.performance?.totalPnL || 0) >= 0 ? 'up' : 'dn'}`}>
                                                    ${fmtK(agent.performance?.totalPnL || 0)}
                                                </div>
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class={`mma-chevron ${isSelected() ? 'open' : ''}`}>
                                                    <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        <Show when={isSelected()}>
                                            <div class="mma-agent-body">
                                                {/* Stats */}
                                                <div class="mma-stats-grid">
                                                    <div class="mma-stat"><span>USDT</span><span class="mono">${fmtK(agent.balances.USDT)}</span></div>
                                                    <div class="mma-stat"><span>VCN</span><span class="mono">{fmtK(agent.balances.VCN)}</span></div>
                                                    <div class="mma-stat"><span>Total Value</span><span class="mono">${fmtK(totalVal())}</span></div>
                                                    <div class="mma-stat"><span>Trades</span><span class="mono">{agent.performance?.totalTrades?.toLocaleString() || 0}</span></div>
                                                </div>

                                                {/* Inventory bar */}
                                                <div class="mma-inv-bar">
                                                    <div class="mma-inv-fill" style={{ width: `${vcnPct()}%` }} />
                                                </div>
                                                <div class="mma-inv-labels"><span>VCN {vcnPct().toFixed(0)}%</span><span>USDT {(100 - vcnPct()).toFixed(0)}%</span></div>

                                                {/* MM Config */}
                                                <Show when={agent.mmConfig}>
                                                    <div class="mma-config-section">
                                                        <h3 class="mma-config-title">Engine Config</h3>
                                                        <div class="mma-config-grid">
                                                            <div><span>Base Price</span><span>${agent.mmConfig!.basePrice?.toFixed(4)}</span></div>
                                                            <div><span>Spread</span><span>{agent.mmConfig!.spreadPercent}%</span></div>
                                                            <div><span>Bias</span><span class={agent.mmConfig!.trendBias > 0 ? 'up' : agent.mmConfig!.trendBias < 0 ? 'dn' : ''}>{agent.mmConfig!.trendBias > 0 ? '+' : ''}{agent.mmConfig!.trendBias}</span></div>
                                                            <div><span>Layers</span><span>{agent.mmConfig!.layerCount} x {agent.mmConfig!.layerSpacing}%</span></div>
                                                        </div>
                                                    </div>
                                                </Show>

                                                {/* Admin Overrides */}
                                                <div class="mma-override-section">
                                                    <h3 class="mma-config-title">Admin Overrides</h3>
                                                    <label class="mma-checkbox">
                                                        <input type="checkbox" checked={override().enabled !== false} onChange={(e) => updateOverride(agent.id, 'enabled', e.currentTarget.checked)} />
                                                        <span>Agent Enabled</span>
                                                    </label>
                                                    <div class="mma-override-grid">
                                                        <div class="mma-override-item">
                                                            <label>Bias Override</label>
                                                            <input type="number" step="0.05" min="-1" max="1" value={override().trendBiasOverride ?? ''} onInput={(e) => updateOverride(agent.id, 'trendBiasOverride', e.currentTarget.value ? parseFloat(e.currentTarget.value) : undefined)} placeholder="Default" class="mma-ovr-input" />
                                                        </div>
                                                        <div class="mma-override-item">
                                                            <label>Spread Override (%)</label>
                                                            <input type="number" step="0.1" min="0.1" max="5" value={override().spreadOverride ?? ''} onInput={(e) => updateOverride(agent.id, 'spreadOverride', e.currentTarget.value ? parseFloat(e.currentTarget.value) : undefined)} placeholder="Default" class="mma-ovr-input" />
                                                        </div>
                                                    </div>
                                                    <div class="mma-note-group">
                                                        <label>Note</label>
                                                        <input type="text" value={override().note || ''} onInput={(e) => updateOverride(agent.id, 'note', e.currentTarget.value)} placeholder="Admin note for this agent..." class="mma-note-input" />
                                                    </div>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </Show>
            </Show>

            <style>{`
                .mma-root { max-width: 900px; }
                .mma-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
                .mma-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mma-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mma-save { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; border: none; cursor: pointer; transition: all 0.2s; }
                .mma-save:hover { transform: scale(1.03); }
                .mma-save:disabled { opacity: 0.5; transform: none; cursor: not-allowed; }
                .mma-save.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }
                .mma-loading { display: flex; justify-content: center; padding: 60px; }
                .mma-spin { width: 24px; height: 24px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mma-summary { display: flex; gap: 16px; margin-bottom: 20px; }
                .mma-summary-item { padding: 14px 18px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; flex: 1; }
                .mma-sum-label { display: block; font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-bottom: 4px; }
                .mma-sum-val { font-size: 20px; font-weight: 900; font-family: monospace; }
                .mma-sum-val.up { color: #22c55e; }
                .mma-sum-val.dn { color: #ef4444; }

                .mma-empty { text-align: center; padding: 50px 20px; color: rgba(255,255,255,0.3); }
                .mma-empty h3 { font-size: 18px; font-weight: 800; margin: 16px 0 8px; color: rgba(255,255,255,0.5); }
                .mma-empty p { font-size: 12px; }

                .mma-agents { display: flex; flex-direction: column; gap: 10px; }
                .mma-agent { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; transition: all 0.2s; overflow: hidden; }
                .mma-agent.expanded { border-color: rgba(245,158,11,0.2); }
                .mma-agent.disabled { opacity: 0.5; }
                .mma-agent-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; cursor: pointer; transition: background 0.2s; }
                .mma-agent-header:hover { background: rgba(255,255,255,0.01); }
                .mma-agent-left { display: flex; align-items: center; gap: 12px; }
                .mma-agent-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(245,158,11,0.08); display: flex; align-items: center; justify-content: center; color: #f59e0b; }
                .mma-agent-name { font-size: 15px; font-weight: 800; }
                .mma-agent-id { font-size: 10px; color: rgba(255,255,255,0.25); font-family: monospace; }
                .mma-agent-right { display: flex; align-items: center; gap: 14px; }
                .mma-agent-status { font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; }
                .mma-agent-status.active { color: #22c55e; background: rgba(34,197,94,0.08); }
                .mma-agent-status.paused { color: #f59e0b; background: rgba(245,158,11,0.08); }
                .mma-agent-pnl { font-size: 14px; font-weight: 900; font-family: monospace; }
                .mma-agent-pnl.up { color: #22c55e; }
                .mma-agent-pnl.dn { color: #ef4444; }
                .mma-chevron { color: rgba(255,255,255,0.3); transition: transform 0.2s; }
                .mma-chevron.open { transform: rotate(180deg); }

                .mma-agent-body { padding: 0 20px 20px; border-top: 1px solid rgba(255,255,255,0.04); }
                .mma-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
                .mma-stat { padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; display: flex; flex-direction: column; gap: 2px; }
                .mma-stat span:first-child { font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; }
                .mma-stat .mono { font-size: 14px; font-weight: 800; font-family: monospace; }

                .mma-inv-bar { height: 6px; background: rgba(255,255,255,0.04); border-radius: 3px; overflow: hidden; margin-bottom: 4px; }
                .mma-inv-fill { height: 100%; background: linear-gradient(to right, #f59e0b, #d97706); border-radius: 3px; }
                .mma-inv-labels { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.3); margin-bottom: 14px; }

                .mma-config-section, .mma-override-section { margin-top: 14px; padding: 14px; background: rgba(0,0,0,0.15); border-radius: 10px; }
                .mma-config-title { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 10px; }
                .mma-config-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .mma-config-grid div { display: flex; flex-direction: column; gap: 2px; }
                .mma-config-grid span:first-child { font-size: 9px; color: rgba(255,255,255,0.3); text-transform: uppercase; }
                .mma-config-grid span:last-child { font-size: 12px; font-weight: 700; font-family: monospace; }
                .mma-config-grid .up { color: #22c55e; }
                .mma-config-grid .dn { color: #ef4444; }

                .mma-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.5); cursor: pointer; margin-bottom: 10px; }
                .mma-checkbox input { accent-color: #f59e0b; }
                .mma-override-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
                .mma-override-item label { display: block; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
                .mma-ovr-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.1); border-radius: 8px; padding: 8px 10px; color: white; font-size: 13px; font-family: monospace; outline: none; box-sizing: border-box; }
                .mma-ovr-input:focus { border-color: rgba(245,158,11,0.3); }

                .mma-note-group label { display: block; font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.35); margin-bottom: 4px; }
                .mma-note-input { width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; color: white; font-size: 12px; outline: none; box-sizing: border-box; }
                .mma-note-input:focus { border-color: rgba(245,158,11,0.2); }

                @media (max-width: 768px) { .mma-summary { flex-direction: column; } .mma-stats-grid { grid-template-columns: repeat(2, 1fr); } .mma-config-grid { grid-template-columns: repeat(2, 1fr); } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
