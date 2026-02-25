import { createSignal, onMount, For, Show, createMemo } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    DiskFile,
    listPublishedMaterials,
    purchaseMaterial,
    checkPurchaseStatus,
    formatFileSize
} from '../../services/diskService';
import {
    ShoppingBag,
    Search,
    Filter,
    Download,
    Globe,
    User,
    Clock,
    Tag,
    Lock,
    ExternalLink,
    CheckCircle,
    ChevronRight,
    SearchX,
    FileText,
    FileImage,
    FileVideo,
    FileAudio,
    File as FileIcon
} from 'lucide-solid';
import { useAuth } from '../auth/authContext';

const FileTypeIcon = (props: { type: string; name: string; class?: string }) => {
    const mime = () => props.type || '';
    if (mime().startsWith('image/')) return <FileImage class={props.class || 'w-5 h-5'} />;
    if (mime().startsWith('video/')) return <FileVideo class={props.class || 'w-5 h-5'} />;
    if (mime().startsWith('audio/')) return <FileAudio class={props.class || 'w-5 h-5'} />;
    if (mime().includes('pdf') || mime().includes('document') || mime().includes('text'))
        return <FileText class={props.class || 'w-5 h-5'} />;
    return <FileIcon class={props.class || 'w-5 h-5'} />;
};

const fileTypeColor = (type: string): string => {
    if (type.startsWith('image/')) return 'text-pink-400';
    if (type.startsWith('video/')) return 'text-purple-400';
    if (type.startsWith('audio/')) return 'text-amber-400';
    if (type.includes('pdf')) return 'text-red-400';
    return 'text-gray-400';
};

