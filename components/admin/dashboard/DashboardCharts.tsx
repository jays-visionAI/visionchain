import { Component, mergeProps, For } from 'solid-js';

// ==================== TPS Gauge (CSS-based Speedometer) ====================
interface TPSGaugeProps {
    value: number;
    max: number;
    label?: string;
}

export const TPSGauge: Component<TPSGaugeProps> = (props) => {
    const merged = mergeProps({ max: 15000, label: 'TPS' }, props);

    // Calculate percentage  
    const percentage = () => Math.min(100, (props.value / merged.max) * 100);

    return (
        <div class="relative w-64 h-64 mx-auto">
            {/* Background Circle */}
            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                {/* Track */}
                <circle
                    cx="50" cy="50" r="40"
                    stroke="#1e293b"
                    stroke-width="8"
                    fill="none"
                    stroke-dasharray="188.5"
                    stroke-dashoffset="62.8"
                    stroke-linecap="round"
                />
                {/* Progress */}
                <circle
                    cx="50" cy="50" r="40"
                    stroke="url(#gaugeGradient)"
                    stroke-width="8"
                    fill="none"
                    stroke-dasharray="188.5"
                    stroke-dashoffset={188.5 - (percentage() * 1.885 * 0.67)}
                    stroke-linecap="round"
                    class="transition-all duration-500"
                />
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#3b82f6" />
                        <stop offset="100%" stop-color="#06b6d4" />
                    </linearGradient>
                </defs>
            </svg>

            {/* Center Value */}
            <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span class="text-4xl font-black text-white">{props.value.toLocaleString()}</span>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{merged.label}</span>
            </div>

            {/* Glow */}
            <div class="absolute inset-0 bg-blue-500/20 blur-[40px] rounded-full pointer-events-none" />
        </div>
    );
};

// ==================== Node Health Chart (Simple SVG Line) ====================
export const NodeHealthChart: Component = () => {
    const data = [45, 47, 48, 47, 49, 50, 52, 53, 55, 54, 56, 57, 58, 60];
    const maxVal = Math.max(...data);
    const minVal = Math.min(...data);
    const range = maxVal - minVal || 1;

    // Generate SVG path
    const pathD = () => {
        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - ((val - minVal) / range) * 80 - 10;
            return `${x} ${y}`;
        });
        return `M ${points.join(' L ')}`;
    };

    const areaD = () => `${pathD()} L 100 100 L 0 100 Z`;

    return (
        <svg class="w-full h-24" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
                <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#22c55e" stop-opacity="0.4" />
                    <stop offset="100%" stop-color="#22c55e" stop-opacity="0" />
                </linearGradient>
            </defs>
            <path d={areaD()} fill="url(#nodeGradient)" />
            <path d={pathD()} fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" />
        </svg>
    );
};

// ==================== Activity Map (Bar Chart) ====================
export const ActivityMap: Component = () => {
    const chartData = [
        { day: 'Mon', value: 400 },
        { day: 'Tue', value: 550 },
        { day: 'Wed', value: 480 },
        { day: 'Thu', value: 890 },
        { day: 'Fri', value: 1200 },
        { day: 'Sat', value: 1100 },
        { day: 'Sun', value: 950 },
    ];
    const maxVal = Math.max(...chartData.map(d => d.value));

    return (
        <div class="flex items-end gap-2 h-full">
            <For each={chartData}>
                {(item) => (
                    <div class="flex-1 flex flex-col items-center gap-2">
                        <div
                            class="w-full bg-indigo-500 rounded-t-lg transition-all duration-300 hover:bg-indigo-400"
                            style={{ height: `${(item.value / maxVal) * 100}%`, 'min-height': '4px' }}
                        />
                        <span class="text-[10px] font-bold text-slate-500">{item.day}</span>
                    </div>
                )}
            </For>
        </div>
    );
};

