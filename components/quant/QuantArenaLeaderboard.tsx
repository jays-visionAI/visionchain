import { createSignal, Show, For, onMount, onCleanup, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import {
    ArrowLeft,
    ChevronRight,
    RefreshCw,
    Info,
    X,
} from 'lucide-solid';
import type { Competition, CompetitionEntry, CompetitionDivision } from '../../services/quant/types';
import {
    getActiveCompetitions,
    getCompetitionLeaderboard,
    subscribeToLeaderboard,
} from '../../services/quant/paperTradingService';
import { getFirebaseAuth } from '../../services/firebaseService';

// ─── SVG Icons ────────────────────

const TrophyIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" class={props.class || "w-5 h-5"} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" /><path d="M10 22V9" /><path d="M14 22V9" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
);

const MedalIcon = (props: { rank: number; class?: string }) => {
    const colors = () => {
        switch (props.rank) {
            case 1: return { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
            case 2: return { bg: 'bg-gray-400/10', border: 'border-gray-400/25', text: 'text-gray-300', glow: 'shadow-gray-400/15' };
            case 3: return { bg: 'bg-orange-600/10', border: 'border-orange-600/25', text: 'text-orange-400', glow: 'shadow-orange-500/15' };
            default: return { bg: 'bg-white/[0.03]', border: 'border-white/[0.06]', text: 'text-gray-500', glow: '' };
        }
    };
    return (
        <div class={`w-7 h-7 rounded-full ${colors().bg} border ${colors().border} flex items-center justify-center ${colors().glow} ${props.rank <= 3 ? 'shadow-lg' : ''}`}>
            <span class={`text-[11px] font-black ${colors().text}`}>{props.rank}</span>
        </div>
    );
};

const ChartUpIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3v18h18" /><path d="m7 12 4-4 4 4 5-6" />
    </svg>
);

const SpotIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 6v12" /><path d="M8 10h8" /><path d="M8 14h8" />
    </svg>
);

const FuturesIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 20h20" /><path d="M5 20V8l4 4 4-8 4 6 3-2v12" />
    </svg>
);

// ─── Component ────────────────────

