import { Show, For, createSignal, onMount, createEffect } from 'solid-js';
import { Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink } from 'lucide-solid';

interface WalletActivityProps {
    purchases: () => any[];
    walletAddress?: string; // Optional for view-only or uninitialized states
}

interface Transaction {
    hash: string;
    from_addr: string;
    to_addr: string;
    value: string;
    timestamp: number;
    type: string;
    status: string;
    metadata?: any;
}

export const WalletActivity = (props: WalletActivityProps) => {
    const [transactions, setTransactions] = createSignal<Transaction[]>([]);
    const [loading, setLoading] = createSignal(false);

    const fetchHistory = async () => {
        if (!props.walletAddress) return;

        try {
            setLoading(true);
            const response = await fetch(`http://46.224.221.201:3000/api/transactions?address=${props.walletAddress}&limit=20`);
            if (response.ok) {
                const data = await response.json();
                setTransactions(data.transactions || []);
            }
        } catch (error) {
            console.error("Failed to fetch transaction history:", error);
        } finally {
            setLoading(false);
        }
    };

    onMount(fetchHistory);

    createEffect(() => {
        if (props.walletAddress) fetchHistory();
    });

    return (
        <div class="space-y-3">
            <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 mb-2">Recent Transactions</h3>

            <Show when={props.purchases().length === 0 && transactions().length === 0 && !loading}>
                <div class="py-20 text-center bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                    <div class="text-gray-500 font-medium">No on-chain activity found</div>
                </div>
            </Show>

            <Show when={loading}>
                <div class="py-10 text-center">
                    <RefreshCw class="w-6 h-6 text-blue-500 animate-spin mx-auto" />
                    <div class="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-widest">Syncing Blockchain Data...</div>
                </div>
            </Show>

            {/* Real On-Chain Transactions */}
            <For each={transactions()}>
                {(tx) => {
                    const isIncoming = tx.to_addr.toLowerCase() === props.walletAddress?.toLowerCase();
                    const date = new Date(tx.timestamp).toLocaleString();
                    const shortHash = `${tx.hash.slice(0, 6)}...${tx.hash.slice(-4)}`;

                    return (
                        <div class="flex items-center justify-between py-4 px-5 bg-[#111114] border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group">
                            <div class="flex items-center gap-4">
                                <div class={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${isIncoming
                                    ? 'bg-green-500/10 text-green-400'
                                    : 'bg-blue-500/10 text-blue-400'}`}>
                                    {isIncoming ? <ArrowDownLeft class="w-5 h-5" /> : <ArrowUpRight class="w-5 h-5" />}
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                                        {isIncoming ? 'Received VCN' : 'Sent VCN'}
                                    </div>
                                    <div class="text-xs text-gray-500 font-mono">{date}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class={`text-sm font-bold ${isIncoming ? 'text-green-400' : 'text-white'}`}>
                                    {isIncoming ? '+' : '-'}{parseFloat(tx.value).toLocaleString()} VCN
                                </div>
                                <a
                                    href={`/visionscan?tx=${tx.hash}`}
                                    target="_blank"
                                    class="text-[10px] font-mono text-gray-500 hover:text-white flex items-center justify-end gap-1 mt-1 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {shortHash} <ExternalLink class="w-2.5 h-2.5" />
                                </a>
                            </div>
                        </div>
                    );
                }}
            </For>

            {/* Static Purchases (Legacy / Off-chain records) */}
            <For each={props.purchases().slice().reverse()}>
                {(p) => {
                    const date = new Date(p.createdAt).toLocaleDateString();
                    return (
                        <div class="flex items-center justify-between py-4 px-5 bg-[#111114] border border-white/[0.04] rounded-xl hover:bg-white/[0.02] transition-colors cursor-pointer group opacity-60 hover:opacity-100">
                            <div class="flex items-center gap-4">
                                <div class="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Plus class="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <div class="text-sm font-medium text-white underline-offset-4 decoration-purple-500/30 group-hover:underline">VCN Purchase</div>
                                    <div class="text-xs text-gray-500">Seed Round • {date}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-medium text-purple-400">+{p.amount.toLocaleString()} VCN</div>
                                <div class="text-xs text-gray-500 italic">Off-Chain Record</div>
                            </div>
                        </div>
                    );
                }}
            </For>
        </div>
    );
};
