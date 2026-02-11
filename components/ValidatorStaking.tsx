import { createSignal, createEffect, Show, For, onMount } from 'solid-js';
import {
    Shield,
    Lock,
    Unlock,
    AlertTriangle,
    Users,
    CheckCircle2,
    XCircle,
    Timer,
    Gift,
    Percent,
    Wallet,
    ArrowRight,
    Info,
    ExternalLink
} from 'lucide-solid';
import { ethers } from 'ethers';
import { WalletViewHeader } from './wallet/WalletViewHeader';
import { useI18n } from '../i18n/i18nContext';
import { contractService } from '../services/contractService';
import { WalletService } from '../services/walletService';

// ============ Contract Config ============
const BRIDGE_STAKING_ADDRESS = '0x593dFDc2e31F32D17B981392786F84b0E1228Ab6'; // BridgeStaking V3 (with stakeFor)
const VCN_TOKEN_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // VCN Token address
const RPC_URL = 'https://api.visionchain.co/rpc-proxy'; // HTTPS RPC Proxy
const PAYMASTER_URL = 'https://paymaster-sapjcm3s5a-uc.a.run.app'; // Paymaster API

const BRIDGE_STAKING_ABI = [
    'function stake(uint256 amount) external',
    'function requestUnstake(uint256 amount) external',
    'function withdraw() external',
    'function cancelUnstake() external',
    'function claimRewards() external',
    'function getStake(address account) external view returns (uint256)',
    'function getPendingUnstake(address account) external view returns (uint256 amount, uint256 unlockTime)',
    'function isActiveValidator(address account) external view returns (bool)',
    'function totalStaked() external view returns (uint256)',
    'function getActiveValidators() external view returns (address[])',
    'function MINIMUM_STAKE() external view returns (uint256)',
    'function COOLDOWN_PERIOD() external view returns (uint256)',
    'function SLASH_PERCENTAGE() external view returns (uint256)',
    'function pendingReward(address account) external view returns (uint256)',
    'function currentAPY() external view returns (uint256)',
    'function getRewardInfo() external view returns (uint256 subsidyPool, uint256 feePool, uint256 subsidyRatePerSecond, uint256 subsidyEndTime, uint256 totalRewardsPaid)',
    'function validators(address) external view returns (uint256 stakedAmount, uint256 unstakeRequestTime, uint256 unstakeAmount, uint256 rewardDebt, uint256 pendingRewards, bool isActive)'
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)'
];

// ============ Types ============
interface ValidatorInfo {
    address: string;
    stakedAmount: string;
    isActive: boolean;
    pendingUnstake: string;
    unlockTime: number;
}

interface UserStakingInfo {
    stakedAmount: string;
    pendingUnstake: string;
    unlockTime: number;
    isActive: boolean;
    vcnBalance: string;
    pendingRewards: string;
}

// ============ Props ============
interface ValidatorStakingProps {
    walletAddress?: () => string;
    privateKey?: () => string;
    userEmail?: () => string;
}

