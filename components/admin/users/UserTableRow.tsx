import { Component, Show } from 'solid-js';
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
    MoreVertical
} from 'lucide-solid';
import { UserData } from '../../../services/firebaseService';

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

    return (
        <div class="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-white/[0.03] transition-colors items-center">
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
            <div class="md:col-span-2 flex items-center">
                <Show when={isRegistered()} fallback={
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-500/10 text-[9px] font-black text-yellow-500 uppercase tracking-widest border border-yellow-500/20 whitespace-nowrap">
                        <Clock class="w-3 h-3" />
                        Pending
                    </span>
                }>
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-[9px] font-black text-green-500 uppercase tracking-widest border border-green-500/20 whitespace-nowrap">
                        <CheckCircle class="w-3 h-3" />
                        Registered
                    </span>
                </Show>
            </div>

            {/* Wallet Status */}
            <div class="md:col-span-1 flex items-center">
                <Show when={hasWallet()} fallback={
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-500/10 text-[9px] font-black text-gray-500 uppercase tracking-widest border border-gray-500/20">
                        <XCircle class="w-3 h-3" />
                        None
                    </span>
                }>
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 text-[9px] font-black text-blue-500 uppercase tracking-widest border border-blue-500/20">
                        <Shield class="w-3 h-3" />
                        Active
                    </span>
                </Show>
            </div>

            {/* Wallet Address */}
            <div class="md:col-span-3 flex items-center">
                <Show when={hasWallet() && props.user.walletAddress && props.user.walletAddress !== 'Not Created'} fallback={
                    <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic">Address Missing</span>
                }>
                    <div class="flex items-center gap-2 group/addr">
                        <span class="text-[11px] font-mono text-cyan-400 group-hover:text-cyan-300 transition-colors">
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
                                href={`https://visionscan.org/address/${props.user.walletAddress}`}
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
                    <span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-500/10 text-[9px] font-black text-purple-400 uppercase tracking-widest border border-purple-500/20">
                        <Star class="w-3 h-3" />
                        Deployed
                    </span>
                </Show>
            </div>

            {/* Referrer */}
            <div class="md:col-span-1 flex items-center min-w-0">
                <Show when={props.user.referrerId} fallback={
                    <span class="text-[9px] font-bold text-gray-700 uppercase tracking-widest italic">Direct</span>
                }>
                    <div class="text-[10px] font-bold text-cyan-500/80 truncate uppercase tracking-tighter" title={props.user.referrerId}>
                        {props.user.referrerId?.split('@')[0]}
                    </div>
                </Show>
            </div>

            {/* Actions */}
            <div class="md:col-span-1 flex items-center justify-end gap-1.5">
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
    );
};
