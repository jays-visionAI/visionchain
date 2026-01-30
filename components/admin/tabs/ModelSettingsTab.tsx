import { createSignal, Show } from 'solid-js';
import { Settings2, Bot, Power, Zap, Image as ImageIcon, Mic, Save, Check } from 'lucide-solid';
import { BotConfig } from '../../../services/firebaseService';

interface ModelSettingsTabProps {
    intentBot: () => BotConfig;
    setIntentBot: (val: BotConfig) => void;
    helpdeskBot: () => BotConfig;
    setHelpdeskBot: (val: BotConfig) => void;
    imageSettings: () => any;
    setImageSettings: (val: any) => void;
    voiceSettings: () => any;
    setVoiceSettings: (val: any) => void;
    onSave: () => Promise<void>;
    isSaving: () => boolean;
    saveSuccess: () => boolean;
}

export function ModelSettingsTab(props: ModelSettingsTabProps) {
    return (
        <div class="space-y-8">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <Settings2 class="w-5 h-5 text-cyan-400" />
                    Model Configuration
                </h2>
                <button
                    onClick={() => props.onSave()}
                    disabled={props.isSaving()}
                    class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                >
                    <Save class="w-4 h-4" />
                    {props.isSaving() ? 'Saving...' : 'Save All Settings'}
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Intent Bot */}
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-xl bg-blue-500/20">
                                <Bot class="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 class="text-white font-bold">Intent Engine Bot</h3>
                                <p class="text-gray-500 text-xs">Primary wallet interface AI</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded">Active</span>
                        </div>
                    </div>
                    <div class="space-y-4 pt-2">
                        {/* Text Chat Model - DeepSeek */}
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Text Chat Model</label>
                            <select
                                value={props.intentBot().model}
                                onChange={(e) => props.setIntentBot({ ...props.intentBot(), model: e.currentTarget.value })}
                                class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500/50"
                            >
                                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                            </select>
                        </div>
                        {/* Vision Model - Gemini Nano Banana */}
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Vision / Image Analysis</label>
                            <select
                                value={props.intentBot().visionModel || 'gemini-2.0-flash-exp'}
                                onChange={(e) => props.setIntentBot({ ...props.intentBot(), visionModel: e.currentTarget.value })}
                                class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                            >
                                <option value="gemini-2.0-flash-exp">Nano Banana (gemini-2.0-flash-exp)</option>
                                <option value="gemini-2.5-pro-preview-06-05">Nano Banana Pro (gemini-2.5-pro)</option>
                            </select>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span class="text-xs text-gray-400">Response Speed</span>
                            <span class="text-xs font-bold text-blue-400">High</span>
                        </div>
                    </div>
                </div>

                {/* Helpdesk Bot */}
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="p-2 rounded-xl bg-purple-500/20">
                                <Bot class="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 class="text-white font-bold">Helpdesk Bot</h3>
                                <p class="text-gray-500 text-xs">Knowledge-based support AI</p>
                            </div>
                        </div>
                    </div>
                    <div class="space-y-4 pt-2">
                        {/* Text Chat Model - DeepSeek */}
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Text Chat Model</label>
                            <select
                                value={props.helpdeskBot().model}
                                onChange={(e) => props.setHelpdeskBot({ ...props.helpdeskBot(), model: e.currentTarget.value })}
                                class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                            >
                                <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                                <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                            </select>
                        </div>
                        {/* Vision Model - Gemini Nano Banana */}
                        <div class="space-y-1.5">
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Vision / Image Analysis</label>
                            <select
                                value={props.helpdeskBot().visionModel || 'gemini-2.0-flash-exp'}
                                onChange={(e) => props.setHelpdeskBot({ ...props.helpdeskBot(), visionModel: e.currentTarget.value })}
                                class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                            >
                                <option value="gemini-2.0-flash-exp">Nano Banana (gemini-2.0-flash-exp)</option>
                                <option value="gemini-2.5-pro-preview-06-05">Nano Banana Pro (gemini-2.5-pro)</option>
                            </select>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <span class="text-xs text-gray-400">Reasoning Depth</span>
                            <span class="text-xs font-bold text-purple-400">Deep</span>
                        </div>
                    </div>
                </div>

                {/* Image Generation */}
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-cyan-500/20">
                            <ImageIcon class="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 class="text-white font-bold">Image Generation</h3>
                            <p class="text-gray-500 text-xs">Target model for Vision Creator</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <select
                            value={props.imageSettings().model}
                            onChange={(e) => props.setImageSettings({ ...props.imageSettings(), model: e.currentTarget.value })}
                            class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                        >
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                        </select>
                        <select
                            value={props.imageSettings().size}
                            onChange={(e) => props.setImageSettings({ ...props.imageSettings(), size: e.currentTarget.value })}
                            class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                        >
                            <option value="1k">Standard (1K)</option>
                            <option value="2k">High (2K)</option>
                        </select>
                    </div>
                </div>

                {/* Voice Model */}
                <div class="rounded-3xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="p-2 rounded-xl bg-amber-500/20">
                            <Mic class="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 class="text-white font-bold">Voice & TTS</h3>
                            <p class="text-gray-500 text-xs">Settings for AI speech synthesis</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <select
                            value={props.voiceSettings().model}
                            onChange={(e) => props.setVoiceSettings({ ...props.voiceSettings(), model: e.currentTarget.value })}
                            class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                        >
                            <option value="gemini-1.5-flash">Gemini Flash</option>
                            <option value="gemini-1.5-pro">Gemini Pro</option>
                        </select>
                        <select
                            value={props.voiceSettings().ttsVoice}
                            onChange={(e) => props.setVoiceSettings({ ...props.voiceSettings(), ttsVoice: e.currentTarget.value })}
                            class="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-amber-500/50"
                        >
                            <option value="Kore">Kore (Balanced)</option>
                            <option value="Fenrir">Fenrir (Professional)</option>
                            <option value="Aoide">Aoide (Natural)</option>
                        </select>
                    </div>
                </div>
            </div>

            <Show when={props.saveSuccess()}>
                <div class="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                    <Check class="w-4 h-4" />
                    <span>All AI settings synced globally!</span>
                </div>
            </Show>
        </div>
    );
}
