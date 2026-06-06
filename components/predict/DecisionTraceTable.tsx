import { createSignal, createEffect, Show, For } from 'solid-js';
import { useI18n } from '../../i18n/i18nContext';

const AGENT_API_URL = (() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('staging')) {
        return 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
    }
    return 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
})();

type FilterMode = 'all' | 'pending' | 'resolved' | 'skip';

interface DecisionRow {
    decision_id: string;
    market_id?: string;
    created_at?: string;
    charged_at?: string;
    market_snapshot?: {
        question?: string;
        yes_price?: number;
        no_price?: number;
        end_date?: string;
    };
    llm_decision?: {
        decision?: string;
        confidence_0_1?: number;
        suggested_size_usdc?: number;
    };
    rule_check?: {
        final_decision?: string;
        final_size_usdc?: number;
    };
    resolution?: {
        status?: 'pending' | 'resolved' | 'cancelled' | string;
        resolved_yes?: boolean | null;
        would_pnl_usdc?: number | null;
    };
}

interface SimulationsResp {
    success?: boolean;
    decisions?: DecisionRow[];
    next_cursor?: string | null;
    error?: string;
}

interface DecisionTraceTableProps {
    apiKey: string;
    refreshKey: () => number;
}

function decisionChip(
    d: string | undefined,
    t: (key: string, params?: Record<string, string | number>) => string,
) {
    if (d === 'bet_yes') return { label: t('predict.intel.trace.chip_yes'), cls: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' };
    if (d === 'bet_no') return { label: t('predict.intel.trace.chip_no'), cls: 'bg-red-500/15 border-red-500/40 text-red-300' };
    return { label: t('predict.intel.trace.chip_skip'), cls: 'bg-amber-500/15 border-amber-500/40 text-amber-300' };
}

function relativeTime(iso?: string): string {
    if (!iso) return '—';
    try {
        const t = new Date(iso).getTime();
        if (!isFinite(t)) return '—';
        const diff = Date.now() - t;
        if (diff < 0) return 'just now';
        const sec = Math.floor(diff / 1000);
        if (sec < 60) return `${sec}s ago`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}m ago`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}h ago`;
        const days = Math.floor(hr / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo ago`;
        return `${Math.floor(months / 12)}y ago`;
    } catch {
        return '—';
    }
}

function truncate(s: string | undefined, n: number): string {
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, n - 1) + '…';
}

function fmtSize(n?: number): string {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return `$${n.toFixed(2)}`;
}

function fmtPnL(n?: number | null): string {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}`;
}

async function callApi(action: string, params: Record<string, any>) {
    const apiKey = localStorage.getItem('vcn_agent_api_key') || '';
    const resp = await fetch(AGENT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, api_key: apiKey, ...params }),
    });
    return { ok: resp.ok, status: resp.status, body: await resp.json() };
}

