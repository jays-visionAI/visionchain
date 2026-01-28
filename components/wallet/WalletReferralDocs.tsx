import { createSignal, Show, For } from 'solid-js';
import {
    Users,
    TrendingUp,
    Shield,
    Zap,
    Award,
    Trophy,
    Crosshair,
    Crown,
    Star,
    ExternalLink,
    CheckCircle,
    ArrowRight,
    Target,
    Gift,
    BarChart3
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import { Motion } from 'solid-motionone';

// 1. Define Tier/Rank Data for Documentation
const RANK_DETAILS = [
    { name: 'Novice', minLvl: 1, color: 'text-gray-400', bg: 'bg-gray-500', icon: Users, desc: 'Your journey begins. Start building your network.', benefits: ['Standard 10% Direct Referral Reward', 'Access to Community Channels'] },
    { name: 'Scout', minLvl: 10, color: 'text-blue-400', bg: 'bg-blue-500', icon: ExternalLink, desc: 'Recognized for network growth.', benefits: ['+2% Bonus on Direct Rewards (12% Total)', 'Scout Identity Badge'] },
    { name: 'Ranger', minLvl: 20, color: 'text-emerald-400', bg: 'bg-emerald-500', icon: TrendingUp, desc: 'Proven ability to expand reach.', benefits: ['+3% Bonus on Direct Rewards (13% Total)', 'Access to Ranger-only Discord'] },
    { name: 'Guardian', minLvl: 30, color: 'text-cyan-400', bg: 'bg-cyan-500', icon: Shield, desc: 'A pillar of the community.', benefits: ['+4% Bonus on Direct Rewards (14% Total)', 'Priority Support Access'] },
    { name: 'Elite', minLvl: 40, color: 'text-indigo-400', bg: 'bg-indigo-500', icon: Zap, desc: 'Elite status among peers.', benefits: ['+5% Bonus on Direct Rewards (15% Total)', 'Elite NFT Airdrop Eligibility'] },
    { name: 'Captain', minLvl: 50, color: 'text-violet-400', bg: 'bg-violet-500', icon: Award, desc: 'Commanding a significant network.', benefits: ['+6% Bonus on Direct Rewards (16% Total)', 'Beta Access to New Features'] },
    { name: 'Commander', minLvl: 60, color: 'text-orange-400', bg: 'bg-orange-500', icon: Trophy, desc: 'Leading the charge.', benefits: ['+8% Bonus on Direct Rewards (18% Total)', 'Direct line to Community Managers'] },
    { name: 'Warlord', minLvl: 70, color: 'text-red-400', bg: 'bg-red-500', icon: Crosshair, desc: 'Aggressive expansion and dominance.', benefits: ['+10% Bonus on Direct Rewards (20% Total)', 'Warlord Exclusive Meridians'] },
    { name: 'Titan', minLvl: 80, color: 'text-rose-400', bg: 'bg-rose-500', icon: Crown, desc: 'A giant in the ecosystem.', benefits: ['+12% Bonus on Direct Rewards (22% Total)', 'Governance Voting Multiplier (1.2x)'] },
    { name: 'Visionary', minLvl: 90, color: 'text-yellow-400', bg: 'bg-yellow-500', icon: Star, desc: 'The pinnacle of influence.', benefits: ['Max 25% Direct Referral Reward', 'Revenue Share Pool Eligibility', 'Custom "Visionary" Profile Skin'] }
];

export const WalletReferralDocs = () => {
    return (
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div class="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletViewHeader
                    tag="Documentation"
                    title="REWARDS"
                    titleAccent="LOGIC"
                    description="Understand how the Vision Chain Dual-Layer Referral System and Rank Progression works to maximize your earnings."
                    icon={Target}
                />

                {/* Section 1: The Dual-Layer System */}
                <section class="space-y-6">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <BarChart3 class="w-5 h-5 text-blue-400" />
                        </div>
                        <h2 class="text-2xl font-black text-white uppercase italic tracking-tight">The <span class="text-blue-500">Dual-Layer</span> System</h2>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Tier 1 Box */}
                        <div class="bg-[#111113] border border-blue-500/30 rounded-[32px] p-8 relative overflow-hidden group hover:border-blue-500/50 transition-colors">
                            <div class="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <Users class="w-40 h-40 text-blue-500" />
                            </div>
                            <div class="relative z-10">
                                <div class="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">Direct Impact</div>
                                <h3 class="text-3xl font-black text-white mb-4">Tier 1 Rewards</h3>
                                <p class="text-gray-400 leading-relaxed mb-6">
                                    Earn rewards directly from every user who joins using your personal invite link. This is your primary source of income and network growth.
                                </p>
                                <div class="bg-blue-500/10 rounded-2xl p-6 border border-blue-500/20">
                                    <div class="flex items-baseline gap-2 mb-1">
                                        <span class="text-4xl font-black text-white">10%</span>
                                        <span class="text-sm font-bold text-blue-400 uppercase">Base Commission</span>
                                    </div>
                                    <p class="text-xs text-gray-400 font-mono">
                                        *Increases up to 25% based on your Rank.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tier 2 Box */}
                        <div class="bg-[#111113] border border-purple-500/30 rounded-[32px] p-8 relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                            <div class="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                                <TrendingUp class="w-40 h-40 text-purple-500" />
                            </div>
                            <div class="relative z-10">
                                <div class="text-purple-400 text-xs font-black uppercase tracking-widest mb-2">Passive Growth</div>
                                <h3 class="text-3xl font-black text-white mb-4">Tier 2 Rewards</h3>
                                <p class="text-gray-400 leading-relaxed mb-6">
                                    Earn passive income when your Tier 1 referrals invite others. This incentivizes you to help your network grow their own networks.
                                </p>
                                <div class="bg-purple-500/10 rounded-2xl p-6 border border-purple-500/20">
                                    <div class="flex items-baseline gap-2 mb-1">
                                        <span class="text-4xl font-black text-white">5%</span>
                                        <span class="text-sm font-bold text-purple-400 uppercase">Passive Commission</span>
                                    </div>
                                    <p class="text-xs text-gray-400 font-mono">
                                        *Fixed rate across all ranks.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="h-[1px] bg-white/5 w-full" />

                {/* Section 2: Rank Progression Table */}
                <section class="space-y-8">
                    <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Trophy class="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h2 class="text-2xl font-black text-white uppercase italic tracking-tight">Rank <span class="text-amber-500">Progression</span></h2>
                            <p class="text-gray-500 text-sm">Unlock higher tier rewards and exclusive perks as you level up.</p>
                        </div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.08] rounded-[32px] overflow-hidden">
                        <div class="overflow-x-auto">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="border-b border-white/5 bg-white/[0.02]">
                                        <th class="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-[200px]">Rank Identity</th>
                                        <th class="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest w-[120px]">Level Requirement</th>
                                        <th class="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest">Benefits & Multipliers</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/[0.02]">
                                    <For each={RANK_DETAILS}>
                                        {(rank) => (
                                            <tr class="group hover:bg-white/[0.02] transition-colors">
                                                <td class="px-8 py-6">
                                                    <div class="flex items-center gap-4">
                                                        <div class={`w-12 h-12 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg ${rank.bg}/10`}>
                                                            <rank.icon class={`w-6 h-6 ${rank.color}`} />
                                                        </div>
                                                        <div>
                                                            <div class={`text-lg font-black ${rank.color} uppercase tracking-tight leading-none mb-1`}>{rank.name}</div>
                                                            <div class="text-[10px] text-gray-500 truncate max-w-[150px]">{rank.desc}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="px-8 py-6">
                                                    <div class="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
                                                        <span class="text-xs font-black text-white">LVL {rank.minLvl}+</span>
                                                    </div>
                                                </td>
                                                <td class="px-8 py-6">
                                                    <div class="space-y-2">
                                                        <For each={rank.benefits}>
                                                            {(benefit, i) => (
                                                                <div class="flex items-center gap-2">
                                                                    <div class={`w-1 h-1 rounded-full ${rank.bg}`} />
                                                                    <span class={`text-xs font-medium ${i() === 0 ? 'text-white font-bold' : 'text-gray-400'}`}>
                                                                        {benefit}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Footer Call to Action */}
                <div class="bg-gradient-to-r from-blue-600 to-purple-600 rounded-[32px] p-8 md:p-12 text-center relative overflow-hidden">
                    <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
                    <div class="relative z-10 space-y-4">
                        <h2 class="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter">Ready to Become a Visionary?</h2>
                        <p class="text-white/80 max-w-2xl mx-auto font-medium">start inviting today and climb the ranks to unlock maximum yield and exclusive community status.</p>
                    </div>
                </div>

            </div>
        </div>
    );
};
