import {
    Zap,
    TrendingUp,
    Sparkles,
    Copy,
    ChevronRight,
    User
} from 'lucide-solid';

export const WalletCampaign = () => {
    return (
        <div class="flex-1 overflow-y-auto relative">
            {/* Decorative Background Blur */}
            <div class="absolute top-0 right-[10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

            <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20 relative">
                <div class="flex items-center gap-6 mb-12">
                    <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-blue-500/20 group hover:scale-105 transition-transform">
                        <Zap class="w-8 h-8 text-white group-hover:animate-pulse" />
                    </div>
                    <div>
                        <h2 class="text-4xl font-bold text-white tracking-tight mb-2">Campaign Central</h2>
                        <p class="text-gray-500 font-medium">Maximize your earnings through Vision ecosystem events and rewards</p>
                    </div>
                </div>


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

                    <div class="col-span-1 md:col-span-2 bg-gradient-to-br from-orange-600/10 to-transparent border border-orange-500/20 rounded-[24px] p-8 hover:border-orange-500/40 transition-all group relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
                        <div class="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                            <div class="flex-1 text-center md:text-left">
                                <div class="flex items-center justify-center md:justify-start gap-3 mb-4">
                                    <div class="px-3 py-1 bg-orange-500/10 rounded-full text-[10px] font-bold text-orange-400 uppercase tracking-widest">Referral Program</div>
                                    <div class="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                </div>
                                <h2 class="text-3xl font-bold text-white mb-4">Invite & Build Your Network</h2>
                                <p class="text-gray-400 mb-6 max-w-lg">Share the vision with your friends. Join the decentralized AI ecosystem together and expand the Vision network.</p>
                                <div class="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                    <div class="px-6 py-3 bg-[#1a1a1f] border border-orange-500/20 rounded-xl font-mono text-xl font-black text-orange-400 tracking-widest shadow-lg shadow-orange-500/5">
                                        VC7F3A
                                    </div>
                                    <button class="px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2">
                                        <Copy class="w-4 h-4" />
                                        Copy Link
                                    </button>
                                </div>
                            </div>
                            <div class="w-full md:w-48 space-y-3">
                                <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between">
                                    <div class="text-xs text-gray-500 font-bold uppercase">Total Invites</div>
                                    <div class="text-lg font-bold text-white">12</div>
                                </div>
                                <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between">
                                    <div class="text-xs text-gray-500 font-bold uppercase">VCN Earned</div>
                                    <div class="text-lg font-bold text-orange-400">0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
