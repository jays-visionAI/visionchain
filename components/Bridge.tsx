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
    Loader2,
    ChevronRight
} from 'lucide-solid';
import { ethers } from 'ethers';
import { WalletViewHeader } from './wallet/WalletViewHeader';
import { getFirebaseDb } from '../services/firebaseService';
import { collection, query, where, orderBy, onSnapshot, limit, doc, setDoc } from 'firebase/firestore';
import { createNotification } from '../services/notificationService';
import { getVcnPrice, initPriceService } from '../services/vcnPriceService';

// Extend Window interface for ethereum
declare global {
    interface Window {
        ethereum?: any;
    }
}

// Contract Addresses - Secure Bridge (Phase 1) - Deployed by user's MetaMask wallet
const INTENT_COMMITMENT_ADDRESS = '0x7F5883b2F48D87b3C15cACb8764A00291A58ce78';
const MESSAGE_INBOX_ADDRESS = '0x785bcD75294b45D855883B75CdDE3e3bA237EF40';
const VISION_BRIDGE_SECURE_ADDRESS = '0xFDA890183E1e18eE7b02A94d9DF195515D914655';

// Chain IDs
const VISION_CHAIN_ID = 1337;
const SEPOLIA_CHAIN_ID = 11155111;
const POLYGON_AMOY_CHAIN_ID = 80002;
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Paymaster API URL
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'visionchain-d19ed';
const PAYMASTER_API = `https://us-central1-${firebaseProjectId}.cloudfunctions.net`;

// VCN Token Addresses per Chain (for bridging destinations)
const VCN_TOKEN_ADDRESSES: Record<number, string> = {
    [SEPOLIA_CHAIN_ID]: '0xC068eD2b45DbD3894A72F0e4985DF8ba1299AB0f',      // Ethereum Sepolia
    [POLYGON_AMOY_CHAIN_ID]: '',   // TODO: Deploy VCN Token to Polygon Amoy
    [BASE_SEPOLIA_CHAIN_ID]: '',   // TODO: Deploy VCN Token to Base Sepolia
};

// IntentCommitment ABI
const INTENT_COMMITMENT_ABI = [
    "function commitIntent(address recipient, uint256 amount, uint256 destChainId) external returns (bytes32)",
    "function computeIntentHash(address sender, address recipient, uint256 amount, uint256 nonce, uint256 expiry, uint256 destChainId) view returns (bytes32)",
    "function userNonces(address) view returns (uint256)",
    "function isIntentValid(bytes32 intentHash) view returns (bool)"
];

// VisionBridgeSecure ABI  
const BRIDGE_SECURE_ABI = [
    "function lockVCN(bytes32 intentHash, address recipient, uint256 destChainId) payable",
    "function getRemainingDailyLimit(address user) view returns (uint256 userRemaining, uint256 globalRemaining)"
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
    rpcUrl?: string;
    explorerUrl?: string;
    vcnTokenAddress?: string;
    enabled: boolean;
}

