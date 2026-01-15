import { createSignal, onMount, For, Show } from 'solid-js';
import {
    Activity,
    Play,
    Square,
    Settings,
    Zap,
    Database,
    ShieldCheck,
    AlertCircle,
    Wallet,
    History,
    RefreshCw,
    Terminal
} from 'lucide-solid';

export default function AdminTraffic() {
    const [botStatus, setBotStatus] = createSignal<'running' | 'stopped' | 'error'>('stopped');
    const [faucetBalance, setFaucetBalance] = createSignal('1,240.50 VCN');
    const [lastRefill, setLastRefill] = createSignal('2 hours ago');
    const [isUpdating, setIsUpdating] = createSignal(false);

    const stats = [
        { label: 'Avg. Ingestion Rate', value: '42.5 tx/min', icon: Zap, color: 'text-blue-500' },
        { label: 'Total Simulated Volume', value: '85,420 VCN', icon: Database, color: 'text-purple-500' },
        { label: 'Validation Success', value: '99.98%', icon: ShieldCheck, color: 'text-emerald-500' },
        { label: 'Error Rate', value: '0.02%', icon: AlertCircle, color: 'text-red-500' },
    ];

    const toggleBot = () => {
        setIsUpdating(true);
        setTimeout(() => {
            setBotStatus(prev => prev === 'running' ? 'stopped' : 'running');
            setIsUpdating(false);
        }, 1500);
    };

    return (
        <div class="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 class="text-3xl font-black text-white italic tracking-tighter uppercase">Traffic Simulation HQ</h1>
                    <p class="text-gray-500 text-sm font-medium tracking-wide">Manage background traffic bots and testnet stress parameters.</p>
                </div>

                <div class="flex items-center gap-4">
                    <button
                        onClick={toggleBot}
                        disabled={isUpdating()}
                        class={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all ${botStatus() === 'running'
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white'
                                : 'bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white'
                            }`}
                    >
                        <Show when={isUpdating()}>
                            <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                        </Show>
                        <Show when={!isUpdating()}>
                            {botStatus() === 'running' ? <Square class="w-3.5 h-3.5" /> : <Play class="w-3.5 h-3.5" />}
                        </Show>
                        {botStatus() === 'running' ? 'Kill Bot Service' : 'Spawn Traffic Bot'}
                    </button>
                    <div class="w-px h-8 bg-white/5" />
                    <div class="flex flex-col text-right">
                        <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Global Status</span>
                        <div class="flex items-center gap-2 justify-end">
                            <div class={`w-2 h-2 rounded-full ${botStatus() === 'running' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                            <span class="text-xs font-black text-white uppercase tracking-widest">{botStatus()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <For each={stats}>
                    {(stat) => (
                        <div class="bg-white/[0.02] border border-white/5 p-6 rounded-2xl hover:border-white/10 transition-colors group">
                            <div class="flex items-center gap-3 mb-4">
                                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                                    <stat.icon class="w-5 h-5" />
                                </div>
                                <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <div class={`text-2xl font-black italic tracking-tighter ${stat.color}`}>
                                {stat.value}
                            </div>
                        </div>
                    )}
                </For>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Configuration */}
                <div class="lg:col-span-4 space-y-6">
                    <div class="bg-white/[0.02] border border-white/5 rounded-3xl p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-[50px] -mr-16 -mt-16" />

                        <div class="relative z-10">
                            <h3 class="font-black italic text-xs tracking-widest uppercase mb-8 flex items-center gap-2">
                                <Wallet class="w-4 h-4 text-blue-500" />
                                Master Faucet Control
                            </h3>

                            <div class="space-y-6">
                                <div>
                                    <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-2">Available Balance</span>
                                    <div class="text-3xl font-black text-white italic tracking-tighter">{faucetBalance()}</div>
                                </div>

                                <div class="p-4 bg-white/5 rounded-xl border border-white/5 flex justify-between items-center">
                                    <div class="flex flex-col">
                                        <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Last Activity</span>
                                        <span class="text-xs font-bold text-blue-400 italic">{lastRefill()}</span>
                                    </div>
                                    <button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                                        Manual Refill
                                    </button>
                                </div>

                                <div class="pt-4 border-t border-white/5">
                                    <div class="flex items-center justify-between mb-4">
                                        <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Auto-Refill Mode</span>
                                        <div class="w-8 h-4 bg-blue-600 rounded-full flex items-center justify-end px-1">
                                            <div class="w-2 h-2 bg-white rounded-full" />
                                        </div>
                                    </div>
                                    <p class="text-[10px] text-gray-500 font-medium leading-relaxed italic">
                                        Automatically tops up simulation wallets when balance falls below 0.01 VCN.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                        <h3 class="font-black italic text-xs tracking-widest uppercase mb-8 flex items-center gap-2">
                            <Settings class="w-4 h-4 text-purple-400" />
                            Engine Parameters
                        </h3>

                        <div class="space-y-6">
                            <div class="space-y-2">
                                <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Global Throttle (%)</label>
                                <input type="range" class="w-full accent-purple-500 bg-white/5" />
                            </div>

                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Accounting Sim</span>
                                    <div class="w-8 h-4 bg-blue-600 rounded-full flex items-center justify-end px-1">
                                        <div class="w-2 h-2 bg-white rounded-full" />
                                    </div>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Relap Pathing</span>
                                    <div class="w-8 h-4 bg-white/10 rounded-full flex items-center justify-start px-1">
                                        <div class="w-2 h-2 bg-gray-600 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: History & Logs */}
                <div class="lg:col-span-8 flex flex-col gap-6">
                    <div class="bg-white/[0.02] border border-white/5 rounded-3xl flex-1 overflow-hidden">
                        <div class="p-8 border-b border-white/5 flex justify-between items-center">
                            <div class="flex items-center gap-3">
                                <History class="w-5 h-5 text-blue-500" />
                                <h3 class="font-black italic text-sm tracking-tight text-white uppercase">Simulation Sessions</h3>
                            </div>
                            <button class="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300">View Archive</button>
                        </div>

                        <div class="p-0">
                            <table class="w-full text-left">
                                <thead class="bg-white/5">
                                    <tr class="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                        <th class="px-8 py-4">Session ID</th>
                                        <th class="px-8 py-4">Status</th>
                                        <th class="px-8 py-4">Duration</th>
                                        <th class="px-8 py-4">TX Count</th>
                                        <th class="px-8 py-4 text-right">Resource Usage</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/5">
                                    <For each={[
                                        { id: 'SESS-202401', status: 'Completed', duration: '24:00:00', tx: '1.2M', cpu: '14%' },
                                        { id: 'SESS-202402', status: 'Active', duration: '08:42:12', tx: '450K', cpu: '22%' },
                                        { id: 'SESS-202403', status: 'Stopped', duration: '01:15:30', tx: '12K', cpu: '0%' },
                                    ]}>
                                        {(session) => (
                                            <tr class="hover:bg-white/[0.03] transition-colors border-l-2 border-transparent hover:border-blue-500 group">
                                                <td class="px-8 py-4 font-mono text-[10px] text-blue-400 font-black">{session.id}</td>
                                                <td class="px-8 py-4">
                                                    <span class={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${session.status === 'Active' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-gray-500/10 border-white/5 text-gray-500'
                                                        }`}>
                                                        {session.status}
                                                    </span>
                                                </td>
                                                <td class="px-8 py-4 text-xs font-bold text-gray-400">{session.duration}</td>
                                                <td class="px-8 py-4 text-xs font-bold text-white italic">{session.tx}</td>
                                                <td class="px-8 py-4 text-right text-xs font-mono text-blue-500/60 font-black">{session.cpu}</td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="bg-black/40 border border-white/10 rounded-2xl p-6 font-mono text-[11px] h-48 overflow-y-auto custom-scrollbar">
                        <div class="flex items-center gap-2 mb-3 text-white/40">
                            <Terminal class="w-3.5 h-3.5" />
                            <span class="font-black uppercase tracking-[0.2em]">Live System Journal</span>
                        </div>
                        <div class="space-y-1.5">
                            <div class="text-blue-500/60">[09:12:44] <span class="text-white/60">INIT: Loading shared-sequencer module...</span></div>
                            <div class="text-emerald-500/60">[09:12:45] <span class="text-white/60">DB: Connected to sequencer.db (SQLite3)</span></div>
                            <div class="text-purple-500/60">[09:12:46] <span class="text-white/60">RPC: Master Faucet connected (Address: 0xac09...f2ff)</span></div>
                            <div class="text-blue-500/60">[09:13:02] <span class="text-white/60">BOT: Spawning batch worker #4...</span></div>
                            <div class="text-amber-500/60">[09:13:05] <span class="text-white/60">WARN: Network jitter detected (142ms)</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
