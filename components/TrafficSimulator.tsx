import { createSignal, For, Show, createMemo, onCleanup, onMount } from 'solid-js';
import type { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Play,
    Square,
    Settings,
    Activity,
    Shield,
    Users,
    Zap,
    Database,
    RefreshCw,
    ArrowUpRight,
    Cpu,
    Lock,
    Globe,
    AlertCircle,
    Info,
    BarChart3,
    Terminal,
    History,
    ExternalLink,
    Timer
} from 'lucide-solid';
import LightSpeedBackground from './LightSpeedBackground';
import { contractService } from '../services/contractService';

// Types
interface SimStats {
    totalTx: number;
    activeWallets: number;
    tps: number;
    gasUsed: string;
    avgConfidence: number;
    uptime: string;
    sessionProgress: number;
}

interface SimLog {
    id: string;
    hash: string;
    type: string;
    from: string;
    to: string;
    value: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: number;
}

const StatCard = (props: { label: string; value: string | number; subValue?: string; icon: JSX.Element; color?: string }) => (
    <div class="bg-white/[0.02] border border-white/5 p-6 rounded-3xl relative overflow-hidden group backdrop-blur-xl">
        <div class={`absolute top-0 right-0 w-32 h-32 bg-${props.color || 'blue'}-500/5 blur-[50px] -mr-16 -mt-16 group-hover:bg-${props.color || 'blue'}-500/10 transition-colors`} />
        <div class="relative z-10">
            <div class="flex items-center gap-3 text-gray-500 mb-4">
                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all border border-white/5">
                    {props.icon}
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest italic">{props.label}</span>
            </div>
            <div class="flex items-baseline gap-2">
                <span class="text-3xl font-black text-white tracking-tighter">{props.value}</span>
                <Show when={props.subValue}>
                    <span class={`text-[10px] font-bold ${props.subValue?.includes('+') ? 'text-green-400' : 'text-blue-400'}`}>
                        {props.subValue}
                    </span>
                </Show>
            </div>
        </div>
    </div>
);

