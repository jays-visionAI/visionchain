import { createSignal, Show, onMount, createEffect } from 'solid-js';
import {
    Sparkles,
    Zap,
    MessageSquare,
    Globe,
    ChevronRight,
    Shield,
    Cpu,
    Coins,
    RefreshCw,
    TrendingUp,
    Activity,
} from 'lucide-solid';
import { getVcnPrice, getVcnPriceSettings, updateVcnPriceSettings, getVcnPriceHistory, initPriceService } from '../../services/vcnPriceService';
import AdminAIManagement from './AdminAIManagement';
import { contractService } from '../../services/contractService';

export default function AdminSettings() {
    const [settingsSubView, setSettingsSubView] = createSignal<'main' | 'ai' | 'infra' | 'gov'>('main');
    const [nodeStats, setNodeStats] = createSignal({ active: 0, total: 5, loading: true });

    const refreshNodeStats = async () => {
        setNodeStats(prev => ({ ...prev, loading: true }));
        try {
            const stats = await contractService.getNodeStatus();
            setNodeStats({ active: stats.active, total: stats.total, loading: false });
        } catch (e) {
            console.error("Failed to refresh nodes:", e);
            setNodeStats(prev => ({ ...prev, loading: false }));
        }
    };

    const [priceInput, setPriceInput] = createSignal({
        min: '0',
        max: '0',
        period: '60',
        range: '5'
    });
    const [isSavingPrice, setIsSavingPrice] = createSignal(false);
    const [priceSaveStatus, setPriceSaveStatus] = createSignal<'idle' | 'success' | 'error'>('idle');

    const PriceChart = () => {
        const history = getVcnPriceHistory();
        if (history.length < 2) return <div class="h-20 flex items-center justify-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">Collecting Fibonacci Data...</div>;

        const min = Math.min(...history);
        const max = Math.max(...history);
        const range = Math.max(0.0001, max - min);

        const points = history.map((p, i) => {
            const x = (i / (history.length - 1)) * 100;
            const y = 100 - ((p - min) / range) * 100;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div class="h-32 w-full relative mt-4 bg-black/20 rounded-xl overflow-hidden border border-white/5">
                <div class="absolute inset-x-0 top-0 h-[1px] bg-white/5" />
                <div class="absolute inset-x-0 bottom-0 h-[1px] bg-white/5" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="w-full h-full">
                    <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#10b981" stop-opacity="0.3" />
                            <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
                        </linearGradient>
                    </defs>
                    <path
                        d={`M 0 100 L ${points} L 100 100 Z`}
                        fill="url(#priceGradient)"
                    />
                    <polyline
                        fill="none"
                        stroke="#10b981"
                        stroke-width="1"
                        points={points}
                        stroke-linejoin="round"
                    />
                </svg>
                {/* Horizontal grid lines for aesthetics */}
                <div class="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div class="h-px bg-white/10 w-full" />
                    <div class="h-px bg-white/10 w-full" />
                    <div class="h-px bg-white/10 w-full" />
                    <div class="h-px bg-white/10 w-full" />
                </div>
            </div>
        );
    };

    onMount(() => {
        initPriceService();
        refreshNodeStats();

        // Polling nodes every 30s
        const interval = setInterval(refreshNodeStats, 30000);
        return () => clearInterval(interval);
    });

    // Automatically sync Firebase settings to input fields when they load/change
    createEffect(() => {
        const settings = getVcnPriceSettings();
        // We only auto-fill if the user has not interacted with the fields yet (or when Firebase updates)
        // To keep it simple and reliable, we sync whenever the settings signal changes
        setPriceInput({
            min: settings.minPrice.toString(),
            max: settings.maxPrice.toString(),
            period: settings.volatilityPeriod?.toString() || '60',
            range: settings.volatilityRange?.toString() || '5'
        });
    });

    const handleUpdatePriceRange = async () => {
        const min = parseFloat(priceInput().min.replace(',', '.'));
        const max = parseFloat(priceInput().max.replace(',', '.'));
        const period = parseInt(priceInput().period);
        const rangePerc = parseFloat(priceInput().range);

        if (isNaN(min) || isNaN(max) || isNaN(period) || isNaN(rangePerc)) {
            setPriceSaveStatus('error');
            setTimeout(() => setPriceSaveStatus('idle'), 3000);
            return;
        }

        setIsSavingPrice(true);
        setPriceSaveStatus('idle');
        try {
            await updateVcnPriceSettings({
                minPrice: min,
                maxPrice: max,
                volatilityPeriod: period,
                volatilityRange: rangePerc
            });
            setPriceSaveStatus('success');
            setTimeout(() => setPriceSaveStatus('idle'), 3000);
        } catch (e) {
            console.error('Failed to update VCN price settings:', e);
            setPriceSaveStatus('error');
            setTimeout(() => setPriceSaveStatus('idle'), 3000);
        } finally {
            setIsSavingPrice(false);
        }
    };

    return (
        <div class="max-w-4xl mx-auto pb-20">
            <Show when={settingsSubView() === 'main'}>
                <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div class="mb-8">
                        <h1 class="text-3xl font-bold text-white tracking-tight">Admin Console</h1>
                        <p class="text-gray-400 mt-1">Global node configuration and system-wide intelligence settings.</p>
                    </div>

                    <div class="space-y-6">
                        {/* Section 1: Intelligence */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Intelligence & AI</h2>
                            <div class="grid gap-3">
                                {/* AI Management Card */}
                                <div
                                    onClick={() => setSettingsSubView('ai')}
                                    class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.08] hover:border-indigo-500/30 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div class="flex items-center justify-between relative z-10">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                                                <Sparkles class="w-6 h-6 group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div>
                                                <div class="font-bold text-white group-hover:text-indigo-300 transition-colors">AI Engine Management</div>
                                                <div class="text-xs text-gray-500 mt-0.5">Dual-bot config, API keys, and knowledge systems</div>
                                            </div>
                                        </div>
                                        <ChevronRight class="w-5 h-5 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Infrastructure */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Infrastructure & Network</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center justify-between mb-4">
                                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                            <Cpu class={`w-5 h-5 ${nodeStats().loading ? 'animate-pulse' : ''}`} />
                                        </div>
                                        <div class="font-bold text-white flex items-center gap-2">
                                            RPC Node Pool
                                            <button
                                                onClick={(e) => { e.stopPropagation(); refreshNodeStats(); }}
                                                class="p-1 hover:bg-white/10 rounded-md transition-colors"
                                            >
                                                <RefreshCw class={`w-3 h-3 text-gray-500 ${nodeStats().loading ? 'animate-spin' : ''}`} />
                                            </button>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">
                                            {nodeStats().loading ? 'Checking nodes...' : `${nodeStats().active} of ${nodeStats().total} Active Nodes`}
                                        </span>
                                        <span class={`text-[10px] px-2 py-0.5 rounded-full font-bold ${nodeStats().active === nodeStats().total ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {nodeStats().active === nodeStats().total ? 'Optimal' : (nodeStats().active > 0 ? 'Degraded' : 'Offline')}
                                        </span>
                                    </div>
                                </div>

                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80 relative">
                                    <div class="flex items-center gap-4 mb-4">
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <Globe class="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div class="font-bold text-white">Relayer Config</div>
                                            <div class="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Gasless Sponsorship</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-slate-500 italic">Facilitates Tx without User Gas</span>
                                        <div class="w-10 h-5 bg-blue-500/20 rounded-full flex items-center px-1">
                                            <div class="w-3 h-3 bg-blue-400 rounded-full ml-auto" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Deployed Contracts Reference */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Deployed Contracts</h2>
                            <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 overflow-hidden">
                                <div class="flex items-center gap-4 mb-4">
                                    <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                        <Shield class="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div class="font-bold text-white">Vision Chain Testnet</div>
                                        <div class="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Chain ID: 1337</div>
                                    </div>
                                </div>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-sm">
                                        <thead>
                                            <tr class="border-b border-white/5">
                                                <th class="text-left py-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">Contract</th>
                                                <th class="text-left py-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">Address</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/5">
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">VCN Token</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0x5FbDB2315678afecb367f032d93F642f64180aa3</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">Node License</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">Mining Pool</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">VCN Vesting</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">Vision Equalizer</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0x610178dA211FEF7D417bC0e6FeD39F05609AD788</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">VCN Paymaster</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">Time Lock Agent</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb</td>
                                            </tr>
                                            <tr class="hover:bg-white/[0.02]">
                                                <td class="py-2.5 px-3 font-bold text-white">Profile Registry</td>
                                                <td class="py-2.5 px-3 font-mono text-xs text-cyan-400 select-all">0x3Aa5ebB10DC797CAC828524e59A333d0A371443c</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Section 4: Ecosystem */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Ecosystem & Governance</h2>
                            <div class="grid gap-3">
                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                                                <Coins class="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">Tokenomics & Vesting</div>
                                                <div class="text-xs text-gray-500">Manage reward curves and lockup periods</div>
                                            </div>
                                        </div>
                                        <ChevronRight class="w-5 h-5 text-gray-700" />
                                    </div>
                                </div>

                                {/* VCN Price Management (Admin Live) */}
                                <div class="bg-[#15151a] border border-blue-500/20 rounded-2xl p-6 shadow-2xl">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                                <TrendingUp class="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 class="font-bold text-white">VCN Price Management</h3>
                                                <p class="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-1">Live Volatility Engine</p>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="flex items-center justify-end gap-2 mb-1">
                                                <span class="relative flex h-2 w-2">
                                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                    <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                </span>
                                                <div class="text-[9px] font-black text-blue-500 uppercase tracking-widest">Live Price (1s Refresh)</div>
                                            </div>
                                            <div class="text-2xl font-black text-white tracking-tighter tabular-nums transition-all duration-300">
                                                ${getVcnPrice().toFixed(4)}
                                            </div>
                                        </div>
                                    </div>

                                    <PriceChart />

                                    <div class="grid grid-cols-2 gap-4 my-6">
                                        <div>
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Min Price (USD)</label>
                                            <input
                                                type="text"
                                                inputmode="decimal"
                                                value={priceInput().min}
                                                onInput={(e) => setPriceInput({ ...priceInput(), min: e.currentTarget.value })}
                                                class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                                placeholder="0.0000"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Max Price (USD)</label>
                                            <input
                                                type="text"
                                                inputmode="decimal"
                                                value={priceInput().max}
                                                onInput={(e) => setPriceInput({ ...priceInput(), max: e.currentTarget.value })}
                                                class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                                placeholder="0.0000"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Volatility Period (Sec)</label>
                                            <input
                                                type="number"
                                                value={priceInput().period}
                                                onInput={(e) => setPriceInput({ ...priceInput(), period: e.currentTarget.value })}
                                                class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                                placeholder="60"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">Max Deviation Range (%)</label>
                                            <input
                                                type="text"
                                                inputmode="decimal"
                                                value={priceInput().range}
                                                onInput={(e) => setPriceInput({ ...priceInput(), range: e.currentTarget.value })}
                                                class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50"
                                                placeholder="5.00"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleUpdatePriceRange}
                                        disabled={isSavingPrice()}
                                        class={`w-full py-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${priceSaveStatus() === 'success'
                                            ? 'bg-green-600 shadow-green-600/20'
                                            : priceSaveStatus() === 'error'
                                                ? 'bg-red-600 shadow-red-600/20'
                                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                                            } text-white disabled:opacity-50`}
                                    >
                                        <Show when={isSavingPrice()}>
                                            <RefreshCw class="w-4 h-4 animate-spin" />
                                        </Show>
                                        {priceSaveStatus() === 'success'
                                            ? 'Saved Successfully!'
                                            : priceSaveStatus() === 'error'
                                                ? 'Error - Check Values'
                                                : isSavingPrice()
                                                    ? 'Saving...'
                                                    : 'Update Volatility Bounds'}
                                    </button>
                                </div>

                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                                                <MessageSquare class="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">System Broadcasts</div>
                                                <div class="text-xs text-gray-500">Push high-priority alerts to all users</div>
                                            </div>
                                        </div>
                                        <div class="w-10 h-5 bg-white/5 rounded-full flex items-center px-1">
                                            <div class="w-3 h-3 bg-gray-600 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            <Show when={settingsSubView() === 'ai'}>
                <div class="animate-in fade-in slide-in-from-right-4 duration-500">
                    <button
                        onClick={() => setSettingsSubView('main')}
                        class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                            <ChevronRight class="w-4 h-4 rotate-180" />
                        </div>
                        <span class="font-bold text-sm">Back to Admin Console</span>
                    </button>
                    <AdminAIManagement />
                </div>
            </Show>
        </div>
    );
}

