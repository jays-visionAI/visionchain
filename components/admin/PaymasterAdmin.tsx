import { Component, createSignal, onMount, onCleanup, For, Show } from 'solid-js';
import { AdminService } from '../../services/admin/AdminService';
import { ChainConfig, PaymasterPool } from '../../services/paymaster/types';
import { PaymasterAgent } from '../../services/paymaster/PaymasterAgent';
import { GrandOrchestrator } from '../../services/paymaster/GrandOrchestrator';
import { getFirebaseDb } from '../../firebaseService';
import { doc, updateDoc } from 'firebase/firestore';

const PaymasterAdmin: Component = () => {
    const [stats, setStats] = createSignal<any>(null);
    const [chains, setChains] = createSignal<ChainConfig[]>([]);
    const [pools, setPools] = createSignal<Record<number, PaymasterPool>>({});
    const [loading, setLoading] = createSignal(true);

    let agent: PaymasterAgent | undefined;
    let orchestrator: GrandOrchestrator | undefined;

    const refreshData = async () => {
        try {
            const [metrics, chainList] = await Promise.all([
                AdminService.getDashboardMetrics(),
                AdminService.getAllChains()
            ]);
            setStats(metrics);
            setChains(chainList);

            const poolMap: Record<number, PaymasterPool> = {};
            await Promise.all(chainList.map(async (c) => {
                const pool = await AdminService.getPool(c.chainId);
                if (pool) poolMap[c.chainId] = pool;
            }));
            setPools(poolMap);
        } catch (error) {
            console.error("Failed to load Paymaster Admin data", error);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => {
        console.log("Starting Paymaster Simulation Node...");
        // 1. Start Mock Agent & Orchestrator
        try {
            // Vision Testnet v2 Configuration
            const VISION_TESTNET_ID = 3151909;
            agent = new PaymasterAgent({
                chainId: VISION_TESTNET_ID,
                rpcUrl: 'http://46.224.221.201:8545', // Testnet v2 RPC
                gasPriceSources: [],
                minBalance: BigInt(1000000000000000000) // 1 ETH
            });
            // Mock the interval to be faster for demo

            orchestrator = new GrandOrchestrator();

            // Force run initial checks
            agent.runHealthCheck().catch(console.error);
        } catch (e) {
            console.error("Failed to start Agent Simulation", e);
        }

        // 2. Start Polling for UI Updates
        refreshData();
        const interval = setInterval(async () => {
            await refreshData();
            // Optional: Manually trigger agent check loop if setInterval inside Class is too slow or drifted
            if (agent) await agent.runHealthCheck();
            if (orchestrator) await orchestrator.runRebalanceJob();
        }, 3000); // 3s Refresh & Game Loop

        onCleanup(() => {
            clearInterval(interval);
            agent?.stop();
            orchestrator?.stop();
        });
    });

    const handlePausePool = async (chainId: number) => {
        if (!confirm("Are you sure you want to PAUSE this pool? DApps will be blocked instantly.")) return;
        await AdminService.setPoolMode("admin_1", chainId, 'PAUSED');
        refreshData();
    };

    const handleResumePool = async (chainId: number) => {
        await AdminService.setPoolMode("admin_1", chainId, 'NORMAL');
        refreshData();
    };

    const handleSimulateDrain = async (chainId: number) => {
        // Drain to 0.1 ETH (below 1 ETH min)
        if (!confirm("Simulate Critical Balance Drop? This should trigger SAFE_MODE.")) return;

        try {
            const db = getFirebaseDb();
            const poolRef = doc(db, 'paymaster_pools', `pool_${chainId}`);
            // Use string for BigInt storage as per schema convention
            await updateDoc(poolRef, {
                balance: "100000000000000000" // 0.1 ETH
            });
            console.log("Simulated Drain executed.");
            refreshData();
        } catch (e) {
            console.error("Simulation Failed", e);
            alert("Simulation Failed: " + e);
        }
    };

    if (loading()) return <div class="p-10 text-center text-white">Loading Grand Paymaster Console...</div>;

    return (
        <div class="space-y-8 p-6 text-white min-h-screen bg-[#0F172A]">
            <header>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Grand Paymaster Orchestrator
                </h1>
                <p class="text-gray-400 mt-2">Global control plane for Cross-Chain Gas Sponsorship</p>
            </header>

            {/* Global KPI Cards */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <KPICard title="24h Sponsor Spend" value={stats()?.totalSpend24h} change="+12.5%" color="blue" />
                <KPICard title="24h Protocol Revenue" value={stats()?.totalRevenue24h} change="+8.2%" color="green" />
                <KPICard title="Global Failure Rate" value={`${stats()?.globalFailureRate}%`} change="-0.05%" color="purple" />
                <KPICard title="Active Chains" value={stats()?.activeChains} color="orange" />
            </div>

            {/* Chain & Pool Monitor */}
            <section>
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold">Chain Agent Nodes</h2>
                    <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
                        onClick={() => alert("Launching Chain Registration Wizard... (Coming Soon)")}>
                        + Register New Chain
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <For each={chains()}>
                        {(chain) => {
                            const pool = pools()[chain.chainId];
                            return (
                                <div class={`relative p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md transition-all hover:border-blue-500/30 ${pool?.mode === 'PAUSED' ? 'border-red-500/50 bg-red-900/10' : ''}`}>
                                    <div class="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 class="text-lg font-bold flex items-center gap-2">
                                                {chain.name}
                                                <span class="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">ID: {chain.chainId}</span>
                                            </h3>
                                            <p class="text-sm text-gray-400">{chain.rpcUrl}</p>
                                        </div>
                                        <StatusBadge status={pool?.mode || 'INIT'} />
                                    </div>

                                    {/* Pool Metrics */}
                                    <div class="space-y-3 mb-6">
                                        <div class="flex justify-between text-sm">
                                            <span class="text-gray-400">Gas Balance</span>
                                            <span class={`font-mono ${formatBalance(pool?.balance) < formatBalance(pool?.minBalance) ? 'text-red-400 font-bold' : 'text-green-400'}`}>
                                                {formatBalance(pool?.balance)} ETH
                                            </span>
                                        </div>
                                        <div class="flex justify-between text-sm">
                                            <span class="text-gray-400">Spend Rate (24h)</span>
                                            <span class="font-mono">{formatBalance(pool?.spendRate24h)} ETH</span>
                                        </div>
                                        <div class="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                            <div
                                                class="bg-blue-500 h-full"
                                                style={{ width: `${Math.min(100, Number(pool?.balance || 0) / Number(pool?.targetBalance || 1) * 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div class="flex gap-2 mt-auto">
                                        <Show when={pool?.mode === 'PAUSED'} fallback={
                                            <button onClick={() => handlePausePool(chain.chainId)} class="flex-1 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg text-sm font-medium transition">
                                                Pause Pool
                                            </button>
                                        }>
                                            <button onClick={() => handleResumePool(chain.chainId)} class="flex-1 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-lg text-sm font-medium transition">
                                                Resume Pool
                                            </button>
                                        </Show>
                                        <button onClick={() => handleSimulateDrain(chain.chainId)} class="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 rounded-lg text-sm font-medium transition ml-2">
                                            Sim: Drain
                                        </button>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </section>
        </div>
    );
};

// UI Helpers
const KPICard = (props: { title: string, value: any, change?: string, color: string }) => (
    <div class="p-6 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        <p class="text-sm text-gray-400 mb-1">{props.title}</p>
        <div class="flex items-end gap-2">
            <h3 class="text-2xl font-bold text-white">{props.value}</h3>
            {props.change && (
                <span class={`text-xs mb-1 ${props.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                    {props.change}
                </span>
            )}
        </div>
        <div class={`mt-3 h-1 w-full rounded-full bg-gradient-to-r from-${props.color}-500/50 to-transparent`} />
    </div>
);

const StatusBadge = (props: { status: string }) => {
    const color = () => ({
        'NORMAL': 'bg-green-500/20 text-green-400 border-green-500/30',
        'SAFE_MODE': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'THROTTLED': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'PAUSED': 'bg-red-500/20 text-red-400 border-red-500/30',
        'INIT': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    }[props.status] || 'bg-gray-500/20 text-gray-400');

    return (
        <span class={`px-2 py-1 text-xs font-bold rounded-md border ${color()}`}>
            {props.status}
        </span>
    );
};

const formatBalance = (val?: bigint) => {
    if (!val) return '0.00';
    try {
        const num = typeof val === 'string' ? BigInt(val) : val;
        return (Number(num) / 1e18).toFixed(4);
    } catch { return '0.00'; }
};

export default PaymasterAdmin;
