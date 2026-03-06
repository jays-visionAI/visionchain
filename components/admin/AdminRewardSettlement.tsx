import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { RefreshCw, ChevronLeft, ChevronDown, ChevronUp, DollarSign, Check, X, AlertTriangle, Eye, Shield, Zap } from 'lucide-solid';

const GATEWAY = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

async function api(action: string, body: any = {}) {
    const res = await fetch(GATEWAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...body }) });
    return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────
interface Snapshot { snapshotId: string; month: string; policyVersion: number; revenueUSD: number; poolUSD: number; poolAllocUSD: number; poolUseUSD: number; poolQualUSD: number; totalNodesRewarded: number; totalRewardUSD: number; totalRewardVCN: number; status: string; fxRateUsdPerVcn: number; createdAt: string; approvedBy?: string; rejectReason?: string; }
interface LineItem { nodeId: string; AC_gb_month: number; UC_gb_month: number; uptime: number; auditSuccessRate: number; p95LatencyMs: number; qualityScore: number; cutoffApplied: boolean; rewardAllocUSD: number; rewardUseUSD: number; rewardQualUSD: number; rewardTotalUSD: number; rewardVCN: number; }
interface Revenue { month: string; grossRevenueUSD: number; refundUSD: number; netRevenueUSD: number; source: string; confirmedByAdmin: boolean; }

