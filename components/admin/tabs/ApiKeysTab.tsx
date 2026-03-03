import { createSignal, For, Show } from 'solid-js';
import { Key, Plus, Eye, EyeOff, Trash2, Loader2 } from 'lucide-solid';
import { ApiKeyData } from '../../../services/firebaseService';

interface ApiKeysTabProps {
    apiKeys: () => ApiKeyData[];
    onAddKey: (name: string, value: string, provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek') => Promise<void>;
    onDeleteKey: (id: string, provider: string) => Promise<void>;
    onToggleActive: (id: string, provider: string, active: boolean) => Promise<void>;
}

function formatDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
        + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

const PROVIDER_COLOR: Record<string, string> = {
    gemini: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    deepseek: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    openai: 'bg-green-500/10 text-green-400 border border-green-500/20',
    anthropic: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
};

export function ApiKeysTab(props: ApiKeysTabProps) {
    const [newKeyName, setNewKeyName] = createSignal('');
    const [newKeyValue, setNewKeyValue] = createSignal('');
    const [newKeyProvider, setNewKeyProvider] = createSignal<'gemini' | 'openai' | 'anthropic' | 'deepseek'>('gemini');
    const [showNewKeyValue, setShowNewKeyValue] = createSignal(false);
    const [isSaving, setIsSaving] = createSignal(false);
    const [isDeleting, setIsDeleting] = createSignal(false);

    // Multi-select for bulk delete
    const [selected, setSelected] = createSignal<Set<string>>(new Set());

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        const all = props.apiKeys().map(k => k.id!);
        setSelected(prev => prev.size === all.length ? new Set() : new Set(all));
    };

    const handleAdd = async () => {
        if (!newKeyName() || !newKeyValue()) return;
        setIsSaving(true);
        await props.onAddKey(newKeyName(), newKeyValue(), newKeyProvider());
        setNewKeyName('');
        setNewKeyValue('');
        setIsSaving(false);
    };

    const handleBulkDelete = async () => {
        const ids = [...selected()];
        if (ids.length === 0) return;
        if (!confirm(`선택한 ${ids.length}개의 키를 삭제하시겠습니까?`)) return;
        setIsDeleting(true);
        for (const id of ids) {
            const key = props.apiKeys().find(k => k.id === id);
            if (key) await props.onDeleteKey(id, key.provider);
        }
        setSelected(new Set());
        setIsDeleting(false);
    };

    return (
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <Key class="w-5 h-5 text-cyan-400" />
                    Global API Keys
                </h2>
                <Show when={selected().size > 0}>
                    <button
                        onClick={handleBulkDelete}
                        disabled={isDeleting()}
                        class="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-all disabled:opacity-50"
                    >
                        {isDeleting()
                            ? <Loader2 class="w-4 h-4 animate-spin" />
                            : <Trash2 class="w-4 h-4" />}
                        {selected().size}개 삭제
                    </button>
                </Show>
            </div>

            {/* Add New Key Form */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/10 p-6 space-y-4">
                <h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Connect New Provider</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input
                        type="text"
                        placeholder="Key Name (e.g. Production Gemini)"
                        value={newKeyName()}
                        onInput={(e) => setNewKeyName(e.currentTarget.value)}
                        class="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                    />
                    <div class="relative">
                        <input
                            type={showNewKeyValue() ? "text" : "password"}
                            placeholder="API Key Value"
                            value={newKeyValue()}
                            onInput={(e) => setNewKeyValue(e.currentTarget.value)}
                            class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 pr-10"
                        />
                        <button
                            onClick={() => setShowNewKeyValue(!showNewKeyValue())}
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                        >
                            {showNewKeyValue()
                                ? <EyeOff class="w-4 h-4" />
                                : <Eye class="w-4 h-4" />}
                        </button>
                    </div>
                    <select
                        value={newKeyProvider()}
                        onChange={(e) => setNewKeyProvider(e.currentTarget.value as any)}
                        class="bg-[#111115] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50"
                    >
                        <option value="gemini">Google Gemini</option>
                        <option value="deepseek">DeepSeek AI</option>
                        <option value="openai">OpenAI GPT</option>
                        <option value="anthropic">Anthropic Claude</option>
                    </select>
                    <button
                        onClick={handleAdd}
                        disabled={isSaving() || !newKeyName() || !newKeyValue()}
                        class="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-cyan-500/20 transition-all disabled:opacity-50"
                    >
                        {isSaving() ? <Loader2 class="w-4 h-4 animate-spin" /> : <Plus class="w-4 h-4" />}
                        Add Key
                    </button>
                </div>
            </div>

            {/* Keys Table */}
            <div class="rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <table class="w-full text-left">
                    <thead>
                        <tr class="bg-white/5 border-b border-white/10">
                            <th class="p-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={props.apiKeys().length > 0 && selected().size === props.apiKeys().length}
                                    onChange={toggleAll}
                                    class="accent-cyan-500 w-4 h-4 cursor-pointer"
                                />
                            </th>
                            <th class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Name</th>
                            <th class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Provider</th>
                            <th class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Key (Masked)</th>
                            <th class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Registered</th>
                            <th class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                            <th class="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">
                        <For each={props.apiKeys()}>
                            {(key) => (
                                <tr class={`transition-colors ${selected().has(key.id!) ? 'bg-red-500/5' : 'hover:bg-white/[0.01]'}`}>
                                    <td class="p-4">
                                        <input
                                            type="checkbox"
                                            checked={selected().has(key.id!)}
                                            onChange={() => toggleSelect(key.id!)}
                                            class="accent-cyan-500 w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                    <td class="p-4 text-white font-medium">
                                        {key.name || <span class="text-gray-600 italic">unnamed</span>}
                                    </td>
                                    <td class="p-4">
                                        <span class={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${PROVIDER_COLOR[key.provider] || 'bg-white/5 text-gray-500'}`}>
                                            {key.provider}
                                        </span>
                                    </td>
                                    <td class="p-4 font-mono text-xs text-gray-500">
                                        {key.key
                                            ? `${key.key.slice(0, 6)}••••••••${key.key.slice(-4)}`
                                            : '••••••••••••'}
                                    </td>
                                    <td class="p-4 text-xs text-gray-600 whitespace-nowrap">
                                        {formatDate((key as any).createdAt)}
                                    </td>
                                    <td class="p-4">
                                        <button
                                            onClick={() => props.onToggleActive(key.id!, key.provider, !key.isActive)}
                                            class={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${key.isActive
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                                                }`}
                                        >
                                            {key.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td class="p-4">
                                        <button
                                            onClick={() => props.onDeleteKey(key.id!, key.provider)}
                                            class="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </For>
                        <Show when={props.apiKeys().length === 0}>
                            <tr>
                                <td colspan="7" class="p-10 text-center text-gray-600 italic">No API keys found. Add your first key to enable AI features.</td>
                            </tr>
                        </Show>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
