import { createSignal, onMount, For, Show } from 'solid-js';
import {
    Search,
    Plus,
    Filter,
    MoreHorizontal,
    FileText,
    Calendar,
    User,
    Tag,
    X,
    Save,
    Paperclip,
    Trash2,
    Bold,
    Italic,
    Underline,
    List,
    ListOrdered,
    Link as LinkIcon,
    Image as ImageIcon,
    Type,
    ChevronDown,
    ChevronUp
} from 'lucide-solid';
import { Motion } from 'solid-motionone';
import Quill from 'quill';
import { marked } from 'marked';
import { getDocuments, saveAdminDocument, deleteAdminDocument, AdminDocument } from '../../services/firebaseService';

const MOCK_DOCUMENTS: AdminDocument[] = [
    {
        id: '1',
        title: '주문장과 회원계정 인증 및 매칭 이슈',
        category: '운영 매뉴얼',
        type: '텍스트/매뉴얼',
        content: '기획안...',
        author: 'Admin',
        updatedAt: '2024-03-20',
        attachments: []
    },
    {
        id: '2',
        title: 'Vision Chain 노드 설치 가이드',
        category: '기술 문서',
        type: '기술 자료',
        content: '# 노드 설치 방법...',
        author: 'Tech Support',
        updatedAt: '2024-03-18',
        attachments: ['setup_v1.pdf']
    }
];