export default function AdminRewardSettlement() {
    const [tab, setTab] = createSignal<'snapshots' | 'revenue' | 'run'>('snapshots');
    const [snapshots, setSnapshots] = createSignal<Snapshot[]>([]);
    const [revenues, setRevenues] = createSignal<Revenue[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [selectedSnapshot, setSelectedSnapshot] = createSignal<Snapshot | null>(null);
    const [lineItems, setLineItems] = createSignal<LineItem[]>([]);
    const [detailLoading, setDetailLoading] = createSignal(false);
    const [actionStatus, setActionStatus] = createSignal<'idle' | 'success' | 'error'>('idle');
    const [actionMsg, setActionMsg] = createSignal('');

    // Revenue form
    const [revMonth, setRevMonth] = createSignal('');
    const [revGross, setRevGross] = createSignal('');
    const [revRefund, setRevRefund] = createSignal('0');

    // Run engine form
    const [runMonth, setRunMonth] = createSignal('');
    const [runRevenue, setRunRevenue] = createSignal('');
    const [runFxRate, setRunFxRate] = createSignal('');

    const loadSnapshots = async () => { setLoading(true); const d = await api('reward_engine.list_snapshots'); setSnapshots(d.snapshots || []); setLoading(false); };
    const loadRevenues = async () => { const d = await api('revenue.list'); setRevenues(d.data || []); };

    onMount(() => { loadSnapshots(); loadRevenues(); });

    const openDetail = async (s: Snapshot) => {
        setSelectedSnapshot(s); setDetailLoading(true);
        const d = await api('reward_engine.get_snapshot', { snapshot_id: s.snapshotId });
        setLineItems(d.line_items || []); setDetailLoading(false);
    };

    const notify = (ok: boolean, msg: string) => { setActionStatus(ok ? 'success' : 'error'); setActionMsg(msg); setTimeout(() => setActionStatus('idle'), 3000); };

    const handleApprove = async (id: string) => { const d = await api('snapshot.approve', { snapshot_id: id }); notify(d.success, d.success ? 'Approved' : d.error); loadSnapshots(); if (selectedSnapshot()?.snapshotId === id) openDetail({ ...selectedSnapshot()!, status: 'APPROVED' }); };
    const handleReject = async (id: string) => { const reason = prompt('Reject reason:'); if (!reason) return; const d = await api('snapshot.reject', { snapshot_id: id, reason }); notify(d.success, d.success ? 'Rejected' : d.error); loadSnapshots(); };
    const handleGeneratePayouts = async (id: string) => { const d = await api('payout.generate', { snapshot_id: id }); notify(d.success, d.success ? `${d.total} payouts (${d.pending} pending, ${d.held} held)` : d.error); };
    const handleSaveRevenue = async () => { if (!revMonth() || !revGross()) return; const d = await api('revenue.set', { month: revMonth(), gross_revenue_usd: parseFloat(revGross()), refund_usd: parseFloat(revRefund()) || 0 }); notify(d.success, d.success ? `Saved: $${d.netRevenueUSD}` : d.error); loadRevenues(); };
    const handleConfirmRevenue = async (month: string) => { const d = await api('revenue.confirm', { month }); notify(d.success, d.success ? 'Confirmed' : d.error); loadRevenues(); };
    const handleRunEngine = async () => { if (!runMonth() || !runRevenue() || !runFxRate()) return; const d = await api('reward_engine.run', { month: runMonth(), revenue_usd: parseFloat(runRevenue()), fx_rate: parseFloat(runFxRate()) }); notify(d.success, d.success ? `Snapshot ${d.snapshot_id} created` : d.error); if (d.success) { loadSnapshots(); setTab('snapshots'); } };

    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
    const usd = (n: number) => `$${n.toFixed(2)}`;
    const statusColor = (s: string) => s === 'APPROVED' ? 'text-emerald-400 bg-emerald-500/10' : s === 'REJECTED' ? 'text-red-400 bg-red-500/10' : s === 'calculated' ? 'text-blue-400 bg-blue-500/10' : s === 'paid' ? 'text-purple-400 bg-purple-500/10' : 'text-gray-400 bg-gray-500/10';

    return (
        <div class="max-w-6xl mx-auto pb-20">
            {/* Toast */}
            <Show when={actionStatus() !== 'idle'}>
                <div class={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg animate-in fade-in slide-in-from-top-2 ${actionStatus() === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {actionMsg()}
                </div>
            </Show>

            {/* Detail View */}
            <Show when={selectedSnapshot()}>
                <div class="animate-in fade-in slide-in-from-right-4 duration-500">
                    <button onClick={() => setSelectedSnapshot(null)} class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
                        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10"><ChevronLeft class="w-4 h-4" /></div>
                        <span class="font-bold text-sm">Back to Snapshots</span>
                    </button>

                    {/* Snapshot Header */}
                    <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6 mb-6">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <div class="text-xs font-black text-gray-500 uppercase tracking-widest">Snapshot</div>
                                <h2 class="text-2xl font-bold text-white">{selectedSnapshot()!.month} &middot; v{selectedSnapshot()!.policyVersion}</h2>
                                <div class="font-mono text-[10px] text-gray-600 mt-1">{selectedSnapshot()!.snapshotId}</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase ${statusColor(selectedSnapshot()!.status)}`}>{selectedSnapshot()!.status}</span>
                            </div>
                        </div>
                        {/* KPIs */}
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <KPI label="Revenue" value={usd(selectedSnapshot()!.revenueUSD)} />
                            <KPI label="Reward Pool" value={usd(selectedSnapshot()!.poolUSD)} />
                            <KPI label="Nodes Rewarded" value={String(selectedSnapshot()!.totalNodesRewarded)} />
                            <KPI label="Total VCN" value={selectedSnapshot()!.totalRewardVCN.toFixed(2)} />
                        </div>
                        {/* Pool Breakdown */}
                        <div class="grid grid-cols-3 gap-3 mt-4">
                            <div class="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-center">
                                <div class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Alloc Pool</div>
                                <div class="text-lg font-bold text-white">{usd(selectedSnapshot()!.poolAllocUSD)}</div>
                            </div>
                            <div class="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-center">
                                <div class="text-[9px] font-black text-blue-400 uppercase tracking-widest">Use Pool</div>
                                <div class="text-lg font-bold text-white">{usd(selectedSnapshot()!.poolUseUSD)}</div>
                            </div>
                            <div class="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 text-center">
                                <div class="text-[9px] font-black text-purple-400 uppercase tracking-widest">Quality Pool</div>
                                <div class="text-lg font-bold text-white">{usd(selectedSnapshot()!.poolQualUSD)}</div>
                            </div>
                        </div>
                        {/* Actions */}
                        <Show when={selectedSnapshot()!.status === 'calculated'}>
                            <div class="flex gap-3 mt-5">
                                <button onClick={() => handleApprove(selectedSnapshot()!.snapshotId)} class="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><Check class="w-4 h-4" />Approve</button>
                                <button onClick={() => handleReject(selectedSnapshot()!.snapshotId)} class="flex-1 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><X class="w-4 h-4" />Reject</button>
                            </div>
                        </Show>
                        <Show when={selectedSnapshot()!.status === 'APPROVED'}>
                            <button onClick={() => handleGeneratePayouts(selectedSnapshot()!.snapshotId)} class="w-full mt-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"><Zap class="w-4 h-4" />Generate Payouts</button>
                        </Show>
                        <Show when={selectedSnapshot()!.rejectReason}>
                            <div class="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                                <div class="text-[9px] font-black text-red-400 uppercase tracking-widest mb-1">Reject Reason</div>
                                <div class="text-sm text-red-300">{selectedSnapshot()!.rejectReason}</div>
                            </div>
                        </Show>
                    </div>

                    {/* Line Items */}
                    <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                        <div class="p-4 border-b border-white/5"><h3 class="font-bold text-white text-sm">Node Breakdown ({lineItems().length})</h3></div>
                        <Show when={detailLoading()}><div class="p-8 text-center"><RefreshCw class="w-5 h-5 text-gray-500 animate-spin mx-auto" /></div></Show>
                        <Show when={!detailLoading()}>
                            <div class="overflow-x-auto">
                                <table class="w-full text-xs">
                                    <thead><tr class="border-b border-white/5">
                                        <th class="text-left py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Node</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Q Score</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Uptime</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Alloc</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Use</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Quality</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">Total USD</th>
                                        <th class="text-right py-2 px-3 text-[9px] font-black text-gray-500 uppercase">VCN</th>
                                    </tr></thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={lineItems()}>
                                            {(li) => (
                                                <tr class={`hover:bg-white/[0.02] ${li.cutoffApplied ? 'opacity-40' : ''}`}>
                                                    <td class="py-2 px-3"><span class="font-mono text-white">{li.nodeId.slice(0, 16)}</span>{li.cutoffApplied && <span class="ml-1 text-[8px] text-red-400 font-black">CUTOFF</span>}</td>
                                                    <td class="py-2 px-3 text-right font-bold text-white">{li.qualityScore.toFixed(4)}</td>
                                                    <td class="py-2 px-3 text-right text-gray-400">{pct(li.uptime)}</td>
                                                    <td class="py-2 px-3 text-right text-emerald-400">{usd(li.rewardAllocUSD)}</td>
                                                    <td class="py-2 px-3 text-right text-blue-400">{usd(li.rewardUseUSD)}</td>
                                                    <td class="py-2 px-3 text-right text-purple-400">{usd(li.rewardQualUSD)}</td>
                                                    <td class="py-2 px-3 text-right font-bold text-white">{usd(li.rewardTotalUSD)}</td>
                                                    <td class="py-2 px-3 text-right text-amber-400">{li.rewardVCN.toFixed(2)}</td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </Show>
                    </div>
                </div>
                {/* Return early from detail view */}
                {null}
            </Show>

            {/* Main View (no detail selected) */}
            <Show when={!selectedSnapshot()}>
                <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h1 class="text-3xl font-bold text-white tracking-tight">Reward Settlement</h1>
                            <p class="text-gray-400 mt-1">Revenue, snapshots, approval, and payout management</p>
                        </div>
                        <button onClick={() => { loadSnapshots(); loadRevenues(); }} class="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"><RefreshCw class={`w-4 h-4 ${loading() ? 'animate-spin' : ''}`} /></button>
                    </div>

                    {/* Tabs */}
                    <div class="flex gap-1 mb-6 bg-[#0d0d10] rounded-xl p-1 border border-white/5">
                        <For each={[['snapshots', 'Snapshots'], ['revenue', 'Revenue'], ['run', 'Run Engine']] as const}>
                            {([id, label]) => (
                                <button onClick={() => setTab(id)} class={`flex-1 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tab() === id ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{label}</button>
                            )}
                        </For>
                    </div>

                    {/* Tab: Snapshots */}
                    <Show when={tab() === 'snapshots'}>
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                            <Show when={loading()}><div class="p-12 text-center"><RefreshCw class="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" /><div class="text-xs text-gray-500 font-bold">Loading...</div></div></Show>
                            <Show when={!loading() && snapshots().length === 0}><div class="p-12 text-center text-gray-500 text-sm">No snapshots yet. Use "Run Engine" to generate one.</div></Show>
                            <Show when={!loading() && snapshots().length > 0}>
                                <table class="w-full text-sm">
                                    <thead><tr class="border-b border-white/5">
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Month</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Revenue</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Pool</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Nodes</th>
                                        <th class="text-right py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Actions</th>
                                    </tr></thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={snapshots()}>
                                            {(s) => (
                                                <tr class="hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => openDetail(s)}>
                                                    <td class="py-3 px-4 font-bold text-white">{s.month} <span class="text-gray-600 text-xs">v{s.policyVersion}</span></td>
                                                    <td class="py-3 px-4"><span class={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase ${statusColor(s.status)}`}>{s.status}</span></td>
                                                    <td class="py-3 px-4 text-gray-400">{usd(s.revenueUSD)}</td>
                                                    <td class="py-3 px-4 text-white font-bold">{usd(s.poolUSD)}</td>
                                                    <td class="py-3 px-4 text-gray-400">{s.totalNodesRewarded}</td>
                                                    <td class="py-3 px-4 text-right">
                                                        <button class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"><Eye class="w-3.5 h-3.5" /></button>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </Show>
                        </div>
                    </Show>

                    {/* Tab: Revenue */}
                    <Show when={tab() === 'revenue'}>
                        <div class="space-y-6">
                            {/* Input Form */}
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6">
                                <h3 class="font-bold text-white mb-4 flex items-center gap-2">
                                    <div class="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center"><DollarSign class="w-4 h-4 text-emerald-400" /></div>
                                    Register Monthly Revenue
                                </h3>
                                <div class="grid grid-cols-3 gap-4 mb-4">
                                    <div><label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Month</label><input type="month" value={revMonth()} onInput={e => setRevMonth(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50" /></div>
                                    <div><label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Gross Revenue (USD)</label><input type="number" value={revGross()} onInput={e => setRevGross(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50" /></div>
                                    <div><label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Refunds (USD)</label><input type="number" value={revRefund()} onInput={e => setRevRefund(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50" /></div>
                                </div>
                                <button onClick={handleSaveRevenue} class="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest transition-all">Save Revenue</button>
                            </div>
                            {/* Revenue List */}
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                                <table class="w-full text-sm">
                                    <thead><tr class="border-b border-white/5">
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase">Month</th>
                                        <th class="text-right py-3 px-4 text-[10px] font-black text-gray-500 uppercase">Gross</th>
                                        <th class="text-right py-3 px-4 text-[10px] font-black text-gray-500 uppercase">Refund</th>
                                        <th class="text-right py-3 px-4 text-[10px] font-black text-gray-500 uppercase">Net</th>
                                        <th class="text-center py-3 px-4 text-[10px] font-black text-gray-500 uppercase">Confirmed</th>
                                        <th class="text-right py-3 px-4 text-[10px] font-black text-gray-500 uppercase">Action</th>
                                    </tr></thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={revenues()}>
                                            {(r) => (
                                                <tr class="hover:bg-white/[0.02]">
                                                    <td class="py-3 px-4 font-bold text-white">{r.month}</td>
                                                    <td class="py-3 px-4 text-right text-gray-400">{usd(r.grossRevenueUSD)}</td>
                                                    <td class="py-3 px-4 text-right text-red-400">{usd(r.refundUSD)}</td>
                                                    <td class="py-3 px-4 text-right text-white font-bold">{usd(r.netRevenueUSD)}</td>
                                                    <td class="py-3 px-4 text-center">{r.confirmedByAdmin ? <Check class="w-4 h-4 text-emerald-400 mx-auto" /> : <X class="w-4 h-4 text-gray-600 mx-auto" />}</td>
                                                    <td class="py-3 px-4 text-right">
                                                        <Show when={!r.confirmedByAdmin}><button onClick={() => handleConfirmRevenue(r.month)} class="text-[10px] px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 font-bold transition-all">Confirm</button></Show>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                                <Show when={revenues().length === 0}><div class="p-8 text-center text-gray-500 text-sm">No revenue records</div></Show>
                            </div>
                        </div>
                    </Show>

                    {/* Tab: Run Engine */}
                    <Show when={tab() === 'run'}>
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6">
                            <h3 class="font-bold text-white mb-4 flex items-center gap-2">
                                <div class="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center"><Zap class="w-4 h-4 text-purple-400" /></div>
                                Run Reward Calculation
                            </h3>
                            <p class="text-gray-500 text-xs mb-5">Requires: active policy + monthly metrics aggregated. Will create a snapshot with status "calculated".</p>
                            <div class="grid grid-cols-3 gap-4 mb-5">
                                <div><label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Month</label><input type="month" value={runMonth()} onInput={e => setRunMonth(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50" /></div>
                                <div><label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">Revenue USD</label><input type="number" value={runRevenue()} onInput={e => setRunRevenue(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50" /></div>
                                <div><label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">FX Rate (USD/VCN)</label><input type="number" step="0.0001" value={runFxRate()} onInput={e => setRunFxRate(e.currentTarget.value)} class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50" /></div>
                            </div>
                            <button onClick={handleRunEngine} disabled={!runMonth() || !runRevenue() || !runFxRate()} class="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"><Zap class="w-4 h-4" />Execute Calculation</button>
                        </div>
                    </Show>
                </div>
            </Show>
        </div>
    );
}

function KPI(props: { label: string; value: string }) {
    return (
        <div class="bg-white/[0.03] rounded-xl p-3 text-center">
            <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">{props.label}</div>
            <div class="text-lg font-bold text-white mt-0.5">{props.value}</div>
        </div>
    );
}