export const QuantArenaLeaderboard = (): JSX.Element => {
    const [competitions, setCompetitions] = createSignal<Competition[]>([]);
    const [activeDivision, setActiveDivision] = createSignal<CompetitionDivision>('spot');
    const [spotEntries, setSpotEntries] = createSignal<CompetitionEntry[]>([]);
    const [futuresEntries, setFuturesEntries] = createSignal<CompetitionEntry[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [showRules, setShowRules] = createSignal(false);

    const currentUserId = () => getFirebaseAuth().currentUser?.uid || '';

    const currentComp = createMemo(() => {
        const div = activeDivision();
        return competitions().find(c => c.division === div) || competitions()[0] || null;
    });

    const currentEntries = createMemo(() => {
        return activeDivision() === 'spot' ? spotEntries() : futuresEntries();
    });

    // Compute days progress
    const progress = createMemo(() => {
        const comp = currentComp();
        if (!comp) return { daysPassed: 0, totalDays: 10, percent: 0, remaining: '' };
        const start = new Date(comp.startDate).getTime();
        const end = new Date(comp.endDate).getTime();
        const now = Date.now();
        const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
        const daysPassed = Math.max(0, Math.ceil((now - start) / 86400000));
        const percent = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));

        const msLeft = Math.max(0, end - now);
        const dLeft = Math.floor(msLeft / 86400000);
        const hLeft = Math.floor((msLeft % 86400000) / 3600000);
        const mLeft = Math.floor((msLeft % 3600000) / 60000);
        const remaining = dLeft > 0 ? `${dLeft}d ${hLeft}h ${mLeft}m` : `${hLeft}h ${mLeft}m`;

        return { daysPassed, totalDays, percent, remaining };
    });

    const myEntry = createMemo(() => {
        const uid = currentUserId();
        if (!uid) return null;
        return currentEntries().find(e => e.userId === uid) || null;
    });

    const myRank = createMemo(() => myEntry()?.rank || null);

    const formatCurrency = (value: number, currency: string = 'KRW') => {
        if (currency === 'KRW') {
            if (value >= 100000000) return `${(value / 100000000).toFixed(2)}억`;
            if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
            return `₩${value.toLocaleString()}`;
        }
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatPnl = (pnl: number) => {
        const sign = pnl >= 0 ? '+' : '';
        return `${sign}${pnl.toFixed(2)}%`;
    };

    onMount(async () => {
        try {
            const comps = await getActiveCompetitions();
            setCompetitions(comps);

            // Subscribe to each division's leaderboard
            for (const comp of comps) {
                const lb = await getCompetitionLeaderboard(comp.id, 100);
                if (comp.division === 'futures') {
                    setFuturesEntries(lb);
                } else {
                    setSpotEntries(lb);
                }

                const setter = comp.division === 'futures' ? setFuturesEntries : setSpotEntries;
                const unsub = subscribeToLeaderboard(comp.id, (newEntries) => {
                    setter(newEntries);
                });
                onCleanup(unsub);
            }
        } catch (err) {
            console.error('[Arena] Failed to load:', err);
        } finally {
            setLoading(false);
        }
    });

    return (
        <div class="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Loading */}
            <Show when={loading()}>
                <div class="flex items-center justify-center py-20">
                    <div class="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full" />
                </div>
            </Show>

            <Show when={!loading() && competitions().length === 0}>
                <div class="flex flex-col items-center justify-center py-16 px-6 bg-[#111113]/40 rounded-3xl border border-white/[0.04]">
                    <TrophyIcon class="w-8 h-8 text-gray-600" />
                    <h3 class="text-base font-black text-white mt-4 mb-2">No Active Competition</h3>
                    <p class="text-xs text-gray-500 text-center max-w-sm">
                        There is no active competition round at the moment. Check back soon!
                    </p>
                </div>
            </Show>

            <Show when={!loading() && competitions().length > 0}>

                {/* ─── Division Tabs ─── */}
                <div class="flex items-center gap-1 bg-[#111113]/60 rounded-xl p-1 border border-white/[0.04]">
                    <button
                        onClick={() => setActiveDivision('spot')}
                        class={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeDivision() === 'spot'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-lg'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                            }`}
                    >
                        <SpotIcon />
                        Spot Division
                        <span class="px-1.5 py-0.5 bg-emerald-500/15 rounded text-[8px] font-black uppercase">1,000 VCN</span>
                    </button>
                    <button
                        onClick={() => setActiveDivision('futures')}
                        class={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${activeDivision() === 'futures'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25 shadow-lg'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                            }`}
                    >
                        <FuturesIcon />
                        Futures Division
                        <span class="px-1.5 py-0.5 bg-purple-500/15 rounded text-[8px] font-black uppercase">1,000 VCN</span>
                    </button>
                </div>

                {/* ─── Round Header Banner ─── */}
                <Show when={currentComp()}>
                    <div class={`relative overflow-hidden rounded-3xl border ${activeDivision() === 'spot' ? 'border-emerald-500/15 bg-gradient-to-br from-[#0a2818] via-[#111113] to-[#0a1628]' : 'border-purple-500/15 bg-gradient-to-br from-[#1a0a2e] via-[#111113] to-[#0f1a2e]'}`}>
                        {/* Background glow */}
                        <div class={`absolute top-0 right-0 w-64 h-64 ${activeDivision() === 'spot' ? 'bg-emerald-500/[0.06]' : 'bg-purple-500/[0.06]'} rounded-full blur-[80px] -mr-32 -mt-32`} />
                        <div class={`absolute bottom-0 left-0 w-48 h-48 ${activeDivision() === 'spot' ? 'bg-cyan-500/[0.04]' : 'bg-pink-500/[0.04]'} rounded-full blur-[60px] -ml-24 -mb-24`} />

                        <div class="relative p-6">
                            {/* Title Row */}
                            <div class="flex items-start justify-between mb-4">
                                <div>
                                    <div class="flex items-center gap-2 mb-1.5">
                                        <div class={`px-2 py-0.5 ${activeDivision() === 'spot' ? 'bg-emerald-500/15 border-emerald-500/25' : 'bg-purple-500/15 border-purple-500/25'} border rounded text-[9px] font-black ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-wider`}>
                                            Live
                                        </div>
                                        <span class={`px-2 py-0.5 ${activeDivision() === 'spot' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'} rounded text-[9px] font-black uppercase tracking-wider`}>
                                            {activeDivision() === 'spot' ? 'Spot' : 'Futures'}
                                        </span>
                                        <span class="text-[10px] text-gray-500">Round 1</span>
                                    </div>
                                    <h2 class="text-xl font-black text-white tracking-tight">{currentComp()!.title}</h2>
                                    <p class="text-[11px] text-gray-400 mt-1 max-w-md">{currentComp()!.description}</p>
                                </div>
                                <button
                                    onClick={() => setShowRules(!showRules())}
                                    class="p-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/[0.06] transition-colors"
                                >
                                    <Info class="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            {/* Progress Bar */}
                            <div class="mb-4">
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-[10px] font-bold text-gray-500">
                                        Day {progress().daysPassed}/{progress().totalDays}
                                    </span>
                                    <span class={`text-[10px] font-bold ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`}>
                                        {progress().remaining} remaining
                                    </span>
                                </div>
                                <div class="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                                    <div
                                        class={`h-full ${activeDivision() === 'spot' ? 'bg-gradient-to-r from-emerald-500 to-cyan-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'} rounded-full transition-all duration-1000`}
                                        style={{ width: `${progress().percent}%` }}
                                    />
                                </div>
                                <div class="flex items-center justify-between mt-1">
                                    <span class="text-[9px] text-gray-600">
                                        {new Date(currentComp()!.startDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <span class="text-[9px] text-gray-600">
                                        {new Date(currentComp()!.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div class="grid grid-cols-3 gap-3">
                                <div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                    <div class="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Participants</div>
                                    <div class="text-base font-black text-white">{currentComp()!.participantCount}</div>
                                </div>
                                <div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                    <div class="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Seed Capital</div>
                                    <div class="text-base font-black text-amber-400">10M KRW</div>
                                </div>
                                <div class="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                                    <div class="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Prize Pool</div>
                                    <div class={`text-base font-black ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`}>1,000 VCN</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ─── Rules Panel ─── */}
                <Show when={showRules() && currentComp()}>
                    <div class="p-5 bg-[#111113] rounded-2xl border border-white/[0.06] space-y-3">
                        <div class="flex items-center justify-between mb-1">
                            <h4 class="text-xs font-black text-white uppercase tracking-wider">
                                {activeDivision() === 'spot' ? 'Spot Division' : 'Futures Division'} Rules
                            </h4>
                            <button onClick={() => setShowRules(false)} class="p-1 hover:bg-white/5 rounded-lg">
                                <X class="w-3.5 h-3.5 text-gray-500" />
                            </button>
                        </div>
                        <For each={currentComp()!.rules}>
                            {(rule, i) => (
                                <div class="flex items-start gap-2.5">
                                    <div class={`w-5 h-5 rounded-full ${activeDivision() === 'spot' ? 'bg-emerald-500/10' : 'bg-purple-500/10'} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                        <span class={`text-[9px] font-black ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`}>{i() + 1}</span>
                                    </div>
                                    <span class="text-[11px] text-gray-400 leading-relaxed">{rule}</span>
                                </div>
                            )}
                        </For>

                        {/* Prize Details */}
                        <div class="mt-3 pt-3 border-t border-white/[0.04]">
                            <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Prize Structure (1,000 VCN)</h5>
                            <div class="space-y-1.5">
                                <For each={currentComp()!.prizes}>
                                    {(prize) => (
                                        <div class="flex items-center justify-between px-3 py-2 bg-white/[0.02] rounded-lg">
                                            <span class="text-[11px] font-bold text-white">{prize.label}</span>
                                            <span class={`text-[11px] font-black ${prize.rankMin <= 3 ? (activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400') : 'text-gray-500'}`}>{prize.reward}</span>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ─── My Status Card ─── */}
                <Show when={myEntry()}>
                    <div class={`p-4 rounded-2xl border ${activeDivision() === 'spot' ? 'bg-gradient-to-r from-emerald-500/[0.06] to-cyan-500/[0.04] border-emerald-500/15' : 'bg-gradient-to-r from-purple-500/[0.06] to-pink-500/[0.04] border-purple-500/15'}`}>
                        <div class="flex items-center gap-2 mb-3">
                            <ChartUpIcon />
                            <span class={`text-[11px] font-bold ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'} uppercase tracking-wider`}>My Position ({activeDivision() === 'spot' ? 'Spot' : 'Futures'})</span>
                        </div>
                        <div class="grid grid-cols-4 gap-3">
                            <div>
                                <div class="text-[9px] text-gray-500 mb-0.5">Rank</div>
                                <div class="text-lg font-black text-white">#{myEntry()!.rank}</div>
                            </div>
                            <div>
                                <div class="text-[9px] text-gray-500 mb-0.5">ROI</div>
                                <div class={`text-lg font-black ${myEntry()!.currentPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatPnl(myEntry()!.currentPnlPercent)}
                                </div>
                            </div>
                            <div>
                                <div class="text-[9px] text-gray-500 mb-0.5">Portfolio</div>
                                <div class="text-lg font-black text-white">{formatCurrency(myEntry()!.currentValue)}</div>
                            </div>
                            <div>
                                <div class="text-[9px] text-gray-500 mb-0.5">Trades</div>
                                <div class="text-lg font-black text-white">{myEntry()!.totalTrades}</div>
                            </div>
                        </div>
                    </div>
                </Show>

                {/* ─── Leaderboard Table ─── */}
                <div class="bg-[#111113] rounded-2xl border border-white/[0.06] overflow-hidden">
                    {/* Table Header */}
                    <div class="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                        <div class="flex items-center gap-2">
                            <TrophyIcon class={`w-4 h-4 ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`} />
                            <h3 class="text-xs font-black text-white uppercase tracking-wider">
                                {activeDivision() === 'spot' ? 'Spot' : 'Futures'} Leaderboard
                            </h3>
                            <span class="text-[9px] text-gray-500 bg-white/[0.04] px-1.5 py-0.5 rounded">{currentEntries().length} traders</span>
                        </div>
                    </div>

                    {/* Column Headers */}
                    <div class="grid grid-cols-12 gap-2 px-5 py-2 border-b border-white/[0.03] text-[9px] font-bold text-gray-600 uppercase tracking-wider">
                        <div class="col-span-1">#</div>
                        <div class="col-span-3">Trader</div>
                        <div class="col-span-2 text-right">ROI</div>
                        <div class="col-span-2 text-right">P&L</div>
                        <div class="col-span-2">Strategy</div>
                        <div class="col-span-1 text-right">Trades</div>
                        <div class="col-span-1 text-right">Win%</div>
                    </div>

                    {/* Entries */}
                    <Show when={currentEntries().length === 0}>
                        <div class="flex flex-col items-center justify-center py-12">
                            <TrophyIcon class="w-6 h-6 text-gray-700" />
                            <p class="text-xs text-gray-500 mt-3">No participants yet in {activeDivision() === 'spot' ? 'Spot' : 'Futures'} Division. Be the first!</p>
                        </div>
                    </Show>

                    <div class="max-h-[500px] overflow-y-auto custom-scrollbar">
                        <For each={currentEntries()}>
                            {(entry) => {
                                const isMe = () => entry.userId === currentUserId();
                                const rankColor = () => {
                                    if (entry.rank === 1) return 'bg-amber-500/[0.06] border-l-2 border-l-amber-400';
                                    if (entry.rank === 2) return 'bg-gray-400/[0.03] border-l-2 border-l-gray-400';
                                    if (entry.rank === 3) return 'bg-orange-500/[0.04] border-l-2 border-l-orange-400';
                                    if (isMe()) return `${activeDivision() === 'spot' ? 'bg-emerald-500/[0.06] border-l-2 border-l-emerald-400' : 'bg-purple-500/[0.06] border-l-2 border-l-purple-400'}`;
                                    return 'border-l-2 border-l-transparent';
                                };

                                return (
                                    <div class={`grid grid-cols-12 gap-2 items-center px-5 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${rankColor()}`}>
                                        {/* Rank */}
                                        <div class="col-span-1">
                                            <MedalIcon rank={entry.rank} />
                                        </div>

                                        {/* Trader */}
                                        <div class="col-span-3">
                                            <div class={`text-xs font-bold ${isMe() ? (activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400') : 'text-white'} truncate`}>
                                                {isMe() ? 'YOU' : entry.displayName}
                                            </div>
                                            <div class="text-[9px] text-gray-600 truncate">{entry.userEmail}</div>
                                        </div>

                                        {/* ROI */}
                                        <div class="col-span-2 text-right">
                                            <span class={`text-xs font-black ${entry.currentPnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatPnl(entry.currentPnlPercent)}
                                            </span>
                                        </div>

                                        {/* P&L */}
                                        <div class="col-span-2 text-right">
                                            <span class={`text-[11px] font-bold ${entry.currentPnl >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                                                {entry.currentPnl >= 0 ? '+' : ''}{formatCurrency(entry.currentPnl)}
                                            </span>
                                        </div>

                                        {/* Strategy */}
                                        <div class="col-span-2">
                                            <span class="text-[10px] text-gray-400 truncate block">{entry.strategyName}</span>
                                        </div>

                                        {/* Trades */}
                                        <div class="col-span-1 text-right">
                                            <span class="text-[11px] font-bold text-gray-400">{entry.totalTrades}</span>
                                        </div>

                                        {/* Win Rate */}
                                        <div class="col-span-1 text-right">
                                            <span class={`text-[11px] font-bold ${entry.winRate >= 50 ? 'text-green-400/70' : 'text-gray-500'}`}>
                                                {entry.winRate.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            }}
                        </For>
                    </div>
                </div>

                {/* ─── How to Participate ─── */}
                <Show when={!myEntry()}>
                    <div class={`p-5 rounded-2xl border ${activeDivision() === 'spot' ? 'bg-gradient-to-r from-emerald-500/[0.04] to-cyan-500/[0.03] border-emerald-500/10' : 'bg-gradient-to-r from-purple-500/[0.04] to-pink-500/[0.03] border-purple-500/10'}`}>
                        <div class="flex items-center gap-2 mb-3">
                            <TrophyIcon class={`w-4 h-4 ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`} />
                            <span class="text-xs font-bold text-white">Join {activeDivision() === 'spot' ? 'Spot' : 'Futures'} Division</span>
                        </div>
                        <p class="text-[11px] text-gray-400 leading-relaxed mb-3">
                            {activeDivision() === 'spot'
                                ? 'Go to the Strategies tab, select a Spot strategy, configure your agent in Paper Trading mode, and you\'ll be automatically enrolled in the Spot Division.'
                                : 'Go to the Strategies tab, select a Futures strategy, configure your agent in Paper Trading mode, and you\'ll be automatically enrolled in the Futures Division.'
                            }
                        </p>
                        <div class="flex items-center gap-4">
                            <div class="flex items-center gap-1.5">
                                <div class={`w-5 h-5 rounded-full ${activeDivision() === 'spot' ? 'bg-emerald-500/15' : 'bg-purple-500/15'} flex items-center justify-center`}>
                                    <span class={`text-[9px] font-black ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`}>1</span>
                                </div>
                                <span class="text-[10px] text-gray-500">{activeDivision() === 'spot' ? 'Spot Strategy' : 'Futures Strategy'}</span>
                            </div>
                            <ChevronRight class="w-3 h-3 text-gray-700" />
                            <div class="flex items-center gap-1.5">
                                <div class={`w-5 h-5 rounded-full ${activeDivision() === 'spot' ? 'bg-emerald-500/15' : 'bg-purple-500/15'} flex items-center justify-center`}>
                                    <span class={`text-[9px] font-black ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`}>2</span>
                                </div>
                                <span class="text-[10px] text-gray-500">Paper Trading</span>
                            </div>
                            <ChevronRight class="w-3 h-3 text-gray-700" />
                            <div class="flex items-center gap-1.5">
                                <div class={`w-5 h-5 rounded-full ${activeDivision() === 'spot' ? 'bg-emerald-500/15' : 'bg-purple-500/15'} flex items-center justify-center`}>
                                    <span class={`text-[9px] font-black ${activeDivision() === 'spot' ? 'text-emerald-400' : 'text-purple-400'}`}>3</span>
                                </div>
                                <span class="text-[10px] text-gray-500">Auto-Enrolled!</span>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    );
};

export default QuantArenaLeaderboard;
