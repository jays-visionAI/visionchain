import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';

type LayerPattern = 'flat' | 'increasing' | 'decreasing' | 'bell';

interface SpreadConfig {
    baseSpread: number;
    bidSpreadMultiplier: number;
    askSpreadMultiplier: number;
    dynamicSpreadEnabled: boolean;
    dynamicSpreadRange: { min: number; max: number };
    layerCount: number;
    layerSpacing: number;
    layerAmountPattern: LayerPattern;
    layerAmountPercent: number;
}

const DEFAULT: SpreadConfig = {
    baseSpread: 0.5,
    bidSpreadMultiplier: 1.0,
    askSpreadMultiplier: 1.0,
    dynamicSpreadEnabled: false,
    dynamicSpreadRange: { min: 0.2, max: 2.0 },
    layerCount: 5,
    layerSpacing: 0.3,
    layerAmountPattern: 'flat',
    layerAmountPercent: 3.0,
};

const PATTERNS: { key: LayerPattern; label: string; desc: string }[] = [
    { key: 'flat', label: 'Flat', desc: 'Equal amounts on all layers' },
    { key: 'increasing', label: 'Increasing', desc: 'Larger orders away from price' },
    { key: 'decreasing', label: 'Decreasing', desc: 'Larger orders near mid-price' },
    { key: 'bell', label: 'Bell Curve', desc: 'Concentration on middle layers' },
];

function getLayerMult(i: number, total: number, pattern: LayerPattern): number {
    switch (pattern) {
        case 'increasing': return 0.5 + (i / total) * 1.0;
        case 'decreasing': return 1.5 - (i / total) * 1.0;
        case 'bell': { const mid = (total - 1) / 2; return 1.0 + 0.5 * (1 - Math.abs(i - mid) / Math.max(mid, 1)); }
        default: return 1.0;
    }
}

