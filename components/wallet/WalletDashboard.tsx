import { createSignal, Show, For, createEffect, createMemo, onMount, onCleanup, lazy, Suspense } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { marked } from 'marked';
import { parseChartBlocks } from './VisionChart';
const VisionChart = lazy(() => import('./VisionChart').then(m => ({ default: m.VisionChart })));
import ChatQueueLine from '../chat/queue/ChatQueueLine';
import AgentChip from '../chat/queue/AgentChip';
import QueueDrawer from '../chat/queue/QueueDrawer';
import { getQuickActions, QuickAction } from '../../services/firebaseService';
import {
    Sparkles,
    User,
    Send,
    ArrowUpRight,
    ArrowDownLeft,
    Download,
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
    ChevronUp,
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
    Lock,
    AlertTriangle,
    List,
    History,
    X
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
    streamingContent: () => string;
    voiceLang: () => string;
    setVoiceLang: (lang: string) => void;
    toggleRecording: () => void;
    isRecording: () => boolean;

    // Queue Integration
    queueTasks: () => any[];
    onCancelTask: (taskId: string) => void;
    onDismissTask?: (taskId: string) => void;
    onForceExecute?: (taskId: string) => void;
    isScheduling: boolean;

    // Sidebar Control
    chatHistoryOpen: boolean;
    setChatHistoryOpen: (val: boolean) => void;
    batchAgents: () => any[];
    reviewMulti: () => any[] | null;
    setReviewMulti: (val: any[] | null) => void;
    onStartBatch: (txs: any[], interval?: number) => void;
    unreadCount: number;
    contacts: () => any[];
    showResponseTime?: boolean;
}

const TypingIndicator = () => (
    <Motion.div
        initial={{ opacity: 0, scale: 0.98, y: 5 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        class="flex flex-col md:flex-row gap-2 md:gap-5 items-start mt-4"
    >
        {/* Helper Icon (Matches Assistant Icon Layout) */}
        <div class="w-10 h-10 rounded-2xl bg-[#0d0d0f] border border-white/5 flex items-center justify-center flex-shrink-0 shadow-2xl mt-1">
            <Bot class="w-5 h-5 text-blue-400" />
        </div>

        {/* Typing Bubble (Matches Assistant Bubble Styles) */}
        <div class="bg-[#18181b]/50 backdrop-blur-3xl border border-white/[0.08] px-6 py-4 rounded-[24px] rounded-tl-sm flex items-center gap-2 w-fit">
            <span class="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
            <span class="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce" style={{ "animation-delay": "0.15s" }} />
            <span class="w-1.5 h-1.5 bg-blue-500/60 rounded-full animate-bounce" style={{ "animation-delay": "0.3s" }} />
        </div>
    </Motion.div>
);

const ThinkingDisplay = (props: { steps: any[] }) => {
    const [isExpanded, setIsExpanded] = createSignal(true);

    // Auto-expand if error occurs
    createEffect(() => {
        if (props.steps.some(s => s.status === 'error')) {
            setIsExpanded(true);
        }
    });

    return (
        <Motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            class="flex flex-col md:flex-row gap-2 md:gap-5 items-start mt-4 mb-8"
        >
            {/* Thinking Icon (Matches Assistant Icon Layout) */}
            <div class="w-10 h-10 rounded-2xl bg-[#0d0d0f] border border-white/5 flex items-center justify-center flex-shrink-0 shadow-2xl mt-1">
                <Bot class="w-5 h-5 text-purple-400 animate-pulse" />
            </div>

            {/* Thinking Content Box (Matches Assistant Bubble Styles) */}
            <div class="w-full md:max-w-[85%]">
                <div class="bg-[#18181b]/50 backdrop-blur-3xl border border-white/[0.08] rounded-[24px] rounded-tl-sm overflow-hidden shadow-2xl transition-all duration-300">
                    {/* Header / Summary View */}
                    <div
                        class="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]"
                        onClick={() => setIsExpanded(!isExpanded())}
                    >
                        <div class="flex flex-col">
                            <div class="flex items-center gap-2">
                                <span class="text-[13px] font-bold text-gray-100 uppercase tracking-wider">Vision AI Thinking</span>
                                <div class="flex gap-0.5 items-end h-3 pb-0.5">
                                    <span class="w-0.5 h-0.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0s" }} />
                                    <span class="w-0.5 h-0.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0.15s" }} />
                                    <span class="w-0.5 h-0.5 bg-purple-500 rounded-full animate-bounce" style={{ "animation-delay": "0.3s" }} />
                                </div>
                            </div>
                            <span class="text-[10px] text-gray-500 font-medium truncate max-w-[200px]">
                                {props.steps[props.steps.length - 1]?.label || "Processing Request..."}
                            </span>
                        </div>

                        <button class="text-gray-500 hover:text-white transition-colors p-1">
                            <ChevronDown class={`w-4 h-4 transition-transform duration-300 ${isExpanded() ? 'rotate-180' : ''}`} />
                        </button>
                    </div>

                    {/* Expanded Details */}
                    <Show when={isExpanded()}>
                        <div class="border-t border-white/5 bg-black/20 px-6 py-5 space-y-4">
                            <For each={props.steps}>
                                {(step) => (
                                    <div class="flex items-start gap-3 group animate-in fade-in slide-in-from-top-1 duration-300">
                                        <div class="mt-1 relative flex-shrink-0">
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
                                            <div class="text-[12px] font-bold text-gray-200">{step.label}</div>
                                            <Show when={step.detail}>
                                                <div class="text-[10px] text-gray-500 mt-1 leading-relaxed">{step.detail}</div>
                                            </Show>
                                        </div>
                                        <Show when={step.status === 'completed'}>
                                            <Check class="w-3.5 h-3.5 text-green-500/50 flex-shrink-0" />
                                        </Show>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
            </div>
        </Motion.div>
    );
};

