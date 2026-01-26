import { createSignal, createMemo, For, Show } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { X, Clock, Check, AlertTriangle, ExternalLink, Copy, Ban, Activity, History, Play } from 'lucide-solid';
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
}

interface QueueDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    tasks: DetailedAgentTask[];
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Toast logic could go here
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
                                        <div class={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border 
                                            ${task.status === 'WAITING' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' :
                                                task.status === 'EXECUTING' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                                                    task.status === 'SENT' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                                        'bg-gray-500/10 border-gray-500/30 text-gray-400'}`}>
                                            <Show when={task.type === 'TIMELOCK'} fallback={<Activity class="w-4 h-4" />}>
                                                <Clock class="w-4 h-4" />
                                            </Show>
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center justify-between">
                                                <span class="text-xs font-bold text-gray-200 truncate">{task.summary}</span>
                                                <span class={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${task.status === 'WAITING' ? 'bg-blue-500/20 text-blue-300' :
                                                    task.status === 'EXECUTING' ? 'bg-amber-500/20 text-amber-300' :
                                                        task.status === 'SENT' ? 'bg-emerald-500/20 text-emerald-300' :
                                                            'bg-gray-700 text-gray-400'
                                                    }`}>{task.status}</span>
                                            </div>
                                            <div class="text-[10px] text-gray-500 mt-0.5">
                                                {task.timeLeft || new Date(task.timestamp).toLocaleTimeString()}
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
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold">Recipient</span>
                                                    <div class="text-xs text-gray-300 font-mono break-all bg-black/20 p-1.5 rounded mt-0.5">
                                                        {task.recipient || 'Unknown'}
                                                    </div>
                                                </div>

                                                <div>
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold">Amount</span>
                                                    <div class="text-xs text-white font-bold mt-0.5">{task.amount} {task.token}</div>
                                                </div>

                                                <div>
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold">Schedule ID</span>
                                                    <div class="text-xs text-gray-400 font-mono mt-0.5 flex items-center gap-1">
                                                        {task.scheduleId?.slice(0, 10)}...
                                                        <button class="hover:text-white" onClick={() => copyToClipboard(task.scheduleId || '')}><Copy class="w-2.5 h-2.5" /></button>
                                                    </div>
                                                </div>

                                                <div class="col-span-2">
                                                    <span class="text-[9px] text-gray-500 uppercase font-bold">Timeline</span>
                                                    <div class="flex items-center gap-1 mt-1.5">
                                                        <div class={`h-1 flex-1 rounded-full ${['WAITING', 'EXECUTING', 'SENT'].includes(task.status) ? 'bg-blue-500' : 'bg-gray-700'}`} />
                                                        <div class={`h-1 flex-1 rounded-full ${['EXECUTING', 'SENT'].includes(task.status) ? 'bg-amber-500' : 'bg-gray-700'}`} />
                                                        <div class={`h-1 flex-1 rounded-full ${task.status === 'SENT' ? 'bg-emerald-500' : 'bg-gray-700'}`} />
                                                    </div>
                                                    <div class="flex justify-between text-[9px] text-gray-500 mt-1 px-0.5 font-medium">
                                                        <span>Locked</span>
                                                        <span>Exec</span>
                                                        <span>Done</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div class="flex gap-2 pt-2 border-t border-white/5">
                                                <Show when={['WAITING', 'EXECUTING'].includes(task.status)}>
                                                    <button
                                                        onClick={(e) => handleCancel(task.scheduleId, e)}
                                                        disabled={isCancelling() === task.scheduleId}
                                                        class="flex-1 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                                                    >
                                                        <Show when={isCancelling() === task.scheduleId} fallback={<><Ban class="w-3 h-3" /> {task.status === 'EXECUTING' ? 'Stop' : 'Cancel'}</>}>
                                                            <div class="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                                        </Show>
                                                    </button>

                                                    {/* Force Run / Retry Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            props.onForceExecute?.(task.id);
                                                        }}
                                                        class={`w-10 py-2 border rounded-lg flex items-center justify-center transition-colors ${task.status === 'EXECUTING'
                                                            ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400'
                                                            : 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30 text-green-400'}`}
                                                        title={task.status === 'EXECUTING' ? "Force Retry" : "Execute Now"}
                                                    >
                                                        <Play class="w-3 h-3 fill-current" />
                                                    </button>
                                                </Show>

                                                <Show when={!['WAITING', 'EXECUTING'].includes(task.status)}>
                                                    <button
                                                        onClick={() => window.open(`https://vision-scan.com/tx/${task.txHash}`, '_blank')}
                                                        class="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <ExternalLink class="w-3 h-3" /> View TX
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
            </Show>
        </Presence>
    );
};

export default QueueDrawer;
