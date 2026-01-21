import { Component, createSignal, onCleanup, For, Show, onMount } from 'solid-js';
import { ethers } from 'ethers';
import { getAllUsers } from '../../services/firebaseService';
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
    Clock,
    Zap
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

// Re-use provider instance outside component to avoid re-creation and memory leaks
const provider = new ethers.JsonRpcProvider("https://vision-testnet-rpc.vision-chain.io");

export const AdminDashboard: Component = () => {
    const [tps, setTps] = createSignal(4850); // Mock initial TPS
    const [gpuTflops, setGpuTflops] = createSignal(0);
    const [storageTb, setStorageTb] = createSignal(0);
    const [wallets, setWallets] = createSignal(0);
    const [blockTime, setBlockTime] = createSignal(1.2); // Static realistic block time
    const [tvl, setTvl] = createSignal(0);
    const [vcnDistributed, setVcnDistributed] = createSignal(0);
    const [vcnBurned, setVcnBurned] = createSignal(0);
    const [apr, setApr] = createSignal(0);
    const [nodeData, setNodeData] = createSignal({
        authority: 5, // 5 Nodes in cluster
        consensus: 0,
        agent: 0,
        edge: 0
    });
    const [recentTransactions, setRecentTransactions] = createSignal<any[]>([]);
    const [paymasterBal, setPaymasterBal] = createSignal("0");
    const [gaslessCount, setGaslessCount] = createSignal(0);

    const API_URL = "https://api.visionchain.co/api/transactions";

    const fetchRecentTransactions = async () => {
        try {
            const response = await fetch(`${API_URL}?limit = 10`);
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

    const fetchPaymasterStats = async () => {
        try {
            // Check if provider is ready
            if (!provider) return;

            const balance = await provider.getBalance("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
            setPaymasterBal(ethers.formatEther(balance));

            // Real gasless count would need an event listener or API. Keeping 0 for now.
        } catch (e) {
            console.log("Failed to fetch paymaster stats (RPC might be down, using cached/mock)");
        }
    };

    // Remove simulation timer
    // const timer = setInterval(() => { ... }, 2000);
    // onCleanup(() => clearInterval(timer));

    const fetchUserStats = async () => {
        try {
            const users = await getAllUsers(500);
            setWallets(users.length);
        } catch (e) {
            console.error("Failed to fetch user stats for dashboard:", e);
        }
    };

    // Fetch real data on mount & Simulate TPS
    onMount(() => {
        fetchRecentTransactions();
        fetchPaymasterStats();
        fetchUserStats();

        // Refresh Data every 5s
        const dataInterval = setInterval(() => {
            fetchRecentTransactions();
            fetchPaymasterStats();
            fetchUserStats();
        }, 5000);

        // Mock TPS Simulation (Fast update)
        const tpsInterval = setInterval(() => {
            setTps(prev => {
                const fluctuation = (Math.random() - 0.5) * 150;
                return Math.floor(Math.max(4500, Math.min(5200, prev + fluctuation)));
            });
        }, 2000);

        onCleanup(() => {
            clearInterval(dataInterval);
            clearInterval(tpsInterval);
        });
    });

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
                        value={`${apr().toFixed(1)}% `}
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
                        value={`${blockTime().toFixed(2)} s`}
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
                    {/* Paymaster / Gasless Relayer Monitor */}
                    <MetricCard
                        title="Gasless Paymaster"
                        value={`${Number(paymasterBal()).toFixed(1)} POL`}
                        subValue="Relayer Pool"
                        trend={0.0}
                        icon={Zap} // Need to import Zap
                        color="amber"
                        class="border-amber-500/10"
                    >
                        <div class="mt-4 space-y-3">
                            <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <span>Relayed Txs (24h)</span>
                                <span class="text-white">{gaslessCount()}</span>
                            </div>
                            <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                <div class="bg-amber-500 h-full w-[45%]" />
                            </div>
                            <p class="text-[9px] text-amber-500/80 font-mono mt-1">
                                Target: 0x7099...79C8
                            </p>
                        </div>
                    </MetricCard>

                    {/* TVL Hero */}
                    <MetricCard
                        title="Total Value Locked"
                        value={`$${tvl().toFixed(1)} M`}
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

