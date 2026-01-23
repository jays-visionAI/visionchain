import { For, Show } from 'solid-js';
import { Camera, Check, Plus } from 'lucide-solid';

interface WalletNodesProps {
    userNodes: any[];
    claimNodeRewards: () => void;
    purchaseNode: (tier: string) => void;
}

// Constants for Pricing
const VCN_PRICE = 0.375;
const VALIDATOR_PRICE_USD = 10000;
const ENTERPRISE_PRICE_USD = 100000;

export const WalletNodes = (props: WalletNodesProps) => {
    // Dynamic Price Calculation
    const validatorPriceVCN = Math.ceil(VALIDATOR_PRICE_USD / VCN_PRICE);
    const enterprisePriceVCN = Math.ceil(ENTERPRISE_PRICE_USD / VCN_PRICE);

    return (
        <div class="flex-1 overflow-y-auto relative h-full">
            {/* Decorative Background Blur */}
            <div class="absolute top-0 right-[25%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

            <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20 relative">

                {/* Header Section */}
                <div class="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
                    <div class="flex items-center gap-6">
                        <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20 group animate-in slide-in-from-left duration-700">
                            <Camera class="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div>
                            <h2 class="text-4xl font-bold text-white tracking-tight mb-2">Compute Nodes</h2>
                            <p class="text-gray-500 font-medium">Manage your decentralized infrastructure fleet</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="px-5 py-3 bg-[#111113] border border-white/10 rounded-2xl flex items-center gap-3">
                            <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span class="text-sm font-bold text-emerald-400">Network Optimal</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-10">
                    {/* Active Nodes List */}
                    <div class="space-y-4">
                        <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Your Fleet</h3>
                        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            <For each={props.userNodes}>
                                {(node) => (
                                    <div class="group bg-[#111113] border border-white/[0.06] hover:border-emerald-500/30 rounded-[32px] p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 relative overflow-hidden">
                                        <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <div class="relative z-10 space-y-6">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/5">
                                                        <div class={`w-2 h-2 rounded-full ${node.status === 'Running' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                                    </div>
                                                    <div>
                                                        <h4 class="font-bold text-white">{node.type} Node</h4>
                                                        <div class="text-[10px] text-gray-500 font-mono uppercase">{node.id}</div>
                                                    </div>
                                                </div>
                                                <span class={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${node.status === 'Running' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                                    {node.status}
                                                </span>
                                            </div>

                                            <div class="grid grid-cols-2 gap-4">
                                                <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Daily Reward</div>
                                                    <div class="text-lg font-bold text-white">+{node.dailyReward} VCN</div>
                                                </div>
                                                <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                    <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Uptime</div>
                                                    <div class="text-lg font-bold text-white">{node.uptime}</div>
                                                </div>
                                            </div>

                                            <div class="flex gap-3">
                                                <button
                                                    onClick={props.claimNodeRewards}
                                                    class="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                                    Claim Rewards
                                                </button>
                                                <button class="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5">
                                                    Manage
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar for daily epoch */}
                                        <div class="h-1 bg-white/5 w-full">
                                            <div class="h-full bg-emerald-500 w-[75%]" />
                                        </div>
                                    </div>
                                )}
                            </For>

                            {/* Purchase New License CTA */}
                            <div
                                onClick={() => document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' })}
                                class="bg-[#111113] border border-white/10 border-dashed rounded-[32px] p-8 flex flex-col items-center justify-center text-center gap-6 group hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all cursor-pointer">
                                <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                    <Plus class="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-bold text-white mb-2">Deploy New Node</h3>
                                    <p class="text-sm text-gray-500 max-w-xs mx-auto">Purchase a new Validator or Enterprise license to increase your mining output.</p>
                                </div>
                                <button class="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                    View Catalog
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Node Catalog Section */}
                    <div id="catalog-section" class="border-t border-white/[0.06] pt-12">
                        <h3 class="text-2xl font-bold text-white mb-8 tracking-tight">Node License Catalog</h3>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Validator Tier */}
                            <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-emerald-500/30 transition-all flex flex-col">
                                <div class="flex justify-between items-start mb-6">
                                    <div class="px-3 py-1 bg-emerald-500/10 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                        Most Popular
                                    </div>
                                    <div class="text-right">
                                        <div class="text-2xl font-bold text-white">{validatorPriceVCN.toLocaleString()} VCN</div>
                                        <div class="text-xs text-gray-500">Fixed ${VALIDATOR_PRICE_USD.toLocaleString()}</div>
                                    </div>
                                </div>

                                <h4 class="text-2xl font-bold text-white mb-4">Validator Node</h4>
                                <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                    Standard participation node. Validates transactions and earns VCN rewards with a 1x multiplier. Ideal for individual operators.
                                </p>

                                <div class="space-y-3 mb-8 flex-1">
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>1x Mining Multiplier</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>Eligible for Halving Trigger</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>Standard Hardware Req.</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => props.purchaseNode('Validator')}
                                    class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all hover:border-emerald-500/50">
                                    Purchase License
                                </button>
                            </div>

                            {/* Enterprise Tier */}
                            <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-purple-500/30 transition-all flex flex-col relative overflow-hidden">
                                {/* Badge */}
                                <div class="absolute -right-12 top-6 bg-purple-600 w-40 h-8 flex items-center justify-center rotate-45 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                                    High Perf.
                                </div>

                                <div class="flex justify-between items-start mb-6">
                                    <div class="px-3 py-1 bg-purple-500/10 rounded-lg text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                        Enterprise
                                    </div>
                                    <div class="text-right">
                                        <div class="text-2xl font-bold text-white">{enterprisePriceVCN.toLocaleString()} VCN</div>
                                        <div class="text-xs text-gray-500">Fixed ${ENTERPRISE_PRICE_USD.toLocaleString()}</div>
                                    </div>
                                </div>

                                <h4 class="text-2xl font-bold text-white mb-4">Validator Node</h4>
                                <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                    Standard participation node. Validates transactions and earns VCN rewards with a 1x multiplier. Ideal for individual operators.
                                </p>

                                <div class="space-y-3 mb-8 flex-1">
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>1x Mining Multiplier</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>Eligible for Halving Trigger</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-emerald-500" />
                                        <span>Standard Hardware Req.</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => props.purchaseNode('Validator')}
                                    class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all hover:border-emerald-500/50">
                                    Purchase License
                                </button>
                            </div>

                            {/* Enterprise Tier */}
                            <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-purple-500/30 transition-all flex flex-col relative overflow-hidden">
                                {/* Badge */}
                                <div class="absolute -right-12 top-6 bg-purple-600 w-40 h-8 flex items-center justify-center rotate-45 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                                    High Perf.
                                </div>

                                <div class="flex justify-between items-start mb-6">
                                    <div class="px-3 py-1 bg-purple-500/10 rounded-lg text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                        Enterprise
                                    </div>
                                    <div class="text-right">
                                        <div class="text-2xl font-bold text-white">500,000 VCN</div>
                                        <div class="text-xs text-gray-500">approx. $62,000</div>
                                    </div>
                                </div>

                                <h4 class="text-2xl font-bold text-white mb-4">Enterprise Node</h4>
                                <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                    High-performance institutional node handling data availability and AI compute tasks. 12x multiplier reward.
                                </p>

                                <div class="space-y-3 mb-8 flex-1">
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-purple-500" />
                                        <span>12x Mining Multiplier</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-purple-500" />
                                        <span>AI Task Processing Priority</span>
                                    </div>
                                    <div class="flex items-center gap-3 text-sm text-gray-300">
                                        <Check class="w-4 h-4 text-purple-500" />
                                        <span>10Gbps Network Required</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => props.purchaseNode('Enterprise')}
                                    class="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20">
                                    Purchase License
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
