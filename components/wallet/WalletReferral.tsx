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
    ExternalLink
} from 'lucide-solid';
import { getUserReferrals, UserData } from '../../services/firebaseService';

import { WalletViewHeader } from './WalletViewHeader';

interface WalletReferralProps {
    userProfile: () => any;
}

export const WalletReferral = (props: WalletReferralProps) => {
    const [referrals, setReferrals] = createSignal<UserData[]>([]);
    const [copied, setCopied] = createSignal(false);
    const [isLoading, setIsLoading] = createSignal(true);

    const referralUrl = () => `${window.location.origin}/signup?ref=${props.userProfile().referralCode}`;

    const invitationMessage = () => {
        const url = referralUrl();
        const userName = props.userProfile().name || props.userProfile().email?.split('@')[0] || 'User';
        return `${url} Invitation Link from ${userName}`;
    };

    onMount(async () => {
        if (props.userProfile().email) {
            const list = await getUserReferrals(props.userProfile().email);
            setReferrals(list);
            setIsLoading(false);
        }
    });

    const copyLink = () => {
        navigator.clipboard.writeText(invitationMessage());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(props.userProfile().referralCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div class="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
            <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <WalletViewHeader
                    tag="Growth Program"
                    title="REFERRAL"
                    titleAccent="ENGINE"
                    description="Build your network and earn multi-tier rewards for every person you bring to the Vision Chain ecosystem."
                    rightElement={
                        <>
                            <div class="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <TrendingUp class="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Global Rank</div>
                                <div class="text-lg font-black text-white">Top 5%</div>
                            </div>
                        </>
                    }
                />

                {/* Primary Actions / Stats Container */}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Share Card */}
                    <div class="lg:col-span-2 bg-gradient-to-br from-blue-600/20 via-[#111113] to-[#111113] border border-white/[0.08] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                            <UserPlus class="w-32 h-32 text-blue-400" />
                        </div>

                        <div class="relative z-10">
                            <h3 class="text-xl font-black text-white italic mb-6 uppercase tracking-tight">Your Invite Link</h3>
                            <div class="flex flex-col gap-3 mb-8">
                                <div class="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between group/link">
                                    <code class="text-blue-400 font-mono text-sm truncate">{referralUrl()}</code>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(invitationMessage());
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
                                                text: `Invitation Link from ${props.userProfile().name || 'User'}`,
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

                    {/* Quick Stats Card */}
                    <div class="bg-[#111113] border border-white/[0.08] rounded-[32px] p-8 flex flex-col justify-between">
                        <div>
                            <div class="flex items-center justify-between mb-8">
                                <div class="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                                    <Users class="w-6 h-6 text-purple-400" />
                                </div>
                                <div class="text-right">
                                    <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Network Size</div>
                                    <div class="text-2xl font-black text-white">{props.userProfile().referralCount || 0}</div>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-gray-500 italic">Tier 1 Direct</span>
                                    <span class="text-xs font-black text-white">{referrals().length}</span>
                                </div>
                                <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-blue-500 w-[60%]" />
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-xs font-bold text-gray-500 italic">Tier 2 Network</span>
                                    <span class="text-xs font-black text-white">{(props.userProfile().referralCount || 0) - referrals().length}</span>
                                </div>
                                <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                    <div class="h-full bg-purple-500 w-[20%]" />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => window.open('https://docs.visionchain.co/referral', '_blank')}
                            class="w-full py-3 bg-white/[0.03] hover:bg-white/[0.08] rounded-xl text-[10px] font-black text-gray-500 hover:text-white transition-all uppercase tracking-widest border border-white/5 mt-6"
                        >
                            View Rewards Logic
                        </button>
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
                                                            <div class="flex items-center gap-2">
                                                                <div class={`w-1.5 h-1.5 rounded-full ${ref.isVerified ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-yellow-500'}`} />
                                                                <span class={`text-[10px] font-black uppercase tracking-widest ${ref.isVerified ? 'text-green-500' : 'text-yellow-500'}`}>
                                                                    {ref.isVerified ? 'Verified' : 'Pending'}
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