// ============ Component ============
export default function ValidatorStaking(props: ValidatorStakingProps) {
    const { t } = useI18n();
    // State - Use prop walletAddress if available
    const isConnected = () => !!(props.walletAddress?.() || '');
    const [totalStaked, setTotalStaked] = createSignal('0');
    const [activeValidatorCount, setActiveValidatorCount] = createSignal(0);
    const [minStake, setMinStake] = createSignal('10,000');
    const [cooldownDays, setCooldownDays] = createSignal(7);
    const [slashPercent, setSlashPercent] = createSignal(50);

    const [userInfo, setUserInfo] = createSignal<UserStakingInfo>({
        stakedAmount: '0',
        pendingUnstake: '0',
        unlockTime: 0,
        isActive: false,
        vcnBalance: '0',
        pendingRewards: '0'
    });

    const [currentAPY, setCurrentAPY] = createSignal('0');
    const [subsidyPool, setSubsidyPool] = createSignal('0');
    const [feePool, setFeePool] = createSignal('0');

    const [validators, setValidators] = createSignal<ValidatorInfo[]>([]);
    const [stakeAmount, setStakeAmount] = createSignal('');
    const [unstakeAmount, setUnstakeAmount] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [activeTab, setActiveTab] = createSignal<'stake' | 'unstake' | 'withdraw'>('stake');
    const [txStatus, setTxStatus] = createSignal<'idle' | 'approving' | 'pending' | 'success' | 'error'>('idle');
    const [txHash, setTxHash] = createSignal('');
    const [errorMsg, setErrorMsg] = createSignal('');

    // Password Modal State
    const [showPasswordModal, setShowPasswordModal] = createSignal(false);
    const [password, setPassword] = createSignal('');
    const [unlockedPrivateKey, setUnlockedPrivateKey] = createSignal('');
    const [pendingAction, setPendingAction] = createSignal<(() => Promise<void>) | null>(null);

    // Connect wallet
    // Wallet address from parent
    const walletAddress = () => props.walletAddress?.() || '';

    // Load contract data
    const loadContractData = async () => {
        if (!walletAddress()) return;

        try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, provider);
            const vcn = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);

            // Get global stats
            const [total, minStakeWei, cooldown, slash] = await Promise.all([
                staking.totalStaked(),
                staking.MINIMUM_STAKE(),
                staking.COOLDOWN_PERIOD(),
                staking.SLASH_PERCENTAGE()
            ]);

            setTotalStaked(ethers.formatEther(total));
            setMinStake(Number(ethers.formatEther(minStakeWei)).toLocaleString());
            setCooldownDays(Number(cooldown) / (24 * 60 * 60));
            setSlashPercent(Number(slash));

            // Get user info and rewards
            const [userStake, pendingInfo, isActive, vcnBalance, pendingRewards, apy, rewardInfo] = await Promise.all([
                staking.getStake(walletAddress()),
                staking.getPendingUnstake(walletAddress()),
                staking.isActiveValidator(walletAddress()),
                vcn.balanceOf(walletAddress()),
                staking.pendingReward(walletAddress()),
                staking.currentAPY().catch(() => 0n),
                staking.getRewardInfo().catch(() => [0n, 0n, 0n, 0n, 0n])
            ]);

            setUserInfo({
                stakedAmount: ethers.formatEther(userStake),
                pendingUnstake: ethers.formatEther(pendingInfo[0]),
                unlockTime: Number(pendingInfo[1]) * 1000,
                isActive,
                vcnBalance: ethers.formatEther(vcnBalance),
                pendingRewards: ethers.formatEther(pendingRewards)
            });

            // APY in basis points (10000 = 100%)
            setCurrentAPY((Number(apy) / 100).toFixed(2));
            setSubsidyPool(ethers.formatEther(rewardInfo[0]));
            setFeePool(ethers.formatEther(rewardInfo[1]));

            // Get active validators
            try {
                const activeAddrs = await staking.getActiveValidators();
                setActiveValidatorCount(activeAddrs.length);

                const validatorInfos: ValidatorInfo[] = [];
                for (const addr of activeAddrs.slice(0, 5)) {
                    const info = await staking.validators(addr);
                    validatorInfos.push({
                        address: `${addr.slice(0, 6)}...${addr.slice(-4)}`,
                        stakedAmount: Number(ethers.formatEther(info.stakedAmount)).toLocaleString(),
                        isActive: info.isActive,
                        pendingUnstake: ethers.formatEther(info.unstakeAmount),
                        unlockTime: Number(info.unstakeRequestTime) * 1000 + Number(cooldown) * 1000
                    });
                }
                setValidators(validatorInfos);
            } catch {
                // No validators yet
                setValidators([]);
            }
        } catch (err) {
            console.error('Failed to load contract data:', err);
        }
    };

    // Get private key - either from prop or unlock with password
    const getPrivateKeyOrPrompt = async (action: () => Promise<void>): Promise<string | null> => {
        // First check if we have it from prop
        const propKey = props.privateKey?.();
        if (propKey) return propKey;

        // Check if already unlocked
        if (unlockedPrivateKey()) return unlockedPrivateKey();

        // Need to prompt for password
        setPendingAction(() => action);
        setShowPasswordModal(true);
        return null;
    };

    // Handle password submit
    const handlePasswordSubmit = async () => {
        const userEmail = props.userEmail?.();
        if (!userEmail) {
            setErrorMsg('User email not available');
            return;
        }

        try {
            const encrypted = WalletService.getEncryptedWallet(userEmail);
            if (!encrypted) {
                setErrorMsg('Wallet not found. Please restore your wallet.');
                return;
            }

            const mnemonic = await WalletService.decrypt(encrypted, password());
            if (!WalletService.validateMnemonic(mnemonic)) {
                setErrorMsg('Invalid password. Please try again.');
                return;
            }

            const { privateKey } = WalletService.deriveEOA(mnemonic);
            setUnlockedPrivateKey(privateKey);
            setShowPasswordModal(false);
            setPassword('');

            // Execute pending action
            const action = pendingAction();
            if (action) {
                setPendingAction(null);
                await action();
            }
        } catch (e: any) {
            setErrorMsg(e.message || 'Failed to unlock wallet');
        }
    };

    // Handle stake using Paymaster (gasless)
    const handleStake = async () => {
        const amount = parseFloat(stakeAmount());
        if (!amount || amount < parseFloat(minStake().replace(/,/g, ''))) {
            setErrorMsg(`Minimum stake is ${minStake()} VCN`);
            return;
        }

        const executeStake = async () => {
            try {
                setIsLoading(true);
                setTxStatus('approving');
                setErrorMsg('');

                const privateKey = props.privateKey?.() || unlockedPrivateKey();
                if (!privateKey) {
                    throw new Error('Internal wallet not available');
                }

                const provider = new ethers.JsonRpcProvider(RPC_URL);
                const signer = new ethers.Wallet(privateKey, provider);
                const userAddress = await signer.getAddress();

                const amountWei = ethers.parseEther(stakeAmount());
                const feeWei = ethers.parseEther('1'); // 1 VCN fee
                const totalAmount = amountWei + feeWei;
                const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

                // EIP-712 Permit signing (gasless - no on-chain tx needed from user)
                const vcnContract = new ethers.Contract(VCN_TOKEN_ADDRESS, [
                    ...ERC20_ABI,
                    'function nonces(address owner) view returns (uint256)',
                    'function name() view returns (string)'
                ], signer);

                const [tokenName, nonce] = await Promise.all([
                    vcnContract.name(),
                    vcnContract.nonces(userAddress)
                ]);

                // Paymaster admin address (spender who will transferFrom)
                const PAYMASTER_ADMIN = '0x08A1B183a53a0f8f1D875945D504272738E3AF34';

                const domain = {
                    name: tokenName,
                    version: '1',
                    chainId: 3151909, // Vision Chain v2
                    verifyingContract: VCN_TOKEN_ADDRESS
                };

                const types = {
                    Permit: [
                        { name: 'owner', type: 'address' },
                        { name: 'spender', type: 'address' },
                        { name: 'value', type: 'uint256' },
                        { name: 'nonce', type: 'uint256' },
                        { name: 'deadline', type: 'uint256' }
                    ]
                };

                const values = {
                    owner: userAddress,
                    spender: PAYMASTER_ADMIN,
                    value: totalAmount,
                    nonce: nonce,
                    deadline: deadline
                };

                console.log('[Staking] Signing EIP-712 Permit...');
                const signature = await signer.signTypedData(domain, types, values);
                console.log('[Staking] Permit signed successfully');

                setTxStatus('pending');
                console.log('[Staking] Calling Paymaster API...');

                // Call Paymaster API (admin pays gas, user pays via permit)
                const response = await fetch(PAYMASTER_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'staking',
                        stakeAction: 'stake',
                        user: userAddress,
                        amount: amountWei.toString(),
                        fee: feeWei.toString(),
                        deadline: deadline,
                        signature: signature
                    })
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Staking failed');
                }

                console.log('[Staking] Success:', result);
                setTxHash(result.txHash);
                setTxStatus('success');
                setStakeAmount('');
                await loadContractData();

                setTimeout(() => setTxStatus('idle'), 5000);
            } catch (err: any) {
                console.error('[Staking] Error:', err);
                setTxStatus('error');
                setErrorMsg(err.reason || err.message || 'Transaction failed');
            } finally {
                setIsLoading(false);
            }
        };

        // Check if we have privateKey, if not prompt for password
        const key = await getPrivateKeyOrPrompt(executeStake);
        if (key) {
            await executeStake();
        }
    };

    // Handle unstake request using Paymaster (gasless)
    const handleUnstake = async () => {
        const amount = parseFloat(unstakeAmount());
        const staked = parseFloat(userInfo().stakedAmount);
        const minStakeNum = parseFloat(minStake().replace(/,/g, ''));

        if (!amount || amount <= 0) {
            setErrorMsg('Please enter a valid amount');
            return;
        }
        if (amount > staked) {
            setErrorMsg('Unstake amount exceeds staked balance');
            return;
        }

        // Minimum stake constraint: remaining must be 0 or >= MINIMUM_STAKE
        const remaining = staked - amount;
        if (remaining > 0 && remaining < minStakeNum) {
            setErrorMsg(`Remaining stake would be ${remaining.toLocaleString()} VCN, below minimum ${minStakeNum.toLocaleString()} VCN. Unstake all or keep at least ${minStakeNum.toLocaleString()} VCN staked.`);
            return;
        }

        try {
            setIsLoading(true);
            setTxStatus('pending');
            setErrorMsg('');

            const amountWei = ethers.parseEther(unstakeAmount());

            console.log('[Staking] Requesting unstake via Paymaster...');
            const response = await fetch(PAYMASTER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'staking',
                    stakeAction: 'unstake',
                    user: walletAddress(),
                    amount: amountWei.toString(),
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                // Extract meaningful error message from Paymaster response
                let errMsg = result.error || 'Unstake request failed';
                if (errMsg.includes('Would drop below minimum')) {
                    errMsg = `Cannot unstake: remaining balance would drop below minimum stake (${minStakeNum.toLocaleString()} VCN). Unstake the full amount instead.`;
                }
                throw new Error(errMsg);
            }

            console.log('[Staking] Unstake success:', result);
            setTxHash(result.txHash);
            setTxStatus('success');
            setUnstakeAmount('');
            await loadContractData();

            setTimeout(() => setTxStatus('idle'), 5000);
        } catch (err: any) {
            console.error('[Staking] Unstake error:', err);
            setTxStatus('error');
            setErrorMsg(err.reason || err.message || 'Transaction failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle withdraw using Paymaster (gasless)
    const handleWithdraw = async () => {
        try {
            setIsLoading(true);
            setTxStatus('pending');
            setErrorMsg('');

            console.log('[Staking] Withdrawing via Paymaster...');
            const response = await fetch(PAYMASTER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'staking',
                    stakeAction: 'withdraw',
                    user: walletAddress(),
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Withdraw failed');
            }

            console.log('[Staking] Withdraw success:', result);
            setTxHash(result.txHash);
            setTxStatus('success');
            await loadContractData();

            setTimeout(() => setTxStatus('idle'), 5000);
        } catch (err: any) {
            console.error('[Staking] Withdraw error:', err);
            setTxStatus('error');
            setErrorMsg(err.reason || err.message || 'Transaction failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle claim rewards using Paymaster (gasless)
    const handleClaimRewards = async () => {
        const pending = parseFloat(userInfo().pendingRewards);
        if (pending <= 0) {
            setErrorMsg('No rewards to claim');
            return;
        }

        try {
            setIsLoading(true);
            setTxStatus('pending');
            setErrorMsg('');

            console.log('[Staking] Claiming rewards via Paymaster...');
            const response = await fetch(PAYMASTER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'staking',
                    stakeAction: 'claim',
                    user: walletAddress(),
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Claim failed');
            }

            console.log('[Staking] Claim success:', result);
            setTxHash(result.txHash);
            setTxStatus('success');
            await loadContractData();

            setTimeout(() => setTxStatus('idle'), 5000);
        } catch (err: any) {
            setTxStatus('error');
            setErrorMsg(err.reason || err.message || 'Transaction failed');
        } finally {
            setIsLoading(false);
        }
    };

    // Format time remaining
    const formatTimeRemaining = (unlockTime: number) => {
        const remaining = unlockTime - Date.now();
        if (remaining <= 0) return 'Ready to withdraw';
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        return `${days}d ${hours}h remaining`;
    };

    // Load data on mount if wallet address is available
    onMount(async () => {
        if (walletAddress()) {
            await loadContractData();
        }
    });

    // Also reload when wallet address changes
    createEffect(() => {
        if (walletAddress()) {
            loadContractData();
        }
    });

    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            {/* Password Modal */}
            <Show when={showPasswordModal()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div class="bg-[#1a1a1c] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 overflow-hidden">
                        <h3 class="text-lg font-black text-white mb-4 flex items-center gap-2">
                            <Lock class="w-5 h-5 text-amber-400" />
                            {t('staking.spendingPasswordRequired')}
                        </h3>
                        <p class="text-sm text-gray-400 mb-4">
                            {t('staking.enterSpendingPassword')}
                        </p>
                        <input
                            type="password"
                            value={password()}
                            onInput={(e) => setPassword(e.currentTarget.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                            placeholder={t('staking.enterPassword')}
                            class="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-amber-500/50 focus:outline-none mb-4 box-border"
                        />
                        <Show when={errorMsg()}>
                            <p class="text-red-400 text-sm mb-4">{errorMsg()}</p>
                        </Show>
                        <div class="flex gap-3">
                            <button
                                onClick={() => { setShowPasswordModal(false); setPassword(''); setErrorMsg(''); }}
                                class="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-bold hover:bg-white/10 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasswordSubmit}
                                class="flex-1 py-3 rounded-xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors"
                            >
                                {t('bridge.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <WalletViewHeader
                    tag={t('staking.tag')}
                    title={t('staking.title')}
                    titleAccent={t('staking.titleAccent')}
                    description={t('staking.description')}
                    icon={Shield}
                    hideDescriptionOnMobile={true}
                />

                {/* Rewards & Conditions Card - NEW */}
                <div class="bg-gradient-to-r from-green-500/5 via-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl p-6">
                    <h3 class="text-lg font-black text-white mb-4 flex items-center gap-2">
                        <Gift class="w-5 h-5 text-amber-400" />
                        {t('staking.stakingRewardsConditions')}
                    </h3>
                    <div class="grid md:grid-cols-3 gap-4">
                        <div class="bg-black/20 rounded-xl p-4 border border-white/5">
                            <div class="flex items-center gap-2 mb-2">
                                <Percent class="w-4 h-4 text-green-400" />
                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('staking.annualApy')}</span>
                            </div>
                            <div class="text-2xl font-black text-green-400">12-20%</div>
                            <p class="text-[10px] text-gray-500 mt-1">{t('staking.dependsOnNetwork')}</p>
                        </div>
                        <div class="bg-black/20 rounded-xl p-4 border border-white/5">
                            <div class="flex items-center gap-2 mb-2">
                                <Gift class="w-4 h-4 text-amber-400" />
                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('staking.rewardSource')}</span>
                            </div>
                            <div class="text-sm font-bold text-white">{t('staking.bridgeFees')}</div>
                            <p class="text-[10px] text-gray-500 mt-1">{t('staking.bridgeFeePercent')}</p>
                        </div>
                        <div class="bg-black/20 rounded-xl p-4 border border-white/5">
                            <div class="flex items-center gap-2 mb-2">
                                <AlertTriangle class="w-4 h-4 text-red-400" />
                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('staking.slashingRisk')}</span>
                            </div>
                            <div class="text-2xl font-black text-red-400">{slashPercent()}%</div>
                            <p class="text-[10px] text-gray-500 mt-1">{t('staking.onInvalidProof')}</p>
                        </div>
                    </div>
                    <div class="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p class="text-[11px] text-gray-400">
                            <strong class="text-amber-400">{t('staking.howItWorks')}</strong> {t('staking.howItWorksDesc')} {slashPercent()}% {t('staking.stakeSlashedDesc')} <strong class="text-white">{minStake()} VCN</strong>,
                            {t('staking.unstakingCooldown')} <strong class="text-white">{cooldownDays()} {t('staking.days')}</strong>.
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">{t('staking.totalStaked')}</div>
                        <div class="text-2xl font-black text-white">{Number(totalStaked()).toLocaleString()}</div>
                        <div class="text-[10px] text-amber-400 font-bold">VCN</div>
                    </div>
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">{t('staking.activeValidators')}</div>
                        <div class="text-2xl font-black text-white">{activeValidatorCount()}</div>
                        <div class="text-[10px] text-green-400 font-bold flex items-center gap-1">
                            <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> {t('staking.online')}
                        </div>
                    </div>
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">{t('staking.minimumStake')}</div>
                        <div class="text-2xl font-black text-white">{minStake()}</div>
                        <div class="text-[10px] text-gray-500 font-bold">{t('staking.vcnRequired')}</div>
                    </div>
                    <div class="p-5 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <div class="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-2">{t('staking.cooldown')}</div>
                        <div class="text-2xl font-black text-white">{cooldownDays()}</div>
                        <div class="text-[10px] text-blue-400 font-bold">{t('staking.daysLabel')}</div>
                    </div>
                    <div class="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl">
                        <div class="text-[9px] font-black text-red-400/60 uppercase tracking-widest mb-2">{t('staking.slashRate')}</div>
                        <div class="text-2xl font-black text-red-400">{slashPercent()}%</div>
                        <div class="text-[10px] text-red-400/60 font-bold">{t('staking.onInvalidProofLabel')}</div>
                    </div>
                </div>

                {/* Connect Wallet or Main Panel */}
                <Show when={!isConnected()} fallback={
                    <div class="grid lg:grid-cols-2 gap-8">
                        {/* Stake/Unstake Form */}
                        <div class="bg-white/[0.02] border border-white/5 rounded-3xl p-8 min-w-0 overflow-hidden">
                            {/* User Balance Display */}
                            <div class="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                <div class="flex items-center justify-between mb-2">
                                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('staking.yourVcnBalance')}</span>
                                    <span class="text-lg font-black text-white">{Number(userInfo().vcnBalance).toLocaleString()} VCN</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('staking.yourStakedAmount')}</span>
                                    <span class="text-lg font-black text-amber-400">{Number(userInfo().stakedAmount).toLocaleString()} VCN</span>
                                </div>
                                <Show when={parseFloat(userInfo().pendingUnstake) > 0}>
                                    <div class="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('staking.pendingUnstake')}</span>
                                        <div class="text-right">
                                            <span class="text-sm font-black text-blue-400">{Number(userInfo().pendingUnstake).toLocaleString()} VCN</span>
                                            <div class="text-[9px] text-gray-500">{formatTimeRemaining(userInfo().unlockTime)}</div>
                                        </div>
                                    </div>
                                </Show>
                                {/* Pending Rewards Section */}
                                <div class="flex items-center justify-between mt-3 pt-3 border-t border-green-500/20">
                                    <div>
                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest block">{t('staking.pendingRewards')}</span>
                                        <span class="text-[9px] text-green-400/60">APY: {currentAPY()}%</span>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <span class="text-lg font-black text-green-400">{Number(userInfo().pendingRewards).toLocaleString(undefined, { maximumFractionDigits: 4 })} VCN</span>
                                        <button
                                            onClick={handleClaimRewards}
                                            disabled={isLoading() || parseFloat(userInfo().pendingRewards) <= 0}
                                            class="px-3 py-1.5 bg-green-500 hover:bg-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold text-xs rounded-lg transition-all"
                                        >
                                            {t('staking.claim')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div class="flex bg-white/[0.03] p-1 rounded-xl mb-6">
                                <button
                                    onClick={() => setActiveTab('stake')}
                                    class={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab() === 'stake' ? 'bg-amber-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'
                                        }`}
                                >
                                    <Lock class="w-4 h-4 inline mr-2" />
                                    {t('staking.stake')}
                                </button>
                                <button
                                    onClick={() => setActiveTab('unstake')}
                                    class={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab() === 'unstake' ? 'bg-amber-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'
                                        }`}
                                >
                                    <Unlock class="w-4 h-4 inline mr-2" />
                                    {t('staking.unstake')}
                                </button>
                                <Show when={parseFloat(userInfo().pendingUnstake) > 0 && userInfo().unlockTime <= Date.now()}>
                                    <button
                                        onClick={() => setActiveTab('withdraw')}
                                        class={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab() === 'withdraw' ? 'bg-green-500 text-black shadow-lg' : 'text-gray-500 hover:text-white'
                                            }`}
                                    >
                                        <Gift class="w-4 h-4 inline mr-2" />
                                        {t('staking.withdraw')}
                                    </button>
                                </Show>
                            </div>

                            <Show when={activeTab() === 'stake'}>
                                <div class="space-y-6">
                                    <div>
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                            {t('staking.stakeAmount')}
                                        </label>
                                        <div class="relative">
                                            <input
                                                type="number"
                                                value={stakeAmount()}
                                                onInput={(e) => setStakeAmount(e.currentTarget.value)}
                                                placeholder={`Min: ${minStake()} VCN`}
                                                class="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-xl font-bold text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 box-border"
                                            />
                                            <button
                                                onClick={() => setStakeAmount(userInfo().vcnBalance)}
                                                class="absolute right-16 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-400 hover:text-amber-300 uppercase"
                                            >
                                                Max
                                            </button>
                                            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">VCN</span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleStake}
                                        disabled={isLoading() || !stakeAmount()}
                                        class="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Show when={isLoading()} fallback={<>
                                            <Lock class="w-4 h-4" />
                                            {t('staking.stakeVcn')}
                                        </>}>
                                            <div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            {txStatus() === 'approving' ? t('staking.approving') : t('staking.staking')}
                                        </Show>
                                    </button>
                                </div>
                            </Show>

                            <Show when={activeTab() === 'unstake'}>
                                <div class="space-y-6">
                                    <div>
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                            {t('staking.unstakeAmount')} (Max: {Number(userInfo().stakedAmount).toLocaleString()} VCN)
                                        </label>
                                        <div class="relative">
                                            <input
                                                type="number"
                                                value={unstakeAmount()}
                                                onInput={(e) => setUnstakeAmount(e.currentTarget.value)}
                                                placeholder={t('staking.enterAmount')}
                                                class="w-full bg-black/40 border border-white/10 rounded-xl px-5 py-4 text-xl font-bold text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                                            />
                                            <button
                                                onClick={() => setUnstakeAmount(userInfo().stakedAmount)}
                                                class="absolute right-16 top-1/2 -translate-y-1/2 text-[10px] font-black text-amber-400 hover:text-amber-300 uppercase"
                                            >
                                                Max
                                            </button>
                                            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 font-black text-sm">VCN</span>
                                        </div>
                                    </div>

                                    {/* Minimum stake warning */}
                                    <Show when={unstakeAmount() && parseFloat(unstakeAmount()) > 0 && parseFloat(unstakeAmount()) < parseFloat(userInfo().stakedAmount)}>
                                        {(() => {
                                            const remaining = parseFloat(userInfo().stakedAmount) - parseFloat(unstakeAmount());
                                            const minStakeNum = parseFloat(minStake().replace(/,/g, ''));
                                            const isInvalid = remaining > 0 && remaining < minStakeNum;
                                            return (
                                                <Show when={isInvalid}>
                                                    <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                                        <div class="flex items-center gap-2 text-red-400 text-xs font-bold">
                                                            <AlertTriangle class="w-4 h-4" />
                                                            {t('staking.belowMinimumStake')}
                                                        </div>
                                                        <p class="text-[11px] text-gray-400 mt-2">
                                                            Remaining stake ({remaining.toLocaleString()} VCN) would be below minimum ({minStake()} VCN).
                                                            Use "Max" to unstake all, or keep at least {minStake()} VCN staked.
                                                        </p>
                                                    </div>
                                                </Show>
                                            );
                                        })()}
                                    </Show>

                                    <div class="p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                        <div class="flex items-center gap-2 text-blue-400 text-xs font-bold">
                                            <Timer class="w-4 h-4" />
                                            {cooldownDays()}{t('staking.cooldownPeriod')}
                                        </div>
                                        <p class="text-[11px] text-gray-400 mt-2">
                                            {t('staking.cooldownDesc')} {cooldownDays()} {t('staking.cooldownDescDays')}
                                        </p>
                                    </div>

                                    <button
                                        onClick={handleUnstake}
                                        disabled={isLoading() || !unstakeAmount() || parseFloat(unstakeAmount()) > parseFloat(userInfo().stakedAmount) || (() => {
                                            const remaining = parseFloat(userInfo().stakedAmount) - parseFloat(unstakeAmount() || '0');
                                            const minStakeNum = parseFloat(minStake().replace(/,/g, ''));
                                            return remaining > 0 && remaining < minStakeNum;
                                        })()}
                                        class="w-full py-4 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <Show when={isLoading()} fallback={<>
                                            <Unlock class="w-4 h-4" />
                                            {t('staking.requestUnstake')}
                                        </>}>
                                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('staking.processingTx')}
                                        </Show>
                                    </button>
                                </div>
                            </Show>

                            <Show when={activeTab() === 'withdraw'}>
                                <div class="space-y-6">
                                    <div class="p-6 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                                        <Gift class="w-12 h-12 text-green-400 mx-auto mb-4" />
                                        <div class="text-2xl font-black text-white mb-2">{Number(userInfo().pendingUnstake).toLocaleString()} VCN</div>
                                        <p class="text-sm text-green-400 font-bold">{t('staking.readyToWithdraw')}</p>
                                    </div>

                                    <button
                                        onClick={handleWithdraw}
                                        disabled={isLoading()}
                                        class="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-black text-sm uppercase tracking-widest rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Show when={isLoading()} fallback={<>
                                            <Gift class="w-4 h-4" />
                                            {t('staking.withdrawVcn')}
                                        </>}>
                                            <div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            {t('staking.withdrawing')}
                                        </Show>
                                    </button>
                                </div>
                            </Show>

                            {/* Transaction Status */}
                            <Show when={txStatus() !== 'idle'}>
                                <div class={`mt-6 p-4 rounded-xl flex items-center gap-3 ${txStatus() === 'pending' || txStatus() === 'approving' ? 'bg-amber-500/10 border border-amber-500/20' :
                                    txStatus() === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                                        'bg-red-500/10 border border-red-500/20'
                                    }`}>
                                    <Show when={txStatus() === 'pending' || txStatus() === 'approving'}>
                                        <div class="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                                        <span class="text-amber-400 text-xs font-bold">
                                            {txStatus() === 'approving' ? t('staking.approvingVcn') : t('staking.txPending')}
                                        </span>
                                    </Show>
                                    <Show when={txStatus() === 'success'}>
                                        <CheckCircle2 class="w-5 h-5 text-green-400" />
                                        <div class="flex-1">
                                            <span class="text-green-400 text-xs font-bold block">{t('staking.txSuccess')}</span>
                                            <Show when={txHash()}>
                                                <a href={`https://sepolia.etherscan.io/tx/${txHash()}`} target="_blank" class="text-[10px] text-gray-500 hover:text-green-400 flex items-center gap-1">
                                                    {t('bridge.viewOnExplorer')} <ExternalLink class="w-3 h-3" />
                                                </a>
                                            </Show>
                                        </div>
                                    </Show>
                                    <Show when={txStatus() === 'error'}>
                                        <XCircle class="w-5 h-5 text-red-400" />
                                        <span class="text-red-400 text-xs font-bold">{errorMsg() || t('staking.txFailed')}</span>
                                    </Show>
                                </div>
                            </Show>
                        </div>

                        {/* Validators List */}
                        <div class="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
                            <div class="p-6 border-b border-white/5">
                                <h3 class="text-lg font-black text-white flex items-center gap-2">
                                    <Users class="w-5 h-5 text-amber-400" />
                                    {t('staking.activeValidatorsTitle')} ({activeValidatorCount()})
                                </h3>
                            </div>
                            <div class="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                                <Show when={validators().length > 0} fallback={
                                    <div class="p-8 text-center">
                                        <Shield class="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                        <p class="text-gray-500 text-sm">{t('staking.noValidators')}</p>
                                        <p class="text-gray-600 text-xs mt-2">{t('staking.beFirstToStake')}</p>
                                    </div>
                                }>
                                    <For each={validators()}>
                                        {(validator) => (
                                            <div class="p-5 hover:bg-white/[0.02] transition-colors">
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-4">
                                                        <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${validator.isActive ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'
                                                            }`}>
                                                            <Shield class="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <div class="text-sm font-bold text-white font-mono">{validator.address}</div>
                                                            <span class={`text-[10px] font-black uppercase tracking-widest ${validator.isActive ? 'text-green-400' : 'text-amber-400'
                                                                }`}>
                                                                {validator.isActive ? t('staking.activeStatus') : t('staking.unstakingStatus')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div class="text-right">
                                                        <div class="text-sm font-black text-white">{validator.stakedAmount}</div>
                                                        <div class="text-[10px] text-amber-400 font-bold">{t('staking.vcnStaked')}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </Show>
                            </div>
                        </div>
                    </div>
                }>
                    {/* No Wallet - Show Loading */}
                    <div class="max-w-md mx-auto">
                        <div class="bg-white/[0.02] border border-white/5 rounded-3xl p-8 text-center">
                            <Wallet class="w-16 h-16 text-gray-600 mx-auto mb-6" />
                            <h3 class="text-xl font-black text-white mb-2">{t('staking.loadingWallet')}</h3>
                            <p class="text-gray-500 text-sm">
                                {t('staking.connectingWallet')}
                            </p>
                            <Show when={errorMsg()}>
                                <p class="text-red-400 text-xs mt-4">{errorMsg()}</p>
                            </Show>
                        </div>
                    </div>
                </Show>

                {/* Security Notice */}
                <div class="p-6 bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
                    <div class="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Shield class="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h4 class="text-sm font-black text-white mb-1">{t('staking.optimisticFinalitySecurity')}</h4>
                        <p class="text-xs text-gray-400 leading-relaxed">
                            {t('staking.securityDesc')} {slashPercent()}% {t('staking.securityDescEnd')}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
