import { createSignal, onMount, For, Show } from 'solid-js';
import { getQuickActions, saveQuickActions, QuickAction } from '../../../services/firebaseService';
import {
    Plus,
    Trash2,
    Save,
    GripVertical,
    ChevronUp,
    ChevronDown,
    BookOpen,
    Sparkles,
    UserPlus,
    Send,
    TrendingUp,
    Zap,
    Download,
    Clock,
    MessageSquare,
    Search,
    Lock,
    Layers,
    Check,
    X
} from 'lucide-solid';

// Available icons for selection
const AVAILABLE_ICONS = [
    { name: 'BookOpen', component: BookOpen },
    { name: 'Sparkles', component: Sparkles },
    { name: 'UserPlus', component: UserPlus },
    { name: 'Send', component: Send },
    { name: 'TrendingUp', component: TrendingUp },
    { name: 'Zap', component: Zap },
    { name: 'Download', component: Download },
    { name: 'Clock', component: Clock },
    { name: 'MessageSquare', component: MessageSquare },
    { name: 'Search', component: Search },
    { name: 'Lock', component: Lock },
    { name: 'Layers', component: Layers }
];

// Available colors
const AVAILABLE_COLORS = [
    { name: 'Yellow', value: 'text-yellow-500' },
    { name: 'Purple', value: 'text-purple-400' },
    { name: 'Emerald', value: 'text-emerald-400' },
    { name: 'Blue', value: 'text-blue-400' },
    { name: 'Red', value: 'text-red-400' },
    { name: 'Cyan', value: 'text-cyan-400' },
    { name: 'Pink', value: 'text-pink-400' },
    { name: 'Orange', value: 'text-orange-400' },
    { name: 'Indigo', value: 'text-indigo-400' },
    { name: 'Teal', value: 'text-teal-400' }
];

