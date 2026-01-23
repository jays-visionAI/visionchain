import { createSignal, Show } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Sparkles,
    Zap,
    MessageSquare,
    Globe,
    ChevronRight,
    Shield,
    Cpu,
    Coins,
} from 'lucide-solid';
import AdminAIManagement from './AdminAIManagement';

export default function AdminSettings() {
    const [settingsSubView, setSettingsSubView] = createSignal<'main' | 'ai' | 'infra' | 'gov'>('main');

    return (
        <div class="max-w-4xl mx-auto pb-20">
            <Show when={settingsSubView() === 'main'}>
                <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div class="mb-8">
                        <h1 class="text-3xl font-bold text-white tracking-tight">Admin Console</h1>
                        <p class="text-gray-400 mt-1">Global node configuration and system-wide intelligence settings.</p>
                    </div>

                    <div class="space-y-6">
                        {/* Section 1: Intelligence */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Intelligence & AI</h2>
                            <div class="grid gap-3">
                                {/* AI Management Card */}
                                <div
                                    onClick={() => setSettingsSubView('ai')}
                                    class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.08] hover:border-indigo-500/30 transition-all cursor-pointer group relative overflow-hidden"
                                >
                                    <div class="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div class="flex items-center justify-between relative z-10">
                                        <div class="flex items-center gap-4">
                                            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                                                <Sparkles class="w-6 h-6 group-hover:scale-110 transition-transform" />
                                            </div>
                                            <div>
                                                <div class="font-bold text-white group-hover:text-indigo-300 transition-colors">AI Engine Management</div>
                                                <div class="text-xs text-gray-500 mt-0.5">Dual-bot config, API keys, and knowledge systems</div>
                                            </div>
                                        </div>
                                        <ChevronRight class="w-5 h-5 text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Infrastructure */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Infrastructure & Network</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center gap-4 mb-4">
                                        <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                            <Cpu class="w-5 h-5" />
                                        </div>
                                        <div class="font-bold text-white">RPC Node Pool</div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">4 Active Nodes</span>
                                        <span class="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full font-bold">Healthy</span>
                                    </div>
                                </div>

                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center gap-4 mb-4">
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <Globe class="w-5 h-5" />
                                        </div>
                                        <div class="font-bold text-white">Relayer Config</div>
                                    </div>
                                    <div class="flex items-center justify-between">
                                        <span class="text-xs text-gray-500">Fast Gasless Tx</span>
                                        <div class="w-10 h-5 bg-blue-500/20 rounded-full flex items-center px-1">
                                            <div class="w-3 h-3 bg-blue-400 rounded-full ml-auto" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Ecosystem */}
                        <div class="space-y-3">
                            <h2 class="text-xs font-black text-gray-500 uppercase tracking-[0.2em] ml-1">Ecosystem & Governance</h2>
                            <div class="grid gap-3">
                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                                                <Coins class="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">Tokenomics & Vesting</div>
                                                <div class="text-xs text-gray-500">Manage reward curves and lockup periods</div>
                                            </div>
                                        </div>
                                        <ChevronRight class="w-5 h-5 text-gray-700" />
                                    </div>
                                </div>

                                <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.04] transition-all cursor-not-allowed group opacity-80">
                                    <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-4">
                                            <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-400">
                                                <MessageSquare class="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div class="font-bold text-white">System Broadcasts</div>
                                                <div class="text-xs text-gray-500">Push high-priority alerts to all users</div>
                                            </div>
                                        </div>
                                        <div class="w-10 h-5 bg-white/5 rounded-full flex items-center px-1">
                                            <div class="w-3 h-3 bg-gray-600 rounded-full" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Motion.div>
            </Show>

            <Show when={settingsSubView() === 'ai'}>
                <Motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <button
                        onClick={() => setSettingsSubView('main')}
                        class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                    >
                        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                            <ChevronRight class="w-4 h-4 rotate-180" />
                        </div>
                        <span class="font-bold text-sm">Back to Admin Console</span>
                    </button>
                    <AdminAIManagement />
                </Motion.div>
            </Show>
        </div>
    );
}

