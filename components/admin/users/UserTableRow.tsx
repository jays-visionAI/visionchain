import { Component, Show, createSignal, For } from 'solid-js';
import {
    Clock,
    CheckCircle,
    XCircle,
    Shield,
    Copy,
    ExternalLink,
    Star,
    Send,
    Mail,
    RefreshCw,
    MoreVertical,
    Coins,
    Award,
    X,
    UserPlus,
    Trophy
} from 'lucide-solid';
import { UserData, getUserRP, getRPHistory, type RPEntry } from '../../../services/firebaseService';

interface UserTableRowProps {
    user: UserData;
    onSendVCN: (user: UserData) => void;
    onResendEmail: (email: string) => void;
    resendingEmail: string | null;
    copyToClipboard: (text: string) => void;
    shortAddress: (addr?: string) => string;
}

export const UserTableRow: Component<UserTableRowProps> = (props) => {
    const isRegistered = () => props.user.status === 'Registered' || props.user.status === 'WalletCreated' || props.user.status === 'VestingDeployed' || (props.user.walletAddress && props.user.walletAddress.startsWith('0x'));
    const hasWallet = () => (props.user.walletAddress && props.user.walletAddress.length > 20 && props.user.walletAddress.startsWith('0x')) || props.user.status === 'WalletCreated' || props.user.status === 'VestingDeployed';

    const [rpTotal, setRPTotal] = createSignal<number | null>(null);
    const [rpModalOpen, setRPModalOpen] = createSignal(false);
    const [rpHistoryData, setRPHistoryData] = createSignal<RPEntry[]>([]);
    const [rpLoading, setRPLoading] = createSignal(false);

    const formatNumber = (num: number | undefined) => {
        if (!num || num === 0) return '-';
        return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    };

    // Lazy load RP on first render
    const loadRP = async () => {
        if (rpTotal() !== null) return;
        try {
            const rp = await getUserRP(props.user.email);
            setRPTotal(rp.totalRP);
        } catch {
            setRPTotal(0);
        }
    };
    loadRP();

    const openRPHistory = async () => {
        setRPModalOpen(true);
        setRPLoading(true);
        try {
            const history = await getRPHistory(props.user.email, 30);
            setRPHistoryData(history);
        } catch {
            setRPHistoryData([]);
        }
        setRPLoading(false);
    };

    return (
        <>
            <div class="grid grid-cols-1 md:grid gap-4 p-4 hover:bg-white/[0.03] transition-colors items-center" style="grid-template-columns: repeat(13, minmax(0, 1fr))">
                {/* User Info */}
                <div class="md:col-span-2 flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-cyan-400 font-black border border-cyan-500/10 text-xs">
                        {props.user.name ? props.user.name.charAt(0) : '?'}
                    </div>
                    <div class="min-w-0">
                        <p class="text-white font-black text-xs truncate uppercase tracking-tight leading-none mb-1">{props.user.name || 'Unknown'}</p>
                        <p class="text-gray-500 text-[9px] truncate font-bold uppercase tracking-widest leading-none">
                            {props.user.email}
                        </p>
                    </div>
                </div>

                {/* Registration Status */}
                <div class="md:col-span-1 flex items-center">
                    <Show when={isRegistered()} fallback={
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-[8px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/20 whitespace-nowrap">
                            <Clock class="w-2.5 h-2.5" />
                            Pending
                        </span>
                    }>
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-[8px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 whitespace-nowrap">
                            <CheckCircle class="w-2.5 h-2.5" />
                            Reg
                        </span>
                    </Show>
                </div>

                {/* Wallet Status */}
                <div class="md:col-span-1 flex items-center">
                    <Show when={hasWallet()} fallback={
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-500/10 text-[8px] font-black text-gray-500 uppercase tracking-widest border border-gray-500/20">
                            <XCircle class="w-2.5 h-2.5" />
                            None
                        </span>
                    }>
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-[8px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/20">
                            <Shield class="w-2.5 h-2.5" />
                            Active
                        </span>
                    </Show>
                </div>

                {/* Wallet Address */}
                <div class="md:col-span-2 flex items-center">
                    <Show when={hasWallet() && props.user.walletAddress && props.user.walletAddress !== 'Not Created'} fallback={
                        <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic">Missing</span>
                    }>
                        <div class="flex items-center gap-2 group/addr">
                            <span class="text-[10px] font-mono text-cyan-400 group-hover:text-cyan-300 transition-colors">
                                {props.shortAddress(props.user.walletAddress)}
                            </span>
                            <div class="flex items-center gap-1 opacity-0 group-hover/addr:opacity-100 transition-opacity">
                                <button
                                    onClick={() => props.copyToClipboard(props.user.walletAddress!)}
                                    class="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"
                                    title="Copy Address"
                                >
                                    <Copy class="w-3 h-3" />
                                </button>
                                <a
                                    href={`https://www.visionchain.co/visionscan/address/${props.user.walletAddress}`}
                                    target="_blank"
                                    class="p-1 hover:bg-white/10 rounded-md text-gray-500 hover:text-white transition-colors"
                                    title="View on Explorer"
                                >
                                    <ExternalLink class="w-3 h-3" />
                                </a>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* Vesting Status */}
                <div class="md:col-span-1 flex items-center">
                    <Show when={props.user.status === 'VestingDeployed'} fallback={
                        <span class="text-[9px] font-bold text-gray-600 uppercase tracking-widest">N/A</span>
                    }>
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/10 text-[8px] font-black text-purple-400 uppercase tracking-widest border border-purple-500/20">
                            <Star class="w-2.5 h-2.5" />
                            OK
                        </span>
                    </Show>
                </div>

                {/* Referrer */}
                <div class="md:col-span-1 flex items-center min-w-0">
                    <Show when={props.user.referrerId} fallback={
                        <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic">Direct</span>
                    }>
                        <div class="text-[9px] font-bold text-cyan-500/80 truncate uppercase tracking-tighter" title={props.user.referrerId}>
                            {props.user.referrerId?.split('@')[0]}
                        </div>
                    </Show>
                </div>

                {/* RP (Reward Points) */}
                <div class="md:col-span-1 flex items-center justify-center">
                    <Show when={rpTotal() !== null && rpTotal()! > 0} fallback={
                        <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest">-</span>
                    }>
                        <button
                            onClick={openRPHistory}
                            class="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors cursor-pointer group/rp"
                            title="Click to view RP history"
                        >
                            <Award class="w-3 h-3 text-amber-400" />
                            <span class="text-[11px] font-black text-amber-400 tracking-tight">
                                {rpTotal()?.toLocaleString()}
                            </span>
                        </button>
                    </Show>
                </div>

                {/* Admin Sent Total */}
                <div class="md:col-span-1 flex items-center justify-center">
                    <Show when={props.user.adminSentTotal && props.user.adminSentTotal > 0} fallback={
                        <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest">-</span>
                    }>
                        <div class="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <Coins class="w-3 h-3 text-emerald-400" />
                            <span class="text-[11px] font-black text-emerald-400 tracking-tight">
                                {formatNumber(props.user.adminSentTotal)}
                            </span>
                        </div>
                    </Show>
                </div>

                {/* Actions */}
                <div class="md:col-span-2 flex items-center justify-end gap-1.5">
                    <Show when={hasWallet() && props.user.walletAddress && props.user.walletAddress !== 'Not Created'}>
                        <button
                            onClick={() => props.onSendVCN(props.user)}
                            class="px-2 py-1 bg-cyan-600/10 hover:bg-cyan-600 text-cyan-400 hover:text-white rounded-lg transition-all border border-cyan-500/20 flex items-center gap-1 text-[9px] font-black uppercase tracking-widest"
                        >
                            <Send class="w-2.5 h-2.5" />
                            Send VCN
                        </button>
                    </Show>

                    <Show when={!isRegistered()}>
                        <button
                            onClick={() => props.onResendEmail(props.user.email)}
                            disabled={props.resendingEmail === props.user.email}
                            class="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition-colors"
                            title="Resend Invitation"
                        >
                            <Show when={props.resendingEmail === props.user.email} fallback={<Mail class="w-4 h-4" />}>
                                <RefreshCw class="w-4 h-4 animate-spin" />
                            </Show>
                        </button>
                    </Show>
                    <button class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-600 hover:text-white">
                        <MoreVertical class="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* RP History Modal */}
            <Show when={rpModalOpen()}>
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRPModalOpen(false)}>
                    <div class="bg-[#111113] border border-white/10 rounded-3xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div class="p-6 border-b border-white/5 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                    <Award class="w-5 h-5 text-amber-400" />
                                </div>
                                <div>
                                    <h3 class="text-sm font-black text-white uppercase tracking-widest">RP History</h3>
                                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-0.5">{props.user.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setRPModalOpen(false)} class="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-500 hover:text-white">
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        {/* Total RP Summary */}
                        <div class="px-6 py-4 bg-amber-500/5 border-b border-white/5 flex items-center justify-between">
                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total RP</span>
                            <span class="text-xl font-black text-amber-400">{rpTotal()?.toLocaleString() || 0} <span class="text-xs text-gray-600">RP</span></span>
                        </div>

                        {/* History List */}
                        <div class="overflow-y-auto max-h-[50vh]">
                            <Show when={!rpLoading()} fallback={
                                <div class="p-12 flex flex-col items-center justify-center">
                                    <div class="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                    <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest mt-3">Loading...</span>
                                </div>
                            }>
                                <Show when={rpHistoryData().length > 0} fallback={
                                    <div class="p-12 text-center">
                                        <div class="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No RP history yet</div>
                                    </div>
                                }>
                                    <div class="divide-y divide-white/[0.03]">
                                        <For each={rpHistoryData()}>
                                            {(entry) => (
                                                <div class="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                                                    <div class="flex items-center gap-3">
                                                        <div class={`w-8 h-8 rounded-lg flex items-center justify-center ${entry.type === 'referral' ? 'bg-amber-500/10' : 'bg-purple-500/10'
                                                            }`}>
                                                            {entry.type === 'referral'
                                                                ? <UserPlus class="w-4 h-4 text-amber-400" />
                                                                : <Trophy class="w-4 h-4 text-purple-400" />
                                                            }
                                                        </div>
                                                        <div>
                                                            <div class="text-xs font-bold text-gray-200">
                                                                {entry.type === 'referral' ? 'Referral' : 'Level-Up Bonus'}
                                                            </div>
                                                            <div class="text-[10px] text-gray-600 font-mono truncate max-w-[200px]">
                                                                {entry.source}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="text-right">
                                                        <div class={`text-sm font-black ${entry.type === 'referral' ? 'text-amber-400' : 'text-purple-400'}`}>
                                                            +{entry.amount} RP
                                                        </div>
                                                        <div class="text-[9px] text-gray-600">
                                                            {new Date(entry.timestamp).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </Show>
                            </Show>
                        </div>
                    </div>
                </div>
            </Show>
        </>
    );
};
