import { Component, createSignal, onMount, For } from 'solid-js';
import { Database, Search, Clock, CheckCircle, XCircle } from 'lucide-solid';

interface IndexedEvent {
    eventType: 'FeeQuoted' | 'FeeDeducted' | 'SponsoredExecutionSubmitted' | 'FeeSettled' | 'PaymasterRebalanced' | 'ModeChanged';
    quoteId?: string;
    chainId: number;
    blockNumber: number;
    txHash: string;
    indexed: boolean;
    latencyMs: number;
    timestamp: string;
}

const AdminExplorerMonitor: Component = () => {
    const [events, setEvents] = createSignal<IndexedEvent[]>([]);
    const [stats, setStats] = createSignal({ total: 0, indexed: 0, pending: 0, avgLatency: 0 });

    onMount(async () => {
        setEvents([
            { eventType: 'FeeQuoted', quoteId: 'q_abc123', chainId: 1, blockNumber: 19234567, txHash: '0xabc...def', indexed: true, latencyMs: 245, timestamp: '2026-01-15 19:45:30' },
            { eventType: 'FeeDeducted', quoteId: 'q_abc123', chainId: 1, blockNumber: 19234567, txHash: '0xabc...def', indexed: true, latencyMs: 312, timestamp: '2026-01-15 19:45:32' },
            { eventType: 'SponsoredExecutionSubmitted', quoteId: 'q_abc123', chainId: 137, blockNumber: 52345678, txHash: '0x123...456', indexed: true, latencyMs: 520, timestamp: '2026-01-15 19:45:35' },
            { eventType: 'FeeSettled', quoteId: 'q_abc123', chainId: 137, blockNumber: 52345680, txHash: '0x789...abc', indexed: false, latencyMs: 0, timestamp: '2026-01-15 19:46:00' },
            { eventType: 'PaymasterRebalanced', chainId: 3151909, blockNumber: 1234567, txHash: '0xdef...123', indexed: true, latencyMs: 180, timestamp: '2026-01-15 19:40:00' },
        ]);
        setStats({ total: 1250, indexed: 1247, pending: 3, avgLatency: 315 });
    });

    const getEventColor = (type: string) => ({
        'FeeQuoted': 'text-blue-400',
        'FeeDeducted': 'text-yellow-400',
        'SponsoredExecutionSubmitted': 'text-purple-400',
        'FeeSettled': 'text-green-400',
        'PaymasterRebalanced': 'text-orange-400',
        'ModeChanged': 'text-red-400'
    }[type] || 'text-gray-400');

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent">
                        Explorer Indexing Monitor
                    </h1>
                    <p class="text-gray-400 mt-2">Track event indexing for VisionScan Paymaster Tab</p>
                </div>
                <div class="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl">
                    <Search class="w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by quoteId or txHash..." class="bg-transparent text-sm w-64 outline-none" />
                </div>
            </header>

            {/* Stats */}
            <div class="grid grid-cols-4 gap-6">
                <div class="p-6 rounded-xl bg-white/5 border border-white/10">
                    <div class="text-sm text-gray-400">Total Events (24h)</div>
                    <div class="text-2xl font-bold mt-1">{stats().total.toLocaleString()}</div>
                </div>
                <div class="p-6 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div class="text-sm text-green-400">Indexed</div>
                    <div class="text-2xl font-bold mt-1">{stats().indexed.toLocaleString()}</div>
                </div>
                <div class="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div class="text-sm text-yellow-400">Pending</div>
                    <div class="text-2xl font-bold mt-1">{stats().pending}</div>
                </div>
                <div class="p-6 rounded-xl bg-white/5 border border-white/10">
                    <div class="text-sm text-gray-400 flex items-center gap-1"><Clock class="w-3 h-3" /> Avg Latency</div>
                    <div class="text-2xl font-bold mt-1">{stats().avgLatency}ms</div>
                </div>
            </div>

            {/* Event Stream */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5">
                    <h2 class="text-lg font-bold">Recent Events</h2>
                </div>
                <div class="divide-y divide-white/5">
                    <For each={events()}>
                        {(e) => (
                            <div class="p-4 flex items-center gap-6 hover:bg-white/[0.02] transition">
                                <div class={`font-mono text-xs font-bold ${getEventColor(e.eventType)}`}>{e.eventType}</div>
                                <div class="text-xs text-gray-500">Chain {e.chainId}</div>
                                <div class="text-xs text-gray-500">Block #{e.blockNumber}</div>
                                <div class="text-xs font-mono text-gray-400 flex-1">{e.txHash}</div>
                                <div class="flex items-center gap-2">
                                    {e.indexed ? (
                                        <span class="flex items-center gap-1 text-xs text-green-400"><CheckCircle class="w-3 h-3" /> {e.latencyMs}ms</span>
                                    ) : (
                                        <span class="flex items-center gap-1 text-xs text-yellow-400"><Clock class="w-3 h-3" /> Pending</span>
                                    )}
                                </div>
                                <div class="text-xs text-gray-500">{e.timestamp}</div>
                            </div>
                        )}
                    </For>
                </div>
            </div>
        </div>
    );
};

export default AdminExplorerMonitor;
