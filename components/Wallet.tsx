import { createSignal, Show, For, onMount, createEffect, Switch, Match, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { Portal } from 'solid-js/web';

import { Motion, Presence } from 'solid-motionone';
import {
    Wallet as WalletIcon,
    Send,
    ArrowUpRight,
    ArrowDownLeft,
    Sparkles,
    User,
    Settings,
    PieChart,
    Menu,
    Plus,
    ChevronRight,
    RefreshCw,
    TrendingUp,
    Copy,
    Check,
    MessageSquare,
    Zap,
    Shield,
    Globe,
    ChevronDown,
    ChevronUp,
    Users,
    Search,
    Smartphone,
    Lock,
    Camera,
    CheckCircle,
    AlertCircle,
    ArrowRight,
    Phone,
    Eye,
    EyeOff,
    Leaf,
    Star,
    Download,
    AlertTriangle,
    Info,
    ShieldCheck,
    LogOut,
    Clock,
    Bell
} from 'lucide-solid';
import {
    updateWalletStatus,
    getUserPurchases,
    getUserData,
    VcnPurchase,
    updateUserData,
    resolveRecipient,
    getUserConversations,
    saveConversation,
    deleteConversation,
    AiConversation,
    subscribeToQueue,
    saveScheduledTransfer,
    cancelScheduledTask,
    createNotification,
    NotificationData,
    getFirebaseDb
} from '../services/firebaseService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { WalletService } from '../services/walletService';
import { ethers } from 'ethers';
import { initPriceService, getVcnPrice, getDailyOpeningPrice } from '../services/vcnPriceService';
import { generateText } from '../services/ai';
import { useAuth } from './auth/authContext';
import { contractService } from '../services/contractService';
import { useNavigate } from '@solidjs/router';
import { WalletSidebar } from './wallet/WalletSidebar';
import { WalletDashboard } from './wallet/WalletDashboard';
import { WalletAssets } from './wallet/WalletAssets';
import { WalletCampaign } from './wallet/WalletCampaign';
import { WalletMint } from './wallet/WalletMint';
import { WalletNodes } from './wallet/WalletNodes';
import { WalletContacts } from './wallet/WalletContacts';
import { WalletSettings } from './wallet/WalletSettings';
import { WalletNotifications } from './wallet/WalletNotifications';

type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 'settings' | 'contacts' | 'nodes' | 'history' | 'notifications';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Token {
    symbol: string;
    name: string;
    balance: string;
    value: string;
    change: number;
    color: string;
}

interface CoinGeckoToken {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    price_change_percentage_24h: number;
    sparkline_in_7d?: {
        price: number[];
    };
}

interface AssetData {
    symbol: string;
    name: string;
    balance: number;
    purchasedBalance: number;
    liquidBalance: number;
    image: string | null;
    price: number;
    change24h: number;
    sparkline: number[];
    isLoading: boolean;
}

// Sparkline component for mini price charts
const Sparkline = (props: { data: number[], positive: boolean, width?: number, height?: number }) => {
    const width = props.width || 80;
    const height = props.height || 32;

    const getPath = () => {
        if (!props.data || props.data.length < 2) return '';

        const min = Math.min(...props.data);
        const max = Math.max(...props.data);
        const range = max - min || 1;

        const points = props.data.map((value, index) => {
            const x = (index / (props.data.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            return `${x},${y}`;
        });

        return `M${points.join(' L')}`;
    };

    return (
        <svg width={width} height={height} class="overflow-visible">
            <path
                d={getPath()}
                fill="none"
                stroke={props.positive ? '#10b981' : '#ef4444'}
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    );
};

const Wallet = (): JSX.Element => {
    const navigate = useNavigate();
    const auth = useAuth();
    // State Declarations
    const [activeView, setActiveView] = createSignal('assets');
    const [networkMode, setNetworkMode] = createSignal<'mainnet' | 'testnet'>('testnet');
    const [assetsTab, setAssetsTab] = createSignal('tokens');
    const [selectedToken, setSelectedToken] = createSignal('VCN');
    const [toToken, setToToken] = createSignal('USDT');
    const [receiveNetwork, setReceiveNetwork] = createSignal('Ethereum');
    const [sendAmount, setSendAmount] = createSignal('');
    const [swapAmount, setSwapAmount] = createSignal('');
    const [recipientAddress, setRecipientAddress] = createSignal('');
    const [stakeAmount, setStakeAmount] = createSignal('');
    const [onboardingStep, setOnboardingStep] = createSignal(0);
    const [userProfile, setUserProfile] = createSignal({
        username: 'Vision User',
        displayName: 'Vision User',
        email: auth.user()?.email || '',
        bio: '',
        twitter: '',
        discord: '',
        phone: '',
        isVerified: false,
        tier: 0,
        address: '',
        role: 'user'
    });
    const [walletAddressSignal, setWalletAddressSignal] = createSignal('');
    const walletAddress = createMemo(() => userProfile().address || walletAddressSignal() || '');
    const [showSeed, setShowSeed] = createSignal(false);
    const [seedPhrase, setSeedPhrase] = createSignal<string[]>([]);
    const [selectedWords, setSelectedWords] = createSignal<string[]>([]);
    const [shuffledSeed, setShuffledSeed] = createSignal<string[]>([]);
    const [isVerifying, setIsVerifying] = createSignal(false);
    const [verificationStep, setVerificationStep] = createSignal(0);
    const [activeFlow, setActiveFlow] = createSignal<string | null>(null);
    const [flowStep, setFlowStep] = createSignal(1);
    const [flowLoading, setFlowLoading] = createSignal(false);
    const [isImporting, setIsImporting] = createSignal(false);
    const [importStep, setImportStep] = createSignal(0);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [copied, setCopied] = createSignal(false);
    const [copiedSeed, setCopiedSeed] = createSignal(false);
    const [showPasswordModal, setShowPasswordModal] = createSignal(false);
    const [passwordMode, setPasswordMode] = createSignal<'setup' | 'verify'>('setup');
    const [pendingAction, setPendingAction] = createSignal<{ type: string, data?: any } | null>(null);
    const [walletPassword, setWalletPassword] = createSignal('');
    const [confirmWalletPassword, setConfirmWalletPassword] = createSignal('');
    const [showWalletPassword, setShowWalletPassword] = createSignal(false);
    const [onboardingSuccess, setOnboardingSuccess] = createSignal(false);
    const [referralBonus, setReferralBonus] = createSignal('0');
    const [isLocalWalletMissing, setIsLocalWalletMissing] = createSignal(false);
    const [restoringMnemonic, setRestoringMnemonic] = createSignal('');
    const [editPhone, setEditPhone] = createSignal('');
    const [isSavingPhone, setIsSavingPhone] = createSignal(false);
    const [isRestoring, setIsRestoring] = createSignal(false);
    const [lastTxHash, setLastTxHash] = createSignal('');
    const [loadingMessage, setLoadingMessage] = createSignal('LOADING WALLET');
    const [purchasedVcn, setPurchasedVcn] = createSignal(0);

    // --- Time-lock Agent (Scheduled Transfer) State ---
    const [queueTasks, setQueueTasks] = createSignal<any[]>([]);
    const [isSchedulingTimeLock, setIsSchedulingTimeLock] = createSignal(false);
    const [lockDelaySeconds, setLockDelaySeconds] = createSignal(0);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = createSignal(0);
    const [chatHistoryOpen, setChatHistoryOpen] = createSignal(true);

    createEffect(() => {
        const email = auth.user()?.email;
        if (!email) return;

        const db = getFirebaseDb();
        const notificationsRef = collection(db, 'users', email.toLowerCase(), 'notifications');
        const q = query(notificationsRef, where('read', '==', false));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadNotificationsCount(snapshot.size);
        });

        return unsubscribe;
    });

    createEffect(() => {
        const email = userProfile().email;
        if (email) {
            const unsubscribe = subscribeToQueue(email, (tasks) => {
                setQueueTasks(tasks);
            });
            return () => unsubscribe();
        }
    });

    const handleCancelTask = async (taskId: string) => {
        try {
            setIsLoading(true);
            setLoadingMessage('CANCELLING TASK...');

            // 1. Contract Cancel (If it has a scheduleId/creationTx)
            // For now, simple mock or direct firebase update
            await cancelScheduledTask(taskId);

            alert('Task cancelled successfully.');
        } catch (e) {
            console.error("Cancel failed:", e);
        } finally {
            setIsLoading(false);
            setLoadingMessage('LOADING WALLET');
        }
    };

    const copyToClipboard = async (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for non-secure contexts or older browsers
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (err) {
            console.error('Copy failed:', err);
            return false;
        }
    };

    const copySeedPhrase = async () => {
        const phrase = seedPhrase().join(' ');
        if (!phrase) return;

        const success = await copyToClipboard(phrase);
        if (success) {
            setCopiedSeed(true);
            setTimeout(() => setCopiedSeed(false), 2000);
        } else {
            alert('Failed to copy to clipboard. Please try selecting the words manually.');
        }
    };
    const [contacts, setContacts] = createSignal([]);
    const [sidebarOpen, setSidebarOpen] = createSignal(false);
    const [input, setInput] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [lastLocale, setLastLocale] = createSignal<'ko' | 'en'>('ko');
    const detectLanguage = (text: string) => {
        return (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) ? 'ko' : 'en';
    };

    const [chatHistory, setChatHistory] = createSignal<AiConversation[]>([]);
    const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);

    // --- Advanced AI Features (Synced with Global AI) ---
    const [attachments, setAttachments] = createSignal<any[]>([]);
    const [thinkingSteps, setThinkingSteps] = createSignal<any[]>([]);
    const [voiceLang, setVoiceLang] = createSignal('ko-KR');
    const [isRecording, setIsRecording] = createSignal(false);
    const [loadingType, setLoadingType] = createSignal<'text' | 'image' | 'voice'>('text');

    const fetchHistory = async () => {
        if (!userProfile().email) return;
        const data = await getUserConversations(userProfile().email);
        setChatHistory(data);
    };

    const selectConversation = (conv: AiConversation) => {
        setCurrentSessionId(conv.id);
        setMessages(conv.messages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.text
        })));
        setActiveView('chat');
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([{ role: 'assistant', content: 'Hello. I am the Vision Chain AI Architect. I can help you transfer assets, bridge tokens, or optimize your portfolio.' }]);
        setActiveView('chat');
    };

    const handleDeleteConversation = async (id: string) => {
        const success = await deleteConversation(id);
        if (success) {
            setChatHistory(prev => prev.filter(c => c.id !== id));
            if (currentSessionId() === id) {
                startNewChat();
            }
        }
    };

    createEffect(() => {
        if (userProfile().email) {
            fetchHistory();
        }
    });
    const [chatLoading, setChatLoading] = createSignal(false); // Dedicated loading for chat
    const [messages, setMessages] = createSignal<Message[]>([]);
    const [marketData, setMarketData] = createSignal<Map<string, CoinGeckoToken>>(new Map());
    const [marketLoading, setMarketLoading] = createSignal(true);
    const [vcnPurchases, setVcnPurchases] = createSignal<VcnPurchase[]>([]);
    const [portfolioStats, setPortfolioStats] = createSignal({
        total: 0,
        unlocked: 0,
        locked: 0,
        nextUnlock: 0,
        nextUnlockDays: 0,
        progress: 0
    });

    const [mintStep, setMintStep] = createSignal(1);
    const [tokenName, setTokenName] = createSignal('');
    const [tokenSymbol, setTokenSymbol] = createSignal('');
    const [tokenSupply, setTokenSupply] = createSignal('1000000');
    const [tokenType, setTokenType] = createSignal<'fungible' | 'nft'>('fungible');
    const [mintingNetworks, setMintingNetworks] = createSignal<string[]>(['Ethereum']);
    const [isMinting, setIsMinting] = createSignal(false);
    const [mintProgress, setMintProgress] = createSignal(0);
    const [mintedSuccess, setMintedSuccess] = createSignal(false);
    const [flowSuccess, setFlowSuccess] = createSignal(false);

    // Node License State
    const [ownedNodes, setOwnedNodes] = createSignal<any[]>([]); // Initialize empty, fetch later if needed
    const [nodeStats, setNodeStats] = createSignal({
        totalRewards: 0,
        activeNodes: 0,
        totalNodes: 0
    });

    // Helper to refresh node data (Placeholder for now, usually fetch from Graph/API)
    // const refreshNodeData = async () => { ... };

    const purchaseNode = async (type: 'Validator' | 'Enterprise') => {
        // Direct to setup if no wallet exists
        if (!WalletService.hasWallet(userProfile().email)) {
            alert('Please create or import a wallet first to purchase nodes.');
            setActiveView('profile');
            return;
        }

        // Use internal wallet flow
        setPasswordMode('verify');
        setPendingAction({ type: 'purchase_node', data: type });
        setWalletPassword('');
        setConfirmWalletPassword('');
        setShowPasswordModal(true);
    };

    const executePendingAction = async () => {
        const action = pendingAction();
        if (!action) return;

        try {
            setLoadingMessage('PROCESSING TRANSACTION...');
            setIsLoading(true);
            setShowPasswordModal(false);

            if (action.type === 'purchase_node') {
                const nodeType = action.data as 'Validator' | 'Enterprise';
                console.log(`Executing internal purchase for ${nodeType}...`);

                // 1. Decrypt Mnemonic
                const encrypted = WalletService.getEncryptedWallet(userProfile().email);
                if (!encrypted) {
                    throw new Error("Local wallet key not found. You are in view-only mode on this browser. Please restore your wallet using your 15-word recovery phrase to enable spending.");
                }

                const mnemonic = await WalletService.decrypt(encrypted, walletPassword());
                if (!WalletService.validateMnemonic(mnemonic)) {
                    throw new Error("Invalid decryption. Please check your spending password.");
                }

                // 2. Derive Signer and Connect Service
                const { privateKey } = WalletService.deriveEOA(mnemonic);
                const address = await contractService.connectInternalWallet(privateKey);
                console.log("Internal Signer Address:", address);

                // 3. Generate UUID and Execute Contract Call
                const uuid = crypto.randomUUID();
                const receipt = await contractService.purchaseLicense(uuid, nodeType);
                console.log("Purchase Successful. Receipt:", receipt);

                // 4. Update UI
                setOwnedNodes(prev => [...prev, {
                    id: `#${uuid.substring(0, 8)}`,
                    type: nodeType,
                    hashPower: nodeType === 'Validator' ? '1x' : '12x',
                    aor: 100,
                    dailyReward: nodeType === 'Validator' ? 12.5 : 150,
                    uptime: '0h 0m',
                    status: 'Operating'
                }]);

                setNodeStats(prev => ({
                    ...prev,
                    activeNodes: prev.activeNodes + 1,
                    totalNodes: prev.totalNodes + 1
                }));

                setLastTxHash(receipt.hash);
                alert(`Successfully deployed ${nodeType} Node! Tx: ${receipt.hash}`);
            } else if (action.type === 'send_tokens') {
                const { amount, recipient, symbol } = action.data;
                setFlowLoading(true);

                // 1. Decrypt Mnemonic
                const encrypted = WalletService.getEncryptedWallet(userProfile().email);
                if (!encrypted) {
                    throw new Error("Local wallet key not found. You are in view-only mode on this browser. Please restore your wallet using your 15-word recovery phrase to authorize transactions.");
                }
                const mnemonic = await WalletService.decrypt(encrypted, walletPassword());
                const { privateKey } = WalletService.deriveEOA(mnemonic);

                // 2. Connect Internal Wallet
                const address = await contractService.connectInternalWallet(privateKey);

                // 3. Execute Send or Local Time-lock Schedule
                if (isSchedulingTimeLock()) {
                    setLoadingMessage('AGENT: SYNCING BALANCE...');

                    // --- Auto-Seed Logic for Demo ---
                    // If user has purchased VCN but 0 on-chain VCN, silent airdrop to make it work
                    try {
                        const onChainBal = await contractService.getNativeBalance(address);
                        const numericAmount = parseFloat(amount.replace(/,/g, ''));

                        if (parseFloat(onChainBal) < numericAmount && purchasedVcn() >= numericAmount) {
                            setLoadingMessage('AGENT: AIRDROPPING VCN...');
                            console.log("[Demo] Auto-seeding wallet from admin...");
                            const seedReceipt = await contractService.adminSendVCN(address, (numericAmount + 1).toString()); // amount + 1 for gas
                            console.log("[Demo] Airdrop confirmed. Hash:", seedReceipt.hash);

                            // Give RPC a moment to update state
                            setLoadingMessage('AGENT: FINALIZING SYNC...');
                            await new Promise(r => setTimeout(r, 2000));

                            const newBal = await contractService.getNativeBalance(address);
                            console.log("[Demo] Verified post-airdrop balance:", newBal);
                        }
                    } catch (seedErr) {
                        console.warn("Auto-seed failed, proceeding anyway...", seedErr);
                    }

                    setLoadingMessage('AGENT: SCHEDULING TIME-LOCK...');
                    const receipt = await contractService.scheduleTransferNative(recipient, amount, lockDelaySeconds());
                    console.log("Time-lock Schedule Successful:", receipt.hash);
                    setLastTxHash(receipt.hash);

                    // 4. Register with Global Agent Queue (Firebase)
                    await saveScheduledTransfer({
                        userEmail: userProfile().email,
                        recipient: recipient,
                        amount: amount,
                        token: symbol,
                        unlockTime: Math.floor(Date.now() / 1000) + lockDelaySeconds(),
                        creationTx: receipt.hash,
                        status: 'pending'
                    });

                } else if (symbol === 'VCN') {
                    try {
                        // Use Paymaster (Gasless) Logic for VCN
                        const result = await contractService.sendGaslessTokens(recipient, amount);
                        console.log("Gasless Send Successful (Fee 1 VCN):", result);

                        // Extract hash from backend response if available, or just mark success
                        // The Smart Relayer returns status: 'success'
                        if (result.txHashes) {
                            setLastTxHash(result.txHashes.transfer || result.txHashes.permit);
                        }
                    } catch (error) {
                        console.warn("Paymaster failed, attempting standard transfer...", error);
                        try {
                            // Fallback to Standard Send
                            const receipt = await contractService.sendTokens(recipient, amount, symbol);
                            console.log("Standard Send Successful (Fallback):", receipt.hash);
                            setLastTxHash(receipt.hash);
                            alert(`Transfer Successful (Fallback): ${receipt.hash}`);
                        } catch (fallbackError: any) {
                            console.error("Fallback Failed:", fallbackError);
                            if (fallbackError.code === 'INSUFFICIENT_FUNDS' || fallbackError.message?.includes('insufficient funds')) {
                                // Show detailed Paymaster error if available
                                const paymasterError = (error as any).message || "Unknown Paymaster Error";
                                alert(`Transaction Failed. \n\nPaymaster Error: ${paymasterError}\n\nFallback Error: Insufficient ETH for gas.`);
                            } else {
                                alert(`Transfer Failed: ${fallbackError.message || "Unknown Error"}`);
                            }
                            throw fallbackError; // Stop flow
                        }
                    }
                } else {
                    // Standard Send for ETH/Other
                    const receipt = await contractService.sendTokens(recipient, amount, symbol);
                    console.log("Send Transaction Successful:", receipt.hash);
                    setLastTxHash(receipt.hash);
                }

                setFlowSuccess(true);
                setFlowStep(3);

                // --- Notification Logic ---
                try {
                    const isScheduled = isSchedulingTimeLock();

                    // 1. Notify Sender
                    await createNotification(userProfile().email, {
                        type: isScheduled ? 'transfer_scheduled' : 'alert',
                        title: isScheduled ? 'Transfer Scheduled' : 'Transfer Successful',
                        content: isScheduled
                            ? `You have scheduled ${amount} ${symbol} to be sent to ${recipient}.`
                            : `You successfully sent ${amount} ${symbol} to ${recipient}.`,
                        data: { amount, symbol, recipient, isScheduled }
                    });

                    // 2. Resolve Recipient for Incoming Notification
                    const recipientInfo = await resolveRecipient(recipient);
                    if (recipientInfo?.email && !isScheduled) {
                        await createNotification(recipientInfo.email, {
                            type: 'transfer_received',
                            title: 'Assets Received',
                            content: `You received ${amount} ${symbol} from ${userProfile().email || 'a Vision user'}.`,
                            data: { amount, symbol, from: userProfile().email }
                        });
                    }
                } catch (notifyErr) {
                    console.warn("Failed to trigger notifications:", notifyErr);
                }

                // Add AI Success Message in Chat
                const isScheduled = isSchedulingTimeLock();
                const successMsg = lastLocale() === 'ko'
                    ? (isScheduled
                        ? `A scheduled transfer of ${amount} ${symbol} has been set up by the Time-lock Agent system. The agent will automatically process it at the set time. You can check the progress in the queue at the top of the chat.`
                        : `Successfully completed the transfer of ${amount} ${symbol}! The transaction has been securely recorded on the network, and your balance will update shortly. Is there anything else I can help you with?`)
                    : (isScheduled
                        ? `Your ${amount} ${symbol} transfer has been orchestrated by the Time-lock Agent. It will be executed automatically at the scheduled time. Monitors the progress in the Queue above.`
                        : `Successfully sent ${amount} ${symbol}! The transaction is recorded, and your balance will be updated shortly. Is there anything else I can help with?`);

                setMessages(prev => [...prev, { role: 'assistant', content: successMsg }]);

                // Persist the success message to history
                if (userProfile().email) {
                    const convMessages = [...messages()].map(m => ({
                        role: m.role,
                        text: m.content,
                        timestamp: new Date().toISOString()
                    }));

                    saveConversation(
                        {
                            userId: userProfile().email,
                            botType: 'intent',
                            messages: convMessages,
                            lastMessage: successMsg,
                            status: 'completed'
                        },
                        currentSessionId() || undefined
                    ).then(id => {
                        if (id) {
                            setCurrentSessionId(id);
                            fetchHistory();
                        }
                    });
                }

                // Refresh balances immediately
                setTimeout(fetchPortfolioData, 1000);
                setTimeout(fetchPortfolioData, 5000); // Second check as nodes might take a moment
            } else if (action.type === 'claim_rewards') {
                // 1. Decrypt Mnemonic
                const encrypted = WalletService.getEncryptedWallet(userProfile().email);
                if (!encrypted) {
                    throw new Error("Local wallet key not found. Please restore your wallet using your recovery phrase to claim rewards.");
                }
                const mnemonic = await WalletService.decrypt(encrypted!, walletPassword());
                const { privateKey } = WalletService.deriveEOA(mnemonic);

                // 2. Connect Internal Wallet
                await contractService.connectInternalWallet(privateKey);

                // 3. Execute Claim (Placeholder logic for demo)
                // await contractService.claimReward(1); 
                console.log("Rewards Claimed via Internal Wallet");

                setNodeStats(prev => ({
                    ...prev,
                    totalRewards: 0
                }));
                alert("Rewards Claimed Successfully!");
            }
        } catch (error: any) {
            console.error("Internal Action Failed:", error);
            alert(`Execution failed: ${error.message || error}`);
        } finally {
            setIsLoading(false);
            setLoadingMessage('LOADING WALLET');
            setPendingAction(null);
            setWalletPassword('');
        }
    };

    const claimNodeRewards = async () => {
        if (!WalletService.hasWallet(userProfile().email)) return;

        setPasswordMode('verify');
        setPendingAction({ type: 'claim_rewards' });
        setWalletPassword('');
        setShowPasswordModal(true);
    };

    // User's token holdings (balance only)
    // User's actual holdings (will be updated via fetchPortfolioData)
    const [userHoldings, setUserHoldings] = createSignal({
        VCN: 0,
        ETH: 0
    });

    const shortAddress = () => {
        const addr = walletAddress();
        if (addr.length < 10) return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    const fetchMarketData = async () => {
        // CoinGecko API removed as per user request to avoid rate-limiting and CORS issues
        console.log('Market data fetch skipped - using static/mock prices');
        setMarketLoading(false);
    };

    // Auth & Data Effect
    createEffect(() => {
        if (!auth.loading()) {
            if (!auth.user()) {
                navigate('/login', { replace: true });
            } else {
                fetchFullProfile();
            }
        }
    });

    // Fetch data on mount
    onMount(async () => {
        initPriceService();

        // Sanitize corrupted local storage keys
        const encrypted = localStorage.getItem('vcn_encrypted_wallet');
        if (encrypted === 'null' || encrypted === 'undefined' || (encrypted && encrypted.length < 20)) {
            console.warn("Cleaning corrupted wallet storage");
            localStorage.removeItem('vcn_encrypted_wallet');
        }

        // Initial fetch
        fetchMarketData();
        // Refresh every 60 seconds
        const interval = setInterval(fetchMarketData, 60000);
        return () => clearInterval(interval);
    });

    const fetchFullProfile = async () => {
        const user = auth.user();
        if (!user || !user.email) return;

        try {
            setIsLoading(true);
            const data = await getUserData(user.email);
            if (data) {
                setUserProfile({
                    username: data.name || user.email.split('@')[0],
                    displayName: data.name || user.email.split('@')[0],
                    email: user.email,
                    bio: data.bio || '',
                    twitter: data.twitter || '',
                    discord: data.discord || '',
                    phone: data.phone || '',
                    isVerified: data.isVerified || false,
                    tier: data.tier || 0,
                    address: data.walletAddress || '',
                    role: data.role || 'user'
                });

                // Check if wallet exists in backend OR locally
                const hasBackendWallet = !!data.walletAddress;
                // Try to get address from local storage if not in profile
                const localAddress = localStorage.getItem('vcn_wallet_address');
                const hasLocalWallet = WalletService.hasWallet(user.email);
                setIsLocalWalletMissing(hasBackendWallet && !hasLocalWallet);

                if (hasBackendWallet || hasLocalWallet) {
                    const finalAddress = data.walletAddress || localAddress || '';
                    if (finalAddress) {
                        setWalletAddressSignal(finalAddress);
                    }
                    setOnboardingStep(0);

                    // Update userProfile with verified status if wallet exists anywhere
                    setUserProfile(prev => ({
                        ...prev,
                        isVerified: true,
                        address: finalAddress || prev.address
                    }));
                } else {
                    // Force onboarding if no wallet exists - Redirect to mnemonic generation flow
                    setOnboardingStep(1);
                    setActiveView('profile');
                }
            } else {
                // No profile data found in database, but maybe user exists in Auth
                const localAddress = localStorage.getItem('vcn_wallet_address');
                if (WalletService.hasWallet(user.email)) {
                    setWalletAddressSignal(localAddress || '');
                    setOnboardingStep(0);
                    setUserProfile(prev => ({ ...prev, isVerified: true, address: localAddress || '' }));
                } else {
                    setOnboardingStep(1);
                    setActiveView('profile');
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setIsLoading(false);
        }
    };

    createEffect(() => {
        if (!auth.loading() && !auth.user()) {
            navigate('/login', { replace: true });
        }
    });

    // Enforce Onboarding View Integrity
    createEffect(() => {
        if (onboardingStep() > 0 && activeView() !== 'profile') {
            setActiveView('profile');
        }
    });

    // Handle History View (Redirect to Wallet Chat)
    createEffect(() => {
        if (activeView() === 'history') {
            setChatHistoryOpen(true);
            setActiveView('chat');
        }
    });

    // Helper to get asset data with live prices
    const fetchPortfolioData = async () => {
        const currentUser = auth.user();
        const email = currentUser?.email;
        if (!email) return;

        try {
            const purchases = await getUserPurchases(email);
            setVcnPurchases(purchases);

            let total = 0;
            let unlocked = 0;
            let locked = 0;
            const now = new Date();

            let nextUnlock = 0;
            let nextUnlockDays = 999; // Initialize with a large number

            purchases.forEach(p => {
                total += p.amount;
                const createdAt = new Date(p.createdAt);

                // Simplified Vesting Calculation
                // 1. Initial Unlock
                const initialAmount = p.amount * (p.initialUnlockRatio / 100);

                // 2. Linear Vesting after Cliff
                const cliffEndDate = new Date(createdAt);
                cliffEndDate.setMonth(cliffEndDate.getMonth() + p.cliffMonths);

                if (now < cliffEndDate) {
                    unlocked += initialAmount;
                    const diffDays = Math.ceil((cliffEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays < nextUnlockDays) {
                        nextUnlockDays = diffDays;
                        // For simplicity, assume next unlock is the start of monthly linear vesting
                        nextUnlock = (p.amount - initialAmount) / p.vestingMonths;
                    }
                } else {
                    const monthsPassedAfterCliff = (now.getFullYear() - cliffEndDate.getFullYear()) * 12 + (now.getMonth() - cliffEndDate.getMonth());
                    const vestingProgress = Math.min(monthsPassedAfterCliff / p.vestingMonths, 1);
                    const linearAmount = (p.amount - initialAmount) * vestingProgress;
                    unlocked += initialAmount + linearAmount;

                    if (vestingProgress < 1) {
                        // Calculate next monthly unlock
                        const nextMonthDate = new Date(cliffEndDate);
                        nextMonthDate.setMonth(nextMonthDate.getMonth() + monthsPassedAfterCliff + 1);
                        const diffDays = Math.ceil((nextMonthDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays < nextUnlockDays) {
                            nextUnlockDays = diffDays;
                            nextUnlock = (p.amount - initialAmount) / p.vestingMonths;
                        }
                    }
                }
            });

            locked = total - unlocked;
            const progress = total > 0 ? (unlocked / total) * 100 : 0;

            setPortfolioStats({
                total,
                unlocked,
                locked,
                nextUnlock,
                nextUnlockDays: nextUnlockDays === 999 ? 0 : nextUnlockDays,
                progress
            });

            // Update purchased amount (Exception to Zero Mock rule as it's contractual)
            setPurchasedVcn(total);

            // CRITICAL: We NO LONGER set userHoldings from Firebase 'total'.
            // Liquid wallet balance must be strictly from the blockchain.

            // FETCH ON-CHAIN BALANCES (Testnet v2)
            if (walletAddress()) {
                console.log("🔄 Fetching On-Chain Balances for:", walletAddress());
                const [vcnBalance, ethBalance] = await Promise.all([
                    contractService.getTokenBalance(walletAddress()),
                    contractService.getNativeBalance(walletAddress())
                ]);

                console.log(`📊 On-Chain: VCN=${vcnBalance}, ETH=${ethBalance}`);

                setUserHoldings(prev => ({
                    ...prev,
                    VCN: Number(vcnBalance),
                    ETH: Number(ethBalance)
                }));
            }
        } catch (error) {
            console.error('Failed to fetch portfolio data:', error);
        }
    };

    onMount(() => {
        fetchPortfolioData();
    });

    createEffect(() => {
        if (auth.user() && walletAddress()) {
            fetchPortfolioData();
        }
    });

    const getAssetData = (symbol: string): AssetData => {
        const liquid = (userHoldings() as any)[symbol] || 0;
        const purchased = (symbol === 'VCN') ? purchasedVcn() : 0;

        // Use live VCN price from service, static for others
        const staticPrices: Record<string, { name: string, price: number, image?: string }> = {
            'VCN': { name: 'Vision Chain', price: getVcnPrice() },
            'ETH': { name: 'Ethereum', price: 3200.00 }
        };

        // Live change calculation for VCN
        const openingPrice = getDailyOpeningPrice();
        const liveDailyChange = ((getVcnPrice() - openingPrice) / openingPrice) * 100;

        const config = staticPrices[symbol] || { name: symbol, price: 0 };

        return {
            symbol,
            name: config.name,
            balance: liquid + purchased,
            purchasedBalance: purchased,
            liquidBalance: liquid,
            image: null,
            price: symbol === 'VCN' ? getVcnPrice() : config.price, // Live
            change24h: symbol === 'VCN' ? liveDailyChange : 0, // Live
            sparkline: [config.price, config.price, config.price],
            isLoading: false
        };
    };

    const totalValue = () => {
        let total = 0;
        ['VCN'].forEach(symbol => {
            const asset = getAssetData(symbol);
            total += asset.balance * asset.price;
        });
        return total;
    };

    const totalValueStr = () => totalValue().toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    createEffect(() => {
        if (userProfile().phone) {
            setEditPhone(userProfile().phone);
        } else {
            setEditPhone('');
        }
    });

    const handleUpdatePhone = async () => {
        if (!userProfile().email) return;
        setIsSavingPhone(true);
        try {
            await updateUserData(userProfile().email, { phone: editPhone() });
            // Refresh local profile
            const freshData = await getUserData(userProfile().email);
            if (freshData) {
                setUserProfile({
                    username: freshData.name || freshData.email.split('@')[0],
                    displayName: freshData.name || freshData.email.split('@')[0],
                    email: freshData.email,
                    bio: freshData.bio || '',
                    twitter: freshData.twitter || '',
                    discord: freshData.discord || '',
                    phone: freshData.phone || '',
                    isVerified: freshData.isVerified || false,
                    tier: freshData.tier || 0,
                    address: freshData.walletAddress || '',
                    role: freshData.role || 'user'
                });
            }
        } catch (e) {
            console.error("Failed to update phone:", e);
        } finally {
            setIsSavingPhone(false);
        }
    };

    // Derived list of tokens based on actual balances
    const tokens = createMemo(() => {
        const list: Token[] = [];
        const vcnAsset = getAssetData('VCN');
        const isTestnet = true; // Flag for future toggling

        // TODO: Hide 'VCN (Testnet)' when Mainnet launches if needed
        list.push({
            symbol: 'VCN',
            name: isTestnet ? 'Vision Chain (Testnet)' : 'Vision Chain',
            balance: vcnAsset.balance.toLocaleString(),
            value: (vcnAsset.balance * vcnAsset.price).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
            change: 0,
            color: 'from-blue-500 to-cyan-400'
        });
        return list;
    });

    const suggestions = [
        { text: 'Send 100 VCN', icon: ArrowUpRight, color: 'blue' },
        { text: 'Swap ETH → VCN', icon: RefreshCw, color: 'purple' },
        { text: 'Check balance', icon: PieChart, color: 'cyan' },
        { text: 'Recent activity', icon: MessageSquare, color: 'green' },
    ];

    const copyAddress = async () => {
        const success = await copyToClipboard(walletAddress());
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const downloadSeedPhrase = () => {
        const phrase = seedPhrase().join(' ');
        if (!phrase) return;

        const blob = new Blob([phrase], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vision-wallet-seed-phrase.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const startFlow = (flow: 'send' | 'receive' | 'swap' | 'stake' | 'bridge') => {
        setActiveFlow(flow);
        setFlowStep(1);
        setFlowSuccess(false);
        setFlowLoading(false);
    };

    const handleTransaction = async () => {
        if (activeFlow() === 'send') {
            setPasswordMode('verify');
            setPendingAction({
                type: 'send_tokens',
                data: {
                    amount: sendAmount().replace(/,/g, ''),
                    recipient: recipientAddress(),
                    symbol: selectedToken()
                }
            });
            setWalletPassword('');
            setShowPasswordModal(true);
        } else {
            // For other flows (swap, stake), we keep the simulation for now or implement as needed
            setFlowLoading(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            setFlowLoading(false);
            setFlowSuccess(true);
            setFlowStep(3);
        }
    };

    const importMobileContacts = () => {
        setIsImporting(true);
        setImportStep(1);
        setTimeout(() => setImportStep(2), 1500);
        setTimeout(() => setImportStep(3), 3000);
        setTimeout(() => {
            setIsImporting(false);
            setImportStep(0);
            setContacts([...contacts()]);
        }, 4500);
    };

    const inviteContact = (id: number) => {
        setContacts(contacts().map(c =>
            c.id === id ? { ...c, invited: true } : c
        ));
        setReferralBonus(prev => prev + 50);
    };

    const toggleFavorite = (id: number) => {
        setContacts(contacts().map(c =>
            c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
        ));
    };

    const generateSeedPhrase = () => {
        try {
            console.log("Generating seed phrase...");
            const mnemonic = WalletService.generateMnemonic(); // 160-bit entropy = 15 words
            if (!mnemonic) throw new Error("Failed to generate mnemonic");

            const words = mnemonic.split(' ');
            console.log("Generated words:", words.length);
            setSeedPhrase(words);
            setShuffledSeed([...words].sort(() => Math.random() - 0.5));
            setSelectedWords([]);
            // Auto-show seed when generated to improve UX
            setShowSeed(true);
        } catch (err) {
            console.error("Error generating seed phrase:", err);
            alert("Failed to generate seed phrase. Please try again or check console.");
        }
    };

    const nextOnboardingStep = () => {
        setOnboardingStep(prev => prev + 1);
    };


    const finalizeWalletCreation = async () => {
        if (!walletPassword()) {
            alert('Please enter a password');
            return;
        }

        if (!isRestoring() && walletPassword() !== confirmWalletPassword()) {
            alert("Passwords do not match. Please try again.");
            return;
        }

        try {
            setIsLoading(true);
            console.log("Finalizing wallet creation...");

            // 1. Derive EOA for metadata
            const mnemonic = seedPhrase().join(' ');
            if (!WalletService.validateMnemonic(mnemonic)) {
                throw new Error("Invalid mnemonic during finalization");
            }
            const { address } = WalletService.deriveEOA(mnemonic);

            // 2. Encrypt and Save 
            const encrypted = await WalletService.encrypt(mnemonic, walletPassword());
            WalletService.saveEncryptedWallet(encrypted, userProfile().email);
            // Save address unencrypted for UI consistency
            localStorage.setItem('vcn_wallet_address', address);

            // 3. Update Backend Status
            const user = auth.user();
            if (user && user.email) {
                await updateWalletStatus(user.email, address);
            }

            // 4. Update User State
            setUserProfile(prev => ({
                ...prev,
                isVerified: true,
                tier: 1,
                address: address
            }));

            // 5. Success state
            setShowPasswordModal(false);
            setIsRestoring(false); // Reset restore state
            setOnboardingStep(4); // Move to Success Screen AFTER password is set

        } catch (error) {
            console.error('Wallet completion error:', error);
            alert('Failed to complete wallet setup. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const finishOnboarding = () => {
        setOnboardingSuccess(false);
        setOnboardingStep(0);
        setActiveView('assets');
    };

    const startVerification = () => {
        setIsVerifying(true);
        setTimeout(() => {
            setIsVerifying(false);
            setVerificationStep(2); // Simulated success
        }, 2000);
    };
    const [recognition, setRecognition] = createSignal<any>(null);

    const handleFileSelect = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files) {
            const files = Array.from(target.files);
            files.forEach(processFile);
        }
    };

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            let type: any = 'unknown';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type === 'application/pdf') type = 'pdf';
            else if (file.name.endsWith('.csv') || file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) type = 'excel';

            setAttachments(prev => [...prev, {
                file,
                preview: e.target?.result as string,
                type
            }]);
        };
        reader.readAsDataURL(file);
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const toggleRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Your browser does not support Speech Recognition.");
            return;
        }

        if (isRecording()) {
            recognition()?.stop();
            setIsRecording(false);
            return;
        }

        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = voiceLang();
        recognitionInstance.interimResults = true;
        recognitionInstance.onstart = () => setIsRecording(true);
        recognitionInstance.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                setInput(prev => {
                    const cleanPrev = prev.trim();
                    return cleanPrev ? `${cleanPrev} ${finalTranscript}` : finalTranscript;
                });
            }
        };
        recognitionInstance.onerror = () => setIsRecording(false);
        recognitionInstance.onend = () => setIsRecording(false);
        recognitionInstance.start();
        setRecognition(recognitionInstance);
    };

    const resetFlow = () => {
        setActiveFlow(null);
        setFlowStep(1);
        setFlowLoading(false);
        setFlowSuccess(false);
        setSendAmount('');
        setSwapAmount('');
        setRecipientAddress('');
        setIsSchedulingTimeLock(false);
        setLockDelaySeconds(0);
    };

    const handleSend = async () => {
        if (!input().trim() || chatLoading()) return;

        const userMessage = input().trim();
        setLastLocale(detectLanguage(userMessage));
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setChatLoading(true);
        setThinkingSteps([
            { id: '1', label: 'Analyzing Intent...', status: 'loading' }
        ]);

        try {
            // Multimodal Support: Grab image if attached
            const imageAttachment = attachments().find(a => a.type === 'image');
            const imageBase64 = imageAttachment?.preview?.split(',')[1];

            // Construct context from wallet state
            const context = `
Current Portfolio Summary:
Network: ${networkMode().toUpperCase()}
Wallet Address: ${walletAddress()}
Total Value: ${totalValueStr()}
Holdings:
${tokens().map((t: any) => `- ${t.symbol}: ${t.balance} (${t.value})`).join('\n')}

(Important: You are currently on the ${networkMode()}. ${networkMode() === 'testnet' ? 'Testnet VCN is distributed at 10% of the purchased amount for testing node purchases and transactions.' : 'Mainnet shows actual purchased assets.'})
`;

            // Enhanced Intent-Aware Prompt
            const languageInstruction = lastLocale() === 'ko'
                ? "반드시 한국어로 답변해 주세요."
                : "Please respond in English.";

            const fullPrompt = `${context}
[Language Rule]
${languageInstruction}

User Input: "${userMessage}"

You are the Vision AI Architect.
[Decision Logic]
1. Transactional Actions: If the user explicitly wants to Send, Swap, Bridge, Stake, or Schedule (e.g., "Send 10 VCN to @jays", "10 VCN 1분뒤에 노장협에게 보내"), identify the intent and parameters.
2. Informational Queries: If the user is asking about their balance, net worth, holdings, prices, or general help (e.g., "How much VCN do I have?", "Check my balance", "잔고 확인해줘", "내 잔액 얼마야?", "보유량 알려줘"), DO NOT append any JSON. Simply provide a helpful answer using the Context provided above.

Output Format:
1. Friendly explanation or answer (Brief, in the user's language: ${lastLocale() === 'ko' ? 'Korean' : 'English'}).
2. ONLY IF A TRANSACTIONAL ACTION IS DETECTED, append THIS EXACT JSON BLOCK at the end (keep values empty if not specified):
{"intent": "send" | "swap" | "bridge" | "stake" | "schedule", "amount": "number_string", "recipient": "0x... or name", "symbol": "VCN", "time": "time_string if schedule"}

Final network context: ${networkMode()}.
`;

            setThinkingSteps(prev => [
                ...prev.map(s => ({ ...s, status: 'completed' as const })),
                { id: '2', label: 'Comparing Portfolio & Simulating...', status: 'loading' }
            ]);

            const response = await generateText(fullPrompt, imageBase64, 'intent', userProfile().email);

            setThinkingSteps(prev => [
                ...prev.map(s => ({ ...s, status: 'completed' as const })),
                { id: '3', label: 'Response Generated', status: 'success' }
            ]);
            setTimeout(() => setThinkingSteps([]), 1500);

            // 1. Check for Intent JSON
            let intentData: any = null;
            const jsonMatch = response.match(/\{"intent":\s*".*?"\}/) || response.match(/\{[\s\S]*?"intent"[\s\S]*?\}/);

            if (jsonMatch) {
                try {
                    const jsonStr = jsonMatch[0];
                    intentData = JSON.parse(jsonStr);
                } catch (e) {
                    console.warn("Intent JSON Parse Failed", e);
                }
            }

            // 2. Trigger Wallet Flow if intent detected
            if (intentData) {
                // Name Resolution Step (VNS)
                if (intentData.recipient && !intentData.recipient.startsWith('0x')) {
                    const resolved = await resolveRecipient(intentData.recipient, userProfile().email);
                    if (resolved && resolved.address) {
                        intentData.recipient = resolved.address;
                    }
                }

                if (intentData.intent === 'send') {
                    setRecipientAddress(intentData.recipient || '');
                    setSendAmount(intentData.amount || '');
                    setSelectedToken(intentData.symbol || 'VCN');
                    startFlow('send');
                    // If we have both amount and recipient, skip to confirmation
                    if (intentData.amount && ethers.isAddress(intentData.recipient)) {
                        setFlowStep(2);
                    }
                } else if (intentData.intent === 'swap') {
                    setSwapAmount(intentData.amount || '');
                    startFlow('swap');
                } else if (intentData.intent === 'stake') {
                    setStakeAmount(intentData.amount || '');
                    startFlow('stake');
                } else if (intentData.intent === 'bridge') {
                    startFlow('bridge');
                } else if (intentData.intent === 'schedule') {
                    setRecipientAddress(intentData.recipient || '');
                    setSendAmount(intentData.amount || '');
                    setSelectedToken(intentData.symbol || 'VCN');

                    // Parse Time from intentData.time or intentData.scheduleTime
                    const timeStr = intentData.time || intentData.scheduleTime || '2 minutes';
                    let delay = 120; // Default 2 mins
                    const numeric = parseInt(timeStr.match(/\d+/) || '2');

                    if (timeStr.includes('min') || timeStr.includes('분')) {
                        delay = numeric * 60;
                    } else if (timeStr.includes('hour') || timeStr.includes('h') || timeStr.includes('시간')) {
                        delay = numeric * 3600;
                    } else if (timeStr.includes('sec') || timeStr.includes('초')) {
                        delay = numeric;
                    } else {
                        // Fallback: if just a number is provided, assume minutes
                        delay = numeric * 60;
                    }

                    setIsSchedulingTimeLock(true);
                    setLockDelaySeconds(delay);

                    startFlow('send');
                    // If we have both amount and recipient, skip to confirmation
                    if (intentData.amount && ethers.isAddress(intentData.recipient)) {
                        setFlowStep(2);
                    }

                    const msg = lastLocale() === 'ko'
                        ? `일정을 확인했습니다. ${intentData.amount} ${intentData.symbol} (${timeStr}) 예약 이체 설정을 시작합니다.`
                        : `I've prepared your scheduled transfer of ${intentData.amount} ${intentData.symbol} (${timeStr}).`;
                    setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
                    setChatLoading(false);
                    return;
                }
            }

            // 3. Clean up response for display
            let cleanResponse = response;
            if (jsonMatch) {
                cleanResponse = response.replace(jsonMatch[0], "").trim();
            }

            if (!cleanResponse && intentData) {
                if (lastLocale() === 'ko') {
                    const intentMap: any = {
                        'send': 'transfer',
                        'swap': 'swap',
                        'stake': 'staking',
                        'bridge': 'bridge',
                        'schedule': 'scheduled transfer'
                    };
                    const intentName = intentMap[intentData.intent] || 'transaction';
                    cleanResponse = `I've prepared the ${intentName} as you requested. Please review the details on the screen and proceed when you're ready!`;
                } else {
                    cleanResponse = `I've prepared the ${intentData.intent} transaction for you. Please review the details on your screen to proceed!`;
                }
            }

            setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);

            // SAVE TO FIREBASE
            if (userProfile().email) {
                const convMessages = [...messages()].map(m => ({
                    role: m.role,
                    text: m.content,
                    timestamp: new Date().toISOString()
                }));

                const savedId = await saveConversation(
                    {
                        userId: userProfile().email,
                        botType: 'intent',
                        messages: convMessages,
                        lastMessage: convMessages[convMessages.length - 1]?.text || '',
                        status: 'completed'
                    },
                    currentSessionId() || undefined
                );

                if (savedId) {
                    setCurrentSessionId(savedId);
                    fetchHistory();
                }
            }
        } catch (error) {
            console.error('AI Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error while processing your request. The system might be busy or undergoing maintenance. Please try again later." }]);
        } finally {
            setChatLoading(false);
        }
    };

    const handleSuggestion = (text: string) => {
        setInput(text);
    };

    const handleRestoreWallet = async () => {
        const mnemonic = restoringMnemonic().trim().toLowerCase();
        if (!mnemonic) return;

        if (!WalletService.validateMnemonic(mnemonic)) {
            alert("Invalid recovery phrase. Please check the words and try again.");
            return;
        }

        setSeedPhrase(mnemonic.split(' '));
        setIsRestoring(true);
        setPasswordMode('setup');
        setShowPasswordModal(true);
    };

    const handleMint = async () => {
        if (!tokenName() || !tokenSymbol()) return;
        setIsMinting(true);
        setMintedSuccess(false);
        setMintProgress(5);

        // Simulate a more detailed multi-stage minting process
        const stages = [
            { threshold: 20, message: 'Deploying smart contract...' },
            { threshold: 45, message: 'Configuring cross-chain interoperability...' },
            { threshold: 70, message: 'Verifying on-chain metadata...' },
            { threshold: 90, message: 'Generating cross-chain proofs...' },
            { threshold: 100, message: 'Finalizing mint...' }
        ];

        let currentStage = 0;

        const interval = setInterval(() => {
            setMintProgress(prev => {
                const next = prev + Math.floor(Math.random() * 8) + 2;

                if (next >= stages[currentStage].threshold && currentStage < stages.length - 1) {
                    currentStage++;
                }

                if (next >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        setIsMinting(false);
                        setMintedSuccess(true);
                    }, 500);
                    return 100;
                }
                return next;
            });
        }, 300);
    };



    return (
        <Show when={!auth.loading() && !isLoading()} fallback={
            <div class="fixed inset-0 bg-[#0a0a0b] flex items-center justify-center z-[100]">
                <div class="flex flex-col items-center gap-4">
                    <div class="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                    <div class="text-white text-sm font-bold tracking-widest animate-pulse">{loadingMessage()}</div>
                </div>
            </div>
        }>
            <section class="bg-[#0a0a0b] min-h-screen pt-14 flex overflow-hidden">

                {/* Ambient Background */}
                <div class="fixed inset-0 pointer-events-none overflow-hidden">
                    <div class="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[150px]" />
                    <div class="absolute bottom-1/4 -right-32 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[130px]" />
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[180px]" />
                </div>

                {/* Wallet Sidebar (Desktop & Mobile) */}
                <WalletSidebar
                    sidebarOpen={sidebarOpen()}
                    setSidebarOpen={setSidebarOpen}
                    activeView={activeView()}
                    setActiveView={setActiveView}
                    onboardingStep={onboardingStep()}
                    userProfile={userProfile()}
                    shortAddress={shortAddress()}
                    copyAddress={copyAddress}
                    copied={copied()}
                    onLogout={() => auth.logout()}
                    networkMode={networkMode()}
                    setNetworkMode={setNetworkMode}
                    unreadCount={unreadNotificationsCount()}
                />

                {/* Main Content Area */}
                <main class="flex-1 flex flex-col h-[calc(100vh-56px)] transition-all duration-300 relative ml-0 lg:ml-[280px] w-full overflow-x-hidden">

                    {/* Top Bar */}
                    <div class="flex items-center gap-4 px-4 sm:px-5 py-3.5 border-b border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-xl sticky top-14 z-20">
                        <button
                            onClick={() => {
                                if (onboardingStep() === 0) setSidebarOpen(!sidebarOpen());
                            }}
                            disabled={onboardingStep() > 0}
                            class="lg:hidden p-2.5 hover:bg-white/[0.06] rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Menu class="w-5 h-5 text-gray-400" />
                        </button>
                        <div class="h-6 w-px bg-white/10" />
                        <div class="flex items-center gap-2.5">
                            <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                                <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <span class="font-medium text-white text-[15px]">Vision Wallet</span>
                        </div>
                    </div>

                    {/* Chat View */}
                    <Show when={activeView() === 'chat'}>
                        <WalletDashboard
                            messages={messages}
                            isLoading={chatLoading} // Use chat-specific loading
                            input={input}
                            setInput={setInput}
                            handleSend={handleSend}
                            setActiveView={setActiveView}
                            setActiveFlow={setActiveFlow}
                            totalValueStr={totalValueStr}
                            getAssetData={getAssetData}
                            userProfile={userProfile}
                            onboardingStep={onboardingStep}
                            networkMode={networkMode()}
                            history={chatHistory}
                            currentSessionId={currentSessionId}
                            onSelectConversation={selectConversation}
                            onNewChat={startNewChat}
                            onDeleteConversation={handleDeleteConversation}
                            // Advanced Features
                            attachments={attachments}
                            removeAttachment={removeAttachment}
                            handleFileSelect={handleFileSelect}
                            thinkingSteps={thinkingSteps}
                            voiceLang={voiceLang}
                            setVoiceLang={setVoiceLang}
                            toggleRecording={toggleRecording}
                            isRecording={isRecording}
                            // Queue Integration (Time-lock Agent)
                            queueTasks={queueTasks}
                            onCancelTask={handleCancelTask}
                            isScheduling={isSchedulingTimeLock()}
                            chatHistoryOpen={chatHistoryOpen()}
                            setChatHistoryOpen={setChatHistoryOpen}
                        />
                    </Show>

                    {/* Campaign View */}
                    <Show when={activeView() === 'campaign'}>
                        <WalletCampaign />
                    </Show>

                    {/* Mint View */}
                    <Show when={activeView() === 'mint'}>
                        <WalletMint
                            mintStep={mintStep}
                            setMintStep={setMintStep}
                            tokenName={tokenName}
                            setTokenName={setTokenName}
                            tokenSymbol={tokenSymbol}
                            setTokenSymbol={setTokenSymbol}
                            tokenType={tokenType}
                            setTokenType={setTokenType}
                            tokenSupply={tokenSupply}
                            setTokenSupply={setTokenSupply}
                            mintingNetworks={mintingNetworks}
                            setMintingNetworks={setMintingNetworks}
                            handleMint={handleMint}
                            isMinting={isMinting}
                            mintedSuccess={mintedSuccess}
                            setMintedSuccess={setMintedSuccess}
                            mintProgress={mintProgress}
                        />
                    </Show>

                    {/* Nodes View (New Implementation) */}
                    <Show when={activeView() === 'nodes'}>
                        <WalletNodes
                            userNodes={ownedNodes()}
                            claimNodeRewards={claimNodeRewards}
                            purchaseNode={purchaseNode}
                        />
                    </Show>

                    <Show when={activeView() === 'assets'}>
                        <WalletAssets
                            totalValueStr={totalValueStr}
                            portfolioStats={portfolioStats}
                            assetsTab={assetsTab}
                            setAssetsTab={setAssetsTab}
                            getAssetData={getAssetData}
                            startFlow={setActiveFlow}
                            setActiveView={setActiveView}
                            vcnPurchases={vcnPurchases}
                            totalValue={totalValue}
                            networkMode={networkMode()}
                            isLocalWalletMissing={isLocalWalletMissing()}
                            onRestoreWallet={() => {
                                setActiveView('profile');
                                setOnboardingStep(2);
                            }}
                            walletAddress={walletAddress}
                        />
                    </Show>

                    <Show when={activeView() === 'profile'}>
                        <div class="flex-1 overflow-y-auto p-4 lg:p-8">
                            <div class="max-w-4xl mx-auto space-y-6">

                                {/* Onboarding Header (Progress Stepper) - Redesigned to match image */}
                                <Show when={onboardingStep() > 0}>
                                    <div class="max-w-xl mx-auto mb-12">
                                        <div class="text-center mb-8">
                                            <h2 class="text-3xl font-bold text-white mb-2">Secure Wallet Setup</h2>
                                            <p class="text-gray-400 text-sm">Your account is active. Now, let's secure your digital assets by creating your wallet.</p>
                                        </div>
                                        <div class="flex items-center justify-center gap-4 relative">
                                            <div class="flex flex-col items-center gap-2 relative z-10">
                                                <div class={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${onboardingStep() >= 1 ? 'bg-[#7e61ff] text-white shadow-[0_0_15px_rgba(126,97,255,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
                                                    <Leaf class="w-5 h-5" />
                                                </div>
                                                <span class={`text-[11px] font-bold uppercase tracking-widest ${onboardingStep() >= 1 ? 'text-white' : 'text-gray-600'}`}>Seed</span>
                                            </div>
                                            <div class={`h-[1px] w-20 transition-colors duration-500 ${onboardingStep() >= 1.5 ? 'bg-[#7e61ff]' : 'bg-gray-800'}`} />
                                            <div class="flex flex-col items-center gap-2 relative z-10">
                                                <div class={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${onboardingStep() >= 1.5 ? 'bg-[#7e61ff] text-white shadow-[0_0_15px_rgba(126,97,255,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
                                                    <CheckCircle class="w-5 h-5" />
                                                </div>
                                                <span class={`text-[11px] font-bold uppercase tracking-widest ${onboardingStep() >= 1.5 ? 'text-white' : 'text-gray-600'}`}>Confirm</span>
                                            </div>
                                            <div class={`h-[1px] w-20 transition-colors duration-500 ${onboardingStep() >= 4 ? 'bg-[#7e61ff]' : 'bg-gray-800'}`} />
                                            <div class="flex flex-col items-center gap-2 relative z-10">
                                                <div class={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${onboardingStep() >= 4 ? 'bg-[#7e61ff] text-white shadow-[0_0_15px_rgba(126,97,255,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
                                                    <Star class="w-5 h-5" />
                                                </div>
                                                <span class={`text-[11px] font-bold uppercase tracking-widest ${onboardingStep() >= 4 ? 'text-white' : 'text-gray-600'}`}>Done</span>
                                            </div>
                                        </div>
                                    </div>
                                </Show>

                                <Switch>
                                    {/* Step 0: Main Dashboard */}
                                    <Match when={onboardingStep() === 0}>
                                        <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} class="space-y-6">
                                            {/* Profile Card */}
                                            <div class="relative overflow-hidden group">
                                                <div class="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-cyan-500/20 to-purple-600/20 rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                                                <div class="relative bg-[#111113] border border-white/[0.08] rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-8">
                                                    <div class="relative">
                                                        <div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-3xl font-black text-white shadow-2xl">
                                                            {userProfile().displayName.charAt(0)}
                                                        </div>
                                                        <button class="absolute -bottom-2 -right-2 p-2 bg-blue-600 rounded-xl border-4 border-[#111113] text-white hover:scale-110 transition-transform">
                                                            <Camera class="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div class="flex-1 text-center md:text-left">
                                                        <div class="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                                                            <h2 class="text-3xl font-bold text-white">{userProfile().displayName}</h2>
                                                            <Show when={userProfile().isVerified}>
                                                                <div class="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                                    <CheckCircle class="w-3 h-3" />
                                                                    Verified Tier {userProfile().tier}
                                                                </div>
                                                            </Show>
                                                            <Show when={!userProfile().isVerified}>
                                                                <div class="flex items-center gap-1.5 px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                                    <AlertCircle class="w-3 h-3" />
                                                                    Pending Setup
                                                                </div>
                                                            </Show>
                                                        </div>
                                                        <p class="text-gray-500 max-w-md">{userProfile().bio || "No bio added yet. Vision Chain pioneer."}</p>
                                                    </div>
                                                    <Show when={!userProfile().isVerified}>
                                                        <button
                                                            onClick={() => setOnboardingStep(0.5)}
                                                            class="px-6 py-3 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
                                                        >
                                                            Setup Wallet
                                                            <ArrowRight class="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => setOnboardingStep(3)} class="ml-4 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs rounded-2xl hover:bg-red-500/20 transition-all">
                                                            [Debug] Skip
                                                        </button>
                                                    </Show>
                                                </div>
                                            </div>

                                            {/* Security & Stats */}
                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div class="bg-white/[0.02] border border-white/[0.06] rounded-[24px] p-6 space-y-4">
                                                    <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Identity & Security</h3>
                                                    <div class="space-y-3">
                                                        <div class="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl">
                                                            <div class="flex items-center gap-3">
                                                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                                                    <Lock class="w-5 h-5 text-blue-400" />
                                                                </div>
                                                                <div>
                                                                    <div class="text-sm font-bold text-white">Seed Phrase</div>
                                                                    <div class="text-[11px] text-gray-500">{userProfile().isVerified ? 'Securely Vaulted' : 'Not generated'}</div>
                                                                </div>
                                                            </div>
                                                            <Show when={userProfile().isVerified} fallback={<CheckCircle class="w-5 h-5 text-gray-700" />}>
                                                                <CheckCircle class="w-5 h-5 text-green-500" />
                                                            </Show>
                                                        </div>
                                                        <div class="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl">
                                                            <div class="flex items-center gap-3 flex-1">
                                                                <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                                    <Phone class="w-5 h-5 text-purple-400" />
                                                                </div>
                                                                <div class="flex-1">
                                                                    <div class="text-sm font-bold text-white">Phone Number</div>
                                                                    <Show when={onboardingStep() === 0}>
                                                                        <div class="flex items-center gap-2 mt-1">
                                                                            <input
                                                                                type="tel"
                                                                                value={editPhone()}
                                                                                onInput={(e) => setEditPhone(e.currentTarget.value)}
                                                                                placeholder="Add phone for VID Search"
                                                                                class="flex-1 bg-black/20 border border-white/5 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-500/50"
                                                                            />
                                                                            <button
                                                                                onClick={handleUpdatePhone}
                                                                                disabled={isSavingPhone() || editPhone() === userProfile().phone}
                                                                                class="p-1 px-2 bg-purple-600 rounded text-[10px] font-bold text-white disabled:opacity-30"
                                                                            >
                                                                                {isSavingPhone() ? '...' : 'Save'}
                                                                            </button>
                                                                        </div>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                            <Show when={userProfile().phone} fallback={<CheckCircle class="w-5 h-5 text-gray-700" />}>
                                                                <CheckCircle class="w-5 h-5 text-green-500" />
                                                            </Show>
                                                        </div>

                                                        {/* Wallet Address Card */}
                                                        <Show when={onboardingStep() > 1 || userProfile().isVerified}>
                                                            <div class="p-4 bg-white/[0.03] rounded-2xl border border-white/[0.06]">
                                                                <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 px-1">Vision Wallet Address</div>
                                                                <div class="flex items-center gap-3">
                                                                    <code class="text-white font-mono text-[12px] flex-1 truncate">{walletAddress()}</code>
                                                                    <button onClick={copyAddress} class="p-2 hover:bg-white/[0.08] rounded-lg transition-colors">
                                                                        <Show when={copied()} fallback={<Copy class="w-3 h-3 text-gray-400" />}>
                                                                            <Check class="w-3 h-3 text-green-400" />
                                                                        </Show>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </Show>
                                                    </div>
                                                </div>

                                                <div class="bg-white/[0.02] border border-white/[0.06] rounded-[24px] p-6 space-y-4">
                                                    <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Network Activity</h3>
                                                    <div class="grid grid-cols-2 gap-4">
                                                        <div class="p-4 bg-white/[0.03] rounded-2xl text-center">
                                                            <div class="text-2xl font-black text-white">0</div>
                                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">TX Sent</div>
                                                        </div>
                                                        <div class="p-4 bg-white/[0.03] rounded-2xl text-center">
                                                            <div class="text-2xl font-black text-white">100%</div>
                                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Trust Score</div>
                                                        </div>
                                                        <div class="p-4 bg-white/[0.03] rounded-2xl text-center text-cyan-400">
                                                            <div class="text-2xl font-black">Level {userProfile().tier + 1}</div>
                                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Account Tier</div>
                                                        </div>
                                                        <div class="p-4 bg-white/[0.03] rounded-2xl text-center text-purple-400">
                                                            <div class="text-2xl font-black">0d</div>
                                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Age</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 0.5: Choice Screen */}
                                    <Match when={onboardingStep() === 0.5}>
                                        <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="max-w-xl mx-auto py-12">
                                            <div class="text-center mb-10">
                                                <h2 class="text-3xl font-black text-white mb-2">Wallet Setup</h2>
                                                <p class="text-gray-400 font-medium">Choose how you want to set up your Vision ID</p>
                                            </div>

                                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <button
                                                    onClick={() => { generateSeedPhrase(); setIsRestoring(false); setOnboardingStep(1); }}
                                                    class="p-8 bg-[#0e0e12] border border-white/[0.05] rounded-[32px] text-left hover:border-blue-500/50 transition-all group relative overflow-hidden"
                                                >
                                                    <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                                        <Plus class="w-20 h-20 text-blue-400" />
                                                    </div>
                                                    <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                                        <Plus class="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <div class="text-xl font-bold text-white mb-2">Create New</div>
                                                    <p class="text-sm text-gray-500 leading-relaxed">Generate a new 15-word recovery phrase for your account.</p>
                                                </button>

                                                <button
                                                    onClick={() => setOnboardingStep(2)}
                                                    class="p-8 bg-[#0e0e12] border border-white/[0.05] rounded-[32px] text-left hover:border-cyan-500/50 transition-all group relative overflow-hidden"
                                                >
                                                    <div class="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                                        <Download class="w-20 h-20 text-cyan-400" />
                                                    </div>
                                                    <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                                        <RefreshCw class="w-6 h-6 text-cyan-400" />
                                                    </div>
                                                    <div class="text-xl font-bold text-white mb-2">Restore Wallet</div>
                                                    <p class="text-sm text-gray-500 leading-relaxed">Import an existing wallet using your 15-word phrase.</p>
                                                </button>
                                            </div>

                                            <div class="text-center mt-8">
                                                <button onClick={() => setOnboardingStep(0)} class="text-gray-500 font-bold hover:text-white transition-colors text-sm uppercase tracking-widest">Cancel</button>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 2: Restore Input */}
                                    <Match when={onboardingStep() === 2}>
                                        <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} class="max-w-xl mx-auto py-12">
                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[32px] overflow-hidden shadow-2xl">
                                                <div class="bg-gradient-to-b from-cyan-900/10 to-transparent p-10 flex flex-col items-center text-center">
                                                    <div class="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                                        <RefreshCw class="w-8 h-8 text-cyan-400" />
                                                    </div>
                                                    <h2 class="text-3xl font-black text-white mb-2">Restore Wallet</h2>
                                                    <p class="text-gray-400 font-medium">Enter your 15-word recovery phrase</p>
                                                </div>

                                                <div class="p-8 space-y-6">
                                                    <div>
                                                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 px-1">Recovery Phrase</label>
                                                        <textarea
                                                            spellcheck={false}
                                                            rows="4"
                                                            placeholder="Enter 15 words separated by spaces..."
                                                            value={restoringMnemonic()}
                                                            onInput={(e) => setRestoringMnemonic(e.currentTarget.value)}
                                                            autofocus
                                                            class="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-5 px-6 text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 transition-all font-mono text-base resize-none leading-relaxed relative z-20"
                                                        />
                                                    </div>

                                                    <div class="flex items-center gap-2 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                                        <Info class="w-4 h-4 text-blue-400 shrink-0" />
                                                        <p class="text-[12px] text-blue-300 font-medium">Ensure you have no extra spaces and all words are spelled correctly.</p>
                                                    </div>

                                                    <div class="flex gap-4">
                                                        <button
                                                            onClick={() => setOnboardingStep(0.5)}
                                                            class="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-2xl border border-white/5 hover:bg-white/10 transition-all"
                                                        >
                                                            Back
                                                        </button>
                                                        <button
                                                            onClick={handleRestoreWallet}
                                                            disabled={!restoringMnemonic().trim() || restoringMnemonic().trim().split(/\s+/).length < 15}
                                                            class="flex-[2] py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                                        >
                                                            Verify Phrase
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 1: Wallet Setup - Redesigned to match image 0 & 1 */}
                                    <Match when={onboardingStep() === 1}>
                                        <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} class="max-w-xl mx-auto">
                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl">
                                                <div class="bg-gradient-to-b from-blue-900/10 to-transparent p-10 flex flex-col items-center text-center">
                                                    <div class="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                                        <Leaf class="w-8 h-8 text-blue-400" />
                                                    </div>
                                                    <h2 class="text-3xl font-black text-white mb-2">Secret Recovery Phrase</h2>
                                                    <p class="text-gray-400 font-medium">Write down these 15 words in the exact order shown</p>
                                                </div>

                                                <div class="p-8 space-y-8">
                                                    {/* Critical Security Link Style */}
                                                    <div class="p-6 bg-red-500/5 border border-red-500/20 rounded-xl">
                                                        <div class="flex items-center gap-2 text-red-400 font-black uppercase tracking-widest text-xs mb-4">
                                                            <AlertTriangle class="w-4 h-4" />
                                                            Critical Security Information
                                                        </div>
                                                        <ul class="space-y-2 text-[13px] font-bold text-red-500/80">
                                                            <li>• Never share this phrase with anyone</li>
                                                            <li>• Store it in a secure, offline location</li>
                                                            <li>• Anyone with this phrase can access your wallet</li>
                                                            <li>• We cannot recover this phrase if lost</li>
                                                        </ul>
                                                    </div>

                                                    <div class="space-y-4">
                                                        <div class="flex items-center justify-between px-2">
                                                            <span class="text-[13px] font-bold text-gray-400">Recovery Phrase</span>
                                                            <button
                                                                onClick={() => {
                                                                    if (seedPhrase().length === 0) {
                                                                        generateSeedPhrase();
                                                                    } else {
                                                                        setShowSeed(!showSeed());
                                                                    }
                                                                }}
                                                                class="flex items-center gap-2 text-blue-400 text-[13px] font-bold hover:text-blue-300 transition-colors"
                                                            >
                                                                {showSeed() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                                                                {showSeed() ? 'Hide Phrase' : 'Show Phrase'}
                                                            </button>
                                                        </div>

                                                        <Show when={showSeed()} fallback={
                                                            <div class="p-12 bg-blue-500/5 border border-white/5 rounded-2xl flex flex-col items-center justify-center text-center gap-4 group cursor-pointer" onClick={() => { if (seedPhrase().length === 0) generateSeedPhrase(); setShowSeed(true); }}>
                                                                <Leaf class="w-8 h-8 text-blue-500/40 group-hover:text-blue-500 transition-colors" />
                                                                <div class="text-[13px] font-medium text-gray-500">
                                                                    Recovery phrase is hidden<br />
                                                                    <span class="text-blue-400/60 font-bold group-hover:text-blue-400">Click "Show Phrase" to reveal</span>
                                                                </div>
                                                            </div>
                                                        }>
                                                            <div class="grid grid-cols-3 gap-3">
                                                                <For each={seedPhrase()}>
                                                                    {(word, i) => (
                                                                        <div class="flex items-center gap-3 p-3.5 bg-white/5 text-white rounded-xl border border-white/10 font-mono text-[14px] font-bold tracking-wide">
                                                                            <span class="text-gray-500 w-4 text-left">{i() + 1}.</span>
                                                                            <span class="flex-1 text-cyan-500/90">{word}</span>
                                                                        </div>
                                                                    )}
                                                                </For>
                                                            </div>
                                                        </Show>
                                                    </div>

                                                    <Show when={showSeed()}>
                                                        <div class="flex gap-4">
                                                            <button
                                                                onClick={copySeedPhrase}
                                                                class={`flex-1 flex items-center justify-center gap-2 py-4 border rounded-2xl font-black text-sm transition-all ${copiedSeed() ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'}`}
                                                            >
                                                                <Show when={copiedSeed()} fallback={<Copy class="w-4 h-4 text-gray-400" />}>
                                                                    <Check class="w-4 h-4 text-green-400" />
                                                                </Show>
                                                                {copiedSeed() ? 'Copied!' : 'Copy Phrase'}
                                                            </button>
                                                            <button
                                                                class="flex-1 flex items-center justify-center gap-2 py-4 bg-white/5 text-white border border-white/10 rounded-2xl font-black text-sm hover:bg-white/10 transition-all hover:border-white/20"
                                                                onClick={downloadSeedPhrase}
                                                            >
                                                                <Download class="w-4 h-4 text-gray-400" />
                                                                Download
                                                            </button>
                                                        </div>
                                                    </Show>

                                                    <button
                                                        onClick={() => setOnboardingStep(1.5)}
                                                        disabled={seedPhrase().length === 0 || !showSeed()}
                                                        class="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-lg hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
                                                    >
                                                        Continue
                                                    </button>
                                                </div>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 1.5: Confirmation - Redesigned to match image 2 */}
                                    <Match when={onboardingStep() === 1.5}>
                                        <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="max-w-xl mx-auto">
                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl">
                                                <div class="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-10 flex flex-col items-center text-center">
                                                    <h2 class="text-2xl font-black text-white mb-2 uppercase tracking-tight">Confirm Recovery Phrase</h2>
                                                    <p class="text-gray-400 font-bold text-sm">Select the words in the correct order to verify your backup</p>
                                                </div>

                                                <div class="p-8 space-y-6">
                                                    <div class="flex justify-between items-end px-1">
                                                        <div class="text-[13px] font-black text-gray-500 uppercase tracking-widest">
                                                            Progress: <span class="text-white">{selectedWords().length}/{seedPhrase().length}</span>
                                                        </div>
                                                        <div class="text-[13px] font-black text-gray-500 uppercase tracking-widest">
                                                            Select word {selectedWords().length + 1}
                                                        </div>
                                                    </div>

                                                    {/* Selected Words Area - Fixed Slots Style */}
                                                    <div class="grid grid-cols-3 gap-3 p-6 bg-black/40 rounded-3xl border border-white/[0.05]">
                                                        <For each={Array.from({ length: seedPhrase().length })}>
                                                            {(_, i) => (
                                                                <div class="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl font-mono text-[13px] font-black min-h-[44px]">
                                                                    <span class="text-gray-600">{i() + 1}.</span>
                                                                    <Show when={selectedWords()[i()]}>
                                                                        <span class="text-white animate-in zoom-in-95">{selectedWords()[i()]}</span>
                                                                    </Show>
                                                                    <Show when={!selectedWords()[i()]}>
                                                                        <div class="w-10 h-[1.5px] bg-gray-700/50 mt-1" />
                                                                    </Show>
                                                                </div>
                                                            )}
                                                        </For>
                                                    </div>

                                                    <div class="flex justify-end">
                                                        <button onClick={() => setSelectedWords([])} class="text-[11px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors">Reset</button>
                                                    </div>

                                                    {/* Word Pool Area */}
                                                    <div class="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.04]">
                                                        <For each={shuffledSeed()}>
                                                            {(word) => (
                                                                <button
                                                                    onClick={() => {
                                                                        if (!selectedWords().includes(word)) {
                                                                            setSelectedWords(prev => [...prev, word]);
                                                                        }
                                                                    }}
                                                                    disabled={selectedWords().includes(word)}
                                                                    class={`p-4 rounded-xl border font-bold text-xs transition-all ${selectedWords().includes(word)
                                                                        ? 'bg-white/5 border-white/5 text-transparent select-none opacity-0'
                                                                        : 'bg-[#1a1a1e] text-gray-300 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 text-center active:scale-95'
                                                                        }`}
                                                                >
                                                                    {word}
                                                                </button>
                                                            )}
                                                        </For>
                                                    </div>

                                                    <div class="pt-6 space-y-4">
                                                        <button
                                                            onClick={() => setSelectedWords(prev => prev.slice(0, -1))}
                                                            disabled={selectedWords().length === 0}
                                                            class="w-full py-4 bg-[#444455] text-white rounded-2xl font-black text-sm hover:bg-[#555566] transition-all disabled:opacity-30"
                                                        >
                                                            Remove Last Word
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                const phrase = seedPhrase().join(' ');
                                                                const selected = selectedWords().join(' ');

                                                                if (selected === phrase) {
                                                                    // Derive address immediately
                                                                    try {
                                                                        const { address } = WalletService.deriveEOA(phrase);
                                                                        console.log("Onboarding Success - Derived Address:", address);

                                                                        // Update all possible state holders for reactivity
                                                                        setWalletAddressSignal(address);
                                                                        setUserProfile(prev => ({ ...prev, address: address }));

                                                                        // Prompt for password immediately
                                                                        setShowPasswordModal(true);
                                                                    } catch (err) {
                                                                        console.error("Failed to derive address:", err);
                                                                        alert("Error generating wallet address. Please try again.");
                                                                    }
                                                                } else {
                                                                    alert('Incorrect order. Please try again.');
                                                                    setSelectedWords([]);
                                                                }
                                                            }}
                                                            disabled={selectedWords().length !== seedPhrase().length}
                                                            class={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl ${selectedWords().length === seedPhrase().length ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 hover:scale-[1.02]' : 'bg-[#1a1a1e] text-gray-500 border border-white/5 cursor-not-allowed'}`}
                                                        >
                                                            Confirm & Create
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 2: Phone Verification - Styled to match current theme */}
                                    <Match when={onboardingStep() === 2}>
                                        <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} class="max-w-xl mx-auto">
                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl">
                                                <div class="bg-gradient-to-b from-purple-900/10 to-transparent p-10 flex flex-col items-center text-center">
                                                    <div class="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                                                        <Phone class="w-8 h-8 text-purple-400" />
                                                    </div>
                                                    <h2 class="text-3xl font-black text-white mb-2 uppercase tracking-tight">Identity Access</h2>
                                                    <p class="text-gray-400 font-medium">Verify your phone to unlock advanced features</p>
                                                </div>

                                                <div class="p-8 space-y-8">
                                                    <div class="space-y-4">
                                                        <label class="block text-[11px] font-black text-gray-500 uppercase tracking-widest px-1">Phone Number</label>
                                                        <div class="relative group">
                                                            <Phone class="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-purple-400 transition-colors" />
                                                            <input
                                                                type="tel"
                                                                placeholder="+1 (555) 000-0000"
                                                                value={userProfile().phone}
                                                                onInput={(e) => setUserProfile({ ...userProfile(), phone: e.currentTarget.value })}
                                                                class="w-full bg-white/[0.03] border border-white/[0.1] rounded-2xl py-4.5 pl-12 pr-4 text-white placeholder:text-gray-600 outline-none focus:border-purple-500/50 transition-all font-medium"
                                                            />
                                                        </div>
                                                    </div>

                                                    <Show when={verificationStep() < 2}>
                                                        <button
                                                            onClick={startVerification}
                                                            disabled={isVerifying()}
                                                            class="w-full py-5 bg-[#a855f7] text-white rounded-2xl font-black text-lg hover:bg-[#9333ea] transition-all flex items-center justify-center gap-3 shadow-xl shadow-purple-500/20 disabled:opacity-50"
                                                        >
                                                            <Show when={isVerifying()}>
                                                                <div class="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                                Sending SMS...
                                                            </Show>
                                                            <Show when={!isVerifying()}>
                                                                Verify via SMS
                                                            </Show>
                                                        </button>
                                                    </Show>

                                                    <Show when={verificationStep() === 2}>
                                                        <div class="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-4 text-green-400">
                                                            <div class="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                                                                <CheckCircle class="w-6 h-6" />
                                                            </div>
                                                            <div class="text-sm font-black uppercase tracking-widest">Verified!</div>
                                                        </div>
                                                        <button
                                                            onClick={nextOnboardingStep}
                                                            class="w-full py-5 bg-white text-black rounded-2xl font-black text-lg hover:bg-white/90 transition-all shadow-xl"
                                                        >
                                                            Continue
                                                        </button>
                                                    </Show>

                                                    <button
                                                        onClick={() => setOnboardingStep(3)}
                                                        class="w-full py-3 text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors"
                                                    >
                                                        Skip for now
                                                    </button>
                                                </div>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 3: Personal Info (Keep existing but align style) */}
                                    <Match when={onboardingStep() === 3}>
                                        <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} class="max-w-xl mx-auto space-y-8">
                                            <div class="text-center">
                                                <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-6 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                                    <User class="w-8 h-8 text-cyan-400" />
                                                </div>
                                                <h2 class="text-3xl font-black text-white mb-2 tracking-tight">Personalize Your ID</h2>
                                                <p class="text-gray-400 font-medium">Choose how you appear to others on Vision Chain.</p>
                                            </div>

                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] p-8 space-y-6 shadow-2xl">
                                                <div class="space-y-4">
                                                    <div>
                                                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 px-1">Display Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Visionary Pioneer"
                                                            value={userProfile().displayName}
                                                            onInput={(e) => setUserProfile({ ...userProfile(), displayName: e.currentTarget.value })}
                                                            class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl py-3.5 px-4 text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 transition-all font-medium"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 px-1">Short Bio</label>
                                                        <textarea
                                                            rows="3"
                                                            placeholder="Describe your vision..."
                                                            value={userProfile().bio}
                                                            onInput={(e) => setUserProfile({ ...userProfile(), bio: e.currentTarget.value })}
                                                            class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl py-3.5 px-4 text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 transition-all resize-none font-medium"
                                                        />
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setOnboardingStep(4);
                                                    }}
                                                    class="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all border border-white/10"
                                                >
                                                    Review Account
                                                </button>
                                            </div>
                                        </Motion.div>
                                    </Match>

                                    {/* Step 4: Success/Done - Match image 3 */}
                                    <Match when={onboardingStep() === 4}>
                                        <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="w-full max-w-xl mx-auto px-4 md:px-0">
                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl">
                                                <div class="bg-gradient-to-b from-green-900/20 to-transparent p-6 md:p-12 flex flex-col items-center text-center">
                                                    <div class="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                                        <Check class="w-8 h-8 text-green-400" />
                                                    </div>
                                                    <h2 class="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">Account Created</h2>
                                                    <p class="text-gray-400 font-medium text-sm md:text-base">Your Vision Chain Account has been successfully created</p>
                                                </div>

                                                <div class="p-6 md:p-8 space-y-6">
                                                    <div class="p-5 md:p-6 bg-white/[0.02] border border-white/[0.05] rounded-3xl space-y-4">
                                                        <div class="space-y-2">
                                                            <label class="text-[10px] md:text-[11px] font-black text-gray-500 uppercase tracking-widest px-1">Your Wallet Address</label>
                                                            <div class="flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-black/40 rounded-2xl border border-white/[0.05] group overflow-hidden">
                                                                <code class="flex-1 font-mono text-[10px] md:text-xs text-green-400 break-all">{walletAddress()}</code>
                                                                <button onClick={copyAddress} class="p-2 hover:bg-white/5 rounded-lg transition-all shrink-0">
                                                                    <Copy class="w-3.5 h-3.5 text-gray-500 group-hover:text-white" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div class="pt-4 border-t border-white/[0.05] space-y-3">
                                                            <div class="flex items-center justify-between text-[11px] md:text-[13px]">
                                                                <span class="font-bold text-gray-500">Wallet Details</span>
                                                            </div>
                                                            <div class="flex items-center justify-between gap-4">
                                                                <span class="text-[10px] md:text-xs text-gray-400 shrink-0">Network:</span>
                                                                <span class="text-[10px] md:text-xs font-bold text-white text-right break-words max-w-[150px] md:max-w-none">VisionChain Mainnet</span>
                                                            </div>
                                                            <div class="flex items-center justify-between gap-4">
                                                                <span class="text-[10px] md:text-xs text-gray-400 shrink-0">Type:</span>
                                                                <span class="text-[10px] md:text-xs font-bold text-white text-right">HD Wallet</span>
                                                            </div>
                                                            <div class="flex items-center justify-between gap-4">
                                                                <span class="text-[10px] md:text-xs text-gray-400 shrink-0">Created:</span>
                                                                <span class="text-[10px] md:text-xs font-bold text-white text-right">{new Date().toLocaleDateString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div class="space-y-4">
                                                        <button onClick={copyAddress} class="w-full py-4 bg-[#1e1e24] text-white border border-white/5 rounded-2xl font-black text-sm hover:bg-[#2a2a35] transition-all">
                                                            Copy Address
                                                        </button>
                                                        <button
                                                            onClick={finishOnboarding}
                                                            class="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-2xl font-black text-lg hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all border border-white/10"
                                                        >
                                                            Go to Wallet
                                                        </button>
                                                    </div>

                                                    <div class="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-2">
                                                        <div class="flex items-center gap-2 text-amber-500 font-black uppercase tracking-widest text-[10px]">
                                                            <AlertTriangle class="w-3 h-3" />
                                                            Security Reminder
                                                        </div>
                                                        <ul class="text-[11px] font-medium text-amber-500/80 space-y-1">
                                                            <li>• Your wallet is now eligible for token distribution</li>
                                                            <li>• Keep your recovery phrase and keystore file safe</li>
                                                            <li>• Never share your private keys with anyone</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </Motion.div>
                                    </Match>
                                </Switch>
                            </div>
                        </div>
                    </Show>



                    <Show when={activeView() === 'settings'}>
                        <div class="flex-1 overflow-y-auto p-4 lg:p-8">
                            <div class="max-w-4xl mx-auto">
                                <WalletSettings />
                            </div>
                        </div>
                    </Show>

                    <Show when={activeView() === 'notifications'}>
                        <div class="flex-1 overflow-y-auto p-4 lg:p-8">
                            <WalletNotifications />
                        </div>
                    </Show>

                    <Show when={activeView() === 'contacts'}>
                        <WalletContacts
                            userProfile={userProfile}
                            startFlow={setActiveFlow}
                            setRecipientAddress={setRecipientAddress}
                        />
                    </Show>

                    <Presence>
                        <Show when={isImporting()}>
                            <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    class="absolute inset-0 bg-black/80 backdrop-blur-xl"
                                />
                                <Motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    class="relative w-full max-w-md bg-[#111113] border border-white/[0.08] rounded-[32px] p-10 text-center space-y-8"
                                >
                                    <div class="relative w-24 h-24 mx-auto">
                                        <div class="absolute inset-0 bg-blue-500 rounded-full blur-2xl opacity-20 animate-pulse" />
                                        <div class="relative w-24 h-24 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin flex items-center justify-center">
                                            <Smartphone class="w-10 h-10 text-blue-400" />
                                        </div>
                                    </div>

                                    <div>
                                        <h3 class="text-2xl font-bold text-white mb-2">
                                            <Show when={importStep() === 1}>Accessing Contacts</Show>
                                            <Show when={importStep() === 2}>Matching Accounts</Show>
                                            <Show when={importStep() === 3}>Syncing Network</Show>
                                        </h3>
                                        <div class="flex justify-center gap-1.2">
                                            <For each={[1, 2, 3]}>
                                                {(step) => (
                                                    <div class={`h-1 rounded-full transition-all duration-500 ${importStep() >= step ? 'w-8 bg-blue-500' : 'w-4 bg-white/10'}`} />
                                                )}
                                            </For>
                                        </div>
                                        <p class="text-gray-500 text-sm mt-4">Vision AI is securely scanning your phone book to find Vision Chain users.</p>
                                    </div>
                                </Motion.div>
                            </div>
                        </Show>
                    </Presence>

                    {/* Interaction Modals */}
                    <Presence >
                        <Show when={activeFlow()}>
                            <div class="fixed inset-0 z-[100] flex items-center justify-center px-4 p-4">
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setActiveFlow(null)}
                                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                                />
                                <Motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    class="relative w-full max-w-lg bg-[#111113] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-2xl"
                                >
                                    <div class="p-8">
                                        <div class="flex items-center justify-between mb-8">
                                            <h3 class="text-2xl font-bold text-white flex items-center gap-3 capitalize">
                                                <Show when={activeFlow() === 'send'}><div class="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><ArrowUpRight class="w-5 h-5 text-blue-400" /></div>Send Tokens</Show>
                                                <Show when={activeFlow() === 'receive'}><div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center"><ArrowDownLeft class="w-5 h-5 text-green-400" /></div>Receive Tokens</Show>
                                                <Show when={activeFlow() === 'swap'}><div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><RefreshCw class="w-5 h-5 text-purple-400" /></div>Swap Assets</Show>
                                                <Show when={activeFlow() === 'stake'}><div class="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center"><TrendingUp class="w-5 h-5 text-indigo-400" /></div>Stake VCN</Show>
                                                <Show when={networkMode() === 'testnet'}>
                                                    <span class="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] rounded-md font-black uppercase tracking-widest">Testnet</span>
                                                </Show>
                                            </h3>
                                            <button onClick={() => setActiveFlow(null)} class="p-2 hover:bg-white/10 rounded-full transition-colors"><Plus class="w-6 h-6 text-gray-500 rotate-45" /></button>
                                        </div>
                                        <div class="space-y-6">
                                            <Show when={activeFlow() === 'stake'}>
                                                <div class="space-y-4">
                                                    <Show when={flowStep() === 1}>
                                                        <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                            <div>
                                                                <div class="flex items-center justify-between mb-2"><label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Stake Amount</label><span class="text-[10px] font-bold text-blue-400">Balance: {getAssetData('VCN').liquidBalance.toLocaleString()} VCN</span></div>
                                                                <div class="relative">
                                                                    <input type="number" placeholder="0.00" value={stakeAmount()} onInput={(e) => setStakeAmount(e.currentTarget.value)} class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-2xl font-bold text-white placeholder:text-gray-700 outline-none focus:border-blue-500/30 transition-all font-mono" />
                                                                    <div class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">VCN</div>
                                                                </div>
                                                            </div>
                                                            <div class="space-y-3">
                                                                <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block px-1">Choose Yield Tier</label>
                                                                <div class="grid grid-cols-3 gap-3">
                                                                    {[
                                                                        { d: 30, a: '4.5%', l: 'Flex' },
                                                                        { d: 90, a: '8.2%', l: 'Std' },
                                                                        { d: 180, a: '12.5%', l: 'Pro' }
                                                                    ].map((o) => (
                                                                        <button class="flex flex-col items-center gap-1 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
                                                                            <div class="text-[10px] font-black text-gray-600 uppercase mb-1">{o.l}</div>
                                                                            <div class="text-xs font-bold text-white uppercase">{o.d} Days</div>
                                                                            <div class="text-[10px] font-black text-green-400">{o.a} APY</div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            <div class="p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative overflow-hidden group">
                                                                <div class="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                <div class="flex items-center justify-between mb-1 relative z-10">
                                                                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Est. Rewards</span>
                                                                    <span class="text-lg font-bold text-green-400">
                                                                        +{stakeAmount() ? (Number(stakeAmount()) * 0.125).toFixed(2) : '0.00'} VCN
                                                                    </span>
                                                                </div>
                                                                <div class="text-[10px] text-gray-500 italic relative z-10">Rewards calculated based on Premium Tier (12.5% APY)</div>
                                                            </div>

                                                            <button
                                                                disabled={!stakeAmount() || Number(stakeAmount()) <= 0}
                                                                onClick={() => setFlowStep(2)}
                                                                class="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] uppercase tracking-widest text-sm"
                                                            >
                                                                Review Stake
                                                            </button>
                                                        </div>
                                                    </Show>
                                                    <Show when={flowStep() === 2}>
                                                        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                            <div class="flex flex-col items-center text-center py-4"><div class="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4"><TrendingUp class="w-8 h-8" /></div><h4 class="text-xl font-bold text-white">Confirm Staking</h4><p class="text-gray-500 text-sm mt-1">You are locking {stakeAmount()} VCN for 180 days</p></div>
                                                            <div class="flex gap-3"><button onClick={() => setFlowStep(1)} class="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-2xl transition-all">Back</button><button onClick={handleTransaction} disabled={flowLoading()} class="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"><Show when={flowLoading()} fallback="Confirm Stake"><RefreshCw class="w-4 h-4 animate-spin" />Staking...</Show></button></div>
                                                        </div>
                                                    </Show>
                                                    <Show when={flowStep() === 3}>
                                                        <div class="flex flex-col items-center py-8 text-center animate-in zoom-in-95 duration-500"><div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-6"><Check class="w-10 h-10 text-white" /></div><h4 class="text-2xl font-bold text-white mb-2">Staking Successful!</h4><button onClick={resetFlow} class="w-full py-4 bg-white text-black font-bold rounded-2xl">Done</button></div>
                                                    </Show>
                                                </div>
                                            </Show>

                                            <Show when={activeFlow() === 'send'}>
                                                <div class="space-y-4">
                                                    {/* Step 1: Destination and Token */}
                                                    <Show when={flowStep() === 1}>
                                                        <div class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                            <div>
                                                                <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Select Asset</label>
                                                                <div class="grid grid-cols-2 gap-2">
                                                                    <For each={['VCN']}>
                                                                        {(symbol) => (
                                                                            <div class="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/50 rounded-xl relative">
                                                                                <div class="text-xs font-bold text-white flex-1">{symbol}</div>
                                                                                <span
                                                                                    onClick={() => {
                                                                                        const max = getAssetData(selectedToken()).liquidBalance;
                                                                                        setSendAmount(max.toLocaleString()); // Format as per user request
                                                                                        fetchPortfolioData();
                                                                                    }}
                                                                                    class="text-[10px] font-black text-blue-400 uppercase tracking-widest cursor-pointer hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-lg"
                                                                                >
                                                                                    Available: {getAssetData(selectedToken()).liquidBalance.toLocaleString()} <RefreshCw class="w-3 h-3" />
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </For>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Recipient Address</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="0x..."
                                                                    value={recipientAddress()}
                                                                    onInput={(e) => setRecipientAddress(e.currentTarget.value)}
                                                                    class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/30 transition-all font-mono text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <div class="flex items-center justify-between mb-2 px-1">
                                                                    <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Amount</label>
                                                                </div>
                                                                <div class="relative">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="0.00"
                                                                        value={sendAmount()}
                                                                        onInput={(e) => {
                                                                            // Remove non-numeric chars except dot
                                                                            const raw = e.currentTarget.value.replace(/,/g, '');
                                                                            if (!isNaN(Number(raw)) || raw === '.') {
                                                                                // Add commas for display
                                                                                const parts = raw.split('.');
                                                                                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                                                setSendAmount(parts.join('.'));
                                                                            }
                                                                        }}
                                                                        class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/30 transition-all text-xl font-bold font-mono"
                                                                    />
                                                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                                                                        <span class="text-sm font-bold text-gray-400">{selectedToken()}</span>
                                                                        <div class="flex flex-col gap-px">
                                                                            <button
                                                                                onClick={() => {
                                                                                    const current = Number(sendAmount().replace(/,/g, '') || '0');
                                                                                    setSendAmount((current + 1).toLocaleString());
                                                                                }}
                                                                                class="p-0.5 text-gray-500 hover:text-blue-400 transition-colors"
                                                                            >
                                                                                <ChevronUp class="w-3 h-3" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const current = Number(sendAmount().replace(/,/g, '') || '0');
                                                                                    setSendAmount(Math.max(0, current - 1).toLocaleString());
                                                                                }}
                                                                                class="p-0.5 text-gray-500 hover:text-blue-400 transition-colors"
                                                                            >
                                                                                <ChevronDown class="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                disabled={!recipientAddress() || !sendAmount() || Number(sendAmount().replace(/,/g, '')) <= 0}
                                                                onClick={() => setFlowStep(2)}
                                                                class="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                Review Transaction
                                                            </button>
                                                        </div>
                                                    </Show>

                                                    {/* Step 2: Confirmation */}
                                                    <Show when={flowStep() === 2}>
                                                        <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                            <div class="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 text-center">
                                                                <div class="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                                                                    <Show when={isSchedulingTimeLock()} fallback="You are sending">Agent is Scheduling</Show>
                                                                </div>
                                                                <div class="text-4xl font-bold text-white mb-1">{sendAmount()} {selectedToken()}</div>
                                                                <div class="text-sm text-gray-500">≈ ${(Number(sendAmount().replace(/,/g, '')) * getAssetData(selectedToken()).price).toFixed(2)}</div>
                                                            </div>

                                                            <div class="space-y-3">
                                                                <div class="flex justify-between text-sm">
                                                                    <span class="text-gray-500">To</span>
                                                                    <span class="text-white font-mono">{recipientAddress().slice(0, 6)}...{recipientAddress().slice(-4)}</span>
                                                                </div>
                                                                <div class="flex justify-between text-sm">
                                                                    <span class="text-gray-500">Network Fee</span>
                                                                    <span class="text-green-400 font-bold">0.00021 VCN ($0.45)</span>
                                                                </div>
                                                                <div class="flex justify-between text-sm">
                                                                    <span class="text-gray-500">Estimated {isSchedulingTimeLock() ? 'Execution' : 'Time'}</span>
                                                                    <span class="text-white font-bold">
                                                                        <Show when={isSchedulingTimeLock()} fallback="~12 seconds">
                                                                            In {Math.ceil(lockDelaySeconds() / 60)} minutes (Agent Lock)
                                                                        </Show>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div class="flex gap-3">
                                                                <button
                                                                    onClick={() => setFlowStep(1)}
                                                                    class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all"
                                                                >
                                                                    Back
                                                                </button>
                                                                <button
                                                                    onClick={handleTransaction}
                                                                    disabled={flowLoading()}
                                                                    class="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2"
                                                                >
                                                                    <Show when={flowLoading()} fallback={isSchedulingTimeLock() ? "Schedule with Agent" : "Confirm & Send"}>
                                                                        <RefreshCw class="w-4 h-4 animate-spin" />
                                                                        {isSchedulingTimeLock() ? "Agent Working..." : "Sending..."}
                                                                    </Show>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Show>

                                                    {/* Step 3: Result */}
                                                    <Show when={flowStep() === 3}>
                                                        <div class="py-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                                                            <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 mb-6">
                                                                <Show when={isSchedulingTimeLock()} fallback={<Check class="w-10 h-10 text-white" />}>
                                                                    <Clock class="w-10 h-10 text-white" />
                                                                </Show>
                                                            </div>
                                                            <h4 class="text-2xl font-bold text-white mb-2">
                                                                {isSchedulingTimeLock() ? 'Agent Scheduled!' : 'Transaction Sent!'}
                                                            </h4>
                                                            <div class="mb-4 text-3xl font-black text-blue-400">
                                                                {sendAmount()} {selectedToken()}
                                                            </div>
                                                            <div class="mb-6 w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                                                                <div class="px-4 py-4 space-y-3">
                                                                    <div class="flex items-center justify-between text-xs">
                                                                        <span class="text-gray-500 font-bold uppercase tracking-wider">Time</span>
                                                                        <span class="text-gray-300 font-mono tracking-tight">{new Date().toLocaleString()}</span>
                                                                    </div>
                                                                    <div class="flex items-center justify-between text-xs">
                                                                        <span class="text-gray-500 font-bold uppercase tracking-wider">From</span>
                                                                        <span class="text-blue-400 font-mono tracking-tight">{walletAddress().slice(0, 8)}...{walletAddress().slice(-8)}</span>
                                                                    </div>
                                                                    <div class="flex items-center justify-between text-xs">
                                                                        <span class="text-gray-500 font-bold uppercase tracking-wider">To</span>
                                                                        <span class="text-blue-400 font-mono tracking-tight">{recipientAddress().slice(0, 8)}...{recipientAddress().slice(-8)}</span>
                                                                    </div>

                                                                    <div class="h-px bg-white/5 w-full my-1"></div>

                                                                    <div class="space-y-1.5 text-left">
                                                                        <div class="flex items-center justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                                            <div class="flex items-center gap-2">
                                                                                <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                                                Transaction ID
                                                                            </div>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    const success = await copyToClipboard(lastTxHash());
                                                                                    if (success) {
                                                                                        setCopied(true);
                                                                                        setTimeout(() => setCopied(false), 2000);
                                                                                    }
                                                                                }}
                                                                                class="hover:text-white text-gray-500 transition-colors flex items-center gap-1.5 group cursor-pointer"
                                                                            >
                                                                                {copied() ? 'Copied!' : 'Copy'}
                                                                                <Copy class="w-3 h-3 group-hover:scale-110 transition-transform" />
                                                                            </button>
                                                                        </div>
                                                                        <div class="text-[11px] font-mono text-gray-400 break-all leading-relaxed select-all hover:text-white transition-colors">{lastTxHash()}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <p class="text-gray-500 mb-8 max-w-xs leading-relaxed text-sm">
                                                                Your transaction has been submitted to the Vision Chain network.
                                                            </p>
                                                            <div class="w-full space-y-3">
                                                                <a
                                                                    href={`/visionscan?tx=${lastTxHash()}`}
                                                                    target="_blank"
                                                                    class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5 flex items-center justify-center decoration-none"
                                                                >
                                                                    View on Explorer
                                                                </a>
                                                                <button
                                                                    onClick={resetFlow}
                                                                    class="w-full py-4 bg-white text-black font-bold rounded-2xl transition-all hover:bg-white/90"
                                                                >
                                                                    Done
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </Show>

                                            <Show when={activeFlow() === 'receive'}>
                                                <div class="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                    <div>
                                                        <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-4 text-center">Select Network</label>
                                                        <div class="flex flex-wrap justify-center gap-2">
                                                            <For each={['Vision Chain', 'Ethereum', 'Base']}>
                                                                {(net) => (
                                                                    <button
                                                                        onClick={() => setReceiveNetwork(net)}
                                                                        class={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${receiveNetwork() === net ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'}`}
                                                                    >
                                                                        {net}
                                                                    </button>
                                                                )}
                                                            </For>
                                                        </div>
                                                    </div>

                                                    <div class="relative group">
                                                        <div class="absolute -inset-4 bg-green-500/10 rounded-[48px] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                                        <div class="relative w-64 h-64 bg-white p-6 rounded-[40px] shadow-2xl flex flex-col items-center justify-center">
                                                            <div class="relative w-full h-full p-2 bg-white rounded-2xl flex items-center justify-center">
                                                                <Show when={walletAddress()} fallback={<div class="w-full h-full bg-gray-100 animate-pulse rounded-xl" />}>
                                                                    <img
                                                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress()}&margin=10&color=000000&bgcolor=FFFFFF`}
                                                                        alt="Wallet QR Code"
                                                                        class="w-full h-full"
                                                                    />
                                                                    {/* Central Logo Overlay */}
                                                                    <div class="absolute inset-0 flex items-center justify-center">
                                                                        <div class="w-12 h-12 bg-white rounded-xl shadow-lg border border-gray-100 flex items-center justify-center p-1.5">
                                                                            <div class="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                                                                <Sparkles class="w-5 h-5 text-white" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </Show>
                                                            </div>
                                                            <div class="absolute top-4 right-4">
                                                                <div class="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div class="w-full space-y-4">
                                                        <div class="p-6 bg-white/[0.03] border border-white/[0.06] rounded-[24px] text-center group active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden" onClick={copyAddress}>
                                                            <div class="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">Your {receiveNetwork()} Address</div>
                                                            <div class="text-white font-mono break-all text-xs lg:text-sm tracking-tight leading-relaxed px-2">{walletAddress() || 'Fetching address...'}</div>
                                                        </div>
                                                        <button
                                                            onClick={copyAddress}
                                                            class="w-full py-5 bg-white text-black font-bold rounded-2xl transition-all hover:bg-white/90 active:scale-[0.98] flex items-center justify-center gap-2 shadow-xl shadow-white/5"
                                                        >
                                                            <Show when={copied()} fallback={<><Copy class="w-5 h-5" /> Copy Address</>}>
                                                                <Check class="w-5 h-5 text-green-600" /> Copied!
                                                            </Show>
                                                        </button>
                                                    </div>
                                                    <p class="text-center text-[10px] font-bold text-gray-500 max-w-[280px] uppercase tracking-wider leading-relaxed">
                                                        Only send assets supported by <span class="text-green-400">{receiveNetwork()}</span>. Other tokens will be lost.
                                                    </p>
                                                </div>
                                            </Show>

                                            <Show when={activeFlow() === 'swap'}>
                                                <div class="space-y-4">
                                                    <Show when={flowStep() === 1}>
                                                        <div class="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                                            <div class="relative">
                                                                {/* Pay Section */}
                                                                <div class="p-6 bg-white/[0.03] border border-white/[0.06] rounded-[24px]">
                                                                    <div class="flex justify-between mb-4">
                                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">You Pay</span>
                                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Balance: {getAssetData(selectedToken()).liquidBalance.toLocaleString()}</span>
                                                                    </div>
                                                                    <div class="flex items-center justify-between">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="0.0"
                                                                            value={swapAmount()}
                                                                            onInput={(e) => setSwapAmount(e.currentTarget.value)}
                                                                            class="bg-transparent border-none outline-none text-2xl font-bold text-white w-1/2 font-mono"
                                                                        />
                                                                        <div
                                                                            onClick={() => setSelectedToken(selectedToken() === 'ETH' ? 'VCN' : 'ETH')}
                                                                            class="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 cursor-pointer transition-all"
                                                                        >
                                                                            <div class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAssetData(selectedToken()).symbol === 'ETH' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                                                                                {getAssetData(selectedToken()).symbol.slice(0, 1)}
                                                                            </div>
                                                                            <span class="font-bold text-white text-sm">{selectedToken()}</span>
                                                                            <ChevronDown class="w-4 h-4 text-gray-500" />
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Switch Icon */}
                                                                <button
                                                                    onClick={() => { const tmp = selectedToken(); setSelectedToken(toToken()); setToToken(tmp); }}
                                                                    class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 z-10 w-10 h-10 rounded-xl bg-[#111113] border border-white/[0.08] flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
                                                                >
                                                                    <RefreshCw class="w-5 h-5 text-purple-400" />
                                                                </button>

                                                                {/* Receive Section */}
                                                                <div class="p-6 bg-white/[0.03] border border-white/[0.06] rounded-[24px] mt-2">
                                                                    <div class="flex justify-between mb-4">
                                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">You Receive</span>
                                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Balance: {getAssetData(toToken()).liquidBalance.toLocaleString()}</span>
                                                                    </div>
                                                                    <div class="flex items-center justify-between">
                                                                        <div class="text-2xl font-bold text-white font-mono">
                                                                            {swapAmount() ? (Number(swapAmount()) * (selectedToken() === 'ETH' ? 850 : 0.0011)).toFixed(4) : '0.0'}
                                                                        </div>
                                                                        <div
                                                                            onClick={() => setToToken(toToken() === 'USDC' ? 'VCN' : 'USDC')}
                                                                            class="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-full border border-purple-500/20 hover:bg-purple-500/20 cursor-pointer transition-all"
                                                                        >
                                                                            <div class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getAssetData(toToken()).symbol === 'VCN' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                                                                {getAssetData(toToken()).symbol.slice(0, 1)}
                                                                            </div>
                                                                            <span class="font-bold text-white text-sm">{toToken()}</span>
                                                                            <ChevronDown class="w-4 h-4 text-gray-500" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div class="px-2 py-2 flex items-center justify-between">
                                                                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Exchange Rate</span>
                                                                <span class="text-[10px] font-black text-white font-mono uppercase tracking-widest">
                                                                    1 {selectedToken()} = {selectedToken() === 'ETH' ? '850.42' : '0.0011'} {toToken()}
                                                                </span>
                                                            </div>

                                                            <button
                                                                disabled={!swapAmount() || Number(swapAmount()) <= 0}
                                                                onClick={() => setFlowStep(2)}
                                                                class="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-500/20 active:scale-[0.98]"
                                                            >
                                                                Review Swap
                                                            </button>
                                                        </div>
                                                    </Show>

                                                    {/* Step 2: Confirm Swap */}
                                                    <Show when={flowStep() === 2}>
                                                        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                            <div class="grid grid-cols-2 gap-4">
                                                                <div class="p-4 bg-white/5 rounded-2xl border border-white/5">
                                                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Selling</div>
                                                                    <div class="text-xl font-bold text-white">{swapAmount()} {selectedToken()}</div>
                                                                </div>
                                                                <div class="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 text-right">
                                                                    <div class="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Estimated Buy</div>
                                                                    <div class="text-xl font-bold text-white">
                                                                        {(Number(swapAmount()) * (selectedToken() === 'ETH' ? 850 : 0.0011)).toFixed(4)} {toToken()}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div class="space-y-3">
                                                                <div class="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                                                                    <span class="text-gray-500">Route</span>
                                                                    <span class="text-white">Vision Router → Uniswap V3</span>
                                                                </div>
                                                                <div class="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                                                                    <span class="text-gray-500">Price Impact</span>
                                                                    <span class="text-green-400 font-black">&lt;0.01%</span>
                                                                </div>
                                                                <div class="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                                                                    <span class="text-gray-500">Slippage Tolerance</span>
                                                                    <span class="text-white">0.5%</span>
                                                                </div>
                                                            </div>

                                                            <div class="flex gap-3">
                                                                <button
                                                                    onClick={() => setFlowStep(1)}
                                                                    class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all"
                                                                >
                                                                    Back
                                                                </button>
                                                                <button
                                                                    onClick={handleTransaction}
                                                                    disabled={flowLoading()}
                                                                    class="flex-[2] py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-500/25 flex items-center justify-center gap-2"
                                                                >
                                                                    <Show when={flowLoading()} fallback="Confirm Swap">
                                                                        <RefreshCw class="w-4 h-4 animate-spin" />
                                                                        Processing Swap...
                                                                    </Show>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Show>

                                                    {/* Step 3: Result */}
                                                    <Show when={flowStep() === 3}>
                                                        <div class="flex flex-col items-center py-8 text-center animate-in zoom-in-95 duration-500">
                                                            <div class="w-20 h-20 bg-purple-500 rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/30 mb-6">
                                                                <Check class="w-10 h-10 text-white" />
                                                            </div>
                                                            <h4 class="text-2xl font-bold text-white mb-2">Swap Complete!</h4>
                                                            <p class="text-gray-500 mb-8 max-w-xs leading-relaxed text-sm">
                                                                Assets have been successfully swapped and are available in your wallet.
                                                            </p>
                                                            <div class="w-full space-y-3">
                                                                <button class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/5 transition-all">
                                                                    View Transaction
                                                                </button>
                                                                <button
                                                                    onClick={resetFlow}
                                                                    class="w-full py-4 bg-white text-black font-bold rounded-2xl transition-all hover:bg-white/90"
                                                                >
                                                                    Done
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                </Motion.div>
                            </div>
                        </Show>
                    </Presence>
                    {/* Password Modal */}
                    <Portal>
                        <Presence>
                            <Show when={showPasswordModal()}>
                                <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                    <Motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
                                        onClick={() => setShowPasswordModal(false)}
                                    />
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                        class="relative w-[90vw] max-w-[420px] bg-[#27272a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl mx-auto"
                                    >
                                        <div class="p-8 space-y-6">
                                            <div class="text-center">
                                                <div class="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                                                    <Lock class="w-8 h-8 text-blue-400" />
                                                </div>
                                                <h3 class="text-2xl font-bold text-white mb-2">
                                                    {isRestoring() ? 'Finalize Restoration' : (passwordMode() === 'setup' ? 'Set Wallet Spending Password' : 'Confirm Spending Password')}
                                                </h3>
                                                <p class="text-sm text-gray-400">
                                                    {isRestoring()
                                                        ? 'Set a spending password to protect your wallet on this browser. This can be different from your old password.'
                                                        : (passwordMode() === 'setup'
                                                            ? 'This password encrypts your private key locally and is required for transactions.'
                                                            : 'Please enter your spending password to authorize this transaction.')}
                                                    <br />
                                                    <span class="text-blue-400 font-bold">It is different from your login password.</span>
                                                </p>
                                            </div>

                                            <div class="space-y-4">
                                                <div class="relative w-full">
                                                    <input
                                                        type={showWalletPassword() ? "text" : "password"}
                                                        placeholder={passwordMode() === 'setup' ? "Create spending password" : "Enter spending password"}
                                                        class="w-full bg-[#0d0d0f] border border-white/20 rounded-2xl py-4 px-14 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-center tracking-widest shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]"
                                                        value={walletPassword()}
                                                        onInput={(e) => setWalletPassword(e.currentTarget.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (passwordMode() === 'setup' ? finalizeWalletCreation() : executePendingAction())}
                                                    />
                                                    <button
                                                        onClick={() => setShowWalletPassword(!showWalletPassword())}
                                                        class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-2"
                                                    >
                                                        {showWalletPassword() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                                                    </button>
                                                    {/* Visual Balancer for Symmetry */}
                                                    <div class="absolute left-5 top-1/2 -translate-y-1/2 p-2 opacity-0 pointer-events-none">
                                                        <Eye class="w-4 h-4" />
                                                    </div>
                                                </div>

                                                <Show when={passwordMode() === 'setup' && !isRestoring()}>
                                                    <div class="relative w-full">
                                                        <input
                                                            type={showWalletPassword() ? "text" : "password"}
                                                            placeholder="Confirm spending password"
                                                            class="w-full bg-[#0d0d0f] border border-white/20 rounded-2xl py-4 px-14 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-center tracking-widest shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]"
                                                            value={confirmWalletPassword()}
                                                            onInput={(e) => setConfirmWalletPassword(e.currentTarget.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && finalizeWalletCreation()}
                                                        />
                                                        {/* Symmetry Balancers */}
                                                        <div class="absolute right-5 top-1/2 -translate-y-1/2 p-2 opacity-0">
                                                            <Eye class="w-4 h-4" />
                                                        </div>
                                                        <div class="absolute left-5 top-1/2 -translate-y-1/2 p-2 opacity-0">
                                                            <Eye class="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                </Show>

                                                <div class="flex items-center justify-center gap-2">
                                                    <ShieldCheck class="w-3.5 h-3.5 text-green-500" />
                                                    <p class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                                        Encrypted Locally. AES-256 GCM.
                                                    </p>
                                                </div>
                                            </div>

                                            <div class="flex gap-3">
                                                <button
                                                    onClick={() => setShowPasswordModal(false)}
                                                    class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => passwordMode() === 'setup' ? finalizeWalletCreation() : executePendingAction()}
                                                    disabled={!walletPassword() || isLoading() || (passwordMode() === 'setup' && !isRestoring() && !confirmWalletPassword())}
                                                    class="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Show when={isLoading()} fallback={isRestoring() ? "Restore Wallet" : (passwordMode() === 'setup' ? "Create Wallet" : "Confirm Payment")}>
                                                        <RefreshCw class="w-4 h-4 animate-spin" />
                                                        {isRestoring() ? 'Restoring...' : (passwordMode() === 'setup' ? 'Encrypting...' : 'Authorizing...')}
                                                    </Show>
                                                </button>
                                            </div>
                                        </div>
                                    </Motion.div>
                                </div>
                            </Show>

                            {/* Onboarding Success Modal */}
                            <Show when={onboardingSuccess()}>
                                <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
                                    <Motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        class="absolute inset-0 bg-black/90 backdrop-blur-md"
                                    />
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        class="relative w-full max-w-lg bg-gradient-to-b from-[#111116] to-[#0a0a0b] border border-white/10 rounded-[40px] p-10 text-center shadow-[0_0_50px_rgba(34,197,94,0.1)] overflow-hidden"
                                    >
                                        {/* Success Confetti Effect (simulated with glow) */}
                                        <div class="absolute -top-20 -left-20 w-64 h-64 bg-green-500/10 rounded-full blur-[100px]" />
                                        <div class="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px]" />

                                        <div class="relative z-10 space-y-8">
                                            <div class="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl flex items-center justify-center mx-auto rotate-12 shadow-2xl shadow-green-500/30">
                                                <Check class="w-12 h-12 text-white -rotate-12" />
                                            </div>

                                            <div class="space-y-3">
                                                <h3 class="text-4xl font-black text-white tracking-tight">Welcome to Vision Chain</h3>
                                                <p class="text-gray-400 font-medium text-lg leading-relaxed">
                                                    Your decentralized identity is ready. Your assets and nodes are now under your full control.
                                                </p>
                                            </div>

                                            <div class="p-6 bg-white/[0.03] border border-white/[0.06] rounded-3xl space-y-4 text-left">
                                                <div class="flex items-center gap-4">
                                                    <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                                        <Shield class="w-5 h-5 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <div class="text-sm font-bold text-white">Encrypted & Secure</div>
                                                        <div class="text-xs text-gray-500">Your seed phrase is locked with your password.</div>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-4">
                                                    <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                        <Zap class="w-5 h-5 text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <div class="text-sm font-bold text-white">Asset Ready</div>
                                                        <div class="text-xs text-gray-500">Your purchases have been detected and linked.</div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={finishOnboarding}
                                                class="w-full py-5 bg-white text-black font-black text-xl rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-white/10"
                                            >
                                                Go to Wallet
                                            </button>
                                        </div>
                                    </Motion.div>
                                </div>
                            </Show>
                        </Presence>
                    </Portal>
                </main>
            </section >
        </Show>
    );
};

export default Wallet;