const NETWORKS: NetworkConfig[] = [
    {
        name: 'Vision Testnet',
        chainId: 20261337,
        rpcUrl: 'https://www.visionchain.co/rpc',
        explorerUrl: 'https://www.visionchain.co/visionscan',
        enabled: true
    },
    {
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
        explorerUrl: 'https://sepolia.etherscan.io',
        vcnTokenAddress: '0xC068eD2b45DbD3894A72F0e4985DF8ba1299AB0f',
        enabled: true
    },
    {
        name: 'Polygon Amoy',
        chainId: 80002,
        rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
        explorerUrl: 'https://amoy.polygonscan.com',
        vcnTokenAddress: '', // TODO: Deploy
        enabled: false  // Enable after VCN token deployment
    },
    {
        name: 'Base Sepolia',
        chainId: 84532,
        rpcUrl: 'https://base-sepolia-rpc.publicnode.com',
        explorerUrl: 'https://sepolia.basescan.org',
        vcnTokenAddress: '', // TODO: Deploy
        enabled: false  // Enable after VCN token deployment
    }
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
    const [showNetworkDropdown, setShowNetworkDropdown] = createSignal(false);

    // Get available destination networks (excluding source)
    const getDestinationNetworks = () => NETWORKS.filter(n => n.chainId !== fromNetwork().chainId);

    // Transaction state
    const [txHash, setTxHash] = createSignal('');
    const [errorMsg, setErrorMsg] = createSignal('');
    const [transactions, setTransactions] = createSignal<Transaction[]>([]);

    // Firebase bridge tracking state
    const [bridgeHistory, setBridgeHistory] = createSignal<BridgeTransaction[]>([]);
    const [isLoadingBridgeHistory, setIsLoadingBridgeHistory] = createSignal(true);
    let unsubscribeBridgeHistory: (() => void) | null = null;

    // Current chain ID and network switching
    const [currentChainId, setCurrentChainId] = createSignal<number>(0);

    // Detect current chain from MetaMask or default to Vision Chain for Cloud Wallet
    const detectCurrentChain = async () => {
        if (window.ethereum) {
            try {
                const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
                setCurrentChainId(parseInt(chainIdHex, 16));
            } catch (e) {
                console.warn('[Bridge] Failed to detect chain:', e);
                setCurrentChainId(VISION_CHAIN_ID); // Default to Vision Chain
            }
        } else {
            // Cloud wallet - assume Vision Chain
            setCurrentChainId(VISION_CHAIN_ID);
        }
    };

    // Switch network (MetaMask only)
    const switchNetwork = async (targetChainId: number) => {
        if (!window.ethereum) {
            setErrorMsg('Network switching requires MetaMask');
            return;
        }

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
            });
            setCurrentChainId(targetChainId);
        } catch (switchError: any) {
            // Chain not added, try to add it
            if (switchError.code === 4902) {
                try {
                    if (targetChainId === VISION_CHAIN_ID) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: `0x${VISION_CHAIN_ID.toString(16)}`,
                                chainName: 'Vision Chain',
                                nativeCurrency: { name: 'VCN', symbol: 'VCN', decimals: 18 },
                                rpcUrls: [VISION_RPC_URL],
                                blockExplorerUrls: ['https://www.visionchain.co/visionscan'],
                            }],
                        });
                    } else if (targetChainId === SEPOLIA_CHAIN_ID) {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                                chainName: 'Ethereum Sepolia',
                                nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
                                rpcUrls: ['https://rpc.sepolia.org'],
                                blockExplorerUrls: ['https://sepolia.etherscan.io'],
                            }],
                        });
                    }
                    setCurrentChainId(targetChainId);
                } catch (addError) {
                    console.error('[Bridge] Failed to add network:', addError);
                    setErrorMsg('Failed to add network to wallet');
                }
            } else {
                console.error('[Bridge] Failed to switch network:', switchError);
                setErrorMsg('Failed to switch network');
            }
        }
    };

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
            // Native VCN - get native balance
            const provider = new ethers.JsonRpcProvider(VISION_RPC_URL);
            const bal = await provider.getBalance(addr);
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

    // Handle bridge transfer using Secure Bridge (Phase 1)
    // Step 1: Commit Intent on-chain
    // Step 2: Lock VCN with intentHash
    const handleBridge = async () => {
        const amountVal = amount();
        if (!amountVal || parseFloat(amountVal) <= 0) {
            setErrorMsg('Please enter a valid amount');
            return;
        }

        // Contract minimum is 0.1 VCN (VisionBridgeSecure.sol: minLockAmount after setLimits)
        if (parseFloat(amountVal) < 0.1) {
            setErrorMsg('Minimum bridge amount is 0.1 VCN');
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
            const amountWei = ethers.parseEther(amountVal);

            // === STEP 1: Commit Intent on-chain ===
            console.log('[Bridge] Step 1: Committing intent on-chain...');
            const intentContract = new ethers.Contract(
                INTENT_COMMITMENT_ADDRESS,
                INTENT_COMMITMENT_ABI,
                signer
            );

            // Commit intent (returns intentHash)
            const commitTx = await intentContract.commitIntent(userAddr, amountWei, dstChainId);
            console.log('[Bridge] Intent commit tx:', commitTx.hash);
            const commitReceipt = await commitTx.wait();

            // Extract intentHash from event logs
            const intentCommittedTopic = ethers.id("IntentCommitted(bytes32,address,address,uint256,uint256,uint256,uint256)");
            const intentLog = commitReceipt.logs.find((log: any) => log.topics[0] === intentCommittedTopic);

            let intentHash: string;
            if (intentLog) {
                intentHash = intentLog.topics[1];
            } else {
                // Fallback: compute hash manually
                const nonce = await intentContract.userNonces(userAddr);
                intentHash = ethers.keccak256(ethers.solidityPacked(
                    ['address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                    [userAddr, userAddr, amountWei, nonce - 1n, 0, dstChainId]
                ));
            }
            console.log('[Bridge] Intent hash:', intentHash);

            setIsApproving(false);

            // === STEP 2: Lock VCN with intentHash ===
            console.log('[Bridge] Step 2: Locking VCN...');
            const bridgeContract = new ethers.Contract(
                VISION_BRIDGE_SECURE_ADDRESS,
                BRIDGE_SECURE_ABI,
                signer
            );

            const lockTx = await bridgeContract.lockVCN(intentHash, userAddr, dstChainId, {
                value: amountWei // Send native VCN
            });
            console.log('[Bridge] Lock tx:', lockTx.hash);
            const lockReceipt = await lockTx.wait();
            console.log('[Bridge] Lock confirmed in block:', lockReceipt.blockNumber);

            setTxHash(lockTx.hash);

            // Create notification
            const chainDisplay = toNetwork().name;
            if (userEmail) {
                try {
                    await createNotification({
                        userEmail: userEmail,
                        type: 'transfer_received', // Using existing type for now
                        title: 'Bridge Request Started',
                        content: `${amountVal} VCN → ${chainDisplay} bridge started. Expected arrival in 10-30 minutes.`,
                        data: {
                            amount: amountVal,
                            destinationChain: chainDisplay,
                            txHash: lockTx.hash,
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
                const txRef = doc(db, 'transactions', lockTx.hash);
                await setDoc(txRef, {
                    hash: lockTx.hash,
                    from_addr: userAddr.toLowerCase(),
                    to_addr: 'bridge:sepolia',
                    value: amountVal,
                    timestamp: Date.now(),
                    type: 'Bridge',
                    bridgeStatus: 'PENDING',
                    challengeEndTime: Date.now() + (2 * 60 * 1000), // 2 min challenge period
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
                hash: lockTx.hash.slice(0, 6) + '...' + lockTx.hash.slice(-4)
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
        // Initialize VCN price service
        initPriceService();

        // Detect current chain
        await detectCurrentChain();

        // Listen for chain changes (MetaMask)
        if (window.ethereum) {
            window.ethereum.on('chainChanged', (chainIdHex: string) => {
                setCurrentChainId(parseInt(chainIdHex, 16));
            });
        }

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

                                        {/* To Network - Dropdown */}
                                        <div class="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 transition-all relative">
                                            <div class="flex justify-between items-center mb-3">
                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Destination Network</span>
                                            </div>
                                            <button
                                                onClick={() => setShowNetworkDropdown(!showNetworkDropdown())}
                                                class="w-full flex items-center gap-4 hover:bg-white/5 rounded-xl p-2 -m-2 transition-all"
                                            >
                                                <div class={`w-10 h-10 rounded-full flex items-center justify-center border ${toNetwork().chainId === 11155111 ? 'bg-purple-600/20 border-purple-500/20' :
                                                    toNetwork().chainId === 80002 ? 'bg-violet-600/20 border-violet-500/20' :
                                                        toNetwork().chainId === 84532 ? 'bg-blue-600/20 border-blue-500/20' :
                                                            'bg-cyan-600/20 border-cyan-500/20'
                                                    }`}>
                                                    <Zap class={`w-5 h-5 ${toNetwork().chainId === 11155111 ? 'text-purple-400' :
                                                        toNetwork().chainId === 80002 ? 'text-violet-400' :
                                                            toNetwork().chainId === 84532 ? 'text-blue-400' :
                                                                'text-cyan-400'
                                                        }`} />
                                                </div>
                                                <div class="flex-1 text-left">
                                                    <div class="text-lg font-black italic uppercase tracking-tight">{toNetwork().name}</div>
                                                    <Show when={!toNetwork().enabled}>
                                                        <span class="text-[10px] text-amber-400 font-bold">Coming Soon</span>
                                                    </Show>
                                                </div>
                                                <ChevronRight class={`w-5 h-5 text-gray-500 transition-transform ${showNetworkDropdown() ? 'rotate-90' : ''}`} />
                                            </button>

                                            {/* Network Dropdown */}
                                            <Show when={showNetworkDropdown()}>
                                                <div class="absolute left-0 right-0 top-full mt-2 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                                                    <For each={getDestinationNetworks()}>
                                                        {(network) => (
                                                            <button
                                                                onClick={() => {
                                                                    if (network.enabled) {
                                                                        setToNetwork(network);
                                                                        setShowNetworkDropdown(false);
                                                                    }
                                                                }}
                                                                disabled={!network.enabled}
                                                                class={`w-full flex items-center gap-4 p-4 transition-all ${network.enabled
                                                                    ? 'hover:bg-white/5 cursor-pointer'
                                                                    : 'opacity-50 cursor-not-allowed'
                                                                    } ${toNetwork().chainId === network.chainId ? 'bg-white/5' : ''}`}
                                                            >
                                                                <div class={`w-8 h-8 rounded-full flex items-center justify-center border ${network.chainId === 11155111 ? 'bg-purple-600/20 border-purple-500/20' :
                                                                    network.chainId === 80002 ? 'bg-violet-600/20 border-violet-500/20' :
                                                                        network.chainId === 84532 ? 'bg-blue-600/20 border-blue-500/20' :
                                                                            'bg-cyan-600/20 border-cyan-500/20'
                                                                    }`}>
                                                                    <Zap class={`w-4 h-4 ${network.chainId === 11155111 ? 'text-purple-400' :
                                                                        network.chainId === 80002 ? 'text-violet-400' :
                                                                            network.chainId === 84532 ? 'text-blue-400' :
                                                                                'text-cyan-400'
                                                                        }`} />
                                                                </div>
                                                                <div class="flex-1 text-left">
                                                                    <div class="text-sm font-bold">{network.name}</div>
                                                                    <Show when={!network.enabled}>
                                                                        <span class="text-[10px] text-amber-400 font-bold">Coming Soon</span>
                                                                    </Show>
                                                                </div>
                                                                <Show when={toNetwork().chainId === network.chainId}>
                                                                    <CheckCircle2 class="w-4 h-4 text-green-400" />
                                                                </Show>
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>
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
                                            {/* VCN Price Display */}
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>VCN Price</span>
                                                <span class="text-emerald-400 font-bold">${getVcnPrice().toFixed(4)}</span>
                                            </div>
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>Estimated Value</span>
                                                <span class="text-white font-bold">
                                                    ${(parseFloat(amount() || '0') * getVcnPrice()).toFixed(2)} USD
                                                </span>
                                            </div>
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>Bridge Fee (Est.)</span>
                                                <span class="text-gray-300">0.1% + Gas</span>
                                            </div>
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>Minimum Bridge</span>
                                                <span class="text-gray-300">0.1 VCN</span>
                                            </div>
                                            <div class="flex justify-between items-center text-[11px] text-gray-500 font-medium px-2">
                                                <span>Estimated Arrival</span>
                                                <span class="text-gray-300">~15 Minutes</span>
                                            </div>

                                            <button
                                                onClick={handleBridge}
                                                disabled={!amount() || isBridging() || parseFloat(amount()) > parseFloat(balance()) || parseFloat(amount()) < 0.1}
                                                class="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-[0.98] disabled:cursor-not-allowed"
                                            >
                                                <ArrowRightLeft class="w-4 h-4" />
                                                {parseFloat(amount() || '0') > parseFloat(balance())
                                                    ? 'INSUFFICIENT BALANCE'
                                                    : parseFloat(amount() || '0') < 0.1 && parseFloat(amount() || '0') > 0
                                                        ? 'MINIMUM 0.1 VCN'
                                                        : 'START BRIDGE TRANSFER'}
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

                                {/* Live VCN Price */}
                                <div class="mt-4 pt-4 border-t border-white/5">
                                    <div class="flex justify-between items-center">
                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">VCN Price</span>
                                        <div class="flex items-center gap-2">
                                            <span class="relative flex h-2 w-2">
                                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            <span class="text-lg font-black text-emerald-400 tabular-nums">${getVcnPrice().toFixed(4)}</span>
                                        </div>
                                    </div>
                                </div>
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
