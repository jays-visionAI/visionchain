import { For } from 'solid-js';
import { BarChart3, Zap, MessageSquare, Image as ImageIcon, Volume2 } from 'lucide-solid';

interface UsageStatsTabProps {
    stats: any;
}

export function UsageStatsTab(props: UsageStatsTabProps) {
    return (
        <div class="space-y-6">
            <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                <BarChart3 class="w-5 h-5 text-cyan-400" />
                Usage Statistics
            </h2>

            {/* Stats Cards */}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-4">
                    <div class="flex items-center gap-2 text-cyan-400 mb-2">
                        <Zap class="w-4 h-4" />
                        <span class="text-xs font-medium">Total API Calls</span>
                    </div>
                    <p class="text-2xl font-bold text-white">{props.stats.totalCalls.toLocaleString()}</p>
                </div>

                <div class="rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-4">
                    <div class="flex items-center gap-2 text-blue-400 mb-2">
                        <MessageSquare class="w-4 h-4" />
                        <span class="text-xs font-medium">Text Requests</span>
                    </div>
                    <p class="text-2xl font-bold text-white">{props.stats.textCalls.toLocaleString()}</p>
                </div>

                <div class="rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 p-4">
                    <div class="flex items-center gap-2 text-purple-400 mb-2">
                        <ImageIcon class="w-4 h-4" />
                        <span class="text-xs font-medium">Image Generations</span>
                    </div>
                    <p class="text-2xl font-bold text-white">{props.stats.imageCalls.toLocaleString()}</p>
                </div>

                <div class="rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/20 p-4">
                    <div class="flex items-center gap-2 text-orange-400 mb-2">
                        <Volume2 class="w-4 h-4" />
                        <span class="text-xs font-medium">Voice Synthesis</span>
                    </div>
                    <p class="text-2xl font-bold text-white">{props.stats.voiceCalls.toLocaleString()}</p>
                </div>
            </div>

            {/* Chart Area */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                <h3 class="text-white font-medium mb-4">Weekly API Calls</h3>
                <div class="flex items-end justify-between h-48 gap-2">
                    {(() => {
                        const maxCalls = Math.max(...props.stats.dailyData.map((d: any) => d.calls));
                        return (
                            <For each={props.stats.dailyData}>
                                {(data: any) => {
                                    const height = (data.calls / maxCalls) * 100;
                                    return (
                                        <div class="flex-1 flex flex-col items-center gap-2">
                                            <div
                                                class="w-full bg-gradient-to-t from-cyan-500 to-blue-500 rounded-t-lg transition-all hover:from-cyan-400 hover:to-blue-400"
                                                style={{ height: `${height}%` }}
                                            />
                                            <span class="text-xs text-gray-500">{data.day}</span>
                                        </div>
                                    );
                                }}
                            </For>
                        );
                    })()}
                </div>
            </div>

            {/* Performance Metrics */}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400">Average Response Time</span>
                        <span class="text-white font-semibold">{props.stats.avgResponseTime}</span>
                    </div>
                    <div class="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full w-[75%] bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" />
                    </div>
                </div>

                <div class="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400">Success Rate</span>
                        <span class="text-green-400 font-semibold">{props.stats.successRate}%</span>
                    </div>
                    <div class="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${props.stats.successRate}%` }} />
                    </div>
                </div>
            </div>
        </div>
    );
}
