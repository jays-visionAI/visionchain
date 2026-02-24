import { createSignal, onMount, Show, For, createMemo } from 'solid-js';
import { getAdminFirebaseDb } from '../../services/firebaseService';
import { collection, getDocs, query, orderBy, limit, startAfter, Timestamp } from 'firebase/firestore';

interface AuditEntry {
    id: string;
    type: string;
    operator: string;
    timestamp: any;
    config?: any;
    overrides?: any;
}

const TYPE_COLORS: Record<string, string> = {
    price_direction: '#3b82f6',
    spread_config: '#8b5cf6',
    inventory_config: '#f59e0b',
    risk_config: '#ef4444',
    agent_overrides: '#22c55e',
    kill_switch_on: '#ef4444',
    kill_switch_off: '#22c55e',
};

const TYPE_LABELS: Record<string, string> = {
    price_direction: 'Price Direction',
    spread_config: 'Spread & Layers',
    inventory_config: 'Inventory',
    risk_config: 'Risk Controls',
    agent_overrides: 'Agent Override',
    kill_switch_on: 'Kill Switch ON',
    kill_switch_off: 'Kill Switch OFF',
};

function formatTimestamp(ts: any): string {
    if (!ts) return 'N/A';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        const now = new Date();
        const diff = (now.getTime() - d.getTime()) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return 'N/A'; }
}

function formatDetails(entry: AuditEntry): string[] {
    const details: string[] = [];
    const c = entry.config || entry.overrides;
    if (!c) return details;

    switch (entry.type) {
        case 'price_direction':
            if (c.mode) details.push(`Mode: ${c.mode}`);
            if (c.targetPrice) details.push(`Target: $${c.targetPrice}`);
            if (c.trendBias !== undefined) details.push(`Bias: ${c.trendBias > 0 ? '+' : ''}${c.trendBias}`);
            if (c.phase) details.push(`Phase: ${c.phase}`);
            if (c.trendSpeed) details.push(`Speed: ${c.trendSpeed}`);
            break;
        case 'spread_config':
            if (c.baseSpread) details.push(`Spread: ${c.baseSpread}%`);
            if (c.bidSpreadMultiplier) details.push(`Bid Mult: ${c.bidSpreadMultiplier}x`);
            if (c.askSpreadMultiplier) details.push(`Ask Mult: ${c.askSpreadMultiplier}x`);
            if (c.layerCount) details.push(`Layers: ${c.layerCount}`);
            break;
        case 'inventory_config':
            if (c.targetRatio) details.push(`Target: ${(c.targetRatio * 100).toFixed(0)}% VCN`);
            if (c.skewIntensity !== undefined) details.push(`Skew: ${c.skewIntensity}`);
            if (c.autoRebalance !== undefined) details.push(`Auto-Rebal: ${c.autoRebalance ? 'ON' : 'OFF'}`);
            break;
        case 'risk_config':
            if (c.killSwitchEnabled !== undefined) details.push(`Kill Switch: ${c.killSwitchEnabled ? 'ON' : 'OFF'}`);
            if (c.dailyLossLimit) details.push(`Loss Limit: $${c.dailyLossLimit}`);
            if (c.maxDrawdownPercent) details.push(`Max DD: ${c.maxDrawdownPercent}%`);
            break;
        case 'agent_overrides':
            const keys = Object.keys(c);
            details.push(`${keys.length} agent(s) configured`);
            break;
    }
    return details;
}

