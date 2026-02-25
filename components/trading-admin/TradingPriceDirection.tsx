import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb, getAdminFirebaseAuth, getFirebaseDb } from '../../services/firebaseService';
import { doc, getDoc, setDoc, collection, addDoc, onSnapshot } from 'firebase/firestore';

type TrendMode = 'bullish' | 'neutral' | 'bearish' | 'custom';
type TrendSpeed = 'slow' | 'medium' | 'fast';
type Phase = 'accumulation' | 'markup' | 'distribution' | 'markdown' | 'ranging';

interface PriceDirectionConfig {
    mode: TrendMode;
    targetPrice: number;
    currentBasePrice: number;
    trendBias: number;
    trendSpeed: TrendSpeed | number;
    movementStyle: 'gradual' | 'aggressive' | 'natural';
    volumeIntensity: number;
    priceFloor: number;
    priceCeiling: number;
    priceRangePercent: number;
    phase: Phase;
    phaseAutoRotate: boolean;
    phaseRotateInterval: number;
    volumeCycleEnabled: boolean;
    volumeCyclePeakHour: number;
    volumeSchedule: Record<number, number>;
}

const DEFAULT_CONFIG: PriceDirectionConfig = {
    mode: 'neutral',
    targetPrice: 0.10,
    currentBasePrice: 0.10,
    trendBias: 0,
    trendSpeed: 'medium' as TrendSpeed,
    movementStyle: 'gradual',
    volumeIntensity: 0.5,
    priceFloor: 0.05,
    priceCeiling: 0.50,
    priceRangePercent: 20,
    phase: 'ranging',
    phaseAutoRotate: false,
    phaseRotateInterval: 24,
    volumeCycleEnabled: false,
    volumeCyclePeakHour: 12,
    volumeSchedule: Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, 1]))
};

const MODE_PRESETS: Record<TrendMode, { bias: number; style: 'gradual' | 'aggressive'; vol: number; desc: string }> = {
    bullish: { bias: 0.3, style: 'gradual', vol: 0.6, desc: 'Gradual price increase with organic volume' },
    neutral: { bias: 0, style: 'gradual', vol: 0.3, desc: 'Stable price, symmetric liquidity' },
    bearish: { bias: -0.3, style: 'gradual', vol: 0.6, desc: 'Gradual price decrease, sell-side favored' },
    custom: { bias: 0, style: 'gradual', vol: 0.5, desc: 'Manual control of all parameters' },
};

const PHASE_INFO: Record<Phase, { label: string; desc: string; defaultBias: number; defaultStyle: 'gradual' | 'aggressive' }> = {
    accumulation: { label: 'Accumulation', desc: 'Quiet buying at support, narrow range', defaultBias: 0.05, defaultStyle: 'gradual' },
    markup: { label: 'Markup', desc: 'Trending up, bullish spread bias', defaultBias: 0.4, defaultStyle: 'aggressive' },
    distribution: { label: 'Distribution', desc: 'Selling at resistance, wide range', defaultBias: -0.05, defaultStyle: 'gradual' },
    markdown: { label: 'Markdown', desc: 'Trending down, bearish spread bias', defaultBias: -0.4, defaultStyle: 'aggressive' },
    ranging: { label: 'Ranging', desc: 'Sideways, grid-style liquidity', defaultBias: 0, defaultStyle: 'gradual' },
};

const SPEED_MAP: Record<TrendSpeed, { label: string; rate: string }> = {
    slow: { label: 'Slow', rate: '~0.3%/hr' },
    medium: { label: 'Medium', rate: '~1.2%/hr' },
    fast: { label: 'Fast', rate: '~3.0%/hr' },
};

