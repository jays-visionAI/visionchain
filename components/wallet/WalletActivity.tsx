import { Show, For, createSignal, onMount, createEffect } from 'solid-js';
import { Plus, ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink } from 'lucide-solid';
import { ethers } from 'ethers';
import { contractService } from '../../services/contractService';

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
    blockNumber: number;
}

const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const WalletActivity = (props: WalletActivityProps) => {
    const [transactions, setTransactions] = createSignal<Transaction[]>([]);
    const [loading, setLoading] = createSignal(false);
    const API_URL = "https://api.visionchain.co/api/transactions";

    const fetchHistory = async () => {
        if (!props.walletAddress) return;

        try {
            setLoading(true);
            const response = await fetch(`${API_URL}?address=${props.walletAddress}&limit=50`);
            const rawData = await response.json();
            const data = (rawData.transactions || []) as any[];

            const mapped = data.map(tx => ({
                hash: tx.hash,
                from_addr: tx.from_addr,
                to_addr: tx.to_addr,
                value: tx.value,
                timestamp: tx.timestamp,
                type: tx.type || 'Transfer',
                status: 'success',
                blockNumber: tx.block_number || 0
            }));

            setTransactions(mapped);
        } catch (error) {
            console.error("Failed to fetch transaction history from API:", error);
        } finally {
            setLoading(false);
        }
    };

    onMount(fetchHistory);

    createEffect(() => {
        if (props.walletAddress) fetchHistory();
    });

    return (
        <div class="space-y-8">
            {/* 1. Off-Chain Records (Top) */}
            <div class="space-y-3">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <span class="w-1 h-1 rounded-full bg-purple-500"></span>
                        Off-chain Records
                    </h3>
                </div>

                <Show when={props.purchases().length === 0}>
                    <div class="py-8 text-center bg-white/[0.01] border border-white/[0.04] rounded-2xl border-dashed">
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

            {/* 2. On-Chain Activity (Bottom) */}
            <div class="space-y-3">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                        <span class="w-1 h-1 rounded-full bg-blue-500"></span>
                        On-chain Activity
                    </h3>
                    <button
                        onClick={fetchHistory}
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
                        <div class="text-gray-600 font-medium text-xs">No on-chain history found for this address</div>
                    </div>
                </Show>

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
                                            {isIncoming ? 'Received' : 'Sent'} {tx.type === 'Transfer' ? 'Asset' : 'Transaction'}
                                        </div>
                                        <div class="text-xs text-gray-500 font-mono">{date}</div>
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
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
};
