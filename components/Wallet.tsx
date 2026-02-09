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
    dismissScheduledTask,
    hideBridgeFromDesk,
    retryScheduledTask,
    createNotification,
    NotificationData,
    getFirebaseDb,
    getUserContacts,
    updateScheduledTaskStatus,
    findUserByAddress,
    uploadProfileImage
} from '../services/firebaseService';

import { collection, query, where, onSnapshot, doc, setDoc, limit, orderBy } from 'firebase/firestore';
import { WalletService } from '../services/walletService';
import { CloudWalletService, calculatePasswordStrength } from '../services/cloudWalletService';
import { ethers } from 'ethers';
import { initPriceService, getVcnPrice, getDailyOpeningPrice } from '../services/vcnPriceService';
import { generateText, generateTextStream } from '../services/ai';
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
import Bridge from './Bridge';
import ValidatorStaking from './ValidatorStaking';

import { VisionLogo } from './wallet/VisionLogo';
import { VisionFullLogo } from './wallet/VisionFullLogo';



type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 'settings' | 'contacts' | 'nodes' | 'notifications' | 'referral' | 'history' | 'quest' | 'send' | 'receive' | 'referral-rules' | 'bridge' | 'staking';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    responseTime?: number; // Response time in milliseconds
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

    // Cross-Chain Bridge State
    const [pendingBridge, setPendingBridge] = createSignal<{
        amount: string;
        symbol: string;
        destinationChain: string;
        intentData?: any;
    } | null>(null);
    const [isBridging, setIsBridging] = createSignal(false);


    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = createSignal<any>(null);
    const [isIOS, setIsIOS] = createSignal(false);
    const [showIOSInstallModal, setShowIOSInstallModal] = createSignal(false);

    // --- Mobile Back Button Protection ---
    // Track wallet view history for proper back navigation
    const [viewHistory, setViewHistory] = createSignal<string[]>(['assets']);

    // Ignore early popstate events (PWA startup can trigger spurious events)
    let appStartTime = Date.now();

    // Handle browser popstate (back/forward button)
    const handlePopState = (e: PopStateEvent) => {
        // Ignore popstate within first 3 seconds of app load (PWA startup issue)
        // PWA installations can trigger multiple spurious popstate events
        if (Date.now() - appStartTime < 3000) {
            console.log('[Wallet] Ignoring early popstate event (PWA startup)');
            // Re-push wallet state to prevent navigation issues
            window.history.pushState({ wallet: true }, '', '/wallet/assets');
            return;
        }

        // If the user pressed back and we're still in wallet
        if (window.location.pathname.startsWith('/wallet')) {
            const history = viewHistory();
            if (history.length > 1) {
                // Go to previous view in our internal history
                const newHistory = [...history];
                newHistory.pop();
                setViewHistory(newHistory);
                const prevView = newHistory[newHistory.length - 1] || 'assets';
                navigate(`/wallet/${prevView}`, { replace: true });
            }
        } else {
            // User is trying to leave wallet - just push them back to wallet
            // DO NOT show logout confirm here - it causes PWA issues
            // User should use the explicit logout button in settings
            if (onboardingStep() === 0) {
                window.history.pushState({ wallet: true }, '', '/wallet/assets');
                // Removed: setShowLogoutConfirm(true) - causes PWA startup issues
            }
        }
    };

    // Track view changes and update history
    createEffect(() => {
        const current = activeView();
        const history = viewHistory();
        // Only add to history if it's a new view (not going back)
        if (history[history.length - 1] !== current) {
            setViewHistory([...history, current]);
            // Push state to browser history for back button to work
            if (typeof window !== 'undefined') {
                window.history.pushState({ walletView: current }, '', `/wallet/${current}`);
            }
        }
    });

    onMount(() => {
        // Check for iOS
        const isDeviceIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(isDeviceIOS);

        // Listen for install prompt (Android/Desktop)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
        });

        // Add popstate listener for mobile back button
        window.addEventListener('popstate', handlePopState);

        // Push initial wallet state to protect against immediate back press
        window.history.pushState({ wallet: true, walletView: activeView() }, '', window.location.pathname);
    });

    onCleanup(() => {
        window.removeEventListener('popstate', handlePopState);
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
        const contactList = contacts();

        return batchInput().split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => {
                // Heuristic: If there's a comma surrounded by digits, it's likely a decimal point
                // Convert "30,50" to "30.50" before splitting if it's not a delimiter
                let sanitizedLine = line.replace(/(\d),(\d)/g, '$1.$2');

                // Split strategy: Try Comma or Tab first. If only 1 part remains, try splitting by space if it looks like columns.
                let parts = sanitizedLine.split(/[,\t]+/).map(p => p.trim()).filter(p => p.length > 0);
                if (parts.length === 1 && sanitizedLine.split(/\s+/).length >= 2) {
                    // Try splitting by space if we have an address or pattern like Name Amount
                    parts = sanitizedLine.split(/\s+/).map(p => p.trim()).filter(p => p.length > 0);
                }

                let recipient = '';
                let amount = '';
                let name = '';

                // Strategy A: Find ETH Address (0x...)
                const addrIdx = parts.findIndex(p => p.startsWith('0x') && p.length >= 40);

                if (addrIdx !== -1) {
                    recipient = parts[addrIdx];
                    // Clean address (remove punctuation around it)
                    recipient = recipient.replace(/[^a-fA-F0-9x]/g, '');

                    // Look for amount: Find parts that look like numbers (optionally with token symbol)
                    const amtPart = parts.find((p, i) => {
                        if (i === addrIdx) return false;
                        const cleanP = p.replace(/[a-zA-Z,]/g, '').trim();
                        return cleanP.length > 0 && !isNaN(parseFloat(cleanP));
                    });

                    if (amtPart) {
                        amount = amtPart.replace(/[a-zA-Z,]/g, '').trim();
                    }

                    // Name is whatever is left that isn't address or amount
                    const namePart = parts.find((p, i) => i !== addrIdx && p !== amtPart && p.length > 1 && !p.includes('/') && !p.includes('>'));
                    if (namePart) name = namePart;
                } else {
                    // Strategy B: No address, find Name and Amount
                    // First find amount
                    const amtPart = parts.find(p => {
                        const cleanP = p.replace(/[a-zA-Z,]/g, '').trim();
                        return cleanP.length > 0 && !isNaN(parseFloat(cleanP));
                    });

                    if (amtPart) {
                        amount = amtPart.replace(/[a-zA-Z,]/g, '').trim();
                        // Name is usually before or after amount
                        const namePart = parts.find(p => p !== amtPart && p.trim().length > 1 && !p.includes('/') && !p.includes('>'));
                        if (namePart) name = namePart;
                    } else if (parts.length > 0) {
                        // Fallback: Just assume the first long part is a name
                        name = parts.find(p => p.length > 1) || '';
                    }
                }

                // Contact Lookup & Cleanup
                name = name.replace(/\*\*|-\s*|>\s*|'\s*/g, '').trim(); // Remove Markdown/Delimiters

                if (recipient) {
                    const contact = contactList.find(c => c.address?.toLowerCase() === recipient?.toLowerCase());
                    if (contact && (!name || name === 'Unknown' || name === '')) name = contact.name;
                } else if (name && name !== 'Unknown') {
                    const contact = contactList.find(c => c.name?.toLowerCase() === name?.toLowerCase() || (name && name.length > 2 && c.name?.toLowerCase().includes(name?.toLowerCase())));
                    if (contact && contact.address) recipient = contact.address;
                }

                if (!recipient && !name) return null;

                return {
                    recipient: recipient || '',
                    amount: amount || '0',
                    name: name || 'Unknown',
                    symbol: 'VCN'
                };
            })
            .filter(Boolean) as any[];
    });

    const handleBatchTransaction = () => {
        const txs = parsedBatchTransactions();
        if (txs.length === 0) return;

        // Filter out transactions without recipient addresses and warn user
        const validTxs = txs.filter(tx => tx.recipient && tx.recipient.length > 0);
        const invalidCount = txs.length - validTxs.length;

        if (validTxs.length === 0) {
            alert('No valid transactions found. Please ensure all recipients have valid addresses.');
            return;
        }

        if (invalidCount > 0) {
            console.warn(`[Batch] ${invalidCount} transactions skipped due to missing addresses`);
        }

        setPendingAction({
            type: 'multi_transactions',
            data: {
                transactions: validTxs.map(tx => ({
                    recipient: tx.recipient,
                    amount: tx.amount,
                    symbol: tx.symbol,
                    name: tx.name, // Include name for tracking
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
        username: '',
        displayName: '',
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
    const [isWalletRestored, setIsWalletRestored] = createSignal(false); // Track if wallet was restored
    const [searchQuery, setSearchQuery] = createSignal('');
    const [showLogoutConfirm, setShowLogoutConfirm] = createSignal(false);
    const [pendingLogout, setPendingLogout] = createSignal<(() => void) | null>(null);
    const [bridgeTasks, setBridgeTasks] = createSignal<any[]>([]);  // Bridge transactions for Agent Queue

    useBeforeLeave((e: any) => {
        // CRITICAL: Skip this check during PWA startup (first 3 seconds)
        // PWA installations can trigger spurious navigation events
        if (Date.now() - appStartTime < 3000) {
            console.log('[Wallet] Ignoring early beforeLeave event (PWA startup)');
            return;
        }

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
        // Simply close the modal - do NOT redirect or change any state
        // User explicitly chose to stay, so keep current state as-is
    };

    const [copied, setCopied] = createSignal(false);
    const [copiedSeed, setCopiedSeed] = createSignal(false);
    const [showPasswordModal, setShowPasswordModal] = createSignal(false);
    const [passwordMode, setPasswordMode] = createSignal<'setup' | 'verify'>('setup');
    const [pendingAction, setPendingAction] = createSignal<{ type: string, data?: any } | null>(null);
    const [walletPassword, setWalletPassword] = createSignal('');
    const [currentPrivateKey, setCurrentPrivateKey] = createSignal(''); // For internal wallet operations
    const [confirmWalletPassword, setConfirmWalletPassword] = createSignal('');
    const [showWalletPassword, setShowWalletPassword] = createSignal(false);
    const [onboardingSuccess, setOnboardingSuccess] = createSignal(false);
    const [referralBonus, setReferralBonus] = createSignal('0');
    const [isLocalWalletMissing, setIsLocalWalletMissing] = createSignal(false);
    const [cloudWalletAvailable, setCloudWalletAvailable] = createSignal(false);
    const [showCloudRestoreModal, setShowCloudRestoreModal] = createSignal(false);
    const [cloudRestorePassword, setCloudRestorePassword] = createSignal('');
    const [cloudRestoreLoading, setCloudRestoreLoading] = createSignal(false);
    const [cloudRestoreError, setCloudRestoreError] = createSignal('');
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

    // --- Multi-Chain Asset State ---
    const [sepoliaVcnBalance, setSepoliaVcnBalance] = createSignal(0);
    const [ethMainnetBalance, setEthMainnetBalance] = createSignal(0);
    const [polygonBalance, setPolygonBalance] = createSignal(0);
    const [baseBalance, setBaseBalance] = createSignal(0);
    const [polygonAmoyBalance, setPolygonAmoyBalance] = createSignal(0);
    const [baseSepoliaBalance, setBaseSepoliaBalance] = createSignal(0);
    const [isLoadingMultiChain, setIsLoadingMultiChain] = createSignal(false);

    // Multi-Chain Balance Fetcher
    const fetchMultiChainBalances = async () => {
        const addr = walletAddress();
        if (!addr) return;

        setIsLoadingMultiChain(true);

        // Fetch all balances in parallel
        const fetchPromises = [
            // Sepolia VCN Token
            (async () => {
                try {
                    const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
                    const SEPOLIA_VCN_TOKEN = '0x07755968236333B5f8803E9D0fC294608B200d1b';
                    const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];
                    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
                    const contract = new ethers.Contract(SEPOLIA_VCN_TOKEN, ERC20_ABI, provider);
                    const balance = await contract.balanceOf(addr);
                    setSepoliaVcnBalance(parseFloat(ethers.formatEther(balance)));
                } catch (err) {
                    console.debug('[Sepolia] VCN balance error:', err);
                    setSepoliaVcnBalance(0);
                }
            })(),

            // Ethereum Mainnet ETH
            (async () => {
                try {
                    const ETH_RPC = 'https://ethereum-rpc.publicnode.com';
                    const provider = new ethers.JsonRpcProvider(ETH_RPC);
                    const balance = await provider.getBalance(addr);
                    setEthMainnetBalance(parseFloat(ethers.formatEther(balance)));
                    console.log('[Ethereum] ETH Balance:', parseFloat(ethers.formatEther(balance)));
                } catch (err) {
                    console.debug('[Ethereum] ETH balance error:', err);
                    setEthMainnetBalance(0);
                }
            })(),

            // Polygon Mainnet POL
            (async () => {
                try {
                    const POLYGON_RPC = 'https://polygon-bor-rpc.publicnode.com';
                    const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
                    const balance = await provider.getBalance(addr);
                    setPolygonBalance(parseFloat(ethers.formatEther(balance)));
                    console.log('[Polygon] POL Balance:', parseFloat(ethers.formatEther(balance)));
                } catch (err) {
                    console.debug('[Polygon] POL balance error:', err);
                    setPolygonBalance(0);
                }
            })(),

            // Base Mainnet ETH
            (async () => {
                try {
                    const BASE_RPC = 'https://base-rpc.publicnode.com';
                    const provider = new ethers.JsonRpcProvider(BASE_RPC);
                    const balance = await provider.getBalance(addr);
                    setBaseBalance(parseFloat(ethers.formatEther(balance)));
                    console.log('[Base] ETH Balance:', parseFloat(ethers.formatEther(balance)));
                } catch (err) {
                    console.debug('[Base] ETH balance error:', err);
                    setBaseBalance(0);
                }
            })(),

            // Polygon Amoy Testnet POL
            (async () => {
                try {
                    const AMOY_RPC = 'https://polygon-amoy-bor-rpc.publicnode.com';
                    const provider = new ethers.JsonRpcProvider(AMOY_RPC);
                    const balance = await provider.getBalance(addr);
                    setPolygonAmoyBalance(parseFloat(ethers.formatEther(balance)));
                    console.log('[Polygon Amoy] POL Balance:', parseFloat(ethers.formatEther(balance)));
                } catch (err) {
                    console.debug('[Polygon Amoy] POL balance error:', err);
                    setPolygonAmoyBalance(0);
                }
            })(),

            // Base Sepolia Testnet ETH
            (async () => {
                try {
                    const BASE_SEPOLIA_RPC = 'https://base-sepolia-rpc.publicnode.com';
                    const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC);
                    const balance = await provider.getBalance(addr);
                    setBaseSepoliaBalance(parseFloat(ethers.formatEther(balance)));
                    console.log('[Base Sepolia] ETH Balance:', parseFloat(ethers.formatEther(balance)));
                } catch (err) {
                    console.debug('[Base Sepolia] ETH balance error:', err);
                    setBaseSepoliaBalance(0);
                }
            })(),
        ];

        await Promise.allSettled(fetchPromises);
        setIsLoadingMultiChain(false);
    };

    // Legacy wrapper for Sepolia balance
    const fetchSepoliaBalance = fetchMultiChainBalances;

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

    // Subscribe to Bridge transactions for Agent Queue display
    createEffect(() => {
        const addr = walletAddress();
        if (!addr) {
            setBridgeTasks([]);
            return;
        }

        const normalizedAddr = addr.toLowerCase();
        const db = getFirebaseDb();
        const txRef = collection(db, 'transactions');
        const q = query(
            txRef,
            where('from_addr', '==', normalizedAddr),
            where('type', '==', 'Bridge'),
            orderBy('timestamp', 'desc'),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const tasks = snapshot.docs.map(docItem => {
                const data = docItem.data();
                const bridgeStatus = data.bridgeStatus || 'PENDING';

                // Map bridge status to AgentTask status
                let status: 'WAITING' | 'EXECUTING' | 'SENT' | 'FAILED' = 'WAITING';
                if (bridgeStatus === 'PENDING' || bridgeStatus === 'SUBMITTED' || bridgeStatus === 'COMMITTED' || bridgeStatus === 'LOCKED') {
                    status = 'WAITING';
                } else if (bridgeStatus === 'PROCESSING') {
                    status = 'EXECUTING';
                } else if (bridgeStatus === 'COMPLETED' || bridgeStatus === 'FINALIZED' || bridgeStatus === 'FULFILLED') {
                    status = 'SENT';
                } else if (bridgeStatus === 'FAILED') {
                    status = 'FAILED';
                }

                // Format amount from Wei to VCN
                let amount = data.value || '0';
                try {
                    const vcn = Number(BigInt(Math.round(parseFloat(amount) * 1e18))) / 1e18;
                    amount = vcn >= 1000 ? `${(vcn / 1000).toFixed(1)}K` : vcn.toFixed(vcn < 10 ? 2 : 0);
                } catch { /* keep original */ }

                const dstChain = data.metadata?.dstChainId === 11155111 ? 'Sepolia' : 'Vision';

                return {
                    id: `bridge_${docItem.id}`,
                    type: 'BRIDGE' as const,
                    summary: `${amount} VCN → ${dstChain}`,
                    status,
                    timestamp: data.timestamp || Date.now(),
                    completedAt: data.completedAt ? new Date(data.completedAt).getTime() :
                        (status === 'SENT' ? (data.timestamp || Date.now()) : undefined),
                    recipient: data.to_addr || 'Bridge',
                    amount: `${amount}`,
                    token: 'VCN',
                    txHash: data.hash,
                    scheduleId: docItem.id,
                    error: bridgeStatus === 'FAILED' ? 'Bridge transaction failed' : undefined,
                    hiddenFromDesk: data.hiddenFromDesk || false
                };
            })
                // Sort by timestamp (newest first)
                .sort((a, b) => b.timestamp - a.timestamp);

            console.log('[Wallet] Bridge tasks updated:', tasks.length, tasks.map(t => ({ id: t.id, status: t.status, type: t.type })));
            setBridgeTasks(tasks);
        }, (error) => {
            console.error('[Wallet] Bridge tasks subscription error:', error);
        });

        return unsubscribe;
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

    // Dismiss a task from Agent Queue and Agent Desk (hide from UI, preserve in history)
    const handleDismissTask = async (taskId: string) => {
        console.log('[Wallet] Dismissing task:', taskId);

        // Handle Bridge transactions (ID starts with 'bridge_')
        if (taskId.startsWith('bridge_')) {
            const actualId = taskId.replace('bridge_', '');
            // Remove from local state using correct ID format
            setBridgeTasks(prev => prev.filter(t => t.id !== taskId));
            try {
                await hideBridgeFromDesk(actualId);
                console.log('[Wallet] Bridge dismissed:', actualId);
            } catch (e) {
                console.error('[Wallet] Failed to dismiss bridge:', e);
            }
            return;
        }

        // Handle Batch agents - mark as hidden (not delete)
        if (batchAgents().some((a: any) => a.id === taskId)) {
            setBatchAgents(prev => prev.map((a: any) =>
                a.id === taskId ? { ...a, hiddenFromDesk: true, hiddenAt: Date.now() } : a
            ));
            console.log('[Wallet] Batch agent hidden:', taskId);
            return;
        }

        // Handle Time-lock tasks - update hiddenFromDesk flag locally first for immediate UI response
        setQueueTasks(prev => prev.map((t: any) =>
            t.id === taskId ? { ...t, hiddenFromDesk: true, hiddenAt: Date.now() } : t
        ));

        // Update Firebase to persist the hidden state
        try {
            await dismissScheduledTask(taskId);
            console.log('[Wallet] TimeLock task dismissed:', taskId);
        } catch (e) {
            console.error('[Wallet] Failed to dismiss task:', e);
        }
    };

    // Retry a failed task
    const handleRetryTask = async (taskId: string) => {
        console.log('[Wallet] Retrying task:', taskId);
        try {
            await retryScheduledTask(taskId);
            // Update local state to reflect retry
            setQueueTasks(prev => prev.map((t: any) =>
                t.id === taskId ? { ...t, status: 'WAITING', error: null } : t
            ));
            alert('Task scheduled for retry.');
        } catch (e) {
            console.error('[Wallet] Failed to retry task:', e);
            alert('Failed to retry task.');
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
    const [showResponseTime, setShowResponseTime] = createSignal(
        localStorage.getItem('visionhub_show_response_time') === 'true'
    );

    // Sync showResponseTime when localStorage changes (from Settings) or when window regains focus
    onMount(() => {
        const syncResponseTimeSetting = () => {
            setShowResponseTime(localStorage.getItem('visionhub_show_response_time') === 'true');
        };

        // Custom event for same-tab settings changes
        const handleSettingsChange = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.key === 'visionhub_show_response_time') {
                setShowResponseTime(detail.value === 'true');
            }
        };

        // Listen for storage changes (cross-tab)
        window.addEventListener('storage', syncResponseTimeSetting);

        // Listen for custom settings event (same-tab)
        window.addEventListener('settingsChanged', handleSettingsChange);

        // Also sync when window regains focus
        window.addEventListener('focus', syncResponseTimeSetting);

        onCleanup(() => {
            window.removeEventListener('storage', syncResponseTimeSetting);
            window.removeEventListener('settingsChanged', handleSettingsChange);
            window.removeEventListener('focus', syncResponseTimeSetting);
        });
    });

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
    const [streamingContent, setStreamingContent] = createSignal<string>(''); // Streaming text shown below thinking
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
        setMessages([]);  // Empty messages to show Quick Actions
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

    // Flag to prevent repeated history loading
    const [historyLoaded, setHistoryLoaded] = createSignal(false);

    createEffect(() => {
        const email = userProfile().email;
        // Only fetch history once when email becomes available
        if (email && !historyLoaded()) {
            setHistoryLoaded(true);
            fetchHistory();
        }
    });
    const [chatLoading, setChatLoading] = createSignal(false); // Dedicated loading for chat
    const [messages, setMessages] = createSignal<Message[]>([]);  // Start empty to show Quick Actions
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
        // CRITICAL: Prevent duplicate execution
        if (isLoading()) {
            console.warn('[executePendingAction] Already processing, ignoring duplicate call');
            return;
        }

        const action = pendingAction();
        if (!action) return;

        // Immediately clear pending action to prevent re-execution
        setPendingAction(null);

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
                setCurrentPrivateKey(privateKey); // Cache for internal wallet operations

                // 2. Connect Internal Wallet
                const address = await contractService.connectInternalWallet(privateKey);

                // 3. Execute Send or Local Time-lock Schedule
                if (isSchedulingTimeLock()) {
                    let timeLockSuccess = false;
                    let timeLockTxHash = '';
                    let timeLockScheduleId = '';

                    // --- STRATEGY 1: Try Gasless Paymaster (Production Ready) ---
                    try {
                        setLoadingMessage('AGENT: ESTIMATING GAS...');
                        const feeQuote = await contractService.getFeeQuote('timelock', {
                            recipient,
                            amount,
                            delaySeconds: lockDelaySeconds()
                        });
                        console.log("[Paymaster] Fee Quote:", feeQuote);

                        setLoadingMessage(`AGENT: SCHEDULING (Fee: ${feeQuote.totalFee} VCN)...`);
                        const result = await contractService.scheduleTimeLockGasless(recipient, amount, lockDelaySeconds(), auth.user()?.email || undefined);
                        console.log("[Paymaster] Time-lock Scheduled:", result);

                        timeLockTxHash = result.txHash;
                        timeLockScheduleId = result.scheduleId;
                        timeLockSuccess = true;

                    } catch (paymasterErr: any) {
                        console.warn("[Paymaster] Failed, trying legacy method:", paymasterErr.message);

                        // --- STRATEGY 2: Fallback to Legacy Auto-Seed (Testnet Only) ---
                        try {
                            setLoadingMessage('AGENT: SYNCING BALANCE...');

                            // Auto-Seed Logic for Demo/Testnet
                            // TODO: In production, restore purchasedVcn() check:
                            //       if (parseFloat(onChainBal) < (numericAmount + gasBuffer) && purchasedVcn() >= numericAmount)
                            // TEMPORARY: Allow airdrop without VCN purchase check for testing
                            try {
                                const onChainBal = await contractService.getNativeBalance(address);
                                const numericAmount = parseFloat(amount.replace(/,/g, ''));
                                const gasBuffer = 1; // Actual gas is ~0.0001 VCN, 1 VCN is already 10000x buffer

                                // TEMPORARY: Always seed if balance is insufficient (for testnet demo only)
                                if (parseFloat(onChainBal) < (numericAmount + gasBuffer)) {
                                    setLoadingMessage('AGENT: AIRDROPPING VCN...');
                                    console.log("[Legacy] Auto-seeding wallet from admin...");
                                    console.log("[Legacy] Current balance:", onChainBal, "Required:", numericAmount + gasBuffer);
                                    const seedAmount = numericAmount + gasBuffer;
                                    const seedReceipt = await contractService.adminSendVCN(address, seedAmount.toString());
                                    console.log("[Legacy] Airdrop confirmed. Hash:", seedReceipt.hash);

                                    setLoadingMessage('AGENT: FINALIZING SYNC...');
                                    await new Promise(r => setTimeout(r, 8000)); // Increased from 4s to 8s

                                    // Poll for balance update (max 3 attempts)
                                    let newBal = '0';
                                    for (let i = 0; i < 3; i++) {
                                        newBal = await contractService.getNativeBalance(address);
                                        if (parseFloat(newBal) >= (numericAmount + gasBuffer)) {
                                            break;
                                        }
                                        console.log(`[Legacy] Balance check ${i + 1}/3: ${newBal}, waiting...`);
                                        await new Promise(r => setTimeout(r, 3000));
                                    }

                                    console.log("[Legacy] Verified post-airdrop balance:", newBal);

                                    // Final check
                                    if (parseFloat(newBal) < (numericAmount + gasBuffer)) {
                                        throw new Error(`Balance still insufficient after airdrop. Have: ${newBal}, Need: ${numericAmount + gasBuffer}`);
                                    }
                                }
                            } catch (seedErr) {
                                console.error("[Legacy] Auto-seed failed:", seedErr);
                                // Don't proceed if seed failed - throw to show error
                                throw new Error("Auto-seed failed. Please try again.");
                            }

                            setLoadingMessage('AGENT: SCHEDULING TIME-LOCK...');
                            const { receipt, scheduleId } = await contractService.scheduleTransferNative(recipient, amount, lockDelaySeconds());
                            console.log("[Legacy] Time-lock Schedule Successful:", receipt.hash);

                            timeLockTxHash = receipt.hash;
                            timeLockScheduleId = scheduleId;
                            timeLockSuccess = true;

                        } catch (legacyErr: any) {
                            console.error("[Legacy] Time-lock scheduling failed:", legacyErr);
                            const isInsufficientFunds = legacyErr.code === 'INSUFFICIENT_FUNDS'
                                || legacyErr.message?.includes('insufficient funds')
                                || legacyErr.message?.includes('-32000');

                            // All system messages in English only
                            const errorMsg = isInsufficientFunds
                                ? 'Insufficient balance. You need the transfer amount plus gas fees (~1 VCN).'
                                : `Time-lock scheduling failed: ${legacyErr.shortMessage || legacyErr.message || 'Unknown error'}`;

                            alert(errorMsg);
                            throw legacyErr;
                        }
                    }

                    // Register successful Time-lock with Firebase
                    if (timeLockSuccess) {
                        setLastTxHash(timeLockTxHash);
                        await saveScheduledTransfer({
                            userEmail: userProfile().email,
                            recipient: recipient,
                            amount: amount,
                            token: symbol,
                            unlockTime: Math.floor(Date.now() / 1000) + lockDelaySeconds(),
                            creationTx: timeLockTxHash,
                            scheduleId: timeLockScheduleId,
                            status: 'WAITING'
                        });
                    }

                } else if (symbol === 'VCN') {
                    try {
                        // Use Paymaster (Gasless) Logic for VCN
                        const result = await contractService.sendGaslessTokens(recipient, amount);
                        console.log("Gasless Send Successful (Fee 1 VCN):", result);

                        // Extract hash from backend response if available, or just mark success
                        // The Smart Relayer returns status: 'success'
                        if (result && (result.txHash || result.hash)) {
                            setLastTxHash(result.txHash || result.hash);
                        }
                    } catch (error: any) {
                        console.warn("Paymaster failed, attempting standard transfer...", error);
                        try {
                            // Fallback to Standard Send
                            const receipt = await contractService.sendTokens(recipient, amount, symbol);
                            console.log("Standard Send Successful (Fallback):", receipt.hash);
                            setLastTxHash(receipt.hash);
                        } catch (fallbackError: any) {
                            console.error("Fallback Failed:", fallbackError);
                            const isInsufficientFunds = fallbackError.code === 'INSUFFICIENT_FUNDS'
                                || fallbackError.message?.includes('insufficient funds')
                                || fallbackError.message?.includes('-32000');

                            // All system messages in English only
                            const errorMsg = isInsufficientFunds
                                ? 'Insufficient balance. You need the transfer amount plus gas fees.'
                                : `Transfer failed: ${fallbackError.shortMessage || fallbackError.reason || 'Unknown error'}`;

                            alert(errorMsg);
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

                // Refresh on-chain balance after successful transfer
                setTimeout(() => fetchPortfolioData(), 2000);

                // --- Notification Logic ---
                try {
                    const isScheduled = isSchedulingTimeLock();

                    // Lookup recipient name from contacts
                    const contactList = contacts() || [];
                    const recipientContact = contactList.find((c: any) => c.address?.toLowerCase() === recipient.toLowerCase());
                    const recipientDisplayName = recipientContact?.name || `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;

                    // 1. Notify Sender
                    await createNotification(userProfile().email, {
                        type: isScheduled ? 'transfer_scheduled' : 'alert',
                        title: isScheduled ? 'Time Lock Transfer Scheduled' : 'Transfer Successful',
                        content: isScheduled
                            ? `You have scheduled ${amount} ${symbol} to be sent to ${recipientDisplayName}.`
                            : `You successfully sent ${amount} ${symbol} to ${recipientDisplayName}.`,
                        data: { amount, symbol, recipient, isScheduled }
                    });

                    // 2. Notify Recipient (if registered user and not scheduled)
                    if (!isScheduled) {
                        const recipientUser = await findUserByAddress(recipient);
                        if (recipientUser?.email) {
                            // Get sender's name - check recipient's contacts for sender's address
                            const senderAddress = userProfile().address;
                            const senderDisplayName = userProfile().displayName || userProfile().email?.split('@')[0] || 'Someone';

                            await createNotification(recipientUser.email, {
                                type: 'transfer_received',
                                title: 'Coins Received',
                                content: `You received ${amount} ${symbol} from ${senderDisplayName} (${senderAddress?.slice(0, 6)}...${senderAddress?.slice(-4)}).`,
                                data: { amount, symbol, sender: userProfile().email, senderAddress, txHash: lastTxHash() }
                            });
                        }
                    }
                } catch (notiErr) {
                    console.warn("Notification failed:", notiErr);
                }

                // --- Add Chat Completion Message ---
                try {
                    const isScheduled = isSchedulingTimeLock();
                    const contactList = contacts() || [];
                    const recipientContact = contactList.find((c: any) => c.address?.toLowerCase() === recipient.toLowerCase());
                    const recipientName = recipientContact?.name || `${recipient.slice(0, 6)}...${recipient.slice(-4)}`;
                    const txHash = lastTxHash();
                    const txLink = txHash ? `https://www.visionchain.co/visionscan/tx/${txHash}` : '';

                    const completionMessage = lastLocale() === 'ko'
                        ? isScheduled
                            ? `**타임락 전송 예약완료**\n\n${recipientName}님에게 **${amount} ${symbol}** 전송이 예약되었습니다.\n\n예약된 시간에 자동으로 전송됩니다.`
                            : `**전송 완료**\n\n${recipientName}님에게 **${amount} ${symbol}** 전송이 성공적으로 완료되었습니다.${txHash ? `\n\nTx: \`${txHash.slice(0, 10)}...${txHash.slice(-6)}\`` : ''}`
                        : isScheduled
                            ? `**Time Lock Transfer Scheduled**\n\n**${amount} ${symbol}** has been scheduled to be sent to ${recipientName}.\n\nIt will be automatically transferred at the scheduled time.`
                            : `**Transfer Complete**\n\n**${amount} ${symbol}** has been successfully sent to ${recipientName}.${txHash ? `\n\nTx: \`${txHash.slice(0, 10)}...${txHash.slice(-6)}\`` : ''}`;

                    setMessages(prev => [...prev, { role: 'assistant', content: completionMessage }]);
                } catch (msgErr) {
                    console.warn("Chat completion message failed:", msgErr);
                }

            } else if (action.type === 'multi_transactions') {
                const { transactions } = action.data;
                setIsLoading(false); // Do not block UI for batch
                setFlowLoading(false);
                // Show "Batch Started" message
                setFlowStep(3); // Step 3 = Batch Started Screen

                // Auto-close modal after 3 seconds
                setTimeout(() => {
                    setActiveFlow(null);
                    setFlowStep(0);
                }, 3000);

                // 1. Initialize Batch Agent
                const agentId = Math.random().toString(36).substring(7);
                const newAgent = {
                    id: agentId,
                    status: 'EXECUTING',
                    totalCount: transactions.length,
                    successCount: 0,
                    failedCount: 0,
                    startTime: Date.now(),
                    transactions: transactions.map((tx: any) => ({
                        ...tx,
                        status: 'PENDING',
                        vid: tx.name || tx.vid || 'New Recipient' // Ensure UI shows name
                    }))
                };
                setBatchAgents(prev => [...prev, newAgent]);

                // 1b. Send "Batch Started" notification to sender
                const totalAmount = transactions.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0);
                try {
                    await createNotification(userProfile().email, {
                        type: 'multi_send_start',
                        title: 'Batch Transfer Started',
                        content: `Processing ${transactions.length} transfers totaling ${totalAmount.toFixed(2)} VCN...`,
                        data: { agentId, count: transactions.length, totalAmount }
                    });
                } catch (notifyErr) {
                    console.warn('[Batch] Start notification failed:', notifyErr);
                }

                // 2. Decrypt Mnemonic for all transactions - with error handling
                let mnemonic: string;
                let privateKey: string;

                try {
                    setLoadingMessage('AGENT: DECRYPTING VAULT...');
                    const encrypted = WalletService.getEncryptedWallet(userProfile().email);
                    if (!encrypted) throw new Error("Wallet not found");
                    mnemonic = await WalletService.decrypt(encrypted, walletPassword());
                    const derived = WalletService.deriveEOA(mnemonic);
                    privateKey = derived.privateKey;
                    await contractService.connectInternalWallet(privateKey);
                } catch (initError: any) {
                    console.error('Batch initialization failed:', initError);
                    // Mark agent as failed
                    setBatchAgents(prev => prev.map(a => a.id === agentId ? {
                        ...a,
                        status: 'FAILED',
                        error: initError.message || 'Wallet initialization failed',
                        failedCount: transactions.length
                    } : a));

                    // Send error message to chat
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: lastLocale() === 'ko'
                            ? `**배치 전송 실패**\n\n지갑 초기화 중 오류가 발생했습니다: ${initError.message}`
                            : `**Batch Transfer Failed**\n\nWallet initialization error: ${initError.message}`
                    }]);
                    return; // Exit early
                }

                const finalResults: any[] = [];
                for (let i = 0; i < transactions.length; i++) {
                    const tx = transactions[i];
                    // Normalize recipient field (support both 'recipient' and 'address' for backwards compat)
                    const recipientAddr = tx.recipient || tx.address;
                    if (!recipientAddr) {
                        console.error('Transaction missing recipient address:', tx);
                        setBatchAgents(prev => prev.map(a => a.id === agentId ? { ...a, failedCount: a.failedCount + 1 } : a));
                        continue;
                    }
                    // Update Agent progress: 3/n Transactions - Update Background Agent, not global loader
                    setBatchAgents(prev => prev.map(a => a.id === agentId ? { ...a, currentCount: i + 1 } : a));

                    try {
                        let receipt;
                        const symbol = tx.symbol || 'VCN';

                        // Default to 'send' if no intent specified
                        const intent = tx.intent || 'send';
                        if (intent === 'send') {
                            if (symbol === 'VCN') {
                                try {
                                    const result = await contractService.sendGaslessTokens(recipientAddr, tx.amount);
                                    receipt = { hash: result?.txHash || result?.hash || '0x...' };
                                    console.log(`[Batch] Gasless transfer ${i + 1}/${transactions.length} successful:`, receipt.hash);
                                } catch (gcError: any) {
                                    console.warn(`[Batch] Gasless failed for tx ${i + 1}, trying standard:`, gcError.message);
                                    try {
                                        receipt = await contractService.sendTokens(recipientAddr, tx.amount, symbol);
                                        console.log(`[Batch] Standard transfer ${i + 1}/${transactions.length} successful:`, receipt?.hash);
                                    } catch (stdError: any) {
                                        console.error(`[Batch] Both gasless and standard failed for tx ${i + 1}:`, stdError.message);
                                        throw new Error(`Transfer failed: ${stdError.message || gcError.message}`);
                                    }
                                }
                            } else {
                                receipt = await contractService.sendTokens(recipientAddr, tx.amount, symbol);
                            }
                        } else if (tx.intent === 'schedule') {
                            const delay = tx.executeAt ? Math.max(60, Math.floor((tx.executeAt - Date.now()) / 1000)) : 300;
                            const scheduleRes = await contractService.scheduleTransferNative(recipientAddr, tx.amount, delay);
                            receipt = scheduleRes.receipt;
                            await saveScheduledTransfer({
                                userEmail: userProfile().email,
                                recipient: recipientAddr,
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

                        // Notify recipient for immediate transfers (not scheduled)
                        if (tx.intent !== 'schedule' && receipt?.hash) {
                            try {
                                const recipientUser = await findUserByAddress(recipientAddr);
                                if (recipientUser?.email) {
                                    const senderAddress = userProfile().address;
                                    const senderDisplayName = userProfile().displayName || userProfile().email?.split('@')[0] || 'Someone';
                                    await createNotification(recipientUser.email, {
                                        type: 'transfer_received',
                                        title: 'Coins Received',
                                        content: `You received ${tx.amount} ${tx.symbol || 'VCN'} from ${senderDisplayName} (${senderAddress?.slice(0, 6)}...${senderAddress?.slice(-4)}).`,
                                        data: { amount: tx.amount, symbol: tx.symbol || 'VCN', sender: userProfile().email, senderAddress, txHash: receipt.hash }
                                    });
                                }
                            } catch (notiErr) {
                                console.warn("Recipient notification failed:", notiErr);
                            }
                        }
                    } catch (err: any) {
                        console.error("Batch item failed:", err);
                        const errorMsg = err.message || "Unknown error";
                        finalResults.push({ success: false, error: errorMsg, tx });
                        // Store error message in agent for UI display
                        setBatchAgents(prev => prev.map(a => a.id === agentId ? {
                            ...a,
                            failedCount: a.failedCount + 1,
                            error: errorMsg,
                            lastError: { recipient: recipientAddr, amount: tx.amount, message: errorMsg }
                        } : a));
                    }

                    // 10 second interval for stability
                    // 10 second interval for stability
                    // Dynamic interval based on user preference
                    if (i < transactions.length - 1) {
                        const waitTime = (action.data.interval || 10) * 1000;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }

                // Calculate final counts for the report
                const successMsg = finalResults.filter(r => r.success).length;
                const failMsg = finalResults.filter(r => !r.success).length;

                // 3.5 Save each transaction result to persistent history
                for (let j = 0; j < finalResults.length; j++) {
                    const r = finalResults[j];
                    await saveScheduledTransfer({
                        userEmail: userProfile().email,
                        recipient: r.tx.recipient,
                        amount: r.tx.amount,
                        token: r.tx.symbol || 'VCN',
                        unlockTime: Math.floor(Date.now() / 1000),
                        creationTx: r.hash || '',
                        scheduleId: `batch_${agentId}_${j}`,
                        status: r.success ? 'SENT' : 'FAILED',
                        type: 'BATCH'
                    } as any);
                }

                // Final Update & Finalize
                setBatchAgents(prev => prev.map(a => a.id === agentId ? {
                    ...a,
                    results: finalResults,
                    status: 'SENT',
                    successCount: successMsg,
                    failedCount: failMsg
                } : a));

                // Set last successful tx hash for notification
                const firstSuccess = finalResults.find(r => r.success);
                if (firstSuccess?.hash) {
                    setLastTxHash(firstSuccess.hash);
                }

                // Send notification to user - Batch Complete
                try {
                    const notificationType = failMsg > 0 ? 'multi_send_partial' : 'multi_send_complete';
                    await createNotification(userProfile().email, {
                        type: notificationType,
                        title: failMsg > 0 ? 'Batch Transfer Partial Success' : 'Batch Transfer Complete',
                        content: lastLocale() === 'ko'
                            ? `배치 전송 완료: ${successMsg}개 성공, ${failMsg}개 실패`
                            : `Batch transfer complete: ${successMsg} succeeded, ${failMsg} failed`,
                        data: {
                            agentId,
                            successCount: successMsg,
                            failedCount: failMsg,
                            txHash: firstSuccess?.hash
                        }
                    });
                } catch (notifyErr) {
                    console.warn('[Batch] Completion notification failed:', notifyErr);
                }

                // 4. Send specialized report message
                const report = lastLocale() === 'ko'
                    ? `### 📊 최종 전송 결과 보고서 (Batch ID: ${agentId})\n\n모든 요청의 처리가 완료되었습니다. 상세 내역 및 회계용 자료는 아래 리포트를 확인해 주세요.`
                    : `### 📊 Final Execution Report (Batch ID: ${agentId})\n\nAll requests have been processed. Please check the report below for details and accounting records.`;

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: report,
                    isBatchReport: true,
                    batchReportData: {
                        agentId: agentId,
                        total: transactions.length,
                        success: successMsg,
                        failed: failMsg,
                        results: finalResults
                    }
                }]);

                // 5. Remove from Queue after 60s to allow report viewing
                setTimeout(() => {
                    setBatchAgents(prev => prev.filter(a => a.id !== agentId));
                }, 60000);

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
            } else if (action.type === 'bridge') {
                // Execute Bridge via the separated function
                const bridgeData = action.data as { amount: string; destinationChain: string };
                await executeBridgeIntent(bridgeData);
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

    const loadContacts = async () => {
        const email = auth.user()?.email;
        if (email) {
            try {
                const data = await getUserContacts(email);
                setContacts(data);
            } catch (e) {
                console.warn("Failed to load contacts", e);
            }
        }
    };

    createEffect(() => {
        loadContacts();
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

                // If backend has wallet but local doesn't, check cloud sync
                if (hasBackendWallet && !hasLocalWallet) {
                    console.log("[Wallet] Local wallet missing, checking cloud sync...");

                    // Check if cloud wallet exists (non-blocking)
                    CloudWalletService.hasCloudWallet().then(cloudResult => {
                        if (cloudResult.exists) {
                            console.log("[Wallet] Cloud wallet found! User can restore with password.");
                            setCloudWalletAvailable(true);
                        } else {
                            console.log("[Wallet] No cloud wallet - user must restore from seed phrase.");
                            setCloudWalletAvailable(false);
                        }
                    }).catch(err => {
                        console.warn("[Wallet] Cloud check failed:", err);
                        setCloudWalletAvailable(false);
                    });
                }

                if (hasBackendWallet || hasLocalWallet) {
                    const finalAddress = data.walletAddress || localAddress || '';
                    console.log(`[Profile] Loading address for ${user.email}:`, finalAddress);
                    if (finalAddress) {
                        setWalletAddressSignal(finalAddress);
                    }
                    setOnboardingStep(0);

                    // *** PERFORMANCE: End loading as soon as wallet address is known ***
                    setIsLoading(false);

                    // Update userProfile with verified status if wallet exists anywhere
                    setUserProfile(prev => ({
                        ...prev,
                        isVerified: true,
                        address: finalAddress || prev.address
                    }));
                } else {
                    // Force onboarding if no wallet exists - Redirect to mnemonic generation flow
                    setOnboardingStep(1);
                    setIsLoading(false);
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
                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
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
                console.log("Fetching On-Chain Balances for:", walletAddress());
                const [vcnBalance, ethBalance] = await Promise.all([
                    contractService.getTokenBalance(walletAddress()),
                    contractService.getNativeBalance(walletAddress())
                ]);

                console.log(`On-Chain: VCN=${vcnBalance}, ETH=${ethBalance}`);

                setUserHoldings(prev => ({
                    ...prev,
                    VCN: Number(vcnBalance),
                    ETH: Number(ethBalance)
                }));

                // Also fetch Sepolia wVCN balance
                fetchSepoliaBalance();
            }
        } catch (error) {
            console.error('Failed to fetch portfolio data:', error);
        }
    };

    // Fetch portfolio data only when wallet address changes (avoid duplicate calls)
    createEffect(() => {
        const addr = walletAddress();
        if (auth.user() && addr) {
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
        // Check for send flow - either via modal (activeFlow) or via route (activeView)
        if (activeFlow() === 'send' || activeView() === 'send') {
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

    const handleMultiTransaction = (recipients: { address: string; amount: string; name: string }[]) => {
        // Convert recipients to multi-transaction format and trigger password flow
        const transactions = recipients.map(r => ({
            recipient: r.address, // Use 'recipient' to match handler expectations
            amount: r.amount,
            symbol: selectedToken(),
            name: r.name,
            intent: 'send' // Default to immediate send
        }));
        setMultiTransactions(transactions);
        setPasswordMode('verify');
        setPendingAction({
            type: 'multi_transactions',
            data: { transactions }
        });
        setWalletPassword('');
        setShowPasswordModal(true);
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
            const { address, privateKey } = WalletService.deriveEOA(mnemonic);
            setCurrentPrivateKey(privateKey); // Cache for internal wallet operations
            console.log("[Wallet] NEW ADDRESS DERIVED:", address);

            // 2. Encrypt and Save Locally
            const userEmail = userProfile().email;
            console.log("[Wallet] Saving encrypted wallet for email:", userEmail);
            const encrypted = await WalletService.encrypt(mnemonic, walletPassword());
            WalletService.saveEncryptedWallet(encrypted, userEmail);
            // Verify save worked
            const verifyKey = `vcn_wallet_${btoa(userEmail).substring(0, 16)}`;
            console.log("[Wallet] Verify localStorage key:", verifyKey, "exists:", !!localStorage.getItem(verifyKey));
            // Save address unencrypted for UI consistency (SCOPED)
            WalletService.saveAddressHint(address, userEmail);


            // 3. Update Backend Status
            const user = auth.user();
            if (user && user.email) {
                console.log("[Wallet] Syncing new address to Firebase...");
                await updateWalletStatus(user.email, address, true);
            }

            // 4. Cloud Sync (for cross-browser access) - Non-blocking
            const passwordStrength = calculatePasswordStrength(walletPassword());
            if (passwordStrength.isStrongEnough) {
                CloudWalletService.saveToCloud(mnemonic, walletPassword(), address, userProfile().email)
                    .then(result => {
                        if (result.success) {
                            console.log("[Wallet] Cloud sync successful - wallet accessible from any browser");
                        } else {
                            console.warn("[Wallet] Cloud sync skipped:", result.error);
                        }
                    })
                    .catch(err => console.warn("[Wallet] Cloud sync error (non-critical):", err));
            } else {
                console.log("[Wallet] Password not strong enough for cloud sync - local only");
            }

            // 5. Update User State & Signals
            setWalletAddressSignal(address); // Force update the signal
            setUserProfile(prev => ({
                ...prev,
                isVerified: true,
                tier: 1,
                address: address
            }));
            console.log("[Wallet] Local state updated with new address.");

            // 6. Success state
            setShowPasswordModal(false);
            setIsWalletRestored(isRestoring()); // Track if this was a restoration
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
        setIsWalletRestored(false); // Reset for next time
        navigate('/wallet/assets');
    };

    // Cloud Wallet Restore Handler
    const handleCloudRestore = async () => {
        if (!cloudRestorePassword()) {
            setCloudRestoreError('Please enter your password');
            return;
        }

        try {
            setCloudRestoreLoading(true);
            setCloudRestoreError('');

            const result = await CloudWalletService.loadFromCloud(
                cloudRestorePassword(),
                userProfile().email
            );

            if (result.success && result.mnemonic) {
                console.log('[CloudRestore] Wallet restored successfully from cloud');

                // Update state
                setWalletAddressSignal(result.walletAddress || '');
                const { privateKey } = WalletService.deriveEOA(result.mnemonic);
                setCurrentPrivateKey(privateKey);

                setIsLocalWalletMissing(false);
                setCloudWalletAvailable(false);
                setShowCloudRestoreModal(false);
                setCloudRestorePassword('');

                // Update user profile
                setUserProfile(prev => ({
                    ...prev,
                    isVerified: true,
                    address: result.walletAddress || prev.address
                }));

                // Show success message
                alert('Wallet restored successfully from cloud!');
            } else {
                setCloudRestoreError(result.error || 'Failed to restore wallet');
            }
        } catch (err: any) {
            console.error('[CloudRestore] Error:', err);
            setCloudRestoreError(err.message || 'An error occurred');
        } finally {
            setCloudRestoreLoading(false);
        }
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

    // === Cross-Chain Bridge Confirmation (Request Password) ===
    const handleExecuteBridge = async () => {
        const bridge = pendingBridge();
        if (!bridge || isBridging()) return;

        // Check if local wallet exists
        const encrypted = WalletService.getEncryptedWallet(userProfile().email);
        if (!encrypted) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: lastLocale() === 'ko'
                    ? "로컬 지갑 키를 찾을 수 없습니다. 복구 문구로 지갑을 복원해주세요."
                    : "Local wallet key not found. Please restore your wallet using your recovery phrase."
            }]);
            setPendingBridge(null);
            return;
        }

        // Request password for signing
        setPasswordMode('verify');
        setPendingAction({ type: 'bridge', data: bridge });
        setWalletPassword('');
        setConfirmWalletPassword('');
        setShowPasswordModal(true);
    };

    // === Actual Bridge Execution (After Password Verified) ===
    const executeBridgeIntent = async (bridge: { amount: string; destinationChain: string }) => {
        setIsBridging(true);
        try {
            const userAddr = walletAddress();
            if (!userAddr) {
                throw new Error(lastLocale() === 'ko'
                    ? "지갑 주소를 찾을 수 없습니다."
                    : "Wallet address not found.");
            }

            // Vision Chain Constants
            const VISION_CHAIN_ID = 1337;
            const SEPOLIA_CHAIN_ID = 11155111;
            const PAYMASTER_URL = 'https://paymaster-sapjcm3s5a-uc.a.run.app';

            // Determine destination chain ID
            const chainUpper = bridge.destinationChain.toUpperCase();
            const ethereumKeywords = ['ETHEREUM', 'ETH', 'SEPOLIA', 'ERC-20', 'ERC20', '이더리움', '이더', '세폴리아'];
            const dstChainId = ethereumKeywords.some(kw => chainUpper.includes(kw)) ? SEPOLIA_CHAIN_ID : 137;

            const amountWei = ethers.parseEther(bridge.amount).toString();

            console.log('[Bridge] Calling Paymaster API for gasless bridge...');
            console.log(`[Bridge] User: ${userAddr}, Amount: ${amountWei}, DstChain: ${dstChainId}`);

            // Call Paymaster API to execute bridge (gasless)
            const response = await fetch(PAYMASTER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'bridge',
                    user: userAddr,
                    recipient: userAddr, // Bridge to own wallet on destination chain
                    amount: amountWei,
                    srcChainId: VISION_CHAIN_ID,
                    dstChainId: dstChainId,
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Bridge Paymaster request failed');
            }

            console.log('[Bridge] Paymaster response:', result);

            const resultTxHash = result.lockTxHash || result.commitTxHash;
            const intentHash = result.intentHash;

            // Success message - NO link until bridge is complete
            const chainDisplay = bridge.destinationChain === 'SEPOLIA' ? 'Ethereum Sepolia' : bridge.destinationChain;

            const successMsg = lastLocale() === 'ko'
                ? `브릿지 요청이 성공적으로 제출되었습니다!\n\n**${bridge.amount} VCN** → ${chainDisplay}\n\n약 2분 후 목적지 체인에서 토큰을 수령할 수 있습니다.\n\n에이전트 데스크에서 진행 상태를 확인하세요.`
                : `Bridge request submitted successfully!\n\n**${bridge.amount} VCN** → ${chainDisplay}\n\nTokens will arrive on the destination chain in approximately 2 minutes.\n\nCheck progress in Agent Desk.`;

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: successMsg,
                bridgeTxHash: resultTxHash,
                bridgeDestination: bridge.destinationChain
            }]);

            // Create Bridge Started Notification (English only for testnet)
            try {
                await createNotification(userProfile().email, {
                    type: 'bridge_started',
                    title: 'Bridge Request Started',
                    content: `${bridge.amount} VCN → ${chainDisplay} bridge started. Expected arrival in ~2 minutes.`,
                    data: {
                        amount: bridge.amount,
                        destinationChain: bridge.destinationChain,
                        txHash: resultTxHash,
                        intentHash: intentHash,
                        status: 'pending'
                    }
                });
            } catch (notiErr) {
                console.warn('[Bridge] Notification failed:', notiErr);
            }

            // Save Bridge Transaction to Firestore for History display (client-side backup)
            try {
                const db = getFirebaseDb();
                const txRef = doc(db, 'transactions', resultTxHash);
                await setDoc(txRef, {
                    hash: resultTxHash,
                    from_addr: walletAddress()?.toLowerCase(),
                    to_addr: 'bridge:sepolia', // Special address for bridge
                    value: bridge.amount,
                    timestamp: Date.now(),
                    type: 'Bridge',
                    bridgeStatus: 'LOCKED', // Relayer will update to SUBMITTED → COMPLETED
                    intentHash: intentHash,
                    commitTxHash: result.commitTxHash,
                    lockTxHash: result.lockTxHash,
                    challengeEndTime: Date.now() + (2 * 60 * 1000), // 2 min challenge period
                    metadata: {
                        destinationChain: bridge.destinationChain,
                        srcChainId: 1337,
                        dstChainId: dstChainId
                    }
                });
                console.log('[Bridge] Saved to Firestore for History');
            } catch (historyErr) {
                console.warn('[Bridge] Failed to save history (non-critical):', historyErr);
            }

            setPendingBridge(null);

            // Refresh Sepolia balance after a delay (to catch the arrival)
            setTimeout(() => fetchSepoliaBalance(), 60000);

        } catch (error: any) {
            console.error('[Bridge] Error:', error);
            const errMsg = lastLocale() === 'ko'
                ? `브릿지 실패: ${error.message || '알 수 없는 오류'}`
                : `Bridge failed: ${error.message || 'Unknown error'}`;
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: errMsg
            }]);
        } finally {
            setIsBridging(false);
        }
    };

    const handleCancelBridge = () => {
        setPendingBridge(null);
        const msg = lastLocale() === 'ko' ? '브릿지 요청이 취소되었습니다.' : 'Bridge request cancelled.';
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: msg
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
[User Identity]
Name: ${userProfile().displayName || userProfile().username || 'Vision User'}
ID: ${userProfile().email}

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

[Referral Info]
Referral Code: ${userProfile().referralCode || 'N/A'}
Referral Link: https://www.visionchain.co/wallet?ref=${userProfile().referralCode || ''}
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
If the user wants to execute a transaction (Send, Swap, Schedule, etc.) or navigate to a specific page, you MUST append a JSON block to the end of your response.
For multiple transactions or complex batch sends, use the "multi" intent with a "transactions" array.

Format (Single - Immediate Transfer):
\`\`\`json
{
  "intent": "send",
  "recipient": "0x..." (or name),
  "amount": "100",
  "symbol": "VCN"
}
\`\`\`

Format (Navigation):
If the user wants to go to a specific page or says "Yes" to your suggestion of moving to a screen (like Referral, Assets, etc.):
\`\`\`json
{
  "intent": "navigate",
  "page": "referral" (or "assets", "nodes", "quest", "mint", "settings", "profile")
}
\`\`\`

Format (Single - Scheduled Transfer):
If the user mentions a delay/time (e.g., "8분 뒤에", "in 10 minutes", "after 1 hour"), use:
\`\`\`json
{
  "intent": "schedule",
  "recipient": "0x..." (or name),
  "amount": "100",
  "symbol": "VCN",
  "scheduleTime": "8m"
}
\`\`\`
IMPORTANT: scheduleTime format: use the EXACT number the user specified. Examples: "8m" for 8 minutes, "1h" for 1 hour, "30s" for 30 seconds.

Format (Multi/Batch):
\`\`\`json
{
  "intent": "multi",
  "description": "Short summary",
  "transactions": [
    { "intent": "send", "recipient": "name/addr", "amount": "30", "name": "optional name" },
    { "intent": "send", "recipient": "name/addr", "amount": "50", "name": "optional name" }
  ]
}
\`\`\`
If you detect multiple recipients in one request, ALWAYS use the "multi" format.

Format (Cross-Chain Bridge):
If the user wants to send assets to another blockchain (Ethereum, Sepolia, Polygon, etc.), use the BRIDGE intent.
Keywords that indicate bridge: "세폴리아", "이더리움", "폴리곤", "Sepolia", "Ethereum", "Polygon", "다른 체인", "브릿지", "bridge", "크로스체인"

IMPORTANT: When user says "세폴리아로 보내줘" or "Sepolia로 전송" WITHOUT specifying a recipient address, this means BRIDGE to their OWN wallet on the destination chain (same address). Do NOT ask for recipient address.

\`\`\`json
{
  "intent": "bridge",
  "amount": "100",
  "symbol": "VCN",
  "destinationChain": "SEPOLIA"
}
\`\`\`
Valid destinationChain values: "SEPOLIA", "ETHEREUM", "POLYGON"
Note: Bridge transfers are from Vision Chain to the user's own wallet on the destination chain.

[REFERRAL GUIDELINE]
If the user asks about inviting friends, missions, or rewards, explain that they can share their referral link to earn rewards. 
Ask: "Would you like to move to the referral page now to check your link and rewards?"
If they say "Yes", output the navigate intent JSON for "referral".
\`\`
`;


            setThinkingSteps(prev => [
                ...prev.map(s => ({ ...s, status: 'completed' as const })),
                { id: '2', label: 'Processing Request...', status: 'loading' }
            ]);

            // Start timing the AI response
            const startTime = performance.now();

            // --- Streaming Response with Typing Effect ---
            // Use separate streamingContent signal (not in messages array)
            // This allows Thinking Process to appear ABOVE the streaming content
            setStreamingContent('');

            // Buffer for typing effect
            let fullBuffer = '';
            let displayedLength = 0;
            let typingInterval: any = null;

            // Start typing animation at human-like pace (~30 chars/sec for readability)
            const startTypingEffect = () => {
                if (typingInterval) return;
                typingInterval = setInterval(() => {
                    if (displayedLength < fullBuffer.length) {
                        // Type 1-2 characters at a time for slower, more natural feel
                        const charsToAdd = Math.min(2, fullBuffer.length - displayedLength);
                        displayedLength += charsToAdd;
                        const displayText = fullBuffer.slice(0, displayedLength);
                        setStreamingContent(displayText);
                    }
                }, 35); // ~30 chars per second - slower, more human-like
            };

            // Filter out <think> tags from displayed content
            const filterThinkTags = (text: string): string => {
                return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            };

            // Parse thinking steps from raw text in real-time
            const parseThinkingStepsRealtime = (text: string) => {
                const thoughtRegex = /<think>([\s\S]*?)<\/think>/g;
                const steps: any[] = [];
                let match;
                while ((match = thoughtRegex.exec(text)) !== null) {
                    const content = match[1];
                    const parts = content.split(':');
                    steps.push({
                        id: crypto.randomUUID(),
                        label: parts[0]?.trim() || 'Thinking Process',
                        detail: parts[1]?.trim() || '',
                        status: 'completed'
                    });
                }
                if (steps.length > 0) {
                    setThinkingSteps(steps);
                }
            };

            let response: string = await generateTextStream(
                fullPrompt,
                (chunk, fullText) => {
                    // Parse and display thinking steps in real-time
                    parseThinkingStepsRealtime(fullText);

                    // Buffer filtered content (without think tags) for typing effect
                    fullBuffer = filterThinkTags(fullText);

                    // Start typing effect on first chunk
                    if (!typingInterval && fullBuffer.length > 0) startTypingEffect();
                },
                imageBase64,
                'intent',
                userProfile().email,
                messages().slice(0, -1) // Exclude the placeholder message
            );

            // Wait for typing to finish displaying
            await new Promise<void>(resolve => {
                const finishInterval = setInterval(() => {
                    if (displayedLength >= fullBuffer.length) {
                        clearInterval(finishInterval);
                        if (typingInterval) clearInterval(typingInterval);
                        resolve();
                    }
                }, 50);
            });

            // Clear streaming content and add final message to messages array
            setStreamingContent('');

            // Calculate response time
            const responseTime = Math.round(performance.now() - startTime);

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
                // Note: thinkingSteps will be cleared before final message is added
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
                    console.log("[AI] Found multiple JSON matches, checking for duplicates...");
                    const wrappedTransactions = genericMatches.map(str => {
                        try { return JSON.parse(str); } catch { return null; }
                    }).filter(Boolean);

                    // DEDUPLICATION: Remove identical intents (AI sometimes outputs same JSON twice)
                    const uniqueTransactions = wrappedTransactions.filter((tx, index, self) => {
                        const key = `${tx.recipient || tx.address || ''}|${tx.amount || ''}|${tx.intent || ''}`;
                        return index === self.findIndex(t => {
                            const tKey = `${t.recipient || t.address || ''}|${t.amount || ''}|${t.intent || ''}`;
                            return tKey === key;
                        });
                    });

                    console.log(`[AI] Deduplicated: ${wrappedTransactions.length} -> ${uniqueTransactions.length} transactions`);

                    if (uniqueTransactions.length === 1) {
                        // Single unique intent - don't wrap as multi
                        intentData = uniqueTransactions[0];
                    } else if (uniqueTransactions.length > 1) {
                        intentData = {
                            intent: 'multi',
                            transactions: uniqueTransactions,
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

            // 2. Process Intent if detected
            if (intentData) {
                console.log("[AI Intent Processing]", intentData);

                // Helper: Resolve all names to addresses (Check Contacts + VNS)
                const resolveAllRecipients = async (data: any) => {
                    const resolveSingle = async (rec: string) => {
                        if (!rec) return { address: '', name: 'New Recipient' };

                        const allContacts = contacts() || [];

                        // If it's already an address, check if it's in contacts to get a name
                        if (ethers.isAddress(rec)) {
                            const local = allContacts.find((c: any) => c.address?.toLowerCase() === rec.toLowerCase());
                            return { address: rec, name: (local?.internalName || local?.name) || 'New Recipient' };
                        }

                        // 1st: Check local contacts by name
                        const nameToResolve = String(rec || '');
                        const cleanName = nameToResolve.replace('@', '').toLowerCase();
                        const local = allContacts.find((c: any) =>
                            (c.internalName?.toLowerCase() === cleanName) ||
                            (c.name?.toLowerCase() === cleanName) ||
                            (c.alias?.toLowerCase() === cleanName)
                        );
                        if (local) return { address: local.address, name: local.internalName || local.name };

                        // 2nd: Check global registry (VNS)
                        const global = await resolveRecipient(rec, userProfile().email);
                        if (global && global.address) {
                            return { address: global.address, name: global.name || rec };
                        }

                        return { address: rec, name: 'New Recipient' };
                    };

                    if (intentData.intent === 'multi' && Array.isArray(intentData.transactions)) {
                        for (let tx of intentData.transactions) {
                            const resolved = await resolveSingle(tx.recipient);
                            tx.recipient = resolved.address;
                            if (!tx.name || tx.name === 'New Recipient') tx.name = resolved.name;
                        }
                    } else if (intentData.recipient) {
                        const resolved = await resolveSingle(intentData.recipient);
                        intentData.recipient = resolved.address;
                        intentData.name = resolved.name;
                    }
                };

                await resolveAllRecipients(intentData);

                // FLOW ROUTING: Single vs Scheduled vs Multi vs Navigate
                if (intentData.intent === 'navigate' && intentData.page) {
                    const targetPage = intentData.page.toLowerCase();
                    const validPages = ['referral', 'assets', 'nodes', 'quest', 'campaign', 'mint', 'settings', 'profile', 'history', 'contacts'];

                    if (validPages.includes(targetPage)) {
                        const displayPage = targetPage === 'campaign' ? 'quest' : targetPage;
                        navigate(`/wallet/${displayPage}`);

                        const msg = lastLocale() === 'ko'
                            ? `${displayPage} 화면으로 이동합니다.`
                            : `Moving you to the ${displayPage} page.`;

                        setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: msg
                        }]);
                        setThinkingSteps([]);
                        setStreamingContent('');
                        setChatLoading(false);
                        return;
                    }
                }

                if (intentData.intent === 'multi' && Array.isArray(intentData.transactions)) {
                    // Route to Enterprise Batch Transfer Agent
                    const results = intentData.transactions.map((tx: any) => ({
                        ...tx,
                        amount: String(tx.amount || '0'),
                        symbol: tx.symbol || 'VCN'
                    }));
                    setMultiTransactions(results);
                    setReviewMulti(results);

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: lastLocale() === 'ko'
                            ? `요청하신 ${results.length}건의 Batch Transaction 내역을 정리했습니다. 전송계획을 확인해주세요.`
                            : `I've organized the ${results.length} Batch Transactions for you. Please check the transfer plan.`,
                        isMultiReview: true,
                        batchData: results
                    }]);
                    setThinkingSteps([]);
                    setStreamingContent('');
                    setChatLoading(false);
                    return;

                } else if (intentData.intent === 'send' || intentData.intent === 'schedule') {
                    // Determine if it's a scheduled transfer
                    const hasSchedule = intentData.intent === 'schedule' || intentData.scheduleTime || intentData.time;

                    setRecipientAddress((intentData as any).recipient || '');
                    setSendAmount(String((intentData as any).amount || '0').replace(/[^0-9.]/g, ''));
                    setSelectedToken((intentData as any).symbol || 'VCN');

                    if (hasSchedule) {
                        setIsSchedulingTimeLock(true);
                        // Parse delay - improved extraction
                        let delay = 300; // default 5 minutes
                        const rawTimeValue = (intentData as any).scheduleTime || (intentData as any).time || (intentData as any).delay || '';
                        const timeStr = String(rawTimeValue).toLowerCase();

                        // Extract numeric value using regex (handles "8분", "8m", "8 minutes", "30초", "1시간", etc.)
                        const numMatch = timeStr.match(/(\d+)/);
                        const num = numMatch ? parseInt(numMatch[1]) : 5;

                        // Determine time unit
                        if (timeStr.includes('h') || timeStr.includes('시간')) {
                            delay = num * 3600; // hours
                        } else if (timeStr.includes('s') || timeStr.includes('초')) {
                            delay = num; // seconds
                        } else {
                            delay = num * 60; // default to minutes (분, m, min, minutes)
                        }
                        setLockDelaySeconds(delay);
                    } else {
                        setIsSchedulingTimeLock(false);
                    }

                    startFlow('send');
                    if (intentData.recipient && intentData.amount) setFlowStep(2); // Skip to Confirmation

                } else if (intentData.intent === 'bridge') {
                    // Cross-Chain Bridge Intent - Execute directly without confirmation
                    const bridgeData = {
                        amount: String(intentData.amount || '0'),
                        symbol: intentData.symbol || 'VCN',
                        destinationChain: intentData.destinationChain || 'SEPOLIA',
                        intentData: intentData
                    };

                    // Show bridge starting message
                    const chainDisplay = bridgeData.destinationChain === 'SEPOLIA' ? 'Ethereum Sepolia' : bridgeData.destinationChain;
                    const startMsg = lastLocale() === 'ko'
                        ? `크로스체인 브릿지 요청을 확인했습니다.\n\n**${bridgeData.amount} ${bridgeData.symbol}**을 Vision Chain → **${chainDisplay}**로 전송합니다.\n\n브릿지 에이전트가 처리 중입니다...`
                        : `Cross-chain bridge request confirmed.\n\nBridging **${bridgeData.amount} ${bridgeData.symbol}** from Vision Chain → **${chainDisplay}**.\n\nBridge agent is processing...`;

                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: startMsg,
                    }]);
                    setThinkingSteps([]);
                    setStreamingContent('');
                    setChatLoading(false);

                    // Execute bridge directly (no confirmation dialog)
                    setTimeout(() => {
                        executeBridgeIntent(bridgeData);
                    }, 500);
                    return;
                }
            }

            // 3. Finalize Assistant Response Message
            let cleanResponse = response.replace(/\{[\s\S]*?"intent"[\s\S]*?\}/g, "").trim();
            cleanResponse = cleanResponse.replace(/```json[\s\S]*?```/g, "").trim();
            cleanResponse = cleanResponse.replace(/```[\s\S]*?```/g, "").trim();

            if (!cleanResponse && intentData) {
                const intentMap: any = {
                    ko: { send: '송금', multi: '대량 송금', schedule: '예약 송금', bridge: '크로스체인 브릿지' },
                    en: { send: 'transfer', multi: 'batch transfer', schedule: 'scheduled transfer', bridge: 'cross-chain bridge' }
                };
                const localized = (intentMap[lastLocale()] || intentMap.en)[intentData.intent] || '업무';
                cleanResponse = lastLocale() === 'ko'
                    ? `요청하신 ${localized}를 준비했습니다. 화면을 확인해 주세요.`
                    : `I've prepared the ${localized} for you. Please check your screen.`;
            }

            // Clear thinking steps BEFORE adding final message
            // This ensures the message appears AFTER thinking visually completes
            setThinkingSteps([]);

            setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse, responseTime }]);

            // SAVE CONVERSATION
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
                        lastMessage: cleanResponse,
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
            console.error('AI Chat Error:', error);
            const errMsg = lastLocale() === 'ko' ? "처리 중 오류가 발생했습니다. 다시 시도해 주세요." : "An error occurred. Please try again.";
            setMessages(prev => [...prev, { role: 'assistant', content: errMsg }]);
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
        console.log("[Restore] About to show password modal...");
        setShowPasswordModal(true);
        console.log("[Restore] Password modal should be visible now. showPasswordModal:", true);
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
                <section class="bg-[#0a0a0b] h-[100dvh] flex overflow-hidden">

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
                                class="absolute left-0 top-1/2 -translate-y-1/2 w-[28px] h-[100px] bg-blue-950/90 border-2 border-blue-400/60 border-l-0 rounded-r-2xl backdrop-blur-xl shadow-[0_0_40px_rgba(59,130,246,0.9),0_0_20px_rgba(59,130,246,0.7)] flex items-center justify-center transition-all duration-300 group-hover:w-[36px] group-hover:bg-blue-900 group-hover:border-blue-300/80 group-hover:shadow-[0_0_60px_rgba(59,130,246,1),0_0_30px_rgba(96,165,250,0.9)] animate-pulse"
                            >
                                <div class="flex flex-col gap-1.5 items-center">
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-300 group-hover:bg-white group-hover:scale-125 transition-all duration-300 shadow-[0_0_12px_rgba(147,197,253,1)]" />
                                    <div class="w-1.5 h-4 rounded-full bg-blue-400 group-hover:bg-white group-hover:h-6 transition-all duration-300 shadow-[0_0_15px_rgba(96,165,250,1)]" />
                                    <div class="w-1.5 h-1.5 rounded-full bg-blue-300 group-hover:bg-white group-hover:scale-125 transition-all duration-300 shadow-[0_0_12px_rgba(147,197,253,1)]" />
                                </div>
                                <ChevronRight class="w-3.5 h-3.5 text-blue-200 group-hover:text-white transition-colors ml-0.5 animate-pulse" />
                            </div>
                        </div>
                    </Show>

                    {/* Main Content Area */}
                    <main class={`flex-1 flex flex-col h-[100dvh] overflow-hidden transition-all duration-300 relative ml-0 lg:ml-[280px] w-full ${onboardingStep() === 0 ? 'pb-[68px] lg:pb-0' : ''}`}>


                        {/* Chat View - Always mounted, CSS-hidden when not active for instant switching */}
                        <div class={`h-full ${activeView() === 'chat' ? '' : 'hidden'}`}>
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
                                streamingContent={streamingContent}
                                voiceLang={voiceLang}
                                setVoiceLang={setVoiceLang}
                                toggleRecording={toggleRecording}
                                isRecording={isRecording}
                                // Queue Integration (Time-lock Agent)
                                queueTasks={queueTasks}
                                bridgeTasks={bridgeTasks}
                                onCancelTask={handleCancelTask}
                                onDismissTask={handleDismissTask}
                                onForceExecute={handleForceExecute}
                                onRetryTask={handleRetryTask}
                                isScheduling={isSchedulingTimeLock()}
                                chatHistoryOpen={chatHistoryOpen()}
                                setChatHistoryOpen={setChatHistoryOpen}
                                batchAgents={batchAgents}
                                reviewMulti={reviewMulti}
                                setReviewMulti={setReviewMulti}
                                unreadCount={0}
                                contacts={contacts}
                                showResponseTime={showResponseTime()}
                                walletAddress={walletAddress}
                                userEmail={auth.user()?.email || undefined}
                                onStartBatch={(txs, interval) => {
                                    console.log("Starting batch with txs:", txs, "interval:", interval);
                                    setPendingAction({
                                        type: 'multi_transactions',
                                        data: { transactions: txs, interval: interval }
                                    });
                                    setPasswordMode('verify');
                                    setWalletPassword('');
                                    setShowPasswordModal(true);
                                }}
                                // Bridge Integration
                                pendingBridge={pendingBridge}
                                isBridging={isBridging}
                                onExecuteBridge={handleExecuteBridge}
                                onCancelBridge={handleCancelBridge}
                            />
                        </div>

                        {/* Quest (formerly Campaign) View */}
                        <Show when={activeView() === 'campaign' || activeView() === 'quest'}>
                            <WalletCampaign userProfile={userProfile} onNavigate={(view: string) => navigate(`/wallet/${view}`)} />
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

                        {/* Bridge View */}
                        <Show when={activeView() === 'bridge'}>
                            <div class="flex-1 overflow-y-auto custom-scrollbar">
                                <Bridge walletAddress={walletAddress} privateKey={currentPrivateKey} userEmail={() => userProfile()?.email || ''} />
                            </div>
                        </Show>

                        {/* Staking View */}
                        <Show when={activeView() === 'staking'}>
                            <div class="flex-1 overflow-y-auto custom-scrollbar">
                                <ValidatorStaking walletAddress={walletAddress} privateKey={currentPrivateKey} userEmail={() => userProfile()?.email || ''} />
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
                                cloudWalletAvailable={cloudWalletAvailable()}
                                onRestoreWallet={() => {
                                    navigate('/wallet/profile');
                                    setOnboardingStep(2);
                                }}
                                onCloudRestore={() => {
                                    setShowCloudRestoreModal(true);
                                }}
                                walletAddress={walletAddress}
                                contacts={contacts()}
                                sepoliaVcnBalance={sepoliaVcnBalance}
                                ethMainnetBalance={ethMainnetBalance}
                                polygonBalance={polygonBalance}
                                baseBalance={baseBalance}
                                polygonAmoyBalance={polygonAmoyBalance}
                                baseSepoliaBalance={baseSepoliaBalance}
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
                                onMultiTransaction={handleMultiTransaction}
                                flowStep={flowStep}
                                setFlowStep={setFlowStep}
                                flowLoading={flowLoading}
                                resetFlow={() => { resetFlow(); navigate('/wallet/assets'); }}
                                walletAddress={walletAddress}
                                lastTxHash={lastTxHash}
                                contacts={contacts}
                                userProfile={userProfile}
                                onContactAdded={loadContacts}
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

                                                    <div class="p-8 space-y-6 overflow-hidden">
                                                        <div>
                                                            <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 px-1">Recovery Phrase</label>
                                                            <textarea
                                                                spellcheck={false}
                                                                rows="4"
                                                                placeholder="Enter 15 words separated by spaces..."
                                                                value={restoringMnemonic()}
                                                                onInput={(e) => setRestoringMnemonic(e.currentTarget.value)}
                                                                autofocus
                                                                class="w-full max-w-full box-border bg-white/[0.03] border border-white/[0.08] rounded-2xl py-5 px-6 text-white placeholder:text-gray-600 outline-none focus:border-cyan-500/50 transition-all font-mono text-base resize-none leading-relaxed relative z-20"
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
                                                        <h2 class="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">
                                                            {isWalletRestored() ? 'Wallet Restored' : 'Account Created'}
                                                        </h2>
                                                        <p class="text-gray-400 font-medium text-sm md:text-base">
                                                            {isWalletRestored()
                                                                ? 'Your wallet has been successfully restored from your recovery phrase'
                                                                : 'Your Vision Chain Account has been successfully created'}
                                                        </p>
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
                                                                    <span class="text-[10px] md:text-xs text-gray-400 shrink-0">
                                                                        {isWalletRestored() ? 'Restored:' : 'Created:'}
                                                                    </span>
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
                                userProfile={userProfile}
                                contacts={contacts}
                                onContactAdded={loadContacts}
                            />
                        </Presence>
                        {/* Mobile Bottom Navigation - Hidden in Chat */}
                        <Show when={activeView() !== 'chat'}>
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
                        </Show>
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
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <Motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    class="relative w-[90vw] max-w-[420px] bg-[#27272a] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl mx-auto"
                                    onClick={(e) => e.stopPropagation()}
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
                                                    class="flex-1 min-w-0 w-full box-border bg-[#0d0d0f] border border-white/20 rounded-2xl py-4 px-14 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-center tracking-widest shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] text-base"
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
                                                        class="flex-1 min-w-0 w-full box-border bg-[#0d0d0f] border border-white/20 rounded-2xl py-4 px-14 text-white placeholder:text-gray-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-center tracking-widest shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] text-base"
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

                        {/* Cloud Wallet Restore Modal */}
                        <Show when={showCloudRestoreModal()}>
                            <Motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                class="fixed inset-0 z-[60] flex items-center justify-center px-4"
                            >
                                <div
                                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                                    onClick={() => setShowCloudRestoreModal(false)}
                                />

                                <Motion.div
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    class="relative w-full max-w-md bg-[#111113] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                                >
                                    {/* Header */}
                                    <div class="p-8 pb-6 text-center">
                                        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center border border-blue-500/30">
                                            <svg class="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                                            </svg>
                                        </div>
                                        <h2 class="text-2xl font-black text-white mb-2">Restore from Cloud</h2>
                                        <p class="text-sm text-gray-400">
                                            Enter your wallet password to restore your wallet from the cloud.
                                        </p>
                                    </div>

                                    {/* Form */}
                                    <div class="px-6 pb-6 space-y-4">
                                        <div>
                                            <label class="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                Wallet Password
                                            </label>
                                            <input
                                                type="password"
                                                value={cloudRestorePassword()}
                                                onInput={(e) => setCloudRestorePassword(e.currentTarget.value)}
                                                onKeyPress={(e) => e.key === 'Enter' && handleCloudRestore()}
                                                placeholder="Enter your password"
                                                class="w-full px-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                                            />
                                        </div>

                                        {/* Error Message */}
                                        <Show when={cloudRestoreError()}>
                                            <div class="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                                                <p class="text-sm text-red-400">{cloudRestoreError()}</p>
                                            </div>
                                        </Show>

                                        {/* Info */}
                                        <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                            <p class="text-xs text-blue-300/80">
                                                Your wallet is protected by double encryption. Only you can decrypt it with your password.
                                            </p>
                                        </div>

                                        {/* Buttons */}
                                        <div class="flex gap-3 pt-2">
                                            <button
                                                onClick={() => {
                                                    setShowCloudRestoreModal(false);
                                                    setCloudRestorePassword('');
                                                    setCloudRestoreError('');
                                                }}
                                                class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleCloudRestore}
                                                disabled={!cloudRestorePassword() || cloudRestoreLoading()}
                                                class="flex-[2] py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Show when={cloudRestoreLoading()} fallback="Restore Wallet">
                                                    <RefreshCw class="w-4 h-4 animate-spin" />
                                                    Restoring...
                                                </Show>
                                            </button>
                                        </div>
                                    </div>
                                </Motion.div>
                            </Motion.div>
                        </Show>
                        {/* Profile Image Crop Modal */}
                        <Show when={isCropping()}>
                            <Motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                class="fixed inset-0 z-[100] flex items-center justify-center px-4"
                            >
                                <div class="absolute inset-0 bg-black/90 backdrop-blur-md" />

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
