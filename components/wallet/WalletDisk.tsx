import { createSignal, Show, For, onMount, createEffect, createMemo, onCleanup } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    HardDrive, UploadCloud, Folder, FolderPlus,
    File as FileIcon, FileText, FileImage, FileVideo, FileAudio,
    MoreVertical, Search, Grid, List, ChevronRight,
    Download, Trash2, Eye, X, ArrowLeft, Plus, Check, AlertTriangle
} from 'lucide-solid';
import { useAuth } from '../auth/authContext';
import {
    uploadDiskFile, listDiskFiles, deleteDiskFile, renameDiskFile,
    createDiskFolder, listDiskFolders, deleteDiskFolder, renameDiskFolder,
    getDiskUsage, formatFileSize, getFileExtension, subscribeToDisk, cancelDiskSubscription,
    type DiskFile, type DiskFolder, type DiskUsage, type UploadProgress
} from '../../services/diskService';
import { ethers } from 'ethers';

// ─── File Type Icon Picker ───

const FileTypeIcon = (props: { type: string; name: string; class?: string }) => {
    const ext = () => getFileExtension(props.name);
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
    if (type.includes('document') || type.includes('word')) return 'text-blue-400';
    if (type.includes('sheet') || type.includes('excel')) return 'text-green-400';
    return 'text-gray-400';
};

// ─── Main Component ───

