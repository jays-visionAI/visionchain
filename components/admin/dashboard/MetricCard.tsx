import { Component, Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface MetricCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    trend?: number; // percentage
    icon?: any;
    color?: 'blue' | 'green' | 'amber' | 'purple' | 'cyan';
    class?: string;
    children?: JSX.Element;
}

export const MetricCard: Component<MetricCardProps> = (props) => {
    const colorClasses: Record<string, string> = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20 shadow-blue-500/10',
        green: 'text-green-400 bg-green-500/10 border-green-500/20 shadow-green-500/10',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-amber-500/10',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20 shadow-purple-500/10',
        cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 shadow-cyan-500/10',
    };

    const activeColor = () => props.color ? colorClasses[props.color] : colorClasses.blue;

    return (
        <div
            class={`relative p-6 rounded-2xl bg-[#13161F] border border-white/5 backdrop-blur-xl group hover:border-white/10 transition-all duration-300 ${props.class || ''}`}
        >
            {/* Header */}
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{props.title}</h3>
                    <div class="flex items-end gap-2">
                        <span class="text-2xl font-black text-white">{props.value}</span>
                        <Show when={props.subValue}>
                            <span class="text-xs font-medium text-slate-500 mb-1">{props.subValue}</span>
                        </Show>
                    </div>
                </div>
                <Show when={props.icon}>
                    {(() => {
                        const Icon = props.icon;
                        return (
                            <div class={`p-2.5 rounded-xl ${activeColor()}`}>
                                <Icon class="w-5 h-5" />
                            </div>
                        );
                    })()}
                </Show>
            </div>

            {/* Content / Chart Area */}
            <div class="relative">
                {props.children}
            </div>

            {/* Footer / Trend */}
            <Show when={props.trend !== undefined}>
                <div class="mt-4 flex items-center gap-2 text-xs font-bold">
                    <span class={props.trend! >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {props.trend! > 0 ? '+' : ''}{props.trend}%
                    </span>
                    <span class="text-slate-600 uppercase tracking-wider">vs last 24h</span>
                </div>
            </Show>
        </div>
    );
};
