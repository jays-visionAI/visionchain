import { Component, createSignal, onCleanup, For, Show } from 'solid-js';
import {
    Activity,
    Server,
    Wallet,
    Layers,
    ArrowRight,
    Search
} from 'lucide-solid';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { MetricCard } from './dashboard/MetricCard';
import { TPSGauge, NodeHealthChart, ActivityMap, TVLPieChart } from './dashboard/DashboardCharts';

export const AdminDashboard: Component = () => {
    const [tps, setTps] = createSignal(97500);

    // Simulate TPS fluctuation - slow movement between 96000-99500
    const timer = setInterval(() => {
        setTps(prev => {
            const fluctuation = (Math.random() - 0.5) * 200; // Smaller, slower changes
            return Math.floor(Math.max(96000, Math.min(99500, prev + fluctuation)));
        });
    }, 2000); // Slower update interval (2 seconds)

    onCleanup(() => clearInterval(timer));

    return (
        <div class="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10 font-sans">
            <DashboardHeader />

            {/* Main Grid Layout */}
            <div class="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">

                {/* LEFT COLUMN: Node & Wallet Status */}
                <div class="xl:col-span-1 space-y-6">
                    {/* Active Nodes */}
                    <MetricCard
                        title="Active Validator Nodes"
                        value="--"
                        subValue="/ --"
                        trend={0}
                        icon={Server}
                        color="green"
                    >
                        <div class="mt-4">
                            <NodeHealthChart />
                        </div>
                    </MetricCard>

                    {/* Total Wallets */}
                    <MetricCard
                        title="Total Wallets"
                        value="--"
                        trend={0}
                        icon={Wallet}
                        color="blue"
                    >
                        <div class="mt-4 space-y-2">
                            <div class="flex justify-between text-xs text-slate-500">
                                <span>New (24h)</span>
                                <span class="text-white font-mono">+0</span>
                            </div>
                            <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-blue-500 h-full w-[75%]" />
                            </div>
                        </div>
                    </MetricCard>

                    {/* Block Time */}
                    <MetricCard
                        title="Avg Block Time"
                        value="--"
                        icon={Layers}
                        color="amber"
                        class="border-amber-500/10"
                    >
                        <p class="text-[10px] text-slate-500 mt-2">Consistent performance within expected limits.</p>
                    </MetricCard>
                </div>

                {/* CENTER COLUMN: TPS Gauge (Hero) */}
                <div class="xl:col-span-2 flex flex-col gap-6">
                    <div class="flex-1 bg-[#0B0E14] border border-white/5 rounded-3xl p-8 relative overflow-hidden flex flex-col items-center justify-center shadow-2xl">
                        <div class="absolute inset-0 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none" />

                        <div class="relative z-10 text-center mb-6">
                            <h2 class="text-sm font-black text-cyan-400 uppercase tracking-[0.2em] mb-2">Real-time Performance</h2>
                            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                <div class="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                Live Network
                            </div>
                        </div>

                        <div class="w-full max-w-md aspect-square relative -my-10">
                            <TPSGauge value={tps()} max={100000} />

                            {/* Central Stats Overlay */}
                            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-12">
                                <span class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Peak TPS</span>
                                <span class="text-lg font-mono text-white">--</span>
                            </div>
                        </div>
                    </div>

                    {/* User Activity Bar Chart */}
                    <div class="h-64 bg-[#13161F] border border-white/5 rounded-2xl p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest">Active User Trends (DAU)</h3>
                            <button class="text-xs text-blue-400 hover:text-white transition-colors">View Report</button>
                        </div>
                        <ActivityMap />
                    </div>
                </div>

                {/* RIGHT COLUMN: TVL & DeFi */}
                <div class="xl:col-span-1 space-y-6">
                    {/* TVL Hero */}
                    <MetricCard
                        title="Total Value Locked"
                        value="$0"
                        trend={0}
                        icon={Activity}
                        color="purple"
                        class="bg-gradient-to-br from-[#13161F] to-[#1e1b4b]"
                    >
                        <div class="mt-6">
                            <TVLPieChart />
                        </div>
                    </MetricCard>

                    {/* Top dApps */}
                    <div class="bg-[#13161F] border border-white/5 rounded-2xl p-6">
                        <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Top Ecosystem dApps</h3>
                        <div class="space-y-4">
                            <div class="py-10 text-center text-slate-500 text-xs italic">
                                No dApps registered yet
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Section: Recent Transactions Table */}
            <div class="bg-[#13161F] border border-white/5 rounded-2xl overflow-hidden">
                <div class="p-6 border-b border-white/5 flex justify-between items-center">
                    <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest">Recent Transactions</h3>
                    <div class="relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search TxHash / Block"
                            class="bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500/50 w-64 transition-all"
                        />
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th class="p-4 pl-6">Tx Hash</th>
                                <th class="p-4">Type</th>
                                <th class="p-4">From</th>
                                <th class="p-4">To</th>
                                <th class="p-4">Amount</th>
                                <th class="p-4">Status</th>
                                <th class="p-4 text-right pr-6">Time</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <Show when={false} fallback={
                                <tr>
                                    <td colspan="7" class="p-20 text-center text-slate-500 text-sm">
                                        No recent transactions found
                                    </td>
                                </tr>
                            }>
                                <For each={[]}>
                                    {(tx: any) => (
                                        <tr class="hover:bg-white/[0.02] transition-colors group">
                                            <td class="p-4 pl-6 font-mono text-xs text-blue-400 group-hover:text-cyan-400 cursor-pointer">{tx.hash}</td>
                                            <td class="p-4">
                                                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-slate-300">
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td class="p-4 font-mono text-xs text-slate-400">{tx.from}</td>
                                            <td class="p-4 font-mono text-xs text-slate-400">{tx.to}</td>
                                            <td class="p-4 text-xs font-bold text-white">{tx.amount} VCN</td>
                                            <td class="p-4">
                                                <span class="text-[10px] font-bold uppercase tracking-wider text-green-400">Success</span>
                                            </td>
                                            <td class="p-4 text-right pr-6 text-xs text-slate-500">{tx.time} min ago</td>
                                        </tr>
                                    )}
                                </For>
                            </Show>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

