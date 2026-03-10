import { createSignal, onMount, For, Show, onCleanup } from 'solid-js';
import { Motion } from 'solid-motionone';
import { getFirebaseDb, getFirebaseAuth } from '../../services/firebaseService';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GameLeaderboardEntry {
    rank: number;
    email: string;
    displayName: string;
    totalVCN: number;
    totalRP: number;
    gamesPlayed: number;
    bestBlockTime: number;
    isCurrentUser: boolean;
}

// ─── SVG Icons (no emoji) ───────────────────────────────────────────────────

const TrophyIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
);

const ClockIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);

const StarIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="currentColor">
        <polygon points="12,2 15,9 22,9 16,14 18,22 12,17 6,22 8,14 2,9 9,9" />
    </svg>
);

const GamepadIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" />
        <line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" />
        <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
    </svg>
);

const CrownIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
    </svg>
);

const VcnCoinIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none">
        <circle cx="12" cy="12" r="10" fill="#F59E0B" opacity="0.2" />
        <circle cx="12" cy="12" r="8" stroke="#F59E0B" stroke-width="1.5" />
        <text x="12" y="16" text-anchor="middle" fill="#F59E0B" font-size="10" font-weight="bold">V</text>
    </svg>
);

const UsersIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const FireIcon = (p: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={p.class} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
);

// ─── Helper ─────────────────────────────────────────────────────────────────

function getTodayStr(): string {
    return new Date().toISOString().split('T')[0];
}

// ─── Component ──────────────────────────────────────────────────────────────