export default function DecisionTraceTable(props: DecisionTraceTableProps) {
    const { t } = useI18n();

    const [decisions, setDecisions] = createSignal<DecisionRow[]>([]);
    const [cursor, setCursor] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal<boolean>(false);
    const [error, setError] = createSignal<string>('');
    const [filter, setFilter] = createSignal<FilterMode>('all');

    const paperPnlTooltip = () => t('predict.intel.trace.paper_pnl_tooltip');

    async function load(reset: boolean) {
        setLoading(true);
        setError('');
        try {
            const params: Record<string, any> = { limit: 25 };
            if (!reset && cursor()) params.cursor = cursor();
            const f = filter();
            if (f !== 'all') params.filter = f;
            const { ok, body } = await callApi('polymarket.simulations', params);
            if (!ok || !body.success) {
                setError(body?.error || 'Failed to load decisions.');
                return;
            }
            const resp = body as SimulationsResp;
            const rows = resp.decisions || [];
            if (reset) {
                setDecisions(rows);
            } else {
                setDecisions([...decisions(), ...rows]);
            }
            setCursor(resp.next_cursor || null);
        } catch (e: any) {
            setError(e?.message || 'Network error.');
        } finally {
            setLoading(false);
        }
    }

    // M.7: single createEffect on (filter, refreshKey) covers initial load via
    //      the implicit first run AND filter changes AND external refresh. The
    //      previous onMount + two createEffects raced on mount.
    createEffect(() => {
        filter();
        props.refreshKey(); // subscribe to external bumps
        setCursor(null);
        load(true);
    });

    const filters = (): { id: FilterMode; label: string }[] => [
        { id: 'all', label: t('predict.intel.trace.filter.all') },
        { id: 'pending', label: t('predict.intel.trace.filter.pending') },
        { id: 'resolved', label: t('predict.intel.trace.filter.resolved') },
        { id: 'skip', label: t('predict.intel.trace.filter.skip') },
    ];

    return (
        <div class="space-y-4">
            {/* Filter pills */}
            <div class="flex items-center gap-2 flex-wrap">
                <For each={filters()}>
                    {(f) => (
                        <button
                            onClick={() => setFilter(f.id)}
                            class={`px-3 py-1 rounded-full text-xs border ${
                                filter() === f.id
                                    ? 'border-white bg-white text-black'
                                    : 'border-white/15 text-[#9b9ba0] hover:text-white'
                            }`}
                        >
                            {f.label}
                        </button>
                    )}
                </For>
            </div>

            <Show when={error()}>
                <div class="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                    {error()}
                </div>
            </Show>

            {/* Table */}
            <Show
                when={decisions().length > 0}
                fallback={
                    <Show
                        when={!loading()}
                        fallback={<div class="text-xs text-[#9b9ba0]">{t('predict.intel.trace.loading')}</div>}
                    >
                        <div class="p-6 rounded-xl border border-white/10 bg-white/[0.02] text-center text-sm text-[#9b9ba0]">
                            {t('predict.intel.trace.empty')}
                        </div>
                    </Show>
                }
            >
                <div class="overflow-x-auto rounded-xl border border-white/10">
                    <table class="w-full text-sm">
                        <thead class="bg-white/[0.03] text-[10px] uppercase tracking-wide text-[#6b6b70]">
                            <tr>
                                <th class="text-left px-3 py-2 font-normal">{t('predict.intel.trace.col.time')}</th>
                                <th class="text-left px-3 py-2 font-normal">{t('predict.intel.trace.col.market')}</th>
                                <th class="text-left px-3 py-2 font-normal">{t('predict.intel.trace.col.llm_decision')}</th>
                                <th class="text-left px-3 py-2 font-normal">{t('predict.intel.trace.col.final_decision')}</th>
                                <th class="text-left px-3 py-2 font-normal">{t('predict.intel.trace.col.size')}</th>
                                <th class="text-left px-3 py-2 font-normal">{t('predict.intel.trace.col.status')}</th>
                                <th class="text-left px-3 py-2 font-normal" title={paperPnlTooltip()}>
                                    {t('predict.intel.trace.col.paper_pnl')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={decisions()}>
                                {(d) => {
                                    const llm = d.llm_decision || {};
                                    const rc = d.rule_check || {};
                                    const res = d.resolution || {};
                                    const llmChip = decisionChip(llm.decision, t);
                                    const finalChip = decisionChip(rc.final_decision, t);
                                    const fullQ = d.market_snapshot?.question || t('predict.intel.trace.market_unknown');
                                    return (
                                        <tr class="border-t border-white/5">
                                            <td class="px-3 py-2 text-[#9b9ba0] text-xs whitespace-nowrap">
                                                {relativeTime(d.created_at || d.charged_at)}
                                            </td>
                                            <td class="px-3 py-2">
                                                <span title={fullQ}>{truncate(fullQ, 60)}</span>
                                            </td>
                                            <td class="px-3 py-2">
                                                <span class={`inline-block px-2 py-0.5 rounded border text-[10px] ${llmChip.cls}`}>
                                                    {llmChip.label}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2">
                                                <span class={`inline-block px-2 py-0.5 rounded border text-[10px] ${finalChip.cls}`}>
                                                    {finalChip.label}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 text-xs font-mono">
                                                {fmtSize(rc.final_size_usdc ?? llm.suggested_size_usdc)}
                                            </td>
                                            <td class="px-3 py-2 text-xs text-[#9b9ba0]">
                                                {res.status || t('predict.intel.trace.status_pending')}
                                            </td>
                                            <td class="px-3 py-2 text-xs text-[#9b9ba0]" title={paperPnlTooltip()}>
                                                <Show
                                                    when={typeof res.would_pnl_usdc === 'number'}
                                                    fallback={<span>—</span>}
                                                >
                                                    <span>
                                                        <span class="text-[10px] mr-1">{t('predict.intel.trace.paper_pnl_prefix')}</span>
                                                        <span class="font-mono">{fmtPnL(res.would_pnl_usdc)}</span>
                                                    </span>
                                                </Show>
                                            </td>
                                        </tr>
                                    );
                                }}
                            </For>
                        </tbody>
                    </table>
                </div>

                {/* Load more */}
                <Show when={cursor()}>
                    <div class="flex justify-center">
                        <button
                            onClick={() => load(false)}
                            disabled={loading()}
                            class="px-4 py-2 rounded-lg border border-white/15 text-sm disabled:opacity-40"
                        >
                            {loading() ? t('predict.intel.trace.loading_more') : t('predict.intel.trace.load_more')}
                        </button>
                    </div>
                </Show>
            </Show>
        </div>
    );
}
