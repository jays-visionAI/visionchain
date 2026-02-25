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
    const [phaseSuccess, setPhaseSuccess] = createSignal('');
    const [capMsg, setCapMsg] = createSignal<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

    // Capitulation state
    const [targetWhale, setTargetWhale] = createSignal('all');
    const [dropPercent, setDropPercent] = createSignal(15);
    const [dumpAmount, setDumpAmount] = createSignal(500000);

    // Strategy Constraints
    const [minVCN, setMinVCN] = createSignal(500000);
    const [minUSDT, setMinUSDT] = createSignal(50000);
    const [autoDowngrade, setAutoDowngrade] = createSignal(true);
    const [constraintSaveMsg, setConstraintSaveMsg] = createSignal('');
    const [alerts, setAlerts] = createSignal<any[]>([]);

    // Vesting Schedule
    const [vestingEntries, setVestingEntries] = createSignal<{ date: string; amount: number; label: string }[]>([]);
    const [newVestDate, setNewVestDate] = createSignal('');
    const [newVestAmount, setNewVestAmount] = createSignal(0);
    const [newVestLabel, setNewVestLabel] = createSignal('');
    const [vestSaveMsg, setVestSaveMsg] = createSignal('');

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
                body: JSON.stringify({ action: 'getAnalyticsHistory', limit: 60 })
            });
            const analyticsData = await analyticsRes.json();
            if (analyticsData.success) {
                setPnlHistory(analyticsData.history || []);
            }

            // Load strategy constraints
            try {
                const cSnap = await getDoc(doc(db, 'dex/config/strategy-constraints/current'));
                if (cSnap.exists()) {
                    const c = cSnap.data();
                    setMinVCN(c.minVCN ?? 500000);
                    setMinUSDT(c.minUSDT ?? 50000);
                    setAutoDowngrade(c.autoDowngrade ?? true);
                    setVestingEntries(c.vestingSchedule || []);
                }
                // Load recent alerts
                const alertSnap = await getDocs(query(collection(db, 'dex/analytics/alerts'), limit(5)));
                const al: any[] = [];
                alertSnap.forEach(d => al.push(d.data()));
                setAlerts(al.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
            } catch (e) { /* constraints not yet saved */ }

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

    const triggerCapitulation = async () => {
        if (!confirm(`경고: Flash-Crash를 실행하면 시장 가격이 즉시 -${dropPercent()}% 급락합니다.\n\n타겟: ${targetWhale() === 'all' ? '전체 취약 지갑' : targetWhale()}\n덤프: ${dumpAmount().toLocaleString()} VCN\n\n계속하시겠습니까?`)) return;
        setSaving(true);
        setCapMsg({ text: '', type: null });
        try {
            await setDoc(doc(db, 'dex/config/trading-settings/current'), {
                capitulation: {
                    active: true,
                    targetUid: targetWhale(),
                    dropPercent: dropPercent(),
                    dumpAmount: dumpAmount()
                },
                updatedAt: new Date(),
                updatedBy: getAdminFirebaseAuth().currentUser?.email || 'admin'
            }, { merge: true });
            setCapMsg({ text: `Flash-Crash 실행 완료! 다음 라운드(-${dropPercent()}%)가 트리거됩니다.`, type: 'success' });
            setTimeout(() => setCapMsg({ text: '', type: null }), 6000);
        } catch (e: any) {
            setCapMsg({ text: `오류: ${e.message}`, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const setMacroPhase = async (phaseName: string, mode: string, bias: number, speed: string, targetMultiplier: number, label: string) => {
        if (!confirm(`페이즈를 "${label}"으로 변경하시겠습니까?\n\n모드: ${mode} | 바이어스: ${bias > 0 ? '+' : ''}${bias} | 스피드: ${speed}\n타겟가: 현재시세 x ${targetMultiplier}`)) return;
        setSaving(true);
        setPhaseSuccess('');
        try {
            const currentMktPrice = market()?.lastPrice || 0.1;
            await setDoc(doc(db, 'dex/config/trading-settings/current'), {
                priceDirection: {
                    phase: phaseName,
                    mode,
                    trendBias: bias,
                    trendSpeed: speed,
                    movementStyle: (phaseName === 'markup' || phaseName === 'markdown') ? 'aggressive' : 'gradual',
                    targetPrice: parseFloat((currentMktPrice * targetMultiplier).toFixed(4)),
                    currentBasePrice: currentMktPrice
                },
                updatedAt: new Date(),
                updatedBy: getAdminFirebaseAuth().currentUser?.email || 'admin'
            }, { merge: true });
            setPhaseSuccess(phaseName);
            setTimeout(() => { setPhaseSuccess(''); loadData(); }, 2500);
        } catch (e: any) {
            alert(`오류: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const saveConstraints = async () => {
        setSaving(true);
        setConstraintSaveMsg('');
        try {
            await setDoc(doc(db, 'dex/config/strategy-constraints/current'), {
                minVCN: minVCN(),
                minUSDT: minUSDT(),
                autoDowngrade: autoDowngrade(),
                vestingSchedule: vestingEntries(),
                updatedAt: new Date(),
                updatedBy: getAdminFirebaseAuth().currentUser?.email || 'admin'
            }, { merge: true });
            setConstraintSaveMsg('저장 완료');
            setTimeout(() => setConstraintSaveMsg(''), 3000);
        } catch (e: any) {
            setConstraintSaveMsg(`오류: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const addVestingEntry = () => {
        if (!newVestDate() || !newVestAmount()) return;
        setVestingEntries(prev => [
            ...prev,
            { date: newVestDate(), amount: newVestAmount(), label: newVestLabel() || '언락 이벤트' }
        ].sort((a, b) => a.date.localeCompare(b.date)));
        setNewVestDate(''); setNewVestAmount(0); setNewVestLabel('');
    };

    const removeVestingEntry = (idx: number) => {
        setVestingEntries(prev => prev.filter((_, i) => i !== idx));
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

                {/* ── Macro Strategy Phase Control ── */}
                <div class="mmd-section">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <div>
                            <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin: 0;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f97316;">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                                Macro Strategy Phase Control
                            </h2>
                            <p style="color: #64748b; font-size: 12px; margin: 6px 0 0;">현재 페이즈: <span style={{
                                'font-weight': '800',
                                'color': tradingSettings()?.priceDirection?.phase === 'markup' ? '#38bdf8' :
                                    tradingSettings()?.priceDirection?.phase === 'markdown' ? '#f43f5e' :
                                        tradingSettings()?.priceDirection?.phase === 'accumulation' ? '#34d399' :
                                            tradingSettings()?.priceDirection?.phase === 'distribution' ? '#a855f7' : '#94a3b8'
                            }}>{(tradingSettings()?.priceDirection?.phase || 'ranging').toUpperCase()}</span>
                                &nbsp;&nbsp;|&nbsp;&nbsp;타겟: <span style="color: #fbbf24; font-weight: 800;">${fmt(tradingSettings()?.priceDirection?.targetPrice || 0)}</span>
                                &nbsp;&nbsp;|&nbsp;&nbsp;바이어스: <span style={{
                                    'font-weight': '800',
                                    'color': (tradingSettings()?.priceDirection?.trendBias || 0) > 0 ? '#34d399' :
                                        (tradingSettings()?.priceDirection?.trendBias || 0) < 0 ? '#f43f5e' : '#94a3b8'
                                }}>{(tradingSettings()?.priceDirection?.trendBias || 0) > 0 ? '+' : ''}{(tradingSettings()?.priceDirection?.trendBias || 0).toFixed(2)}</span></p>
                        </div>
                        <Show when={saving()}>
                            <div style="width: 20px; height: 20px; border: 2px solid rgba(249,115,22,0.3); border-top-color: #f97316; border-radius: 50%; animation: spin 0.7s linear infinite;"></div>
                        </Show>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 8px;">
                        {/* Accumulation */}
                        <button
                            disabled={saving()}
                            onClick={() => setMacroPhase('accumulation', 'bullish', 0.15, 'slow', 1.5, '매집 (Accumulation)')}
                            style={{
                                'position': 'relative',
                                'background': tradingSettings()?.priceDirection?.phase === 'accumulation' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                                'border': tradingSettings()?.priceDirection?.phase === 'accumulation' ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.08)',
                                'border-radius': '14px', 'padding': '18px 12px', 'text-align': 'center',
                                'cursor': saving() ? 'not-allowed' : 'pointer', 'transition': 'all 0.2s',
                                'opacity': saving() ? '0.6' : '1',
                                'box-shadow': tradingSettings()?.priceDirection?.phase === 'accumulation' ? '0 0 20px rgba(52, 211, 153, 0.15)' : 'none'
                            }}>
                            <Show when={phaseSuccess() === 'accumulation'}>
                                <div style="position: absolute; inset: 0; background: rgba(52, 211, 153, 0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </Show>
                            <div style="color: #34d399; margin-bottom: 10px; display: flex; justify-content: center;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"></path><path d="m7 16 4-4 4 4 5-5"></path></svg>
                            </div>
                            <div style="color: #e2e8f0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">매집</div>
                            <div style="color: #34d399; font-size: 11px; font-weight: 700;">Accumulation</div>
                            <div style="color: #64748b; font-size: 10px; margin-top: 6px;">Bias +0.15 | Slow</div>
                            <div style="color: #475569; font-size: 10px;">Target x1.5</div>
                        </button>

                        {/* Markup / Pump */}
                        <button
                            disabled={saving()}
                            onClick={() => setMacroPhase('markup', 'bullish', 0.8, 'fast', 3.0, '급등 (Markup/Pump)')}
                            style={{
                                'position': 'relative',
                                'background': tradingSettings()?.priceDirection?.phase === 'markup' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                                'border': tradingSettings()?.priceDirection?.phase === 'markup' ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)',
                                'border-radius': '14px', 'padding': '18px 12px', 'text-align': 'center',
                                'cursor': saving() ? 'not-allowed' : 'pointer', 'transition': 'all 0.2s',
                                'opacity': saving() ? '0.6' : '1',
                                'box-shadow': tradingSettings()?.priceDirection?.phase === 'markup' ? '0 0 20px rgba(56, 189, 248, 0.15)' : 'none'
                            }}>
                            <Show when={phaseSuccess() === 'markup'}>
                                <div style="position: absolute; inset: 0; background: rgba(56, 189, 248, 0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </Show>
                            <div style="color: #38bdf8; margin-bottom: 10px; display: flex; justify-content: center;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                            </div>
                            <div style="color: #e2e8f0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">급등</div>
                            <div style="color: #38bdf8; font-size: 11px; font-weight: 700;">Markup / Pump</div>
                            <div style="color: #64748b; font-size: 10px; margin-top: 6px;">Bias +0.80 | Fast</div>
                            <div style="color: #475569; font-size: 10px;">Target x3.0</div>
                        </button>

                        {/* Ranging */}
                        <button
                            disabled={saving()}
                            onClick={() => setMacroPhase('ranging', 'neutral', 0.0, 'slow', 1.0, '횡보 (Ranging)')}
                            style={{
                                'position': 'relative',
                                'background': tradingSettings()?.priceDirection?.phase === 'ranging' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                                'border': tradingSettings()?.priceDirection?.phase === 'ranging' ? '2px solid #94a3b8' : '1px solid rgba(255,255,255,0.08)',
                                'border-radius': '14px', 'padding': '18px 12px', 'text-align': 'center',
                                'cursor': saving() ? 'not-allowed' : 'pointer', 'transition': 'all 0.2s',
                                'opacity': saving() ? '0.6' : '1',
                                'box-shadow': tradingSettings()?.priceDirection?.phase === 'ranging' ? '0 0 20px rgba(148, 163, 184, 0.1)' : 'none'
                            }}>
                            <Show when={phaseSuccess() === 'ranging'}>
                                <div style="position: absolute; inset: 0; background: rgba(148, 163, 184, 0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </Show>
                            <div style="color: #94a3b8; margin-bottom: 10px; display: flex; justify-content: center;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                            </div>
                            <div style="color: #e2e8f0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">횡보</div>
                            <div style="color: #94a3b8; font-size: 11px; font-weight: 700;">Ranging</div>
                            <div style="color: #64748b; font-size: 10px; margin-top: 6px;">Bias 0.00 | Slow</div>
                            <div style="color: #475569; font-size: 10px;">Target x1.0</div>
                        </button>

                        {/* Distribution */}
                        <button
                            disabled={saving()}
                            onClick={() => setMacroPhase('distribution', 'bearish', -0.1, 'medium', 0.8, '분배 (Distribution)')}
                            style={{
                                'position': 'relative',
                                'background': tradingSettings()?.priceDirection?.phase === 'distribution' ? 'rgba(168, 85, 247, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                                'border': tradingSettings()?.priceDirection?.phase === 'distribution' ? '2px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                                'border-radius': '14px', 'padding': '18px 12px', 'text-align': 'center',
                                'cursor': saving() ? 'not-allowed' : 'pointer', 'transition': 'all 0.2s',
                                'opacity': saving() ? '0.6' : '1',
                                'box-shadow': tradingSettings()?.priceDirection?.phase === 'distribution' ? '0 0 20px rgba(168, 85, 247, 0.15)' : 'none'
                            }}>
                            <Show when={phaseSuccess() === 'distribution'}>
                                <div style="position: absolute; inset: 0; background: rgba(168, 85, 247, 0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </Show>
                            <div style="color: #a855f7; margin-bottom: 10px; display: flex; justify-content: center;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                            </div>
                            <div style="color: #e2e8f0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">분배</div>
                            <div style="color: #a855f7; font-size: 11px; font-weight: 700;">Distribution</div>
                            <div style="color: #64748b; font-size: 10px; margin-top: 6px;">Bias -0.10 | Medium</div>
                            <div style="color: #475569; font-size: 10px;">Target x0.8</div>
                        </button>

                        {/* Markdown / Dump */}
                        <button
                            disabled={saving()}
                            onClick={() => setMacroPhase('markdown', 'bearish', -0.8, 'fast', 0.5, '급락 (Markdown/Dump)')}
                            style={{
                                'position': 'relative',
                                'background': tradingSettings()?.priceDirection?.phase === 'markdown' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(15, 23, 42, 0.6)',
                                'border': tradingSettings()?.priceDirection?.phase === 'markdown' ? '2px solid #f43f5e' : '1px solid rgba(255,255,255,0.08)',
                                'border-radius': '14px', 'padding': '18px 12px', 'text-align': 'center',
                                'cursor': saving() ? 'not-allowed' : 'pointer', 'transition': 'all 0.2s',
                                'opacity': saving() ? '0.6' : '1',
                                'box-shadow': tradingSettings()?.priceDirection?.phase === 'markdown' ? '0 0 20px rgba(244, 63, 94, 0.15)' : 'none'
                            }}>
                            <Show when={phaseSuccess() === 'markdown'}>
                                <div style="position: absolute; inset: 0; background: rgba(244, 63, 94, 0.2); border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                            </Show>
                            <div style="color: #f43f5e; margin-bottom: 10px; display: flex; justify-content: center;">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                            </div>
                            <div style="color: #e2e8f0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">급락</div>
                            <div style="color: #f43f5e; font-size: 11px; font-weight: 700;">Markdown / Dump</div>
                            <div style="color: #64748b; font-size: 10px; margin-top: 6px;">Bias -0.80 | Fast</div>
                            <div style="color: #475569; font-size: 10px;">Target x0.5</div>
                        </button>
                    </div>
                    <p style="color: #334155; font-size: 11px; text-align: center;">페이즈 변경 시 현재 시세 기준으로 타겟가가 자동 계산되어 엔진에 반영됩니다.</p>
                </div>

                {/* ── Capitulation Engine ── */}
                <div class="mmd-section" style="background: linear-gradient(135deg, rgba(244,63,94,0.04) 0%, rgba(15,23,42,0) 60%); border: 1px solid rgba(244,63,94,0.15); border-radius: 20px; padding: 24px;">
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap;">
                        <div style="flex: 1; min-width: 260px;">
                            <h2 style="display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font-size: 18px; font-weight: 900; color: #f43f5e;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                                Flash-Crash Capitulation Engine
                            </h2>
                            <p style="color: #64748b; font-size: 12px; margin: 0 0 20px;">시장 급락을 즉시 시뮬레이션합니다. 손절 주문 트리거 및 타겟 지갑 청산에 사용합니다.</p>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">타겟 지갑</label>
                                    <select
                                        value={targetWhale()}
                                        onInput={(e) => setTargetWhale(e.currentTarget.value)}
                                        style="width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(244,63,94,0.2); border-radius: 8px; color: white; padding: 10px 12px; font-size: 13px; outline: none;"
                                    >
                                        <option value="all">모든 취약 지갑</option>
                                        <For each={whales()}>{(w) => <option value={w.id}>{w.name} ({w.id.substring(0, 8)})</option>}</For>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">덤프 VCN 수량</label>
                                    <input
                                        type="number"
                                        value={dumpAmount()}
                                        onInput={(e) => setDumpAmount(Number(e.currentTarget.value) || 500000)}
                                        style="width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(244,63,94,0.2); border-radius: 8px; color: white; padding: 10px 12px; font-size: 13px; outline: none; box-sizing: border-box;"
                                    />
                                </div>
                            </div>

                            <div style="margin-bottom: 20px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                    <label style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">목표 하락률</label>
                                    <span style="font-size: 16px; font-weight: 900; color: #f43f5e; font-family: monospace;">-{dropPercent()}%</span>
                                </div>
                                <input
                                    type="range" min="5" max="80" step="1"
                                    value={dropPercent()}
                                    onInput={(e) => setDropPercent(Number(e.currentTarget.value))}
                                    style="width: 100%; accent-color: #f43f5e; cursor: pointer;"
                                />
                                <div style="display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-top: 4px;">
                                    <span>-5% (경미)</span><span>-40% (중간)</span><span>-80% (초강력)</span>
                                </div>
                            </div>

                            <Show when={capMsg().type}>
                                <div style={{
                                    'padding': '10px 14px', 'border-radius': '8px', 'font-size': '12px', 'font-weight': '600', 'margin-bottom': '16px',
                                    'background': capMsg().type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                                    'border': capMsg().type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
                                    'color': capMsg().type === 'success' ? '#4ade80' : '#fca5a5'
                                }}>
                                    {capMsg().text}
                                </div>
                            </Show>

                            <button
                                onClick={triggerCapitulation}
                                disabled={saving()}
                                style={{
                                    'width': '100%', 'padding': '14px', 'background': saving() ? 'rgba(244,63,94,0.4)' : 'linear-gradient(135deg, #e11d48, #be123c)',
                                    'color': 'white', 'border': 'none', 'border-radius': '10px', 'font-weight': '900',
                                    'font-size': '14px', 'letter-spacing': '0.05em', 'cursor': saving() ? 'not-allowed' : 'pointer',
                                    'box-shadow': '0 4px 20px rgba(225, 29, 72, 0.4)', 'transition': 'all 0.2s', 'text-transform': 'uppercase'
                                }}
                            >
                                <Show when={!saving()} fallback="실행 중...">
                                    Flash-Crash 실행
                                </Show>
                            </button>
                        </div>

                        {/* Live preview panel */}
                        <div style="min-width: 200px; background: rgba(0,0,0,0.3); border: 1px solid rgba(244,63,94,0.1); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 16px;">
                            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">예상 결과 미리보기</div>
                            <div>
                                <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">현재 시세</div>
                                <div style="font-size: 22px; font-weight: 900; color: #fbbf24; font-family: monospace;">${fmt(market()?.lastPrice || 0)}</div>
                            </div>
                            <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 16px;">
                                <div style="color: #f43f5e; font-size: 11px; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                                    예상 급락 후 시세
                                </div>
                                <div style="font-size: 28px; font-weight: 900; color: #f43f5e; font-family: monospace;">
                                    ${((market()?.lastPrice || 0.1) * (1 - dropPercent() / 100)).toFixed(4)}
                                </div>
                            </div>
                            <div style="border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 16px;">
                                <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">덤프 USDT 가치</div>
                                <div style="font-size: 16px; font-weight: 700; color: #fca5a5; font-family: monospace;">
                                    ~${((dumpAmount() * (market()?.lastPrice || 0.1) * (1 - dropPercent() / 100))).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
                                </div>
                            </div>
                            <div style="background: rgba(244,63,94,0.08); border-radius: 8px; padding: 10px; font-size: 11px; color: #f87171; line-height: 1.6;">
                                이 작업은 되돌릴 수 없습니다. 다음 Engine 라운드에서 즉시 실행됩니다.
                            </div>
                        </div>
                    </div>
                </div>


                {/* ── 1. Strategy Constraints & Alert Panel ── */}
                <div class="mmd-section" style="border: 1px solid rgba(251,191,36,0.15); border-radius: 20px; padding: 24px; background: linear-gradient(135deg, rgba(251,191,36,0.03) 0%, rgba(15,23,42,0) 60%);">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
                        <h2 style="display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; font-weight: 900; color: #fbbf24;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                            Strategy Constraints & Alerts
                        </h2>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <Show when={constraintSaveMsg()}>
                                <span style="font-size: 12px; color: #4ade80; font-weight: 600;">{constraintSaveMsg()}</span>
                            </Show>
                            <button
                                onClick={saveConstraints}
                                disabled={saving()}
                                style={{ 'padding': '8px 20px', 'background': saving() ? 'rgba(251,191,36,0.3)' : 'rgba(251,191,36,0.15)', 'border': '1px solid rgba(251,191,36,0.4)', 'border-radius': '8px', 'color': '#fbbf24', 'font-size': '13px', 'font-weight': '700', 'cursor': 'pointer' }}
                            >저장</button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
                        {/* Min VCN */}
                        <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(52,211,153,0.15); border-radius: 12px; padding: 16px;">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: #34d399;"></div>
                                <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">VCN 최소 재고 하한선</span>
                            </div>
                            <input
                                type="number"
                                value={minVCN()}
                                onInput={(e) => setMinVCN(Number(e.currentTarget.value))}
                                style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(52,211,153,0.2); border-radius: 6px; color: #34d399; padding: 8px 10px; font-size: 14px; font-family: monospace; font-weight: 700; outline: none; box-sizing: border-box;"
                            />
                            <div style="font-size: 10px; color: #475569; margin-top: 6px;">이 수량 이하 → 경보 발생, 자동 다운그레이드</div>
                            <div style={{
                                'margin-top': '8px', 'padding': '6px 10px', 'border-radius': '6px', 'font-size': '12px', 'font-weight': '700',
                                'background': (tradingAgents().reduce((s, a) => s + (a.balances?.VCN || 0), 0)) < minVCN() ? 'rgba(244,63,94,0.15)' : 'rgba(52,211,153,0.1)',
                                'color': (tradingAgents().reduce((s, a) => s + (a.balances?.VCN || 0), 0)) < minVCN() ? '#f43f5e' : '#34d399'
                            }}>
                                현재: {tradingAgents().reduce((s, a) => s + (a.balances?.VCN || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} VCN
                                {(tradingAgents().reduce((s, a) => s + (a.balances?.VCN || 0), 0)) < minVCN() ? ' — 경보!' : ' — 정상'}
                            </div>
                        </div>

                        {/* Min USDT */}
                        <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(56,189,248,0.15); border-radius: 12px; padding: 16px;">
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                                <div style="width: 8px; height: 8px; border-radius: 50%; background: #38bdf8;"></div>
                                <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">USDT 최소 유지선</span>
                            </div>
                            <input
                                type="number"
                                value={minUSDT()}
                                onInput={(e) => setMinUSDT(Number(e.currentTarget.value))}
                                style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(56,189,248,0.2); border-radius: 6px; color: #38bdf8; padding: 8px 10px; font-size: 14px; font-family: monospace; font-weight: 700; outline: none; box-sizing: border-box;"
                            />
                            <div style="font-size: 10px; color: #475569; margin-top: 6px;">이 금액 이하 → Markup 중단, Spread Capture로 전환</div>
                            <div style={{
                                'margin-top': '8px', 'padding': '6px 10px', 'border-radius': '6px', 'font-size': '12px', 'font-weight': '700',
                                'background': (tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0)) < minUSDT() ? 'rgba(244,63,94,0.15)' : 'rgba(56,189,248,0.1)',
                                'color': (tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0)) < minUSDT() ? '#f43f5e' : '#38bdf8'
                            }}>
                                현재: ${tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
                                {(tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0)) < minUSDT() ? ' — 경보!' : ' — 정상'}
                            </div>
                        </div>

                        {/* Auto Downgrade */}
                        <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(168,85,247,0.15); border-radius: 12px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
                            <div>
                                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">자동 페이즈 다운그레이드</div>
                                <div style="font-size: 11px; color: #475569; line-height: 1.6;">임계값 위반 시 Engine이 자동으로 보수적 페이즈(Ranging 또는 Accumulation)로 전환합니다.</div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-top: 16px;">
                                <button
                                    onClick={() => setAutoDowngrade(!autoDowngrade())}
                                    style={{
                                        'width': '44px', 'height': '24px', 'border-radius': '12px', 'border': 'none', 'cursor': 'pointer', 'transition': 'all 0.2s', 'position': 'relative',
                                        'background': autoDowngrade() ? '#a855f7' : 'rgba(255,255,255,0.1)'
                                    }}
                                >
                                    <div style={{
                                        'width': '18px', 'height': '18px', 'border-radius': '50%', 'background': 'white', 'position': 'absolute', 'top': '3px', 'transition': 'all 0.2s',
                                        'left': autoDowngrade() ? '23px' : '3px'
                                    }}></div>
                                </button>
                                <span style={{ 'font-size': '13px', 'font-weight': '700', 'color': autoDowngrade() ? '#a855f7' : '#475569' }}>
                                    {autoDowngrade() ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Alerts */}
                    <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px;">
                        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">최근 Engine 경보 로그</div>
                        <Show when={alerts().length > 0} fallback={
                            <div style="font-size: 12px; color: #1e293b; padding: 10px 0;">Engine이 실행되면 임계값 위반 시 자동 기록됩니다.</div>
                        }>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                <For each={alerts()}>{(al) =>
                                    <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(244,63,94,0.06); border: 1px solid rgba(244,63,94,0.15); border-radius: 6px;">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        <span style="font-size: 11px; color: #fca5a5; flex: 1;">{al.message}</span>
                                        <span style="font-size: 10px; color: #475569;">{al.timestamp ? new Date(al.timestamp.seconds * 1000).toLocaleString('ko-KR') : ''}</span>
                                    </div>
                                }</For>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* ── 2. Phase Transition Rules ── */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #818cf8;"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                        Phase Transition Rules
                    </h2>
                    <p style="color: #475569; font-size: 12px; margin: 0 0 20px;">각 페이즈에 진입하기 위한 조건입니다. Engine이 매 라운드 체크합니다.</p>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        {([
                            { phase: 'accumulation', color: '#34d399', label: '매집 (Accumulation)', condition: 'VCN 재고가 최소 유지선의 120% 이하일 때 가능', icon: 'M3 3v18h18M7 16l4-4 4 4 5-5' },
                            { phase: 'ranging', color: '#94a3b8', label: '횡보 (Ranging)', condition: '항상 전환 가능. VCN·USDT 모두 최소선 이상일 때 자동 유지', icon: 'M3 12h18M3 6h18M3 18h18' },
                            { phase: 'markup', color: '#38bdf8', label: '급등 (Markup)', condition: 'VCN 재고 > 최소선 × 2 AND USDT > 최소선 × 1.5 일 때 가능', icon: 'M23 6l-13.5 15.5-5-5-5 7.5M17 6h6v6' },
                            { phase: 'distribution', color: '#a855f7', label: '분배 (Distribution)', condition: 'VCN 재고 > 최소선 × 1.2 이상. USDT 충분히 확보된 상태', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 12h8' },
                            { phase: 'markdown', color: '#f43f5e', label: '급락 (Markdown)', condition: '수동 설정만 가능. 단, USDT > 최소선 × 3 이상 확보 시', icon: 'M23 18l-13.5-15.5-5 5-5-7.5M17 18h6v-6' },
                        ] as any[]).map((r) => {
                            const isActive = tradingSettings()?.priceDirection?.phase === r.phase;
                            const isCurrent = tradingSettings()?.priceDirection?.phase === r.phase;
                            return (
                                <div style={{
                                    'display': 'flex', 'align-items': 'center', 'gap': '14px', 'padding': '14px 16px',
                                    'background': isActive ? `rgba(${r.color === '#34d399' ? '52,211,153' : r.color === '#38bdf8' ? '56,189,248' : r.color === '#94a3b8' ? '148,163,184' : r.color === '#a855f7' ? '168,85,247' : '244,63,94'},0.08)` : 'rgba(15,23,42,0.4)',
                                    'border': `1px solid ${isActive ? r.color : 'rgba(255,255,255,0.06)'}`,
                                    'border-radius': '10px', 'transition': 'all 0.2s'
                                }}>
                                    <div style={{ 'width': '10px', 'height': '10px', 'border-radius': '50%', 'background': r.color, 'flex-shrink': '0' }}></div>
                                    <div style="flex: 1;">
                                        <div style={{ 'font-size': '13px', 'font-weight': '700', 'color': isActive ? r.color : '#e2e8f0', 'margin-bottom': '3px' }}>
                                            {r.label}
                                            {isCurrent && <span style={{ 'margin-left': '8px', 'font-size': '10px', 'padding': '2px 6px', 'background': `rgba(${r.color === '#34d399' ? '52,211,153' : r.color === '#38bdf8' ? '56,189,248' : r.color === '#94a3b8' ? '148,163,184' : r.color === '#a855f7' ? '168,85,247' : '244,63,94'},0.2)`, 'border-radius': '4px', 'color': r.color }}>현재 페이즈</span>}
                                        </div>
                                        <div style="font-size: 11px; color: #475569;">{r.condition}</div>
                                    </div>
                                    <div style={{
                                        'font-size': '11px', 'padding': '4px 8px', 'border-radius': '4px', 'font-weight': '600',
                                        'background': 'rgba(255,255,255,0.04)', 'color': '#475569', 'white-space': 'nowrap'
                                    }}>
                                        {r.phase === 'markup'
                                            ? (tradingAgents().reduce((s, a) => s + (a.balances?.VCN || 0), 0) >= minVCN() * 2 && tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0) >= minUSDT() * 1.5 ? '진입 가능' : '조건 미충족')
                                            : r.phase === 'markdown'
                                                ? (tradingAgents().reduce((s, a) => s + (a.balances?.USDT || 0), 0) >= minUSDT() * 3 ? '수동 가능' : '조건 미충족')
                                                : '진입 가능'
                                        }
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── 3. Dual Balance Tracker ── */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #34d399;"><path d="M3 3v18h18"></path><path d="m7 12 4-4 4 4 5-5"></path></svg>
                        Dual Balance Tracker
                    </h2>
                    <p style="color: #475569; font-size: 12px; margin: 0 0 20px;">VCN 재고(초록)와 USDT 잔고(파랑)의 시계열 추이 — 모두 초기값 이상을 유지해야 합니다.</p>
                    <Show when={pnlHistory().length >= 2} fallback={
                        <div style="background: rgba(15,23,42,0.4); border: 1px dashed rgba(255,255,255,0.06); border-radius: 12px; padding: 40px; text-align: center; color: #334155; font-size: 12px;">
                            Trading Engine이 실행되면 자동으로 데이터가 채워집니다.
                        </div>
                    }>
                        <div style="background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px;">
                            <SolidApexCharts
                                type="line"
                                height={280}
                                options={{
                                    chart: { background: 'transparent', toolbar: { show: false }, animations: { enabled: true, speed: 400 } },
                                    theme: { mode: 'dark' },
                                    colors: ['#34d399', '#38bdf8'],
                                    dataLabels: { enabled: false },
                                    stroke: { width: [2, 2], curve: 'smooth' },
                                    fill: { type: ['gradient', 'gradient'], gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.0 } },
                                    xaxis: {
                                        categories: pnlHistory().map(h => {
                                            const d = new Date((h.timestamp?.seconds || 0) * 1000);
                                            return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                                        }),
                                        tickAmount: Math.min(8, pnlHistory().length),
                                        axisBorder: { show: false }, axisTicks: { show: false },
                                        labels: { style: { colors: '#475569', fontSize: '10px' } }
                                    },
                                    yaxis: [
                                        {
                                            title: { text: 'VCN 재고', style: { color: '#34d399' } },
                                            labels: {
                                                style: { colors: '#34d399', fontSize: '11px' },
                                                formatter: (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)
                                            }
                                        },
                                        {
                                            opposite: true,
                                            title: { text: 'USDT 잔고', style: { color: '#38bdf8' } },
                                            labels: {
                                                style: { colors: '#38bdf8', fontSize: '11px' },
                                                formatter: (v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}`
                                            }
                                        }
                                    ],
                                    grid: { borderColor: 'rgba(255,255,255,0.04)', strokeDashArray: 4 },
                                    legend: { position: 'top', labels: { colors: '#94a3b8' } },
                                    annotations: {
                                        yaxis: [
                                            { y: minVCN(), borderColor: '#34d399', borderWidth: 1, strokeDashArray: 4, label: { text: `VCN 하한 ${(minVCN() / 1000000).toFixed(1)}M`, style: { color: '#34d399', background: 'transparent', fontSize: '10px' } } },
                                        ]
                                    },
                                    tooltip: { theme: 'dark', shared: true }
                                }}
                                series={[
                                    {
                                        name: 'VCN 재고',
                                        type: 'area',
                                        data: pnlHistory().map(h => {
                                            // netTokenVacuumed = current - initial. We want current VCN = initial + vacuumed
                                            const initial = tradingAgents().length * 5000000;
                                            return +((h.netTokenVacuumed || 0) + initial).toFixed(0);
                                        })
                                    },
                                    {
                                        name: 'USDT 잔고',
                                        type: 'area',
                                        data: pnlHistory().map(h => {
                                            const initialU = tradingAgents().length * 500000;
                                            return +((h.spreadProfitUSDT || 0) + initialU).toFixed(0);
                                        })
                                    }
                                ]}
                            />
                        </div>
                    </Show>
                </div>

                {/* ── 4. Vesting Unlock Schedule ── */}
                <div class="mmd-section">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; flex-wrap: wrap; gap: 12px;">
                        <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin: 0;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #f97316;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            Vesting Unlock Schedule
                        </h2>
                        <button
                            onClick={saveConstraints}
                            disabled={saving()}
                            style={{ 'padding': '7px 16px', 'background': 'rgba(249,115,22,0.12)', 'border': '1px solid rgba(249,115,22,0.3)', 'border-radius': '7px', 'color': '#f97316', 'font-size': '12px', 'font-weight': '700', 'cursor': 'pointer' }}
                        >저장</button>
                    </div>
                    <p style="color: #475569; font-size: 12px; margin: 0 0 20px;">예정된 토큰 언락 일정을 등록하면, Engine이 해당 날짜 전 자동으로 유동성을 보수적으로 조정합니다.</p>

                    {/* Add entry */}
                    <div style="display: grid; grid-template-columns: auto 1fr 1fr auto; gap: 10px; margin-bottom: 16px; align-items: end;">
                        <div>
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 600;">날짜</div>
                            <input type="date" value={newVestDate()} onInput={(e) => setNewVestDate(e.currentTarget.value)}
                                style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: white; padding: 8px 10px; font-size: 13px; outline: none; width: 140px;" />
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 600;">언락 수량 (VCN)</div>
                            <input type="number" value={newVestAmount() || ''} onInput={(e) => setNewVestAmount(Number(e.currentTarget.value))}
                                placeholder="예: 5000000"
                                style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: white; padding: 8px 10px; font-size: 13px; outline: none; box-sizing: border-box;" />
                        </div>
                        <div>
                            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-weight: 600;">라벨</div>
                            <input type="text" value={newVestLabel()} onInput={(e) => setNewVestLabel(e.currentTarget.value)}
                                placeholder="예: Round 1 언락"
                                style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 7px; color: white; padding: 8px 10px; font-size: 13px; outline: none; box-sizing: border-box;" />
                        </div>
                        <button onClick={addVestingEntry}
                            style="padding: 8px 14px; background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.3); border-radius: 7px; color: #f97316; font-weight: 700; font-size: 13px; cursor: pointer; white-space: nowrap;">
                            + 추가
                        </button>
                    </div>

                    {/* Schedule list */}
                    <Show when={vestingEntries().length > 0} fallback={
                        <div style="text-align: center; padding: 24px; color: #1e293b; font-size: 12px; border: 1px dashed rgba(255,255,255,0.06); border-radius: 10px;">
                            등록된 언락 일정이 없습니다. 위에서 항목을 추가해주세요.
                        </div>
                    }>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <For each={vestingEntries()}>{(entry, idx) => {
                                const daysLeft = Math.ceil((new Date(entry.date).getTime() - Date.now()) / 86400000);
                                const urgency = daysLeft <= 3 ? '#f43f5e' : daysLeft <= 7 ? '#fbbf24' : '#34d399';
                                return (
                                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px;">
                                        <div style={{ 'width': '8px', 'height': '8px', 'border-radius': '50%', 'background': urgency, 'flex-shrink': '0' }}></div>
                                        <div style="flex: 1;">
                                            <div style="font-size: 13px; font-weight: 700; color: #e2e8f0;">{entry.label}</div>
                                            <div style="font-size: 11px; color: #64748b;">{entry.date} — {(entry.amount / 1000000).toFixed(1)}M VCN</div>
                                        </div>
                                        <div style={{ 'font-size': '12px', 'font-weight': '700', 'color': urgency, 'padding': '4px 8px', 'border-radius': '4px', 'background': `${urgency}18`, 'white-space': 'nowrap' }}>
                                            {daysLeft > 0 ? `D-${daysLeft}` : daysLeft === 0 ? 'TODAY' : `D+${Math.abs(daysLeft)} 지남`}
                                        </div>
                                        <button onClick={() => removeVestingEntry(idx())}
                                            style="background: none; border: none; cursor: pointer; color: #334155; padding: 4px;">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                        </button>
                                    </div>
                                );
                            }}</For>
                        </div>
                    </Show>
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
                        </div>
                    </div>
                </div>

                {/* ── Historical Trend Charts (실제 pnlHistory 기반) ── */}
                <div class="mmd-section">
                    <h2 class="mmd-section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #818cf8;">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        Historical Trends
                        <span style="font-size: 11px; padding: 2px 6px; background: rgba(129,140,248,0.12); border: 1px solid rgba(129,140,248,0.25); border-radius: 4px; color: #818cf8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; margin-left: auto;">
                            {pnlHistory().length > 0 ? `${pnlHistory().length} snapshots` : 'Waiting for data...'}
                        </span>
                    </h2>
                    <p style="color: #475569; font-size: 12px; margin: 0 0 24px;">Trading Engine이 1분마다 스냅샷을 저장합니다. 데이터가 쌓일수록 차트가 표시됩니다.</p>

                    <Show when={pnlHistory().length >= 2} fallback={
                        <div style="background: rgba(15, 23, 42, 0.4); border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px; padding: 48px; text-align: center; color: #475569;">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 16px; display: block; opacity: 0.4;"><path d="M3 3v18h18"></path><path d="m7 16 4-4 4 4 5-5"></path></svg>
                            <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">아직 기록된 히스토리가 없습니다</div>
                            <div style="font-size: 12px;">Trading Engine이 실행되면 1분마다 스냅샷이 저장되어 여기에 표시됩니다.</div>
                        </div>
                    }>
                        <div style="display: flex; flex-direction: column; gap: 20px;">

                            {/* Chart 1: Net Token Vacuumed (VCN) */}
                            <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(52, 211, 153, 0.12); border-radius: 16px; padding: 24px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="width: 10px; height: 10px; border-radius: 50%; background: #34d399;"></div>
                                        <span style="color: #e2e8f0; font-size: 14px; font-weight: 700;">Net Token Vacuumed</span>
                                    </div>
                                    <span style="color: #34d399; font-size: 18px; font-weight: 900; font-family: monospace;">
                                        {netTokenVacuumed() >= 0 ? '+' : ''}{netTokenVacuumed().toLocaleString(undefined, { maximumFractionDigits: 0 })} VCN
                                    </span>
                                </div>
                                <p style="color: #475569; font-size: 11px; margin: 0 0 16px; padding-left: 18px;">MM 에이전트가 초기 보유량 대비 순매집/순매도한 VCN 수량 추이</p>
                                <SolidApexCharts
                                    type="area"
                                    height={200}
                                    options={{
                                        chart: { background: 'transparent', toolbar: { show: false }, animations: { enabled: true, speed: 400 } },
                                        theme: { mode: 'dark' },
                                        colors: ['#34d399'],
                                        dataLabels: { enabled: false },
                                        stroke: { curve: 'smooth', width: 2 },
                                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.0, stops: [0, 100] } },
                                        xaxis: {
                                            categories: pnlHistory().map(h => {
                                                const d = new Date((h.timestamp?.seconds || 0) * 1000);
                                                return d.toLocaleTimeString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                            }),
                                            tickAmount: Math.min(8, pnlHistory().length),
                                            axisBorder: { show: false },
                                            axisTicks: { show: false },
                                            labels: { style: { colors: '#475569', fontSize: '10px' }, rotate: -30 }
                                        },
                                        yaxis: {
                                            labels: {
                                                style: { colors: '#64748b', fontSize: '11px' },
                                                formatter: (v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v.toFixed(0)
                                            }
                                        },
                                        grid: { borderColor: 'rgba(255,255,255,0.04)', strokeDashArray: 4 },
                                        tooltip: {
                                            theme: 'dark',
                                            y: { formatter: (v: number) => `${v >= 0 ? '+' : ''}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} VCN` }
                                        }
                                    }}
                                    series={[{ name: 'Net VCN Vacuumed', data: pnlHistory().map(h => +(h.netTokenVacuumed || 0).toFixed(0)) }]}
                                />
                            </div>

                            {/* Chart 2: Spread Strategy PnL (USDT) */}
                            <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(56, 189, 248, 0.12); border-radius: 16px; padding: 24px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="width: 10px; height: 10px; border-radius: 50%; background: #38bdf8;"></div>
                                        <span style="color: #e2e8f0; font-size: 14px; font-weight: 700;">Spread Strategy PnL</span>
                                    </div>
                                    <span style="color: #38bdf8; font-size: 18px; font-weight: 900; font-family: monospace;">
                                        {spreadProfitUSDT() >= 0 ? '+' : ''}${spreadProfitUSDT().toLocaleString(undefined, { maximumFractionDigits: 0 })} USDT
                                    </span>
                                </div>
                                <p style="color: #475569; font-size: 11px; margin: 0 0 16px; padding-left: 18px;">Bid-Ask 스프레드 전략을 통해 누적된 USDT 수익 추이</p>
                                <SolidApexCharts
                                    type="area"
                                    height={200}
                                    options={{
                                        chart: { background: 'transparent', toolbar: { show: false }, animations: { enabled: true, speed: 400 } },
                                        theme: { mode: 'dark' },
                                        colors: ['#38bdf8'],
                                        dataLabels: { enabled: false },
                                        stroke: { curve: 'smooth', width: 2 },
                                        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.0, stops: [0, 100] } },
                                        xaxis: {
                                            categories: pnlHistory().map(h => {
                                                const d = new Date((h.timestamp?.seconds || 0) * 1000);
                                                return d.toLocaleTimeString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                            }),
                                            tickAmount: Math.min(8, pnlHistory().length),
                                            axisBorder: { show: false },
                                            axisTicks: { show: false },
                                            labels: { style: { colors: '#475569', fontSize: '10px' }, rotate: -30 }
                                        },
                                        yaxis: {
                                            labels: {
                                                style: { colors: '#64748b', fontSize: '11px' },
                                                formatter: (v: number) => `$${v >= 1000000 ? `${(v / 1000000).toFixed(2)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}`
                                            }
                                        },
                                        grid: { borderColor: 'rgba(255,255,255,0.04)', strokeDashArray: 4 },
                                        tooltip: {
                                            theme: 'dark',
                                            y: { formatter: (v: number) => `${v >= 0 ? '+' : ''}$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT` }
                                        }
                                    }}
                                    series={[{ name: 'Spread PnL (USDT)', data: pnlHistory().map(h => +(h.spreadProfitUSDT || 0).toFixed(2)) }]}
                                />
                            </div>

                            {/* Chart 3: Total Extracted + VCN Price (dual axis) */}
                            <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(168, 85, 247, 0.12); border-radius: 16px; padding: 24px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        <div style="width: 10px; height: 10px; border-radius: 50%; background: #a855f7;"></div>
                                        <span style="color: #e2e8f0; font-size: 14px; font-weight: 700;">Total Capital Extracted vs. VCN Price</span>
                                    </div>
                                    <span style="color: #a855f7; font-size: 18px; font-weight: 900; font-family: monospace;">
                                        {totalExtractedUSDT() >= 0 ? '+' : ''}${totalExtractedUSDT().toLocaleString(undefined, { maximumFractionDigits: 0 })} USD-EQ
                                    </span>
                                </div>
                                <p style="color: #475569; font-size: 11px; margin: 0 0 16px; padding-left: 18px;">실현+미실현 총 추출 자산(보라)과 VCN 시세(노랑) 비교 — 가격 상승 시 추출 효율 변화 확인</p>
                                <SolidApexCharts
                                    type="line"
                                    height={220}
                                    options={{
                                        chart: { background: 'transparent', toolbar: { show: false }, animations: { enabled: true, speed: 400 } },
                                        theme: { mode: 'dark' },
                                        colors: ['#a855f7', '#fbbf24'],
                                        dataLabels: { enabled: false },
                                        stroke: { width: [2, 2], dashArray: [0, 4], curve: 'smooth' },
                                        fill: { type: ['gradient', 'solid'], gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.0, stops: [0, 100] } },
                                        xaxis: {
                                            categories: pnlHistory().map(h => {
                                                const d = new Date((h.timestamp?.seconds || 0) * 1000);
                                                return d.toLocaleTimeString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                                            }),
                                            tickAmount: Math.min(8, pnlHistory().length),
                                            axisBorder: { show: false },
                                            axisTicks: { show: false },
                                            labels: { style: { colors: '#475569', fontSize: '10px' }, rotate: -30 }
                                        },
                                        yaxis: [
                                            {
                                                title: { text: 'Total Extracted ($)', style: { color: '#a855f7' } },
                                                labels: {
                                                    style: { colors: '#a855f7', fontSize: '11px' },
                                                    formatter: (v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}`
                                                }
                                            },
                                            {
                                                opposite: true,
                                                title: { text: 'VCN Price', style: { color: '#fbbf24' } },
                                                labels: {
                                                    style: { colors: '#fbbf24', fontSize: '11px' },
                                                    formatter: (v: number) => `$${v.toFixed(4)}`
                                                }
                                            }
                                        ],
                                        grid: { borderColor: 'rgba(255,255,255,0.04)', strokeDashArray: 4 },
                                        legend: { position: 'top', labels: { colors: '#94a3b8' } },
                                        tooltip: { theme: 'dark', shared: true }
                                    }}
                                    series={[
                                        { name: 'Total Extracted (USD-EQ)', type: 'area', data: pnlHistory().map(h => +(h.totalExtractedUSDT || 0).toFixed(2)) },
                                        { name: 'VCN Price', type: 'line', data: pnlHistory().map(h => +(h.marketPrice || 0).toFixed(6)) }
                                    ]}
                                />
                            </div>

                            {/* Order Book Imbalance Row */}
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; align-items: center;">
                                    <h3 style="color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; width: 100%; text-align: left;">Order Book Imbalance</h3>
                                    <Show when={(obStats().bidsVol || 0) + (obStats().asksVol || 0) > 0}
                                        fallback={
                                            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; gap: 10px;">
                                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8M12 8v8"></path></svg>
                                                <span style="font-size: 12px; color: #334155; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Coming Soon</span>
                                                <span style="font-size: 11px; color: #1e293b; text-align: center;">오더북 데이터가 쌓이면 자동으로 표시됩니다</span>
                                            </div>
                                        }
                                    >
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
                                            series={[obStats().bidsVol, obStats().asksVol]}
                                        />
                                    </Show>

                                </div>
                                <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 24px; display: flex; flex-direction: column; justify-content: center; gap: 16px;">
                                    <h3 style="color: #94a3b8; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin: 0;">System KPIs</h3>
                                    <div style="display: flex; flex-direction: column; gap: 14px;">
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #64748b; font-size: 12px;">Extraction Efficiency</span>
                                            <span style="color: #f8fafc; font-family: monospace; font-size: 14px; font-weight: 700;">
                                                {Math.abs(spreadProfitUSDT() / (netTokenVacuumed() || 1)).toFixed(4)} USDT/VCN
                                            </span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #64748b; font-size: 12px;">Inventory Drift</span>
                                            <span style={{
                                                'font-family': 'monospace', 'font-size': '14px', 'font-weight': '700',
                                                'color': (netTokenVacuumed() / (initialVCN() || 1)) > 0.05 ? '#fbbf24' : (netTokenVacuumed() / (initialVCN() || 1)) < -0.05 ? '#f43f5e' : '#34d399'
                                            }}>
                                                {((netTokenVacuumed() / (initialVCN() || 1)) * 100).toFixed(2)}%
                                            </span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #64748b; font-size: 12px;">Avg Sell Price</span>
                                            <span style="color: #f8fafc; font-family: monospace; font-size: 14px; font-weight: 700;">
                                                ${avgSellPrice() > 0 ? avgSellPrice().toFixed(4) : '-'}
                                            </span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #64748b; font-size: 12px;">Bid Wall Volume</span>
                                            <span style="color: #34d399; font-family: monospace; font-size: 14px; font-weight: 700;">
                                                {obStats().bidsVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} VCN
                                            </span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between; align-items: center;">
                                            <span style="color: #64748b; font-size: 12px;">Ask Wall Volume</span>
                                            <span style="color: #f43f5e; font-family: monospace; font-size: 14px; font-weight: 700;">
                                                {obStats().asksVol.toLocaleString(undefined, { maximumFractionDigits: 0 })} VCN
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>
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
            </Show >

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
        </div >
    );
}
