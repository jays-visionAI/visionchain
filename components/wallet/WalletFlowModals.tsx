import { Show, For, Switch, Match, createSignal, createMemo } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    TrendingUp,
    Layers,
    Plus,
    Check,
    Copy,
    Clock,
    Sparkles,
    ChevronDown,
    AlertCircle,
    LucideIcon
} from 'lucide-solid';
import { ethers } from 'ethers';
import { saveUserContacts } from '../../services/firebaseService';

interface WalletFlowModalsProps {
    activeFlow: () => string | null;
    setActiveFlow: (flow: string | null) => void;
    flowStep: () => number;
    setFlowStep: (step: number) => void;
    networkMode: () => 'mainnet' | 'testnet';
    selectedToken: () => string;
    setSelectedToken: (s: string) => void;
    toToken: () => string;
    setToToken: (s: string) => void;
    sendAmount: () => string;
    setSendAmount: (a: string) => void;
    swapAmount: () => string;
    setSwapAmount: (a: string) => void;
    recipientAddress: () => string;
    setRecipientAddress: (a: string) => void;
    stakeAmount: () => string;
    setStakeAmount: (a: string) => void;
    batchInput: () => string;
    setBatchInput: (i: string) => void;
    parsedBatchTransactions: () => any[];
    multiTransactions: () => any[];
    handleTransaction: () => void;
    handleBatchTransaction: () => void;
    flowLoading: () => boolean;
    resetFlow: () => void;
    walletAddress: () => string;
    getAssetData: (symbol: string) => any;
    lastTxHash: () => string;
    copyToClipboard: (text: string) => Promise<boolean>;
    isSchedulingTimeLock: () => boolean;
    lockDelaySeconds: () => number;
    userProfile: () => any;
    contacts: () => any[];
    onContactAdded?: () => void;
}

