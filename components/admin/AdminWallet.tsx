import { createSignal, For, Show } from 'solid-js';
import {
    Wallet,
    TrendingUp,
    ArrowUpRight,
    ArrowDownLeft,
    DollarSign,
    Activity,
    Lock,
    RefreshCw,
    Search,
    Filter,
    MoreVertical,
    BarChart3
} from 'lucide-solid';
import { Motion } from 'solid-motionone';

// Mock Transaction Data
const mockTransactions = [
    { id: 'tx_01', type: 'send', amount: '1,200 VCN', from: '0x7F3A...BE29', to: '0x9dE2...4A1B', status: 'completed', time: '2 min ago' },
    { id: 'tx_02', type: 'receive', amount: '450 VCN', from: '0x3C1F...8B02', to: '0x7F3A...BE29', status: 'completed', time: '15 min ago' },
    { id: 'tx_03', type: 'swap', amount: '0.5 ETH', from: 'ETH Node', to: 'VCN Bridge', status: 'processing', time: '1 hour ago' },
    { id: 'tx_04', type: 'send', amount: '3,000 VCN', from: '0x7F3A...BE29', to: '0x1A2B...3C4D', status: 'completed', time: '3 hours ago' },
    { id: 'tx_05', type: 'mint', amount: 'NFT #2841', from: 'Vision Mint', to: '0x5E6F...7G8H', status: 'completed', time: '5 hours ago' },
];

export default function AdminWallet() {
    const [searchQuery, setSearchQuery] = createSignal('');

    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex items-end justify-between">
                <div>
                    <h1 class="text-3xl font-black text-white uppercase tracking-tight">Wallet Control</h1>
                    <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Global Asset & Transaction Management</p>
                </div>
                <div class="flex gap-3">
                    <button class="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-white/[0.08] transition-all flex items-center gap-2">
                        <RefreshCw class="w-3.5 h-3.5" />
                        Sync Nodes
                    </button>
                    <button class="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all flex items-center gap-2">
                        <DollarSign class="w-3.5 h-3.5" />
                        Adjust Liquidity
                    </button>
                </div>
            </div>

            {/* Asset Performance Grid */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BarChart3 class="w-12 h-12 text-cyan-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total System Liquidity</div>
                    <div class="flex items-end gap-2 mb-2">
                        <span class="text-3xl font-black text-white">$142.5M</span>
                        <span class="text-green-400 text-xs font-bold mb-1">+4.2%</span>
                    </div>
                    <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full w-[75%] bg-gradient-to-r from-cyan-500 to-blue-500" />
                    </div>
                </div>

                <div class="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <RefreshCw class="w-12 h-12 text-purple-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Daily Volume (24h)</div>
                    <div class="flex items-end gap-2 mb-2">
                        <span class="text-3xl font-black text-white">842,900</span>
                        <span class="text-gray-500 text-[10px] font-bold mb-1 uppercase tracking-widest">Transactions</span>
                    </div>
                    <div class="flex gap-1 items-end h-6">
                        <For each={[30, 45, 25, 60, 40, 75, 50]}>
                            {(h) => <div class="w-full bg-purple-500/20 rounded-t-[1px]" style={{ height: `${h}%` }} />}
                        </For>
                    </div>
                </div>

                <div class="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Lock class="w-12 h-12 text-orange-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Proof of Reserve</div>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-3xl font-black text-white">100%</span>
                        <div class="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[9px] font-black text-green-400 uppercase tracking-widest">Verified</div>
                    </div>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Last audit: 12 minutes ago</p>
                </div>
            </div>

            {/* Transaction Explorer */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 class="text-xl font-bold text-white flex items-center gap-3">
                        <Activity class="w-5 h-5 text-cyan-400" />
                        Global Transaction Explorer
                    </h2>
                    <div class="flex gap-4">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search hashes, addresses..."
                                class="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-64"
                            />
                        </div>
                        <button class="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                            <Filter class="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-white/[0.01] text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5">
                                <th class="px-6 py-4">Status</th>
                                <th class="px-6 py-4">Transaction hash</th>
                                <th class="px-6 py-4">Type</th>
                                <th class="px-6 py-4">From</th>
                                <th class="px-6 py-4">To</th>
                                <th class="px-6 py-4">Amount</th>
                                <th class="px-6 py-4">Time</th>
                                <th class="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <For each={mockTransactions}>
                                {(tx) => (
                                    <tr class="hover:bg-white/[0.02] transition-colors group">
                                        <td class="px-6 py-4">
                                            <div class={`w-2 h-2 rounded-full ${tx.status === 'completed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-yellow-500 animate-pulse'}`} />
                                        </td>
                                        <td class="px-6 py-4">
                                            <code class="text-[11px] text-cyan-400/80 font-mono tracking-tight">{tx.id}_f32a...910c</code>
                                        </td>
                                        <td class="px-6 py-4">
                                            <div class="flex items-center gap-2">
                                                <Show when={tx.type === 'send'}>
                                                    <div class="p-1.5 rounded-lg bg-red-500/10 text-red-400"><ArrowUpRight class="w-3.5 h-3.5" /></div>
                                                </Show>
                                                <Show when={tx.type === 'receive'}>
                                                    <div class="p-1.5 rounded-lg bg-green-500/10 text-green-400"><ArrowDownLeft class="w-3.5 h-3.5" /></div>
                                                </Show>
                                                <Show when={tx.type === 'swap'}>
                                                    <div class="p-1.5 rounded-lg bg-purple-500/10 text-purple-400"><RefreshCw class="w-3.5 h-3.5" /></div>
                                                </Show>
                                                <Show when={tx.type === 'mint'}>
                                                    <div class="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400"><TrendingUp class="w-3.5 h-3.5" /></div>
                                                </Show>
                                                <span class="text-xs font-bold text-gray-300 capitalize">{tx.type}</span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4 text-[11px] font-mono text-gray-500">{tx.from}</td>
                                        <td class="px-6 py-4 text-[11px] font-mono text-gray-500">{tx.to}</td>
                                        <td class="px-6 py-4 text-sm font-black text-white">{tx.amount}</td>
                                        <td class="px-6 py-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{tx.time}</td>
                                        <td class="px-6 py-4 text-right">
                                            <button class="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white">
                                                <MoreVertical class="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>

                <div class="p-4 bg-white/[0.01] text-center border-t border-white/5">
                    <button class="text-[10px] font-black text-gray-500 hover:text-cyan-400 uppercase tracking-widest transition-colors">Load more transactions</button>
                </div>
            </div>
        </div>
    );
}