export const WalletDisk = (props: { privateKey?: string; walletAddress?: string; networkMode?: string }) => {
    const auth = useAuth();
    const email = () => auth.user()?.email || '';

    // State
    const [files, setFiles] = createSignal<DiskFile[]>([]);
    const [folders, setFolders] = createSignal<DiskFolder[]>([]);
    const [usage, setUsage] = createSignal<DiskUsage>({ totalBytes: 0, fileCount: 0, limitBytes: 50 * 1024 * 1024 * 1024, status: 'none' });
    const [currentPath, setCurrentPath] = createSignal('/');
    const [viewMode, setViewMode] = createSignal<'grid' | 'list'>('grid');
    const [isLoading, setIsLoading] = createSignal(false);
    const [searchQuery, setSearchQuery] = createSignal('');
    const [isDragOver, setIsDragOver] = createSignal(false);
    const [uploadQueue, setUploadQueue] = createSignal<UploadProgress[]>([]);
    const [showUploadPanel, setShowUploadPanel] = createSignal(false);
    const [previewFile, setPreviewFile] = createSignal<DiskFile | null>(null);
    const [contextMenu, setContextMenu] = createSignal<{ item: DiskFile | DiskFolder; type: 'file' | 'folder'; x: number; y: number } | null>(null);
    const [showNewFolder, setShowNewFolder] = createSignal(false);
    const [newFolderName, setNewFolderName] = createSignal('');
    const [deletingId, setDeletingId] = createSignal('');
    const [renamingId, setRenamingId] = createSignal('');
    const [renameValue, setRenameValue] = createSignal('');

    // Subscription State
    const [isSubscribing, setIsSubscribing] = createSignal(false);
    const [subsError, setSubsError] = createSignal('');
    const [selectedGb, setSelectedGb] = createSignal(10);
    const [isCanceling, setIsCanceling] = createSignal(false);

    let fileInputRef: HTMLInputElement | undefined;

    // ─── Data Loading ───

    const loadData = async () => {
        if (!email()) return;
        setIsLoading(true);
        try {
            const [fileList, folderList, storageUsage] = await Promise.all([
                listDiskFiles(email(), currentPath()),
                listDiskFolders(email(), currentPath()),
                getDiskUsage(email()),
            ]);
            setFiles(fileList);
            setFolders(folderList);
            setUsage(storageUsage);
        } catch (e) {
            console.error('[Disk] Failed to load data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        if (email()) loadData();
    });

    createEffect(() => {
        if (email()) loadData();
    });

    // Reload on path change
    createEffect(() => {
        currentPath(); // dependency
        if (email()) loadData();
    });

    // ─── Breadcrumbs ───

    const breadcrumbs = createMemo(() => {
        const path = currentPath();
        if (path === '/') return [{ name: 'My Disk', path: '/' }];
        const parts = path.split('/').filter(Boolean);
        const crumbs = [{ name: 'My Disk', path: '/' }];
        let acc = '';
        for (const part of parts) {
            acc += '/' + part;
            crumbs.push({ name: part, path: acc });
        }
        return crumbs;
    });

    // ─── Search Filter ───

    const filteredFiles = createMemo(() => {
        const q = searchQuery().toLowerCase().trim();
        if (!q) return files();
        return files().filter(f => f.name.toLowerCase().includes(q));
    });

    const filteredFolders = createMemo(() => {
        const q = searchQuery().toLowerCase().trim();
        if (!q) return folders();
        return folders().filter(f => f.name.toLowerCase().includes(q));
    });

    // ─── Upload Logic ───

    const handleFiles = async (fileList: FileList | File[]) => {
        if (!email() || usage().status === 'overdue' || usage().status === 'none') return;
        setShowUploadPanel(true);

        const filesToUpload = Array.from(fileList);

        for (const file of filesToUpload) {
            const progressEntry: UploadProgress = {
                fileName: file.name,
                progress: 0,
                bytesTransferred: 0,
                totalBytes: file.size,
                status: 'uploading',
            };
            setUploadQueue(prev => [...prev, progressEntry]);

            try {
                await uploadDiskFile(email(), file, currentPath(), (p) => {
                    setUploadQueue(prev =>
                        prev.map(item =>
                            item.fileName === p.fileName ? { ...item, ...p } : item
                        )
                    );
                });
            } catch (err: any) {
                setUploadQueue(prev =>
                    prev.map(item =>
                        item.fileName === file.name
                            ? { ...item, status: 'error' as const, error: err.message, progress: 0 }
                            : item
                    )
                );
            }
        }

        // Reload after all uploads
        await loadData();
    };

    const onFileSelect = (e: Event) => {
        const input = e.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            handleFiles(input.files);
            input.value = '';
        }
    };

    // ─── Drag & Drop ───

    const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); setIsDragOver(false); };
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    // ─── Delete ───

    const handleDeleteFile = async (file: DiskFile) => {
        if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
        setDeletingId(file.id);
        try {
            await deleteDiskFile(email(), file.id);
            await loadData();
        } catch (e) {
            console.error('[Disk] Delete failed:', e);
            alert('Failed to delete file.');
        } finally {
            setDeletingId('');
            setContextMenu(null);
        }
    };

    const handleDeleteFolder = async (folder: DiskFolder) => {
        if (!confirm(`Delete folder "${folder.name}" and all metadata? (Files inside are not automatically deleted in this version).`)) return;
        setDeletingId(folder.id);
        try {
            await deleteDiskFolder(email(), folder.id);
            await loadData();
        } catch (e) {
            console.error('[Disk] Delete folder failed:', e);
            alert('Failed to delete folder.');
        } finally {
            setDeletingId('');
            setContextMenu(null);
        }
    };

    const handleRename = async () => {
        const id = renamingId();
        const newName = renameValue().trim();
        const ctx = contextMenu();
        if (!id || !newName || !ctx) return;

        try {
            if (ctx.type === 'file') {
                await renameDiskFile(email(), id, newName);
            } else {
                await renameDiskFolder(email(), id, newName);
            }
            setRenamingId('');
            setContextMenu(null);
            await loadData();
        } catch (e) {
            console.error('[Disk] Rename failed:', e);
            alert('Failed to rename.');
        }
    };

    // ─── Folders ───

    const handleCreateFolder = async () => {
        if (usage().status === 'overdue' || usage().status === 'none') return;
        const name = newFolderName().trim();
        if (!name) return;
        try {
            await createDiskFolder(email(), name, currentPath());
            setNewFolderName('');
            setShowNewFolder(false);
            await loadData();
        } catch (e) {
            console.error('[Disk] Create folder failed:', e);
        }
    };

    const navigateToFolder = (path: string) => {
        setCurrentPath(path);
    };

    // ─── Subscription Logic ───

    const handleSubscribe = async () => {
        if (!props.privateKey) {
            setSubsError('Wallet not unlocked or missing.');
            return;
        }
        setIsSubscribing(true);
        setSubsError('');
        try {
            const rpc = props.networkMode === 'mainnet' ? 'https://rpc.visionchain.co' : 'http://46.224.221.201:8545';
            const provider = new ethers.JsonRpcProvider(rpc);
            const wallet = new ethers.Wallet(props.privateKey, provider);
            const token = new ethers.Contract('0x5FbDB2315678afecb367f032d93F642f64180aa3', [
                "function allowance(address,address) external view returns (uint256)",
                "function approve(address spender, uint256 amount) external returns (bool)"
            ], wallet);

            const executor = '0xE020035a1395132D0EFA2c4BA40098eF99882C3a';
            const currentAllowance = await token.allowance(wallet.address, executor);

            // If allowance is small, approve Infinity
            if (currentAllowance < ethers.parseEther('1000')) {
                const tx = await token.approve(executor, ethers.MaxUint256);
                await tx.wait();
            }

            await subscribeToDisk(selectedGb());
            await loadData();
        } catch (e: any) {
            console.error('[Disk] Subscription failed:', e);
            setSubsError(e.message || 'Payment or approval failed. Check VCN balance.');
        } finally {
            setIsSubscribing(false);
        }
    };

    const handleCancelSubs = async () => {
        if (!confirm('Cancel your Vision Disk subscription? Your data will remain until the billing cycle ends.')) return;
        setIsCanceling(true);
        try {
            await cancelDiskSubscription();
            await loadData();
        } catch (e) {
            alert('Failed to cancel subscription.');
        } finally {
            setIsCanceling(false);
        }
    };

    // ─── Usage Computed ───

    const usagePercent = createMemo(() => {
        const u = usage();
        if (u.limitBytes === 0) return 0;
        return Math.min(100, (u.totalBytes / u.limitBytes) * 100);
    });

    const usageGB = createMemo(() => (usage().totalBytes / (1024 * 1024 * 1024)).toFixed(2));
    const limitGB = createMemo(() => Math.round(usage().limitBytes / (1024 * 1024 * 1024)));

    // ─── Active uploads count ───
    const activeUploads = createMemo(() => uploadQueue().filter(u => u.status === 'uploading').length);

    // Close context menu on outside click
    const handleGlobalClick = () => setContextMenu(null);
    onMount(() => document.addEventListener('click', handleGlobalClick));
    onCleanup(() => document.removeEventListener('click', handleGlobalClick));

    // ─── Render ───

    return (
        <div
            class={`h-full flex flex-col pt-[max(env(safe-area-inset-top,20px),24px)] lg:pt-8 px-4 lg:px-8 pb-32 lg:pb-8 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar relative transition-all ${isDragOver() ? 'ring-2 ring-cyan-400/40 ring-inset' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                class="hidden"
                onChange={onFileSelect}
            />

            {/* ── Drag Overlay ── */}
            <Presence>
                <Show when={isDragOver()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center rounded-3xl pointer-events-none"
                    >
                        <div class="text-center">
                            <div class="w-20 h-20 rounded-3xl bg-cyan-500/20 border-2 border-dashed border-cyan-400/50 flex items-center justify-center mx-auto mb-4">
                                <UploadCloud class="w-10 h-10 text-cyan-400" />
                            </div>
                            <div class="text-xl font-black text-white">Drop files here</div>
                            <div class="text-sm text-gray-400 mt-1">Files will be uploaded to current folder</div>
                        </div>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── Header ── */}
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
                <div class="space-y-1">
                    <h1 class="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        <HardDrive class="w-6 h-6 text-cyan-400" />
                        VISION DISK
                    </h1>
                    <p class="text-sm text-gray-400 font-medium">Decentralized storage powered by Vision Nodes</p>
                </div>

                <div class="flex items-center gap-2">
                    {/* Search */}
                    <div class="relative">
                        <Search class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchQuery()}
                            onInput={(e) => setSearchQuery(e.currentTarget.value)}
                            class="h-10 w-48 pl-9 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all"
                        />
                    </div>

                    {/* View Toggle */}
                    <div class="flex items-center bg-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
                        <button
                            onClick={() => setViewMode('grid')}
                            class={`p-2.5 transition-all ${viewMode() === 'grid' ? 'bg-white/[0.1] text-cyan-400' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Grid class="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            class={`p-2.5 transition-all ${viewMode() === 'list' ? 'bg-white/[0.1] text-cyan-400' : 'text-gray-500 hover:text-white'}`}
                        >
                            <List class="w-4 h-4" />
                        </button>
                    </div>

                    {/* New Folder */}
                    <button
                        onClick={() => setShowNewFolder(true)}
                        class="h-10 px-3 flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl text-sm text-gray-300 hover:text-white transition-all"
                    >
                        <FolderPlus class="w-4 h-4" />
                        <span class="hidden sm:inline">Folder</span>
                    </button>

                    {/* Upload */}
                    <button
                        onClick={() => fileInputRef?.click()}
                        class="h-10 flex items-center gap-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
                    >
                        <UploadCloud class="w-4 h-4" />
                        Upload
                    </button>
                </div>
            </div>

            {/* ── Storage Usage ── */}
            <div class="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 mb-6 shrink-0">
                <div class="flex justify-between items-end mb-2.5">
                    <div>
                        <div class="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Storage</div>
                        <div class="text-lg font-black text-white leading-tight">
                            {usageGB()} <span class="text-xs text-gray-400 font-medium">GB</span>
                            <span class="text-xs text-gray-600 font-medium mx-1.5">/</span>
                            {limitGB()} <span class="text-xs text-gray-400 font-medium">GB</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-[10px] font-bold text-gray-500">
                            {usage().fileCount} file{usage().fileCount !== 1 ? 's' : ''}
                        </div>
                        <div class="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">
                            0.50 VCN / GB
                        </div>
                    </div>
                </div>
                <div class="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                    <div
                        class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700"
                        style={{ width: `${usagePercent()}%` }}
                    />
                </div>
            </div>

            {/* ── Breadcrumbs ── */}
            <div class="flex items-center gap-1 mb-4 text-sm shrink-0">
                <For each={breadcrumbs()}>
                    {(crumb, i) => (
                        <>
                            <Show when={i() > 0}>
                                <ChevronRight class="w-3 h-3 text-gray-600" />
                            </Show>
                            <button
                                onClick={() => navigateToFolder(crumb.path)}
                                class={`px-1.5 py-0.5 rounded-md transition-all ${i() === breadcrumbs().length - 1
                                    ? 'text-white font-bold'
                                    : 'text-gray-400 hover:text-white hover:bg-white/[0.05]'
                                    }`}
                            >
                                {crumb.name}
                            </button>
                        </>
                    )}
                </For>
            </div>

            {/* ── New Folder Modal ── */}
            <Presence>
                <Show when={showNewFolder()}>
                    <Motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        class="mb-4 bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 flex items-center gap-3"
                    >
                        <Folder class="w-5 h-5 text-cyan-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="New folder name..."
                            value={newFolderName()}
                            onInput={(e) => setNewFolderName(e.currentTarget.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            autofocus
                            class="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
                        />
                        <button
                            onClick={handleCreateFolder}
                            class="h-8 px-3 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold rounded-lg transition-all"
                        >
                            Create
                        </button>
                        <button
                            onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
                            class="p-1.5 text-gray-500 hover:text-white"
                        >
                            <X class="w-4 h-4" />
                        </button>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── File Content Area ── */}
            <div class="flex-1 min-h-0 relative">
                <Show when={usage().status === 'none' || usage().status === 'canceled' || usage().status === 'expired'}>
                    <div class="absolute inset-0 z-10 bg-[#12121a] rounded-2xl border border-white/5 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
                        <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6">
                            <HardDrive class="w-8 h-8 text-cyan-400" />
                        </div>
                        <h2 class="text-2xl font-black text-white mb-3 tracking-tight">Activate Vision Disk</h2>
                        <p class="text-sm text-gray-400 max-w-md mb-8 leading-relaxed">
                            Store your files securely on the decentralized Vision Network. Pay smoothly with VCN tokens.
                        </p>

                        <div class="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md mb-6">
                            <div class="flex justify-between items-center mb-4">
                                <div class="text-sm font-bold text-gray-300">Storage Plan</div>
                                <div class="flex items-center gap-2">
                                    <button onClick={() => setSelectedGb(Math.max(10, selectedGb() - 10))} class="p-1 text-gray-400 hover:text-white bg-white/[0.05] rounded-md transition-all">-</button>
                                    <span class="text-sm font-bold text-white w-12 text-center">{selectedGb()} GB</span>
                                    <button onClick={() => setSelectedGb(Math.min(50, selectedGb() + 10))} class="p-1 text-gray-400 hover:text-white bg-white/[0.05] rounded-md transition-all">+</button>
                                </div>
                            </div>
                            <div class="flex justify-between items-end">
                                <div class="text-xs text-gray-500">Monthly Price</div>
                                <div class="text-xl font-black text-cyan-400">
                                    {selectedGb() <= 10 ? 5 : 5 + Math.ceil((selectedGb() - 10) / 10) * 3} <span class="text-sm">VCN</span>
                                </div>
                            </div>
                        </div>

                        <Show when={subsError()}>
                            <div class="w-full max-w-md bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6 text-xs text-red-400 text-left">
                                {subsError()}
                            </div>
                        </Show>

                        <button
                            onClick={handleSubscribe}
                            disabled={isSubscribing() || isLoading()}
                            class="w-full max-w-md h-12 flex items-center justify-center bg-cyan-500 hover:bg-cyan-400 text-black font-black rounded-xl transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubscribing() ? (
                                <div class="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                            ) : 'Subscribe Now'}
                        </button>
                        <div class="text-[10px] text-gray-500 mt-4 max-w-md">By subscribing, you approve Vision Network to deduct VCN automatically purely for storage usage. You can cancel anytime.</div>
                    </div>
                </Show>

                <Show
                    when={!isLoading() && (filteredFolders().length > 0 || filteredFiles().length > 0)}
                    fallback={
                        <Show when={!isLoading() && usage().status !== 'none' && usage().status !== 'canceled' && usage().status !== 'expired'} fallback={
                            <Show when={usage().status === 'none' || usage().status === 'canceled' || usage().status === 'expired'} fallback={
                                <div class="flex-1 flex items-center justify-center py-20">
                                    <div class="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            }>
                                {/* Covered by the overlay above */}
                                <div />
                            </Show>
                        }>
                            {/* Empty State */}
                            <div class="flex-1 bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[320px] cursor-pointer hover:border-cyan-500/30 hover:bg-cyan-500/[0.02] transition-all"
                                onClick={() => usage().status !== 'overdue' && fileInputRef?.click()}
                            >
                                <div class="w-16 h-16 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-5 border border-white/10 shadow-2xl">
                                    <UploadCloud class="w-8 h-8 text-gray-400" />
                                </div>
                                <h3 class="text-lg font-bold text-white tracking-tight mb-2">
                                    {searchQuery() ? 'No results found' : 'Drop files here or click to upload'}
                                </h3>
                                <p class="text-sm text-gray-400 max-w-sm">
                                    {searchQuery()
                                        ? `No files matching "${searchQuery()}"`
                                        : 'Upload photos, videos, documents, or any files. All data is stored securely on the decentralized network.'}
                                </p>
                                <Show when={!searchQuery() && usage().status !== 'overdue'}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); fileInputRef?.click(); }}
                                        class="mt-6 px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold rounded-xl transition-all border border-white/10 text-sm active:scale-95"
                                    >
                                        Select Files
                                    </button>
                                </Show>
                            </div>
                        </Show>
                    }
                >
                    <Show when={usage().status === 'overdue'}>
                        <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 flex items-start gap-3 text-left">
                            <AlertTriangle class="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <div class="text-sm font-bold text-red-400 mb-1">Subscription Payment Overdue</div>
                                <div class="text-xs text-red-400/80">Uploads are disabled. Please assure your VCN balance is sufficient for auto-renewal to avoid losing your files next week.</div>
                            </div>
                        </div>
                    </Show>

                    {/* ── Grid View ── */}
                    <Show when={viewMode() === 'grid'}>
                        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {/* Folders */}
                            <For each={filteredFolders()}>
                                {(folder) => (
                                    <div class="relative group">
                                        <button
                                            onClick={() => navigateToFolder(folder.path)}
                                            class="group w-full bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-cyan-500/20 rounded-xl p-4 flex flex-col items-center gap-2 transition-all text-center"
                                        >
                                            <Folder class="w-10 h-10 text-cyan-400/80 group-hover:text-cyan-400 transition-colors" />
                                            <span class="text-xs font-semibold text-gray-300 truncate w-full">{folder.name}</span>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setContextMenu({ item: folder, type: 'folder', x: e.clientX, y: e.clientY });
                                            }}
                                            class="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <MoreVertical class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </For>
                            {/* Files */}
                            <For each={filteredFiles()}>
                                {(file) => (
                                    <div
                                        class={`group relative bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-xl p-4 flex flex-col items-center gap-2 transition-all cursor-pointer ${deletingId() === file.id ? 'opacity-40' : ''}`}
                                        onClick={() => setPreviewFile(file)}
                                    >
                                        {/* Thumbnail or Icon */}
                                        <div class="w-full aspect-square rounded-lg bg-white/[0.03] flex items-center justify-center overflow-hidden border border-white/5">
                                            <Show
                                                when={file.type.startsWith('image/')}
                                                fallback={
                                                    <div class={fileTypeColor(file.type)}>
                                                        <FileTypeIcon type={file.type} name={file.name} class="w-10 h-10" />
                                                    </div>
                                                }
                                            >
                                                <img
                                                    src={file.downloadURL}
                                                    alt={file.name}
                                                    class="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            </Show>
                                        </div>
                                        <div class="w-full text-left">
                                            <div class="text-xs font-semibold text-gray-200 truncate">{file.name}</div>
                                            <div class="text-[10px] text-gray-500 mt-0.5">{formatFileSize(file.size)}</div>
                                        </div>
                                        {/* Context button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setContextMenu({ item: file, type: 'file', x: e.clientX, y: e.clientY });
                                            }}
                                            class="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <MoreVertical class="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>

                    {/* ── List View ── */}
                    <Show when={viewMode() === 'list'}>
                        <div class="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
                            {/* Table Header */}
                            <div class="grid grid-cols-[1fr_100px_120px_40px] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <span>Name</span>
                                <span>Size</span>
                                <span>Modified</span>
                                <span></span>
                            </div>
                            {/* Folders */}
                            <For each={filteredFolders()}>
                                {(folder) => (
                                    <div
                                        class="w-full grid grid-cols-[1fr_100px_120px_40px] gap-2 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.04] group transition-all items-center text-left cursor-pointer"
                                        onClick={() => navigateToFolder(folder.path)}
                                    >
                                        <div class="flex items-center gap-3 min-w-0">
                                            <Folder class="w-5 h-5 text-cyan-400 shrink-0" />
                                            <span class="text-sm text-gray-200 truncate font-medium">{folder.name}</span>
                                        </div>
                                        <span class="text-xs text-gray-500">--</span>
                                        <span class="text-xs text-gray-500">{new Date(folder.createdAt).toLocaleDateString()}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setContextMenu({ item: folder, type: 'folder', x: e.clientX, y: e.clientY });
                                            }}
                                            class="p-1 rounded-md text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <MoreVertical class="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </For>
                            {/* Files */}
                            <For each={filteredFiles()}>
                                {(file) => (
                                    <div
                                        class={`group grid grid-cols-[1fr_100px_120px_40px] gap-2 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.04] transition-all items-center cursor-pointer ${deletingId() === file.id ? 'opacity-40' : ''}`}
                                        onClick={() => setPreviewFile(file)}
                                    >
                                        <div class="flex items-center gap-3 min-w-0">
                                            <div class={`shrink-0 ${fileTypeColor(file.type)}`}>
                                                <FileTypeIcon type={file.type} name={file.name} />
                                            </div>
                                            <span class="text-sm text-gray-200 truncate">{file.name}</span>
                                        </div>
                                        <span class="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                                        <span class="text-xs text-gray-500">{new Date(file.createdAt).toLocaleDateString()}</span>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setContextMenu({ item: file, type: 'file', x: e.clientX, y: e.clientY });
                                            }}
                                            class="p-1 rounded-md text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <MoreVertical class="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </Show>
            </div>

            {/* ── Context Menu ── */}
            <Presence>
                <Show when={contextMenu()}>
                    {(ctx) => (
                        <Motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            class="fixed z-[100] bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
                            style={{ left: `${ctx().x}px`, top: `${ctx().y}px` }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Show when={renamingId() === ctx().item.id} fallback={
                                <>
                                    <Show when={ctx().type === 'file'}>
                                        <button
                                            onClick={() => { setPreviewFile(ctx().item as DiskFile); setContextMenu(null); }}
                                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                        >
                                            <Eye class="w-4 h-4" /> Preview
                                        </button>
                                        <a
                                            href={(ctx().item as DiskFile).downloadURL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                            onClick={() => setContextMenu(null)}
                                        >
                                            <Download class="w-4 h-4" /> Download
                                        </a>
                                    </Show>
                                    <Show when={ctx().type === 'folder'}>
                                        <button
                                            onClick={() => { navigateToFolder((ctx().item as DiskFolder).path); setContextMenu(null); }}
                                            class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                        >
                                            <Folder class="w-4 h-4" /> Open
                                        </button>
                                    </Show>

                                    <button
                                        onClick={() => {
                                            setRenamingId(ctx().item.id);
                                            setRenameValue(ctx().item.name);
                                        }}
                                        class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                    >
                                        <FileText class="w-4 h-4" /> Rename
                                    </button>

                                    <div class="h-px bg-white/[0.06] my-1" />
                                    <button
                                        onClick={() => {
                                            if (ctx().type === 'file') {
                                                handleDeleteFile(ctx().item as DiskFile);
                                            } else {
                                                handleDeleteFolder(ctx().item as DiskFolder);
                                            }
                                        }}
                                        class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        <Trash2 class="w-4 h-4" /> Delete
                                    </button>
                                </>
                            }>
                                {/* Inline Rename UI */}
                                <div class="px-3 py-2">
                                    <input
                                        type="text"
                                        value={renameValue()}
                                        onInput={(e) => setRenameValue(e.currentTarget.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename();
                                            if (e.key === 'Escape') setRenamingId('');
                                        }}
                                        autofocus
                                        class="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50"
                                    />
                                    <div class="flex gap-2 mt-2">
                                        <button
                                            onClick={handleRename}
                                            class="flex-1 py-1 bg-cyan-500 text-black text-[10px] font-bold rounded-md"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setRenamingId('')}
                                            class="flex-1 py-1 bg-white/5 text-gray-400 text-[10px] font-bold rounded-md"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </Show>
                        </Motion.div>
                    )}
                </Show>
            </Presence>

            {/* ── File Preview Modal ── */}
            <Presence>
                <Show when={previewFile()}>
                    {(file) => (
                        <Motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            class="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                            onClick={() => setPreviewFile(null)}
                        >
                            <Motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                class="bg-[#12121a] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Preview Header */}
                                <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class={fileTypeColor(file().type)}>
                                            <FileTypeIcon type={file().type} name={file().name} />
                                        </div>
                                        <div class="min-w-0">
                                            <div class="text-sm font-bold text-white truncate">{file().name}</div>
                                            <div class="text-[11px] text-gray-500">{formatFileSize(file().size)} - {new Date(file().createdAt).toLocaleString()}</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <a
                                            href={file().downloadURL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                        >
                                            <Download class="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={() => handleDeleteFile(file())}
                                            class="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setPreviewFile(null)}
                                            class="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                        >
                                            <X class="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {/* Preview Body */}
                                <div class="flex-1 overflow-auto flex items-center justify-center p-6 min-h-[200px] max-h-[70vh]">
                                    <Show when={file().type.startsWith('image/')}>
                                        <img src={file().downloadURL} alt={file().name} class="max-w-full max-h-full object-contain rounded-lg" />
                                    </Show>
                                    <Show when={file().type.startsWith('video/')}>
                                        <video src={file().downloadURL} controls class="max-w-full max-h-full rounded-lg" />
                                    </Show>
                                    <Show when={file().type.startsWith('audio/')}>
                                        <div class="w-full max-w-md">
                                            <div class="w-20 h-20 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4 border border-white/10">
                                                <FileAudio class="w-10 h-10 text-amber-400" />
                                            </div>
                                            <audio src={file().downloadURL} controls class="w-full" />
                                        </div>
                                    </Show>
                                    <Show when={file().type.includes('pdf')}>
                                        <iframe src={file().downloadURL} class="w-full h-full min-h-[400px] rounded-lg border border-white/10" />
                                    </Show>
                                    <Show when={!file().type.startsWith('image/') && !file().type.startsWith('video/') && !file().type.startsWith('audio/') && !file().type.includes('pdf')}>
                                        <div class="text-center">
                                            <div class={`${fileTypeColor(file().type)} mx-auto mb-3`}>
                                                <FileTypeIcon type={file().type} name={file().name} class="w-16 h-16" />
                                            </div>
                                            <div class="text-sm text-gray-400 mb-4">Preview not available for this file type</div>
                                            <a
                                                href={file().downloadURL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all"
                                            >
                                                <Download class="w-4 h-4" /> Download File
                                            </a>
                                        </div>
                                    </Show>
                                </div>
                            </Motion.div>
                        </Motion.div>
                    )}
                </Show>
            </Presence>

            {/* ── Upload Progress Panel ── */}
            <Presence>
                <Show when={showUploadPanel() && uploadQueue().length > 0}>
                    <Motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        class="fixed bottom-20 lg:bottom-6 right-4 lg:right-8 z-[80] w-80 bg-[#14141a] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                    >
                        <div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                            <div class="text-sm font-bold text-white flex items-center gap-2">
                                <Show when={activeUploads() > 0} fallback={
                                    <>
                                        <Check class="w-4 h-4 text-green-400" />
                                        Uploads complete
                                    </>
                                }>
                                    <div class="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                    Uploading {activeUploads()} file{activeUploads() !== 1 ? 's' : ''}
                                </Show>
                            </div>
                            <button
                                onClick={() => { setShowUploadPanel(false); setUploadQueue([]); }}
                                class="p-1 text-gray-500 hover:text-white"
                            >
                                <X class="w-4 h-4" />
                            </button>
                        </div>
                        <div class="max-h-48 overflow-y-auto">
                            <For each={uploadQueue()}>
                                {(item) => (
                                    <div class="px-4 py-2.5 border-b border-white/[0.03] last:border-b-0">
                                        <div class="flex items-center justify-between mb-1">
                                            <span class="text-xs text-gray-300 truncate max-w-[200px]">{item.fileName}</span>
                                            <span class={`text-[10px] font-bold ${item.status === 'success' ? 'text-green-400' :
                                                item.status === 'error' ? 'text-red-400' :
                                                    'text-cyan-400'
                                                }`}>
                                                {item.status === 'uploading' ? `${item.progress}%` :
                                                    item.status === 'success' ? 'Done' : 'Error'}
                                            </span>
                                        </div>
                                        <div class="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                                            <div
                                                class={`h-full rounded-full transition-all duration-300 ${item.status === 'success' ? 'bg-green-500' :
                                                    item.status === 'error' ? 'bg-red-500' :
                                                        'bg-gradient-to-r from-cyan-500 to-blue-500'
                                                    }`}
                                                style={{ width: `${item.progress}%` }}
                                            />
                                        </div>
                                        <Show when={item.error}>
                                            <div class="text-[10px] text-red-400 mt-1 truncate">{item.error}</div>
                                        </Show>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Motion.div>
                </Show>
            </Presence>
        </div>
    );
};

export default WalletDisk;
