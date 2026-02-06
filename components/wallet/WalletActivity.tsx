import { Show, For, createSignal, onMount, createEffect } from 'solid-js';
import { Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink } from 'lucide-solid';
import { ethers } from 'ethers';
import { contractService } from '../../services/contractService';
import { getFirebaseDb } from '../../services/firebaseService';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

interface WalletActivityProps {
    purchases: () => any[];
    walletAddress?: string; // Optional for view-only or uninitialized states
    contacts?: any[];
}

interface Transaction {
    hash: string;
    from_addr: string;
    to_addr: string;
    value: string;
    timestamp: number;
    type: string;
    status: 'success' | 'pending' | 'challenged' | 'reverted';
    metadata?: any;
    blockNumber: number;
    bridgeStatus?: 'PENDING' | 'CHALLENGED' | 'FINALIZED' | 'REVERTED';
    challengeEndTime?: number;
}

const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const WalletActivity = (props: WalletActivityProps) => {
    const [transactions, setTransactions] = createSignal<Transaction[]>([]);
    const [loading, setLoading] = createSignal(false);
    const [page, setPage] = createSignal(1);
    const [hasMore, setHasMore] = createSignal(true);
    const PAGE_SIZE = 20;

    const fetchHistory = async (p: number = 1) => {
        if (!props.walletAddress) return;

        try {
            setLoading(true);
            setPage(p);
            const normalizedAddress = props.walletAddress.toLowerCase();

            // Query Firestore directly instead of server API
            const db = getFirebaseDb();
            const txRef = collection(db, 'transactions');

            // Use two separate queries to avoid composite index requirement
            // Query 1: Transactions sent by user
            const sentQuery = query(
                txRef,
                where('from_addr', '==', normalizedAddress),
                limit(PAGE_SIZE)
            );

            // Query 2: Transactions received by user
            const receivedQuery = query(
                txRef,
                where('to_addr', '==', normalizedAddress),
                limit(PAGE_SIZE)
            );

            const [sentSnapshot, receivedSnapshot] = await Promise.all([
                getDocs(sentQuery),
                getDocs(receivedQuery)
            ]);

            console.log(`[WalletActivity] Querying for address: ${normalizedAddress}`);
            console.log(`[WalletActivity] Sent transactions found: ${sentSnapshot.docs.length}`);
            console.log(`[WalletActivity] Received transactions found: ${receivedSnapshot.docs.length}`);

            // Debug: Log first sent transaction
            if (sentSnapshot.docs.length > 0) {
                const firstSent = sentSnapshot.docs[0].data();
                console.log(`[WalletActivity] First sent tx:`, firstSent.hash?.slice(0, 15), 'from:', firstSent.from_addr?.slice(0, 15), 'to:', firstSent.to_addr?.slice(0, 15), 'time:', new Date(firstSent.timestamp).toISOString());
            }

            // Merge and deduplicate by hash
            const allTxs = new Map();
            sentSnapshot.docs.forEach(doc => allTxs.set(doc.id, doc.data()));
            receivedSnapshot.docs.forEach(doc => allTxs.set(doc.id, doc.data()));

            // Sort by timestamp descending
            const data = Array.from(allTxs.values())
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, PAGE_SIZE);

            const mapped = data.map(tx => ({
                hash: tx.hash,
                from_addr: tx.from_addr,
                to_addr: tx.to_addr,
                value: tx.value,
                timestamp: tx.timestamp,
                type: tx.type || 'Transfer',
                status: 'success' as const,
                blockNumber: tx.block_number || 0,
                bridgeStatus: tx.bridgeStatus || undefined,
                challengeEndTime: tx.challengeEndTime || undefined
            }));

            setTransactions(mapped);
            setHasMore(data.length === PAGE_SIZE);
        } catch (error) {
            console.error("Failed to fetch transaction history from Firestore:", error);
        } finally {
            setLoading(false);
        }
    };

    onMount(() => fetchHistory(1));

    createEffect(() => {
        if (props.walletAddress) fetchHistory(1);
    });

    const handleNext = () => {
        if (!loading() && hasMore()) {
            fetchHistory(page() + 1);
        }
    };

    const handlePrev = () => {
        if (!loading() && page() > 1) {
            fetchHistory(page() - 1);
        }
    };

    return (
        <div class="space-y-8">
            {/* 1. Off-Chain Records (Top) - Only show on first page to keep it clean */}
            <Show when={page() === 1}>
                <div class="space-y-3">
                    <div class="flex items-center justify-between px-1">
                        <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                            <span class="w-1 h-1 rounded-full bg-purple-500"></span>
                            Off-chain Records
                        </h3>
                    </div>

                    <Show when={props.purchases().length === 0}>
                        <div class="py-12 text-center bg-white/[0.01] border border-white/[0.04] rounded-2xl border-dashed">
                            <div class="text-gray-600 font-medium text-xs">No purchase records found</div>
                        </div>
                    </Show>

                    <For each={props.purchases().slice().reverse()}>
                        {(p) => {
                            const date = new Date(p.createdAt).toLocaleDateString();
                            return (
                                <div class="flex items-center justify-between py-4 px-5 bg-[#111114] border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group">
                                    <div class="flex items-center gap-4">
                                        <div class="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Plus class="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <div class="text-sm font-medium text-white underline-offset-4 decoration-purple-500/30 group-hover:underline">VCN Purchase</div>
                                            <div class="text-xs text-gray-500 italic">Seed Round • {date}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-bold text-purple-400">+{p.amount.toLocaleString()} VCN</div>
                                        <div class="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-1">Allocated Record</div>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* 2. On-Chain Activity (Bottom) */}
            <div class="space-y-3">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <span class="w-1 h-1 rounded-full bg-blue-500"></span>
                        On-chain Activity
                        <Show when={page() > 1}>
                            <span class="ml-2 text-blue-400/50 bg-blue-500/10 px-1.5 py-0.5 rounded text-[8px]">Page {page()}</span>
                        </Show>
                    </h3>
                    <button
                        onClick={() => fetchHistory(page())}
                        disabled={loading()}
                        class="p-1.5 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-blue-400 disabled:opacity-50"
                    >
                        <RefreshCw class={`w-3.5 h-3.5 ${loading() ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <Show when={loading() && transactions().length === 0}>
                    <div class="py-10 text-center">
                        <RefreshCw class="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                        <div class="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">Syncing Blockchain History...</div>
                    </div>
                </Show>

                <Show when={!loading() && transactions().length === 0}>
                    <div class="py-12 text-center bg-white/[0.01] border border-white/[0.04] rounded-2xl border-dashed">
                        <div class="text-gray-600 font-medium text-xs">No on-chain history found on this page</div>
                    </div>
                </Show>

                <div class={`transition-opacity duration-300 ${loading() ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <For each={transactions()}>
                        {(tx) => {
                            const isIncoming = tx.to_addr.toLowerCase() === props.walletAddress?.toLowerCase();
                            const isBridge = tx.type === 'Bridge' || tx.to_addr.startsWith('bridge:');
                            const date = new Date(tx.timestamp).toLocaleString();
                            const shortHash = `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`;

                            return (
                                <div class={`flex items-center justify-between py-4 px-5 bg-[#111114] border rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group mb-3 last:mb-0 ${isBridge ? 'border-purple-500/20' : 'border-white/[0.04]'}`}>
                                    <div class="flex items-center gap-4">
                                        <div class={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${isBridge
                                            ? 'bg-purple-500/10 text-purple-400'
                                            : isIncoming
                                                ? 'bg-green-500/10 text-green-400'
                                                : 'bg-blue-500/10 text-blue-400'}`}>
                                            {isBridge ? <RefreshCw class="w-5 h-5" /> : isIncoming ? <ArrowDownLeft class="w-5 h-5" /> : <ArrowUpRight class="w-5 h-5" />}
                                        </div>
                                        <div class="flex-1 min-w-0 pr-2">
                                            <div class="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                                                {isBridge ? (
                                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                        <span class="text-purple-400 font-bold">Bridge</span>
                                                        <span class="text-gray-400">to</span>
                                                        <span class="text-purple-300 font-black uppercase tracking-tight">
                                                            {tx.to_addr.replace('bridge:', '')}
                                                        </span>
                                                    </div>
                                                ) : (() => {
                                                    const counterpartyAddr = isIncoming ? tx.from_addr : tx.to_addr;
                                                    const contact = props.contacts?.find((c: any) =>
                                                        c.address?.toLowerCase() === counterpartyAddr?.toLowerCase()
                                                    );
                                                    const shortAddr = counterpartyAddr ? `${counterpartyAddr.slice(0, 6)}...${counterpartyAddr.slice(-4)}` : 'unknown';
                                                    const displayName = contact ? (contact.internalName || contact.name) : 'unknown';
                                                    const prefix = isIncoming ? 'Received from' : 'Sent to';

                                                    return (
                                                        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                            <span class="text-gray-400 font-bold shrink-0">{prefix}</span>
                                                            <span class={`font-black italic tracking-tight truncate max-w-[140px] sm:max-w-none pr-1.5 ${contact ? 'text-blue-400 uppercase' : 'text-gray-500 text-[11px]'}`}>
                                                                {displayName}
                                                            </span>
                                                            <span class="text-[10px] text-gray-600 font-mono shrink-0">({shortAddr})</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div class="text-xs text-gray-500 font-mono mt-1 italic opacity-80">{date}</div>
                                        </div>
                                    </div>
                                    <div class="text-right">
                                        <div class={`text-sm font-bold ${isIncoming ? 'text-green-400' : 'text-white'}`}>
                                            {isIncoming ? '+' : '-'}{parseFloat(tx.value).toLocaleString(undefined, { maximumFractionDigits: 6 })} VCN
                                        </div>
                                        <a
                                            href={`/visionscan?tx=${tx.hash}`}
                                            target="_blank"
                                            class="text-[10px] font-mono text-gray-500 hover:text-white flex items-center justify-end gap-1 mt-1 transition-colors"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {shortHash} <ExternalLink class="w-2.5 h-2.5" />
                                        </a>
                                        {/* Bridge Status Badge */}
                                        <Show when={tx.bridgeStatus && tx.bridgeStatus !== 'FINALIZED'}>
                                            <div class={`mt-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${tx.bridgeStatus === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                                tx.bridgeStatus === 'CHALLENGED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                                    'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                                                }`}>
                                                <span class={`w-1.5 h-1.5 rounded-full animate-pulse ${tx.bridgeStatus === 'PENDING' ? 'bg-amber-400' :
                                                    tx.bridgeStatus === 'CHALLENGED' ? 'bg-red-400' : 'bg-gray-400'
                                                    }`} />
                                                {tx.bridgeStatus === 'PENDING' ? 'Pending' : tx.bridgeStatus === 'CHALLENGED' ? 'Challenged' : tx.bridgeStatus}
                                            </div>
                                        </Show>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>

                {/* Pagination Controls */}
                <div class="flex items-center justify-center gap-4 pt-6">
                    <button
                        onClick={handlePrev}
                        disabled={loading() || page() === 1}
                        class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 transition-all"
                    >
                        Previous
                    </button>
                    <div class="text-xs font-mono text-gray-500">
                        Page <span class="text-blue-400 font-bold">{page()}</span>
                    </div>
                    <button
                        onClick={handleNext}
                        disabled={loading() || !hasMore()}
                        class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-white/5 transition-all"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
};