export default function TrafficSimulator() {
    // Sim State
    const [isRunning, setIsRunning] = createSignal(false);
    const [tpsTarget, setTpsTarget] = createSignal(5);
    const [sessionLimit, setSessionLimit] = createSignal(100); // Default 100 TX
    const [simLogs, setSimLogs] = createSignal<SimLog[]>([]);
    const [stats, setStats] = createSignal<SimStats>({
        totalTx: 0,
        activeWallets: 45,
        tps: 0,
        gasUsed: '0',
        avgConfidence: 99.8,
        uptime: '00:00:00',
        sessionProgress: 0
    });

    // Configuration
    const [burstIntensity, setBurstIntensity] = createSignal('Medium');
    const [targetContract, setTargetContract] = createSignal('');
    const [customMethod, setCustomMethod] = createSignal('');
    const [metadataType, setMetadataType] = createSignal('A110 (Asset Transfer)');

    // Toggles
    const [useAccounting, setUseAccounting] = createSignal(true);
    const [useCrossChain, setUseCrossChain] = createSignal(false);
    const [useZkProof, setUseZkProof] = createSignal(false);

    // Wallet
    let simWallet: any = null;

    // Timer refs
    let simInterval: any;
    let uptimeInterval: any;
    let startTime: number | null = null;
    let txCount = 0;
    const SCAN_URL = "https://api.visionchain.co/scan/tx/";

    // Local trackers to avoid per-TX RPC calls
    let currentNonce: number | null = null;
    let cachedGasPrice: bigint | null = null;

    const injectTransaction = async () => {
        const currentWallet = simWallet; // Capture instance to prevent race conditions during stop
        if (!currentWallet || !isRunning()) return;

        if (txCount >= sessionLimit()) {
            stopSimulation();
            return;
        }

        const type = metadataType().split(' ')[0];
        const metadata: any = {
            timestamp: Date.now(),
            method: customMethod() || 'SimulatedAction',
            simulator: true
        };

        if (useAccounting()) {
            metadata.accounting = {
                basis: "Accrual",
                taxCategory: "Standard",
                journalEntries: [
                    { account: "VCN-Asset", dr: 100, cr: 0 },
                    { account: "Revenue", dr: 0, cr: 100 }
                ]
            };
        }

        if (useCrossChain()) {
            metadata.bridgeContext = {
                sourceChain: "Vision Testnet v2",
                destinationChain: "Ethereum Sepolia",
                isCrossChain: true
            };
        }

        if (useZkProof()) {
            metadata.zkProof = "0x" + Math.random().toString(16).slice(2, 66);
        }

        let txResult: any;

        try {
            // Real Injection
            if (currentWallet) {
                // Initialize Nonce and GasPrice if needed
                if (currentNonce === null) {
                    currentNonce = await currentWallet.getNonce();
                }
                if (cachedGasPrice === null || txCount % 10 === 0) {
                    const feeData = await currentWallet.provider!.getFeeData();
                    cachedGasPrice = feeData.gasPrice;
                }

                txResult = await contractService.injectSimulatorTransaction(currentWallet, {
                    type,
                    to: targetContract() || "0x0000000000000000000000000000000000000000",
                    value: (Math.random() * 0.1).toFixed(4),
                    metadata,
                    nonce: currentNonce,
                    gasPrice: cachedGasPrice || undefined
                });

                currentNonce++; // Increment locally
            }
        } catch (error) {
            console.warn("Injection failed or interrupted:", error);
            return;
        }

        if (!txResult) return;

        const newLog: SimLog = {
            id: (txResult.hash || '0x...').slice(0, 10) + '...',
            hash: txResult.hash || '',
            type: type,
            from: (await simWallet?.getAddress() || (txResult.from || '0x...')),
            to: targetContract() || (txResult.to || '0x...'),
            value: (txResult.value || (Math.random() * 5).toFixed(4)) + ' VCN',
            status: 'success',
            timestamp: Date.now()
        };

        setSimLogs(prev => [newLog, ...prev].slice(0, 50));
        txCount++;

        setStats(prev => ({
            ...prev,
            totalTx: prev.totalTx + 1,
            sessionProgress: (txCount / sessionLimit()) * 100,
            tps: tpsTarget() + (Math.random() * 0.5 - 0.25),
            gasUsed: (parseFloat(prev.gasUsed) + 0.0001).toFixed(4)
        }));
    };

    const startSimulation = async () => {
        if (isRunning()) return;

        // Initialize Ephemeral Wallet for real transactions
        try {
            simWallet = await contractService.createSimulatorWallet();
            console.log("Simulator Wallet Initialized:", await simWallet.getAddress());
        } catch (e) {
            console.warn("Could not initialize simulator wallet, using mock data.", e);
        }

        setIsRunning(true);
        txCount = 0;
        currentNonce = null; // Reset tracker
        cachedGasPrice = null; // Reset tracker
        startTime = Date.now();
        setSimLogs([]);
        setStats(prev => ({ ...prev, sessionProgress: 0, uptime: '00:00:00' }));

        const target = tpsTarget();
        const intervalMs = Math.max(10, 1000 / target);
        const txPerInterval = target > 100 ? Math.ceil(target / (1000 / intervalMs)) : 1;

        simInterval = setInterval(() => {
            for (let i = 0; i < txPerInterval; i++) {
                if (isRunning()) injectTransaction();
            }
        }, intervalMs);

        uptimeInterval = setInterval(() => {
            if (!startTime) return;
            const diff = Date.now() - startTime;
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            setStats(prev => ({ ...prev, uptime: `${h}:${m}:${s}` }));
        }, 1000);
    };

    const stopSimulation = () => {
        setIsRunning(false);
        clearInterval(simInterval);
        clearInterval(uptimeInterval);
        setStats(prev => ({ ...prev, tps: 0 }));
        simWallet = null;
        currentNonce = null;
        cachedGasPrice = null;
    };

    const handleTpsChange = (val: number) => {
        setTpsTarget(val);
        if (isRunning()) {
            clearInterval(simInterval);
            const intervalMs = Math.max(10, 1000 / val);
            const txPerInterval = val > 100 ? Math.ceil(val / (1000 / intervalMs)) : 1;

            simInterval = setInterval(() => {
                for (let i = 0; i < txPerInterval; i++) {
                    if (isRunning()) injectTransaction();
                }
            }, intervalMs);
        }
    };

    const setBurst = (level: string) => {
        setBurstIntensity(level);
        const tpsMap: Record<string, number> = { 'Low': 10, 'Medium': 100, 'High': 1000, 'Max': 100000 };
        handleTpsChange(tpsMap[level]);
    };

    onCleanup(() => {
        clearInterval(simInterval);
        clearInterval(uptimeInterval);
    });

    return (
        <div class="bg-[#050505] min-h-screen text-white pt-24 pb-32 font-sans selection:bg-blue-500/30">
            <div class="fixed inset-0 opacity-10 pointer-events-none">
                <LightSpeedBackground />
            </div>

            <main class="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header Section */}
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                    <div class="space-y-2">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 border border-white/10 flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
                                <Activity class={`w-7 h-7 ${isRunning() ? 'animate-pulse' : ''}`} />
                            </div>
                            <div>
                                <h1 class="text-5xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">TRAFFIC SIMULATOR</h1>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                                    <p class="text-blue-500 font-black tracking-[0.4em] uppercase text-[10px]">Developer Stress-Testing Suite v2</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-4 p-3 bg-white/5 border border-white/10 rounded-[28px] backdrop-blur-3xl shadow-2xl">
                        <div class="flex flex-col px-4 border-r border-white/10">
                            <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Session Limit</span>
                            <select
                                value={sessionLimit()}
                                onChange={(e) => setSessionLimit(parseInt(e.currentTarget.value))}
                                class="bg-transparent text-xs font-black text-white outline-none cursor-pointer hover:text-blue-400 transition-colors"
                            >
                                <option value="50">50 Transactions</option>
                                <option value="100">100 Transactions</option>
                                <option value="1000">1,000 Transactions</option>
                                <option value="10000">10,000 Transactions</option>
                                <option value="100000">100,000 Transactions</option>
                                <option value="1000000">1,000,000 Transactions</option>
                            </select>
                        </div>

                        <button
                            onClick={() => isRunning() ? stopSimulation() : startSimulation()}
                            class={`px-10 py-4 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-[0.2em] transition-all duration-500 group relative overflow-hidden ${isRunning()
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)]'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]'
                                }`}
                        >
                            <Show when={isRunning()} fallback={<Play class="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />}>
                                <Square class="w-4 h-4 fill-white animate-pulse" />
                            </Show>
                            {isRunning() ? 'Terminate' : 'Initialize'} Session
                        </button>
                    </div>
                </div>

                {/* Session Progress Bar */}
                <Show when={isRunning()}>
                    <div class="mb-12 space-y-3">
                        <div class="flex justify-between items-end">
                            <div class="flex items-center gap-2">
                                <Timer class="w-4 h-4 text-blue-400" />
                                <span class="text-[10px] font-black uppercase tracking-widest text-blue-400">Execution Progress</span>
                            </div>
                            <span class="text-xs font-mono font-black text-white">{stats().sessionProgress.toFixed(1)}%</span>
                        </div>
                        <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <Motion.div
                                class="h-full bg-gradient-to-r from-blue-600 to-indigo-500"
                                animate={{ width: `${stats().sessionProgress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    </div>
                </Show>

                {/* Stat Grid */}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard label="Injection TPS" value={stats().tps.toFixed(1)} subValue={isRunning() ? "+Active" : "Ready"} icon={<Zap class="w-4 h-4" />} color="blue" />
                    <StatCard label="Session Payload" value={stats().totalTx.toLocaleString()} icon={<Database class="w-4 h-4" />} color="purple" />
                    <StatCard label="Network Latency" value="12ms" subValue="-2ms" icon={<Users class="w-4 h-4" />} color="emerald" />
                    <StatCard label="Session Uptime" value={stats().uptime} icon={<RefreshCw class={`w-4 h-4 ${isRunning() ? 'animate-spin' : ''}`} />} color="orange" />
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Live Traffic Feed */}
                    <div class="lg:col-span-8 space-y-8">
                        {/* Advanced Config Panel */}
                        <div class="bg-gradient-to-br from-blue-600/10 via-white/[0.02] to-transparent border border-white/10 rounded-[32px] p-8 shadow-2xl backdrop-blur-2xl">
                            <div class="flex items-center justify-between mb-8">
                                <div class="flex items-center gap-3">
                                    <div class="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                        <Settings class="w-5 h-5 text-blue-400" />
                                    </div>
                                    <h3 class="font-black italic text-sm tracking-tight text-white/90 uppercase">Deployment Parameters</h3>
                                </div>
                                <div class="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-widest">
                                    Sequencer Mode: Active
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div class="space-y-3">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <History class="w-3 h-3" /> Target Contract
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        value={targetContract()}
                                        onInput={(e) => setTargetContract(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-xs font-mono text-blue-400 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-white/10"
                                    />
                                </div>
                                <div class="space-y-3">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Zap class="w-3 h-3" /> Method Signature
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. swapTokens"
                                        value={customMethod()}
                                        onInput={(e) => setCustomMethod(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-xs font-mono text-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder:text-white/10"
                                    />
                                </div>
                                <div class="space-y-3">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                        <Shield class="w-3 h-3" /> Metadata Protocol
                                    </label>
                                    <select
                                        value={metadataType()}
                                        onChange={(e) => setMetadataType(e.currentTarget.value)}
                                        class="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3.5 text-xs font-black uppercase text-gray-300 focus:border-blue-500/50 outline-none appearance-none cursor-pointer hover:bg-black/60 transition-colors"
                                    >
                                        <option>A110 (Asset Transfer)</option>
                                        <option>S200 (Swap/Liquidity)</option>
                                        <option>B410 (Burn/Mint)</option>
                                        <option>R500 (Relay Message)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white/[0.02] border border-white/5 rounded-[40px] overflow-hidden backdrop-blur-3xl shadow-2xl">
                            <div class="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-500/5 to-transparent">
                                <div class="flex items-center gap-3">
                                    <Terminal class="w-5 h-5 text-blue-400" />
                                    <h3 class="font-black italic text-sm tracking-tight text-white/90 uppercase">Live Execution Feed</h3>
                                </div>
                                <div class="flex items-center gap-4">
                                    <div class="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                                        <div class={`w-2 h-2 rounded-full ${isRunning() ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                        <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            {isRunning() ? 'SYNCED' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="p-0 overflow-x-auto custom-scrollbar">
                                <table class="w-full text-left border-collapse">
                                    <thead>
                                        <tr class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5">
                                            <th class="px-10 py-6">Transaction ID</th>
                                            <th class="px-10 py-6">Protocol</th>
                                            <th class="px-10 py-6">Payload Routing</th>
                                            <th class="px-10 py-6 text-right">Magnitude</th>
                                            <th class="px-10 py-6 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={simLogs()} fallback={
                                            <tr>
                                                <td colspan="5" class="px-10 py-40 text-center">
                                                    <div class="flex flex-col items-center gap-6 opacity-20">
                                                        <Activity class="w-16 h-16 text-white" />
                                                        <p class="text-xs font-black text-white uppercase tracking-[0.3em] italic">No active session detected</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        }>
                                            {(tx) => (
                                                <tr
                                                    class="hover:bg-blue-500/[0.03] group transition-all duration-300 border-b border-white/5 last:border-0"
                                                >
                                                    <td class="px-10 py-5">
                                                        <div class="flex flex-col">
                                                            <span class="text-[11px] text-blue-400 font-black group-hover:text-blue-300 transition-colors uppercase font-mono">{tx.id}</span>
                                                            <span class="text-[8px] text-gray-600 font-bold uppercase mt-1">L2 Sequencer Block</span>
                                                        </div>
                                                    </td>
                                                    <td class="px-10 py-5">
                                                        <span class={`px-3 py-1 rounded-lg text-[9px] font-black border tracking-widest ${tx.type === 'S200' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                                                            tx.type === 'A110' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                            }`}>
                                                            {tx.type}
                                                        </span>
                                                    </td>
                                                    <td class="px-10 py-5">
                                                        <div class="flex items-center gap-3 text-[10px] font-bold">
                                                            <span class="text-white/30 font-mono">{(tx.from || '0x...').slice(0, 10)}...</span>
                                                            <ArrowUpRight class="w-3 h-3 text-blue-500 animate-bounce-short" />
                                                            <span class="text-white/60 font-mono">{(tx.to || '0x...').slice(0, 10)}...</span>
                                                        </div>
                                                    </td>
                                                    <td class="px-10 py-5 text-right font-mono">
                                                        <span class="text-[11px] font-black text-white">{tx.value}</span>
                                                    </td>
                                                    <td class="px-10 py-5 text-center">
                                                        <a
                                                            href={`${SCAN_URL}${tx.hash}`}
                                                            target="_blank"
                                                            class="inline-flex p-2 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-blue-600 hover:border-blue-500 transition-all duration-300"
                                                        >
                                                            <ExternalLink class="w-3.5 h-3.5" />
                                                        </a>
                                                    </td>
                                                </tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Settings & Network Health */}
                    <div class="lg:col-span-4 space-y-8">
                        <div class="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-50" />
                            <h3 class="font-black italic text-xs tracking-[0.2em] uppercase mb-10 flex items-center gap-3 text-white/50">
                                <Zap class="w-4 h-4 text-blue-400" />
                                Injection Intensity
                            </h3>

                            <div class="space-y-10">
                                <div class="space-y-6">
                                    <div class="flex justify-between items-center px-1">
                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Manual Override</span>
                                        <span class="text-sm font-black text-blue-400 font-mono">{tpsTarget().toLocaleString()} <span class="text-[9px] text-gray-600 uppercase">TPS</span></span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max="100000"
                                        step="1"
                                        value={tpsTarget()}
                                        onInput={(e) => handleTpsChange(parseInt(e.currentTarget.value))}
                                        class="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                                    />
                                    <div class="grid grid-cols-4 gap-3">
                                        <For each={['Low', 'Medium', 'High', 'Max']}>
                                            {(level) => (
                                                <button
                                                    onClick={() => setBurst(level)}
                                                    class={`py-2.5 rounded-xl text-[9px] font-black border transition-all duration-300 ${burstIntensity() === level
                                                        ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                                                        : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10 hover:border-white/10'
                                                        }`}
                                                >
                                                    {level}
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                <div class="space-y-5 pt-8 border-t border-white/5">
                                    <div class="space-y-5 pt-8 border-t border-white/5">
                                        <div
                                            onClick={() => setUseAccounting(!useAccounting())}
                                            class="flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] p-2 -m-2 rounded-xl transition-colors"
                                        >
                                            <div class="flex items-center gap-3">
                                                <div class={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${useAccounting() ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
                                                    <Shield class={`w-3.5 h-3.5 ${useAccounting() ? 'text-emerald-400' : 'text-gray-500'}`} />
                                                </div>
                                                <span class={`text-[10px] font-black uppercase tracking-widest italic ${useAccounting() ? 'text-gray-300' : 'text-gray-600'}`}>Accounting Metadata</span>
                                            </div>
                                            <div class={`w-8 h-4 rounded-full flex items-center transition-all px-1 ${useAccounting() ? 'bg-blue-600 justify-end' : 'bg-white/10 justify-start'}`}>
                                                <div class={`w-2 h-2 rounded-full ${useAccounting() ? 'bg-white' : 'bg-gray-600'}`} />
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => setUseCrossChain(!useCrossChain())}
                                            class="flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] p-2 -m-2 rounded-xl transition-colors"
                                        >
                                            <div class="flex items-center gap-3">
                                                <div class={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${useCrossChain() ? 'bg-purple-500/10 border-purple-500/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
                                                    <Globe class={`w-3.5 h-3.5 ${useCrossChain() ? 'text-purple-400' : 'text-gray-500'}`} />
                                                </div>
                                                <span class={`text-[10px] font-black uppercase tracking-widest italic ${useCrossChain() ? 'text-gray-300' : 'text-gray-600'}`}>Cross-Chain Route</span>
                                            </div>
                                            <div class={`w-8 h-4 rounded-full flex items-center transition-all px-1 ${useCrossChain() ? 'bg-blue-600 justify-end' : 'bg-white/10 justify-start'}`}>
                                                <div class={`w-2 h-2 rounded-full ${useCrossChain() ? 'bg-white' : 'bg-gray-600'}`} />
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => setUseZkProof(!useZkProof())}
                                            class="flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] p-2 -m-2 rounded-xl transition-colors"
                                        >
                                            <div class="flex items-center gap-3">
                                                <div class={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${useZkProof() ? 'bg-orange-500/10 border-orange-500/20' : 'bg-white/5 border-white/5 opacity-50'}`}>
                                                    <Cpu class={`w-3.5 h-3.5 ${useZkProof() ? 'text-orange-400' : 'text-gray-500'}`} />
                                                </div>
                                                <span class={`text-[10px] font-black uppercase tracking-widest italic ${useZkProof() ? 'text-gray-300' : 'text-gray-600'}`}>ZK-SNARK Proof</span>
                                            </div>
                                            <div class={`w-8 h-4 rounded-full flex items-center transition-all px-1 ${useZkProof() ? 'bg-blue-600 justify-end' : 'bg-white/10 justify-start'}`}>
                                                <div class={`w-2 h-2 rounded-full ${useZkProof() ? 'bg-white' : 'bg-gray-600'}`} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Node Health Status */}
                        <div class="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-[32px] p-8 backdrop-blur-2xl shadow-2xl">
                            <h4 class="text-sm font-black italic tracking-tight mb-8 flex items-center gap-3">
                                <BarChart3 class="w-5 h-5 text-blue-500" />
                                ENGINE LOAD ANALYSIS
                            </h4>
                            <div class="space-y-8">
                                <div>
                                    <div class="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
                                        <span>Cluster Load Factor</span>
                                        <span class="text-white">{Math.min(100, (isRunning() ? (tpsTarget() / 1000) : 0)).toFixed(1)}%</span>
                                    </div>
                                    <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                        <Motion.div
                                            class="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                            animate={{ width: `${Math.min(100, (isRunning() ? (tpsTarget() / 1000) : 0))}%` }}
                                        />
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-5 bg-white/[0.03] rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-colors">
                                        <span class="text-[9px] font-black text-gray-600 uppercase block mb-2 tracking-[0.2em]">Efficiency</span>
                                        <span class="text-sm font-black text-emerald-400 font-mono tracking-tighter">99.98%</span>
                                    </div>
                                    <div class="p-5 bg-white/[0.03] rounded-2xl border border-white/5 group hover:border-blue-500/30 transition-colors">
                                        <span class="text-[9px] font-black text-gray-600 uppercase block mb-2 tracking-[0.2em]">Reliability</span>
                                        <span class="text-sm font-black text-white font-mono tracking-tighter">HIGH-TC</span>
                                    </div>
                                </div>

                                <div class="px-5 py-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-center gap-3">
                                    <Info class="w-4 h-4 text-blue-400 shrink-0" />
                                    <p class="text-[9px] font-bold text-blue-400/80 uppercase leading-relaxed tracking-wider">
                                        Load is distributed across 5 consensus nodes using round-robin routing protocol.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(59, 130, 246, 0.4);
                }
                @keyframes bounce-short {
                    0%, 100% { transform: translate(0, 0); }
                    50% { transform: translate(2px, -2px); }
                }
                .animate-bounce-short {
                    animation: bounce-short 1s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}
