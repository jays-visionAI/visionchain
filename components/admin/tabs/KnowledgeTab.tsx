import { createSignal, Show } from 'solid-js';
import { Database, Save, Check } from 'lucide-solid';

interface KnowledgeTabProps {
    content: () => string;
    setContent: (val: string) => void;
    onSave: () => Promise<void>;
    isSaving: () => boolean;
    saveSuccess: () => boolean;
}

export function KnowledgeTab(props: KnowledgeTabProps) {
    return (
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                    <Database class="w-5 h-5 text-cyan-400" />
                    Knowledge Base Editor
                </h2>
                <div class="flex gap-2">
                    <button
                        onClick={() => props.onSave()}
                        disabled={props.isSaving()}
                        class="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50"
                    >
                        <Save class="w-4 h-4" />
                        {props.isSaving() ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>

            <div class="rounded-2xl bg-white/[0.02] border border-white/10 overflow-hidden">
                <textarea
                    value={props.content()}
                    onInput={(e) => props.setContent(e.currentTarget.value)}
                    class="w-full h-[400px] bg-transparent p-4 text-sm text-gray-300 font-mono resize-none focus:outline-none"
                    placeholder="Enter global knowledge base content..."
                />
            </div>

            <Show when={props.saveSuccess()}>
                <div class="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2">
                    <Check class="w-4 h-4" />
                    <span>Knowledge base updated globally!</span>
                </div>
            </Show>
        </div>
    );
}
