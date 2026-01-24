import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { Wallet, TrendingUp, Zap, AlertCircle, ChevronRight, BarChart3 } from 'lucide-solid';

interface ChainStatus {
    chainId: number;
    name: string;
    status: 'ON' | 'OFF';
    avgGasCost: string;
    sponsored24h: number;
}

const DevConsoleOverview: Component = () => {
    const [balance, setBalance] = createSignal({ vcn: '12,450.00', usdt: '5,200.00' });
    const [spend7d, setSpend7d] = createSignal('3,420.00');
    const [eta, setEta] = createSignal('24 days');
    const [stats, setStats] = createSignal({ txCount: 15420, totalCost: '89.5 ETH', surcharge: '26.85 ETH', failureRate: 0.12 });
    const [chains, setChains] = createSignal<ChainStatus[]>([]);

    onMount(async () => {
        setChains([
            { chainId: 1, name: 'Ethereum', status: 'ON', avgGasCost: '0.0045 ETH', sponsored24h: 1250 },
            { chainId: 137, name: 'Polygon', status: 'ON', avgGasCost: '0.02 MATIC', sponsored24h: 8500 },
            { chainId: 1337, name: 'Vision Chain', status: 'ON', avgGasCost: '0.001 VCN', sponsored24h: 3200 },
            { chainId: 42161, name: 'Arbitrum', status: 'OFF', avgGasCost: '-', sponsored24h: 0 },
        ]);
    });

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Developer Console
                </h1>
                <p class="text-gray-400 mt-2">Manage your Paymaster integration and sponsorship settings</p>
            </header>

            {/* Balance & Spend */}
            <div class="grid grid-cols-3 gap-6">
                <div class="p-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20">
                    <div class="flex items-center gap-2 text-blue-400 mb-3">
                        <Wallet class="w-5 h-5" /> Sponsor Pool Balance
                    </div>
                    <div class="text-3xl font-bold">{balance().vcn} VCN</div>
                    <div class="text-lg text-gray-400 mt-1">{balance().usdt} USDT</div>
                </div>
                <div class="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div class="flex items-center gap-2 text-gray-400 mb-3">
                        <TrendingUp class="w-5 h-5" /> 7-Day Spend
                    </div>
                    <div class="text-3xl font-bold">${spend7d()}</div>
                    <div class="text-sm text-gray-500 mt-1">Estimated Runway: <span class="text-green-400">{eta()}</span></div>
                </div>
                <div class="p-6 rounded-2xl bg-white/5 border border-white/10">
                    <div class="flex items-center gap-2 text-gray-400 mb-3">
                        <Zap class="w-5 h-5" /> Sponsored Transactions
                    </div>
                    <div class="text-3xl font-bold">{stats().txCount.toLocaleString()}</div>
                    <div class="text-sm text-gray-500 mt-1">Failure Rate: <span class={stats().failureRate < 1 ? 'text-green-400' : 'text-red-400'}>{stats().failureRate}%</span></div>
                </div>
            </div>

            {/* Cost Breakdown */}
            <div class="bg-white/5 rounded-2xl border border-white/10 p-6">
                <h2 class="text-xl font-bold mb-4 flex items-center gap-2"><BarChart3 class="w-5 h-5" /> Cost Breakdown</h2>
                <div class="grid grid-cols-3 gap-6">
                    <div class="p-4 bg-white/5 rounded-xl">
                        <div class="text-sm text-gray-400">Total Gas Cost</div>
                        <div class="text-2xl font-bold mt-1">{stats().totalCost}</div>
                    </div>
                    <div class="p-4 bg-white/5 rounded-xl">
                        <div class="text-sm text-gray-400">Surcharge (Fees)</div>
                        <div class="text-2xl font-bold mt-1 text-yellow-400">{stats().surcharge}</div>
                    </div>
                    <div class="p-4 bg-white/5 rounded-xl">
                        <div class="text-sm text-gray-400">Net Paid</div>
                        <div class="text-2xl font-bold mt-1 text-green-400">116.35 ETH</div>
                    </div>
                </div>
            </div>

            {/* Chain Status Cards */}
            <div>
                <h2 class="text-xl font-bold mb-4">Chain Status</h2>
                <div class="grid grid-cols-4 gap-4">
                    <For each={chains()}>
                        {(chain) => (
                            <div class={`p-4 rounded-xl border transition cursor-pointer hover:border-blue-500/30 ${chain.status === 'ON' ? 'bg-white/5 border-white/10' : 'bg-gray-800/50 border-gray-700/50 opacity-60'}`}>
                                <div class="flex justify-between items-start mb-3">
                                    <div class="font-bold">{chain.name}</div>
                                    <span class={`px-2 py-0.5 text-xs font-bold rounded ${chain.status === 'ON' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                        {chain.status}
                                    </span>
                                </div>
                                <div class="text-xs text-gray-400">Avg Gas: {chain.avgGasCost}</div>
                                <div class="text-xs text-gray-400">24h Sponsored: {chain.sponsored24h.toLocaleString()}</div>
                            </div>
                        )}
                    </For>
                </div>
            </div>

            {/* Quick Actions */}
            <div class="flex gap-4">
                <button class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition">Deposit Funds</button>
                <button class="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition">View Transactions</button>
                <button class="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition">Manage Instances</button>
            </div>
        </div>
    );
};

export default DevConsoleOverview;