export const WalletFlowModals = (props: WalletFlowModalsProps) => {
    const [receiveNetwork, setReceiveNetwork] = createSignal('Vision Chain');
    const [copied, setCopied] = createSignal(false);
    const [isAddingContact, setIsAddingContact] = createSignal(false);

    const resolvedRecipientName = createMemo(() => {
        const addr = props.recipientAddress().toLowerCase();
        if (!addr || !ethers.isAddress(addr)) return null;
        const contact = props.contacts().find(c => c.address?.toLowerCase() === addr);
        return contact?.internalName || null;
    });

    return (
        <Show when={props.activeFlow()}>
            <div class="fixed inset-0 z-[100] flex items-center justify-center px-4 p-4">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <Motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    class="relative w-full max-w-lg bg-[#111113] border border-white/[0.08] rounded-[32px] overflow-hidden shadow-2xl"
                >
                    <div class="p-8">
                        {/* Header */}
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="text-2xl font-bold text-white flex items-center gap-3 capitalize">
                                <Switch>
                                    <Match when={props.activeFlow() === 'send'}>
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><ArrowUpRight class="w-5 h-5 text-blue-400" /></div>Send Tokens
                                    </Match>
                                    <Match when={props.activeFlow() === 'receive'}>
                                        <div class="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center"><ArrowDownLeft class="w-5 h-5 text-green-400" /></div>Receive Tokens
                                    </Match>
                                    <Match when={props.activeFlow() === 'swap'}>
                                        <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><RefreshCw class="w-5 h-5 text-purple-400" /></div>Swap Assets
                                    </Match>
                                    <Match when={props.activeFlow() === 'stake'}>
                                        <div class="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center"><TrendingUp class="w-5 h-5 text-indigo-400" /></div>Stake VCN
                                    </Match>
                                    <Match when={props.activeFlow() === 'multi' || props.activeFlow() === 'batch_send'}>
                                        <div class="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><Layers class="w-5 h-5 text-purple-400" /></div>Batch Transfer
                                    </Match>
                                </Switch>
                                <Show when={props.networkMode() === 'testnet'}>
                                    <span class="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] rounded-md font-black uppercase tracking-widest">Testnet</span>
                                </Show>
                            </h3>
                            <button onClick={() => props.setActiveFlow(null)} class="p-2 hover:bg-white/10 rounded-full transition-colors"><Plus class="w-6 h-6 text-gray-500 rotate-45" /></button>
                        </div>

                        {/* Flow Content */}
                        <div class="space-y-6">
                            <Switch>
                                {/* SEND FLOW */}
                                <Match when={props.activeFlow() === 'send'}>
                                    <div class="space-y-4">
                                        <div class="flex justify-between items-center mb-2">
                                            <span class="text-[11px] font-black text-blue-400 uppercase tracking-widest">Single Transfer</span>
                                            <button
                                                onClick={() => props.setActiveFlow('batch_send')}
                                                class="text-[10px] font-bold text-gray-500 hover:text-purple-400 uppercase tracking-widest transition-colors"
                                            >
                                                Switch to Batch Mode &rarr;
                                            </button>
                                        </div>

                                        <Switch>
                                            <Match when={props.flowStep() === 1}>
                                                <div class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                    <div>
                                                        <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Select Asset</label>
                                                        <div class="grid grid-cols-2 gap-2">
                                                            <For each={['VCN']}>
                                                                {(symbol) => (
                                                                    <div class="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/50 rounded-xl relative">
                                                                        <div class="text-xs font-bold text-white flex-1">{symbol}</div>
                                                                        <span
                                                                            onClick={() => {
                                                                                const max = props.getAssetData(props.selectedToken()).liquidBalance;
                                                                                props.setSendAmount(max.toLocaleString());
                                                                            }}
                                                                            class="text-[10px] font-black text-blue-400 uppercase tracking-widest cursor-pointer hover:text-blue-300 transition-colors flex items-center gap-1 bg-blue-500/20 px-2 py-1 rounded-lg"
                                                                        >
                                                                            Available: {props.getAssetData(props.selectedToken()).liquidBalance.toLocaleString()} <RefreshCw class="w-3 h-3" />
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </For>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Recipient Address</label>
                                                        <div class="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="0x..."
                                                                value={props.recipientAddress()}
                                                                onInput={(e) => props.setRecipientAddress(e.currentTarget.value)}
                                                                class={`w-full bg-white/[0.03] border rounded-2xl px-5 py-4 text-white placeholder:text-gray-600 outline-none transition-all font-mono text-sm ${props.recipientAddress() && !ethers.isAddress(props.recipientAddress()) ? 'border-red-500/50' : 'border-white/[0.06] focus:border-blue-500/30'}`}
                                                            />
                                                            <Show when={props.recipientAddress().trim() && !ethers.isAddress(props.recipientAddress().trim()) && (props.recipientAddress().includes(',') || props.recipientAddress().includes('&') || props.recipientAddress().includes('+') || props.recipientAddress().includes('/') || (props.recipientAddress().trim().split(/\s+/).length > 1))}>
                                                                <button
                                                                    onClick={() => {
                                                                        const raw = props.recipientAddress().trim();
                                                                        // Split by various separators
                                                                        let parts = raw.split(/[,\/&+]+/).map(a => a.trim()).filter(Boolean);

                                                                        if (parts.length <= 1 && raw.split(/\s+/).length > 1) {
                                                                            parts = raw.split(/\s+/).map(a => a.trim()).filter(Boolean);
                                                                        }

                                                                        const rawAmount = props.sendAmount().replace(/,/g, '');
                                                                        // Build standardized batch strings
                                                                        const batchStr = parts.map(p => {
                                                                            // Try to see if part contains its own amount e.g. "Alice 30"
                                                                            const subParts = p.split(/\s+/);
                                                                            if (subParts.length >= 2 && !isNaN(parseFloat(subParts[subParts.length - 1]))) {
                                                                                const amt = subParts.pop();
                                                                                return `${subParts.join(' ')}, , ${amt}`;
                                                                            }
                                                                            return `${p}, , ${rawAmount}`;
                                                                        }).join('\n');

                                                                        props.setBatchInput(batchStr);
                                                                        props.setActiveFlow('batch_send');
                                                                    }}
                                                                    class="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black px-4 py-2.5 rounded-xl transition-all animate-pulse shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center gap-2 z-20 border border-blue-400/50"
                                                                >
                                                                    <Sparkles class="w-3.5 h-3.5" /> Multi-Detect! Switch to Batch &rarr;
                                                                </button>
                                                            </Show>
                                                        </div>
                                                        <Show when={props.recipientAddress().trim() && !ethers.isAddress(props.recipientAddress().trim()) && !(props.recipientAddress().includes(',') || props.recipientAddress().includes('&') || props.recipientAddress().includes('+') || (props.recipientAddress().trim().split(/\s+/).length > 1))}>
                                                            <p class="text-[10px] text-red-400 mt-2 ml-1 font-bold uppercase tracking-wider italic animate-pulse">Invalid Address</p>
                                                        </Show>
                                                    </div>

                                                    <div>
                                                        <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-2 px-1">Amount</label>
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
                                                                class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-white placeholder:text-gray-600 outline-none focus:border-blue-500/30 transition-all text-xl font-bold font-mono"
                                                            />
                                                            <div class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">{props.selectedToken()}</div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        disabled={!ethers.isAddress(props.recipientAddress()) || !props.sendAmount() || Number(props.sendAmount().replace(/,/g, '')) <= 0}
                                                        onClick={() => props.setFlowStep(2)}
                                                        class="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Review Transaction
                                                    </button>
                                                </div>
                                            </Match>

                                            <Match when={props.flowStep() === 2}>
                                                <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                    <div class="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 text-center">
                                                        <div class="text-[11px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                                                            <Show when={props.isSchedulingTimeLock()} fallback="You are sending">Agent is Scheduling</Show>
                                                        </div>
                                                        <div class="text-4xl font-bold text-white mb-1">{props.sendAmount()} {props.selectedToken()}</div>
                                                        <div class="text-sm text-gray-500">≈ ${(Number(props.sendAmount().replace(/,/g, '')) * props.getAssetData(props.selectedToken()).price).toFixed(2)}</div>
                                                    </div>

                                                    <div class="space-y-3">
                                                        <div class="flex justify-between text-sm">
                                                            <span class="text-gray-500">To</span>
                                                            <div class="flex flex-col items-end">
                                                                <Show when={resolvedRecipientName()} fallback={
                                                                    <button
                                                                        onClick={() => setIsAddingContact(true)}
                                                                        class="flex items-center gap-1.5 group/save"
                                                                    >
                                                                        <span class="text-xs font-black text-amber-400 uppercase italic tracking-tighter group-hover/save:text-amber-300 transition-colors">New Recipient</span>
                                                                        <Plus class="w-3 h-3 text-amber-400" />
                                                                    </button>
                                                                }>
                                                                    <span class="text-white font-black italic tracking-tight">{resolvedRecipientName()}</span>
                                                                </Show>
                                                                <span class="text-[10px] font-mono text-gray-600 opacity-60">
                                                                    {props.recipientAddress().slice(0, 6)}...{props.recipientAddress().slice(-4)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div class="flex justify-between text-sm">
                                                            <span class="text-gray-500">Network Fee</span>
                                                            <span class="text-green-400 font-bold">0.00021 VCN ($0.45)</span>
                                                        </div>
                                                        <div class="flex justify-between text-sm">
                                                            <span class="text-gray-500">Estimated {props.isSchedulingTimeLock() ? 'Execution' : 'Time'}</span>
                                                            <span class="text-white font-bold">
                                                                <Show when={props.isSchedulingTimeLock()} fallback="~12 seconds">
                                                                    In {Math.ceil(props.lockDelaySeconds() / 60)} minutes (Agent Lock)
                                                                </Show>
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div class="flex gap-4">
                                                        <button onClick={() => props.setFlowStep(1)} class="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-2xl transition-all">Back</button>
                                                        <button
                                                            onClick={props.handleTransaction}
                                                            disabled={props.flowLoading()}
                                                            class="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"
                                                        >
                                                            <Show when={props.flowLoading()} fallback="Confirm & Send">
                                                                <RefreshCw class="w-4 h-4 animate-spin" />
                                                                Sending...
                                                            </Show>
                                                        </button>
                                                    </div>
                                                </div>
                                            </Match>

                                            <Match when={props.flowStep() === 3}>
                                                <div class="py-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
                                                    <div class="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-amber-500/30 mb-4">
                                                        <Show when={props.isSchedulingTimeLock()} fallback={<Clock class="w-8 h-8 text-white" />}>
                                                            <Clock class="w-8 h-8 text-white" />
                                                        </Show>
                                                    </div>
                                                    <h4 class="text-xl font-bold text-white mb-1">
                                                        {props.isSchedulingTimeLock() ? 'Agent Scheduled!' : 'Transaction Pending'}
                                                    </h4>
                                                    <p class="text-xs text-gray-500 mb-4">Challenge period in progress for security</p>
                                                    <div class="mb-4 text-2xl font-black text-blue-400">
                                                        {props.sendAmount()} {props.selectedToken()}
                                                    </div>

                                                    {/* Challenge Period Status */}
                                                    <div class="w-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
                                                        <div class="flex items-center justify-between mb-2">
                                                            <div class="flex items-center gap-2">
                                                                <div class="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                                                <span class="text-[10px] font-black text-amber-400 uppercase tracking-widest">Challenge Period</span>
                                                            </div>
                                                            <span class="text-sm font-black text-white tabular-nums">15:00</span>
                                                        </div>
                                                        <div class="h-1.5 bg-black/30 rounded-full overflow-hidden">
                                                            <div class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full" style="width: 0%" />
                                                        </div>
                                                    </div>

                                                    <div class="mb-4 w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden">
                                                        <div class="px-4 py-3 space-y-2">
                                                            <div class="flex items-center justify-between text-xs">
                                                                <span class="text-gray-500 font-bold uppercase tracking-wider">Status</span>
                                                                <span class="text-amber-400 font-bold flex items-center gap-1.5">
                                                                    <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                                                                    Pending Finalization
                                                                </span>
                                                            </div>
                                                            <div class="flex items-center justify-between text-xs">
                                                                <span class="text-gray-500 font-bold uppercase tracking-wider">From</span>
                                                                <span class="text-blue-400 font-mono tracking-tight">{props.walletAddress().slice(0, 6)}...{props.walletAddress().slice(-6)}</span>
                                                            </div>
                                                            <div class="flex items-center justify-between text-xs">
                                                                <span class="text-gray-500 font-bold uppercase tracking-wider">To</span>
                                                                <span class="text-blue-400 font-mono tracking-tight">{props.recipientAddress().slice(0, 6)}...{props.recipientAddress().slice(-6)}</span>
                                                            </div>

                                                            <div class="h-px bg-white/5 w-full my-1"></div>

                                                            <div class="space-y-1.5 text-left">
                                                                <div class="flex items-center justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                                    <div class="flex items-center gap-2">
                                                                        <div class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                                                                        Transaction ID
                                                                    </div>
                                                                    <button
                                                                        onClick={async () => {
                                                                            const success = await props.copyToClipboard(props.lastTxHash());
                                                                            if (success) {
                                                                                setCopied(true);
                                                                                setTimeout(() => setCopied(false), 2000);
                                                                            }
                                                                        }}
                                                                        class="hover:text-white text-gray-500 transition-colors flex items-center gap-1.5 group cursor-pointer"
                                                                    >
                                                                        {copied() ? 'Copied!' : 'Copy'}
                                                                        <Copy class="w-3 h-3 group-hover:scale-110 transition-transform" />
                                                                    </button>
                                                                </div>
                                                                <div class="text-[11px] font-mono text-gray-400 break-all leading-relaxed select-all hover:text-white transition-colors">{props.lastTxHash()}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div class="w-full space-y-3">
                                                        <a
                                                            href={`/visionscan?tx=${props.lastTxHash()}`}
                                                            target="_blank"
                                                            class="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all border border-white/5 flex items-center justify-center decoration-none text-sm"
                                                        >
                                                            Track on VisionScan
                                                        </a>
                                                        <button
                                                            onClick={props.resetFlow}
                                                            class="w-full py-3 bg-white text-black font-bold rounded-2xl transition-all hover:bg-white/90 text-sm"
                                                        >
                                                            Done
                                                        </button>
                                                    </div>
                                                </div>
                                            </Match>
                                        </Switch>
                                    </div>
                                </Match>

                                {/* BATCH SEND FLOW */}
                                <Match when={props.activeFlow() === 'batch_send'}>
                                    <div class="space-y-4">
                                        <div class="flex justify-between items-center mb-2">
                                            <div class="flex items-center gap-2">
                                                <span class="text-[11px] font-black text-purple-400 uppercase tracking-widest">Architect Batch Mode</span>
                                                <Show when={props.parsedBatchTransactions().length > 0}>
                                                    <span class="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded-lg border border-purple-500/20">{props.parsedBatchTransactions().length} Tasks</span>
                                                </Show>
                                            </div>
                                            <button
                                                onClick={() => props.setActiveFlow('send')}
                                                class="text-[10px] font-bold text-gray-500 hover:text-blue-400 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                                            >
                                                <ArrowUpRight class="w-3 h-3" /> Single Transfer
                                            </button>
                                        </div>

                                        <div class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                            <div class="grid grid-cols-2 gap-3">
                                                <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2 opacity-60">Selected Asset</label>
                                                    <div class="flex items-center gap-2">
                                                        <div class="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center text-[10px] font-black">V</div>
                                                        <span class="text-sm font-bold text-white">VCN Token</span>
                                                    </div>
                                                </div>
                                                <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                                                    <label class="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1 opacity-60">Account Balance</label>
                                                    <div class="text-sm font-bold text-green-400">{props.getAssetData('VCN').liquidBalance.toLocaleString()} VCN</div>
                                                </div>
                                            </div>

                                            <div class="group">
                                                <div class="flex justify-between items-center mb-1.5 px-1">
                                                    <label class="text-[11px] font-black text-gray-400 uppercase tracking-widest">Input Stream</label>
                                                    <div class="flex items-center gap-3">
                                                        <button
                                                            class="text-[10px] text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                                                            onClick={() => props.setBatchInput("")}
                                                        >
                                                            Clear
                                                        </button>
                                                        <button
                                                            class="text-[10px] text-purple-400 cursor-pointer hover:underline font-bold flex items-center gap-1"
                                                            onClick={() => {
                                                                const randAddr = "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
                                                                const newVal = `Pioneer, ${randAddr}, 50`;
                                                                props.setBatchInput(props.batchInput() ? props.batchInput() + "\n" + newVal : newVal);
                                                            }}
                                                        >
                                                            <Plus class="w-3 h-3" /> Sample
                                                        </button>
                                                    </div>
                                                </div>
                                                <div class="relative">
                                                    <textarea
                                                        placeholder={`Format: Name, Address, Amount\nExample: Alice, 0x..., 50`}
                                                        value={props.batchInput()}
                                                        onInput={(e) => props.setBatchInput(e.currentTarget.value)}
                                                        class="w-full h-32 bg-[#0a0a0c] border border-white/[0.08] rounded-2xl p-4 text-xs font-mono text-white placeholder:text-gray-600 outline-none focus:border-purple-500/40 focus:bg-purple-500/[0.02] transition-all resize-none leading-relaxed shadow-2xl"
                                                    />
                                                    <div class="absolute bottom-3 right-3 opacity-20"><Layers class="w-8 h-8 text-purple-500" /></div>
                                                </div>
                                            </div>

                                            <div class="bg-black/40 rounded-3xl border border-white/[0.05] overflow-hidden shadow-xl">
                                                <div class="grid grid-cols-12 gap-2 p-4 bg-white/[0.02] text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/[0.05]">
                                                    <div class="col-span-5">Identity / Recipient</div>
                                                    <div class="col-span-4">Network ID</div>
                                                    <div class="col-span-3 text-right">Value</div>
                                                </div>
                                                <div class="max-h-[220px] overflow-y-auto custom-scrollbar">
                                                    <For each={props.parsedBatchTransactions()}>
                                                        {(tx, i) => {
                                                            const colors = ['bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                                                            const colorClass = colors[i() % colors.length];

                                                            return (
                                                                <div class="grid grid-cols-12 gap-2 p-4 border-b border-white/[0.03] hover:bg-white/[0.04] transition-all items-center group/row">
                                                                    <div class="col-span-5 flex items-center gap-3">
                                                                        <div class={`w-8 h-8 rounded-full ${colorClass}/20 flex items-center justify-center text-[10px] font-black text-white border border-${colorClass}/20`}>
                                                                            {(tx.name || 'U')[0].toUpperCase()}
                                                                        </div>
                                                                        <div class="flex flex-col min-w-0">
                                                                            <span class="text-xs font-bold text-white truncate">{tx.name || `Task ${i() + 1}`}</span>
                                                                            <Show when={tx.recipient} fallback={<span class="text-[9px] text-amber-500/80 font-medium italic flex items-center gap-1"><AlertCircle class="w-2.5 h-2.5" /> Pending Resolution</span>}>
                                                                                <span class="text-[9px] text-gray-500 font-mono truncate opacity-60">Verified Identity</span>
                                                                            </Show>
                                                                        </div>
                                                                    </div>
                                                                    <div class="col-span-4 font-mono text-[10px] truncate" title={tx.recipient || 'Waiting for resolution...'}>
                                                                        <Show when={tx.recipient} fallback={<span class="px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[8px] font-black uppercase tracking-tighter border border-amber-500/20">Missing</span>}>
                                                                            <span class="text-blue-400 group-hover/row:text-blue-300 transition-colors uppercase">{tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}</span>
                                                                        </Show>
                                                                    </div>
                                                                    <div class="col-span-3 text-right">
                                                                        <div class="text-xs font-black text-white">{parseFloat(tx.amount || '0').toLocaleString()}</div>
                                                                        <div class="text-[9px] text-gray-500 font-bold uppercase tracking-tight">VCN</div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }}
                                                    </For>
                                                    <Show when={props.parsedBatchTransactions().length === 0}>
                                                        <div class="p-12 text-center flex flex-col items-center gap-3">
                                                            <div class="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-1">
                                                                <Plus class="w-6 h-6 text-gray-700 rotate-45" />
                                                            </div>
                                                            <p class="text-gray-600 text-[11px] font-bold uppercase tracking-widest">No Executable Tasks</p>
                                                            <p class="text-gray-700 text-[10px] max-w-[200px]">The stream is currently empty. Provide names or addresses to begin.</p>
                                                        </div>
                                                    </Show>
                                                </div>
                                                <div class="p-4 bg-gradient-to-r from-purple-900/10 to-transparent border-t border-white/[0.05] flex justify-between items-center">
                                                    <div class="flex items-center gap-2">
                                                        <div class="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                                        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Consolidated Batch Sum</span>
                                                    </div>
                                                    <div class="flex flex-col items-end">
                                                        <span class="text-lg font-black text-white font-mono leading-none">
                                                            {props.parsedBatchTransactions().reduce((acc, curr) => acc + parseFloat(curr.amount || '0'), 0).toLocaleString()} <span class="text-xs text-purple-400 ml-1">VCN</span>
                                                        </span>
                                                        <span class="text-[9px] text-gray-600 font-bold uppercase mt-1">Estimating Network Fee...</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                disabled={props.parsedBatchTransactions().length === 0}
                                                onClick={props.handleBatchTransaction}
                                                class="w-full group/btn relative py-5 bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 text-white font-black rounded-3xl transition-all shadow-[0_10px_30px_rgba(79,70,229,0.3)] active:scale-[0.98] mt-4 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed overflow-hidden"
                                            >
                                                <div class="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-500" />
                                                <div class="relative flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
                                                    <Layers class="w-4 h-4" />
                                                    Execute Multi-Chain Batch ({props.parsedBatchTransactions().length})
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                </Match>

                                {/* STAKE FLOW */}
                                <Match when={props.activeFlow() === 'stake'}>
                                    <div class="space-y-4">
                                        <Show when={props.flowStep() === 1}>
                                            <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div>
                                                    <div class="flex items-center justify-between mb-2"><label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Stake Amount</label><span class="text-[10px] font-bold text-blue-400">Balance: {props.getAssetData('VCN').liquidBalance.toLocaleString()} VCN</span></div>
                                                    <div class="relative">
                                                        <input type="number" placeholder="0.00" value={props.stakeAmount()} onInput={(e) => props.setStakeAmount(e.currentTarget.value)} class="w-full bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-2xl font-bold text-white placeholder:text-gray-700 outline-none focus:border-blue-500/30 transition-all font-mono" />
                                                        <div class="absolute right-5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">VCN</div>
                                                    </div>
                                                </div>
                                                <div class="space-y-3">
                                                    <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block px-1">Choose Yield Tier</label>
                                                    <div class="grid grid-cols-3 gap-3">
                                                        {[
                                                            { d: 30, a: '4.5%', l: 'Flex' },
                                                            { d: 90, a: '8.2%', l: 'Std' },
                                                            { d: 180, a: '12.5%', l: 'Pro' }
                                                        ].map((o) => (
                                                            <button class="flex flex-col items-center gap-1 p-3 bg-white/[0.03] border border-white/[0.06] rounded-2xl hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
                                                                <div class="text-[10px] font-black text-gray-600 uppercase mb-1">{o.l}</div>
                                                                <div class="text-xs font-bold text-white uppercase">{o.d} Days</div>
                                                                <div class="text-[10px] font-black text-green-400">{o.a} APY</div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div class="p-5 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative overflow-hidden group">
                                                    <div class="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    <div class="flex items-center justify-between mb-1 relative z-10">
                                                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Est. Rewards</span>
                                                        <span class="text-lg font-bold text-green-400">
                                                            +{props.stakeAmount() ? (Number(props.stakeAmount()) * 0.125).toFixed(2) : '0.00'} VCN
                                                        </span>
                                                    </div>
                                                    <div class="text-[10px] text-gray-500 italic relative z-10">Rewards calculated based on Premium Tier (12.5% APY)</div>
                                                </div>

                                                <button
                                                    disabled={!props.stakeAmount() || Number(props.stakeAmount()) <= 0}
                                                    onClick={() => props.setFlowStep(2)}
                                                    class="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] uppercase tracking-widest text-sm"
                                                >
                                                    Review Stake
                                                </button>
                                            </div>
                                        </Show>
                                        <Show when={props.flowStep() === 2}>
                                            <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                <div class="flex flex-col items-center text-center py-4"><div class="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4"><TrendingUp class="w-8 h-8" /></div><h4 class="text-xl font-bold text-white">Confirm Staking</h4><p class="text-gray-500 text-sm mt-1">You are locking {props.stakeAmount()} VCN for 180 days</p></div>
                                                <div class="flex gap-3"><button onClick={() => props.setFlowStep(1)} class="flex-1 py-4 bg-white/5 text-gray-400 font-bold rounded-2xl transition-all">Back</button><button onClick={props.handleTransaction} disabled={props.flowLoading()} class="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"><Show when={props.flowLoading()} fallback="Confirm Stake"><RefreshCw class="w-4 h-4 animate-spin" />Staking...</Show></button></div>
                                            </div>
                                        </Show>
                                        <Show when={props.flowStep() === 3}>
                                            <div class="flex flex-col items-center py-8 text-center animate-in zoom-in-95 duration-500"><div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-6"><Check class="w-10 h-10 text-white" /></div><h4 class="text-2xl font-bold text-white mb-2">Staking Successful!</h4><button onClick={props.resetFlow} class="w-full py-4 bg-white text-black font-bold rounded-2xl">Done</button></div>
                                        </Show>
                                    </div>
                                </Match>

                                {/* SWAP FLOW */}
                                <Match when={props.activeFlow() === 'swap'}>
                                    <div class="space-y-4">
                                        <Show when={props.flowStep() === 1}>
                                            <div class="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                                <div class="relative">
                                                    {/* Pay Section */}
                                                    <div class="p-6 bg-white/[0.03] border border-white/[0.06] rounded-[24px]">
                                                        <div class="flex justify-between mb-4">
                                                            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">You Pay</span>
                                                            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Balance: {props.getAssetData(props.selectedToken()).liquidBalance.toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between">
                                                            <input
                                                                type="text"
                                                                placeholder="0.0"
                                                                value={props.swapAmount()}
                                                                onInput={(e) => props.setSwapAmount(e.currentTarget.value)}
                                                                class="bg-transparent border-none outline-none text-2xl font-bold text-white w-1/2 font-mono"
                                                            />
                                                            <div
                                                                onClick={() => props.setSelectedToken(props.selectedToken() === 'ETH' ? 'VCN' : 'ETH')}
                                                                class="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 cursor-pointer transition-all"
                                                            >
                                                                <div class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${props.getAssetData(props.selectedToken()).symbol === 'ETH' ? 'bg-indigo-500' : 'bg-blue-500'}`}>
                                                                    {props.getAssetData(props.selectedToken()).symbol.slice(0, 1)}
                                                                </div>
                                                                <span class="font-bold text-white text-sm">{props.selectedToken()}</span>
                                                                <ChevronDown class="w-4 h-4 text-gray-500" />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Switch Icon */}
                                                    <button
                                                        onClick={() => { const tmp = props.selectedToken(); props.setSelectedToken(props.toToken()); props.setToToken(tmp); }}
                                                        class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 z-10 w-10 h-10 rounded-xl bg-[#111113] border border-white/[0.08] flex items-center justify-center text-white shadow-xl hover:scale-110 active:scale-95 transition-all"
                                                    >
                                                        <RefreshCw class="w-5 h-5 text-purple-400" />
                                                    </button>

                                                    {/* Receive Section */}
                                                    <div class="p-6 bg-white/[0.03] border border-white/[0.06] rounded-[24px] mt-2">
                                                        <div class="flex justify-between mb-4">
                                                            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">You Receive</span>
                                                            <span class="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Balance: {props.getAssetData(props.toToken()).liquidBalance.toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex items-center justify-between">
                                                            <div class="text-2xl font-bold text-white font-mono">
                                                                {props.swapAmount() ? (Number(props.swapAmount()) * (props.selectedToken() === 'ETH' ? 850 : 0.0011)).toFixed(4) : '0.0'}
                                                            </div>
                                                            <div
                                                                onClick={() => props.setToToken(props.toToken() === 'USDC' ? 'VCN' : 'USDC')}
                                                                class="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 rounded-full border border-purple-500/20 hover:bg-purple-500/20 cursor-pointer transition-all"
                                                            >
                                                                <div class={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${props.getAssetData(props.toToken()).symbol === 'VCN' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                                                    {props.getAssetData(props.toToken()).symbol.slice(0, 1)}
                                                                </div>
                                                                <span class="font-bold text-white text-sm">{props.toToken()}</span>
                                                                <ChevronDown class="w-4 h-4 text-gray-500" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="px-2 py-2 flex items-center justify-between">
                                                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Exchange Rate</span>
                                                    <span class="text-[10px] font-black text-white font-mono uppercase tracking-widest">
                                                        1 {props.selectedToken()} ={props.selectedToken() === 'ETH' ? '850.42' : '0.0011'} {props.toToken()}
                                                    </span>
                                                </div>

                                                <button
                                                    disabled={!props.swapAmount() || Number(props.swapAmount()) <= 0}
                                                    onClick={() => props.setFlowStep(2)}
                                                    class="w-full py-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-500/20 active:scale-[0.98]"
                                                >
                                                    Review Swap
                                                </button>
                                            </div>
                                        </Show>

                                        {/* Step 2: Confirm Swap */}
                                        <Show when={props.flowStep() === 2}>
                                            <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                                <div class="grid grid-cols-2 gap-4">
                                                    <div class="p-4 bg-white/5 rounded-2xl border border-white/5">
                                                        <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Selling</div>
                                                        <div class="text-xl font-bold text-white">{props.swapAmount()} {props.selectedToken()}</div>
                                                    </div>
                                                    <div class="p-4 bg-purple-500/5 rounded-2xl border border-purple-500/10 text-right">
                                                        <div class="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Estimated Buy</div>
                                                        <div class="text-xl font-bold text-white">
                                                            {(Number(props.swapAmount()) * (props.selectedToken() === 'ETH' ? 850 : 0.0011)).toFixed(4)} {props.toToken()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div class="space-y-3">
                                                    <div class="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                                                        <span class="text-gray-500">Route</span>
                                                        <span class="text-white">Vision Router → Uniswap V3</span>
                                                    </div>
                                                    <div class="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                                                        <span class="text-gray-500">Price Impact</span>
                                                        <span class="text-green-400 font-black">&lt;0.01%</span>
                                                    </div>
                                                    <div class="flex justify-between text-[11px] font-bold uppercase tracking-widest">
                                                        <span class="text-gray-500">Slippage Tolerance</span>
                                                        <span class="text-white">0.5%</span>
                                                    </div>
                                                </div>

                                                <div class="flex gap-3">
                                                    <button
                                                        onClick={() => props.setFlowStep(1)}
                                                        class="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all"
                                                    >
                                                        Back
                                                    </button>
                                                    <button
                                                        onClick={props.handleTransaction}
                                                        disabled={props.flowLoading()}
                                                        class="flex-[2] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"
                                                    >
                                                        <Show when={props.flowLoading()} fallback="Confirm Swap">
                                                            <RefreshCw class="w-4 h-4 animate-spin" />
                                                            Swapping...
                                                        </Show>
                                                    </button>
                                                </div>
                                            </div>
                                        </Show>
                                        <Show when={props.flowStep() === 3}>
                                            <div class="flex flex-col items-center py-8 text-center animate-in zoom-in-95 duration-500"><div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl mb-6"><Check class="w-10 h-10 text-white" /></div><h4 class="text-2xl font-bold text-white mb-2">Swap Successful!</h4><button onClick={props.resetFlow} class="w-full py-4 bg-white text-black font-bold rounded-2xl">Done</button></div>
                                        </Show>
                                    </div>
                                </Match>

                                {/* RECEIVE FLOW */}
                                <Match when={props.activeFlow() === 'receive'}>
                                    <div class="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div>
                                            <label class="text-[11px] font-bold text-gray-500 uppercase tracking-widest block mb-4 text-center">Select Network</label>
                                            <div class="flex flex-wrap justify-center gap-2">
                                                <For each={['Vision Chain', 'Ethereum', 'Base']}>
                                                    {(net) => (
                                                        <button
                                                            onClick={() => setReceiveNetwork(net)}
                                                            class={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${receiveNetwork() === net ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/10'}`}
                                                        >
                                                            {net}
                                                        </button>
                                                    )}
                                                </For>
                                            </div>
                                        </div>

                                        <div class="relative group">
                                            <div class="absolute -inset-4 bg-green-500/10 rounded-[48px] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                            <div class="relative w-64 h-64 bg-white p-6 rounded-[40px] shadow-2xl flex flex-col items-center justify-center">
                                                <div class="relative w-full h-full p-2 bg-white rounded-2xl flex items-center justify-center">
                                                    <Show when={props.walletAddress()} fallback={<div class="w-full h-full bg-gray-100 animate-pulse rounded-xl" />}>
                                                        <img
                                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${props.walletAddress()}&margin=10&color=000000&bgcolor=FFFFFF`}
                                                            alt="Wallet QR Code"
                                                            class="w-full h-full"
                                                        />
                                                        {/* Central Logo Overlay */}
                                                        <div class="absolute inset-0 flex items-center justify-center">
                                                            <div class="w-12 h-12 bg-white rounded-xl shadow-lg border border-gray-100 flex items-center justify-center p-1.5">
                                                                <div class="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                                                                    <Sparkles class="w-5 h-5 text-white" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="w-full space-y-4">
                                            <div class="p-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl group cursor-pointer" onClick={async () => {
                                                const success = await props.copyToClipboard(props.walletAddress());
                                                if (success) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
                                            }}>
                                                <div class="flex items-center justify-between mb-2">
                                                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Your Private Address</span>
                                                    <button class="text-[10px] font-black text-green-400 uppercase tracking-widest hover:text-white transition-colors">
                                                        {copied() ? 'Copied!' : 'Copy'}
                                                    </button>
                                                </div>
                                                <div class="text-xs font-mono text-white break-all leading-relaxed">{props.walletAddress()}</div>
                                            </div>
                                            <p class="text-[10px] text-gray-500 text-center italic">Only send assets compatible with the selected network.</p>
                                        </div>
                                    </div>
                                </Match>

                                {/* MULTI FLOW (AI Batch) */}
                                <Match when={props.activeFlow() === 'multi'}>
                                    <div class="space-y-4">
                                        <Show when={props.flowStep() === 1}>
                                            <div class="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div class="p-6 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 rounded-3xl relative overflow-hidden">
                                                    <div class="absolute top-0 right-0 p-4 opacity-10">
                                                        <Layers class="w-16 h-16" />
                                                    </div>
                                                    <h4 class="text-xl font-bold text-white mb-1">Batch Execution Plan</h4>
                                                    <p class="text-xs text-blue-400 font-medium">Vision AI has orchestrated {props.multiTransactions().length} actions for you.</p>
                                                </div>

                                                <div class="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                                    <For each={props.multiTransactions()}>
                                                        {(tx, i) => (
                                                            <div class="p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-between group hover:bg-white/[0.05] transition-all">
                                                                <div class="flex items-center gap-3">
                                                                    <div class={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.intent === 'send' ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                                                        {tx.intent === 'send' ? <ArrowUpRight class="w-5 h-5" /> : <Clock class="w-5 h-5" />}
                                                                    </div>
                                                                    <div>
                                                                        <div class="text-sm font-bold text-white uppercase tracking-tight">
                                                                            {tx.intent === 'send' ? 'Immediate Transfer' : 'Scheduled Transfer'}
                                                                        </div>
                                                                        <div class="text-[10px] font-medium text-gray-500 truncate max-w-[150px]">
                                                                            To: {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div class="text-right">
                                                                    <div class="text-sm font-black text-white">{tx.amount} {tx.symbol || 'VCN'}</div>
                                                                    <Show when={tx.intent === 'schedule'}>
                                                                        <div class="text-[10px] text-amber-500 font-bold">Time-locked</div>
                                                                    </Show>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </For>
                                                </div>

                                                <div class="pt-4 space-y-3">
                                                    <div class="flex justify-between items-center px-2">
                                                        <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Batch Value</span>
                                                        <span class="text-lg font-black text-white">
                                                            {props.multiTransactions().reduce((acc, tx) => acc + parseFloat(tx.amount || '0'), 0).toLocaleString()} VCN
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={props.handleTransaction}
                                                        class="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] uppercase tracking-widest text-sm"
                                                    >
                                                        Authorize All Transactions
                                                    </button>
                                                    <p class="text-[10px] text-center text-gray-600 font-medium">Authorizing this batch will process all transactions sequentially.</p>
                                                </div>
                                            </div>
                                        </Show>

                                        <Show when={props.flowStep() === 3}>
                                            <div class="flex flex-col items-center py-8 text-center animate-in zoom-in-95 duration-500">
                                                <div class="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30 mb-6">
                                                    <Check class="w-10 h-10 text-white" />
                                                </div>
                                                <h4 class="text-2xl font-bold text-white mb-2">Batch Processed!</h4>
                                                <p class="text-gray-500 mb-8 max-w-xs leading-relaxed text-sm">
                                                    All transactions in the batch have been processed. You can review each in your activity history.
                                                </p>
                                                <button
                                                    onClick={props.resetFlow}
                                                    class="w-full py-4 bg-white text-black font-bold rounded-2xl transition-all hover:bg-white/90"
                                                >
                                                    Done
                                                </button>
                                            </div>
                                        </Show>
                                    </div>
                                </Match>
                            </Switch>
                        </div>
                    </div>
                </Motion.div>
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
        </Show>
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
                        <Plus class="w-8 h-8" />
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
