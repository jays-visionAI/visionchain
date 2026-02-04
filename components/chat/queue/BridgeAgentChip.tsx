import { createSignal, createEffect, Show, For, onCleanup } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    ArrowRightLeft,
    Clock,
    ExternalLink,
    Check,
    Loader2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    RefreshCw
} from 'lucide-solid';
import { getFirebaseDb } from '../../../services/firebaseService';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';

interface BridgeTransaction {
    id: string;
    user: string;
    srcChainId: number;
    dstChainId: number;
    amount: string;
    recipient: string;
    intentHash?: string;
    txHash: string;
    status: 'PENDING' | 'SUBMITTED' | 'COMMITTED' | 'PROCESSING' | 'COMPLETED' | 'FINALIZED' | 'FAILED';
    createdAt: any;
    completedAt?: any;
}

interface BridgeAgentChipProps {
    walletAddress: string;
    onViewBridgePage?: () => void;
}

const BridgeAgentChip = (props: BridgeAgentChipProps) => {
    const [bridges, setBridges] = createSignal<BridgeTransaction[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    // const [isExpanded, setIsExpanded] = createSignal(false); // Removed
    let unsubscribe1: (() => void) | null = null;
    let unsubscribe2: (() => void) | null = null;

    // Get chain name from chainId
    const getChainName = (chainId: number): string => {
        if (chainId === 11155111) return 'Sepolia';
        if (chainId === 1337 || chainId === 20261337) return 'Vision';
        return `Chain ${chainId}`;
    };

    // Format amount from Wei to VCN
    const formatAmount = (weiAmount: string): string => {
        try {
            const wei = BigInt(weiAmount);
            const vcn = Number(wei) / 1e18;
            if (vcn >= 1000000) return `${(vcn / 1000000).toFixed(2)}M`;
            if (vcn >= 1000) return `${(vcn / 1000).toFixed(2)}K`;
            return vcn.toFixed(vcn < 10 ? 2 : 0);
        } catch {
            return weiAmount;
        }
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
        if (status === 'COMPLETED' || status === 'FINALIZED') return 'Complete';
        if (status === 'FAILED') return 'Failed';
        if (!createdAt) return '~2-5 min';

        const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        const elapsed = (Date.now() - date.getTime()) / 60000;
        const remaining = Math.max(0, 5 - elapsed);

        if (remaining <= 0) return 'Soon...';
        return `~${Math.ceil(remaining)}m`;
    };

    // Subscribe to Firebase - both bridgeTransactions and transactions collections
    createEffect(() => {
        const addr = props.walletAddress;
        if (!addr) {
            console.log('[BridgeAgentChip] No wallet address provided');
            setBridges([]);
            setIsLoading(false);
            return;
        }

        const normalizedAddr = addr.toLowerCase();
        console.log('[BridgeAgentChip] Subscribing for wallet:', normalizedAddr);

        setIsLoading(true);
        let bridgeTxList: BridgeTransaction[] = [];
        let txList: BridgeTransaction[] = [];

        const updateCombinedBridges = () => {
            // Combine and deduplicate by id
            const combined = [...bridgeTxList, ...txList];
            const unique = combined.filter((b, i, arr) =>
                arr.findIndex(x => x.id === b.id) === i
            );
            console.log('[BridgeAgentChip] Combined bridges:', unique.length);
            setBridges(unique);
            setIsLoading(false);
        };

        try {
            const db = getFirebaseDb();

            // 1. Listen to bridgeTransactions collection (legacy)
            const bridgeRef = collection(db, 'bridgeTransactions');
            const q1 = query(
                bridgeRef,
                where('user', '==', normalizedAddr),
                // orderBy('createdAt', 'desc'), // Removed orderBy for now to avoid index issues
                limit(5)
            );

            unsubscribe1 = onSnapshot(q1, (snapshot) => {
                bridgeTxList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as BridgeTransaction));
                console.log('[BridgeAgentChip] bridgeTransactions:', bridgeTxList.length);
                updateCombinedBridges();
            }, (error) => {
                console.error('[BridgeAgentChip] bridgeTransactions error:', error);
                updateCombinedBridges();
            });

            // 2. Listen to users/{email}/transactions where type === 'Bridge'
            const txRef = collection(db, 'transactions');
            const q2 = query(
                txRef,
                where('from_addr', '==', normalizedAddr),
                where('type', '==', 'Bridge'),
                limit(10) // Get more, will sort client-side
            );

            unsubscribe2 = onSnapshot(q2, (snapshot) => {
                txList = snapshot.docs.map(doc => {
                    const data = doc.data();
                    console.log('[BridgeAgentChip] Found bridge tx:', doc.id, 'status:', data.bridgeStatus);
                    // Map transactions format to BridgeTransaction format
                    // Keep original status names for display
                    const status = data.bridgeStatus || 'PENDING';
                    return {
                        id: doc.id,
                        user: data.from_addr,
                        srcChainId: data.metadata?.srcChainId || 1337,
                        dstChainId: data.metadata?.dstChainId || 11155111,
                        amount: String(parseFloat(data.value || '0') * 1e18),
                        recipient: data.from_addr,
                        txHash: data.hash,
                        intentHash: data.intentHash,
                        status: status as BridgeTransaction['status'],
                        createdAt: data.timestamp ? { toDate: () => new Date(data.timestamp) } : null,
                        completedAt: data.completedAt
                    } as BridgeTransaction;
                });
                // Sort client-side by timestamp (newest first)
                txList.sort((a, b) => {
                    const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
                    const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
                    return timeB - timeA;
                });
                console.log('[BridgeAgentChip] transactions bridges:', txList.length);
                updateCombinedBridges();
            }, (error) => {
                console.error('[BridgeAgentChip] transactions error:', error);
                // Index might be missing - still show bridgeTransactions
                updateCombinedBridges();
            });
        } catch (err) {
            console.error('[BridgeAgentChip] Failed to subscribe:', err);
            setIsLoading(false);
        }
    });

    onCleanup(() => {
        unsubscribe1?.();
        unsubscribe2?.();
    });

    // Count active (pending) bridges - include all non-final states
    const activeBridges = () => bridges().filter(b =>
        b.status === 'COMMITTED' || b.status === 'PROCESSING' ||
        b.status === 'PENDING' || b.status === 'SUBMITTED'
    );

    // Filter visible bridges (active + recently completed within 1 minute)
    const visibleBridges = () => {
        const now = Date.now();
        const oneMinute = 60 * 1000;

        return bridges().filter(b => {
            // Always show active bridges
            if (b.status === 'COMMITTED' || b.status === 'PROCESSING' ||
                b.status === 'PENDING' || b.status === 'SUBMITTED') {
                return true;
            }

            // Show completed within last minute
            if (b.status === 'COMPLETED' || b.status === 'FINALIZED') {
                const completedTime = b.completedAt?.toDate?.()?.getTime() ||
                    b.createdAt?.toDate?.()?.getTime() || 0; // Fallback to createdAt if completedAt is missing
                return (now - completedTime) < oneMinute;
            }

            // Show failed bridges
            if (b.status === 'FAILED') return true;

            return false;
        }).sort((a, b) => {
            // Sort by createdAt (newest first)
            const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
            const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
            return timeB - timeA;
        });
    };

    // Get the latest bridge to display
    const latestBridge = () => visibleBridges()[0] || null;

    // Reactive show condition
    const shouldShow = () => !isLoading() && latestBridge() !== null;

    // Get status display info
    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'PENDING':
            case 'SUBMITTED':
            case 'COMMITTED':
                return { label: 'Processing', color: 'text-blue-400', bg: 'bg-blue-500/10', pulse: true, icon: Loader2 };
            case 'PROCESSING':
                return { label: 'Verifying', color: 'text-amber-400', bg: 'bg-amber-500/10', pulse: true, icon: Loader2 };
            case 'COMPLETED':
            case 'FINALIZED':
                return { label: 'Complete', color: 'text-green-400', bg: 'bg-green-500/10', pulse: false, icon: Check };
            case 'FAILED':
                return { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10', pulse: false, icon: AlertCircle };
            default:
                return { label: status, color: 'text-gray-400', bg: 'bg-gray-500/10', pulse: false, icon: ArrowRightLeft };
        }
    };

    return (
        <Show when={shouldShow()}>
            <Motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                class="relative flex flex-col rounded-2xl border backdrop-blur-xl overflow-hidden bg-purple-500/10 border-purple-500/30 min-w-[240px] max-w-[320px] shadow-2xl shadow-black/40"
            >
                {/* Single Bridge Display */}
                <div class="p-3.5 space-y-3">
                    {/* Header */}
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                <Show when={activeBridges().length > 0} fallback={<ArrowRightLeft class="w-4 h-4 text-purple-400" />}>
                                    <Loader2 class="w-4 h-4 text-purple-400 animate-spin" />
                                </Show>
                            </div>
                            <div class="flex flex-col items-start">
                                <span class="text-[10px] font-black text-white uppercase tracking-widest">
                                    Bridge Agent
                                </span>
                                <Show when={latestBridge()}>
                                    {(bridge) => {
                                        const statusInfo = getStatusInfo(bridge().status);
                                        return (
                                            <span class={`text-[9px] font-bold ${statusInfo.color} ${statusInfo.pulse ? 'animate-pulse' : ''}`}>
                                                {statusInfo.label}
                                            </span>
                                        );
                                    }}
                                </Show>
                            </div>
                        </div>
                        <Show when={activeBridges().length > 0}>
                            <span class="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[8px] font-black text-purple-300 animate-pulse">
                                {activeBridges().length} ACTIVE
                            </span>
                        </Show>
                    </div>

                    {/* Bridge Info */}
                    <Show when={latestBridge()}>
                        {(bridge) => (
                            <div class="bg-black/20 rounded-xl p-3 space-y-2 border border-white/5">
                                <div class="flex items-center justify-between">
                                    <span class="text-lg font-black text-white">
                                        {formatAmount(bridge().amount)} VCN
                                    </span>
                                    <span class="text-[9px] text-gray-500">
                                        {getTimeAgo(bridge().createdAt)}
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 text-[10px] text-gray-400">
                                    <span class="font-bold">{getChainName(bridge().srcChainId)}</span>
                                    <ArrowRightLeft class="w-3 h-3 text-purple-400" />
                                    <span class="font-bold">{getChainName(bridge().dstChainId)}</span>
                                </div>
                                {/* Progress Bar */}
                                <div class="flex gap-0.5 mt-2">
                                    <div class={`h-1 flex-1 rounded-full ${['PENDING', 'SUBMITTED', 'COMMITTED', 'PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge().status)
                                        ? 'bg-blue-500' : 'bg-gray-800'}`} />
                                    <div class={`h-1 flex-1 rounded-full ${['PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge().status)
                                        ? 'bg-amber-500' : 'bg-gray-800'}`} />
                                    <div class={`h-1 flex-1 rounded-full ${['COMPLETED', 'FINALIZED'].includes(bridge().status)
                                        ? 'bg-green-500' : 'bg-gray-800'}`} />
                                </div>
                                {/* Time & Link */}
                                <div class="flex items-center justify-between pt-2">
                                    <Show when={bridge().status === 'COMMITTED' || bridge().status === 'PROCESSING' || bridge().status === 'PENDING' || bridge().status === 'SUBMITTED'}>
                                        <span class="text-[9px] text-purple-400 font-bold flex items-center gap-1">
                                            <Clock class="w-2.5 h-2.5" />
                                            {getEstimatedCompletion(bridge().createdAt, bridge().status)}
                                        </span>
                                    </Show>
                                    <Show when={bridge().txHash}>
                                        <a
                                            href={`https://www.visionchain.co/visionscan/tx/${bridge().txHash}`}
                                            target="_blank"
                                            class="text-[9px] text-gray-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            View Tx <ExternalLink class="w-2.5 h-2.5" />
                                        </a>
                                    </Show>
                                </div>
                            </div>
                        )}
                    </Show>

                    {/* Go to Bridge Page Button */}
                    <button
                        onClick={() => props.onViewBridgePage?.()}
                        class="w-full py-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-[9px] font-black text-purple-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowRightLeft class="w-3 h-3" />
                        Go to Bridge Page
                    </button>
                </div>

                {/* Glow Effect */}
                <div class="absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-10 bg-purple-500" />
            </Motion.div>
        </Show>
    );
};

export default BridgeAgentChip;
