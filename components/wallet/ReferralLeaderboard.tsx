import { createSignal, onMount, For, Show, onCleanup } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    Trophy,
    Zap,
    Timer,
    Star,
    Crown,
    Users,
    ChevronRight
} from 'lucide-solid';

interface LeaderboardUser {
    rank: number;
    name: string;
    email: string;
    invites: number;
    isCurrentUser?: boolean;
}

export const ReferralLeaderboard = (props: { currentUserEmail: string }) => {
    const [timeLeft, setTimeLeft] = createSignal('--:--:--');

    // Better initial data strategy to ensure rendering
    const [mockData, setMockData] = createSignal<LeaderboardUser[]>([
        { rank: 1, name: "CryptoKing", email: "ck@example.com", invites: 156 },
        { rank: 2, name: "Visionary", email: "v@example.com", invites: 142 },
        { rank: 3, name: "EarlyAdopter", email: "ea@example.com", invites: 128 },
        { rank: 4, name: "NodeMaster", email: "nm@example.com", invites: 95 },
        { rank: 5, name: "Web3Whale", email: "ww@example.com", invites: 84 },
        { rank: 6, name: "AlphaNode", email: "an@example.com", invites: 72 },
        { rank: 7, name: "ChainRunner", email: "cr@example.com", invites: 61 },
        { rank: 8, name: "BlockHustler", email: "bh@example.com", invites: 55 },
        { rank: 9, name: "Satoshi_N", email: "sn@example.com", invites: 48 },
        { rank: 10, name: "DeepVCN", email: "dv@example.com", invites: 42 },
        { rank: 11, name: "LiquidMiner", email: "lm@example.com", invites: 38 },
        { rank: 35, name: "SwiftBot", email: "sb@example.com", invites: 12 },
        { rank: 36, name: "TrailBlazer", email: "tb@example.com", invites: 11 },
        { rank: 37, name: "Me (You)", email: props.currentUserEmail || 'user@example.com', invites: 10, isCurrentUser: true },
        { rank: 38, name: "NodeHacker", email: "nh@example.com", invites: 9 },
        { rank: 39, name: "DeFiLover", email: "dl@example.com", invites: 8 },
        { rank: 40, name: "GhostProtocol", email: "gp@example.com", invites: 7 },
        { rank: 41, name: "MetaSurfer", email: "ms@example.com", invites: 6 },
    ]);

    const updateCountdown = () => {
        const now = new Date();
        const nextPayout = new Date();
        // Set to next 4-hour mark (0, 4, 8, 12, 16, 20, 24)
        const nextHour = Math.ceil((now.getUTCHours() + 0.001) / 4) * 4;
        nextPayout.setUTCHours(nextHour, 0, 0, 0);

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

    onMount(() => {
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        onCleanup(() => clearInterval(timer));
    });

    const displayData = () => {
        const full = mockData();
        const top3 = full.slice(0, 3);
        const userIdx = full.findIndex(u => u.isCurrentUser);

        if (userIdx > 2) {
            // Focus on user: 5 neighbors above, 5 neighbors below
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

    const getMultiplier = (rank: number) => {
        if (rank === 1) return 100;
        if (rank === 2) return 50;
        if (rank === 3) return 30;
        return 0;
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
                            WINNER'S LEADERBOARD
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

                <div class="flex items-center gap-8 bg-black/40 backdrop-blur-xl border border-white/5 px-8 py-3 rounded-2xl relative z-10">
                    <div class="flex items-center gap-3">
                        <Timer class="w-4 h-4 text-blue-400" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Next Payout:</span>
                        <span class="text-sm font-black text-white font-mono">{timeLeft()}</span>
                    </div>
                    <div class="w-px h-4 bg-white/10" />
                    <div class="flex items-center gap-2">
                        <Trophy class="w-4 h-4 text-amber-500" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Multiplier:</span>
                        <span class="text-sm font-black text-amber-500">Up to 100x</span>
                    </div>
                </div>
            </div>

            <div class="max-w-3xl mx-auto space-y-4">
                <For each={displayData()}>
                    {(user, i) => (
                        <Motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i() * 0.05 }}
                            class={`relative flex items-center gap-6 p-4 rounded-[28px] border overflow-hidden transition-all hover:scale-[1.02] ${getRankStyle(user.rank)} ${user.isCurrentUser ? 'ring-2 ring-blue-500/50' : ''}`}
                        >
                            {/* Rank Number Area */}
                            <div class="flex items-center justify-center w-12 h-12 rounded-2xl bg-black/20 font-black text-xl italic select-none">
                                {user.rank === 1 ? <Crown class="w-6 h-6 text-amber-500" /> : user.rank}
                            </div>

                            {/* User Info */}
                            <div class="flex items-center gap-4 flex-1">
                                <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-gray-300">
                                    {(user.name || 'U').substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-black text-white tracking-tight uppercase text-sm">{user.name}</span>
                                        <Show when={user.isCurrentUser}>
                                            <span class="px-2 py-0.5 bg-blue-500 text-[8px] font-black rounded text-white uppercase tracking-widest">You</span>
                                        </Show>
                                    </div>
                                    <div class="text-[10px] font-bold text-gray-500 tracking-wider">NETWORK MEMBER</div>
                                </div>
                            </div>

                            {/* Stats & Rewards */}
                            <div class="flex items-center gap-8 pr-4">
                                <div class="text-right">
                                    <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Invites</div>
                                    <div class="text-lg font-black text-white font-mono">{user.invites}</div>
                                </div>
                                <div class="text-right min-w-[100px]">
                                    <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest">Est. Reward</div>
                                    <div class={`text-lg font-black font-mono ${user.rank <= 3 ? 'text-blue-400' : 'text-gray-400'}`}>
                                        <Show when={user.rank <= 3} fallback={`${user.invites * 5} VCN`}>
                                            {user.invites * getMultiplier(user.rank)} VCN
                                        </Show>
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
                    )}
                </For>
            </div>

            {/* Milestones Integrated Style */}
            <div class="max-w-3xl mx-auto pt-8 border-t border-white/5">
                <div class="flex items-center justify-between mb-8">
                    <h3 class="text-xs font-black text-white uppercase tracking-[0.3em] italic flex items-center gap-3">
                        <Zap class="w-4 h-4 text-blue-400" />
                        Bonus Milestones
                    </h3>
                    <div class="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-widest">Instant Pay</div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { count: 3, reward: 50, color: 'blue' },
                        { count: 6, reward: 150, color: 'purple' },
                        { count: 9, reward: 400, color: 'amber' }
                    ].map((m) => {
                        const invited = mockData().find(u => u.isCurrentUser)?.invites || 0;
                        const isAchieved = invited >= m.count;

                        return (
                            <div class={`p-5 rounded-[24px] border transition-all ${isAchieved ? 'bg-white/5 border-blue-500/30' : 'bg-white/[0.02] border-white/5 opacity-50'}`}>
                                <div class="flex items-center justify-between mb-2">
                                    <div class={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${isAchieved ? 'bg-blue-500 text-white' : 'bg-white/5 text-gray-600'}`}>
                                        {m.count}
                                    </div>
                                    <Show when={isAchieved}>
                                        <Star class="w-4 h-4 text-blue-400 fill-current" />
                                    </Show>
                                </div>
                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Target Invites</div>
                                <div class="text-lg font-black text-white italic">+{m.reward} VCN</div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
