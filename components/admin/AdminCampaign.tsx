import { For } from 'solid-js';
import {
    Trophy,
    Users,
    Gift,
    BarChart3,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Plus,
    Search,
    ChevronRight,
    ArrowUpRight,
    Target,
    Activity
} from 'lucide-solid';
import { Motion } from 'solid-motionone';

// Mock Campaign Data
const campaigns = [
    {
        id: 'camp_01',
        name: 'Genesis Referrals',
        status: 'active',
        reward: '500 VCN',
        participants: 0,
        conversion: '0%',
        endDate: '--'
    },
    {
        id: 'camp_02',
        name: 'Early Adopter Airdrop',
        status: 'pending',
        reward: '1000 VCN',
        participants: 0,
        conversion: '0%',
        endDate: '2024-05-15'
    },
    {
        id: 'camp_03',
        name: 'Node Validator Bonus',
        status: 'pending',
        reward: '-- VCN',
        participants: 0,
        conversion: '0%',
        endDate: '--'
    },
];

export default function AdminCampaign() {
    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex items-end justify-between">
                <div>
                    <h1 class="text-3xl font-black text-white uppercase tracking-tight">Campaign Control</h1>
                    <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Management for Referral & Growth Programs</p>
                </div>
                <button class="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 hover:scale-[1.02] transition-all flex items-center gap-2">
                    <Plus class="w-4 h-4" />
                    New Campaign
                </button>
            </div>

            {/* Campaign Performance Summary */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Rewards Paid</div>
                    <div class="text-2xl font-black text-white">-- VCN</div>
                    <div class="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500 font-bold">
                        <Activity class="w-3 h-3" />
                        Awaiting data
                    </div>
                </div>
                <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Active Participants</div>
                    <div class="text-2xl font-black text-white">--</div>
                    <div class="mt-2 flex items-center gap-1.5 text-[10px] text-gray-500 font-bold">
                        <Users class="w-3 h-3" />
                        Ready
                    </div>
                </div>
                <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Avg. CPA</div>
                    <div class="text-2xl font-black text-white">$1.42</div>
                    <div class="mt-2 flex items-center gap-1.5 text-[10px] text-purple-400 font-bold">
                        <Target class="w-3 h-3" />
                        Optimized
                    </div>
                </div>
                <div class="p-5 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-2">Campaign ROI</div>
                    <div class="text-2xl font-black text-white">842%</div>
                    <div class="mt-2 flex items-center gap-1.5 text-[10px] text-pink-400 font-bold">
                        <BarChart3 class="w-3 h-3" />
                        High Performance
                    </div>
                </div>
            </div>

            {/* Active Campaigns List */}
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 space-y-4">
                    <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Activity class="w-4 h-4" />
                        Global Campaigns
                    </h2>
                    <For each={campaigns}>
                        {(camp) => (
                            <div class="group p-1 bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.05] hover:border-white/20 transition-all cursor-pointer">
                                <div class="p-5 flex items-center justify-between">
                                    <div class="flex items-center gap-4">
                                        <div class={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${camp.status === 'active' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                                            camp.status === 'pending' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                                'bg-white/5 border-white/10 text-gray-500'
                                            }`}>
                                            <Trophy class="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 class="text-sm font-black text-white uppercase tracking-tight">{camp.name}</h3>
                                            <div class="flex items-center gap-3 mt-1">
                                                <div class="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                    <Gift class="w-3 h-3" />
                                                    {camp.reward}
                                                </div>
                                                <div class="w-1 h-1 rounded-full bg-white/10" />
                                                <div class="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                                                    <Calendar class="w-3 h-3" />
                                                    Ends {camp.endDate}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-6">
                                        <div class="text-right">
                                            <div class="text-xs font-black text-white">{camp.participants}</div>
                                            <div class="text-[9px] font-bold text-gray-500 uppercase">Users</div>
                                        </div>
                                        <div class="h-8 w-[1px] bg-white/5" />
                                        <div class="text-right">
                                            <div class="text-xs font-black text-white">{camp.conversion}</div>
                                            <div class="text-[9px] font-bold text-gray-500 uppercase">Conv.</div>
                                        </div>
                                        <ChevronRight class="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </For>
                </div>

                {/* Quick Rewards Log */}
                <div class="space-y-4">
                    <h2 class="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <Gift class="w-4 h-4" />
                        Pending Approvals
                    </h2>
                    <div class="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden p-2">
                        <For each={[1, 2, 3, 4]}>
                            {(item) => (
                                <div class="flex items-center justify-between p-3 hover:bg-white/[0.03] rounded-xl transition-colors group">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-[10px] font-black">JD</div>
                                        <div>
                                            <div class="text-[11px] font-bold text-gray-200">John Doe</div>
                                            <div class="text-[9px] font-bold text-gray-500">#GEN_REF Reward</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <button class="w-8 h-8 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all">
                                            <CheckCircle2 class="w-4 h-4" />
                                        </button>
                                        <button class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all">
                                            <AlertCircle class="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                    <button class="w-full py-3 rounded-xl bg-white/[0.03] border border-white/10 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:bg-white/[0.05] transition-all">
                        Bulk Approve Rewards
                    </button>
                </div>
            </div>
        </div>
    );
}
