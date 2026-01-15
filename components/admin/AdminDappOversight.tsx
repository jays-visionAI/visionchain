import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { Building2, TrendingUp, AlertCircle, DollarSign, Users } from 'lucide-solid';

interface DAppOverview {
    dappId: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
    totalSponsored24h: string;
    totalSponsored7d: string;
    txCount: number;
    userCount: number;
    chainStatus: Record<number, boolean>;
    capUsage: number; // 0-100%
}

const AdminDappOversight: Component = () => {
    const [dapps, setDapps] = createSignal<DAppOverview[]>([]);
    const [loading, setLoading] = createSignal(true);

    onMount(async () => {
        // Mock data
        setDapps([
            { dappId: 'dapp_001', name: 'Vision Swap', status: 'ACTIVE', totalSponsored24h: '45.2 ETH', totalSponsored7d: '312.5 ETH', txCount: 12450, userCount: 3200, chainStatus: { 1: true, 137: true, 3151909: true }, capUsage: 35 },
            { dappId: 'dapp_002', name: 'NFT Marketplace', status: 'ACTIVE', totalSponsored24h: '12.8 ETH', totalSponsored7d: '89.3 ETH', txCount: 5600, userCount: 1100, chainStatus: { 1: true, 137: false }, capUsage: 78 },
            { dappId: 'dapp_003', name: 'DeFi Lender', status: 'SUSPENDED', totalSponsored24h: '0 ETH', totalSponsored7d: '156.7 ETH', txCount: 0, userCount: 2800, chainStatus: { 1: false }, capUsage: 0 }
        ]);
        setLoading(false);
    });

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header class="flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                        dApp Sponsor Oversight
                    </h1>
                    <p class="text-gray-400 mt-2">Monitor & manage dApp sponsorship usage</p>
                </div>
                <div class="flex gap-3">
                    <input type="text" placeholder="Search dApp..." class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm w-64" />
                </div>
            </header>

            {/* Summary Cards */}
            <div class="grid grid-cols-4 gap-6">
                <SummaryCard icon={Building2} title="Active dApps" value="42" color="blue" />
                <SummaryCard icon={DollarSign} title="Total Sponsored (24h)" value="892.5 ETH" color="green" />
                <SummaryCard icon={Users} title="Unique Users (24h)" value="12.4K" color="purple" />
                <SummaryCard icon={AlertCircle} title="Cap Breaches" value="3" color="red" />
            </div>

            {/* dApp Table */}
            <div class="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                <table class="w-full">
                    <thead class="bg-white/5 text-left text-xs text-gray-400 uppercase tracking-wider">
                        <tr>
                            <th class="p-4">dApp</th>
                            <th class="p-4">Status</th>
                            <th class="p-4">Spent (24h)</th>
                            <th class="p-4">Spent (7d)</th>
                            <th class="p-4">Tx Count</th>
                            <th class="p-4">Users</th>
                            <th class="p-4">Cap Usage</th>
                            <th class="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={dapps()}>
                            {(dapp) => (
                                <tr class="hover:bg-white/[0.02] transition">
                                    <td class="p-4">
                                        <div class="font-bold text-white">{dapp.name}</div>
                                        <div class="text-xs text-gray-500">{dapp.dappId}</div>
                                    </td>
                                    <td class="p-4">
                                        <span class={`px-2 py-1 text-xs font-bold rounded-md ${dapp.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                                                dapp.status === 'SUSPENDED' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                            }`}>{dapp.status}</span>
                                    </td>
                                    <td class="p-4 font-mono text-sm">{dapp.totalSponsored24h}</td>
                                    <td class="p-4 font-mono text-sm">{dapp.totalSponsored7d}</td>
                                    <td class="p-4">{dapp.txCount.toLocaleString()}</td>
                                    <td class="p-4">{dapp.userCount.toLocaleString()}</td>
                                    <td class="p-4">
                                        <div class="flex items-center gap-2">
                                            <div class="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div class={`h-full ${dapp.capUsage > 80 ? 'bg-red-500' : dapp.capUsage > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${dapp.capUsage}%` }} />
                                            </div>
                                            <span class="text-xs text-gray-400">{dapp.capUsage}%</span>
                                        </div>
                                    </td>
                                    <td class="p-4">
                                        <button class="px-3 py-1 text-xs bg-white/5 hover:bg-white/10 rounded-lg transition">View</button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SummaryCard = (props: { icon: any; title: string; value: string; color: string }) => (
    <div class="p-6 rounded-xl bg-white/5 border border-white/10">
        <div class="flex items-center gap-3 mb-3">
            <props.icon class={`w-5 h-5 text-${props.color}-400`} />
            <span class="text-sm text-gray-400">{props.title}</span>
        </div>
        <div class="text-2xl font-bold text-white">{props.value}</div>
    </div>
);

export default AdminDappOversight;
