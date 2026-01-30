import { createSignal, createEffect, For, Show, onMount } from 'solid-js';
import {
    Zap,
    TrendingUp,
    Clock,
    AlertCircle,
    Settings,
    Save,
    PieChart,
    Activity,
    Shield,
    DollarSign,
    RefreshCw,
    Users,
    Ban,
    CheckCircle2,
    XCircle,
    Wallet,
    ArrowRightLeft
} from 'lucide-solid';
import { getFirebaseDb, DefiConfig, getDefiConfig, updateDefiConfig } from '../../services/firebaseService';
import { collection, query, getDocs, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { ethers } from 'ethers';

// ============ Bridge Staking Contract Config ============
const BRIDGE_STAKING_ADDRESS = '0x21915b79E1d334499272521a3508061354D13FF0';

const BRIDGE_STAKING_ABI = [
    'function totalStaked() external view returns (uint256)',
    'function getActiveValidators() external view returns (address[])',
    'function MINIMUM_STAKE() external view returns (uint256)',
    'function COOLDOWN_PERIOD() external view returns (uint256)',
    'function SLASH_PERCENTAGE() external view returns (uint256)',
    'function validators(address) external view returns (uint256 stakedAmount, uint256 unstakeRequestTime, uint256 unstakeAmount, uint256 rewardDebt, uint256 pendingRewards, bool isActive)',
    'function slash(address validator, address challenger) external returns (uint256)',
    'function owner() external view returns (address)',
    'function addSubsidy(uint256 amount, uint256 duration) external',
    'function withdrawSubsidy() external',
    'function currentAPY() external view returns (uint256)',
    'function getRewardInfo() external view returns (uint256 subsidyPool, uint256 feePool, uint256 subsidyRatePerSecond, uint256 subsidyEndTime, uint256 totalRewardsPaid)',
    'function totalRewardsPaid() external view returns (uint256)'
];

const VCN_TOKEN_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const VCN_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)'
];

// Extend Window interface
declare global {
    interface Window {
        ethereum?: any;
    }
}

interface ValidatorInfo {
    address: string;
    stakedAmount: string;
    isActive: boolean;
    unstakeAmount: string;
}

