import { createSignal, Show, For, onMount, createEffect, Switch, Match, createMemo, onCleanup, lazy, Suspense } from 'solid-js';
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
    Bell,
    Play,
    Layers,
    UserPlus,
    History as HistoryIcon,
    Award,
    Crown,
    Crosshair,
    Trophy,
    ExternalLink
} from 'lucide-solid';
import { AI_LOCALIZATION } from '../services/ai/aiLocalization';
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
    getFirebaseDb,
    getUserContacts,
    updateScheduledTaskStatus,
    findUserByAddress,
    uploadProfileImage
} from '../services/firebaseService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { WalletService } from '../services/walletService';
import { ethers } from 'ethers';
import { initPriceService, getVcnPrice, getDailyOpeningPrice } from '../services/vcnPriceService';
import { generateText } from '../services/ai';
import { useAuth } from './auth/authContext';
import { contractService } from '../services/contractService';
import { useNavigate, useLocation, useBeforeLeave } from '@solidjs/router';
import { useTimeLockAgent } from '../hooks/useTimeLockAgent';
import { WalletSidebar } from './wallet/WalletSidebar';
import { WalletDashboard } from './wallet/WalletDashboard';
import { WalletAssets } from './wallet/WalletAssets';
import { WalletCampaign } from './wallet/WalletCampaign';
import { WalletMint } from './wallet/WalletMint';
import { WalletNodes } from './wallet/WalletNodes';
import { WalletContacts } from './wallet/WalletContacts';
import { WalletSettings } from './wallet/WalletSettings';
import { WalletNotifications } from './wallet/WalletNotifications';
import { WalletReferral } from './wallet/WalletReferral';
import { WalletActivity } from './wallet/WalletActivity';
import { WalletFlowModals } from './wallet/WalletFlowModals';
import { WalletSend } from './wallet/WalletSend';
import { WalletReceive } from './wallet/WalletReceive';
import { WalletViewHeader } from './wallet/WalletViewHeader';
import { WalletReferralDocs } from './wallet/WalletReferralDocs';

import { VisionLogo } from './wallet/VisionLogo';
import { VisionFullLogo } from './wallet/VisionFullLogo';



type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 'settings' | 'contacts' | 'nodes' | 'notifications' | 'referral' | 'history' | 'quest' | 'send' | 'receive' | 'referral-rules';

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

const AiChatIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" class={props.class} xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM12 6L13.5 9.5L17 11L13.5 12.5L12 16L10.5 12.5L7 11L10.5 9.5L12 6Z" />
    </svg>
);

