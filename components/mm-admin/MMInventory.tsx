import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where } from 'firebase/firestore';

interface InventoryConfig {
    targetRatio: number;
    skewIntensity: number;
    autoRebalance: boolean;
    rebalanceTrigger: number;
    maxVCNPercent: number;
    maxUSDTPercent: number;
}

interface AgentBalance { id: string; name: string; usdt: number; vcn: number; }

const DEFAULT: InventoryConfig = { targetRatio: 0.5, skewIntensity: 0.5, autoRebalance: true, rebalanceTrigger: 15, maxVCNPercent: 80, maxUSDTPercent: 80 };

export default function MMInventory() {
    const [config, setConfig] = createSignal<InventoryConfig>({ ...DEFAULT });
    const [agents, setAgents] = createSignal<AgentBalance[]>([]);
    const [price, setPrice] = createSignal(0.10);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saved, setSaved] = createSignal(false);
    const db = getAdminFirebaseDb();

    onMount(async () => {
        try {
            const [settingsSnap, marketSnap, agentsSnap] = await Promise.all([
                getDoc(doc(db, 'dex/config/mm-settings/current')),
                getDoc(doc(db, 'dex/market/data/VCN-USDT')),
                getDocs(query(collection(db, 'dex/agents/list'), where('role', '==', 'market_maker'))),
            ]);
            if (settingsSnap.exists() && settingsSnap.data().inventoryConfig) setConfig(prev => ({ ...prev, ...settingsSnap.data().inventoryConfig }));
            if (marketSnap.exists()) setPrice(marketSnap.data().lastPrice || 0.10);
            const a: AgentBalance[] = [];
            agentsSnap.forEach(d => { const data = d.data(); a.push({ id: d.id, name: data.name || d.id, usdt: data.balances?.USDT || 0, vcn: data.balances?.VCN || 0 }); });
            setAgents(a);
        } catch (e) { console.error('[MMInv] Load:', e); }
        finally { setLoading(false); }
    });

    const update = (key: keyof InventoryConfig, value: any) => { setConfig(prev => ({ ...prev, [key]: value })); setSaved(false); };

    const handleSave = async () => {
        setSaving(true);
        try {
            const operator = getAdminFirebaseAuth().currentUser?.email || 'unknown';
            await setDoc(doc(db, 'dex/config/mm-settings/current'), { inventoryConfig: config(), updatedAt: new Date(), updatedBy: operator }, { merge: true });
            await addDoc(collection(db, 'dex/config/mm-audit-log'), { type: 'inventory_config', config: config(), operator, timestamp: new Date() });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error('[MMInv] Save:', e); }
        finally { setSaving(false); }
    };

    // Combined inventory
    const combined = createMemo(() => {
        const totalUSDT = agents().reduce((s, a) => s + a.usdt, 0);
        const totalVCN = agents().reduce((s, a) => s + a.vcn, 0);
        const vcnVal = totalVCN * price();
        const total = totalUSDT + vcnVal;
        return { totalUSDT, totalVCN, vcnVal, total, vcnPct: total > 0 ? (vcnVal / total) * 100 : 50, usdtPct: total > 0 ? (totalUSDT / total) * 100 : 50 };
    });

    const imbalance = createMemo(() => Math.abs(combined().vcnPct - config().targetRatio * 100));
    const imbalanceStatus = createMemo(() => {
        const i = imbalance();
        if (i < 5) return 'balanced';
        if (i < config().rebalanceTrigger) return 'mild';
        return 'critical';
    });

    const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(0);

    return (
        <div class="mmi-root">
            <div class="mmi-header">
                <div><h1 class="mmi-title">Inventory</h1><p class="mmi-subtitle">Target ratios, skew intensity, and position limits</p></div>
                <button onClick={handleSave} disabled={saving()} class={`mmi-save ${saved() ? 'saved' : ''}`}>
                    <Show when={saving()} fallback={<span>{saved() ? 'Saved' : 'Save Changes'}</span>}><div class="mmi-spin" /><span>Saving...</span></Show>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="mmi-loading"><div class="mmi-spin" /></div>}>
                {/* Current Inventory Overview */}
                <div class="mmi-overview">
                    <div class="mmi-overview-header">
                        <h2 class="mmi-section-title">Current Inventory</h2>
                        <div class={`mmi-status-badge ${imbalanceStatus()}`}>
                            {imbalanceStatus() === 'balanced' && 'Balanced'}
                            {imbalanceStatus() === 'mild' && 'Mild Imbalance'}
                            {imbalanceStatus() === 'critical' && 'Rebalance Needed'}
                        </div>
                    </div>
                    <div class="mmi-bar-wrap">
                        <div class="mmi-bar">
                            <div class="mmi-bar-vcn" style={{ width: `${combined().vcnPct}%` }} />
                        </div>
                        <div class="mmi-bar-labels">
                            <span>VCN {combined().vcnPct.toFixed(1)}% ({fmtK(combined().totalVCN)} tokens)</span>
                            <span>USDT {combined().usdtPct.toFixed(1)}% (${fmtK(combined().totalUSDT)})</span>
                        </div>
                        <div class="mmi-target-marker" style={{ left: `${config().targetRatio * 100}%` }}>
                            <div class="mmi-target-line" />
                            <span class="mmi-target-label">Target {(config().targetRatio * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                    <div class="mmi-overview-stats">
                        <div class="mmi-stat"><span class="mmi-stat-label">Total Value</span><span class="mmi-stat-val">${fmtK(combined().total)}</span></div>
                        <div class="mmi-stat"><span class="mmi-stat-label">Imbalance</span><span class={`mmi-stat-val ${imbalanceStatus()}`}>{imbalance().toFixed(1)}%</span></div>
                        <div class="mmi-stat"><span class="mmi-stat-label">Agents</span><span class="mmi-stat-val">{agents().length}</span></div>
                    </div>
                </div>

                {/* Target Ratio */}
                <div class="mmi-section">
                    <h2 class="mmi-section-title">Target Ratio</h2>
                    <div class="mmi-slider-row">
                        <span class="mmi-slider-end">VCN 0%</span>
                        <input type="range" min="0.1" max="0.9" step="0.01" value={config().targetRatio} onInput={(e) => update('targetRatio', parseFloat(e.currentTarget.value))} class="mmi-slider" />
                        <span class="mmi-slider-end">VCN 90%</span>
                    </div>
                    <div class="mmi-slider-val-row">
                        <span class="mmi-ratio-badge vcn">VCN {(config().targetRatio * 100).toFixed(0)}%</span>
                        <span class="mmi-ratio-badge usdt">USDT {((1 - config().targetRatio) * 100).toFixed(0)}%</span>
                    </div>
                </div>

                {/* Skew Intensity */}
                <div class="mmi-section">
                    <h2 class="mmi-section-title">Skew Intensity</h2>
                    <p class="mmi-desc">How aggressively to adjust order sizes when inventory is imbalanced</p>
                    <div class="mmi-slider-row">
                        <span class="mmi-slider-end">Off</span>
                        <input type="range" min="0" max="1" step="0.01" value={config().skewIntensity} onInput={(e) => update('skewIntensity', parseFloat(e.currentTarget.value))} class="mmi-slider" />
                        <span class="mmi-slider-end">Aggressive</span>
                    </div>
                    <div class="mmi-slider-center-val">{config().skewIntensity.toFixed(1)}</div>
                </div>

                {/* Auto-Rebalance */}
                <div class="mmi-section">
                    <h2 class="mmi-section-title">Auto-Rebalance</h2>
                    <label class="mmi-checkbox">
                        <input type="checkbox" checked={config().autoRebalance} onChange={(e) => update('autoRebalance', e.currentTarget.checked)} />
                        <span>Enable automatic rebalancing</span>
                    </label>
                    <Show when={config().autoRebalance}>
                        <div class="mmi-inline">
                            <span>Trigger when imbalance exceeds</span>
                            <input type="number" step="0.01" min="0.01" max="50" value={config().rebalanceTrigger} onInput={(e) => update('rebalanceTrigger', parseFloat(e.currentTarget.value) || 15)} class="mmi-input-sm" />
                            <span>%</span>
                        </div>
                    </Show>
                </div>

                {/* Position Limits */}
                <div class="mmi-section">
                    <h2 class="mmi-section-title">Position Limits</h2>
                    <div class="mmi-limits">
                        <div class="mmi-limit-row">
                            <span class="mmi-limit-label">Max VCN</span>
                            <input type="number" step="0.01" min="0.01" max="100" value={config().maxVCNPercent} onInput={(e) => update('maxVCNPercent', parseFloat(e.currentTarget.value) || 80)} class="mmi-input-sm" />
                            <span class="mmi-unit">%</span>
                        </div>
                        <div class="mmi-limit-row">
                            <span class="mmi-limit-label">Max USDT</span>
                            <input type="number" step="0.01" min="0.01" max="100" value={config().maxUSDTPercent} onInput={(e) => update('maxUSDTPercent', parseFloat(e.currentTarget.value) || 80)} class="mmi-input-sm" />
                            <span class="mmi-unit">%</span>
                        </div>
                    </div>
                </div>

                {/* Per-Agent Breakdown */}
                <Show when={agents().length > 0}>
                    <div class="mmi-section">
                        <h2 class="mmi-section-title">Agent Breakdown</h2>
                        <div class="mmi-agents-table">
                            <div class="mmi-th"><span>Agent</span><span>USDT</span><span>VCN</span><span>VCN Value</span><span>Ratio</span></div>
                            <For each={agents()}>
                                {(a) => {
                                    const vcnVal = () => a.vcn * price();
                                    const total = () => a.usdt + vcnVal();
                                    const vcnPct = () => total() > 0 ? (vcnVal() / total()) * 100 : 50;
                                    return (
                                        <div class="mmi-tr">
                                            <span class="mmi-agent-name">{a.name}</span>
                                            <span class="mmi-mono">${fmtK(a.usdt)}</span>
                                            <span class="mmi-mono">{fmtK(a.vcn)}</span>
                                            <span class="mmi-mono">${fmtK(vcnVal())}</span>
                                            <span class="mmi-ratio-mini"><div class="mmi-ratio-bar"><div class="mmi-ratio-fill" style={{ width: `${vcnPct()}%` }} /></div><span>{vcnPct().toFixed(0)}%</span></span>
                                        </div>
                                    );
                                }}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>

            <style>{`
                .mmi-root { max-width: 900px; }
                .mmi-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
                .mmi-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mmi-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mmi-save { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; border: none; cursor: pointer; transition: all 0.2s; }
                .mmi-save:hover { transform: scale(1.03); }
                .mmi-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .mmi-save.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }
                .mmi-loading { display: flex; justify-content: center; padding: 60px; }
                .mmi-spin { width: 24px; height: 24px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mmi-section { margin-bottom: 20px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; }
                .mmi-section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); margin: 0 0 12px; }
                .mmi-desc { font-size: 11px; color: rgba(255,255,255,0.3); margin: 0 0 12px; }

                .mmi-overview { padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(245,158,11,0.08); border-radius: 14px; margin-bottom: 20px; position: relative; }
                .mmi-overview-header { display: flex; align-items: center; justify-content: space-between; }
                .mmi-status-badge { padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; }
                .mmi-status-badge.balanced { color: #22c55e; background: rgba(34,197,94,0.08); }
                .mmi-status-badge.mild { color: #f59e0b; background: rgba(245,158,11,0.08); }
                .mmi-status-badge.critical { color: #ef4444; background: rgba(239,68,68,0.08); }

                .mmi-bar-wrap { position: relative; margin: 16px 0; }
                .mmi-bar { height: 20px; background: rgba(255,255,255,0.04); border-radius: 10px; overflow: hidden; }
                .mmi-bar-vcn { height: 100%; background: linear-gradient(to right, #f59e0b, #d97706); border-radius: 10px; transition: width 0.3s; }
                .mmi-bar-labels { display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: rgba(255,255,255,0.35); }
                .mmi-target-marker { position: absolute; top: 0; transform: translateX(-50%); }
                .mmi-target-line { width: 2px; height: 20px; background: white; opacity: 0.6; margin: 0 auto; }
                .mmi-target-label { display: block; font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.5); text-align: center; margin-top: 2px; white-space: nowrap; }

                .mmi-overview-stats { display: flex; gap: 20px; margin-top: 14px; }
                .mmi-stat { display: flex; flex-direction: column; gap: 2px; }
                .mmi-stat-label { font-size: 9px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; }
                .mmi-stat-val { font-size: 16px; font-weight: 900; font-family: monospace; }
                .mmi-stat-val.balanced { color: #22c55e; }
                .mmi-stat-val.mild { color: #f59e0b; }
                .mmi-stat-val.critical { color: #ef4444; }

                .mmi-slider-row { display: flex; align-items: center; gap: 10px; }
                .mmi-slider-end { font-size: 10px; color: rgba(255,255,255,0.3); white-space: nowrap; }
                .mmi-slider { flex: 1; height: 6px; appearance: none; background: linear-gradient(to right, rgba(245,158,11,0.15), rgba(245,158,11,0.4)); border-radius: 3px; outline: none; cursor: pointer; }
                .mmi-slider::-webkit-slider-thumb { appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #f59e0b; border: 3px solid #0a0808; cursor: pointer; }
                .mmi-slider-val-row { display: flex; justify-content: center; gap: 12px; margin-top: 10px; }
                .mmi-slider-center-val { text-align: center; margin-top: 8px; font-size: 18px; font-weight: 900; color: #f59e0b; font-family: monospace; }
                .mmi-ratio-badge { padding: 4px 14px; border-radius: 6px; font-size: 12px; font-weight: 800; }
                .mmi-ratio-badge.vcn { color: #f59e0b; background: rgba(245,158,11,0.1); }
                .mmi-ratio-badge.usdt { color: #22c55e; background: rgba(34,197,94,0.1); }

                .mmi-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.5); cursor: pointer; margin-bottom: 10px; }
                .mmi-checkbox input { accent-color: #f59e0b; }
                .mmi-inline { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.4); }
                .mmi-input-sm { width: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.12); border-radius: 6px; padding: 6px 8px; color: white; font-size: 13px; font-weight: 700; outline: none; text-align: center; }
                .mmi-unit { font-size: 12px; color: rgba(255,255,255,0.3); }
                .mmi-limits { display: flex; gap: 20px; }
                .mmi-limit-row { display: flex; align-items: center; gap: 8px; }
                .mmi-limit-label { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.4); min-width: 70px; }

                .mmi-agents-table { border-radius: 10px; overflow: hidden; }
                .mmi-th { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1.2fr; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.03); font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.3); text-transform: uppercase; }
                .mmi-tr { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1.2fr; gap: 8px; padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.03); font-size: 12px; align-items: center; }
                .mmi-agent-name { font-weight: 700; }
                .mmi-mono { font-family: monospace; color: rgba(255,255,255,0.6); }
                .mmi-ratio-mini { display: flex; align-items: center; gap: 6px; }
                .mmi-ratio-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden; }
                .mmi-ratio-fill { height: 100%; background: #f59e0b; border-radius: 2px; }

                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