export default function AdminDocuments() {
    const [documents, setDocuments] = createSignal<AdminDocument[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [isEditorOpen, setIsEditorOpen] = createSignal(false);
    const [selectedDoc, setSelectedDoc] = createSignal<AdminDocument | null>(null);
    const [isSaving, setIsSaving] = createSignal(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
    const [isViewerOpen, setIsViewerOpen] = createSignal(false);

    onMount(async () => {
        await loadDocuments();
    });

    const loadDocuments = async () => {
        setLoading(true);
        try {
            let docs = await getDocuments();

            // If Firestore is empty, show MOCK immediately and seed in background
            if (docs.length === 0) {
                console.log("[AdminDocuments] Firestore empty. Using mock data & Seeding...");
                // 1. Show Mock Data Immediately
                setDocuments(MOCK_DOCUMENTS);

                // 2. Seed in Background (Fire and forget, or silent await)
                (async () => {
                    try {
                        for (const d of MOCK_DOCUMENTS) {
                            await saveAdminDocument(d);
                        }
                        console.log("[AdminDocuments] Seeding completed.");
                    } catch (e) {
                        console.warn("[AdminDocuments] Seeding failed (likely permission issue), but Mock data is shown.", e);
                    }
                })();
            } else {
                // Client-side sort (Newest first)
                // Use updatedAt primarily, then id (timestamp) as a fallback for same-day entries
                docs.sort((a, b) => {
                    const dateA = new Date(a.updatedAt || 0).getTime();
                    const dateB = new Date(b.updatedAt || 0).getTime();
                    if (dateB !== dateA) return dateB - dateA;
                    return b.id.localeCompare(a.id);
                });
                setDocuments(docs);
            }
        } catch (error) {
            console.error("Failed to load documents:", error);
            // Fallback to local state sorted newest first
            const sortedMocks = [...MOCK_DOCUMENTS].sort((a, b) => b.id.localeCompare(a.id));
            setDocuments(sortedMocks);
        } finally {
            setLoading(false);
        }
    };

    // Form Signals
    const [title, setTitle] = createSignal('');
    const [category, setCategory] = createSignal('운영 매뉴얼');
    const [docType, setDocType] = createSignal('텍스트/매뉴얼');
    const [attachments, setAttachments] = createSignal<string[]>([]);

    let editorRef: HTMLDivElement | undefined;
    let quill: any;



    const openViewer = (doc: AdminDocument) => {
        setSelectedDoc(doc);
        setIsViewerOpen(true);
    };

    const handleEditFromViewer = () => {
        setIsViewerOpen(false);
        openEditor(selectedDoc());
    };

    const openEditor = (doc: AdminDocument | null = null) => {
        if (doc) {
            setSelectedDoc(doc);
            setTitle(doc.title);
            setCategory(doc.category);
            setDocType(doc.type);
            setAttachments(doc.attachments);
        } else {
            setSelectedDoc(null);
            setTitle('');
            setCategory('운영 매뉴얼');
            setDocType('텍스트/매뉴얼');
            setAttachments([]);
        }
        setIsEditorOpen(true);

        // Initialize Quill after modal is opened and ref is available
        setTimeout(() => {
            if (editorRef) {
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

                if (doc) {
                    quill.root.innerHTML = doc.content;
                }

                // Handle Markdown Paste
                quill.root.addEventListener('paste', (e: ClipboardEvent) => {
                    const text = e.clipboardData?.getData('text/plain');
                    if (text && (text.includes('# ') || text.includes('**') || text.includes('- '))) {
                        // Potential Markdown detected - simple check
                        e.preventDefault();
                        const html = marked.parse(text);
                        const range = quill.getSelection();
                        quill.clipboard.dangerouslyPasteHTML(range.index, html);
                    }
                });
            }
        }, 100);
    };

    const handleSave = async () => {
        setIsSaving(true);
        const content = quill.root.innerHTML;

        const newDoc: AdminDocument = {
            id: selectedDoc()?.id || Date.now().toString(),
            title: title(),
            category: category(),
            type: docType(),
            content: content,
            author: 'Admin',
            updatedAt: new Date().toISOString().split('T')[0],
            attachments: attachments()
        };

        try {
            await saveAdminDocument(newDoc);
            await loadDocuments(); // Reload from Firebase
            setIsEditorOpen(false);
        } catch (error) {
            console.error("Failed to save document:", error);
            alert("저장에 실패했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedDoc()) return;

        setIsSaving(true);
        try {
            await deleteAdminDocument(selectedDoc()!.id);
            await loadDocuments();
            setShowDeleteConfirm(false);
            setIsEditorOpen(false);
        } catch (error) {
            console.error("Failed to delete document:", error);
            alert("삭제에 실패했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredDocs = () => {
        return documents().filter(doc =>
            doc.title.toLowerCase().includes(searchQuery().toLowerCase()) ||
            doc.category.toLowerCase().includes(searchQuery().toLowerCase())
        );
    };

    return (
        <div class="space-y-8 animate-in fade-in duration-700">
            <style>{`
                .ql-toolbar.ql-snow {
                    border: none !important;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
                    background: rgba(255, 255, 255, 0.02);
                    padding: 12px 16px !important;
                }
                .ql-container.ql-snow {
                    border: none !important;
                    background: transparent;
                }
                .ql-editor {
                    padding: 20px 24px !important;
                    font-family: 'Inter', sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    color: rgba(255, 255, 255, 0.8);
                }
                .ql-editor.ql-blank::before {
                    color: rgba(255, 255, 255, 0.2);
                    left: 24px !important;
                    font-style: normal;
                }
                .ql-stroke {
                    stroke: #6b7280 !important;
                }
                .ql-fill {
                    fill: #6b7280 !important;
                }
                .ql-picker {
                    color: #6b7280 !important;
                }
                .ql-picker-options {
                    background-color: #0c0c0c !important;
                    border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    border-radius: 8px !important;
                }
            `}</style>
            {/* Header Section */}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-black italic tracking-tight uppercase">Document Management</h1>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Manage system manuals, guides, and technical records</p>
                </div>
                <button
                    onClick={() => openEditor()}
                    class="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                >
                    <Plus class="w-4 h-4" />
                    New Document
                </button>
            </div>

            {/* Stats & Filters */}
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div class="bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                        <FileText class="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                        <div class="text-[10px] font-black text-gray-500 uppercase">Total Docs</div>
                        <div class="text-xl font-black italic">{documents().length}</div>
                    </div>
                </div>
                <div class="md:col-span-3 bg-white/[0.03] border border-white/5 p-4 rounded-2xl flex items-center gap-4">
                    <div class="relative flex-1">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="SEARCH BY TITLE OR CATEGORY..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-[10px] font-bold text-white uppercase placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                        />
                    </div>
                    <button class="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold text-gray-400 hover:text-white transition-colors">
                        <Filter class="w-4 h-4" />
                        Sort: Newest
                    </button>
                </div>
            </div>

            {/* Document List View */}
            <div class="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl">
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-white/5 bg-white/[0.02] text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                <th class="px-8 py-5">Document</th>
                                <th class="px-8 py-5">Category</th>
                                <th class="px-8 py-5">Type</th>
                                <th class="px-8 py-5">Updated</th>
                                <th class="px-8 py-5">Author</th>
                                <th class="px-8 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-white/5">
                            <For each={filteredDocs()}>
                                {(doc) => (
                                    <tr
                                        onClick={() => openViewer(doc)}
                                        class="hover:bg-white/[0.02] transition-all cursor-pointer group"
                                    >
                                        <td class="px-8 py-6">
                                            <div class="flex items-center gap-4">
                                                <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-all">
                                                    <FileText class="w-5 h-5 text-gray-400 group-hover:text-cyan-400" />
                                                </div>
                                                <span class="text-[13px] font-bold group-hover:text-cyan-400 transition-colors">{doc.title}</span>
                                            </div>
                                        </td>
                                        <td class="px-8 py-6">
                                            <span class="px-2 py-1 bg-white/5 border border-white/10 rounded-md text-[9px] font-black text-gray-400 uppercase">
                                                {doc.category}
                                            </span>
                                        </td>
                                        <td class="px-8 py-6 text-[11px] text-gray-500 font-medium">{doc.type}</td>
                                        <td class="px-8 py-6 text-[11px] text-gray-500 font-medium">{doc.updatedAt}</td>
                                        <td class="px-8 py-6">
                                            <div class="flex items-center gap-2">
                                                <div class="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-[10px] font-black uppercase">
                                                    {doc.author[0]}
                                                </div>
                                                <span class="text-[11px] text-gray-400">{doc.author}</span>
                                            </div>
                                        </td>
                                        <td class="px-8 py-6 text-right">
                                            <button class="p-2 text-gray-500 hover:text-white transition-colors">
                                                <MoreHorizontal class="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Viewer Modal (Read-Only) */}
            <Show when={isViewerOpen() && selectedDoc()}>
                <div class="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsViewerOpen(false)}
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
                                    <FileText class="w-6 h-6" />
                                </div>
                                <div>
                                    <div class="flex items-center gap-3 mb-1">
                                        <span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-wider">
                                            {selectedDoc()!.category}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-wider">
                                            {selectedDoc()!.type}
                                        </span>
                                    </div>
                                    <h2 class="text-xl md:text-2xl font-black italic tracking-tight text-white leading-tight">
                                        {selectedDoc()!.title}
                                    </h2>
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <button
                                    onClick={handleEditFromViewer}
                                    class="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-cyan-400 hover:text-cyan-300 transition-all flex items-center gap-2"
                                >
                                    <Type class="w-3.5 h-3.5" />
                                    Edit Document
                                </button>
                                <button
                                    onClick={() => setIsViewerOpen(false)}
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
                                            {selectedDoc()!.author[0]}
                                        </div>
                                        <div>
                                            <div class="text-[11px] font-bold text-white">{selectedDoc()!.author}</div>
                                            <div class="text-[10px] text-gray-500">Last updated on {selectedDoc()!.updatedAt}</div>
                                        </div>
                                    </div>
                                    <div class="text-[10px] font-mono text-gray-600">ID: {selectedDoc()!.id}</div>
                                </div>

                                {/* Main Body */}
                                <div class="ql-editor-view" innerHTML={selectedDoc()!.content} />

                                {/* Viewer Attachments */}
                                <Show when={selectedDoc()!.attachments && selectedDoc()!.attachments.length > 0}>
                                    <div class="mt-12 pt-8 border-t border-white/5">
                                        <h3 class="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                                            <Paperclip class="w-3.5 h-3.5" />
                                            Attachments
                                        </h3>
                                        <div class="flex flex-wrap gap-3">
                                            <For each={selectedDoc()!.attachments}>
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

            {/* Smart Editor Modal */}
            <Show when={isEditorOpen()}>
                <div class="fixed inset-0 z-[200] flex items-center justify-center p-6">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsEditorOpen(false)}
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
                                    <h2 class="text-2xl font-black italic tracking-tight">{selectedDoc() ? 'EDIT DOCUMENT' : 'NEW DOCUMENT'}</h2>
                                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Rich-Text Smart Editor with Markdown Support</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditorOpen(false)}
                                class="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center active:scale-95"
                            >
                                <X class="w-6 h-6 text-gray-400" />
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div class="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                            {/* Meta Inputs Rows */}
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
                                        <option value="운영 매뉴얼">운영 매뉴얼</option>
                                        <option value="기술 문서">기술 문서</option>
                                        <option value="기획안">기획안</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Document Type</label>
                                    <select
                                        value={docType()}
                                        onChange={(e) => setDocType(e.currentTarget.value)}
                                        class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none"
                                    >
                                        <option value="텍스트/매뉴얼">텍스트/매뉴얼</option>
                                        <option value="기술 자료">기술 자료</option>
                                        <option value="시스템 공지">시스템 공지</option>
                                    </select>
                                </div>
                            </div>

                            {/* Editor Container */}
                            <div class="space-y-2">
                                <label class="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Content</label>
                                <div class="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden min-h-[400px]">
                                    <div ref={editorRef} class="h-[400px] text-gray-300" />
                                </div>
                            </div>

                            {/* Attachments UI */}
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
                                <Show when={attachments().length === 0}>
                                    <p class="text-[10px] text-gray-600 italic">No files attached to this document.</p>
                                </Show>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div class="p-8 border-t border-white/5 bg-white/[0.02] flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <button
                                    onClick={() => setIsEditorOpen(false)}
                                    class="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 transition-all"
                                >
                                    Cancel
                                </button>
                                <Show when={selectedDoc()}>
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        class="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center gap-2"
                                    >
                                        <Trash2 class="w-4 h-4" />
                                        Delete
                                    </button>
                                </Show>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving() || !title()}
                                class="px-10 py-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-3 active:scale-95"
                            >
                                <Show when={isSaving()} fallback={<Save class="w-4 h-4" />}>
                                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </Show>
                                {isSaving() ? 'Saving Changes...' : 'Save & Publish'}
                            </button>
                        </div>
                    </Motion.div>
                </div>
            </Show>

            {/* Deletion Confirmation Modal */}
            <Show when={showDeleteConfirm()}>
                <div class="fixed inset-0 z-[300] flex items-center justify-center p-6">
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowDeleteConfirm(false)}
                        class="absolute inset-0 bg-black/90 backdrop-blur-xl"
                    />
                    <Motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        class="relative w-full max-w-md bg-[#0c0c0c] border border-red-500/20 rounded-[32px] p-8 shadow-2xl shadow-red-500/5 text-center"
                    >
                        <div class="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6 text-red-500">
                            <Trash2 class="w-10 h-10" />
                        </div>
                        <h3 class="text-2xl font-black italic tracking-tight mb-2">DELETE DOCUMENT?</h3>
                        <p class="text-sm text-gray-500 font-medium mb-8">
                            Are you sure you want to delete <span class="text-white font-bold">"{selectedDoc()?.title}"</span>?<br />
                            This action cannot be undone.
                        </p>

                        <div class="flex flex-col gap-3">
                            <button
                                onClick={handleDelete}
                                disabled={isSaving()}
                                class="w-full py-4 bg-red-500 hover:bg-red-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Show when={isSaving()}>
                                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                </Show>
                                YES, DELETE PERMANENTLY
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                class="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                Keep Document
                            </button>
                        </div>
                    </Motion.div>
                </div>
            </Show>
        </div>
    );
}
