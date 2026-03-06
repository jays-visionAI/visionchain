import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { RefreshCw, ChevronLeft, Plus, Check, X, AlertTriangle, Power, PowerOff, Edit3, Trash2 } from 'lucide-solid';

const GATEWAY = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

// ─── Types ───────────────────────────────────────────────────────────
interface RewardPolicy {
    policyId: string;
    version: number;
    effectiveFrom: string;
    effectiveTo: string;
    rewardPoolRatio: number;
    allocPoolRatio: number;
    usePoolRatio: number;
    qualityPoolRatio: number;
    allocationCapLambda: number;
    allocPureRatio: number;
    uptimeCutoff: number;
    auditCutoff: number;
    latencyMinMs: number;
    latencyMaxMs: number;
    qualityWeightUptime: number;
    qualityWeightAudit: number;
    qualityWeightLatency: number;
    minPayoutUsd: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// ─── API Helpers ─────────────────────────────────────────────────────
async function apiCall(action: string, body: any = {}) {
    const res = await fetch(GATEWAY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
    });
    return res.json();
}

// ─── Default Form Values ─────────────────────────────────────────────
const defaultForm = (): Omit<RewardPolicy, 'policyId' | 'createdAt' | 'updatedAt'> => ({
    version: 1,
    effectiveFrom: new Date().toISOString().slice(0, 16),
    effectiveTo: '',
    rewardPoolRatio: 0.30,
    allocPoolRatio: 0.40,
    usePoolRatio: 0.35,
    qualityPoolRatio: 0.25,
    allocationCapLambda: 1.50,
    allocPureRatio: 0.30,
    uptimeCutoff: 0.90,
    auditCutoff: 0.95,
    latencyMinMs: 50,
    latencyMaxMs: 2000,
    qualityWeightUptime: 0.50,
    qualityWeightAudit: 0.30,
    qualityWeightLatency: 0.20,
    minPayoutUsd: 1.00,
    isActive: true,
});