// ==================== TVL Pie Chart (CSS Donut) ====================
export const TVLPieChart: Component = () => {
    const pieData = [
        { label: 'Liquidity', value: 45, color: '#06b6d4', start: 0 },
        { label: 'Staking', value: 30, color: '#3b82f6', start: 45 },
        { label: 'Lending', value: 15, color: '#8b5cf6', start: 75 },
        { label: 'Derivs', value: 10, color: '#a855f7', start: 90 },
    ];

    const circumference = Math.PI * 60; // radius 30 * 2 * PI

    return (
        <div class="flex flex-col items-center gap-4">
            {/* Donut */}
            <div class="relative w-40 h-40">
                <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <For each={pieData}>
                        {(seg) => (
                            <circle
                                cx="50" cy="50" r="30"
                                stroke={seg.color}
                                stroke-width="15"
                                fill="none"
                                stroke-dasharray={`${(seg.value / 100) * circumference} ${circumference}`}
                                stroke-dashoffset={-(seg.start / 100) * circumference}
                            />
                        )}
                    </For>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-xl font-black text-white">$100M</span>
                    <span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total TVL</span>
                </div>
            </div>

            {/* Legend */}
            <div class="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <For each={pieData}>
                    {(item) => (
                        <div class="flex items-center gap-1.5">
                            <div class="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span class="text-[10px] font-bold text-slate-400">{item.label}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

// ==================== Node Distribution Chart (Stacked Segmented Bar) ====================
interface NodeDistributionProps {
    data: {
        authority: number;
        consensus: number;
        agent: number;
        edge: number;
    };
}

export const NodeDistributionChart: Component<NodeDistributionProps> = (props) => {
    const total = () => props.data.authority + props.data.consensus + props.data.agent + props.data.edge;

    const segments = [
        { label: 'Authority', key: 'authority', color: 'bg-blue-500', shadow: 'shadow-blue-500/50' },
        { label: 'Consensus', key: 'consensus', color: 'bg-green-500', shadow: 'shadow-green-500/50' },
        { label: 'Agent', key: 'agent', color: 'bg-purple-500', shadow: 'shadow-purple-500/50' },
        { label: 'Edge', key: 'edge', color: 'bg-slate-500', shadow: 'shadow-slate-500/50' },
    ];

    return (
        <div class="space-y-4">
            <div class="h-3 w-full flex rounded-full overflow-hidden bg-white/5">
                <For each={segments}>
                    {(seg) => (
                        <div
                            class={`${seg.color} h-full transition-all duration-1000 ease-out ${seg.shadow} shadow-[0_0_15px_rgba(0,0,0,0.3)]`}
                            style={{ width: `${(props.data[seg.key as keyof typeof props.data] / total()) * 100}%` }}
                        />
                    )}
                </For>
            </div>
            <div class="grid grid-cols-2 gap-y-2 gap-x-4">
                <For each={segments}>
                    {(seg) => (
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <div class={`w-1.5 h-1.5 rounded-full ${seg.color}`} />
                                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{seg.label}</span>
                            </div>
                            <span class="text-[10px] font-mono text-white">{props.data[seg.key as keyof typeof props.data]}</span>
                        </div>
                    )}
                </For>
            </div>
        </div>
    );
};

// ==================== Resource Metric Group (GPU/Storage) ====================
import { Cpu, Database } from 'lucide-solid';

interface ResourceMetricsProps {
    gpuTflops: number;
    storageTb: number;
}

export const ResourceMetricGroup: Component<ResourceMetricsProps> = (props) => {
    return (
        <div class="grid grid-cols-2 gap-4 w-full">
            <div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.05] transition-all">
                <div class="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                    <Cpu class="w-5 h-5" />
                </div>
                <div>
                    <span class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Compute Power</span>
                    <div class="flex items-baseline gap-1">
                        <span class="text-xl font-black text-white">{props.gpuTflops.toLocaleString()}</span>
                        <span class="text-[10px] font-bold text-cyan-400 uppercase">TFLOPS</span>
                    </div>
                </div>
            </div>

            <div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.05] transition-all">
                <div class="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-110 transition-transform">
                    <Database class="w-5 h-5" />
                </div>
                <div>
                    <span class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Network Storage</span>
                    <div class="flex items-baseline gap-1">
                        <span class="text-xl font-black text-white">{props.storageTb.toLocaleString()}</span>
                        <span class="text-[10px] font-bold text-purple-400 uppercase">TB</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
// ==================== Economic Metric Group (Incentives/Revenue) ====================
import { Coins, Flame } from 'lucide-solid';

interface EconomicMetricsProps {
    distributed: number;
    burned: number;
}

export const EconomicMetricGroup: Component<EconomicMetricsProps> = (props) => {
    return (
        <div class="grid grid-cols-2 gap-4 w-full">
            <div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.05] transition-all">
                <div class="p-3 rounded-xl bg-green-500/10 text-green-400 group-hover:scale-110 transition-transform">
                    <Coins class="w-5 h-5" />
                </div>
                <div>
                    <span class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Rewards</span>
                    <div class="flex items-baseline gap-1">
                        <span class="text-xl font-black text-white">{props.distributed.toLocaleString()}</span>
                        <span class="text-[10px] font-bold text-green-400 uppercase">VCN</span>
                    </div>
                </div>
            </div>

            <div class="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/[0.05] transition-all">
                <div class="p-3 rounded-xl bg-orange-500/10 text-orange-400 group-hover:scale-110 transition-transform">
                    <Flame class="w-5 h-5" />
                </div>
                <div>
                    <span class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tokens Burned</span>
                    <div class="flex items-baseline gap-1">
                        <span class="text-xl font-black text-white">{props.burned.toLocaleString()}</span>
                        <span class="text-[10px] font-bold text-orange-400 uppercase">VCN</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