const MultiReviewCard = (props: {
    transactions: any[],
    onApprove: (interval: number) => void,
    onCancel: () => void,
    onViewDetail: () => void
}) => {
    const [interval, setIntervalVal] = createSignal(5); // Default 5s
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
                                    <span class="text-[12px] font-bold text-gray-200">{tx.name || tx.vid || 'New Recipient'}</span>
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

            {/* Interval Setting */}
            <div class="px-4 py-3 bg-white/[0.02] border-t border-white/5">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Execution Interval</span>
                    <span class="text-[10px] font-bold text-blue-400">{interval()}s <span class="text-gray-600">/ Tx</span></span>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-[9px] font-bold text-gray-600">3s</span>
                    <input
                        type="range"
                        min="3"
                        max="10"
                        step="1"
                        value={interval()}
                        onInput={(e) => setIntervalVal(parseInt(e.currentTarget.value))}
                        class="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <span class="text-[9px] font-bold text-gray-600">10s</span>
                </div>
            </div>

            <div class="p-3 bg-black/40 border-t border-white/5 flex gap-2">
                <button
                    onClick={props.onCancel}
                    class="flex-1 py-2 rounded-xl text-[11px] font-black text-gray-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-widest"
                >
                    Cancel
                </button>
                <button
                    onClick={() => props.onApprove(interval())}
                    class="flex-[2] py-2 bg-blue-500 hover:bg-blue-600 rounded-xl text-[11px] font-black text-white shadow-lg shadow-blue-500/20 transition-all uppercase tracking-widest"
                >
                    Start Batch Transfer
                </button>
            </div>
        </Motion.div>
    );
};

