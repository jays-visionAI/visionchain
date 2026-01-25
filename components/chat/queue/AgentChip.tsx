import { createMemo, Show } from 'solid-js';
import { Motion } from 'solid-motionone';
import { Clock, Check, AlertTriangle, Loader2, X, Repeat, Shield, Wallet } from 'lucide-solid';

export type TaskStatus = 'WAITING' | 'EXECUTING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type AgentType = 'TIMELOCK' | 'BRIDGE' | 'SWAP' | 'STAKE';

export interface AgentTask {
    id: string;
    type: AgentType;
    summary: string;
    status: TaskStatus;
    timeLeft?: string;
    timestamp: number;
    // ... extendable fields
}

interface AgentChipProps {
    task: AgentTask;
    isCompact?: boolean;
    onClick?: () => void;
}

// 1. Config Object for Status Styles (Easy to Extend)
const STATUS_CONFIG: Record<TaskStatus, any> = {
    WAITING: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/50',
        glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
        color: 'text-blue-400',
        textColor: 'text-blue-100',
        subTextColor: 'text-blue-300',
        animate: {
            scale: [1, 1.02, 1],
            borderColor: ['rgba(59,130,246,0.5)', 'rgba(59,130,246,0.8)', 'rgba(59,130,246,0.5)'],
            boxShadow: ['0 0 10px rgba(59,130,246,0.3)', '0 0 20px rgba(59,130,246,0.6)', '0 0 10px rgba(59,130,246,0.3)']
        },
        transition: { duration: 3, repeat: Infinity, easing: "ease-in-out" }
    },
    EXECUTING: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/50',
        glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
        color: 'text-amber-400',
        textColor: 'text-amber-100',
        subTextColor: 'text-amber-300',
        animate: { opacity: 1 },
        transition: {}
    },
    SENT: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        glow: '',
        color: 'text-emerald-400',
        textColor: 'text-emerald-100',
        subTextColor: 'text-emerald-400',
        animate: { opacity: 1 },
        transition: {}
    },
    FAILED: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        glow: '',
        color: 'text-red-400',
        textColor: 'text-red-100',
        subTextColor: 'text-red-400',
        animate: { x: [-2, 2, -2, 2, 0] },
        transition: { duration: 0.4 }
    },
    CANCELLED: {
        bg: 'bg-gray-500/5',
        border: 'border-gray-500/20',
        glow: '',
        color: 'text-gray-500',
        textColor: 'text-gray-400',
        subTextColor: 'text-gray-500',
        animate: { opacity: 0.7 },
        transition: {}
    },
    EXPIRED: {
        bg: 'bg-gray-500/5',
        border: 'border-gray-500/20',
        glow: '',
        color: 'text-gray-500',
        textColor: 'text-gray-400',
        subTextColor: 'text-gray-500',
        animate: { opacity: 0.7 },
        transition: {}
    }
};

// 2. Config Object for Agent Type Icons
const AGENT_ICONS: Record<AgentType, any> = {
    TIMELOCK: Clock,
    BRIDGE: Wallet, // Placeholder
    SWAP: Repeat,
    STAKE: Shield
};

const AgentChip = (props: AgentChipProps) => {
    const config = createMemo(() => STATUS_CONFIG[props.task.status]);
    const BaseIcon = createMemo(() => AGENT_ICONS[props.task.type] || Clock);

    // Determine which icon key to use or return the component directly
    const DisplayIcon = createMemo(() => {
        switch (props.task.status) {
            case 'EXECUTING': return Loader2;
            case 'SENT': return Check;
            case 'FAILED': return AlertTriangle;
            case 'CANCELLED': return X;
            default: return BaseIcon();
        }
    });

    return (
        <Motion.button
            class={`relative flex items-center gap-3 rounded-xl border backdrop-blur-md transition-all active:scale-95 text-left 
            ${config().bg} ${config().border} ${config().glow}
            ${props.isCompact ? 'px-2 py-1.5' : 'px-3 py-2 min-w-[160px] max-w-[220px]'}`}
            animate={config().animate}
            transition={config().transition}
            onClick={props.onClick}
            title={props.task.summary}
        >
            {/* Icon Circle */}
            <div class={`${props.isCompact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center shrink-0 border ${config().border} bg-black/20 transition-all`}>
                <Dynamic component={DisplayIcon()} class={`${props.isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${config().color} ${props.task.status === 'EXECUTING' ? 'animate-spin' : ''}`} />
            </div>

            {/* Text Content - Hidden in Compact Mode */}
            <Show when={!props.isCompact}>
                <div class="flex flex-col min-w-0">
                    <span class={`text-[11px] font-bold truncate ${config().textColor}`}>
                        {props.task.summary}
                    </span>
                    <div class="flex items-center gap-1.5">
                        <span class={`text-[9px] font-medium uppercase tracking-wide flex items-center gap-1 ${config().subTextColor}`}>
                            {props.task.status === 'WAITING' && props.task.timeLeft ? (
                                <>
                                    <Clock class="w-2 h-2" />
                                    {props.task.timeLeft}
                                </>
                            ) : (
                                props.task.status
                            )}
                        </span>
                    </div>
                </div>
            </Show>

            {/* Waiting Pulse Ring */}
            <Show when={props.task.status === 'WAITING' && !props.isCompact}>
                <div class="absolute inset-0 rounded-xl border border-blue-400/30 animate-ping opacity-20 pointer-events-none" />
            </Show>
        </Motion.button>
    );
};

export default AgentChip;
