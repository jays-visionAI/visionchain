import { createSignal, Show } from 'solid-js';
import { Motion } from 'solid-motionone';
import {
    Sparkles,
    Zap,
    MessageSquare,
    Globe,
    ChevronRight,
} from 'lucide-solid';
import AdminAIManagement from './AdminAIManagement';

export default function AdminSettings() {
    const [settingsSubView, setSettingsSubView] = createSignal<'main' | 'ai'>('main');

    return (
        <div class="max-w-4xl mx-auto">
            <Show when={settingsSubView() === 'main'}>
                <Motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div class="mb-8">
                        <h1 class="text-3xl font-bold text-white">Admin Settings</h1>
                        <p class="text-gray-400 mt-1">Configure system-wide settings and AI integrations.</p>
                    </div>

                    <div class="grid gap-4">
                        {/* AI Management Card */}
                        <div
                            onClick={() => setSettingsSubView('ai')}
                            class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.02] transition-all cursor-pointer group"
                        >
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                                        <Sparkles class="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                                    </div>
                                    <div>
                                        <div class="font-medium text-white group-hover:text-indigo-300 transition-colors">AI Management</div>
                                        <div class="text-sm text-gray-500">Configure API keys, models, and knowledge base</div>
                                    </div>
                                </div>
                                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                    <ChevronRight class="w-4 h-4 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        {/* Other Admin Settings Placeholders */}
                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                        <Zap class="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <div class="font-medium text-white">System Performance</div>
                                        <div class="text-sm text-gray-500">Optimized for high throughput</div>
                                    </div>
                                </div>
                                <div class="w-14 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center px-1 shadow-lg shadow-blue-500/20">
                                    <div class="w-6 h-6 bg-white rounded-full ml-auto shadow-md" />
                                </div>
                            </div>
                        </div>

                        <div class="bg-[#15151a] border border-white/[0.06] rounded-2xl p-5">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-4">
                                    <div class="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                        <MessageSquare class="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <div class="font-medium text-white">System Notifications</div>
                                        <div class="text-sm text-gray-500">Global alerts for all users</div>
                                    </div>
                                </div>
                                <div class="w-14 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full flex items-center px-1 shadow-lg shadow-blue-500/20">
                                    <div class="w-6 h-6 bg-white rounded-full ml-auto shadow-md" />
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
                        class="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronRight class="w-4 h-4 rotate-180" />
                        <span class="font-medium">Back to Settings</span>
                    </button>
                    <AdminAIManagement />
                </Motion.div>
            </Show>
        </div>
    );
}