const Wallet = (): JSX.Element => {
    const navigate = useNavigate();
    const auth = useAuth();
    // State Declarations
    const location = useLocation();

    // Replaced Signal with Derived State from URL
    const activeView = () => {
        const path = location.pathname.split('/');
        // default to 'assets' if no sub-route provided
        return (path[2] as ViewType) || 'assets';
    };
    const [networkMode, setNetworkMode] = createSignal<'mainnet' | 'testnet'>('testnet');
    const [selectedToken, setSelectedToken] = createSignal('VCN');
    const [toToken, setToToken] = createSignal('USDT');
    const [receiveNetwork, setReceiveNetwork] = createSignal('Ethereum');
    const [sendAmount, setSendAmount] = createSignal('');
    const [swapAmount, setSwapAmount] = createSignal('');
    const [recipientAddress, setRecipientAddress] = createSignal('');
    const [stakeAmount, setStakeAmount] = createSignal('');
    const [sendMode, setSendMode] = createSignal<'single' | 'batch'>('single');
    const [batchInput, setBatchInput] = createSignal('');

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = createSignal<any>(null);
    const [isIOS, setIsIOS] = createSignal(false);
    const [showIOSInstallModal, setShowIOSInstallModal] = createSignal(false);

    onMount(() => {
        // Check for iOS
        const isDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isDeviceIOS);

        // Listen for install prompt (Android/Desktop)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });
    });

    const handleInstallClick = async () => {
        if (isIOS()) {
            setShowIOSInstallModal(true);
        } else if (deferredPrompt()) {
            deferredPrompt().prompt();
            const { outcome } = await deferredPrompt().userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        }
    };

    // Batch Parsing Logic
    const parsedBatchTransactions = createMemo(() => {
        if (!batchInput().trim()) return [];
        return batchInput().split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Support Comma or Tab separated
                const parts = line.split(/[,\t]+/).map(p => p.trim());
                let recipient = '';
                let amount = '';
                let name = '';

                // Strategy: Find Address (0x...)
                const addrIdx = parts.findIndex(p => p.startsWith('0x') && p.length === 42);

                if (addrIdx !== -1) {
                    recipient = parts[addrIdx];
                    // Look for amount (first number that isn't the address)
                    const amtPart = parts.find((p, i) => i !== addrIdx && !isNaN(parseFloat(p.replace(/,/g, ''))));
                    if (amtPart) amount = amtPart.replace(/,/g, '');

                    // Name is whatever is left (first non-addr, non-amt part)
                    const namePart = parts.find((p, i) => i !== addrIdx && p.replace(/,/g, '') !== amount);
                    if (namePart) name = namePart;
                } else {
                    // No address found, try to find amount and name
                    const amtPart = parts.find(p => !isNaN(parseFloat(p.replace(/,/g, ''))));
                    if (amtPart) amount = amtPart.replace(/,/g, '');
                    const namePart = parts.find(p => p !== amtPart && p.trim().length > 0);
                    if (namePart) name = namePart;
                }

                if (!recipient && !name) return null;

                return {
                    recipient: recipient || '',
                    amount: amount || '0',
                    name: name || 'Unknown',
                    symbol: 'VCN'
                };
            })
            .filter((tx): tx is { recipient: string, amount: string, name: string, symbol: string } => tx !== null);
    });

    const handleBatchTransaction = () => {
        const txs = parsedBatchTransactions();
        if (txs.length === 0) return;

        setPendingAction({
            type: 'multi_transactions',
            data: {
                transactions: txs.map(tx => ({
                    recipient: tx.recipient,
                    amount: tx.amount,
                    symbol: tx.symbol,
                    intent: 'send',
                    description: `Batch transfer to ${tx.name}`
                }))
            }
        });
        setPasswordMode('verify');
        setShowPasswordModal(true);
    };

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
        role: 'user',
        referralCode: '',
        referrerId: '',
        referralCount: 0,
        totalRewardsVCN: 0,
        totalRewardsUSD: 0,
        photoURL: auth.user()?.photoURL || ''
    });
    // Profile Image & Crop State
    const [imageToCrop, setImageToCrop] = createSignal<string | null>(null);
    const [isCropping, setIsCropping] = createSignal(false);
    const [isUploadingImage, setIsUploadingImage] = createSignal(false);
    let fileInputRef: HTMLInputElement | undefined;
    let cropCanvasRef: HTMLCanvasElement | undefined;
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
    const [showLogoutConfirm, setShowLogoutConfirm] = createSignal(false);
    const [pendingLogout, setPendingLogout] = createSignal<(() => void) | null>(null);

    // Prompt before leaving the wallet entirely
    useBeforeLeave((e: any) => {
        // e.to might be a string (path) or an object with pathname
        const destination = e.to;
        const path = typeof destination === 'string'
            ? destination
            : (typeof destination === 'object' && destination !== null && 'pathname' in destination ? destination.pathname : '');

        // If we are navigating to a path that does NOT start with /wallet
        // AND we are logged in (onboardingStep === 0 or userProfile exists)
        // AND we haven't already confirmed the logout
        if (typeof path === 'string' && !path.startsWith('/wallet') && onboardingStep() === 0 && !e.defaultPrevented && !e.options?.ignore) {
            e.preventDefault();
            setShowLogoutConfirm(true);
            setPendingLogout(() => () => {
                e.retry(true); // Retry with force/ignore
            });
        }
    });

    const confirmLogout = async () => {
        setShowLogoutConfirm(false);
        await auth.logout();
        window.location.href = 'https://www.visionchain.co';
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
        setPendingLogout(null);
    };

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
    const [multiTransactions, setMultiTransactions] = createSignal<any[]>([]);
    const [unreadNotificationsCount, setUnreadNotificationsCount] = createSignal(0);
    const [chatHistoryOpen, setChatHistoryOpen] = createSignal(true);

    // --- Enterprise Bulk Transfer Agent State ---
    const [batchAgents, setBatchAgents] = createSignal<any[]>([]);
    const [reviewMulti, setReviewMulti] = createSignal<any[] | null>(null);

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
            // Local state is enough (QueueDrawer handles its own isCancelling)
            await cancelScheduledTask(taskId);
            alert('Task cancelled successfully.');
        } catch (e) {
            console.error("Cancel failed:", e);
            alert('Failed to cancel task. Please try again.');
        }
    };

    // --- Client-side Scheduler for Time-lock Agent (Extracted to Hook) ---
    const { handleForceExecute } = useTimeLockAgent(() => userProfile().email, queueTasks);

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
    const [touchStartX, setTouchStartX] = createSignal(0);
    const [input, setInput] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
    const [lastLocale, setLastLocale] = createSignal<string>('en');
    const detectLanguage = (text: string): string => {
        // Simple heuristic for demo; in production use a library or AI-based detection
        if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) return 'ko';
        if (/[ぁ-んァ-ヶ]/.test(text)) return 'ja';
        if (/[一-龠]/.test(text)) return 'zh'; // Simplified for CJK
        return 'en';
    };

    const [chatHistory, setChatHistory] = createSignal<AiConversation[]>([]);
    const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(null);

    // --- Advanced AI Features (Synced with Global AI) ---
    const [attachments, setAttachments] = createSignal<any[]>([]);
    const [thinkingSteps, setThinkingSteps] = createSignal<any[]>([]);
    const [voiceLang, setVoiceLang] = createSignal('en-US');

    const handleFileChange = (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImageToCrop(event.target?.result as string);
                setIsCropping(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUploadCrop = async () => {
        if (!imageToCrop() || !auth.user()?.email) return;
        setIsUploadingImage(true);
        try {
            const canvas = cropCanvasRef!;
            const ctx = canvas.getContext('2d')!;
            const img = new Image();
            img.src = imageToCrop()!;
            await new Promise((resolve) => img.onload = resolve);

            // Simple square crop from center
            const size = Math.min(img.width, img.height);
            const startX = (img.width - size) / 2;
            const startY = (img.height - size) / 2;

            canvas.width = 512;
            canvas.height = 512;
            ctx.drawImage(img, startX, startY, size, size, 0, 0, 512, 512);

            const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9));
            const url = await uploadProfileImage(auth.user().email, blob);

            setUserProfile(prev => ({ ...prev, photoURL: url }));
            setIsCropping(false);
            setImageToCrop(null);
            if (fileInputRef) fileInputRef.value = '';
        } catch (err) {
            console.error("Upload failed", err);
            alert("Image upload failed. Please try again.");
        } finally {
            setIsUploadingImage(false);
        }
    };
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
        navigate('/wallet/chat');
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([{ role: 'assistant', content: 'Hello. I am the Vision Chain AI Architect. I can help you transfer assets, bridge tokens, or optimize your portfolio.' }]);
        navigate('/wallet/chat');
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

    // Reset flow step when active flow changes
    createEffect(() => {
        if (activeFlow()) {
            setFlowStep(1);
            // If switching to 'multi', set mode to batch automatically? 
            // Or just keep the modal state clean.
            if (activeFlow() === 'send') {
                // Keep user preference or reset? Resetting is safer.
                // setSendMode('single'); 
            }
        }
    });

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
            navigate('/wallet/profile');
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

                // 5. Trigger Referral Rewards
                const vcnAmount = nodeType === 'Enterprise' ? 500000 : 70000;
                import('../services/firebaseService').then(m => {
                    m.processReferralRewards('token_sale', userProfile().email, vcnAmount, 'VCN', receipt.hash);
                });
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
                    const { receipt, scheduleId } = await contractService.scheduleTransferNative(recipient, amount, lockDelaySeconds());
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
                        scheduleId: scheduleId,
                        status: 'WAITING'
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
                } catch (notiErr) {
                    console.warn("Notification failed:", notiErr);
                }

            } else if (action.type === 'multi_transactions') {
                const { transactions } = action.data;
                setFlowLoading(true);
                setFlowStep(1); // Ensure we show processing UI
                // 1. Initialize Batch Agent
                const agentId = Math.random().toString(36).substring(7);
                const newAgent = {
                    id: agentId,
                    status: 'EXECUTING',
                    totalCount: transactions.length,
                    successCount: 0,
                    failedCount: 0,
                    startTime: Date.now(),
                    transactions: transactions.map((tx: any) => ({ ...tx, status: 'PENDING' }))
                };
                setBatchAgents(prev => [...prev, newAgent]);

                // 2. Decrypt Mnemonic for all transactions
                setLoadingMessage('AGENT: DECRYPTING VAULT...');
                const encrypted = WalletService.getEncryptedWallet(userProfile().email);
                if (!encrypted) throw new Error("Wallet not found");
                const mnemonic = await WalletService.decrypt(encrypted, walletPassword());
                const { privateKey } = WalletService.deriveEOA(mnemonic);
                await contractService.connectInternalWallet(privateKey);

                const finalResults = [];
                for (let i = 0; i < transactions.length; i++) {
                    const tx = transactions[i];
                    setLoadingMessage(`AGENT: PROCESSING ${i + 1}/${transactions.length}...`);

                    try {
                        let receipt;
                        const symbol = tx.symbol || 'VCN';

                        if (tx.intent === 'send') {
                            if (symbol === 'VCN') {
                                try {
                                    // Try gasless first for VCN in batch
                                    const result = await contractService.sendGaslessTokens(tx.recipient, tx.amount);
                                    receipt = { hash: result.txHashes?.transfer || result.txHashes?.permit || '0x...' };
                                } catch (gcError) {
                                    console.warn("Batch gasless failed, trying standard...", gcError);
                                    receipt = await contractService.sendTokens(tx.recipient, tx.amount, symbol);
                                }
                            } else {
                                receipt = await contractService.sendTokens(tx.recipient, tx.amount, symbol);
                            }
                        } else if (tx.intent === 'schedule') {
                            const delay = tx.executeAt ? Math.max(60, Math.floor((tx.executeAt - Date.now()) / 1000)) : 300;
                            const scheduleRes = await contractService.scheduleTransferNative(tx.recipient, tx.amount, delay);
                            receipt = scheduleRes.receipt;
                            await saveScheduledTransfer({
                                userEmail: userProfile().email,
                                recipient: tx.recipient,
                                amount: tx.amount,
                                token: tx.symbol || 'VCN',
                                unlockTime: Math.floor(Date.now() / 1000) + delay,
                                creationTx: receipt.hash,
                                scheduleId: scheduleRes.scheduleId,
                                status: 'WAITING'
                            });
                        }

                        finalResults.push({ success: true, hash: receipt?.hash, tx });
                        setBatchAgents(prev => prev.map(a => a.id === agentId ? { ...a, successCount: a.successCount + 1 } : a));
                    } catch (err: any) {
                        console.error("Batch item failed:", err);
                        finalResults.push({ success: false, error: err.message || "Unknown error", tx });
                        setBatchAgents(prev => prev.map(a => a.id === agentId ? { ...a, failedCount: a.failedCount + 1 } : a));
                    }

                    // 3 second interval between transactions (except the last one)
                    if (i < transactions.length - 1) {
                        setLoadingMessage(`AGENT: WAITING 3S INTERVAL (${i + 1}/${transactions.length})...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    }
                }

                // 3. Finalize
                setFlowSuccess(true);
                setFlowStep(3);
                setFlowLoading(false);
                setBatchAgents(prev => prev.map(a => a.id === agentId ? { ...a, status: 'SENT' } : a));

                // 4. Generate Report
                const successMsg = finalResults.filter(r => r.success).length;
                const failMsg = finalResults.filter(r => !r.success).length;

                // 4. Generate Final Accounting Report CSV
                let accountingCsv = "Date,BatchID,Intent,VID,Recipient,Amount,Symbol,Status,TxHash,Error\n";
                const timestamp = new Date().toISOString();
                finalResults.forEach(r => {
                    accountingCsv += `${timestamp},${agentId},${r.tx.intent},${r.tx.vid || ''},${r.tx.recipient},${r.tx.amount},${r.tx.symbol || 'VCN'},${r.success ? 'SUCCESS' : 'FAILED'},${r.hash || ''},"${r.error || ''}"\n`;
                });
                const accountingUri = `data:text/csv;charset=utf-8,${encodeURIComponent(accountingCsv)}`;

                let report = lastLocale() === 'ko'
                    ? `### 📊 최종 전송 결과 보고서 (Batch ID: ${agentId})\n\n`
                    : `### 📊 Final Execution Report (Batch ID: ${agentId})\n\n`;

                report += lastLocale() === 'ko'
                    ? `- **기업 재무용 레포트**: [📥 전송결과_회계보고서_${agentId}.csv 다운로드](${accountingUri})\n`
                    : `- **Accounting Report**: [📥 Execution_Report_${agentId}.csv Download](${accountingUri})\n`;

                report += lastLocale() === 'ko'
                    ? `- **총 요청 건수**: ${transactions.length}건\n- **성공**: ${successMsg}건\n- **실패**: ${failMsg}건\n\n`
                    : `- **Total Requests**: ${transactions.length}\n- **Success**: ${successMsg}\n- **Failed**: ${failMsg}\n\n`;

                if (failMsg > 0) {
                    const failedTXs = finalResults.filter(r => !r.success);
                    report += lastLocale() === 'ko'
                        ? `⚠️ **실패 내역 조치**\n일부 전송이 실패했습니다. 아래의 복구용 CSV를 다운로드하여 사유 확인 후 다시 시도해 주세요.\n`
                        : `⚠️ **Action Required**\nSome transactions failed. Download the remediation CSV to review reasons and retry.\n`;

                    let failCsv = "VID,Recipient,Amount,Symbol,Error\n";
                    failedTXs.forEach(f => {
                        failCsv += `${f.tx.vid || 'N/A'},${f.tx.recipient},${f.tx.amount},${f.tx.symbol || 'VCN'},"${f.error}"\n`;
                    });
                    const failUri = `data:text/csv;charset=utf-8,${encodeURIComponent(failCsv)}`;
                    report += lastLocale() === 'ko'
                        ? `\n[📥 실패 리스트_복구용.csv 다운로드](${failUri})\n\n`
                        : `\n[📥 Remediation_List.csv Download](${failUri})\n\n`;
                }

                setMessages(prev => [...prev, { role: 'assistant', content: report }]);

                // 5. Remove from Queue with delay
                setTimeout(() => {
                    setBatchAgents(prev => prev.filter(a => a.id !== agentId));
                }, 5000);

                setTimeout(fetchPortfolioData, 1000);

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

    createEffect(async () => {
        const email = auth.user()?.email;
        if (email) {
            try {
                const data = await getUserContacts(email);
                setContacts(data);
            } catch (e) {
                console.warn("Failed to pre-load contacts", e);
            }
        }
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
                    role: data.role || 'user',
                    referralCode: data.referralCode || '',
                    referrerId: data.referrerId || '',
                    referralCount: data.referralCount || 0,
                    totalRewardsVCN: data.totalRewardsVCN || 0,
                    totalRewardsUSD: data.totalRewardsUSD || 0,
                    photoURL: data.photoURL || user.photoURL || ''
                });

                // Check if wallet exists in backend OR locally
                const hasBackendWallet = !!data.walletAddress;
                // Try to get address from local storage if not in profile (SCOPED)
                const localAddress = WalletService.getAddressHint(user.email);
                const hasLocalWallet = WalletService.hasWallet(user.email);
                setIsLocalWalletMissing(hasBackendWallet && !hasLocalWallet);

                if (hasBackendWallet || hasLocalWallet) {
                    const finalAddress = data.walletAddress || localAddress || '';
                    console.log(`[Profile] Loading address for ${user.email}:`, finalAddress);
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
                    navigate('/wallet/profile');
                }
            } else {
                // No profile data found in database, but maybe user exists in Auth
                const localAddress = WalletService.getAddressHint(user.email);
                if (WalletService.hasWallet(user.email)) {
                    setWalletAddressSignal(localAddress || '');
                    setOnboardingStep(0);
                    setUserProfile(prev => ({ ...prev, isVerified: true, address: localAddress || '' }));
                } else {
                    setOnboardingStep(1);
                    navigate('/wallet/profile');
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
            navigate('/wallet/profile');
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
                    role: freshData.role || 'user',
                    referralCode: freshData.referralCode || '',
                    referrerId: freshData.referrerId || '',
                    referralCount: freshData.referralCount || 0,
                    totalRewardsVCN: freshData.totalRewardsVCN || 0,
                    totalRewardsUSD: freshData.totalRewardsUSD || 0,
                    photoURL: freshData.photoURL || ''
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

    const startFlow = (flow: 'send' | 'receive' | 'swap' | 'stake' | 'bridge' | 'multi') => {
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
        } else if (activeFlow() === 'multi') {
            setPasswordMode('verify');
            setPendingAction({
                type: 'multi_transactions',
                data: { transactions: multiTransactions() }
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

    const [quizIndices, setQuizIndices] = createSignal<number[]>([]);
    const [quizAnswers, setQuizAnswers] = createSignal<Record<number, string>>({});

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

            // Prepare Quiz Indices (3 random words)
            const indices = new Set<number>();
            while (indices.size < 3) indices.add(Math.floor(Math.random() * 15));
            setQuizIndices(Array.from(indices).sort((a, b) => a - b));
            setQuizAnswers({});

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
            console.log("[Wallet] Deriving address for finalization...");

            if (!WalletService.validateMnemonic(mnemonic)) {
                console.error("[Wallet] INVALID MNEMONIC DETECTED");
                throw new Error("Invalid mnemonic during finalization");
            }
            const { address } = WalletService.deriveEOA(mnemonic);
            console.log("[Wallet] NEW ADDRESS DERIVED:", address);

            // 2. Encrypt and Save 
            const encrypted = await WalletService.encrypt(mnemonic, walletPassword());
            WalletService.saveEncryptedWallet(encrypted, userProfile().email);
            // Save address unencrypted for UI consistency (SCOPED)
            WalletService.saveAddressHint(address, userProfile().email);

            // 3. Update Backend Status
            const user = auth.user();
            if (user && user.email) {
                console.log("[Wallet] Syncing new address to Firebase...");
                await updateWalletStatus(user.email, address, true);
            }

            // 4. Update User State & Signals
            setWalletAddressSignal(address); // Force update the signal
            setUserProfile(prev => ({
                ...prev,
                isVerified: true,
                tier: 1,
                address: address
            }));
            console.log("[Wallet] Local state updated with new address.");

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
        navigate('/wallet/assets');
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

            const newAttachment: any = {
                file,
                preview: e.target?.result as string,
                type
            };

            if (type === 'excel' && file.name.endsWith('.csv')) {
                const textReader = new FileReader();
                textReader.onload = (te) => {
                    newAttachment.csvData = te.target?.result as string;
                    setAttachments(prev => [...prev, newAttachment]);
                };
                textReader.readAsText(file);
            } else {
                setAttachments(prev => [...prev, newAttachment]);
            }
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

    const handleStopChat = () => {
        if (!chatLoading()) return;
        setChatLoading(false);
        setThinkingSteps([{ id: 'stop', label: 'Stopped', status: 'error', detail: 'Generation cancelled by user.' }]);
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: "Generation stopped by user request."
        }]);
    };

    const handleSend = async () => {
        if (!input().trim() || chatLoading()) return;

        const userMessage = input().trim();
        setLastLocale(detectLanguage(userMessage));
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setChatLoading(true);
        const currentLang = lastLocale();
        const config = AI_LOCALIZATION[currentLang] || AI_LOCALIZATION['en'];
        const getLabel = (step: '1' | '2' | '3') => {
            const labels: Record<string, any> = {
                'ko': { '1': '의도 분석 중...', '2': '포트폴리오 분석 및 시뮬레이션...', '3': '응답 생성 완료' },
                'ja': { '1': '意図を分析中...', '2': 'ポートフォリオ分析とシュミレーション...', '3': '回答の生成完了' },
                'en': { '1': 'Analyzing Intent...', '2': 'Comparing Portfolio & Simulating...', '3': 'Response Generated' }
            };
            return (labels[currentLang] || labels['en'])[step];
        };

        setThinkingSteps([
            { id: '1', label: getLabel('1'), status: 'loading' }
        ]);

        try {
            // Multimodal Support: Grab image if attached
            const imageAttachment = attachments().find(a => a.type === 'image');
            const imageBase64 = imageAttachment?.preview?.split(',')[1];

            // Ensure contacts are loaded before generating context
            let activeContacts = contacts();
            if (activeContacts.length === 0 && userProfile().email) {
                // Quick fetch backup if state is empty (rare but possible on refresh)
                try {
                    const loaded = await getUserContacts(userProfile().email);
                    setContacts(loaded);
                    activeContacts = loaded;
                } catch (e) { console.warn("Background contact fetch failed", e); }
            }

            // Construct context from wallet state with ENFORCED Contact List
            const context = `
[Live Context]
Network: ${networkMode().toUpperCase()}
Wallet Address: ${walletAddress()}
Total Value: ${totalValueStr()}

[ADDRESS BOOK - PRIMARY SOURCE OF TRUTH]
(You MUST check this list first. If the name matches precisely or partially, use the address below.)
${activeContacts.length > 0
                    ? activeContacts.map((c: any) => `- Name: "${c.internalName}"${c.alias ? `, Alias: "${c.alias}"` : ''} -> Address: ${c.address} ${c.vchainUserUid ? `(@${c.vchainUserUid})` : ''}`).join('\n')
                    : '(Address book is currently empty. Ask user for address.)'}

Holdings:
${tokens().map((t: any) => `- ${t.symbol}: ${t.balance} (${t.value})`).join('\n')}
`;

            // Excel/CSV Context
            const excelAttachment = attachments().find(a => a.type === 'excel' && a.csvData);
            const csvContext = excelAttachment ? `\n[ATTACHED CSV DATA]\n${excelAttachment.csvData}\n` : '';

            // The systemic rules (Prompt Tuning) are now managed in the Admin Dashboard.
            const fullPrompt = `
${context}
${csvContext}

[User Request]
"${userMessage}"

Identify the intent and provide a friendly response following the established architect persona. 
IF the recipient is found in the [ADDRESS BOOK] above, auto-resolve the address and proceed to confirmation.

[CRITICAL: ACTION FORMAT]
If the user wants to execute a transaction (Send, Swap, Schedule, etc.), you MUST append a JSON block to the end of your response.
Format:
\`\`\`json
{
  "intent": "send" | "swap" | "schedule" | "stake" | "bridge",
  "recipient": "0x..." (or name if not resolved),
  "amount": "100",
  "symbol": "VCN",
  "executeAt": "ISO_TIMESTAMP" (for schedule only)
}
\`\`\`
`;

            setThinkingSteps(prev => [
                ...prev.map(s => ({ ...s, status: 'completed' as const })),
                { id: '2', label: 'Processing Request...', status: 'loading' }
            ]);

            let response = await generateText(fullPrompt, imageBase64, 'intent', userProfile().email, messages());

            // --- State-of-the-Art Thinking Process Parsing ---
            const thoughtRegex = /<think>([\s\S]*?)<\/think>/g;
            const parsedSteps: any[] = [];
            let match;
            let hasTags = false;

            // 1. Try Tag-based parsing first (Preferred)
            while ((match = thoughtRegex.exec(response)) !== null) {
                hasTags = true;
                const content = match[1];
                const parts = content.split(':');
                parsedSteps.push({
                    id: crypto.randomUUID(),
                    label: parts[0]?.trim() || 'Thinking Process',
                    detail: parts[1]?.trim() || '',
                    status: 'completed'
                });
            }

            // 2. Fallback: If no tags, try to parse markdown steps (e.g. **Step 1: ...**)
            if (!hasTags) {
                // Clean up the response first to avoid duplication
                let cleanResponse = response;

                // Regex to catch **Step 1: ...** blocks
                const stepMatches = [...response.matchAll(/\*\*Step (\d+).*?[-:](.*?)\*\*(.*?)(?=\*\*Step|$)/gs)];
                if (stepMatches.length > 0) {
                    stepMatches.forEach(m => {
                        parsedSteps.push({
                            id: crypto.randomUUID(),
                            label: `Step ${m[1]}: ${m[2]?.trim()}`,
                            detail: m[3]?.trim().slice(0, 100) + '...', // Truncate detail
                            status: 'completed'
                        });
                        // Remove this part from the final response
                        cleanResponse = cleanResponse.replace(m[0], '');
                    });
                    response = cleanResponse; // Update response to show only the final parts
                }
            }

            if (parsedSteps.length > 0) {
                setThinkingSteps(parsedSteps);
                setTimeout(() => setThinkingSteps([]), 8000);
            }

            // Clean tags again just in case
            response = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            response = response.replace(/^\s*[-—]+\s*$/gm, '').trim();


            // 1. Check for Intent JSON
            let intentData: any = null;

            // STRATEGY A: Check for Markdown Code Blocks first (Highest Reliability)
            const codeBlockMatch = response.match(/```json([\s\S]*?)```/);
            if (codeBlockMatch) {
                let jsonStr = codeBlockMatch[1].trim();
                // Fix common AI JSON errors
                if (jsonStr.startsWith(',')) jsonStr = jsonStr.substring(1).trim(); // Remove leading comma

                try {
                    // Try parsing as is
                    intentData = JSON.parse(jsonStr);
                } catch (e) {
                    // Try wrapping in array if it looks like a list of objects e.g. {..}, {..}
                    try {
                        intentData = JSON.parse(`[${jsonStr}]`);
                    } catch (e2) {
                        console.warn("[AI] JSON Parse Failed in Code Block", e2);
                    }
                }

                // If processed successfully, check if valid intent or transaction list
                if (Array.isArray(intentData)) {
                    // Auto-convert array to 'multi' intent
                    intentData = {
                        intent: 'multi',
                        transactions: intentData,
                        description: "Batch Transfer"
                    };
                }
            }

            // STRATEGY B: Regex fallback if no code block found (Backward Compatibility)
            if (!intentData) {
                // Advanced Intent Discovery: Try to find "multi" intent first (Priority)
                const multiMatch = response.match(/\{[\s\S]*?"intent"\s*:\s*"multi"[\s\S]*?\}/);
                const genericMatches = response.match(/\{[\s\S]*?"intent"[\s\S]*?\}/g);

                if (multiMatch) {
                    try {
                        intentData = JSON.parse(multiMatch[0]);
                    } catch (e) {
                        console.warn("Multi Intent Parse Failed", e);
                    }
                } else if (genericMatches && genericMatches.length > 1) {
                    // HEURISTIC: If AI outputted multiple individual JSONs, wrap them into a 'multi' intent automatically
                    console.log("[AI] Auto-wrapping multiple intents into 'multi'");
                    const wrappedTransactions = genericMatches.map(str => {
                        try { return JSON.parse(str); } catch { return null; }
                    }).filter(Boolean);

                    if (wrappedTransactions.length > 0) {
                        intentData = {
                            intent: 'multi',
                            transactions: wrappedTransactions,
                            description: "Consolidated Batch Transfer"
                        };
                    }
                } else if (genericMatches && genericMatches.length === 1) {
                    try {
                        intentData = JSON.parse(genericMatches[0]);
                    } catch (e) {
                        console.warn("Single Intent Parse Failed", e);
                    }
                }
            }

            console.log("[AI Intent Data]", intentData);

            // 2. Trigger Wallet Flow if intent detected
            if (intentData) {
                // Name Resolution Step (VNS)
                if (intentData.recipient && typeof intentData.recipient === 'string' && !intentData.recipient.startsWith('0x')) {
                    const resolved = await resolveRecipient(intentData.recipient, userProfile().email);
                    if (resolved && resolved.address) {
                        intentData.recipient = resolved.address;
                    } else {
                        console.warn(`[AI] Could not resolve name: ${intentData.recipient}`);
                        // Even if not resolved, allow flow to start so user can fix it
                    }
                }

                if (intentData.intent === 'send') {
                    console.log("Starting Send Flow with:", intentData);

                    // AUTO-DETECT BATCH MODE: If recipient or amount is an array, or if recipient string contains commas/newlines
                    const rawRecipient = String(intentData.recipient || '');
                    const isMulti = Array.isArray(intentData.recipient) ||
                        Array.isArray(intentData.amount) ||
                        Array.isArray(intentData.transactions) ||
                        rawRecipient.includes(',') ||
                        rawRecipient.includes('\n');

                    if (isMulti) {
                        console.log("[AI] Multi-recipient detected in 'send' intent. Switching to batch mode.");
                        let batchStr = "";
                        if (intentData.transactions) {
                            batchStr = intentData.transactions.map((tx: any) => `${tx.name || ''}, ${tx.recipient || ''}, ${tx.amount || ''}`).join('\n');
                        } else if (Array.isArray(intentData.recipient)) {
                            batchStr = intentData.recipient.map((r: any, i: number) => {
                                const amt = Array.isArray(intentData.amount) ? intentData.amount[i] : intentData.amount;
                                return `, ${r}, ${amt || ''}`;
                            }).join('\n');
                        } else if (rawRecipient.includes(',') || rawRecipient.includes('\n')) {
                            const addresses = rawRecipient.split(/[,\n]/).map(a => a.trim()).filter(Boolean);
                            batchStr = addresses.map(a => `, ${a}, ${intentData.amount || ''}`).join('\n');
                        }

                        if (batchStr) {
                            setBatchInput(batchStr);
                            setActiveFlow('batch_send');
                            setChatLoading(false);
                            return;
                        }
                    }

                    setRecipientAddress(String(intentData.recipient || ''));
                    // Sanitize amount - remove any non-numeric chars except dot
                    const cleanAmount = (intentData.amount || '').toString().replace(/[^0-9.]/g, '');
                    setSendAmount(cleanAmount);
                    setSelectedToken(intentData.symbol || 'VCN');

                    startFlow('send');

                    // If we have both amount and VALID recipient, skip to confirmation
                    if (cleanAmount && intentData.recipient && ethers.isAddress(intentData.recipient)) {
                        setFlowStep(2);
                    }
                } else if (intentData.intent === 'swap') {
                    setSwapAmount(String(intentData.amount || ''));
                    startFlow('swap');
                } else if (intentData.intent === 'stake') {
                    setStakeAmount(String(intentData.amount || ''));
                    startFlow('stake');
                } else if (intentData.intent === 'bridge') {
                    startFlow('bridge');
                } else if (intentData.intent === 'schedule') {
                    setRecipientAddress(String(intentData.recipient || ''));
                    setSendAmount(String(intentData.amount || ''));
                    setSelectedToken(intentData.symbol || 'VCN');

                    // Parse Time from intentData.executeAt (timestamp) or intentData.time/scheduleTime (relative string)
                    let delay = 300; // Default 5 mins
                    let displayTime = '5 minutes';

                    // Logic to handle execution time: Supports both ISO timestamp and relative string
                    let timestampMs = 0;
                    if (intentData.executeAt) {
                        if (typeof intentData.executeAt === 'number') {
                            timestampMs = intentData.executeAt;
                        } else if (typeof intentData.executeAt === 'string') {
                            // Try parsing ISO or other date formats
                            const parsed = new Date(intentData.executeAt).getTime();
                            if (!isNaN(parsed)) {
                                timestampMs = parsed;
                            }
                        }
                    }

                    if (timestampMs > 0 && timestampMs > Date.now()) {
                        const now = Date.now();
                        delay = Math.max(1, Math.floor((timestampMs - now) / 1000));
                        displayTime = `${Math.ceil(delay / 60)} minutes`;
                        console.log(`[AI] Using parsed timestamp. Delay: ${delay}s`);
                    } else {
                        // Relative parsing fallback
                        // Check executeAt too in case LLM put "10 minutes" there
                        const rawStr = intentData.time || intentData.scheduleTime || intentData.executeAt || '5 minutes';
                        const timeStr = String(rawStr).toLowerCase();
                        displayTime = timeStr;

                        const match = timeStr.match(/(\d+)/);
                        const numeric = match ? parseInt(match[0]) : 5;

                        if (timeStr.includes('hour') || timeStr.includes('h') || timeStr.includes('시') || timeStr.includes('時')) {
                            delay = numeric * 3600;
                        } else if (timeStr.includes('sec') || timeStr.includes('초') || timeStr.includes('秒')) {
                            delay = numeric;
                        } else {
                            // Default to minutes (covers 'min', '분', '分' and failures)
                            delay = numeric * 60;
                        }
                        console.log(`[AI] Using relative time string: ${timeStr}. Delay: ${delay}s`);
                    }


                    setIsSchedulingTimeLock(true);
                    setLockDelaySeconds(delay);

                    startFlow('send');
                    // If we have both amount and recipient, skip to confirmation
                    if (intentData.amount && ethers.isAddress(intentData.recipient)) {
                        setFlowStep(2);
                    }

                    const msg = config.chat.scheduledConfirm(intentData.amount || '', intentData.symbol || 'VCN', displayTime);
                    setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
                    setChatLoading(false);
                    return;
                } else if (intentData.intent === 'multi') {
                    setReviewMulti(intentData.transactions || []);
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: lastLocale() === 'ko'
                            ? "분석된 전송 리스트입니다. 내용을 확인하시고 '전송 시작' 버튼을 눌러주세요."
                            : "I've analyzed the transfer list. Please review the details and click 'Start Transfer' to proceed.",
                        isMultiReview: true,
                        batchData: intentData.transactions
                    }]);
                    setChatLoading(false);
                    return;
                } else if (intentData.intent === 'provide_csv_template') {
                    const csvContent = "VID,Recipient,Amount,Symbol\nRyu CEO,,100,VCN\n,0x123...,0.5,ETH\n";
                    const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
                    const templateMsg = lastLocale() === 'ko'
                        ? `표준 CSV 템플릿을 준비했습니다. 아래 링크를 클릭하여 다운로드 후 전송 리스트를 작성해 주세요.\n\n[📥 Vision_Batch_Template.csv 다운로드](${encodedUri})`
                        : `I've prepared the standard CSV template for you. Click the link below to download and fill in your transfer list.\n\n[📥 Vision_Batch_Template.csv Download](${encodedUri})`;

                    setMessages(prev => [...prev, { role: 'assistant', content: templateMsg }]);
                    setChatLoading(false);
                    return;
                }
            }

            // 3. Clean up response for display
            // Remove intent JSON blocks
            let cleanResponse = response.replace(/\{[\s\S]*?"intent"[\s\S]*?\}/g, "").trim();
            // Remove markdown code blocks
            cleanResponse = cleanResponse.replace(/```json[\s\S]*?```/g, "").trim();
            cleanResponse = cleanResponse.replace(/```[\s\S]*?```/g, "").trim(); // Generic blocks too

            if (!cleanResponse && intentData) {
                const intent = intentData.intent || 'transaction';
                const intentMap: Record<string, Record<string, string>> = {
                    'ko': { 'send': '송금', 'swap': '스왑', 'bridge': '브릿지', 'stake': '스테이킹', 'schedule': '예약 송금', 'transaction': '트랜잭션' },
                    'ja': { 'send': '送金', 'swap': 'スワップ', 'bridge': 'ブリッジ', 'stake': 'ステーキング', 'schedule': '予約送金', 'transaction': 'トランザクション' },
                    'en': { 'send': 'transfer', 'swap': 'swap', 'bridge': 'bridge', 'stake': 'staking', 'schedule': 'scheduled transfer', 'transaction': 'transaction' }
                };
                const localizedIntent = (intentMap[lastLocale()] || intentMap['en'])[intent] || intent;

                const defaultMsgMap: Record<string, string> = {
                    'ko': `요청하신 ${localizedIntent} 업무를 준비했습니다. 화면의 내용을 확인하고 진행해 주세요!`,
                    'ja': `ご依頼の ${localizedIntent} の準備ができました。画面の内容を確認して進めてください。`,
                    'en': `I've prepared the ${localizedIntent} for you. Please review the details on your screen to proceed!`
                };
                cleanResponse = defaultMsgMap[lastLocale()] || defaultMsgMap['en'];
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

        const derived = WalletService.deriveEOA(mnemonic);
        console.log("[Restore] Mnemonic valid. Targeted address will be:", derived.address);

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
            <>
                <section class="bg-[#0a0a0b] min-h-screen flex overflow-hidden">

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
                        setActiveView={(v: string) => navigate(`/wallet/${v}`)}
                        onboardingStep={onboardingStep()}
                        userProfile={userProfile()}
                        shortAddress={shortAddress()}
                        copyAddress={copyAddress}
                        copied={copied()}
                        onLogout={async () => {
                            if (confirm('Are you sure you want to logout?')) {
                                await auth.logout();
                                window.location.href = 'https://www.visionchain.co';
                            }
                        }}
                        networkMode={networkMode()}
                        setNetworkMode={setNetworkMode}
                        unreadCount={unreadNotificationsCount()}
                    />

                    {/* Edge Swipe Handle / Sidebar Toggle Handle */}
                    <Show when={onboardingStep() === 0}>
                        <div
                            class={`lg:hidden fixed left-0 top-0 bottom-[68px] w-8 z-[34] group touch-none transition-all duration-300 ${sidebarOpen() ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                            onTouchStart={(e) => {
                                setTouchStartX(e.touches[0].clientX);
                            }}
                            onTouchMove={(e) => {
                                const currentX = e.touches[0].clientX;
                                const deltaX = currentX - touchStartX();
                                // Threshold for swipe opening
                                if (deltaX > 30 && !sidebarOpen()) {
                                    setSidebarOpen(true);
                                }
                            }}
                            onClick={() => setSidebarOpen(true)}
                        >
                            <div
                                class="absolute left-0 top-1/2 -translate-y-1/2 w-[28px] h-[56px] bg-blue-950/80 border border-blue-400/30 border-l-0 rounded-r-2xl backdrop-blur-xl shadow-[0_0_25px_rgba(59,130,246,0.6)] flex items-center justify-center transition-all duration-300 group-hover:w-[36px] group-hover:bg-blue-900/90 group-hover:border-blue-400/50 group-hover:shadow-[0_0_35px_rgba(59,130,246,0.8)]"
                            >
                                <div class="flex flex-col gap-1 items-center">
                                    <div class="w-1 h-1 rounded-full bg-blue-300 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-[0_0_8px_rgba(147,197,253,0.8)]" />
                                    <div class="w-1 h-3 rounded-full bg-blue-400 group-hover:bg-white group-hover:h-5 transition-all duration-300 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
                                    <div class="w-1 h-1 rounded-full bg-blue-300 group-hover:bg-white group-hover:scale-110 transition-all duration-300 shadow-[0_0_8px_rgba(147,197,253,0.8)]" />
                                </div>
                                <ChevronRight class="w-3.5 h-3.5 text-blue-200 group-hover:text-white transition-colors ml-0.5 animate-pulse" />
                            </div>
                        </div>
                    </Show>

                    {/* Main Content Area */}
                    <main class={`flex-1 flex flex-col h-screen transition-all duration-300 relative ml-0 lg:ml-[280px] w-full overflow-x-hidden ${onboardingStep() === 0 ? 'pb-[68px] lg:pb-0' : ''}`}>


                        {/* Chat View */}
                        <Show when={activeView() === 'chat'}>
                            <WalletDashboard
                                messages={messages}
                                isLoading={chatLoading}
                                onStop={handleStopChat} // Use chat-specific loading
                                input={input}
                                setInput={setInput}
                                handleSend={handleSend}
                                setActiveView={(v: string) => navigate(`/wallet/${v}`)}
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
                                onForceExecute={handleForceExecute}
                                isScheduling={isSchedulingTimeLock()}
                                chatHistoryOpen={chatHistoryOpen()}
                                setChatHistoryOpen={setChatHistoryOpen}
                                batchAgents={batchAgents}
                                reviewMulti={reviewMulti}
                                setReviewMulti={setReviewMulti}
                                onStartBatch={(txs) => {
                                    console.log("Starting batch with txs:", txs);
                                    setPendingAction({
                                        type: 'multi_transactions',
                                        data: { transactions: txs }
                                    });
                                    setPasswordMode('verify');
                                    setWalletPassword('');
                                    setShowPasswordModal(true);
                                }}
                            />
                        </Show>

                        {/* Quest (formerly Campaign) View */}
                        <Show when={activeView() === 'campaign' || activeView() === 'quest'}>
                            <WalletCampaign userProfile={userProfile} />
                        </Show>

                        {/* History View */}
                        <Show when={activeView() === 'history'}>
                            <div class="flex-1 overflow-y-auto p-4 lg:p-8 pb-32 custom-scrollbar">
                                <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                    <WalletViewHeader
                                        tag="Blockchain Ledger"
                                        title="TRANSACTION"
                                        titleAccent="HISTORY"
                                        description="View your on-chain activity, token transfers, and purchase records across the Vision network."
                                        icon={HistoryIcon}
                                    />
                                    <WalletActivity
                                        purchases={vcnPurchases}
                                        walletAddress={walletAddress()}
                                        contacts={contacts()}
                                    />
                                </div>
                            </div>
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
                                setActiveView={(v: string) => navigate(`/wallet/${v}`)}
                            />
                        </Show>

                        <Show when={activeView() === 'nodes'}>
                            <WalletNodes
                                userNodes={ownedNodes()}
                                claimNodeRewards={claimNodeRewards}
                                purchaseNode={purchaseNode}
                            />
                        </Show>

                        {/* Referral View */}
                        <Show when={activeView() === 'referral'}>
                            <WalletReferral
                                userProfile={userProfile}
                            />
                        </Show>

                        <Show when={activeView() === 'assets'}>
                            <WalletAssets
                                totalValueStr={totalValueStr}
                                portfolioStats={portfolioStats}
                                getAssetData={getAssetData}
                                startFlow={(flow) => {
                                    if (flow === 'send' || flow === 'receive') {
                                        navigate('/wallet/' + flow);
                                    } else {
                                        setActiveFlow(flow);
                                    }
                                }}
                                setActiveView={(v: string) => navigate(`/wallet/${v}`)}
                                vcnPurchases={vcnPurchases}
                                totalValue={totalValue}
                                networkMode={networkMode()}
                                isLocalWalletMissing={isLocalWalletMissing()}
                                onRestoreWallet={() => {
                                    navigate('/wallet/profile');
                                    setOnboardingStep(2);
                                }}
                                walletAddress={walletAddress}
                                contacts={contacts()}
                            />
                        </Show>

                        <Show when={activeView() === 'send'}>
                            <WalletSend
                                onBack={() => navigate('/wallet/assets')}
                                getAssetData={getAssetData}
                                selectedToken={selectedToken}
                                setSelectedToken={setSelectedToken}
                                sendAmount={sendAmount}
                                setSendAmount={setSendAmount}
                                recipientAddress={recipientAddress}
                                setRecipientAddress={setRecipientAddress}
                                handleTransaction={handleTransaction}
                                flowStep={flowStep}
                                setFlowStep={setFlowStep}
                                flowLoading={flowLoading}
                                resetFlow={() => { resetFlow(); navigate('/wallet/assets'); }}
                                walletAddress={walletAddress}
                                lastTxHash={lastTxHash}
                                contacts={contacts}
                                isSchedulingTimeLock={isSchedulingTimeLock}
                                lockDelaySeconds={lockDelaySeconds}
                            />
                        </Show>

                        <Show when={activeView() === 'receive'}>
                            <WalletReceive
                                onBack={() => navigate('/wallet/assets')}
                                walletAddress={walletAddress}
                                receiveNetwork={receiveNetwork}
                                setReceiveNetwork={setReceiveNetwork}
                                copyAddress={copyAddress}
                                copied={copied}
                            />
                        </Show>

                        <Show when={activeView() === 'profile'}>
                            <div class="flex-1 overflow-y-auto p-4 lg:p-8 pb-32">
                                <div class="max-w-5xl mx-auto space-y-6">

                                    {/* Onboarding Header (Progress Stepper) - Redesigned to match image */}
                                    <Show when={onboardingStep() > 0}>
                                        <div class="max-w-xl mx-auto mb-8">
                                            <div class="text-center mb-6">
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
                                                <WalletViewHeader
                                                    tag="Identity Vault"
                                                    title="USER"
                                                    titleAccent="PROFILE"
                                                    description="Manage your Vision ID, linked socials, and account level metrics."
                                                    icon={User}
                                                />
                                                {/* Profile Card */}
                                                <div class="relative overflow-hidden group">
                                                    <div class="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-cyan-500/20 to-purple-600/20 rounded-[32px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
                                                    <div class="relative bg-[#111113] border border-white/[0.08] rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-8">
                                                        <div class="relative">
                                                            <div class="w-24 h-24 rounded-3xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden shadow-2xl relative">
                                                                <Show when={userProfile().photoURL} fallback={
                                                                    <span class="text-6xl font-black text-white/90">
                                                                        {userProfile().displayName.charAt(0)}
                                                                    </span>
                                                                }>
                                                                    <img src={userProfile().photoURL} class="w-full h-full object-cover" />
                                                                </Show>
                                                                <Show when={isUploadingImage()}>
                                                                    <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                                        <RefreshCw class="w-6 h-6 text-white animate-spin" />
                                                                    </div>
                                                                </Show>
                                                            </div>
                                                            <input
                                                                type="file"
                                                                ref={fileInputRef}
                                                                class="hidden"
                                                                accept="image/*"
                                                                onChange={handleFileChange}
                                                            />
                                                            <button
                                                                onClick={() => fileInputRef?.click()}
                                                                disabled={isUploadingImage()}
                                                                class="absolute -bottom-2 -right-2 p-2 bg-blue-600 rounded-xl border-4 border-[#111113] text-white hover:scale-110 active:scale-95 transition-transform disabled:opacity-50"
                                                            >
                                                                <Camera class="w-4 h-4" />
                                                            </button>
                                                        </div>

                                                        <div class="flex-1">
                                                            <div class="flex items-center gap-3 mb-1">
                                                                <h3 class="text-2xl font-black text-white">{userProfile().displayName}</h3>
                                                                <Show when={userProfile().isVerified}>
                                                                    <div class="p-1 bg-cyan-500/20 rounded-full border border-cyan-500/50">
                                                                        <Check class="w-3 h-3 text-cyan-400" />
                                                                    </div>
                                                                </Show>
                                                                {/* Rank Badge */}
                                                                <div class={`px-2 py-0.5 rounded-lg border flex items-center gap-1.5 ${(() => {
                                                                    const count = userProfile().referralCount || 0;
                                                                    const RANKS = [
                                                                        { minLvl: 1, bg: 'bg-gray-500', border: 'border-gray-500/30' },
                                                                        { minLvl: 10, bg: 'bg-blue-500', border: 'border-blue-500/30' },
                                                                        { minLvl: 20, bg: 'bg-emerald-500', border: 'border-emerald-500/30' },
                                                                        { minLvl: 30, bg: 'bg-cyan-500', border: 'border-cyan-500/30' },
                                                                        { minLvl: 40, bg: 'bg-indigo-500', border: 'border-indigo-500/30' },
                                                                        { minLvl: 50, bg: 'bg-violet-500', border: 'border-violet-500/30' },
                                                                        { minLvl: 60, bg: 'bg-orange-500', border: 'border-orange-500/30' },
                                                                        { minLvl: 70, bg: 'bg-red-500', border: 'border-red-500/30' },
                                                                        { minLvl: 80, bg: 'bg-rose-500', border: 'border-rose-500/30' },
                                                                        { minLvl: 90, bg: 'bg-yellow-500', border: 'border-yellow-500/30' }
                                                                    ];
                                                                    let level = 1;
                                                                    // Level Calc Logic
                                                                    if (count < 20) { level = count + 1; }
                                                                    else if (count < 80) { level = 20 + Math.floor((count - 20) / 2) + 1; }
                                                                    else if (count < 230) { level = 50 + Math.floor((count - 80) / 5) + 1; }
                                                                    else { level = 80 + Math.floor((count - 230) / 10) + 1; }
                                                                    if (level > 100) level = 100;

                                                                    const rank = RANKS.slice().reverse().find(r => level >= r.minLvl) || RANKS[0];
                                                                    return `${rank.bg}/10 ${rank.border}`;
                                                                })()
                                                                    }`}>
                                                                    <Trophy class="w-3 h-3 text-white" />
                                                                    <span class="text-[10px] font-black text-white uppercase tracking-widest">
                                                                        {(() => {
                                                                            const count = userProfile().referralCount || 0;
                                                                            let level = 1;
                                                                            // Level Calc Logic
                                                                            if (count < 20) { level = count + 1; }
                                                                            else if (count < 80) { level = 20 + Math.floor((count - 20) / 2) + 1; }
                                                                            else if (count < 230) { level = 50 + Math.floor((count - 80) / 5) + 1; }
                                                                            else { level = 80 + Math.floor((count - 230) / 10) + 1; }
                                                                            if (level > 100) level = 100;

                                                                            const names = ['Novice', 'Scout', 'Ranger', 'Guardian', 'Elite', 'Captain', 'Commander', 'Warlord', 'Titan', 'Visionary'];
                                                                            const idx = Math.min(9, Math.floor((level - 1) / 10)); // Correct logic: Lvl 1-9=0 (Novice), Lvl 10-19=1 (Scout)...
                                                                            const rankName = (level >= 10 && level < 20) ? 'Scout' :
                                                                                (level >= 20 && level < 30) ? 'Ranger' :
                                                                                    names.find((_, i) => level >= (i * 10) && level < ((i + 1) * 10)) || (level === 100 ? 'Visionary' : names[Math.min(9, Math.floor(level / 10))]);

                                                                            // Simpler logic for name mapping
                                                                            const getRankName = (lvl: number) => {
                                                                                if (lvl >= 90) return 'Visionary';
                                                                                if (lvl >= 80) return 'Titan';
                                                                                if (lvl >= 70) return 'Warlord';
                                                                                if (lvl >= 60) return 'Commander';
                                                                                if (lvl >= 50) return 'Captain';
                                                                                if (lvl >= 40) return 'Elite';
                                                                                if (lvl >= 30) return 'Guardian';
                                                                                if (lvl >= 20) return 'Ranger';
                                                                                if (lvl >= 10) return 'Scout';
                                                                                return 'Novice';
                                                                            };

                                                                            return `${getRankName(level)} LVL.${level}`;
                                                                        })()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div class="flex items-center gap-4 text-sm text-gray-400 font-mono mb-4">
                                                                <span>{userProfile().email}</span>
                                                                <span class="w-1 h-1 rounded-full bg-gray-700" />
                                                                <span>{userProfile().phone || 'No phone linked'}</span>
                                                            </div>

                                                            {/* XP / Level Progress Bar */}
                                                            {(() => {
                                                                const count = userProfile().referralCount || 0;
                                                                // Logic duplication for isolated calculation
                                                                let level = 1;
                                                                let nextLevelRefs = 1;
                                                                let currentLevelBaseRefs = 0;
                                                                let refsPerLevel = 1;

                                                                if (count < 20) {
                                                                    level = count + 1;
                                                                    refsPerLevel = 1;
                                                                    currentLevelBaseRefs = count;
                                                                    nextLevelRefs = count + 1;
                                                                } else if (count < 80) {
                                                                    const surplus = count - 20;
                                                                    const levelGain = Math.floor(surplus / 2);
                                                                    level = 20 + levelGain + 1;
                                                                    refsPerLevel = 2;
                                                                    currentLevelBaseRefs = 20 + (levelGain * 2);
                                                                    nextLevelRefs = currentLevelBaseRefs + 2;
                                                                } else if (count < 230) {
                                                                    const surplus = count - 80;
                                                                    const levelGain = Math.floor(surplus / 5);
                                                                    level = 50 + levelGain + 1;
                                                                    refsPerLevel = 5;
                                                                    currentLevelBaseRefs = 80 + (levelGain * 5);
                                                                    nextLevelRefs = currentLevelBaseRefs + 5;
                                                                } else {
                                                                    const surplus = count - 230;
                                                                    const levelGain = Math.floor(surplus / 10);
                                                                    level = 80 + levelGain + 1;
                                                                    refsPerLevel = 10;
                                                                    currentLevelBaseRefs = 230 + (levelGain * 10);
                                                                    nextLevelRefs = currentLevelBaseRefs + 10;
                                                                }
                                                                if (level > 100) level = 100;
                                                                const progressIntoLevel = count - currentLevelBaseRefs;
                                                                const progressPercent = Math.min(100, Math.max(0, (progressIntoLevel / refsPerLevel) * 100));
                                                                const refsToNext = Math.max(0, nextLevelRefs - count);

                                                                // Rank Gradient Helper
                                                                const getGradient = (lvl: number) => {
                                                                    if (lvl >= 90) return 'from-yellow-500 to-amber-300';
                                                                    if (lvl >= 80) return 'from-rose-600 to-pink-600';
                                                                    if (lvl >= 70) return 'from-red-600 to-orange-600';
                                                                    if (lvl >= 60) return 'from-orange-600 to-amber-500';
                                                                    if (lvl >= 50) return 'from-violet-600 to-purple-600';
                                                                    if (lvl >= 40) return 'from-indigo-600 to-blue-600';
                                                                    if (lvl >= 30) return 'from-cyan-600 to-sky-500';
                                                                    if (lvl >= 20) return 'from-emerald-600 to-green-500';
                                                                    if (lvl >= 10) return 'from-blue-600 to-cyan-500';
                                                                    return 'from-gray-600 to-gray-500';
                                                                };

                                                                return (
                                                                    <div class="bg-black/20 rounded-xl p-3 border border-white/5 w-full max-w-md">
                                                                        <div class="flex justify-between items-center mb-2">
                                                                            <span class="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                                                                XP Progress
                                                                            </span>
                                                                            <span class="text-[9px] font-bold text-gray-400">
                                                                                <span class="text-white">{refsToNext}</span> INVITES TO LVL {level + 1}
                                                                            </span>
                                                                        </div>
                                                                        <div class="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                                                                            <div
                                                                                class={`h-full bg-gradient-to-r ${getGradient(level)} relative shadow-[0_0_15px_rgba(255,255,255,0.2)]`}
                                                                                style={{ width: `${progressPercent}%` }}
                                                                            >
                                                                                <div class="absolute inset-0 bg-white/20" />
                                                                            </div>
                                                                        </div>
                                                                        <div class="flex justify-end mt-1">
                                                                            <span class="text-[9px] font-mono font-bold text-gray-600">{progressPercent.toFixed(0)}%</span>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}
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

                                                {/* Action Buttons */}
                                                <div class="grid grid-cols-2 gap-3 mb-6">
                                                    <button
                                                        onClick={() => navigate('/wallet/referral-rules')}
                                                        class="w-full py-4 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-white/20 transition-all group"
                                                    >
                                                        <div class="w-8 h-8 rounded-full bg-yellow-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                            <Trophy class="w-4 h-4 text-yellow-400" />
                                                        </div>
                                                        <div class="text-center">
                                                            <div class="text-xs font-bold text-white uppercase tracking-wider">Reward Logic</div>
                                                            <div class="text-[9px] text-gray-400">View Rank Benefits</div>
                                                        </div>
                                                    </button>

                                                    <Show when={deferredPrompt() || isIOS()}>
                                                        <button
                                                            onClick={handleInstallClick}
                                                            class="w-full py-4 bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-white/20 transition-all group"
                                                        >
                                                            <div class="w-8 h-8 rounded-full bg-emerald-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                <Download class="w-4 h-4 text-emerald-400" />
                                                            </div>
                                                            <div class="text-center">
                                                                <div class="text-xs font-bold text-white uppercase tracking-wider">Install App</div>
                                                                <div class="text-[9px] text-gray-400">Add to Home Screen</div>
                                                            </div>
                                                        </button>
                                                    </Show>
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

                                        {/* Step 1.5: Smart Quiz Verification */}
                                        <Match when={onboardingStep() === 1.5}>
                                            <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="max-w-xl mx-auto pb-10">
                                                <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl">
                                                    <div class="bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 flex flex-col items-center text-center">
                                                        <h2 class="text-xl font-black text-white mb-2 uppercase tracking-tight">Security Check</h2>
                                                        <p class="text-gray-400 font-bold text-xs">Verify your backup by selecting the correct words</p>
                                                    </div>

                                                    <div class="p-8 space-y-6">
                                                        <div class="flex justify-between items-end px-1">
                                                            <div class="text-[13px] font-black text-gray-500 uppercase tracking-widest">
                                                                Quiz: <span class="text-white">{Object.keys(quizAnswers()).length}/3</span>
                                                            </div>
                                                            <div class="text-[13px] font-black text-gray-500 uppercase tracking-widest">
                                                                Smart Verify
                                                            </div>
                                                        </div>

                                                        {/* Quiz Slots Area */}
                                                        <div class="grid grid-cols-3 gap-3 p-6 bg-black/40 rounded-3xl border border-white/[0.05]">
                                                            <For each={quizIndices()}>
                                                                {(idx) => (
                                                                    <div class="flex flex-col gap-2">
                                                                        <span class="text-[10px] font-bold text-gray-500 text-center uppercase">Word #{idx + 1}</span>
                                                                        <div class={`min-h-[50px] flex items-center justify-center p-2 bg-white/5 border rounded-xl font-mono text-[13px] font-black transition-all ${quizAnswers()[idx] ? 'border-blue-500/50 bg-blue-500/10 text-white' : 'border-white/5 text-gray-700 dashed-border'}`}>
                                                                            <Show when={quizAnswers()[idx]} fallback={<span class="text-gray-700">?</span>}>
                                                                                <span class="animate-in zoom-in-95">{quizAnswers()[idx]}</span>
                                                                            </Show>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </For>
                                                        </div>

                                                        <div class="flex justify-end">
                                                            <button onClick={() => setQuizAnswers({})} class="text-[11px] font-black text-blue-400 uppercase tracking-widest hover:text-white transition-colors">Reset Quiz</button>
                                                        </div>

                                                        {/* Word Pool Area */}
                                                        <div class="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.04]">
                                                            <For each={shuffledSeed()}>
                                                                {(word) => {
                                                                    const isSelected = Object.values(quizAnswers()).includes(word);
                                                                    return (
                                                                        <button
                                                                            onClick={() => {
                                                                                if (!isSelected) {
                                                                                    const currentAnswers = quizAnswers();
                                                                                    const nextIndex = quizIndices().find(idx => !currentAnswers[idx]);
                                                                                    if (nextIndex !== undefined) {
                                                                                        setQuizAnswers({ ...currentAnswers, [nextIndex]: word });
                                                                                    }
                                                                                }
                                                                            }}
                                                                            disabled={isSelected}
                                                                            class={`p-3 rounded-xl border font-bold text-xs transition-all ${isSelected
                                                                                ? 'bg-white/5 border-white/5 text-transparent select-none opacity-20'
                                                                                : 'bg-[#1a1a1e] text-gray-300 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/5 text-center active:scale-95'
                                                                                }`}
                                                                        >
                                                                            {word}
                                                                        </button>
                                                                    );
                                                                }}
                                                            </For>
                                                        </div>

                                                        <div class="pt-6 space-y-4">
                                                            <button
                                                                onClick={() => {
                                                                    const validSeed = seedPhrase();
                                                                    const currentAnswers = quizAnswers();
                                                                    const indices = quizIndices();
                                                                    const allCorrect = indices.every(idx => currentAnswers[idx] === validSeed[idx]);

                                                                    if (allCorrect) {
                                                                        // Derive address immediately
                                                                        try {
                                                                            const phrase = validSeed.join(' ');
                                                                            const { address } = WalletService.deriveEOA(phrase);
                                                                            console.log("Quiz Success - Derived Address:", address);

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
                                                                        alert('Incorrect words. Please check your backup and try again.');
                                                                        setQuizAnswers({});
                                                                    }
                                                                }}
                                                                disabled={Object.keys(quizAnswers()).length !== 3}
                                                                class={`w-full py-5 rounded-2xl font-black text-lg transition-all shadow-xl ${Object.keys(quizAnswers()).length === 3 ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/20 hover:scale-[1.02]' : 'bg-[#1a1a1e] text-gray-500 border border-white/5 cursor-not-allowed'}`}
                                                            >
                                                                Verify & Create
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
                                <div class="max-w-5xl mx-auto">
                                    <WalletSettings onBack={() => navigate('/wallet/assets')} />
                                </div>
                            </div>
                        </Show>

                        <Show when={activeView() === 'notifications'}>
                            <div class="flex-1 h-full overflow-y-auto p-4 lg:p-8 pb-32">
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
                        <Presence>
                            <WalletFlowModals
                                activeFlow={activeFlow}
                                setActiveFlow={setActiveFlow}
                                flowStep={flowStep}
                                setFlowStep={setFlowStep}
                                networkMode={networkMode}
                                selectedToken={selectedToken}
                                setSelectedToken={setSelectedToken}
                                toToken={toToken}
                                setToToken={setToToken}
                                sendAmount={sendAmount}
                                setSendAmount={setSendAmount}
                                swapAmount={swapAmount}
                                setSwapAmount={setSwapAmount}
                                recipientAddress={recipientAddress}
                                setRecipientAddress={setRecipientAddress}
                                stakeAmount={stakeAmount}
                                setStakeAmount={setStakeAmount}
                                batchInput={batchInput}
                                setBatchInput={setBatchInput}
                                parsedBatchTransactions={parsedBatchTransactions}
                                multiTransactions={multiTransactions}
                                handleTransaction={handleTransaction}
                                handleBatchTransaction={handleBatchTransaction}
                                flowLoading={flowLoading}
                                resetFlow={resetFlow}
                                walletAddress={walletAddress}
                                getAssetData={getAssetData}
                                lastTxHash={lastTxHash}
                                copyToClipboard={copyToClipboard}
                                isSchedulingTimeLock={isSchedulingTimeLock}
                                lockDelaySeconds={lockDelaySeconds}
                            />
                        </Presence>
                        {/* Mobile Bottom Navigation */}
                        <div class="lg:hidden fixed bottom-0 left-0 right-0 z-[60] bg-[#0a0a0b]/90 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-2 pb-2 flex items-center justify-around h-[68px]">
                            {
                                [
                                    { id: 'assets', label: 'Assets', icon: PieChart },
                                    { id: 'nodes', label: 'Nodes', icon: Camera },
                                    { id: 'chat', label: 'Vision AI', icon: AiChatIcon, primary: true },
                                    { id: 'referral', label: 'Earn', icon: UserPlus },
                                    { id: 'settings', label: 'Settings', icon: Settings },
                                ].map((item) => (
                                    <button
                                        onClick={() => {
                                            if (onboardingStep() === 0) {
                                                navigate('/wallet/' + item.id);
                                                setSidebarOpen(false);
                                            }
                                        }}
                                        class={`flex flex-col items-center gap-1 transition-all relative ${activeView() === item.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        <div class={`w-10 h-9 rounded-xl flex items-center justify-center transition-all ${item.primary ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white -mt-4 scale-110' : ''}`}>
                                            <item.icon class={`${item.primary ? 'w-5 h-5' : 'w-4.5 h-4.5'}`} />
                                        </div>
                                        <span class={`text-[8px] font-black uppercase tracking-widest ${item.primary ? 'text-blue-400 opacity-0' : ''}`}>{item.label}</span>
                                        {activeView() === item.id && !item.primary && (
                                            <div class="absolute -bottom-0.5 w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                                        )}
                                    </button>
                                ))
                            }
                        </div>
                    </main>
                </section>
                <canvas ref={cropCanvasRef} class="hidden" />
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
                                            <div class="relative w-full flex items-center">
                                                <input
                                                    type={showWalletPassword() ? "text" : "password"}
                                                    placeholder={passwordMode() === 'setup' ? "Create spending password" : "Enter spending password"}
                                                    class="flex-1 min-w-0 w-full box-border bg-[#0d0d0f] border border-white/20 rounded-2xl py-4 px-14 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-center tracking-widest shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]"
                                                    value={walletPassword()}
                                                    onInput={(e) => setWalletPassword(e.currentTarget.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && (passwordMode() === 'setup' ? finalizeWalletCreation() : executePendingAction())}
                                                    autocomplete="new-password"
                                                    spellcheck={false}
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
                                                <div class="relative w-full flex items-center">
                                                    <input
                                                        type={showWalletPassword() ? "text" : "password"}
                                                        placeholder="Confirm spending password"
                                                        class="flex-1 min-w-0 w-full box-border bg-[#0d0d0f] border border-white/20 rounded-2xl py-4 px-14 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-center tracking-widest shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]"
                                                        value={confirmWalletPassword()}
                                                        onInput={(e) => setConfirmWalletPassword(e.currentTarget.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && finalizeWalletCreation()}
                                                        autocomplete="new-password"
                                                        spellcheck={false}
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

                        {/* Profile Image Crop Modal */}
                        <Show when={isCropping()}>
                            <Motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                class="fixed inset-0 z-[100] flex items-center justify-center px-4"
                            >
                                <div class="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => !isUploadingImage() && setIsCropping(false)} />

                                <Motion.div
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    class="relative w-full max-w-lg bg-[#111113] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                                >
                                    <div class="p-8 pb-4">
                                        <h3 class="text-2xl font-bold text-white mb-2">Crop Profile Picture</h3>
                                        <p class="text-gray-400 text-sm">Adjust the photo to fit your profile best</p>
                                    </div>

                                    <div class="p-8 flex flex-col items-center">
                                        <div class="w-72 h-72 rounded-3xl overflow-hidden border-2 border-blue-500/50 relative bg-black/20 group">
                                            <img
                                                src={imageToCrop()!}
                                                class="w-full h-full object-cover opacity-80"
                                            />
                                            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div class="w-64 h-64 border-2 border-dashed border-white/30 rounded-2xl" />
                                            </div>
                                        </div>

                                        <div class="mt-8 flex gap-4 w-full">
                                            <button
                                                onClick={() => setIsCropping(false)}
                                                disabled={isUploadingImage()}
                                                class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/10 disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleUploadCrop}
                                                disabled={isUploadingImage()}
                                                class="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                <Show when={isUploadingImage()} fallback={<><Check class="w-5 h-5" /> Save Changes</>}>
                                                    <RefreshCw class="w-4 h-4 animate-spin" /> Uploading...
                                                </Show>
                                            </button>
                                        </div>
                                    </div>
                                </Motion.div>
                            </Motion.div>
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


                        {/* iOS PWA Install Instructions Modal */}
                        <Show when={showIOSInstallModal()}>
                            <div class="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4">
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                                    onClick={() => setShowIOSInstallModal(false)}
                                />
                                <Motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                                    class="relative w-full max-w-sm bg-[#111113] border border-white/10 rounded-[32px] p-8 overflow-hidden shadow-2xl"
                                >
                                    <div class="flex flex-col items-center text-center gap-6">
                                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-xl">
                                            <VisionLogo class="w-10 h-10 text-white" />
                                        </div>
                                        <div>
                                            <h3 class="text-xl font-bold text-white mb-2">Install Vision Wallet</h3>
                                            <p class="text-gray-400 text-sm">Follow these steps to add Vision Wallet to your home screen:</p>
                                        </div>

                                        <div class="w-full space-y-4 bg-white/[0.03] rounded-2xl p-5 text-left border border-white/[0.06]">
                                            <div class="flex items-center gap-4">
                                                <div class="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-black">1</div>
                                                <div class="text-sm text-gray-300 italic">Tap the <span class="text-white font-bold not-italic">"Share"</span> button at the bottom of Safari</div>
                                            </div>
                                            <div class="flex items-center gap-4">
                                                <div class="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-sm font-black">2</div>
                                                <div class="text-sm text-gray-300 italic">Select <span class="text-white font-bold not-italic">"Add to Home Screen"</span> from the list</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowIOSInstallModal(false)}
                                            class="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-200 transition-colors shadow-lg active:scale-95 transition-all"
                                        >
                                            Got it
                                        </button>
                                    </div>
                                </Motion.div>
                            </div>
                        </Show>

                        {/* Logout Confirmation Modal */}
                        <Show when={showLogoutConfirm()}>
                            <div class="fixed inset-0 z-[120] flex items-center justify-center p-4">
                                <Motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                                    onClick={cancelLogout}
                                />
                                <Motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    class="relative w-[90vw] max-w-[400px] bg-[#1a1a1e] border border-white/10 rounded-[30px] p-8 shadow-2xl text-center"
                                >
                                    <div class="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5 border border-red-500/20">
                                        <LogOut class="w-8 h-8 text-red-500" />
                                    </div>
                                    <h3 class="text-xl font-bold text-white mb-2">Are you sure to logout?</h3>
                                    <p class="text-sm text-gray-400 mb-8 leading-relaxed">
                                        Your session will be closed and you will be returned to the home page.
                                    </p>
                                    <div class="flex gap-3">
                                        <button
                                            onClick={cancelLogout}
                                            class="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={confirmLogout}
                                            class="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                </Motion.div>
                            </div>
                        </Show>
                    </Presence>
                </Portal>
            </>
        </Show >
    );
};

export default Wallet;