export default function MMSpreadLayers() {
    const [config, setConfig] = createSignal<SpreadConfig>({ ...DEFAULT });
    const [currentPrice, setCurrentPrice] = createSignal(0.10);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saved, setSaved] = createSignal(false);
    const db = getAdminFirebaseDb();

    onMount(async () => {
        try {
            const [settingsSnap, marketSnap] = await Promise.all([
                getDoc(doc(db, 'dex/config/mm-settings/current')),
                getDoc(doc(db, 'dex/market/data/VCN-USDT')),
            ]);
            if (settingsSnap.exists() && settingsSnap.data().spreadConfig) {
                setConfig(prev => ({ ...prev, ...settingsSnap.data().spreadConfig }));
            }
            if (marketSnap.exists()) setCurrentPrice(marketSnap.data().lastPrice || 0.10);
        } catch (e) { console.error('[MMSpread] Load:', e); }
        finally { setLoading(false); }
    });

    const update = (key: keyof SpreadConfig, value: any) => { setConfig(prev => ({ ...prev, [key]: value })); setSaved(false); };

    const handleSave = async () => {
        setSaving(true);
        try {
            const operator = getAdminFirebaseAuth().currentUser?.email || 'unknown';
            await setDoc(doc(db, 'dex/config/mm-settings/current'), { spreadConfig: config(), updatedAt: new Date(), updatedBy: operator }, { merge: true });
            await addDoc(collection(db, 'dex/config/mm-audit-log'), { type: 'spread_config', config: config(), operator, timestamp: new Date() });
            setSaved(true); setTimeout(() => setSaved(false), 3000);
        } catch (e) { console.error('[MMSpread] Save:', e); }
        finally { setSaving(false); }
    };

    // Spread direction indicator
    const spreadBias = createMemo(() => {
        const c = config();
        if (c.askSpreadMultiplier > c.bidSpreadMultiplier + 0.1) return 'bullish';
        if (c.bidSpreadMultiplier > c.askSpreadMultiplier + 0.1) return 'bearish';
        return 'neutral';
    });

    // Order book preview data
    const previewLayers = createMemo(() => {
        const c = config();
        const mid = currentPrice();
        const bidSpread = (c.baseSpread / 100) * c.bidSpreadMultiplier;
        const askSpread = (c.baseSpread / 100) * c.askSpreadMultiplier;
        const spacing = c.layerSpacing / 100;
        const asks: { price: number; pct: number }[] = [];
        const bids: { price: number; pct: number }[] = [];
        for (let i = 0; i < c.layerCount; i++) {
            const mult = getLayerMult(i, c.layerCount, c.layerAmountPattern);
            const pct = c.layerAmountPercent * mult;
            asks.push({ price: mid * (1 + askSpread / 2 + i * spacing), pct });
            bids.push({ price: mid * (1 - bidSpread / 2 - i * spacing), pct });
        }
        return { asks: asks.reverse(), bids };
    });

    const fmt = (n: number) => n.toFixed(4);
    const maxPct = createMemo(() => Math.max(...previewLayers().asks.map(a => a.pct), ...previewLayers().bids.map(b => b.pct), 1));

    return (
        <div class="mms-root">
            <div class="mms-header">
                <div>
                    <h1 class="mms-title">Spread & Layers</h1>
                    <p class="mms-subtitle">Configure bid/ask spread and order book layers</p>
                </div>
                <button onClick={handleSave} disabled={saving()} class={`mms-save-btn ${saved() ? 'saved' : ''}`}>
                    <Show when={saving()} fallback={<span>{saved() ? 'Saved' : 'Save Changes'}</span>}>
                        <div class="mms-spin" /><span>Saving...</span>
                    </Show>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="mms-loading"><div class="mms-spin" /></div>}>
                <div class="mms-grid-2">
                    {/* Left: Settings */}
                    <div class="mms-settings">
                        {/* Base Spread */}
                        <div class="mms-section">
                            <h2 class="mms-section-title">Base Spread</h2>
                            <div class="mms-input-row">
                                <input type="number" step="0.01" min="0.01" max="5" value={config().baseSpread} onInput={(e) => update('baseSpread', parseFloat(e.currentTarget.value) || 0.5)} class="mms-input" />
                                <span class="mms-unit">%</span>
                            </div>
                            <div class="mms-actual-spread">
                                Actual: Bid {(config().baseSpread * config().bidSpreadMultiplier).toFixed(2)}% / Ask {(config().baseSpread * config().askSpreadMultiplier).toFixed(2)}%
                            </div>
                        </div>

                        {/* Asymmetric Spread */}
                        <div class="mms-section">
                            <h2 class="mms-section-title">Asymmetric Spread</h2>
                            <div class="mms-slider-row">
                                <label class="mms-label">Bid Multiplier</label>
                                <input type="range" min="0.5" max="2.0" step="0.01" value={config().bidSpreadMultiplier} onInput={(e) => update('bidSpreadMultiplier', parseFloat(e.currentTarget.value))} class="mms-slider" />
                                <span class="mms-slider-val">{config().bidSpreadMultiplier.toFixed(2)}x</span>
                            </div>
                            <div class="mms-slider-row">
                                <label class="mms-label">Ask Multiplier</label>
                                <input type="range" min="0.5" max="2.0" step="0.01" value={config().askSpreadMultiplier} onInput={(e) => update('askSpreadMultiplier', parseFloat(e.currentTarget.value))} class="mms-slider" />
                                <span class="mms-slider-val">{config().askSpreadMultiplier.toFixed(2)}x</span>
                            </div>
                            <div class={`mms-bias-indicator ${spreadBias()}`}>
                                {spreadBias() === 'bullish' && 'Bullish bias: Easier to buy, harder to sell'}
                                {spreadBias() === 'bearish' && 'Bearish bias: Easier to sell, harder to buy'}
                                {spreadBias() === 'neutral' && 'Neutral: Symmetric spread'}
                            </div>
                        </div>

                        {/* Dynamic Spread */}
                        <div class="mms-section">
                            <h2 class="mms-section-title">Dynamic Spread</h2>
                            <label class="mms-checkbox">
                                <input type="checkbox" checked={config().dynamicSpreadEnabled} onChange={(e) => update('dynamicSpreadEnabled', e.currentTarget.checked)} />
                                <span>Enable volatility-based spread adjustment</span>
                            </label>
                            <Show when={config().dynamicSpreadEnabled}>
                                <div class="mms-range-inputs">
                                    <div class="mms-input-group">
                                        <label class="mms-label">Min %</label>
                                        <input type="number" step="0.01" value={config().dynamicSpreadRange.min} onInput={(e) => update('dynamicSpreadRange', { ...config().dynamicSpreadRange, min: parseFloat(e.currentTarget.value) || 0.2 })} class="mms-input-sm" />
                                    </div>
                                    <span class="mms-range-sep">~</span>
                                    <div class="mms-input-group">
                                        <label class="mms-label">Max %</label>
                                        <input type="number" step="0.01" value={config().dynamicSpreadRange.max} onInput={(e) => update('dynamicSpreadRange', { ...config().dynamicSpreadRange, max: parseFloat(e.currentTarget.value) || 2.0 })} class="mms-input-sm" />
                                    </div>
                                </div>
                            </Show>
                        </div>

                        {/* Layers */}
                        <div class="mms-section">
                            <h2 class="mms-section-title">Order Layers</h2>
                            <div class="mms-slider-row">
                                <label class="mms-label">Count</label>
                                <input type="range" min="1" max="15" step="1" value={config().layerCount} onInput={(e) => update('layerCount', parseInt(e.currentTarget.value))} class="mms-slider" />
                                <span class="mms-slider-val">{config().layerCount}</span>
                            </div>
                            <div class="mms-slider-row">
                                <label class="mms-label">Spacing</label>
                                <input type="number" step="0.01" min="0.01" max="2" value={config().layerSpacing} onInput={(e) => update('layerSpacing', parseFloat(e.currentTarget.value) || 0.3)} class="mms-input-sm" />
                                <span class="mms-unit">%</span>
                            </div>
                            <div class="mms-slider-row">
                                <label class="mms-label">Amount/Layer</label>
                                <input type="number" step="0.01" min="0.01" max="10" value={config().layerAmountPercent} onInput={(e) => update('layerAmountPercent', parseFloat(e.currentTarget.value) || 3)} class="mms-input-sm" />
                                <span class="mms-unit">% of balance</span>
                            </div>
                            <div class="mms-pattern-grid">
                                <For each={PATTERNS}>
                                    {(p) => (
                                        <button onClick={() => update('layerAmountPattern', p.key)} class={`mms-pattern-btn ${config().layerAmountPattern === p.key ? 'active' : ''}`}>
                                            <span class="mms-pattern-label">{p.label}</span>
                                            <span class="mms-pattern-desc">{p.desc}</span>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>

                    {/* Right: Order Book Preview */}
                    <div class="mms-preview">
                        <h2 class="mms-section-title">Order Book Preview</h2>
                        <div class="mms-ob">
                            {/* Asks */}
                            <For each={previewLayers().asks}>
                                {(ask) => (
                                    <div class="mms-ob-row ask">
                                        <div class="mms-ob-bar" style={{ width: `${(ask.pct / maxPct()) * 100}%` }} />
                                        <span class="mms-ob-side">SELL</span>
                                        <span class="mms-ob-price">{fmt(ask.price)}</span>
                                        <span class="mms-ob-pct">{ask.pct.toFixed(1)}%</span>
                                    </div>
                                )}
                            </For>
                            {/* Mid */}
                            <div class="mms-ob-mid">
                                <span>{fmt(currentPrice())}</span>
                                <span class="mms-ob-spread">Spread: {(config().baseSpread * (config().bidSpreadMultiplier + config().askSpreadMultiplier) / 2).toFixed(2)}%</span>
                            </div>
                            {/* Bids */}
                            <For each={previewLayers().bids}>
                                {(bid) => (
                                    <div class="mms-ob-row bid">
                                        <div class="mms-ob-bar" style={{ width: `${(bid.pct / maxPct()) * 100}%` }} />
                                        <span class="mms-ob-side">BUY</span>
                                        <span class="mms-ob-price">{fmt(bid.price)}</span>
                                        <span class="mms-ob-pct">{bid.pct.toFixed(1)}%</span>
                                    </div>
                                )}
                            </For>
                        </div>
                        <div class="mms-ob-summary">
                            Total layers: {config().layerCount} x 2 = {config().layerCount * 2} orders
                        </div>
                    </div>
                </div>
            </Show>

            <style>{`
                .mms-root { max-width: 1100px; }
                .mms-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
                .mms-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mms-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mms-save-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; border: none; cursor: pointer; transition: all 0.2s; }
                .mms-save-btn:hover { transform: scale(1.03); }
                .mms-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .mms-save-btn.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }
                .mms-loading { display: flex; justify-content: center; padding: 60px; }
                .mms-spin { width: 24px; height: 24px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mms-grid-2 { display: grid; grid-template-columns: 1fr 340px; gap: 20px; }
                .mms-settings { display: flex; flex-direction: column; gap: 16px; }
                .mms-section { padding: 18px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 14px; }
                .mms-section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); margin: 0 0 12px; }

                .mms-input-row { display: flex; align-items: center; gap: 8px; }
                .mms-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.12); border-radius: 10px; padding: 10px 14px; color: white; font-size: 18px; font-weight: 800; font-family: monospace; outline: none; width: 120px; box-sizing: border-box; }
                .mms-input:focus { border-color: rgba(245,158,11,0.4); }
                .mms-input-sm { background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.12); border-radius: 8px; padding: 8px 10px; color: white; font-size: 14px; font-weight: 700; font-family: monospace; outline: none; width: 80px; }
                .mms-unit { font-size: 13px; color: rgba(255,255,255,0.3); font-weight: 700; }
                .mms-actual-spread { margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.3); }

                .mms-slider-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
                .mms-label { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); min-width: 70px; }
                .mms-slider { flex: 1; height: 4px; appearance: none; background: rgba(255,255,255,0.08); border-radius: 2px; outline: none; cursor: pointer; }
                .mms-slider::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #f59e0b; border: 2px solid #0a0808; cursor: pointer; }
                .mms-slider-val { font-size: 13px; font-weight: 800; color: #f59e0b; font-family: monospace; min-width: 40px; text-align: right; }

                .mms-bias-indicator { margin-top: 10px; padding: 8px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; text-align: center; }
                .mms-bias-indicator.bullish { background: rgba(34,197,94,0.06); color: #22c55e; border: 1px solid rgba(34,197,94,0.15); }
                .mms-bias-indicator.bearish { background: rgba(239,68,68,0.06); color: #ef4444; border: 1px solid rgba(239,68,68,0.15); }
                .mms-bias-indicator.neutral { background: rgba(245,158,11,0.06); color: #f59e0b; border: 1px solid rgba(245,158,11,0.15); }

                .mms-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.5); cursor: pointer; margin-bottom: 10px; }
                .mms-checkbox input { accent-color: #f59e0b; }
                .mms-range-inputs { display: flex; align-items: flex-end; gap: 10px; }
                .mms-input-group { display: flex; flex-direction: column; gap: 4px; }
                .mms-range-sep { font-size: 16px; color: rgba(255,255,255,0.2); padding-bottom: 8px; }

                .mms-pattern-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }
                .mms-pattern-btn { padding: 10px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; text-align: left; }
                .mms-pattern-btn:hover { border-color: rgba(255,255,255,0.12); }
                .mms-pattern-btn.active { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.06); color: #f59e0b; }
                .mms-pattern-label { display: block; font-weight: 800; font-size: 12px; margin-bottom: 2px; }
                .mms-pattern-desc { display: block; font-size: 9px; opacity: 0.6; }

                /* Order Book Preview */
                .mms-preview { position: sticky; top: 20px; padding: 18px; background: rgba(255,255,255,0.02); border: 1px solid rgba(245,158,11,0.08); border-radius: 14px; }
                .mms-ob { display: flex; flex-direction: column; gap: 2px; }
                .mms-ob-row { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 6px; position: relative; overflow: hidden; font-size: 11px; font-family: monospace; }
                .mms-ob-bar { position: absolute; top: 0; right: 0; height: 100%; opacity: 0.08; }
                .mms-ob-row.ask .mms-ob-bar { background: #ef4444; }
                .mms-ob-row.bid .mms-ob-bar { background: #22c55e; }
                .mms-ob-side { font-weight: 800; font-size: 9px; width: 32px; }
                .mms-ob-row.ask .mms-ob-side { color: #ef4444; }
                .mms-ob-row.bid .mms-ob-side { color: #22c55e; }
                .mms-ob-price { flex: 1; font-weight: 700; color: rgba(255,255,255,0.7); }
                .mms-ob-pct { color: rgba(255,255,255,0.3); font-weight: 600; }
                .mms-ob-mid { text-align: center; padding: 8px; margin: 4px 0; border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; font-weight: 900; color: white; display: flex; justify-content: center; gap: 12px; align-items: center; }
                .mms-ob-spread { font-size: 10px; color: rgba(255,255,255,0.3); font-weight: 600; }
                .mms-ob-summary { text-align: center; margin-top: 10px; font-size: 10px; color: rgba(255,255,255,0.25); }

                @media (max-width: 900px) { .mms-grid-2 { grid-template-columns: 1fr; } .mms-preview { position: static; } }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
