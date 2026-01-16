import { Component, createSignal, onCleanup, For, Show } from 'solid-js';
import {
    Activity,
    Server,
    Wallet,
    Layers,
    ArrowRight,
    Search,
    ShieldCheck,
    Cpu,
    Database,
    Clock
} from 'lucide-solid';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { MetricCard } from './dashboard/MetricCard';
import {
    TPSGauge,
    NodeHealthChart,
    ActivityMap,
    TVLPieChart,
    NodeDistributionChart,
    ResourceMetricGroup,
    EconomicMetricGroup
} from './dashboard/DashboardCharts';
import { MaxTPSSection } from './dashboard/MaxTPSSection';
import { Coins } from 'lucide-solid';

export const AdminDashboard: Component = () => {
    const [tps, setTps] = createSignal(97500);
    const [gpuTflops, setGpuTflops] = createSignal(8420);
    const [storageTb, setStorageTb] = createSignal(1240);
    const [wallets, setWallets] = createSignal(142080);
    const [blockTime, setBlockTime] = createSignal(1.2);
    const [tvl, setTvl] = createSignal(125.4);
    const [vcnDistributed, setVcnDistributed] = createSignal(1250000);
    const [vcnBurned, setVcnBurned] = createSignal(42500);
    const [apr, setApr] = createSignal(12.5);
    const [nodeData, setNodeData] = createSignal({
        authority: 1, // Updated to match 5-node cluster (1 boot/RPC, 4 validators)
        consensus: 4,
        agent: 12,
        edge: 45
    });
    const [recentTransactions, setRecentTransactions] = createSignal<any[]>([]);

    const API_URL = "https://api.visionchain.co/api/transactions";

    const fetchRecentTransactions = async () => {
        try {
            const response = await fetch(`${API_URL}?limit=10`);
            const data = await response.json();
            const formatted = data.map((tx: any) => ({
                hash: tx.hash,
                type: tx.type,
                from: tx.from_addr.slice(0, 6) + '...' + tx.from_addr.slice(-4),
                to: tx.to_addr.slice(0, 6) + '...' + tx.to_addr.slice(-4),
                amount: tx.value,
                time: Math.floor((Date.now() - tx.timestamp) / 60000)
            }));
            setRecentTransactions(formatted);
        } catch (error) {
            console.error("Failed to fetch dashboard transactions:", error);
        }
    };

    const timer = setInterval(() => {
        // TPS Simulation (Base for the gauge)
        setTps(prev => {
            const fluctuation = (Math.random() - 0.5) * 200;
            return Math.floor(Math.max(96000, Math.min(99500, prev + fluctuation)));
        });

        fetchRecentTransactions();

        // Resource Simulation
        setGpuTflops(prev => {
            const change = (Math.random() - 0.5) * 50;
            return Math.floor(Math.max(8000, Math.min(9000, prev + change)));
        });

        setStorageTb(prev => {
            const change = Math.random() > 0.8 ? 1 : 0;
            return prev + change;
        });

        // Wallets Simulation
        setWallets(prev => prev + Math.floor(Math.random() * 5));

        // Block Time Simulation
        setBlockTime(prev => {
            const target = 1.2;
            const diff = (Math.random() - 0.5) * 0.1;
            return Math.max(1.1, Math.min(1.4, prev + diff));
        });

        // TVL Simulation
        setTvl(prev => prev + (Math.random() - 0.45) * 0.5);

        // VCN Economy Simulation
        setVcnDistributed(prev => prev + (Math.random() * 2));
        setVcnBurned(prev => prev + (Math.random() * 0.5));
        setApr(prev => {
            const fluctuation = (Math.random() - 0.5) * 0.05;
            return Math.max(10, Math.min(15, prev + fluctuation));
        });

        // Node Count Simulation
        setNodeData(prev => ({
            ...prev,
            edge: Math.max(850, Math.min(950, prev.edge + Math.floor((Math.random() - 0.5) * 10)))
        }));
    }, 2000);

    onCleanup(() => clearInterval(timer));

    return (
        <div class="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10 font-sans">
            <DashboardHeader />

            {/* Main Grid Layout */}
            <div class="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">

                {/* LEFT COLUMN: Node & Resource Status */}
                <div class="xl:col-span-1 space-y-6">
                    {/* Active Nodes Taxonomy */}
                    <MetricCard
                        title="Active Network Nodes"
                        value={nodeData().authority + nodeData().consensus + nodeData().agent + nodeData().edge}
                        subValue="Live"
                        trend={2.4}
                        icon={Server}
                        color="blue"
                    >
                        <div class="mt-4">
                            <NodeDistributionChart data={nodeData()} />
                        </div>
                    </MetricCard>

                    {/* Network Health */}
                    <MetricCard
                        title="Operational Health"
                        value="99.9%"
                        subValue="Uptime"
                        icon={ShieldCheck}
                        color="green"
                    >
                        <div class="mt-4">
                            <NodeHealthChart />
                            <p class="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wider">Stability Index: Optimal</p>
                        </div>
                    </MetricCard>

                    {/* Total Wallets */}
                    <MetricCard
                        title="Total Wallets"
                        value={wallets().toLocaleString()}
                        trend={5.8}
                        icon={Wallet}
                        color="blue"
                    >
                        <div class="mt-4 space-y-2">
                            <div class="flex justify-between text-xs text-slate-500">
                                <span>New (24h)</span>
                                <span class="text-white font-mono">+1,240</span>
                            </div>
                            <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-blue-500 h-full w-[75%]" />
                            </div>
                        </div>
                    </MetricCard>

                    {/* Economy & Staking */}
                    <MetricCard
                        title="Economy & Staking"
                        value={`${apr().toFixed(1)}%`}
                        subValue="Est. APR"
                        trend={0.5}
                        icon={Coins}
                        color="green"
                    >
                        <div class="mt-4">
                            <EconomicMetricGroup distributed={Math.floor(vcnDistributed())} burned={Math.floor(vcnBurned())} />
                            <p class="text-[9px] text-slate-500 mt-2 font-bold uppercase tracking-wider">Deflationary Pressure: Moderate</p>
                        </div>
                    </MetricCard>

                    {/* Block Time */}
                    <MetricCard
                        title="Avg Block Time"
                        value={`${blockTime().toFixed(2)}s`}
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
                                <span class="text-lg font-mono text-white">99,842</span>
                            </div>
                        </div>
                    </div>

                    {/* Resource Hero Section: GPU & Storage */}
                    <div class="space-y-4">
                        <div class="flex justify-between items-center px-2">
                            <h3 class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Contributed Resources</h3>
                            <div class="flex items-center gap-2 text-[10px] font-bold text-blue-400">
                                <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                Monitoring dApp SLA
                            </div>
                        </div>
                        <ResourceMetricGroup gpuTflops={gpuTflops()} storageTb={storageTb()} />
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
                        value={`$${tvl().toFixed(1)}M`}
                        trend={1.2}
                        icon={Activity}
                        color="purple"
                        class="bg-gradient-to-br from-[#13161F] to-[#1e1b4b]"
                    >
                        <div class="mt-6">
                            <TVLPieChart />
                        </div>
                    </MetricCard>

                    {/* Max Performance Section */}
                    <MaxTPSSection />
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
                            <Show when={recentTransactions().length > 0} fallback={
                                <tr>
                                    <td colspan="7" class="p-20 text-center text-slate-500 text-sm">
                                        No recent transactions found
                                    </td>
                                </tr>
                            }>
                                <For each={recentTransactions()}>
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

