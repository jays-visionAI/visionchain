import { createSignal, onMount, For, Show } from 'solid-js';
import {
    Search,
    Plus,
    Filter,
    FileText
} from 'lucide-solid';
import { getDocuments, saveAdminDocument, deleteAdminDocument, AdminDocument } from '../../services/firebaseService';

// Sub-components
import { DocTableRow } from './documents/DocTableRow';
import { DocViewerModal } from './documents/DocViewerModal';
import { DocEditorModal } from './documents/DocEditorModal';
import { DocDeleteModal } from './documents/DocDeleteModal';

const MOCK_DOCUMENTS: AdminDocument[] = [
    {
        id: '1',
        title: 'Vision Chain Node Classification (Authority, Consensus, Agent, Edge)',
        category: 'Technical Document',
        type: 'Technical Data',
        content: `<h1>Vision Chain Node Classification</h1><p>Vision Chain v2.0 consists of 4 core nodes based on roles and reward structures.</p><ul><li><strong>Authority Node</strong>: Network governance and final signing</li><li><strong>Consensus Node</strong>: Transaction verification and block creation</li><li><strong>Agent Node</strong>: AI inference and paymaster services</li><li><strong>Edge Node</strong>: Lightweight data processing and endpoint computing</li></ul>`,
        author: 'Vision Tech Team',
        updatedAt: '2024-03-20',
        attachments: []
    },
    {
        id: '2',
        title: 'Resource Contribution Model and Reward Structure',
        category: 'Economic Model',
        type: 'Technical Data',
        content: `<h2>Resource Contribution Reward (RC-Reward)</h2><p>Node contribution ($C_{node}$) is calculated as a combination of computing power ($P_{gpu}$) and storage capacity ($S_{data}$).</p><p>Reward formula: $R_{node} = (w_1 \\cdot P_{gpu} + w_2 \\cdot S_{data}) \\times U_{time}$</p>`,
        author: 'Eco Division',
        updatedAt: '2024-03-19',
        attachments: []
    },
    {
        id: '3',
        title: 'Vision Chain TVL Growth Strategy and Roadmap',
        category: 'Planning',
        type: 'Text/Manual',
        content: `<h2>TVL Growth 5-Step Plan</h2><ol><li><strong>Bootstrapping</strong>: Enhance early rewards</li><li><strong>Utility Expansion</strong>: Introduce resource staking</li><li><strong>Financial Infrastructure</strong>: Activate DEX and LST</li><li><strong>Real Revenue Settlement</strong>: AI service fee settlement</li><li><strong>Ecosystem Lock-in</strong>: Strengthen governance</li></ol>`,
        author: 'Ops Lead',
        updatedAt: '2024-03-18',
        attachments: []
    },
    {
        id: '4',
        title: '5-Node Cluster Deployment Guide on Single Server',
        category: 'Operations Manual',
        type: 'Technical Data',
        content: `<h3>5-Node Cluster Deployment</h3><p>Method of operating 5 nodes on a single server without port conflicts using Docker Compose. RPC ports are assigned from 8545 to 8549.</p>`,
        author: 'DevOps',
        updatedAt: '2024-03-17',
        attachments: []
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
            if (docs.length === 0) {
                setDocuments(MOCK_DOCUMENTS);
                (async () => {
                    try {
                        for (const d of MOCK_DOCUMENTS) {
                            await saveAdminDocument(d);
                        }
                    } catch (e) {
                        console.warn("[AdminDocuments] Seeding failed", e);
                    }
                })();
            } else {
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
            setDocuments([...MOCK_DOCUMENTS].sort((a, b) => b.id.localeCompare(a.id)));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (newDoc: AdminDocument) => {
        setIsSaving(true);
        try {
            await saveAdminDocument(newDoc);
            await loadDocuments();
            setIsEditorOpen(false);
        } catch (error) {
            console.error("Failed to save document:", error);
            alert("Failed to save.");
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
            alert("Failed to delete.");
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

                /* === Markdown Body Styles === */
                .markdown-body {
                    color: rgba(255, 255, 255, 0.85);
                    font-family: 'Inter', -apple-system, sans-serif;
                    font-size: 14px;
                    line-height: 1.7;
                    word-wrap: break-word;
                }
                .markdown-body h1 {
                    font-size: 1.75em;
                    font-weight: 900;
                    font-style: italic;
                    letter-spacing: -0.02em;
                    color: #fff;
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    padding-bottom: 0.5em;
                    margin: 1.5em 0 0.8em;
                }
                .markdown-body h1:first-child { margin-top: 0; }
                .markdown-body h2 {
                    font-size: 1.35em;
                    font-weight: 800;
                    color: #e5e7eb;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 0.4em;
                    margin: 1.4em 0 0.6em;
                }
                .markdown-body h3 {
                    font-size: 1.1em;
                    font-weight: 700;
                    color: #d1d5db;
                    margin: 1.2em 0 0.4em;
                }
                .markdown-body h4 {
                    font-size: 1em;
                    font-weight: 700;
                    color: #9ca3af;
                    margin: 1em 0 0.3em;
                }
                .markdown-body p { margin: 0.6em 0; }
                .markdown-body strong { color: #f3f4f6; font-weight: 700; }
                .markdown-body em { color: #d1d5db; }
                .markdown-body a {
                    color: #22d3ee;
                    text-decoration: none;
                }
                .markdown-body a:hover { text-decoration: underline; }

                /* Lists */
                .markdown-body ul, .markdown-body ol {
                    padding-left: 1.5em;
                    margin: 0.5em 0;
                }
                .markdown-body li {
                    margin: 0.3em 0;
                    color: rgba(255,255,255,0.75);
                }
                .markdown-body li::marker { color: #4b5563; }
                .markdown-body ul { list-style-type: disc; }
                .markdown-body ol { list-style-type: decimal; }

                /* Tables */
                .markdown-body table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 1em 0;
                    font-size: 13px;
                }
                .markdown-body thead tr {
                    background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .markdown-body th {
                    padding: 10px 16px;
                    text-align: left;
                    font-size: 10px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #6b7280;
                }
                .markdown-body td {
                    padding: 10px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    color: rgba(255,255,255,0.75);
                }
                .markdown-body tbody tr:hover {
                    background: rgba(255,255,255,0.02);
                }

                /* Code Blocks */
                .markdown-body pre {
                    background: rgba(0,0,0,0.4);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 12px;
                    padding: 0;
                    margin: 1em 0;
                    overflow-x: auto;
                }
                .markdown-body pre code {
                    display: block;
                    padding: 16px 20px;
                    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
                    font-size: 12.5px;
                    line-height: 1.6;
                    color: #e5e7eb;
                    background: transparent;
                    border: none;
                    border-radius: 0;
                }
                .markdown-body code {
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 6px;
                    padding: 2px 6px;
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 0.88em;
                    color: #22d3ee;
                }

                /* Blockquotes */
                .markdown-body blockquote {
                    border-left: 3px solid #22d3ee;
                    margin: 1em 0;
                    padding: 0.5em 1.2em;
                    background: rgba(6, 182, 212, 0.05);
                    border-radius: 0 8px 8px 0;
                    color: rgba(255,255,255,0.7);
                }
                .markdown-body blockquote > blockquote {
                    border-left-color: #f59e0b;
                    background: rgba(245, 158, 11, 0.05);
                }

                /* Alerts (GitHub style) */
                .markdown-body blockquote p:first-child strong:first-child {
                    display: block;
                    margin-bottom: 4px;
                }

                /* Horizontal Rule */
                .markdown-body hr {
                    border: none;
                    height: 1px;
                    background: rgba(255,255,255,0.06);
                    margin: 2em 0;
                }

                /* Mermaid Diagrams */
                .mermaid-diagram {
                    display: flex;
                    justify-content: center;
                    margin: 1.5em 0;
                    padding: 24px;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.06);
                    border-radius: 16px;
                }
                .mermaid-diagram svg {
                    max-width: 100%;
                    height: auto;
                }

                /* highlight.js dark overrides */
                .hljs { background: transparent !important; color: #e5e7eb !important; }
                .hljs-keyword { color: #c084fc !important; }
                .hljs-string { color: #86efac !important; }
                .hljs-comment { color: #6b7280 !important; font-style: italic; }
                .hljs-function { color: #93c5fd !important; }
                .hljs-number { color: #fdba74 !important; }
                .hljs-title { color: #67e8f9 !important; }
                .hljs-attr { color: #fca5a5 !important; }
                .hljs-built_in { color: #fcd34d !important; }
                .hljs-variable { color: #f9a8d4 !important; }
                .hljs-type { color: #a5b4fc !important; }
                .hljs-meta { color: #6b7280 !important; }
                .hljs-literal { color: #fdba74 !important; }
            `}</style>

            {/* Header Section */}
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 class="text-3xl font-black italic tracking-tight uppercase">Document Management</h1>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] mt-1">Manage system manuals, guides, and technical records</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedDoc(null);
                        setIsEditorOpen(true);
                    }}
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
                                    <DocTableRow
                                        doc={doc}
                                        onClick={(d) => {
                                            setSelectedDoc(d);
                                            setIsViewerOpen(true);
                                        }}
                                    />
                                )}
                            </For>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Extracted Modals */}
            <DocViewerModal
                isOpen={isViewerOpen()}
                doc={selectedDoc()}
                onClose={() => setIsViewerOpen(false)}
                onEdit={() => {
                    setIsViewerOpen(false);
                    setIsEditorOpen(true);
                }}
            />

            <DocEditorModal
                isOpen={isEditorOpen()}
                doc={selectedDoc()}
                isSaving={isSaving()}
                onClose={() => setIsEditorOpen(false)}
                onSave={handleSave}
                onDelete={() => setShowDeleteConfirm(true)}
            />

            <DocDeleteModal
                isOpen={showDeleteConfirm()}
                doc={selectedDoc()}
                isDeleting={isSaving()}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
            />
        </div>
    );
}
