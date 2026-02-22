import { Component, createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { getAdminFirebaseAuth } from '../../services/firebaseService';

interface NodeStatus {
    name: string;
    role: string;
    port: number;
    online: boolean;
    block: number;
    peers: number;
    mining: boolean;
}

interface HealthSummary {
    total: number;
    online: number;
    forked: boolean;
    maxBlock: number;
    minBlock: number;
    blockDiff: number;
}

interface HealthCheck {
    id: string;
    timestamp: any;
    summary: HealthSummary;
    nodes: NodeStatus[];
}

const AdminNodeHealth: Component = () => {
    const [nodes, setNodes] = createSignal<NodeStatus[]>([]);
    const [summary, setSummary] = createSignal<HealthSummary | null>(null);
    const [history, setHistory] = createSignal<HealthCheck[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [syncing, setSyncing] = createSignal(false);
    const [lastUpdated, setLastUpdated] = createSignal('');
    const [error, setError] = createSignal('');

    const API_URL = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/nodeHealth';

    const fetchStatus = async () => {
        setLoading(true);
        setError('');
        try {
            const auth = getAdminFirebaseAuth();
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
            const resp = await fetch(API_URL, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            setNodes(data.nodes || []);
            setSummary(data.summary || null);
            setHistory(data.history || []);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (e: any) {
            setError(e.message || 'Failed to fetch node status');
        } finally {
            setLoading(false);
        }
    };

    const forceSync = async () => {
        setSyncing(true);
        setError('');
        try {
            const auth = getAdminFirebaseAuth();
            const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
            const resp = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'force_sync' }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            setNodes(data.nodes || []);
            setSummary(data.summary || null);
            setLastUpdated(new Date().toLocaleTimeString());
        } catch (e: any) {
            setError(e.message || 'Force sync failed');
        } finally {
            setSyncing(false);
        }
    };

    onMount(() => {
        fetchStatus();
    });

    const getStatusColor = (node: NodeStatus) => {
        if (!node.online) return 'red';
        if (node.peers < 2) return 'yellow';
        return 'green';
    };

    const getBlockBehind = (node: NodeStatus) => {
        const s = summary();
        if (!s || !node.online) return 0;
        return s.maxBlock - node.block;
    };

    const formatTimestamp = (ts: any) => {
        if (!ts) return '-';
        if (ts._seconds) {
            return new Date(ts._seconds * 1000).toLocaleString();
        }
        return new Date(ts).toLocaleString();
    };

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex items-center justify-between">
                <div>
                    <h1 class="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                        Node Health Monitor
                    </h1>
                    <p class="text-gray-400 mt-2">Vision Chain node synchronization status & management</p>
                </div>
                <div class="flex items-center gap-3">
                    <Show when={lastUpdated()}>
                        <span class="text-xs text-gray-500">Updated: {lastUpdated()}</span>
                    </Show>
                    <button
                        onClick={fetchStatus}
                        disabled={loading()}
                        class="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                        <svg class={`w-4 h-4 ${loading() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                        </svg>
                        Refresh
                    </button>
                    <button
                        onClick={forceSync}
                        disabled={syncing()}
                        class="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 transition-all text-sm font-bold flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
                    >
                        <svg class={`w-4 h-4 ${syncing() ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4v5h5" />
                            <path d="M20 20v-5h-5" />
                            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                        </svg>
                        {syncing() ? 'Syncing...' : 'Force Sync'}
                    </button>
                </div>
            </header>

            {/* Error */}
            <Show when={error()}>
                <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error()}
                </div>
            </Show>

            {/* Summary Cards */}
            <Show when={summary()}>
                {(s) => (
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div class="p-5 rounded-xl bg-white/5 border border-white/10">
                            <div class="text-xs text-gray-500 uppercase tracking-wider font-bold">Total Nodes</div>
                            <div class="text-3xl font-bold mt-2">{s().total}</div>
                        </div>
                        <div class={`p-5 rounded-xl border ${s().online === s().total ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                            <div class={`text-xs uppercase tracking-wider font-bold ${s().online === s().total ? 'text-green-400' : 'text-yellow-400'}`}>Online</div>
                            <div class="text-3xl font-bold mt-2">{s().online} / {s().total}</div>
                        </div>
                        <div class={`p-5 rounded-xl border ${s().forked ? 'bg-red-500/10 border-red-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
                            <div class={`text-xs uppercase tracking-wider font-bold ${s().forked ? 'text-red-400' : 'text-green-400'}`}>Sync Status</div>
                            <div class={`text-xl font-bold mt-2 ${s().forked ? 'text-red-400' : 'text-green-400'}`}>{s().forked ? 'FORKED' : 'SYNCED'}</div>
                        </div>
                        <div class="p-5 rounded-xl bg-white/5 border border-white/10">
                            <div class="text-xs text-gray-500 uppercase tracking-wider font-bold">Latest Block</div>
                            <div class="text-2xl font-bold mt-2 font-mono">{s().maxBlock.toLocaleString()}</div>
                        </div>
                        <div class={`p-5 rounded-xl border ${s().blockDiff > 10 ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10'}`}>
                            <div class={`text-xs uppercase tracking-wider font-bold ${s().blockDiff > 10 ? 'text-red-400' : 'text-gray-500'}`}>Block Diff</div>
                            <div class={`text-2xl font-bold mt-2 font-mono ${s().blockDiff > 10 ? 'text-red-400' : ''}`}>{s().blockDiff}</div>
                        </div>
                    </div>
                )}
            </Show>

            {/* Fork Alert */}
            <Show when={summary()?.forked}>
                <div class="p-5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-4">
                    <svg class="w-6 h-6 text-red-400 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <div>
                        <div class="font-bold text-red-400 text-lg">Chain Fork Detected</div>
                        <p class="text-red-300/70 text-sm mt-1">
                            Nodes are on different chains with a block difference of {summary()?.blockDiff || 0}.
                            Click "Force Sync" to reconnect all nodes via admin_addPeer.
                        </p>
                    </div>
                </div>
            </Show>

            {/* Node Status Table */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="2" y="2" width="20" height="8" rx="2" />
                            <rect x="2" y="14" width="20" height="8" rx="2" />
                            <line x1="6" y1="6" x2="6.01" y2="6" />
                            <line x1="6" y1="18" x2="6.01" y2="18" />
                        </svg>
                        Node Status
                    </h2>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase tracking-wider">
                        <tr>
                            <th class="p-4">Status</th>
                            <th class="p-4">Node</th>
                            <th class="p-4">Role</th>
                            <th class="p-4">Block Height</th>
                            <th class="p-4">Behind</th>
                            <th class="p-4">Peers</th>
                            <th class="p-4">Mining</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={nodes()}>
                            {(node) => {
                                const color = getStatusColor(node);
                                const behind = getBlockBehind(node);
                                return (
                                    <tr class="hover:bg-white/[0.02]">
                                        <td class="p-4">
                                            <div class="flex items-center gap-2">
                                                <div class={`w-2.5 h-2.5 rounded-full ${color === 'green' ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : color === 'yellow' ? 'bg-yellow-500 shadow-[0_0_6px_rgba(234,179,8,0.5)]' : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]'}`} />
                                                <span class={`text-xs font-bold uppercase ${color === 'green' ? 'text-green-400' : color === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {node.online ? (node.peers < 2 ? 'LOW PEERS' : 'ONLINE') : 'OFFLINE'}
                                                </span>
                                            </div>
                                        </td>
                                        <td class="p-4">
                                            <div class="font-bold">{node.name}</div>
                                            <div class="text-xs text-gray-500">:{node.port}</div>
                                        </td>
                                        <td class="p-4 text-gray-400">{node.role}</td>
                                        <td class="p-4 font-mono font-bold">{node.online ? node.block.toLocaleString() : '-'}</td>
                                        <td class="p-4">
                                            <span class={`font-mono ${behind > 10 ? 'text-red-400 font-bold' : behind > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                {node.online ? (behind === 0 ? 'OK' : `-${behind}`) : '-'}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class={`px-2 py-0.5 rounded-md text-xs font-bold ${node.peers >= 3 ? 'bg-green-500/20 text-green-400' : node.peers >= 1 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {node.online ? node.peers : 0}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class={`text-xs font-bold ${node.mining ? 'text-cyan-400' : 'text-gray-600'}`}>
                                                {node.mining ? 'ACTIVE' : '-'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            }}
                        </For>
                    </tbody>
                </table>
            </div>

            {/* Health Check History */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5">
                    <h2 class="text-lg font-bold flex items-center gap-2">
                        <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        Hourly Health Check History
                    </h2>
                    <p class="text-xs text-gray-500 mt-1">Automated checks run every hour with auto-reconnect on failure</p>
                </div>
                <Show when={history().length > 0} fallback={
                    <div class="p-8 text-center text-gray-500 text-sm">
                        No health check history yet. The first check will run within the next hour.
                    </div>
                }>
                    <table class="w-full text-sm">
                        <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th class="p-4">Time</th>
                                <th class="p-4">Online</th>
                                <th class="p-4">Status</th>
                                <th class="p-4">Block Diff</th>
                                <th class="p-4">Max Block</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <For each={history()}>
                                {(check) => (
                                    <tr class="hover:bg-white/[0.02]">
                                        <td class="p-4 text-gray-400 text-xs">{formatTimestamp(check.timestamp)}</td>
                                        <td class="p-4">
                                            <span class={check.summary?.online === check.summary?.total ? 'text-green-400' : 'text-yellow-400'}>
                                                {check.summary?.online || 0} / {check.summary?.total || 5}
                                            </span>
                                        </td>
                                        <td class="p-4">
                                            <span class={`px-2 py-0.5 rounded-md text-xs font-bold ${check.summary?.forked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {check.summary?.forked ? 'FORKED' : 'SYNCED'}
                                            </span>
                                        </td>
                                        <td class={`p-4 font-mono ${(check.summary?.blockDiff || 0) > 10 ? 'text-red-400' : ''}`}>
                                            {check.summary?.blockDiff || 0}
                                        </td>
                                        <td class="p-4 font-mono text-gray-400">{(check.summary?.maxBlock || 0).toLocaleString()}</td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </Show>
            </div>
        </div>
    );
};

export default AdminNodeHealth;
