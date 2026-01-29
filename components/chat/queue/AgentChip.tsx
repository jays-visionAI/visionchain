import { createMemo, Show, createSignal, createEffect, onCleanup } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Motion } from 'solid-motionone';
import { Clock, Check, AlertTriangle, Loader2, X, Repeat, Shield, Wallet, Play, Layers } from 'lucide-solid';

export type TaskStatus = 'WAITING' | 'EXECUTING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type AgentType = 'TIMELOCK' | 'BRIDGE' | 'SWAP' | 'STAKE' | 'BATCH';

export interface AgentTask {
    id: string;
    type: AgentType;
    summary: string;
    status: TaskStatus;
    timeLeft?: string;
    timestamp: number;
    executeAt?: number;
    progress?: number;
}

interface AgentChipProps {
    task: AgentTask;
    isCompact?: boolean;
    onClick?: () => void;
}

const STATUS_CONFIG: Record<TaskStatus, any> = {
    WAITING: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/50',
        accent: 'bg-blue-500',
        color: 'text-blue-400',
        textColor: 'text-blue-50',
        label: 'Scheduled',
        animate: {
            borderColor: ['rgba(59,130,246,0.3)', 'rgba(59,130,246,0.8)', 'rgba(59,130,246,0.3)'],
        }
    },
    EXECUTING: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/50',
        accent: 'bg-amber-500',
        color: 'text-amber-400',
        textColor: 'text-amber-50',
        label: 'In Progress',
        animate: {
            opacity: [0.8, 1, 0.8],
        }
    },
    SENT: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        accent: 'bg-emerald-500',
        color: 'text-emerald-400',
        textColor: 'text-emerald-50',
        label: 'Success',
        animate: {}
    },
    FAILED: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        accent: 'bg-red-500',
        color: 'text-red-400',
        textColor: 'text-red-50',
        label: 'Failed',
        animate: { x: [-1, 1, -1, 1, 0] }
    },
    CANCELLED: {
        bg: 'bg-neutral-800/50',
        border: 'border-white/10',
        accent: 'bg-neutral-500',
        color: 'text-neutral-400',
        textColor: 'text-neutral-300',
        label: 'Cancelled',
        animate: {}
    },
    EXPIRED: {
        bg: 'bg-neutral-900/50',
        border: 'border-white/5',
        accent: 'bg-neutral-700',
        color: 'text-neutral-500',
        textColor: 'text-neutral-400',
        label: 'Expired',
        animate: {}
    }
};

const AGENT_ICONS: Record<AgentType, any> = {
    TIMELOCK: Clock,
    BATCH: Layers,
    BRIDGE: Wallet,
    SWAP: Repeat,
    STAKE: Shield
};