const VisionMarket = (props: { walletAddress?: string }) => {
    const auth = useAuth();
    const [items, setItems] = createSignal<DiskFile[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [purchasingId, setPurchasingId] = createSignal('');
    const [purchasedIds, setPurchasedIds] = createSignal<Set<string>>(new Set());

    const loadMarket = async () => {
        setIsLoading(true);
        try {
            const data = await listPublishedMaterials();
            setItems(data);

            if (auth.user()?.email) {
                const purchasedSet = new Set<string>();
                for (const item of data) {
                    const isPurchased = await checkPurchaseStatus(auth.user()!.email!, item.id);
                    if (isPurchased) purchasedSet.add(item.id);
                }
                setPurchasedIds(purchasedSet);
            }
        } catch (e) {
            console.error('Failed to load market:', e);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(loadMarket);

    const filteredItems = createMemo(() => {
        const q = searchQuery().toLowerCase().trim();
        if (!q) return items();
        return items().filter(i =>
            i.name.toLowerCase().includes(q) ||
            i.publisherEmail?.toLowerCase().includes(q)
        );
    });

    const handlePurchase = async (item: DiskFile) => {
        if (!auth.user()) {
            alert('Please login to purchase.');
            return;
        }

        if (purchasedIds().has(item.id) || item.publisherEmail === auth.user()?.email) {
            window.open(item.downloadURL, '_blank');
            return;
        }

        if (!confirm(`Purchase "${item.name}" for ${item.priceVcn} VCN?`)) return;

        setPurchasingId(item.id);
        try {
            const result = await purchaseMaterial(item.id);
            if (result.success) {
                setPurchasedIds(prev => new Set(prev).add(item.id));
                alert('Purchase successful!');
                window.open(result.downloadURL, '_blank');
            }
        } catch (err: any) {
            console.error('Purchase failed:', err);
            alert('Purchase failed: ' + (err.message || 'Check balance and allowance.'));
        } finally {
            setPurchasingId('');
        }
    };

    return (
        <div class="h-full flex flex-col pt-[max(env(safe-area-inset-top,20px),24px)] lg:pt-8 px-4 lg:px-8 pb-32 lg:pb-8 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar">
            {/* ── Header ── */}
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 shrink-0">
                <div class="space-y-1">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400 uppercase tracking-widest">Global Channel</span>
                    </div>
                    <h1 class="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <ShoppingBag class="w-8 h-8 text-cyan-400" />
                        VISION MARKET
                    </h1>
                    <p class="text-sm text-gray-400 font-medium">Discover and purchase premium datasets, media, and documents.</p>
                </div>

                <div class="flex items-center gap-3">
                    <div class="relative">
                        <Search class="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search materials..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="h-12 w-64 pl-11 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
                        />
                    </div>
                    <button
                        onClick={loadMarket}
                        class="h-12 w-12 flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-2xl text-gray-400 hover:text-white transition-all"
                    >
                        <Filter class="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div class="flex-1 min-h-0">
                <Show when={!isLoading()} fallback={
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        <For each={[1, 2, 3, 4, 5, 6]}>
                            {() => (
                                <div class="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 h-64 animate-pulse">
                                    <div class="w-full h-32 bg-white/[0.03] rounded-2xl mb-4" />
                                    <div class="h-4 w-3/4 bg-white/[0.03] rounded mb-2" />
                                    <div class="h-3 w-1/2 bg-white/[0.03] rounded" />
                                </div>
                            )}
                        </For>
                    </div>
                }>
                    <Show when={filteredItems().length > 0} fallback={
                        <div class="flex flex-col items-center justify-center py-20 text-center">
                            <div class="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center mb-6 border border-white/5">
                                <SearchX class="w-10 h-10 text-gray-600" />
                            </div>
                            <h3 class="text-xl font-bold text-white mb-2">No materials found</h3>
                            <p class="text-sm text-gray-500 max-w-sm">Try adjusting your search or check back later for new content.</p>
                        </div>
                    }>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <For each={filteredItems()}>
                                {(item) => (
                                    <Motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        class="group bg-[#12121a] border border-white/[0.05] hover:border-cyan-500/30 rounded-3xl p-5 transition-all relative overflow-hidden flex flex-col"
                                    >
                                        {/* BG Glow */}
                                        <div class="absolute -right-8 -top-8 w-24 h-24 bg-cyan-500/5 rounded-full blur-3xl group-hover:bg-cyan-500/10 transition-all" />

                                        {/* Status Tag */}
                                        <Show when={purchasedIds().has(item.id) || item.publisherEmail === auth.user()?.email}>
                                            <div class="absolute top-4 left-4 z-10 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-[9px] font-black text-green-400 uppercase tracking-tighter flex items-center gap-1">
                                                <CheckCircle class="w-2.5 h-2.5" /> {item.publisherEmail === auth.user()?.email ? 'Owned' : 'Purchased'}
                                            </div>
                                        </Show>

                                        {/* Thumbnail Area */}
                                        <div class="w-full aspect-video rounded-2xl bg-black/40 mb-4 flex items-center justify-center overflow-hidden border border-white/5 relative">
                                            <Show when={item.type.startsWith('image/')} fallback={
                                                <div class={`${fileTypeColor(item.type)} opacity-40 group-hover:opacity-100 transition-all`}>
                                                    <FileTypeIcon type={item.type} name={item.name} class="w-12 h-12" />
                                                </div>
                                            }>
                                                <img src={item.downloadURL} alt={item.name} class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                                            </Show>
                                            {/* Overlay for non-purchased */}
                                            <Show when={!purchasedIds().has(item.id) && item.publisherEmail !== auth.user()?.email}>
                                                <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                                    <Lock class="w-6 h-6 text-white/50" />
                                                </div>
                                            </Show>
                                        </div>

                                        {/* Content Info */}
                                        <div class="flex-1 space-y-2">
                                            <div class="text-base font-black text-white leading-tight truncate px-1">{item.name}</div>
                                            <div class="flex items-center justify-between text-[11px] text-gray-500 px-1">
                                                <span class="flex items-center gap-1"><Clock class="w-3 h-3" /> {new Date(item.publishedAt || item.createdAt).toLocaleDateString()}</span>
                                                <span>{formatFileSize(item.size)}</span>
                                            </div>
                                            <div class="flex items-center gap-2 px-1 pt-1 mb-4">
                                                <div class="w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center border border-white/5">
                                                    <User class="w-3 h-3 text-gray-400" />
                                                </div>
                                                <span class="text-[11px] font-medium text-gray-400 truncate">{item.publisherEmail?.split('@')[0]}</span>
                                            </div>
                                        </div>

                                        {/* Footer / Purchase Button */}
                                        <div class="pt-4 border-t border-white/[0.04] mt-auto flex items-center justify-between">
                                            <div class="flex flex-col">
                                                <span class="text-[9px] font-bold text-gray-600 uppercase">Price</span>
                                                <span class="text-lg font-black text-cyan-400 leading-none">{item.priceVcn} <span class="text-xs">VCN</span></span>
                                            </div>

                                            <button
                                                onClick={() => handlePurchase(item)}
                                                disabled={purchasingId() === item.id}
                                                class={`h-10 px-5 flex items-center justify-center gap-2 rounded-xl font-black text-xs uppercase tracking-tight transition-all active:scale-95 ${purchasedIds().has(item.id) || item.publisherEmail === auth.user()?.email
                                                        ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10'
                                                        : 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-lg shadow-cyan-500/20'
                                                    }`}
                                            >
                                                {purchasingId() === item.id ? (
                                                    <div class="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                                ) : (
                                                    purchasedIds().has(item.id) || item.publisherEmail === auth.user()?.email
                                                        ? <><Download class="w-4 h-4" /> Download</>
                                                        : <><Tag class="w-4 h-4" /> Buy Now</>
                                                )}
                                            </button>
                                        </div>
                                    </Motion.div>
                                )}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>
        </div>
    );
};

export default VisionMarket;