export default function MMActivityLog() {
    const [entries, setEntries] = createSignal<AuditEntry[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [loadingMore, setLoadingMore] = createSignal(false);
    const [hasMore, setHasMore] = createSignal(true);
    const [filter, setFilter] = createSignal<string>('all');
    const PAGE_SIZE = 30;
    const db = getAdminFirebaseDb();

    const loadEntries = async (append = false) => {
        if (append) setLoadingMore(true); else setLoading(true);
        try {
            const existing = entries();
            const lastDoc = append && existing.length > 0 ? existing[existing.length - 1].timestamp : null;
            let q;
            if (lastDoc) {
                q = query(collection(db, 'dex/config/trading-audit-log'), orderBy('timestamp', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
            } else {
                q = query(collection(db, 'dex/config/trading-audit-log'), orderBy('timestamp', 'desc'), limit(PAGE_SIZE));
            }
            const snap = await getDocs(q);
            const newEntries: AuditEntry[] = [];
            snap.forEach(d => newEntries.push({ id: d.id, ...d.data() } as AuditEntry));
            if (newEntries.length < PAGE_SIZE) setHasMore(false);
            setEntries(prev => append ? [...prev, ...newEntries] : newEntries);
        } catch (e) { console.error('[MMLog] Load:', e); }
        finally { setLoading(false); setLoadingMore(false); }
    };

    onMount(() => loadEntries());

    const filtered = createMemo(() => {
        const f = filter();
        if (f === 'all') return entries();
        return entries().filter(e => e.type === f);
    });

    const uniqueTypes = createMemo(() => {
        const types = new Set(entries().map(e => e.type));
        return ['all', ...Array.from(types)];
    });

    return (
        <div class="mml-root">
            <div class="mml-header">
                <div>
                    <h1 class="mml-title">Activity Log</h1>
                    <p class="mml-subtitle">Configuration changes and system events</p>
                </div>
                <div class="mml-count">{entries().length} entries</div>
            </div>

            <Show when={!loading()} fallback={<div class="mml-loading"><div class="mml-spin" /></div>}>
                {/* Filter bar */}
                <div class="mml-filters">
                    <For each={uniqueTypes()}>
                        {(type) => (
                            <button onClick={() => setFilter(type)} class={`mml-filter-btn ${filter() === type ? 'active' : ''}`} style={type !== 'all' ? { "border-color": `${TYPE_COLORS[type] || '#f59e0b'}40` } : {}}>
                                {type === 'all' ? 'All' : TYPE_LABELS[type] || type.replace(/_/g, ' ')}
                            </button>
                        )}
                    </For>
                </div>

                {/* Log entries */}
                <Show when={filtered().length > 0} fallback={
                    <div class="mml-empty">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                            <rect x="8" y="4" width="24" height="32" rx="4" stroke="rgba(245,158,11,0.3)" stroke-width="2" />
                            <path d="M14 14h12M14 20h12M14 26h8" stroke="rgba(245,158,11,0.15)" stroke-width="2" stroke-linecap="round" />
                        </svg>
                        <p>No log entries found</p>
                    </div>
                }>
                    <div class="mml-timeline">
                        <For each={filtered()}>
                            {(entry, i) => {
                                const color = TYPE_COLORS[entry.type] || '#f59e0b';
                                const details = formatDetails(entry);
                                return (
                                    <div class="mml-entry">
                                        {/* Timeline dot */}
                                        <div class="mml-timeline-col">
                                            <div class="mml-dot" style={{ background: color, "box-shadow": `0 0 8px ${color}60` }} />
                                            <Show when={i() < filtered().length - 1}>
                                                <div class="mml-line" />
                                            </Show>
                                        </div>

                                        {/* Content */}
                                        <div class="mml-entry-content">
                                            <div class="mml-entry-header">
                                                <span class="mml-entry-type" style={{ color, background: `${color}12`, "border-color": `${color}25` }}>
                                                    {TYPE_LABELS[entry.type] || entry.type.replace(/_/g, ' ')}
                                                </span>
                                                <span class="mml-entry-time">{formatTimestamp(entry.timestamp)}</span>
                                            </div>
                                            <div class="mml-entry-operator">
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <circle cx="6" cy="4" r="2" stroke="currentColor" stroke-width="1" />
                                                    <path d="M2 11c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="1" />
                                                </svg>
                                                <span>{entry.operator || 'System'}</span>
                                            </div>
                                            <Show when={details.length > 0}>
                                                <div class="mml-entry-details">
                                                    <For each={details}>
                                                        {(detail) => <span class="mml-detail-tag">{detail}</span>}
                                                    </For>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>

                    {/* Load More */}
                    <Show when={hasMore()}>
                        <button onClick={() => loadEntries(true)} disabled={loadingMore()} class="mml-load-more">
                            <Show when={loadingMore()} fallback={<span>Load More</span>}>
                                <div class="mml-spin-sm" /><span>Loading...</span>
                            </Show>
                        </button>
                    </Show>
                </Show>
            </Show>

            <style>{`
                .mml-root { max-width: 800px; }
                .mml-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
                .mml-title { font-size: 26px; font-weight: 900; letter-spacing: -0.03em; margin: 0 0 4px; }
                .mml-subtitle { font-size: 13px; color: rgba(255,255,255,0.35); margin: 0; }
                .mml-count { font-size: 12px; font-weight: 800; color: rgba(255,255,255,0.3); padding: 6px 14px; border-radius: 8px; background: rgba(255,255,255,0.03); }
                .mml-loading { display: flex; justify-content: center; padding: 60px; }
                .mml-spin { width: 28px; height: 28px; border: 3px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }
                .mml-spin-sm { width: 16px; height: 16px; border: 2px solid rgba(245,158,11,0.2); border-top-color: #f59e0b; border-radius: 50%; animation: spin 0.8s linear infinite; }

                .mml-filters { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
                .mml-filter-btn { padding: 6px 14px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); cursor: pointer; font-size: 11px; font-weight: 700; text-transform: capitalize; transition: all 0.2s; }
                .mml-filter-btn:hover { border-color: rgba(255,255,255,0.12); color: white; }
                .mml-filter-btn.active { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.3); color: #f59e0b; }

                .mml-empty { text-align: center; padding: 40px; color: rgba(255,255,255,0.3); }
                .mml-empty p { margin-top: 12px; font-size: 13px; }

                .mml-timeline { display: flex; flex-direction: column; }
                .mml-entry { display: flex; gap: 16px; }
                .mml-timeline-col { display: flex; flex-direction: column; align-items: center; width: 20px; flex-shrink: 0; }
                .mml-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
                .mml-line { flex: 1; width: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }

                .mml-entry-content { flex: 1; padding-bottom: 18px; }
                .mml-entry-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
                .mml-entry-type { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 3px 8px; border-radius: 4px; border: 1px solid; }
                .mml-entry-time { font-size: 11px; color: rgba(255,255,255,0.25); font-family: monospace; }
                .mml-entry-operator { display: flex; align-items: center; gap: 5px; font-size: 11px; color: rgba(255,255,255,0.35); margin-bottom: 6px; }
                .mml-entry-details { display: flex; flex-wrap: wrap; gap: 6px; }
                .mml-detail-tag { padding: 3px 8px; border-radius: 4px; background: rgba(255,255,255,0.03); font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.5); font-family: monospace; }

                .mml-load-more { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 12px; border-radius: 10px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; margin-top: 10px; }
                .mml-load-more:hover { background: rgba(255,255,255,0.04); color: white; }
                .mml-load-more:disabled { opacity: 0.5; cursor: not-allowed; }

                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
