/**
 * MyAgentPanel - User Trading Agent Management
 * Allows users to create, view, and manage their trading agents
 * within the VisionDEX Trading Terminal.
 */
import { createSignal, createEffect, onMount, For, Show, onCleanup } from 'solid-js';
import { getFirebaseAuth } from '../services/firebaseService';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TradingAgent {
    id: string;
    ownerUid: string;
    name: string;
    role: string;
    strategy: {
        preset: string;
        prompt: string;
        riskLevel: number;
        tradingFrequency: string;
        maxPositionPercent: number;
    };
    balances: { USDT: number; VCN: number };
    performance: {
        initialValueUSDT: number;
        currentValueUSDT: number;
        totalPnL: number;
        totalPnLPercent: number;
        winCount: number;
        lossCount: number;
        totalTrades: number;
        bestTrade: number;
        worstTrade: number;
        maxDrawdown: number;
    };
    recentTrades: Array<{
        timestamp: number;
        side: string;
        amount: number;
        price: number;
        reasoning: string;
    }>;
    status: string;
    lastTradeAt: any;
    createdAt: any;
}

// ─── Strategy Presets ──────────────────────────────────────────────────────

const STRATEGY_PRESETS = [
    { id: 'momentum', name: 'Momentum', desc: 'Follow trends, buy on breakouts', risk: 7, icon: 'M2 12L6 4l4 6 4-8' },
    { id: 'value', name: 'Value', desc: 'Buy dips, hold long term', risk: 3, icon: 'M2 10h3l2-6 2 8 2-4h3' },
    { id: 'scalper', name: 'Scalper', desc: 'Quick small profits', risk: 5, icon: 'M2 7h2l1-2 1 4 1-3 1 2h2l1-1h1' },
    { id: 'contrarian', name: 'Contrarian', desc: 'Go against the herd', risk: 6, icon: 'M3 3l4 8-4 0M11 11l-4-8 4 0' },
    { id: 'grid', name: 'Grid', desc: 'Place orders at intervals', risk: 3, icon: 'M2 2v10h10M4 8v2M6 6v4M8 4v6M10 2v8' },
    { id: 'breakout', name: 'Breakout', desc: 'Trade price breakouts hard', risk: 8, icon: 'M2 8h4l2-4 2 0 2 4h2' },
    { id: 'twap', name: 'TWAP', desc: 'Time-weighted steady buying', risk: 2, icon: 'M2 10l2-1 2 0 2-1 2 0 2-1' },
    { id: 'sentiment', name: 'Sentiment', desc: 'Trade on news/updates', risk: 5, icon: 'M7 2a5 5 0 100 10 5 5 0 000-10M7 5v3l2 1' },
    { id: 'random', name: 'Random', desc: 'Benchmark (random trades)', risk: 5, icon: 'M4 4l2 2M8 4l-2 2M6 8l0 2M4 10l4 0' },
    { id: 'dca', name: 'DCA', desc: 'Dollar cost average buying', risk: 2, icon: 'M3 10l2-2 2 1 2-3 2 1 1-2' },
];

// ─── SVG Icons ─────────────────────────────────────────────────────────────

const PlusIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
);
const PlayIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 2l7 4-7 4V2z" fill="currentColor" />
    </svg>
);
const PauseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect x="2" y="2" width="3" height="8" rx="0.5" fill="currentColor" />
        <rect x="7" y="2" width="3" height="8" rx="0.5" fill="currentColor" />
    </svg>
);
const TrashIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 3h6l-.5 7h-5L3 3zM2 3h8M5 1h2" stroke="currentColor" stroke-width="1" stroke-linecap="round" />
    </svg>
);
const EditIcon = () => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M8 1.5l2.5 2.5L4 10.5H1.5V8L8 1.5z" stroke="currentColor" stroke-width="1" />
    </svg>
);
const BackIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
);
const BotIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="5" width="10" height="8" rx="2" stroke="currentColor" stroke-width="1.2" />
        <circle cx="6" cy="9" r="1" fill="currentColor" />
        <circle cx="10" cy="9" r="1" fill="currentColor" />
        <path d="M8 2v3M5 5V4M11 5V4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
    </svg>
);

// ─── API Helper ────────────────────────────────────────────────────────────