export default function AdminDeFi() {
    // Tab State
    const [activeTab, setActiveTab] = createSignal<'liquid' | 'bridge'>('liquid');

    // Liquid Staking State (existing)
    const [config, setConfig] = createSignal<DefiConfig | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [isSaving, setIsSaving] = createSignal(false);

    // Liquid Staking Form States
    const [apr, setApr] = createSignal(12.5);
    const [unbonding, setUnbonding] = createSignal(14);
    const [instantFee, setInstantFee] = createSignal(3.0);
    const [minStaking, setMinStaking] = createSignal(100);
    const [protocolFee, setProtocolFee] = createSignal(5.0);
    const [exchangeRate, setExchangeRate] = createSignal(1.0);

    // Bridge Staking State (new)
    const [bridgeLoading, setBridgeLoading] = createSignal(false);
    const [bridgeTotalStaked, setBridgeTotalStaked] = createSignal('0');
    const [bridgeValidators, setBridgeValidators] = createSignal<ValidatorInfo[]>([]);
    const [bridgeMinStake, setBridgeMinStake] = createSignal('10,000');
    const [bridgeCooldown, setBridgeCooldown] = createSignal(7);
    const [bridgeSlashPercent, setBridgeSlashPercent] = createSignal(50);
    const [isAdmin, setIsAdmin] = createSignal(false);
    const [walletAddress, setWalletAddress] = createSignal('');
    const [slashAddress, setSlashAddress] = createSignal('');
    const [slashIntentHash, setSlashIntentHash] = createSignal('');
    const [isSlashing, setIsSlashing] = createSignal(false);

    // Reward Pool State
    const [subsidyPool, setSubsidyPool] = createSignal('0');
    const [feePool, setFeePool] = createSignal('0');
    const [currentAPY, setCurrentAPY] = createSignal('0');
    const [subsidyEndTime, setSubsidyEndTime] = createSignal(0);
    const [totalRewardsPaid, setTotalRewardsPaid] = createSignal('0');

    // Add Subsidy Form
    const [subsidyAmount, setSubsidyAmount] = createSignal('');
    const [subsidyDuration, setSubsidyDuration] = createSignal(30); // days
    const [isAddingSubsidy, setIsAddingSubsidy] = createSignal(false);
    const [adminVcnBalance, setAdminVcnBalance] = createSignal('0');

    // Fetch Liquid Staking Data
    const fetchData = async () => {
        setLoading(true);
        try {
            const cfg = await getDefiConfig();
            setConfig(cfg);
            setApr(cfg.stakingApr);
            setUnbonding(cfg.unbondingDays);
            setInstantFee(cfg.instantUnstakeFee);
            setMinStaking(cfg.minStakingAmount);
            setProtocolFee(cfg.protocolFee);
            setExchangeRate(cfg.sVcnExchangeRate);
        } catch (e) {
            console.error("Failed to fetch De-Fi data:", e);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Bridge Staking Data (read-only, no wallet needed)
    const fetchBridgeData = async () => {
        setBridgeLoading(true);
        try {
            // Use JsonRpcProvider for read-only access - no wallet needed
            const provider = new ethers.JsonRpcProvider('https://api.visionchain.co/rpc-proxy');
            const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, provider);
            const vcn = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_ABI, provider);

            const [total, minStakeWei, cooldown, slash, owner, apy, rewardInfo] = await Promise.all([
                staking.totalStaked(),
                staking.MINIMUM_STAKE(),
                staking.COOLDOWN_PERIOD(),
                staking.SLASH_PERCENTAGE(),
                staking.owner(),
                staking.currentAPY().catch(() => 0n),
                staking.getRewardInfo().catch(() => [0n, 0n, 0n, 0n, 0n])
            ]);

            setBridgeTotalStaked(ethers.formatEther(total));
            setBridgeMinStake(Number(ethers.formatEther(minStakeWei)).toLocaleString());
            setBridgeCooldown(Number(cooldown) / (24 * 60 * 60));
            setBridgeSlashPercent(Number(slash));

            // Set reward info
            setSubsidyPool(ethers.formatEther(rewardInfo[0]));
            setFeePool(ethers.formatEther(rewardInfo[1]));
            setCurrentAPY((Number(apy) / 100).toFixed(2));
            setSubsidyEndTime(Number(rewardInfo[3]) * 1000);
            setTotalRewardsPaid(ethers.formatEther(rewardInfo[4]));

            // Check if current user is admin
            if (walletAddress() && owner.toLowerCase() === walletAddress().toLowerCase()) {
                setIsAdmin(true);
                // Get admin VCN balance
                const balance = await vcn.balanceOf(walletAddress());
                setAdminVcnBalance(ethers.formatEther(balance));
            }

            // Get validators
            try {
                const activeAddrs = await staking.getActiveValidators();
                const validatorInfos: ValidatorInfo[] = [];

                for (const addr of activeAddrs) {
                    const info = await staking.validators(addr);
                    validatorInfos.push({
                        address: addr,
                        stakedAmount: Number(ethers.formatEther(info.stakedAmount)).toLocaleString(),
                        isActive: info.isActive,
                        unstakeAmount: ethers.formatEther(info.unstakeAmount)
                    });
                }
                setBridgeValidators(validatorInfos);
            } catch {
                setBridgeValidators([]);
            }
        } catch (err) {
            console.error('Failed to fetch bridge staking data:', err);
        } finally {
            setBridgeLoading(false);
        }
    };

    // Handle Liquid Staking Update
    const handleUpdate = async () => {
        setIsSaving(true);
        try {
            const newCfg: Partial<DefiConfig> = {
                stakingApr: apr(),
                unbondingDays: unbonding(),
                instantUnstakeFee: instantFee(),
                minStakingAmount: minStaking(),
                protocolFee: protocolFee(),
                sVcnExchangeRate: exchangeRate()
            };
            await updateDefiConfig(newCfg);
            alert("De-Fi configuration updated successfully!");
            await fetchData();
        } catch (e) {
            alert("Failed to update De-Fi config");
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Slash Validator
    const handleSlash = async () => {
        if (!slashAddress() || !slashIntentHash()) {
            alert('Please enter validator address and intent hash');
            return;
        }

        setIsSlashing(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, signer);

            const tx = await staking.slash(slashAddress(), slashIntentHash());
            await tx.wait();

            alert('Validator slashed successfully!');
            setSlashAddress('');
            setSlashIntentHash('');
            await fetchBridgeData();
        } catch (err: any) {
            alert(err.reason || err.message || 'Failed to slash validator');
        } finally {
            setIsSlashing(false);
        }
    };

    // Handle Add Subsidy (Foundation Funding)
    const handleAddSubsidy = async () => {
        const amount = parseFloat(subsidyAmount());
        if (!amount || amount <= 0) {
            alert('Please enter a valid subsidy amount');
            return;
        }

        setIsAddingSubsidy(true);
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const vcn = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_ABI, signer);
            const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, signer);

            const amountWei = ethers.parseEther(subsidyAmount());
            const durationSeconds = subsidyDuration() * 24 * 60 * 60; // days to seconds

            // Check allowance and approve if needed
            const allowance = await vcn.allowance(walletAddress(), BRIDGE_STAKING_ADDRESS);
            if (allowance < amountWei) {
                const approveTx = await vcn.approve(BRIDGE_STAKING_ADDRESS, amountWei);
                await approveTx.wait();
            }

            // Add subsidy
            const tx = await staking.addSubsidy(amountWei, durationSeconds);
            await tx.wait();

            alert(`Successfully added ${amount.toLocaleString()} VCN subsidy for ${subsidyDuration()} days!`);
            setSubsidyAmount('');
            await fetchBridgeData();
        } catch (err: any) {
            alert(err.reason || err.message || 'Failed to add subsidy');
        } finally {
            setIsAddingSubsidy(false);
        }
    };

    // Format subsidy end time
    const formatSubsidyEndTime = () => {
        if (subsidyEndTime() <= Date.now()) return 'Ended';
        const remaining = subsidyEndTime() - Date.now();
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        return `${days}d ${hours}h remaining`;
    };

    // Connect wallet for admin functions
    const connectWallet = async () => {
        if (!window.ethereum) return;

        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            setWalletAddress(accounts[0]);
            await fetchBridgeData();
        } catch (err) {
            console.error('Failed to connect wallet:', err);
        }
    };

    createEffect(() => {
        fetchData();
    });

    onMount(async () => {
        if (window.ethereum) {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                setWalletAddress(accounts[0]);
            }
        }
        if (activeTab() === 'bridge') {
            fetchBridgeData();
        }
    });

    return (
        <div class="space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 class="text-3xl font-black text-white tracking-tight mb-2 uppercase italic flex items-center gap-3">
                        <Zap class="w-8 h-8 text-yellow-400" />
                        De-Fi <span class="text-yellow-400">Management</span>
                    </h2>
                    <p class="text-gray-500 font-medium">Configure staking parameters and manage bridge validators</p>
                </div>
                <button
                    onClick={() => activeTab() === 'liquid' ? fetchData() : fetchBridgeData()}
                    class="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center gap-3 transition-all group"
                >
                    <RefreshCw class={`w-5 h-5 text-gray-400 group-hover:text-white transition-all ${loading() || bridgeLoading() ? 'animate-spin' : ''}`} />
                    <span class="font-bold text-sm">Sync Metrics</span>
                </button>
            </div>

            {/* Tabs */}
            <div class="flex bg-white/[0.03] p-1 rounded-2xl max-w-md">
                <button
                    onClick={() => { setActiveTab('liquid'); fetchData(); }}
                    class={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab() === 'liquid' ? 'bg-yellow-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'
                        }`}
                >
                    <PieChart class="w-4 h-4" />
                    Liquid Staking
                </button>
                <button
                    onClick={() => { setActiveTab('bridge'); fetchBridgeData(); }}
                    class={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab() === 'bridge' ? 'bg-amber-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'
                        }`}
                >
                    <Shield class="w-4 h-4" />
                    Bridge Validators
                </button>
            </div>

            {/* ========== LIQUID STAKING TAB ========== */}
            <Show when={activeTab() === 'liquid'}>
                {/* Metrics Dashboard */}
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-yellow-500">
                            <PieChart class="w-16 h-16" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Total VCN Locked</div>
                        <div class="text-3xl font-black text-white mb-2">{(config()?.totalVcnLocked || 0).toLocaleString()} VCN</div>
                        <div class="text-sm font-medium text-yellow-400/80 italic">TVL Maturity: Stable</div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-cyan-500">
                            <Activity class="w-16 h-16" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">sVCN Issued</div>
                        <div class="text-3xl font-black text-white mb-2">{(config()?.totalSVcnIssued || 0).toLocaleString()} sVCN</div>
                        <div class="text-sm font-medium text-cyan-400/80 italic">Liquid Supply Factor</div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-green-500">
                            <TrendingUp class="w-16 h-16" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Current Exchange Rate</div>
                        <div class="text-3xl font-black text-white mb-2">1:{exchangeRate().toFixed(4)}</div>
                        <div class="text-sm font-medium text-green-400/80 italic">sVCN / VCN Ratio</div>
                    </div>

                    <div class="bg-gradient-to-br from-yellow-600/10 to-orange-600/10 border border-yellow-500/20 rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                            <DollarSign class="w-16 h-16 text-yellow-400" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Current APR</div>
                        <div class="text-3xl font-black text-white mb-2">{apr()}%</div>
                        <div class="text-sm font-medium text-white/50 italic">Compounding Active</div>
                    </div>
                </div>

                {/* Configuration Form */}
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-10 shadow-2xl">
                            <div class="flex items-center gap-4 mb-10">
                                <div class="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                    <Settings class="w-6 h-6 text-yellow-400" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-black text-white italic tracking-tight uppercase">Protocol <span class="text-yellow-400">Parameters</span></h3>
                                    <p class="text-gray-500 text-xs font-medium">Admin-level overrides for staking mechanics</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* APR Setting */}
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Global Staking APR (%)</label>
                                    <div class="relative group">
                                        <input
                                            type="number" step="0.1" value={apr()}
                                            onInput={(e) => setApr(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                                        />
                                        <div class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">%</div>
                                    </div>
                                </div>

                                {/* Unbonding Setting */}
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Unbonding Period (Days)</label>
                                    <div class="relative">
                                        <input
                                            type="number" value={unbonding()}
                                            onInput={(e) => setUnbonding(parseInt(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                                        />
                                        <Clock class="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-700" />
                                    </div>
                                </div>

                                {/* Instant Exit Fee */}
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Instant Exit Fee (%)</label>
                                    <div class="relative">
                                        <input
                                            type="number" step="0.1" value={instantFee()}
                                            onInput={(e) => setInstantFee(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-red-400 outline-none focus:border-red-500/50 transition-all font-mono"
                                        />
                                        <div class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 font-black">%</div>
                                    </div>
                                </div>

                                {/* Min Staking */}
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Min Staking Amount</label>
                                    <div class="relative">
                                        <input
                                            type="number" value={minStaking()}
                                            onInput={(e) => setMinStaking(parseInt(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                                        />
                                        <div class="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 uppercase">VCN</div>
                                    </div>
                                </div>

                                {/* Exchange Rate */}
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Manual Exchange Rate Override</label>
                                    <div class="relative">
                                        <input
                                            type="number" step="0.0001" value={exchangeRate()}
                                            onInput={(e) => setExchangeRate(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-cyan-400 outline-none focus:border-cyan-500/50 transition-all font-mono"
                                        />
                                        <RefreshCw class="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-700" />
                                    </div>
                                </div>

                                {/* Protocol Fee */}
                                <div class="space-y-3">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Protocol Yield Fee (%)</label>
                                    <div class="relative">
                                        <input
                                            type="number" step="0.1" value={protocolFee()}
                                            onInput={(e) => setProtocolFee(parseFloat(e.currentTarget.value))}
                                            class="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-2xl font-black text-orange-400 outline-none focus:border-orange-500/50 transition-all font-mono"
                                        />
                                        <Shield class="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-700" />
                                    </div>
                                </div>
                            </div>

                            <div class="mt-12 flex items-center justify-between p-6 bg-yellow-500/5 border border-yellow-500/10 rounded-2xl">
                                <div class="flex items-center gap-4">
                                    <AlertCircle class="w-6 h-6 text-yellow-500" />
                                    <div class="text-xs font-medium text-gray-400">Updating these parameters will affect new and existing staking positions protocol-wide.</div>
                                </div>
                                <button
                                    onClick={handleUpdate}
                                    disabled={isSaving()}
                                    class="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-black font-black rounded-xl shadow-xl shadow-yellow-500/20 transition-all uppercase tracking-widest text-[11px] flex items-center gap-3"
                                >
                                    <Show when={isSaving()} fallback={<><Save class="w-4 h-4" /> Save changes</>}>
                                        <RefreshCw class="w-4 h-4 animate-spin" /> Updating...
                                    </Show>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Info Panel */}
                    <div class="space-y-6">
                        <div class="bg-gradient-to-br from-gray-900 to-black border border-white/5 rounded-[32px] p-8 shadow-2xl">
                            <h4 class="text-lg font-black text-white italic mb-6 uppercase tracking-tighter">System <span class="text-yellow-400">Integrity</span></h4>
                            <div class="space-y-6">
                                <div class="flex items-start gap-4">
                                    <div class="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                                        <Shield class="w-4 h-4 text-green-400" />
                                    </div>
                                    <div>
                                        <div class="text-[11px] font-black text-white uppercase tracking-wider mb-1">sVCN Value Guard</div>
                                        <p class="text-[10px] text-gray-500 leading-relaxed font-medium">The exchange rate is protected by a 1:1 floor.</p>
                                    </div>
                                </div>
                                <div class="flex items-start gap-4">
                                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                        <PieChart class="w-4 h-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <div class="text-[11px] font-black text-white uppercase tracking-wider mb-1">Liquid Staking Yield</div>
                                        <p class="text-[10px] text-gray-500 leading-relaxed font-medium">Rewards distributed via sVCN value appreciation.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* ========== BRIDGE VALIDATORS TAB ========== */}
            <Show when={activeTab() === 'bridge'}>

                {/* Bridge Metrics */}
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-amber-500">
                            <Shield class="w-16 h-16" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Total Bridge Staked</div>
                        <div class="text-3xl font-black text-white mb-2">{Number(bridgeTotalStaked()).toLocaleString()} VCN</div>
                        <div class="text-sm font-medium text-amber-400/80 italic">Validator Security</div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-green-500">
                            <Users class="w-16 h-16" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Active Validators</div>
                        <div class="text-3xl font-black text-white mb-2">{bridgeValidators().length}</div>
                        <div class="text-sm font-medium text-green-400/80 italic flex items-center gap-2">
                            <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> Online
                        </div>
                    </div>

                    <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500 text-blue-500">
                            <Clock class="w-16 h-16" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Cooldown Period</div>
                        <div class="text-3xl font-black text-white mb-2">{bridgeCooldown()} Days</div>
                        <div class="text-sm font-medium text-blue-400/80 italic">Unstake Delay</div>
                    </div>

                    <div class="bg-gradient-to-br from-red-600/10 to-orange-600/10 border border-red-500/20 rounded-[32px] p-8 relative overflow-hidden group">
                        <div class="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform duration-500">
                            <AlertCircle class="w-16 h-16 text-red-400" />
                        </div>
                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Slash Rate</div>
                        <div class="text-3xl font-black text-red-400 mb-2">{bridgeSlashPercent()}%</div>
                        <div class="text-sm font-medium text-red-400/60 italic">On Invalid Proof</div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Validators List */}
                    <div class="lg:col-span-2">
                        <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] overflow-hidden">
                            <div class="p-6 border-b border-white/5 flex items-center justify-between">
                                <h3 class="text-lg font-black text-white flex items-center gap-3">
                                    <Users class="w-5 h-5 text-amber-400" />
                                    Active Validators ({bridgeValidators().length})
                                </h3>
                                <button
                                    onClick={fetchBridgeData}
                                    class="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <RefreshCw class={`w-4 h-4 text-gray-500 ${bridgeLoading() ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div class="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                                <Show when={bridgeValidators().length > 0} fallback={
                                    <div class="p-12 text-center">
                                        <Shield class="w-16 h-16 text-gray-700 mx-auto mb-4" />
                                        <p class="text-gray-500">No validators registered yet</p>
                                    </div>
                                }>
                                    <For each={bridgeValidators()}>
                                        {(validator) => (
                                            <div class="p-5 hover:bg-white/[0.02] transition-colors">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-4">
                                                        <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${validator.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                            }`}>
                                                            <Shield class="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div class="text-sm font-bold text-white font-mono">
                                                                {validator.address.slice(0, 6)}...{validator.address.slice(-4)}
                                                            </div>
                                                            <span class={`text-[10px] font-black uppercase tracking-widest ${validator.isActive ? 'text-green-400' : 'text-red-400'
                                                                }`}>
                                                                {validator.isActive ? 'Active' : 'Inactive'}
                                                            </span>
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
                                </Show>
                            </div>
                        </div>
                    </div>

                    {/* Admin Controls */}
                    <div class="space-y-6">
                        {/* Foundation Funding - Subsidy Management */}
                        <div class="bg-gradient-to-br from-green-900/20 to-black border border-green-500/20 rounded-[32px] p-8">
                            <div class="flex items-center gap-3 mb-6">
                                <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                    <DollarSign class="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h4 class="text-lg font-black text-white italic uppercase tracking-tight">Foundation <span class="text-green-400">Funding</span></h4>
                                    <p class="text-[10px] text-gray-500">Add VCN subsidies to incentivize validator staking</p>
                                </div>
                            </div>

                            {/* Funding Guide */}
                            <div class="mb-6 p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
                                <h5 class="text-[11px] font-black text-green-400 uppercase tracking-widest mb-3">How Validator Rewards Work</h5>
                                <div class="space-y-2 text-[10px] text-gray-400">
                                    <p>1. <strong class="text-white">Subsidy Pool</strong> - Foundation deposits VCN as initial incentives</p>
                                    <p>2. <strong class="text-white">Fee Pool</strong> - Bridge transaction fees (0.1%) accumulate automatically</p>
                                    <p>3. <strong class="text-white">Distribution</strong> - Rewards distributed proportionally to staked amount</p>
                                    <p>4. <strong class="text-white">APY Calculation</strong> - (Annual Rewards / Total Staked) x 100</p>
                                </div>
                                <div class="mt-3 pt-3 border-t border-green-500/10">
                                    <p class="text-[10px] text-green-400/80">
                                        Recommended: Start with 100,000 VCN for 30 days to achieve ~12% APY target
                                    </p>
                                </div>
                            </div>

                            {/* Current Reward Pool Status */}
                            <div class="grid grid-cols-2 gap-4 mb-6">
                                <div class="bg-white/5 rounded-xl p-4">
                                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Subsidy Pool</div>
                                    <div class="text-lg font-black text-green-400">{Number(subsidyPool()).toLocaleString()} VCN</div>
                                    <div class="text-[9px] text-gray-600">{formatSubsidyEndTime()}</div>
                                </div>
                                <div class="bg-white/5 rounded-xl p-4">
                                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Fee Pool</div>
                                    <div class="text-lg font-black text-blue-400">{Number(feePool()).toLocaleString()} VCN</div>
                                    <div class="text-[9px] text-gray-600">From bridge fees</div>
                                </div>
                                <div class="bg-white/5 rounded-xl p-4">
                                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Current APY</div>
                                    <div class="text-lg font-black text-amber-400">{currentAPY()}%</div>
                                    <div class="text-[9px] text-gray-600">Validator reward rate</div>
                                </div>
                                <div class="bg-white/5 rounded-xl p-4">
                                    <div class="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Total Paid</div>
                                    <div class="text-lg font-black text-white">{Number(totalRewardsPaid()).toLocaleString()} VCN</div>
                                    <div class="text-[9px] text-gray-600">Rewards distributed</div>
                                </div>
                            </div>

                            <Show when={isAdmin()} fallback={
                                <div class="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                                    <p class="text-gray-500 text-xs">Admin wallet required to add subsidy</p>
                                    <button
                                        onClick={connectWallet}
                                        class="mt-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-bold rounded-lg"
                                    >
                                        Connect Admin Wallet
                                    </button>
                                </div>
                            }>
                                <div class="space-y-4">
                                    <div class="p-3 bg-white/5 rounded-lg flex justify-between items-center">
                                        <span class="text-[10px] text-gray-500">Your VCN Balance</span>
                                        <span class="text-sm font-bold text-white">{Number(adminVcnBalance()).toLocaleString()} VCN</span>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Subsidy Amount (VCN)</label>
                                        <input
                                            type="number"
                                            value={subsidyAmount()}
                                            onInput={(e) => setSubsidyAmount(e.currentTarget.value)}
                                            placeholder="100000"
                                            class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Distribution Period (Days)</label>
                                        <div class="flex gap-2">
                                            {[7, 14, 30, 60, 90].map((days) => (
                                                <button
                                                    onClick={() => setSubsidyDuration(days)}
                                                    class={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${subsidyDuration() === days
                                                            ? 'bg-green-500 text-black'
                                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                        }`}
                                                >
                                                    {days}d
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <Show when={subsidyAmount()}>
                                        <div class="p-3 bg-green-500/5 border border-green-500/10 rounded-lg">
                                            <div class="text-[10px] text-gray-500 mb-1">Estimated APY (if 100K VCN staked)</div>
                                            <div class="text-lg font-black text-green-400">
                                                {((parseFloat(subsidyAmount() || '0') / 100000) * (365 / subsidyDuration()) * 100).toFixed(1)}%
                                            </div>
                                        </div>
                                    </Show>
                                    <button
                                        onClick={handleAddSubsidy}
                                        disabled={isAddingSubsidy() || !subsidyAmount()}
                                        class="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <Show when={isAddingSubsidy()} fallback={<><DollarSign class="w-4 h-4" /> Add Subsidy</>}>
                                            <RefreshCw class="w-4 h-4 animate-spin" /> Adding...
                                        </Show>
                                    </button>
                                </div>
                            </Show>
                        </div>

                        {/* Slash Validator */}
                        <div class="bg-gradient-to-br from-red-900/20 to-black border border-red-500/20 rounded-[32px] p-8">
                            <div class="flex items-center gap-3 mb-6">
                                <div class="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                    <Ban class="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h4 class="text-lg font-black text-white italic uppercase tracking-tight">Slash <span class="text-red-400">Validator</span></h4>
                                    <p class="text-[10px] text-gray-500">Admin only - penalize malicious validators</p>
                                </div>
                            </div>

                            <Show when={isAdmin()} fallback={
                                <div class="p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                                    <p class="text-gray-500 text-xs">Admin wallet required</p>
                                </div>
                            }>
                                <div class="space-y-4">
                                    <div>
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Validator Address</label>
                                        <input
                                            type="text"
                                            value={slashAddress()}
                                            onInput={(e) => setSlashAddress(e.currentTarget.value)}
                                            placeholder="0x..."
                                            class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                                        />
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">Challenger Address</label>
                                        <input
                                            type="text"
                                            value={slashIntentHash()}
                                            onInput={(e) => setSlashIntentHash(e.currentTarget.value)}
                                            placeholder="0x..."
                                            class="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSlash}
                                        disabled={isSlashing() || !slashAddress() || !slashIntentHash()}
                                        class="w-full py-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <Show when={isSlashing()} fallback={<><Ban class="w-4 h-4" /> Execute Slash</>}>
                                            <RefreshCw class="w-4 h-4 animate-spin" /> Slashing...
                                        </Show>
                                    </button>
                                </div>
                            </Show>
                        </div>

                        {/* Contract Info */}
                        <div class="bg-[#111113] border border-white/[0.05] rounded-[32px] p-8">
                            <h4 class="text-sm font-black text-white uppercase tracking-widest mb-4">Contract Info</h4>
                            <div class="space-y-3">
                                <div class="flex justify-between items-center">
                                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">Address</span>
                                    <span class="text-[10px] font-mono text-amber-400">{BRIDGE_STAKING_ADDRESS.slice(0, 8)}...</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">Min Stake</span>
                                    <span class="text-sm font-bold text-white">{bridgeMinStake()} VCN</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">Cooldown</span>
                                    <span class="text-sm font-bold text-white">{bridgeCooldown()} days</span>
                                </div>
                                <div class="flex justify-between items-center">
                                    <span class="text-[10px] text-gray-500 uppercase tracking-widest">Slash %</span>
                                    <span class="text-sm font-bold text-red-400">{bridgeSlashPercent()}%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
