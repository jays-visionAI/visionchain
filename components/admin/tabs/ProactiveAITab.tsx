import { createSignal, onMount, Show, For } from 'solid-js';
import {
    Brain,
    User,
    Cpu,
    Zap,
    MessageSquare,
    Save,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Power,
    Clock,
    List
} from 'lucide-solid';
import {
    getProactiveAISettings,
    updateProactiveAISettings,
    ProactiveAISettings,
    AIModuleConfig
} from '../../../services/firebaseService';

export default function ProactiveAITab() {
    const [settings, setSettings] = createSignal<ProactiveAISettings | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [saveStatus, setSaveStatus] = createSignal<'idle' | 'success' | 'error'>('idle');
    const [expandedModule, setExpandedModule] = createSignal<string | null>('profileAnalyzer');

    onMount(async () => {
        try {
            const data = await getProactiveAISettings();
            setSettings(data);
        } catch (e) {
            console.error('Failed to load proactive AI settings:', e);
        } finally {
            setLoading(false);
        }
    });

    const handleSaveAll = async () => {
        if (!settings()) return;
        setSaving(true);
        setSaveStatus('idle');
        try {
            await updateProactiveAISettings(settings()!);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (e) {
            console.error('Failed to save settings:', e);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setSaving(false);
        }
    };

    const updateModule = (moduleName: keyof ProactiveAISettings, updates: Partial<AIModuleConfig>) => {
        setSettings(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                [moduleName]: {
                    ...(prev[moduleName] as AIModuleConfig),
                    ...updates
                }
            };
        });
    };

    const toggleMaster = () => {
        setSettings(prev => prev ? { ...prev, masterEnabled: !prev.masterEnabled } : prev);
    };

    const ModuleCard = (props: {
        name: string;
        moduleKey: keyof ProactiveAISettings;
        icon: any;
        iconColor: string;
        description: string;
        config: AIModuleConfig;
    }) => {
        const isExpanded = () => expandedModule() === props.moduleKey;
        const IconComponent = props.icon;

        return (
            <div class={`bg-[#15151a] border rounded-2xl overflow-hidden transition-all ${props.config.enabled ? 'border-white/10' : 'border-white/5 opacity-60'
                }`}>
                {/* Header */}
                <div
                    class="flex items-center justify-between p-5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedModule(isExpanded() ? null : props.moduleKey as string)}
                >
                    <div class="flex items-center gap-4">
                        <div class={`w-10 h-10 rounded-xl ${props.iconColor} flex items-center justify-center`}>
                            <IconComponent class="w-5 h-5" />
                        </div>
                        <div>
                            <h3 class="font-bold text-white">{props.name}</h3>
                            <p class="text-xs text-gray-500">{props.description}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        {/* Toggle */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                updateModule(props.moduleKey, { enabled: !props.config.enabled });
                            }}
                            class={`w-12 h-6 rounded-full flex items-center px-1 transition-all ${props.config.enabled ? 'bg-blue-500' : 'bg-white/10'
                                }`}
                        >
                            <div class={`w-4 h-4 rounded-full bg-white shadow transition-all ${props.config.enabled ? 'ml-auto' : ''
                                }`} />
                        </button>
                        {/* Expand/Collapse */}
                        <div class="text-gray-500">
                            <Show when={isExpanded()} fallback={<ChevronDown class="w-5 h-5" />}>
                                <ChevronUp class="w-5 h-5" />
                            </Show>
                        </div>
                    </div>
                </div>

                {/* Expanded Content */}
                <Show when={isExpanded()}>
                    <div class="p-5 pt-0 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Prompt */}
                        <div>
                            <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                System Prompt
                            </label>
                            <textarea
                                value={props.config.prompt}
                                onInput={(e) => updateModule(props.moduleKey, { prompt: e.currentTarget.value })}
                                class="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-gray-600 resize-none focus:outline-none focus:border-blue-500/50 font-mono"
                                placeholder="Enter system prompt..."
                            />
                        </div>

                        {/* Update Frequency (for profile analyzer) */}
                        <Show when={props.config.updateFrequency !== undefined}>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                        Update Frequency
                                    </label>
                                    <select
                                        value={props.config.updateFrequency}
                                        onChange={(e) => updateModule(props.moduleKey, {
                                            updateFrequency: e.currentTarget.value as 'realtime' | 'daily' | 'weekly'
                                        })}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        <option value="realtime">Realtime</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                    </select>
                                </div>
                            </div>
                        </Show>

                        {/* Trigger (for context engine) */}
                        <Show when={props.config.triggerOn !== undefined}>
                            <div>
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                    Trigger On
                                </label>
                                <select
                                    value={props.config.triggerOn}
                                    onChange={(e) => updateModule(props.moduleKey, {
                                        triggerOn: e.currentTarget.value as 'chat_start' | 'on_demand' | 'scheduled'
                                    })}
                                    class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                >
                                    <option value="chat_start">On Chat Start</option>
                                    <option value="on_demand">On Demand</option>
                                    <option value="scheduled">Scheduled</option>
                                </select>
                            </div>
                        </Show>

                        {/* Priority Rules (for action generator) */}
                        <Show when={props.config.priorityRules !== undefined}>
                            <div>
                                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                    Priority Rules (highest first)
                                </label>
                                <div class="space-y-2">
                                    <For each={props.config.priorityRules}>
                                        {(rule, index) => (
                                            <div class="flex items-center gap-3 bg-black/30 rounded-lg px-4 py-3 border border-white/5">
                                                <span class="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
                                                    {index() + 1}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={rule}
                                                    onInput={(e) => {
                                                        const newRules = [...(props.config.priorityRules || [])];
                                                        newRules[index()] = e.currentTarget.value;
                                                        updateModule(props.moduleKey, { priorityRules: newRules });
                                                    }}
                                                    class="flex-1 bg-transparent text-sm text-white focus:outline-none"
                                                />
                                            </div>
                                        )}
                                    </For>
                                </div>
                                <div class="flex items-center gap-2 mt-2">
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                        Max Actions:
                                    </label>
                                    <input
                                        type="number"
                                        value={props.config.maxItems || 5}
                                        onInput={(e) => updateModule(props.moduleKey, { maxItems: parseInt(e.currentTarget.value) || 5 })}
                                        class="w-16 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none"
                                        min="1"
                                        max="10"
                                    />
                                </div>
                            </div>
                        </Show>

                        {/* Style (for greeting generator) */}
                        <Show when={props.config.style !== undefined}>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                        Greeting Style
                                    </label>
                                    <select
                                        value={props.config.style}
                                        onChange={(e) => updateModule(props.moduleKey, { style: e.currentTarget.value })}
                                        class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50"
                                    >
                                        <option value="friendly_professional">Friendly & Professional</option>
                                        <option value="casual">Casual</option>
                                        <option value="formal">Formal</option>
                                        <option value="enthusiastic">Enthusiastic</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                        Available Variables
                                    </label>
                                    <div class="flex flex-wrap gap-2">
                                        <For each={props.config.templateVars || []}>
                                            {(v) => (
                                                <span class="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-mono rounded">
                                                    {`{${v}}`}
                                                </span>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </div>
                        </Show>
                    </div>
                </Show>
            </div>
        );
    };

    return (
        <div class="space-y-6">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
                        <Brain class="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 class="text-xl font-bold text-white">Proactive AI Orchestrator</h2>
                        <p class="text-sm text-gray-500">Configure intelligent, context-aware AI behavior</p>
                    </div>
                </div>

                {/* Master Toggle */}
                <Show when={settings()}>
                    <button
                        onClick={toggleMaster}
                        class={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${settings()!.masterEnabled
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                    >
                        <Power class="w-4 h-4" />
                        {settings()!.masterEnabled ? 'SYSTEM ACTIVE' : 'SYSTEM OFF'}
                    </button>
                </Show>
            </div>

            {/* Loading */}
            <Show when={loading()}>
                <div class="flex items-center justify-center py-20">
                    <RefreshCw class="w-8 h-8 text-gray-500 animate-spin" />
                </div>
            </Show>

            {/* Modules */}
            <Show when={!loading() && settings()}>
                <div class="space-y-4">
                    <ModuleCard
                        name="User Profile Analyzer"
                        moduleKey="profileAnalyzer"
                        icon={User}
                        iconColor="bg-amber-500/20 text-amber-400"
                        description="Analyze user behavior patterns and preferences"
                        config={settings()!.profileAnalyzer}
                    />

                    <ModuleCard
                        name="Context Engine"
                        moduleKey="contextEngine"
                        icon={Cpu}
                        iconColor="bg-blue-500/20 text-blue-400"
                        description="Determine relevant context for each interaction"
                        config={settings()!.contextEngine}
                    />

                    <ModuleCard
                        name="Action Generator"
                        moduleKey="actionGenerator"
                        icon={Zap}
                        iconColor="bg-green-500/20 text-green-400"
                        description="Generate personalized quick actions"
                        config={settings()!.actionGenerator}
                    />

                    <ModuleCard
                        name="Greeting Generator"
                        moduleKey="greetingGenerator"
                        icon={MessageSquare}
                        iconColor="bg-purple-500/20 text-purple-400"
                        description="Create warm, personalized greetings"
                        config={settings()!.greetingGenerator}
                    />
                </div>

                {/* Save Button */}
                <div class="pt-4">
                    <button
                        onClick={handleSaveAll}
                        disabled={saving()}
                        class={`w-full py-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${saveStatus() === 'success'
                                ? 'bg-green-600 text-white'
                                : saveStatus() === 'error'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                            } disabled:opacity-50`}
                    >
                        <Show when={saving()}>
                            <RefreshCw class="w-4 h-4 animate-spin" />
                        </Show>
                        <Show when={!saving()}>
                            <Save class="w-4 h-4" />
                        </Show>
                        {saveStatus() === 'success'
                            ? 'Saved Successfully!'
                            : saveStatus() === 'error'
                                ? 'Error Saving'
                                : saving()
                                    ? 'Saving...'
                                    : 'Save All Settings'}
                    </button>
                </div>

                {/* Info Box */}
                <div class="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-5">
                    <h4 class="text-sm font-bold text-blue-400 mb-2">How it works</h4>
                    <ul class="text-xs text-gray-400 space-y-1">
                        <li>1. <strong>Profile Analyzer</strong> runs periodically to understand each user</li>
                        <li>2. <strong>Context Engine</strong> activates when user opens chat</li>
                        <li>3. <strong>Action Generator</strong> creates personalized quick action chips</li>
                        <li>4. <strong>Greeting Generator</strong> produces a warm, relevant welcome message</li>
                    </ul>
                </div>
            </Show>
        </div>
    );
}
