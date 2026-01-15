import { createSignal, For, Show, createMemo, onCleanup } from 'solid-js';
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
    Terminal
} from 'lucide-solid';
import LightSpeedBackground from './LightSpeedBackground';

// Types
interface SimStats {
    totalTx: number;
    activeWallets: number;
    tps: number;
    gasUsed: string;
    avgConfidence: number;
    uptime: string;
}

interface SimLog {
    id: string;
    type: string;
    from: string;
    to: string;
    value: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: number;
}

const StatCard = (props: { label: string; value: string | number; subValue?: string; icon: JSX.Element; color?: string }) => (
    <div class="bg-white/[0.02] border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
        <div class={`absolute top-0 right-0 w-32 h-32 bg-${props.color || 'blue'}-500/5 blur-[50px] -mr-16 -mt-16 group-hover:bg-${props.color || 'blue'}-500/10 transition-colors`} />
        <div class="relative z-10">
            <div class="flex items-center gap-3 text-gray-500 mb-4">
                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                    {props.icon}
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest italic">{props.label}</span>
            </div>
            <div class="flex items-baseline gap-2">
                <span class="text-3xl font-black text-white tracking-tighter">{props.value}</span>
                <Show when={props.subValue}>
                    <span class={`text-[10px] font-bold ${props.subValue?.startsWith('+') ? 'text-green-400' : 'text-blue-400'}`}>
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
    const [simLogs, setSimLogs] = createSignal<SimLog[]>([]);
    const [stats, setStats] = createSignal<SimStats>({
        totalTx: 0,
        activeWallets: 0,
        tps: 0,
        gasUsed: '0',
        avgConfidence: 99.8,
        uptime: '00:00:00'
    });

    // Timer refs
    let simInterval: any;
    let uptimeInterval: any;
    let startTime: number | null = null;

    const generateRandomTx = () => {
        const types = ['A110', 'S200', 'B410', 'R500', 'D600'];
        const status: ('success' | 'pending' | 'failed')[] = ['success', 'success', 'success', 'pending', 'failed'];

        return {
            id: '0x' + Math.random().toString(16).slice(2, 10) + '...',
            type: types[Math.floor(Math.random() * types.length)],
            from: '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(-4),
            to: '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(-4),
            value: (Math.random() * 1000).toFixed(2) + ' VCN',
            status: status[Math.floor(Math.random() * status.length)],
            timestamp: Date.now()
        };
    };

    const startSimulation = () => {
        setIsRunning(true);
        startTime = Date.now();

        simInterval = setInterval(() => {
            const newTxs = Array.from({ length: Math.ceil(tpsTarget() / 2) }, generateRandomTx);
            setSimLogs(prev => [...newTxs, ...prev].slice(0, 50));

            setStats(prev => ({
                ...prev,
                totalTx: prev.totalTx + newTxs.length,
                activeWallets: prev.activeWallets + (Math.random() > 0.8 ? 1 : 0),
                tps: tpsTarget() + (Math.random() * 2 - 1),
                gasUsed: (parseFloat(prev.gasUsed) + (newTxs.length * 0.0012)).toFixed(4)
            }));
        }, 1000);

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
    };

    onCleanup(() => {
        clearInterval(simInterval);
        clearInterval(uptimeInterval);
    });

    return (
        <div class="bg-black min-h-screen text-white pt-24 pb-32">
            <div class="absolute inset-0 opacity-20 pointer-events-none">
                <LightSpeedBackground />
            </div>

            <main class="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header Section */}
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                    <div>
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                <Activity class="w-6 h-6 animate-pulse" />
                            </div>
                            <div>
                                <h1 class="text-4xl font-black italic tracking-tighter">TRAFFIC SIMULATOR</h1>
                                <p class="text-blue-500 font-bold tracking-[0.3em] uppercase text-[9px] -mt-1">Automated Stress Testing Module</p>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-2xl">
                        <button
                            onClick={() => isRunning() ? stopSimulation() : startSimulation()}
                            class={`px-8 py-3 rounded-xl flex items-center gap-3 font-black text-xs uppercase tracking-widest transition-all ${isRunning()
                                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                                }`}
                        >
                            {isRunning() ? (
                                <><Square class="w-4 h-4 fill-white" /> Stop Simulation</>
                            ) : (
                                <><Play class="w-4 h-4 fill-white" /> Start Simulation</>
                            )}
                        </button>
                        <div class="w-px h-8 bg-white/10 mx-2" />
                        <div class="flex flex-col px-4">
                            <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Target TPS</span>
                            <div class="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    value={tpsTarget()}
                                    onInput={(e) => setTpsTarget(parseInt(e.currentTarget.value))}
                                    class="w-32 accent-blue-500"
                                />
                                <span class="text-xs font-black text-blue-400 font-mono w-8 text-right">{tpsTarget()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stat Grid */}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <StatCard label="Live Simulation TPS" value={stats().tps.toFixed(1)} subValue={isRunning() ? "+Live" : "Standby"} icon={<Zap class="w-4 h-4" />} color="blue" />
                    <StatCard label="Total Injected Tx" value={stats().totalTx.toLocaleString()} icon={<Database class="w-4 h-4" />} color="purple" />
                    <StatCard label="Active Simulation Wallets" value={stats().activeWallets} icon={<Users class="w-4 h-4" />} color="emerald" />
                    <StatCard label="Current Uptime" value={stats().uptime} icon={<RefreshCw class={`w-4 h-4 ${isRunning() ? 'animate-spin' : ''}`} />} color="orange" />
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Live Traffic Feed */}
                    <div class="lg:col-span-8 space-y-6">
                        {/* Advanced Config Panel (New) */}
                        <div class="bg-gradient-to-r from-blue-600/10 to-transparent border border-blue-500/20 rounded-[32px] p-8 mb-6">
                            <div class="flex items-center gap-3 mb-6">
                                <Settings class="w-5 h-5 text-blue-400" />
                                <h3 class="font-black italic text-sm tracking-tight text-white/90 uppercase">Developer Override (Custom Scenario)</h3>
                            </div>
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Target Contract Address</label>
                                    <input
                                        type="text"
                                        placeholder="0x..."
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-blue-400 focus:border-blue-500/50 outline-none"
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Custom Method Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. swapTokens"
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono text-white focus:border-blue-500/50 outline-none"
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Metadata Type (Accounting)</label>
                                    <select class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-black uppercase text-gray-400 focus:border-blue-500/50 outline-none">
                                        <option>A110 (Asset Transfer)</option>
                                        <option>S200 (Swap/Liquidity)</option>
                                        <option>B410 (Burn/Mint)</option>
                                        <option>Custom Override</option>
                                    </select>
                                </div>
                            </div>
                            <div class="mt-4 flex items-center gap-2 text-[10px] text-blue-500/70 italic">
                                <Info class="w-3 h-3" />
                                When configured, the generator will target these specific parameters instead of random production.
                            </div>
                        </div>

                        <div class="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden">
                            <div class="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-500/5 to-transparent">
                                <div class="flex items-center gap-3">
                                    <Terminal class="w-5 h-5 text-blue-400" />
                                    <h3 class="font-black italic text-sm tracking-tight text-white/90 uppercase">Traffic Distribution Feed</h3>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class={`w-2 h-2 rounded-full ${isRunning() ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                    <span class="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                        {isRunning() ? 'Injecting Packets' : 'Sim Paused'}
                                    </span>
                                </div>
                            </div>

                            <div class="p-0 max-h-[600px] overflow-y-auto font-mono custom-scrollbar">
                                <table class="w-full text-left">
                                    <thead class="sticky top-0 bg-[#0c0c0c] z-20">
                                        <tr class="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                            <th class="px-8 py-4">Tx Hash</th>
                                            <th class="px-8 py-4">Category</th>
                                            <th class="px-8 py-4">Routing Path</th>
                                            <th class="px-8 py-4 text-right">Value</th>
                                            <th class="px-8 py-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        <For each={simLogs()} fallback={
                                            <tr>
                                                <td colspan="5" class="px-8 py-32 text-center">
                                                    <div class="flex flex-col items-center gap-4">
                                                        <Activity class="w-12 h-12 text-white/5" />
                                                        <p class="text-xs font-black text-gray-600 uppercase tracking-widest italic">Initiate simulation to view live traffic</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        }>
                                            {(tx) => (
                                                <Motion.tr
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    class="hover:bg-white/[0.02] group transition-colors"
                                                >
                                                    <td class="px-8 py-4">
                                                        <span class="text-[11px] text-blue-400 font-bold group-hover:text-blue-300">{tx.id}</span>
                                                    </td>
                                                    <td class="px-8 py-4">
                                                        <span class={`px-2 py-0.5 rounded text-[10px] font-black border ${tx.type === 'S200' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                                                            tx.type === 'A110' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                                                                'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                            }`}>
                                                            {tx.type}
                                                        </span>
                                                    </td>
                                                    <td class="px-8 py-4">
                                                        <div class="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                                                            <span class="text-white/40">{tx.from}</span>
                                                            <ArrowUpRight class="w-3 h-3 text-blue-500/50" />
                                                            <span class="text-white/40">{tx.to}</span>
                                                        </div>
                                                    </td>
                                                    <td class="px-8 py-4 text-right text-[11px] font-black text-white">
                                                        {tx.value}
                                                    </td>
                                                    <td class="px-8 py-4">
                                                        <div class="flex items-center gap-2">
                                                            <div class={`w-1.5 h-1.5 rounded-full ${tx.status === 'success' ? 'bg-green-500' :
                                                                tx.status === 'pending' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                                                                }`} />
                                                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-500">{tx.status}</span>
                                                        </div>
                                                    </td>
                                                </Motion.tr>
                                            )}
                                        </For>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Settings & Network Health */}
                    <div class="lg:col-span-4 space-y-6">
                        <div class="bg-white/[0.02] border border-white/5 rounded-[32px] p-8">
                            <h3 class="font-black italic text-xs tracking-widest uppercase mb-8 flex items-center gap-2">
                                <Settings class="w-4 h-4 text-blue-400" />
                                Simulation Engine Config
                            </h3>

                            <div class="space-y-6">
                                <div class="space-y-3">
                                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest flex justify-between">
                                        <span>Traffic Burst Intensity</span>
                                        <span class="text-blue-400">Normal</span>
                                    </label>
                                    <div class="grid grid-cols-4 gap-2">
                                        <For each={['Low', 'Medium', 'High', 'Max']}>
                                            {(level) => (
                                                <button class={`py-2 rounded-lg text-[9px] font-black border transition-all ${level === 'Medium' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                                                    }`}>
                                                    {level}
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                <div class="space-y-4 pt-4 border-t border-white/5">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <Shield class="w-4 h-4 text-emerald-400" />
                                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-300 italic">Accounting Metadata</span>
                                        </div>
                                        <div class="w-8 h-4 bg-blue-600 rounded-full flex items-center justify-end px-1 cursor-pointer">
                                            <div class="w-2 h-2 bg-white rounded-full shadow-sm" />
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <Globe class="w-4 h-4 text-purple-400" />
                                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-300 italic">Cross-Chain Route</span>
                                        </div>
                                        <div class="w-8 h-4 bg-white/10 rounded-full flex items-center justify-start px-1 cursor-pointer">
                                            <div class="w-2 h-2 bg-gray-600 rounded-full" />
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <Cpu class="w-4 h-4 text-orange-400" />
                                            <span class="text-[10px] font-black uppercase tracking-widest text-gray-300 italic">ZK Proof Simulation</span>
                                        </div>
                                        <div class="w-8 h-4 bg-white/10 rounded-full flex items-center justify-start px-1 cursor-pointer">
                                            <div class="w-2 h-2 bg-gray-600 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Node Health Status */}
                        <div class="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-[32px] p-8">
                            <h4 class="text-sm font-black italic tracking-tight mb-4 flex items-center gap-2">
                                <BarChart3 class="w-4 h-4 text-blue-500" />
                                NETWORK PERFORMANCE
                            </h4>
                            <div class="space-y-6">
                                <div>
                                    <div class="flex justify-between text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">
                                        <span>Sequencer Load</span>
                                        <span class="text-white">{(isRunning() ? (tpsTarget() * 0.8) : 0).toFixed(1)}%</span>
                                    </div>
                                    <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div class="h-full bg-blue-500" style={{ width: `${isRunning() ? (tpsTarget() * 0.8) : 0}%` }} />
                                    </div>
                                </div>

                                <div class="grid grid-cols-2 gap-4">
                                    <div class="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                                        <span class="text-[9px] font-black text-gray-600 uppercase block mb-1">Latency</span>
                                        <span class="text-xs font-black text-emerald-400 font-mono">14ms</span>
                                    </div>
                                    <div class="p-4 bg-white/[0.03] rounded-2xl border border-white/5">
                                        <span class="text-[9px] font-black text-gray-600 uppercase block mb-1">Reliability</span>
                                        <span class="text-xs font-black text-white font-mono">100%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
