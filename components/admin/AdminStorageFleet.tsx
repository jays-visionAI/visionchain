import { Component, createSignal, onMount, For, Show } from 'solid-js';

/**
 * AdminStorageFleet — Phase 6 observability for the storage-node fleet.
 * Renders the aggregated system_stats/fleet_health doc served by the
 * public node_fleet.health gateway action: fleet composition, 24h proof
 * outcomes, enforcement readiness, replication + on-chain reward health.
 */

const GATEWAY = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

interface FleetHealth {
    computed_at: number;
    fleet: {
        active_nodes: number;
        heartbeat_24h: number;
        by_device: Record<string, number>;
        by_version: Record<string, number>;
        allocated_gb_total: number;
    };
    proofs_24h: {
        pending: number; verified: number; failed: number; expired: number;
        abandoned: number; judged: number; pass_rate: number | null;
    };
    enforcement: {
        mode: string;
        updated_client_pct: number;
        ready_to_enforce: boolean;
        criteria: string;
    };
    replication: {
        scanned?: number; under_replicated?: number; zero_replica?: number;
        counts_healed?: number; last_run_at?: number;
    } | null;
    onchain_rewards: {
        pool_balance_vcn: number | null;
        last_run: {
            nodes_accrued?: number; wallets_mapped?: number;
            active_nodes_total?: number; authorized?: boolean;
        } | null;
    };
    storage: { staging_chunks: number; registry_chunks: number };
}

const StatCard: Component<{ label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad' }> = (props) => (
    <div class={`rounded-xl p-4 border ${props.tone === 'good' ? 'bg-emerald-500/5 border-emerald-500/20'
        : props.tone === 'warn' ? 'bg-amber-500/5 border-amber-500/20'
            : props.tone === 'bad' ? 'bg-red-500/5 border-red-500/20'
                : 'bg-white/[0.03] border-white/[0.08]'}`}>
        <div class="text-[10px] font-black text-gray-400 uppercase tracking-widest">{props.label}</div>
        <div class={`text-xl font-bold mt-1 ${props.tone === 'good' ? 'text-emerald-300'
            : props.tone === 'warn' ? 'text-amber-300'
                : props.tone === 'bad' ? 'text-red-300' : 'text-white'}`}>{props.value}</div>
        <Show when={props.sub}><div class="text-[10px] text-gray-500 mt-0.5">{props.sub}</div></Show>
    </div>
);

