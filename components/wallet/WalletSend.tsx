import { createSignal, Show, For, createMemo } from 'solid-js';
import {
    ArrowUpRight,
    RefreshCw,
    Check,
    Clock,
    Copy,
    ChevronRight,
    Search,
    User,
    ArrowLeft,
    Plus,
    UserPlus
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import { ethers } from 'ethers';
import { saveUserContacts } from '../../services/firebaseService';
import { Motion } from 'solid-motionone';

interface WalletSendProps {
    onBack: () => void;
    getAssetData: (symbol: string) => any;
    selectedToken: () => string;
    setSelectedToken: (symbol: string) => void;
    sendAmount: () => string;
    setSendAmount: (amount: string) => void;
    recipientAddress: () => string;
    setRecipientAddress: (addr: string) => void;
    handleTransaction: () => void;
    flowStep: () => number;
    setFlowStep: (step: number) => void;
    flowLoading: () => boolean;
    resetFlow: () => void;
    walletAddress: () => string;
    lastTxHash: () => string;
    contacts: () => any[];
    isSchedulingTimeLock: () => boolean;
    lockDelaySeconds: () => number;
    userProfile: () => any;
    onContactAdded?: () => void;
}

export const WalletSend = (props: WalletSendProps) => {
    const [searchQuery, setSearchQuery] = createSignal('');
    const [copied, setCopied] = createSignal(false);
    const [isAddingContact, setIsAddingContact] = createSignal(false);

    const resolvedRecipientName = createMemo(() => {
        const addr = props.recipientAddress().toLowerCase();
        if (!addr || !ethers.isAddress(addr)) return null;
        const contact = props.contacts().find(c => c.address?.toLowerCase() === addr);
        return contact?.internalName || null;
    });

    const isNewRecipient = () => !resolvedRecipientName() && ethers.isAddress(props.recipientAddress());

    const filteredContacts = () => {
        const query = searchQuery().toLowerCase().trim();
        if (!query) return props.contacts().slice(0, 5);
        return props.contacts().filter(c =>
            c.internalName?.toLowerCase().includes(query) ||
            c.address?.toLowerCase().includes(query) ||
            c.vchainUserUid?.toLowerCase().includes(query)
        ).slice(0, 5);
    };

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            return false;
        }
    };

    return (
        <div class="flex-1 overflow-y-auto pb-32 custom-scrollbar p-4 lg:p-8">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div class="flex items-center gap-4 mb-2 lg:hidden">
                    <button
                        onClick={props.onBack}
                        class="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft class="w-5 h-5" />
                    </button>
                    <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">Back to Assets</span>
                </div>

                <WalletViewHeader
                    tag="Transfer Protocol"
                    title="SEND"
                    titleAccent="ASSETS"
                    description="Securely transfer your digital assets across the Vision network with near-instant settlement."
                    icon={ArrowUpRight}
                />

                <div class="w-full">
                    <Show when={props.flowStep() === 1}>
                        <div class="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Asset Selection */}
                            <div class="space-y-4">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 block text-center md:text-left">Select Asset</label>
                                <div class="w-full">
                                    <div class="flex items-center justify-between p-5 bg-blue-500/10 border border-blue-500/30 rounded-2xl relative group w-full">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                                <span class="font-black text-blue-400 text-sm">V</span>
                                            </div>
                                            <div class="flex-1 min-w-0 text-left">
                                                <div class="text-sm font-bold text-white uppercase tracking-tight truncate">Vision Coin</div>
                                                <div class="text-[10px] font-bold text-blue-400/70 uppercase">VCN</div>
                                            </div>
                                        </div>
                                        <div class="text-right">
                                            <div class="text-sm font-black text-white tabular-nums">{props.getAssetData('VCN').liquidBalance.toLocaleString()}</div>
                                            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Available</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recipient */}
                            <div class="space-y-4">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 block text-center md:text-left">Recipient Address</label>
                                <div class="relative group">
                                    <input
                                        type="text"
                                        placeholder="0x... or Search Contacts"
                                        value={props.recipientAddress()}
                                        onInput={(e) => {
                                            props.setRecipientAddress(e.currentTarget.value);
                                            setSearchQuery(e.currentTarget.value);
                                        }}
                                        class={`w-full bg-[#111113] border rounded-[22px] px-4 md:px-6 py-4 md:py-5 text-white placeholder:text-gray-600 outline-none transition-all font-mono text-sm box-border min-w-0 ${props.recipientAddress() && !ethers.isAddress(props.recipientAddress()) ? 'border-red-500/30 focus:border-red-500/50' : 'border-white/10 focus:border-blue-500/30'}`}
                                    />
                                    <div class="absolute right-4 top-1/2 -translate-y-1/2">
                                        <Search class="w-5 h-5 text-gray-700" />
                                    </div>
                                </div>

                                {/* Contact Suggestions */}
                                <Show when={searchQuery() && !ethers.isAddress(props.recipientAddress())}>
                                    <div class="bg-[#111113] border border-white/10 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                                        <For each={filteredContacts()}>
                                            {(contact) => (
                                                <button
                                                    onClick={() => {
                                                        props.setRecipientAddress(contact.address);
                                                        setSearchQuery('');
                                                    }}
                                                    class="w-full flex items-center justify-between p-4 hover:bg-white/[0.03] border-b border-white/[0.03] last:border-0 transition-colors"
                                                >
                                                    <div class="flex items-center gap-3 text-left">
                                                        <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                                            <User class="w-4 h-4 text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <div class="text-sm font-bold text-white">{contact.internalName}</div>
                                                            <div class="text-[10px] font-mono text-gray-500 truncate max-w-[150px]">{contact.address}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight class="w-4 h-4 text-gray-700" />
                                                </button>
                                            )}
                                        </For>
                                        <Show when={filteredContacts().length === 0}>
                                            <div class="p-4 text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest italic">No contacts found</div>
                                        </Show>
                                    </div>
                                </Show>
                            </div>

                            {/* Amount */}
                            <div class="space-y-4">
                                <div class="flex flex-col sm:flex-row justify-between items-center sm:items-end px-1 gap-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Transfer Amount</label>
                                    <button
                                        onClick={() => props.setSendAmount(props.getAssetData('VCN').liquidBalance.toString())}
                                        class="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors bg-blue-400/10 px-3 py-1 rounded-full sm:bg-transparent sm:p-0"
                                    >
                                        Use Max Balance
                                    </button>
                                </div>
                                <div class="relative">
                                    <input
                                        type="text"
                                        placeholder="0.00"
                                        value={props.sendAmount()}
                                        onInput={(e) => {
                                            const raw = e.currentTarget.value.replace(/,/g, '');
                                            if (!isNaN(Number(raw)) || raw === '.') {
                                                const parts = raw.split('.');
                                                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                                props.setSendAmount(parts.join('.'));
                                            }
                                        }}
                                        class="w-full bg-[#111113] border border-white/10 rounded-[22px] p-4 md:p-6 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/30 transition-all text-3xl font-bold font-mono box-border min-w-0"
                                    />
                                    <div class="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-black text-gray-600 tracking-tighter">VCN</div>
                                </div>
                            </div>

                            <button
                                disabled={!ethers.isAddress(props.recipientAddress()) || !props.sendAmount() || Number(props.sendAmount().replace(/,/g, '')) <= 0}
                                onClick={() => props.setFlowStep(2)}
                                class="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed uppercase tracking-widest"
                            >
                                Review Transaction
                            </button>
                        </div>
                    </Show>

                    <Show when={props.flowStep() === 2}>
                        <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div class="bg-gradient-to-br from-[#1c1c21] to-[#111113] border border-white/10 rounded-[32px] p-8 text-center shadow-3xl">
                                <div class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">You are sending</div>
                                <div class="text-5xl font-black text-white mb-2 tracking-tighter drop-shadow-sm">{props.sendAmount()} <span class="text-blue-500">VCN</span></div>
                                <div class="text-sm font-bold text-gray-500">≈ ${(Number(props.sendAmount().replace(/,/g, '')) * props.getAssetData('VCN').price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</div>

                                <div class="mt-8 pt-8 border-t border-white/[0.04] space-y-4">
                                    <div class="flex justify-between items-center px-2">
                                        <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Recipient</span>
                                        <div class="flex flex-col items-end">
                                            <Show when={resolvedRecipientName()} fallback={
                                                <button
                                                    onClick={() => setIsAddingContact(true)}
                                                    class="flex items-center gap-2 group/save"
                                                >
                                                    <span class="text-sm font-black text-amber-400 uppercase italic tracking-tighter group-hover/save:text-amber-300 transition-colors">New Recipient</span>
                                                    <div class="w-5 h-5 rounded-md bg-amber-400/10 flex items-center justify-center group-hover/save:bg-amber-400/20 transition-all">
                                                        <Plus class="w-3 h-3 text-amber-400" />
                                                    </div>
                                                </button>
                                            }>
                                                <span class="text-sm font-black text-white italic tracking-tight">{resolvedRecipientName()}</span>
                                            </Show>
                                            <span class="text-[10px] font-mono text-gray-500 mt-0.5 opacity-60">
                                                {props.recipientAddress().slice(0, 6)}...{props.recipientAddress().slice(-4)}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center px-2">
                                        <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Network Fee</span>
                                        <span class="text-sm font-bold text-green-400">0.00021 VCN <span class="text-[10px] text-gray-500 ml-1">($0.45)</span></span>
                                    </div>
                                    <div class="flex justify-between items-center px-2">
                                        <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Estimated Time</span>
                                        <span class="text-sm font-bold text-white flex items-center gap-2">
                                            <Clock class="w-3.5 h-3.5 text-blue-400" />
                                            ~12 Seconds
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex flex-col sm:flex-row gap-4">
                                <button onClick={() => props.setFlowStep(1)} class="flex-1 py-5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all border border-white/5 uppercase tracking-widest text-xs">Modify Details</button>
                                <button
                                    onClick={props.handleTransaction}
                                    disabled={props.flowLoading()}
                                    class="flex-[2] py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-widest"
                                >
                                    <Show when={props.flowLoading()} fallback="Confirm & Send Tokens">
                                        <RefreshCw class="w-5 h-5 animate-spin" />
                                        Processing...
                                    </Show>
                                </button>
                            </div>
                        </div>
                    </Show>

                    <Show when={props.flowStep() === 3}>
                        <div class="py-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 space-y-8">
                            <div class="relative">
                                <div class="absolute inset-0 bg-green-500/20 rounded-full blur-3xl animate-pulse" />
                                <div class="relative w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/40">
                                    <Check class="w-12 h-12 text-white" />
                                </div>
                            </div>

                            <div>
                                <h4 class="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">Transaction Sent!</h4>
                                <p class="text-gray-500 font-medium">Your assets are being moved across the Vision ledger.</p>
                            </div>

                            <div class="w-full bg-[#111113] border border-white/10 rounded-[32px] overflow-hidden shadow-3xl">
                                <div class="p-8 space-y-4 text-left">
                                    <div class="flex justify-between items-center">
                                        <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Amount Sent</span>
                                        <span class="text-lg font-black text-white italic">{props.sendAmount()} VCN</span>
                                    </div>
                                    <div class="flex justify-between items-center">
                                        <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">To Address</span>
                                        <span class="text-xs font-mono text-blue-400">{props.recipientAddress().slice(0, 12)}...{props.recipientAddress().slice(-12)}</span>
                                    </div>
                                    <div class="h-px bg-white/[0.04] w-full my-2" />
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Transaction Hash</span>
                                            <button
                                                onClick={async () => {
                                                    const ok = await copyToClipboard(props.lastTxHash());
                                                    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
                                                }}
                                                class="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5 hover:text-white transition-colors"
                                            >
                                                {copied() ? 'Copied!' : 'Copy Hash'}
                                                <Copy class="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div class="text-[11px] font-mono text-gray-500 truncate bg-black/40 p-3 rounded-xl border border-white/5">{props.lastTxHash()}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <a
                                    href={`/visionscan?tx=${props.lastTxHash()}`}
                                    target="_blank"
                                    class="py-5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-2"
                                >
                                    VisionScan Explorer
                                </a>
                                <button
                                    onClick={props.resetFlow}
                                    class="py-5 bg-white text-black font-black rounded-2xl transition-all hover:bg-white/90 uppercase tracking-widest shadow-xl shadow-white/5"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </Show>
                </div>
            </div>

            <NewContactModal
                isOpen={isAddingContact()}
                onClose={() => setIsAddingContact(false)}
                address={props.recipientAddress()}
                userEmail={props.userProfile().email}
                onSuccess={() => {
                    setIsAddingContact(false);
                    props.onContactAdded?.();
                }}
            />
        </div>
    );
};
const NewContactModal = (props: { isOpen: boolean, onClose: () => void, address: string, userEmail: string, onSuccess: () => void }) => {
    const [name, setName] = createSignal('');
    const [isSaving, setIsSaving] = createSignal(false);

    const handleSave = async () => {
        if (!name().trim()) return;
        setIsSaving(true);
        try {
            await saveUserContacts(props.userEmail, [{
                internalName: name(),
                address: props.address,
                phone: '',
                isFavorite: false,
                syncStatus: 'verified'
            }]);
            props.onSuccess();
        } catch (e) {
            console.error("Failed to save contact:", e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 z-[150] flex items-center justify-center p-4">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    class="absolute inset-0 bg-black/90 backdrop-blur-md"
                    onClick={props.onClose}
                />
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    class="relative w-full max-w-sm bg-[#0d0d0f] border border-white/[0.08] rounded-[32px] p-8 shadow-3xl text-center"
                >
                    <div class="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6 text-blue-400">
                        <UserPlus class="w-8 h-8" />
                    </div>
                    <h3 class="text-xl font-black text-white italic uppercase tracking-tight mb-2">Save to Contacts</h3>
                    <p class="text-xs text-gray-500 mb-8 whitespace-pre-wrap">Assign a name to this address for easier identification in the future.</p>

                    <div class="space-y-4 mb-8">
                        <div class="text-left">
                            <label class="text-[9px] font-black text-gray-600 uppercase tracking-widest px-2 mb-2 block">Display Name</label>
                            <input
                                type="text"
                                autofocus
                                placeholder="e.g. Park Ji-hyun"
                                value={name()}
                                onInput={(e) => setName(e.currentTarget.value)}
                                class="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-blue-500/30 transition-all font-bold"
                            />
                        </div>
                        <div class="text-left">
                            <label class="text-[9px] font-black text-gray-600 uppercase tracking-widest px-2 mb-2 block">Wallet Address</label>
                            <div class="px-5 py-4 bg-black/40 border border-white/5 rounded-2xl text-[11px] font-mono text-gray-500 truncate italic">
                                {props.address}
                            </div>
                        </div>
                    </div>

                    <div class="flex gap-4">
                        <button onClick={props.onClose} class="flex-1 py-4 text-xs font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest">Cancel</button>
                        <button
                            onClick={handleSave}
                            disabled={!name().trim() || isSaving()}
                            class="flex-[2] bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest text-xs active:scale-95 disabled:opacity-30"
                        >
                            {isSaving() ? 'Saving...' : 'Save Contact'}
                        </button>
                    </div>
                </Motion.div>
            </div>
        </Show>
    );
};
