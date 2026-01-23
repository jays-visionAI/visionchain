import { createSignal, Show, For, onMount, createEffect, Switch, Match, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
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
    LogOut
} from 'lucide-solid';
import {
    updateWalletStatus,
    getUserPurchases,
    getUserData,
    VcnPurchase
} from '../services/firebaseService';
import { WalletService } from '../services/walletService';
import AIChat from './AIChat';
import { generateText } from '../services/geminiService';
import { useAuth } from './auth/authContext';
import { contractService } from '../services/contractService';
import { useNavigate } from '@solidjs/router';

type ViewType = 'chat' | 'assets' | 'campaign' | 'mint' | 'profile' | 'settings' | 'contacts' | 'nodes';

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
    const [showChat, setShowChat] = createSignal(false);
    const [assetsTab, setAssetsTab] = createSignal('portfolio');
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
        address: ''
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
    const [contacts, setContacts] = createSignal([
        { id: 1, name: 'Alex Rivers', address: '0x742d...44e', avatar: 'AR', isUser: true, isFavorite: true },
        { id: 2, name: 'Sarah Chen', address: '0x123c...89a', avatar: 'SC', isUser: true, isFavorite: true },
        { id: 3, name: 'Jordan Smith', address: '0x987b...55d', avatar: 'JS', isUser: false, isFavorite: false },
        { id: 4, name: 'Elena Vance', address: '0x456e...22b', avatar: 'EV', isUser: true, isFavorite: false },
    ]);
    const [sidebarOpen, setSidebarOpen] = createSignal(false);
    const [input, setInput] = createSignal('');
    const [isLoading, setIsLoading] = createSignal(false);
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
        if (!WalletService.hasWallet()) {
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
            setIsLoading(true);
            setShowPasswordModal(false);

            if (action.type === 'purchase_node') {
                const nodeType = action.data as 'Validator' | 'Enterprise';
                console.log(`Executing internal purchase for ${nodeType}...`);

                // 1. Decrypt Mnemonic
                const encrypted = WalletService.getEncryptedWallet();
                if (!encrypted) throw new Error("No encrypted wallet found locally.");

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

                alert(`Successfully deployed ${nodeType} Node! Tx: ${receipt.hash}`);
            } else if (action.type === 'send_tokens') {
                const { amount, recipient, symbol } = action.data;
                setFlowLoading(true);

                // 1. Decrypt Mnemonic
                const encrypted = WalletService.getEncryptedWallet();
                const mnemonic = await WalletService.decrypt(encrypted!, walletPassword());
                const { privateKey } = WalletService.deriveEOA(mnemonic);

                // 2. Connect Internal Wallet
                await contractService.connectInternalWallet(privateKey);

                // 3. Execute Send
                if (symbol === 'VCN') {
                    // Use Paymaster (Gasless) Logic for VCN
                    const result = await contractService.sendGaslessTokens(recipient, amount);
                    console.log("✅ Gasless Send Successful (Fee 1 VCN):", result);
                } else {
                    // Standard Send for ETH/Other
                    const receipt = await contractService.sendTokens(recipient, amount, symbol);
                    console.log("Send Transaction Successful:", receipt.hash);
                }

                setFlowSuccess(true);
                setFlowStep(3);
            } else if (action.type === 'claim_rewards') {
                // 1. Decrypt Mnemonic
                const encrypted = WalletService.getEncryptedWallet();
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
            setPendingAction(null);
            setWalletPassword('');
        }
    };

    const claimNodeRewards = async () => {
        if (!WalletService.hasWallet()) return;

        setPasswordMode('verify');
        setPendingAction({ type: 'claim_rewards' });
        setWalletPassword('');
        setShowPasswordModal(true);
    };

    // User's token holdings (balance only)
    // User's actual holdings (will be updated via fetchPortfolioData)
    const [userHoldings, setUserHoldings] = createSignal({
        VCN: 0,
        ETH: 0,
        USDC: 0
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
        fetchMarketData();
        // Auto-open sidebar only on desktop
        if (window.innerWidth >= 1024) {
            setSidebarOpen(true);
        }
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
                    address: data.walletAddress || ''
                });

                // Check if wallet exists in backend OR locally
                const hasBackendWallet = !!data.walletAddress;
                // Try to get address from local storage if not in profile
                const localAddress = localStorage.getItem('vcn_wallet_address');
                const hasLocalWallet = WalletService.hasWallet();

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
                if (WalletService.hasWallet()) {
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

            // Update userHoldings with total VCN for portfolio value calculation
            setUserHoldings(prev => ({ ...prev, VCN: total }));
        } catch (error) {
            console.error('Failed to fetch portfolio data:', error);
        }
    };

    onMount(() => {
        fetchPortfolioData();
    });

    createEffect(() => {
        if (auth.user()) {
            fetchPortfolioData();
        }
    });

    const getAssetData = (symbol: string): AssetData => {
        const balance = (userHoldings() as any)[symbol] || 0;

        // Use static/mock prices for stability
        const staticPrices: Record<string, { name: string, price: number, image?: string }> = {
            'VCN': { name: 'Vision Chain', price: 0.375 },
            'ETH': { name: 'Ethereum', price: 3200.00 },
            'USDC': { name: 'USDC', price: 1.00 }
        };

        const config = staticPrices[symbol] || { name: symbol, price: 0 };

        return {
            symbol,
            name: config.name,
            balance,
            image: null,
            price: config.price,
            change24h: 0,
            sparkline: [config.price, config.price, config.price],
            isLoading: false
        };
    };

    const totalValue = () => {
        let total = 0;
        ['VCN', 'ETH', 'USDC'].forEach(symbol => {
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

    const startFlow = (flow: 'send' | 'receive' | 'swap' | 'stake') => {
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
                    amount: sendAmount(),
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
            const newContacts = [
                { id: Date.now(), name: 'Sam Taylor', address: '0x321a...88b', avatar: 'ST', isUser: false, isFavorite: false },
                { id: Date.now() + 1, name: 'Lisa Ray', address: '0x654f...11c', avatar: 'LR', isUser: true, isFavorite: false },
            ];
            setContacts([...contacts(), ...newContacts]);
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
            WalletService.saveEncryptedWallet(encrypted);
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

    const resetFlow = () => {
        setActiveFlow(null);
        setFlowStep(1);
        setFlowLoading(false);
        setFlowSuccess(false);
        setSendAmount('');
        setSwapAmount('');
        setRecipientAddress('');
    };

    const handleSend = async () => {
        if (!input().trim() || isLoading()) return;

        const userMessage = input().trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setIsLoading(true);

        try {
            // Construct context from wallet state
            const context = `
Current Portfolio Summary:
Total Value: ${totalValueStr()}
Holdings:
${tokens().map((t: any) => `- ${t.symbol}: ${t.balance} (${t.value})`).join('\n')}
`;
            const fullPrompt = `${context}\n\nUser Question: ${userMessage}\n\nPlease answer the user's question based on their portfolio context if relevant. keep it concise.`;

            const response = await generateText(fullPrompt);
            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (error) {
            console.error('AI Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: "I apologize, but I'm unable to connect to the Vision network right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestion = (text: string) => {
        setInput(text);
    };

    const startNewChat = () => {
        setMessages([]);
        setActiveView('chat');
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

    const menuItems = [
        { id: 'chat' as ViewType, label: 'Chat', icon: Sparkles },
        { id: 'assets' as ViewType, label: 'My Assets', icon: PieChart },
        { id: 'nodes' as ViewType, label: 'Nodes', icon: Camera }, // New Nodes View
        { id: 'campaign' as ViewType, label: 'Campaign', icon: Zap },
        { id: 'mint' as ViewType, label: 'Mint', icon: Plus },
        { id: 'contacts' as ViewType, label: 'Address Book', icon: Users },
        { id: 'profile' as ViewType, label: 'Profile', icon: User },
        { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
    ];

    return (
        <Show when={!auth.loading() && !isLoading()} fallback={
            <div class="fixed inset-0 bg-[#0a0a0b] flex items-center justify-center z-[100]">
                <div class="flex flex-col items-center gap-4">
                    <div class="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                    <div class="text-white text-sm font-bold tracking-widest animate-pulse">LOADING WALLET</div>
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

                {/* Sidebar Overlay (Mobile) */}
                <Presence>
                    <Show when={sidebarOpen()}>
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            class="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden pointer-events-auto"
                        />
                    </Show>
                </Presence>

                {/* Left Sidebar */}
                <Presence>
                    <Show when={sidebarOpen()}>
                        <Motion.aside
                            initial={{ x: -280, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: -280, opacity: 0 }}
                            transition={{ duration: 0.3, easing: [0.25, 0.1, 0.25, 1] }}
                            class="w-[280px] h-[calc(100vh-56px)] bg-[#111113]/95 lg:bg-[#111113]/80 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col fixed left-0 top-14 z-40 lg:z-30 shadow-2xl lg:shadow-none overflow-y-auto"
                        >
                            {/* Logo Area */}
                            <div class="p-5 border-b border-white/[0.06] flex items-center justify-between">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                        <Sparkles class="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <div class="font-semibold text-white text-[15px]">Vision AI</div>
                                        <div class="text-xs text-gray-500">Wallet Assistant</div>
                                    </div>
                                </div>
                                {/* Mobile Close Button */}
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    class="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <Plus class="w-5 h-5 text-gray-400 rotate-45" />
                                </button>
                            </div>



                            {/* AI Architect Button (Global) */}
                            <div class="px-4 pb-2">
                                <button
                                    onClick={() => setShowChat(true)}
                                    disabled={onboardingStep() > 0}
                                    class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400 rounded-xl text-white font-medium transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    <Sparkles class="w-4 h-4 text-purple-200" />
                                    AI Architect
                                </button>
                            </div>

                            {/* Navigation */}
                            <nav class="flex-1 px-3 py-2 space-y-1">
                                <For each={menuItems}>
                                    {(item) => (
                                        <button
                                            onClick={() => {
                                                if (onboardingStep() === 0) setActiveView(item.id);
                                            }}
                                            disabled={onboardingStep() > 0 && item.id !== 'profile'}
                                            class={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all group bg-transparent border-none cursor-pointer ${activeView() === item.id
                                                ? 'bg-white/[0.08] text-white shadow-lg shadow-black/20'
                                                : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                                                } ${onboardingStep() > 0 && item.id !== 'profile' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                            style={{ background: activeView() === item.id ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                                        >
                                            <div class={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${activeView() === item.id
                                                ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20'
                                                : 'bg-white/[0.03] group-hover:bg-white/[0.06]'
                                                }`}
                                                style={{ background: activeView() === item.id ? 'linear-gradient(to bottom right, rgba(59,130,246,0.2), rgba(6,182,212,0.2))' : 'rgba(255,255,255,0.03)' }}
                                            >
                                                <item.icon class={`w-4 h-4 ${activeView() === item.id ? 'text-cyan-400' : ''}`} />
                                            </div>
                                            <span class="font-medium text-[14px]">{item.label}</span>
                                            <Show when={activeView() === item.id}>
                                                <div class="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                            </Show>
                                        </button>
                                    )}
                                </For>
                            </nav>

                            {/* Wallet Card */}
                            <div class="p-4 border-t border-white/[0.06]">
                                <div class="relative overflow-hidden p-4 bg-gradient-to-br from-white/[0.04] to-white/[0.02] rounded-2xl border border-white/[0.06]">
                                    {/* Logout button moved to bottom */}
                                    <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/10 to-transparent rounded-full blur-2xl" />
                                    <div class="relative flex items-center gap-3">
                                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                            <WalletIcon class="w-5 h-5 text-white" />
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Logged in as</div>
                                            <div class="text-[12px] font-bold text-white truncate mb-1" title={userProfile().email}>
                                                {userProfile().email || 'Loading...'}
                                            </div>
                                            <div class="flex items-center gap-1.5 pt-1.5 border-t border-white/10">
                                                <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                                <span class="text-[11px] text-gray-400 font-mono">{shortAddress() || 'Not Created'}</span>
                                                <Show when={shortAddress()}>
                                                    <button onClick={copyAddress} class="p-1 hover:bg-white/10 rounded-md transition-colors ml-auto">
                                                        <Show when={copied()} fallback={<Copy class="w-3 h-3 text-gray-500" />}>
                                                            <Check class="w-3 h-3 text-green-400" />
                                                        </Show>
                                                    </button>
                                                </Show>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Big Red Logout Button (Admin Style) */}
                                    <button
                                        onClick={() => auth.logout()}
                                        class="w-full flex items-center justify-center gap-2 mt-4 px-4 py-2.5 rounded-xl border border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-500/80 hover:text-red-500 transition-all duration-300 group"
                                    >
                                        <LogOut class="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        <span class="font-bold text-[11px] uppercase tracking-wider">Logout Session</span>
                                    </button>
                                </div>
                            </div>
                        </Motion.aside>
                    </Show>
                </Presence>

                {/* Main Content Area */}
                <main class={`flex-1 flex flex-col h-[calc(100vh-56px)] transition-all duration-300 relative ${sidebarOpen() ? 'lg:ml-[280px]' : 'ml-0'}`}>

                    {/* Top Bar */}
                    <div class="flex items-center gap-4 px-5 py-3.5 border-b border-white/[0.06] bg-[#0a0a0b]/80 backdrop-blur-xl sticky top-14 z-20">
                        <button
                            onClick={() => {
                                if (onboardingStep() === 0) setSidebarOpen(!sidebarOpen());
                            }}
                            disabled={onboardingStep() > 0}
                            class="p-2.5 hover:bg-white/[0.06] rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
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
                        <div class="flex-1 flex overflow-hidden relative">

                            {/* Main Chat Area */}
                            <div class="flex-1 flex flex-col overflow-hidden relative">

                                {/* Messages Area */}
                                <div class="flex-1 overflow-y-auto">
                                    <Show when={messages().length === 0}>
                                        {/* Bento Grid Layout */}
                                        <div class="flex flex-col items-center justify-start px-6 md:px-20 py-12">
                                            <Motion.div
                                                initial={{ opacity: 0, y: 30 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.6, easing: [0.25, 0.1, 0.25, 1] }}
                                                class="w-full max-w-5xl"
                                            >
                                                {/* Welcome Text */}
                                                <div class="text-center mb-8">
                                                    <h1 class="text-3xl md:text-4xl font-semibold text-white mb-2 tracking-tight">
                                                        Welcome to Vision Wallet
                                                    </h1>
                                                    <p class="text-gray-400 text-base">
                                                        Your gateway to the Vision Chain ecosystem
                                                    </p>
                                                </div>

                                                {/* Bento Grid */}
                                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-min md:auto-rows-[210px]">
                                                    {/* Main Banner - Free Tokens */}
                                                    <Motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: 0.1 }}
                                                        class="col-span-1 md:col-span-2 row-span-2 relative overflow-hidden rounded-[32px] cursor-pointer group min-h-[400px] md:min-h-0"
                                                    >
                                                        <div class="absolute inset-0 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-700" />
                                                        <div class="absolute inset-0 opacity-40 mix-blend-overlay">
                                                            <img src="/bento_free_tokens.png" alt="Free Tokens" class="w-full h-full object-cover" />
                                                        </div>
                                                        <div class="absolute inset-0 bg-black/20" />
                                                        <div class="relative h-full p-8 md:p-10 flex flex-col items-center text-center">
                                                            <div class="flex-1 flex flex-col items-center justify-center">
                                                                <div class="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full text-[10px] md:text-sm font-semibold text-white mb-4 md:mb-6 border border-white/20">
                                                                    <Sparkles class="w-3.5 h-3.5 md:w-4 h-4 text-cyan-300" />
                                                                    Exclusive Reward
                                                                </div>
                                                                <h2 class="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6 tracking-tight">Free Tokens</h2>
                                                                <p class="text-white/80 text-lg md:text-xl max-w-[320px] leading-relaxed mx-auto mb-6 md:mb-8">
                                                                    Claim your VCN airdrop and join the Vision ecosystem.
                                                                </p>
                                                                <button
                                                                    onClick={() => setActiveView('campaign')}
                                                                    class="px-8 py-4 md:px-10 md:py-5 bg-white text-[#0a84ff] font-bold text-lg md:text-xl rounded-2xl hover:bg-white/90 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-blue-500/40 mb-6 md:mb-8"
                                                                >
                                                                    Claim Now
                                                                </button>
                                                            </div>
                                                            <div class="flex flex-col items-center mt-auto">
                                                                <span class="text-white font-black text-2xl md:text-3xl">100 VCN</span>
                                                                <span class="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em]">Available to claim</span>
                                                            </div>
                                                        </div>
                                                    </Motion.div>

                                                    {/* Send Card */}
                                                    <Motion.div
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.2 }}
                                                        onClick={() => setActiveFlow('send')}
                                                        class="col-span-1 row-span-1 h-full relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-blue-500/40 transition-all duration-500 shadow-lg hover:shadow-blue-500/10"
                                                    >
                                                        <div class="absolute inset-0 bg-[#121216]" />
                                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                                            <img src="/bento_send.png" alt="Send" class="w-full h-full object-cover" />
                                                        </div>
                                                        <div class="absolute inset-0 bg-gradient-to-t from-[#121216] via-transparent to-transparent" />
                                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                                <ArrowUpRight class="w-5 h-5 md:w-6 md:h-6 text-blue-400" />
                                                            </div>
                                                            <div>
                                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 text-center">Send</h3>
                                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Instant transfers anywhere in the world</p>
                                                            </div>
                                                        </div>
                                                    </Motion.div>

                                                    {/* Receive Card */}
                                                    <Motion.div
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.25 }}
                                                        onClick={() => setActiveFlow('receive')}
                                                        class="col-span-1 row-span-1 relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-green-500/40 transition-all duration-500 shadow-lg hover:shadow-green-500/10"
                                                    >
                                                        <div class="absolute inset-0 bg-[#0a1611]" />
                                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                                            <img src="/bento_receive.png" alt="Receive" class="w-full h-full object-cover" />
                                                        </div>
                                                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a1611] via-transparent to-transparent" />
                                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-green-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-green-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                                <ArrowDownLeft class="w-5 h-5 md:w-6 md:h-6 text-green-400" />
                                                            </div>
                                                            <div>
                                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 text-center">Receive</h3>
                                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Your secure global digital address</p>
                                                            </div>
                                                        </div>
                                                    </Motion.div>

                                                    {/* Swap Card */}
                                                    <Motion.div
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.3 }}
                                                        onClick={() => setActiveFlow('swap')}
                                                        class="col-span-1 row-span-1 relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-purple-500/40 transition-all duration-500 shadow-lg hover:shadow-purple-500/10"
                                                    >
                                                        <div class="absolute inset-0 bg-[#110e1a]" />
                                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                                            <img src="/bento_swap.png" alt="Swap" class="w-full h-full object-cover" />
                                                        </div>
                                                        <div class="absolute inset-0 bg-gradient-to-t from-[#110e1a] via-transparent to-transparent" />
                                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-purple-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                                <RefreshCw class="w-5 h-5 md:w-6 md:h-6 text-purple-400" />
                                                            </div>
                                                            <div>
                                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2 text-center">Swap</h3>
                                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Aggregated DEX liquidity for best rates</p>
                                                            </div>
                                                        </div>
                                                    </Motion.div>

                                                    {/* Mint Card */}
                                                    <Motion.div
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.35 }}
                                                        onClick={() => setActiveView('mint')}
                                                        class="col-span-1 row-span-1 relative overflow-hidden rounded-3xl cursor-pointer group border border-white/[0.08] hover:border-cyan-500/40 transition-all duration-500 shadow-lg hover:shadow-cyan-500/10"
                                                    >
                                                        <div class="absolute inset-0 bg-[#0a1418]" />
                                                        <div class="absolute inset-x-0 bottom-0 top-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
                                                            <img src="/bento_mint.png" alt="Mint" class="w-full h-full object-cover" />
                                                        </div>
                                                        <div class="absolute inset-0 bg-gradient-to-t from-[#0a1418] via-transparent to-transparent" />
                                                        <div class="relative h-full p-6 flex flex-col justify-center items-center text-center min-h-[160px] md:min-h-0">
                                                            <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-cyan-500/30 transition-all duration-500 mb-3 md:mb-4">
                                                                <Sparkles class="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                                                            </div>
                                                            <div>
                                                                <h3 class="text-lg md:text-xl font-bold text-white mb-1 md:mb-2">Mint</h3>
                                                                <p class="text-[10px] md:text-xs text-gray-400 px-2 leading-tight">Create NFTs and digital collectibles</p>
                                                            </div>
                                                        </div>
                                                    </Motion.div>
                                                </div>
                                            </Motion.div>
                                        </div>
                                    </Show>


                                    <Show when={messages().length > 0}>
                                        <div class="max-w-3xl mx-auto px-6 py-10 space-y-8">
                                            <For each={messages()}>
                                                {(msg) => (
                                                    <Motion.div
                                                        initial={{ opacity: 0, y: 15 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        class={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}
                                                    >
                                                        <Show when={msg.role === 'assistant'}>
                                                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                                                <Sparkles class="w-4 h-4 text-white" />
                                                            </div>
                                                        </Show>
                                                        <div class={`max-w-[75%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                                                            <div class={`px-5 py-4 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                                                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-tr-md shadow-lg shadow-blue-500/20'
                                                                : 'bg-[#17171a] text-gray-200 border border-white/[0.06] rounded-tl-md'
                                                                }`}>
                                                                {msg.content}
                                                            </div>
                                                        </div>
                                                        <Show when={msg.role === 'user'}>
                                                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center flex-shrink-0">
                                                                <User class="w-4 h-4 text-white" />
                                                            </div>
                                                        </Show>
                                                    </Motion.div>
                                                )}
                                            </For>

                                            <Show when={isLoading()}>
                                                <Motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} class="flex gap-4">
                                                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
                                                        <Sparkles class="w-4 h-4 text-white animate-pulse" />
                                                    </div>
                                                    <div class="bg-[#17171a] border border-white/[0.06] px-5 py-4 rounded-2xl rounded-tl-md flex items-center gap-2">
                                                        <div class="flex gap-1.5">
                                                            <span class="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
                                                            <span class="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ "animation-delay": "0.15s" }} />
                                                            <span class="w-2 h-2 bg-cyan-400/60 rounded-full animate-bounce" style={{ "animation-delay": "0.3s" }} />
                                                        </div>
                                                    </div>
                                                </Motion.div>
                                            </Show>
                                        </div>
                                    </Show>
                                </div>

                                {/* Input Area - Floating Style */}
                                <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0b] via-[#0a0a0b]/95 to-transparent pt-20">
                                    <div class="max-w-3xl mx-auto">
                                        <div class="relative bg-[#17171a] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/40 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.05)] transition-all duration-300">
                                            <textarea
                                                class="w-full bg-transparent text-white text-[15px] py-5 px-6 pr-16 outline-none resize-none placeholder:text-gray-500 min-h-[60px] max-h-[180px]"
                                                placeholder="Message Vision AI..."
                                                rows={1}
                                                value={input()}
                                                onInput={(e) => {
                                                    setInput(e.currentTarget.value);
                                                    e.currentTarget.style.height = 'auto';
                                                    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 180) + 'px';
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSend();
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={handleSend}
                                                disabled={isLoading() || !input().trim()}
                                                class="absolute right-3 bottom-3 p-3 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 rounded-xl text-white transition-all shadow-lg shadow-blue-500/25 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none hover:scale-105 active:scale-95"
                                            >
                                                <Send class="w-4 h-4" />
                                            </button>
                                        </div>
                                        <p class="text-center text-[11px] text-gray-600 mt-4">
                                            Vision AI may make mistakes. Always verify transactions before confirming.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar - Assets & Campaigns */}
                            <div class="w-[320px] h-full border-l border-white/[0.04] bg-[#0c0c0e]/40 backdrop-blur-3xl overflow-y-auto hidden xl:block">
                                <div class="p-6 space-y-6">

                                    {/* Portfolio Overview */}
                                    <div class="relative overflow-hidden group">
                                        <div class="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-700" />
                                        <div class="flex items-center justify-between mb-4">
                                            <div class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Net Worth</div>
                                            <div class="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] rounded-full border border-white/[0.06]">
                                                <span class="w-1 h-1 rounded-full bg-gray-500" />
                                                <span class="text-[10px] text-gray-500 font-bold">0.00%</span>
                                            </div>
                                        </div>
                                        <div class="text-3xl font-bold text-white mb-8 tracking-tight font-mono">
                                            {totalValueStr()}
                                        </div>

                                        {/* Mini Token List */}
                                        <div class="space-y-4">
                                            <For each={['VCN']}>
                                                {(symbol) => {
                                                    const asset = () => getAssetData(symbol);
                                                    const valueStr = () => (asset().balance * asset().price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

                                                    return (
                                                        <div class="flex items-center justify-between group/item cursor-pointer">
                                                            <div class="flex items-center gap-3">
                                                                <div class="relative">
                                                                    <Show when={asset().image} fallback={
                                                                        <div class={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[11px] shadow-lg ${symbol === 'VCN' ? 'bg-gradient-to-br from-blue-500 to-cyan-400 shadow-blue-500/20' :
                                                                            symbol === 'ETH' ? 'bg-gradient-to-br from-purple-500 to-indigo-400 shadow-purple-500/20' :
                                                                                'bg-gradient-to-br from-green-500 to-emerald-400 shadow-green-500/20'
                                                                            }`}>
                                                                            {symbol.slice(0, 2)}
                                                                        </div>
                                                                    }>
                                                                        <img src={asset().image!} alt={symbol} class="w-9 h-9 rounded-xl shadow-lg" />
                                                                    </Show>
                                                                </div>
                                                                <div>
                                                                    <div class="text-[14px] font-semibold text-white group-hover/item:text-blue-400 transition-colors uppercase tracking-wide">{symbol}</div>
                                                                    <div class="text-[11px] text-gray-500 font-medium tracking-tight">Active Portfolio</div>
                                                                </div>
                                                            </div>
                                                            <div class="text-right">
                                                                <div class="text-[14px] font-bold text-white tabular-nums">{valueStr()}</div>
                                                                <div class={`text-[10px] font-bold ${asset().change24h > 0 ? 'text-green-400' : asset().change24h < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                                    {asset().change24h > 0 ? '+' : ''}{asset().change24h.toFixed(1)}%
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </div>

                                    <div class="h-px bg-white/[0.04] w-full" />

                                    {/* Rewards Section */}
                                    <div class="space-y-5">
                                        <div class="flex items-center justify-between px-1">
                                            <span class="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em]">Live Rewards</span>
                                            <div class="flex gap-1">
                                                <div class="w-1 h-1 rounded-full bg-cyan-400" />
                                                <div class="w-1 h-1 rounded-full bg-cyan-400/40" />
                                            </div>
                                        </div>

                                        {/* Reward Cards */}
                                        <div class="space-y-3">
                                            <div
                                                onClick={() => setActiveView('campaign')}
                                                class="relative overflow-hidden p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] rounded-2xl transition-all duration-500 group cursor-pointer"
                                            >
                                                <div class="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                                                <div class="flex items-center justify-between mb-4">
                                                    <div class="flex items-center gap-2">
                                                        <div class="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                            <TrendingUp class="w-3.5 h-3.5" />
                                                        </div>
                                                        <span class="text-[11px] font-bold text-blue-400 uppercase tracking-widest">Staking</span>
                                                    </div>
                                                    <ChevronRight class="w-3.5 h-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                                <div class="text-[17px] font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">12% APY Yield</div>
                                                <p class="text-[12px] text-gray-400 mb-4 font-medium">Auto-compounding rewards</p>
                                                <div class="flex items-center gap-2">
                                                    <div class="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/10 text-[10px] font-bold text-blue-400">HOT</div>
                                                    <span class="text-[10px] text-gray-500 font-bold">New Pool</span>
                                                </div>
                                            </div>

                                            <div
                                                onClick={() => setActiveView('campaign')}
                                                class="relative overflow-hidden p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] rounded-2xl transition-all duration-500 group cursor-pointer"
                                            >
                                                <div class="absolute -right-4 -top-4 w-20 h-20 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-colors" />
                                                <div class="flex items-center justify-between mb-4">
                                                    <div class="flex items-center gap-2">
                                                        <div class="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                                            <Sparkles class="w-3.5 h-3.5" />
                                                        </div>
                                                        <span class="text-[11px] font-bold text-purple-400 uppercase tracking-widest">Airdrop</span>
                                                    </div>
                                                    <ChevronRight class="w-3.5 h-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                                </div>
                                                <div class="text-[17px] font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">Season 1 is Live</div>
                                                <div class="flex items-center justify-between mt-4">
                                                    <div class="flex items-center gap-3 flex-1 mr-4">
                                                        <div class="h-1 flex-1 bg-white/[0.04] rounded-full overflow-hidden">
                                                            <div class="h-full w-[10%] bg-gradient-to-r from-purple-500 to-indigo-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]" />
                                                        </div>
                                                        <span class="text-[11px] font-bold text-white/40">1/10</span>
                                                    </div>
                                                    <span class="text-[11px] font-bold text-purple-400">JOIN NOW</span>
                                                </div>
                                            </div>

                                            {/* Simplified Referral */}
                                            <div
                                                onClick={() => setActiveView('campaign')}
                                                class="group cursor-pointer p-4 bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10 rounded-2xl hover:border-orange-500/20 transition-all"
                                            >
                                                <div class="flex items-center justify-between mb-1">
                                                    <span class="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Growth</span>
                                                    <User class="w-3 h-3 text-orange-400/50" />
                                                </div>
                                                <div class="text-[15px] font-bold text-white">Invite & Earn 50 VCN</div>
                                                <div class="flex items-center justify-between mt-3">
                                                    <div class="text-[10px] font-mono text-gray-500 group-hover:text-white transition-colors">VC-7F3A-8B9C</div>
                                                    <div class="text-[10px] font-bold text-orange-400">COPY LINK</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* System Health & User Info */}
                                    <div class="grid grid-cols-2 gap-3 pt-4">
                                        <div class="col-span-2 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
                                                <User class="w-4 h-4 text-white" />
                                            </div>
                                            <div class="overflow-hidden">
                                                <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Logged In As</div>
                                                <div class="text-[11px] font-bold text-white truncate w-full" title={userProfile().email}>{userProfile().email}</div>
                                            </div>
                                        </div>

                                        <div class="p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Network</div>
                                            <div class="flex items-center gap-2">
                                                <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                                                <span class="text-[12px] font-bold text-white">Connected</span>
                                            </div>
                                        </div>
                                        <div class="p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Gas Priority</div>
                                            <div class="flex items-center gap-2">
                                                <Zap class="w-3 h-3 text-amber-400" />
                                                <span class="text-[12px] font-bold text-white">0.002 VCN</span>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Campaign View */}
                    <Show when={activeView() === 'campaign'}>
                        <div class="flex-1 overflow-y-auto relative">
                            {/* Decorative Background Blur */}
                            <div class="absolute top-0 right-[10%] w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

                            <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20 relative">
                                <div class="flex items-center gap-6 mb-12">
                                    <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-500 flex items-center justify-center shadow-2xl shadow-blue-500/20 group hover:scale-105 transition-transform">
                                        <Zap class="w-8 h-8 text-white group-hover:animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 class="text-4xl font-bold text-white tracking-tight mb-2">Campaign Central</h2>
                                        <p class="text-gray-500 font-medium">Maximize your earnings through Vision ecosystem events and rewards</p>
                                    </div>
                                </div>


                                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Re-use campaign card styles but larger */}
                                    <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-8 hover:border-blue-500/30 transition-all group">
                                        <div class="flex items-center justify-between mb-6">
                                            <div class="px-3 py-1 bg-blue-500/10 rounded-full text-[10px] font-bold text-blue-400 uppercase tracking-widest">Active Now</div>
                                            <TrendingUp class="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                        </div>
                                        <h2 class="text-2xl font-bold text-white mb-2">Staking V1</h2>
                                        <p class="text-gray-400 mb-6 font-medium">Earn up to 12% APY by staking your VCN tokens. No lock-up period required for this season.</p>
                                        <div class="flex items-center gap-6 mb-8">
                                            <div>
                                                <div class="text-xs text-gray-500 uppercase font-bold tracking-tight mb-1">Total TVL</div>
                                                <div class="text-lg font-bold text-white font-mono">--</div>
                                            </div>
                                            <div class="w-px h-8 bg-white/10" />
                                            <div>
                                                <div class="text-xs text-gray-500 uppercase font-bold tracking-tight mb-1">Stakers</div>
                                                <div class="text-lg font-bold text-white font-mono">--</div>
                                            </div>
                                        </div>
                                        <button class="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20">
                                            Start Staking
                                        </button>
                                    </div>

                                    <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] p-8 hover:border-purple-500/30 transition-all group">
                                        <div class="flex items-center justify-between mb-6">
                                            <div class="px-3 py-1 bg-purple-500/10 rounded-full text-[10px] font-bold text-purple-400 uppercase tracking-widest">Season 1</div>
                                            <Sparkles class="w-5 h-5 text-gray-600 group-hover:text-purple-400 transition-colors" />
                                        </div>
                                        <h2 class="text-2xl font-bold text-white mb-2">Community Airdrop</h2>
                                        <p class="text-gray-400 mb-6 font-medium">Complete daily missions to earn Vision Points. Top participants will share in the reward pool.</p>
                                        <div class="mb-8">
                                            <div class="flex items-center justify-between mb-2">
                                                <span class="text-xs text-gray-500 font-bold uppercase">Your Progress</span>
                                                <span class="text-xs text-white font-bold">In Progress</span>
                                            </div>
                                            <div class="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                                <div class="w-[5%] h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]" />
                                            </div>
                                        </div>
                                        <button class="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20">
                                            View Missions
                                        </button>
                                    </div>

                                    <div class="col-span-1 md:col-span-2 bg-gradient-to-br from-orange-600/10 to-transparent border border-orange-500/20 rounded-[24px] p-8 hover:border-orange-500/40 transition-all group relative overflow-hidden">
                                        <div class="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
                                        <div class="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                                            <div class="flex-1 text-center md:text-left">
                                                <div class="flex items-center justify-center md:justify-start gap-3 mb-4">
                                                    <div class="px-3 py-1 bg-orange-500/10 rounded-full text-[10px] font-bold text-orange-400 uppercase tracking-widest">Referral Program</div>
                                                    <div class="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                                                </div>
                                                <h2 class="text-3xl font-bold text-white mb-4">Invite & Earn 50 VCN</h2>
                                                <p class="text-gray-400 mb-6 max-w-lg">Share the vision with your friends. For every friend who connects their wallet, you both receive 50 VCN tokens instantly.</p>
                                                <div class="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                                    <div class="px-6 py-3 bg-[#1a1a1f] border border-orange-500/20 rounded-xl font-mono text-xl font-black text-orange-400 tracking-widest shadow-lg shadow-orange-500/5">
                                                        VC7F3A
                                                    </div>
                                                    <button class="px-6 py-3.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2">
                                                        <Copy class="w-4 h-4" />
                                                        Copy Link
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="w-full md:w-48 space-y-3">
                                                <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between">
                                                    <div class="text-xs text-gray-500 font-bold uppercase">Total Invites</div>
                                                    <div class="text-lg font-bold text-white">12</div>
                                                </div>
                                                <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between">
                                                    <div class="text-xs text-gray-500 font-bold uppercase">VCN Earned</div>
                                                    <div class="text-lg font-bold text-orange-400">600</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Mint View */}
                    <Show when={activeView() === 'mint'}>
                        <div class="flex-1 overflow-y-auto relative h-full">
                            {/* Decorative Background Blur */}
                            <div class="absolute top-0 right-[15%] w-[450px] h-[450px] bg-cyan-500/5 rounded-full blur-[130px] pointer-events-none" />

                            <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20 relative min-h-full flex flex-col">
                                <div class="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
                                    <div class="flex items-center gap-6">
                                        <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-cyan-600 to-emerald-500 flex items-center justify-center shadow-2xl shadow-cyan-500/20 group animate-in slide-in-from-left duration-700">
                                            <Plus class="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-500" />
                                        </div>
                                        <div>
                                            <h2 class="text-4xl font-bold text-white tracking-tight mb-2">Minting Studio</h2>
                                            <p class="text-gray-500 font-medium">Cross-chain token deployment powered by Vision Interoperability</p>
                                        </div>
                                    </div>

                                    {/* Step Indicator */}
                                    <div class="flex items-center gap-3 bg-white/[0.03] p-1.5 rounded-2xl border border-white/[0.06]">
                                        <For each={[1, 2, 3]}>
                                            {(step) => (
                                                <button
                                                    onClick={() => setMintStep(step)}
                                                    class={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${mintStep() === step ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                                >
                                                    {step}
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 xl:grid-cols-12 gap-10 flex-1">
                                    {/* Left Side: Configuration Form */}
                                    <div class="xl:col-span-7 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">

                                        {/* Step 1: Identity */}
                                        <Show when={mintStep() === 1}>
                                            <div class="space-y-6">
                                                <div class="space-y-2">
                                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Token Identity</label>
                                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div class="relative group">
                                                            <input
                                                                type="text"
                                                                placeholder="Token Name (e.g. Vision Gold)"
                                                                class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                                                value={tokenName()}
                                                                onInput={(e) => setTokenName(e.currentTarget.value)}
                                                            />
                                                        </div>
                                                        <div class="relative group">
                                                            <input
                                                                type="text"
                                                                placeholder="Symbol (e.g. VGOLD)"
                                                                class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600 uppercase"
                                                                value={tokenSymbol()}
                                                                onInput={(e) => setTokenSymbol(e.currentTarget.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="space-y-4">
                                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Asset Type</label>
                                                    <div class="flex gap-4">
                                                        <button
                                                            onClick={() => setTokenType('fungible')}
                                                            class={`flex-1 p-5 rounded-2xl border transition-all flex flex-col items-center gap-3 ${tokenType() === 'fungible' ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/5' : 'bg-[#111113] border-white/10 text-gray-500 hover:border-white/20'}`}
                                                        >
                                                            <Zap class="w-6 h-6" />
                                                            <span class="font-bold">Fungible (ERC-20)</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setTokenType('nft')}
                                                            class={`flex-1 p-5 rounded-2xl border transition-all flex flex-col items-center gap-3 ${tokenType() === 'nft' ? 'bg-purple-500/10 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/5' : 'bg-[#111113] border-white/10 text-gray-500 hover:border-white/20'}`}
                                                        >
                                                            <Sparkles class="w-6 h-6" />
                                                            <span class="font-bold">NFT (ERC-721)</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => setMintStep(2)}
                                                    class="w-full py-5 bg-gradient-to-r from-cyan-600 to-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] transition-all active:scale-95"
                                                >
                                                    Next: Configuration
                                                </button>
                                            </div>
                                        </Show>

                                        {/* Step 2: Configuration */}
                                        <Show when={mintStep() === 2}>
                                            <div class="space-y-6">
                                                <div class="space-y-2">
                                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Total Supply</label>
                                                    <input
                                                        type="number"
                                                        class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all"
                                                        value={tokenSupply()}
                                                        onInput={(e) => setTokenSupply(e.currentTarget.value)}
                                                    />
                                                </div>

                                                <div class="space-y-4">
                                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Advanced Settings</label>
                                                    <div class="space-y-4">
                                                        <div class="relative group">
                                                            <textarea
                                                                placeholder="Description (Optional)"
                                                                class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600 resize-none h-24"
                                                            />
                                                        </div>

                                                        <Show when={tokenType() === 'nft'}>
                                                            <div class="grid grid-cols-2 gap-4">
                                                                <div class="relative group">
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Royalty %"
                                                                        class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                                                    />
                                                                </div>
                                                                <div class="relative group">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Metadata CID"
                                                                        class="w-full bg-[#111113] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-gray-600"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </Show>

                                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group/toggle cursor-pointer hover:border-white/10 transition-colors">
                                                                <div class="flex flex-col">
                                                                    <span class="text-sm font-bold text-gray-300">Mintable</span>
                                                                    <span class="text-[10px] text-gray-500 uppercase font-black">Allow future supply</span>
                                                                </div>
                                                                <div class="w-10 h-5 bg-cyan-500 rounded-full relative shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                                                                    <div class="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                                                                </div>
                                                            </div>
                                                            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group/toggle cursor-pointer hover:border-white/10 transition-colors">
                                                                <div class="flex flex-col">
                                                                    <span class="text-sm font-bold text-gray-300">Burnable</span>
                                                                    <span class="text-[10px] text-gray-500 uppercase font-black">Enable token burning</span>
                                                                </div>
                                                                <div class="w-10 h-5 bg-white/10 rounded-full relative">
                                                                    <div class="absolute left-0.5 top-0.5 w-4 h-4 bg-white/30 rounded-full shadow-sm" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="flex gap-4">
                                                    <button onClick={() => setMintStep(1)} class="px-8 py-5 bg-white/5 text-gray-400 font-bold rounded-2xl hover:bg-white/10 transition-all">Back</button>
                                                    <button
                                                        onClick={() => setMintStep(3)}
                                                        class="flex-1 py-5 bg-gradient-to-r from-cyan-600 to-emerald-500 text-white font-bold rounded-2xl shadow-xl shadow-cyan-500/20 hover:scale-[1.02] transition-all active:scale-95"
                                                    >
                                                        Next: Select Networks
                                                    </button>
                                                </div>
                                            </div>
                                        </Show>

                                        {/* Step 3: Network Selection */}
                                        <Show when={mintStep() === 3}>
                                            <div class="space-y-6">
                                                <div class="space-y-4">
                                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Target Networks (Cross-Chain)</label>
                                                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        <For each={[
                                                            { name: 'Ethereum', color: 'from-blue-600 to-indigo-500' },
                                                            { name: 'Solana', color: 'from-purple-500 to-emerald-400' },
                                                            { name: 'Base', color: 'from-blue-400 to-blue-600' },
                                                            { name: 'Polygon', color: 'from-purple-600 to-pink-500' },
                                                            { name: 'Arbitrum', color: 'from-blue-500 to-cyan-400' },
                                                            { name: 'Binance', color: 'from-amber-400 to-amber-600' }
                                                        ]}>
                                                            {(network) => (
                                                                <button
                                                                    onClick={() => {
                                                                        if (mintingNetworks().includes(network.name)) {
                                                                            setMintingNetworks(prev => prev.filter(n => n !== network.name));
                                                                        } else {
                                                                            setMintingNetworks(prev => [...prev, network.name]);
                                                                        }
                                                                    }}
                                                                    class={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 group relative overflow-hidden ${mintingNetworks().includes(network.name) ? 'bg-white/5 border-white/20 text-white' : 'bg-[#111113] border-white/10 text-gray-500 hover:border-white/20'}`}
                                                                >
                                                                    <Show when={mintingNetworks().includes(network.name)}>
                                                                        <div class={`absolute inset-0 bg-gradient-to-br ${network.color} opacity-10`} />
                                                                    </Show>
                                                                    <Globe class={`w-5 h-5 transition-colors ${mintingNetworks().includes(network.name) ? 'text-white' : 'group-hover:text-gray-300'}`} />
                                                                    <span class="text-xs font-bold">{network.name}</span>
                                                                </button>
                                                            )}
                                                        </For>
                                                    </div>
                                                </div>

                                                <div class="bg-blue-500/5 border border-blue-500/10 p-5 rounded-2xl">
                                                    <div class="flex gap-3">
                                                        <Shield class="w-5 h-5 text-blue-400 shrink-0" />
                                                        <p class="text-xs text-blue-300 leading-relaxed font-medium">Vision Chain will automatically handle the cross-chain interoperability proofs. One mint covers all selected networks.</p>
                                                    </div>
                                                </div>

                                                <div class="flex gap-4">
                                                    <button onClick={() => setMintStep(2)} class="px-8 py-5 bg-white/5 text-gray-400 font-bold rounded-2xl hover:bg-white/10 transition-all">Back</button>
                                                    <button
                                                        onClick={handleMint}
                                                        disabled={isMinting() || !tokenName()}
                                                        class="flex-1 py-5 bg-gradient-to-r from-blue-600 to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/30 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Show when={isMinting()} fallback={mintedSuccess() ? "Mint Complete" : "Launch Token"}>
                                                            <div class="flex flex-col items-center gap-1.5">
                                                                <div class="flex items-center justify-center gap-3">
                                                                    <RefreshCw class="w-4 h-4 animate-spin text-white/80" />
                                                                    <span class="text-sm tracking-wide">Launching Studio...</span>
                                                                </div>
                                                                <div class="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                                                                    <div class="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-all duration-300" style={{ width: `${mintProgress()}%` }} />
                                                                </div>
                                                            </div>
                                                        </Show>
                                                    </button>
                                                </div>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Right Side: Live Preview */}
                                    <div class="xl:col-span-5 relative">
                                        <div class="sticky top-10 space-y-6">
                                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1">Token Preview</label>

                                            {/* Premium Token Card */}
                                            <div class="relative group">
                                                {/* Glow Effect */}
                                                <div class={`absolute inset-0 bg-gradient-to-br transition-all duration-700 blur-[40px] opacity-20 ${tokenType() === 'fungible' ? 'from-cyan-500 to-emerald-500' : 'from-purple-500 to-pink-500'}`} />

                                                <div class="relative bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden aspect-[4/5] flex flex-col">
                                                    {/* Card Background Pattern */}
                                                    <div class="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ "background-image": "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", "background-size": "24px 24px" }} />

                                                    <div class="flex justify-between items-start mb-12">
                                                        <div class={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${tokenType() === 'fungible' ? 'bg-gradient-to-br from-cyan-500 to-emerald-400' : 'bg-gradient-to-br from-purple-500 to-pink-400'}`}>
                                                            <Show when={tokenType() === 'fungible'} fallback={<Sparkles class="w-7 h-7 text-white" />}>
                                                                <Zap class="w-7 h-7 text-white" />
                                                            </Show>
                                                        </div>
                                                        <div class="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                                            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                                            <span class="text-[10px] font-bold text-white uppercase tracking-tighter">Verified Standard</span>
                                                        </div>
                                                    </div>

                                                    <div class="flex-1 space-y-2">
                                                        <div class="text-[11px] font-black text-white/30 uppercase tracking-[0.2em]">Asset Name</div>
                                                        <h3 class="text-3xl font-bold text-white tracking-tight truncate">{tokenName() || 'Vision Asset'}</h3>
                                                        <div class="flex items-center gap-3">
                                                            <span class={`text-sm font-bold px-2 py-0.5 rounded ${tokenType() === 'fungible' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-purple-500/20 text-purple-400'}`}>
                                                                {tokenSymbol() || 'SYMBOL'}
                                                            </span>
                                                            <span class="text-xs text-gray-500 font-medium font-mono">{(Number(tokenSupply()) || 0).toLocaleString()} Initial Supply</span>
                                                        </div>
                                                    </div>

                                                    <div class="pt-8 mt-8 border-t border-white/5 space-y-4">
                                                        <div class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Distribution Networks</div>
                                                        <div class="flex flex-wrap gap-2">
                                                            <For each={mintingNetworks()}>
                                                                {(network) => (
                                                                    <span class="px-3 py-1.5 bg-white/5 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5">
                                                                        <div class="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                                                        {network}
                                                                    </span>
                                                                )}
                                                            </For>
                                                        </div>
                                                    </div>

                                                    {/* Watermark */}
                                                    <div class="absolute bottom-8 right-8 text-[10px] font-black text-white/10 uppercase tracking-widest rotate-90 origin-bottom-right">
                                                        Minted via Vision Chain
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Success Message UI */}
                                <Presence>
                                    <Show when={mintedSuccess()}>
                                        <div class="fixed inset-0 z-[100] flex items-center justify-center px-4 p-4">
                                            <Motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                class="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                                onClick={() => setMintedSuccess(false)}
                                            />
                                            <Motion.div
                                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                class="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 p-6 rounded-[24px] flex flex-col items-center text-center gap-4 relative overflow-hidden group/success"
                                            >
                                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover/success:translate-x-full transition-transform duration-1000" />
                                                <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30">
                                                    <Check class="w-6 h-6 text-white" />
                                                </div>
                                                <div>
                                                    <h4 class="text-white font-bold text-lg">Mint Successful!</h4>
                                                    <p class="text-green-400/80 text-sm">{tokenSymbol() || 'Asset'} is now live on {mintingNetworks().length} networks.</p>
                                                </div>
                                                <div class="flex gap-2 w-full mt-2 relative z-10">
                                                    <button class="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">View Explorer</button>
                                                    <button
                                                        onClick={() => { setMintedSuccess(false); setTokenName(''); setTokenSymbol(''); setMintStep(1); setTokenSupply('1000000'); setMintingNetworks(['Ethereum']); }}
                                                        class="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-green-500/20"
                                                    >
                                                        New Mint
                                                    </button>
                                                </div>
                                            </Motion.div>
                                        </div>
                                    </Show>
                                </Presence>

                                {/* My Collections Section */}
                                <div class="mt-20 pt-10 border-t border-white/[0.04] animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                                    <div class="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 class="text-2xl font-bold text-white tracking-tight mb-1">My Collections</h3>
                                            <p class="text-gray-500 text-sm">Manage and track your deployed assets across all chains</p>
                                        </div>
                                        <button class="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-all border border-white/5">View Full History</button>
                                    </div>

                                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                        <For each={[] as any[]}>
                                            {(collection) => (
                                                <div class="bg-[#111113] border border-white/[0.06] rounded-[24px] overflow-hidden group hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl hover:shadow-cyan-500/5 transition-all duration-500 cursor-pointer flex flex-col">
                                                    <div class={`h-32 bg-gradient-to-br ${collection.color} p-6 flex items-end relative overflow-hidden`}>
                                                        <div class="absolute top-4 left-4 px-2 py-0.5 bg-black/20 backdrop-blur-md rounded text-[8px] font-black text-white/90 uppercase tracking-widest">{collection.date}</div>
                                                        <div class="absolute top-4 right-4 text-[10px] font-black text-white/40 uppercase tracking-widest">{collection.type}</div>
                                                        <div class="absolute -right-8 -bottom-8 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-700" />
                                                        <Sparkles class="w-8 h-8 text-white/50 group-hover:scale-110 group-hover:text-white transition-all duration-700" />
                                                    </div>
                                                    <div class="p-5 flex-1 flex flex-col justify-between">
                                                        <div>
                                                            <h4 class="font-bold text-base text-white mb-1 group-hover:text-cyan-400 transition-colors">{collection.name}</h4>
                                                            <div class="flex items-center gap-2 mb-4">
                                                                <span class="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Chain Status:</span>
                                                                <div class="flex items-center gap-1">
                                                                    <div class="w-1.5 h-1.5 rounded-full bg-green-500" />
                                                                    <span class="text-[10px] text-green-500/80 font-bold">Synced</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div class="flex items-center justify-between border-t border-white/5 pt-4">
                                                            <span class="text-xs text-gray-500 font-medium">{collection.items} Items</span>
                                                            <div class="flex -space-x-1.5">
                                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-blue-500 flex items-center justify-center text-[7px] font-black text-white shadow-sm" title="Ethereum">ETH</div>
                                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-[#14F195] flex items-center justify-center text-[7px] font-black text-black shadow-sm" title="Solana">SOL</div>
                                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-[#0052FF] flex items-center justify-center text-[7px] font-black text-white shadow-sm" title="Base">B</div>
                                                                <div class="w-5 h-5 rounded-full border border-[#111113] bg-gray-700 flex items-center justify-center text-[7px] font-black text-white shadow-sm">+2</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Show>

                    {/* Nodes View (New Implementation) */}
                    <Show when={activeView() === 'nodes'}>
                        <div class="flex-1 overflow-y-auto relative h-full">
                            {/* Decorative Background Blur */}
                            <div class="absolute top-0 right-[25%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

                            <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20 relative">

                                {/* Header Section */}
                                <div class="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
                                    <div class="flex items-center gap-6">
                                        <div class="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/20 group animate-in slide-in-from-left duration-700">
                                            <Camera class="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-500" />
                                        </div>
                                        <div>
                                            <h2 class="text-4xl font-bold text-white tracking-tight mb-2">My Nodes</h2>
                                            <p class="text-gray-500 font-medium">Manage your Vision Chain Validator Licenses & Mining Rewards</p>
                                        </div>
                                    </div>

                                    {/* Total Mining Stats */}
                                    <div class="flex gap-4">
                                        <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col items-end min-w-[140px]">
                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Rewards</div>
                                            <div class="text-xl font-bold text-white">{nodeStats().totalRewards.toLocaleString(undefined, { minimumFractionDigits: 2 })} VCN</div>
                                        </div>
                                        <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col items-end min-w-[140px]">
                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Active Nodes</div>
                                            <div class="text-xl font-bold text-emerald-400">{nodeStats().activeNodes} / {nodeStats().totalNodes}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Node Licenses List */}
                                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
                                    <For each={ownedNodes()}>
                                        {(node) => (
                                            <div class="bg-[#111113] border border-emerald-500/30 rounded-[32px] overflow-hidden relative group">
                                                <div class="absolute top-0 right-0 p-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

                                                <div class="p-8">
                                                    <div class="flex justify-between items-start mb-8">
                                                        <div class="flex items-center gap-4">
                                                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center">
                                                                <span class="font-mono text-xs font-bold text-gray-400">{node.id}</span>
                                                            </div>
                                                            <div>
                                                                <div class="text-lg font-bold text-white">{node.type} Node</div>
                                                                <div class="flex items-center gap-2 mt-1">
                                                                    <div class={`w-2 h-2 rounded-full ${node.status === 'Operating' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                                                                    <span class={`text-xs font-bold uppercase tracking-wide ${node.status === 'Operating' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                        {node.status} (AOR {node.aor}%)
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div class="px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hash Power: {node.hashPower}</span>
                                                        </div>
                                                    </div>

                                                    <div class="grid grid-cols-2 gap-4 mb-8">
                                                        <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Daily Reward</div>
                                                            <div class="text-lg font-bold text-white">+{node.dailyReward} VCN</div>
                                                        </div>
                                                        <div class="p-4 bg-black/20 rounded-2xl border border-white/5">
                                                            <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Uptime</div>
                                                            <div class="text-lg font-bold text-white">{node.uptime}</div>
                                                        </div>
                                                    </div>

                                                    <div class="flex gap-3">
                                                        <button
                                                            onClick={claimNodeRewards}
                                                            class="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95">
                                                            Claim Rewards
                                                        </button>
                                                        <button class="px-6 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all border border-white/5">
                                                            Manage
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Progress Bar for daily epoch */}
                                                <div class="h-1 bg-white/5 w-full">
                                                    <div class="h-full bg-emerald-500 w-[75%]" />
                                                </div>
                                            </div>
                                        )}
                                    </For>

                                    {/* Purchase New License CTA */}
                                    <div
                                        onClick={() => document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' })}
                                        class="bg-[#111113] border border-white/10 border-dashed rounded-[32px] p-8 flex flex-col items-center justify-center text-center gap-6 group hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all cursor-pointer">
                                        <div class="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                            <Plus class="w-6 h-6 text-emerald-400" />
                                        </div>
                                        <div>
                                            <h3 class="text-xl font-bold text-white mb-2">Deploy New Node</h3>
                                            <p class="text-sm text-gray-500 max-w-xs mx-auto">Purchase a new Validator or Enterprise license to increase your mining output.</p>
                                        </div>
                                        <button class="px-8 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                                            View Catalog
                                        </button>
                                    </div>
                                </div>

                                {/* Node Catalog Section */}
                                <div id="catalog-section" class="border-t border-white/[0.06] pt-12">
                                    <h3 class="text-2xl font-bold text-white mb-8 tracking-tight">Node License Catalog</h3>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Validator Tier */}
                                        <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-emerald-500/30 transition-all flex flex-col">
                                            <div class="flex justify-between items-start mb-6">
                                                <div class="px-3 py-1 bg-emerald-500/10 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                                    Most Popular
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-2xl font-bold text-white">70,000 VCN</div>
                                                    <div class="text-xs text-gray-500">approx. $6,200</div>
                                                </div>
                                            </div>

                                            <h4 class="text-2xl font-bold text-white mb-4">Validator Node</h4>
                                            <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                                Standard participation node. Validates transactions and earns VCN rewards with a 1x multiplier. Ideal for individual operators.
                                            </p>

                                            <div class="space-y-3 mb-8 flex-1">
                                                <div class="flex items-center gap-3 text-sm text-gray-300">
                                                    <Check class="w-4 h-4 text-emerald-500" />
                                                    <span>1x Mining Multiplier</span>
                                                </div>
                                                <div class="flex items-center gap-3 text-sm text-gray-300">
                                                    <Check class="w-4 h-4 text-emerald-500" />
                                                    <span>Eligible for Halving Trigger</span>
                                                </div>
                                                <div class="flex items-center gap-3 text-sm text-gray-300">
                                                    <Check class="w-4 h-4 text-emerald-500" />
                                                    <span>Standard Hardware Req.</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => purchaseNode('Validator')}
                                                class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all hover:border-emerald-500/50">
                                                Purchase License
                                            </button>
                                        </div>

                                        {/* Enterprise Tier */}
                                        <div class="bg-[#111113] border border-white/[0.06] rounded-3xl p-8 hover:border-purple-500/30 transition-all flex flex-col relative overflow-hidden">
                                            {/* Badge */}
                                            <div class="absolute -right-12 top-6 bg-purple-600 w-40 h-8 flex items-center justify-center rotate-45 text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                                                High Perf.
                                            </div>

                                            <div class="flex justify-between items-start mb-6">
                                                <div class="px-3 py-1 bg-purple-500/10 rounded-lg text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                                                    Enterprise
                                                </div>
                                                <div class="text-right">
                                                    <div class="text-2xl font-bold text-white">500,000 VCN</div>
                                                    <div class="text-xs text-gray-500">approx. $62,000</div>
                                                </div>
                                            </div>

                                            <h4 class="text-2xl font-bold text-white mb-4">Enterprise Node</h4>
                                            <p class="text-gray-400 text-sm mb-8 leading-relaxed">
                                                High-performance institutional node handling data availability and AI compute tasks. 12x multiplier reward.
                                            </p>

                                            <div class="space-y-3 mb-8 flex-1">
                                                <div class="flex items-center gap-3 text-sm text-gray-300">
                                                    <Check class="w-4 h-4 text-purple-500" />
                                                    <span>12x Mining Multiplier</span>
                                                </div>
                                                <div class="flex items-center gap-3 text-sm text-gray-300">
                                                    <Check class="w-4 h-4 text-purple-500" />
                                                    <span>AI Task Processing Priority</span>
                                                </div>
                                                <div class="flex items-center gap-3 text-sm text-gray-300">
                                                    <Check class="w-4 h-4 text-purple-500" />
                                                    <span>10Gbps Network Required</span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => purchaseNode('Enterprise')}
                                                class="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-500/20">
                                                Purchase License
                                            </button>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </Show>

                    <Show when={activeView() === 'assets'}>
                        <div class="flex-1 overflow-y-auto">
                            {/* Top Header */}
                            <div class="bg-gradient-to-b from-[#0a0a0b] to-[#0d0d0f] border-b border-white/[0.04] relative overflow-hidden">
                                {/* Decorative Background Blur */}
                                <div class="absolute top-0 right-[20%] w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

                                <div class="max-w-[1440px] mx-auto px-8 py-10 pt-20">
                                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                        <div class="relative group">
                                            <div class="text-[11px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-2">Total Portfolio Value</div>
                                            <div class="flex items-baseline gap-4">
                                                <span class="text-4xl sm:text-5xl font-bold text-white tracking-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                                                    {totalValueStr()}
                                                </span>
                                                <div class="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                                                    <TrendingUp class="w-3.5 h-3.5 text-gray-500" />
                                                    <span class="text-sm text-gray-500 font-bold">+$0.00 (0.00%)</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
                                            <button
                                                onClick={() => startFlow('send')}
                                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-blue-500/5 group-hover:shadow-blue-500/10">
                                                    <ArrowUpRight class="w-5 h-5 text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                </div>
                                                <span class="text-sm font-bold text-white tracking-wide">Send</span>
                                            </button>
                                            <button
                                                onClick={() => startFlow('receive')}
                                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                <div class="w-10 h-10 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-green-500/5 group-hover:shadow-green-500/10">
                                                    <ArrowDownLeft class="w-5 h-5 text-green-400 group-hover:-translate-x-0.5 group-hover:translate-y-0.5 transition-transform" />
                                                </div>
                                                <span class="text-sm font-bold text-white tracking-wide">Receive</span>
                                            </button>
                                            <button
                                                onClick={() => startFlow('swap')}
                                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}>
                                                <div class="w-10 h-10 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-purple-500/5 group-hover:shadow-purple-500/10">
                                                    <RefreshCw class="w-5 h-5 text-purple-400 group-hover:rotate-180 transition-transform duration-700" />
                                                </div>
                                                <span class="text-sm font-bold text-white tracking-wide">Swap</span>
                                            </button>
                                            <button
                                                onClick={() => setActiveView('mint')}
                                                class="flex items-center gap-3 px-6 py-4 bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] rounded-2xl transition-all group active:scale-95" style={{ background: 'rgba(255,255,255,0.03)' }}
                                            >
                                                <div class="w-10 h-10 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 flex items-center justify-center transition-all duration-300 shadow-lg shadow-cyan-500/5 group-hover:shadow-cyan-500/10">
                                                    <Sparkles class="w-5 h-5 text-cyan-400 group-hover:scale-110 transition-transform" />
                                                </div>
                                                <span class="text-sm font-bold text-white tracking-wide">Mint</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Main Content */}
                            <div class="max-w-[1440px] mx-auto px-8 py-10">
                                {/* Token Info Banner */}
                                <div class="mb-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
                                    <div class="mt-0.5 p-1.5 bg-blue-500/20 rounded-lg shrink-0">
                                        <Info class="w-4 h-4 text-blue-400" />
                                    </div>
                                    <div>
                                        <p class="text-xs text-blue-200/80 leading-relaxed">
                                            The <span class="text-white font-bold">'Purchased (VCN)'</span> balance reflects your total token purchase history updated via CSV. <span class="text-white font-bold">'Locked'</span>, <span class="text-white font-bold">'Vesting'</span>, and <span class="text-white font-bold">'Next Unlock'</span> details will be calculated after the vesting contract is officially executed.
                                        </p>
                                    </div>
                                </div>

                                {/* Stats Row */}
                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all duration-500 shadow-xl">
                                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <WalletIcon class="w-16 h-16 text-blue-400" />
                                        </div>
                                        <div class="relative">
                                            <div class="flex items-center gap-3 mb-4">
                                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-inner">
                                                    <WalletIcon class="w-5 h-5" />
                                                </div>
                                                <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Purchased (VCN)</span>
                                            </div>
                                            <div class="text-3xl font-bold text-white tracking-tight tabular-nums group-hover:text-blue-400 transition-colors">
                                                {portfolioStats().total.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>

                                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-500 shadow-xl">
                                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Shield class="w-16 h-16 text-amber-400" />
                                        </div>
                                        <div class="relative">
                                            <div class="flex items-center gap-3 mb-4">
                                                <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shadow-inner">
                                                    <Shield class="w-5 h-5" />
                                                </div>
                                                <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Locked (VCN)</span>
                                            </div>
                                            <div class="text-3xl font-bold text-white tracking-tight tabular-nums group-hover:text-amber-400 transition-colors">
                                                0
                                            </div>
                                        </div>
                                    </div>

                                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 shadow-xl">
                                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Zap class="w-16 h-16 text-purple-400" />
                                        </div>
                                        <div class="relative">
                                            <div class="flex items-center justify-between mb-4">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shadow-inner">
                                                        <Zap class="w-5 h-5" />
                                                    </div>
                                                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Vesting</span>
                                                </div>
                                                <span class="text-xs font-bold text-purple-400">0.0%</span>
                                            </div>
                                            <div class="text-3xl font-bold text-white mb-4 tracking-tight tabular-nums">
                                                0 / {portfolioStats().total.toFixed(0)}
                                            </div>
                                            <div class="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                                <div
                                                    class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)] transition-all duration-1000"
                                                    style={{ width: `0%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div class="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] rounded-3xl p-6 relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500 shadow-xl">
                                        <div class="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Sparkles class="w-16 h-16 text-cyan-400" />
                                        </div>
                                        <div class="relative">
                                            <div class="flex items-center justify-between mb-4">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 shadow-inner">
                                                        <Sparkles class="w-5 h-5" />
                                                    </div>
                                                    <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Next Unlock</span>
                                                </div>
                                                <span class="text-xs font-bold text-cyan-400 tracking-wide">
                                                    N/A
                                                </span>
                                            </div>
                                            <div class="flex items-baseline gap-2 group-hover:text-cyan-400 transition-colors">
                                                <div class="text-3xl font-bold text-white tracking-tight group-hover:text-inherit">
                                                    0.00
                                                </div>
                                                <div class="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">VCN</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tab Navigation */}
                                <div class="flex items-center gap-1 mb-8 p-1.5 bg-white/[0.03] backdrop-blur-md rounded-2xl w-fit border border-white/[0.06] shadow-2xl">
                                    <button
                                        onClick={() => setAssetsTab('tokens')}
                                        class={`px-8 py-3 rounded-[14px] text-sm font-bold transition-all ${assetsTab() === 'tokens'
                                            ? 'bg-white/[0.08] text-white shadow-lg shadow-black/20'
                                            : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                                            }`}
                                        style={{ background: assetsTab() === 'tokens' ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                                    >
                                        Assets
                                    </button>
                                    <button
                                        onClick={() => setAssetsTab('activity')}
                                        class={`px-8 py-3 rounded-[14px] text-sm font-bold transition-all ${assetsTab() === 'activity'
                                            ? 'bg-white/[0.08] text-white shadow-lg shadow-black/20'
                                            : 'text-gray-500 hover:text-white hover:bg-white/[0.04]'
                                            }`}
                                        style={{ background: assetsTab() === 'activity' ? 'rgba(255,255,255,0.08)' : 'transparent' }}
                                    >
                                        Activity
                                    </button>
                                </div>

                                {/* Two Column Layout */}
                                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    {/* Left Column - Holdings or Activity */}
                                    <div class="lg:col-span-8 overflow-x-auto">

                                        {/* Assets Tab Content */}
                                        <Show when={assetsTab() === 'tokens'}>
                                            <div class="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-[24px] overflow-hidden shadow-2xl backdrop-blur-sm">
                                                {/* Table Header */}
                                                <div class="flex items-center px-8 py-4 border-b border-white/[0.04] text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] min-w-[600px] bg-white/[0.01]">
                                                    <div class="flex-1 min-w-[200px]">Asset</div>
                                                    <div class="w-24 text-right hidden sm:block">Market Price</div>
                                                    <div class="w-24 text-right hidden sm:block">24h Change</div>
                                                    <div class="w-32 text-right">User Holdings</div>
                                                    <div class="w-32 text-right">Total Value</div>
                                                </div>

                                                {/* Dynamic Token Rows */}
                                                <For each={['VCN', 'ETH', 'USDC']}>
                                                    {(symbol, index) => {
                                                        const asset = () => getAssetData(symbol);
                                                        const value = () => (asset().balance * asset().price).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                                                        const isLast = () => index() === 2;

                                                        return (
                                                            <div class={`flex items-center px-8 py-6 ${!isLast() ? 'border-b border-white/[0.03]' : ''} hover:bg-white/[0.03] transition-all duration-300 cursor-pointer min-w-[600px] group/row`}>
                                                                {/* Token Info */}
                                                                <div class="flex-1 min-w-[200px] flex items-center gap-4">
                                                                    <div class="relative">
                                                                        <Show when={asset().image} fallback={
                                                                            <div class={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg ${symbol === 'VCN' ? 'bg-gradient-to-br from-blue-500 to-cyan-400' :
                                                                                symbol === 'ETH' ? 'bg-gradient-to-br from-purple-500 to-indigo-400' :
                                                                                    'bg-gradient-to-br from-green-500 to-emerald-400'
                                                                                }`}>
                                                                                {symbol.charAt(0)}
                                                                            </div>
                                                                        }>
                                                                            <img src={asset().image!} alt={symbol} class="w-12 h-12 rounded-2xl flex-shrink-0 shadow-lg group-hover/row:scale-105 transition-transform" />
                                                                        </Show>
                                                                        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#0a0a0b] border-2 border-[#0a0a0b] overflow-hidden">
                                                                            <div class={`w-full h-full ${asset().change24h > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                        </div>
                                                                    </div>
                                                                    <div class="min-w-0">
                                                                        <div class="text-[17px] font-bold text-white group-hover/row:text-blue-400 transition-colors uppercase tracking-wide">{symbol}</div>
                                                                        <div class="text-[12px] text-gray-500 font-medium truncate tracking-tight">{asset().name}</div>
                                                                    </div>
                                                                </div>
                                                                {/* Price */}
                                                                <div class="w-24 text-right hidden sm:block">
                                                                    <Show when={!asset().isLoading} fallback={
                                                                        <div class="h-5 w-16 bg-white/[0.06] rounded-lg animate-pulse ml-auto" />
                                                                    }>
                                                                        <span class="text-base font-medium text-white group-hover/row:text-white transition-colors">
                                                                            ${asset().price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                            {symbol === 'VCN' && <span class="text-[11px] text-gray-500 ml-1">/ VCN</span>}
                                                                        </span>
                                                                    </Show>
                                                                </div>
                                                                {/* 24h Change */}
                                                                <div class="w-24 text-right hidden sm:block text-right">
                                                                    <Show when={!asset().isLoading} fallback={
                                                                        <div class="h-5 w-12 bg-white/[0.06] rounded-lg animate-pulse ml-auto" />
                                                                    }>
                                                                        <div class={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-bold text-[13px] ${asset().change24h > 0 ? 'text-green-400 bg-green-500/5' : asset().change24h < 0 ? 'text-red-400 bg-red-500/5' : 'text-gray-400 bg-gray-500/5'}`}>
                                                                            {asset().change24h > 0 ? <TrendingUp class="w-3 h-3" /> : ''}
                                                                            {asset().change24h.toFixed(1)}%
                                                                        </div>
                                                                    </Show>
                                                                </div>
                                                                {/* Holdings */}
                                                                <div class="w-32 text-right">
                                                                    <div class="text-[16px] font-bold text-white tabular-nums tracking-wide">{asset().balance.toLocaleString()}</div>
                                                                    <div class="text-[11px] text-gray-500 font-bold uppercase tracking-widest">{symbol}</div>
                                                                </div>
                                                                {/* Value */}
                                                                <div class="w-32 text-right">
                                                                    <Show when={!asset().isLoading} fallback={
                                                                        <div class="h-5 w-20 bg-white/[0.06] rounded-lg animate-pulse ml-auto" />
                                                                    }>
                                                                        <span class="text-[18px] font-bold text-white tabular-nums drop-shadow-sm">{value()}</span>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                        </Show>


                                        {/* Activity Tab Content */}
                                        <Show when={assetsTab() === 'activity'}>
                                            <div class="space-y-3">
                                                <Show when={vcnPurchases().length === 0}>
                                                    <div class="py-20 text-center bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                                                        <div class="text-gray-500 font-medium">No activities found</div>
                                                    </div>
                                                </Show>
                                                <For each={vcnPurchases().slice().reverse()}>
                                                    {(p) => {
                                                        const date = new Date(p.createdAt).toLocaleDateString();
                                                        return (
                                                            <div class="flex items-center justify-between py-4 px-5 bg-[#111114] border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                                                <div class="flex items-center gap-4">
                                                                    <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                                        <Plus class="w-5 h-5 text-blue-400" />
                                                                    </div>
                                                                    <div>
                                                                        <div class="text-sm font-medium text-white underline-offset-4 group-hover:underline">VCN Purchased</div>
                                                                        <div class="text-xs text-gray-500">From Vision Chain • {date}</div>
                                                                    </div>
                                                                </div>
                                                                <div class="text-right">
                                                                    <div class="text-sm font-medium text-blue-400">+{p.amount.toLocaleString()} VCN</div>
                                                                    <div class="text-xs text-gray-500">Status: {p.status}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    }}
                                                </For>
                                            </div>
                                        </Show>
                                    </div>

                                    {/* Right Column - Allocation */}
                                    <div class="lg:col-span-4 space-y-8">
                                        <div class="relative group">
                                            <div class="flex items-center justify-between mb-4">
                                                <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Portfolio Allocation</h3>
                                                <div class="p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                                                    <Menu class="w-3.5 h-3.5 text-gray-500" />
                                                </div>
                                            </div>
                                            <div class="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
                                                <div class="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                                                {/* Donut Chart */}
                                                <div class="relative w-48 h-48 mx-auto mb-10">
                                                    <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90 filter drop-shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                                        <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.02)" stroke-width="12" />
                                                        {(() => {
                                                            const tv = totalValue();
                                                            if (tv === 0) return (
                                                                <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="12" />
                                                            );

                                                            let offset = 0;
                                                            return ['VCN', 'ETH', 'USDC'].map((symbol, idx) => {
                                                                const asset = getAssetData(symbol);
                                                                const val = asset.balance * asset.price;
                                                                const ratio = val / tv;
                                                                const dashArray = `${(ratio * 238.7).toFixed(2)} 238.7`;
                                                                const currentOffset = offset;
                                                                offset -= ratio * 238.7;
                                                                const colors = ['#3b82f6', '#8b5cf6', '#10b981'];

                                                                if (ratio === 0) return null;

                                                                return (
                                                                    <circle
                                                                        cx="50" cy="50" r="38" fill="none"
                                                                        stroke={colors[idx]} stroke-width="12"
                                                                        stroke-dasharray={dashArray}
                                                                        stroke-dashoffset={currentOffset.toFixed(2)}
                                                                        stroke-linecap="butt"
                                                                        class="transition-all duration-1000 ease-out"
                                                                    />
                                                                );
                                                            });
                                                        })()}
                                                    </svg>
                                                    <div class="absolute inset-0 flex flex-col items-center justify-center">
                                                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total</div>
                                                        <div class="text-2xl font-bold text-white tracking-tighter">
                                                            {totalValue() > 0 ? '100%' : '0%'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Legend */}
                                                <div class="space-y-4">
                                                    {['VCN', 'ETH', 'USDC'].map((symbol, idx) => {
                                                        const asset = getAssetData(symbol);
                                                        const tv = totalValue();
                                                        const ratio = tv > 0 ? ((asset.balance * asset.price) / tv) * 100 : 0;
                                                        const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500'];
                                                        const shadowColors = ['rgba(59,130,246,0.5)', 'rgba(139,92,246,0.5)', 'rgba(16,185,129,0.5)'];

                                                        return (
                                                            <div class="flex items-center justify-between group/item cursor-pointer">
                                                                <div class="flex items-center gap-3">
                                                                    <div class={`w-3 h-3 rounded-full ${colors[idx]}`} style={{ 'box-shadow': `0 0 8px ${shadowColors[idx]}` }} />
                                                                    <span class="text-sm font-bold text-gray-400 group-hover/item:text-white transition-colors">{symbol}</span>
                                                                </div>
                                                                <div class="text-right">
                                                                    <span class="text-sm font-black text-white tabular-nums">{ratio.toFixed(1)}%</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Actions */}
                                        <div class="space-y-4">
                                            <div class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-2">Earning Opportunities</div>
                                            <div class="grid grid-cols-1 gap-3">
                                                <button
                                                    onClick={() => startFlow('stake')}
                                                    class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-blue-500/5 to-transparent hover:from-blue-500/10 border border-white/[0.06] rounded-[24px] transition-all duration-300 text-left group active:scale-95"
                                                    style={{ background: 'linear-gradient(to right, rgba(59,130,246,0.05), transparent)' }}
                                                >
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform shadow-xl">
                                                            <TrendingUp class="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div class="text-[15px] font-bold text-white group-hover:text-blue-400 transition-colors">Stake VCN Tokens</div>
                                                            <div class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Earn up to 12% APY</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight class="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                                </button>

                                                <button
                                                    onClick={() => setActiveView('campaign')}
                                                    class="w-full flex items-center justify-between p-5 bg-gradient-to-r from-purple-500/5 to-transparent hover:from-purple-500/10 border border-white/[0.06] rounded-[24px] transition-all duration-300 text-left group active:scale-95"
                                                    style={{ background: 'linear-gradient(to right, rgba(168,85,247,0.05), transparent)' }}
                                                >
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform shadow-xl">
                                                            <Sparkles class="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <div class="text-[15px] font-bold text-white group-hover:text-purple-400 transition-colors">Claim Rewards</div>
                                                            <div class="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Check for available rewards</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight class="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                                            onClick={() => setOnboardingStep(1)}
                                                            class="px-6 py-3 bg-white text-black rounded-2xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2"
                                                        >
                                                            Create Wallet
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
                                                            <div class="flex items-center gap-3">
                                                                <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                                    <Phone class="w-5 h-5 text-purple-400" />
                                                                </div>
                                                                <div>
                                                                    <div class="text-sm font-bold text-white">Phone Number</div>
                                                                    <div class="text-[11px] text-gray-500">{userProfile().phone || 'Not verified'}</div>
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
                                                                        : 'bg-[#1a1a1e] text-gray-300 border-white/10 hover:border-blue-500/50 hover:text-white hover:bg-blue-500/5 text-center active:scale-95'
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
                                        <Motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} class="max-w-xl mx-auto">
                                            <div class="bg-[#0e0e12] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl">
                                                <div class="bg-gradient-to-b from-green-900/20 to-transparent p-12 flex flex-col items-center text-center">
                                                    <div class="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(34,197,94,0.2)]">
                                                        <Check class="w-8 h-8 text-green-400" />
                                                    </div>
                                                    <h2 class="text-3xl font-black text-white mb-2 tracking-tight">Account Created</h2>
                                                    <p class="text-gray-400 font-medium">Your Vision Chain Account has been successfully created</p>
                                                </div>

                                                <div class="p-8 space-y-6">
                                                    <div class="p-6 bg-white/[0.02] border border-white/[0.05] rounded-3xl space-y-4">
                                                        <div class="space-y-2">
                                                            <label class="text-[11px] font-black text-gray-500 uppercase tracking-widest px-1">Your Wallet Address</label>
                                                            <div class="flex items-center gap-3 p-4 bg-black/40 rounded-2xl border border-white/[0.05] group">
                                                                <code class="flex-1 font-mono text-xs text-green-400 truncate">{walletAddress()}</code>
                                                                <button onClick={copyAddress} class="p-2 hover:bg-white/5 rounded-lg transition-all">
                                                                    <Copy class="w-3.5 h-3.5 text-gray-500 group-hover:text-white" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div class="pt-4 border-t border-white/[0.05] space-y-3">
                                                            <div class="flex items-center justify-between text-[13px]">
                                                                <span class="font-bold text-gray-500">Wallet Details</span>
                                                            </div>
                                                            <div class="flex items-center justify-between">
                                                                <span class="text-xs text-gray-400">Network:</span>
                                                                <span class="text-xs font-bold text-white">VisionChain Mainnet</span>
                                                            </div>
                                                            <div class="flex items-center justify-between">
                                                                <span class="text-xs text-gray-400">Type:</span>
                                                                <span class="text-xs font-bold text-white">HD Wallet</span>
                                                            </div>
                                                            <div class="flex items-center justify-between">
                                                                <span class="text-xs text-gray-400">Created:</span>
                                                                <span class="text-xs font-bold text-white">{new Date().toLocaleDateString()}</span>
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
                            <div class="max-w-4xl mx-auto space-y-6">
                                <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                                    <h2 class="text-3xl font-semibold text-white mb-8">Settings</h2>

                                    <div class="space-y-4">
                                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-4">
                                                    <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                                        <Zap class="w-5 h-5 text-purple-400" />
                                                    </div>
                                                    <div>
                                                        <div class="font-medium text-white">Dark Mode</div>
                                                        <div class="text-sm text-gray-500">Always enabled for best experience</div>
                                                    </div>
                                                </div>
                                                <div class="w-14 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center px-1 shadow-lg shadow-blue-500/20">
                                                    <div class="w-6 h-6 bg-white rounded-full ml-auto shadow-md" />
                                                </div>
                                            </div>
                                        </div>

                                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-4">
                                                    <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                                        <MessageSquare class="w-5 h-5 text-green-400" />
                                                    </div>
                                                    <div>
                                                        <div class="font-medium text-white">Notifications</div>
                                                        <div class="text-sm text-gray-500">Get alerts for all transactions</div>
                                                    </div>
                                                </div>
                                                <div class="w-14 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center px-1 shadow-lg shadow-blue-500/20">
                                                    <div class="w-6 h-6 bg-white rounded-full ml-auto shadow-md" />
                                                </div>
                                            </div>
                                        </div>

                                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-4">
                                                    <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                                                        <Globe class="w-5 h-5 text-cyan-400" />
                                                    </div>
                                                    <div>
                                                        <div class="font-medium text-white">Currency</div>
                                                        <div class="text-sm text-gray-500">Display values in preferred currency</div>
                                                    </div>
                                                </div>
                                                <select class="bg-white/[0.05] border border-white/[0.1] text-white px-4 py-2 rounded-xl text-sm outline-none focus:border-cyan-500/50 transition-colors">
                                                    <option value="usd">USD</option>
                                                    <option value="eur">EUR</option>
                                                    <option value="gbp">GBP</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </Motion.div>
                            </div>
                        </div>
                    </Show>

                    <Show when={activeView() === 'contacts'}>
                        <div class="flex-1 overflow-y-auto p-4 lg:p-8">
                            <div class="max-w-4xl mx-auto space-y-8">
                                <Motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    class="flex flex-col md:flex-row md:items-center justify-between gap-4"
                                >
                                    <div>
                                        <h2 class="text-3xl font-bold text-white mb-1">Address Book</h2>
                                        <p class="text-gray-500 text-sm">Manage your network and earn rewards for invitations.</p>
                                    </div>
                                    <div class="flex items-center gap-3">
                                        <button
                                            onClick={importMobileContacts}
                                            class="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all font-medium text-sm"
                                        >
                                            <Smartphone class="w-4 h-4" />
                                            Import Mobile
                                        </button>
                                        <button class="flex items-center gap-2 px-4 py-2.5 bg-white text-black rounded-xl hover:bg-white/90 transition-all font-bold text-sm">
                                            <Plus class="w-4 h-4" />
                                            Add Contact
                                        </button>
                                    </div>
                                </Motion.div>

                                {/* Referral Tracker */}
                                <Motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 }}
                                    class="relative overflow-hidden group"
                                >
                                    <div class="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-cyan-500/20 to-purple-600/20 rounded-[24px] blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
                                    <div class="relative bg-[#111113] border border-white/[0.08] rounded-[24px] p-6 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden">
                                        <div class="flex items-center gap-5">
                                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/40">
                                                <Zap class="w-7 h-7 text-white fill-white/20" />
                                            </div>
                                            <div>
                                                <div class="text-[11px] font-black text-orange-400 uppercase tracking-widest mb-1">Referral Campaign</div>
                                                <div class="text-xl font-bold text-white">Invite Friends & Get 50 VCN Each</div>
                                            </div>
                                        </div>
                                        <div class="flex gap-8 px-6 border-l border-white/[0.06]">
                                            <div class="text-center">
                                                <div class="text-2xl font-black text-white">{referralBonus()}</div>
                                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">VCN Earned</div>
                                            </div>
                                            <div class="text-center">
                                                <div class="text-2xl font-black text-white">{contacts().filter((c: any) => c.invited).length}</div>
                                                <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Invites Sent</div>
                                            </div>
                                        </div>
                                    </div>
                                </Motion.div>

                                {/* Contacts List */}
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <For each={contacts().filter(c => c.name.toLowerCase().includes(searchQuery().toLowerCase()))}>
                                        {(contact: any) => (
                                            <Motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                class="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl hover:bg-white/[0.05] transition-all group"
                                            >
                                                <div class="flex items-center justify-between gap-4">
                                                    <div class="flex items-center gap-4">
                                                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white font-black text-lg shadow-inner">
                                                            {contact.avatar}
                                                        </div>
                                                        <div>
                                                            <div class="font-bold text-white flex items-center gap-2">
                                                                {contact.name}
                                                                <Show when={contact.isUser}>
                                                                    <div class="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_#10b981]" />
                                                                </Show>
                                                            </div>
                                                            <div class="text-[11px] font-mono text-gray-500">{contact.address}</div>
                                                        </div>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <button
                                                            onClick={() => toggleFavorite(contact.id)}
                                                            class={`p-2 rounded-lg transition-colors ${contact.isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-600 hover:bg-white/5'}`}
                                                        >
                                                            <Sparkles class="w-4 h-4" />
                                                        </button>
                                                        <Show
                                                            when={contact.isUser}
                                                            fallback={
                                                                <button
                                                                    onClick={() => inviteContact(contact.id)}
                                                                    disabled={contact.invited}
                                                                    class={`px-4 py-1.5 rounded-lg text-[11px] font-black tracking-widest uppercase transition-all ${contact.invited ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20'}`}
                                                                >
                                                                    {contact.invited ? 'Invited' : 'Invite'}
                                                                </button>
                                                            }
                                                        >
                                                            <button
                                                                onClick={() => {
                                                                    setRecipientAddress(contact.address);
                                                                    startFlow('send');
                                                                }}
                                                                class="px-4 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg text-[11px] font-black tracking-widest uppercase hover:bg-blue-500/20 transition-all"
                                                            >
                                                                Send
                                                            </button>
                                                        </Show>
                                                    </div>
                                                </div>
                                            </Motion.div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </div>
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
                                            </h3>
                                            <button onClick={() => setActiveFlow(null)} class="p-2 hover:bg-white/10 rounded-full transition-colors"><Plus class="w-6 h-6 text-gray-500 rotate-45" /></button>
                                        </div>
                                        <div class="space-y-6">
                                            <Show when={activeFlow() === 'stake'}>
                                                <div class="space-y-4">
                                                    <Show when={flowStep() === 1}>
                                                        <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                            <div>
                                                                <div class="flex items-center justify-between mb-2"><label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Stake Amount</label><span class="text-[10px] font-bold text-blue-400">Balance: 2,450 VCN</span></div>
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
                                                                <div class="grid grid-cols-3 gap-2">
                                                                    <For each={['VCN', 'ETH', 'USDC']}>
                                                                        {(symbol) => (
                                                                            <button
                                                                                onClick={() => setSelectedToken(symbol)}
                                                                                class={`p-3 rounded-xl border text-xs font-bold transition-all ${selectedToken() === symbol ? 'bg-blue-500/10 border-blue-500/50 text-white' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'}`}
                                                                            >
                                                                                {symbol}
                                                                            </button>
                                                                        )}
                                                                    </For>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Recipient Address</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="0x... or ENS"
                                                                    value={recipientAddress()}
                                                                    onInput={(e) => setRecipientAddress(e.currentTarget.value)}
                                                                    class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/30 transition-all font-mono text-sm"
                                                                />
                                                            </div>
                                                            <div>
                                                                <div class="flex items-center justify-between mb-2 px-1">
                                                                    <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Amount</label>
                                                                    <span
                                                                        onClick={() => setSendAmount(getAssetData(selectedToken()).balance.toString())}
                                                                        class="text-[10px] font-black text-blue-400 uppercase tracking-widest cursor-pointer hover:text-blue-300 transition-colors"
                                                                    >
                                                                        Max: {getAssetData(selectedToken()).balance.toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div class="relative">
                                                                    <input
                                                                        type="number"
                                                                        placeholder="0.00"
                                                                        value={sendAmount()}
                                                                        onInput={(e) => setSendAmount(e.currentTarget.value)}
                                                                        class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/30 transition-all text-xl font-bold font-mono"
                                                                    />
                                                                    <div class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{selectedToken()}</div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                disabled={!recipientAddress() || !sendAmount() || Number(sendAmount()) <= 0}
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
                                                                <div class="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-2">You are sending</div>
                                                                <div class="text-4xl font-bold text-white mb-1">{sendAmount()} {selectedToken()}</div>
                                                                <div class="text-sm text-gray-500">≈ ${(Number(sendAmount()) * getAssetData(selectedToken()).price).toFixed(2)}</div>
                                                            </div>

                                                            <div class="space-y-3">
                                                                <div class="flex justify-between text-sm">
                                                                    <span class="text-gray-500">To</span>
                                                                    <span class="text-white font-mono">{recipientAddress().slice(0, 6)}...{recipientAddress().slice(-4)}</span>
                                                                </div>
                                                                <div class="flex justify-between text-sm">
                                                                    <span class="text-gray-500">Network Fee</span>
                                                                    <span class="text-green-400 font-bold">0.00021 ETH ($0.45)</span>
                                                                </div>
                                                                <div class="flex justify-between text-sm">
                                                                    <span class="text-gray-500">Estimated Time</span>
                                                                    <span class="text-white font-bold">~12 seconds</span>
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
                                                                    <Show when={flowLoading()} fallback="Confirm & Send">
                                                                        <RefreshCw class="w-4 h-4 animate-spin" />
                                                                        Sending...
                                                                    </Show>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </Show>

                                                    {/* Step 3: Result */}
                                                    <Show when={flowStep() === 3}>
                                                        <div class="py-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                                                            <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 mb-6">
                                                                <Check class="w-10 h-10 text-white" />
                                                            </div>
                                                            <h4 class="text-2xl font-bold text-white mb-2">Transaction Sent!</h4>
                                                            <p class="text-gray-500 mb-8 max-w-xs leading-relaxed">
                                                                Your transaction has been submitted to the Vision Chain network.
                                                            </p>
                                                            <div class="w-full space-y-3">
                                                                <button class="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5">
                                                                    View on Explorer
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

                                            <Show when={activeFlow() === 'receive'}>
                                                <div class="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                                    <div>
                                                        <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-4 text-center">Select Network</label>
                                                        <div class="flex flex-wrap justify-center gap-2">
                                                            <For each={['Vision Chain', 'Ethereum', 'Base', 'Solana']}>
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
                                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Balance: {getAssetData(selectedToken()).balance.toLocaleString()}</span>
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
                                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Balance: {getAssetData(toToken()).balance.toLocaleString()}</span>
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
                                    class="relative w-full max-w-md bg-[#0e0e12] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
                                >
                                    <div class="p-8 space-y-6">
                                        <div class="text-center">
                                            <div class="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                                                <Lock class="w-8 h-8 text-blue-400" />
                                            </div>
                                            <h3 class="text-2xl font-bold text-white mb-2">
                                                {passwordMode() === 'setup' ? 'Set Wallet Spending Password' : 'Confirm Spending Password'}
                                            </h3>
                                            <p class="text-sm text-gray-400">
                                                {passwordMode() === 'setup'
                                                    ? 'This password encrypts your private key locally and is required for transactions.'
                                                    : 'Please enter your spending password to authorize this transaction.'}
                                                <br />
                                                <span class="text-blue-400 font-bold">It is different from your login password.</span>
                                            </p>
                                        </div>

                                        <div class="px-2 space-y-4">
                                            <div class="relative w-full">
                                                <input
                                                    type={showWalletPassword() ? "text" : "password"}
                                                    placeholder={passwordMode() === 'setup' ? "Create spending password" : "Enter spending password"}
                                                    class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 transition-all font-mono text-center"
                                                    value={walletPassword()}
                                                    onInput={(e) => setWalletPassword(e.currentTarget.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && (passwordMode() === 'setup' ? finalizeWalletCreation() : executePendingAction())}
                                                />
                                                <button
                                                    onClick={() => setShowWalletPassword(!showWalletPassword())}
                                                    class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-2"
                                                >
                                                    {showWalletPassword() ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                                                </button>
                                            </div>

                                            <Show when={passwordMode() === 'setup'}>
                                                <div class="relative w-full">
                                                    <input
                                                        type={showWalletPassword() ? "text" : "password"}
                                                        placeholder="Confirm spending password"
                                                        class="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 transition-all font-mono text-center"
                                                        value={confirmWalletPassword()}
                                                        onInput={(e) => setConfirmWalletPassword(e.currentTarget.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && finalizeWalletCreation()}
                                                    />
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
                                                disabled={!walletPassword() || isLoading() || (passwordMode() === 'setup' && !confirmWalletPassword())}
                                                class="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Show when={isLoading()} fallback={passwordMode() === 'setup' ? "Create Wallet" : "Confirm Payment"}>
                                                    <RefreshCw class="w-4 h-4 animate-spin" />
                                                    {passwordMode() === 'setup' ? 'Encrypting...' : 'Authorizing...'}
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
                    <AIChat isOpen={showChat()} onClose={() => setShowChat(false)} />
                </main>
            </section >
        </Show>
    );
};

export default Wallet;
