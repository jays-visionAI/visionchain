import { createSignal, onMount, For, Show } from 'solid-js';
import { RefreshCw, AlertTriangle, TrendingUp, Shield, Zap, ChevronDown, Check, X } from 'lucide-solid';

const GATEWAY = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
async function api(action: string, body: any = {}) {
    const res = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
    return res.json();
}

interface Report {
    revenue: any; snapshot: any;
    nodes: { total: number; rewarded: number; cutoff: number; cutoffRatio: number };
    earningDistribution: Record<string, number>;
    qualityDistribution: Record<string, number>;
    topEarners: Array<{ nodeId: string; totalUSD: number; qualityScore: number }>;
    abuse: { total: number; excluded: number; byType: Record<string, number> };
    rollover: { total: number; totalAccumulatedUSD: number };
}

interface AbuseFlag { flagId: string; nodeId: string; month: string; type: string; severity: string; description: string; excluded: boolean; resolvedAt?: string; }
interface BootstrapTier { label: string; minAllocGb: number; maxAllocGb: number; floorUSD: number; }
interface BootstrapConfig { enabled: boolean; tiers: BootstrapTier[]; qualityMinUptime: number; qualityMinAudit: number; totalFloorBudgetUSD: number; }

export default function AdminRewardOps() {
    const [tab, setTab] = createSignal<'report' | 'abuse' | 'rollover' | 'bootstrap'>('report');
    const [month, setMonth] = createSignal('');
    const [report, setReport] = createSignal<Report | null>(null);
    const [abuseFlags, setAbuseFlags] = createSignal<AbuseFlag[]>([]);
    const [rollovers, setRollovers] = createSignal<any[]>([]);
    const [bootstrap, setBootstrap] = createSignal<BootstrapConfig | null>(null);
    const [loading, setLoading] = createSignal(false);
    const [toast, setToast] = createSignal('');

    const notify = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

    const loadReport = async () => { if (!month()) return; setLoading(true); const d = await api('ops.monthly_report', { month: month() }); setReport(d.report || null); setLoading(false); };
    const loadAbuse = async () => { const d = await api('abuse.list', { month: month() || undefined }); setAbuseFlags(d.data || []); };
    const loadRollovers = async () => { const d = await api('rollover.list'); setRollovers(d.data || []); };
    const loadBootstrap = async () => { const d = await api('bootstrap.get'); setBootstrap(d.data || null); };

    onMount(() => {
        const now = new Date(); setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
        loadBootstrap();
    });

    const runScan = async () => { if (!month()) return; const d = await api('abuse.scan', { month: month() }); notify(d.success ? `${d.count} flags detected` : d.error); loadAbuse(); };
    const handleExclude = async (id: string, excl: boolean) => { await api('abuse.exclude', { flag_id: id, excluded: excl }); loadAbuse(); };
    const handleResolve = async (id: string) => { await api('abuse.resolve', { flag_id: id }); loadAbuse(); };
    const saveBootstrap = async () => { if (!bootstrap()) return; const d = await api('bootstrap.set', { config: bootstrap() }); notify(d.success ? 'Saved' : d.error); };

    const usd = (n: number) => `$${n.toFixed(2)}`;
    const sevColor = (s: string) => s === 'high' ? 'text-red-400 bg-red-500/10' : s === 'medium' ? 'text-amber-400 bg-amber-500/10' : 'text-blue-400 bg-blue-500/10';

    return (
        <div class="max-w-6xl mx-auto pb-20">
            <Show when={toast()}><div class="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold bg-emerald-600 text-white shadow-lg">{toast()}</div></Show>

            <div class="flex items-center justify-between mb-8">
                <div>
                    <h1 class="text-3xl font-bold text-white tracking-tight">Reward Operations</h1>
                    <p class="text-gray-400 mt-1">Monitoring, abuse detection, rollover, and bootstrap management</p>
                </div>
                <div class="flex items-center gap-3">
                    <input type="month" value={month()} onInput={e => setMonth(e.currentTarget.value)} class="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-blue-500/50" />
                </div>
            </div>

            {/* Tabs */}
            <div class="flex gap-1 mb-6 bg-[#0d0d10] rounded-xl p-1 border border-white/5">
                <For each={[['report', 'Monthly Report'], ['abuse', 'Abuse Detection'], ['rollover', 'Rollovers'], ['bootstrap', 'Bootstrap']] as const}>
                    {([id, label]) => (
                        <button onClick={() => { setTab(id); if (id === 'report') loadReport(); else if (id === 'abuse') loadAbuse(); else if (id === 'rollover') loadRollovers(); else loadBootstrap(); }}
                            class={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tab() === id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{label}</button>
                    )}
                </For>
            </div>

            {/* ═══ Tab: Monthly Report ═══ */}
            <Show when={tab() === 'report'}>
                <div class="space-y-6">
                    <button onClick={loadReport} disabled={!month()} class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"><TrendingUp class="w-4 h-4" />Generate Report</button>
                    <Show when={loading()}><div class="p-12 text-center"><RefreshCw class="w-6 h-6 text-gray-500 animate-spin mx-auto" /></div></Show>
                    <Show when={report() && !loading()}>
                        {/* KPIs */}
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <KPI label="Revenue" value={report()!.revenue ? usd(report()!.revenue.netRevenueUSD) : 'N/A'} />
                            <KPI label="Reward Pool" value={report()!.snapshot ? usd(report()!.snapshot.poolUSD) : 'N/A'} />
                            <KPI label="Nodes Rewarded" value={`${report()!.nodes.rewarded} / ${report()!.nodes.total}`} />
                            <KPI label="Cutoff Rate" value={`${report()!.nodes.cutoffRatio}%`} />
                        </div>

                        {/* Pool Breakdown */}
                        <Show when={report()!.snapshot}>
                            <div class="grid grid-cols-3 gap-3">
                                <PoolCard label="Alloc Pool" value={usd(report()!.snapshot.poolAllocUSD)} color="emerald" />
                                <PoolCard label="Use Pool" value={usd(report()!.snapshot.poolUseUSD)} color="blue" />
                                <PoolCard label="Quality Pool" value={usd(report()!.snapshot.poolQualUSD)} color="purple" />
                            </div>
                        </Show>

                        {/* Distribution Charts (as tables) */}
                        <div class="grid grid-cols-2 gap-6">
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Earning Distribution</h3>
                                <For each={Object.entries(report()!.earningDistribution)}>
                                    {([bucket, count]) => (<DistBar label={bucket} count={count as number} total={report()!.nodes.total} />)}
                                </For>
                            </div>
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Quality Distribution</h3>
                                <For each={Object.entries(report()!.qualityDistribution)}>
                                    {([bucket, count]) => (<DistBar label={bucket} count={count as number} total={report()!.nodes.total} />)}
                                </For>
                            </div>
                        </div>

                        {/* Top Earners */}
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                            <div class="p-4 border-b border-white/5"><h3 class="text-xs font-black text-gray-500 uppercase tracking-widest">Top 10 Earners</h3></div>
                            <table class="w-full text-sm">
                                <thead><tr class="border-b border-white/5">
                                    <th class="text-left py-2 px-4 text-[9px] font-black text-gray-500 uppercase">#</th>
                                    <th class="text-left py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Node</th>
                                    <th class="text-right py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Reward USD</th>
                                    <th class="text-right py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Q Score</th>
                                </tr></thead>
                                <tbody class="divide-y divide-white/5">
                                    <For each={report()!.topEarners}>{(n, i) => (
                                        <tr class="hover:bg-white/[0.02]">
                                            <td class="py-2 px-4 text-gray-500">{i() + 1}</td>
                                            <td class="py-2 px-4 font-mono text-white text-xs">{n.nodeId.slice(0, 20)}</td>
                                            <td class="py-2 px-4 text-right font-bold text-emerald-400">{usd(n.totalUSD)}</td>
                                            <td class="py-2 px-4 text-right text-gray-400">{n.qualityScore.toFixed(4)}</td>
                                        </tr>
                                    )}</For>
                                </tbody>
                            </table>
                        </div>

                        {/* Abuse & Rollover Summary */}
                        <div class="grid grid-cols-2 gap-6">
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Abuse Flags</h3>
                                <div class="text-2xl font-bold text-white">{report()!.abuse.total} <span class="text-sm text-red-400">({report()!.abuse.excluded} excluded)</span></div>
                                <div class="mt-2 space-y-1">
                                    <For each={Object.entries(report()!.abuse.byType)}>{([type, ct]) => (<div class="flex justify-between text-xs"><span class="text-gray-400">{type}</span><span class="text-white font-bold">{ct as number}</span></div>)}</For>
                                </div>
                            </div>
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Rollover</h3>
                                <div class="text-2xl font-bold text-white">{report()!.rollover.total} nodes</div>
                                <div class="text-sm text-amber-400 mt-1">{usd(report()!.rollover.totalAccumulatedUSD)} accumulated</div>
                            </div>
                        </div>
                    </Show>
                </div>
            </Show>

            {/* ═══ Tab: Abuse Detection ═══ */}
            <Show when={tab() === 'abuse'}>
                <div class="space-y-4">
                    <div class="flex gap-3">
                        <button onClick={runScan} disabled={!month()} class="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-40 flex items-center gap-2"><AlertTriangle class="w-4 h-4" />Scan {month()}</button>
                        <button onClick={loadAbuse} class="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2"><RefreshCw class="w-4 h-4" />Refresh</button>
                    </div>
                    <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                        <Show when={abuseFlags().length === 0}><div class="p-8 text-center text-gray-500 text-sm">No abuse flags</div></Show>
                        <Show when={abuseFlags().length > 0}>
                            <table class="w-full text-xs">
                                <thead><tr class="border-b border-white/5">
                                    <th class="text-left py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Node</th>
                                    <th class="text-left py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Type</th>
                                    <th class="text-left py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Sev</th>
                                    <th class="text-left py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Description</th>
                                    <th class="text-center py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Excluded</th>
                                    <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Actions</th>
                                </tr></thead>
                                <tbody class="divide-y divide-white/5">
                                    <For each={abuseFlags()}>{(f) => (
                                        <tr class={`hover:bg-white/[0.02] ${f.excluded ? 'opacity-60' : ''}`}>
                                            <td class="py-2 px-3 font-mono text-white">{f.nodeId.slice(0, 14)}</td>
                                            <td class="py-2 px-3 text-gray-400">{f.type}</td>
                                            <td class="py-2 px-3"><span class={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${sevColor(f.severity)}`}>{f.severity}</span></td>
                                            <td class="py-2 px-3 text-gray-300 max-w-xs truncate">{f.description}</td>
                                            <td class="py-2 px-3 text-center">{f.excluded ? <X class="w-3.5 h-3.5 text-red-400 mx-auto" /> : <Check class="w-3.5 h-3.5 text-gray-600 mx-auto" />}</td>
                                            <td class="py-2 px-3 text-right space-x-1">
                                                <Show when={!f.excluded}><button onClick={() => handleExclude(f.flagId, true)} class="text-[9px] px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/40 font-bold">Exclude</button></Show>
                                                <Show when={f.excluded && !f.resolvedAt}><button onClick={() => handleResolve(f.flagId)} class="text-[9px] px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 font-bold">Resolve</button></Show>
                                            </td>
                                        </tr>
                                    )}</For>
                                </tbody>
                            </table>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* ═══ Tab: Rollovers ═══ */}
            <Show when={tab() === 'rollover'}>
                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div class="p-4 border-b border-white/5 flex justify-between items-center">
                        <h3 class="text-xs font-black text-gray-500 uppercase tracking-widest">Accumulated Rollovers ({rollovers().length})</h3>
                        <button onClick={loadRollovers} class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400"><RefreshCw class="w-3.5 h-3.5" /></button>
                    </div>
                    <Show when={rollovers().length === 0}><div class="p-8 text-center text-gray-500 text-sm">No rollover balances</div></Show>
                    <Show when={rollovers().length > 0}>
                        <table class="w-full text-sm">
                            <thead><tr class="border-b border-white/5">
                                <th class="text-left py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Node</th>
                                <th class="text-right py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Accumulated USD</th>
                                <th class="text-right py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Accumulated VCN</th>
                                <th class="text-right py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Months</th>
                                <th class="text-right py-2 px-4 text-[9px] font-black text-gray-500 uppercase">Last Updated</th>
                            </tr></thead>
                            <tbody class="divide-y divide-white/5">
                                <For each={rollovers()}>{(r) => (
                                    <tr class="hover:bg-white/[0.02]">
                                        <td class="py-2 px-4 font-mono text-white text-xs">{r.nodeId.slice(0, 20)}</td>
                                        <td class="py-2 px-4 text-right text-amber-400 font-bold">{usd(r.accumulatedUSD)}</td>
                                        <td class="py-2 px-4 text-right text-gray-400">{r.accumulatedVCN.toFixed(2)}</td>
                                        <td class="py-2 px-4 text-right text-gray-500">{r.history?.length || 0}</td>
                                        <td class="py-2 px-4 text-right text-gray-600 text-xs">{r.lastUpdatedMonth}</td>
                                    </tr>
                                )}</For>
                            </tbody>
                        </table>
                    </Show>
                </div>
            </Show>

            {/* ═══ Tab: Bootstrap ═══ */}
            <Show when={tab() === 'bootstrap'}>
                <Show when={bootstrap()}>
                    <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6 space-y-5">
                        <div class="flex items-center justify-between">
                            <h3 class="font-bold text-white flex items-center gap-2"><Shield class="w-5 h-5 text-purple-400" />Bootstrap Minimum Guarantee</h3>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <span class="text-xs text-gray-400 font-bold">{bootstrap()!.enabled ? 'Enabled' : 'Disabled'}</span>
                                <button onClick={() => setBootstrap({ ...bootstrap()!, enabled: !bootstrap()!.enabled })} class={`w-10 h-5 rounded-full transition-all relative ${bootstrap()!.enabled ? 'bg-emerald-600' : 'bg-gray-700'}`}>
                                    <div class={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${bootstrap()!.enabled ? 'left-5' : 'left-0.5'}`} />
                                </button>
                            </label>
                        </div>

                        <div class="grid grid-cols-3 gap-4">
                            <div><label class="text-[9px] font-black text-gray-500 uppercase block mb-1.5">Min Uptime</label><input type="number" step="0.01" value={bootstrap()!.qualityMinUptime} onInput={e => setBootstrap({ ...bootstrap()!, qualityMinUptime: parseFloat(e.currentTarget.value) || 0 })} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50" /></div>
                            <div><label class="text-[9px] font-black text-gray-500 uppercase block mb-1.5">Min Audit Rate</label><input type="number" step="0.01" value={bootstrap()!.qualityMinAudit} onInput={e => setBootstrap({ ...bootstrap()!, qualityMinAudit: parseFloat(e.currentTarget.value) || 0 })} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50" /></div>
                            <div><label class="text-[9px] font-black text-gray-500 uppercase block mb-1.5">Budget Cap (USD)</label><input type="number" value={bootstrap()!.totalFloorBudgetUSD} onInput={e => setBootstrap({ ...bootstrap()!, totalFloorBudgetUSD: parseFloat(e.currentTarget.value) || 0 })} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50" /></div>
                        </div>

                        <div>
                            <h4 class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Tiers</h4>
                            <div class="space-y-2">
                                <For each={bootstrap()!.tiers}>{(tier, i) => (
                                    <div class="grid grid-cols-4 gap-3 bg-black/20 rounded-lg p-3">
                                        <div><label class="text-[8px] text-gray-600 uppercase block">Label</label><input type="text" value={tier.label} onInput={e => { const t = [...bootstrap()!.tiers]; t[i()] = { ...t[i()], label: e.currentTarget.value }; setBootstrap({ ...bootstrap()!, tiers: t }); }} class="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white" /></div>
                                        <div><label class="text-[8px] text-gray-600 uppercase block">Min GB</label><input type="number" value={tier.minAllocGb} onInput={e => { const t = [...bootstrap()!.tiers]; t[i()] = { ...t[i()], minAllocGb: parseFloat(e.currentTarget.value) || 0 }; setBootstrap({ ...bootstrap()!, tiers: t }); }} class="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white" /></div>
                                        <div><label class="text-[8px] text-gray-600 uppercase block">Max GB</label><input type="number" value={tier.maxAllocGb} onInput={e => { const t = [...bootstrap()!.tiers]; t[i()] = { ...t[i()], maxAllocGb: parseFloat(e.currentTarget.value) || 0 }; setBootstrap({ ...bootstrap()!, tiers: t }); }} class="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white" /></div>
                                        <div><label class="text-[8px] text-gray-600 uppercase block">Floor USD</label><input type="number" step="0.01" value={tier.floorUSD} onInput={e => { const t = [...bootstrap()!.tiers]; t[i()] = { ...t[i()], floorUSD: parseFloat(e.currentTarget.value) || 0 }; setBootstrap({ ...bootstrap()!, tiers: t }); }} class="w-full bg-transparent border border-white/10 rounded px-2 py-1.5 text-xs text-white" /></div>
                                    </div>
                                )}</For>
                            </div>
                        </div>

                        <button onClick={saveBootstrap} class="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase tracking-widest transition-all">Save Configuration</button>
                    </div>
                </Show>
            </Show>
        </div>
    );
}

function KPI(props: { label: string; value: string }) {
    return (<div class="bg-[#15151a] border border-white/[0.06] rounded-xl p-4 text-center"><div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">{props.label}</div><div class="text-xl font-bold text-white mt-1">{props.value}</div></div>);
}

function PoolCard(props: { label: string; value: string; color: string }) {
    const colors: Record<string, string> = { emerald: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400', blue: 'bg-blue-500/5 border-blue-500/20 text-blue-400', purple: 'bg-purple-500/5 border-purple-500/20 text-purple-400' };
    return (<div class={`border rounded-xl p-3 text-center ${colors[props.color]}`}><div class={`text-[9px] font-black uppercase tracking-widest ${colors[props.color].split(' ').pop()}`}>{props.label}</div><div class="text-lg font-bold text-white">{props.value}</div></div>);
}

function DistBar(props: { label: string; count: number; total: number }) {
    const pct = () => props.total > 0 ? (props.count / props.total * 100) : 0;
    return (
        <div class="flex items-center gap-2 mb-1.5">
            <div class="w-20 text-[10px] text-gray-400 font-bold text-right shrink-0">{props.label}</div>
            <div class="flex-1 h-4 bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-blue-500/40 rounded-full transition-all" style={`width: ${pct()}%`} /></div>
            <div class="w-8 text-[10px] text-gray-500 font-bold">{props.count}</div>
        </div>
    );
}