const AgentChip = (props: AgentChipProps) => {
    const config = createMemo(() => STATUS_CONFIG[props.task.status]);
    const BaseIcon = createMemo(() => AGENT_ICONS[props.task.type] || Clock);

    const DisplayIcon = createMemo(() => {
        switch (props.task.status) {
            case 'EXECUTING': return Loader2;
            case 'SENT': return Check;
            case 'FAILED': return AlertTriangle;
            default: return BaseIcon();
        }
    });

    const formatTime = (ts: number) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    // Real-time Ticker for Overdue Status
    const [currentTime, setCurrentTime] = createSignal(Date.now());

    // Only run interval if task is waiting
    createEffect(() => {
        if (props.task.status === 'WAITING') {
            const timer = setInterval(() => setCurrentTime(Date.now()), 1000); // 1s tick
            onCleanup(() => clearInterval(timer));
        }
    });

    const timeStatus = createMemo(() => {
        if (props.task.status !== 'WAITING') return props.task.timeLeft || '';
        if (!props.task.executeAt) return props.task.timeLeft || '';

        const diff = props.task.executeAt - currentTime();
        if (diff > 0) {
            // Format remaining time: show only largest necessary units
            const totalSeconds = Math.floor(diff / 1000);
            const days = Math.floor(totalSeconds / 86400);
            const hours = Math.floor((totalSeconds % 86400) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            let parts: string[] = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0 || days > 0) parts.push(`${hours}h`);
            if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            // Remove leading zeros for cleaner display
            if (days === 0) {
                parts = parts.filter(p => !p.startsWith('0'));
                if (hours === 0) {
                    parts = parts.filter(p => !p.includes('h'));
                }
            }

            return parts.join(' ');
        } else {
            // Overdue logic
            const overdueSecs = Math.abs(Math.floor(diff / 1000));
            if (overdueSecs < 60) return `Due Now`;
            return `Overdue (${Math.ceil(overdueSecs / 60)}m)`;
        }
    });

    return (
        <Motion.button
            class={`relative flex flex-col group rounded-2xl border backdrop-blur-xl transition-all active:scale-[0.98] text-left overflow-hidden
            ${config().bg} ${config().border} 
            ${props.isCompact ? 'px-3 py-2 min-w-[140px]' : 'p-3.5 min-w-[220px] max-w-[280px] shadow-2xl shadow-black/40'}`}
            animate={config().animate}
            transition={{ duration: 2, repeat: Infinity }}
            onClick={props.onClick}
        >
            {/* Top Bar: Icon + Status */}
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <div class={`w-7 h-7 rounded-lg flex items-center justify-center border ${config().border} bg-black/40`}>
                        <Dynamic component={DisplayIcon()} class={`w-3.5 h-3.5 ${config().color} ${props.task.status === 'EXECUTING' ? 'animate-spin' : ''}`} />
                    </div>
                    <span class="text-[10px] font-black text-white uppercase tracking-widest opacity-80">
                        {props.task.type === 'TIMELOCK' ? 'Time Lock Agent' : 'Batch Agent'}
                    </span>
                </div>
                <div class={`px-1.5 py-0.5 rounded-md border ${config().border} bg-black/20`}>
                    <span class={`text-[8px] font-black uppercase tracking-tighter ${config().color}`}>
                        {config().label}
                    </span>
                </div>
            </div>

            {/* Content Section */}
            <div class="flex flex-col gap-1 my-1">
                <span class={`text-[12px] font-bold leading-tight truncate ${config().textColor}`}>
                    {props.task.summary}
                </span>
            </div>

            {/* Timeline Section (Hidden in compact) */}
            <Show when={!props.isCompact}>
                <div class="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                            <span class="text-[8px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                                <Play class="w-2 h-2" /> Task Started
                            </span>
                            <span class="text-[10px] font-mono text-neutral-300">
                                {formatTime(props.task.timestamp)}
                            </span>
                        </div>

                        <div class="flex flex-col items-end">
                            <span class="text-[8px] font-bold text-neutral-500 uppercase tracking-wide flex items-center gap-1">
                                <Clock class="w-2 h-2" /> Scheduled Target
                            </span>
                            <span class={`text-[10px] font-mono ${props.task.status === 'WAITING' ? 'text-blue-400' : 'text-neutral-500'}`}>
                                {props.task.status === 'WAITING' ? timeStatus() : (props.task.executeAt ? formatTime(props.task.executeAt) : (props.task.timeLeft || '--:--'))}
                            </span>
                        </div>
                    </div>

                    {/* Progress Visual */}
                    <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <Motion.div
                            class={`h-full ${config().accent} opacity-40`}
                            initial={{ width: '0%' }}
                            animate={{ width: props.task.status === 'SENT' ? '100%' : (props.task.status === 'EXECUTING' ? (props.task.progress ? `${props.task.progress}%` : '60%') : '10%') }}
                        />
                    </div>
                </div>
            </Show>

            {/* Compact Indicator */}
            <Show when={props.isCompact}>
                <div class="mt-1 flex items-center gap-1.5">
                    <span class={`text-[9px] font-mono ${config().color}`}>
                        {timeStatus() || config().label}
                    </span>
                </div>
            </Show>

            {/* Background Glow */}
            <div class={`absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl opacity-10 ${config().accent}`} />
        </Motion.button>
    );
};

export default AgentChip;
