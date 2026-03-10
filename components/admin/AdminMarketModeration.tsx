import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import {
    adminGetMarketModeration,
    adminRemoveMarketItem,
    adminBanPublisher,
    formatFileSize,
    type MarketModerationData,
    type DiskFile,
} from '../../services/diskService';

// ─── SVG Icons ───
const ShieldIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);
const TrashIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14H7L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
);
const BanIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
);
const UnbanIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
const RefreshIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
);
const SearchIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);
const AlertIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);
const FileIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
);
const UserIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
);
const ClockIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-3 h-3'}>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);
const XIcon = (props: { class?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class={props.class || 'w-4 h-4'}>
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// ─── Predefined Violation Reasons ───
const VIOLATION_REASONS = [
    'Illegal content',
    'Copyright infringement',
    'Explicit / NSFW content',
    'Malware or malicious file',
    'Spam or misleading content',
    'Hate speech or harassment',
    'Privacy violation (personal data)',
    'Other (specify below)',
];

export default function AdminMarketModeration() {
    const [data, setData] = createSignal<MarketModerationData | null>(null);
    const [isLoading, setIsLoading] = createSignal(true);
    const [activeSubTab, setActiveSubTab] = createSignal<'items' | 'banned' | 'violations'>('items');
    const [searchQuery, setSearchQuery] = createSignal('');

    // Remove modal state
    const [showRemoveModal, setShowRemoveModal] = createSignal(false);
    const [removeTarget, setRemoveTarget] = createSignal<(DiskFile & { id: string }) | null>(null);
    const [removeReason, setRemoveReason] = createSignal('');
    const [removeCustomReason, setRemoveCustomReason] = createSignal('');
    const [removeAutoBan, setRemoveAutoBan] = createSignal(false);
    const [isRemoving, setIsRemoving] = createSignal(false);

    // Ban modal state
    const [showBanModal, setShowBanModal] = createSignal(false);
    const [banTargetEmail, setBanTargetEmail] = createSignal('');
    const [banReason, setBanReason] = createSignal('');
    const [isBanning, setIsBanning] = createSignal(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const result = await adminGetMarketModeration();
            setData(result);
        } catch (e) {
            console.error('[AdminMarket] Failed to load:', e);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(loadData);

    const filteredItems = createMemo(() => {
        const d = data();
        if (!d) return [];
        const q = searchQuery().toLowerCase().trim();
        if (!q) return d.publishedItems;
        return d.publishedItems.filter(i =>
            i.name?.toLowerCase().includes(q) ||
            i.publisherEmail?.toLowerCase().includes(q)
        );
    });

    const openRemoveModal = (item: DiskFile & { id: string }) => {
        setRemoveTarget(item);
        setRemoveReason('');
        setRemoveCustomReason('');
        setRemoveAutoBan(false);
        setShowRemoveModal(true);
    };

    const executeRemove = async () => {
        const target = removeTarget();
        if (!target) return;

        const reason = removeReason() === 'Other (specify below)' ? removeCustomReason() : removeReason();
        if (!reason.trim()) {
            alert('Please select or enter a reason.');
            return;
        }

        setIsRemoving(true);
        try {
            await adminRemoveMarketItem(target.id, reason, removeAutoBan());
            setShowRemoveModal(false);
            await loadData();
            alert(`Item "${target.name}" removed from market.${removeAutoBan() ? ` Publisher ${target.publisherEmail} has been permanently banned.` : ''}`);
        } catch (e: any) {
            alert('Failed to remove: ' + (e.message || 'Unknown error'));
        } finally {
            setIsRemoving(false);
        }
    };

    const executeBan = async () => {
        const email = banTargetEmail().trim().toLowerCase();
        if (!email) return;

        setIsBanning(true);
        try {
            await adminBanPublisher(email, 'ban', banReason() || 'Admin decision');
            setShowBanModal(false);
            setBanTargetEmail('');
            setBanReason('');
            await loadData();
            alert(`${email} has been permanently banned from publishing.`);
        } catch (e: any) {
            alert('Failed to ban: ' + (e.message || 'Unknown error'));
        } finally {
            setIsBanning(false);
        }
    };

    const executeUnban = async (email: string) => {
        if (!confirm(`Unban ${email} and restore their publish access?`)) return;
        try {
            await adminBanPublisher(email, 'unban');
            await loadData();
        } catch (e: any) {
            alert('Failed to unban: ' + (e.message || 'Unknown error'));
        }
    };

    return (
        <div class="space-y-6">
            {/* ── Stats KPI Cards ── */}
            <Show when={data()}>
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                        <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Published Items</div>
                        <div class="text-3xl font-black text-white">{data()!.stats.totalPublished}</div>
                        <div class="text-[11px] text-gray-500 mt-1">Currently on market</div>
                    </div>
                    <div class="bg-white/[0.02] border border-red-500/10 rounded-2xl p-5">
                        <div class="text-xs font-bold text-red-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <BanIcon class="w-3.5 h-3.5" /> Banned Users
                        </div>
                        <div class="text-3xl font-black text-red-400">{data()!.stats.totalBanned}</div>
                        <div class="text-[11px] text-gray-500 mt-1">Permanently restricted</div>
                    </div>
                    <div class="bg-white/[0.02] border border-amber-500/10 rounded-2xl p-5">
                        <div class="text-xs font-bold text-amber-400/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <AlertIcon class="w-3.5 h-3.5" /> Total Violations
                        </div>
                        <div class="text-3xl font-black text-amber-400">{data()!.stats.totalViolations}</div>
                        <div class="text-[11px] text-gray-500 mt-1">All time records</div>
                    </div>
                </div>
            </Show>

            {/* ── Sub-tabs & Actions ── */}
            <div class="flex items-center justify-between">
                <div class="flex gap-1 bg-white/[0.02] border border-white/[0.06] rounded-xl p-1">
                    {(['items', 'banned', 'violations'] as const).map(tab => (
                        <button
                            onClick={() => setActiveSubTab(tab)}
                            class={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeSubTab() === tab
                                ? 'bg-white/[0.08] text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {tab === 'items' ? 'Published Items' : tab === 'banned' ? 'Banned Users' : 'Violation Log'}
                        </button>
                    ))}
                </div>
                <div class="flex items-center gap-2">
                    <Show when={activeSubTab() === 'banned'}>
                        <button
                            onClick={() => setShowBanModal(true)}
                            class="h-9 px-4 flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-xs font-bold text-red-400 transition-all"
                        >
                            <BanIcon class="w-3.5 h-3.5" /> Ban User
                        </button>
                    </Show>
                    <button
                        onClick={loadData}
                        disabled={isLoading()}
                        class="h-9 w-9 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl text-gray-400 hover:text-white transition-all"
                    >
                        <RefreshIcon class={`w-4 h-4 ${isLoading() ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* ── Loading State ── */}
            <Show when={isLoading()}>
                <div class="flex items-center justify-center py-16">
                    <div class="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                </div>
            </Show>

            {/* ── Tab: Published Items ── */}
            <Show when={!isLoading() && activeSubTab() === 'items'}>
                <div class="space-y-4">
                    {/* Search */}
                    <div class="relative">
                        <SearchIcon class="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by file name or publisher email..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="w-full h-11 pl-11 pr-4 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all"
                        />
                    </div>

                    {/* Items Table */}
                    <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                        <div class="grid grid-cols-[1fr_140px_100px_100px_120px] gap-4 px-5 py-3 border-b border-white/[0.04] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            <span>File</span>
                            <span>Publisher</span>
                            <span>Size</span>
                            <span>Price</span>
                            <span class="text-right">Actions</span>
                        </div>
                        <Show when={filteredItems().length === 0}>
                            <div class="px-5 py-12 text-center text-sm text-gray-600">
                                {searchQuery() ? 'No items match your search.' : 'No published items found.'}
                            </div>
                        </Show>
                        <For each={filteredItems()}>
                            {(item) => (
                                <div class="grid grid-cols-[1fr_140px_100px_100px_120px] gap-4 px-5 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-all items-center">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 border border-white/[0.06]">
                                            <Show when={item.thumbnailURL || item.thumbnail} fallback={
                                                <FileIcon class="w-4 h-4 text-gray-500" />
                                            }>
                                                <img src={item.thumbnailURL || item.thumbnail || ''} alt="" class="w-full h-full object-cover rounded-lg" />
                                            </Show>
                                        </div>
                                        <div class="min-w-0">
                                            <div class="text-sm font-bold text-white truncate">{item.name}</div>
                                            <div class="text-[10px] text-gray-600 flex items-center gap-1">
                                                <ClockIcon /> {new Date(item.publishedAt || item.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div class="text-xs text-gray-400 truncate">{item.publisherEmail?.split('@')[0]}</div>
                                    <div class="text-xs text-gray-400">{formatFileSize(item.size)}</div>
                                    <div class="text-xs font-bold text-cyan-400">{item.priceVcn || 0} VCN</div>
                                    <div class="flex items-center justify-end gap-1.5">
                                        <button
                                            onClick={() => openRemoveModal(item as DiskFile & { id: string })}
                                            class="h-8 px-3 flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-[11px] font-bold text-red-400 transition-all"
                                            title="Remove from market"
                                        >
                                            <TrashIcon class="w-3.5 h-3.5" /> Remove
                                        </button>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>
                </div>
            </Show>

            {/* ── Tab: Banned Users ── */}
            <Show when={!isLoading() && activeSubTab() === 'banned'}>
                <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div class="grid grid-cols-[1fr_120px_120px_150px_100px] gap-4 px-5 py-3 border-b border-white/[0.04] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        <span>Email</span>
                        <span>Violations</span>
                        <span>Banned By</span>
                        <span>Reason</span>
                        <span class="text-right">Actions</span>
                    </div>
                    <Show when={!data()?.bannedUsers?.length}>
                        <div class="px-5 py-12 text-center text-sm text-gray-600">No banned users.</div>
                    </Show>
                    <For each={data()?.bannedUsers || []}>
                        {(user) => (
                            <div class="grid grid-cols-[1fr_120px_120px_150px_100px] gap-4 px-5 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-all items-center">
                                <div class="flex items-center gap-2 min-w-0">
                                    <div class="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                                        <UserIcon class="w-3.5 h-3.5 text-red-400" />
                                    </div>
                                    <span class="text-sm font-bold text-white truncate">{user.email}</span>
                                </div>
                                <div class="text-xs font-bold text-amber-400">{user.violationCount}</div>
                                <div class="text-xs text-gray-500 truncate">{user.bannedBy?.split('@')[0] || '-'}</div>
                                <div class="text-xs text-gray-400 truncate" title={user.banReason}>{user.banReason || '-'}</div>
                                <div class="flex justify-end">
                                    <button
                                        onClick={() => executeUnban(user.email)}
                                        class="h-8 px-3 flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-[11px] font-bold text-green-400 transition-all"
                                    >
                                        <UnbanIcon class="w-3.5 h-3.5" /> Unban
                                    </button>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* ── Tab: Violation Log ── */}
            <Show when={!isLoading() && activeSubTab() === 'violations'}>
                <div class="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div class="grid grid-cols-[150px_1fr_120px_1fr_130px] gap-4 px-5 py-3 border-b border-white/[0.04] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        <span>Date</span>
                        <span>File</span>
                        <span>Publisher</span>
                        <span>Reason</span>
                        <span>Action</span>
                    </div>
                    <Show when={!data()?.violations?.length}>
                        <div class="px-5 py-12 text-center text-sm text-gray-600">No violations recorded.</div>
                    </Show>
                    <For each={data()?.violations || []}>
                        {(v) => (
                            <div class="grid grid-cols-[150px_1fr_120px_1fr_130px] gap-4 px-5 py-3 border-b border-white/[0.02] hover:bg-white/[0.02] transition-all items-center">
                                <div class="text-xs text-gray-500">{new Date(v.createdAt).toLocaleString()}</div>
                                <div class="text-xs font-bold text-white truncate">{v.fileName}</div>
                                <div class="text-xs text-gray-400 truncate">{v.publisherEmail?.split('@')[0]}</div>
                                <div class="text-xs text-gray-400 truncate" title={v.reason}>{v.reason}</div>
                                <div>
                                    <span class={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${v.action === 'auto_removed_ban'
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                        }`}>
                                        {v.action === 'auto_removed_ban' ? 'Auto-Removed' : 'Removed'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </For>
                </div>
            </Show>

            {/* ── Remove Confirmation Modal ── */}
            <Show when={showRemoveModal() && removeTarget()}>
                <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ "background-color": "rgba(0,0,0,0.7)", "backdrop-filter": "blur(8px)" }}>
                    <div class="w-full max-w-lg bg-[#0d0d14] border border-white/[0.08] rounded-3xl p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowRemoveModal(false)}
                            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all"
                        >
                            <XIcon />
                        </button>

                        <div class="space-y-5">
                            <div class="text-center">
                                <div class="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                                    <TrashIcon class="w-7 h-7 text-red-400" />
                                </div>
                                <h3 class="text-lg font-black text-white">Remove from Market</h3>
                                <p class="text-sm text-gray-500 mt-1">This will immediately remove the content and log a violation.</p>
                            </div>

                            {/* File Info */}
                            <div class="bg-white/[0.03] rounded-xl p-4 border border-white/[0.05] space-y-2">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-500">File</span>
                                    <span class="text-white font-bold truncate max-w-[200px]">{removeTarget()!.name}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-500">Publisher</span>
                                    <span class="text-gray-300">{removeTarget()!.publisherEmail}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-gray-500">Size</span>
                                    <span class="text-gray-300">{formatFileSize(removeTarget()!.size)}</span>
                                </div>
                            </div>

                            {/* Reason Selection */}
                            <div class="space-y-2">
                                <label class="text-xs font-bold text-gray-400 uppercase tracking-wider">Violation Reason</label>
                                <div class="grid grid-cols-2 gap-2">
                                    <For each={VIOLATION_REASONS}>
                                        {(reason) => (
                                            <button
                                                onClick={() => setRemoveReason(reason)}
                                                class={`px-3 py-2 rounded-lg text-xs font-medium text-left transition-all border ${removeReason() === reason
                                                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                                    : 'bg-white/[0.02] border-white/[0.06] text-gray-400 hover:border-white/[0.12]'
                                                    }`}
                                            >
                                                {reason}
                                            </button>
                                        )}
                                    </For>
                                </div>
                                <Show when={removeReason() === 'Other (specify below)'}>
                                    <input
                                        type="text"
                                        placeholder="Enter custom reason..."
                                        value={removeCustomReason()}
                                        onInput={(e) => setRemoveCustomReason(e.currentTarget.value)}
                                        class="w-full h-10 px-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                                    />
                                </Show>
                            </div>

                            {/* Auto-ban Toggle */}
                            <label class="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-xl cursor-pointer hover:bg-red-500/10 transition-all">
                                <input
                                    type="checkbox"
                                    checked={removeAutoBan()}
                                    onChange={(e) => setRemoveAutoBan(e.currentTarget.checked)}
                                    class="w-4 h-4 rounded accent-red-500"
                                />
                                <div>
                                    <div class="text-xs font-bold text-red-300 flex items-center gap-1.5">
                                        <BanIcon class="w-3.5 h-3.5" /> Also permanently ban this publisher
                                    </div>
                                    <div class="text-[10px] text-gray-500 mt-0.5">
                                        All their published content will be removed and they will be unable to publish again.
                                    </div>
                                </div>
                            </label>

                            {/* Actions */}
                            <div class="flex gap-3">
                                <button
                                    onClick={() => setShowRemoveModal(false)}
                                    class="flex-1 h-11 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 font-bold text-sm rounded-xl transition-all border border-white/[0.05]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeRemove}
                                    disabled={isRemoving() || (!removeReason() || (removeReason() === 'Other (specify below)' && !removeCustomReason().trim()))}
                                    class="flex-1 h-11 bg-red-500 hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {isRemoving() ? (
                                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <><TrashIcon class="w-4 h-4" /> Remove{removeAutoBan() ? ' & Ban' : ''}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>

            {/* ── Ban User Modal ── */}
            <Show when={showBanModal()}>
                <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ "background-color": "rgba(0,0,0,0.7)", "backdrop-filter": "blur(8px)" }}>
                    <div class="w-full max-w-md bg-[#0d0d14] border border-white/[0.08] rounded-3xl p-6 shadow-2xl relative">
                        <button
                            onClick={() => setShowBanModal(false)}
                            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all"
                        >
                            <XIcon />
                        </button>

                        <div class="space-y-5">
                            <div class="text-center">
                                <div class="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
                                    <BanIcon class="w-7 h-7 text-red-400" />
                                </div>
                                <h3 class="text-lg font-black text-white">Ban Publisher</h3>
                                <p class="text-sm text-gray-500 mt-1">Permanently revoke user's publish access</p>
                            </div>

                            <div class="space-y-3">
                                <div>
                                    <label class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">User Email</label>
                                    <input
                                        type="email"
                                        placeholder="user@example.com"
                                        value={banTargetEmail()}
                                        onInput={(e) => setBanTargetEmail(e.currentTarget.value)}
                                        class="w-full h-11 px-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                                    />
                                </div>
                                <div>
                                    <label class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Reason (optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Repeated policy violations..."
                                        value={banReason()}
                                        onInput={(e) => setBanReason(e.currentTarget.value)}
                                        class="w-full h-11 px-4 bg-white/[0.03] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div class="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                                <div class="text-[11px] text-red-300/80">
                                    <span class="font-bold">Warning:</span> Banning will immediately remove ALL of this user's published content from Vision Market and prevent future publishing.
                                </div>
                            </div>

                            <div class="flex gap-3">
                                <button
                                    onClick={() => setShowBanModal(false)}
                                    class="flex-1 h-11 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 font-bold text-sm rounded-xl transition-all border border-white/[0.05]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={executeBan}
                                    disabled={isBanning() || !banTargetEmail().trim()}
                                    class="flex-1 h-11 bg-red-500 hover:bg-red-400 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {isBanning() ? (
                                        <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <><BanIcon class="w-4 h-4" /> Permanently Ban</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
}
