import { Component, createSignal, onMount, For } from 'solid-js';
import { DollarSign, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-solid';

interface SettlementRecord {
    quoteId: string;
    dappName: string;
    chainId: number;
    baseCost: string;
    actualCost: string;
    surcharge: string;
    refund: string;
    variance: string; // +/- percentage
    timestamp: string;
}

const AdminFeesSettlement: Component = () => {
    const [records, setRecords] = createSignal<SettlementRecord[]>([]);
    const [revenueByChain, setRevenueByChain] = createSignal<Record<string, string>>({});

    onMount(async () => {
        // Mock data
        setRecords([
            { quoteId: 'q_abc123', dappName: 'Vision Swap', chainId: 1, baseCost: '0.0045 ETH', actualCost: '0.0042 ETH', surcharge: '0.00126 ETH', refund: '0.0003 ETH', variance: '-6.7%', timestamp: '2026-01-15 19:30' },
            { quoteId: 'q_def456', dappName: 'NFT Market', chainId: 137, baseCost: '0.12 MATIC', actualCost: '0.15 MATIC', surcharge: '0.045 MATIC', refund: '0', variance: '+25%', timestamp: '2026-01-15 19:28' },
        ]);
        setRevenueByChain({
            'Ethereum': '45.2 ETH ($125,400)',
            'Polygon': '12,450 MATIC ($8,200)',
            'Vision': '89,000 VCN ($4,450)'
        });
    });

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                    Fees & Settlement
                </h1>
                <p class="text-gray-400 mt-2">Revenue tracking and settlement verification</p>
            </header>

            {/* Revenue Summary */}
            <div class="grid grid-cols-4 gap-6">
                <div class="p-6 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20">
                    <div class="text-sm text-green-400 mb-2">Total Revenue (24h)</div>
                    <div class="text-3xl font-bold text-white">$138,050</div>
                </div>
                <div class="p-6 rounded-xl bg-white/5 border border-white/10">
                    <div class="text-sm text-gray-400 mb-2">Avg Surcharge Rate</div>
                    <div class="text-2xl font-bold text-white">28.5%</div>
                </div>
                <div class="p-6 rounded-xl bg-white/5 border border-white/10">
                    <div class="text-sm text-gray-400 mb-2">Total Refunds</div>
                    <div class="text-2xl font-bold text-white">$2,340</div>
                </div>
                <div class="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <div class="text-sm text-yellow-400 mb-2 flex items-center gap-2">
                        <AlertTriangle class="w-4 h-4" /> Variance Alerts
                    </div>
                    <div class="text-2xl font-bold text-white">7</div>
                </div>
            </div>

            {/* Revenue by Chain */}
            <div class="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h2 class="text-xl font-bold mb-4">Revenue by Chain</h2>
                <div class="grid grid-cols-3 gap-4">
                    <For each={Object.entries(revenueByChain())}>
                        {([chain, value]) => (
                            <div class="p-4 bg-white/5 rounded-xl border border-white/5">
                                <div class="text-sm text-gray-400">{chain}</div>
                                <div class="text-lg font-bold text-white mt-1">{value}</div>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Settlement Records */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <div class="p-4 border-b border-white/5 flex justify-between items-center">
                    <h2 class="text-lg font-bold">Recent Settlements</h2>
                    <button class="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                        <RefreshCw class="w-3 h-3" /> Refresh
                    </button>
                </div>
                <table class="w-full text-sm">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase">
                        <tr>
                            <th class="p-4">Quote ID</th>
                            <th class="p-4">dApp</th>
                            <th class="p-4">Chain</th>
                            <th class="p-4">Base Cost</th>
                            <th class="p-4">Actual Cost</th>
                            <th class="p-4">Surcharge</th>
                            <th class="p-4">Refund</th>
                            <th class="p-4">Variance</th>
                            <th class="p-4">Time</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={records()}>
                            {(r) => (
                                <tr class="hover:bg-white/[0.02]">
                                    <td class="p-4 font-mono text-xs">{r.quoteId}</td>
                                    <td class="p-4">{r.dappName}</td>
                                    <td class="p-4">{r.chainId}</td>
                                    <td class="p-4 font-mono">{r.baseCost}</td>
                                    <td class="p-4 font-mono">{r.actualCost}</td>
                                    <td class="p-4 font-mono text-green-400">{r.surcharge}</td>
                                    <td class="p-4 font-mono text-yellow-400">{r.refund || '-'}</td>
                                    <td class={`p-4 font-mono ${r.variance.startsWith('+') ? 'text-red-400' : 'text-green-400'}`}>{r.variance}</td>
                                    <td class="p-4 text-gray-500">{r.timestamp}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminFeesSettlement;
