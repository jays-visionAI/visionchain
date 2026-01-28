import { createSignal, createMemo, For, Show } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { X, Clock, Check, AlertTriangle, ExternalLink, Copy, Ban, Activity, History, Play, Layers } from 'lucide-solid';
import { AgentTask } from './AgentChip';
import { contractService } from '../../../services/contractService';
import { cancelScheduledTask } from '../../../services/firebaseService';

// Extend AgentTask locally if needed or assume it has extra props from subscription
interface DetailedAgentTask extends AgentTask {
    recipient?: string;
    amount?: string;
    token?: string;
    scheduleId?: string;
    txHash?: string;
    error?: string;
}

interface QueueDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: DetailedAgentTask[];
    contacts?: any[];
    focusedTaskId?: string | null;
    onCancelTask?: (taskId: string) => void;
    onForceExecute?: (taskId: string) => void;
}

const QueueDrawer = (props: QueueDrawerProps) => {
    const [activeTab, setActiveTab] = createSignal<'ACTIVE' | 'HISTORY'>('ACTIVE');
    const [expandedIds, setExpandedIds] = createSignal<Set<string>>(new Set());
    const [isCancelling, setIsCancelling] = createSignal<string | null>(null);

    const handleCancel = async (scheduleId: string | undefined, e: Event) => {
        e.stopPropagation();
        if (!scheduleId) return;

        if (!confirm("Are you sure you want to cancel this scheduled transfer?")) return;

        setIsCancelling(scheduleId);
        try {
            // Cancel via Parent Prop (which handles Firebase update only)
            if (props.onCancelTask) {
                await props.onCancelTask(scheduleId);
            } else {
                console.warn("No cancel handler provided");
            }

            // Optimistic UI update could happen here via subscription automatically
        } catch (err) {
            console.error("Cancel failed:", err);
            alert("Failed to cancel transfer. See console for details.");
        } finally {
            setIsCancelling(null);
        }
    };

    // Auto-expand focused task on open
    createMemo(() => {
        if (props.isOpen && props.focusedTaskId) {
            setExpandedIds(new Set([props.focusedTaskId]));
            // Also switch tab if needed (assuming logic to find which tab the task is in)
            const task = props.tasks.find(t => t.id === props.focusedTaskId);
            if (task) {
                if (['SENT', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(task.status)) {
                    setActiveTab('HISTORY');
                } else {
                    setActiveTab('ACTIVE');
                }
            }
        }
    });

    const toggleExpand = (id: string, e: MouseEvent) => {
        e.stopPropagation();
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredTasks = createMemo(() => {
        return props.tasks.filter(t => {
            if (activeTab() === 'ACTIVE') return ['WAITING', 'EXECUTING'].includes(t.status);
            return ['SENT', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(t.status);
        }).sort((a, b) => b.timestamp - a.timestamp);
    });

    const resolveName = (address: string | undefined) => {
        if (!address || !props.contacts) return 'New Recipient';
        const contact = props.contacts.find((c: any) => c.address.toLowerCase() === address.toLowerCase());
        return contact ? contact.name : 'New Recipient';
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <Presence>
            <Show when={props.isOpen}>
                <Motion.div
                    initial={{ x: '100%', opacity: 0.5 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0.5 }}
                    transition={{ duration: 0.3, easing: [0.32, 0.72, 0, 1] }}
                    class="absolute inset-y-0 right-0 w-full md:w-[380px] bg-[#1a1a1c] border-l border-white/10 shadow-2xl z-[50] flex flex-col"
                >
                    {/* Header */}
                    <div class="flex items-center justify-between p-4 border-b border-white/5 bg-[#161618]">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold text-white uppercase tracking-wider">Agent Queue</span>
                            <div class="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">
                                {props.tasks.filter(t => ['WAITING', 'EXECUTING'].includes(t.status)).length} Active
                            </div>
                        </div>
                        <button
                            onClick={props.onClose}
                            class="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div class="flex p-2 gap-2 border-b border-white/5 bg-[#161618]">
                        <button
                            onClick={() => setActiveTab('ACTIVE')}
                            class={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab() === 'ACTIVE' ? 'bg-blue-600 text-white' : 'hover:bg-white/5 text-gray-400'}`}
                        >
                            <Activity class="w-3.5 h-3.5" /> Active
                        </button>
                        <button
                            onClick={() => setActiveTab('HISTORY')}
                            class={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${activeTab() === 'HISTORY' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-gray-400'}`}
                        >
                            <History class="w-3.5 h-3.5" /> History
                        </button>
                    </div>

                    {/* Content List */}
                    <div class="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                        <Show when={filteredTasks().length === 0}>
                            <div class="h-40 flex flex-col items-center justify-center text-gray-500 gap-2">
                                <span class="text-sm">No tasks in {activeTab().toLowerCase()} queue.</span>
                            </div>
                        </Show>

                        <For each={filteredTasks()}>
                            {(task) => (
                                <div class={`rounded-xl border transition-all overflow-hidden ${expandedIds().has(task.id) ? 'bg-[#242426] border-blue-500/20 shadow-lg' : 'bg-[#1e1e20] border-white/5 hover:border-white/10'}`}>

                                    {/* Task Summary Header (Always Visible) */}
                                    <div
                                        class="p-3 flex items-center gap-3 cursor-pointer"
                                        onClick={(e) => toggleExpand(task.id, e)}
                                    >
                                        <div class={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border 
                                            ${task.status === 'WAITING' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
                                                task.status === 'EXECUTING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse' :
                                                    task.status === 'SENT' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' :
                                                        'bg-gray-500/10 border-gray-500/30 text-gray-400'}`}>
                                            <Show when={task.type === 'BATCH'} fallback={<Clock class="w-4 h-4" />}>
                                                <Layers class="w-4 h-4" />
                                            </Show>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center justify-between gap-2">
                                                <div class="flex items-center gap-1.5 min-w-0">
                                                    <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest shrink-0">
                                                        {task.type === 'BATCH' ? 'BATCH AGENT' : 'TIME LOCK AGENT'}
                                                    </span>
                                                    <div class="w-1 h-1 rounded-full bg-gray-700 shrink-0" />
                                                    <span class="text-xs font-bold text-gray-200 truncate">
                                                        {task.summary}
                                                    </span>
                                                </div>
                                                <span class={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-tight shrink-0 ${task.status === 'WAITING' ? 'bg-blue-500/20 text-blue-300' :
                                                    task.status === 'EXECUTING' ? 'bg-amber-500/20 text-amber-300' :
                                                        task.status === 'SENT' ? 'bg-emerald-500/20 text-emerald-300' :
                                                            'bg-gray-800 text-gray-400'
                                                    }`}>{task.status === 'SENT' ? 'SUCCESS' : task.status}</span>
                                            </div>
                                            <div class="flex items-center gap-2 mt-1">
                                                <div class="text-[10px] text-gray-400 font-medium">
                                                    {resolveName(task.recipient)}
                                                </div>
                                                <div class="text-[10px] text-gray-600">
                                                    • {formatDate(task.timestamp)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detailed View (Expandable) */}
                                    <Show when={expandedIds().has(task.id)}>
                                        <div class="px-3 pb-3 pt-0 border-t border-white/5 mt-1">
                                            {/* Details Grid */}
                                            {/* Details Grid */}
                                            <div class="grid grid-cols-2 gap-y-3 gap-x-2 py-3">
                                                <div class="col-span-2">
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Recipient Details</span>
                                                    <div class="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5 mt-1">
                                                        <div class="flex flex-col">
                                                            <span class="text-xs text-white font-bold">{resolveName(task.recipient)}</span>
                                                            <span class="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-[200px]">{task.recipient || 'No address'}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => copyToClipboard(task.recipient || '')}
                                                            class="p-1.5 hover:bg-white/10 rounded-lg text-gray-500 transition-colors"
                                                        >
                                                            <Copy class="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div>
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Amount</span>
                                                    <div class="text-xs text-white font-black mt-0.5 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 inline-block">
                                                        {task.amount} {task.token}
                                                    </div>
                                                </div>

                                                <div>
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Source</span>
                                                    <div class="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
                                                        {task.id?.slice(0, 12)}
                                                        <div class="w-1 h-1 rounded-full bg-gray-700" />
                                                        {task.type || 'TIME'}
                                                    </div>
                                                </div>

                                                <Show when={task.txHash}>
                                                    <div class="col-span-2">
                                                        <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Transaction Result</span>
                                                        <div class="bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/20 mt-1 flex items-center justify-between">
                                                            <div class="flex flex-col">
                                                                <span class="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Successful Execution</span>
                                                                <span class="text-[9px] text-emerald-500/60 font-mono mt-0.5 truncate max-w-[250px]">{task.txHash}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => window.open(`https://visionscan.org/tx/${task.txHash}`, '_blank')}
                                                                class="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-emerald-400 transition-colors"
                                                            >
                                                                <ExternalLink class="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Show>

                                                <div class="col-span-2">
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold tracking-widest">Timeline Status</span>
                                                    <div class="flex items-center gap-1 mt-1.5">
                                                        <div class={`h-1 flex-1 rounded-full ${['WAITING', 'EXECUTING', 'SENT'].includes(task.status) ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-gray-800'}`} />
                                                        <div class={`h-1 flex-1 rounded-full ${['EXECUTING', 'SENT'].includes(task.status) ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-gray-800'}`} />
                                                        <div class={`h-1 flex-1 rounded-full ${task.status === 'SENT' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-800'}`} />
                                                    </div>
                                                    <div class="flex justify-between text-[8px] text-gray-600 mt-1.5 px-0.5 font-black uppercase tracking-widest">
                                                        <span class={['WAITING', 'EXECUTING', 'SENT'].includes(task.status) ? 'text-blue-400' : ''}>Start</span>
                                                        <span class={['EXECUTING', 'SENT'].includes(task.status) ? 'text-amber-400' : ''}>Exec</span>
                                                        <span class={task.status === 'SENT' ? 'text-emerald-400' : ''}>Done</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <Show when={task.status === 'FAILED' && task.error}>
                                                <div class="col-span-2 mt-1 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                                                    <span class="text-[9px] font-bold text-red-500 uppercase flex items-center gap-1">
                                                        <AlertTriangle class="w-2.5 h-2.5" /> Failure Reason
                                                    </span>
                                                    <div class="text-[10px] text-red-300 mt-1 break-words font-mono leading-tight">
                                                        {task.error}
                                                    </div>
                                                </div>
                                            </Show>

                                            {/* Action Buttons */}
                                            <div class="flex gap-2 pt-2 border-t border-white/5">
                                                <Show when={['WAITING', 'EXECUTING'].includes(task.status)}>
                                                    <button
                                                        onClick={(e) => handleCancel(task.scheduleId, e)}
                                                        disabled={isCancelling() === task.scheduleId}
                                                        class="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                    >
                                                        <Show when={isCancelling() === task.scheduleId} fallback={<><Ban class="w-3.5 h-3.5" /> {task.status === 'EXECUTING' ? 'Stop Agent' : 'Cancel Task'}</>}>
                                                            <div class="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                                        </Show>
                                                    </button>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            props.onForceExecute?.(task.id);
                                                        }}
                                                        class={`w-12 py-2.5 border rounded-xl flex items-center justify-center transition-all ${task.status === 'EXECUTING'
                                                            ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                                                            : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400'}`}
                                                        title={task.status === 'EXECUTING' ? "Force Retry" : "Execute Now"}
                                                    >
                                                        <Play class="w-3.5 h-3.5 fill-current" />
                                                    </button>
                                                </Show>

                                                <Show when={!['WAITING', 'EXECUTING'].includes(task.status)}>
                                                    <button
                                                        onClick={() => window.open(`https://visionscan.org/tx/${task.txHash}`, '_blank')}
                                                        class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                                    >
                                                        <ExternalLink class="w-3.5 h-3.5" /> View on Vision Scan
                                                    </button>
                                                </Show>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </div>
                </Motion.div>
            </Show >
        </Presence >
    );
};

export default QueueDrawer;
