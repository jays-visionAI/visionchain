import {
    Zap,
    TrendingUp,
    Sparkles,
    Copy,
    ChevronRight,
    User
} from 'lucide-solid';

import { WalletViewHeader } from './WalletViewHeader';
import { ReferralLeaderboard } from './ReferralLeaderboard';

export const WalletCampaign = (props: { userProfile: () => any }) => {
    return (
        <div class="flex-1 overflow-y-auto relative custom-scrollbar p-4 lg:p-8">
            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletViewHeader
                    tag="Earning Center"
                    title="QUEST"
                    titleAccent="SYSTEM"
                    description="Maximize your earnings through Vision ecosystem events, rewards, and community missions."
                    icon={Zap}
                />

                {/* Referral Leaderboard Sprint Section */}
                <ReferralLeaderboard currentUserEmail={props.userProfile()?.email || ''} />


                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Re-use campaign card styles but larger */}
                    <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-8 hover:border-blue-500/30 transition-all group">
                        <div class="flex items-center justify-between mb-6">
                            <div class="px-3 py-1 bg-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 uppercase tracking-widest">Active Now</div>
                            <TrendingUp class="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                        </div>
                        <h2 class="text-2xl font-bold text-white mb-2">Staking V1</h2>
                        <p class="text-gray-400 mb-6 font-medium">Earn up to 12% APY by staking your VCN tokens. No lock-up period required for this season.</p>
                        <div class="flex items-center gap-6 mb-8">
                            <div>
                                <div class="text-xs text-gray-500 uppercase font-bold tracking-tight mb-1">Total TVL</div>
                                <div class="text-lg font-bold text-white font-mono">--</div>
                            </div>
                            <div class="w-px h-8 bg-white/10" />
                            <div>
                                <div class="text-xs text-gray-500 uppercase font-bold tracking-tight mb-1">Stakers</div>
                                <div class="text-lg font-bold text-white font-mono">--</div>
                            </div>
                        </div>
                        <button class="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
                            Start Staking
                        </button>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-8 hover:border-purple-500/30 transition-all group">
                        <div class="flex items-center justify-between mb-6">
                            <div class="px-3 py-1 bg-purple-500/10 rounded-full text-[10px] font-bold text-purple-400 uppercase tracking-widest">Season 1</div>
                            <Sparkles class="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                        </div>
                        <h2 class="text-2xl font-bold text-white mb-2">Community Airdrop</h2>
                        <p class="text-gray-400 mb-6 font-medium">Complete daily missions to earn Vision Points. Top participants will share in the reward pool.</p>
                        <div class="mb-8">
                            <div class="flex items-center justify-between mb-2">
                                <span class="text-xs text-gray-500 font-bold uppercase">Your Progress</span>
                                <span class="text-xs text-white font-bold">In Progress</span>
                            </div>
                            <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                <div class="w-[5%] h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                            </div>
                        </div>
                        <button class="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20">
                            View Missions
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};
