import { createSignal, Show, For, createEffect } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import ChatQueueLine from '../chat/queue/ChatQueueLine';
import AgentChip from '../chat/queue/AgentChip';
import QueueDrawer from '../chat/queue/QueueDrawer';
import {
    Sparkles,
    User,
    Send,
    ArrowUpRight,
    ArrowDownLeft,
    RefreshCw,
    TrendingUp,
    ChevronRight,
    Copy,
    UserPlus,
    Zap,
    Plus,
    Mic,
    Paperclip,
    Clock,
    BookOpen,
    Trash2,
    MessageSquare,
    ChevronDown,
    FileText,
    FileSpreadsheet,
    Bot,
    GripHorizontal,
    Search,
    ChevronLeft,
    ShieldCheck,
    Check,
    Square,
    Layers,
    Lock
} from 'lucide-solid';

interface WalletDashboardProps {
    messages: () => any[];
    isLoading: () => boolean;
    input: () => string;
    setInput: (val: string) => void;
    handleSend: () => void;
    onStop?: () => void;
    setActiveView: (view: any) => void;
    setActiveFlow: (flow: any) => void;
    totalValueStr: () => string;
    getAssetData: (symbol: string) => any;
    userProfile: () => any;
    onboardingStep: () => number;
    networkMode: 'mainnet' | 'testnet';
    history: () => any[];
    currentSessionId: () => string | null;
    onSelectConversation: (conv: any) => void;
    onNewChat: () => void;
    onDeleteConversation: (id: string) => void;

    // Advanced Features
    attachments: () => any[];
    removeAttachment: (index: number) => void;
    handleFileSelect: (e: Event) => void;
    thinkingSteps: () => any[];
    voiceLang: () => string;
    setVoiceLang: (lang: string) => void;
    toggleRecording: () => void;
    isRecording: () => boolean;

    // Queue Integration
    queueTasks: () => any[];
    onCancelTask: (taskId: string) => void;
    onForceExecute?: (taskId: string) => void;
    isScheduling: boolean;

    // Sidebar Control
    chatHistoryOpen: boolean;
    setChatHistoryOpen: (val: boolean) => void;
    batchAgents: () => any[];
    reviewMulti: () => any[] | null;
    setReviewMulti: (val: any[] | null) => void;
    onStartBatch: (txs: any[]) => void;
}

const TypingIndicator = () => (
    <Motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        class="flex gap-4 items-start"
    >
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-400/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
            <Bot class="w-4 h-4 text-blue-400" />
        </div>
        <div class="bg-white/[0.03] border border-white/[0.06] px-5 py-4 rounded-2xl rounded-tl-sm flex items-center gap-1.5 min-w-[60px]">
            <span class="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
            <span class="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce" style={{ "animation-delay": "0.15s" }} />
            <span class="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce" style={{ "animation-delay": "0.3s" }} />
        </div>
    </Motion.div>
);

