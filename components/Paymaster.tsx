import { Component, createSignal, For, Show } from 'solid-js';
import {
    Zap,
    ShieldCheck,
    CreditCard,
    Users,
    BarChart3,
    Lock,
    Unlock,
    ChevronRight,
    Maximize2,
    Activity,
    CheckCircle2,
    Plus,
    Flame
} from 'lucide-solid';
import { Motion } from 'solid-motionone';

interface SponsoringRule {
    id: string;
    target: string;
    budget: string;
    remaining: string;
    status: 'Active' | 'Paused';
    consumers: number;
}

const Paymaster: Component = () => {
    const [isGlobalEnabled, setIsGlobalEnabled] = createSignal(true);
    const [sponsoredRules, setSponsoredRules] = createSignal<SponsoringRule[]>([
        { id: '1', target: 'Swap & Liquidity', budget: '50,000 VCN', remaining: '12,450 VCN', status: 'Active', consumers: 1240 },
        { id: '2', target: 'NFT Minting', budget: '10,000 VCN', remaining: '8,200 VCN', status: 'Active', consumers: 450 },
        { id: '3', target: 'Accounting Metadata', budget: 'Unlimited', remaining: 'N/A', status: 'Active', consumers: 5800 },
    ]);

    return (
        <div class="min-h-screen bg-[#050505] text-white pt-24 pb-20 px-4">
            <div class="max-w-6xl mx-auto">

                {/* Header Section */}
                <div class="flex flex-col md:flex-row justify-between items-end gap-6 mb-16">
                    <Motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        class="max-w-2xl"
                    >
                        <div class="flex items-center gap-3 mb-4">
                            <div class="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                <ShieldCheck class="w-3 h-3" />
                                Account Abstraction (ERC-4337)
                            </div>
                        </div>
                        <h1 class="text-4xl md:text-6xl font-black italic tracking-tighter mb-6 uppercase">
                            Vision Paymaster <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">& Gasless Hub</span>
                        </h1>
                        <p class="text-slate-400 font-medium leading-relaxed">
                            Onboard users without requiring VCN for gas. The Vision AI Foundation sponsors transactions for
                            verified accounts, autonomous agents, and strategic dApps to ensure a threshold-free entry
                            into the AI-Native economy.
                        </p>
                    </Motion.div>

                    <div class="flex gap-4">
                        <button
                            onClick={() => setIsGlobalEnabled(!isGlobalEnabled())}
                            class={`px-6 py-4 rounded-xl flex items-center gap-3 transition-all font-black text-xs uppercase tracking-widest ${isGlobalEnabled() ? 'bg-green-500/10 border border-green-500/30 text-green-500' : 'bg-red-500/10 border border-red-500/30 text-red-500'}`}
                        >
                            {isGlobalEnabled() ? <Unlock class="w-4 h-4" /> : <Lock class="w-4 h-4" />}
                            {isGlobalEnabled() ? 'Active' : 'Paused'}
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {[
                        { label: 'Total Sponsored', value: '425.8k VCN', icon: Flame, color: 'text-orange-500' },
                        { label: 'Active Users', value: '12,840', icon: Users, color: 'text-blue-400' },
                        { label: 'Gas Saved (USD)', value: '$52,140', icon: CreditCard, color: 'text-green-400' },
                        { label: 'Latency (Paymaster)', value: '12ms', icon: Activity, color: 'text-purple-400' },
                    ].map((stat) => (
                        <div class="bg-[#0c0c0c] border border-white/5 rounded-3xl p-6 hover:bg-white/[0.04] transition-all">
                            <div class="flex items-center gap-3 mb-4">
                                <stat.icon class={`w-5 h-5 ${stat.color}`} />
                                <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <div class="text-3xl font-black italic tracking-tighter">{stat.value}</div>
                        </div>
                    ))}
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Sponsorship Rules */}
                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden">
                            <div class="p-8 border-b border-white/5 flex justify-between items-center">
                                <h3 class="text-xl font-black italic uppercase tracking-tight">Active Sponsoring Campaigns</h3>
                                <button class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold transition-all uppercase">
                                    <Plus class="w-3 h-3" />
                                    New Goal
                                </button>
                            </div>
                            <div class="divide-y divide-white/5">
                                <For each={sponsoredRules()}>
                                    {(rule) => (
                                        <div class="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors group">
                                            <div class="flex items-center gap-6">
                                                <div class="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                                                    <Zap class="w-6 h-6 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h4 class="text-lg font-black italic uppercase tracking-tight mb-1">{rule.target}</h4>
                                                    <div class="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        <span>Budget: {rule.budget}</span>
                                                        <span class="w-1 h-1 rounded-full bg-slate-700" />
                                                        <span>{rule.consumers} Consumers</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-8">
                                                <div class="text-right">
                                                    <div class="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Remaing Fuel</div>
                                                    <div class="text-xl font-black italic text-blue-400">{rule.remaining}</div>
                                                </div>
                                                <button class="w-10 h-10 rounded-full bg-white/5 hover:bg-blue-600 flex items-center justify-center transition-all group-hover:scale-110">
                                                    <ChevronRight class="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        {/* Developer Documentation Link */}
                        <div class="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-[32px] p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                            <div class="max-w-md">
                                <h3 class="text-2xl font-black italic tracking-tight mb-2 uppercase">Integrate Gasless API</h3>
                                <p class="text-sm text-slate-400 font-medium">Use our SDK to enable gasless interactions in your dApp. No more onboarding friction for new users.</p>
                            </div>
                            <button class="px-8 py-4 bg-white text-black rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl shadow-white/10 whitespace-nowrap">
                                VIEW DOCS
                            </button>
                        </div>
                    </div>

                    {/* Sidebar Area */}
                    <div class="space-y-6">

                        {/* Status Card */}
                        <div class="bg-[#0c0c0c] border border-white/10 rounded-[32px] p-8">
                            <div class="flex items-center justify-between mb-8">
                                <h3 class="text-sm font-black italic tracking-widest uppercase">Live Pulse</h3>
                                <Activity class="w-4 h-4 text-green-500" />
                            </div>
                            <div class="space-y-6">
                                {[
                                    { user: '0x3a...f42', tx: 'BatchTransfer', time: 'Just now' },
                                    { user: '0x1c...a9b', tx: 'AI-Mint', time: '2s ago' },
                                    { user: '0x4d...82d', tx: 'Accounting-Sync', time: '5s ago' },
                                    { user: '0x8e...c31', tx: 'Bridge-Confirm', time: '12s ago' },
                                ].map((item) => (
                                    <div class="flex items-center gap-4">
                                        <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                        <div class="flex-1 min-w-0">
                                            <div class="text-xs font-black italic uppercase tracking-tight text-white">{item.tx}</div>
                                            <div class="text-[10px] text-slate-500 font-medium">By {item.user} • {item.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Policy Card */}
                        <div class="bg-white/5 border border-[#1a1a1a] rounded-[32px] p-8 space-y-4">
                            <h3 class="text-xs font-black text-slate-500 uppercase tracking-widest">Sponsorship Policy</h3>
                            <div class="space-y-3">
                                <div class="flex gap-3">
                                    <CheckCircle2 class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p class="text-[11px] text-slate-400 font-medium leading-relaxed">Verified Vision ID accounts get 50 free Transactions / Day.</p>
                                </div>
                                <div class="flex gap-3">
                                    <CheckCircle2 class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p class="text-[11px] text-slate-400 font-medium leading-relaxed">Accounting metadata transactions (A110-D600) are always 100% sponsored.</p>
                                </div>
                                <div class="flex gap-3">
                                    <CheckCircle2 class="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p class="text-[11px] text-slate-400 font-medium leading-relaxed">Enterprise partners can create custom budget pools for their users.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default Paymaster;
