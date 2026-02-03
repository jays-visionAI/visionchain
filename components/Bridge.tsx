import { Component, createSignal, createEffect, For, Show, onMount, onCleanup } from 'solid-js';
import {
    ArrowRightLeft,
    ArrowDown,
    Zap,
    ShieldCheck,
    Clock,
    ExternalLink,
    History,
    CheckCircle2,
    AlertCircle,
    Wallet,
    RefreshCw,
    Loader2
} from 'lucide-solid';
import { ethers } from 'ethers';
import { WalletViewHeader } from './wallet/WalletViewHeader';
import { getFirebaseDb } from '../services/firebaseService';
import { collection, query, where, orderBy, onSnapshot, limit, doc, setDoc } from 'firebase/firestore';
import { createNotification } from '../services/notificationService';

// Extend Window interface for ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

// Contract Addresses - IntentCommitment for Paymaster approach
const VISION_INTENT_COMMITMENT = '0x47c05BCCA7d57c87083EB4e586007530eE4539e9';
const VCN_TOKEN_ADDRESS = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

// Chain IDs
const VISION_CHAIN_ID = 1337;
const SEPOLIA_CHAIN_ID = 11155111;

// Paymaster API URL
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'visionchain-d19ed';
const PAYMASTER_API = `https://us-central1-${firebaseProjectId}.cloudfunctions.net`;

const INTENT_ABI = [
    "function getNextNonce(address user) view returns (uint256)"
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)'
];

interface Transaction {
    id: string;
    from: string;
    to: string;
    amount: string;
    asset: string;
    status: 'Pending' | 'Processing' | 'Success';
    time: string;
    hash: string;
}

// Bridge transaction from Firebase
interface BridgeTransaction {
    id: string;
    user: string;
    srcChainId: number;
    dstChainId: number;
    amount: string;
    recipient: string;
    intentHash?: string;
    txHash: string;
    status: 'COMMITTED' | 'PROCESSING' | 'COMPLETED' | 'FINALIZED' | 'FAILED';
    createdAt: any;
    completedAt?: any;
}

interface NetworkConfig {
    name: string;
    chainId: number;
}

const NETWORKS: NetworkConfig[] = [
    { name: 'Ethereum Sepolia', chainId: 11155111 },
    { name: 'Vision Testnet', chainId: 20261337 }
];

// Vision Chain RPC endpoint
const VISION_RPC_URL = 'https://www.visionchain.co/rpc';

// Props interface
interface BridgeProps {
    walletAddress?: () => string;
    privateKey?: () => string;
    userEmail?: () => string;
}

