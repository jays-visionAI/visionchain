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
    const [isExpanded, setIsExpanded] = createSignal(false);
    let unsubscribe1: (() => void) | null = null;
    let unsubscribe2: (() => void) | null = null;

    // Get chain name from chainId
    const getChainName = (chainId: number): string => {
        if (chainId === 11155111) return 'Sepolia';
        if (chainId === 1337 || chainId === 20261337) return 'Vision';
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

        let bridgeTxList: BridgeTransaction[] = [];
        let txList: BridgeTransaction[] = [];

        const updateCombinedBridges = () => {
            // Combine and sort by timestamp, remove duplicates
            const combined = [...bridgeTxList, ...txList];
            combined.sort((a, b) => {
                const timeA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
                const timeB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
                return timeB.getTime() - timeA.getTime();
            });
            console.log('[BridgeAgentChip] Combined bridges:', combined.length);
            setBridges(combined.slice(0, 5));
            setIsLoading(false);
        };

        try {
            const db = getFirebaseDb();

            // 1. Subscribe to bridgeTransactions collection (backend-created)
            const bridgeRef = collection(db, 'bridgeTransactions');
            const q1 = query(
                bridgeRef,
                where('user', '==', normalizedAddr),
                orderBy('createdAt', 'desc'),
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
            });

            // 2. Subscribe to transactions collection (frontend-created bridges)
            // Note: Using simpler query to avoid index requirement
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
        if (unsubscribe1) unsubscribe1();
        if (unsubscribe2) unsubscribe2();
    });

    // Count active (pending) bridges - include all non-final states
    const activeBridges = () => bridges().filter(b =>
        b.status === 'COMMITTED' || b.status === 'PROCESSING' ||
        b.status === 'PENDING' || b.status === 'SUBMITTED'
    );

    // Filter visible bridges (active + recently completed within 1 minute)
    const visibleBridges = () => {
        const now = Date.now();
        console.log('[BridgeAgentChip] Filtering bridges, total:', bridges().length);
        return bridges().filter(b => {
            // Always show active bridges (including PENDING/SUBMITTED)
            if (b.status === 'COMMITTED' || b.status === 'PROCESSING' ||
                b.status === 'PENDING' || b.status === 'SUBMITTED') {
                console.log('[BridgeAgentChip] Active bridge:', b.id, b.status);
                return true;
            }
            // Show completed/finalized bridges for 1 minute after completion
            if ((b.status === 'COMPLETED' || b.status === 'FINALIZED') && b.completedAt) {
                const completedTime = b.completedAt.toDate ? b.completedAt.toDate().getTime() : b.completedAt;
                return (now - completedTime) < 60000; // 1 minute
            }
            // Show recently created completed bridges (fallback if no completedAt)
            if ((b.status === 'COMPLETED' || b.status === 'FINALIZED') && b.createdAt) {
                const createdTime = b.createdAt.toDate ? b.createdAt.toDate().getTime() : b.createdAt;
                return (now - createdTime) < 120000; // 2 minutes from creation
            }
            // Show failed bridges
            if (b.status === 'FAILED') return true;
            return false;
        });
    };

    // Reactive show condition
    const shouldShow = () => !isLoading() && visibleBridges().length > 0;

    return (
        <Show when={shouldShow()}>
            <Motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                class="relative flex flex-col rounded-2xl border backdrop-blur-xl overflow-hidden bg-purple-500/10 border-purple-500/30 min-w-[240px] max-w-[320px] shadow-2xl shadow-black/40"
            >
                {/* Header */}
                <button
                    onClick={() => setIsExpanded(!isExpanded())}
                    class="flex items-center justify-between p-3.5 hover:bg-white/[0.02] transition-colors"
                >
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
                            <span class="text-[9px] font-bold text-purple-400">
                                {activeBridges().length > 0
                                    ? `${activeBridges().length} Active`
                                    : `${bridges().length} Total`}
                            </span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Show when={activeBridges().length > 0}>
                            <span class="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-[8px] font-black text-purple-300 animate-pulse">
                                PROCESSING
                            </span>
                        </Show>
                        {isExpanded() ? (
                            <ChevronUp class="w-4 h-4 text-gray-500" />
                        ) : (
                            <ChevronDown class="w-4 h-4 text-gray-500" />
                        )}
                    </div>
                </button>

                {/* Expanded Bridge List */}
                <Show when={isExpanded()}>
                    <div class="border-t border-white/5 bg-black/20 max-h-[300px] overflow-y-auto custom-scrollbar">
                        <For each={bridges()}>
                            {(bridge) => (
                                <div class="p-3 border-b border-white/5 last:border-b-0 space-y-2">
                                    {/* Bridge Info */}
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="text-[11px] font-black text-white">
                                                {parseFloat(bridge.amount).toLocaleString()} VCN
                                            </span>
                                            <span class="text-[9px] text-gray-500">
                                                {getChainName(bridge.srcChainId)} → {getChainName(bridge.dstChainId)}
                                            </span>
                                        </div>
                                        <span class={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${bridge.status === 'COMMITTED' ? 'bg-blue-500/10 text-blue-400' :
                                            bridge.status === 'PROCESSING' ? 'bg-amber-500/10 text-amber-400' :
                                                bridge.status === 'COMPLETED' || bridge.status === 'FINALIZED' ? 'bg-green-500/10 text-green-400' :
                                                    'bg-red-500/10 text-red-400'
                                            }`}>
                                            {bridge.status === 'COMMITTED' ? 'Pending' :
                                                bridge.status === 'PROCESSING' ? 'Verifying' :
                                                    bridge.status === 'COMPLETED' || bridge.status === 'FINALIZED' ? 'Done' : 'Failed'}
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <Show when={bridge.status !== 'FAILED'}>
                                        <div class="flex gap-0.5">
                                            <div class={`h-0.5 flex-1 rounded-full ${['COMMITTED', 'PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge.status)
                                                ? 'bg-blue-500'
                                                : 'bg-gray-800'
                                                }`} />
                                            <div class={`h-0.5 flex-1 rounded-full ${['PROCESSING', 'COMPLETED', 'FINALIZED'].includes(bridge.status)
                                                ? 'bg-amber-500'
                                                : 'bg-gray-800'
                                                }`} />
                                            <div class={`h-0.5 flex-1 rounded-full ${['COMPLETED', 'FINALIZED'].includes(bridge.status)
                                                ? 'bg-green-500'
                                                : 'bg-gray-800'
                                                }`} />
                                        </div>
                                    </Show>

                                    {/* Time & Link */}
                                    <div class="flex items-center justify-between">
                                        <span class="text-[9px] text-gray-600">{getTimeAgo(bridge.createdAt)}</span>
                                        <div class="flex items-center gap-2">
                                            <Show when={bridge.status === 'COMMITTED' || bridge.status === 'PROCESSING'}>
                                                <span class="text-[9px] text-purple-400 font-bold flex items-center gap-1">
                                                    <Clock class="w-2.5 h-2.5" />
                                                    {getEstimatedCompletion(bridge.createdAt, bridge.status)}
                                                </span>
                                            </Show>
                                            <Show when={bridge.txHash}>
                                                <a
                                                    href={`https://www.visionchain.co/visionscan/tx/${bridge.txHash}`}
                                                    target="_blank"
                                                    class="text-[9px] text-gray-500 hover:text-purple-400 flex items-center gap-0.5 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink class="w-2.5 h-2.5" />
                                                </a>
                                            </Show>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>

                    {/* Footer */}
                    <div class="p-2 bg-black/30 border-t border-white/5">
                        <button
                            onClick={() => props.onViewBridgePage?.()}
                            class="w-full py-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-xl text-[9px] font-black text-purple-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <ArrowRightLeft class="w-3 h-3" />
                            Go to Bridge Page
                        </button>
                    </div>
                </Show>

                {/* Glow Effect */}
                <div class="absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-10 bg-purple-500" />
            </Motion.div>
        </Show>
    );
};

export default BridgeAgentChip;
