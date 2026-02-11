
import { createSignal, Show, For, createMemo } from 'solid-js';
import {
    ArrowUpRight,
    RefreshCw,
    Check,
    Clock,
    Copy,
    ChevronRight,
    ChevronDown,
    Search,
    User,
    Users,
    ArrowLeft,
    Plus,
    UserPlus,
    X,
    Trash2
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import { ethers } from 'ethers';
import { saveUserContacts } from '../../services/firebaseService';
import { Motion } from 'solid-motionone';
import { useI18n } from '../../i18n/i18nContext';

interface Recipient {
    contact: any;
    amount: string;
}

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
    onMultiTransaction?: (recipients: { address: string; amount: string; name: string }[]) => void;
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

// Transferable asset configurations
const TRANSFERABLE_ASSETS = [
    { symbol: 'VCN', name: 'Vision Chain', letter: 'V', color: 'blue', bgClass: 'bg-blue-500/20', textClass: 'text-blue-400', borderClass: 'border-blue-500/30', bgActiveClass: 'bg-blue-500/10' },
    { symbol: 'ETH', name: 'Ethereum', letter: 'E', color: 'indigo', bgClass: 'bg-indigo-500/20', textClass: 'text-indigo-400', borderClass: 'border-indigo-500/30', bgActiveClass: 'bg-indigo-500/10' },
];

export const WalletSend = (props: WalletSendProps) => {
    const [searchQuery, setSearchQuery] = createSignal('');
    const { t } = useI18n();
    const [copied, setCopied] = createSignal(false);
    const [isAddingContact, setIsAddingContact] = createSignal(false);
    const [showContactPicker, setShowContactPicker] = createSignal(false);
    const [multiRecipients, setMultiRecipients] = createSignal<Recipient[]>([]);
    const [selectedContacts, setSelectedContacts] = createSignal<Set<string>>(new Set());
    const [contactSearchQuery, setContactSearchQuery] = createSignal('');
    const [showAssetPicker, setShowAssetPicker] = createSignal(false);

    const currentAssetConfig = () => TRANSFERABLE_ASSETS.find(a => a.symbol === props.selectedToken()) || TRANSFERABLE_ASSETS[0];

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
        <div class="flex-1 overflow-y-auto overflow-x-hidden pb-32 custom-scrollbar px-4 py-4 lg:p-8 box-border">
            <div class="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 w-full">
                <div class="flex items-center gap-4 mb-2 lg:hidden">
                    <button
                        onClick={props.onBack}
                        class="p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft class="w-5 h-5" />
                    </button>
                    <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">{t('common.backToAssets')}</span>
                </div>

                <WalletViewHeader
                    tag={t('wallet.send.tag')}
                    title={t('wallet.send.title')}
                    titleAccent={t('wallet.send.titleAccent')}
                    description={t('wallet.send.description')}
                    icon={ArrowUpRight}
                />

                <div class="w-full">
                    <Show when={props.flowStep() === 1}>
                        <div class="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            {/* Asset Selection */}
                            <div class="space-y-4 relative">
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] px-1 block text-left">{t('wallet.send.selectAsset')}</label>
                                <div class="w-full">
                                    <button
                                        type="button"
                                        onClick={() => setShowAssetPicker(!showAssetPicker())}
                                        class={`flex items-center justify-between p-4 md:p-5 ${currentAssetConfig().bgActiveClass} border ${currentAssetConfig().borderClass} rounded-2xl relative group w-full overflow-hidden cursor-pointer hover:brightness-110 transition-all`}
                                    >
                                        <div class="flex items-center gap-3">
                                            <div class={`w-10 h-10 rounded-xl ${currentAssetConfig().bgClass} flex items-center justify-center`}>
                                                <span class={`font-black ${currentAssetConfig().textClass} text-sm`}>{currentAssetConfig().letter}</span>
                                            </div>
                                            <div class="flex-1 min-w-0 text-left">
                                                <div class="text-sm font-bold text-white uppercase tracking-tight truncate">{currentAssetConfig().name}</div>
                                                <div class={`text-[10px] font-bold ${currentAssetConfig().textClass} opacity-70 uppercase`}>{props.selectedToken()}</div>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-3">
                                            <div class="text-right shrink-0">
                                                <div class="text-sm font-black text-white tabular-nums">{props.getAssetData(props.selectedToken()).liquidBalance.toLocaleString()}</div>
                                                <div class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{t('wallet.send.available')}</div>
                                            </div>
                                            <ChevronDown class={`w-4 h-4 text-gray-500 transition-transform ${showAssetPicker() ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {/* Asset Dropdown */}
                                    <Show when={showAssetPicker()}>
                                        <div class="absolute z-20 left-0 right-0 mt-2 bg-[#111113] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <For each={TRANSFERABLE_ASSETS}>
                                                {(asset) => {
                                                    const assetData = () => props.getAssetData(asset.symbol);
                                                    const isSelected = () => props.selectedToken() === asset.symbol;
                                                    return (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                props.setSelectedToken(asset.symbol);
                                                                props.setSendAmount('');
                                                                setShowAssetPicker(false);
                                                            }}
                                                            class={`w-full flex items-center justify-between p-4 hover:bg-white/[0.04] border-b border-white/[0.03] last:border-0 transition-all ${isSelected() ? 'bg-white/[0.03]' : ''}`}
                                                        >
                                                            <div class="flex items-center gap-3">
                                                                <div class={`w-9 h-9 rounded-xl ${asset.bgClass} flex items-center justify-center`}>
                                                                    <span class={`font-black ${asset.textClass} text-xs`}>{asset.letter}</span>
                                                                </div>
                                                                <div class="text-left">
                                                                    <div class="text-sm font-bold text-white uppercase tracking-tight">{asset.name}</div>
                                                                    <div class={`text-[10px] font-bold ${asset.textClass} opacity-60 uppercase`}>{asset.symbol}</div>
                                                                </div>
                                                            </div>
                                                            <div class="flex items-center gap-3">
                                                                <div class="text-right">
                                                                    <div class="text-sm font-black text-white tabular-nums">{assetData().liquidBalance.toLocaleString()}</div>
                                                                    <div class="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{t('wallet.send.available')}</div>
                                                                </div>
                                                                <Show when={isSelected()}>
                                                                    <div class={`w-5 h-5 rounded-full ${asset.bgClass} flex items-center justify-center`}>
                                                                        <Check class={`w-3 h-3 ${asset.textClass}`} />
                                                                    </div>
                                                                </Show>
                                                            </div>
                                                        </button>
                                                    );
                                                }}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </div>

                            {/* Recipient */}
                            <div class="space-y-4">
                                <div class="flex items-center justify-between px-1">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] block text-left">
                                        {multiRecipients().length > 0 ? t('wallet.send.recipients') : t('wallet.send.recipientAddress')}
                                    </label>
                                    <button
                                        onClick={() => setShowContactPicker(true)}
                                        class="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all text-[10px] font-black uppercase tracking-widest border border-blue-500/20"
                                    >
                                        <Users class="w-3.5 h-3.5" />
                                        {t('wallet.send.contactList')}
                                    </button>
                                </div>

                                {/* Single Recipient Mode */}
                                <Show when={multiRecipients().length === 0}>
                                    <div class="relative group">
                                        <input
                                            type="text"
                                            placeholder={t('wallet.send.recipientPlaceholder')}
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
                                                <div class="p-4 text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest italic">{t('wallet.send.noContactsFound')}</div>
                                            </Show>
                                        </div>
                                    </Show>
                                </Show>

                                {/* Multi-Recipient Mode */}
                                <Show when={multiRecipients().length > 0}>
                                    <div class="space-y-3">
                                        <For each={multiRecipients()}>
                                            {(recipient, index) => (
                                                <div class="bg-[#111113] border border-white/10 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                                    <div class="flex items-center justify-between">
                                                        <div class="flex items-center gap-3">
                                                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 font-black text-sm border border-blue-500/20">
                                                                {recipient.contact.internalName?.charAt(0) || '?'}
                                                            </div>
                                                            <div>
                                                                <div class="text-sm font-bold text-white">{recipient.contact.internalName}</div>
                                                                <div class="text-[10px] font-mono text-gray-500">{recipient.contact.address?.slice(0, 10)}...{recipient.contact.address?.slice(-6)}</div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setMultiRecipients(prev => prev.filter((_, i) => i !== index()));
                                                            }}
                                                            class="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-400 rounded-xl transition-all"
                                                        >
                                                            <Trash2 class="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div class="flex items-center gap-3">
                                                        <div class="flex-1 relative">
                                                            <input
                                                                type="text"
                                                                placeholder="0.00"
                                                                value={recipient.amount}
                                                                onInput={(e) => {
                                                                    // Only validate, don't update state on every keystroke
                                                                    const raw = e.currentTarget.value.replace(/,/g, '');
                                                                    if (isNaN(Number(raw)) && raw !== '' && raw !== '.') {
                                                                        e.currentTarget.value = recipient.amount;
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    const raw = e.currentTarget.value.replace(/,/g, '');
                                                                    if (!isNaN(Number(raw)) || raw === '' || raw === '.') {
                                                                        setMultiRecipients(prev => prev.map((r, i) =>
                                                                            i === index() ? { ...r, amount: raw } : r
                                                                        ));
                                                                    }
                                                                }}
                                                                onChange={(e) => {
                                                                    const raw = e.currentTarget.value.replace(/,/g, '');
                                                                    if (!isNaN(Number(raw)) || raw === '' || raw === '.') {
                                                                        setMultiRecipients(prev => prev.map((r, i) =>
                                                                            i === index() ? { ...r, amount: raw } : r
                                                                        ));
                                                                    }
                                                                }}
                                                                class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-700 outline-none focus:border-blue-500/30 transition-all text-lg font-bold font-mono"
                                                            />
                                                            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-600">{props.selectedToken()}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const maxPerRecipient = Math.floor(props.getAssetData(props.selectedToken()).liquidBalance / multiRecipients().length);
                                                                setMultiRecipients(prev => prev.map((r, i) =>
                                                                    i === index() ? { ...r, amount: maxPerRecipient.toString() } : r
                                                                ));
                                                            }}
                                                            class="text-[9px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors bg-blue-400/10 px-3 py-2 rounded-lg whitespace-nowrap"
                                                        >
                                                            Max
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </For>

                                        <button
                                            onClick={() => setShowContactPicker(true)}
                                            class="w-full py-4 border-2 border-dashed border-white/10 hover:border-blue-500/30 rounded-2xl text-gray-500 hover:text-blue-400 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <Plus class="w-4 h-4 group-hover:rotate-90 transition-transform" />
                                            <span class="text-[10px] font-black uppercase tracking-widest">{t('wallet.send.addMoreRecipients')}</span>
                                        </button>

                                        <div class="flex items-center justify-between px-2 pt-2 border-t border-white/5">
                                            <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('wallet.send.totalAmount')}</span>
                                            <span class="text-lg font-black text-white">
                                                {multiRecipients().reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toLocaleString()} <span class="text-blue-400">{props.selectedToken()}</span>
                                            </span>
                                        </div>
                                    </div>
                                </Show>
                            </div>

                            {/* Amount - Single Recipient Mode Only */}
                            <Show when={multiRecipients().length === 0}>
                                <div class="space-y-4">
                                    <div class="flex flex-col sm:flex-row justify-between items-center sm:items-end px-1 gap-2">
                                        <label class="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{t('wallet.send.transferAmount')}</label>
                                        <button
                                            onClick={() => props.setSendAmount(props.getAssetData(props.selectedToken()).liquidBalance.toString())}
                                            class="text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300 transition-colors bg-blue-400/10 px-3 py-1 rounded-full sm:bg-transparent sm:p-0"
                                        >
                                            {t('wallet.send.useMaxBalance')}
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
                                        <div class="absolute right-6 top-1/2 -translate-y-1/2 text-lg font-black text-gray-600 tracking-tighter">{props.selectedToken()}</div>
                                    </div>
                                </div>
                            </Show>

                            {/* Review Transaction Button */}
                            <Show when={multiRecipients().length === 0} fallback={
                                <button
                                    disabled={multiRecipients().some(r => !r.amount || parseFloat(r.amount) <= 0)}
                                    onClick={() => props.setFlowStep(2)}
                                    class="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed uppercase tracking-widest"
                                >
                                    Review {multiRecipients().length} Transactions
                                </button>
                            }>
                                <button
                                    disabled={!ethers.isAddress(props.recipientAddress()) || !props.sendAmount() || Number(props.sendAmount().replace(/,/g, '')) <= 0}
                                    onClick={() => props.setFlowStep(2)}
                                    class="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-2xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed uppercase tracking-widest"
                                >
                                    {t('wallet.send.reviewTransaction')}
                                </button>
                            </Show>
                        </div>
                    </Show>

                    <Show when={props.flowStep() === 2}>
                        <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Single Recipient Review */}
                            <Show when={multiRecipients().length === 0}>
                                <div class="bg-gradient-to-br from-[#1c1c21] to-[#111113] border border-white/10 rounded-[32px] p-8 text-center shadow-3xl">
                                    <div class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-4">{t('wallet.send.youAreSending')}</div>
                                    <div class="text-5xl font-black text-white mb-2 tracking-tighter drop-shadow-sm">{props.sendAmount()} <span class="text-blue-500">{props.selectedToken()}</span></div>
                                    <div class="text-sm font-bold text-gray-500">≈ ${(Number(props.sendAmount().replace(/,/g, '')) * props.getAssetData(props.selectedToken()).price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</div>

                                    <div class="mt-8 pt-8 border-t border-white/[0.04] space-y-4">
                                        <div class="flex justify-between items-center px-2">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.recipientLabel')}</span>
                                            <div class="flex flex-col items-end">
                                                <Show when={resolvedRecipientName()} fallback={
                                                    <button
                                                        onClick={() => setIsAddingContact(true)}
                                                        class="flex items-center gap-2 group/save"
                                                    >
                                                        <span class="text-sm font-black text-amber-400 uppercase italic tracking-tighter group-hover/save:text-amber-300 transition-colors">{t('wallet.send.newRecipient')}</span>
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
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.networkFee')}</span>
                                            <span class="text-sm font-bold text-green-400">0.00021 {props.selectedToken()} <span class="text-[10px] text-gray-500 ml-1">($0.45)</span></span>
                                        </div>
                                        <div class="flex justify-between items-center px-2">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.estimatedTime')}</span>
                                            <span class="text-sm font-bold text-white flex items-center gap-2">
                                                <Clock class="w-3.5 h-3.5 text-blue-400" />
                                                ~12 Seconds
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Show>

                            {/* Multi-Recipient Review */}
                            <Show when={multiRecipients().length > 0}>
                                <div class="bg-gradient-to-br from-[#1c1c21] to-[#111113] border border-white/10 rounded-[32px] p-6 md:p-8 shadow-3xl">
                                    <div class="text-center mb-6">
                                        <div class="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">{t('wallet.send.batchTransfer')}</div>
                                        <div class="text-3xl font-black text-white tracking-tighter">
                                            {multiRecipients().reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0).toLocaleString()} <span class="text-blue-500">{props.selectedToken()}</span>
                                        </div>
                                        <div class="text-sm font-bold text-gray-500 mt-1">
                                            to {multiRecipients().length} recipients
                                        </div>
                                    </div>

                                    <div class="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                        <For each={multiRecipients()}>
                                            {(recipient) => (
                                                <div class="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/5">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-blue-400 font-black text-sm border border-blue-500/20">
                                                            {recipient.contact.internalName?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <div class="text-sm font-bold text-white">{recipient.contact.internalName}</div>
                                                            <div class="text-[10px] font-mono text-gray-500">{recipient.contact.address?.slice(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                    <div class="text-right">
                                                        <div class="text-sm font-black text-white">{parseFloat(recipient.amount).toLocaleString()} <span class="text-blue-400">{props.selectedToken()}</span></div>
                                                    </div>
                                                </div>
                                            )}
                                        </For>
                                    </div>

                                    <div class="mt-6 pt-6 border-t border-white/5 space-y-3">
                                        <div class="flex justify-between items-center px-2">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.estTotalFee')}</span>
                                            <span class="text-sm font-bold text-green-400">{(0.00021 * multiRecipients().length).toFixed(5)} {props.selectedToken()}</span>
                                        </div>
                                        <div class="flex justify-between items-center px-2">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.estTime')}</span>
                                            <span class="text-sm font-bold text-white flex items-center gap-2">
                                                <Clock class="w-3.5 h-3.5 text-blue-400" />
                                                ~{multiRecipients().length * 12} Seconds
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Show>

                            <div class="flex flex-col sm:flex-row gap-4">
                                <button onClick={() => props.setFlowStep(1)} class="flex-1 py-5 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all border border-white/5 uppercase tracking-widest text-xs">{t('wallet.send.modifyDetails')}</button>
                                <button
                                    onClick={() => {
                                        if (multiRecipients().length > 0 && props.onMultiTransaction) {
                                            // Multi-recipient batch transaction
                                            const recipients = multiRecipients().map(r => ({
                                                address: r.contact.address,
                                                amount: r.amount,
                                                name: r.contact.internalName || 'Unknown'
                                            }));
                                            props.onMultiTransaction(recipients);
                                        } else {
                                            // Single recipient transaction
                                            props.handleTransaction();
                                        }
                                    }}
                                    disabled={props.flowLoading()}
                                    class="flex-[2] py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-500/30 flex items-center justify-center gap-3 uppercase tracking-widest"
                                >
                                    <Show when={props.flowLoading()} fallback={
                                        multiRecipients().length > 0 ? t('wallet.send.sendToRecipients', { count: multiRecipients().length }) : t('wallet.send.confirmAndSend')
                                    }>
                                        <RefreshCw class="w-5 h-5 animate-spin" />
                                        {t('wallet.send.processing')}
                                    </Show>
                                </button>
                            </div>
                        </div>
                    </Show>

                    <Show when={props.flowStep() === 3}>
                        {/* Differentiate: Time Lock vs Standard Transfer Success */}
                        <Show when={props.isSchedulingTimeLock()} fallback={
                            /* Standard Transfer - Immediate Success */
                            <div class="py-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 space-y-8">
                                <div class="relative">
                                    <div class="absolute inset-0 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
                                    <div class="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                                        <Check class="w-12 h-12 text-white" />
                                    </div>
                                </div>

                                <div>
                                    <h4 class="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">{t('wallet.send.transferComplete')}</h4>
                                    <p class="text-gray-500 font-medium">{t('wallet.send.transferCompleteDesc')}</p>
                                </div>

                                {/* Success Card */}
                                <div class="w-full bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-[32px] overflow-hidden shadow-3xl">
                                    <div class="p-6 border-b border-emerald-500/20">
                                        <div class="flex items-center gap-3">
                                            <div class="w-3 h-3 bg-emerald-400 rounded-full" />
                                            <span class="text-sm font-black text-emerald-400 uppercase tracking-widest">{t('wallet.send.confirmed')}</span>
                                        </div>
                                    </div>

                                    <div class="p-6 space-y-4 text-left">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.amount')}</span>
                                            <span class="text-lg font-black text-white italic">{props.sendAmount()} {props.selectedToken()}</span>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">{t('wallet.send.toAddress')}</span>
                                            <span class="text-xs font-mono text-blue-400">{props.recipientAddress().slice(0, 12)}...{props.recipientAddress().slice(-8)}</span>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Status</span>
                                            <span class="text-xs font-black text-emerald-400 uppercase flex items-center gap-2">
                                                <span class="w-2 h-2 bg-emerald-400 rounded-full" />
                                                {t('wallet.send.completed')}
                                            </span>
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
                                                    {copied() ? t('wallet.send.copied') : t('wallet.send.copyHash')}
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
                                        {t('wallet.send.trackOnVisionScan')}
                                    </a>
                                    <button
                                        onClick={props.resetFlow}
                                        class="py-5 bg-white text-black font-black rounded-2xl transition-all hover:bg-white/90 uppercase tracking-widest shadow-xl shadow-white/5"
                                    >
                                        {t('wallet.send.done')}
                                    </button>
                                </div>
                            </div>
                        }>
                            {/* Time Lock Transfer - Pending UI */}
                            <div class="py-12 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 space-y-8">
                                <div class="relative">
                                    <div class="absolute inset-0 bg-amber-500/20 rounded-full blur-3xl animate-pulse" />
                                    <div class="relative w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/40">
                                        <Clock class="w-12 h-12 text-white" />
                                    </div>
                                </div>

                                <div>
                                    <h4 class="text-3xl font-black text-white italic tracking-tighter uppercase mb-2">{t('wallet.send.timeLockScheduled')}</h4>
                                    <p class="text-gray-500 font-medium">{t('wallet.send.timeLockScheduledDesc')}</p>
                                </div>

                                {/* Time Lock Status Card */}
                                <div class="w-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-[32px] overflow-hidden shadow-3xl">
                                    <div class="p-6 border-b border-amber-500/20">
                                        <div class="flex items-center justify-between">
                                            <div class="flex items-center gap-3">
                                                <div class="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                                                <span class="text-sm font-black text-amber-400 uppercase tracking-widest">{t('wallet.send.challengePeriod')}</span>
                                            </div>
                                            <span class="text-lg font-black text-white tabular-nums">15:00</span>
                                        </div>
                                        <div class="mt-3 h-2 bg-black/30 rounded-full overflow-hidden">
                                            <div class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full w-0 animate-[progress_900s_linear]" style="width: 0%" />
                                        </div>
                                        <p class="text-[10px] text-amber-400/60 mt-2 uppercase tracking-widest">{t('wallet.send.finalizationAfter')}</p>
                                    </div>

                                    <div class="p-6 space-y-4 text-left">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Amount</span>
                                            <span class="text-lg font-black text-white italic">{props.sendAmount()} {props.selectedToken()}</span>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">To Address</span>
                                            <span class="text-xs font-mono text-blue-400">{props.recipientAddress().slice(0, 12)}...{props.recipientAddress().slice(-8)}</span>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <span class="text-[10px] font-black text-gray-600 uppercase tracking-widest">Status</span>
                                            <span class="text-xs font-black text-amber-400 uppercase flex items-center gap-2">
                                                <span class="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                                {t('wallet.send.pendingFinalization')}
                                            </span>
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

                                {/* Info Box */}
                                <div class="w-full bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 text-left">
                                    <div class="flex items-start gap-3">
                                        <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                                            <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <div class="text-xs font-bold text-white mb-1">{t('wallet.send.timeLockAgentActive')}</div>
                                            <p class="text-[11px] text-gray-500 leading-relaxed">
                                                {t('wallet.send.timeLockAgentDesc')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div class="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <a
                                        href={`/visionscan?tx=${props.lastTxHash()}`}
                                        target="_blank"
                                        class="py-5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5 flex items-center justify-center gap-2"
                                    >
                                        Track on VisionScan
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

            <ContactPickerModal
                isOpen={showContactPicker()}
                onClose={() => {
                    setShowContactPicker(false);
                    setContactSearchQuery('');
                }}
                contacts={props.contacts()}
                selectedContacts={selectedContacts()}
                setSelectedContacts={setSelectedContacts}
                searchQuery={contactSearchQuery()}
                setSearchQuery={setContactSearchQuery}
                onConfirm={(selected) => {
                    if (selected.length === 1 && multiRecipients().length === 0) {
                        // Single selection: use existing single-recipient mode
                        props.setRecipientAddress(selected[0].address);
                    } else {
                        // Multiple selection: add to multi-recipients
                        const existingAddresses = new Set(multiRecipients().map(r => r.contact.address));
                        const newRecipients = selected
                            .filter(c => !existingAddresses.has(c.address))
                            .map(c => ({ contact: c, amount: '' }));
                        setMultiRecipients(prev => [...prev, ...newRecipients]);
                    }
                    setSelectedContacts(new Set<string>());
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

interface ContactPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    contacts: any[];
    selectedContacts: Set<string>;
    setSelectedContacts: (set: Set<string>) => void;
    onConfirm: (selected: any[]) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
}

const ContactPickerModal = (props: ContactPickerModalProps) => {
    const availableContacts = () => {
        const query = props.searchQuery.toLowerCase().trim();
        const withWallet = props.contacts.filter(c => c.address && c.address.startsWith('0x'));
        if (!query) return withWallet;
        return withWallet.filter(c =>
            c.internalName?.toLowerCase().includes(query) ||
            c.address?.toLowerCase().includes(query)
        );
    };

    const toggleContact = (contactId: string) => {
        const newSet = new Set(props.selectedContacts);
        if (newSet.has(contactId)) {
            newSet.delete(contactId);
        } else {
            newSet.add(contactId);
        }
        props.setSelectedContacts(newSet);
    };

    const handleConfirm = () => {
        const selected = props.contacts.filter(c => props.selectedContacts.has(c.id || c.address));
        props.onConfirm(selected);
        props.onClose();
    };

    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 z-[150] flex items-center justify-center p-4">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    class="absolute inset-0 bg-black/90 backdrop-blur-md"
                />
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    class="relative w-full max-w-lg bg-[#0d0d0f] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-3xl max-h-[80vh] flex flex-col"
                >
                    {/* Header */}
                    <div class="p-6 border-b border-white/5">
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h3 class="text-xl font-black text-white uppercase tracking-tight">Select Recipients</h3>
                                <p class="text-xs text-gray-500 mt-1">Choose contacts to send tokens to</p>
                            </div>
                            <button
                                onClick={props.onClose}
                                class="p-2 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-all"
                            >
                                <X class="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div class="relative">
                            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                value={props.searchQuery}
                                onInput={(e) => props.setSearchQuery(e.currentTarget.value)}
                                class="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-blue-500/30 transition-all placeholder:text-gray-600"
                            />
                        </div>
                    </div>

                    {/* Contact List */}
                    <div class="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                        <Show when={availableContacts().length === 0}>
                            <div class="py-12 text-center">
                                <User class="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p class="text-sm text-gray-500">No contacts with wallet addresses found</p>
                            </div>
                        </Show>

                        <For each={availableContacts()}>
                            {(contact) => {
                                const id = contact.id || contact.address;
                                const isSelected = () => props.selectedContacts.has(id);

                                return (
                                    <button
                                        onClick={() => toggleContact(id)}
                                        class={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${isSelected()
                                            ? 'bg-blue-500/10 border-2 border-blue-500/50'
                                            : 'bg-white/[0.02] border-2 border-transparent hover:border-white/10'
                                            }`}
                                    >
                                        <div class={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isSelected() ? 'bg-blue-500' : 'bg-white/10 border border-white/20'
                                            }`}>
                                            <Show when={isSelected()}>
                                                <Check class="w-4 h-4 text-white" />
                                            </Show>
                                        </div>
                                        <div class={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${isSelected()
                                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                                            : 'bg-white/5 text-gray-400'
                                            }`}>
                                            {contact.internalName?.charAt(0) || '?'}
                                        </div>
                                        <div class="flex-1 text-left">
                                            <div class={`text-sm font-bold ${isSelected() ? 'text-white' : 'text-gray-300'}`}>
                                                {contact.internalName}
                                            </div>
                                            <div class="text-[10px] font-mono text-gray-500">
                                                {contact.address?.slice(0, 10)}...{contact.address?.slice(-6)}
                                            </div>
                                        </div>
                                    </button>
                                );
                            }}
                        </For>
                    </div>

                    {/* Footer */}
                    <div class="p-6 border-t border-white/5 flex items-center justify-between gap-4">
                        <div class="text-sm text-gray-400">
                            <span class="font-black text-white">{props.selectedContacts.size}</span> selected
                        </div>
                        <div class="flex gap-3">
                            <button
                                onClick={props.onClose}
                                class="px-6 py-3 text-xs font-bold text-gray-500 hover:text-white transition-colors uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={props.selectedContacts.size === 0}
                                class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest text-xs active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Confirm Selection
                            </button>
                        </div>
                    </div>
                </Motion.div>
            </div>
        </Show>
    );
};
