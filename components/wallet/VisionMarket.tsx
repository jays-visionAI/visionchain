import { createSignal, onMount, onCleanup, For, Show, createMemo } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import { ethers } from 'ethers';
import {
    DiskFile,
    listPublishedMaterials,
    purchaseMaterial,
    checkPurchaseStatus,
    downloadDiskFile,
    downloadDiskFileGranular,
    streamVideoChunks,
    formatFileSize
} from '../../services/diskService';
import { getFirebaseDb, addRewardPoints, getRPConfig } from '../../services/firebaseService';
import { WalletService } from '../../services/walletService';
import { contractService } from '../../services/contractService';
import VCNTokenABI from '../../services/abi/VCNToken.json';
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
    File as FileIcon,
    X,
    AlertTriangle,
    Loader2,
    ShieldCheck,
    Play,
    Eye,
    Maximize2,
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import { useAuth } from '../auth/authContext';

// Contract constants (must match transferService.ts)
const VCN_TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const PAYMASTER_ADMIN = '0x08A1B183a53a0f8f1D875945D504272738E3AF34';
const CHAIN_ID = 3151909;
const RPC_URL = 'https://api.visionchain.co/rpc-proxy';

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

    // Purchase modal state
    const [showPurchaseModal, setShowPurchaseModal] = createSignal(false);
    const [selectedItem, setSelectedItem] = createSignal<DiskFile | null>(null);
    const [walletPassword, setWalletPassword] = createSignal('');
    const [purchaseStep, setPurchaseStep] = createSignal<'confirm' | 'password' | 'processing' | 'downloading' | 'success' | 'preview' | 'error'>('confirm');
    const [purchaseError, setPurchaseError] = createSignal('');
    const [downloadProgress, setDownloadProgress] = createSignal(0);

    // Preview state
    const [previewUrl, setPreviewUrl] = createSignal('');
    const [previewType, setPreviewType] = createSignal<'video' | 'image' | 'audio' | 'pdf' | 'text' | 'document' | 'other'>('other');
    const [previewBlob, setPreviewBlob] = createSignal<Blob | null>(null);
    const [previewText, setPreviewText] = createSignal('');
    const [imageZoomed, setImageZoomed] = createSignal(false);

    // Cleanup preview URLs on unmount
    onCleanup(() => {
        if (previewUrl()) window.URL.revokeObjectURL(previewUrl());
    });

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

    // ── Determine preview type from MIME ──
    const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'html', 'css', 'xml', 'yaml', 'yml', 'log', 'sh', 'sql', 'env', 'conf', 'ini', 'toml', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'rb', 'php', 'swift', 'kt', 'lua', 'r', 'vim', 'makefile', 'dockerfile', 'gitignore'];
    const getPreviewType = (mime: string, name: string): 'video' | 'image' | 'audio' | 'pdf' | 'text' | 'document' | 'other' => {
        // Check MIME type first
        if (mime.startsWith('video/')) return 'video';
        if (mime.startsWith('image/')) return 'image';
        if (mime.startsWith('audio/')) return 'audio';
        if (mime.includes('pdf')) return 'pdf';
        if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('yaml') || mime.includes('javascript') || mime.includes('typescript')) return 'text';
        // Fallback: check file extension
        const ext = name.split('.').pop()?.toLowerCase() || '';
        if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', 'ogv', '3gp'].includes(ext)) return 'video';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) return 'image';
        if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext)) return 'audio';
        if (ext === 'pdf') return 'pdf';
        if (TEXT_EXTENSIONS.includes(ext)) return 'text';
        if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) return 'document';
        return 'other';
    };

    // ── Trigger browser download from blob ──
    const triggerBlobDownload = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    };

    // ── Download file and show preview ──
    const downloadFile = async (item: DiskFile) => {
        setPurchasingId(item.id);
        setPurchaseStep('downloading');
        setDownloadProgress(0);
        try {
            const userEmail = auth.user()?.email || '';
            let blob: Blob;
            let fileName = item.name;
            let fileType = item.type || 'application/octet-stream';

            if (item.storageType === 'distributed' || item.cid) {
                // Ensure we have chunkHashes (market listing might not include them)
                let chunkHashes = item.chunkHashes || [];

                // Always try to enrich metadata from published_materials if type or chunkHashes are missing
                if (chunkHashes.length === 0 || !item.type || item.type === 'application/octet-stream') {
                    try {
                        const { doc, getDoc } = await import('firebase/firestore');
                        const db = getFirebaseDb();
                        const marketDoc = await getDoc(doc(db, 'published_materials', item.id));
                        if (marketDoc.exists()) {
                            const data = marketDoc.data();
                            if (!chunkHashes.length) chunkHashes = data?.chunkHashes || [];
                            if (data?.type) fileType = data.type;
                            if (data?.name) fileName = data.name;
                        }
                    } catch (metaErr) {
                        console.warn('[Market] Failed to fetch file metadata:', metaErr);
                    }
                }

                // Re-evaluate preview type with enriched metadata
                const enrichedPType = getPreviewType(fileType, fileName);

                if (enrichedPType === 'video' && chunkHashes.length > 0) {
                    const streamItem = { ...item, chunkHashes, type: fileType, name: fileName };
                    blob = await streamVideoChunks(
                        streamItem,
                        (current, total, bytesLoaded) => {
                            setDownloadProgress(Math.round((current / total) * 100));
                        },
                        (partialUrl) => {
                            if (previewUrl()) window.URL.revokeObjectURL(previewUrl());
                            setPreviewUrl(partialUrl);
                            setPreviewType('video');
                            setPurchaseStep('preview');
                        },
                        2 * 1024 * 1024
                    );
                } else if (chunkHashes.length > 0) {
                    const dlItem = { ...item, chunkHashes, type: fileType, name: fileName };
                    blob = await downloadDiskFileGranular(
                        dlItem,
                        (current, total) => {
                            setDownloadProgress(Math.round((current / total) * 100));
                        },
                        10
                    );
                } else if (item.downloadURL) {
                    const response = await fetch(item.downloadURL);
                    blob = await response.blob();
                } else {
                    throw new Error('File chunks not available. Please try again later.');
                }
            } else if (item.downloadURL) {
                const response = await fetch(item.downloadURL);
                blob = await response.blob();
            } else {
                throw new Error('Download URL not available.');
            }

            // Use enriched metadata for final preview type decision
            const finalMime = fileType || blob.type || 'application/octet-stream';
            const finalPType = getPreviewType(finalMime, fileName);

            // Cleanup old preview URL
            if (previewUrl()) window.URL.revokeObjectURL(previewUrl());

            if (finalPType === 'video' || finalPType === 'image' || finalPType === 'audio') {
                // Show inline preview
                const url = window.URL.createObjectURL(blob);
                setPreviewUrl(url);
                setPreviewType(finalPType);
                setPreviewBlob(blob);
                setImageZoomed(false);
                setPurchaseStep('preview');
            } else if (finalPType === 'pdf') {
                // Inline PDF viewer using iframe
                const url = window.URL.createObjectURL(blob);
                setPreviewUrl(url);
                setPreviewType('pdf');
                setPreviewBlob(blob);
                setPurchaseStep('preview');
            } else if (finalPType === 'text') {
                // Read blob as text and show in code viewer
                try {
                    const text = await blob.text();
                    setPreviewText(text.length > 500000 ? text.slice(0, 500000) + '\n\n--- Content truncated (500KB limit) ---' : text);
                    setPreviewType('text');
                    setPreviewBlob(blob);
                    setPurchaseStep('preview');
                } catch {
                    // Fallback: download
                    triggerBlobDownload(blob, fileName);
                    setPreviewBlob(blob);
                    setPurchaseStep('success');
                }
            } else {
                // Documents, archives, and other: auto-download + show success with info
                triggerBlobDownload(blob, fileName);
                setPreviewBlob(blob);
                setPurchaseStep('success');
            }
        } catch (err: any) {
            console.error('Download failed:', err);
            setPurchaseError('Download failed: ' + (err.message || 'Unknown error'));
            setPurchaseStep('error');
        } finally {
            setPurchasingId('');
        }
    };

    // ── Open purchase/download flow ──
    const handlePurchase = async (item: DiskFile) => {
        if (!auth.user()) {
            alert('Please login to purchase.');
            return;
        }

        const userEmail = auth.user()?.email || '';
        const isOwned = purchasedIds().has(item.id) || item.publisherEmail === userEmail;

        if (isOwned) {
            // Already purchased or own file - direct download
            setSelectedItem(item);
            setShowPurchaseModal(true);
            setPurchaseStep('downloading');
            await downloadFile(item);
            return;
        }

        // New purchase -- show confirmation modal
        setSelectedItem(item);
        setWalletPassword('');
        setPurchaseError('');
        setPurchaseStep('confirm');
        setShowPurchaseModal(true);
    };

    // ── Execute purchase with Permit signature ──
    const executePurchase = async () => {
        const item = selectedItem();
        if (!item) return;

        const userEmail = auth.user()?.email || '';
        const priceVcn = item.priceVcn || 0;

        if (priceVcn <= 0) {
            // Free item - skip payment
            setPurchaseStep('processing');
            try {
                const result = await purchaseMaterial(item.id);
                if (result.success) {
                    setPurchasedIds(prev => new Set(prev).add(item.id));
                    await downloadFile(item);
                }
            } catch (err: any) {
                setPurchaseError(err.message || 'Purchase failed');
                setPurchaseStep('error');
            }
            return;
        }

        // Paid item - need wallet password for Permit signing
        setPurchaseStep('password');
    };

    const executePermitPurchase = async () => {
        const item = selectedItem();
        if (!item || !walletPassword()) return;

        const userEmail = auth.user()?.email || '';
        const priceVcn = item.priceVcn || 0;

        setPurchaseStep('processing');

        try {
            // 1. Decrypt wallet to get signer
            const encrypted = WalletService.getEncryptedWallet(userEmail);
            if (!encrypted) {
                throw new Error('Wallet not found. Please restore your wallet first.');
            }

            const mnemonic = await WalletService.decrypt(encrypted, walletPassword());
            if (!WalletService.validateMnemonic(mnemonic)) {
                throw new Error('Incorrect password. Please try again.');
            }

            const { privateKey } = WalletService.deriveEOA(mnemonic);
            const address = await contractService.connectInternalWallet(privateKey);
            const signer = contractService.getSigner();
            if (!signer) throw new Error('Failed to initialize wallet signer.');

            // 2. Sign EIP-712 Permit for the exact price (no extra fee)
            const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
            const vcnContract = new ethers.Contract(VCN_TOKEN, VCNTokenABI.abi, rpcProvider);
            const totalAmount = ethers.parseUnits(priceVcn.toString(), 18);
            const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

            // Check balance
            const balance = await vcnContract.balanceOf(address);
            if (balance < totalAmount) {
                throw new Error(`Insufficient balance. You have ${ethers.formatEther(balance)} VCN but need ${priceVcn} VCN.`);
            }

            const [tokenName, nonce] = await Promise.all([
                vcnContract.name(),
                vcnContract.nonces(address),
            ]);

            const domain = {
                name: tokenName,
                version: '1',
                chainId: CHAIN_ID,
                verifyingContract: VCN_TOKEN,
            };

            const types = {
                Permit: [
                    { name: 'owner', type: 'address' },
                    { name: 'spender', type: 'address' },
                    { name: 'value', type: 'uint256' },
                    { name: 'nonce', type: 'uint256' },
                    { name: 'deadline', type: 'uint256' },
                ],
            };

            const values = {
                owner: address,
                spender: PAYMASTER_ADMIN,
                value: totalAmount,
                nonce: nonce,
                deadline: deadline,
            };

            const signature = await signer.signTypedData(domain, types, values);

            // 3. Call purchaseMaterial with Permit data
            const result = await purchaseMaterial(item.id, {
                signature,
                deadline,
                owner: address,
            });

            if (result.success) {
                setPurchasedIds(prev => new Set(prev).add(item.id));

                // Award RP for market_purchase (fire-and-forget)
                const userEmail = auth.user()?.email;
                if (userEmail) {
                    getRPConfig().then(rpCfg => {
                        if (rpCfg.market_purchase > 0) {
                            addRewardPoints(userEmail, rpCfg.market_purchase, 'market_purchase', item.name).catch(() => { });
                        }
                    }).catch(() => { });
                }

                // 4. Download the file
                await downloadFile(item);
            } else {
                throw new Error('Purchase failed.');
            }
        } catch (err: any) {
            console.error('Purchase failed:', err);
            const errorMsg = err.message || 'Purchase failed';
            if (errorMsg.includes('Decryption failed') || errorMsg.includes('Incorrect password')) {
                setPurchaseError('Incorrect wallet password. Please try again.');
                setPurchaseStep('password');
            } else {
                setPurchaseError(errorMsg);
                setPurchaseStep('error');
            }
        }
    };

    const closePurchaseModal = () => {
        setShowPurchaseModal(false);
        setSelectedItem(null);
        setWalletPassword('');
        setPurchaseError('');
        setPurchaseStep('confirm');
        setPurchasingId('');
        // Cleanup preview
        if (previewUrl()) {
            window.URL.revokeObjectURL(previewUrl());
            setPreviewUrl('');
        }
        setPreviewBlob(null);
        setPreviewType('other');
        setPreviewText('');
        setImageZoomed(false);
    };

    return (
        <div class="h-full flex flex-col pt-[max(env(safe-area-inset-top,20px),24px)] lg:pt-8 px-4 lg:px-8 pb-32 lg:pb-8 max-w-5xl mx-auto w-full overflow-y-auto custom-scrollbar">
            <WalletViewHeader
                tag="Global Channel"
                title="VISION"
                titleAccent="MARKET"
                description="Discover and purchase premium datasets, media, and documents."
                icon={ShoppingBag}
                rightElement={
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
                }
            />

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
                                            <Show when={item.thumbnailURL || item.thumbnail || (item.type.startsWith('image/') && item.downloadURL)} fallback={
                                                <div class={`${fileTypeColor(item.type)} opacity-40 group-hover:opacity-100 transition-all`}>
                                                    <FileTypeIcon type={item.type} name={item.name} class="w-12 h-12" />
                                                </div>
                                            }>
                                                <img src={item.thumbnailURL || item.thumbnail || item.downloadURL} alt={item.name} class="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
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
                                                <span class="flex items-center gap-1.5">
                                                    {formatFileSize(item.size)}
                                                    {item.optimized && (
                                                        <span class="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[9px] font-bold">MP4</span>
                                                    )}
                                                    {item.preserveOriginal && (
                                                        <span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">RAW</span>
                                                    )}
                                                </span>
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

            {/* ── Purchase / Download Modal ── */}
            <Show when={showPurchaseModal() && selectedItem()}>
                <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ "background-color": "rgba(0,0,0,0.7)", "backdrop-filter": "blur(8px)" }}>
                    <Motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        class={`w-full bg-[#0d0d14] border border-white/[0.08] rounded-3xl p-6 shadow-2xl relative ${purchaseStep() === 'preview' ? (previewType() === 'pdf' || previewType() === 'text' ? 'max-w-4xl max-h-[90vh] overflow-hidden flex flex-col' : 'max-w-2xl') : 'max-w-md'}`}
                    >
                        {/* Close button */}
                        <button
                            onClick={closePurchaseModal}
                            class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all"
                        >
                            <X class="w-4 h-4" />
                        </button>

                        {/* ── Step: Confirm Purchase ── */}
                        <Show when={purchaseStep() === 'confirm'}>
                            <div class="space-y-6">
                                <div class="text-center">
                                    <div class="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
                                        <ShoppingBag class="w-8 h-8 text-cyan-400" />
                                    </div>
                                    <h3 class="text-xl font-black text-white">Confirm Purchase</h3>
                                    <p class="text-sm text-gray-500 mt-1">You are about to purchase this content</p>
                                </div>

                                <div class="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.05] space-y-3">
                                    <div class="flex items-center gap-3">
                                        <div class="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                                            <Show when={selectedItem()!.thumbnailURL || selectedItem()!.thumbnail} fallback={
                                                <FileTypeIcon type={selectedItem()!.type} name={selectedItem()!.name} class="w-6 h-6 text-gray-500" />
                                            }>
                                                <img src={selectedItem()!.thumbnailURL || selectedItem()!.thumbnail || ''} alt="" class="w-full h-full object-cover" />
                                            </Show>
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="text-sm font-bold text-white truncate">{selectedItem()!.name}</div>
                                            <div class="text-[11px] text-gray-500 flex items-center gap-1">
                                                <User class="w-3 h-3" /> {selectedItem()!.publisherEmail?.split('@')[0]}
                                            </div>
                                        </div>
                                    </div>

                                    <div class="border-t border-white/[0.04] pt-3 flex items-center justify-between">
                                        <span class="text-sm text-gray-400 font-medium">Total Price</span>
                                        <span class="text-2xl font-black text-cyan-400">{selectedItem()!.priceVcn} <span class="text-sm">VCN</span></span>
                                    </div>

                                    <div class="border-t border-white/[0.04] pt-3 space-y-1.5">
                                        <div class="flex items-center justify-between text-[11px]">
                                            <span class="text-gray-500">File Size</span>
                                            <span class="text-gray-400">{formatFileSize(selectedItem()!.size)}</span>
                                        </div>
                                        <div class="flex items-center justify-between text-[11px]">
                                            <span class="text-gray-500">Transaction Fee</span>
                                            <span class="text-green-400 font-bold">FREE (Gasless)</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={executePurchase}
                                    class="w-full h-12 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <ShieldCheck class="w-5 h-5" />
                                    Purchase for {selectedItem()!.priceVcn} VCN
                                </button>

                                <p class="text-[10px] text-gray-600 text-center">
                                    By purchasing, you agree to pay via gasless VCN transfer. No additional gas fees required.
                                </p>
                            </div>
                        </Show>

                        {/* ── Step: Password ── */}
                        <Show when={purchaseStep() === 'password'}>
                            <div class="space-y-6">
                                <div class="text-center">
                                    <div class="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                                        <Lock class="w-8 h-8 text-amber-400" />
                                    </div>
                                    <h3 class="text-xl font-black text-white">Wallet Password</h3>
                                    <p class="text-sm text-gray-500 mt-1">Enter your wallet password to authorize this payment</p>
                                </div>

                                <Show when={purchaseError()}>
                                    <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-300">
                                        <AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
                                        <span>{purchaseError()}</span>
                                    </div>
                                </Show>

                                <div class="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.05]">
                                    <div class="flex items-center justify-between mb-3 text-[11px]">
                                        <span class="text-gray-500">Amount</span>
                                        <span class="text-cyan-400 font-black">{selectedItem()!.priceVcn} VCN</span>
                                    </div>
                                    <input
                                        type="password"
                                        placeholder="Enter wallet password..."
                                        value={walletPassword()}
                                        onInput={(e) => setWalletPassword(e.currentTarget.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && walletPassword()) {
                                                executePermitPurchase();
                                            }
                                        }}
                                        class="w-full h-12 px-4 bg-black/40 border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 transition-all"
                                        autofocus
                                    />
                                </div>

                                <div class="flex gap-3">
                                    <button
                                        onClick={() => { setPurchaseStep('confirm'); setPurchaseError(''); }}
                                        class="flex-1 h-12 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 font-bold text-sm rounded-xl transition-all border border-white/[0.05]"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={executePermitPurchase}
                                        disabled={!walletPassword()}
                                        class="flex-1 h-12 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-black text-sm rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <ShieldCheck class="w-4 h-4" />
                                        Authorize
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* ── Step: Processing ── */}
                        <Show when={purchaseStep() === 'processing'}>
                            <div class="space-y-6 text-center py-8">
                                <div class="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                                    <Loader2 class="w-8 h-8 text-cyan-400 animate-spin" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-black text-white">Processing Payment</h3>
                                    <p class="text-sm text-gray-500 mt-2">Signing permit and executing gasless payment...</p>
                                </div>
                                <div class="flex items-center justify-center gap-3 text-xs text-gray-600">
                                    <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                    <span>This may take a few moments</span>
                                </div>
                            </div>
                        </Show>

                        {/* ── Step: Downloading ── */}
                        <Show when={purchaseStep() === 'downloading'}>
                            <div class="space-y-6 text-center py-8">
                                <div class="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                    <Download class="w-8 h-8 text-green-400 animate-bounce" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-black text-white">Downloading File</h3>
                                    <p class="text-sm text-gray-500 mt-2">Retrieving file from decentralized storage...</p>
                                </div>
                                <Show when={downloadProgress() > 0}>
                                    <div class="px-4">
                                        <div class="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                                            <div
                                                class="h-full bg-gradient-to-r from-green-500 to-cyan-400 rounded-full transition-all duration-300"
                                                style={{ width: `${downloadProgress()}%` }}
                                            />
                                        </div>
                                        <div class="text-xs text-gray-500 mt-2">{downloadProgress()}% complete</div>
                                    </div>
                                </Show>
                                <div class="flex items-center justify-center gap-3 text-xs text-gray-600">
                                    <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                    <span>{selectedItem()?.name}</span>
                                </div>
                            </div>
                        </Show>

                        {/* \u2500\u2500 Step: Preview (Video / Image / Audio / PDF / Text) \u2500\u2500 */}
                        <Show when={purchaseStep() === 'preview'}>
                            <div class={`space-y-4 ${previewType() === 'pdf' || previewType() === 'text' ? 'flex flex-col min-h-0 flex-1' : ''}`}>
                                {/* Header with file info */}
                                <div class="flex items-center justify-between shrink-0">
                                    <div class="flex items-center gap-3 min-w-0 pr-10">
                                        <div class={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center border ${previewType() === 'video' ? 'bg-purple-500/10 border-purple-500/20' :
                                                previewType() === 'image' ? 'bg-pink-500/10 border-pink-500/20' :
                                                    previewType() === 'audio' ? 'bg-amber-500/10 border-amber-500/20' :
                                                        previewType() === 'pdf' ? 'bg-red-500/10 border-red-500/20' :
                                                            'bg-cyan-500/10 border-cyan-500/20'
                                            }`}>
                                            <FileTypeIcon type={selectedItem()?.type || ''} name={selectedItem()?.name || ''} class={`w-4 h-4 ${previewType() === 'video' ? 'text-purple-400' :
                                                    previewType() === 'image' ? 'text-pink-400' :
                                                        previewType() === 'audio' ? 'text-amber-400' :
                                                            previewType() === 'pdf' ? 'text-red-400' :
                                                                'text-cyan-400'
                                                }`} />
                                        </div>
                                        <div class="min-w-0">
                                            <h3 class="text-sm font-black text-white truncate">{selectedItem()?.name}</h3>
                                            <div class="text-[10px] text-gray-500">{formatFileSize(selectedItem()?.size || 0)} &middot; {selectedItem()?.type || 'Unknown type'}</div>
                                        </div>
                                    </div>
                                    {/* Fullscreen button for video/image/pdf */}
                                    <Show when={previewType() === 'video' || previewType() === 'image' || previewType() === 'pdf'}>
                                        <button
                                            onClick={() => {
                                                const el = document.getElementById('preview-content-area');
                                                if (el) {
                                                    if (document.fullscreenElement) {
                                                        document.exitFullscreen();
                                                    } else {
                                                        el.requestFullscreen().catch(() => { });
                                                    }
                                                }
                                            }}
                                            class="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-all mr-8"
                                            title="Toggle fullscreen"
                                        >
                                            <Maximize2 class="w-4 h-4" />
                                        </button>
                                    </Show>
                                </div>

                                {/* Video Player */}
                                <Show when={previewType() === 'video'}>
                                    <div id="preview-content-area" class="rounded-2xl overflow-hidden bg-black border border-white/10">
                                        <video
                                            src={previewUrl()}
                                            controls
                                            autoplay
                                            playsinline
                                            class="w-full max-h-[60vh] object-contain"
                                            style={{ "background-color": "#000" }}
                                        />
                                    </div>
                                </Show>

                                {/* Image Viewer with zoom */}
                                <Show when={previewType() === 'image'}>
                                    <div
                                        id="preview-content-area"
                                        class="rounded-2xl overflow-auto bg-black/60 border border-white/10 flex items-center justify-center cursor-zoom-in"
                                        style={{ "max-height": "60vh" }}
                                        onClick={() => setImageZoomed(!imageZoomed())}
                                    >
                                        <img
                                            src={previewUrl()}
                                            alt={selectedItem()?.name || ''}
                                            class={`transition-all duration-300 ${imageZoomed() ? 'max-w-none w-auto' : 'w-full max-h-[60vh] object-contain'}`}
                                            style={{ cursor: imageZoomed() ? 'zoom-out' : 'zoom-in' }}
                                        />
                                    </div>
                                    <Show when={imageZoomed()}>
                                        <div class="text-center text-[10px] text-gray-600 shrink-0">Click image to toggle zoom</div>
                                    </Show>
                                </Show>

                                {/* Audio Player */}
                                <Show when={previewType() === 'audio'}>
                                    <div class="rounded-2xl bg-white/[0.03] border border-white/10 p-6 flex flex-col items-center gap-4">
                                        <div class="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                                            <FileAudio class="w-10 h-10 text-amber-400" />
                                        </div>
                                        <div class="text-sm font-bold text-white">{selectedItem()?.name}</div>
                                        <audio
                                            src={previewUrl()}
                                            controls
                                            autoplay
                                            class="w-full"
                                        />
                                    </div>
                                </Show>

                                {/* PDF Inline Viewer */}
                                <Show when={previewType() === 'pdf'}>
                                    <div id="preview-content-area" class="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/10" style={{ "min-height": "500px" }}>
                                        <iframe
                                            src={previewUrl()}
                                            class="w-full h-full border-0"
                                            style={{ "min-height": "500px", "background-color": "#fff" }}
                                            title="PDF Viewer"
                                        />
                                    </div>
                                </Show>

                                {/* Text/Code Viewer */}
                                <Show when={previewType() === 'text'}>
                                    <div class="flex-1 min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12] flex flex-col" style={{ "min-height": "400px" }}>
                                        {/* Mini toolbar */}
                                        <div class="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/[0.05] shrink-0">
                                            <div class="flex items-center gap-2 text-[10px] text-gray-500">
                                                <FileText class="w-3 h-3" />
                                                <span>{selectedItem()?.name?.split('.').pop()?.toUpperCase() || 'TEXT'}</span>
                                                <span class="text-gray-700">&middot;</span>
                                                <span>{previewText().split('\n').length} lines</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(previewText());
                                                    // Brief visual feedback
                                                    const btn = document.getElementById('copy-text-btn');
                                                    if (btn) { btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy All', 1500); }
                                                }}
                                                id="copy-text-btn"
                                                class="px-3 py-1 text-[10px] font-bold text-gray-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-all border border-white/[0.05]"
                                            >
                                                Copy All
                                            </button>
                                        </div>
                                        {/* Code content with line numbers */}
                                        <div class="flex-1 overflow-auto custom-scrollbar">
                                            <pre class="p-4 text-xs leading-relaxed" style={{ "font-family": "'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace", "tab-size": "4", "white-space": "pre-wrap", "word-break": "break-all" }}>
                                                <code class="text-gray-300">{previewText()}</code>
                                            </pre>
                                        </div>
                                    </div>
                                </Show>

                                {/* Action Buttons */}
                                <div class="flex gap-3 shrink-0">
                                    <button
                                        onClick={() => {
                                            const blob = previewBlob();
                                            const item = selectedItem();
                                            if (blob && item) triggerBlobDownload(blob, item.name);
                                        }}
                                        class="flex-1 h-10 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <Download class="w-4 h-4" />
                                        Save to Device
                                    </button>
                                    <Show when={previewType() === 'pdf'}>
                                        <button
                                            onClick={() => {
                                                if (previewUrl()) window.open(previewUrl(), '_blank');
                                            }}
                                            class="h-10 px-5 bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
                                        >
                                            <ExternalLink class="w-3.5 h-3.5" />
                                            Open in Tab
                                        </button>
                                    </Show>
                                    <button
                                        onClick={closePurchaseModal}
                                        class="h-10 px-6 bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs rounded-xl transition-all border border-white/10"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </Show>

                        {/* ── Step: Success (for documents/other) ── */}
                        <Show when={purchaseStep() === 'success'}>
                            <div class="space-y-6 text-center py-8">
                                <div class="w-16 h-16 mx-auto rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                    <CheckCircle class="w-8 h-8 text-green-400" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-black text-white">Download Complete</h3>
                                    <p class="text-sm text-gray-500 mt-2">The file has been saved to your device.</p>
                                </div>
                                <button
                                    onClick={closePurchaseModal}
                                    class="mx-auto h-10 px-8 bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-sm rounded-xl transition-all border border-white/10"
                                >
                                    Done
                                </button>
                            </div>
                        </Show>

                        {/* ── Step: Error ── */}
                        <Show when={purchaseStep() === 'error'}>
                            <div class="space-y-6 text-center py-8">
                                <div class="w-16 h-16 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                    <AlertTriangle class="w-8 h-8 text-red-400" />
                                </div>
                                <div>
                                    <h3 class="text-xl font-black text-white">Error</h3>
                                    <p class="text-sm text-red-400 mt-2 px-4">{purchaseError()}</p>
                                </div>
                                <div class="flex gap-3 justify-center">
                                    <button
                                        onClick={closePurchaseModal}
                                        class="h-10 px-6 bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-sm rounded-xl transition-all border border-white/10"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => { setPurchaseError(''); setPurchaseStep('confirm'); }}
                                        class="h-10 px-6 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-sm rounded-xl transition-all"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        </Show>
                    </Motion.div>
                </div>
            </Show>
        </div>
    );
};

export default VisionMarket;
