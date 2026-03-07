import { Component, createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { getAnalytics, runHealthCheck } from '../../services/aiStorage/aiStorageService';

interface StorageData {
    files: { total: number; indexed: number; pending: number; error: number };
    chunks: { total: number; withOpenaiEmbedding: number; withGeminiEmbedding: number };
    memories: { total: number; episodic: number; semantic: number; procedural: number; consolidated: number };
    caches: { total: number; active: number; expired: number };
    workspaces: { total: number; totalMembers: number };
    shares: { total: number; active: number };
}

interface HealthData {
    overall: 'healthy' | 'degraded' | 'down';
    components: Record<string, { status: string; latencyMs?: number; message?: string }>;
    latencyMs: Record<string, number>;
}

interface CostData {
    period: string;
    byModel: {
        openai: { tokens: number; estimatedCost: number };
        gemini: { tokens: number; estimatedCost: number };
        deepseek: { tokens: number; estimatedCost: number };
    };
    totalEstimatedCost: number;
}

const AIStorageAdmin: Component = () => {
    const [storage, setStorage] = createSignal<StorageData | null>(null);
    const [health, setHealth] = createSignal<HealthData | null>(null);
    const [cost, setCost] = createSignal<CostData | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [healthLoading, setHealthLoading] = createSignal(false);
    const [error, setError] = createSignal('');

    onMount(async () => {
        await loadDashboard();
    });

    const loadDashboard = async () => {
        setLoading(true);
        setError('');
        try {
            const [storageResult, costResult] = await Promise.all([
                getAnalytics('getStorage'),
                getAnalytics('getCost'),
            ]);
            if (storageResult?.analytics) setStorage(storageResult.analytics);
            if (costResult?.cost) setCost(costResult.cost);
        } catch (err: any) {
            setError(err.message || 'Failed to load dashboard');
        }
        setLoading(false);
    };

    const handleHealthCheck = async () => {
        setHealthLoading(true);
        try {
            const result = await runHealthCheck();
            if (result?.health) setHealth(result.health);
        } catch (err: any) {
            setError('Health check failed: ' + err.message);
        }
        setHealthLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-emerald-400';
            case 'degraded': return 'text-amber-400';
            case 'down': return 'text-red-400';
            case 'unconfigured': return 'text-gray-500';
            default: return 'text-gray-400';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-emerald-500/10 border-emerald-500/20';
            case 'degraded': return 'bg-amber-500/10 border-amber-500/20';
            case 'down': return 'bg-red-500/10 border-red-500/20';
            default: return 'bg-gray-500/10 border-gray-500/20';
        }
    };

    const getStatusDot = (status: string) => {
        switch (status) {
            case 'healthy': return 'bg-emerald-500';
            case 'degraded': return 'bg-amber-500';
            case 'down': return 'bg-red-500';
            default: return 'bg-gray-600';
        }
    };

    const StatCard = (props: { label: string; value: number | string; sub?: string; accent?: string }) => (
        <div class="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:border-cyan-500/20 transition-all">
            <div class="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{props.label}</div>
            <div class={`text-2xl font-black ${props.accent || 'text-white'}`}>
                {typeof props.value === 'number' ? props.value.toLocaleString() : props.value}
            </div>
            <Show when={props.sub}>
                <div class="text-[11px] text-gray-500 mt-1">{props.sub}</div>
            </Show>
        </div>
    );

    return (
        <div class="min-h-screen">
            {/* Header */}
            <div class="mb-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h1 class="text-2xl font-black text-white tracking-tight">AI Storage Infrastructure</h1>
                        <p class="text-sm text-gray-500 mt-1">Distributed Storage Node - AI Data Layer Management</p>
                    </div>
                    <div class="flex gap-3">
                        <button
                            onClick={handleHealthCheck}
                            disabled={healthLoading()}
                            class="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-sm font-bold disabled:opacity-50"
                        >
                            {healthLoading() ? 'Checking...' : 'Health Check'}
                        </button>
                        <button
                            onClick={loadDashboard}
                            disabled={loading()}
                            class="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all text-sm font-bold disabled:opacity-50"
                        >
                            {loading() ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                </div>
            </div>

            <Show when={error()}>
                <div class="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error()}
                </div>
            </Show>

            <Show when={loading()} fallback={
                <div class="space-y-8">
                    {/* Storage Analytics */}
                    <Show when={storage()}>
                        <section>
                            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
                                Storage Overview
                            </h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                <StatCard label="Total Files" value={storage()!.files.total} sub={`${storage()!.files.indexed} indexed`} accent="text-cyan-400" />
                                <StatCard label="Chunks" value={storage()!.chunks.total} sub="Semantic segments" />
                                <StatCard label="OpenAI Vectors" value={storage()!.chunks.withOpenaiEmbedding} sub="1536d embeddings" accent="text-green-400" />
                                <StatCard label="Gemini Vectors" value={storage()!.chunks.withGeminiEmbedding} sub="768d embeddings" accent="text-blue-400" />
                                <StatCard label="Memories" value={storage()!.memories.total} sub={`${storage()!.memories.consolidated} consolidated`} accent="text-purple-400" />
                                <StatCard label="Workspaces" value={storage()!.workspaces.total} sub={`${storage()!.workspaces.totalMembers} members`} />
                            </div>
                        </section>

                        {/* Memory Breakdown */}
                        <section>
                            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                                Memory Types
                            </h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard label="Episodic" value={storage()!.memories.episodic} sub="Conversations & events" accent="text-amber-400" />
                                <StatCard label="Semantic" value={storage()!.memories.semantic} sub="Facts & knowledge" accent="text-blue-400" />
                                <StatCard label="Procedural" value={storage()!.memories.procedural} sub="Preferences & habits" accent="text-green-400" />
                                <StatCard label="Consolidated" value={storage()!.memories.consolidated} sub="Merged memories" accent="text-gray-400" />
                            </div>
                        </section>

                        {/* Cache & Shares */}
                        <section>
                            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Cache & Sharing
                            </h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard label="Context Caches" value={storage()!.caches.total} sub={`${storage()!.caches.active} active`} accent="text-amber-400" />
                                <StatCard label="Expired Caches" value={storage()!.caches.expired} />
                                <StatCard label="Share Links" value={storage()!.shares.total} sub={`${storage()!.shares.active} active`} accent="text-indigo-400" />
                                <StatCard label="Pending Index" value={storage()!.files.pending} sub={`${storage()!.files.error} errors`} accent={storage()!.files.error > 0 ? 'text-red-400' : 'text-gray-400'} />
                            </div>
                        </section>
                    </Show>

                    {/* Cost Estimation */}
                    <Show when={cost()}>
                        <section>
                            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Cost Estimation — {cost()!.period}
                            </h2>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard
                                    label="OpenAI"
                                    value={`$${cost()!.byModel.openai.estimatedCost.toFixed(2)}`}
                                    sub={`${(cost()!.byModel.openai.tokens / 1000).toFixed(1)}K tokens`}
                                    accent="text-green-400"
                                />
                                <StatCard
                                    label="Gemini"
                                    value={`$${cost()!.byModel.gemini.estimatedCost.toFixed(2)}`}
                                    sub={`${(cost()!.byModel.gemini.tokens / 1000).toFixed(1)}K tokens`}
                                    accent="text-blue-400"
                                />
                                <StatCard
                                    label="DeepSeek"
                                    value={`$${cost()!.byModel.deepseek.estimatedCost.toFixed(2)}`}
                                    sub={`${(cost()!.byModel.deepseek.tokens / 1000).toFixed(1)}K tokens`}
                                    accent="text-amber-400"
                                />
                                <StatCard
                                    label="Total"
                                    value={`$${cost()!.totalEstimatedCost.toFixed(2)}`}
                                    sub="This month"
                                    accent="text-cyan-400"
                                />
                            </div>
                        </section>
                    </Show>

                    {/* System Health */}
                    <Show when={health()}>
                        <section>
                            <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                System Health
                                <span class={`ml-2 text-xs font-black uppercase px-2 py-0.5 rounded-md border ${getStatusBg(health()!.overall)} ${getStatusColor(health()!.overall)}`}>
                                    {health()!.overall}
                                </span>
                            </h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <For each={Object.entries(health()!.components)}>
                                    {([name, comp]) => (
                                        <div class={`p-4 rounded-xl border ${getStatusBg(comp.status)}`}>
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-sm font-bold text-white capitalize">{name.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                <div class="flex items-center gap-2">
                                                    <div class={`w-2 h-2 rounded-full ${getStatusDot(comp.status)} ${comp.status === 'healthy' ? 'animate-pulse' : ''}`} />
                                                    <span class={`text-xs font-bold uppercase ${getStatusColor(comp.status)}`}>{comp.status}</span>
                                                </div>
                                            </div>
                                            <Show when={comp.latencyMs && comp.latencyMs > 0}>
                                                <div class="text-xs text-gray-500">Latency: {comp.latencyMs}ms</div>
                                            </Show>
                                            <Show when={comp.message}>
                                                <div class="text-xs text-gray-500 mt-1">{comp.message}</div>
                                            </Show>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </section>
                    </Show>

                    {/* Phase Overview */}
                    <section>
                        <h2 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Infrastructure Phases
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { phase: 1, name: 'Foundation Data Layer', fns: 'aiRequestIndexing, aiGetIndexStatus', status: 'deployed' },
                                { phase: 2, name: 'Ingestion & Processing', fns: 'aiProcessIngestion', status: 'deployed' },
                                { phase: 3, name: 'Dual Index & Retrieval', fns: 'aiGenerateEmbeddings, aiRetrieve', status: 'deployed' },
                                { phase: 4, name: 'Cache & Memory', fns: 'aiCreateContextCache, aiMemoryStore, aiMemoryConsolidate', status: 'deployed' },
                                { phase: 5, name: 'Access Control', fns: 'aiWorkspaceManage, aiDataShare, aiAuditLog', status: 'deployed' },
                                { phase: 6, name: 'Monitoring & Analytics', fns: 'aiAnalytics, aiHealthCheck', status: 'deployed' },
                            ].map(p => (
                                <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-cyan-500/20 transition-all">
                                    <div class="flex items-center justify-between mb-2">
                                        <span class="text-xs font-black text-cyan-500/60 uppercase">Phase {p.phase}</span>
                                        <span class="text-[10px] font-bold text-emerald-400 uppercase px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                            {p.status}
                                        </span>
                                    </div>
                                    <div class="text-sm font-bold text-white mb-1">{p.name}</div>
                                    <div class="text-[11px] text-gray-500 font-mono">{p.fns}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            }>
                <div class="flex items-center justify-center py-20">
                    <div class="w-10 h-10 border-3 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                </div>
            </Show>
        </div>
    );
};

export default AIStorageAdmin;
