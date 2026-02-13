import { Component, Show, For, onMount, createEffect, createSignal } from 'solid-js';
import { FileText, X, Type, Paperclip, Code } from 'lucide-solid';
import { Motion } from 'solid-motionone';
import { AdminDocument } from '../../../services/firebaseService';
import { marked } from 'marked';
import hljs from 'highlight.js';
import mermaid from 'mermaid';

// Initialize mermaid with dark theme
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#06b6d4',
        primaryTextColor: '#e5e7eb',
        primaryBorderColor: '#22d3ee',
        lineColor: '#4b5563',
        secondaryColor: '#1e293b',
        tertiaryColor: '#0f172a',
        background: '#0c0c0c',
        mainBkg: '#111827',
        nodeBorder: '#22d3ee',
        clusterBkg: '#1e293b',
        titleColor: '#e5e7eb',
        edgeLabelBackground: '#111827',
    },
    fontFamily: '"Inter", sans-serif',
    fontSize: 13,
});

// Configure marked with highlight.js
marked.setOptions({
    breaks: true,
    gfm: true,
});

const isMarkdownType = (type: string): boolean => {
    return type === 'Markdown' || type === 'markdown';
};

interface DocViewerModalProps {
    isOpen: boolean;
    doc: AdminDocument | null;
    onClose: () => void;
    onEdit: () => void;
}

export const DocViewerModal: Component<DocViewerModalProps> = (props) => {
    let contentRef: HTMLDivElement | undefined;
    const [rendered, setRendered] = createSignal(false);

    const renderMermaidDiagrams = async () => {
        if (!contentRef) return;
        const mermaidBlocks = contentRef.querySelectorAll('pre code.language-mermaid');
        for (let i = 0; i < mermaidBlocks.length; i++) {
            const block = mermaidBlocks[i];
            const pre = block.parentElement;
            if (!pre) continue;
            const code = block.textContent || '';
            try {
                const id = `mermaid-${Date.now()}-${i}`;
                const { svg } = await mermaid.render(id, code);
                const wrapper = document.createElement('div');
                wrapper.className = 'mermaid-diagram';
                wrapper.innerHTML = svg;
                pre.replaceWith(wrapper);
            } catch (e) {
                console.warn('[DocViewer] Mermaid render failed:', e);
            }
        }
    };

    const highlightCodeBlocks = () => {
        if (!contentRef) return;
        const blocks = contentRef.querySelectorAll('pre code:not(.language-mermaid)');
        blocks.forEach((block) => {
            hljs.highlightElement(block as HTMLElement);
        });
    };

    const renderMarkdown = (content: string): string => {
        return marked.parse(content) as string;
    };

    createEffect(() => {
        if (props.isOpen && props.doc && isMarkdownType(props.doc.type)) {
            setRendered(false);
            // Wait for DOM to update
            setTimeout(async () => {
                highlightCodeBlocks();
                await renderMermaidDiagrams();
                setRendered(true);
            }, 100);
        }
    });

    return (
        <Show when={props.isOpen && props.doc}>
            <div class="fixed inset-0 z-[200] flex items-center justify-center p-6">
                <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={props.onClose}
                    class="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <Motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    class="relative w-full max-w-4xl bg-[#0c0c0c] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl shadow-cyan-500/10 flex flex-col max-h-[90vh]"
                >
                    {/* Viewer Header */}
                    <div class="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500">
                                {isMarkdownType(props.doc!.type) ? <Code class="w-6 h-6" /> : <FileText class="w-6 h-6" />}
                            </div>
                            <div>
                                <div class="flex items-center gap-3 mb-1">
                                    <span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-wider">
                                        {props.doc!.category}
                                    </span>
                                    <span class={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${isMarkdownType(props.doc!.type) ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                                        {props.doc!.type}
                                    </span>
                                </div>
                                <h2 class="text-xl md:text-2xl font-black italic tracking-tight text-white leading-tight">
                                    {props.doc!.title}
                                </h2>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <button
                                onClick={props.onEdit}
                                class="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all flex items-center gap-2"
                            >
                                <Type class="w-3.5 h-3.5" />
                                Edit Document
                            </button>
                            <button
                                onClick={props.onClose}
                                class="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-center group"
                            >
                                <X class="w-5 h-5 text-gray-400 group-hover:text-white" />
                            </button>
                        </div>
                    </div>

                    {/* Viewer Content */}
                    <div class="flex-1 overflow-y-auto custom-scrollbar">
                        <div class="p-10 max-w-3xl mx-auto">
                            {/* Meta Info */}
                            <div class="flex items-center justify-between pb-8 border-b border-white/5 mb-8">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-[10px] font-black uppercase text-white shadow-lg shadow-cyan-500/20">
                                        {props.doc!.author[0]}
                                    </div>
                                    <div>
                                        <div class="text-[11px] font-bold text-white">{props.doc!.author}</div>
                                        <div class="text-[10px] text-gray-500">Last updated on {props.doc!.updatedAt}</div>
                                    </div>
                                </div>
                                <div class="text-[10px] font-mono text-gray-600">ID: {props.doc!.id}</div>
                            </div>

                            {/* Main Body */}
                            <Show
                                when={isMarkdownType(props.doc!.type)}
                                fallback={
                                    <div class="ql-editor-view text-gray-300 leading-relaxed" innerHTML={props.doc!.content} />
                                }
                            >
                                <div
                                    ref={contentRef}
                                    class="markdown-body"
                                    innerHTML={renderMarkdown(props.doc!.content)}
                                />
                            </Show>

                            {/* Viewer Attachments */}
                            <Show when={props.doc!.attachments && props.doc!.attachments.length > 0}>
                                <div class="mt-12 pt-8 border-t border-white/5">
                                    <h3 class="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                                        <Paperclip class="w-3.5 h-3.5" />
                                        Attachments
                                    </h3>
                                    <div class="flex flex-wrap gap-3">
                                        <For each={props.doc!.attachments}>
                                            {(file) => (
                                                <a href="#" class="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[11px] font-bold text-gray-300 hover:text-white flex items-center gap-3 transition-all group">
                                                    <div class="w-6 h-6 rounded-lg bg-black/20 flex items-center justify-center">
                                                        <FileText class="w-3.5 h-3.5 text-cyan-400" />
                                                    </div>
                                                    {file}
                                                </a>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>
                        </div>
                    </div>
                </Motion.div>
            </div>
        </Show>
    );
};
