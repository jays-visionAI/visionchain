import { createSignal, Show, For, onMount, createMemo } from 'solid-js';
import type { JSX } from 'solid-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '../../services/firebaseService';

// ─── SVG Icons ────────────────────

const CopyIcon = () => (
    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const CheckIcon = () => (
    <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const SparklesIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
    </svg>
);

const RefreshIcon = () => (
    <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="21 3 21 9 15 9" />
    </svg>
);

// ─── Types ────────────────────

interface ContentDraft {
    id: string;
    updateType: string;
    version: string | null;
    sourceNotes: string;
    content: Record<string, string>;
    status: string;
    createdAt: string;
    updatedAt: string;
    publishedFormats: string[];
}

type ContentFormat = {
    key: string;
    label: string;
    platform: string;
    maxChars?: number;
};

const CONTENT_FORMATS: ContentFormat[] = [
    { key: 'announcement_ko', label: 'Announcement (KO)', platform: 'Blog' },
    { key: 'announcement_en', label: 'Announcement (EN)', platform: 'Blog' },
    { key: 'twitter_ko', label: 'Twitter/X (KO)', platform: 'Twitter', maxChars: 240 },
    { key: 'twitter_en', label: 'Twitter/X (EN)', platform: 'Twitter', maxChars: 240 },
    { key: 'telegram_ko', label: 'Telegram (KO)', platform: 'Telegram' },
    { key: 'telegram_en', label: 'Telegram (EN)', platform: 'Telegram' },
    { key: 'push_title_ko', label: 'Push Title (KO)', platform: 'Push', maxChars: 40 },
    { key: 'push_title_en', label: 'Push Title (EN)', platform: 'Push', maxChars: 40 },
    { key: 'push_body_ko', label: 'Push Body (KO)', platform: 'Push', maxChars: 100 },
    { key: 'push_body_en', label: 'Push Body (EN)', platform: 'Push', maxChars: 100 },
    { key: 'blog_title_ko', label: 'Blog Title (KO)', platform: 'Blog' },
    { key: 'blog_title_en', label: 'Blog Title (EN)', platform: 'Blog' },
    { key: 'blog_body_ko', label: 'Blog Post (KO)', platform: 'Blog' },
    { key: 'blog_body_en', label: 'Blog Post (EN)', platform: 'Blog' },
];

// ─── Component ────────────────────

export function AdminAutoDrafts(): JSX.Element {
    const [drafts, setDrafts] = createSignal<ContentDraft[]>([]);
    const [loading, setLoading] = createSignal(true);
    const [generating, setGenerating] = createSignal(false);
    const [expandedDraft, setExpandedDraft] = createSignal<string | null>(null);
    const [copiedKey, setCopiedKey] = createSignal<string | null>(null);
    const [statusFilter, setStatusFilter] = createSignal<string>('all');

    // Manual generation form
    const [genNotes, setGenNotes] = createSignal('');
    const [genType, setGenType] = createSignal<string>('feature');
    const [genVersion, setGenVersion] = createSignal('');

    const functions = getFunctions(getFirebaseApp(), 'us-central1');

    const filteredDrafts = createMemo(() => {
        const filter = statusFilter();
        if (filter === 'all') return drafts();
        return drafts().filter(d => d.status === filter);
    });

    async function loadDrafts() {
        setLoading(true);
        try {
            const fn = httpsCallable(functions, 'getContentDrafts');
            const res = await fn({ status: 'all', limit: 30 }) as any;
            setDrafts(res.data.drafts || []);
        } catch (err) {
            console.error('Failed to load drafts:', err);
        } finally {
            setLoading(false);
        }
    }

    async function generateContent() {
        if (!genNotes().trim()) return;
        setGenerating(true);
        try {
            const fn = httpsCallable(functions, 'generateReleaseContent');
            await fn({
                releaseNotes: genNotes(),
                updateType: genType(),
                version: genVersion() || undefined,
            });
            setGenNotes('');
            setGenVersion('');
            await loadDrafts();
        } catch (err) {
            console.error('Failed to generate content:', err);
        } finally {
            setGenerating(false);
        }
    }

    async function updateDraftStatus(draftId: string, newStatus: string) {
        try {
            const fn = httpsCallable(functions, 'updateContentDraft');
            await fn({ draftId, updates: { status: newStatus } });
            setDrafts(prev => prev.map(d =>
                d.id === draftId ? { ...d, status: newStatus, updatedAt: new Date().toISOString() } : d
            ));
        } catch (err) {
            console.error('Failed to update draft:', err);
        }
    }

    function copyToClipboard(text: string, key: string) {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString('ko', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    const typeColors: Record<string, string> = {
        release: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
        feature: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
        hotfix: 'bg-red-500/15 text-red-400 border-red-500/20',
        weekly: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    };

    const statusColors: Record<string, string> = {
        draft: 'bg-amber-500/15 text-amber-400',
        approved: 'bg-green-500/15 text-green-400',
        published: 'bg-blue-500/15 text-blue-400',
        archived: 'bg-gray-500/15 text-gray-400',
    };

    onMount(loadDrafts);

    return (
        <div class="space-y-6">
            {/* ─── Generate New Content ─── */}
            <div class="bg-[#111113] rounded-2xl border border-white/[0.06] p-5">
                <div class="flex items-center gap-2 mb-4">
                    <SparklesIcon />
                    <h3 class="text-sm font-black text-white uppercase tracking-wider">Generate Content</h3>
                </div>

                <div class="space-y-3">
                    {/* Type + Version Row */}
                    <div class="flex gap-3">
                        <select
                            value={genType()}
                            onChange={(e) => setGenType(e.target.value)}
                            class="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white focus:outline-none focus:border-cyan-500/30"
                        >
                            <option value="feature">New Feature</option>
                            <option value="release">Product Release</option>
                            <option value="hotfix">Bug Fix / Hotfix</option>
                            <option value="weekly">Weekly Update</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Version (optional, e.g. 1.2.0)"
                            value={genVersion()}
                            onInput={(e) => setGenVersion(e.target.value)}
                            class="flex-1 max-w-48 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30"
                        />
                    </div>

                    {/* Notes textarea */}
                    <textarea
                        placeholder="Describe the update... (e.g. 'Added Spot/Futures Division to Quant Arena with 1,000 VCN prizes each. Fixed Live Trading agent creation.')"
                        value={genNotes()}
                        onInput={(e) => setGenNotes(e.target.value)}
                        rows={4}
                        class="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 resize-none"
                    />

                    <button
                        onClick={generateContent}
                        disabled={!genNotes().trim() || generating()}
                        class="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold text-sm rounded-xl transition-colors"
                    >
                        <Show when={generating()}>
                            <div class="w-4 h-4 border-2 border-black/50 border-t-black rounded-full animate-spin" />
                        </Show>
                        <Show when={!generating()}>
                            <SparklesIcon />
                        </Show>
                        {generating() ? 'Generating...' : 'Generate All Formats'}
                    </button>
                </div>
            </div>

            {/* ─── Filter Bar ─── */}
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    {['all', 'draft', 'approved', 'published', 'archived'].map(s => (
                        <button
                            onClick={() => setStatusFilter(s)}
                            class={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${statusFilter() === s
                                ? 'bg-white/[0.08] text-white'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                                }`}
                        >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
                <button
                    onClick={loadDrafts}
                    class="p-2 hover:bg-white/[0.04] rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                    <RefreshIcon />
                </button>
            </div>

            {/* ─── Drafts List ─── */}
            <Show when={loading()}>
                <div class="flex justify-center py-12">
                    <div class="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
            </Show>

            <Show when={!loading() && filteredDrafts().length === 0}>
                <div class="flex flex-col items-center py-12 bg-[#111113] rounded-2xl border border-white/[0.04]">
                    <SparklesIcon />
                    <p class="text-sm text-gray-500 mt-3">No content drafts found</p>
                    <p class="text-xs text-gray-600 mt-1">Generate content above or finalize a release to auto-create drafts</p>
                </div>
            </Show>

            <Show when={!loading()}>
                <div class="space-y-3">
                    <For each={filteredDrafts()}>
                        {(draft) => {
                            const isExpanded = () => expandedDraft() === draft.id;
                            return (
                                <div class="bg-[#111113] rounded-2xl border border-white/[0.06] overflow-hidden">
                                    {/* Header */}
                                    <div
                                        onClick={() => setExpandedDraft(isExpanded() ? null : draft.id)}
                                        class="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div class="flex items-center gap-3">
                                            <span class={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${typeColors[draft.updateType] || typeColors.feature}`}>
                                                {draft.updateType}
                                            </span>
                                            <span class="text-sm font-bold text-white">
                                                {draft.content?.summary || draft.sourceNotes?.slice(0, 60) || 'Untitled'}
                                            </span>
                                            {draft.version && (
                                                <span class="text-[10px] text-gray-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                                    v{draft.version}
                                                </span>
                                            )}
                                        </div>
                                        <div class="flex items-center gap-3">
                                            <span class={`px-2 py-0.5 rounded text-[9px] font-bold ${statusColors[draft.status] || statusColors.draft}`}>
                                                {draft.status}
                                            </span>
                                            <span class="text-[10px] text-gray-600">{formatDate(draft.createdAt)}</span>
                                            <svg viewBox="0 0 24 24" class={`w-4 h-4 text-gray-500 transition-transform ${isExpanded() ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" stroke-width="2">
                                                <polyline points="6 9 12 15 18 9" />
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Expanded Content */}
                                    <Show when={isExpanded()}>
                                        <div class="px-5 pb-5 border-t border-white/[0.04] pt-4">
                                            {/* Status Actions */}
                                            <div class="flex items-center gap-2 mb-4">
                                                <span class="text-[10px] text-gray-500 mr-2">Status:</span>
                                                {['draft', 'approved', 'published', 'archived'].map(s => (
                                                    <button
                                                        onClick={() => updateDraftStatus(draft.id, s)}
                                                        class={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${draft.status === s
                                                            ? 'bg-white/[0.1] text-white'
                                                            : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'
                                                            }`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Content Cards by Platform */}
                                            <div class="space-y-4">
                                                {/* Group by platform */}
                                                {['Twitter', 'Telegram', 'Push', 'Blog'].map(platform => {
                                                    const formats = CONTENT_FORMATS.filter(f => f.platform === platform);
                                                    const hasContent = formats.some(f => draft.content?.[f.key]);
                                                    if (!hasContent) return null;
                                                    return (
                                                        <div>
                                                            <h5 class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{platform}</h5>
                                                            <div class={`grid ${platform === 'Push' ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                                                                <For each={formats.filter(f => draft.content?.[f.key])}>
                                                                    {(fmt) => {
                                                                        const text = draft.content[fmt.key] || '';
                                                                        const isOverLimit = fmt.maxChars ? text.length > fmt.maxChars : false;
                                                                        const uniqueKey = `${draft.id}_${fmt.key}`;
                                                                        return (
                                                                            <div class="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04] group relative">
                                                                                <div class="flex items-center justify-between mb-1.5">
                                                                                    <span class="text-[9px] font-bold text-gray-500 uppercase">{fmt.label}</span>
                                                                                    <div class="flex items-center gap-1.5">
                                                                                        {fmt.maxChars && (
                                                                                            <span class={`text-[9px] font-mono ${isOverLimit ? 'text-red-400' : 'text-gray-600'}`}>
                                                                                                {text.length}/{fmt.maxChars}
                                                                                            </span>
                                                                                        )}
                                                                                        <button
                                                                                            onClick={() => copyToClipboard(text, uniqueKey)}
                                                                                            class="p-1 hover:bg-white/[0.06] rounded transition-colors text-gray-500 hover:text-white"
                                                                                        >
                                                                                            {copiedKey() === uniqueKey ? <CheckIcon /> : <CopyIcon />}
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                                <p class={`text-[11px] leading-relaxed whitespace-pre-wrap ${platform === 'Push' ? 'text-white font-bold' : 'text-gray-300'}`}>
                                                                                    {text}
                                                                                </p>
                                                                            </div>
                                                                        );
                                                                    }}
                                                                </For>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Source Notes */}
                                            <div class="mt-4 pt-3 border-t border-white/[0.04]">
                                                <h5 class="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1">Source Input</h5>
                                                <p class="text-[10px] text-gray-500 whitespace-pre-wrap">{draft.sourceNotes}</p>
                                            </div>
                                        </div>
                                    </Show>
                                </div>
                            );
                        }}
                    </For>
                </div>
            </Show>
        </div>
    );
}

export default AdminAutoDrafts;
