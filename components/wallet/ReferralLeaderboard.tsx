import { createSignal, onMount, For, Show, onCleanup } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Trophy,
    Zap,
    Timer,
    Star,
    Crown,
    History,
    Percent
} from 'lucide-solid';
import {
    getRoundLeaderboard,
    getCurrentRound,
    calculateCurrentRoundId,
    type ReferralRound,
    type RoundParticipant
} from '../../services/firebaseService';

interface LeaderboardUser {
    rank: number;
    name: string;
    email: string;
    invites: number;
    contributionRate: number;
    estimatedReward: number;
    isCurrentUser?: boolean;
}

export const ReferralLeaderboard = (props: { currentUserEmail: string }) => {
    const [timeLeft, setTimeLeft] = createSignal('--:--:--');
    const [leaderboardData, setLeaderboardData] = createSignal<LeaderboardUser[]>([]);
    const [currentRound, setCurrentRound] = createSignal<ReferralRound | null>(null);
    const [activeTab, setActiveTab] = createSignal<'current' | 'history'>('current');

    const updateCountdown = () => {
        const now = new Date();
        const nextPayout = new Date();
        // Set to next midnight UTC (daily round)
        nextPayout.setUTCDate(now.getUTCDate() + 1);
        nextPayout.setUTCHours(0, 0, 0, 0);

        const diff = nextPayout.getTime() - now.getTime();
        if (diff <= 0) {
            setTimeLeft('00:00:00');
            return;
        }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    const fetchRoundData = async () => {
        try {
            const { round, participants } = await getRoundLeaderboard();
            setCurrentRound(round);

            const formatted: LeaderboardUser[] = participants.map((p, index) => ({
                rank: index + 1,
                name: p.referrerId.split('@')[0].toUpperCase(),
                email: p.referrerId,
                invites: p.inviteCount,
                contributionRate: p.contributionRate,
                estimatedReward: p.estimatedReward,
                isCurrentUser: (props.currentUserEmail || '').toLowerCase() === p.referrerId.toLowerCase()
            }));

            setLeaderboardData(formatted);
        } catch (e) {
            console.error('Failed to fetch round data:', e);
        }
    };

    onMount(async () => {
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);

        await fetchRoundData();

        // Refresh data every 30 seconds
        const dataTimer = setInterval(fetchRoundData, 30000);

        onCleanup(() => {
            clearInterval(timer);
            clearInterval(dataTimer);
        });
    });

    const displayData = () => {
        const full = leaderboardData();
        const top3 = full.slice(0, 3);
        const userIdx = full.findIndex(u => u.isCurrentUser);

        if (userIdx > 2) {
            const neighbors = full.slice(Math.max(3, userIdx - 5), Math.min(full.length, userIdx + 6));
            return [...top3, ...neighbors];
        }

        return full.slice(0, 10);
    };

    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1: return "bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]";
            case 2: return "bg-gradient-to-r from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.1)]";
            case 3: return "bg-gradient-to-r from-purple-500/20 to-purple-500/5 border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.1)]";
            default: return "bg-white/[0.02] border-white/[0.06] text-gray-400";
        }
    };

    const getNftBadge = (rank: number) => {
        if (rank === 1) return { label: 'GOLD NFT', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
        if (rank === 2) return { label: 'SILVER NFT', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
        if (rank === 3) return { label: 'BRONZE NFT', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' };
        return null;
    };

    return (
        <div class="mb-20 space-y-12">
            {/* Header Section with Ribbon Style */}
            <div class="relative flex flex-col items-center py-8">
                <div class="absolute inset-0 bg-blue-600/5 blur-[100px] rounded-full" />

                {/* Modern Ribbon */}
                <div class="relative z-10 scale-110 mb-4">
                    <svg width="320" height="60" viewBox="0 0 320 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                        <path d="M20 10H300L320 30L300 50H20L0 30L20 10Z" fill="#1e40af" />
                        <path d="M30 0H290L310 30L290 60H30L10 30L30 0Z" fill="#2563eb" />
                        <text x="160" y="38" text-anchor="middle" fill="white" font-weight="900" font-size="14" font-style="italic" letter-spacing="0.2em" filter="url(#glow)">
                            ROUND #{currentRound()?.roundId || calculateCurrentRoundId()}
                        </text>
                        <defs>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                <feMerge>
                                    <feMergeNode in="coloredBlur" />
                                    <feMergeNode in="SourceGraphic" />
                                </feMerge>
                            </filter>
                        </defs>
                    </svg>
                </div>

                {/* Round Info Bar */}
                <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-8 bg-black/40 backdrop-blur-xl border border-white/5 px-6 sm:px-8 py-3 rounded-2xl relative z-10">
                    <div class="flex items-center gap-3">
                        <Timer class="w-4 h-4 text-blue-400" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ends In:</span>
                        <span class="text-sm font-black text-white font-mono">{timeLeft()}</span>
                    </div>
                    <div class="w-px h-4 bg-white/10 hidden sm:block" />
                    <div class="flex items-center gap-2">
                        <Trophy class="w-4 h-4 text-amber-500" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pool:</span>
                        <span class="text-sm font-black text-amber-500">{(currentRound()?.totalRewardPool || 1000).toLocaleString()} VCN</span>
                    </div>
                    <div class="w-px h-4 bg-white/10 hidden sm:block" />
                    <div class="flex items-center gap-2">
                        <Percent class="w-4 h-4 text-emerald-400" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Rate-Based</span>
                    </div>
                </div>
            </div>

            {/* Tab Selector */}
            <div class="max-w-3xl mx-auto flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('current')}
                    class={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab() === 'current'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                    Current Round
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    class={`flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab() === 'history'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                    <History class="w-4 h-4" /> Past Rounds
                </button>
            </div>

            <Show when={activeTab() === 'current'}>
                <div class="max-w-3xl mx-auto space-y-4">
                    <Show when={leaderboardData().length === 0}>
                        <div class="py-12 text-center">
                            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                                <Trophy class="w-8 h-8 text-gray-600" />
                            </div>
                            <p class="text-gray-500 text-sm">No participants yet in this round</p>
                            <p class="text-gray-600 text-xs mt-2">Be the first to invite friends!</p>
                        </div>
                    </Show>

                    <For each={displayData()}>
                        {(user, i) => {
                            const nft = getNftBadge(user.rank);
                            return (
                                <Motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i() * 0.05 }}
                                    class={`relative flex items-center gap-2 sm:gap-6 p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] border overflow-hidden transition-all hover:scale-[1.02] ${getRankStyle(user.rank)} ${user.isCurrentUser ? 'ring-2 ring-blue-500/50' : ''}`}
                                >
                                    {/* Rank Number Area */}
                                    <div class="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-black/20 font-black text-sm sm:text-xl italic select-none">
                                        {user.rank === 1 ? <Crown class="w-4 h-4 sm:w-6 sm:h-6 text-amber-500" /> : user.rank}
                                    </div>

                                    {/* User Info */}
                                    <div class="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                                        <div class="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] sm:text-xs font-black text-gray-300 flex-shrink-0">
                                            {(user.name || 'U').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                <span class="font-black text-white tracking-tight uppercase text-[11px] sm:text-sm truncate">{user.name}</span>
                                                <Show when={user.isCurrentUser}>
                                                    <span class="px-1.5 py-0.5 bg-blue-500 text-[7px] sm:text-[8px] font-black rounded text-white uppercase tracking-widest whitespace-nowrap">You</span>
                                                </Show>
                                                <Show when={nft}>
                                                    <span class={`px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black rounded border uppercase tracking-widest whitespace-nowrap ${nft?.color}`}>{nft?.label}</span>
                                                </Show>
                                            </div>
                                            <div class="text-[8px] sm:text-[10px] font-bold text-gray-500 tracking-wider">CONTRIBUTION: {(user.contributionRate * 100).toFixed(1)}%</div>
                                        </div>
                                    </div>

                                    {/* Stats & Rewards */}
                                    <div class="flex items-center gap-4 sm:gap-8 pr-1 sm:pr-4">
                                        <div class="text-right whitespace-nowrap">
                                            <div class="text-[8px] sm:text-[9px] font-black text-gray-600 uppercase tracking-widest">Invites</div>
                                            <div class="text-[14px] sm:text-lg font-black text-white font-mono">{user.invites}</div>
                                        </div>
                                        <div class="text-right min-w-[70px] sm:min-w-[100px] whitespace-nowrap">
                                            <div class="text-[8px] sm:text-[9px] font-black text-gray-600 uppercase tracking-widest">Est. Reward</div>
                                            <div class={`text-[14px] sm:text-lg font-black font-mono ${user.rank <= 3 ? 'text-emerald-400' : 'text-gray-400'}`}>
                                                {user.estimatedReward.toLocaleString()} VCN
                                            </div>
                                        </div>
                                    </div>

                                    {/* Background Accents for Top 3 */}
                                    <Show when={user.rank <= 3}>
                                        <div class={`absolute top-0 right-0 w-32 h-32 blur-[40px] -mr-16 -mt-16 opacity-30 ${user.rank === 1 ? 'bg-amber-500' :
                                            user.rank === 2 ? 'bg-blue-500' : 'bg-purple-500'
                                            }`} />
                                    </Show>
                                </Motion.div>
                            );
                        }}
                    </For>
                </div>

                {/* How It Works */}
                <div class="max-w-3xl mx-auto pt-8 border-t border-white/5">
                    <div class="flex items-center justify-between mb-8">
                        <h3 class="text-xs font-black text-white uppercase tracking-[0.3em] italic flex items-center gap-3">
                            <Zap class="w-4 h-4 text-blue-400" />
                            How Rewards Work
                        </h3>
                        <div class="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-widest">Contribution Rate</div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-5 rounded-[24px] border bg-white/[0.02] border-white/5">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-blue-500/10 text-blue-400 mb-3">1</div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Invite Friends</div>
                            <div class="text-sm text-white">Each referral increases your contribution rate</div>
                        </div>
                        <div class="p-5 rounded-[24px] border bg-white/[0.02] border-white/5">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-emerald-500/10 text-emerald-400 mb-3">2</div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Earn Your Share</div>
                            <div class="text-sm text-white">Reward = Pool × Your Contribution %</div>
                        </div>
                        <div class="p-5 rounded-[24px] border bg-white/[0.02] border-white/5">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-amber-500/10 text-amber-400 mb-3">3</div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Top 3 NFT</div>
                            <div class="text-sm text-white">Gold, Silver, Bronze NFT for leaders</div>
                        </div>
                    </div>
                </div>
            </Show>

            <Show when={activeTab() === 'history'}>
                <div class="max-w-3xl mx-auto py-12 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
                        <History class="w-8 h-8 text-gray-600" />
                    </div>
                    <p class="text-gray-500 text-sm">Past rounds will appear here</p>
                    <p class="text-gray-600 text-xs mt-2">Complete rounds are archived for reference</p>
                </div>
            </Show>
        </div>
    );
};