const Bridge: Component<BridgeProps> = (props) => {
    // Connection state - derived from prop
    const isConnected = () => !!(props.walletAddress?.() || '');
    const walletAddress = () => props.walletAddress?.() || '';

    // Bridge state
    const [fromNetwork, setFromNetwork] = createSignal(NETWORKS[0]);
    const [toNetwork, setToNetwork] = createSignal(NETWORKS[1]);
    const [amount, setAmount] = createSignal('');
    const [selectedAsset, setSelectedAsset] = createSignal('VCN');
    const [balance, setBalance] = createSignal('0');
    const [isBridging, setIsBridging] = createSignal(false);
    const [isApproving, setIsApproving] = createSignal(false);
    const [step, setStep] = createSignal(1); // 1: Input, 2: Processing, 3: Success

    // Transaction state
    const [txHash, setTxHash] = createSignal('');
    const [errorMsg, setErrorMsg] = createSignal('');
    const [transactions, setTransactions] = createSignal<Transaction[]>([]);

    // Firebase bridge tracking state
    const [bridgeHistory, setBridgeHistory] = createSignal<BridgeTransaction[]>([]);
    const [isLoadingBridgeHistory, setIsLoadingBridgeHistory] = createSignal(true);
    let unsubscribeBridgeHistory: (() => void) | null = null;

    // Get chain name from chainId
    const getChainName = (chainId: number): string => {
        if (chainId === 11155111) return 'Ethereum Sepolia';
        if (chainId === 1337 || chainId === 20261337) return 'Vision Chain';
        return `Chain ${chainId}`;
    };

    // Get time ago string
    const getTimeAgo = (timestamp: any): string => {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    // Get estimated completion time
    const getEstimatedCompletion = (createdAt: any, status: string): string => {
        if (status === 'COMPLETED' || status === 'FINALIZED') return 'Completed';
        if (status === 'FAILED') return 'Failed';
        if (!createdAt) return '~15-30 min';

        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        const elapsed = (Date.now() - date.getTime()) / 60000; // minutes
        const remaining = Math.max(0, 30 - elapsed);

        if (remaining <= 0) return 'Completing soon...';
        return `~${Math.ceil(remaining)} min remaining`;
    };

    // Subscribe to Firebase bridge transactions
    const subscribeToBridgeHistory = () => {
        const addr = walletAddress();
        if (!addr) {
            setBridgeHistory([]);
            setIsLoadingBridgeHistory(false);
            return;
        }

        try {
            const db = getFirebaseDb();
            const bridgeRef = collection(db, 'bridgeTransactions');
            const q = query(
                bridgeRef,
                where('user', '==', addr.toLowerCase()),
                orderBy('createdAt', 'desc'),
                limit(10)
            );

            unsubscribeBridgeHistory = onSnapshot(q, (snapshot) => {
                const bridges: BridgeTransaction[] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as BridgeTransaction));
                setBridgeHistory(bridges);
                setIsLoadingBridgeHistory(false);
            }, (error) => {
                console.error('[Bridge] Firebase subscription error:', error);
                setBridgeHistory([]);
                setIsLoadingBridgeHistory(false);
            });
        } catch (err) {
            console.error('[Bridge] Failed to subscribe to bridge history:', err);
            setIsLoadingBridgeHistory(false);
        }
    };

    // Load balance from Vision Chain directly (Cloud Wallet)
    const loadBalance = async () => {
        const addr = walletAddress();
        if (!addr) return;

        try {
            const provider = new ethers.JsonRpcProvider(VISION_RPC_URL);
            const vcn = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
            const bal = await vcn.balanceOf(addr);
            setBalance(ethers.formatEther(bal));
        } catch (err) {
            console.error('Failed to load balance:', err);
            setBalance('0');
        }
    };

    // Switch networks (swap from/to)
    const handleSwitch = () => {
        const temp = fromNetwork();
        setFromNetwork(toNetwork());
        setToNetwork(temp);
        loadBalance();
    };

    // Handle bridge transfer using EIP-712 + Paymaster (same as Chat)
    const handleBridge = async () => {
        const amountVal = amount();
        if (!amountVal || parseFloat(amountVal) <= 0) {
            setErrorMsg('Please enter a valid amount');
            return;
        }

        if (parseFloat(amountVal) > parseFloat(balance())) {
            setErrorMsg('Insufficient balance');
            return;
        }

        const privateKey = props.privateKey?.();
        if (!privateKey) {
            setErrorMsg('Wallet not unlocked. Please enter your spending password.');
            return;
        }

        const userEmail = props.userEmail?.();

        try {
            setIsBridging(true);
            setIsApproving(true);
            setErrorMsg('');
            setStep(2);

            // Create provider and signer
            const provider = new ethers.JsonRpcProvider(VISION_RPC_URL);
            const signer = new ethers.Wallet(privateKey, provider);
            const userAddr = walletAddress();

            // Get destination chain ID
            const dstChainId = toNetwork().chainId;

            // Get next nonce from IntentCommitment contract
            const intentContract = new ethers.Contract(VISION_INTENT_COMMITMENT, INTENT_ABI, provider);
            const nonce = await intentContract.getNextNonce(userAddr);
            const amountWei = ethers.parseEther(amountVal);
            const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour validity

            // Build intent struct
            const intent = {
                user: userAddr,
                srcChainId: BigInt(VISION_CHAIN_ID),
                dstChainId: BigInt(dstChainId),
                token: ethers.ZeroAddress, // Native VCN
                amount: amountWei,
                recipient: userAddr,
                nonce: nonce,
                expiry: BigInt(expiry)
            };

            // EIP-712 Domain for Bridge Intent
            const domain = {
                name: 'VisionBridge',
                version: '1',
                chainId: VISION_CHAIN_ID,
                verifyingContract: VISION_INTENT_COMMITMENT
            };

            // EIP-712 Types
            const types = {
                BridgeIntent: [
                    { name: 'user', type: 'address' },
                    { name: 'srcChainId', type: 'uint256' },
                    { name: 'dstChainId', type: 'uint256' },
                    { name: 'token', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'recipient', type: 'address' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'expiry', type: 'uint256' }
                ]
            };

            setIsApproving(false);
            console.log('[Bridge] Signing intent with EIP-712...');

            // Sign with EIP-712
            const intentSignature = await signer.signTypedData(domain, types, intent);

            // Submit to Paymaster API
            console.log('[Bridge] Submitting to Paymaster API...');
            const response = await fetch(`${PAYMASTER_API}/bridgeWithPaymaster`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user: userAddr,
                    srcChainId: VISION_CHAIN_ID,
                    dstChainId: dstChainId,
                    token: ethers.ZeroAddress,
                    amount: amountWei.toString(),
                    recipient: userAddr,
                    nonce: nonce.toString(),
                    expiry: expiry,
                    intentSignature: intentSignature
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`Paymaster Failed: ${error.error || response.statusText}`);
            }

            const result = await response.json();
            console.log(`[Bridge] Tx submitted via Paymaster: ${result.txHash}`);
            setTxHash(result.txHash);

            // Create notification (bridge_started)
            const chainDisplay = toNetwork().name;
            if (userEmail) {
                try {
                    await createNotification(userEmail, {
                        type: 'bridge_started' as any,
                        title: 'Bridge Request Started',
                        content: `${amountVal} VCN → ${chainDisplay} bridge started. Expected arrival in 10-30 minutes.`,
                        data: {
                            amount: amountVal,
                            destinationChain: chainDisplay,
                            txHash: result.txHash,
                            status: 'pending'
                        }
                    });
                    console.log('[Bridge] Notification created');
                } catch (notiErr) {
                    console.warn('[Bridge] Notification failed:', notiErr);
                }
            }

            // Save to Firebase for History
            try {
                const db = getFirebaseDb();
                const txRef = doc(db, 'transactions', result.txHash);
                await setDoc(txRef, {
                    hash: result.txHash,
                    from_addr: userAddr.toLowerCase(),
                    to_addr: 'bridge:sepolia',
                    value: amountVal,
                    timestamp: Date.now(),
                    type: 'Bridge',
                    bridgeStatus: 'PENDING',
                    challengeEndTime: Date.now() + (10 * 60 * 1000),
                    metadata: {
                        destinationChain: chainDisplay,
                        srcChainId: VISION_CHAIN_ID,
                        dstChainId: dstChainId
                    }
                });
                console.log('[Bridge] Saved to Firestore for History');
            } catch (historyErr) {
                console.warn('[Bridge] Failed to save history:', historyErr);
            }

            // Add to local transaction list
            const newTx: Transaction = {
                id: Date.now().toString(),
                from: fromNetwork().name,
                to: toNetwork().name,
                amount: amountVal,
                asset: selectedAsset(),
                status: 'Processing',
                time: 'Just now',
                hash: result.txHash.slice(0, 6) + '...' + result.txHash.slice(-4)
            };
            setTransactions(prev => [newTx, ...prev]);

            setStep(3);
            setAmount('');
            await loadBalance();

        } catch (err: any) {
            console.error('[Bridge] Transfer failed:', err);
            setErrorMsg(err.reason || err.message || 'Bridge transfer failed');
            setStep(1);
        } finally {
            setIsBridging(false);
            setIsApproving(false);
        }
    };

    // Set percentage amount
    const setPercentage = (percent: number) => {
        const val = (parseFloat(balance()) * percent / 100).toFixed(4);
        setAmount(val);
    };

    // Load data on mount and when wallet changes
    onMount(async () => {
        if (walletAddress()) {
            await loadBalance();
            subscribeToBridgeHistory();
        }
    });

    // Cleanup Firebase subscription on unmount
    onCleanup(() => {
        if (unsubscribeBridgeHistory) {
            unsubscribeBridgeHistory();
        }
    });

    createEffect(() => {
        const addr = walletAddress();
        if (addr) {
            loadBalance();
            // Re-subscribe when wallet address changes
            if (unsubscribeBridgeHistory) {
                unsubscribeBridgeHistory();
            }
            subscribeToBridgeHistory();
        }
    });

    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Header */}
                <WalletViewHeader
                    tag="Cross-Chain Transfer"
                    title="VISION"
                    titleAccent="BRIDGE"
                    description="Transfer assets between Ethereum and Vision Chain with optimistic finality security."
                    icon={ArrowRightLeft}
                    hideDescriptionOnMobile={true}
                />

                <Show when={isConnected()} fallback={
                    <div class="max-w-md mx-auto">
                        <div class="bg-white/[0.02] border border-white/5 rounded-3xl p-8 text-center">
                            <Wallet class="w-16 h-16 text-gray-600 mx-auto mb-6" />
                            <h3 class="text-xl font-black text-white mb-2">Loading Wallet...</h3>
                            <p class="text-gray-500 text-sm">
                                Please wait while we connect to your wallet.
                            </p>
                        </div>
                    </div>
                }>
                    <div class="grid grid-cols-1 lg:grid-cols-5 gap-8">

                        {/* Main Bridge UI */}
                        <div class="lg:col-span-3 space-y-6">
                            <div class="bg-[#111113]/40 border border-white/[0.06] rounded-[32px] p-8 shadow-2xl relative overflow-hidden group">
                                <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                <Show when={step() === 1}>
                                    {/* Input Interface */}
                                    <div class="relative z-10 space-y-4">

                                        {/* From Network */}
                                        <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all focus-within:border-blue-500/50">
                                            <div class="flex justify-between items-center mb-3">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">From Network</span>
                                                <span class="text-[10px] font-bold text-blue-400">Balance: {Number(balance()).toLocaleString()} {selectedAsset()}</span>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <div class="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center border border-blue-500/20">
                                                    <Zap class="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div class="flex-1">
                                                    <div class="text-lg font-black italic uppercase tracking-tight">{fromNetwork().name}</div>
                                                    <Show when={currentChainId() !== fromNetwork().chainId}>
                                                        <button
                                                            onClick={() => switchNetwork(fromNetwork().chainId)}
                                                            class="text-[10px] text-amber-400 hover:text-amber-300 font-bold"
                                                        >
                                                            Switch Network
                                                        </button>
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Switch Button */}
                                        <div class="flex justify-center -my-6 relative z-20">
                                            <button
                                                onClick={handleSwitch}
                                                class="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20 hover:scale-110 active:scale-95 transition-all border-4 border-[#111113]"
                                            >
                                                <ArrowDown class="w-5 h-5 text-white" />
                                            </button>
                                        </div>

                                        {/* To Network */}
                                        <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all">
                                            <div class="flex justify-between items-center mb-3">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">To Network</span>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <div class="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center border border-purple-500/20">
                                                    <Zap class="w-5 h-5 text-purple-400" />
                                                </div>
                                                <div class="flex-1">
                                                    <div class="text-lg font-black italic uppercase tracking-tight">{toNetwork().name}</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Asset & Amount */}
                                        <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 mt-4">
                                            <div class="flex justify-between items-center mb-4">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Amount to Bridge</span>
                                                <div class="flex gap-2">
                                                    <button onClick={() => setPercentage(25)} class="px-2 py-1 bg-white/5 rounded text-[8px] font-bold hover:bg-white/10">25%</button>
                                                    <button onClick={() => setPercentage(50)} class="px-2 py-1 bg-white/5 rounded text-[8px] font-bold hover:bg-white/10">50%</button>
                                                    <button onClick={() => setPercentage(100)} class="px-2 py-1 bg-white/5 rounded text-[8px] font-bold hover:bg-white/10">MAX</button>
                                                </div>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <input
                                                    type="number"
                                                    placeholder="0.00"
                                                    value={amount()}
                                                    onInput={(e) => setAmount(e.currentTarget.value)}
                                                    class="bg-transparent border-none text-3xl font-black focus:outline-none w-full placeholder-gray-700"
                                                />
                                                <div class="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                                                    <div class="w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500" />
                                                    <span class="font-bold text-sm tracking-tight">{selectedAsset()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Error Message */}
                                        <Show when={errorMsg()}>
                                            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                                                <AlertCircle class="w-5 h-5 text-red-400" />
                                                <span class="text-red-400 text-xs font-bold">{errorMsg()}</span>
                                            </div>
                                        </Show>

                                        {/* Summary & Action */}
                                        <div class="pt-4 space-y-4">
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>Bridge Fee (Est.)</span>
                                                <span class="text-gray-300">0.1% + Gas</span>
                                            </div>
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>Estimated Arrival</span>
                                                <span class="text-gray-300">~15 Minutes (Challenge Period)</span>
                                            </div>

                                            <button
                                                onClick={handleBridge}
                                                disabled={!amount() || isBridging() || parseFloat(amount()) > parseFloat(balance())}
                                                class="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:cursor-not-allowed"
                                            >
                                                <ArrowRightLeft class="w-4 h-4" />
                                                {parseFloat(amount() || '0') > parseFloat(balance()) ? 'INSUFFICIENT BALANCE' : 'START BRIDGE TRANSFER'}
                                            </button>
                                        </div>
                                    </div>
                                </Show>

                                <Show when={step() === 2}>
                                    {/* Processing Interface */}
                                    <div class="relative z-10 py-12 text-center space-y-6">
                                        <div class="w-20 h-20 bg-blue-500/20 border border-blue-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <div class="w-10 h-10 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                                        </div>
                                        <h2 class="text-2xl font-black italic tracking-tight">
                                            {isApproving() ? 'APPROVING TOKEN...' : 'INITIATING BRIDGE...'}
                                        </h2>
                                        <p class="text-gray-400 text-sm max-w-sm mx-auto">
                                            {isApproving()
                                                ? 'Please confirm the approval transaction in your wallet.'
                                                : 'Please confirm the bridge transaction in your wallet.'}
                                        </p>
                                    </div>
                                </Show>

                                <Show when={step() === 3}>
                                    {/* Success Interface */}
                                    <div class="relative z-10 py-12 text-center space-y-6">
                                        <div class="w-20 h-20 bg-green-500/20 border border-green-500/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle2 class="w-10 h-10 text-green-500" />
                                        </div>
                                        <h2 class="text-3xl font-black italic tracking-tight">TRANSFER INITIATED!</h2>
                                        <p class="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
                                            Your {amount()} {selectedAsset()} is being bridged to {toNetwork().name}.
                                            It will be available after the 15-minute challenge period.
                                        </p>
                                        <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 max-w-xs mx-auto">
                                            <div class="text-xs font-mono text-blue-400 break-all mb-2">
                                                Tx: {txHash().slice(0, 10)}...{txHash().slice(-8)}
                                            </div>
                                            <a
                                                href={`https://sepolia.etherscan.io/tx/${txHash()}`}
                                                target="_blank"
                                                class="text-[10px] text-gray-500 hover:text-blue-400 flex items-center justify-center gap-1"
                                            >
                                                View on Explorer <ExternalLink class="w-3 h-3" />
                                            </a>
                                        </div>
                                        <button
                                            onClick={() => { setStep(1); setAmount(''); setTxHash(''); }}
                                            class="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-300 transition-all"
                                        >
                                            New Transfer
                                        </button>
                                    </div>
                                </Show>
                            </div>

                            {/* Info Section */}
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="bg-white/[0.03] border border-white/[0.06] p-6 rounded-2xl space-y-3">
                                    <div class="flex items-center gap-3 text-cyan-400">
                                        <ShieldCheck class="w-5 h-5" />
                                        <span class="text-[11px] font-black uppercase tracking-widest">Optimistic Security</span>
                                    </div>
                                    <p class="text-[11px] text-gray-500 leading-relaxed font-medium">
                                        Transfers are secured by a 15-minute challenge period. Validators stake VCN to attest to transfers.
                                    </p>
                                </div>
                                <div class="bg-white/[0.03] border border-white/[0.06] p-6 rounded-2xl space-y-3">
                                    <div class="flex items-center gap-3 text-purple-400">
                                        <Clock class="w-5 h-5" />
                                        <span class="text-[11px] font-black uppercase tracking-widest">Challenge Period</span>
                                    </div>
                                    <p class="text-[11px] text-gray-500 leading-relaxed font-medium">
                                        Funds are released after 15 minutes if no valid challenge is submitted.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar: History & Activity */}
                        <div class="lg:col-span-2 space-y-6">

                            {/* Status Card */}
                            <div class="bg-blue-600/10 border border-blue-500/20 rounded-[24px] p-6">
                                <div class="flex items-center gap-3 mb-4">
                                    <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span class="text-[10px] font-black text-green-400 uppercase tracking-widest">Bridge Operational</span>
                                </div>
                                <div class="text-lg font-black italic mb-2 tracking-tight">Connected: {walletAddress().slice(0, 6)}...{walletAddress().slice(-4)}</div>
                                <p class="text-xs text-blue-400/60 font-medium">Chain ID: {currentChainId()}</p>
                            </div>

                            {/* Recent Bridge History - Real-time from Firebase */}
                            <div class="bg-[#111113]/40 border border-white/[0.06] rounded-[24px] p-6">
                                <div class="flex items-center justify-between mb-6">
                                    <div class="flex items-center gap-3">
                                        <History class="w-5 h-5 text-gray-400" />
                                        <h3 class="text-sm font-black italic tracking-widest uppercase">Bridge Status</h3>
                                    </div>
                                    <button
                                        onClick={() => subscribeToBridgeHistory()}
                                        class="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                    >
                                        <RefreshCw class="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>

                                <Show when={!isLoadingBridgeHistory()} fallback={
                                    <div class="py-8 flex items-center justify-center gap-2 text-gray-500">
                                        <Loader2 class="w-4 h-4 animate-spin" />
                                        <span class="text-xs">Loading...</span>
                                    </div>
                                }>
                                    <Show when={bridgeHistory().length > 0} fallback={
                                        <div class="py-8 text-center">
                                            <History class="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                            <p class="text-gray-600 text-xs">No bridge requests yet</p>
                                        </div>
                                    }>
                                        <div class="space-y-4">
                                            <For each={bridgeHistory()}>
                                                {(bridge) => (
                                                    <div class="bg-white/[0.02] border border-white/5 rounded-xl p-4 space-y-3">
                                                        {/* Header */}
                                                        <div class="flex justify-between items-start">
                                                            <div>
                                                                <span class="text-sm font-black text-white">
                                                                    {parseFloat(bridge.amount).toLocaleString()} VCN
                                                                </span>
                                                                <div class="text-[10px] text-gray-500 mt-0.5">
                                                                    {getChainName(bridge.srcChainId)} → {getChainName(bridge.dstChainId)}
                                                                </div>
                                                            </div>
                                                            <span class={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${bridge.status === 'COMMITTED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                                                bridge.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                                    bridge.status === 'COMPLETED' || bridge.status === 'FINALIZED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                                                        'bg-red-500/10 text-red-400 border border-red-500/20'
                                                                }`}>
                                                                {bridge.status === 'COMMITTED' ? 'Processing' :
                                                                    bridge.status === 'PROCESSING' ? 'Confirming' :
                                                                        bridge.status === 'COMPLETED' || bridge.status === 'FINALIZED' ? 'Complete' : 'Failed'}
                                                            </span>
                                                        </div>

                                                        {/* Progress Bar */}
                                                        <Show when={bridge.status !== 'FAILED'}>
                                                            <div class="space-y-1.5">
                                                                <div class="flex gap-1">
                                                                    <div class={`h-1 flex-1 rounded-full transition-all duration-500 ${['COMMITTED', 'PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge.status)
                                                                        ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                                                                        : 'bg-gray-800'
                                                                        }`} />
                                                                    <div class={`h-1 flex-1 rounded-full transition-all duration-500 ${['PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge.status)
                                                                        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                                                        : 'bg-gray-800'
                                                                        }`} />
                                                                    <div class={`h-1 flex-1 rounded-full transition-all duration-500 ${['COMPLETED', 'FINALIZED'].includes(bridge.status)
                                                                        ? 'bg-green-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                                                        : 'bg-gray-800'
                                                                        }`} />
                                                                </div>
                                                                <div class="flex justify-between text-[8px] text-gray-600 font-bold uppercase tracking-widest">
                                                                    <span class={['COMMITTED', 'PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge.status) ? 'text-blue-400' : ''}>
                                                                        Submitted
                                                                    </span>
                                                                    <span class={['PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge.status) ? 'text-amber-400' : ''}>
                                                                        Verifying
                                                                    </span>
                                                                    <span class={['COMPLETED', 'FINALIZED'].includes(bridge.status) ? 'text-green-400' : ''}>
                                                                        Complete
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </Show>

                                                        {/* Time Info */}
                                                        <div class="flex justify-between items-center text-[10px]">
                                                            <span class="text-gray-500">{getTimeAgo(bridge.createdAt)}</span>
                                                            <Show when={bridge.status === 'COMMITTED' || bridge.status === 'PROCESSING'}>
                                                                <span class="text-blue-400 font-bold flex items-center gap-1">
                                                                    <Clock class="w-3 h-3" />
                                                                    {getEstimatedCompletion(bridge.createdAt, bridge.status)}
                                                                </span>
                                                            </Show>
                                                        </div>

                                                        {/* TX Link */}
                                                        <Show when={bridge.txHash}>
                                                            <a
                                                                href={`https://www.visionchain.co/visionscan/tx/${bridge.txHash}`}
                                                                target="_blank"
                                                                class="flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-gray-400 hover:text-white transition-colors"
                                                            >
                                                                <ExternalLink class="w-3 h-3" />
                                                                View on VisionScan
                                                            </a>
                                                        </Show>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </Show>
                            </div>
                        </div>
                    </div>
                </Show>

            </div>
        </div>
    );
};

export default Bridge;
