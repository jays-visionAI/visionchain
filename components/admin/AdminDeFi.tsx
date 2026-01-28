import { createSignal, createEffect, For, Show } from 'solid-js';
import {
    Zap,
    TrendingUp,
    Clock,
    AlertCircle,
    Settings,
    Save,
    PieChart,
    Activity,
    Shield,
    DollarSign,
    RefreshCw
} from 'lucide-solid';
import { getFirebaseDb, DefiConfig, getDefiConfig, updateDefiConfig } from '../../services/firebaseService';
import { collection, query, getDocs, limit, orderBy, doc, getDoc } from 'firebase/firestore';

export default function AdminDeFi() {
    const [config, setConfig] = createSignal<DefiConfig | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);

    // Form States
    const [apr, setApr] = createSignal(12.5);
    const [unbonding, setUnbonding] = createSignal(14);
    const [instantFee, setInstantFee] = createSignal(3.0);
    const [minStaking, setMinStaking] = createSignal(100);
    const [protocolFee, setProtocolFee] = createSignal(5.0);
    const [exchangeRate, setExchangeRate] = createSignal(1.0);

    const fetchData = async () => {
        setLoading(true);
        try {
            const cfg = await getDefiConfig();
            setConfig(cfg);
            setApr(cfg.stakingApr);
            setUnbonding(cfg.unbondingDays);
            setInstantFee(cfg.instantUnstakeFee);
            setMinStaking(cfg.minStakingAmount);
            setProtocolFee(cfg.protocolFee);
            setExchangeRate(cfg.sVcnExchangeRate);
        } catch (e) {
            console.error("Failed to fetch De-Fi data:", e);
        } finally {
            setLoading(false);
        }
    };

    createEffect(() => {
        fetchData();
    });

    const handleUpdate = async () => {
        setIsSaving(true);
        try {
            const newCfg: Partial<DefiConfig> = {
                stakingApr: apr(),
                unbondingDays: unbonding(),
                instantUnstakeFee: instantFee(),
                minStakingAmount: minStaking(),
                protocolFee: protocolFee(),
                sVcnExchangeRate: exchangeRate()
            };
            await updateDefiConfig(newCfg);
            alert("De-Fi configuration updated successfully!");
            await fetchData();
        } catch (e) {
            alert("Failed to update De-Fi config");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div class="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 class="text-3xl font-black text-white tracking-tight mb-2 uppercase italic flex items-center gap-3">
                        <Zap class="w-8 h-8 text-yellow-400" />
                        De-Fi <span class="text-yellow-400">Management</span>
                    </h2>
                    <p class="text-gray-500 font-medium">Configure liquid staking parameters and monitor protocol health</p>
                </div>
                <button
                    onClick={fetchData}
                    class="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 transition-all group"
                >
                    <RefreshCw class={`w-5 h-5 text-gray-400 group-hover:text-white transition-all ${loading() ? 'animate-spin' : ''}`} />
                    <span class="font-bold text-sm">Sync Metrics</span>
                </button>
            </div>

            {/* Metrics Dashboard */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-yellow-500">
                        <PieChart class="w-16 h-16" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Total VCN Locked</div>
                    <div class="text-3xl font-black text-white mb-2">{(config()?.totalVcnLocked || 0).toLocaleString()} VCN</div>
                    <div class="text-sm font-medium text-yellow-400/80 italic">TVL Maturity: Stable</div>
                </div>

                <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-cyan-500">
                        <Activity class="w-16 h-16" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">sVCN Issued</div>
                    <div class="text-3xl font-black text-white mb-2">{(config()?.totalSVcnIssued || 0).toLocaleString()} sVCN</div>
                    <div class="text-sm font-medium text-cyan-400/80 italic">Liquid Supply Factor</div>
                </div>

                <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-green-500">
                        <TrendingUp class="w-16 h-16" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Current Exchange Rate</div>
                    <div class="text-3xl font-black text-white mb-2">1:{exchangeRate().toFixed(4)}</div>
                    <div class="text-sm font-medium text-green-400/80 italic">sVCN / VCN Ratio</div>
                </div>

                <div class="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 border border-yellow-500/20 rounded-[32px] p-8 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                        <DollarSign class="w-16 h-16 text-yellow-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Current APR</div>
                    <div class="text-3xl font-black text-white mb-2">{apr()}%</div>
                    <div class="text-sm font-medium text-white/50 italic">Compounding Active</div>
                </div>
            </div>

            {/* Configuration Form */}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 space-y-6">
                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-10 shadow-2xl">
                        <div class="flex items-center gap-4 mb-10">
                            <div class="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                <Settings class="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <h3 class="text-xl font-black text-white italic tracking-tight uppercase">Protocol <span class="text-yellow-400">Parameters</span></h3>
                                <p class="text-gray-500 text-xs font-medium">Admin-level overrides for staking mechanics</p>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* APR Setting */}
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Global Staking APR (%)</label>
                                <div class="relative group">
                                    <input
                                        type="number" step="0.1" value={apr()}
                                        onInput={(e) => setApr(parseFloat(e.currentTarget.value))}
                                        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                                    />
                                    <div class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">%</div>
                                </div>
                            </div>

                            {/* Unbonding Setting */}
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Unbonding Period (Days)</label>
                                <div class="relative">
                                    <input
                                        type="number" value={unbonding()}
                                        onInput={(e) => setUnbonding(parseInt(e.currentTarget.value))}
                                        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                                    />
                                    <Clock class="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-700" />
                                </div>
                            </div>

                            {/* Instant Exit Fee */}
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Instant Exit Fee (%)</label>
                                <div class="relative">
                                    <input
                                        type="number" step="0.1" value={instantFee()}
                                        onInput={(e) => setInstantFee(parseFloat(e.currentTarget.value))}
                                        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-red-400 outline-none focus:border-red-500/50 transition-all font-mono"
                                    />
                                    <div class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">%</div>
                                </div>
                            </div>

                            {/* Min Staking */}
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Min Staking Amount</label>
                                <div class="relative">
                                    <input
                                        type="number" value={minStaking()}
                                        onInput={(e) => setMinStaking(parseInt(e.currentTarget.value))}
                                        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                                    />
                                    <div class="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">VCN</div>
                                </div>
                            </div>

                            {/* Exchange Rate (Simulated Admin Override) */}
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Manual Exchange Rate Override</label>
                                <div class="relative">
                                    <input
                                        type="number" step="0.0001" value={exchangeRate()}
                                        onInput={(e) => setExchangeRate(parseFloat(e.currentTarget.value))}
                                        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-cyan-400 outline-none focus:border-cyan-500/50 transition-all font-mono"
                                    />
                                    <RefreshCw class="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-700" />
                                </div>
                            </div>

                            {/* Protocol Fee */}
                            <div class="space-y-3">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Protocol Yield Fee (%)</label>
                                <div class="relative">
                                    <input
                                        type="number" step="0.1" value={protocolFee()}
                                        onInput={(e) => setProtocolFee(parseFloat(e.currentTarget.value))}
                                        class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-orange-400 outline-none focus:border-orange-500/50 transition-all font-mono"
                                    />
                                    <Shield class="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-700" />
                                </div>
                            </div>
                        </div>

                        <div class="mt-12 flex items-center justify-between p-6 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                            <div class="flex items-center gap-4">
                                <AlertCircle class="w-6 h-6 text-yellow-500" />
                                <div class="text-xs font-medium text-gray-400">Updating these parameters will affect new and existing staking positions protocol-wide.</div>
                            </div>
                            <button
                                onClick={handleUpdate}
                                disabled={isSaving()}
                                class="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-black rounded-xl shadow-xl shadow-yellow-500/20 transition-all uppercase tracking-widest text-[11px] flex items-center gap-3"
                            >
                                <Show when={isSaving()} fallback={<><Save class="w-4 h-4" /> Save changes</>}>
                                    <RefreshCw class="w-4 h-4 animate-spin" /> Updating...
                                </Show>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Panel */}
                <div class="space-y-6">
                    <div class="bg-gradient-to-br from-gray-900 to-black border border-white/5 rounded-[32px] p-8 shadow-2xl">
                        <h4 class="text-lg font-black text-white italic mb-6 uppercase tracking-tighter">System <span class="text-yellow-400">Integrity</span></h4>
                        <div class="space-y-6">
                            <div class="flex items-start gap-4">
                                <div class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                    <Shield class="w-4 h-4 text-green-400" />
                                </div>
                                <div>
                                    <div class="text-[11px] font-black text-white uppercase tracking-wider mb-1">sVCN Value Guard</div>
                                    <p class="text-[10px] text-gray-500 leading-relaxed font-medium">The exchange rate is protected by a 1:1 floor. It can never drop below 1.0 even if yields stabilize.</p>
                                </div>
                            </div>
                            <div class="flex items-start gap-4">
                                <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                    <PieChart class="w-4 h-4 text-blue-400" />
                                </div>
                                <div>
                                    <div class="text-[11px] font-black text-white uppercase tracking-wider mb-1">Liquid Staking Yield</div>
                                    <p class="text-[10px] text-gray-500 leading-relaxed font-medium">Rewards are distributed daily via sVCN value appreciation rather than token quantity increase.</p>
                                </div>
                            </div>
                            <div class="flex items-start gap-4">
                                <div class="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                                    <Clock class="w-4 h-4 text-red-400" />
                                </div>
                                <div>
                                    <div class="text-[11px] font-black text-white uppercase tracking-wider mb-1">Exit Liquidity Buffer</div>
                                    <p class="text-[10px] text-gray-500 leading-relaxed font-medium">Instant exit fees are funneled back into the staking reward pool to benefit long-term holders.</p>
                                </div>
                            </div>
                        </div>

                        <div class="mt-8 pt-8 border-t border-white/5">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-[10px] font-black text-gray-600 uppercase">Operational Status</span>
                                <span class="flex items-center gap-1.5 text-[10px] font-black text-green-400 uppercase">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Nominal
                                </span>
                            </div>
                            <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div class="w-[98%] h-full bg-green-400/50" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