const BatchResultsModal = (props: {
    isOpen: boolean,
    onClose: () => void,
    agent: any
}) => {
    if (!props.agent) return null;

    const successCount = () => props.agent.successCount || 0;
    const failedCount = () => props.agent.failedCount || 0;
    const totalCount = () => props.agent.totalCount || 0;
    const results = () => props.agent.results || [];

    const downloadCSV = () => {
        let csv = "Date,BatchID,Recipient,Amount,Symbol,Status,TxHash,Error\n";
        const timestamp = new Date(props.agent.startTime).toISOString();
        results().forEach((r: any) => {
            csv += `${timestamp},${props.agent.id},${r.tx.recipient},${r.tx.amount},${r.tx.symbol || 'VCN'},${r.success ? 'SUCCESS' : 'FAILED'},${r.hash || ''},"${r.error || ''}"\n`;
        });
        const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
        const link = document.createElement("a");
        link.setAttribute("href", uri);
        link.setAttribute("download", `Batch_Report_${props.agent.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Presence>
            <Show when={props.isOpen}>
                <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={props.onClose}
                        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <Motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        class="relative w-full max-w-2xl bg-[#0d0d0f] border border-white/10 rounded-[32px] shadow-3xl overflow-hidden flex flex-col max-h-[80vh]"
                    >
                        <div class="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-blue-500/5 to-transparent">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                    <Layers class="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-black text-white">Execution Report</h3>
                                    <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">ID: {props.agent.id}</p>
                                </div>
                            </div>
                            <button onClick={props.onClose} class="text-gray-500 hover:text-white transition-colors">
                                <Plus class="w-6 h-6 rotate-45" />
                            </button>
                        </div>

                        <div class="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div class="grid grid-cols-3 gap-4 mb-8">
                                <div class="bg-white/5 rounded-2xl p-4 border border-white/5">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total</div>
                                    <div class="text-2xl font-black text-white">{totalCount()}</div>
                                </div>
                                <div class="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10">
                                    <div class="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Success</div>
                                    <div class="text-2xl font-black text-emerald-400">{successCount()}</div>
                                </div>
                                <div class="bg-red-500/5 rounded-2xl p-4 border border-red-500/10">
                                    <div class="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Failed</div>
                                    <div class="text-2xl font-black text-red-400">{failedCount()}</div>
                                </div>
                            </div>

                            <div class="space-y-3">
                                <For each={results()}>
                                    {(res) => (
                                        <div class="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                                            <div class="flex items-center gap-3">
                                                <div class={`w-8 h-8 rounded-lg flex items-center justify-center ${res.success ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                                    <Show when={res.success} fallback={<AlertTriangle class="w-4 h-4 text-red-400" />}>
                                                        <Check class="w-4 h-4 text-emerald-400" />
                                                    </Show>
                                                </div>
                                                <div class="flex flex-col">
                                                    <span class="text-xs font-bold text-gray-200 truncate max-w-[150px]">{res.tx.recipient}</span>
                                                    <span class="text-[10px] text-gray-500">{res.tx.amount} {res.tx.symbol || 'VCN'}</span>
                                                </div>
                                            </div>
                                            <div class="text-right">
                                                <Show when={res.success} fallback={<span class="text-[9px] font-bold text-red-400 uppercase">Blocked</span>}>
                                                    <span class="text-[9px] font-mono text-blue-400">{res.hash?.slice(0, 10)}...</span>
                                                </Show>
                                            </div>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>

                        <div class="p-8 bg-black/40 border-t border-white/5 flex gap-4">
                            <button
                                onClick={downloadCSV}
                                class="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-[13px] font-black text-white transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <FileSpreadsheet class="w-5 h-5" /> Download Report (.csv)
                            </button>
                            <button
                                onClick={props.onClose}
                                class="flex-1 py-4 bg-blue-500 hover:bg-blue-600 rounded-2xl text-[13px] font-black text-white transition-all uppercase tracking-widest"
                            >
                                Close History
                            </button>
                        </div>
                    </Motion.div>
                </div>
            </Show>
        </Presence>
    );
};
const BatchReportCard = (props: {
    data: any,
    onViewDetail: () => void
}) => {
    const downloadReport = () => {
        let csv = "Date,BatchID,Intent,Recipient,Amount,Symbol,Status,TxHash,Error\n";
        const timestamp = new Date().toISOString();
        props.data.results.forEach((r: any) => {
            csv += `${timestamp},${props.data.agentId},${r.tx.intent},${r.tx.recipient},${r.tx.amount},${r.tx.symbol || 'VCN'},${r.success ? 'SUCCESS' : 'FAILED'},${r.hash || ''},"${r.error || ''}"\n`;
        });
        const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
        const link = document.createElement("a");
        link.setAttribute("href", uri);
        link.setAttribute("download", `Accounting_Report_${props.data.agentId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div class="mt-4 p-6 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 rounded-[24px] shadow-2xl">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                        <FileSpreadsheet class="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h4 class="text-sm font-black text-white uppercase tracking-widest">Execution Report</h4>
                        <p class="text-[10px] text-gray-500 font-bold">BATCH ID: {props.data.agentId}</p>
                    </div>
                </div>
                <div class={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${props.data.failed === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'}`}>
                    {props.data.failed === 0 ? 'Completed' : 'Issues Detected'}
                </div>
            </div>

            <div class="grid grid-cols-3 gap-3 mb-6">
                <div class="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <div class="text-[9px] font-black text-gray-500 uppercase mb-1">Total</div>
                    <div class="text-lg font-black text-white">{props.data.total}</div>
                </div>
                <div class="bg-emerald-500/5 rounded-2xl p-3 border border-emerald-500/10">
                    <div class="text-[9px] font-black text-emerald-500 uppercase mb-1">Success</div>
                    <div class="text-lg font-black text-emerald-400">{props.data.success}</div>
                </div>
                <div class="bg-red-500/5 rounded-2xl p-3 border border-red-500/10">
                    <div class="text-[9px] font-black text-red-500 uppercase mb-1">Failed</div>
                    <div class="text-lg font-black text-red-400">{props.data.failed}</div>
                </div>
            </div>

            <div class="flex flex-col gap-2">
                <button
                    onClick={downloadReport}
                    class="w-full py-3.5 bg-white text-black hover:bg-white/90 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5 active:scale-[0.98]"
                >
                    <Download class="w-4 h-4" /> Download Accounting Report
                </button>

                <div class="flex gap-2">
                    <Show when={props.data.failed > 0}>
                        <button
                            onClick={() => {
                                let csv = "Date,BatchID,Intent,Recipient,Amount,Symbol,Status,Error\n";
                                const timestamp = new Date().toISOString();
                                props.data.results.filter((r: any) => !r.success).forEach((r: any) => {
                                    csv += `${timestamp},${props.data.agentId},${r.tx.intent},${r.tx.recipient},${r.tx.amount},${r.tx.symbol || 'VCN'},FAILED,"${r.error || ''}"\n`;
                                });
                                const uri = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
                                const link = document.createElement("a");
                                link.setAttribute("href", uri);
                                link.setAttribute("download", `Remediation_List_${props.data.agentId}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            class="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center justify-center gap-2"
                        >
                            <RefreshCw class="w-3.5 h-3.5" /> Remediation CSV
                        </button>
                    </Show>
                    <button
                        onClick={props.onViewDetail}
                        class="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 active:scale-[0.98]"
                    >
                        Detailed Log
                    </button>
                </div>
            </div>
        </div>
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
                        class="relative w-full max-w-5xl h-[85vh] bg-[#0d0d0f] border-t border-white/10 rounded-t-[40px] shadow-3xl flex flex-col overflow-hidden"
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

// Default Quick Actions - defined outside component for instant availability
const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
    { id: '1', label: 'Learn about Vision Chain', prompt: 'Tell me about Vision Chain', icon: 'BookOpen', iconColor: 'text-yellow-500', actionType: 'chat', order: 1, enabled: true },
    { id: '2', label: 'Receive VCN Gift', prompt: 'I want to receive VCN airdrop', icon: 'Sparkles', iconColor: 'text-purple-400', actionType: 'chat', order: 2, enabled: true },
    { id: '3', label: 'Invite Friends', prompt: 'How do I invite friends?', icon: 'UserPlus', iconColor: 'text-emerald-400', actionType: 'chat', order: 3, enabled: true },
    { id: '4', label: 'Send VCN', prompt: '', icon: 'Send', iconColor: 'text-blue-400', actionType: 'flow', flowName: 'send', order: 4, enabled: true }
];

export const WalletDashboard = (props: WalletDashboardProps) => {
    const [scrolled, setScrolled] = createSignal(false);
    const [isAgentBayCollapsed, setIsAgentBayCollapsed] = createSignal(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [isMobile, setIsMobile] = createSignal(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    // Bottom Sheet state for mobile input
    const [bottomSheetExpanded, setBottomSheetExpanded] = createSignal(true);
    // Mobile Chat History drawer state
    const [isMobileHistoryOpen, setIsMobileHistoryOpen] = createSignal(false);
    let bottomSheetDragStart = 0;
    // Initialize with defaults immediately for instant UI
    const [quickActions, setQuickActions] = createSignal<QuickAction[]>(DEFAULT_QUICK_ACTIONS);
    let scrollContainerRef: HTMLDivElement | undefined;


    onMount(() => {
        // Load Quick Actions from Firebase in background (non-blocking)
        getQuickActions()
            .then(actions => {
                const enabledActions = actions.filter(a => a.enabled).sort((a, b) => a.order - b.order);
                // Only update if Firebase has custom actions
                if (enabledActions.length > 0) {
                    setQuickActions(enabledActions);
                }
            })
            .catch(e => {
                console.error('Failed to load quick actions:', e);
                // Keep defaults - already set
            });

        // Track mobile/desktop for responsive input visibility
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        onCleanup(() => window.removeEventListener('resize', handleResize));
    });

    // Memo for active time-lock tasks (show SENT for 60 seconds then hide)
    const activeTimeTasks = createMemo(() => {
        const tasks = props.queueTasks();
        // Early return for empty queue - performance optimization
        if (tasks.length === 0) return [];

        const now = Date.now();
        return tasks.filter(t => {
            // Always show WAITING, EXECUTING, FAILED
            if (['WAITING', 'EXECUTING', 'FAILED'].includes(t.status)) return true;
            // Show SENT tasks for 60 seconds after completion
            if (t.status === 'SENT' && t.completedAt) {
                const elapsed = now - t.completedAt;
                return elapsed < 60000; // 60 seconds
            }
            return false;
        });
    });
    const [isComposing, setIsComposing] = createSignal(false);
    const [isQueueDrawerOpen, setIsQueueDrawerOpen] = createSignal(false);
    const [isBatchDrawerOpen, setIsBatchDrawerOpen] = createSignal(false);
    const [selectedTaskId, setSelectedTaskId] = createSignal<string | null>(null);
    const [selectedBatchId, setSelectedBatchId] = createSignal<string | null>(null);

    const combinedDrawerTasks = createMemo(() => {
        const queueTasks = props.queueTasks();
        const batchAgents = props.batchAgents();

        // Early return for empty state - performance optimization
        if (queueTasks.length === 0 && batchAgents.length === 0) return [];

        const batchTasks = batchAgents
            .map(agent => ({
                id: agent.id,
                type: 'BATCH',
                summary: `${agent.successCount + agent.failedCount}/${agent.totalCount} Transactions`,
                status: (agent.status === 'EXECUTING' || agent.status === 'executing') ? 'EXECUTING' : (agent.status === 'SENT' ? 'SENT' : 'FAILED'),
                timestamp: agent.startTime,
                recipient: agent.transactions?.[0]?.recipient,
                amount: `${agent.successCount + agent.failedCount}/${agent.totalCount}`,
                token: 'TX',
                progress: ((agent.successCount + agent.failedCount) / agent.totalCount) * 100
            }));
        return [...queueTasks, ...batchTasks];
    });
    let fileInputRef: HTMLInputElement | undefined;
    let messagesContainerRef: HTMLDivElement | undefined;

    const LANGUAGES = [
        { code: 'en-US', label: 'English' }
    ];

    const selectedBatchAgent = createMemo(() =>
        props.batchAgents().find(a => a.id === selectedBatchId())
    );

    // --- Auto-scroll Logic ---
    createEffect(() => {
        const msgs = props.messages();
        const steps = props.thinkingSteps();
        const loading = props.isLoading();

        // Early return if no content - performance optimization
        if (msgs.length === 0 && steps.length === 0 && !loading) return;

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

    // --- Bottom Sheet Touch Handlers for Mobile ---
    const handleBottomSheetTouchStart = (e: TouchEvent) => {
        bottomSheetDragStart = e.touches[0].clientY;
    };

    const handleBottomSheetTouchEnd = (e: TouchEvent) => {
        const dragEnd = e.changedTouches[0].clientY;
        const dragDistance = bottomSheetDragStart - dragEnd;

        // Swipe up (expand) if dragged more than 30px up
        if (dragDistance > 30) {
            setBottomSheetExpanded(true);
        }
        // Swipe down (collapse) if dragged more than 30px down
        else if (dragDistance < -30) {
            setBottomSheetExpanded(false);
        }
    };

    return (
        <div class="flex-1 flex h-full overflow-hidden relative bg-[#070708]">
            {/* Left Sidebar & Toggle Removed - Moved to Right Sidebar */}

            {/* Main Chat Area */}
            <div class="flex-1 flex flex-col overflow-hidden relative">


                <QueueDrawer
                    isOpen={isQueueDrawerOpen()}
                    onClose={() => setIsQueueDrawerOpen(false)}
                    tasks={combinedDrawerTasks()}
                    contacts={props.contacts()}
                    focusedTaskId={selectedTaskId()}
                    onCancelTask={props.onCancelTask}
                    onDismissTask={props.onDismissTask}
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

                <BatchResultsModal
                    isOpen={!!selectedBatchId()}
                    onClose={() => setSelectedBatchId(null)}
                    agent={selectedBatchAgent()}
                />

                {/* Mobile Chat History Drawer */}
                <Presence>
                    <Show when={isMobileHistoryOpen()}>
                        <Motion.div
                            initial={{ x: '-100%', opacity: 0.5 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '-100%', opacity: 0.5 }}
                            transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
                            class="fixed inset-y-0 left-0 w-[85%] max-w-[320px] bg-[#0c0c0e] border-r border-white/10 shadow-2xl z-[60] flex flex-col md:hidden"
                        >
                            {/* Header */}
                            <div class="p-4 flex items-center justify-between border-b border-white/5 bg-[#0a0a0b]">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <History class="w-4 h-4 text-purple-400" />
                                    </div>
                                    <span class="text-sm font-bold text-white uppercase tracking-wider">Chat History</span>
                                </div>
                                <button
                                    onClick={() => setIsMobileHistoryOpen(false)}
                                    class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                                >
                                    <X class="w-4 h-4" />
                                </button>
                            </div>

                            {/* New Chat Button */}
                            <div class="p-3 border-b border-white/5">
                                <button
                                    onClick={() => {
                                        props.onNewChat();
                                        setIsMobileHistoryOpen(false);
                                    }}
                                    class="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <Plus class="w-4 h-4" />
                                    New Chat
                                </button>
                            </div>

                            {/* History List */}
                            <div class="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                                <Show when={props.history().length === 0}>
                                    <div class="py-12 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                                        No chat history yet
                                    </div>
                                </Show>
                                <For each={props.history()}>
                                    {(conv) => (
                                        <button
                                            onClick={() => {
                                                props.onSelectConversation(conv);
                                                setIsMobileHistoryOpen(false);
                                            }}
                                            class={`w-full p-3 rounded-xl text-left transition-all border ${props.currentSessionId() === conv.id
                                                    ? 'bg-purple-600/10 border-purple-500/30'
                                                    : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.05]'
                                                }`}
                                        >
                                            <div class="flex flex-col gap-1">
                                                <span class={`text-[12px] font-bold truncate ${props.currentSessionId() === conv.id ? 'text-purple-400' : 'text-gray-100'
                                                    }`}>
                                                    {conv.messages[0]?.text || 'New Chat'}
                                                </span>
                                                <div class="flex items-center gap-2 text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                    <span>{new Date(conv.updatedAt || conv.createdAt).toLocaleDateString()}</span>
                                                    <span class="w-1 h-1 rounded-full bg-gray-700" />
                                                    <span>{conv.messages.length} msgs</span>
                                                </div>
                                            </div>
                                        </button>
                                    )}
                                </For>
                            </div>
                        </Motion.div>
                    </Show>
                </Presence>

                {/* Mobile History Backdrop */}
                <Show when={isMobileHistoryOpen()}>
                    <div
                        class="fixed inset-0 bg-black/60 z-[55] md:hidden"
                        onClick={() => setIsMobileHistoryOpen(false)}
                    />
                </Show>

                {/* Mobile Chat History Floating Button */}
                <Show when={isMobile() && !isMobileHistoryOpen()}>
                    <button
                        onClick={() => setIsMobileHistoryOpen(true)}
                        class="fixed top-20 left-4 z-40 w-10 h-10 bg-[#1a1a1c] border border-white/10 rounded-full flex items-center justify-center shadow-lg hover:bg-white/10 transition-all"
                        title="Chat History"
                    >
                        <History class="w-4 h-4 text-purple-400" />
                    </button>
                </Show>

                {/* Messages Area */}
                <div
                    ref={(el) => messagesContainerRef = el}
                    class="flex-1 overflow-y-auto overflow-x-hidden bg-[#070708] scrollbar-hide scroll-smooth overscroll-contain"
                    style="-webkit-overflow-scrolling: touch; max-width: 100vw;"
                >
                    <Show when={props.messages().length === 0}>
                        <div class="min-h-full h-full flex flex-col items-center justify-start p-6 pt-24 md:pt-32 w-full max-w-2xl mx-auto z-10 pb-48 md:pb-64">
                            {/* Welcome & Quick Actions */}
                            <Motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                class="w-full max-w-sm flex flex-col gap-6 self-center"
                            >
                                <div class="flex flex-col gap-1">
                                    <h2 class="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">
                                        Hello, {props.userProfile()?.displayName || props.userProfile()?.name || props.userProfile()?.username || <span class="text-red-400">NO DATA</span>}
                                    </h2>
                                    <p class="text-lg text-gray-500 font-medium">How can I help you today?</p>
                                </div>

                                <div class="flex flex-col gap-2 w-full items-start">
                                    <For each={quickActions()}>
                                        {(action) => {
                                            // Icon mapping
                                            const iconMap: Record<string, any> = {
                                                BookOpen, Sparkles, UserPlus, Send, TrendingUp, Zap, Download, Clock, MessageSquare, Search, Lock, Layers
                                            };
                                            const IconComponent = iconMap[action.icon] || Sparkles;

                                            const handleClick = () => {
                                                if (action.actionType === 'flow' && action.flowName) {
                                                    props.setActiveFlow(action.flowName);
                                                } else if (action.prompt) {
                                                    props.setInput(action.prompt);
                                                    // Use queueMicrotask to ensure input signal is updated
                                                    queueMicrotask(() => props.handleSend());
                                                }
                                            };

                                            return (
                                                <button
                                                    onClick={handleClick}
                                                    class="flex items-center gap-3 py-3 px-4 rounded-[20px] bg-[#1a1a1c] border border-white/5 hover:bg-[#252528] transition-all group text-left"
                                                >
                                                    <div class={`w-5 h-5 ${action.iconColor} group-hover:scale-110 transition-transform`}>
                                                        <IconComponent class="w-full h-full" />
                                                    </div>
                                                    <span class="text-[13px] font-medium text-gray-200 group-hover:text-white">{action.label}</span>
                                                </button>
                                            );
                                        }}
                                    </For>
                                </div>
                            </Motion.div>
                        </div>
                    </Show>

                    <Show when={props.messages().length > 0}>
                        <div class="max-w-3xl mx-auto px-2 md:px-6 pt-4 md:pt-16 pb-80 md:pb-56 space-y-4 md:space-y-12">
                            <For each={props.messages()}>
                                {(msg) => (
                                    <Motion.div
                                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ duration: 0.4 }}
                                        class={`flex flex-col md:flex-row gap-2 md:gap-5 ${msg.role === 'user' ? 'items-end md:justify-end' : 'items-start'}`}
                                    >
                                        <Show when={msg.role === 'assistant'}>
                                            <div class="w-10 h-10 rounded-2xl bg-[#0d0d0f] border border-white/5 flex items-center justify-center flex-shrink-0 shadow-2xl mt-1">
                                                <div class="w-5 h-5 text-blue-400">
                                                    <Sparkles class="w-full h-full" />
                                                </div>
                                            </div>
                                        </Show>
                                        <div class={`w-full max-w-full md:max-w-[85%] ${msg.role === 'user' ? 'md:order-first' : ''}`}>
                                            {(() => {
                                                const rawContent = msg.content.split('[RECOMMENDED_QUESTIONS]')[0];
                                                const { text, charts } = parseChartBlocks(rawContent);
                                                return (
                                                    <>
                                                        <Show when={text.trim().length > 0}>
                                                            <div class={`px-6 py-4 rounded-[24px] text-[16px] leading-[1.6] transition-all markdown-body overflow-hidden break-words ${msg.role === 'user'
                                                                ? 'bg-[#007AFF] text-white rounded-tr-sm shadow-[0_10px_30px_-5px_rgba(0,122,255,0.3)]'
                                                                : 'bg-[#18181b]/50 backdrop-blur-3xl text-gray-100 border border-white/[0.08] rounded-tl-sm'
                                                                }`}
                                                                style="max-width: 100%; word-wrap: break-word; overflow-wrap: break-word;"
                                                                innerHTML={marked.parse(text) as string}
                                                            />
                                                        </Show>
                                                        <For each={charts}>
                                                            {(chartData) => (
                                                                <Suspense fallback={<div class="h-48 flex items-center justify-center text-gray-500 text-sm">Loading chart...</div>}>
                                                                    <VisionChart data={chartData} />
                                                                </Suspense>
                                                            )}
                                                        </For>
                                                    </>
                                                );
                                            })()}

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
                                                    onApprove={(interval) => {
                                                        props.onStartBatch(msg.batchData, interval);
                                                        props.setReviewMulti(null);
                                                    }}
                                                    onCancel={() => props.setReviewMulti(null)}
                                                    onViewDetail={() => {
                                                        props.setReviewMulti(msg.batchData);
                                                        setIsBatchDrawerOpen(true);
                                                    }}
                                                />
                                            </Show>

                                            {/* Specialized Batch Report UI */}
                                            <Show when={msg.role === 'assistant' && msg.isBatchReport && msg.batchReportData}>
                                                <BatchReportCard
                                                    data={msg.batchReportData!}
                                                    onViewDetail={() => {
                                                        setSelectedBatchId(msg.batchReportData!.agentId);
                                                    }}
                                                />
                                            </Show>

                                            {/* Response Time Display */}
                                            <Show when={msg.role === 'assistant' && msg.responseTime && props.showResponseTime}>
                                                <div class="mt-1.5 px-2 text-[10px] text-gray-500 font-mono flex items-center gap-1">
                                                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <circle cx="12" cy="12" r="10" />
                                                        <polyline points="12,6 12,12 16,14" />
                                                    </svg>
                                                    {msg.responseTime >= 1000
                                                        ? `${(msg.responseTime / 1000).toFixed(1)}s`
                                                        : `${msg.responseTime}ms`}
                                                </div>
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

                            {/* Streaming Content - Appears BELOW thinking process */}
                            <Show when={props.streamingContent().length > 0}>
                                <Motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    class="flex gap-2 md:gap-3 px-2 md:px-4 mt-2"
                                >
                                    <div class="w-8 h-8 md:w-10 md:h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 mt-1 shadow-xl">
                                        <Sparkles class="w-4 h-4 md:w-5 md:h-5 text-cyan-400" />
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div
                                            class="px-4 py-3 md:px-6 md:py-4 rounded-[20px] md:rounded-[24px] text-[14px] md:text-[16px] leading-[1.6] bg-[#18181b]/50 backdrop-blur-3xl text-gray-100 border border-white/[0.08] rounded-tl-sm markdown-body overflow-hidden"
                                            style="max-width: 100%; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word;"
                                            innerHTML={marked.parse(props.streamingContent()) as string}
                                        />
                                    </div>
                                </Motion.div>
                            </Show>

                            <Show when={props.isLoading() && props.streamingContent().length === 0}>
                                <TypingIndicator />
                            </Show>

                            {/* Dynamic Spacer for Agent Bay / Input Padding */}
                            <div class={`transition-all duration-300 ${(activeTimeTasks().length > 0 || props.batchAgents().length > 0) && !isAgentBayCollapsed()
                                ? 'h-64'
                                : 'h-48 md:h-32'
                                }`} />
                        </div>
                    </Show>
                </div>

                {/* Bottom Sheet Mobile Input Area */}
                <div
                    class={`md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0b] z-40 transition-all duration-300 ease-out rounded-t-2xl shadow-2xl ${bottomSheetExpanded() ? '' : ''
                        }`}
                    on:touchstart={handleBottomSheetTouchStart}
                    on:touchend={handleBottomSheetTouchEnd}
                >
                    {/* Drag Handle - Always Visible */}
                    <div
                        class="flex justify-center py-3 cursor-grab active:cursor-grabbing"
                        onClick={() => setBottomSheetExpanded(!bottomSheetExpanded())}
                    >
                        <div class={`w-12 h-1.5 rounded-full transition-colors ${bottomSheetExpanded() ? 'bg-gray-500' : 'bg-blue-500'}`} />
                    </div>

                    {/* Collapsed State - Always show mini bar when collapsed */}
                    <Show when={!bottomSheetExpanded()}>
                        <div
                            class="px-4 pb-6 flex items-center gap-3"
                            onClick={() => setBottomSheetExpanded(true)}
                        >
                            <div class="flex-1 bg-[#1a1a1c] rounded-2xl px-5 py-3 text-gray-400 text-base border border-white/10">
                                Tap to type a message...
                            </div>
                            <button
                                class="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-full flex items-center justify-center shadow-lg"
                            >
                                <ChevronUp class="w-6 h-6 text-white" />
                            </button>
                        </div>
                    </Show>

                    {/* Expanded State - Full Input */}
                    <Show when={bottomSheetExpanded()}>
                        <div class="px-4 pb-6">
                            {/* Input Container */}
                            <div class="relative bg-[#121214] rounded-2xl border border-white/10 overflow-hidden">
                                <textarea
                                    value={props.input()}
                                    placeholder="Tell Vision AI what to do..."
                                    rows="1"
                                    class="w-full bg-transparent text-white text-base px-4 py-4 pb-14 resize-none focus:outline-none placeholder:text-gray-500"
                                    style="max-height: 200px;"
                                    onInput={(e) => {
                                        props.setInput(e.currentTarget.value);
                                        e.currentTarget.style.height = 'auto';
                                        e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 200) + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.isComposing || e.keyCode === 229) return;
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            props.handleSend();
                                        }
                                    }}
                                />
                                {/* Bottom bar with buttons */}
                                <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                                    <div class="flex items-center gap-1">
                                        <button
                                            onClick={() => fileInputRef?.click()}
                                            class="w-10 h-10 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/10"
                                        >
                                            <Plus class="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => {
                                            props.handleSend();
                                            setBottomSheetExpanded(false);
                                        }}
                                        disabled={!props.input().trim() || props.isLoading()}
                                        class={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${props.input().trim() && !props.isLoading()
                                            ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white'
                                            : 'bg-white/5 text-gray-600'
                                            }`}
                                    >
                                        <Send class="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Show>
                </div>

                {/* Desktop Input Area - Desktop only */}
                <Show when={!isMobile()}>
                    <div class="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#070708] via-[#070708]/95 to-transparent pt-32 z-30 pointer-events-none">
                        <div class="max-w-3xl mx-auto px-3 md:px-0 pointer-events-auto">
                            <Presence>
                                {/* Unified Background Agents Bar - Above Input */}
                                <Show when={activeTimeTasks().length > 0 || props.batchAgents().length > 0}>
                                    <div class="px-2 mb-2 flex flex-col gap-2 relative group-agents">
                                        {/* Header Row: Agent Desk Label (left) + Toggle Button (right) */}
                                        <div class="hidden md:flex items-center justify-between mb-1">
                                            <span class="text-[9px] font-black text-blue-500 uppercase tracking-widest">Agent Desk</span>
                                            <button
                                                onClick={() => setIsAgentBayCollapsed(!isAgentBayCollapsed())}
                                                class={`w-[120px] px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 shadow-2xl backdrop-blur-2xl group/agent-toggle ${isAgentBayCollapsed()
                                                    ? 'bg-blue-600/90 border-blue-400 text-white hover:bg-blue-600 shadow-blue-900/40'
                                                    : 'bg-[#121214]/80 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                                    }`}
                                            >
                                                <div class={`w-1.5 h-1.5 rounded-full ${isAgentBayCollapsed() ? 'bg-white animate-pulse' : 'bg-blue-500 ring-4 ring-blue-500/10'}`} />
                                                <span>{isAgentBayCollapsed() ? 'Show Agents' : 'Minimize'}</span>
                                                <div class="w-3.5 h-3.5 flex items-center justify-center">
                                                    <Show when={!isAgentBayCollapsed()} fallback={<ChevronUp class="w-full h-full" />}>
                                                        <ChevronDown class="w-full h-full group-hover/agent-toggle:translate-y-0.5 transition-transform" />
                                                    </Show>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Mobile Toggle Button (absolute positioned) */}
                                        <div class="absolute -top-4 right-0 z-40 md:hidden">
                                            <button
                                                onClick={() => setIsAgentBayCollapsed(!isAgentBayCollapsed())}
                                                class={`w-[120px] px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-1.5 shadow-2xl backdrop-blur-2xl group/agent-toggle ${isAgentBayCollapsed()
                                                    ? 'bg-blue-600/90 border-blue-400 text-white hover:bg-blue-600 shadow-blue-900/40'
                                                    : 'bg-[#121214]/80 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                                                    }`}
                                            >
                                                <div class={`w-1.5 h-1.5 rounded-full ${isAgentBayCollapsed() ? 'bg-white animate-pulse' : 'bg-blue-500 ring-4 ring-blue-500/10'}`} />
                                                <span>{isAgentBayCollapsed() ? 'Show Agents' : 'Minimize'}</span>
                                                <div class="w-3.5 h-3.5 flex items-center justify-center">
                                                    <Show when={!isAgentBayCollapsed()} fallback={<ChevronUp class="w-full h-full" />}>
                                                        <ChevronDown class="w-full h-full group-hover/agent-toggle:translate-y-0.5 transition-transform" />
                                                    </Show>
                                                </div>
                                            </button>
                                        </div>

                                        {/* Agent Bay + History Button Row */}
                                        <div class="flex items-center gap-3">
                                            <Presence>
                                                <Show when={!isAgentBayCollapsed()}>
                                                    <Motion.div
                                                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                                        transition={{ duration: 0.3, easing: 'ease-out' }}
                                                        class="flex-1 flex items-center gap-3 overflow-hidden bg-[#0d0d0f]/60 backdrop-blur-md rounded-[24px] border border-white/5 p-1.5 pr-3 shadow-2xl"
                                                    >
                                                        {/* Unified Scrollable Row */}
                                                        <div class="flex-1 flex gap-3 overflow-x-auto scrollbar-hide py-0.5 pl-2">
                                                            {/* Batch Agents */}
                                                            <For each={props.batchAgents()}>
                                                                {(agent) => (
                                                                    <AgentChip
                                                                        task={{
                                                                            id: agent.id,
                                                                            type: 'BATCH',
                                                                            summary: `${agent.successCount + agent.failedCount}/${agent.totalCount} Transactions`,
                                                                            status: (agent.status === 'EXECUTING' || agent.status === 'executing') ? 'EXECUTING' : (agent.status === 'SENT' ? 'SENT' : 'FAILED'),
                                                                            timestamp: agent.startTime,
                                                                            progress: ((agent.successCount + agent.failedCount) / agent.totalCount) * 100,
                                                                            error: agent.error // Pass error message to display in UI
                                                                        }}
                                                                        isCompact={true}
                                                                        onClick={() => {
                                                                            setSelectedTaskId(agent.id);
                                                                            setIsQueueDrawerOpen(true);
                                                                        }}
                                                                        onDismiss={(id) => props.onDismissTask?.(id)}
                                                                    />
                                                                )}
                                                            </For>

                                                            {/* Time-lock Agents */}
                                                            <For each={activeTimeTasks()}>
                                                                {(task) => (
                                                                    <AgentChip
                                                                        task={task}
                                                                        isCompact={true}
                                                                        onClick={() => {
                                                                            setSelectedTaskId(task.id);
                                                                            setIsQueueDrawerOpen(true);
                                                                        }}
                                                                        onDismiss={(id) => props.onDismissTask?.(id)}
                                                                    />
                                                                )}
                                                            </For>
                                                        </div>
                                                    </Motion.div>
                                                </Show>
                                            </Presence>

                                            {/* History Button - Only visible when Agent Desk is expanded */}
                                            <Show when={!isAgentBayCollapsed()}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsQueueDrawerOpen(true);
                                                    }}
                                                    class="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[#0d0d0f]/80 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10 shadow-xl"
                                                >
                                                    <List class="w-5 h-5" />
                                                </button>
                                            </Show>
                                        </div>
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

                            <div class="relative group overflow-hidden rounded-[30px]">
                                {/* Agent Activated Glow Effect */}
                                <div class={`absolute inset-0 rounded-[28px] blur-xl transition-all duration-700 ${props.isScheduling
                                    ? 'bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600 opacity-60'
                                    : 'bg-gradient-to-r from-blue-600 via-cyan-400 to-purple-600 opacity-20 group-focus-within:opacity-50'}`}
                                />
                                <div class="absolute inset-0 bg-gradient-to-r from-white/[0.08] to-transparent rounded-[26px] blur-sm opacity-50 group-focus-within:opacity-100 transition-opacity" />

                                <div class="relative bg-[#0d0d0f]/90 backdrop-blur-3xl border border-[#1a1a1c] rounded-[28px] p-2 flex flex-col md:flex-row items-stretch md:items-end gap-1 group-focus-within:bg-[#0d0d0f] group-focus-within:border-[#2a2a2e] transition-all duration-500 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)]">
                                    {/* Text area - Top on mobile, Center on desktop */}
                                    <div class="flex-1 px-1 border border-[#1a1a1c] group-focus-within:border-[#2a2a2e] rounded-xl self-stretch mt-1 mb-0 order-1 md:order-2 transition-colors">
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
                                    <div class="flex items-center gap-1.5 pb-0.5 pr-1.5 order-2 md:order-3">
                                        {/* Mobile: horizontal row with left tools and right-aligned send button */}
                                        <div class="flex md:hidden items-center gap-1.5 w-full">
                                            {/* Left side tools */}
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

                                            {/* Spacer to push send button to right */}
                                            <div class="flex-1" />

                                            {/* Send/Stop Button - Right aligned */}
                                            <button
                                                onClick={() => {
                                                    if (props.isLoading()) {
                                                        props.onStop?.();
                                                    } else {
                                                        props.handleSend();
                                                    }
                                                }}
                                                disabled={!props.isLoading() && (!props.input().trim() && props.attachments().length === 0)}
                                                class={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all duration-300 flex-shrink-0 ${props.isLoading()
                                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-100'
                                                    : (!props.input().trim() && props.attachments().length === 0)
                                                        ? 'bg-white/5 text-white/5 grayscale cursor-not-allowed'
                                                        : 'bg-[#007AFF] text-white shadow-[0_10px_30px_-5px_rgba(0,122,255,0.4)] hover:scale-105 active:scale-95'
                                                    }`}
                                            >
                                                <Show when={props.isLoading()} fallback={<Send class="w-5 h-5" />}>
                                                    <Square class="w-4 h-4 fill-current" />
                                                </Show>
                                            </button>
                                        </div>

                                        {/* Desktop: 2x2 grid on right side */}
                                        <div class="hidden md:grid grid-cols-2 gap-1 ml-2.5">
                                            {/* Row 1: Plus + Language */}
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
                                                <button class="w-11 h-11 flex items-center justify-center gap-1 rounded-xl bg-black/40 border border-white/5 text-[10px] font-black text-gray-500 hover:text-white transition-all uppercase tracking-widest">
                                                    <span>{props.voiceLang().split('-')[0]}</span>
                                                    <ChevronDown class="w-2.5 h-2.5" />
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

                                            {/* Row 2: Mic + Send */}
                                            <button
                                                onClick={props.toggleRecording}
                                                class={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all ${props.isRecording() ? 'bg-red-500 text-white animate-pulse' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                            >
                                                <Mic class="w-5 h-5" />
                                            </button>

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
                                                    ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_15px_rgba(239,68,68,0.5)] scale-100'
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
                            </div>


                        </div>
                    </div >
                </Show>
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
            </div >
        </div >
    );
};
