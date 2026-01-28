import { createSignal, onMount, For, Show } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    UserPlus,
    Copy,
    Check,
    Users,
    TrendingUp,
    DollarSign,
    ChevronRight,
    ArrowUpRight,
    Gift,
    Shield,
    ExternalLink,
    Award,
    Star,
    Crown,
    Zap,
    Trophy,
    Crosshair
} from 'lucide-solid';
import { getUserReferrals, UserData } from '../../services/firebaseService';

import { WalletViewHeader } from './WalletViewHeader';

interface WalletReferralProps {
    userProfile: () => any;
}

// --- 1. RPG-Style Level System Configuration ---
// 10 Major Ranks, spanning 100 Levels.
const RANKS = [
    { name: 'Novice', minLvl: 1, color: 'text-gray-400', bg: 'bg-gray-500', gradient: 'from-gray-600 to-gray-500', icon: Users },         // Lvl 1-9
    { name: 'Scout', minLvl: 10, color: 'text-blue-400', bg: 'bg-blue-500', gradient: 'from-blue-600 to-cyan-500', icon: ExternalLink },    // Lvl 10-19
    { name: 'Ranger', minLvl: 20, color: 'text-emerald-400', bg: 'bg-emerald-500', gradient: 'from-emerald-600 to-green-500', icon: TrendingUp }, // Lvl 20-29
    { name: 'Guardian', minLvl: 30, color: 'text-cyan-400', bg: 'bg-cyan-500', gradient: 'from-cyan-600 to-sky-500', icon: Shield },       // Lvl 30-39
    { name: 'Elite', minLvl: 40, color: 'text-indigo-400', bg: 'bg-indigo-500', gradient: 'from-indigo-600 to-blue-600', icon: Zap },       // Lvl 40-49
    { name: 'Captain', minLvl: 50, color: 'text-violet-400', bg: 'bg-violet-500', gradient: 'from-violet-600 to-purple-600', icon: Award }, // Lvl 50-59
    { name: 'Commander', minLvl: 60, color: 'text-orange-400', bg: 'bg-orange-500', gradient: 'from-orange-600 to-amber-500', icon: Trophy },// Lvl 60-69
    { name: 'Warlord', minLvl: 70, color: 'text-red-400', bg: 'bg-red-500', gradient: 'from-red-600 to-orange-600', icon: Crosshair },      // Lvl 70-79
    { name: 'Titan', minLvl: 80, color: 'text-rose-400', bg: 'bg-rose-500', gradient: 'from-rose-600 to-pink-600', icon: Crown },           // Lvl 80-89
    { name: 'Visionary', minLvl: 90, color: 'text-yellow-400', bg: 'bg-yellow-500', gradient: 'from-yellow-500 to-amber-300', icon: Star }   // Lvl 90-100
];

// Helper to determine Level based on Referral Count (Progressive Curve)
// 1 Ref = 1 Level (up to 20)
// 2 Refs = 1 Level (20-50) -> Needs 30*2 = 60 more refs. Total 80.
// 5 Refs = 1 Level (50-80) -> Needs 30*5 = 150 more refs. Total 230.
// 10 Refs = 1 Level (80-100) -> Needs 20*10 = 200 more refs. Total 430.
const getLevelData = (count: number) => {
    let level = 1;
    let nextLevelRefs = 1; // Total refs needed for next level
    let currentLevelBaseRefs = 0; // Refs needed to reach current level
    let refsPerLevel = 1;

    if (count < 20) {
        level = count + 1;
        refsPerLevel = 1;
        currentLevelBaseRefs = count;
        nextLevelRefs = count + 1;
    } else if (count < 80) { // 20 + (30 * 2)
        const surplus = count - 20;
        const levelGain = Math.floor(surplus / 2);
        level = 20 + levelGain + 1;
        refsPerLevel = 2;
        currentLevelBaseRefs = 20 + (levelGain * 2);
        nextLevelRefs = currentLevelBaseRefs + 2;
    } else if (count < 230) { // 80 + (30 * 5)
        const surplus = count - 80;
        const levelGain = Math.floor(surplus / 5);
        level = 50 + levelGain + 1;
        refsPerLevel = 5;
        currentLevelBaseRefs = 80 + (levelGain * 5);
        nextLevelRefs = currentLevelBaseRefs + 5;
    } else { // 230 + ...
        const surplus = count - 230;
        const levelGain = Math.floor(surplus / 10);
        level = 80 + levelGain + 1;
        refsPerLevel = 10;
        currentLevelBaseRefs = 230 + (levelGain * 10);
        nextLevelRefs = currentLevelBaseRefs + 10;
    }

    if (level > 100) level = 100;

    // Progress % within current level
    const progressIntoLevel = count - currentLevelBaseRefs;
    const progressPercent = Math.min(100, (progressIntoLevel / refsPerLevel) * 100);

    // Find Rank
    const rank = [...RANKS].reverse().find(r => level >= r.minLvl) || RANKS[0];

    return {
        level,
        rank,
        progressPercent,
        nextLevelRefs,
        refsPerLevel,
        refsToNext: Math.max(0, nextLevelRefs - count)
    };
};

