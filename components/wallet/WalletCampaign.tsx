import { createSignal, Show, For, onMount } from 'solid-js';
import { ethers } from 'ethers';
import {
    Zap,
    ChevronRight,
    UserPlus,
    ArrowLeft,
    Trophy,
    Award,
    Gamepad2
} from 'lucide-solid';
import { Motion } from 'solid-motionone';

import { WalletViewHeader } from './WalletViewHeader';
import { ReferralLeaderboard } from './ReferralLeaderboard';
import { GameDailyLeaderboard } from './GameDailyLeaderboard';
import { DailyHub } from './DailyHub';
import { useI18n } from '../../i18n/i18nContext';
import { getRPConfig, RPConfig } from '../../services/firebaseService';

export const WalletCampaign = (props: { userProfile: () => any; onNavigate?: (view: string) => void; initialQuest?: string | null }) => {
    const { t } = useI18n();
    const [selectedQuest, setSelectedQuest] = createSignal<string | null>(props.initialQuest || null);
    const [totalStaked, setTotalStaked] = createSignal('Loading...');
    const [myRank, setMyRank] = createSignal<number | null>(null);
    const [myReward, setMyReward] = createSignal(0);
    const [myGameRank, setMyGameRank] = createSignal<number | null>(null);
    const [myGameVCN, setMyGameVCN] = createSignal(0);
    const [rpConfig, setRpConfig] = createSignal<RPConfig | null>(null);

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

        // Fetch RP config for rush rewards display
        try {
            const cfg = await getRPConfig();
            setRpConfig(cfg);
        } catch { /* silent */ }
    });

    // P1: the five hardcoded quest cards are gone.
    //
    // Three of them were dead ends — `airdrop` and `vns` rendered a "Quest
    // Initializing" placeholder and `staking` was permanently disabled — so a
    // new user exploring this tab hit "coming soon" three times out of five.
    // The stats printed on them were literals, not data: Participants "2.4K+",
    // Handles Claimed "8.1K", Top Reward "100x VCN", airdrop progress 5%.
    // Those are removed rather than recomputed; the daily hub below shows real
    // server state, and the two entries that lead somewhere real (the referral
    // and game leaderboards) are kept as links underneath it.
    const leaderboards = [
        {
            id: 'referral',
            title: t('campaign.referralRushTitle'),
            description: t('campaign.referralRushCardDesc'),
            icon: UserPlus,
            accent: 'emerald',
            btnText: t('campaign.viewLeaderboard'),
        },
        {
            id: 'game_daily',
            title: 'Daily Game Challenge',
            description: 'Play daily mini-games and compete for the top spot on today\'s leaderboard.',
            icon: Gamepad2,
            accent: 'amber',
            btnText: 'View Leaderboard',
        },
    ];

    return (
        <div class="flex-1 overflow-y-auto relative custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

                <Show when={selectedQuest() === null} fallback={
                    <div class="space-y-8">
                        {/* Sub-page Header */}
                        <div class="flex items-center justify-between">
                            <button
                                onClick={() => {
                                    // If user came from Game Center (via initialQuest), go back to game view
                                    if (props.initialQuest && props.onNavigate) {
                                        props.onNavigate('game');
                                    } else {
                                        setSelectedQuest(null);
                                    }
                                }}
                                class="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                            >
                                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                                    <ArrowLeft class="w-5 h-5" />
                                </div>
                                <span class="text-sm font-bold uppercase tracking-widest">
                                    {props.initialQuest ? t('campaign.backToGames') || 'Back to Games' : t('campaign.backToQuests')}
                                </span>
                            </button>

                            <div class="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <Trophy class="w-4 h-4 text-blue-400" />
                                <span class="text-xs font-black text-blue-400 uppercase tracking-widest">{t('campaign.activeLeaderboard')}</span>
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
                                        <span class="inline-block px-3 py-1 bg-emerald-500 text-black text-[10px] font-black uppercase rounded mb-4">{t('campaign.referralQuest')}</span>
                                        <h1 class="text-4xl lg:text-5xl font-black italic text-white tracking-tighter mb-4">{t('campaign.referralRush')}</h1>
                                        <p class="text-lg text-gray-400 font-medium leading-relaxed mb-8">
                                            {t('campaign.referralRushDesc')}
                                        </p>
                                        <div class="flex gap-4">
                                            <div class="bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t('campaign.yourRank')}</div>
                                                <div class="text-2xl font-black text-white italic">{myRank() !== null ? `#${myRank()}` : '#--'}</div>
                                            </div>
                                            <div class="bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t('campaign.totalReward')}</div>
                                                <div class="text-2xl font-black text-emerald-400 italic">{myReward() > 0 ? `${myReward().toLocaleString()} VCN` : '0 VCN'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ReferralLeaderboard
                                    currentUserEmail={props.userProfile()?.email || ''}
                                    onUserStats={(rank, reward) => {
                                        setMyRank(rank);
                                        setMyReward(reward);
                                    }}
                                />

                                {/* RP Reward Tiers */}
                                <Show when={rpConfig()}>
                                    <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-6 lg:p-8">
                                        <div class="flex items-center gap-3 mb-6">
                                            <svg class="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                                <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
                                                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                                            </svg>
                                            <h3 class="text-lg font-black text-white uppercase italic tracking-tight">RP Bonus Rewards</h3>
                                        </div>
                                        <p class="text-sm text-gray-500 mb-6">Top Referral Rush finishers earn bonus Reward Points at the end of each season.</p>
                                        <div class="space-y-2">
                                            {[
                                                { rank: '1st Place', color: '#eab308', rp: rpConfig()!.rush_1st },
                                                { rank: '2nd Place', color: '#9ca3af', rp: rpConfig()!.rush_2nd },
                                                { rank: '3rd Place', color: '#cd7f32', rp: rpConfig()!.rush_3rd },
                                                { rank: 'Top 10', color: '#06b6d4', rp: rpConfig()!.rush_top10 },
                                                { rank: 'Top 50', color: '#6b7280', rp: rpConfig()!.rush_top50 },
                                            ].map(tier => (
                                                <div class="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] transition-colors">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={`background: ${tier.color}`} />
                                                        <span class="text-sm font-bold text-gray-200">{tier.rank}</span>
                                                    </div>
                                                    <span class="text-sm font-black" style={`color: ${tier.color}`}>+{tier.rp.toLocaleString()} RP</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p class="text-[10px] text-gray-600 mt-4 text-center">RP bonus is awarded automatically when the season ends.</p>
                                    </div>
                                </Show>
                            </div>
                        </Show>

                        {/* Placeholder for other quest sub-pages */}
                        <Show when={selectedQuest() === 'game_daily'}>
                            <div class="space-y-6">
                                <div class="bg-gradient-to-br from-amber-600/10 to-orange-600/10 border border-white/10 rounded-[32px] p-8 lg:p-12 relative overflow-hidden">
                                    <div class="absolute top-0 right-0 p-12 opacity-5 scale-150">
                                        <Gamepad2 class="w-64 h-64" />
                                    </div>
                                    <div class="relative z-10 max-w-2xl">
                                        <span class="inline-block px-3 py-1 bg-amber-500 text-black text-[10px] font-black uppercase rounded mb-4">Daily Game</span>
                                        <h1 class="text-4xl lg:text-5xl font-black italic text-white tracking-tighter mb-4">DAILY GAME CHALLENGE</h1>
                                        <p class="text-lg text-gray-400 font-medium leading-relaxed mb-8">
                                            Play mini-games every day to earn VCN and RP. Compete with other players for the top spot on today's leaderboard!
                                        </p>
                                        <div class="flex gap-4">
                                            <div class="bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Your Rank</div>
                                                <div class="text-2xl font-black text-white italic">{myGameRank() !== null ? `#${myGameRank()}` : '#--'}</div>
                                            </div>
                                            <div class="bg-black/40 border border-white/10 rounded-2xl px-6 py-4">
                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Today's VCN</div>
                                                <div class="text-2xl font-black text-amber-400 italic">{myGameVCN() > 0 ? `${myGameVCN().toFixed(1)} VCN` : '0 VCN'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <GameDailyLeaderboard
                                    currentUserEmail={props.userProfile()?.email || ''}
                                    onUserStats={(rank, vcn) => {
                                        setMyGameRank(rank);
                                        setMyGameVCN(vcn);
                                    }}
                                />
                            </div>
                        </Show>

                        <Show when={selectedQuest() !== 'referral' && selectedQuest() !== 'game_daily'}>
                            <div class="py-20 flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-600 mb-6">
                                    <Award class="w-10 h-10" />
                                </div>
                                <h3 class="text-2xl font-black text-white uppercase italic tracking-tight mb-2">{t('campaign.questInitializing')}</h3>
                                <p class="text-gray-500 max-w-sm mb-8">{t('campaign.questInitializingDesc')} {selectedQuest()} {t('campaign.questInitializingDescEnd')}</p>
                                <button
                                    onClick={() => setSelectedQuest(null)}
                                    class="px-8 py-3 bg-white text-black font-black uppercase italic rounded-xl text-sm hover:scale-105 active:scale-95 transition-all"
                                >
                                    {t('campaign.returnToOverview')}
                                </button>
                            </div>
                        </Show>
                    </div>
                }>
                    <div class="space-y-12">
                        <WalletViewHeader
                            tag={t('campaign.tag')}
                            title={t('campaign.title')}
                            titleAccent={t('campaign.titleAccent')}
                            description={t('campaign.description')}
                            icon={Zap}
                        />

                        {/* The day's checklist — real server state, one call. */}
                        <DailyHub onNavigate={props.onNavigate} />

                        {/* The two destinations that actually exist. */}
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                            <For each={leaderboards}>
                                {(item) => (
                                    <button
                                        onClick={() => setSelectedQuest(item.id)}
                                        class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-6 text-left transition-all hover:border-white/[0.14] group"
                                    >
                                        <div class="flex items-center justify-between mb-4">
                                            <item.icon class="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                                            <ChevronRight class="w-4 h-4 text-gray-700 group-hover:text-white transition-colors" />
                                        </div>
                                        <h2 class="text-xl font-black italic text-white tracking-tighter uppercase mb-2">
                                            {item.title}
                                        </h2>
                                        <p class="text-sm text-gray-500 font-medium leading-relaxed">
                                            {item.description}
                                        </p>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
