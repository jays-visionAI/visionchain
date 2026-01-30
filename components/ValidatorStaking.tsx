import { createSignal, Show, For, onMount, createEffect } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Shield,
    Lock,
    Unlock,
    Clock,
    AlertTriangle,
    TrendingUp,
    Users,
    ChevronRight,
    Coins,
    CheckCircle2,
    XCircle,
    Timer
} from 'lucide-solid';
import { ethers } from 'ethers';

// ============ Types ============
interface ValidatorInfo {
    address: string;
    stakedAmount: string;
    isActive: boolean;
    pendingUnstake: string;
    unlockTime: number;
}

interface StakingStats {
    totalStaked: string;
    activeValidators: number;
    minStake: string;
    cooldownDays: number;
    slashPercent: number;
}

// ============ Mock Data (Replace with contract calls) ============
const MOCK_STATS: StakingStats = {
    totalStaked: '1,250,000',
    activeValidators: 12,
    minStake: '10,000',
    cooldownDays: 7,
    slashPercent: 50
};

const MOCK_VALIDATORS: ValidatorInfo[] = [
    { address: '0x7F3A...BE29', stakedAmount: '150,000', isActive: true, pendingUnstake: '0', unlockTime: 0 },
    { address: '0x9dE2...4A1B', stakedAmount: '85,000', isActive: true, pendingUnstake: '0', unlockTime: 0 },
    { address: '0x3C1F...8B02', stakedAmount: '50,000', isActive: false, pendingUnstake: '50,000', unlockTime: Date.now() + 3 * 24 * 60 * 60 * 1000 },
];

