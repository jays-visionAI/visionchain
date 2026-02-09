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
import { getReferralConfig, getUserReferrals, getUserRP, getRPHistory, UserData, ReferralConfig, RankInfo, LevelThreshold, type UserRP, type RPEntry } from '../../services/firebaseService';

import { WalletViewHeader } from './WalletViewHeader';

interface WalletReferralProps {
    userProfile: () => any;
}

// Helper for dynamic icon mapping
const ICON_MAP: Record<string, any> = {
    Users, TrendingUp, DollarSign, Shield, ExternalLink, Award, Star, Crown, Zap, Trophy, Crosshair
};

export const WalletReferral = (props: WalletReferralProps) => {
    const [referrals, setReferrals] = createSignal<UserData[]>([]);
    const [copied, setCopied] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);
    const [config, setConfig] = createSignal<ReferralConfig | null>(null);
    const [userRP, setUserRP] = createSignal<UserRP>({ totalRP: 0, claimedRP: 0, availableRP: 0 });
    const [rpHistory, setRPHistory] = createSignal<RPEntry[]>([]);

    const referralUrl = () => `https://visionchain.co/signup?ref=${props.userProfile().referralCode}`;

    const invitationMessage = () => {
        return `Join me on Vision Chain! Create your Vision ID and participate in the AI blockchain ecosystem.`;
    };

    const getDynamicLevelData = (count: number, cfg: ReferralConfig) => {
        // New formula: Level L requires L*(L-1)/2 total referrals (triangular number)
        // To go from level N to N+1, you need N more referrals
        // Level 1: 0 refs, Level 2: 1 ref, Level 3: 3 refs, Level 4: 6 refs, Level 10: 45 refs, etc.

        // Calculate level from count using inverse triangular number: L = floor((1 + sqrt(1 + 8*count)) / 2)
        let level = Math.floor((1 + Math.sqrt(1 + 8 * count)) / 2);
        if (level > 100) level = 100;

        // Total refs needed to reach current level
        const currentLevelBaseRefs = level * (level - 1) / 2;
        // Refs needed for next level = current level number
        const refsPerLevel = level;
        // Total refs needed to reach next level
        const nextLevelRefs = level >= 100 ? currentLevelBaseRefs : currentLevelBaseRefs + level;

        const progressIntoLevel = count - currentLevelBaseRefs;
        const progressPercent = level >= 100 ? 100 : Math.min(100, (progressIntoLevel / refsPerLevel) * 100);

        const ranks = cfg.ranks || [];
        const rankInfo = [...ranks].reverse().find(r => level >= r.minLvl) || (ranks.length > 0 ? ranks[0] : { name: 'Novice', color: 'text-gray-400', gradient: 'from-gray-600 to-gray-500', iconName: 'Users', bg: 'bg-gray-500' });

        const rank = {
            ...rankInfo,
            icon: ICON_MAP[rankInfo.iconName] || Users
        };

        const xpMultiplier = (cfg.baseXpMultiplier || 1.0) + (level * (cfg.xpMultiplierPerLevel || 0.05));

        return {
            level,
            rank,
            progressPercent,
            nextLevelRefs,
            refsPerLevel,
            refsToNext: Math.max(0, nextLevelRefs - count),
            xpMultiplier
        };
    };

    onMount(async () => {
        try {
            const [list, cfg] = await Promise.all([
                getUserReferrals(props.userProfile().email),
                getReferralConfig()
            ]);
            setReferrals(list);
            setConfig(cfg);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    });

    // Fetch RP data
    onMount(async () => {
        const email = props.userProfile()?.email;
        if (email) {
            try {
                const [rp, history] = await Promise.all([
                    getUserRP(email),
                    getRPHistory(email, 20)
                ]);
                setUserRP(rp);
                setRPHistory(history);
            } catch (e) {
                console.error('Failed to load RP:', e);
            }
        }
    });

    const copyLink = () => {
        navigator.clipboard.writeText(referralUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(props.userProfile().referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const currentReferralCount = () => props.userProfile().referralCount || 0;

    const stats = () => {
        const cfg = config();
        if (!cfg) {
            return {
                level: 1,
                rank: { name: 'Novice', color: 'text-gray-400', gradient: 'from-gray-600 to-gray-500', icon: Users },
                progressPercent: 0,
                nextLevelRefs: 1,
                refsPerLevel: 1,
                refsToNext: 1,
                xpMultiplier: 1.0
            };
        }
        return getDynamicLevelData(currentReferralCount(), cfg);
    };

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
                                            navigator.clipboard.writeText(referralUrl());
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
                                                text: invitationMessage(),
                                                url: referralUrl()
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
                                    <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Reward Points</div>
                                    <div class="text-xl font-black text-amber-400">
                                        {userRP().totalRP.toLocaleString()} <span class="text-xs font-bold text-gray-600">RP</span>
                                    </div>
                                </div>
                            </div>

                            {/* Next Rank Teaser */}
                            <Show when={stats().level < 100}>
                                <div class="mt-4 p-3 rounded-xl bg-white/[0.02] border border-dashed border-white/10 text-center">
                                    <p class="text-[10px] text-gray-400">
                                        Next Major Rank: <span class="font-bold text-white">{(config()?.ranks || []).find(r => r.minLvl > stats().level)?.name || 'Max'}</span>
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
                                                <th class="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-widest">Contact Info</th>
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
                                                            <div class="space-y-1">
                                                                <Show when={ref.phone}>
                                                                    <div class="text-[10px] font-mono text-gray-400">{ref.phone}</div>
                                                                </Show>
                                                                <div class="text-[9px] font-mono text-gray-600 truncate max-w-[160px]">{ref.email}</div>
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

                {/* RP (Reward Points) Section */}
                <div class="space-y-6">
                    <div class="flex items-center justify-between px-2">
                        <h3 class="text-xl font-black text-white italic uppercase tracking-tight">REWARD <span class="text-amber-400">POINTS</span></h3>
                        <div class="flex items-center gap-2">
                            <span class="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-black text-amber-400 uppercase tracking-widest">
                                {userRP().totalRP.toLocaleString()} RP
                            </span>
                        </div>
                    </div>

                    {/* RP Summary Cards */}
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div class="bg-[#111113] border border-amber-500/10 rounded-[24px] p-6 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 blur-[30px]" />
                            <div class="relative z-10">
                                <div class="text-[9px] font-black text-amber-500/60 uppercase tracking-widest mb-2">Total Earned</div>
                                <div class="text-2xl font-black text-amber-400">{userRP().totalRP.toLocaleString()}</div>
                                <div class="text-[10px] font-bold text-gray-600 mt-1">Reward Points</div>
                            </div>
                        </div>
                        <div class="bg-[#111113] border border-emerald-500/10 rounded-[24px] p-6 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 blur-[30px]" />
                            <div class="relative z-10">
                                <div class="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-2">Available</div>
                                <div class="text-2xl font-black text-emerald-400">{userRP().availableRP.toLocaleString()}</div>
                                <div class="text-[10px] font-bold text-gray-600 mt-1">Claimable Points</div>
                            </div>
                        </div>
                        <div class="bg-[#111113] border border-blue-500/10 rounded-[24px] p-6 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 blur-[30px]" />
                            <div class="relative z-10">
                                <div class="text-[9px] font-black text-blue-500/60 uppercase tracking-widest mb-2">Claimed</div>
                                <div class="text-2xl font-black text-blue-400">{userRP().claimedRP.toLocaleString()}</div>
                                <div class="text-[10px] font-bold text-gray-600 mt-1">Converted to VCN</div>
                            </div>
                        </div>
                    </div>

                    {/* How RP Works */}
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-5 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                <UserPlus class="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <div class="text-xs font-black text-white uppercase tracking-wider mb-1">Per Referral</div>
                                <div class="text-lg font-black text-amber-400">+10 RP</div>
                                <p class="text-[10px] text-gray-500 mt-1">Earned for each new user you invite</p>
                            </div>
                        </div>
                        <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-5 flex items-start gap-4">
                            <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                <Trophy class="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <div class="text-xs font-black text-white uppercase tracking-wider mb-1">Level-Up Bonus</div>
                                <div class="text-lg font-black text-purple-400">+100 RP</div>
                                <p class="text-[10px] text-gray-500 mt-1">Every 10 levels (LVL 10, 20, 30...)</p>
                            </div>
                        </div>
                    </div>

                    {/* RP History List */}
                    <Show when={rpHistory().length > 0}>
                        <div class="bg-[#111113] border border-white/[0.08] rounded-[32px] overflow-hidden">
                            <div class="p-5 border-b border-white/5">
                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Recent Activity</div>
                            </div>
                            <div class="divide-y divide-white/[0.03]">
                                <For each={rpHistory()}>
                                    {(entry) => (
                                        <div class="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                            <div class="flex items-center gap-3">
                                                <div class={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.type === 'referral' ? 'bg-amber-500/10' : 'bg-purple-500/10'
                                                    }`}>
                                                    {entry.type === 'referral'
                                                        ? <UserPlus class="w-4 h-4 text-amber-400" />
                                                        : <Trophy class="w-4 h-4 text-purple-400" />
                                                    }
                                                </div>
                                                <div>
                                                    <div class="text-xs font-bold text-gray-200">
                                                        {entry.type === 'referral' ? 'Referral Bonus' : 'Level-Up Bonus'}
                                                    </div>
                                                    <div class="text-[10px] text-gray-600 font-mono truncate max-w-[200px]">
                                                        {entry.source}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <div class={`text-sm font-black ${entry.type === 'referral' ? 'text-amber-400' : 'text-purple-400'}`}>
                                                    +{entry.amount} RP
                                                </div>
                                                <div class="text-[9px] text-gray-600">
                                                    {new Date(entry.timestamp).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </Show>
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