const AdminStorageFleet: Component = () => {
    const [health, setHealth] = createSignal<FleetHealth | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [error, setError] = createSignal('');

    const fetchHealth = async () => {
        setLoading(true);
        setError('');
        try {
            const resp = await fetch(GATEWAY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'node_fleet.health' }),
            });
            const data = await resp.json();
            if (data.success) setHealth(data.health);
            else setError(data.error || 'Failed to load fleet health');
        } catch (e: any) {
            setError(e.message || 'Failed to load fleet health');
        }
        setLoading(false);
    };

    onMount(fetchHealth);

    const passRatePct = () => {
        const pr = health()?.proofs_24h.pass_rate;
        return pr === null || pr === undefined ? null : Math.round(pr * 100);
    };

    return (
        <div class="space-y-6 mt-6">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-lg font-bold text-white">Storage Fleet Health</h2>
                    <Show when={health()}>
                        <p class="text-[11px] text-gray-500 mt-0.5">
                            Updated {new Date(health()!.computed_at).toLocaleString()} · auto-refreshes every 6h
                        </p>
                    </Show>
                </div>
                <button
                    onClick={fetchHealth}
                    disabled={loading()}
                    class="px-4 py-2 text-xs font-bold text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 rounded-lg transition-all disabled:opacity-40"
                >
                    {loading() ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            <Show when={error()}>
                <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">{error()}</div>
            </Show>

            <Show when={health()}>
                {/* Enforcement readiness banner */}
                <div class={`rounded-2xl p-5 border ${health()!.enforcement.ready_to_enforce
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div class="flex items-center justify-between flex-wrap gap-3">
                        <div>
                            <div class="text-xs font-black uppercase tracking-widest text-gray-300">
                                Proof Enforcement — currently <span class="text-white">{health()!.enforcement.mode}</span>
                            </div>
                            <div class={`text-lg font-bold mt-1 ${health()!.enforcement.ready_to_enforce ? 'text-emerald-300' : 'text-amber-300'}`}>
                                {health()!.enforcement.ready_to_enforce
                                    ? 'Ready to enforce — flip system_config/storage_proofs to "enforce"'
                                    : 'Hold — fleet not ready to enforce yet'}
                            </div>
                            <div class="text-[11px] text-gray-400 mt-1">{health()!.enforcement.criteria}</div>
                        </div>
                        <div class="flex gap-3">
                            <StatCard label="Updated clients" value={`${health()!.enforcement.updated_client_pct}%`}
                                tone={health()!.enforcement.updated_client_pct >= 80 ? 'good' : 'warn'} />
                            <StatCard label="Proof pass 24h" value={passRatePct() === null ? 'no data' : `${passRatePct()}%`}
                                tone={passRatePct() === null ? undefined : passRatePct()! >= 90 ? 'good' : 'bad'} />
                        </div>
                    </div>
                </div>

                {/* Fleet */}
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Active nodes" value={`${health()!.fleet.active_nodes}${(health()!.fleet as any).truncated ? '+' : ''}`}
                        sub={(health()!.fleet as any).truncated ? 'TRUNCATED at 2000 — metrics partial' : `${health()!.fleet.heartbeat_24h} heartbeat in 24h`}
                        tone={(health()!.fleet as any).truncated ? 'warn' : undefined} />
                    <StatCard label="Allocated storage" value={`${health()!.fleet.allocated_gb_total} GB`} sub="self-reported" />
                    <StatCard label="Registry chunks" value={String(health()!.storage.registry_chunks)} sub={`${health()!.storage.staging_chunks} in staging`} />
                    <StatCard label="Reward pool" value={health()!.onchain_rewards.pool_balance_vcn === null ? '—' : `${health()!.onchain_rewards.pool_balance_vcn.toFixed(2)} VCN`}
                        tone={(health()!.onchain_rewards.pool_balance_vcn || 0) > 0 ? 'good' : 'warn'}
                        sub={(health()!.onchain_rewards.pool_balance_vcn || 0) > 0 ? undefined : 'fund via fundPool()'} />
                </div>

                {/* Proofs 24h */}
                <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                    <div class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Storage Proofs (24h)</div>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <StatCard label="Verified" value={String(health()!.proofs_24h.verified)} tone="good" />
                        <StatCard label="Failed" value={String(health()!.proofs_24h.failed)} tone={health()!.proofs_24h.failed > 0 ? 'bad' : undefined} />
                        <StatCard label="Abandoned" value={String(health()!.proofs_24h.abandoned ?? 0)} sub="unanswered · counts as evaded"
                            tone={(health()!.proofs_24h.abandoned ?? 0) > 0 ? 'bad' : undefined} />
                        <StatCard label="Expired" value={String(health()!.proofs_24h.expired)} />
                        <StatCard label="Pending" value={String(health()!.proofs_24h.pending)} sub="live (<5 min)" />
                    </div>
                </div>

                {/* Replication */}
                <Show when={health()!.replication}>
                    <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <div class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                            Replication Monitor
                            <Show when={health()!.replication!.last_run_at}>
                                <span class="normal-case font-medium text-gray-500 ml-2">last run {new Date(health()!.replication!.last_run_at!).toLocaleString()}</span>
                            </Show>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Scanned" value={String(health()!.replication!.scanned ?? '—')} />
                            <StatCard label="Under-replicated" value={String(health()!.replication!.under_replicated ?? '—')}
                                tone={(health()!.replication!.under_replicated || 0) > 0 ? 'warn' : 'good'} />
                            <StatCard label="Zero replica" value={String(health()!.replication!.zero_replica ?? '—')}
                                tone={(health()!.replication!.zero_replica || 0) > 0 ? 'bad' : 'good'} />
                            <StatCard label="Counts healed" value={String(health()!.replication!.counts_healed ?? '—')} />
                        </div>
                    </div>
                </Show>

                {/* Version + device distribution */}
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <div class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Client Versions</div>
                        <div class="space-y-2">
                            <For each={Object.entries(health()!.fleet.by_version).sort((a, b) => b[1] - a[1])}>
                                {([v, n]) => (
                                    <div class="flex items-center justify-between text-sm">
                                        <span class="font-mono text-gray-300">{v}</span>
                                        <span class="font-bold text-white">{n}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                    <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <div class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Devices</div>
                        <div class="space-y-2">
                            <For each={Object.entries(health()!.fleet.by_device).sort((a, b) => b[1] - a[1])}>
                                {([d, n]) => (
                                    <div class="flex items-center justify-between text-sm">
                                        <span class="text-gray-300 capitalize">{d}</span>
                                        <span class="font-bold text-white">{n}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </div>

                {/* On-chain accrual last run */}
                <Show when={health()!.onchain_rewards.last_run}>
                    <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <div class="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Last On-chain Accrual</div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard label="Nodes accrued" value={String(health()!.onchain_rewards.last_run!.nodes_accrued ?? 0)} />
                            <StatCard label="Wallets mapped" value={String(health()!.onchain_rewards.last_run!.wallets_mapped ?? 0)} />
                            <StatCard label="Fleet total" value={String(health()!.onchain_rewards.last_run!.active_nodes_total ?? '—')} />
                            <StatCard label="Executor" value={health()!.onchain_rewards.last_run!.authorized ? 'authorized' : 'NOT authorized'}
                                tone={health()!.onchain_rewards.last_run!.authorized ? 'good' : 'bad'} />
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

export default AdminStorageFleet;