function getApiUrl() {
    if (window.location.hostname.includes('staging') || window.location.hostname === 'localhost') {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/tradingArenaAPI';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/tradingArenaAPI';
}

async function agentApi(action: string, body: Record<string, any> = {}) {
    const res = await fetch(getApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
    });
    return res.json();
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function MyAgentPanel(props: { currentPrice: number }) {
    const [uid, setUid] = createSignal<string | null>(null);
    const [agents, setAgents] = createSignal<TradingAgent[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [view, setView] = createSignal<'list' | 'create' | 'detail' | 'edit'>('list');
    const [selectedAgent, setSelectedAgent] = createSignal<TradingAgent | null>(null);
    const [error, setError] = createSignal('');
    const [saving, setSaving] = createSignal(false);

    // Create form state
    const [newName, setNewName] = createSignal('');
    const [newPreset, setNewPreset] = createSignal('momentum');
    const [newPrompt, setNewPrompt] = createSignal('');
    const [newRisk, setNewRisk] = createSignal(5);

    // Edit form state
    const [editPrompt, setEditPrompt] = createSignal('');
    const [editRisk, setEditRisk] = createSignal(5);

    // ── Auth ──
    onMount(() => {
        try {
            const auth = getFirebaseAuth();
            const unsubscribe = auth.onAuthStateChanged((user: any) => {
                setUid(user?.uid || null);
                if (user?.uid) loadAgents(user.uid);
                else setLoading(false);
            });
            onCleanup(() => unsubscribe());
        } catch {
            setLoading(false);
        }
    });

    // Auto-refresh every 30s
    const refreshInterval = setInterval(() => {
        const u = uid();
        if (u) loadAgents(u);
    }, 30000);
    onCleanup(() => clearInterval(refreshInterval));

    async function loadAgents(userUid: string) {
        try {
            const res = await agentApi('getMyAgents', { uid: userUid });
            if (res.success) {
                const userAgents = (res.agents || []).filter((a: TradingAgent) => a.role === 'trader');
                setAgents(userAgents);
                // Update selected agent if viewing detail
                const sel = selectedAgent();
                if (sel) {
                    const updated = userAgents.find((a: TradingAgent) => a.id === sel.id);
                    if (updated) setSelectedAgent(updated);
                }
            }
        } catch (e) {
            console.warn('[MyAgentPanel] Load failed:', e);
        }
        setLoading(false);
    }

    async function createAgent() {
        if (!newName().trim()) { setError('Agent name required'); return; }
        setSaving(true);
        setError('');
        try {
            const res = await agentApi('createAgent', {
                uid: uid(),
                name: newName().trim(),
                preset: newPreset(),
                prompt: newPrompt().trim(),
                riskLevel: newRisk(),
            });
            if (res.success) {
                setView('list');
                setNewName(''); setNewPrompt(''); setNewRisk(5); setNewPreset('momentum');
                await loadAgents(uid()!);
            } else {
                setError(res.error || 'Failed to create agent');
            }
        } catch (e: any) {
            setError(e.message || 'Network error');
        }
        setSaving(false);
    }

    async function updateAgent() {
        const sel = selectedAgent();
        if (!sel) return;
        setSaving(true);
        try {
            await agentApi('updateAgent', {
                uid: uid(),
                agentId: sel.id,
                prompt: editPrompt(),
                riskLevel: editRisk(),
            });
            setView('detail');
            await loadAgents(uid()!);
        } catch (e) { console.error(e); }
        setSaving(false);
    }

    async function togglePause(agent: TradingAgent) {
        const newStatus = agent.status === 'active' ? 'paused' : 'active';
        await agentApi('updateAgent', { uid: uid(), agentId: agent.id, status: newStatus });
        await loadAgents(uid()!);
    }

    async function deleteAgent(agent: TradingAgent) {
        if (!confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
        await agentApi('deleteAgent', { uid: uid(), agentId: agent.id });
        setView('list');
        setSelectedAgent(null);
        await loadAgents(uid()!);
    }

    function openDetail(agent: TradingAgent) {
        setSelectedAgent(agent);
        setView('detail');
    }

    function openEdit(agent: TradingAgent) {
        setSelectedAgent(agent);
        setEditPrompt(agent.strategy?.prompt || '');
        setEditRisk(agent.strategy?.riskLevel || 5);
        setView('edit');
    }

    function pnlColor(pct: number) {
        return pct > 0 ? '#22c55e' : pct < 0 ? '#ef4444' : '#71717a';
    }

    function statusDot(status: string) {
        return status === 'active' ? '#22c55e' : status === 'paused' ? '#f59e0b' : '#ef4444';
    }

    const presetInfo = (id: string) => STRATEGY_PRESETS.find(p => p.id === id);

    // ── Not Logged In ──
    const NotLoggedIn = () => (
        <div class="map-empty">
            <BotIcon />
            <p class="map-empty-title">Login to create agents</p>
            <p class="map-empty-desc">Create AI trading agents that trade VCN/USDT automatically using your strategy</p>
            <a href="/wallet" class="map-login-btn">Go to Wallet</a>
        </div>
    );

    // ── Agent List View ──
    const AgentList = () => (
        <div class="map-list">
            <div class="map-header">
                <span class="map-header-title">
                    <BotIcon />
                    <span>My Agents</span>
                </span>
                <Show when={agents().length < 3}>
                    <button class="map-create-btn" onClick={() => setView('create')}>
                        <PlusIcon /> New
                    </button>
                </Show>
            </div>
            <Show when={agents().length === 0}>
                <div class="map-empty">
                    <BotIcon />
                    <p class="map-empty-title">No agents yet</p>
                    <p class="map-empty-desc">Create an AI agent to start trading VCN/USDT automatically</p>
                    <button class="map-action-btn primary" onClick={() => setView('create')}>
                        <PlusIcon /> Create Agent
                    </button>
                </div>
            </Show>
            <For each={agents()}>
                {(agent) => {
                    const pnl = () => agent.performance?.totalPnLPercent || 0;
                    const totalVal = () => agent.performance?.currentValueUSDT || 0;
                    return (
                        <div class="map-agent-card" onClick={() => openDetail(agent)}>
                            <div class="map-card-top">
                                <div class="map-card-name">
                                    <span class="map-status-dot" style={{ background: statusDot(agent.status) }} />
                                    <span>{agent.name}</span>
                                </div>
                                <span class="map-card-pnl" style={{ color: pnlColor(pnl()) }}>
                                    {pnl() > 0 ? '+' : ''}{pnl().toFixed(2)}%
                                </span>
                            </div>
                            <div class="map-card-meta">
                                <span class="map-card-preset">{presetInfo(agent.strategy?.preset)?.name || agent.strategy?.preset}</span>
                                <span class="map-card-trades">{agent.performance?.totalTrades || 0} trades</span>
                            </div>
                            <div class="map-card-balances">
                                <span>{agent.balances?.USDT?.toFixed(0) || 0} USDT</span>
                                <span>{(agent.balances?.VCN || 0).toLocaleString()} VCN</span>
                            </div>
                            <div class="map-card-total">
                                Total: ${totalVal().toFixed(2)}
                            </div>
                        </div>
                    );
                }}
            </For>
            <Show when={agents().length > 0 && agents().length < 3}>
                <button class="map-add-more" onClick={() => setView('create')}>
                    <PlusIcon /> Add Agent ({agents().length}/3)
                </button>
            </Show>
        </div>
    );

    // ── Create Agent View ──
    const CreateView = () => (
        <div class="map-create">
            <div class="map-sub-header">
                <button class="map-back-btn" onClick={() => setView('list')}><BackIcon /></button>
                <span>Create Agent</span>
            </div>

            <div class="map-form">
                <div class="map-field">
                    <label>Agent Name</label>
                    <input
                        type="text"
                        placeholder="e.g. My Momentum Bot"
                        value={newName()}
                        onInput={(e) => setNewName(e.currentTarget.value)}
                        maxLength={30}
                        class="map-input"
                    />
                </div>

                <div class="map-field">
                    <label>Strategy Preset</label>
                    <div class="map-preset-grid">
                        <For each={STRATEGY_PRESETS}>
                            {(p) => (
                                <button
                                    class={`map-preset-item ${newPreset() === p.id ? 'active' : ''}`}
                                    onClick={() => setNewPreset(p.id)}
                                >
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                        <path d={p.icon} stroke="currentColor" stroke-width="1" stroke-linecap="round" />
                                    </svg>
                                    <span class="map-preset-name">{p.name}</span>
                                </button>
                            )}
                        </For>
                    </div>
                    <Show when={newPreset() === 'custom' || newPreset()}>
                        <p class="map-preset-desc">{presetInfo(newPreset())?.desc}</p>
                    </Show>
                </div>

                <div class="map-field">
                    <label>Custom Strategy Prompt <span class="map-optional">(optional)</span></label>
                    <textarea
                        placeholder="Describe your trading strategy in detail..."
                        value={newPrompt()}
                        onInput={(e) => setNewPrompt(e.currentTarget.value)}
                        maxLength={2000}
                        rows={3}
                        class="map-textarea"
                    />
                    <span class="map-char-count">{newPrompt().length}/2000</span>
                </div>

                <div class="map-field">
                    <label>Risk Level: {newRisk()}/10</label>
                    <input
                        type="range" min="1" max="10" step="1"
                        value={newRisk()}
                        onInput={(e) => setNewRisk(parseInt(e.currentTarget.value))}
                        class="map-risk-slider"
                    />
                    <div class="map-risk-labels">
                        <span>Conservative</span>
                        <span>Aggressive</span>
                    </div>
                </div>

                <div class="map-initial-info">
                    <span>Initial Balance:</span>
                    <span>10,000 USDT + 100,000 VCN</span>
                </div>

                <Show when={error()}>
                    <div class="map-error">{error()}</div>
                </Show>

                <button
                    class="map-action-btn primary"
                    onClick={createAgent}
                    disabled={saving() || !newName().trim()}
                >
                    {saving() ? 'Creating...' : 'Create Agent'}
                </button>
            </div>
        </div>
    );

    // ── Agent Detail View ──
    const DetailView = () => {
        const agent = () => selectedAgent()!;
        const pnl = () => agent()?.performance?.totalPnLPercent || 0;
        const totalVal = () => agent()?.performance?.currentValueUSDT || 0;
        const initVal = () => agent()?.performance?.initialValueUSDT || 0;
        const winRate = () => {
            const t = agent()?.performance?.totalTrades || 0;
            if (t === 0) return 0;
            return ((agent()?.performance?.winCount || 0) / t * 100);
        };

        return (
            <Show when={agent()}>
                <div class="map-detail">
                    <div class="map-sub-header">
                        <button class="map-back-btn" onClick={() => { setView('list'); setSelectedAgent(null); }}><BackIcon /></button>
                        <span>{agent().name}</span>
                        <div class="map-detail-actions">
                            <button class="map-icon-btn" onClick={() => openEdit(agent())} title="Edit"><EditIcon /></button>
                            <button class="map-icon-btn" onClick={() => togglePause(agent())} title={agent().status === 'active' ? 'Pause' : 'Resume'}>
                                {agent().status === 'active' ? <PauseIcon /> : <PlayIcon />}
                            </button>
                            <button class="map-icon-btn danger" onClick={() => deleteAgent(agent())} title="Delete"><TrashIcon /></button>
                        </div>
                    </div>

                    <div class="map-detail-status">
                        <span class="map-status-badge" style={{ background: statusDot(agent().status) }}>
                            {agent().status}
                        </span>
                        <span class="map-detail-preset">{presetInfo(agent().strategy?.preset)?.name || agent().strategy?.preset}</span>
                        <span class="map-detail-risk">Risk {agent().strategy?.riskLevel}/10</span>
                    </div>

                    <div class="map-detail-pnl-card">
                        <div class="map-pnl-main">
                            <span class="map-pnl-label">Total Value</span>
                            <span class="map-pnl-value">${totalVal().toFixed(2)}</span>
                        </div>
                        <div class="map-pnl-change" style={{ color: pnlColor(pnl()) }}>
                            {pnl() > 0 ? '+' : ''}${(agent()?.performance?.totalPnL || 0).toFixed(2)}
                            ({pnl() > 0 ? '+' : ''}{pnl().toFixed(2)}%)
                        </div>
                    </div>

                    <div class="map-balances-grid">
                        <div class="map-bal-item">
                            <span class="map-bal-label">USDT</span>
                            <span class="map-bal-val">{(agent().balances?.USDT || 0).toFixed(2)}</span>
                        </div>
                        <div class="map-bal-item">
                            <span class="map-bal-label">VCN</span>
                            <span class="map-bal-val">{(agent().balances?.VCN || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="map-stats-grid">
                        <div class="map-stat">
                            <span class="map-stat-label">Trades</span>
                            <span class="map-stat-val">{agent().performance?.totalTrades || 0}</span>
                        </div>
                        <div class="map-stat">
                            <span class="map-stat-label">Win Rate</span>
                            <span class="map-stat-val">{winRate().toFixed(1)}%</span>
                        </div>
                        <div class="map-stat">
                            <span class="map-stat-label">Best</span>
                            <span class="map-stat-val" style={{ color: '#22c55e' }}>+${(agent().performance?.bestTrade || 0).toFixed(2)}</span>
                        </div>
                        <div class="map-stat">
                            <span class="map-stat-label">Worst</span>
                            <span class="map-stat-val" style={{ color: '#ef4444' }}>${(agent().performance?.worstTrade || 0).toFixed(2)}</span>
                        </div>
                    </div>

                    <Show when={agent().strategy?.prompt}>
                        <div class="map-prompt-preview">
                            <span class="map-prompt-label">Strategy Prompt</span>
                            <p class="map-prompt-text">{agent().strategy.prompt}</p>
                        </div>
                    </Show>

                    <div class="map-trades-section">
                        <span class="map-trades-title">Recent Trades</span>
                        <Show when={(agent().recentTrades || []).length === 0}>
                            <p class="map-no-trades">No trades yet</p>
                        </Show>
                        <For each={(agent().recentTrades || []).slice(0, 10)}>
                            {(trade) => (
                                <div class="map-trade-item">
                                    <div class="map-trade-top">
                                        <span class={`map-trade-side ${trade.side}`}>{trade.side.toUpperCase()}</span>
                                        <span class="map-trade-amount">{trade.amount.toLocaleString()} VCN</span>
                                        <span class="map-trade-price">@ {trade.price.toFixed(4)}</span>
                                    </div>
                                    <Show when={trade.reasoning}>
                                        <p class="map-trade-reasoning">{trade.reasoning}</p>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>
        );
    };

    // ── Edit View ──
    const EditView = () => (
        <Show when={selectedAgent()}>
            <div class="map-edit">
                <div class="map-sub-header">
                    <button class="map-back-btn" onClick={() => setView('detail')}><BackIcon /></button>
                    <span>Edit {selectedAgent()!.name}</span>
                </div>
                <div class="map-form">
                    <div class="map-field">
                        <label>Strategy Prompt</label>
                        <textarea
                            value={editPrompt()}
                            onInput={(e) => setEditPrompt(e.currentTarget.value)}
                            maxLength={2000}
                            rows={5}
                            class="map-textarea"
                        />
                        <span class="map-char-count">{editPrompt().length}/2000</span>
                    </div>
                    <div class="map-field">
                        <label>Risk Level: {editRisk()}/10</label>
                        <input
                            type="range" min="1" max="10" step="1"
                            value={editRisk()}
                            onInput={(e) => setEditRisk(parseInt(e.currentTarget.value))}
                            class="map-risk-slider"
                        />
                    </div>
                    <button class="map-action-btn primary" onClick={updateAgent} disabled={saving()}>
                        {saving() ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </Show>
    );

    // ── Render ──
    return (
        <div class="my-agent-panel">
            <Show when={loading()}>
                <div class="map-loading">
                    <div class="map-spinner" />
                    <span>Loading agents...</span>
                </div>
            </Show>
            <Show when={!loading()}>
                <Show when={!uid()}>
                    <NotLoggedIn />
                </Show>
                <Show when={uid()}>
                    <Show when={view() === 'list'}><AgentList /></Show>
                    <Show when={view() === 'create'}><CreateView /></Show>
                    <Show when={view() === 'detail'}><DetailView /></Show>
                    <Show when={view() === 'edit'}><EditView /></Show>
                </Show>
            </Show>
        </div>
    );
}