// ─── Component ───────────────────────────────────────────────────────
export default function AdminRewardPolicy() {
    const [view, setView] = createSignal<'list' | 'create' | 'edit'>('list');
    const [policies, setPolicies] = createSignal<RewardPolicy[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saveStatus, setSaveStatus] = createSignal<'idle' | 'success' | 'error'>('idle');
    const [errors, setErrors] = createSignal<string[]>([]);
    const [editingId, setEditingId] = createSignal<string | null>(null);
    const [form, setForm] = createSignal(defaultForm());

    // ── Computed Sums ──
    const poolSum = createMemo(() => {
        const f = form();
        return Math.round((f.allocPoolRatio + f.usePoolRatio + f.qualityPoolRatio) * 10000) / 10000;
    });
    const qualitySum = createMemo(() => {
        const f = form();
        return Math.round((f.qualityWeightUptime + f.qualityWeightAudit + f.qualityWeightLatency) * 10000) / 10000;
    });

    // ── Load Policies ──
    const loadPolicies = async () => {
        setLoading(true);
        try {
            const data = await apiCall('reward_policy.list');
            if (data.success) {
                setPolicies(data.policies || []);
            }
        } catch (e) {
            console.error('[RewardPolicy] Load error:', e);
        } finally {
            setLoading(false);
        }
    };

    onMount(loadPolicies);

    // ── Save Policy (Create or Update) ──
    const handleSave = async () => {
        setErrors([]);
        setSaving(true);
        setSaveStatus('idle');

        try {
            const f = form();

            // Client-side pre-validation
            const clientErrors: string[] = [];
            if (poolSum() !== 1.0) clientErrors.push(`Pool ratios must sum to 1.0 (current: ${poolSum()})`);
            if (qualitySum() !== 1.0) clientErrors.push(`Quality weights must sum to 1.0 (current: ${qualitySum()})`);
            if (f.rewardPoolRatio > 0.30) clientErrors.push(`rewardPoolRatio must be <= 0.30 (30%)`);
            if (f.latencyMaxMs <= f.latencyMinMs) clientErrors.push(`latencyMaxMs must be > latencyMinMs`);

            if (clientErrors.length > 0) {
                setErrors(clientErrors);
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 4000);
                return;
            }

            let data;
            if (view() === 'edit' && editingId()) {
                // Update
                const { version, ...updates } = f;
                data = await apiCall('reward_policy.update', { policy_id: editingId(), updates });
            } else {
                // Create - auto-increment version
                const maxVersion = policies().reduce((m, p) => Math.max(m, p.version), 0);
                data = await apiCall('reward_policy.create', {
                    policy: { ...f, version: maxVersion + 1 },
                });
            }

            if (data.success) {
                setSaveStatus('success');
                setTimeout(() => {
                    setSaveStatus('idle');
                    setView('list');
                    loadPolicies();
                }, 1200);
            } else {
                setErrors(data.errors || [data.error || 'Unknown error']);
                setSaveStatus('error');
                setTimeout(() => setSaveStatus('idle'), 4000);
            }
        } catch (e: any) {
            setErrors([e.message || 'Network error']);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 4000);
        } finally {
            setSaving(false);
        }
    };

    // ── Activate / Deactivate ──
    const handleActivate = async (policyId: string) => {
        await apiCall('reward_policy.activate', { policy_id: policyId });
        loadPolicies();
    };

    const handleDeactivate = async (policyId: string) => {
        await apiCall('reward_policy.deactivate', { policy_id: policyId });
        loadPolicies();
    };

    // ── Open Edit Form ──
    const openEdit = (p: RewardPolicy) => {
        setEditingId(p.policyId);
        setForm({
            version: p.version,
            effectiveFrom: p.effectiveFrom?.slice(0, 16) || '',
            effectiveTo: p.effectiveTo?.slice(0, 16) || '',
            rewardPoolRatio: p.rewardPoolRatio,
            allocPoolRatio: p.allocPoolRatio,
            usePoolRatio: p.usePoolRatio,
            qualityPoolRatio: p.qualityPoolRatio,
            allocationCapLambda: p.allocationCapLambda,
            allocPureRatio: p.allocPureRatio ?? 0.3,
            uptimeCutoff: p.uptimeCutoff,
            auditCutoff: p.auditCutoff,
            latencyMinMs: p.latencyMinMs,
            latencyMaxMs: p.latencyMaxMs,
            qualityWeightUptime: p.qualityWeightUptime,
            qualityWeightAudit: p.qualityWeightAudit,
            qualityWeightLatency: p.qualityWeightLatency,
            minPayoutUsd: p.minPayoutUsd,
            isActive: p.isActive,
        });
        setErrors([]);
        setView('edit');
    };

    // ── Open Create Form ──
    const openCreate = () => {
        setEditingId(null);
        setForm(defaultForm());
        setErrors([]);
        setView('create');
    };

    // ── Update a single form field ──
    const updateField = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    // ── Helpers ──
    const fmtDate = (iso: string) => {
        if (!iso) return '--';
        try { return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
        catch { return iso; }
    };
    const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

    // ─── Render ──────────────────────────────────────────────────────

    return (
        <div class="max-w-5xl mx-auto pb-20">
            {/* ── LIST VIEW ── */}
            <Show when={view() === 'list'}>
                <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div class="flex items-center justify-between mb-8">
                        <div>
                            <h1 class="text-3xl font-bold text-white tracking-tight">Reward Policy</h1>
                            <p class="text-gray-400 mt-1">Manage distributed storage node reward policies</p>
                        </div>
                        <div class="flex items-center gap-3">
                            <button
                                onClick={loadPolicies}
                                class="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all"
                            >
                                <RefreshCw class={`w-4 h-4 ${loading() ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={openCreate}
                                class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-emerald-600/20"
                            >
                                <Plus class="w-4 h-4" />
                                New Policy
                            </button>
                        </div>
                    </div>

                    {/* Active Policy Highlight */}
                    <Show when={policies().find(p => p.isActive)}>
                        {(active) => (
                            <div class="mb-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-5">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center gap-3">
                                        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                            <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                        </div>
                                        <div>
                                            <div class="text-xs font-black text-emerald-400 uppercase tracking-widest">Active Policy</div>
                                            <div class="text-white font-bold">v{active().version} &middot; Pool {pct(active().rewardPoolRatio)}</div>
                                        </div>
                                    </div>
                                    <div class="text-right text-xs text-gray-500">
                                        <div>Since {fmtDate(active().effectiveFrom)}</div>
                                        <div class="font-mono text-[10px] text-gray-600 mt-0.5">{active().policyId}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Show>

                    {/* Policy Table */}
                    <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl overflow-hidden">
                        <Show when={loading()}>
                            <div class="p-12 text-center">
                                <RefreshCw class="w-6 h-6 text-gray-500 animate-spin mx-auto mb-3" />
                                <div class="text-xs text-gray-500 font-bold uppercase tracking-widest">Loading Policies...</div>
                            </div>
                        </Show>
                        <Show when={!loading() && policies().length === 0}>
                            <div class="p-12 text-center">
                                <div class="text-gray-500 text-sm">No policies found. Create your first policy.</div>
                            </div>
                        </Show>
                        <Show when={!loading() && policies().length > 0}>
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b border-white/5">
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Version</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Pool</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Alloc / Use / Quality</th>
                                        <th class="text-left py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Effective</th>
                                        <th class="text-right py-3 px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/5">
                                    <For each={policies()}>
                                        {(p) => (
                                            <tr class={`hover:bg-white/[0.02] transition-colors ${p.isActive ? 'bg-emerald-500/[0.03]' : ''}`}>
                                                <td class="py-3 px-4">
                                                    <span class="font-bold text-white text-base">v{p.version}</span>
                                                    <div class="text-[10px] font-mono text-gray-600 mt-0.5">{p.policyId}</div>
                                                </td>
                                                <td class="py-3 px-4">
                                                    <Show when={p.isActive} fallback={
                                                        <span class="text-[10px] px-2.5 py-1 rounded-full font-bold bg-gray-500/10 text-gray-500">Inactive</span>
                                                    }>
                                                        <span class="text-[10px] px-2.5 py-1 rounded-full font-bold bg-emerald-500/10 text-emerald-400 animate-pulse">ACTIVE</span>
                                                    </Show>
                                                </td>
                                                <td class="py-3 px-4 font-bold text-white">{pct(p.rewardPoolRatio)}</td>
                                                <td class="py-3 px-4 text-xs text-gray-400">
                                                    {pct(p.allocPoolRatio)} / {pct(p.usePoolRatio)} / {pct(p.qualityPoolRatio)}
                                                </td>
                                                <td class="py-3 px-4 text-xs text-gray-500">{fmtDate(p.effectiveFrom)}</td>
                                                <td class="py-3 px-4">
                                                    <div class="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openEdit(p)}
                                                            class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                                                            title="Edit"
                                                        >
                                                            <Edit3 class="w-3.5 h-3.5" />
                                                        </button>
                                                        <Show when={!p.isActive}>
                                                            <button
                                                                onClick={() => handleActivate(p.policyId)}
                                                                class="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                                                                title="Activate"
                                                            >
                                                                <Power class="w-3.5 h-3.5" />
                                                            </button>
                                                        </Show>
                                                        <Show when={p.isActive}>
                                                            <button
                                                                onClick={() => handleDeactivate(p.policyId)}
                                                                class="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all"
                                                                title="Deactivate"
                                                            >
                                                                <PowerOff class="w-3.5 h-3.5" />
                                                            </button>
                                                        </Show>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </Show>
                    </div>
                </div>
            </Show>

            {/* ── CREATE / EDIT FORM ── */}
            <Show when={view() === 'create' || view() === 'edit'}>
                <div class="animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Back Button */}
                    <button
                        onClick={() => { setView('list'); setErrors([]); }}
                        class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                            <ChevronLeft class="w-4 h-4" />
                        </div>
                        <span class="font-bold text-sm">Back to Policies</span>
                    </button>

                    <div class="mb-6">
                        <h2 class="text-2xl font-bold text-white">{view() === 'create' ? 'Create New Policy' : `Edit Policy v${form().version}`}</h2>
                        <p class="text-gray-500 text-sm mt-1">{view() === 'create' ? 'Define reward parameters for node operators' : `Editing ${editingId()}`}</p>
                    </div>

                    {/* Error Banner */}
                    <Show when={errors().length > 0}>
                        <div class="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                            <div class="flex items-start gap-3">
                                <AlertTriangle class="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                                <div>
                                    <div class="font-bold text-red-400 text-sm mb-1">Validation Errors</div>
                                    <For each={errors()}>
                                        {(err) => <div class="text-xs text-red-300/80">&bull; {err}</div>}
                                    </For>
                                </div>
                            </div>
                        </div>
                    </Show>

                    <div class="space-y-6">
                        {/* Section: Pool Distribution */}
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6">
                            <div class="flex items-center gap-3 mb-5">
                                <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white">Pool Distribution</h3>
                                    <p class="text-[10px] text-gray-500 uppercase font-black tracking-widest">Revenue allocation parameters</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <FormField label="Reward Pool (%)" value={(form().rewardPoolRatio * 100).toFixed(1)}
                                    onChange={(v) => updateField('rewardPoolRatio', parseFloat(v) / 100 || 0)}
                                    hint="Max 30%" error={form().rewardPoolRatio > 0.30} />
                                <FormField label="Allocation Pool (%)" value={(form().allocPoolRatio * 100).toFixed(1)}
                                    onChange={(v) => updateField('allocPoolRatio', parseFloat(v) / 100 || 0)} />
                                <FormField label="Usage Pool (%)" value={(form().usePoolRatio * 100).toFixed(1)}
                                    onChange={(v) => updateField('usePoolRatio', parseFloat(v) / 100 || 0)} />
                                <FormField label="Quality Pool (%)" value={(form().qualityPoolRatio * 100).toFixed(1)}
                                    onChange={(v) => updateField('qualityPoolRatio', parseFloat(v) / 100 || 0)} />
                            </div>

                            {/* Pool Sum Indicator */}
                            <div class={`mt-3 text-xs font-bold flex items-center gap-2 ${poolSum() === 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                <Show when={poolSum() === 1.0} fallback={<X class="w-3.5 h-3.5" />}>
                                    <Check class="w-3.5 h-3.5" />
                                </Show>
                                Alloc + Usage + Quality = {(poolSum() * 100).toFixed(1)}%
                                {poolSum() !== 1.0 && ' (must be 100%)'}
                            </div>
                        </div>

                        {/* Section: Quality Weights */}
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6">
                            <div class="flex items-center gap-3 mb-5">
                                <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white">Quality Weights</h3>
                                    <p class="text-[10px] text-gray-500 uppercase font-black tracking-widest">How quality score is calculated</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-3 gap-4">
                                <FormField label="Uptime Weight (%)" value={(form().qualityWeightUptime * 100).toFixed(1)}
                                    onChange={(v) => updateField('qualityWeightUptime', parseFloat(v) / 100 || 0)} />
                                <FormField label="Audit Weight (%)" value={(form().qualityWeightAudit * 100).toFixed(1)}
                                    onChange={(v) => updateField('qualityWeightAudit', parseFloat(v) / 100 || 0)} />
                                <FormField label="Latency Weight (%)" value={(form().qualityWeightLatency * 100).toFixed(1)}
                                    onChange={(v) => updateField('qualityWeightLatency', parseFloat(v) / 100 || 0)} />
                            </div>

                            <div class={`mt-3 text-xs font-bold flex items-center gap-2 ${qualitySum() === 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                <Show when={qualitySum() === 1.0} fallback={<X class="w-3.5 h-3.5" />}>
                                    <Check class="w-3.5 h-3.5" />
                                </Show>
                                Uptime + Audit + Latency = {(qualitySum() * 100).toFixed(1)}%
                                {qualitySum() !== 1.0 && ' (must be 100%)'}
                            </div>
                        </div>

                        {/* Section: Thresholds */}
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6">
                            <div class="flex items-center gap-3 mb-5">
                                <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white">Quality Thresholds</h3>
                                    <p class="text-[10px] text-gray-500 uppercase font-black tracking-widest">Minimum requirements for reward eligibility</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <FormField label="Uptime Cutoff (%)" value={(form().uptimeCutoff * 100).toFixed(1)}
                                    onChange={(v) => updateField('uptimeCutoff', parseFloat(v) / 100 || 0)} />
                                <FormField label="Audit Cutoff (%)" value={(form().auditCutoff * 100).toFixed(1)}
                                    onChange={(v) => updateField('auditCutoff', parseFloat(v) / 100 || 0)} />
                                <FormField label="Alloc Cap Lambda" value={form().allocationCapLambda.toString()}
                                    onChange={(v) => updateField('allocationCapLambda', parseFloat(v) || 0)} hint="e.g. 1.5 = max AC credited is 1.5x UC" />
                                <FormField label="Pure Alloc Ratio (%)" value={(form().allocPureRatio * 100).toFixed(0)}
                                    onChange={(v) => updateField('allocPureRatio', parseFloat(v) / 100 || 0)} hint="% of Alloc Pool for pure capacity reward" />
                                <FormField label="Min Latency (ms)" value={form().latencyMinMs.toString()}
                                    onChange={(v) => updateField('latencyMinMs', parseInt(v) || 0)} />
                                <FormField label="Max Latency (ms)" value={form().latencyMaxMs.toString()}
                                    onChange={(v) => updateField('latencyMaxMs', parseInt(v) || 0)} />
                                <FormField label="Min Payout (USDT)" value={form().minPayoutUsd.toString()}
                                    onChange={(v) => updateField('minPayoutUsd', parseFloat(v) || 0)} />
                            </div>
                        </div>

                        {/* Section: Effective Period */}
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-6">
                            <div class="flex items-center gap-3 mb-5">
                                <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                </div>
                                <div>
                                    <h3 class="font-bold text-white">Effective Period</h3>
                                    <p class="text-[10px] text-gray-500 uppercase font-black tracking-widest">When this policy applies</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">From</label>
                                    <input
                                        type="datetime-local"
                                        value={form().effectiveFrom}
                                        onInput={(e) => updateField('effectiveFrom', e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">To (optional)</label>
                                    <input
                                        type="datetime-local"
                                        value={form().effectiveTo}
                                        onInput={(e) => updateField('effectiveTo', e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <button
                            onClick={handleSave}
                            disabled={saving() || poolSum() !== 1.0 || qualitySum() !== 1.0}
                            class={`w-full py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${saveStatus() === 'success'
                                ? 'bg-green-600 shadow-green-600/20'
                                : saveStatus() === 'error'
                                    ? 'bg-red-600 shadow-red-600/20'
                                    : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20'
                                } text-white disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            <Show when={saving()}>
                                <RefreshCw class="w-4 h-4 animate-spin" />
                            </Show>
                            {saveStatus() === 'success'
                                ? 'Saved Successfully!'
                                : saveStatus() === 'error'
                                    ? 'Validation Failed'
                                    : saving()
                                        ? 'Saving...'
                                        : view() === 'edit' ? 'Update Policy' : 'Create Policy'}
                        </button>
                    </div>
                </div>
            </Show>
        </div>
    );
}

// ─── Reusable Form Field ─────────────────────────────────────────────
function FormField(props: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: boolean }) {
    return (
        <div>
            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1.5">{props.label}</label>
            <input
                type="text"
                inputmode="decimal"
                value={props.value}
                onInput={(e) => props.onChange(e.currentTarget.value)}
                class={`w-full bg-black/40 border rounded-lg px-3 py-2.5 text-sm font-bold text-white focus:outline-none transition-colors ${props.error ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-emerald-500/50'
                    }`}
            />
            <Show when={props.hint}>
                <div class="text-[9px] text-gray-600 mt-1">{props.hint}</div>
            </Show>
        </div>
    );
}
