import { createSignal, createMemo, onMount, Show, For } from 'solid-js';
import { getAdminFirebaseAuth } from '../../services/firebaseService';

function getApiUrl() {
    if (window.location.hostname.includes('staging') || window.location.hostname === 'localhost') {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/tradingArenaAPI';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/tradingArenaAPI';
}

interface OrderList {
    price: number;
    amount: number;
    agentId?: string;
}

type OperationMode = 'pump' | 'dump' | 'wash';

export default function TradingMarketAction() {
    const [mode, setMode] = createSignal<OperationMode>('pump');
    const [loading, setLoading] = createSignal(true);
    const [executing, setExecuting] = createSignal(false);

    const [bids, setBids] = createSignal<OrderList[]>([]);
    const [asks, setAsks] = createSignal<OrderList[]>([]);
    const [lastPrice, setLastPrice] = createSignal(0.10);

    const [targetPrice, setTargetPrice] = createSignal<number>(0.15);
    const [washVolumeUSDT, setWashVolumeUSDT] = createSignal<number>(50000); // 50k default fake volume

    // Feedback 
    const [message, setMessage] = createSignal<{ text: string; type: 'success' | 'error' | null }>({ text: '', type: null });

    onMount(() => {
        loadOrderBook();
    });

    const loadOrderBook = async () => {
        setLoading(true);
        try {
            const res = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'getOrderBook', full: true }),
            });
            const data = await res.json();
            if (data.success) {
                // Ensure array shape & sorted correctly
                // Bids: descending (highest price first)
                // Asks: ascending (lowest price first)
                const safeBids = (data.bids || []).map((x: any) => ({ ...x, price: parseFloat(x.price), amount: parseFloat(x.amount) }));
                const safeAsks = (data.asks || []).map((x: any) => ({ ...x, price: parseFloat(x.price), amount: parseFloat(x.amount) }));

                setBids(safeBids.sort((a, b) => b.price - a.price));
                setAsks(safeAsks.sort((a, b) => a.price - b.price));
                if (data.lastPrice) {
                    setLastPrice(parseFloat(data.lastPrice));
                    if (mode() === 'pump') setTargetPrice(parseFloat(data.lastPrice) * 1.5);
                    if (mode() === 'dump') setTargetPrice(parseFloat(data.lastPrice) * 0.8);
                }
            }
        } catch (e) {
            console.error('[MarketAction] Error loading OB', e);
        } finally {
            setLoading(false);
        }
    };

    const handleModeSwitch = (m: OperationMode) => {
        setMode(m);
        if (m === 'pump') setTargetPrice(lastPrice() * 1.5);
        if (m === 'dump') setTargetPrice(lastPrice() * 0.8);
    };

    // Calculate simulation for Pump & Dump
    const simulationResult = createMemo(() => {
        if (mode() === 'wash') return null;

        const isPump = mode() === 'pump';
        const target = targetPrice();
        const current = lastPrice();

        let costAsset = 0;   // Pump = USDT required, Dump = VCN required
        let yieldAsset = 0;  // Pump = VCN acquired, Dump = USDT acquired
        let ordersEaten = 0;
        let actualFinalPrice = current;

        // Validation
        if (isPump && target <= current) return { valid: false, reason: "Target must be > current for Pump" };
        if (!isPump && target >= current) return { valid: false, reason: "Target must be < current for Dump" };

        if (isPump) {
            const currentAsks = asks();
            for (const ask of currentAsks) {
                if (ask.price > target) break;
                // Accumulate cost
                costAsset += (ask.price * ask.amount);
                yieldAsset += ask.amount;
                ordersEaten++;
                actualFinalPrice = ask.price;
            }
        } else {
            const currentBids = bids();
            for (const bid of currentBids) {
                if (bid.price < target) break;
                costAsset += bid.amount; // cost in VCN
                yieldAsset += (bid.price * bid.amount); // yield in USDT
                ordersEaten++;
                actualFinalPrice = bid.price;
            }
        }

        const priceImpactPct = Math.abs((actualFinalPrice - current) / current) * 100;

        return {
            valid: true,
            costAsset,
            yieldAsset,
            ordersEaten,
            actualFinalPrice,
            priceImpactPct,
            reason: ""
        };
    });

    const executeAction = async () => {
        const confirmMsg = mode() === 'wash'
            ? `Execute ${washVolumeUSDT().toLocaleString()} USDT Wash Volume?`
            : `Execute Market ${mode().toUpperCase()} to ${targetPrice().toFixed(4)}?`;

        if (!confirm(confirmMsg)) return;

        setExecuting(true);
        setMessage({ text: '', type: null });

        const payload = {
            action: 'executeMarketAction',
            side: mode(),
            type: mode() === 'wash' ? 'volume_generation' : 'sweep',
            amount: mode() === 'wash' ? washVolumeUSDT() : (simulationResult()?.costAsset || 0),
            targetPrice: mode() === 'wash' ? lastPrice() : targetPrice(),
        };

        try {
            const res = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ text: `Execution Engine Engaged. Operation Pending. (Ref: ${data.actionId})`, type: 'success' });
                // Reload orderbook to show potential immediate impacts, though execution might take seconds
                setTimeout(loadOrderBook, 2000);
            } else {
                setMessage({ text: data.error || 'Execution failed', type: 'error' });
            }
        } catch (e: any) {
            setMessage({ text: e.message || 'Execution failed', type: 'error' });
        } finally {
            setExecuting(false);
        }
    };

    const fmtNum = (n: number, d = 2) => n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

    return (
        <div class="mma-root">
            <div class="mma-header">
                <div>
                    <h1 class="mma-title">Volume & Market Operations</h1>
                    <p class="mma-subtitle">STOA Execution Engine for Wash Trading & Strategic Directional Sweeps</p>
                </div>
            </div>

            <Show when={!loading()} fallback={<div class="mma-loading"><div class="mma-spinner" /></div>}>
                <div class="mma-mode-selector">
                    <button
                        class={`mma-mode-btn ${mode() === 'wash' ? 'active wash' : ''}`}
                        onClick={() => handleModeSwitch('wash')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        <div class="mma-mode-info">
                            <span class="mma-mode-label">Wash Trading</span>
                            <span class="mma-mode-desc">Generate Faux Volume</span>
                        </div>
                    </button>
                    <button
                        class={`mma-mode-btn ${mode() === 'pump' ? 'active pump' : ''}`}
                        onClick={() => handleModeSwitch('pump')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <div class="mma-mode-info">
                            <span class="mma-mode-label">Controlled Pump</span>
                            <span class="mma-mode-desc">Burn USDT to Sweep Asks</span>
                        </div>
                    </button>
                    <button
                        class={`mma-mode-btn ${mode() === 'dump' ? 'active dump' : ''}`}
                        onClick={() => handleModeSwitch('dump')}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
                        <div class="mma-mode-info">
                            <span class="mma-mode-label">Controlled Dump</span>
                            <span class="mma-mode-desc">Burn VCN to Sweep Bids</span>
                        </div>
                    </button>
                </div>

                <div class="mma-content-grid">
                    {/* Input Controls */}
                    <div class="mma-panel">
                        <h2 class="mma-panel-title">Configuration</h2>
                        <div class="mma-current-price-box">
                            <span class="mma-price-label">Current Market Price</span>
                            <span class="mma-price-val">${lastPrice().toFixed(4)}</span>
                        </div>

                        <Show when={mode() === 'wash'}>
                            <div class="mma-input-group">
                                <label>Target Volume (USDT Equivalent)</label>
                                <input
                                    type="number"
                                    value={washVolumeUSDT()}
                                    onInput={(e) => setWashVolumeUSDT(parseFloat(e.currentTarget.value) || 0)}
                                    step="1000"
                                    min="1000"
                                />
                                <span class="mma-hint">Will execute matching buy/sell pairs between internal accounts without changing price.</span>
                            </div>
                        </Show>

                        <Show when={mode() !== 'wash'}>
                            <div class="mma-input-group">
                                <label>Target Execution Price</label>
                                <input
                                    type="number"
                                    value={targetPrice()}
                                    onInput={(e) => setTargetPrice(parseFloat(e.currentTarget.value) || 0)}
                                    step="0.0001"
                                />
                                <div class="mma-range-presets">
                                    <button onClick={() => setTargetPrice(lastPrice() * (mode() === 'pump' ? 1.1 : 0.9))}>10%</button>
                                    <button onClick={() => setTargetPrice(lastPrice() * (mode() === 'pump' ? 1.25 : 0.75))}>25%</button>
                                    <button onClick={() => setTargetPrice(lastPrice() * (mode() === 'pump' ? 1.5 : 0.5))}>50%</button>
                                    <button onClick={() => setTargetPrice(lastPrice() * (mode() === 'pump' ? 2.0 : 0.2))}>MAX</button>
                                </div>
                            </div>
                        </Show>

                        <Show when={message().type}>
                            <div class={`mma-message ${message().type}`}>
                                {message().text}
                            </div>
                        </Show>

                        <button
                            class={`mma-execute-btn ${mode()}`}
                            onClick={executeAction}
                            disabled={executing() || (mode() !== 'wash' && !simulationResult()?.valid)}
                        >
                            <Show when={!executing()} fallback={<div class="mma-btn-spinner" />}>
                                {mode() === 'wash' ? 'ENGAGE WASH ENGINE' : `EXECUTE ${mode().toUpperCase()} SWEEP`}
                            </Show>
                        </button>
                    </div>

                    {/* Simulation Console */}
                    <div class="mma-panel mma-simulation">
                        <h2 class="mma-panel-title">Engine Simulation Console</h2>

                        <Show when={mode() === 'wash'}>
                            <div class="mma-sim-block wash-block">
                                <div class="mma-sim-val-row">
                                    <span class="mma-sim-label">Faux Volume Generated</span>
                                    <span class="mma-sim-val highlight-wash">${fmtNum(washVolumeUSDT())}</span>
                                </div>
                                <div class="mma-sim-val-row">
                                    <span class="mma-sim-label">Est. Required Internal Matching Hooks</span>
                                    <span class="mma-sim-val">~{Math.ceil(washVolumeUSDT() / 5000)} Trades</span>
                                </div>
                                <div class="mma-sim-val-row">
                                    <span class="mma-sim-label">Price Impact</span>
                                    <span class="mma-sim-val" style="color:#22c55e">0.00% (Neutral)</span>
                                </div>
                                <div class="mma-sim-info">Volume generator cycles matching buy and sell limits simultaneously from internal alpha and beta accounts.</div>
                            </div>
                        </Show>

                        <Show when={mode() !== 'wash' && simulationResult()}>
                            {(sim) => (
                                <Show when={sim().valid} fallback={
                                    <div class="mma-sim-invalid">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                        <span>{sim().reason}</span>
                                    </div>
                                }>
                                    <div class="mma-sim-block">
                                        {/* Cost */}
                                        <div class="mma-sim-val-row">
                                            <span class="mma-sim-label">Required Capital Burn</span>
                                            <span class={`mma-sim-val ${mode() === 'pump' ? 'highlight-usdt' : 'highlight-vcn'}`}>
                                                {mode() === 'pump'
                                                    ? `$${fmtNum(sim().costAsset)} USDT`
                                                    : `${fmtNum(sim().costAsset, 0)} VCN`
                                                }
                                            </span>
                                        </div>
                                        {/* Yield */}
                                        <div class="mma-sim-val-row">
                                            <span class="mma-sim-label">Est. Asset Acquisition</span>
                                            <span class={`mma-sim-val ${mode() === 'pump' ? 'highlight-vcn' : 'highlight-usdt'}`}>
                                                {mode() === 'pump'
                                                    ? `~${fmtNum(sim().yieldAsset, 0)} VCN`
                                                    : `~$${fmtNum(sim().yieldAsset)} USDT`
                                                }
                                            </span>
                                        </div>

                                        <hr class="mma-sim-divider" />

                                        {/* Impact */}
                                        <div class="mma-sim-val-row">
                                            <span class="mma-sim-label">Resulting Price Level</span>
                                            <span class="mma-sim-val mono">${fmtNum(sim().actualFinalPrice, 4)}</span>
                                        </div>
                                        <div class="mma-sim-val-row">
                                            <span class="mma-sim-label">Market Slippage Impact</span>
                                            <span class={`mma-sim-val ${mode() === 'pump' ? 'color-pump' : 'color-dump'}`}>
                                                {mode() === 'pump' ? '+' : '-'}{fmtNum(sim().priceImpactPct)}%
                                            </span>
                                        </div>
                                        <div class="mma-sim-val-row">
                                            <span class="mma-sim-label">Orders Absorbed</span>
                                            <span class="mma-sim-val">{sim().ordersEaten} Liquidity Layers</span>
                                        </div>

                                        <div class="mma-sim-val-row" style="margin-top: 12px; font-size: 11px; opacity: 0.6;">
                                            <span class="mma-sim-label">Avg Execution Price</span>
                                            <span class="mma-sim-val mono">
                                                ~${fmtNum(mode() === 'pump' ? sim().costAsset / Math.max(sim().yieldAsset, 1) : sim().yieldAsset / Math.max(sim().costAsset, 1), 4)}
                                            </span>
                                        </div>

                                    </div>
                                </Show>
                            )}
                        </Show>
                    </div>
                </div>
            </Show>

            <style>{`
                .mma-root { max-width: 1000px; margin: 0 auto; color: white; padding-bottom: 60px; }
                .mma-header { margin-bottom: 24px; }
                .mma-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mma-subtitle { font-size: 13px; color: rgba(255,255,255,0.4); margin: 0; }

                .mma-loading { display: flex; justify-content: center; padding: 60px; }
                .mma-spinner { width: 32px; height: 32px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }
                .mma-btn-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin: auto; }

                .mma-mode-selector { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
                .mma-mode-btn { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 16px; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.2s; text-align: left; }
                .mma-mode-btn:hover { background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); }
                .mma-mode-btn.active.wash { background: rgba(56, 189, 248, 0.1); border-color: #38bdf8; color: #38bdf8; box-shadow: 0 4px 20px rgba(56, 189, 248, 0.15); }
                .mma-mode-btn.active.pump { background: rgba(34, 197, 94, 0.1); border-color: #22c55e; color: #22c55e; box-shadow: 0 4px 20px rgba(34, 197, 94, 0.15); }
                .mma-mode-btn.active.dump { background: rgba(239, 68, 68, 0.1); border-color: #ef4444; color: #ef4444; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.15); }
                .mma-mode-info { display: flex; flex-direction: column; gap: 2px; }
                .mma-mode-label { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
                .mma-mode-desc { font-size: 11px; opacity: 0.7; }

                .mma-content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                @media (max-width: 768px) { .mma-content-grid { grid-template-columns: 1fr; } .mma-mode-selector { grid-template-columns: 1fr; } }
                
                .mma-panel { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 24px; }
                .mma-panel-title { font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 20px; }
                
                .mma-current-price-box { margin-bottom: 24px; display: flex; flex-direction: column; gap: 4px; }
                .mma-price-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); }
                .mma-price-val { font-size: 32px; font-weight: 900; font-family: monospace; color: #f59e0b; text-shadow: 0 0 20px rgba(245,158,11,0.2); }

                .mma-input-group { margin-bottom: 24px; }
                .mma-input-group label { display: block; font-size: 11px; font-weight: 800; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
                .mma-input-group input { width: 100%; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; padding: 12px 16px; font-size: 18px; color: white; border-left: 4px solid #f59e0b; font-family: monospace; transition: border-color 0.2s; outline: none; box-sizing: border-box; }
                .mma-input-group input:focus { border-color: rgba(245,158,11,0.6); }
                .mma-hint { display: block; margin-top: 8px; font-size: 11px; color: rgba(255,255,255,0.3); }

                .mma-range-presets { display: flex; gap: 8px; margin-top: 8px; }
                .mma-range-presets button { flex: 1; padding: 6px; font-size: 11px; font-weight: 800; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.6); cursor: pointer; transition: all 0.2s; }
                .mma-range-presets button:hover { background: rgba(255,255,255,0.1); color: white; border-color: rgba(255,255,255,0.2); }

                .mma-execute-btn { width: 100%; padding: 16px; border-radius: 12px; font-size: 14px; font-weight: 900; letter-spacing: 0.1em; border: none; color: white; cursor: pointer; text-transform: uppercase; transition: all 0.2s; }
                .mma-execute-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .mma-execute-btn.wash { background: linear-gradient(135deg, #0284c7, #0369a1); box-shadow: 0 4px 20px rgba(2, 132, 199, 0.3); }
                .mma-execute-btn.pump { background: linear-gradient(135deg, #16a34a, #15803d); box-shadow: 0 4px 20px rgba(22, 163, 74, 0.3); }
                .mma-execute-btn.dump { background: linear-gradient(135deg, #dc2626, #b91c1c); box-shadow: 0 4px 20px rgba(220, 38, 38, 0.3); }
                .mma-execute-btn:not(:disabled):hover { transform: translateY(-2px); filter: brightness(1.2); }

                .mma-simulation { background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.8) 100%); }
                .mma-sim-block { display: flex; flex-direction: column; gap: 16px; }
                .mma-sim-val-row { display: flex; justify-content: space-between; align-items: center; }
                .mma-sim-label { font-size: 12px; color: rgba(255,255,255,0.5); }
                .mma-sim-val { font-size: 16px; font-weight: 800; font-family: monospace; }
                .mma-sim-divider { border: 0; border-top: 1px dashed rgba(255,255,255,0.1); margin: 4px 0; }
                
                .highlight-usdt { color: #f59e0b; }
                .highlight-vcn { color: #60a5fa; }
                .highlight-wash { color: #38bdf8; font-size: 20px; }
                .color-pump { color: #22c55e; }
                .color-dump { color: #ef4444; }
                .mono { font-family: monospace; }

                .mma-sim-invalid { display: flex; flex-direction: column; align-items: center; gap: 12px; color: #ef4444; padding: 40px 0; text-align: center; opacity: 0.8; font-size: 13px; font-weight: 700; }
                .mma-sim-info { margin-top: 24px; padding: 12px; background: rgba(56, 189, 248, 0.1); border-radius: 8px; font-size: 11px; color: #7dd3fc; line-height: 1.5; }

                .mma-message { margin-bottom: 24px; padding: 12px 16px; border-radius: 8px; font-size: 12px; font-weight: 600; word-break: break-all; }
                .mma-message.success { background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; }
                .mma-message.error { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #fca5a5; }

                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
