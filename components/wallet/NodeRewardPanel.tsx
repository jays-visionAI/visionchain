import { createSignal, onMount, Show, For } from 'solid-js';

const GATEWAY = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

async function api(action: string, body: any = {}) {
    const res = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
    return res.json();
}

interface RewardSummary {
    totalEarnedUSD: number; totalEarnedVCN: number; totalEarnedRP: number; monthsActive: number;
    rolloverUSD: number; rolloverVCN: number;
}
interface HistoryItem {
    month: string; rewardTotalUSD: number; rewardVCN: number;
    qualityScore: number; allocUSD: number; useUSD: number; qualUSD: number;
    cutoffApplied: boolean; status?: string;
}
interface QualityData {
    metrics: { allocatedGb: number; usedGb: number; uptimePct: number; auditPct: number; p95LatencyMs: number };
    quality: { score: number; latencyScore: number; cutoffApplied: boolean; cutoffReason: string | null };
    thresholds: { uptimeCutoff: number; auditCutoff: number } | null;
}

export default function NodeRewardPanel(props: { nodeId: string }) {
    const [summary, setSummary] = createSignal<RewardSummary | null>(null);
    const [history, setHistory] = createSignal<HistoryItem[]>([]);
    const [quality, setQuality] = createSignal<QualityData | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [tab, setTab] = createSignal<'overview' | 'history' | 'quality'>('overview');

    const load = async () => {
        setLoading(true);
        const [sumRes, qualRes] = await Promise.all([
            api('my_rewards.summary', { node_id: props.nodeId }),
            api('my_rewards.quality', { node_id: props.nodeId }),
        ]);
        if (sumRes.success) { setSummary(sumRes.summary); setHistory(sumRes.history || []); }
        if (qualRes.success && qualRes.metrics) setQuality({ metrics: qualRes.metrics, quality: qualRes.quality, thresholds: qualRes.thresholds });
        setLoading(false);
    };

    onMount(load);

    const usd = (n: number) => `$${n.toFixed(2)}`;
    const vcn = (n: number) => `${n.toFixed(2)} VCN`;

    return (
        <div class="space-y-4">
            {/* Tabs */}
            <div class="flex gap-1 bg-black/30 rounded-lg p-0.5">
                {(['overview', 'history', 'quality'] as const).map(t => (
                    <button onClick={() => setTab(t)} class={`flex-1 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${tab() === t ? 'bg-white/10 text-white' : 'text-gray-500'}`}>
                        {t === 'overview' ? 'Earnings' : t === 'history' ? 'History' : 'Quality'}
                    </button>
                ))}
            </div>

            <Show when={loading()}>
                <div class="py-8 text-center">
                    <svg class="w-5 h-5 animate-spin mx-auto text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56" /></svg>
                </div>
            </Show>

            {/* ─── Overview Tab ─── */}
            <Show when={tab() === 'overview' && !loading()}>
                <Show when={summary()} fallback={<div class="py-6 text-center text-gray-500 text-xs">No reward data yet</div>}>
                    <div class="space-y-3">
                        {/* 3-Type Earned Summary */}
                        <div class="grid grid-cols-3 gap-2">
                            <div class="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                <div class="text-[8px] font-black text-emerald-400/70 uppercase tracking-widest">USDT</div>
                                <div class="text-lg font-bold text-emerald-400 mt-0.5">{usd(summary()!.totalEarnedUSD)}</div>
                                <div class="text-[9px] text-gray-500">Storage Usage</div>
                            </div>
                            <div class="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-xl p-3">
                                <div class="text-[8px] font-black text-cyan-400/70 uppercase tracking-widest">VCN</div>
                                <div class="text-lg font-bold text-cyan-400 mt-0.5">{vcn(summary()!.totalEarnedVCN)}</div>
                                <div class="text-[9px] text-gray-500">Uptime</div>
                            </div>
                            <div class="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                <div class="text-[8px] font-black text-amber-400/70 uppercase tracking-widest">RP</div>
                                <div class="text-lg font-bold text-amber-400 mt-0.5">{(summary()!.totalEarnedRP || 0).toLocaleString()}</div>
                                <div class="text-[9px] text-gray-500">Testnet</div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                                <div class="text-[8px] font-black text-gray-500 uppercase tracking-widest">Months Active</div>
                                <div class="text-lg font-bold text-white mt-0.5">{summary()!.monthsActive}</div>
                            </div>
                            <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                                <div class="text-[8px] font-black text-gray-500 uppercase tracking-widest">Pending Rollover</div>
                                <div class="text-lg font-bold text-amber-400 mt-0.5">{summary()!.rolloverUSD > 0 ? usd(summary()!.rolloverUSD) : '--'}</div>
                            </div>
                        </div>

                        {/* Quality Score Quick View */}
                        <Show when={quality()}>
                            <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Quality Score</div>
                                    <Show when={quality()!.quality.cutoffApplied}>
                                        <span class="text-[8px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold">CUTOFF</span>
                                    </Show>
                                </div>
                                <div class="flex items-end gap-2">
                                    <div class="text-3xl font-bold text-white">{(quality()!.quality.score * 100).toFixed(1)}</div>
                                    <div class="text-sm text-gray-500 pb-1">/ 100</div>
                                </div>
                                <div class="mt-2 h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div class={`h-full rounded-full transition-all ${quality()!.quality.score > 0.8 ? 'bg-emerald-500' : quality()!.quality.score > 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} style={`width: ${quality()!.quality.score * 100}%`} />
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>
            </Show>

            {/* ─── History Tab ─── */}
            <Show when={tab() === 'history' && !loading()}>
                <Show when={history().length > 0} fallback={<div class="py-6 text-center text-gray-500 text-xs">No reward history</div>}>
                    <div class="space-y-2">
                        <For each={history()}>{(h) => (
                            <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs font-bold text-white">{h.month || 'N/A'}</span>
                                    <span class="text-xs font-bold text-emerald-400">{usd(h.rewardTotalUSD)}</span>
                                </div>
                                <div class="flex gap-3 text-[9px] text-gray-500">
                                    <span>Alloc {usd(h.allocUSD)}</span>
                                    <span>Use {usd(h.useUSD)}</span>
                                    <span>Qual {usd(h.qualUSD)}</span>
                                </div>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-[9px] text-gray-600">Q: {(h.qualityScore * 100).toFixed(1)}</span>
                                    <Show when={h.cutoffApplied}><span class="text-[8px] text-red-400">cutoff</span></Show>
                                </div>
                            </div>
                        )}</For>
                    </div>
                </Show>
            </Show>

            {/* ─── Quality Tab ─── */}
            <Show when={tab() === 'quality' && !loading()}>
                <Show when={quality()} fallback={<div class="py-6 text-center text-gray-500 text-xs">No quality data</div>}>
                    <div class="space-y-3">
                        {/* Metric Bars */}
                        <MetricBar label="Uptime" value={quality()!.metrics.uptimePct} unit="%" threshold={quality()!.thresholds ? quality()!.thresholds!.uptimeCutoff * 100 : undefined} />
                        <MetricBar label="Audit Pass" value={quality()!.metrics.auditPct} unit="%" threshold={quality()!.thresholds ? quality()!.thresholds!.auditCutoff * 100 : undefined} />
                        <MetricBar label="Latency" value={quality()!.metrics.p95LatencyMs} unit="ms" inverted />

                        <div class="grid grid-cols-2 gap-2">
                            <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                                <div class="text-[8px] font-black text-gray-500 uppercase">Allocated</div>
                                <div class="text-sm font-bold text-white">{quality()!.metrics.allocatedGb.toFixed(2)} GB</div>
                            </div>
                            <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                                <div class="text-[8px] font-black text-gray-500 uppercase">Used</div>
                                <div class="text-sm font-bold text-white">{quality()!.metrics.usedGb.toFixed(2)} GB</div>
                            </div>
                        </div>

                        <Show when={quality()!.quality.cutoffApplied}>
                            <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300">
                                <svg class="w-4 h-4 text-red-400 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                Reward cutoff: {quality()!.quality.cutoffReason}
                            </div>
                        </Show>
                    </div>
                </Show>
            </Show>
        </div>
    );
}

function MetricBar(props: { label: string; value: number; unit: string; threshold?: number; inverted?: boolean }) {
    const pct = () => {
        if (props.inverted) return Math.max(0, Math.min(100, 100 - props.value / 20)); // 2000ms = 0%, 0ms = 100%
        return Math.min(100, props.value);
    };
    const color = () => {
        if (props.inverted) return pct() > 80 ? 'bg-emerald-500' : pct() > 50 ? 'bg-amber-500' : 'bg-red-500';
        if (props.threshold && props.value < props.threshold) return 'bg-red-500';
        return pct() > 80 ? 'bg-emerald-500' : pct() > 50 ? 'bg-amber-500' : 'bg-red-500';
    };
    return (
        <div class="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div class="flex justify-between items-center mb-1.5">
                <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">{props.label}</span>
                <span class="text-sm font-bold text-white">{props.value.toFixed(1)}{props.unit}</span>
            </div>
            <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div class={`h-full rounded-full transition-all ${color()}`} style={`width: ${pct()}%`} />
            </div>
            <Show when={props.threshold}>
                <div class="text-[8px] text-gray-600 mt-1">Min: {props.threshold}{props.unit}</div>
            </Show>
        </div>
    );
}