// ============ Component ============
export default function ValidatorStaking() {
    const [stats, setStats] = createSignal<StakingStats>(MOCK_STATS);
    const [validators, setValidators] = createSignal<ValidatorInfo[]>(MOCK_VALIDATORS);
    const [userStake, setUserStake] = createSignal('0');
    const [stakeAmount, setStakeAmount] = createSignal('');
    const [unstakeAmount, setUnstakeAmount] = createSignal('');
    const [isStaking, setIsStaking] = createSignal(false);
    const [isUnstaking, setIsUnstaking] = createSignal(false);
    const [activeTab, setActiveTab] = createSignal<'stake' | 'unstake'>('stake');
    const [txStatus, setTxStatus] = createSignal<'idle' | 'pending' | 'success' | 'error'>('idle');

    // Format remaining time
    const formatTimeRemaining = (unlockTime: number) => {
        const remaining = unlockTime - Date.now();
        if (remaining <= 0) return 'Ready to withdraw';
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        return `${days}d ${hours}h remaining`;
    };

    // Handle stake
    const handleStake = async () => {
        if (!stakeAmount() || parseFloat(stakeAmount()) < parseFloat(stats().minStake.replace(/,/g, ''))) {
            return;
        }
        setIsStaking(true);
        setTxStatus('pending');

        // Simulate transaction
        await new Promise(r => setTimeout(r, 2000));

        setTxStatus('success');
        setStakeAmount('');
        setIsStaking(false);

        setTimeout(() => setTxStatus('idle'), 3000);
    };

    // Handle unstake request
    const handleUnstake = async () => {
        if (!unstakeAmount()) return;
        setIsUnstaking(true);
        setTxStatus('pending');

        await new Promise(r => setTimeout(r, 2000));

        setTxStatus('success');
        setUnstakeAmount('');
        setIsUnstaking(false);

        setTimeout(() => setTxStatus('idle'), 3000);
    };

    return (
        <div class="min-h-screen bg-[#0A0A0B] text-white p-6 lg:p-10">
            <div class="max-w-6xl mx-auto space-y-10">

                {/* Header */}
                <div class="text-center space-y-4">
                    <div class="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full">
                        <Shield class="w-4 h-4 text-amber-400" />
                        <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest">Bridge Security</span>
                    </div>
                    <h1 class="text-5xl font-black italic uppercase tracking-tighter">
                        VALIDATOR <span class="text-amber-400">STAKING</span>
                    </h1>
                    <p class="text-gray-500 text-sm max-w-xl mx-auto">
                        Stake VCN to become a bridge validator. Earn rewards for securing cross-chain transfers.
                    </p>
                </div>

                {/* Stats Grid */}
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Total Staked</div>
                        <div class="text-2xl font-black text-white">{stats().totalStaked}</div>
                        <div class="text-[10px] text-amber-400 font-bold">VCN</div>
                    </div>
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Active Validators</div>
                        <div class="text-2xl font-black text-white">{stats().activeValidators}</div>
                        <div class="text-[10px] text-green-400 font-bold flex items-center gap-1">
                            <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> Online
                        </div>
                    </div>
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Minimum Stake</div>
                        <div class="text-2xl font-black text-white">{stats().minStake}</div>
                        <div class="text-[10px] text-gray-500 font-bold">VCN Required</div>
                    </div>
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">Cooldown</div>
                        <div class="text-2xl font-black text-white">{stats().cooldownDays}</div>
                        <div class="text-[10px] text-blue-400 font-bold">Days</div>
                    </div>
                    <div class="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl">
                        <div class="text-[9px] font-black text-red-400/60 uppercase tracking-widest mb-2">Slash Rate</div>
                        <div class="text-2xl font-black text-red-400">{stats().slashPercent}%</div>
                        <div class="text-[10px] text-red-400/60 font-bold">On Invalid Proof</div>
                    </div>
                </div>

                {/* Main Staking Panel */}
                <div class="grid lg:grid-cols-2 gap-8">

                    {/* Stake/Unstake Form */}
                    <div class="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                        {/* Tabs */}
                        <div class="flex bg-white/[0.03] p-1 rounded-xl mb-8">
                            <button
                                onClick={() => setActiveTab('stake')}
                                class={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab() === 'stake'
                                        ? 'bg-amber-500 text-black shadow-lg'
                                        : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                <Lock class="w-4 h-4 inline mr-2" />
                                Stake
                            </button>
                            <button
                                onClick={() => setActiveTab('unstake')}
                                class={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab() === 'unstake'
                                        ? 'bg-amber-500 text-black shadow-lg'
                                        : 'text-gray-500 hover:text-white'
                                    }`}
                            >
                                <Unlock class="w-4 h-4 inline mr-2" />
                                Unstake
                            </button>
                        </div>

                        <Show when={activeTab() === 'stake'}>
                            <div class="space-y-6">
                                <div>
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                        Stake Amount
                                    </label>
                                    <div class="relative">
                                        <input
                                            type="number"
                                            value={stakeAmount()}
                                            onInput={(e) => setStakeAmount(e.currentTarget.value)}
                                            placeholder={`Min: ${stats().minStake} VCN`}
                                            class="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-xl font-bold text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">VCN</span>
                                    </div>
                                </div>

                                <div class="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-2">
                                    <div class="flex items-center gap-2 text-amber-400 text-xs font-bold">
                                        <AlertTriangle class="w-4 h-4" />
                                        Important
                                    </div>
                                    <p class="text-[11px] text-gray-400">
                                        By staking, you agree to validate bridge transfers. Invalid proofs result in {stats().slashPercent}% stake slashing.
                                    </p>
                                </div>

                                <button
                                    onClick={handleStake}
                                    disabled={isStaking() || !stakeAmount()}
                                    class="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Show when={isStaking()} fallback={<>
                                        <Lock class="w-4 h-4" />
                                        Stake VCN
                                    </>}>
                                        <div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                        Staking...
                                    </Show>
                                </button>
                            </div>
                        </Show>

                        <Show when={activeTab() === 'unstake'}>
                            <div class="space-y-6">
                                <div>
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                        Unstake Amount
                                    </label>
                                    <div class="relative">
                                        <input
                                            type="number"
                                            value={unstakeAmount()}
                                            onInput={(e) => setUnstakeAmount(e.currentTarget.value)}
                                            placeholder="Enter amount"
                                            class="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-xl font-bold text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                                        />
                                        <span class="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">VCN</span>
                                    </div>
                                </div>

                                <div class="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2">
                                    <div class="flex items-center gap-2 text-blue-400 text-xs font-bold">
                                        <Timer class="w-4 h-4" />
                                        {stats().cooldownDays}-Day Cooldown
                                    </div>
                                    <p class="text-[11px] text-gray-400">
                                        Unstaking initiates a {stats().cooldownDays}-day waiting period before you can withdraw.
                                    </p>
                                </div>

                                <button
                                    onClick={handleUnstake}
                                    disabled={isUnstaking() || !unstakeAmount()}
                                    class="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <Show when={isUnstaking()} fallback={<>
                                        <Unlock class="w-4 h-4" />
                                        Request Unstake
                                    </>}>
                                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Processing...
                                    </Show>
                                </button>
                            </div>
                        </Show>

                        {/* Transaction Status */}
                        <Show when={txStatus() !== 'idle'}>
                            <div class={`mt-6 p-4 rounded-xl flex items-center gap-3 ${txStatus() === 'pending' ? 'bg-amber-500/10 border border-amber-500/20' :
                                    txStatus() === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                                        'bg-red-500/10 border border-red-500/20'
                                }`}>
                                <Show when={txStatus() === 'pending'}>
                                    <div class="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                    <span class="text-amber-400 text-xs font-bold">Transaction pending...</span>
                                </Show>
                                <Show when={txStatus() === 'success'}>
                                    <CheckCircle2 class="w-5 h-5 text-green-400" />
                                    <span class="text-green-400 text-xs font-bold">Transaction successful!</span>
                                </Show>
                                <Show when={txStatus() === 'error'}>
                                    <XCircle class="w-5 h-5 text-red-400" />
                                    <span class="text-red-400 text-xs font-bold">Transaction failed</span>
                                </Show>
                            </div>
                        </Show>
                    </div>

                    {/* Validators List */}
                    <div class="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
                        <div class="p-6 border-b border-white/5">
                            <h3 class="text-lg font-black text-white flex items-center gap-2">
                                <Users class="w-5 h-5 text-amber-400" />
                                Active Validators
                            </h3>
                        </div>
                        <div class="divide-y divide-white/5">
                            <For each={validators()}>
                                {(validator) => (
                                    <div class="p-5 hover:bg-white/[0.02] transition-colors">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-4">
                                                <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${validator.isActive
                                                        ? 'bg-green-500/10 text-green-400'
                                                        : 'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                    <Shield class="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div class="text-sm font-bold text-white font-mono">{validator.address}</div>
                                                    <div class="flex items-center gap-2 mt-1">
                                                        <span class={`text-[10px] font-black uppercase tracking-widest ${validator.isActive ? 'text-green-400' : 'text-amber-400'
                                                            }`}>
                                                            {validator.isActive ? 'Active' : 'Unstaking'}
                                                        </span>
                                                        <Show when={!validator.isActive}>
                                                            <span class="text-[9px] text-gray-500">
                                                                {formatTimeRemaining(validator.unlockTime)}
                                                            </span>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-sm font-black text-white">{validator.stakedAmount}</div>
                                                <div class="text-[10px] text-amber-400 font-bold">VCN Staked</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </For>
                        </div>
                        <div class="p-4 bg-white/[0.01] text-center">
                            <button class="text-[10px] font-black text-gray-500 hover:text-amber-400 uppercase tracking-widest transition-colors">
                                View All Validators
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security Notice */}
                <div class="p-6 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
                    <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Shield class="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h4 class="text-sm font-black text-white mb-1">Optimistic Finality Security</h4>
                        <p class="text-xs text-gray-400 leading-relaxed">
                            Validators secure the bridge by attesting to cross-chain transfers. Invalid attestations
                            can be challenged within the 15-minute challenge period. Valid challenges result in
                            slashing {stats().slashPercent}% of the validator's stake, which is awarded to the challenger.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