export const GameDailyLeaderboard = (props: {
    currentUserEmail: string;
    onUserStats?: (rank: number | null, totalVCN: number, totalRP: number) => void;
}) => {
    const [entries, setEntries] = createSignal<GameLeaderboardEntry[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [timeLeft, setTimeLeft] = createSignal('--:--:--');
    const [totalParticipants, setTotalParticipants] = createSignal(0);
    const [totalVCNDistributed, setTotalVCNDistributed] = createSignal(0);

    // ─── Countdown to next day (UTC midnight) ───────────────────────
    const updateCountdown = () => {
        const now = new Date();
        const nextDay = new Date();
        nextDay.setUTCDate(now.getUTCDate() + 1);
        nextDay.setUTCHours(0, 0, 0, 0);

        const diff = nextDay.getTime() - now.getTime();
        if (diff <= 0) {
            setTimeLeft('00:00:00');
            return;
        }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };

    // ─── Fetch today's leaderboard ──────────────────────────────────
    const fetchLeaderboard = async () => {
        try {
            const db = getFirebaseDb();
            const today = getTodayStr();

            // Query all game plays for today
            const q = query(
                collection(db, 'mini_game_plays'),
                where('date', '==', today),
            );
            const snap = await getDocs(q);

            const rawEntries: GameLeaderboardEntry[] = [];
            let totalVCN = 0;

            snap.forEach(doc => {
                const data = doc.data();
                const email = doc.id.replace(`${today}_`, '');
                const vcn = data.totalVCN || 0;
                const rp = data.totalRP || 0;
                const gamesPlayed = (data.games || []).length || (data.spinsUsed || 0) + (data.blocksUsed || 0);
                const bestBlockTime = data.bestBlockTime || 0;

                totalVCN += vcn;

                rawEntries.push({
                    rank: 0,
                    email,
                    displayName: email.split('@')[0].toUpperCase(),
                    totalVCN: vcn,
                    totalRP: rp,
                    gamesPlayed,
                    bestBlockTime,
                    isCurrentUser: (props.currentUserEmail || '').toLowerCase() === email.toLowerCase(),
                });
            });

            // Sort by total VCN earned (descending), then by RP as tiebreaker
            rawEntries.sort((a, b) => {
                if (b.totalVCN !== a.totalVCN) return b.totalVCN - a.totalVCN;
                return b.totalRP - a.totalRP;
            });

            // Assign ranks
            rawEntries.forEach((entry, idx) => {
                entry.rank = idx + 1;
            });

            setEntries(rawEntries);
            setTotalParticipants(rawEntries.length);
            setTotalVCNDistributed(parseFloat(totalVCN.toFixed(1)));

            // Report user stats
            const currentUser = rawEntries.find(e => e.isCurrentUser);
            if (props.onUserStats) {
                props.onUserStats(
                    currentUser ? currentUser.rank : null,
                    currentUser ? currentUser.totalVCN : 0,
                    currentUser ? currentUser.totalRP : 0,
                );
            }
        } catch (e) {
            console.error('[GameLeaderboard] Failed to fetch:', e);
        } finally {
            setLoading(false);
        }
    };

    // ─── Display data (top 10 + current user if not in top 10) ─────
    const displayData = () => {
        const full = entries();
        const top = full.slice(0, 10);
        const userIdx = full.findIndex(u => u.isCurrentUser);

        if (userIdx > 9) {
            const neighbors = full.slice(Math.max(10, userIdx - 2), Math.min(full.length, userIdx + 3));
            return [...top, ...neighbors];
        }

        return top;
    };

    // ─── Rank styling ───────────────────────────────────────────────
    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 1: return "bg-gradient-to-r from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]";
            case 2: return "bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)]";
            case 3: return "bg-gradient-to-r from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.1)]";
            default: return "bg-white/[0.02] border-white/[0.06] text-gray-400";
        }
    };

    const getBadge = (rank: number) => {
        if (rank === 1) return { label: 'MVP', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' };
        if (rank === 2) return { label: 'TOP 2', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
        if (rank === 3) return { label: 'TOP 3', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' };
        return null;
    };

    onMount(async () => {
        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);

        await fetchLeaderboard();

        // Refresh every 30s
        const dataTimer = setInterval(fetchLeaderboard, 30000);

        onCleanup(() => {
            clearInterval(timer);
            clearInterval(dataTimer);
        });
    });

    // ─── Render ─────────────────────────────────────────────────────

    const renderRow = (entry: GameLeaderboardEntry, index: () => number) => {
        const badge = getBadge(entry.rank);
        return (
            <Motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index() * 0.05 }}
                class={`relative flex items-center gap-2 sm:gap-5 p-3 sm:p-4 rounded-[24px] sm:rounded-[28px] border overflow-hidden transition-all hover:scale-[1.02] ${getRankStyle(entry.rank)} ${entry.isCurrentUser ? 'ring-2 ring-amber-500/50' : ''}`}
            >
                {/* Rank */}
                <div class="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-black/20 font-black text-sm sm:text-xl italic select-none">
                    {entry.rank === 1 ? <CrownIcon class="w-4 h-4 sm:w-6 sm:h-6 text-amber-500" /> : entry.rank}
                </div>

                {/* Avatar + Name */}
                <div class="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                    <div class="w-8 h-8 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] sm:text-xs font-black text-gray-300 flex-shrink-0">
                        {(entry.displayName || 'U').substring(0, 2)}
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span class="font-black text-white tracking-tight uppercase text-[11px] sm:text-sm truncate">{entry.displayName}</span>
                            <Show when={entry.isCurrentUser}>
                                <span class="px-1.5 py-0.5 bg-amber-500 text-[7px] sm:text-[8px] font-black rounded text-black uppercase tracking-widest whitespace-nowrap">You</span>
                            </Show>
                            <Show when={badge}>
                                <span class={`px-1.5 py-0.5 text-[7px] sm:text-[8px] font-black rounded border uppercase tracking-widest whitespace-nowrap ${badge?.color}`}>{badge?.label}</span>
                            </Show>
                        </div>
                        <div class="text-[8px] sm:text-[10px] font-bold text-gray-500 tracking-wider">
                            {entry.gamesPlayed} game{entry.gamesPlayed !== 1 ? 's' : ''} played
                            {entry.bestBlockTime > 0 ? ` · Best: ${entry.bestBlockTime.toFixed(1)}s` : ''}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div class="flex items-center gap-3 sm:gap-6 pr-1 sm:pr-4">
                    <div class="text-right whitespace-nowrap">
                        <div class="text-[8px] sm:text-[9px] font-black text-gray-600 uppercase tracking-widest">VCN</div>
                        <div class={`text-[14px] sm:text-lg font-black font-mono ${entry.rank <= 3 ? 'text-amber-400' : 'text-white'}`}>{entry.totalVCN.toFixed(1)}</div>
                    </div>
                    <div class="text-right whitespace-nowrap">
                        <div class="text-[8px] sm:text-[9px] font-black text-gray-600 uppercase tracking-widest">RP</div>
                        <div class="text-[14px] sm:text-lg font-black text-purple-400 font-mono">{entry.totalRP}</div>
                    </div>
                </div>

                {/* Background glow for top 3 */}
                <Show when={entry.rank <= 3}>
                    <div class={`absolute top-0 right-0 w-32 h-32 blur-[40px] -mr-16 -mt-16 opacity-30 ${entry.rank === 1 ? 'bg-amber-500' :
                        entry.rank === 2 ? 'bg-cyan-500' : 'bg-rose-500'
                        }`} />
                </Show>
            </Motion.div>
        );
    };

    return (
        <div class="mb-20 space-y-10">
            {/* ─── Header Banner ─── */}
            <div class="relative flex flex-col items-center py-8">
                <div class="absolute inset-0 bg-amber-600/5 blur-[100px] rounded-full" />

                {/* Title Ribbon */}
                <div class="relative z-10 scale-110 mb-4">
                    <svg width="340" height="60" viewBox="0 0 340 60" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                        <path d="M20 10H320L340 30L320 50H20L0 30L20 10Z" fill="#92400E" />
                        <path d="M30 0H310L330 30L310 60H30L10 30L30 0Z" fill="#D97706" />
                        <text x="170" y="38" text-anchor="middle" fill="white" font-weight="900" font-size="14" font-style="italic" letter-spacing="0.15em">
                            DAILY GAME LEADERBOARD
                        </text>
                    </svg>
                </div>

                {/* Info Bar */}
                <div class="flex flex-wrap items-center justify-center gap-4 sm:gap-8 bg-black/40 backdrop-blur-xl border border-white/5 px-6 sm:px-8 py-3 rounded-2xl relative z-10">
                    <div class="flex items-center gap-3">
                        <ClockIcon class="w-4 h-4 text-amber-400" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Resets In:</span>
                        <span class="text-sm font-black text-white font-mono">{timeLeft()}</span>
                    </div>
                    <div class="w-px h-4 bg-white/10 hidden sm:block" />
                    <div class="flex items-center gap-2">
                        <UsersIcon class="w-4 h-4 text-cyan-400" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Players:</span>
                        <span class="text-sm font-black text-cyan-400">{totalParticipants()}</span>
                    </div>
                    <div class="w-px h-4 bg-white/10 hidden sm:block" />
                    <div class="flex items-center gap-2">
                        <VcnCoinIcon class="w-5 h-5" />
                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Mined:</span>
                        <span class="text-sm font-black text-amber-400">{totalVCNDistributed()} VCN</span>
                    </div>
                </div>
            </div>

            {/* ─── Loading State ─── */}
            <Show when={loading()}>
                <div class="py-12 text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center animate-pulse">
                        <GamepadIcon class="w-8 h-8 text-amber-400" />
                    </div>
                    <p class="text-gray-400 text-sm">Loading today's leaderboard...</p>
                </div>
            </Show>

            {/* ─── Empty State ─── */}
            <Show when={!loading() && entries().length === 0}>
                <div class="py-16 text-center">
                    <div class="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <GamepadIcon class="w-10 h-10 text-gray-600" />
                    </div>
                    <h3 class="text-xl font-black text-white uppercase italic tracking-tight mb-2">No Players Today Yet</h3>
                    <p class="text-gray-500 text-sm max-w-sm mx-auto">Be the first to play today's mini-games and claim the top spot on the leaderboard!</p>
                </div>
            </Show>

            {/* ─── Leaderboard ─── */}
            <Show when={!loading() && entries().length > 0}>
                <div class="max-w-3xl mx-auto space-y-4">
                    <For each={displayData()}>
                        {(entry, i) => renderRow(entry, i)}
                    </For>
                </div>

                {/* ─── How It Works ─── */}
                <div class="max-w-3xl mx-auto pt-8 border-t border-white/5">
                    <div class="flex items-center justify-between mb-8">
                        <h3 class="text-xs font-black text-white uppercase tracking-[0.3em] italic flex items-center gap-3">
                            <FireIcon class="w-4 h-4 text-amber-400" />
                            How Daily Games Work
                        </h3>
                        <div class="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-gray-500 uppercase tracking-widest">Daily Reset</div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-5 rounded-[24px] border bg-white/[0.02] border-white/5">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-amber-500/10 text-amber-400 mb-3">1</div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Play Daily Games</div>
                            <div class="text-sm text-white">Spin the Lucky Wheel and break blocks each day</div>
                        </div>
                        <div class="p-5 rounded-[24px] border bg-white/[0.02] border-white/5">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-cyan-500/10 text-cyan-400 mb-3">2</div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Earn VCN & RP</div>
                            <div class="text-sm text-white">Accumulate rewards through lucky spins and block breaks</div>
                        </div>
                        <div class="p-5 rounded-[24px] border bg-white/[0.02] border-white/5">
                            <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black bg-rose-500/10 text-rose-400 mb-3">3</div>
                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Climb the Ranks</div>
                            <div class="text-sm text-white">Top players get featured on the daily leaderboard</div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};

export default GameDailyLeaderboard;