const ThinkingDisplay = (props: { steps: any[] }) => {
    const [isExpanded, setIsExpanded] = createSignal(false);

    // Auto-expand if error occurs
    createEffect(() => {
        if (props.steps.some(s => s.status === 'error')) {
            setIsExpanded(true);
        }
    });

    return (
        <div class="max-w-3xl mx-auto px-6 mb-6 w-full z-20 relative">
            <Motion.div
                class="bg-[#0d0d0f]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300"
            >
                {/* Header / Summary View */}
                <div
                    class="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                    onClick={() => setIsExpanded(!isExpanded())}
                >
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                            <Bot class="w-4 h-4 text-purple-400 animate-pulse" />
                        </div>
                        <div class="flex flex-col">
                            <div class="flex items-center gap-2">
                                <span class="text-[13px] font-bold text-gray-100">AI Architect Thinking</span>
                                <div class="flex gap-0.5 items-end h-3 pb-0.5">
                                    <span class="w-0.5 h-0.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
                                    <span class="w-0.5 h-0.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0.15s" }} />
                                    <span class="w-0.5 h-0.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0.3s" }} />
                                </div>
                            </div>
                            <span class="text-[10px] text-gray-500 font-medium truncate max-w-[200px]">
                                {props.steps[props.steps.length - 1]?.label || "Processing..."}
                            </span>
                        </div>
                    </div>

                    <button class="text-gray-500 hover:text-white transition-colors p-1">
                        <ChevronDown class={`w-4 h-4 transition-transform duration-300 ${isExpanded() ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Expanded Details */}
                <Show when={isExpanded()}>
                    <div class="border-t border-white/5 bg-black/20 p-4 space-y-3">
                        <For each={props.steps}>
                            {(step) => (
                                <div class="flex items-start gap-3 group animate-in fade-in slide-in-from-top-1 duration-300">
                                    <div class="mt-1 relative">
                                        <Show when={step.status === 'loading'} fallback={
                                            <div class={`w-2 h-2 rounded-full ${step.status === 'completed' ? 'bg-green-500' : 'bg-red-500'}`} />
                                        }>
                                            <div class="w-2 h-2 bg-purple-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                                        </Show>
                                        <Show when={step.status === 'completed'}>
                                            <div class="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-20" />
                                        </Show>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-[12px] font-bold text-gray-300">{step.label}</div>
                                        <Show when={step.detail}>
                                            <div class="text-[10px] text-gray-500 mt-0.5 truncate">{step.detail}</div>
                                        </Show>
                                    </div>
                                    <Show when={step.status === 'completed'}>
                                        <Check class="w-3 h-3 text-green-500/50" />
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </Show>
            </Motion.div>
        </div>
    );
};

const MultiReviewCard = (props: {
    transactions: any[],
    onApprove: () => void,
    onCancel: () => void,
    onViewDetail: () => void
}) => {
    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            class="mt-4 bg-[#0d0d0f]/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl w-full max-w-md"
        >
            <div class="p-4 border-b border-white/5 bg-gradient-to-r from-blue-500/10 to-transparent">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <Layers class="w-4 h-4 text-blue-400" />
                        <span class="text-[11px] font-black text-white uppercase tracking-widest">Batch Review</span>
                    </div>
                    <span class="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                        {props.transactions.length} ITEMS
                    </span>
                </div>
            </div>

            <div class="p-4 space-y-3 max-h-[320px] overflow-y-auto scrollbar-hide">
                <For each={props.transactions.slice(0, 10)}>
                    {(tx) => (
                        <div class="flex items-center justify-between group">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center border border-white/5 group-hover:border-blue-500/30 transition-colors">
                                    <User class="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[12px] font-bold text-gray-200">{tx.vid || 'New Recipient'}</span>
                                    <span class="text-[10px] text-gray-500 font-mono italic">
                                        {tx.recipient.slice(0, 6)}...{tx.recipient.slice(-4)}
                                    </span>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-[12px] font-black text-white">{tx.amount}</div>
                                <div class="text-[9px] font-bold text-gray-500 uppercase">{tx.symbol || 'VCN'}</div>
                            </div>
                        </div>
                    )}
                </For>

                <Show when={props.transactions.length > 10}>
                    <button
                        onClick={props.onViewDetail}
                        class="w-full py-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl border border-white/5 text-[10px] font-black text-blue-400 uppercase tracking-widest transition-all"
                    >
                        + {props.transactions.length - 10} More Items (View Full List)
                    </button>
                </Show>
            </div>

            <div class="p-3 bg-black/40 border-t border-white/5 flex gap-2">
                <button
                    onClick={props.onCancel}
                    class="flex-1 py-2 rounded-xl text-[11px] font-black text-gray-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                    Cancel
                </button>
                <button
                    onClick={props.onApprove}
                    class="flex-[2] py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-[11px] font-black text-white shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest"
                >
                    Start Batch Transfer
                </button>
            </div>
        </Motion.div>
    );
};

const MultiBatchDrawer = (props: {
    isOpen: boolean,
    onClose: () => void,
    transactions: any[],
    onApprove: () => void
}) => {
    return (
        <Presence>
            <Show when={props.isOpen}>
                <div class="fixed inset-0 z-[100] flex items-end justify-center">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={props.onClose}
                        class="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <Motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ duration: 0.5, easing: [0.16, 1, 0.3, 1] }}
                        class="relative w-full max-w-4xl h-[85vh] bg-[#0d0d0f] border-t border-white/10 rounded-t-[40px] shadow-3xl flex flex-col overflow-hidden"
                    >
                        <div class="p-8 flex items-center justify-between border-b border-white/5 bg-gradient-to-br from-blue-500/5 to-transparent">
                            <div>
                                <h2 class="text-2xl font-black text-white mb-1">Detailed Batch List</h2>
                                <p class="text-gray-500 text-sm font-medium italic">Review all {props.transactions.length} items for precision</p>
                            </div>
                            <button
                                onClick={props.onClose}
                                class="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
                            >
                                <Plus class="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div class="flex-1 overflow-y-auto p-8 scrollbar-hide">
                            <table class="w-full text-left">
                                <thead>
                                    <tr class="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">
                                        <th class="pb-4 pl-2">#</th>
                                        <th class="pb-4">Recipient (VID)</th>
                                        <th class="pb-4">Wallet Address</th>
                                        <th class="pb-4 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-white/[0.03]">
                                    <For each={props.transactions}>
                                        {(tx, i) => (
                                            <tr class="group hover:bg-white/[0.01] transition-colors">
                                                <td class="py-4 pl-2 text-xs font-mono text-gray-600 italic">{(i() + 1).toString().padStart(2, '0')}</td>
                                                <td class="py-4">
                                                    <div class="flex items-center gap-2">
                                                        <div class="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                                                            <User class="w-3 h-3 text-blue-400" />
                                                        </div>
                                                        <span class="text-xs font-bold text-gray-200">{tx.vid || 'External'}</span>
                                                    </div>
                                                </td>
                                                <td class="py-4 text-xs font-mono text-gray-500">{tx.recipient}</td>
                                                <td class="py-4 text-right">
                                                    <span class="text-xs font-black text-white">{tx.amount}</span>
                                                    <span class="text-[9px] font-bold text-gray-500 ml-1 uppercase">{tx.symbol || 'VCN'}</span>
                                                </td>
                                            </tr>
                                        )}
                                    </For>
                                </tbody>
                            </table>
                        </div>

                        <div class="p-8 bg-black/40 border-t border-white/5 flex gap-4">
                            <button
                                onClick={props.onClose}
                                class="flex-1 py-4 rounded-2xl border border-white/10 text-[13px] font-black text-gray-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                            >
                                Continue Editing
                            </button>
                            <button
                                onClick={props.onApprove}
                                class="flex-[2] py-4 bg-blue-500 hover:bg-blue-600 rounded-2xl text-[13px] font-black text-white shadow-2xl shadow-blue-500/20 transition-all uppercase tracking-widest"
                            >
                                Confirm & Execute Batch
                            </button>
                        </div>
                    </Motion.div>
                </div>
            </Show>
        </Presence>
    );
};

export const WalletDashboard = (props: WalletDashboardProps) => {
    const [isComposing, setIsComposing] = createSignal(false);
    const [isQueueDrawerOpen, setIsQueueDrawerOpen] = createSignal(false);
    const [isBatchDrawerOpen, setIsBatchDrawerOpen] = createSignal(false);
    const [selectedTaskId, setSelectedTaskId] = createSignal<string | null>(null);
    let fileInputRef: HTMLInputElement | undefined;
    let messagesContainerRef: HTMLDivElement | undefined;

    const LANGUAGES = [
        { code: 'en-US', label: 'English' }
    ];

    // --- Auto-scroll Logic ---
    createEffect(() => {
        // Dependencies: Anytime messages, thinking steps, or loading state changes
        const msgs = props.messages();
        const steps = props.thinkingSteps();
        const loading = props.isLoading();

        if (messagesContainerRef) {
            // Use requestAnimationFrame to ensure the scroll happens after the browser has painted the new elements
            requestAnimationFrame(() => {
                messagesContainerRef?.scrollTo({
                    top: messagesContainerRef.scrollHeight,
                    behavior: 'smooth'
                });
            });
        }
    });

    return (
        <div class="flex-1 flex overflow-hidden relative bg-[#070708]">
            {/* Left Sidebar & Toggle Removed - Moved to Right Sidebar */}

            {/* Main Chat Area */}
            <div class="flex-1 flex flex-col overflow-hidden relative">


                <QueueDrawer
                    isOpen={isQueueDrawerOpen()}
                    onClose={() => setIsQueueDrawerOpen(false)}
                    tasks={props.queueTasks()}
                    focusedTaskId={selectedTaskId()}
                    onCancelTask={props.onCancelTask}
                    onForceExecute={props.onForceExecute}
                />

                <MultiBatchDrawer
                    isOpen={isBatchDrawerOpen()}
                    onClose={() => setIsBatchDrawerOpen(false)}
                    transactions={props.reviewMulti() || []}
                    onApprove={() => {
                        props.onStartBatch(props.reviewMulti() || []);
                    }}
                />

                {/* Top Queue Monitor: unified view for all background agents */}
                <div class="absolute top-4 left-0 right-0 z-[40] pointer-events-none px-6">
                    <div class="max-w-4xl mx-auto flex flex-col items-end gap-3 pointer-events-auto">
                        <For each={props.batchAgents()}>
                            {(agent) => (
                                <AgentChip
                                    task={{
                                        id: agent.id,
                                        type: 'BATCH',
                                        summary: `${agent.successCount + agent.failedCount}/${agent.totalCount} Transactions`,
                                        status: (agent.status === 'EXECUTING' || agent.status === 'executing') ? 'EXECUTING' : 'SENT',
                                        timestamp: agent.startTime,
                                        progress: ((agent.successCount + agent.failedCount) / agent.totalCount) * 100
                                    }}
                                    onClick={() => {
                                        // Potential: Show details modal for this batch
                                    }}
                                />
                            )}
                        </For>
                    </div>
                </div>

                {/* Messages Area */}
                <div
                    ref={(el) => messagesContainerRef = el}
                    class="flex-1 overflow-y-auto bg-[#070708] scrollbar-hide scroll-smooth"
                >
                    <Show when={props.messages().length === 0}>
                        <div class="flex flex-col items-center justify-start px-6 md:px-20 py-12 md:py-24">
                            <Motion.div
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, easing: [0.22, 1, 0.36, 1] }}
                                class="w-full max-w-5xl text-center"
                            >
                                <div class="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8">
                                    <Sparkles class="w-4 h-4 text-blue-400 animate-pulse" />
                                    <span class="text-[11px] font-black text-blue-400 uppercase tracking-[0.25em]">Vision Architect v0.8</span>
                                </div>
                                <h1 class="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
                                    Ready to <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">Transform</span> your assets?
                                </h1>
                                <p class="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto mb-16 leading-relaxed">
                                    AI-powered orchestration for on-chain assets. Seamless, secure, and intelligent.
                                </p>

                                {/* Quick Actions Bento */}
                                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto overflow-visible">
                                    <div
                                        onClick={() => props.setActiveFlow('send')}
                                        class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-[28px] hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition-all group cursor-pointer"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <ArrowUpRight class="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div class="text-sm font-bold text-white mb-1">Send</div>
                                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-black">Transfer Assets</div>
                                    </div>
                                    <div
                                        onClick={() => props.setActiveFlow('swap')}
                                        class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-[28px] hover:border-purple-500/40 hover:bg-purple-500/[0.02] transition-all group cursor-pointer"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <RefreshCw class="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div class="text-sm font-bold text-white mb-1">Swap</div>
                                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-black">Exchange Tokens</div>
                                    </div>
                                    <div
                                        onClick={() => props.setActiveView('nodes')}
                                        class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-[28px] hover:border-emerald-500/40 hover:bg-emerald-500/[0.02] transition-all group cursor-pointer"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <Zap class="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div class="text-sm font-bold text-white mb-1">Nodes</div>
                                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-black">Stake & Reward</div>
                                    </div>
                                    <div
                                        onClick={() => props.setActiveView('mint')}
                                        class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-[28px] hover:border-cyan-500/40 hover:bg-cyan-500/[0.02] transition-all group cursor-pointer"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <FileText class="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <div class="text-sm font-bold text-white mb-1">Mint</div>
                                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-black">Generate NFTs</div>
                                    </div>
                                    <div
                                        onClick={() => props.setActiveView('referral')}
                                        class="p-6 bg-white/[0.02] border border-white/[0.06] rounded-[28px] hover:border-blue-500/40 hover:bg-blue-500/[0.02] transition-all group cursor-pointer"
                                    >
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <UserPlus class="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div class="text-sm font-bold text-white mb-1">Referral</div>
                                        <div class="text-[10px] text-gray-500 uppercase tracking-widest font-black">Earn Rewards</div>
                                    </div>
                                </div>
                            </Motion.div>
                        </div>
                    </Show>

                    <Show when={props.messages().length > 0}>
                        <div class="max-w-3xl mx-auto px-4 md:px-6 pt-16 md:pt-32 pb-64 space-y-8 md:space-y-12">
                            <For each={props.messages()}>
                                {(msg) => (
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ duration: 0.4 }}
                                        class={`flex gap-5 ${msg.role === 'user' ? 'justify-end' : ''}`}
                                    >
                                        <Show when={msg.role === 'assistant'}>
                                            <div class="w-10 h-10 rounded-2xl bg-[#0d0d0f] border border-white/5 flex items-center justify-center flex-shrink-0 shadow-2xl mt-1">
                                                <div class="w-5 h-5 text-blue-400">
                                                    <Sparkles class="w-full h-full" />
                                                </div>
                                            </div>
                                        </Show>
                                        <div class={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                                            <div class={`px-6 py-4 rounded-[24px] text-[16px] leading-[1.6] transition-all ${msg.role === 'user'
                                                ? 'bg-[#007AFF] text-white rounded-tr-sm shadow-[0_10px_30px_-5px_rgba(0,122,255,0.3)]'
                                                : 'bg-[#18181b]/50 backdrop-blur-3xl text-gray-100 border border-white/[0.08] rounded-tl-sm'
                                                }`}>
                                                {msg.content.split('[RECOMMENDED_QUESTIONS]')[0]}
                                            </div>

                                            <Show when={msg.role === 'assistant' && msg.content.includes('[RECOMMENDED_QUESTIONS]')}>
                                                <div class="flex flex-wrap gap-2 mt-3 px-1 animate-in fade-in slide-in-from-top-2 duration-500 delay-300">
                                                    <For each={msg.content.split('[RECOMMENDED_QUESTIONS]')[1].split('|')}>
                                                        {(q) => (
                                                            <button
                                                                onClick={() => {
                                                                    props.setInput(q.trim());
                                                                    props.handleSend();
                                                                }}
                                                                class="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[11px] font-bold text-gray-400 hover:text-blue-400 hover:border-blue-500/30 transition-all active:scale-95"
                                                            >
                                                                {q.trim()}
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </Show>

                                            {/* Specialized Multi-Transaction Review UI */}
                                            <Show when={msg.role === 'assistant' && msg.isMultiReview && msg.batchData}>
                                                <MultiReviewCard
                                                    transactions={msg.batchData}
                                                    onApprove={() => {
                                                        props.onStartBatch(msg.batchData);
                                                        props.setReviewMulti(null);
                                                    }}
                                                    onCancel={() => props.setReviewMulti(null)}
                                                    onViewDetail={() => {
                                                        props.setReviewMulti(msg.batchData);
                                                        setIsBatchDrawerOpen(true);
                                                    }}
                                                />
                                            </Show>
                                        </div>
                                        <Show when={msg.role === 'user'}>
                                            <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-white/[0.05] flex items-center justify-center flex-shrink-0 mt-1 shadow-xl">
                                                <User class="w-5 h-5 text-gray-400" />
                                            </div>
                                        </Show>
                                    </Motion.div>
                                )}
                            </For>

                            <Show when={props.thinkingSteps().length > 0}>
                                <ThinkingDisplay steps={props.thinkingSteps()} />
                            </Show>

                            <Show when={props.isLoading()}>
                                <TypingIndicator />
                            </Show>
                        </div>
                    </Show>
                </div>

                {/* Modern Floating Input Area */}
                <div class="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#070708] via-[#070708]/95 to-transparent pt-32 z-30 pointer-events-none">
                    <div class="max-w-4xl mx-auto pointer-events-auto">
                        <Presence>
                            {/* Active Queue Bar (Time-lock Agent) - Above Input */}
                            <Show when={props.queueTasks().length > 0}>
                                <div class="px-2 mb-2">
                                    <ChatQueueLine
                                        tasks={props.queueTasks()}
                                        isCompact={true}
                                        onTaskClick={(id) => {
                                            setSelectedTaskId(id);
                                            setIsQueueDrawerOpen(true);
                                        }}
                                        onOpenHistory={() => setIsQueueDrawerOpen(true)}
                                    />
                                </div>
                            </Show>

                            <Show when={props.attachments().length > 0}>
                                <Motion.div
                                    initial={{ opacity: 0, y: 10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    class="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-2"
                                >
                                    <For each={props.attachments()}>
                                        {(att, i) => (
                                            <div class="relative w-20 h-20 rounded-2xl border border-white/[0.08] bg-[#0d0d0f] flex-shrink-0 group overflow-hidden shadow-2xl">
                                                <Show when={att.type === 'image'} fallback={
                                                    <div class="w-full h-full flex flex-col items-center justify-center gap-1 text-gray-600">
                                                        <Show when={att.type === 'pdf'} fallback={<FileSpreadsheet class="w-7 h-7 text-green-600" />}>
                                                            <FileText class="w-7 h-7 text-red-600" />
                                                        </Show>
                                                        <span class="text-[9px] font-bold uppercase tracking-wider">{att.type}</span>
                                                    </div>
                                                }>
                                                    <img src={att.preview} class="w-full h-full object-cover" />
                                                </Show>
                                                <button
                                                    onClick={() => props.removeAttachment(i())}
                                                    class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                                                >
                                                    <Trash2 class="w-5 h-5 text-red-400" />
                                                </button>
                                            </div>
                                        )}
                                    </For>
                                </Motion.div>
                            </Show>
                        </Presence>

                        <div class="relative group">
                            {/* Agent Activated Glow Effect */}
                            <div class={`absolute -inset-[3px] rounded-[30px] blur-2xl transition-all duration-700 ${props.isScheduling
                                ? 'bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600 opacity-60'
                                : 'bg-gradient-to-r from-blue-600 via-cyan-400 to-purple-600 opacity-20 group-focus-within:opacity-50'}`}
                            />
                            <div class="absolute -inset-[1px] bg-gradient-to-r from-white/[0.08] to-transparent rounded-[26px] blur-sm opacity-50 group-focus-within:opacity-100 transition-opacity" />

                            <div class="relative bg-[#0d0d0f]/90 backdrop-blur-3xl border border-white/10 rounded-[28px] p-2 flex flex-col md:flex-row items-stretch md:items-end gap-2 group-focus-within:bg-[#0d0d0f] transition-all duration-500 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)]">
                                {/* Text area - Top on mobile, Center on desktop */}
                                <div class="flex-1 px-1 border border-[#1d1d1f] rounded-xl self-stretch my-1 order-1 md:order-2">
                                    <textarea
                                        class="w-full bg-transparent text-white text-[16px] py-3.5 px-3 outline-none resize-none placeholder:text-gray-600 min-h-[48px] max-h-[220px] font-medium leading-relaxed scrollbar-hide"
                                        placeholder={props.isRecording() ? "Listening..." : "Tell Vision AI what to do..."}
                                        rows={1}
                                        value={props.input()}
                                        onCompositionStart={() => setIsComposing(true)}
                                        onCompositionEnd={() => {
                                            setTimeout(() => setIsComposing(false), 10);
                                        }}
                                        onInput={(e) => {
                                            props.setInput(e.currentTarget.value);
                                            e.currentTarget.style.height = 'auto';
                                            e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 220) + 'px';
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.isComposing || isComposing() || e.keyCode === 229) return;
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                props.handleSend();
                                            }
                                        }}
                                    />
                                </div>

                                {/* Bottom controls for mobile / side for desktop */}
                                <div class="flex items-center justify-between md:justify-end gap-1.5 pb-0.5 pr-1.5 order-2 md:order-3">
                                    <div class="flex items-center gap-1.5">
                                        {/* Tools / Plus Button */}
                                        <button
                                            onClick={() => fileInputRef?.click()}
                                            class="w-11 h-11 flex items-center justify-center rounded-2xl text-gray-500 hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
                                        >
                                            <Plus class="w-5 h-5" />
                                        </button>
                                        <input
                                            type="file"
                                            multiple
                                            ref={fileInputRef}
                                            class="hidden"
                                            onChange={props.handleFileSelect}
                                        />

                                        {/* Language Selection Popover */}
                                        <div class="relative group/lang">
                                            <button class="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black text-gray-500 hover:text-white transition-all uppercase tracking-widest">
                                                <span>{props.voiceLang().split('-')[0]}</span>
                                                <ChevronDown class="w-3 h-3" />
                                            </button>
                                            <div class="absolute bottom-full right-0 mb-2 pb-2 w-32 bg-transparent hidden group-hover/lang:block z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                <div class="bg-[#121214] border border-white/10 rounded-2xl shadow-3xl overflow-hidden">
                                                    <For each={LANGUAGES}>
                                                        {(lang) => (
                                                            <button
                                                                onClick={() => props.setVoiceLang(lang.code)}
                                                                class={`w-full text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-white/5 transition-colors ${props.voiceLang() === lang.code ? 'text-blue-400' : 'text-gray-500'}`}
                                                            >
                                                                {lang.label}
                                                            </button>
                                                        )}
                                                    </For>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Voice Button */}
                                        <button
                                            onClick={props.toggleRecording}
                                            class={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${props.isRecording() ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                        >
                                            <Mic class="w-5 h-5" />
                                        </button>
                                    </div>

                                    {/* Send/Stop Button */}
                                    <button
                                        onClick={() => {
                                            if (props.isLoading()) {
                                                props.onStop?.();
                                            } else {
                                                props.handleSend();
                                            }
                                        }}
                                        disabled={!props.isLoading() && (!props.input().trim() && props.attachments().length === 0)}
                                        class={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 ${props.isLoading()
                                            ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-100' // Stop state
                                            : (!props.input().trim() && props.attachments().length === 0)
                                                ? 'bg-white/5 text-white/5 grayscale cursor-not-allowed'
                                                : 'bg-[#007AFF] text-white shadow-[0_10px_30px_-5px_rgba(0,122,255,0.4)] hover:scale-105 active:scale-95'
                                            }`}
                                    >
                                        <Show when={props.isLoading()} fallback={<Send class="w-5 h-5" />}>
                                            <Square class="w-4 h-4 fill-current animate-in fade-in zoom-in duration-200" />
                                        </Show>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div class="mt-4 flex items-center justify-between px-6 opacity-30">
                            <div class="flex items-center gap-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span class="text-[9px] font-black text-white uppercase tracking-[0.3em]">Neural Interface Active</span>
                            </div>
                            <span class="text-[9px] font-bold text-gray-500 italic uppercase">Secure End-to-End Orchestration</span>
                        </div>
                    </div>
                </div>
            </div >

            {/* Right Sidebar - Portfolio & Analytics (Always Fixed for Wallet context) */}
            < div class="w-[320px] h-full border-l border-white/[0.04] bg-[#0c0c0e]/40 backdrop-blur-3xl overflow-y-auto hidden xl:block scrollbar-hide" >
                <div class="p-8 space-y-10">
                    {/* Chat History Section (Moved from Left Sidebar) */}
                    <div class="h-[45vh] min-h-[400px] flex flex-col bg-white/[0.02] border border-white/[0.04] rounded-[30px] overflow-hidden shrink-0">
                        <div class="p-5 flex items-center justify-between border-b border-white/[0.04] shrink-0">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                    <Clock class="w-4 h-4 text-purple-400" />
                                </div>
                                <span class="text-[11px] font-black text-white uppercase tracking-[0.2em]">History</span>
                            </div>
                            <button
                                onClick={() => props.onNewChat()}
                                class="p-2 hover:bg-white/5 rounded-xl transition-all text-purple-400 hover:text-white"
                            >
                                <Plus class="w-4 h-4" />
                            </button>
                        </div>

                        <div class="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
                            <Show when={props.history().length === 0}>
                                <div class="py-8 text-center text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                    No sessions yet
                                </div>
                            </Show>
                            <For each={props.history()}>
                                {(conv) => (
                                    <div class="group relative">
                                        <button
                                            onClick={() => props.onSelectConversation(conv)}
                                            class={`w-full p-3 rounded-xl text-left transition-all border group-hover:scale-[1.02] active:scale-[0.98] ${props.currentSessionId() === conv.id
                                                ? 'bg-purple-600/10 border-purple-500/30'
                                                : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.05]'
                                                }`}
                                        >
                                            <div class="flex flex-col gap-1">
                                                <span class={`text-[12px] font-bold truncate pr-6 ${props.currentSessionId() === conv.id ? 'text-purple-400' : 'text-gray-100'}`}>
                                                    {conv.messages[0]?.text || 'New Chat'}
                                                </span>
                                                <div class="flex items-center gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                    <span>{new Date(conv.updatedAt || conv.createdAt).toLocaleDateString()}</span>
                                                    <span class="w-1 h-1 rounded-full bg-gray-700" />
                                                    <span>{conv.messages.length} msgs</span>
                                                </div>
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                props.onDeleteConversation(conv.id);
                                            }}
                                            class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all bg-[#0c0c0e]/90"
                                        >
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Staking / Rewards (Mirrored from Sidebar logic) */}
                    <div class="space-y-6">
                        <span class="text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Active Rewards</span>
                        <div class="space-y-4">
                            <div
                                onClick={() => props.setActiveView('nodes')}
                                class="p-5 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-[28px] hover:border-blue-500/40 transition-all cursor-pointer group"
                            >
                                <div class="flex items-center justify-between mb-4">
                                    <div class="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                                        <Zap class="w-4 h-4" />
                                    </div>
                                    <ChevronRight class="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-all" />
                                </div>
                                <div class="text-[18px] font-bold text-white mb-1">12.5% VCN Yield</div>
                                <p class="text-[12px] text-gray-500 leading-relaxed">Validator nodes are currently operational with 100% uptime.</p>
                            </div>

                            <div
                                onClick={() => props.setActiveView('campaign')}
                                class="p-5 bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20 rounded-[28px] hover:border-purple-500/40 transition-all cursor-pointer group"
                            >
                                <div class="flex items-center justify-between mb-4">
                                    <div class="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                                        <Sparkles class="w-4 h-4" />
                                    </div>
                                    <ChevronRight class="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-all" />
                                </div>
                                <div class="text-[18px] font-bold text-white mb-1">Season 1 Airdrop</div>
                                <p class="text-[12px] text-gray-500 leading-relaxed">Early contributor multipliers active. Claim rewards soon.</p>
                            </div>
                        </div>
                    </div>

                    {/* Identity Info */}
                    <div class="p-6 bg-white/[0.02] border border-white/[0.04] rounded-[30px] space-y-4">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <ShieldCheck class="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <div class="text-[11px] font-black text-white uppercase tracking-widest">KYC Level 1</div>
                                <div class="text-[10px] text-gray-500 font-bold uppercase">Basic Account</div>
                            </div>
                        </div>
                        <div class="h-px bg-white/[0.04] w-full" />
                        <div class="text-[10px] text-gray-500 leading-loose">
                            Your identity is verified on the Vision Chain network. Tier 2 verification unlocks increased limits.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
