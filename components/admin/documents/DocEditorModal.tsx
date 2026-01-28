import { Component, Show, createSignal, onMount, onCleanup, createEffect, For } from 'solid-js';
import { FileText, X, Paperclip, Save, Trash2 } from 'lucide-solid';
import { Motion } from 'solid-motionone';
import Quill from 'quill';
import { marked } from 'marked';
import { AdminDocument } from '../../../services/firebaseService';

interface DocEditorModalProps {
    isOpen: boolean;
    doc: AdminDocument | null;
    isSaving: boolean;
    onClose: () => void;
    onSave: (doc: AdminDocument) => Promise<void>;
    onDelete: () => void;
}

export const DocEditorModal: Component<DocEditorModalProps> = (props) => {
    const [title, setTitle] = createSignal('');
    const [category, setCategory] = createSignal('Operations Manual');
    const [docType, setDocType] = createSignal('Text/Manual');
    const [attachments, setAttachments] = createSignal<string[]>([]);

    let editorRef: HTMLDivElement | undefined;
    let quill: any;

    createEffect(() => {
        if (props.isOpen) {
            if (props.doc) {
                setTitle(props.doc.title);
                setCategory(props.doc.category);
                setDocType(props.doc.type);
                setAttachments(props.doc.attachments || []);
            } else {
                setTitle('');
                setCategory('Operations Manual');
                setDocType('Text/Manual');
                setAttachments([]);
            }

            // Initialize Quill after modal is opened and ref is available
            setTimeout(() => {
                if (editorRef && !quill) {
                    quill = new Quill(editorRef, {
                        theme: 'snow',
                        modules: {
                            toolbar: [
                                [{ 'header': [1, 2, 3, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                ['link', 'image'],
                                ['clean']
                            ]
                        }
                    });

                    // Handle Markdown Paste
                    quill.root.addEventListener('paste', (e: ClipboardEvent) => {
                        const text = e.clipboardData?.getData('text/plain');
                        if (text && (text.includes('# ') || text.includes('**') || text.includes('- '))) {
                            e.preventDefault();
                            const html = marked.parse(text);
                            const range = quill.getSelection();
                            quill.clipboard.dangerouslyPasteHTML(range.index, html);
                        }
                    });
                }

                if (quill) {
                    quill.root.innerHTML = props.doc?.content || '';
                }
            }, 100);
        } else {
            // Clean up quill on close if needed
            if (quill) {
                // quill = null;
            }
        }
    });

    const handleSave = async () => {
        const content = quill ? quill.root.innerHTML : '';
        const newDoc: AdminDocument = {
            id: props.doc?.id || Date.now().toString(),
            title: title(),
            category: category(),
            type: docType(),
            content: content,
            author: props.doc?.author || 'Admin',
            updatedAt: new Date().toISOString().split('T')[0],
            attachments: attachments()
        };
        await props.onSave(newDoc);
    };

    return (
        <Show when={props.isOpen}>
            <div class="fixed inset-0 z-[200] flex items-center justify-center p-6">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={props.onClose}
                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <Motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    class="relative w-full max-w-5xl bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl shadow-cyan-500/10 flex flex-col max-h-[90vh]"
                >
                    {/* Modal Header */}
                    <div class="p-8 border-b border-white/5 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                                <FileText class="w-6 h-6" />
                            </div>
                            <div>
                                <h2 class="text-2xl font-black italic tracking-tight">{props.doc ? 'EDIT DOCUMENT' : 'NEW DOCUMENT'}</h2>
                                <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Rich-Text Smart Editor with Markdown Support</p>
                            </div>
                        </div>
                        <button
                            onClick={props.onClose}
                            class="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center active:scale-95"
                        >
                            <X class="w-6 h-6 text-gray-400" />
                        </button>
                    </div>

                    {/* Modal Body - Scrollable */}
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div class="md:col-span-1">
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Subject / Title</label>
                                <input
                                    type="text"
                                    value={title()}
                                    onInput={(e) => setTitle(e.currentTarget.value)}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
                                    placeholder="Document name..."
                                />
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Category</label>
                                <select
                                    value={category()}
                                    onChange={(e) => setCategory(e.currentTarget.value)}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
                                >
                                    <option value="Operations Manual">Operations Manual</option>
                                    <option value="Technical Document">Technical Document</option>
                                    <option value="Planning">Planning</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Document Type</label>
                                <select
                                    value={docType()}
                                    onChange={(e) => setDocType(e.currentTarget.value)}
                                    class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
                                >
                                    <option value="Text/Manual">Text/Manual</option>
                                    <option value="Technical Data">Technical Data</option>
                                    <option value="System Notice">System Notice</option>
                                </select>
                            </div>
                        </div>

                        <div class="space-y-2">
                            <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Content</label>
                            <div class="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden min-h-[400px]">
                                <div ref={editorRef} class="h-[400px] text-gray-300" />
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div class="flex items-center gap-2">
                                <Paperclip class="w-4 h-4 text-cyan-400" />
                                <h3 class="text-[11px] font-black uppercase tracking-widest italic">Attachments ({attachments().length})</h3>
                            </div>
                            <div class="flex flex-wrap gap-3">
                                <button class="px-4 py-2 bg-white/5 border border-white/10 border-dashed rounded-xl text-[10px] font-bold text-gray-500 hover:text-white hover:border-white/20 transition-all flex items-center gap-2">
                                    + Add Files
                                </button>
                                <For each={attachments()}>
                                    {(file) => (
                                        <div class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-gray-400 flex items-center gap-2 group">
                                            <FileText class="w-3 h-3 text-cyan-400/50" />
                                            {file}
                                            <button class="ml-2 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X class="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </For>
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div class="p-8 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <button
                                onClick={props.onClose}
                                class="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 transition-all"
                            >
                                Cancel
                            </button>
                            <Show when={props.doc}>
                                <button
                                    onClick={props.onDelete}
                                    class="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center gap-2"
                                >
                                    <Trash2 class="w-4 h-4" />
                                    Delete
                                </button>
                            </Show>
                        </div>
                        <button
                            onClick={handleSave}
                            disabled={props.isSaving || !title()}
                            class="px-10 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-3 active:scale-95"
                        >
                            <Show when={props.isSaving} fallback={<Save class="w-4 h-4" />}>
                                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            </Show>
                            {props.isSaving ? 'Saving Changes...' : 'Save & Publish'}
                        </button>
                    </div>
                </Motion.div>
            </div>
        </Show>
    );
};
