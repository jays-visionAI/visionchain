import { createSignal, onMount, For, Show, createEffect, onCleanup } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    Trophy,
    Zap,
    Timer,
    ChevronUp,
    ChevronDown,
    Star,
    Crown,
    Users,
    ArrowUpRight,
    TrendingUp
} from 'lucide-solid';

interface LeaderboardUser {
    rank: number;
    name: string;
    email: string;
    invites: number;
    isCurrentUser?: boolean;
}

export const ReferralLeaderboard = (props: { currentUserEmail: string }) => {
    const [timeLeft, setTimeLeft] = createSignal('');
    const [mockData, setMockData] = createSignal<LeaderboardUser[]>([]);
    const [currentUserRank, setCurrentUserRank] = createSignal(12);

    // Countdown logic for 4-hour cycles
    const updateCountdown = () => {
        const now = new Date();
        const hour = now.getUTCHours();
        const nextTargetHour = Math.ceil((hour + 0.1) / 4) * 4;

        const target = new Date(now);
        target.setUTCHours(nextTargetHour, 0, 0, 0);

        const diff = target.getTime() - now.getTime();
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    onMount(() => {
        const timer = setInterval(updateCountdown, 1000);
        updateCountdown();

        // Mock data generation
        const data: LeaderboardUser[] = [
            { rank: 1, name: "CryptoKing", email: "ck@example.com", invites: 42 },
            { rank: 2, name: "Visionary", email: "v@example.com", invites: 28 },
            { rank: 3, name: "EarlyAdopter", email: "ea@example.com", invites: 19 },
            // ... padding for neighbors
            { rank: 7, name: "User_007", email: "u7@example.com", invites: 12 },
            { rank: 8, name: "AlphaNode", email: "an@example.com", invites: 11 },
            { rank: 9, name: "ChainRunner", email: "cr@example.com", invites: 10 },
            { rank: 10, name: "Web3Master", email: "w3m@example.com", invites: 9 },
            { rank: 11, name: "Satoshi_N", email: "sn@example.com", invites: 8 },
            { rank: 12, name: "Me (You)", email: props.currentUserEmail, invites: 7, isCurrentUser: true },
            { rank: 13, name: "NodeHacker", email: "nh@example.com", invites: 6 },
            { rank: 14, name: "DeFiLover", email: "dl@example.com", invites: 5 },
            { rank: 15, name: "VCN_Bull", email: "vb@example.com", invites: 4 },
            { rank: 16, name: "MetaTrader", email: "mt@example.com", invites: 3 },
            { rank: 17, name: "TechEnthusiast", email: "te@example.com", invites: 2 },
        ];
        setMockData(data);

        onCleanup(() => clearInterval(timer));
    });

    const topThree = () => mockData().slice(0, 3);
    const neighbors = () => {
        const userIdx = mockData().findIndex(u => u.isCurrentUser);
        if (userIdx === -1) return [];
        return mockData().slice(Math.max(3, userIdx - 5), Math.min(mockData().length, userIdx + 6));
    };

    const getMultiplier = (rank: number) => {
        if (rank === 1) return 100;
        if (rank === 2) return 50;
        if (rank === 3) return 30;
        return 0;
    };

    return (
        <div class="mb-16 space-y-8">
            {/* Header & Timer */}
            <div class="flex flex-col md:flex-row items-center justify-between gap-6">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-lg shadow-amber-500/5">
                        <Trophy class="w-6 h-6" />
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-white italic uppercase tracking-tight">Referral Rush</h2>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black text-amber-500/80 uppercase tracking-widest">Flash Sprint Sprint</span>
                            <div class="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-6 bg-white/[0.02] border border-white/[0.06] px-6 py-3 rounded-2xl backdrop-blur-md">
                    <div class="flex items-center gap-3">
                        <Timer class="w-4 h-4 text-blue-400" />
                        <div class="flex flex-col">
                            <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Round Ends In</span>
                            <span class="text-lg font-black text-white font-mono tracking-wider">{timeLeft()}</span>
                        </div>
                    </div>
                    <div class="w-px h-8 bg-white/10" />
                    <div class="flex flex-col">
                        <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Current Multiplier</span>
                        <span class="text-lg font-black text-blue-400 font-mono tracking-wider">UP TO 100X</span>
                    </div>
                </div>
            </div>

            {/* Podium Section */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-12">
                {/* 2nd Place */}
                <Show when={topThree()[1]}>
                    <div class="relative group order-2 md:order-1">
                        <div class="absolute -top-12 left-1/2 -translate-x-1/2 text-center w-full">
                            <div class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Silver Runner</div>
                            <div class="text-xs font-bold text-white mb-2">{topThree()[1].name}</div>
                        </div>
                        <div class="bg-gradient-to-t from-gray-500/20 to-transparent border-x border-t border-white/10 rounded-t-[32px] p-6 h-40 flex flex-col items-center justify-center gap-2 group-hover:border-white/20 transition-all">
                            <div class="w-14 h-14 rounded-2xl bg-gray-400/10 border border-gray-400/20 flex items-center justify-center text-gray-400">
                                <span class="text-2xl font-black">2</span>
                            </div>
                            <div class="text-center">
                                <div class="text-xl font-black text-white">{topThree()[1].invites} <span class="text-[10px] text-gray-500">INVITES</span></div>
                                <div class="text-[11px] font-black text-blue-400">+{topThree()[1].invites * 50} VCN</div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* 1st Place */}
                <Show when={topThree()[0]}>
                    <div class="relative group z-10 order-1 md:order-2">
                        <div class="absolute -top-16 left-1/2 -translate-x-1/2 text-center w-full">
                            <Crown class="w-8 h-8 text-amber-500 mx-auto mb-2 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-bounce" />
                            <div class="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em] mb-1">Current Leader</div>
                            <div class="text-sm font-black text-white mb-2">{topThree()[0].name}</div>
                        </div>
                        <div class="bg-gradient-to-t from-amber-500/20 to-transparent border-x border-t border-amber-500/30 rounded-t-[40px] p-8 h-56 flex flex-col items-center justify-center gap-3 group-hover:border-amber-500/50 transition-all shadow-[0_-20px_40px_-15px_rgba(245,158,11,0.1)]">
                            <div class="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-500/20">
                                <span class="text-3xl font-black italic">1</span>
                            </div>
                            <div class="text-center">
                                <div class="text-3xl font-black text-white tracking-tighter">{topThree()[0].invites} <span class="text-xs text-gray-500">INVITES</span></div>
                                <div class="text-sm font-black text-amber-400 leading-none mt-1">+{topThree()[0].invites * 100} VCN REWARD</div>
                            </div>
                        </div>
                        <div class="absolute inset-0 bg-amber-500/5 blur-3xl rounded-full -z-10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </Show>

                {/* 3rd Place */}
                <Show when={topThree()[2]}>
                    <div class="relative group order-3">
                        <div class="absolute -top-12 left-1/2 -translate-x-1/2 text-center w-full">
                            <div class="text-[10px] font-black text-orange-400/60 uppercase tracking-[0.2em] mb-1">Bronze Sprinter</div>
                            <div class="text-xs font-bold text-white mb-2">{topThree()[2].name}</div>
                        </div>
                        <div class="bg-gradient-to-t from-orange-900/20 to-transparent border-x border-t border-white/10 rounded-t-[32px] p-6 h-32 flex flex-col items-center justify-center gap-2 group-hover:border-white/20 transition-all">
                            <div class="w-12 h-12 rounded-2xl bg-orange-900/20 border border-orange-900/40 flex items-center justify-center text-orange-600">
                                <span class="text-xl font-black">3</span>
                            </div>
                            <div class="text-center">
                                <div class="text-lg font-black text-white">{topThree()[2].invites} <span class="text-[10px] text-gray-500">INVITES</span></div>
                                <div class="text-[10px] font-black text-blue-400">+{topThree()[2].invites * 30} VCN</div>
                            </div>
                        </div>
                    </div>
                </Show>
            </div>

            {/* Neighborhood View & Milestones */}
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Milestone Targets */}
                <div class="bg-[#0d0d0f] border border-white/[0.06] rounded-[32px] p-8 flex flex-col justify-center">
                    <div class="flex items-center gap-3 mb-8">
                        <Zap class="w-5 h-5 text-blue-400" />
                        <h3 class="text-sm font-black text-white uppercase tracking-widest italic">Personal Milestones</h3>
                    </div>

                    <div class="space-y-10 relative px-4">
                        {/* Milestone Line */}
                        <div class="absolute left-6 top-2 bottom-2 w-0.5 bg-white/5" />

                        {[3, 6, 9].map((m, i) => {
                            const invited = mockData().find(u => u.isCurrentUser)?.invites || 0;
                            const isAchieved = invited >= m;
                            const bonus = i === 0 ? 50 : i === 1 ? 150 : 400;

                            return (
                                <div class="relative flex items-center gap-6 group">
                                    <div class={`w-4 h-4 rounded-full z-10 border-4 ${isAchieved ? 'bg-blue-500 border-blue-500/20 shadow-[0_0_10px_#3b82f6]' : 'bg-gray-800 border-black'} transition-all`} />
                                    <div class={`flex-1 p-4 rounded-2xl border transition-all ${isAchieved ? 'bg-blue-500/5 border-blue-500/20' : 'bg-white/[0.02] border-white/5 opacity-40'}`}>
                                        <div class="flex items-center justify-between">
                                            <div>
                                                <div class="text-xs font-black text-white uppercase tracking-tight">{m} Successful Invites</div>
                                                <div class={`text-[10px] font-black uppercase tracking-widest ${isAchieved ? 'text-blue-400' : 'text-gray-600'}`}>Reward: +{bonus} VCN</div>
                                            </div>
                                            <Show when={isAchieved}>
                                                <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                                    <Star class="w-4 h-4 fill-current text-blue-400" />
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Neighboring Rankings */}
                <div class="bg-[#0d0d0f] border border-white/[0.06] rounded-[32px] overflow-hidden">
                    <div class="px-8 py-6 border-b border-white/[0.06] bg-white/[0.01]">
                        <h3 class="text-sm font-black text-white uppercase tracking-widest italic flex items-center gap-3">
                            <Users class="w-4 h-4 text-gray-500" />
                            Live Rankings Around You
                        </h3>
                    </div>
                    <div class="divide-y divide-white/[0.04]">
                        <For each={neighbors()}>
                            {(user) => (
                                <div class={`px-8 py-4 flex items-center justify-between transition-all ${user.isCurrentUser ? 'bg-blue-600/10 border-y border-blue-600/20' : 'hover:bg-white/[0.02]'}`}>
                                    <div class="flex items-center gap-4">
                                        <span class={`text-sm font-black font-mono w-6 ${user.isCurrentUser ? 'text-blue-400' : 'text-gray-600'}`}>
                                            #{user.rank}
                                        </span>
                                        <div>
                                            <div class={`text-sm font-bold ${user.isCurrentUser ? 'text-white' : 'text-gray-400'}`}>{user.name}</div>
                                            <div class="text-[9px] font-bold text-gray-600 uppercase tracking-widest">{user.email.substring(0, 4)}***</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-black text-white">{user.invites}</div>
                                        <div class="text-[9px] font-black text-gray-600 uppercase">Invites</div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </div>
        </div>
    );
};
