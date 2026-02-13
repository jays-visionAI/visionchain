import { Component, createSignal, onCleanup, For, Show, onMount } from 'solid-js';
import { ethers } from 'ethers';
import { getAllUsers, getDefiConfig, getFirebaseDb } from '../../services/firebaseService';
import { collection, query, where, getDocs, orderBy, limit, getCountFromServer } from 'firebase/firestore';
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
    Zap,
    Bot,
    Users
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
import { RecentTransactionsTable } from './dashboard/RecentTransactionsTable';
import { Coins } from 'lucide-solid';

// Use a mock provider or dynamic provider to avoid blocking on load
const RPC_NODES = [
    "https://api.visionchain.co/rpc-proxy",
    "https://rpc.visionchain.co",
    "https://api.visionchain.co"
];

let dashboardProvider: ethers.JsonRpcProvider | null = null;
const getDashboardProvider = () => {
    if (dashboardProvider) return dashboardProvider;

    // Try primary rpc-proxy first (normalized CORS)
    try {
        dashboardProvider = new ethers.JsonRpcProvider(RPC_NODES[0], undefined, { staticNetwork: true });
        return dashboardProvider;
    } catch (e) {
        console.warn("Primary RPC failed:", e);
        return null;
    }
};

export const AdminDashboard: Component = () => {
    const [tps, setTps] = createSignal(4850); // Mock initial TPS
    const [gpuTflops, setGpuTflops] = createSignal(0);
    const [storageTb, setStorageTb] = createSignal(0);
    const [wallets, setWallets] = createSignal(0);
    const [humanCount, setHumanCount] = createSignal(0);
    const [agentCount, setAgentCount] = createSignal(0);
    const [blockTime, setBlockTime] = createSignal(1.2); // Static realistic block time
    const [tvl, setTvl] = createSignal(0);
    const [vcnDistributed, setVcnDistributed] = createSignal(0);
    const [vcnBurned, setVcnBurned] = createSignal(0);
    const [apr, setApr] = createSignal(0);
    const [dauData, setDauData] = createSignal<{ day: string; value: number }[]>([]);
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
            // Fix: remove spaces in query params
            const response = await fetch(`${API_URL}?limit=10`);

            if (!response.ok) {
                // If 404 or other error, fallback to empty to avoid crash
                console.warn(`[Dashboard] Transaction fetch failed: ${response.status}`);
                setRecentTransactions([]);
                return;
            }

            const data = await response.json();

            // Fix: Ensure data is an array before mapping
            if (Array.isArray(data)) {
                const formatted = data.map((tx: any) => ({
                    hash: tx.hash,
                    type: tx.type,
                    from: tx.from_addr ? (tx.from_addr.slice(0, 6) + '...' + tx.from_addr.slice(-4)) : 'Unknown',
                    to: tx.to_addr ? (tx.to_addr.slice(0, 6) + '...' + tx.to_addr.slice(-4)) : 'Unknown',
                    amount: tx.value,
                    time: Math.floor((Date.now() - (tx.timestamp || Date.now())) / 60000)
                }));
                setRecentTransactions(formatted);
            } else {
                console.warn("[Dashboard] Transaction API returned unexpected format:", data);
                setRecentTransactions([]);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard transactions:", error);
            setRecentTransactions([]);
        }
    };

    const fetchPaymasterStats = async () => {
        try {
            const p = getDashboardProvider();
            if (!p) return;

            const balance = await p.getBalance("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
            setPaymasterBal(ethers.formatEther(balance));
        } catch (e) {
            console.log("Failed to fetch paymaster stats (RPC might be down)");
        }
    };

    // Remove simulation timer
    // const timer = setInterval(() => { ... }, 2000);
    // onCleanup(() => clearInterval(timer));

    const fetchUserStats = async () => {
        try {
            const users = await getAllUsers(500);
            setHumanCount(users.length);

            // Fetch agent count from Firestore
            const db = getFirebaseDb();
            const agentsRef = collection(db, 'agents');
            const agentsSnap = await getCountFromServer(agentsRef);
            const agentTotal = agentsSnap.data().count;
            setAgentCount(agentTotal);

            setWallets(users.length + agentTotal);
        } catch (e) {
            console.error("Failed to fetch user stats for dashboard:", e);
        }
    };

    const fetchTVLData = async () => {
        try {
            const config = await getDefiConfig();
            // TVL in VCN, convert to millions USD (assuming $0.3 per VCN)
            const tvlUsd = (config.totalVcnLocked || 0) * 0.3 / 1000000;
            setTvl(tvlUsd);
            setApr(config.stakingApr || 0);
        } catch (e) {
            console.error("Failed to fetch TVL:", e);
        }
    };

    const fetchDAUData = async () => {
        try {
            const db = getFirebaseDb();
            // Get users grouped by creation date (last 7 days)
            const now = new Date();
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

            // Build all 7 day queries in parallel instead of sequential
            const dayPromises = Array.from({ length: 7 }, (_, idx) => {
                const i = 6 - idx;
                const date = new Date(now);
                date.setDate(date.getDate() - i);
                const dayName = days[date.getDay()];
                const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0)).toISOString();
                const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999)).toISOString();

                const usersRef = collection(db, 'users');
                const q = query(
                    usersRef,
                    where('createdAt', '>=', startOfDay),
                    where('createdAt', '<=', endOfDay)
                );
                return getDocs(q).then(snapshot => ({ day: dayName, value: snapshot.size }));
            });

            const result = await Promise.all(dayPromises);
            setDauData(result);
        } catch (e) {
            console.error("Failed to fetch DAU data:", e);
            // Fallback to empty data
            setDauData([
                { day: 'Mon', value: 0 },
                { day: 'Tue', value: 0 },
                { day: 'Wed', value: 0 },
                { day: 'Thu', value: 0 },
                { day: 'Fri', value: 0 },
                { day: 'Sat', value: 0 },
                { day: 'Sun', value: 0 },
            ]);
        }
    };

    // Fetch real data on mount & Simulate TPS
    onMount(() => {
        // Fetch all data on mount
        fetchRecentTransactions();
        fetchPaymasterStats();
        fetchUserStats();
        fetchTVLData();
        fetchDAUData();

        // Refresh only fast-changing data every 30s (was 5s - too aggressive)
        // User stats and TVL change infrequently, no need to poll
        const dataInterval = setInterval(() => {
            fetchRecentTransactions();
            fetchPaymasterStats();
        }, 30000);

        // Mock TPS Simulation (cosmetic only, slowed from 2s to 10s)
        const tpsInterval = setInterval(() => {
            setTps(prev => {
                const fluctuation = (Math.random() - 0.5) * 150;
                return Math.floor(Math.max(4500, Math.min(5200, prev + fluctuation)));
            });
        }, 10000);

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

                    <MetricCard
                        title="Total Accounts"
                        value={wallets().toLocaleString()}
                        trend={5.8}
                        icon={Users}
                        color="blue"
                    >
                        <div class="mt-4 space-y-3">
                            {/* Human Accounts */}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-slate-500 flex items-center gap-1">
                                        <Wallet class="w-3 h-3" /> Human
                                    </span>
                                    <span class="text-white font-mono">{humanCount().toLocaleString()}</span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-blue-500 h-full rounded-full transition-all" style={`width: ${wallets() > 0 ? (humanCount() / wallets() * 100) : 0}%`} />
                                </div>
                            </div>
                            {/* Agent Accounts */}
                            <div>
                                <div class="flex justify-between text-xs mb-1">
                                    <span class="text-slate-500 flex items-center gap-1">
                                        <Bot class="w-3 h-3" /> AI Agent
                                    </span>
                                    <span class="text-cyan-400 font-mono">{agentCount().toLocaleString()}</span>
                                </div>
                                <div class="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                    <div class="bg-cyan-500 h-full rounded-full transition-all" style={`width: ${wallets() > 0 ? (agentCount() / wallets() * 100) : 0}%`} />
                                </div>
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
                        <ActivityMap data={dauData()} />
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
                            <TVLPieChart tvlValue={tvl()} />
                        </div>
                    </MetricCard>

                    {/* Max Performance Section */}
                    <MaxTPSSection />
                </div>
            </div>

            {/* Bottom Section: Recent Transactions Table */}
            <RecentTransactionsTable transactions={recentTransactions()} />
        </div>
    );
};

