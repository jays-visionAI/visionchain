import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

type DrawdownAction = 'pause' | 'reduce' | 'hedge';

interface RiskConfig {
    killSwitchEnabled: boolean;
    circuitBreaker: { enabled: boolean; priceChangeThreshold: number; pauseDurationMinutes: number };
    dailyLossLimit: number;
    dailyProfitTakeEnabled: boolean;
    dailyProfitTarget: number;
    maxDrawdownPercent: number;
    maxDrawdownAction: DrawdownAction;
}

const DEFAULT: RiskConfig = {
    killSwitchEnabled: false,
    circuitBreaker: { enabled: true, priceChangeThreshold: 5, pauseDurationMinutes: 10 },
    dailyLossLimit: 5000,
    dailyProfitTakeEnabled: false,
    dailyProfitTarget: 10000,
    maxDrawdownPercent: 10,
    maxDrawdownAction: 'pause',
};

export default function MMRiskControls() {
    const [config, setConfig] = createSignal<RiskConfig>({ ...DEFAULT });
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saved, setSaved] = createSignal(false);
    const [dailyPnL, setDailyPnL] = createSignal(0);
    const [drawdown, setDrawdown] = createSignal(0);
    const [recentEvents, setRecentEvents] = createSignal<any[]>([]);
    const db = getAdminFirebaseDb();

    onMount(async () => {
        try {
            const [settingsSnap, marketSnap] = await Promise.all([
                getDoc(doc(db, 'dex/config/mm-settings')),
                getDoc(doc(db, 'dex/market/data/VCN-USDT')),
            ]);
            if (settingsSnap.exists() && settingsSnap.data().riskConfig) setConfig(prev => ({ ...prev, ...settingsSnap.data().riskConfig }));
            if (marketSnap.exists()) {
                const m = marketSnap.data();
                setDailyPnL(m.dailyPnL || 0);
                setDrawdown(m.maxDrawdownPercent || 0);
            }
            // Load recent risk events
            try {
                const evSnap = await getDocs(query(collection(db, 'dex/config/mm-audit-log'), orderBy('timestamp', 'desc'), limit(5)));
                const ev: any[] = [];
                evSnap.forEach(d => ev.push({ id: d.id, ...d.data() }));
                setRecentEvents(ev);
            } catch (e) { /* audit log may not exist yet */ }
        } catch (e) { console.error('[MMRisk] Load:', e); }
        finally { setLoading(false); }
    });

    const update = (path: string, value: any) => {
        setConfig(prev => {
            const next = { ...prev };
            const keys = path.split('.');
            let obj: any = next;
            for (let i = 0; i < keys.length - 1; i++) { obj[keys[i]] = { ...obj[keys[i]] }; obj = obj[keys[i]]; }
            obj[keys[keys.length - 1]] = value;
            return next;
        });
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const operator = getAdminFirebaseAuth().currentUser?.email || 'unknown';
            await setDoc(doc(db, 'dex/config/mm-settings'), { riskConfig: config(), updatedAt: new Date(), updatedBy: operator }, { merge: true });
            await addDoc(collection(db, 'dex/config/mm-audit-log'), { type: 'risk_config', config: config(), operator, timestamp: new Date() });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error('[MMRisk] Save:', e); }
        finally { setSaving(false); }
    };

    const toggleKillSwitch = async () => {
        const newState = !config().killSwitchEnabled;
        update('killSwitchEnabled', newState);
        // Save immediately for kill switch
        setSaving(true);
        try {
            const operator = getAdminFirebaseAuth().currentUser?.email || 'unknown';
            await setDoc(doc(db, 'dex/config/mm-settings'), { riskConfig: { ...config(), killSwitchEnabled: newState }, updatedAt: new Date(), updatedBy: operator }, { merge: true });
            await addDoc(collection(db, 'dex/config/mm-audit-log'), { type: newState ? 'kill_switch_on' : 'kill_switch_off', operator, timestamp: new Date() });
        } catch (e) { console.error('[MMRisk] Kill switch:', e); }
        finally { setSaving(false); }
    };

    const riskLevel = createMemo(() => {
        const pnl = dailyPnL();
        const dd = drawdown();
        const c = config();
        if (c.killSwitchEnabled) return 'halt';
        if (Math.abs(pnl) > c.dailyLossLimit * 0.8 || dd > c.maxDrawdownPercent * 0.8) return 'danger';
        if (Math.abs(pnl) > c.dailyLossLimit * 0.5 || dd > c.maxDrawdownPercent * 0.5) return 'warning';
        return 'safe';
    });

    const fmtK = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;

    return (
        <div class="mmr-root">
            <div class="mmr-header">
                <div><h1 class="mmr-title">Risk Controls</h1><p class="mmr-subtitle">Kill switch, circuit breaker, loss limits</p></div>
                <button onClick={handleSave} disabled={saving()} class={`mmr-save ${saved() ? 'saved' : ''}`}>
                    <Show when={saving()} fallback={<span>{saved() ? 'Saved' : 'Save Changes'}</span>}><div class="mmr-spin" /><span>Saving...</span></Show>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="mmr-loading"><div class="mmr-spin" /></div>}>
                {/* Risk Status Banner */}
                <div class={`mmr-banner ${riskLevel()}`}>
                    <div class="mmr-banner-icon">
                        {riskLevel() === 'safe' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v5c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" stroke="currentColor" stroke-width="2" /><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}
                        {riskLevel() === 'warning' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 3L2 21h20L12 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>}
                        {riskLevel() === 'danger' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" /><path d="M12 7v6M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>}
                        {riskLevel() === 'halt' && <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2" /><rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" /></svg>}
                    </div>
                    <div class="mmr-banner-text">
                        <span class="mmr-banner-status">
                            {riskLevel() === 'safe' && 'System Status: SAFE'}
                            {riskLevel() === 'warning' && 'System Status: WARNING'}
                            {riskLevel() === 'danger' && 'System Status: DANGER'}
                            {riskLevel() === 'halt' && 'System Status: HALTED (Kill Switch Active)'}
                        </span>
                        <span class="mmr-banner-detail">
                            24h PnL: {dailyPnL() >= 0 ? '+' : ''}{fmtK(dailyPnL())} | Drawdown: {drawdown().toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Kill Switch */}
                <div class={`mmr-kill-section ${config().killSwitchEnabled ? 'active' : ''}`}>
                    <div class="mmr-kill-left">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="16" r="9" stroke="currentColor" stroke-width="2.5" />
                            <path d="M14 7v7" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                        </svg>
                        <div>
                            <div class="mmr-kill-title">Kill Switch</div>
                            <div class="mmr-kill-desc">Immediately halt ALL market maker activity</div>
                        </div>
                    </div>
                    <button onClick={toggleKillSwitch} class={`mmr-kill-btn ${config().killSwitchEnabled ? 'on' : 'off'}`}>
                        <div class="mmr-kill-toggle">
                            <div class="mmr-kill-knob" />
                        </div>
                        <span>{config().killSwitchEnabled ? 'ACTIVE' : 'OFF'}</span>
                    </button>
                </div>

                {/* Circuit Breaker */}
                <div class="mmr-section">
                    <h2 class="mmr-section-title">Circuit Breaker</h2>
                    <label class="mmr-checkbox">
                        <input type="checkbox" checked={config().circuitBreaker.enabled} onChange={(e) => update('circuitBreaker.enabled', e.currentTarget.checked)} />
                        <span>Enable automatic pause on rapid price changes</span>
                    </label>
                    <Show when={config().circuitBreaker.enabled}>
                        <div class="mmr-cb-grid">
                            <div class="mmr-input-group">
                                <label class="mmr-label">Price Change Threshold</label>
                                <div class="mmr-input-row">
                                    <input type="number" step="1" min="1" max="20" value={config().circuitBreaker.priceChangeThreshold} onInput={(e) => update('circuitBreaker.priceChangeThreshold', parseInt(e.currentTarget.value) || 5)} class="mmr-input" />
                                    <span class="mmr-unit">% in 5min</span>
                                </div>
                            </div>
                            <div class="mmr-input-group">
                                <label class="mmr-label">Pause Duration</label>
                                <div class="mmr-input-row">
                                    <input type="number" step="5" min="5" max="60" value={config().circuitBreaker.pauseDurationMinutes} onInput={(e) => update('circuitBreaker.pauseDurationMinutes', parseInt(e.currentTarget.value) || 10)} class="mmr-input" />
                                    <span class="mmr-unit">minutes</span>
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* Daily P&L Limits */}
                <div class="mmr-section">
                    <h2 class="mmr-section-title">Daily P&L Limits</h2>
                    <div class="mmr-pnl-grid">
                        <div class="mmr-input-group">
                            <label class="mmr-label">Daily Loss Limit (USDT)</label>
                            <input type="number" step="500" min="100" value={config().dailyLossLimit} onInput={(e) => update('dailyLossLimit', parseInt(e.currentTarget.value) || 5000)} class="mmr-input" />
                            <div class="mmr-pnl-bar-wrap">
                                <div class="mmr-pnl-bar loss">
                                    <div class="mmr-pnl-bar-fill" style={{ width: `${Math.min(Math.abs(Math.min(dailyPnL(), 0)) / config().dailyLossLimit * 100, 100)}%` }} />
                                </div>
                                <span class="mmr-pnl-bar-label">{(Math.abs(Math.min(dailyPnL(), 0)) / config().dailyLossLimit * 100).toFixed(0)}% used</span>
                            </div>
                        </div>
                        <div class="mmr-input-group">
                            <label class="mmr-checkbox" style={{ "margin-bottom": "8px" }}>
                                <input type="checkbox" checked={config().dailyProfitTakeEnabled} onChange={(e) => update('dailyProfitTakeEnabled', e.currentTarget.checked)} />
                                <span class="mmr-label" style={{ margin: "0" }}>Daily Profit Target</span>
                            </label>
                            <Show when={config().dailyProfitTakeEnabled}>
                                <input type="number" step="500" min="100" value={config().dailyProfitTarget} onInput={(e) => update('dailyProfitTarget', parseInt(e.currentTarget.value) || 10000)} class="mmr-input" />
                                <span class="mmr-hint">Reduce speed when target is reached</span>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Max Drawdown */}
                <div class="mmr-section">
                    <h2 class="mmr-section-title">Max Drawdown</h2>
                    <div class="mmr-dd-grid">
                        <div class="mmr-input-group">
                            <label class="mmr-label">Threshold (%)</label>
                            <input type="number" step="1" min="1" max="50" value={config().maxDrawdownPercent} onInput={(e) => update('maxDrawdownPercent', parseInt(e.currentTarget.value) || 10)} class="mmr-input" />
                            <div class="mmr-dd-current">
                                Current: <span class={drawdown() > config().maxDrawdownPercent * 0.7 ? 'danger' : ''}>{drawdown().toFixed(1)}%</span>
                            </div>
                        </div>
                        <div class="mmr-input-group">
                            <label class="mmr-label">On Trigger</label>
                            <div class="mmr-action-btns">
                                <For each={[{ key: 'pause', label: 'Pause', desc: 'Stop trading' }, { key: 'reduce', label: 'Reduce', desc: 'Halve order sizes' }, { key: 'hedge', label: 'Hedge', desc: 'Offset positions' }] as { key: DrawdownAction; label: string; desc: string }[]}>
                                    {(action) => (
                                        <button onClick={() => update('maxDrawdownAction', action.key)} class={`mmr-action-btn ${config().maxDrawdownAction === action.key ? 'active' : ''}`}>
                                            <span>{action.label}</span>
                                            <span class="mmr-action-desc">{action.desc}</span>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Events */}
                <Show when={recentEvents().length > 0}>
                    <div class="mmr-section">
                        <h2 class="mmr-section-title">Recent Risk Events</h2>
                        <div class="mmr-events">
                            <For each={recentEvents()}>
                                {(ev) => (
                                    <div class="mmr-event">
                                        <span class="mmr-event-type">{ev.type?.replace(/_/g, ' ')}</span>
                                        <span class="mmr-event-who">{ev.operator}</span>
                                        <span class="mmr-event-time">{ev.timestamp?.toDate?.()?.toLocaleString?.() || 'N/A'}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </Show>

            <style>{`
                .mmr-root { max-width: 900px; }
                .mmr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
                .mmr-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mmr-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mmr-save { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; border: none; cursor: pointer; transition: all 0.2s; }
                .mmr-save:hover { transform: scale(1.03); }
                .mmr-save:disabled { opacity: 0.5; transform: none; cursor: not-allowed; }
                .mmr-save.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }
                .mmr-loading { display: flex; justify-content: center; padding: 60px; }
                .mmr-spin { width: 24px; height: 24px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mmr-banner { display: flex; align-items: center; gap: 16px; padding: 18px 22px; border-radius: 14px; margin-bottom: 20px; }
                .mmr-banner.safe { background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.15); color: #22c55e; }
                .mmr-banner.warning { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15); color: #f59e0b; }
                .mmr-banner.danger { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); color: #ef4444; }
                .mmr-banner.halt { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; animation: haltPulse 2s ease-in-out infinite; }
                .mmr-banner-icon { flex-shrink: 0; }
                .mmr-banner-text { display: flex; flex-direction: column; gap: 2px; }
                .mmr-banner-status { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
                .mmr-banner-detail { font-size: 11px; opacity: 0.7; }

                .mmr-kill-section { display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-radius: 14px; margin-bottom: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); transition: all 0.3s; }
                .mmr-kill-section.active { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.2); color: #ef4444; }
                .mmr-kill-left { display: flex; align-items: center; gap: 14px; color: inherit; }
                .mmr-kill-title { font-size: 16px; font-weight: 900; }
                .mmr-kill-desc { font-size: 11px; opacity: 0.5; }
                .mmr-kill-btn { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-radius: 10px; border: none; cursor: pointer; font-weight: 800; font-size: 12px; transition: all 0.2s; text-transform: uppercase; }
                .mmr-kill-btn.off { background: rgba(34,197,94,0.1); color: #22c55e; }
                .mmr-kill-btn.on { background: rgba(239,68,68,0.15); color: #ef4444; }
                .mmr-kill-toggle { width: 44px; height: 24px; border-radius: 12px; position: relative; transition: background 0.2s; }
                .mmr-kill-btn.off .mmr-kill-toggle { background: rgba(34,197,94,0.2); }
                .mmr-kill-btn.on .mmr-kill-toggle { background: rgba(239,68,68,0.3); }
                .mmr-kill-knob { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; transition: all 0.2s; }
                .mmr-kill-btn.off .mmr-kill-knob { left: 3px; background: #22c55e; }
                .mmr-kill-btn.on .mmr-kill-knob { left: 23px; background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.5); }

                .mmr-section { margin-bottom: 20px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; }
                .mmr-section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); margin: 0 0 12px; }
                .mmr-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.5); cursor: pointer; margin-bottom: 12px; }
                .mmr-checkbox input { accent-color: #f59e0b; }

                .mmr-cb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .mmr-pnl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .mmr-dd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .mmr-input-group { display: flex; flex-direction: column; gap: 6px; }
                .mmr-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; }
                .mmr-input-row { display: flex; align-items: center; gap: 8px; }
                .mmr-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.12); border-radius: 10px; padding: 10px 14px; color: white; font-size: 15px; font-weight: 700; font-family: monospace; outline: none; width: 100%; box-sizing: border-box; }
                .mmr-input:focus { border-color: rgba(245,158,11,0.4); }
                .mmr-unit { font-size: 12px; color: rgba(255,255,255,0.3); white-space: nowrap; }
                .mmr-hint { font-size: 10px; color: rgba(255,255,255,0.25); }

                .mmr-pnl-bar-wrap { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
                .mmr-pnl-bar { flex: 1; height: 4px; border-radius: 2px; overflow: hidden; }
                .mmr-pnl-bar.loss { background: rgba(239,68,68,0.1); }
                .mmr-pnl-bar-fill { height: 100%; background: #ef4444; border-radius: 2px; }
                .mmr-pnl-bar-label { font-size: 10px; color: rgba(255,255,255,0.3); }

                .mmr-dd-current { font-size: 12px; color: rgba(255,255,255,0.4); }
                .mmr-dd-current .danger { color: #ef4444; font-weight: 800; }

                .mmr-action-btns { display: flex; gap: 8px; }
                .mmr-action-btn { flex: 1; padding: 10px 8px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; text-align: center; }
                .mmr-action-btn:hover { border-color: rgba(255,255,255,0.12); }
                .mmr-action-btn.active { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.06); color: #f59e0b; }
                .mmr-action-btn span:first-child { display: block; font-weight: 800; font-size: 13px; }
                .mmr-action-desc { display: block; font-size: 9px; opacity: 0.6; margin-top: 2px; }

                .mmr-events { display: flex; flex-direction: column; gap: 4px; }
                .mmr-event { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; background: rgba(0,0,0,0.2); font-size: 11px; }
                .mmr-event-type { font-weight: 800; color: #f59e0b; text-transform: uppercase; min-width: 120px; }
                .mmr-event-who { color: rgba(255,255,255,0.4); flex: 1; }
                .mmr-event-time { color: rgba(255,255,255,0.25); font-family: monospace; font-size: 10px; }

                @media (max-width: 768px) { .mmr-cb-grid, .mmr-pnl-grid, .mmr-dd-grid { grid-template-columns: 1fr; } .mmr-action-btns { flex-direction: column; } }
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes haltPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
            `}</style>
        </div>
    );
}
