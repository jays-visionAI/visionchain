import { Component, createSignal, onMount, For } from 'solid-js';
import { ArrowRight, Download, Search, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-solid';

interface TransactionRecord {
    quoteId: string;
    stage: 'Quote' | 'Deduct' | 'Execute' | 'Settle';
    chainId: number;
    chainName: string;
    baseCost: string;
    actualCost: string;
    surcharge: string;
    refund: string;
    destTxHash?: string;
    explorerUrl?: string;
    timestamp: string;
}

const DevTransactions: Component = () => {
    const [transactions, setTransactions] = createSignal<TransactionRecord[]>([]);
    const [filter, setFilter] = createSignal<string>('ALL');

    onMount(async () => {
        setTransactions([
            { quoteId: 'q_001', stage: 'Settle', chainId: 1, chainName: 'Ethereum', baseCost: '0.0045 ETH', actualCost: '0.0042 ETH', surcharge: '0.00126 ETH', refund: '0.0003 ETH', destTxHash: '0xabc...123', explorerUrl: 'https://etherscan.io/tx/0xabc', timestamp: '2026-01-15 19:50:00' },
            { quoteId: 'q_002', stage: 'Execute', chainId: 137, chainName: 'Polygon', baseCost: '0.15 MATIC', actualCost: '-', surcharge: '-', refund: '-', destTxHash: '0xdef...456', explorerUrl: 'https://polygonscan.com/tx/0xdef', timestamp: '2026-01-15 19:52:00' },
            { quoteId: 'q_003', stage: 'Settle', chainId: 3151909, chainName: 'Vision', baseCost: '5 VCN', actualCost: '4.8 VCN', surcharge: '1.44 VCN', refund: '0.2 VCN', destTxHash: '0x789...abc', explorerUrl: 'http://visionscan.io/tx/0x789', timestamp: '2026-01-15 19:48:00' },
            { quoteId: 'q_004', stage: 'Deduct', chainId: 1, chainName: 'Ethereum', baseCost: '0.008 ETH', actualCost: '-', surcharge: '-', refund: '-', timestamp: '2026-01-15 19:55:00' },
        ]);
    });

    const getStageIcon = (stage: string) => {
        if (stage === 'Settle') return <CheckCircle class="w-4 h-4 text-green-400" />;
        if (stage === 'Execute') return <Clock class="w-4 h-4 text-blue-400" />;
        if (stage === 'Deduct') return <Clock class="w-4 h-4 text-yellow-400" />;
        return <Clock class="w-4 h-4 text-gray-400" />;
    };

    const getStageColor = (stage: string) => ({
        'Quote': 'bg-gray-500/20 text-gray-400',
        'Deduct': 'bg-yellow-500/20 text-yellow-400',
        'Execute': 'bg-blue-500/20 text-blue-400',
        'Settle': 'bg-green-500/20 text-green-400'
    }[stage] || 'bg-gray-500/20 text-gray-400');

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold">Transactions & Settlement</h1>
                    <p class="text-gray-400 mt-2">Track your sponsored transaction lifecycle</p>
                </div>
                <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm flex items-center gap-2">
                    <Download class="w-4 h-4" /> Export CSV
                </button>
            </header>

            {/* Search & Filter */}
            <div class="flex gap-4">
                <div class="flex-1 flex items-center gap-2 bg-white/5 px-4 py-3 rounded-xl">
                    <Search class="w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="Search by quoteId or txHash..." class="bg-transparent text-sm flex-1 outline-none" />
                </div>
                <div class="flex gap-2">
                    {['ALL', 'Quote', 'Deduct', 'Execute', 'Settle'].map(f => (
                        <button
                            onClick={() => setFilter(f)}
                            class={`px-4 py-2 rounded-lg text-sm font-bold transition ${filter() === f ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline Visualization */}
            <div class="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h2 class="text-lg font-bold mb-4">Transaction Lifecycle</h2>
                <div class="flex items-center justify-center gap-2 text-sm">
                    <div class="px-4 py-2 bg-gray-500/20 rounded-lg">Quote</div>
                    <ArrowRight class="w-4 h-4 text-gray-500" />
                    <div class="px-4 py-2 bg-yellow-500/20 rounded-lg">Deduct</div>
                    <ArrowRight class="w-4 h-4 text-gray-500" />
                    <div class="px-4 py-2 bg-blue-500/20 rounded-lg">Execute</div>
                    <ArrowRight class="w-4 h-4 text-gray-500" />
                    <div class="px-4 py-2 bg-green-500/20 rounded-lg">Settle</div>
                </div>
            </div>

            {/* Transactions Table */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase">
                        <tr>
                            <th class="p-4">Quote ID</th>
                            <th class="p-4">Stage</th>
                            <th class="p-4">Chain</th>
                            <th class="p-4">Base Cost</th>
                            <th class="p-4">Actual Cost</th>
                            <th class="p-4">Surcharge</th>
                            <th class="p-4">Refund</th>
                            <th class="p-4">Dest Tx</th>
                            <th class="p-4">Time</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={transactions().filter(t => filter() === 'ALL' || t.stage === filter())}>
                            {(tx) => (
                                <tr class="hover:bg-white/[0.02]">
                                    <td class="p-4 font-mono text-xs">{tx.quoteId}</td>
                                    <td class="p-4">
                                        <span class={`px-2 py-1 text-xs font-bold rounded flex items-center gap-1 w-fit ${getStageColor(tx.stage)}`}>
                                            {getStageIcon(tx.stage)} {tx.stage}
                                        </span>
                                    </td>
                                    <td class="p-4">{tx.chainName}</td>
                                    <td class="p-4 font-mono">{tx.baseCost}</td>
                                    <td class="p-4 font-mono">{tx.actualCost}</td>
                                    <td class="p-4 font-mono text-yellow-400">{tx.surcharge}</td>
                                    <td class="p-4 font-mono text-green-400">{tx.refund}</td>
                                    <td class="p-4">
                                        {tx.destTxHash ? (
                                            <a href={tx.explorerUrl} target="_blank" class="text-blue-400 hover:underline flex items-center gap-1">
                                                {tx.destTxHash} <ExternalLink class="w-3 h-3" />
                                            </a>
                                        ) : '-'}
                                    </td>
                                    <td class="p-4 text-gray-500">{tx.timestamp}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DevTransactions;
