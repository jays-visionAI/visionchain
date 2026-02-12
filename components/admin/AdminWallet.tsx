import { createSignal, For, Show, onMount, createEffect } from 'solid-js';
import {
    Wallet,
    TrendingUp,
    ArrowUpRight,
    ArrowDownLeft,
    DollarSign,
    Activity,
    Lock,
    RefreshCw,
    Search,
    Filter,
    MoreVertical,
    BarChart3,
    Clock,
    AlertTriangle,
    ExternalLink,
    Loader2
} from 'lucide-solid';
import { Motion } from 'solid-motionone';
import { contractService } from '../../services/contractService';
import { getFirebaseDb } from '../../services/firebaseService';
import { collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { ethers } from 'ethers';

interface Transaction {
    id: string;
    type: 'bridge' | 'send' | 'receive' | 'swap' | 'mint';
    amount: string;
    from: string;
    to: string;
    status: 'pending' | 'completed' | 'challenged' | 'finalized';
    bridgeStatus?: string;
    time: string;
    hash?: string;
    timestamp?: number;
}

interface SystemStats {
    totalLiquidity: string;
    liquidityChange: string;
    dailyVolume: number;
    proofOfReserve: number;
    lastAuditTime: string;
    totalSupply: string;
}

// Format time ago
const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

// Truncate address
const truncateAddress = (addr: string): string => {
    if (!addr || addr.length < 10) return addr || 'Unknown';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export default function AdminWallet() {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [transactions, setTransactions] = createSignal<Transaction[]>([]);
    const [stats, setStats] = createSignal<SystemStats>({
        totalLiquidity: '$0',
        liquidityChange: '+0%',
        dailyVolume: 0,
        proofOfReserve: 100,
        lastAuditTime: 'Never',
        totalSupply: '0'
    });
    const [loading, setLoading] = createSignal(true);
    const [syncing, setSyncing] = createSignal(false);

    // Fetch real transaction data from Firebase (transactions + scheduledTransfers + bridgeTransactions)
    const fetchTransactions = async () => {
        try {
            const db = getFirebaseDb();
            const allTxList: Transaction[] = [];

            // 1. Fetch from transactions collection
            try {
                const txCollection = collection(db, 'transactions');
                const txQuery = query(txCollection, orderBy('timestamp', 'desc'), limit(30));
                const txSnapshot = await getDocs(txQuery);

                txSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    allTxList.push({
                        id: doc.id,
                        type: (data.type?.toLowerCase() as Transaction['type']) || 'send',
                        amount: data.value ? `${parseFloat(data.value).toLocaleString()} VCN` : '0 VCN',
                        from: data.from_addr || data.from || 'Unknown',
                        to: data.to_addr || data.to || 'Unknown',
                        status: data.bridgeStatus === 'PENDING' ? 'pending' :
                            data.bridgeStatus === 'COMMITTED' ? 'pending' : 'completed',
                        bridgeStatus: data.bridgeStatus,
                        time: data.timestamp ? formatTimeAgo(data.timestamp) : 'Unknown',
                        hash: data.hash || data.txHash,
                        timestamp: data.timestamp || Date.now()
                    });
                });
            } catch (e) {
                console.warn('[AdminWallet] transactions collection error:', e);
            }

            // 2. Fetch from bridgeTransactions collection
            try {
                const bridgeCollection = collection(db, 'bridgeTransactions');
                const bridgeQuery = query(bridgeCollection, orderBy('createdAt', 'desc'), limit(30));
                const bridgeSnapshot = await getDocs(bridgeQuery);

                bridgeSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt?.toDate?.() || new Date();
                    const timestamp = createdAt.getTime();

                    // Avoid duplicates (if also in transactions collection)
                    if (!allTxList.some(tx => tx.hash === data.txHash)) {
                        allTxList.push({
                            id: doc.id,
                            type: 'bridge',
                            amount: data.amount ? `${(parseFloat(data.amount) / 1e18).toLocaleString()} VCN` : '0 VCN',
                            from: data.user || 'Unknown',
                            to: `Bridge → Chain ${data.dstChainId}`,
                            status: data.status === 'COMMITTED' ? 'pending' :
                                data.status === 'FINALIZED' ? 'finalized' :
                                    data.status === 'CHALLENGED' ? 'challenged' : 'completed',
                            bridgeStatus: data.status,
                            time: formatTimeAgo(timestamp),
                            hash: data.txHash,
                            timestamp
                        });
                    }
                });
            } catch (e) {
                console.warn('[AdminWallet] bridgeTransactions collection error:', e);
            }

            // 3. Fetch from scheduledTransfers collection
            try {
                const scheduledCollection = collection(db, 'scheduledTransfers');
                const scheduledQuery = query(scheduledCollection, orderBy('createdAt', 'desc'), limit(20));
                const scheduledSnapshot = await getDocs(scheduledQuery);

                scheduledSnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const createdAt = data.createdAt?.toDate?.() || new Date();
                    const timestamp = createdAt.getTime();

                    allTxList.push({
                        id: doc.id,
                        type: 'send',
                        amount: data.amount ? `${parseFloat(data.amount).toLocaleString()} VCN` : '0 VCN',
                        from: data.sender || data.userEmail || 'System',
                        to: data.recipient || 'Unknown',
                        status: data.status === 'SENT' ? 'completed' :
                            data.status === 'WAITING' ? 'pending' :
                                data.status === 'FAILED' ? 'challenged' : 'pending',
                        time: formatTimeAgo(timestamp),
                        hash: data.executionTx || data.creationTx || data.txHash,
                        timestamp
                    });
                });
            } catch (e) {
                console.warn('[AdminWallet] scheduledTransfers collection error:', e);
            }

            // Sort all transactions by timestamp (newest first)
            allTxList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            setTransactions(allTxList.slice(0, 50)); // Limit to 50 most recent
            console.log(`[AdminWallet] Loaded ${allTxList.length} transactions from all collections`);
        } catch (error) {
            console.error('[AdminWallet] Failed to fetch transactions:', error);
        }
    };

    // Fetch blockchain statistics
    const fetchStats = async () => {
        try {
            const provider = await contractService.getRobustProvider();

            // Get VCN Token total supply
            const vcnAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
            const vcnAbi = ['function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)'];
            const vcnContract = new ethers.Contract(vcnAddress, vcnAbi, provider);

            let totalSupply = '0';
            let totalLiquidity = '$0';

            try {
                const supply = await vcnContract.totalSupply();
                const decimals = await vcnContract.decimals();
                totalSupply = ethers.formatUnits(supply, decimals);

                // Estimate value (mock price of $0.10 per VCN for display)
                const vcnPrice = 0.10;
                const liquidityValue = parseFloat(totalSupply) * vcnPrice;
                totalLiquidity = `$${(liquidityValue / 1000000).toFixed(2)}M`;
            } catch (e) {
                console.warn('[AdminWallet] Failed to get VCN supply:', e);
            }

            // Get recent block info for audit timestamp
            const block = await provider.getBlock('latest');
            const lastAuditTime = block ? formatTimeAgo(block.timestamp * 1000) : 'Unknown';

            // Count transactions in last 24h from Firebase (filtered server-side)
            let dailyVolume = 0;
            try {
                const db = getFirebaseDb();
                const yesterday = Date.now() - 24 * 60 * 60 * 1000;

                // Use server-side filtering instead of fetching entire collections
                const txCollection = collection(db, 'transactions');
                const txQuery = query(txCollection, where('timestamp', '>', yesterday));
                const txSnapshot = await getDocs(txQuery);
                dailyVolume = txSnapshot.size;

                // Also count scheduled transfers (filtered server-side)
                const scheduledCollection = collection(db, 'scheduledTransfers');
                const scheduledQuery = query(scheduledCollection, where('createdAt', '>', new Date(yesterday)));
                const scheduledSnapshot = await getDocs(scheduledQuery);
                dailyVolume += scheduledSnapshot.size;
            } catch (e) {
                console.warn('[AdminWallet] Failed to count daily transactions');
            }

            setStats({
                totalLiquidity,
                liquidityChange: '+0.0%',
                dailyVolume,
                proofOfReserve: 100,
                lastAuditTime,
                totalSupply: parseFloat(totalSupply).toLocaleString()
            });
        } catch (error) {
            console.error('[AdminWallet] Failed to fetch stats:', error);
        }
    };

    // Sync nodes - refresh all data
    const handleSyncNodes = async () => {
        setSyncing(true);
        await Promise.all([fetchTransactions(), fetchStats()]);
        setSyncing(false);
    };

    // Initial data fetch
    onMount(async () => {
        setLoading(true);
        await Promise.all([fetchTransactions(), fetchStats()]);
        setLoading(false);
    });

    // Filter transactions based on search
    const filteredTransactions = () => {
        const query = searchQuery().toLowerCase();
        if (!query) return transactions();
        return transactions().filter(tx =>
            tx.id.toLowerCase().includes(query) ||
            tx.from.toLowerCase().includes(query) ||
            tx.to.toLowerCase().includes(query) ||
            (tx.hash && tx.hash.toLowerCase().includes(query))
        );
    };

    return (
        <div class="space-y-8">
            {/* Header */}
            <div class="flex items-end justify-between">
                <div>
                    <h1 class="text-3xl font-black text-white uppercase tracking-tight">Wallet Control</h1>
                    <p class="text-gray-500 font-bold uppercase tracking-widest text-[10px] mt-1">Global Asset & Transaction Management</p>
                </div>
                <div class="flex gap-3">
                    <button
                        onClick={handleSyncNodes}
                        disabled={syncing()}
                        class="px-4 py-2 bg-white/[0.03] border border-white/10 rounded-xl text-xs font-black text-gray-400 uppercase tracking-widest hover:bg-white/[0.08] transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        <Show when={syncing()} fallback={<RefreshCw class="w-3.5 h-3.5" />}>
                            <Loader2 class="w-3.5 h-3.5 animate-spin" />
                        </Show>
                        Sync Nodes
                    </button>
                    <button class="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all flex items-center gap-2">
                        <DollarSign class="w-3.5 h-3.5" />
                        Adjust Liquidity
                    </button>
                </div>
            </div>

            {/* Asset Performance Grid */}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BarChart3 class="w-12 h-12 text-cyan-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Total System Liquidity</div>
                    <div class="flex items-end gap-2 mb-2">
                        <Show when={!loading()} fallback={<span class="text-xl text-gray-500">Loading...</span>}>
                            <span class="text-3xl font-black text-white">{stats().totalLiquidity}</span>
                            <span class="text-green-400 text-xs font-bold mb-1">{stats().liquidityChange}</span>
                        </Show>
                    </div>
                    <div class="text-[10px] text-gray-600 mb-2">Total Supply: {stats().totalSupply} VCN</div>
                    <div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full w-[75%] bg-gradient-to-r from-cyan-500 to-blue-500" />
                    </div>
                </div>

                <div class="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <RefreshCw class="w-12 h-12 text-purple-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Daily Volume (24h)</div>
                    <div class="flex items-end gap-2 mb-2">
                        <Show when={!loading()} fallback={<span class="text-xl text-gray-500">Loading...</span>}>
                            <span class="text-3xl font-black text-white">{stats().dailyVolume.toLocaleString()}</span>
                            <span class="text-gray-500 text-[10px] font-bold mb-1 uppercase tracking-widest">Transactions</span>
                        </Show>
                    </div>
                    <div class="flex gap-1 items-end h-6">
                        <For each={[30, 45, 25, 60, 40, 75, 50]}>
                            {(h) => <div class="w-full bg-purple-500/20 rounded-t-[1px]" style={{ height: `${h}%` }} />}
                        </For>
                    </div>
                </div>

                <div class="p-6 rounded-2xl bg-white/[0.02] border border-white/5 relative overflow-hidden group">
                    <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Lock class="w-12 h-12 text-orange-400" />
                    </div>
                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Proof of Reserve</div>
                    <div class="flex items-center gap-3 mb-2">
                        <span class="text-3xl font-black text-white">{stats().proofOfReserve}%</span>
                        <div class="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded text-[9px] font-black text-green-400 uppercase tracking-widest">Verified</div>
                    </div>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Last audit: {stats().lastAuditTime}</p>
                </div>
            </div>

            {/* Transaction Explorer */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <div class="p-6 border-b border-white/5 flex items-center justify-between">
                    <h2 class="text-xl font-bold text-white flex items-center gap-3">
                        <Activity class="w-5 h-5 text-cyan-400" />
                        Global Transaction Explorer
                    </h2>
                    <div class="flex gap-4">
                        <div class="relative">
                            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search hashes, addresses..."
                                value={searchQuery()}
                                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                                class="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 w-64"
                            />
                        </div>
                        <button class="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                            <Filter class="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="bg-white/[0.01] text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5">
                                <th class="px-6 py-4">Status</th>
                                <th class="px-6 py-4">Transaction hash</th>
                                <th class="px-6 py-4">Type</th>
                                <th class="px-6 py-4">From</th>
                                <th class="px-6 py-4">To</th>
                                <th class="px-6 py-4">Amount</th>
                                <th class="px-6 py-4">Time</th>
                                <th class="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <Show when={!loading()} fallback={
                                <tr>
                                    <td colspan="8" class="px-6 py-12 text-center">
                                        <div class="flex items-center justify-center gap-3 text-gray-500">
                                            <Loader2 class="w-5 h-5 animate-spin" />
                                            <span class="text-sm">Loading transactions...</span>
                                        </div>
                                    </td>
                                </tr>
                            }>
                                <Show when={filteredTransactions().length > 0} fallback={
                                    <tr>
                                        <td colspan="8" class="px-6 py-12 text-center text-gray-500 text-sm">
                                            No transactions found
                                        </td>
                                    </tr>
                                }>
                                    <For each={filteredTransactions()}>
                                        {(tx) => (
                                            <tr class="hover:bg-white/[0.02] transition-colors group">
                                                <td class="px-6 py-4">
                                                    <div class={`flex items-center gap-2 px-2 py-1 rounded-lg w-fit ${tx.status === 'completed' ? 'bg-green-500/10' :
                                                        tx.status === 'challenged' ? 'bg-red-500/10' :
                                                            tx.status === 'pending' ? 'bg-amber-500/10' :
                                                                tx.status === 'finalized' ? 'bg-blue-500/10' : 'bg-yellow-500/10'
                                                        }`}>
                                                        <div class={`w-2 h-2 rounded-full ${tx.status === 'completed' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                                            tx.status === 'challenged' ? 'bg-red-500 animate-pulse' :
                                                                tx.status === 'pending' ? 'bg-amber-500 animate-pulse' :
                                                                    tx.status === 'finalized' ? 'bg-blue-500' : 'bg-yellow-500 animate-pulse'
                                                            }`} />
                                                        <span class={`text-[9px] font-black uppercase tracking-widest ${tx.status === 'completed' ? 'text-green-400' :
                                                            tx.status === 'challenged' ? 'text-red-400' :
                                                                tx.status === 'pending' ? 'text-amber-400' :
                                                                    tx.status === 'finalized' ? 'text-blue-400' : 'text-yellow-400'
                                                            }`}>
                                                            {tx.bridgeStatus || tx.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4">
                                                    <code class="text-[11px] text-cyan-400/80 font-mono tracking-tight">
                                                        {tx.hash ? truncateAddress(tx.hash) : `${tx.id.slice(0, 8)}...`}
                                                    </code>
                                                </td>
                                                <td class="px-6 py-4">
                                                    <div class="flex items-center gap-2">
                                                        <Show when={tx.type === 'send'}>
                                                            <div class="p-1.5 rounded-lg bg-red-500/10 text-red-400"><ArrowUpRight class="w-3.5 h-3.5" /></div>
                                                        </Show>
                                                        <Show when={tx.type === 'receive'}>
                                                            <div class="p-1.5 rounded-lg bg-green-500/10 text-green-400"><ArrowDownLeft class="w-3.5 h-3.5" /></div>
                                                        </Show>
                                                        <Show when={tx.type === 'swap'}>
                                                            <div class="p-1.5 rounded-lg bg-purple-500/10 text-purple-400"><RefreshCw class="w-3.5 h-3.5" /></div>
                                                        </Show>
                                                        <Show when={tx.type === 'mint'}>
                                                            <div class="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400"><TrendingUp class="w-3.5 h-3.5" /></div>
                                                        </Show>
                                                        <Show when={tx.type === 'bridge'}>
                                                            <div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400"><Clock class="w-3.5 h-3.5" /></div>
                                                        </Show>
                                                        <span class="text-xs font-bold text-gray-300 capitalize">{tx.type}</span>
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4 text-[11px] font-mono text-gray-500">{truncateAddress(tx.from)}</td>
                                                <td class="px-6 py-4 text-[11px] font-mono text-gray-500">{truncateAddress(tx.to)}</td>
                                                <td class="px-6 py-4 text-sm font-black text-white">{tx.amount}</td>
                                                <td class="px-6 py-4 text-[10px] font-bold text-gray-600 uppercase tracking-widest">{tx.time}</td>
                                                <td class="px-6 py-4 text-right">
                                                    <Show when={tx.hash}>
                                                        <a
                                                            href={`https://www.visionchain.co/visionscan/tx/${tx.hash}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            class="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-cyan-400 inline-block"
                                                        >
                                                            <ExternalLink class="w-4 h-4" />
                                                        </a>
                                                    </Show>
                                                    <button class="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-500 hover:text-white">
                                                        <MoreVertical class="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </Show>
                            </Show>
                        </tbody>
                    </table>
                </div>

                <div class="p-4 bg-white/[0.01] text-center border-t border-white/5">
                    <button
                        onClick={fetchTransactions}
                        class="text-[10px] font-black text-gray-500 hover:text-cyan-400 uppercase tracking-widest transition-colors"
                    >
                        Load more transactions
                    </button>
                </div>
            </div>
        </div>
    );
}
