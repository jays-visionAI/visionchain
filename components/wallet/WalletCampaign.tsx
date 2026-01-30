import { createSignal, Show, For, onMount } from 'solid-js';
import { ethers } from 'ethers';
import {
    Zap,
    TrendingUp,
    Sparkles,
    Copy,
    ChevronRight,
    User,
    UserPlus,
    Target,
    ArrowLeft,
    Trophy,
    Search,
    Award
} from 'lucide-solid';
import { Motion } from 'solid-motionone';

import { WalletViewHeader } from './WalletViewHeader';
import { ReferralLeaderboard } from './ReferralLeaderboard';

export const WalletCampaign = (props: { userProfile: () => any; onNavigate?: (view: string) => void }) => {
    const [selectedQuest, setSelectedQuest] = createSignal<string | null>(null);
    const [totalStaked, setTotalStaked] = createSignal('Loading...');

    // Fetch real staking data on mount
    onMount(async () => {
        try {
            const provider = new ethers.JsonRpcProvider('https://api.visionchain.co/rpc-proxy');
            const stakingContract = new ethers.Contract(
                '0x746a48E39dC57Ff14B872B8979E20efE5E5100B1',
                ['function totalStaked() view returns (uint256)'],
                provider
            );
            const staked = await stakingContract.totalStaked();
            const stakedFormatted = parseFloat(ethers.formatEther(staked));
            if (stakedFormatted >= 1000000) {
                setTotalStaked(`${(stakedFormatted / 1000000).toFixed(1)}M VCN`);
            } else if (stakedFormatted >= 1000) {
                setTotalStaked(`${(stakedFormatted / 1000).toFixed(1)}K VCN`);
            } else {
                setTotalStaked(`${stakedFormatted.toFixed(0)} VCN`);
            }
        } catch (e) {
            console.error('Failed to fetch total staked:', e);
            setTotalStaked('0 VCN');
        }
    });

    const quests = [
        {
            id: 'referral',
            title: 'Referral Rush',
            tag: 'Active Now',
            tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            description: 'Invite your network to Vision Chain and climb the global leaderboard for massive VCN multipliers.',
            icon: UserPlus,
            accent: 'emerald',
            btnText: 'View Leaderboard',
            stats: [
                { label: 'Top Reward', value: '100x VCN' },
                { label: 'Participants', value: '2.4K+' }
            ],
            footerTag: 'Season 1',
            footerIcon: Sparkles
        },
        {
            id: 'staking',
            title: 'Validator Staking',
            tag: 'Active Now',
            tagColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            description: 'Earn min 12% APR up to 20% by staking your VCN tokens. Secure bridge network and grow your holdings.',
            icon: TrendingUp,
            accent: 'emerald',
            btnText: 'Stake Now',
            stats: [
                { label: 'Current APY', value: '12~20%' },
                { label: 'Total Staked', value: totalStaked() }
            ],
            footerTag: 'Active Now',
            footerIcon: Target
        },
        {
            id: 'airdrop',
            title: 'Community Airdrop',
            tag: 'Season 1',
            tagColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            description: 'Complete daily ecosystem missions to earn Vision Points and qualify for the first genesis airdrop.',
            icon: Sparkles,
            accent: 'purple',
            btnText: 'View Missions',
            progress: 5,
            footerTag: 'New Era',
            footerIcon: TrendingUp
        },
        {
            id: 'vns',
            title: 'VNS Hunting',
            tag: 'Early Access',
            tagColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
            description: 'Secure premium .vsn handles before the public launch. Collectors earn exclusive naming rewards.',
            icon: Target,
            accent: 'amber',
            btnText: 'Start Hunting',
            stats: [
                { label: 'Handles Claimed', value: '8.1K' },
                { label: 'Rarity Bonus', value: 'Up to 5x' }
            ],
            footerTag: 'Limited',
            footerIcon: Award
        }
    ];

    return (
        <div class="flex-1 overflow-y-auto relative custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

                <Show when={selectedQuest() === null} fallback={
                    <div class="space-y-8">
                        {/* Sub-page Header */}
                        <div class="flex items-center justify-between">
                            <button
                                onClick={() => setSelectedQuest(null)}
                                class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                            >
                                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                    <ArrowLeft class="w-5 h-5" />
                                </div>
                                <span class="text-sm font-bold uppercase tracking-widest">Back to Quests</span>
                            </button>

                            <div class="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <Trophy class="w-4 h-4 text-blue-400" />
                                <span class="text-xs font-black text-blue-400 uppercase tracking-widest">Active Leaderboard</span>
                            </div>
                        </div>

                        {/* Specific Sub-page Content */}
                        <Show when={selectedQuest() === 'referral'}>
                            <div class="space-y-6">
                                <div class="bg-gradient-to-br from-emerald-600/10 to-blue-600/10 border border-white/10 rounded-[32px] p-8 lg:p-12 relative overflow-hidden">
                                    <div class="absolute top-0 right-0 p-12 opacity-5 scale-150">
                                        <UserPlus class="w-64 h-64" />
                                    </div>
                                    <div class="relative z-10 max-w-2xl">
                                        <span class="inline-block px-3 py-1 bg-emerald-500 text-black text-[10px] font-black uppercase rounded mb-4">Referral Quest</span>
                                        <h1 class="text-4xl lg:text-5xl font-black italic text-white tracking-tighter mb-4">REFERRAL RUSH</h1>
                                        <p class="text-lg text-gray-400 font-medium leading-relaxed mb-8">
                                            The race is on. Build your network on Vision Chain and unlock exclusive multipliers based on your rank.
                                            Every verified referral boosts your power.
                                        </p>
                                        <div class="flex gap-4">
                                            <div class="bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Your Rank</div>
                                                <div class="text-2xl font-black text-white italic">#--</div>
                                            </div>
                                            <div class="bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Reward</div>
                                                <div class="text-2xl font-black text-emerald-400 italic">0 VCN</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ReferralLeaderboard currentUserEmail={props.userProfile()?.email || ''} />
                            </div>
                        </Show>

                        {/* Placeholder for other quest sub-pages */}
                        <Show when={selectedQuest() !== 'referral'}>
                            <div class="py-20 flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-600 mb-6">
                                    <Award class="w-10 h-10" />
                                </div>
                                <h3 class="text-2xl font-black text-white uppercase italic tracking-tight mb-2">Quest System Initializing</h3>
                                <p class="text-gray-500 max-w-sm mb-8">Leaderboards and mission dashboards for {selectedQuest()} are coming soon in the next season update.</p>
                                <button
                                    onClick={() => setSelectedQuest(null)}
                                    class="px-8 py-3 bg-white text-black font-black uppercase italic rounded-xl text-sm hover:scale-105 active:scale-95 transition-all"
                                >
                                    Return to Overview
                                </button>
                            </div>
                        </Show>
                    </div>
                }>
                    <div class="space-y-12">
                        <WalletViewHeader
                            tag="Earning Center"
                            title="QUEST"
                            titleAccent="SYSTEM"
                            description="Maximize your earnings through Vision ecosystem events, rewards, and community missions."
                            icon={Zap}
                        />

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                            <For each={quests}>
                                {(quest) => (
                                    <div
                                        onClick={() => {
                                            if (quest.id === 'staking' && props.onNavigate) {
                                                props.onNavigate('staking');
                                            } else {
                                                setSelectedQuest(quest.id);
                                            }
                                        }}
                                        class={`bg-[#111113] border border-white/[0.06] rounded-[32px] p-8 pb-10 hover:border-${quest.accent}-500/30 transition-all group flex flex-col h-full cursor-pointer relative`}
                                    >
                                        {/* Hover Glow - Moved to inner container to prevent clipping of button shadow */}
                                        <div class="absolute inset-0 rounded-[32px] overflow-hidden pointer-events-none">
                                            <div class={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-0 group-hover:opacity-20 transition-opacity bg-${quest.accent}-500 -mr-16 -mt-16`} />
                                        </div>

                                        <div class="flex items-center justify-between mb-8 relative z-10">
                                            <div class={`px-3 py-1 ${quest.tagColor} border rounded-full text-[9px] font-black uppercase tracking-widest`}>
                                                {quest.tag}
                                            </div>
                                            <quest.icon class="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                                        </div>

                                        <div class="flex-1 relative z-10">
                                            <h2 class="text-3xl font-black italic text-white tracking-tighter mb-4 group-hover:text-blue-400 transition-colors uppercase">
                                                {quest.title}
                                            </h2>
                                            <p class="text-gray-400 mb-8 font-medium leading-relaxed text-sm">
                                                {quest.description}
                                            </p>

                                            <Show when={quest.stats}>
                                                <div class="flex items-center gap-8 mb-8 pt-4 border-t border-white/5">
                                                    <For each={quest.stats}>
                                                        {(stat) => (
                                                            <div>
                                                                <div class="text-[9px] text-gray-600 uppercase font-black tracking-widest mb-1.5">{stat.label}</div>
                                                                <div class="text-xl font-black text-white italic tracking-tighter">{stat.value}</div>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>

                                            <Show when={quest.progress !== undefined}>
                                                <div class="mb-8 pt-4 border-t border-white/5">
                                                    <div class="flex items-center justify-between mb-3">
                                                        <span class="text-[9px] text-gray-600 font-black uppercase tracking-widest">Progress Basis</span>
                                                        <span class="text-[10px] text-white font-black italic">ACTIVE</span>
                                                    </div>
                                                    <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            class={`h-full bg-${quest.accent}-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]`}
                                                            style={{ width: `${quest.progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>

                                        <div class="space-y-6 mt-auto pr-1 pb-1">
                                            <button
                                                class={`w-full py-4 rounded-2xl font-black uppercase italic tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${quest.accent === 'blue' ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-500/20 shadow-xl' :
                                                    quest.accent === 'emerald' ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20 shadow-xl' :
                                                        quest.accent === 'purple' ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-purple-500/20 shadow-xl' :
                                                            'bg-white/5 text-gray-500 hover:bg-white/10'
                                                    }`}
                                            >
                                                {quest.btnText}
                                                <ChevronRight class="w-4 h-4" />
                                            </button>

                                            <div class="flex items-center justify-between pt-2">
                                                <div class="flex items-center gap-2 px-2 py-1 bg-white/[0.03] border border-white/[0.05] rounded-lg">
                                                    <span class="text-[8px] font-black text-gray-600 uppercase tracking-widest">{quest.footerTag}</span>
                                                </div>
                                                <quest.footerIcon class="w-3.5 h-3.5 text-gray-700" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