export default function MMPriceDirection() {
    const [config, setConfig] = createSignal<PriceDirectionConfig>({ ...DEFAULT_CONFIG });
    const [currentPrice, setCurrentPrice] = createSignal(0.10);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saved, setSaved] = createSignal(false);
    const [customSpeed, setCustomSpeed] = createSignal(false);

    const db = getAdminFirebaseDb();
    const publicDb = getFirebaseDb();

    onMount(async () => {
        try {
            const settingsSnap = await getDoc(doc(db, 'dex/config/trading-settings/current'));
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                if (data.priceDirection) {
                    setConfig(prev => ({ ...prev, ...data.priceDirection }));
                    if (typeof data.priceDirection.trendSpeed === 'number') setCustomSpeed(true);
                }
            }

            // Real-time market price listener
            console.log('[MMPrice] Initializing market sync on: dex/market/data/VCN-USDT');
            const unsubscribe = onSnapshot(doc(publicDb, 'dex/market/data/VCN-USDT'), (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    const price = data.lastPrice;
                    if (price !== undefined) {
                        setCurrentPrice(price);
                        console.log('[MMPrice] Live market price synchronized:', price);
                    } else {
                        console.warn('[MMPrice] Document exists but lastPrice is missing:', data);
                    }
                } else {
                    console.warn('[MMPrice] Market data document DOES NOT EXIST at: dex/market/data/VCN-USDT');
                }
            }, (err) => {
                console.error('[MMPrice] Snapshot listener error:', err);
            });

            return () => unsubscribe();
        } catch (e) {
            console.error('[MMPrice] Load error:', e);
        } finally {
            setLoading(false);
        }
    });

    const update = (key: keyof PriceDirectionConfig, value: any) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const selectMode = (mode: TrendMode) => {
        const preset = MODE_PRESETS[mode];
        if (mode !== 'custom') {
            setConfig(prev => ({
                ...prev,
                mode,
                trendBias: preset.bias,
                movementStyle: preset.style as any,
                volumeIntensity: preset.vol
            }));
        } else {
            update('mode', mode);
        }
    };

    const selectPhase = (phase: Phase) => {
        const info = PHASE_INFO[phase];
        setConfig(prev => ({
            ...prev,
            phase,
            trendBias: info.defaultBias,
            movementStyle: info.defaultStyle as any
        }));
    };
    const handleSave = async () => {
        setSaving(true);
        try {
            const operator = getAdminFirebaseAuth().currentUser?.email || 'unknown';
            console.log('[MMPrice] Attempting to save config:', {
                priceDirection: config(),
                operator
            });

            await setDoc(doc(db, 'dex/config/trading-settings/current'), {
                priceDirection: config(),
                updatedAt: new Date(),
                updatedBy: operator,
            }, { merge: true });

            // Audit log
            await addDoc(collection(db, 'dex/config/trading-audit-log'), {
                type: 'price_direction',
                config: config(),
                operator,
                timestamp: new Date(),
            });

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
            console.log('[MMPrice] Save successful');
        } catch (e: any) {
            console.error('[MMPrice] Save error details:', e);
            alert(`Failed to save changes: ${e.message}`);
        }
        finally { setSaving(false); }
    };

    // Price direction preview calculations
    const speedRate = createMemo(() => {
        const s = config().trendSpeed;
        if (typeof s === 'number') return s;
        return { slow: 0.00005, medium: 0.0002, fast: 0.0005 }[s] || 0.0002;
    });

    const estHoursToTarget = createMemo(() => {
        const diff = Math.abs(config().targetPrice - currentPrice());
        if (diff < 0.0001) return 0;
        const perRound = currentPrice() * speedRate() * Math.abs(config().trendBias || 0.1);
        if (perRound < 0.00001) return Infinity;
        const rounds = diff / perRound;
        return rounds / 60; // ~1 round per minute
    });

    const fmt = (n: number) => n.toFixed(4);

    return (
        <div class="mmp-root">
            <div class="mmp-header">
                <div>
                    <h1 class="mmp-title">Price Direction</h1>
                    <p class="mmp-subtitle">Control market trend, target price, and phase</p>
                </div>
                <button onClick={handleSave} disabled={saving()} class={`mmp-save-btn ${saved() ? 'saved' : ''}`}>
                    <Show when={saving()} fallback={
                        <Show when={saved()} fallback={
                            <>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 5L6 12l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                                <span>Save Changes</span>
                            </>
                        }>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 5L6 12l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                            <span>Saved</span>
                        </Show>
                    }>
                        <div class="mmp-spin" />
                        <span>Saving...</span>
                    </Show>
                </button>
            </div>

            <Show when={!loading()} fallback={<div class="mmp-loading"><div class="mmp-spin" /></div>}>
                {/* Trend Mode */}
                <div class="mmp-section">
                    <h2 class="mmp-section-title">Trend Mode</h2>
                    <div class="mmp-mode-grid">
                        <For each={['bullish', 'neutral', 'bearish', 'custom'] as TrendMode[]}>
                            {(mode) => (
                                <button
                                    onClick={() => selectMode(mode)}
                                    class={`mmp-mode-btn ${config().mode === mode ? 'active' : ''} ${mode}`}
                                >
                                    <div class="mmp-mode-icon">
                                        {mode === 'bullish' && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 14l4-4 3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M12 8h4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}
                                        {mode === 'neutral' && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><path d="M7 7l-3 3 3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M13 7l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}
                                        {mode === 'bearish' && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 6l4 4 3-3 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /><path d="M12 12h4v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>}
                                        {mode === 'custom' && <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" /><circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5" /></svg>}
                                    </div>
                                    <span class="mmp-mode-label">{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
                                    <span class="mmp-mode-desc">{MODE_PRESETS[mode].desc}</span>
                                </button>
                            )}
                        </For>
                    </div>
                </div>

                {/* Target Price & Trend Bias */}
                <div class="mmp-two-col">
                    <div class="mmp-section">
                        <h2 class="mmp-section-title">Target Price</h2>
                        <div class="mmp-input-group">
                            <label class="mmp-label">Target (USDT)</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={config().targetPrice}
                                onChange={(e) => {
                                    const val = parseFloat(e.currentTarget.value);
                                    update('targetPrice', isNaN(val) ? 0 : val);
                                }}
                                class="mmp-input"
                            />
                        </div>
                        <div class="mmp-current-price">
                            Current: <span class="mmp-price-val">${fmt(currentPrice())}</span>
                            <span class={`mmp-price-arrow ${config().targetPrice > currentPrice() ? 'up' : config().targetPrice < currentPrice() ? 'dn' : ''}`}>
                                {config().targetPrice > currentPrice() ? ' +' : config().targetPrice < currentPrice() ? ' ' : ' ='}
                                {((config().targetPrice - currentPrice()) / currentPrice() * 100).toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    <div class="mmp-section">
                        <h2 class="mmp-section-title">Trend Bias</h2>
                        <div class="mmp-slider-group">
                            <input
                                type="range"
                                min="-1"
                                max="1"
                                step="0.0001"
                                value={config().trendBias}
                                onInput={(e) => update('trendBias', parseFloat(e.currentTarget.value))}
                                class="mmp-slider"
                                disabled={config().mode !== 'custom' && config().mode !== 'bullish' && config().mode !== 'bearish'}
                            />
                            <div class="mmp-slider-labels">
                                <span>-1.0 Bearish</span>
                                <span class={`mmp-bias-val ${config().trendBias > 0.05 ? 'up' : config().trendBias < -0.05 ? 'dn' : ''}`}>
                                    {config().trendBias > 0 ? '+' : ''}{config().trendBias.toFixed(2)}
                                </span>
                                <span>Bullish +1.0</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Movement & Volume Intensity */}
                <div class="mmp-two-col">
                    <div class="mmp-section">
                        <h2 class="mmp-section-title">Movement Style</h2>
                        <div style="display: flex; gap: 8px;">
                            <For each={['gradual', 'aggressive', 'natural']}>
                                {(style) => (
                                    <button
                                        onClick={() => update('movementStyle', style)}
                                        class={`mmp-choice-btn ${config().movementStyle === style ? 'active' : ''}`}
                                    >
                                        {style.charAt(0).toUpperCase() + style.slice(1)}
                                    </button>
                                )}
                            </For>
                        </div>
                        <p style="font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 8px;">
                            {config().movementStyle === 'gradual' ? 'Slow, steady climb with wall movements.' :
                                config().movementStyle === 'aggressive' ? 'Push price with coordinated market orders.' :
                                    'Mimic organic market participants.'}
                        </p>
                    </div>

                    <div class="mmp-section">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <h2 class="mmp-section-title" style="margin: 0;">Organic Volume Intensity</h2>
                            <div style="display: flex; gap: 12px; align-items: center;">
                                <div class="mmp-toggle-group">
                                    <span class="mmp-label-sm">24h Cycle</span>
                                    <button
                                        class={`mmp-toggle-btn ${config().volumeCycleEnabled ? 'active' : ''}`}
                                        onClick={() => update('volumeCycleEnabled', !config().volumeCycleEnabled)}
                                    >
                                        <div class="mmp-toggle-slider" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="mmp-slider-group">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={config().volumeIntensity}
                                onInput={(e) => update('volumeIntensity', parseFloat(e.currentTarget.value))}
                                class="mmp-slider vol"
                            />
                            <div class="mmp-slider-labels">
                                <span>None</span>
                                <span class="mmp-bias-val" style="color: #38bdf8;">
                                    {(config().volumeIntensity * 100).toFixed(0)}%
                                </span>
                                <span>High Liquidity</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Volume Scheduler Grid */}
                <div class="mmp-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <h2 class="mmp-section-title" style="margin-bottom: 4px;">Volume Scheduler (Multiplier)</h2>
                            <p style="font-size: 10px; color: rgba(255,255,255,0.3);">
                                Set hourly multipliers. System adds ±10% random jitter for organic feel. (UTC Time)
                            </p>
                        </div>
                        <button class="mmp-choice-btn" style="flex: none; padding: 4px 12px;" onClick={() => {
                            const reset = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i, 1]));
                            update('volumeSchedule', reset);
                        }}>Reset All to 1x</button>
                    </div>
                    <div class="mmp-hour-grid">
                        <For each={Array.from({ length: 24 }, (_, i) => i)}>
                            {(hour) => (
                                <div class="mmp-hour-cell">
                                    <span class="mmp-hour-label">{hour.toString().padStart(2, '0')}:00</span>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={config().volumeSchedule?.[hour] ?? 1}
                                        onChange={(e) => {
                                            const val = parseFloat(e.currentTarget.value);
                                            const newSched = { ...config().volumeSchedule, [hour]: isNaN(val) ? 1 : val };
                                            update('volumeSchedule', newSched);
                                        }}
                                        class="mmp-hour-input"
                                    />
                                </div>
                            )}
                        </For>
                    </div>
                </div>

                {/* Trend Speed */}
                <div class="mmp-section">
                    <h2 class="mmp-section-title">Trend Speed</h2>
                    <div class="mmp-speed-grid">
                        <For each={['slow', 'medium', 'fast'] as TrendSpeed[]}>
                            {(speed) => (
                                <button
                                    onClick={() => { update('trendSpeed', speed); setCustomSpeed(false); }}
                                    class={`mmp-speed-btn ${!customSpeed() && config().trendSpeed === speed ? 'active' : ''}`}
                                >
                                    <span class="mmp-speed-label">{SPEED_MAP[speed].label}</span>
                                    <span class="mmp-speed-rate">{SPEED_MAP[speed].rate}</span>
                                </button>
                            )}
                        </For>
                        <button
                            onClick={() => { setCustomSpeed(true); update('trendSpeed', 0.0003); }}
                            class={`mmp-speed-btn ${customSpeed() ? 'active' : ''}`}
                        >
                            <span class="mmp-speed-label">Custom</span>
                            <Show when={customSpeed()}>
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={typeof config().trendSpeed === 'number' ? config().trendSpeed : 0.0003}
                                    onChange={(e) => {
                                        const val = parseFloat(e.currentTarget.value);
                                        update('trendSpeed', isNaN(val) ? 0.0003 : val);
                                    }}
                                    class="mmp-speed-input"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </Show>
                        </button>
                    </div>
                </div>

                {/* Price Range */}
                <div class="mmp-section">
                    <h2 class="mmp-section-title">Price Range Limits</h2>
                    <div class="mmp-range-grid">
                        <div class="mmp-input-group">
                            <label class="mmp-label">Floor (USDT)</label>
                            <input type="number" step="0.0001" value={config().priceFloor} onChange={(e) => { const v = parseFloat(e.currentTarget.value); update('priceFloor', isNaN(v) ? 0 : v); }} class="mmp-input" />
                        </div>
                        <div class="mmp-input-group">
                            <label class="mmp-label">Ceiling (USDT)</label>
                            <input type="number" step="0.0001" value={config().priceCeiling} onChange={(e) => { const v = parseFloat(e.currentTarget.value); update('priceCeiling', isNaN(v) ? 0 : v); }} class="mmp-input" />
                        </div>
                        <div class="mmp-input-group">
                            <label class="mmp-label">Band Width (%)</label>
                            <input type="number" step="0.0001" value={config().priceRangePercent} onChange={(e) => { const v = parseFloat(e.currentTarget.value); update('priceRangePercent', isNaN(v) ? 20 : v); }} class="mmp-input" />
                            <span class="mmp-input-hint">+-{config().priceRangePercent}% from base</span>
                        </div>
                    </div>
                </div>

                {/* Phase Control */}
                <div class="mmp-section">
                    <h2 class="mmp-section-title">Phase Control</h2>
                    <div class="mmp-phase-grid">
                        <For each={Object.entries(PHASE_INFO)}>
                            {([key, info]) => (
                                <button
                                    onClick={() => selectPhase(key as Phase)}
                                    class={`mmp-phase-btn ${config().phase === key ? 'active' : ''}`}
                                >
                                    <span class="mmp-phase-label">{info.label}</span>
                                    <span class="mmp-phase-desc">{info.desc}</span>
                                </button>
                            )}
                        </For>
                    </div>
                    <div class="mmp-phase-options">
                        <label class="mmp-checkbox">
                            <input type="checkbox" checked={config().phaseAutoRotate} onChange={(e) => update('phaseAutoRotate', e.currentTarget.checked)} />
                            <span>Auto-Rotate Phases</span>
                        </label>
                        <Show when={config().phaseAutoRotate}>
                            <div class="mmp-inline-input">
                                <span>Interval:</span>
                                <input type="number" step="0.0001" min="1" max="168" value={config().phaseRotateInterval} onChange={(e) => { const v = parseFloat(e.currentTarget.value); update('phaseRotateInterval', isNaN(v) ? 24 : v); }} class="mmp-input-sm" />
                                <span>hours</span>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* Preview */}
                <div class="mmp-section mmp-preview">
                    <h2 class="mmp-section-title">Direction Preview</h2>
                    <div class="mmp-preview-content">
                        <div class="mmp-preview-row">
                            <div class="mmp-preview-item">
                                <span class="mmp-preview-label">Current</span>
                                <span class="mmp-preview-val">${fmt(currentPrice())}</span>
                            </div>
                            <div class="mmp-preview-arrow">
                                <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
                                    <path d="M2 8h32M30 3l6 5-6 5" stroke="rgba(245,158,11,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </div>
                            <div class="mmp-preview-item">
                                <span class="mmp-preview-label">Target</span>
                                <span class={`mmp-preview-val ${config().targetPrice > currentPrice() ? 'up' : 'dn'}`}>${fmt(config().targetPrice)}</span>
                            </div>
                        </div>
                        <div class="mmp-preview-detail">
                            <Show when={estHoursToTarget() !== Infinity && estHoursToTarget() > 0} fallback={
                                <span>Target reached or no movement configured</span>
                            }>
                                <span>Est. arrival: ~{estHoursToTarget().toFixed(1)} hours</span>
                            </Show>
                            <span>Mode: {config().mode} | Phase: {config().phase} | Bias: {config().trendBias > 0 ? '+' : ''}{config().trendBias.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </Show>

            <style>{`
                .mmp-root { max-width: 900px; }
                .mmp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
                .mmp-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mmp-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mmp-save-btn { display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); color: white; font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; border: none; cursor: pointer; transition: all 0.2s; }
                .mmp-save-btn:hover { transform: scale(1.03); box-shadow: 0 4px 20px rgba(245,158,11,0.3); }
                .mmp-save-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                .mmp-save-btn.saved { background: linear-gradient(135deg, #22c55e, #16a34a); }
                .mmp-loading { display: flex; justify-content: center; padding: 60px; }
                .mmp-spin { width: 28px; height: 28px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mmp-section { margin-bottom: 24px; padding: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; }
                .mmp-section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.5); margin: 0 0 14px; }

                .mmp-mode-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                .mmp-mode-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 10px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; text-align: center; }
                .mmp-mode-btn:hover { border-color: rgba(255,255,255,0.12); color: white; }
                .mmp-mode-btn.active.bullish { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.06); color: #22c55e; }
                .mmp-mode-btn.active.neutral { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.06); color: #f59e0b; }
                .mmp-mode-btn.active.bearish { border-color: rgba(239,68,68,0.4); background: rgba(239,68,68,0.06); color: #ef4444; }
                .mmp-mode-btn.active.custom { border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.06); color: #8b5cf6; }
                .mmp-mode-icon { margin-bottom: 2px; }
                .mmp-mode-label { font-size: 14px; font-weight: 800; }
                .mmp-mode-desc { font-size: 10px; opacity: 0.6; line-height: 1.3; }

                .mmp-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .mmp-input-group { display: flex; flex-direction: column; gap: 6px; }
                .mmp-label { font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; }
                .mmp-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.12); border-radius: 10px; padding: 10px 14px; color: white; font-size: 15px; font-weight: 700; font-family: monospace; outline: none; transition: border-color 0.2s; width: 100%; box-sizing: border-box; }
                .mmp-input:focus { border-color: rgba(245,158,11,0.4); }
                .mmp-input-hint { font-size: 10px; color: rgba(255,255,255,0.25); }
                .mmp-current-price { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.4); }
                .mmp-price-val { font-weight: 800; color: white; font-family: monospace; }
                .mmp-price-arrow { font-weight: 700; }
                .mmp-price-arrow.up { color: #22c55e; }
                .mmp-price-arrow.dn { color: #ef4444; }

                .mmp-slider-group { padding-top: 8px; }
                .mmp-slider { width: 100%; height: 6px; border-radius: 3px; appearance: none; background: linear-gradient(to right, #ef4444, rgba(255,255,255,0.1) 45%, rgba(255,255,255,0.1) 55%, #22c55e); outline: none; cursor: pointer; }
                .mmp-slider::-webkit-slider-thumb { appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #f59e0b; border: 3px solid #0a0808; box-shadow: 0 0 8px rgba(245,158,11,0.4); cursor: pointer; }
                .mmp-slider:disabled { opacity: 0.4; cursor: not-allowed; }
                .mmp-slider-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 10px; color: rgba(255,255,255,0.3); }
                .mmp-bias-val { font-size: 16px; font-weight: 900; font-family: monospace; }
                .mmp-bias-val.up { color: #22c55e; }
                .mmp-bias-val.dn { color: #ef4444; }

                .mmp-speed-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
                .mmp-speed-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; }
                .mmp-speed-btn:hover { border-color: rgba(255,255,255,0.12); }
                .mmp-speed-btn.active { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.06); color: #f59e0b; }
                .mmp-speed-label { font-weight: 800; font-size: 13px; }
                .mmp-speed-rate { font-size: 10px; opacity: 0.6; }
                .mmp-speed-input { width: 80px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.2); border-radius: 6px; padding: 4px 8px; color: #f59e0b; font-size: 11px; font-family: monospace; outline: none; text-align: center; margin-top: 4px; }

                .mmp-choice-btn { flex: 1; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); font-size: 11px; font-weight: 800; cursor: pointer; transition: all 0.2s; }
                .mmp-choice-btn:hover { border-color: rgba(255,255,255,0.12); color: white; }
                .mmp-choice-btn.active { background: rgba(56, 189, 248, 0.1); border-color: #38bdf8; color: #38bdf8; }
                .mmp-slider.vol { background: linear-gradient(to right, rgba(255,255,255,0.05), #38bdf8); }
                .mmp-slider.vol::-webkit-slider-thumb { background: #38bdf8; box-shadow: 0 0 8px rgba(56, 189, 248, 0.4); }

                .mmp-range-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }

                .mmp-phase-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
                .mmp-phase-btn { padding: 12px 8px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); cursor: pointer; transition: all 0.2s; text-align: center; }
                .mmp-phase-btn:hover { border-color: rgba(255,255,255,0.12); }
                .mmp-phase-btn.active { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.06); color: #f59e0b; }
                .mmp-phase-label { display: block; font-weight: 800; font-size: 12px; margin-bottom: 3px; }
                .mmp-phase-desc { display: block; font-size: 9px; opacity: 0.6; line-height: 1.3; }
                .mmp-phase-options { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
                .mmp-toggle-group { display: flex; align-items: center; gap: 8px; }
                .mmp-toggle-btn { width: 36px; height: 20px; border-radius: 10px; background: rgba(255,255,255,0.1); border: none; cursor: pointer; position: relative; transition: all 0.2s; }
                .mmp-toggle-btn.active { background: #38bdf8; }
                .mmp-toggle-slider { width: 14px; height: 14px; border-radius: 7px; background: white; position: absolute; top: 3px; left: 3px; transition: all 0.2s; }
                .mmp-toggle-btn.active .mmp-toggle-slider { left: 19px; }
                .mmp-label-sm { font-size: 10px; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase; }

                .mmp-hour-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px; margin-top: 4px; }
                @media (max-width: 1200px) { .mmp-hour-grid { grid-template-columns: repeat(6, 1fr); } }
                @media (max-width: 600px) { .mmp-hour-grid { grid-template-columns: repeat(4, 1fr); } }
                .mmp-hour-cell { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; }
                .mmp-hour-label { font-size: 9px; color: rgba(255,255,255,0.3); font-family: monospace; }
                .mmp-hour-input { width: 100%; background: transparent; border: none; color: #38bdf8; font-size: 13px; font-weight: 800; text-align: center; outline: none; -moz-appearance: textfield; }
                .mmp-hour-input::-webkit-outer-spin-button, .mmp-hour-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .mmp-hour-input:focus { color: white; }
                .mmp-checkbox { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.5); cursor: pointer; }
                .mmp-checkbox input { accent-color: #f59e0b; }
                .mmp-inline-input { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.4); }
                .mmp-input-sm { width: 60px; background: rgba(0,0,0,0.3); border: 1px solid rgba(245,158,11,0.12); border-radius: 6px; padding: 4px 8px; color: white; font-size: 12px; outline: none; text-align: center; }

                .mmp-preview { border-color: rgba(245,158,11,0.12); }
                .mmp-preview-content { padding: 16px; background: rgba(0,0,0,0.2); border-radius: 12px; }
                .mmp-preview-row { display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 14px; }
                .mmp-preview-item { text-align: center; }
                .mmp-preview-label { display: block; font-size: 10px; font-weight: 800; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
                .mmp-preview-val { font-size: 22px; font-weight: 900; font-family: monospace; }
                .mmp-preview-val.up { color: #22c55e; }
                .mmp-preview-val.dn { color: #ef4444; }
                .mmp-preview-arrow { opacity: 0.5; }
                .mmp-preview-detail { text-align: center; font-size: 11px; color: rgba(255,255,255,0.35); display: flex; flex-direction: column; gap: 4px; }

                @media (max-width: 768px) {
                    .mmp-mode-grid { grid-template-columns: repeat(2, 1fr); }
                    .mmp-two-col { grid-template-columns: 1fr; }
                    .mmp-range-grid { grid-template-columns: 1fr 1fr; }
                    .mmp-phase-grid { grid-template-columns: repeat(3, 1fr); }
                    .mmp-speed-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