export const WalletReferral = (props: WalletReferralProps) => {
    const [referrals, setReferrals] = createSignal<UserData[]>([]);
    const [copied, setCopied] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);

    const referralUrl = () => `${window.location.origin}/signup?ref=${props.userProfile().referralCode}`;

    const invitationMessage = () => {
        const url = referralUrl();
        return `Join Vision Chain\n${url}`;
    };

    onMount(async () => {
        if (props.userProfile().email) {
            const list = await getUserReferrals(props.userProfile().email);
            setReferrals(list);
            setIsLoading(false);
        }
    });

    const copyLink = () => {
        navigator.clipboard.writeText(invitationMessage());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(props.userProfile().referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentReferralCount = () => props.userProfile().referralCount || 0;
    const stats = () => getLevelData(currentReferralCount());

    return (
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletViewHeader
                    tag="Visionary Program"
                    title="REFERRAL"
                    titleAccent="LEGENDS"
                    description="Climb the 100 levels of mastery. Unlock ranks, earn exponential rewards, and become a Visionary Legend."
                    rightElement={
                        <div class="flex items-center gap-4 bg-[#111113]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 pr-6 overflow-hidden relative">
                            {/* Animated Glow based on Rank */}
                            <div class={`absolute inset-0 bg-gradient-to-r ${stats().rank.gradient} opacity-10 animate-pulse`} />

                            <div class="relative z-10 flex items-center gap-4">
                                <div class="relative">
                                    <div class={`w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${stats().rank.gradient} shadow-lg shadow-black/40`}>
                                        <DynamicIcon icon={stats().rank.icon} class="w-7 h-7 text-white" />
                                    </div>
                                    <div class="absolute -bottom-2 -right-2 bg-[#0a0a0b] border border-white/10 text-white text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center shadow-lg">
                                        {stats().level}
                                    </div>
                                </div>
                                <div>
                                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">CURRENT RANK</div>
                                    <div class={`text-xl font-black ${stats().rank.color} uppercase tracking-tight flex flex-col leading-none`}>
                                        {stats().rank.name}
                                        <span class="text-[10px] text-white/40 font-bold tracking-widest mt-0.5">Level {stats().level} / 100</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                />

                {/* Primary Actions / Stats Container */}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Share Card */}
                    <div class="lg:col-span-2 bg-gradient-to-br from-blue-600/5 via-[#111113] to-[#111113] border border-white/[0.08] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <UserPlus class="w-32 h-32 text-blue-400" />
                        </div>

                        <div class="relative z-10">
                            <h3 class="text-xl font-black text-white italic mb-6 uppercase tracking-tight">Your Invite Link</h3>
                            <div class="flex flex-col gap-3 mb-8">
                                <div class="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group/link shadow-inner">
                                    <code class="text-blue-400 font-mono text-sm truncate">{referralUrl()}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(invitationMessage());
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        class="p-2 hover:bg-white/5 rounded-lg transition-all"
                                    >
                                        <Show when={copied()} fallback={<Copy class="w-4 h-4 text-gray-500" />}>
                                            <Check class="w-4 h-4 text-green-400" />
                                        </Show>
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        if (navigator.share) {
                                            navigator.share({
                                                title: 'Join Vision Chain',
                                                text: invitationMessage()
                                            });
                                        } else {
                                            copyLink();
                                            alert("Invitation link copied to clipboard!");
                                        }
                                    }}
                                    class="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl shadow-blue-600/20 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 active:scale-95"
                                >
                                    <ArrowUpRight class="w-4 h-4" />
                                    Share Link
                                </button>
                            </div>

                            <div class="flex items-center gap-8">
                                <div>
                                    <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Your Code</div>
                                    <div class="flex items-center gap-2">
                                        <span class="text-2xl font-black text-white font-mono tracking-tighter">{props.userProfile().referralCode}</span>
                                        <button onClick={copyCode} class="text-gray-600 hover:text-white transition-colors">
                                            <Copy class="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div class="w-[1px] h-10 bg-white/5" />
                                <div>
                                    <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Total Earned</div>
                                    <div class="text-2xl font-black text-green-400">{(props.userProfile().totalRewardsVCN || 0).toLocaleString()} <span class="text-xs font-bold text-gray-600">VCN</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Elite Stats / XP Card */}
                    <div class="bg-[#111113] border border-white/[0.08] rounded-[32px] p-8 flex flex-col relative overflow-hidden">
                        {/* Dynamic Background */}
                        <div class={`absolute inset-0 bg-gradient-to-br ${stats().rank.gradient} opacity-[0.03]`} />

                        <div class="relative z-10 flex-1 flex flex-col">
                            <div class="flex items-center justify-between mb-2">
                                <h4 class="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
                                    XP Progress
                                </h4>
                                <span class={`text-xs font-bold ${stats().rank.color}`}>
                                    Lvl {stats().level} <span class="text-gray-600">to</span> Lvl {stats().level + 1}
                                </span>
                            </div>

                            {/* Main Progress Bar */}
                            <div class="relative w-full h-4 bg-black/40 rounded-full border border-white/5 overflow-hidden mb-1">
                                <Motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats().progressPercent}%` }}
                                    transition={{ duration: 1.5, easing: [0.22, 1, 0.36, 1] }}
                                    class={`h-full bg-gradient-to-r ${stats().rank.gradient} relative shadow-[0_0_15px_rgba(255,255,255,0.3)]`}
                                >
                                    <div class="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                                    {/* Shimmer Effect */}
                                    <div class="absolute top-0 bottom-0 right-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 translate-x-full animate-[shimmer_2s_infinite]" />
                                </Motion.div>
                            </div>

                            <div class="flex justify-between items-center text-[10px] font-mono text-gray-500 mb-6 font-bold">
                                <span>{stats().progressPercent.toFixed(0)}% Complete</span>
                                <span>{stats().refsToNext} XP (Invites) Needed</span>
                            </div>

                            {/* Status Grid */}
                            <div class="grid grid-cols-2 gap-3 mt-auto">
                                <div class="bg-black/20 rounded-2xl p-4 border border-white/5">
                                    <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Total Invites</div>
                                    <div class="text-xl font-black text-white">{currentReferralCount()}</div>
                                </div>
                                <div class="bg-black/20 rounded-2xl p-4 border border-white/5">
                                    <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">XP Multiplier</div>
                                    <div class={`text-xl font-black ${stats().rank.color}`}>
                                        {(1 + (stats().level * 0.05)).toFixed(2)}x
                                    </div>
                                </div>
                            </div>

                            {/* Next Rank Teaser */}
                            <Show when={stats().level < 100}>
                                <div class="mt-4 p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                                    <p class="text-[10px] text-gray-400">
                                        Next Major Rank: <span class="font-bold text-white">{RANKS.find(r => r.minLvl > stats().level)?.name || 'Max'}</span>
                                    </p>
                                </div>
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Referrals List Section */}
                <div class="space-y-6">
                    <div class="flex items-center justify-between px-2">
                        <h3 class="text-xl font-black text-white italic uppercase tracking-tight">MY <span class="text-blue-400">NETWORK</span></h3>
                        <div class="flex items-center gap-2 text-gray-600">
                            <span class="text-[9px] font-black uppercase tracking-widest">Direct Invitations</span>
                            <ChevronRight class="w-4 h-4" />
                        </div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-2xl">
                        <Show when={isLoading()} fallback={
                            <Show when={referrals().length > 0} fallback={
                                <div class="p-20 text-center">
                                    <div class="w-16 h-16 rounded-full bg-white/[0.02] flex items-center justify-center mx-auto mb-4 border border-white/5">
                                        <Users class="w-8 h-8 text-gray-700" />
                                    </div>
                                    <div class="text-sm font-bold text-gray-500 uppercase tracking-widest mb-1">No invitations found</div>
                                    <p class="text-xs text-gray-700 max-w-[240px] mx-auto italic">Start sharing your link to build your initial Tier 1 network.</p>
                                </div>
                            }>
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left">
                                        <thead>
                                            <tr class="border-b border-white/5 bg-white/[0.02]">
                                                <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Identity</th>
                                                <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Status</th>
                                                <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Rewards Generated</th>
                                                <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Join Date</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-white/[0.02]">
                                            <For each={referrals()}>
                                                {(ref) => (
                                                    <tr class="group hover:bg-white/[0.02] transition-colors">
                                                        <td class="px-8 py-5">
                                                            <div class="flex items-center gap-3">
                                                                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/5 flex items-center justify-center text-xs font-black text-blue-400 group-hover:scale-110 transition-all">
                                                                    {(ref.name || ref.email).substring(0, 2).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <div class="text-sm font-bold text-white uppercase tracking-tight">{ref.name || ref.email.split('@')[0]}</div>
                                                                    <div class="text-[9px] font-bold text-gray-600 truncate max-w-[120px]">{ref.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td class="px-8 py-5">
                                                            <div class="flex items-center gap-2">
                                                                <div class={`w-1.5 h-1.5 rounded-full ${(ref.isVerified || ref.walletAddress) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-yellow-500'}`} />
                                                                <span class={`text-[10px] font-black uppercase tracking-widest ${(ref.isVerified || ref.walletAddress) ? 'text-green-500' : 'text-yellow-500'}`}>
                                                                    {(ref.isVerified || ref.walletAddress) ? 'Verified' : 'Pending'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td class="px-8 py-5">
                                                            <div class="flex items-center gap-3">
                                                                <div class="text-xs font-black text-white">+{(ref.totalRewardsVCN || 0).toLocaleString()} VCN</div>
                                                                <div class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400">
                                                                    <Gift class="w-3.5 h-3.5" />
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td class="px-8 py-5 text-right">
                                                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest font-mono italic">
                                                                {ref.joinDate || 'Jan 2026'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </For>
                                        </tbody>
                                    </table>
                                </div>
                            </Show>
                        }>
                            <div class="p-20 flex flex-col items-center justify-center">
                                <div class="w-10 h-10 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                <span class="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] mt-4">Loading Network...</span>
                            </div>
                        </Show>
                    </div>
                </div>

                {/* Footer Logic / Security */}
                <div class="bg-gradient-to-r from-blue-600/10 to-transparent border-l-4 border-blue-500 p-6 rounded-r-3xl">
                    <div class="flex gap-4">
                        <div class="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
                            <Shield class="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h4 class="text-sm font-black text-white italic uppercase mb-1">Referral Security & Integrity</h4>
                            <p class="text-xs text-gray-500 leading-relaxed font-medium">Vision Chain uses a neural fraud detection system to verify network quality. Self-referrals and bot-driven invitations are automatically suppressed and may result in account restriction. Rewards are distributed in VCN and settled directly to your wallet.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Component for Dynamic Icons
const DynamicIcon = (props: { icon: any, class?: string }) => {
    return <props.icon class={props.class} />;
};