export const QuickActionsTab = () => {
    const [actions, setActions] = createSignal<QuickAction[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [hasChanges, setHasChanges] = createSignal(false);
    const [error, setError] = createSignal('');
    const [successMessage, setSuccessMessage] = createSignal('');

    onMount(async () => {
        await loadActions();
    });

    const loadActions = async () => {
        setLoading(true);
        try {
            const data = await getQuickActions();
            setActions(data.sort((a, b) => a.order - b.order));
        } catch (e) {
            setError('Failed to load Quick Actions');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            await saveQuickActions(actions());
            setHasChanges(false);
            setSuccessMessage('Quick Actions saved successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (e) {
            setError('Failed to save Quick Actions');
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const addAction = () => {
        const newId = Date.now().toString();
        const newOrder = actions().length + 1;
        setActions([...actions(), {
            id: newId,
            label: 'New Action',
            prompt: '',
            icon: 'Sparkles',
            iconColor: 'text-purple-400',
            actionType: 'chat',
            order: newOrder,
            enabled: true
        }]);
        setHasChanges(true);
    };

    const removeAction = (id: string) => {
        setActions(actions().filter(a => a.id !== id));
        setHasChanges(true);
    };

    const updateAction = (id: string, updates: Partial<QuickAction>) => {
        setActions(actions().map(a => a.id === id ? { ...a, ...updates } : a));
        setHasChanges(true);
    };

    const moveUp = (index: number) => {
        if (index === 0) return;
        const newActions = [...actions()];
        [newActions[index - 1], newActions[index]] = [newActions[index], newActions[index - 1]];
        newActions.forEach((a, i) => a.order = i + 1);
        setActions(newActions);
        setHasChanges(true);
    };

    const moveDown = (index: number) => {
        if (index === actions().length - 1) return;
        const newActions = [...actions()];
        [newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]];
        newActions.forEach((a, i) => a.order = i + 1);
        setActions(newActions);
        setHasChanges(true);
    };

    const getIconComponent = (iconName: string) => {
        const found = AVAILABLE_ICONS.find(i => i.name === iconName);
        return found ? found.component : Sparkles;
    };

    return (
        <div class="space-y-6">
            {/* Header */}
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xl font-bold text-white">Quick Actions</h2>
                    <p class="text-sm text-gray-400 mt-1">
                        Manage the action buttons shown to new users in the chat interface
                    </p>
                </div>
                <div class="flex items-center gap-3">
                    <button
                        onClick={addAction}
                        class="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                        <Plus class="w-4 h-4" />
                        Add Action
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges() || saving()}
                        class={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${hasChanges() && !saving()
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <Save class="w-4 h-4" />
                        {saving() ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            {/* Success/Error Messages */}
            <Show when={successMessage()}>
                <div class="flex items-center gap-2 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400">
                    <Check class="w-4 h-4" />
                    {successMessage()}
                </div>
            </Show>
            <Show when={error()}>
                <div class="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400">
                    <X class="w-4 h-4" />
                    {error()}
                </div>
            </Show>

            {/* Loading State */}
            <Show when={loading()}>
                <div class="flex items-center justify-center py-12">
                    <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
            </Show>

            {/* Actions List */}
            <Show when={!loading()}>
                <div class="space-y-4">
                    <For each={actions()}>
                        {(action, index) => {
                            const IconComponent = getIconComponent(action.icon);
                            return (
                                <div class={`p-4 rounded-xl border ${action.enabled ? 'bg-[#1a1a1c] border-white/10' : 'bg-[#0f0f10] border-white/5 opacity-60'}`}>
                                    <div class="flex items-start gap-4">
                                        {/* Drag Handle & Order Controls */}
                                        <div class="flex flex-col items-center gap-1 pt-2">
                                            <button onClick={() => moveUp(index())} class="p-1 hover:bg-white/10 rounded transition-colors" disabled={index() === 0}>
                                                <ChevronUp class="w-4 h-4 text-gray-400" />
                                            </button>
                                            <GripVertical class="w-4 h-4 text-gray-500" />
                                            <button onClick={() => moveDown(index())} class="p-1 hover:bg-white/10 rounded transition-colors" disabled={index() === actions().length - 1}>
                                                <ChevronDown class="w-4 h-4 text-gray-400" />
                                            </button>
                                        </div>

                                        {/* Icon Preview */}
                                        <div class={`w-12 h-12 rounded-xl bg-[#252528] flex items-center justify-center ${action.iconColor}`}>
                                            <IconComponent class="w-6 h-6" />
                                        </div>

                                        {/* Form Fields */}
                                        <div class="flex-1 grid grid-cols-2 gap-4">
                                            {/* Label */}
                                            <div>
                                                <label class="text-xs text-gray-400 mb-1 block">Label</label>
                                                <input
                                                    type="text"
                                                    value={action.label}
                                                    onInput={(e) => updateAction(action.id, { label: e.currentTarget.value })}
                                                    class="w-full px-3 py-2 bg-[#0f0f10] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                                    placeholder="Button label"
                                                />
                                            </div>

                                            {/* Action Type */}
                                            <div>
                                                <label class="text-xs text-gray-400 mb-1 block">Action Type</label>
                                                <select
                                                    value={action.actionType}
                                                    onChange={(e) => updateAction(action.id, { actionType: e.currentTarget.value as 'chat' | 'flow' })}
                                                    class="w-full px-3 py-2 bg-[#0f0f10] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                                >
                                                    <option value="chat">Send Chat Message</option>
                                                    <option value="flow">Open Flow</option>
                                                </select>
                                            </div>

                                            {/* Prompt or Flow Name */}
                                            <div class="col-span-2">
                                                <Show when={action.actionType === 'chat'}>
                                                    <label class="text-xs text-gray-400 mb-1 block">Chat Prompt</label>
                                                    <input
                                                        type="text"
                                                        value={action.prompt}
                                                        onInput={(e) => updateAction(action.id, { prompt: e.currentTarget.value })}
                                                        class="w-full px-3 py-2 bg-[#0f0f10] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                                        placeholder="e.g., Tell me about Vision Chain"
                                                    />
                                                </Show>
                                                <Show when={action.actionType === 'flow'}>
                                                    <label class="text-xs text-gray-400 mb-1 block">Flow Name</label>
                                                    <select
                                                        value={action.flowName || ''}
                                                        onChange={(e) => updateAction(action.id, { flowName: e.currentTarget.value })}
                                                        class="w-full px-3 py-2 bg-[#0f0f10] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                                    >
                                                        <option value="">Select Flow</option>
                                                        <option value="send">Send VCN</option>
                                                        <option value="receive">Receive</option>
                                                        <option value="swap">Swap</option>
                                                        <option value="stake">Stake</option>
                                                    </select>
                                                </Show>
                                            </div>

                                            {/* Icon */}
                                            <div>
                                                <label class="text-xs text-gray-400 mb-1 block">Icon</label>
                                                <select
                                                    value={action.icon}
                                                    onChange={(e) => updateAction(action.id, { icon: e.currentTarget.value })}
                                                    class="w-full px-3 py-2 bg-[#0f0f10] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                                >
                                                    <For each={AVAILABLE_ICONS}>
                                                        {(icon) => <option value={icon.name}>{icon.name}</option>}
                                                    </For>
                                                </select>
                                            </div>

                                            {/* Color */}
                                            <div>
                                                <label class="text-xs text-gray-400 mb-1 block">Color</label>
                                                <select
                                                    value={action.iconColor}
                                                    onChange={(e) => updateAction(action.id, { iconColor: e.currentTarget.value })}
                                                    class="w-full px-3 py-2 bg-[#0f0f10] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
                                                >
                                                    <For each={AVAILABLE_COLORS}>
                                                        {(color) => <option value={color.value}>{color.name}</option>}
                                                    </For>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div class="flex flex-col items-center gap-2 pt-2">
                                            {/* Enable Toggle */}
                                            <button
                                                onClick={() => updateAction(action.id, { enabled: !action.enabled })}
                                                class={`p-2 rounded-lg transition-colors ${action.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}
                                                title={action.enabled ? 'Enabled' : 'Disabled'}
                                            >
                                                <Check class="w-4 h-4" />
                                            </button>

                                            {/* Delete */}
                                            <button
                                                onClick={() => removeAction(action.id)}
                                                class="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 class="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>

            {/* Empty State */}
            <Show when={!loading() && actions().length === 0}>
                <div class="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Sparkles class="w-12 h-12 mb-4 opacity-50" />
                    <p class="text-lg mb-2">No Quick Actions configured</p>
                    <p class="text-sm">Click "Add Action" to create your first quick action</p>
                </div>
            </Show>
        </div>
    );
};

export default QuickActionsTab;
