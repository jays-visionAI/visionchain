import { createSignal, Show, For, onMount, createEffect, createMemo, onCleanup } from 'solid-js';
import { Motion, Presence } from 'solid-motionone';
import {
    HardDrive, UploadCloud, Folder, FolderPlus,
    File as FileIcon, FileText, FileImage, FileVideo, FileAudio,
    MoreVertical, Search, Grid, List, ChevronRight,
    Download, Trash2, Eye, X, ArrowLeft, Plus, Check, AlertTriangle, Copy
} from 'lucide-solid';
import { WalletViewHeader } from './WalletViewHeader';
import { useAuth } from '../auth/authContext';
import { addRewardPoints, getRPConfig, getUserContacts } from '../../services/firebaseService';
import {
    uploadDiskFile, downloadDiskFile, downloadDiskFileGranular, listDiskFiles, deleteDiskFile, renameDiskFile,
    createDiskFolder, listDiskFolders, deleteDiskFolder, renameDiskFolder,
    listAllDiskFolders, getDiskUsage, formatFileSize, getFileExtension,
    subscribeToDisk, cancelDiskSubscription,
    publishDiskFile, unpublishDiskFile, encryptFile, decryptFile,
    moveDiskFile, moveDiskFolder,
    generateImageThumbnail, generateVideoThumbnail,
    optimizeImage, streamVideoChunks, backfillThumbnail,
    shareResource, revokeShare, getSharedWithMe, getMyShares,
    createSharedFolder, manageSharedFolderMember, getSharedFolderFiles,
    uploadToSharedFolder, deleteSharedFolderFile,
    type DiskFile, type DiskFolder, type DiskUsage, type UploadProgress,
    type ShareInfo, type SharedFolder
} from '../../services/diskService';
import { ethers } from 'ethers';
import VCNTokenABI from '../../services/abi/VCNToken.json';
import { Globe, Share2, ShieldCheck, ShieldAlert, Lock, Unlock, RotateCw, Users, UserPlus, UserMinus } from 'lucide-solid';
import NodeRewardPanel from './NodeRewardPanel';

// ─── Gasless Permit Constants (must match transferService / contractService) ───
const VCN_TOKEN = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const PAYMASTER_ADMIN = '0x08A1B183a53a0f8f1D875945D504272738E3AF34';
const CHAIN_ID = 3151909;
const RPC_URL = 'https://api.visionchain.co/rpc-proxy';

/**
 * Sign an EIP-2612 Permit off-chain (gasless).
 * The Executor (Cloud Function) will execute permit() + transferFrom() on-chain.
 */
async function signDiskPermit(
    privateKey: string,
    totalVcn: string
): Promise<{ signature: string; deadline: number; owner: string }> {
    const rpcProvider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, rpcProvider);
    const vcnContract = new ethers.Contract(VCN_TOKEN, VCNTokenABI.abi, rpcProvider);

    const totalAmount = ethers.parseUnits(totalVcn, 18);
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    const [tokenName, nonce] = await Promise.all([
        vcnContract.name(),
        vcnContract.nonces(wallet.address),
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
        owner: wallet.address,
        spender: PAYMASTER_ADMIN,
        value: totalAmount,
        nonce: nonce,
        deadline: deadline,
    };

    const signature = await wallet.signTypedData(domain, types, values);
    return { signature, deadline, owner: wallet.address };
}

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

export const WalletDisk = (props: {
    privateKey?: string;
    walletAddress?: string;
    networkMode?: string;
    onRequestUnlock?: () => void;
    isWalletMissing?: boolean;
    cloudWalletAvailable?: boolean;
    onCloudRestore?: () => void;
    onRestoreWallet?: () => void;
}) => {
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
    const [diskTab, setDiskTab] = createSignal<'myDisk' | 'shared'>('myDisk');
    // Sharing state
    const [showShareModal, setShowShareModal] = createSignal(false);
    const [shareTarget, setShareTarget] = createSignal<{ type: 'file' | 'folder'; item: DiskFile | DiskFolder } | null>(null);
    const [shareSearchQuery, setShareSearchQuery] = createSignal('');
    const [sharingInProgress, setSharingInProgress] = createSignal(false);
    const [sharedWithMe, setSharedWithMe] = createSignal<ShareInfo[]>([]);
    const [sharedFolders, setSharedFolders] = createSignal<SharedFolder[]>([]);
    const [sharedLoading, setSharedLoading] = createSignal(false);
    const [showCreateSharedFolder, setShowCreateSharedFolder] = createSignal(false);
    const [newSharedFolderName, setNewSharedFolderName] = createSignal('');
    const [newSharedFolderMembers, setNewSharedFolderMembers] = createSignal<string[]>([]);
    const [activeSharedFolder, setActiveSharedFolder] = createSignal<string | null>(null);
    const [sharedFolderFiles, setSharedFolderFiles] = createSignal<DiskFile[]>([]);
    const [sharedFolderMeta, setSharedFolderMeta] = createSignal<any>(null);
    const [contacts, setContacts] = createSignal<any[]>([]);
    const [showMemberPanel, setShowMemberPanel] = createSignal(false);
    const [previewFile, setPreviewFile] = createSignal<DiskFile | null>(null);
    const [previewURL, setPreviewURL] = createSignal<string>('');
    const [previewLoading, setPreviewLoading] = createSignal(false);
    const [previewProgress, setPreviewProgress] = createSignal<{ current: number; total: number } | null>(null);
    // Video streaming state
    const [videoStreamProgress, setVideoStreamProgress] = createSignal<{ current: number; total: number; bytesLoaded: number } | null>(null);
    const [videoBuffering, setVideoBuffering] = createSignal(false);
    const [videoFullyLoaded, setVideoFullyLoaded] = createSignal(false);
    const [videoBufferReady, setVideoBufferReady] = createSignal(false); // true when 10MB buffered, play button shown
    // PDF viewer state
    const [pdfPages, setPdfPages] = createSignal<string[]>([]); // rendered page images as data URLs
    const [pdfCurrentPage, setPdfCurrentPage] = createSignal(1);
    const [pdfTotalPages, setPdfTotalPages] = createSignal(0);
    const [pdfRendering, setPdfRendering] = createSignal(false);
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

    // Publishing State
    const [showPublishModal, setShowPublishModal] = createSignal(false);
    const [publishPrice, setPublishPrice] = createSignal('5');
    const [publishLoading, setPublishLoading] = createSignal(false);
    const [publishingFile, setPublishingFile] = createSignal<DiskFile | null>(null);

    // Batch Actions State
    const [selectedItems, setSelectedItems] = createSignal<Set<string>>(new Set());
    const [isSelectMode, setIsSelectMode] = createSignal(false);

    // Encryption State
    const [useEncryption, setUseEncryption] = createSignal(true);
    const [encryptionPassword, setEncryptionPassword] = createSignal('');
    const [showPasswordModal, setShowPasswordModal] = createSignal(false);
    const [pendingFiles, setPendingFiles] = createSignal<(FileList | File[]) | null>(null);
    const [pendingPreviewFile, setPendingPreviewFile] = createSignal<DiskFile | null>(null);
    const [decryptingFileId, setDecryptingFileId] = createSignal('');
    const [useDistributed, setUseDistributed] = createSignal(true);
    const [preserveOriginal, setPreserveOriginal] = createSignal(false);

    // Reward
    const [nodeId, setNodeId] = createSignal<string | null>(null);
    const [showRewards, setShowRewards] = createSignal(false);

    // Tooltip State
    const [showVNetTooltip, setShowVNetTooltip] = createSignal(false);
    const [showPrivateTooltip, setShowPrivateTooltip] = createSignal(false);

    // PPTX Preview State
    const [pptxSlides, setPptxSlides] = createSignal<{ html: string; images: Record<string, string> }[]>([]);
    const [pptxCurrentSlide, setPptxCurrentSlide] = createSignal(1);
    const [pptxTotalSlides, setPptxTotalSlides] = createSignal(0);
    const [pptxRendering, setPptxRendering] = createSignal(false);

    // Move Modal State
    const [showMoveModal, setShowMoveModal] = createSignal(false);
    const [moveTargetFolder, setMoveTargetFolder] = createSignal<string | null>(null);
    const [allFolders, setAllFolders] = createSignal<DiskFolder[]>([]);

    let fileInputRef: HTMLInputElement | undefined;

    // ─── PDF.js Renderer ───
    const renderPdfFromBlob = async (blob: Blob) => {
        try {
            // Dynamically load pdf.js from CDN
            if (!(window as any).pdfjsLib) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    script.type = 'text/javascript';
                    script.onload = () => {
                        const lib = (window as any).pdfjsLib;
                        if (lib) {
                            lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        }
                        resolve();
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const pdfjsLib = (window as any).pdfjsLib;
            if (!pdfjsLib) throw new Error('pdf.js failed to load');

            const arrayBuffer = await blob.arrayBuffer();

            // Validate PDF header
            const header = new Uint8Array(arrayBuffer.slice(0, 5));
            const headerStr = String.fromCharCode(...header);
            if (!headerStr.startsWith('%PDF')) {
                console.error('[Disk] Invalid PDF header:', headerStr, '- first 20 bytes:', new Uint8Array(arrayBuffer.slice(0, 20)));
                throw new Error('Downloaded data is not a valid PDF (header: ' + headerStr + ')');
            }

            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            const totalPages = pdf.numPages;
            setPdfTotalPages(totalPages);

            const pagesToRender = Math.min(totalPages, 50);
            const pages: string[] = [];
            const scale = 2.0;

            for (let i = 1; i <= pagesToRender; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) continue;

                await page.render({ canvasContext: ctx, viewport }).promise;
                pages.push(canvas.toDataURL('image/png'));

                if (i === 1 || i % 5 === 0) {
                    setPdfPages([...pages]);
                }
            }

            setPdfPages(pages);
            setPdfCurrentPage(1);
        } catch (err) {
            console.error('[Disk] PDF render error:', err);
        }
    };

    // ─── PPTX Renderer ───
    const renderPptxFromBlob = async (blob: Blob) => {
        try {
            // Load JSZip from CDN
            if (!(window as any).JSZip) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                    script.onload = () => resolve();
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const JSZip = (window as any).JSZip;
            if (!JSZip) throw new Error('JSZip failed to load');

            const arrayBuffer = await blob.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);

            // Extract media images as data URLs
            const mediaImages: Record<string, string> = {};
            const mediaFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/media/'));
            for (const mediaPath of mediaFiles) {
                const data = await zip.file(mediaPath)?.async('base64');
                if (data) {
                    const ext = mediaPath.split('.').pop()?.toLowerCase() || 'png';
                    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
                    mediaImages[mediaPath.replace('ppt/', '')] = `data:${mime};base64,${data}`;
                }
            }

            // Find all slides
            const slideFiles = Object.keys(zip.files)
                .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
                .sort((a, b) => {
                    const na = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
                    const nb = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
                    return na - nb;
                });

            setPptxTotalSlides(slideFiles.length);
            const slides: { html: string; images: Record<string, string> }[] = [];

            for (const slideFile of slideFiles) {
                const slideXml = await zip.file(slideFile)?.async('text');
                if (!slideXml) continue;

                // Parse slide relationships for image references
                const slideNum = slideFile.match(/slide(\d+)/)?.[1] || '1';
                const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
                const relsXml = await zip.file(relsPath)?.async('text');
                const imageRels: Record<string, string> = {};
                if (relsXml) {
                    const relMatches = relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g);
                    for (const m of relMatches) {
                        const target = m[2].replace('../', '');
                        if (mediaImages[target]) {
                            imageRels[m[1]] = mediaImages[target];
                        }
                    }
                }

                // Parse text content from slide XML
                const textParts: string[] = [];
                const parser = new DOMParser();
                const doc = parser.parseFromString(slideXml, 'text/xml');

                // Extract all text runs
                const textNodes = doc.querySelectorAll('*');
                let currentParagraph = '';
                textNodes.forEach(node => {
                    if (node.localName === 'p' && node.namespaceURI?.includes('drawingml')) {
                        if (currentParagraph.trim()) textParts.push(currentParagraph.trim());
                        currentParagraph = '';
                    }
                    if (node.localName === 't' && node.textContent) {
                        currentParagraph += node.textContent;
                    }
                });
                if (currentParagraph.trim()) textParts.push(currentParagraph.trim());

                // Extract image references from slide
                const slideImages: string[] = [];
                const blipNodes = doc.querySelectorAll('*');
                blipNodes.forEach(node => {
                    if (node.localName === 'blip') {
                        const embed = node.getAttribute('r:embed') || node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
                        if (embed && imageRels[embed]) {
                            slideImages.push(imageRels[embed]);
                        }
                    }
                });

                // Build HTML for this slide
                let html = '<div style="width:100%;height:100%;padding:32px;display:flex;flex-direction:column;justify-content:center;background:#1e1e2e;color:white;font-family:Inter,system-ui,sans-serif;position:relative;overflow:hidden;">';

                // Slide number badge
                html += `<div style="position:absolute;top:12px;right:16px;font-size:11px;color:rgba(255,255,255,0.3);font-weight:600;">SLIDE ${slides.length + 1}</div>`;

                // Images
                if (slideImages.length > 0) {
                    html += '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;">';
                    for (const img of slideImages) {
                        html += `<img src="${img}" style="max-width:80%;max-height:240px;border-radius:8px;object-fit:contain;" />`;
                    }
                    html += '</div>';
                }

                // Text content
                if (textParts.length > 0) {
                    const title = textParts[0];
                    html += `<div style="font-size:22px;font-weight:800;margin-bottom:16px;line-height:1.3;">${title.replace(/</g, '&lt;')}</div>`;
                    if (textParts.length > 1) {
                        html += '<div style="display:flex;flex-direction:column;gap:8px;">';
                        for (let i = 1; i < textParts.length; i++) {
                            html += `<div style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.5;">${textParts[i].replace(/</g, '&lt;')}</div>`;
                        }
                        html += '</div>';
                    }
                } else if (slideImages.length === 0) {
                    html += '<div style="font-size:16px;color:rgba(255,255,255,0.4);text-align:center;">(Empty slide)</div>';
                }

                html += '</div>';
                slides.push({ html, images: imageRels });

                // Progressive update
                if (slides.length === 1 || slides.length % 3 === 0) {
                    setPptxSlides([...slides]);
                }
            }

            setPptxSlides(slides);
            setPptxCurrentSlide(1);
        } catch (err) {
            console.error('[Disk] PPTX render error:', err);
        }
    };

    // ─── Data Loading ───

    // Track files already being backfilled to avoid duplicates
    const backfillingIds = new Set<string>();

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

            // Lazy backfill thumbnails for distributed files without thumbnails
            const filesToBackfill = fileList.filter(f =>
                !f.thumbnailURL && !f.thumbnail &&
                !f.isEncrypted &&
                (f.storageType === 'distributed' || f.cid) &&
                (f.type.startsWith('image/') || f.type.startsWith('video/')) &&
                !backfillingIds.has(f.id)
            );

            if (filesToBackfill.length > 0) {
                // Process one at a time in background to avoid overwhelming
                (async () => {
                    for (const file of filesToBackfill) {
                        if (backfillingIds.has(file.id)) continue;
                        backfillingIds.add(file.id);
                        try {
                            const thumb = await backfillThumbnail(email(), file);
                            if (thumb) {
                                // Update local state immediately
                                setFiles(prev => prev.map(f =>
                                    f.id === file.id ? { ...f, thumbnail: thumb } : f
                                ));
                            }
                        } catch (e) {
                            console.warn('[Disk] Backfill failed for', file.name, e);
                        }
                    }
                })();
            }
        } catch (e) {
            console.error('[Disk] Failed to load data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    onMount(() => {
        if (email()) loadData();
        // Load nodeId from mobile_nodes
        fetch('https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mobile_node.status', email: email() }),
        }).then(r => r.json()).then(d => { if (d.success && d.node_id) setNodeId(d.node_id); }).catch(() => { });
    });

    createEffect(() => {
        if (email()) loadData();
    });

    createEffect(async () => {
        if (showMoveModal() && email()) {
            const folders = await listAllDiskFolders(email());
            setAllFolders(folders);
        }
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

        if (useEncryption() && !encryptionPassword()) {
            setPendingFiles(Array.from(fileList));
            setShowPasswordModal(true);
            return;
        }

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
                // ── Media Optimization (when preserveOriginal is OFF) ──
                let processedFile: File = file;
                if (!preserveOriginal()) {
                    if (file.type.startsWith('image/') && !file.type.includes('svg')) {
                        processedFile = await optimizeImage(file, 2048, 0.85);
                    }
                    // Video transcoding is handled server-side in Phase 2
                }

                let fileToUpload: File | Blob = processedFile;
                let encryptionMeta: any = {};

                // Generate thumbnail from ORIGINAL file BEFORE encryption
                let preEncryptionThumbnail = '';
                if (useEncryption()) {
                    if (file.type.startsWith('image/')) {
                        preEncryptionThumbnail = await generateImageThumbnail(file);
                    } else if (file.type.startsWith('video/')) {
                        preEncryptionThumbnail = await generateVideoThumbnail(file);
                    }

                    const encrypted = await encryptFile(processedFile, encryptionPassword());
                    fileToUpload = new File([encrypted.encryptedData], processedFile.name, { type: processedFile.type });
                    encryptionMeta = {
                        isEncrypted: true,
                        salt: encrypted.salt,
                        iv: encrypted.iv
                    };
                }

                const extraMeta = {
                    ...encryptionMeta,
                    storageType: useDistributed() ? 'distributed' : 'cloud',
                    preserveOriginal: preserveOriginal(),
                    ...(preEncryptionThumbnail ? { preEncryptionThumbnail } : {})
                };

                await uploadDiskFile(email(), fileToUpload as File, currentPath(), (p) => {
                    setUploadQueue(prev =>
                        prev.map(item =>
                            item.fileName === p.fileName ? { ...item, ...p } : item
                        )
                    );
                }, extraMeta);

                // Award RP for disk upload
                try {
                    const rpCfg = await getRPConfig();
                    if (rpCfg.disk_upload > 0) {
                        await addRewardPoints(email(), rpCfg.disk_upload, 'disk_upload', file.name);
                    }
                } catch (_rpErr) { /* non-blocking */ }
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

        await loadData();

        // Clear search filter so uploaded files are visible
        setSearchQuery('');

        // Auto-dismiss upload panel after a brief delay if all uploads succeeded
        const hasErrors = uploadQueue().some(u => u.status === 'error');
        if (!hasErrors) {
            setTimeout(() => {
                setShowUploadPanel(false);
                setUploadQueue([]);
            }, 1500);
        }
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
            if (props.isWalletMissing) {
                if (props.cloudWalletAvailable && props.onCloudRestore) {
                    setSubsError('Wallet not found on this device. Restoring from cloud...');
                    props.onCloudRestore();
                } else if (props.onRestoreWallet) {
                    setSubsError('Local wallet not found. Redirecting to Profile settings...');
                    props.onRestoreWallet();
                } else {
                    setSubsError('Local wallet not found. Please restore your wallet in Profile settings.');
                }
            } else {
                setSubsError('');
                if (props.onRequestUnlock) props.onRequestUnlock();
            }
            return;
        }
        setIsSubscribing(true);
        setSubsError('');
        try {
            // Calculate price to sign permit for
            const gb = selectedGb();
            const price = gb <= 10 ? 5 : 5 + Math.ceil((gb - 10) / 10) * 3;

            // Sign EIP-2612 Permit off-chain (gasless - no gas needed from user)
            console.log(`[Disk] Signing permit for ${price} VCN (${gb}GB plan)...`);
            const permit = await signDiskPermit(props.privateKey, price.toString());
            console.log(`[Disk] Permit signed. Calling diskSubscribe Cloud Function...`);

            // Call Cloud Function with permit data
            await subscribeToDisk(gb, permit.signature, permit.deadline, permit.owner);
            await loadData();
        } catch (e: any) {
            console.error('[Disk] Subscription failed:', e);
            setSubsError(e.message || 'Payment failed. Check VCN balance.');
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

    const handleDownload = async (file: DiskFile) => {
        try {
            // Distributed storage files (new architecture)
            if (file.storageType === 'distributed' || file.cid) {
                const userEmail = email();
                if (!userEmail) { alert('Login required'); return; }

                // Use chunk-by-chunk download to avoid base64 response size limits
                let blob: Blob;
                if (file.chunkHashes && file.chunkHashes.length > 0) {
                    blob = await downloadDiskFileGranular(file, () => { }, 10);
                } else {
                    const result = await downloadDiskFile(userEmail, file.id);
                    blob = result.blob;
                }

                // Award RP for disk download (fire-and-forget)
                getRPConfig().then(rpCfg => {
                    if (rpCfg.disk_download > 0) {
                        addRewardPoints(userEmail, rpCfg.disk_download, 'disk_download', file.name).catch(() => { });
                    }
                }).catch(() => { });

                // If encrypted, decrypt the blob
                if (file.isEncrypted) {
                    if (!encryptionPassword()) {
                        setShowPasswordModal(true);
                        alert('Please enter your encryption password first.');
                        return;
                    }
                    setDecryptingFileId(file.id);
                    try {
                        const buffer = await blob.arrayBuffer();
                        const decBlob = await decryptFile(buffer, encryptionPassword(), file.salt!, file.iv!, file.type);
                        const url = window.URL.createObjectURL(decBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.name;
                        a.style.display = 'none';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                    } finally {
                        setDecryptingFileId('');
                    }
                    return;
                }

                // Normal distributed file download
                const finalBlob = new Blob([await blob.arrayBuffer()], { type: file.type });
                const url = window.URL.createObjectURL(finalBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
                return;
            }

            // Legacy: Firebase Storage direct download
            if (file.isEncrypted) {
                if (!encryptionPassword()) {
                    setShowPasswordModal(true);
                    alert('Please enter your encryption password first.');
                    return;
                }
                setDecryptingFileId(file.id);
                try {
                    const response = await fetch(file.downloadURL);
                    const buffer = await response.arrayBuffer();
                    const blob = await decryptFile(buffer, encryptionPassword(), file.salt!, file.iv!, file.type);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                } catch (err: any) {
                    alert('Decryption failed. Wrong password?');
                } finally {
                    setDecryptingFileId('');
                }
            } else {
                window.open(file.downloadURL, '_blank');
            }
        } catch (err: any) {
            console.error('[Disk] Download error:', err);
            alert('Download failed: ' + (err.message || 'Unknown error'));
        }
    };

    const handlePublish = async () => {
        const file = publishingFile();
        if (!file || !email()) return;

        setPublishLoading(true);
        try {
            const price = parseFloat(publishPrice());
            if (isNaN(price) || price < 0) throw new Error('Invalid price');

            await publishDiskFile(email(), file.id, price);

            // Award RP for market_publish
            try {
                const rpCfg = await getRPConfig();
                if (rpCfg.market_publish > 0) {
                    await addRewardPoints(email(), rpCfg.market_publish, 'market_publish', file.name);
                }
            } catch (_rpErr) { /* non-blocking */ }

            setShowPublishModal(false);
            setPublishingFile(null);
            setContextMenu(null);
            await loadData();
            alert('File published successfully to Vision Market!');
        } catch (err: any) {
            console.error('Publish error:', err);
            alert('Failed to publish: ' + err.message);
        } finally {
            setPublishLoading(false);
        }
    };

    const handleUnpublish = async () => {
        const file = publishingFile() || (contextMenu()?.type === 'file' ? contextMenu()?.item as DiskFile : null);
        if (!file || !email()) return;

        if (!confirm('Are you sure you want to remove this file from Vision Market?')) return;

        try {
            await unpublishDiskFile(email(), file.id);
            setPublishingFile(null);
            await loadData();
            setContextMenu(null);
        } catch (err: any) {
            alert('Failed to unpublish: ' + err.message);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            if (next.size === 0) setIsSelectMode(false);
            return next;
        });
    };

    const clearSelection = () => {
        setSelectedItems(new Set<string>());
        setIsSelectMode(false);
    };

    const loadContacts = async () => {
        if (contacts().length > 0 || !email()) return;
        try {
            const c = await getUserContacts(email());
            setContacts(c);
        } catch (e) { console.error('[Disk] Failed to load contacts:', e); }
    };

    const handleShare = (item: DiskFile | DiskFolder, type: 'file' | 'folder' = 'file') => {
        setShareTarget({ type, item });
        setShareSearchQuery('');
        setShowShareModal(true);
        setContextMenu(null);
        loadContacts();
    };

    const executeShare = async (targetEmail: string) => {
        const target = shareTarget();
        if (!target) return;
        setSharingInProgress(true);
        try {
            await shareResource(targetEmail, target.type, target.item.id, target.item.name);
            setShowShareModal(false);
            setShareTarget(null);
        } catch (err: any) {
            console.error('[Disk] Share failed:', err);
            alert(err.message || 'Failed to share');
        } finally {
            setSharingInProgress(false);
        }
    };

    const loadSharedItems = async () => {
        setSharedLoading(true);
        loadContacts();
        try {
            const data = await getSharedWithMe();
            setSharedWithMe(data.shares);
            setSharedFolders(data.sharedFolders);
        } catch (err) {
            console.error('[Disk] Failed to load shared items:', err);
        } finally {
            setSharedLoading(false);
        }
    };

    const handleCreateSharedFolder = async () => {
        if (!newSharedFolderName().trim()) return;
        try {
            await createSharedFolder(newSharedFolderName(), newSharedFolderMembers());
            setShowCreateSharedFolder(false);
            setNewSharedFolderName('');
            setNewSharedFolderMembers([]);
            await loadSharedItems();
        } catch (err: any) {
            alert(err.message || 'Failed to create shared folder');
        }
    };

    const openSharedFolder = async (folderId: string) => {
        setActiveSharedFolder(folderId);
        setSharedLoading(true);
        try {
            const data = await getSharedFolderFiles(folderId);
            setSharedFolderFiles(data.files);
            setSharedFolderMeta(data.folder);
        } catch (err) {
            console.error('[Disk] Failed to load shared folder:', err);
        } finally {
            setSharedLoading(false);
        }
    };

    const handleBatchMove = () => {
        setShowMoveModal(true);
    };

    const handleMoveConfirm = async (targetPath: string) => {
        if (!email()) return;
        const ids = Array.from(selectedItems());
        try {
            for (const id of ids) {
                // Check if it's a file or folder in our current signals
                const isFile = files().find(f => f.id === id);
                if (isFile) {
                    await moveDiskFile(email(), id, targetPath);
                } else {
                    await moveDiskFolder(email(), id, targetPath);
                }
            }
            setShowMoveModal(false);
            clearSelection();
            await loadData();
            alert('Items moved successfully!');
        } catch (err: any) {
            alert('Move failed: ' + err.message);
        }
    };

    const handleBatchDelete = async () => {
        const ids = Array.from(selectedItems());
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} items?`)) return;

        setIsLoading(true);
        try {
            await Promise.all(ids.map(id => {
                const isFile = files().some(f => f.id === id);
                return isFile ? deleteDiskFile(email(), id) : deleteDiskFolder(email(), id);
            }));
            clearSelection();
            await loadData();
        } catch (e) {
            alert('Failed to delete some items.');
        } finally {
            setIsLoading(false);
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

    // ─── Preview Handler ───
    let prevBlobURL = '';
    createEffect(async () => {
        const file = previewFile();

        // Revoke previous blob URL (non-reactive, use local var)
        if (prevBlobURL) {
            URL.revokeObjectURL(prevBlobURL);
            prevBlobURL = '';
        }
        setPreviewURL('');
        setPreviewLoading(false);
        setVideoStreamProgress(null);
        setVideoBuffering(false);
        setVideoFullyLoaded(false);
        setVideoBufferReady(false);
        setPdfPages([]);
        setPdfCurrentPage(1);
        setPdfTotalPages(0);
        setPdfRendering(false);
        setPptxSlides([]);
        setPptxCurrentSlide(1);
        setPptxTotalSlides(0);
        setPptxRendering(false);

        if (!file) return;

        // PDF files: download blob and render via pdf.js
        if (file.type.includes('pdf')) {
            console.log('[Disk] PDF preview for:', file.name, '| isEncrypted:', file.isEncrypted, '| storageType:', file.storageType, '| chunkCount:', file.chunkCount);
            setPreviewLoading(true);
            setPreviewProgress(null);
            try {
                let blob: Blob;
                if (file.storageType === 'distributed' || file.isEncrypted) {
                    if (file.storageType === 'distributed') {
                        blob = await downloadDiskFileGranular(file, (current, total) => {
                            setPreviewProgress({ current, total });
                        }, 8);
                    } else {
                        const resp = await fetch(file.downloadURL);
                        blob = await resp.blob();
                    }
                    if (file.isEncrypted) {
                        if (!encryptionPassword()) {
                            setPendingPreviewFile(file);
                            setShowPasswordModal(true);
                            setPreviewFile(null);
                            return;
                        }
                        console.log('[Disk] Decrypting PDF:', { salt: file.salt, iv: file.iv, saltLen: file.salt?.length, ivLen: file.iv?.length, pwdLen: encryptionPassword().length });
                        const buffer = await blob.arrayBuffer();
                        console.log('[Disk] Pre-decrypt blob size:', buffer.byteLength);
                        blob = await decryptFile(buffer, encryptionPassword(), file.salt!, file.iv!, file.type);
                        console.log('[Disk] Post-decrypt blob size:', blob.size);
                    }
                } else {
                    const resp = await fetch(file.downloadURL);
                    blob = await resp.blob();
                }
                setPreviewLoading(false);
                setPdfRendering(true);
                await renderPdfFromBlob(blob);
            } catch (err) {
                console.error('[Disk] PDF preview failed:', err);
            } finally {
                setPreviewLoading(false);
                setPdfRendering(false);
                setPreviewProgress(null);
            }
            return;
        }

        // PPTX files: download and render via JSZip
        const pptxTypes = ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint'];
        const isPptx = pptxTypes.includes(file.type) || file.name.toLowerCase().endsWith('.pptx') || file.name.toLowerCase().endsWith('.ppt');
        if (isPptx) {
            console.log('[Disk] PPTX preview for:', file.name);
            setPreviewLoading(true);
            setPreviewProgress(null);
            try {
                let blob: Blob;
                if (file.storageType === 'distributed' || file.isEncrypted) {
                    if (file.storageType === 'distributed') {
                        blob = await downloadDiskFileGranular(file, (current, total) => {
                            setPreviewProgress({ current, total });
                        }, 8);
                    } else {
                        const resp = await fetch(file.downloadURL);
                        blob = await resp.blob();
                    }
                    if (file.isEncrypted) {
                        if (!encryptionPassword()) {
                            setPendingPreviewFile(file);
                            setShowPasswordModal(true);
                            setPreviewFile(null);
                            return;
                        }
                        const buffer = await blob.arrayBuffer();
                        blob = await decryptFile(buffer, encryptionPassword(), file.salt!, file.iv!, file.type);
                    }
                } else {
                    const resp = await fetch(file.downloadURL);
                    blob = await resp.blob();
                }
                setPreviewLoading(false);
                setPptxRendering(true);
                await renderPptxFromBlob(blob);
            } catch (err) {
                console.error('[Disk] PPTX preview failed:', err);
            } finally {
                setPreviewLoading(false);
                setPptxRendering(false);
                setPreviewProgress(null);
            }
            return;
        }

        // Video streaming path (non-encrypted distributed video)
        if (file.type.startsWith('video/') && (file.storageType === 'distributed' || file.cid) && !file.isEncrypted) {
            setVideoBuffering(true);
            setPreviewLoading(false); // Don't show generic spinner
            try {
                const fullBlob = await streamVideoChunks(
                    file,
                    (current, total, bytesLoaded) => {
                        setVideoStreamProgress({ current, total, bytesLoaded });
                    },
                    (blobUrl) => {
                        // Buffer ready - show play button, DON'T auto-play
                        prevBlobURL = blobUrl;
                        setPreviewURL(blobUrl);
                        setVideoBufferReady(true);
                        setVideoBuffering(false);
                    },
                    10 * 1024 * 1024 // 10MB threshold before play button appears
                );
                // Replace with full blob URL
                if (prevBlobURL) URL.revokeObjectURL(prevBlobURL);
                const fullUrl = URL.createObjectURL(fullBlob);
                prevBlobURL = fullUrl;
                setPreviewURL(fullUrl);
                setVideoFullyLoaded(true);
                setVideoStreamProgress(null);
            } catch (err) {
                console.error('[Disk] Video stream failed, trying fallback download:', err);
                // Fallback: download entire file via granular chunks
                try {
                    const blob = await downloadDiskFileGranular(file, (current, total) => {
                        setVideoStreamProgress({ current, total, bytesLoaded: current * 256 * 1024 });
                    }, 12);
                    const fullUrl = URL.createObjectURL(blob);
                    prevBlobURL = fullUrl;
                    setPreviewURL(fullUrl);
                    setVideoFullyLoaded(true);
                    setVideoBuffering(false);
                    setVideoStreamProgress(null);
                } catch (fallbackErr) {
                    console.error('[Disk] Video fallback download also failed:', fallbackErr);
                    setVideoBuffering(false);
                    setVideoStreamProgress(null);
                }
            }
            return;
        }

        if (file.storageType === 'distributed' || file.isEncrypted) {
            setPreviewLoading(true);
            setPreviewProgress(null);
            try {
                let blob: Blob;
                if (file.storageType === 'distributed') {
                    // Use larger batch for video, normal for others
                    const batchSize = file.type.startsWith('video/') ? 12 : 8;
                    blob = await downloadDiskFileGranular(file, (current, total) => {
                        setPreviewProgress({ current, total });
                    }, batchSize);
                } else {
                    const resp = await fetch(file.downloadURL);
                    blob = await resp.blob();
                }

                if (file.isEncrypted) {
                    if (!encryptionPassword()) {
                        setPendingPreviewFile(file);
                        setShowPasswordModal(true);
                        setPreviewFile(null);
                        return;
                    }
                    const buffer = await blob.arrayBuffer();
                    blob = await decryptFile(buffer, encryptionPassword(), file.salt!, file.iv!, file.type);
                }
                const blobUrl = URL.createObjectURL(blob);
                prevBlobURL = blobUrl;
                setPreviewURL(blobUrl);
            } catch (err) {
                console.error('[Disk] Preview load failed:', err);
            } finally {
                setPreviewLoading(false);
                setPreviewProgress(null);
            }
        } else {
            setPreviewURL(file.downloadURL);
        }
    });

    // Close context menu on outside click
    const handleGlobalClick = () => setContextMenu(null);
    onMount(() => document.addEventListener('click', handleGlobalClick));
    onCleanup(() => document.removeEventListener('click', handleGlobalClick));

    // ─── Render ───

    return (
        <div
            class={`h-full flex flex-col pt-[max(env(safe-area-inset-top,20px),24px)] lg:pt-8 px-3 sm:px-4 lg:px-8 pb-32 lg:pb-8 max-w-5xl mx-auto w-full overflow-x-hidden overflow-y-auto custom-scrollbar relative transition-all ${isDragOver() ? 'ring-2 ring-cyan-400/40 ring-inset' : ''}`}
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
            <WalletViewHeader
                tag="Decentralized"
                title="VISION"
                titleAccent="DISK"
                description="Decentralized storage powered by Vision Nodes"
                icon={HardDrive}
            />

            <div class="flex flex-wrap items-center gap-2 mb-6 shrink-0">
                {/* Search */}
                <div class="relative">
                    <Search class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchQuery()}
                        onInput={(e) => setSearchQuery(e.currentTarget.value)}
                        autocomplete="off"
                        name="disk-search-query"
                        class="h-10 w-32 sm:w-48 pl-9 pr-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 transition-all"
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

                {/* Distributed Toggle */}
                <div class="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setUseDistributed(!useDistributed());
                        }}
                        onMouseEnter={() => { if (window.innerWidth > 768) setShowVNetTooltip(true); }}
                        onMouseLeave={() => setShowVNetTooltip(false)}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowVNetTooltip(!showVNetTooltip());
                            setShowPrivateTooltip(false);
                            if (!showVNetTooltip()) setTimeout(() => setShowVNetTooltip(false), 3000);
                        }}
                        class={`h-10 px-3 flex items-center gap-2 border rounded-xl text-sm font-bold transition-all ${useDistributed()
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                            : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white'
                            }`}
                    >
                        <Globe class={`w-4 h-4 ${useDistributed() ? 'text-amber-500' : 'text-gray-600'}`} />
                        <span class="hidden md:inline">VNet</span>
                    </button>
                    <Show when={showVNetTooltip()}>
                        <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 text-xs leading-relaxed">
                            <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a2e] border-l border-t border-white/10 rotate-45" />
                            <p class="font-bold text-amber-400 mb-1.5">Vision Network Storage</p>
                            <p class="text-gray-300 mb-1.5">
                                Files are split into 256KB chunks and distributed across Vision Nodes worldwide. Each chunk is replicated to 3+ nodes for maximum durability.
                            </p>
                            <div class="flex items-center gap-1.5 text-gray-500">
                                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                                <span>Merkle tree verification ensures data integrity</span>
                            </div>
                            <button onClick={() => setShowVNetTooltip(false)} class="md:hidden absolute top-2 right-2 text-gray-500 hover:text-white">
                                <X class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </Show>
                </div>

                {/* Encryption Toggle */}
                <div class="relative">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setUseEncryption(!useEncryption());
                        }}
                        onMouseEnter={() => { if (window.innerWidth > 768) setShowPrivateTooltip(true); }}
                        onMouseLeave={() => setShowPrivateTooltip(false)}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowPrivateTooltip(!showPrivateTooltip());
                            setShowVNetTooltip(false);
                            if (!showPrivateTooltip()) setTimeout(() => setShowPrivateTooltip(false), 3000);
                        }}
                        class={`h-10 px-3 flex items-center gap-2 border rounded-xl text-sm font-bold transition-all ${useEncryption()
                            ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                            : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white'
                            }`}
                    >
                        {useEncryption() ? <ShieldCheck class="w-4 h-4" /> : <ShieldAlert class="w-4 h-4 text-gray-600" />}
                        <span class="hidden md:inline">Private</span>
                    </button>
                    <Show when={showPrivateTooltip()}>
                        <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 z-50 text-xs leading-relaxed">
                            <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1a1a2e] border-l border-t border-white/10 rotate-45" />
                            <p class="font-bold text-blue-400 mb-1.5">End-to-End Encryption</p>
                            <p class="text-gray-300 mb-1.5">
                                Files are encrypted in your browser before uploading. No one — not even Vision Chain — can view your data without your password.
                            </p>
                            <div class="flex items-center gap-1.5 text-red-400/70">
                                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                                <span>If you lose your password, files cannot be recovered</span>
                            </div>
                            <button onClick={() => setShowPrivateTooltip(false)} class="md:hidden absolute top-2 right-2 text-gray-500 hover:text-white">
                                <X class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </Show>
                </div>

                {/* Preserve Original Toggle */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setPreserveOriginal(!preserveOriginal());
                    }}
                    class={`h-10 px-3 flex items-center gap-2 border rounded-xl text-sm font-bold transition-all ${preserveOriginal()
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/[0.04] border-white/[0.08] text-gray-400 hover:text-white'
                        }`}
                    title={preserveOriginal() ? 'Original: files uploaded without optimization' : 'Optimized: images → WebP, videos → MP4'}
                >
                    <svg class={`w-4 h-4 ${preserveOriginal() ? 'text-emerald-400' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <span class="hidden md:inline">Original</span>
                </button>

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

            {/* ── Node Rewards (collapsible) ── */}
            <Show when={nodeId()}>
                <div class="mb-4 shrink-0">
                    <button onClick={() => setShowRewards(!showRewards())} class="w-full flex items-center justify-between bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-2.5 text-left hover:bg-white/[0.04] transition-all">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 100 4h4a2 2 0 110 4H8" /><path d="M12 18V6" /></svg>
                            <span class="text-xs font-black text-white uppercase tracking-widest">Node Rewards</span>
                        </div>
                        <svg class={`w-4 h-4 text-gray-500 transition-transform ${showRewards() ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    <Show when={showRewards()}>
                        <div class="mt-2 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                            <NodeRewardPanel nodeId={nodeId()!} />
                        </div>
                    </Show>
                </div>
            </Show>

            {/* ── Tab Switcher ── */}
            <div class="flex items-center gap-1 mb-4 shrink-0 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
                <button
                    onClick={() => { setDiskTab('myDisk'); setActiveSharedFolder(null); }}
                    class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${diskTab() === 'myDisk' ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <HardDrive class="w-3.5 h-3.5" /> My Disk
                </button>
                <button
                    onClick={() => { setDiskTab('shared'); loadSharedItems(); }}
                    class={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${diskTab() === 'shared' ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <Share2 class="w-3.5 h-3.5" /> Shared
                </button>
            </div>

            {/* ── My Disk Content ── */}
            <Show when={diskTab() === 'myDisk'}>

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
                            {/* Mobile NavBar clearance */}
                            <div class="h-14 lg:hidden" />
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
                                        <div
                                            class={`relative group bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-cyan-500/20 rounded-xl p-4 transition-all ${selectedItems().has(folder.id) ? 'ring-2 ring-cyan-500 bg-cyan-500/5' : ''
                                                }`}
                                        >
                                            {/* Selection Checkbox */}
                                            <div
                                                class={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border transition-all flex items-center justify-center ${selectedItems().has(folder.id)
                                                    ? 'bg-cyan-500 border-cyan-500 text-black'
                                                    : 'bg-black/40 border-white/20 text-transparent'
                                                    } ${isSelectMode() || selectedItems().size > 0 ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSelectMode(true);
                                                    toggleSelection(folder.id);
                                                }}
                                            >
                                                <Check class="w-3.5 h-3.5" />
                                            </div>

                                            <button
                                                onClick={() => isSelectMode() ? toggleSelection(folder.id) : navigateToFolder(folder.path)}
                                                class="w-full flex flex-col items-center gap-2 text-center"
                                            >
                                                <Folder class="w-10 h-10 text-cyan-400/80 group-hover:text-cyan-400 transition-colors" />
                                                <span class="text-xs font-semibold text-gray-300 truncate w-full">{folder.name}</span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setContextMenu({ item: folder, type: 'folder', x: rect.right, y: rect.bottom + 4 });
                                                }}
                                                class="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 text-gray-400 hover:text-white opacity-100 transition-all"
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
                                            class={`group relative bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] hover:border-cyan-500/20 rounded-xl p-4 flex flex-col items-center gap-3 transition-all cursor-pointer ${selectedItems().has(file.id) ? 'ring-2 ring-cyan-500 bg-cyan-500/5' : ''
                                                } ${deletingId() === file.id ? 'opacity-40' : ''}`}
                                            onClick={() => isSelectMode() ? toggleSelection(file.id) : setPreviewFile(file)}
                                        >
                                            {/* Selection Checkbox */}
                                            <div
                                                class={`absolute top-2 left-2 z-10 w-5 h-5 rounded-md border transition-all flex items-center justify-center ${selectedItems().has(file.id)
                                                    ? 'bg-cyan-500 border-cyan-500 text-black'
                                                    : 'bg-black/40 border-white/20 text-transparent'
                                                    } ${isSelectMode() || selectedItems().size > 0 ? 'opacity-100' : 'lg:opacity-0 lg:group-hover:opacity-100'}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSelectMode(true);
                                                    toggleSelection(file.id);
                                                }}
                                            >
                                                <Check class="w-3.5 h-3.5" />
                                            </div>

                                            {/* Thumbnail or Icon */}
                                            <div class="w-full aspect-square rounded-lg bg-white/[0.03] flex items-center justify-center overflow-hidden border border-white/5 relative">
                                                <Show
                                                    when={file.thumbnailURL || file.thumbnail || (file.type.startsWith('image/') && file.downloadURL)}
                                                    fallback={
                                                        <Show
                                                            when={file.type.startsWith('video/')}
                                                            fallback={
                                                                <div class={fileTypeColor(file.type)}>
                                                                    <FileTypeIcon type={file.type} name={file.name} class="w-10 h-10" />
                                                                </div>
                                                            }
                                                        >
                                                            <div class={`${fileTypeColor(file.type)} relative`}>
                                                                <FileTypeIcon type={file.type} name={file.name} class="w-10 h-10" />
                                                                <div class="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                                                                    <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                                                </div>
                                                            </div>
                                                        </Show>
                                                    }
                                                >
                                                    <img
                                                        src={file.thumbnailURL || file.thumbnail || file.downloadURL}
                                                        alt={file.name}
                                                        class="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                    <Show when={file.type.startsWith('video/')}>
                                                        <div class="absolute inset-0 flex items-center justify-center bg-black/30">
                                                            <div class="w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                                                                <svg class="w-3.5 h-3.5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                                                            </div>
                                                        </div>
                                                    </Show>
                                                </Show>

                                                {/* Security & Storage Badges Overlay */}
                                                <div class="absolute bottom-1.5 right-1.5 flex gap-1">
                                                    <Show when={file.isEncrypted}>
                                                        <div class="p-1 rounded bg-black/60 backdrop-blur-md border border-white/10" title="Client-side Encrypted">
                                                            <ShieldCheck class="w-3 h-3 text-cyan-400" />
                                                        </div>
                                                    </Show>
                                                    <Show when={file.storageType === 'distributed'}>
                                                        <div class="px-1 py-0.5 rounded bg-amber-500 text-[8px] font-black text-black uppercase tracking-tighter" title="Stored on Distributed Node Network">
                                                            VNet
                                                        </div>
                                                    </Show>
                                                </div>
                                            </div>

                                            <div class="w-full text-left">
                                                <div class="flex items-center gap-1.5 min-w-0">
                                                    <div class="text-xs font-semibold text-gray-200 truncate">{file.name}</div>
                                                    <Show when={file.isPublished}>
                                                        <div class="shrink-0 w-3.5 h-3.5 bg-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/20" title="Published to Market">
                                                            <Globe class="w-2 h-2 text-black" />
                                                        </div>
                                                    </Show>
                                                </div>
                                                <Show when={file.abstract}>
                                                    <div class="text-[9px] text-gray-400 mt-0.5 line-clamp-2 leading-tight">{file.abstract}</div>
                                                </Show>
                                                <div class="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1">
                                                    {formatFileSize(file.size)} &bull; {new Date(file.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                    {file.optimized && <span class="px-1 py-0.5 rounded bg-green-500/10 text-green-400 text-[8px] font-bold">MP4</span>}
                                                    {file.preserveOriginal && <span class="px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] font-bold">RAW</span>}
                                                </div>
                                            </div>

                                            {/* Context button */}
                                            <div class="absolute top-2 right-2 flex gap-1">
                                                <Show when={decryptingFileId() === file.id}>
                                                    <div class="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 animate-spin">
                                                        <RotateCw class="w-3.5 h-3.5" />
                                                    </div>
                                                </Show>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                        setContextMenu({ item: file, type: 'file', x: rect.right, y: rect.bottom + 4 });
                                                    }}
                                                    class="p-1.5 rounded-lg bg-black/40 text-gray-400 hover:text-white opacity-100 transition-all"
                                                >
                                                    <MoreVertical class="w-3.5 h-3.5" />
                                                </button>
                                            </div>
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
                                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setContextMenu({ item: folder, type: 'folder', x: rect.right, y: rect.bottom + 4 });
                                                }}
                                                class="p-1 rounded-md text-gray-500 hover:text-white opacity-100 transition-all"
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
                                            class={`group grid grid-cols-[1fr_40px] sm:grid-cols-[1fr_100px_120px_40px] gap-2 px-3 sm:px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.04] transition-all items-center cursor-pointer ${selectedItems().has(file.id) ? 'bg-cyan-500/10' : ''
                                                } ${deletingId() === file.id ? 'opacity-40' : ''}`}
                                            onClick={() => isSelectMode() ? toggleSelection(file.id) : setPreviewFile(file)}
                                        >
                                            <div class="flex items-center gap-3 min-w-0">
                                                {/* List Selection Check */}
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsSelectMode(true);
                                                        toggleSelection(file.id);
                                                    }}
                                                    class={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${selectedItems().has(file.id)
                                                        ? 'bg-cyan-500 border-cyan-500 text-black'
                                                        : 'bg-white/5 border-white/10 text-transparent group-hover:border-white/30'
                                                        }`}
                                                >
                                                    <Check class="w-3.5 h-3.5" />
                                                </div>
                                                <div class={`shrink-0 ${fileTypeColor(file.type)}`}>
                                                    <FileTypeIcon type={file.type} name={file.name} />
                                                </div>
                                                <span class="text-sm text-gray-200 truncate">{file.name}</span>
                                                <div class="flex gap-1 shrink-0">
                                                    <Show when={file.isPublished}>
                                                        <span class="px-1.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-black text-cyan-400 uppercase tracking-tighter">Market</span>
                                                    </Show>
                                                    <Show when={file.isEncrypted}>
                                                        <span class="px-1.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/30 text-[9px] font-black text-purple-400 uppercase tracking-tighter">Private</span>
                                                    </Show>
                                                    <Show when={file.storageType === 'distributed'}>
                                                        <span class="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[9px] font-black text-amber-500 uppercase tracking-tighter">VNet</span>
                                                    </Show>
                                                </div>
                                            </div>
                                            <span class="text-xs text-gray-500 hidden sm:block">{formatFileSize(file.size)}</span>
                                            <span class="text-xs text-gray-500 hidden sm:block">{new Date(file.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setContextMenu({ item: file, type: 'file', x: rect.right, y: rect.bottom + 4 });
                                                }}
                                                class="p-1 rounded-md text-gray-500 hover:text-white opacity-100 transition-all active:bg-white/10"
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
                                style={{
                                    left: `${Math.min(ctx().x, window.innerWidth - 180)}px`,
                                    top: `${Math.min(ctx().y, window.innerHeight - 320)}px`,
                                }}
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
                                            <button
                                                onClick={() => { handleDownload(ctx().item as DiskFile); setContextMenu(null); }}
                                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                            >
                                                <Download class="w-4 h-4" /> Download
                                            </button>
                                            <button
                                                onClick={() => handleShare(ctx().item as DiskFile, 'file')}
                                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                            >
                                                <Share2 class="w-4 h-4" /> Share
                                            </button>
                                        </Show>
                                        <Show when={ctx().type === 'folder'}>
                                            <button
                                                onClick={() => { navigateToFolder((ctx().item as DiskFolder).path); setContextMenu(null); }}
                                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                            >
                                                <Folder class="w-4 h-4" /> Open
                                            </button>
                                            <button
                                                onClick={() => handleShare(ctx().item as DiskFolder, 'folder')}
                                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/[0.06] hover:text-white transition-all"
                                            >
                                                <Share2 class="w-4 h-4" /> Share
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

                                        <Show when={ctx().type === 'file'}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const file = ctx().item as DiskFile;
                                                    setPublishingFile(file);
                                                    if (file.isPublished) {
                                                        handleUnpublish();
                                                    } else {
                                                        setShowPublishModal(true);
                                                        setContextMenu(null);
                                                    }
                                                }}
                                                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-cyan-400 hover:bg-cyan-500/10 transition-all font-bold"
                                            >
                                                <Globe class="w-4 h-4" /> {(ctx().item as DiskFile).isPublished ? 'Unpublish' : 'Publish to Market'}
                                            </button>
                                        </Show>

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

            </Show>{/* End My Disk */}

            {/* ── Shared Tab Content ── */}
            <Show when={diskTab() === 'shared'}>
                <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                    <Show when={!activeSharedFolder()}>
                        {/* Shared Header */}
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-sm font-black text-white uppercase tracking-widest">Shared with me</h3>
                            <button
                                onClick={() => setShowCreateSharedFolder(true)}
                                class="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all border border-cyan-500/20"
                            >
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
                                New Shared Folder
                            </button>
                        </div>

                        <Show when={sharedLoading()}>
                            <div class="flex items-center justify-center py-12">
                                <div class="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                            </div>
                        </Show>

                        <Show when={!sharedLoading()}>
                            {/* Shared Folders */}
                            <Show when={sharedFolders().length > 0}>
                                <div class="mb-6">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Shared Folders</div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <For each={sharedFolders()}>
                                            {(folder) => (
                                                <button
                                                    onClick={() => openSharedFolder(folder.id)}
                                                    class="flex items-center gap-3 p-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl hover:bg-white/[0.06] hover:border-cyan-500/20 transition-all text-left group"
                                                >
                                                    <div class="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 group-hover:bg-cyan-500/20 transition-all">
                                                        <Users class="w-5 h-5 text-cyan-400" />
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="text-sm font-bold text-white truncate">{folder.name}</div>
                                                        <div class="text-[10px] text-gray-500">{folder.members.length} members | {folder.fileCount} files</div>
                                                    </div>
                                                    <ChevronRight class="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-colors" />
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            {/* Shared Files */}
                            <Show when={sharedWithMe().length > 0}>
                                <div class="mb-6">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Shared Files</div>
                                    <div class="space-y-2">
                                        <For each={sharedWithMe()}>
                                            {(share) => (
                                                <div class="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:bg-white/[0.05] transition-all">
                                                    <div class="w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center">
                                                        <Show when={share.type === 'file'} fallback={<Folder class="w-4 h-4 text-yellow-400" />}>
                                                            <FileIcon class="w-4 h-4 text-blue-400" />
                                                        </Show>
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="text-sm font-bold text-white truncate">{share.resourceName || share.resourceId}</div>
                                                        <div class="text-[10px] text-gray-500">
                                                            from {share.ownerEmail.split('@')[0]} | {new Date(share.createdAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <Show when={share.resource && share.type === 'file'}>
                                                        <button
                                                            onClick={() => {
                                                                if (share.resource) {
                                                                    setPreviewFile(share.resource as DiskFile);
                                                                }
                                                            }}
                                                            class="p-2 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                                        >
                                                            <Eye class="w-4 h-4" />
                                                        </button>
                                                    </Show>
                                                </div>
                                            )}
                                        </For>
                                    </div>
                                </div>
                            </Show>

                            <Show when={sharedWithMe().length === 0 && sharedFolders().length === 0}>
                                <div class="flex flex-col items-center justify-center py-16 text-center">
                                    <Share2 class="w-12 h-12 text-gray-700 mb-4" />
                                    <div class="text-sm font-bold text-gray-500 mb-1">No shared items</div>
                                    <div class="text-xs text-gray-600">Files and folders shared with you will appear here</div>
                                </div>
                            </Show>
                        </Show>
                    </Show>

                    {/* Active Shared Folder View */}
                    <Show when={activeSharedFolder()}>
                        {/* Folder Header */}
                        <div class="flex items-center justify-between mb-4">
                            <div class="flex items-center gap-2">
                                <button
                                    onClick={() => { setActiveSharedFolder(null); setSharedFolderFiles([]); setSharedFolderMeta(null); setShowMemberPanel(false); }}
                                    class="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                >
                                    <ArrowLeft class="w-4 h-4" />
                                </button>
                                <Users class="w-4 h-4 text-cyan-400" />
                                <span class="text-sm font-bold text-white">{sharedFolderMeta()?.name || 'Shared Folder'}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                {/* Member Management Toggle */}
                                <button
                                    onClick={() => setShowMemberPanel(!showMemberPanel())}
                                    class={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border ${showMemberPanel() ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-white/[0.03] text-gray-400 hover:text-white border-white/[0.06]'}`}
                                >
                                    <Users class="w-3.5 h-3.5" />
                                    {sharedFolderMeta()?.members?.length || 0}
                                </button>
                                {/* Upload Button */}
                                <label class="flex items-center gap-1.5 px-3 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border border-cyan-500/20 cursor-pointer">
                                    <UploadCloud class="w-3.5 h-3.5" />
                                    Upload
                                    <input
                                        type="file"
                                        multiple
                                        class="hidden"
                                        onChange={async (e) => {
                                            const fileList = e.currentTarget.files;
                                            if (!fileList || fileList.length === 0) return;
                                            const fId = activeSharedFolder();
                                            if (!fId) return;
                                            for (let i = 0; i < fileList.length; i++) {
                                                const f = fileList[i];
                                                try {
                                                    setSharedLoading(true);
                                                    await uploadToSharedFolder(fId, f);
                                                } catch (err: any) {
                                                    console.error('[Disk] Shared folder upload error:', err);
                                                    alert(`Failed to upload ${f.name}: ${err.message || 'Unknown error'}`);
                                                }
                                            }
                                            // Reload files
                                            await openSharedFolder(fId);
                                        }}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Member Management Panel */}
                        <Show when={showMemberPanel()}>
                            <div class="mb-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div class="flex items-center justify-between mb-3">
                                    <div class="text-[10px] font-black text-gray-500 uppercase tracking-widest">Members</div>
                                    <Show when={sharedFolderMeta()?.ownerEmail === email()}>
                                        <div class="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={shareSearchQuery()}
                                                onInput={(e) => setShareSearchQuery(e.currentTarget.value)}
                                                placeholder="Add member..."
                                                autocomplete="off"
                                                class="bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/30 w-40"
                                            />
                                        </div>
                                    </Show>
                                </div>

                                {/* Add member search results */}
                                <Show when={shareSearchQuery().length >= 2 && sharedFolderMeta()?.ownerEmail === email()}>
                                    <div class="mb-3 space-y-1">
                                        <For each={contacts().filter((c: any) => {
                                            const q = shareSearchQuery().toLowerCase();
                                            const memberEmails = sharedFolderMeta()?.members?.map((m: any) => m.email) || [];
                                            return (c.internalName?.toLowerCase().includes(q) || c.vchainUserUid?.toLowerCase().includes(q)) && c.vchainUserUid && !memberEmails.includes(c.vchainUserUid);
                                        }).slice(0, 5)}>
                                            {(contact: any) => (
                                                <button
                                                    onClick={async () => {
                                                        const fId = activeSharedFolder();
                                                        if (!fId) return;
                                                        try {
                                                            await manageSharedFolderMember(fId, 'add', contact.vchainUserUid, 'editor');
                                                            setShareSearchQuery('');
                                                            await openSharedFolder(fId);
                                                        } catch (err: any) { alert(err.message || 'Failed to add member'); }
                                                    }}
                                                    class="w-full flex items-center gap-2 p-2 bg-cyan-500/5 hover:bg-cyan-500/10 rounded-lg transition-all text-left text-xs border border-cyan-500/10"
                                                >
                                                    <UserPlus class="w-3.5 h-3.5 text-cyan-400" />
                                                    <span class="text-white font-bold truncate">{contact.internalName}</span>
                                                    <span class="text-gray-500 ml-auto text-[10px]">{contact.vchainUserUid}</span>
                                                </button>
                                            )}
                                        </For>
                                    </div>
                                </Show>

                                {/* Member list */}
                                <div class="space-y-2">
                                    <For each={sharedFolderMeta()?.members || []}>
                                        {(member: any) => (
                                            <div class="flex items-center justify-between p-2 bg-white/[0.02] rounded-xl">
                                                <div class="flex items-center gap-2">
                                                    <div class={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border ${member.role === 'owner' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : member.role === 'editor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                                                        {member.email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div class="text-xs font-bold text-white">{(() => { const c = contacts().find((c: any) => c.vchainUserUid === member.email); return c?.internalName || member.email.split('@')[0]; })()}</div>
                                                        <div class="text-[10px] text-gray-500">{member.role}</div>
                                                    </div>
                                                </div>
                                                <Show when={member.role !== 'owner' && sharedFolderMeta()?.ownerEmail === email()}>
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm(`Remove ${member.email}?`)) return;
                                                            const fId = activeSharedFolder();
                                                            if (!fId) return;
                                                            try {
                                                                await manageSharedFolderMember(fId, 'remove', member.email);
                                                                await openSharedFolder(fId);
                                                            } catch (err: any) { alert(err.message || 'Failed'); }
                                                        }}
                                                        class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                    >
                                                        <UserMinus class="w-3.5 h-3.5" />
                                                    </button>
                                                </Show>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </div>
                        </Show>

                        <Show when={sharedLoading()}>
                            <div class="flex items-center justify-center py-12">
                                <div class="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
                            </div>
                        </Show>

                        <Show when={!sharedLoading()}>
                            <Show when={sharedFolderFiles().length > 0}>
                                <div class="space-y-2">
                                    <For each={sharedFolderFiles()}>
                                        {(file) => (
                                            <div class="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.08] rounded-xl hover:bg-white/[0.05] transition-all group">
                                                <div class={`w-9 h-9 rounded-lg bg-white/[0.05] flex items-center justify-center ${fileTypeColor(file.type)}`}>
                                                    <FileTypeIcon type={file.type} name={file.name} class="w-4 h-4" />
                                                </div>
                                                <div class="flex-1 min-w-0">
                                                    <div class="text-sm font-bold text-white truncate">{file.name}</div>
                                                    <div class="text-[10px] text-gray-500">
                                                        {formatFileSize(file.size)} | by {(file as any).uploadedBy?.split('@')[0] || 'unknown'} | {new Date(file.createdAt).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setPreviewFile(file)}
                                                        class="p-2 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                                        title="Preview"
                                                    >
                                                        <Eye class="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDownload(file)}
                                                        class="p-2 text-gray-500 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                                        title="Download"
                                                    >
                                                        <Download class="w-4 h-4" />
                                                    </button>
                                                    <Show when={sharedFolderMeta()?.ownerEmail === email() || (file as any).uploadedBy === email()}>
                                                        <button
                                                            onClick={async () => {
                                                                if (!confirm(`Delete ${file.name}?`)) return;
                                                                const fId = activeSharedFolder();
                                                                if (!fId) return;
                                                                try {
                                                                    await deleteSharedFolderFile(fId, file.id);
                                                                    await openSharedFolder(fId);
                                                                } catch (err: any) { alert(err.message || 'Failed'); }
                                                            }}
                                                            class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                            title="Delete"
                                                        >
                                                            <Trash2 class="w-4 h-4" />
                                                        </button>
                                                    </Show>
                                                </div>
                                            </div>
                                        )}
                                    </For>
                                </div>
                            </Show>
                            <Show when={sharedFolderFiles().length === 0}>
                                <div class="flex flex-col items-center justify-center py-16 text-center">
                                    <div class="w-16 h-16 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 flex items-center justify-center mb-4">
                                        <UploadCloud class="w-8 h-8 text-cyan-400/40" />
                                    </div>
                                    <div class="text-sm font-bold text-gray-500 mb-1">No files yet</div>
                                    <div class="text-xs text-gray-600 mb-4">Upload files to start collaborating</div>
                                    <label class="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all cursor-pointer">
                                        <UploadCloud class="w-4 h-4" /> Upload Files
                                        <input
                                            type="file"
                                            multiple
                                            class="hidden"
                                            onChange={async (e) => {
                                                const fileList = e.currentTarget.files;
                                                if (!fileList || fileList.length === 0) return;
                                                const fId = activeSharedFolder();
                                                if (!fId) return;
                                                for (let i = 0; i < fileList.length; i++) {
                                                    try {
                                                        setSharedLoading(true);
                                                        await uploadToSharedFolder(fId, fileList[i]);
                                                    } catch (err: any) {
                                                        alert(`Failed: ${err.message || 'Unknown error'}`);
                                                    }
                                                }
                                                await openSharedFolder(fId);
                                            }}
                                        />
                                    </label>
                                </div>
                            </Show>
                        </Show>
                    </Show>
                </div>
            </Show>

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
                                        <button
                                            onClick={() => handleDownload(file())}
                                            class="p-2 text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
                                            title="Download"
                                        >
                                            <Download class="w-4 h-4" />
                                        </button>
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
                                <div class="flex-1 overflow-auto flex flex-col p-6 min-h-[300px]">
                                    <div class="flex-1 flex items-center justify-center min-h-0">
                                        <Show when={previewLoading()}>
                                            <div class="text-center w-full max-w-xs">
                                                <div class="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                                                <div class="text-sm text-gray-400 font-medium mb-2">
                                                    {previewProgress() ? `Gathering Chunks (${previewProgress()?.current}/${previewProgress()?.total})` : 'Fetching & Decrypting...'}
                                                </div>
                                                <Show when={previewProgress()}>
                                                    <div class="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            class="h-full bg-cyan-500 transition-all duration-300"
                                                            style={{ width: `${(previewProgress()!.current / previewProgress()!.total) * 100}%` }}
                                                        />
                                                    </div>
                                                </Show>
                                            </div>
                                        </Show>
                                        <Show when={!previewLoading()}>
                                            <Show when={file().type.startsWith('image/')}>
                                                <img src={previewURL()} alt={file().name} class="max-w-full max-h-full object-contain rounded-lg" />
                                            </Show>
                                            <Show when={file().type.startsWith('video/')}>
                                                {/* Video Streaming Player */}
                                                <div class="w-full max-w-2xl relative">
                                                    {/* Phase 1: Buffering - downloading chunks */}
                                                    <Show when={videoBuffering() && !videoBufferReady()}>
                                                        <div class="w-full aspect-video bg-black/60 rounded-xl flex flex-col items-center justify-center border border-white/10">
                                                            <div class="relative mb-5">
                                                                <svg class="w-16 h-16 text-cyan-500/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                                    <polygon points="5 3 19 12 5 21 5 3" />
                                                                </svg>
                                                                <div class="absolute inset-0 flex items-center justify-center">
                                                                    <div class="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
                                                                </div>
                                                            </div>
                                                            <div class="text-sm font-bold text-white mb-1">Buffering...</div>
                                                            <Show when={videoStreamProgress()}>
                                                                <div class="text-xs text-gray-400 mb-3">
                                                                    Chunks {videoStreamProgress()!.current}/{videoStreamProgress()!.total}
                                                                    <span class="mx-1.5 text-gray-600">|</span>
                                                                    {formatFileSize(videoStreamProgress()!.bytesLoaded)} loaded
                                                                </div>
                                                                <div class="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
                                                                    <div
                                                                        class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                                                                        style={{ width: `${(videoStreamProgress()!.current / videoStreamProgress()!.total) * 100}%` }}
                                                                    />
                                                                </div>
                                                            </Show>
                                                            <Show when={file().size > 100 * 1024 * 1024}>
                                                                <div class="text-[10px] text-amber-400/70 mt-3 flex items-center gap-1">
                                                                    <AlertTriangle class="w-3 h-3" />
                                                                    Large file ({formatFileSize(file().size)}) - buffering may take longer
                                                                </div>
                                                            </Show>
                                                        </div>
                                                    </Show>
                                                    {/* Phase 2: Buffer ready - show play button */}
                                                    <Show when={videoBufferReady() && !videoFullyLoaded() && previewURL()}>
                                                        {(() => {
                                                            const [userPlaying, setUserPlaying] = createSignal(false);
                                                            let videoRef: HTMLVideoElement | undefined;
                                                            return (
                                                                <div class="relative">
                                                                    <video
                                                                        ref={videoRef}
                                                                        src={previewURL()}
                                                                        controls={userPlaying()}
                                                                        playsinline
                                                                        webkit-playsinline
                                                                        class="max-w-full max-h-full rounded-lg"
                                                                        style={{ filter: userPlaying() ? 'none' : 'brightness(0.4)' }}
                                                                    />
                                                                    {/* Play button overlay */}
                                                                    <Show when={!userPlaying()}>
                                                                        <div
                                                                            class="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group"
                                                                            onClick={() => {
                                                                                setUserPlaying(true);
                                                                                videoRef?.play();
                                                                            }}
                                                                        >
                                                                            <div class="w-20 h-20 rounded-full bg-cyan-500/90 flex items-center justify-center mb-4 group-hover:bg-cyan-400 group-hover:scale-110 transition-all shadow-lg shadow-cyan-500/30">
                                                                                <svg class="w-9 h-9 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                                                                                    <polygon points="5 3 19 12 5 21 5 3" />
                                                                                </svg>
                                                                            </div>
                                                                            <div class="text-sm font-bold text-white">Ready to Play</div>
                                                                            <div class="text-xs text-gray-400 mt-1">
                                                                                {formatFileSize(videoStreamProgress()?.bytesLoaded || 0)} buffered
                                                                            </div>
                                                                        </div>
                                                                    </Show>
                                                                    {/* Background download progress */}
                                                                    <Show when={videoStreamProgress()}>
                                                                        <div class="absolute bottom-12 left-0 right-0 px-3">
                                                                            <div class="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                                                                                <div class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                                                                <span class="text-[10px] text-gray-300 font-medium">
                                                                                    Downloading... {videoStreamProgress()!.current}/{videoStreamProgress()!.total} ({formatFileSize(videoStreamProgress()!.bytesLoaded)})
                                                                                </span>
                                                                                <div class="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                                                                                    <div
                                                                                        class="h-full bg-cyan-500 rounded-full transition-all duration-300"
                                                                                        style={{ width: `${(videoStreamProgress()!.current / videoStreamProgress()!.total) * 100}%` }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </Show>
                                                                </div>
                                                            );
                                                        })()}
                                                    </Show>
                                                    {/* Phase 3: Fully loaded - normal video player */}
                                                    <Show when={videoFullyLoaded() && previewURL()}>
                                                        <video
                                                            src={previewURL()}
                                                            controls
                                                            playsinline
                                                            webkit-playsinline
                                                            class="max-w-full max-h-full rounded-lg"
                                                        />
                                                    </Show>
                                                    {/* Phase 4: All streaming failed - show download fallback */}
                                                    <Show when={!videoBuffering() && !videoBufferReady() && !videoFullyLoaded() && !previewURL()}>
                                                        <div class="w-full aspect-video bg-black/40 rounded-xl flex flex-col items-center justify-center border border-white/10">
                                                            <svg class="w-12 h-12 text-gray-500 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                                                <polygon points="5 3 19 12 5 21 5 3" />
                                                            </svg>
                                                            <div class="text-sm text-gray-400 mb-3">Streaming unavailable</div>
                                                            <button
                                                                onClick={() => handleDownload(file())}
                                                                class="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition border border-cyan-500/20"
                                                            >
                                                                Download to play
                                                            </button>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </Show>
                                            <Show when={file().type.startsWith('audio/')}>
                                                <div class="w-full max-w-md">
                                                    <div class="w-20 h-20 rounded-2xl bg-white/[0.05] flex items-center justify-center mx-auto mb-4 border border-white/10">
                                                        <FileAudio class="w-10 h-10 text-amber-400" />
                                                    </div>
                                                    <audio src={previewURL()} controls class="w-full" />
                                                </div>
                                            </Show>
                                            <Show when={file().type.includes('pdf')}>
                                                <div class="w-full flex flex-col items-center gap-4">
                                                    <Show when={pdfRendering()}>
                                                        <div class="text-center py-8">
                                                            <div class="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-3" />
                                                            <div class="text-sm text-gray-400">PDF 렌더링 중...</div>
                                                        </div>
                                                    </Show>
                                                    <Show when={pdfPages().length > 0}>
                                                        {/* PDF Toolbar */}
                                                        <div class="w-full flex items-center justify-between bg-[#0e0e16] border border-white/10 rounded-xl px-4 py-2">
                                                            <div class="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setPdfCurrentPage(Math.max(1, pdfCurrentPage() - 1))}
                                                                    disabled={pdfCurrentPage() <= 1}
                                                                    class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg>
                                                                </button>
                                                                <span class="text-sm text-gray-300 font-medium min-w-[80px] text-center">
                                                                    {pdfCurrentPage()} / {pdfTotalPages()}
                                                                </span>
                                                                <button
                                                                    onClick={() => setPdfCurrentPage(Math.min(pdfTotalPages(), pdfCurrentPage() + 1))}
                                                                    disabled={pdfCurrentPage() >= pdfTotalPages()}
                                                                    class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6" /></svg>
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDownload(file())}
                                                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-white/10"
                                                            >
                                                                <Download class="w-3.5 h-3.5" /> Download
                                                            </button>
                                                        </div>
                                                        {/* PDF Page */}
                                                        <div class="w-full overflow-auto rounded-lg border border-white/10 bg-[#2a2a2a]" style={{ 'max-height': '65vh' }}>
                                                            <img
                                                                src={pdfPages()[pdfCurrentPage() - 1]}
                                                                alt={`Page ${pdfCurrentPage()}`}
                                                                class="w-full"
                                                                style={{ 'image-rendering': 'auto' }}
                                                            />
                                                        </div>
                                                    </Show>
                                                    <Show when={!pdfRendering() && pdfPages().length === 0 && !previewLoading()}>
                                                        <div class="text-center py-12">
                                                            <svg class="w-16 h-16 text-red-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                                            <div class="text-sm text-gray-400 mb-4">PDF를 불러올 수 없습니다.</div>
                                                            <button
                                                                onClick={() => handleDownload(file())}
                                                                class="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all"
                                                            >
                                                                <Download class="w-4 h-4" /> PDF 다운로드
                                                            </button>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </Show>
                                            {/* PPTX Preview */}
                                            <Show when={(() => { const f = file(); const types = ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint']; return types.includes(f.type) || f.name.toLowerCase().endsWith('.pptx') || f.name.toLowerCase().endsWith('.ppt'); })()}>
                                                <div class="w-full flex flex-col gap-3">
                                                    <Show when={pptxRendering()}>
                                                        <div class="text-center py-8">
                                                            <div class="w-10 h-10 border-3 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
                                                            <div class="text-sm text-gray-400">슬라이드 렌더링 중...</div>
                                                        </div>
                                                    </Show>
                                                    <Show when={pptxSlides().length > 0}>
                                                        {/* PPTX Toolbar */}
                                                        <div class="w-full flex items-center justify-between bg-[#0e0e16] border border-white/10 rounded-xl px-4 py-2">
                                                            <div class="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setPptxCurrentSlide(Math.max(1, pptxCurrentSlide() - 1))}
                                                                    disabled={pptxCurrentSlide() <= 1}
                                                                    class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6" /></svg>
                                                                </button>
                                                                <span class="text-sm text-gray-300 font-medium min-w-[100px] text-center">
                                                                    Slide {pptxCurrentSlide()} / {pptxTotalSlides()}
                                                                </span>
                                                                <button
                                                                    onClick={() => setPptxCurrentSlide(Math.min(pptxTotalSlides(), pptxCurrentSlide() + 1))}
                                                                    disabled={pptxCurrentSlide() >= pptxTotalSlides()}
                                                                    class="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                                                >
                                                                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6" /></svg>
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDownload(file())}
                                                                class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-all border border-white/10"
                                                            >
                                                                <Download class="w-3.5 h-3.5" /> Download
                                                            </button>
                                                        </div>
                                                        {/* PPTX Slide */}
                                                        <div
                                                            class="w-full rounded-lg border border-white/10 overflow-hidden"
                                                            style={{ 'aspect-ratio': '16/9', 'max-height': '65vh' }}
                                                            innerHTML={pptxSlides()[pptxCurrentSlide() - 1]?.html || ''}
                                                        />
                                                        {/* Slide thumbnails */}
                                                        <div class="flex gap-2 overflow-x-auto py-2 px-1 custom-scrollbar">
                                                            {pptxSlides().map((slide, i) => (
                                                                <button
                                                                    onClick={() => setPptxCurrentSlide(i + 1)}
                                                                    class={`flex-shrink-0 w-20 h-12 rounded-lg border-2 overflow-hidden transition-all ${pptxCurrentSlide() === i + 1 ? 'border-cyan-500 ring-1 ring-cyan-500/30' : 'border-white/10 hover:border-white/30'}`}
                                                                >
                                                                    <div class="w-full h-full bg-[#1e1e2e] flex items-center justify-center text-[8px] text-gray-500 font-bold">
                                                                        {i + 1}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </Show>
                                                    <Show when={!pptxRendering() && pptxSlides().length === 0 && !previewLoading()}>
                                                        <div class="text-center py-12">
                                                            <svg class="w-16 h-16 text-orange-400 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                                            <div class="text-sm text-gray-400 mb-4">슬라이드를 불러올 수 없습니다.</div>
                                                            <button
                                                                onClick={() => handleDownload(file())}
                                                                class="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all"
                                                            >
                                                                <Download class="w-4 h-4" /> 다운로드
                                                            </button>
                                                        </div>
                                                    </Show>
                                                </div>
                                            </Show>
                                            <Show when={(() => { const f = file(); const pptxTypes = ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint']; const isPptx = pptxTypes.includes(f.type) || f.name.toLowerCase().endsWith('.pptx') || f.name.toLowerCase().endsWith('.ppt'); return !f.type.startsWith('image/') && !f.type.startsWith('video/') && !f.type.startsWith('audio/') && !f.type.includes('pdf') && !isPptx; })()}>
                                                <div class="text-center">
                                                    <div class={`${fileTypeColor(file().type)} mx-auto mb-3`}>
                                                        <FileTypeIcon type={file().type} name={file().name} class="w-16 h-16" />
                                                    </div>
                                                    <div class="text-sm text-gray-400 mb-4">Preview not available for this file type</div>
                                                    <button
                                                        onClick={() => handleDownload(file())}
                                                        class="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl text-sm transition-all"
                                                    >
                                                        <Download class="w-4 h-4" /> Download File
                                                    </button>
                                                </div>
                                            </Show>
                                        </Show>
                                    </div>

                                    {/* AI Abstract Section */}
                                    <Show when={file().abstract}>
                                        <div class="mt-6 pt-6 border-t border-white/[0.06]">
                                            <div class="flex items-center gap-2 mb-3">
                                                <div class="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                                    <svg class="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                                                </div>
                                                <span class="text-[11px] font-black text-purple-400 uppercase tracking-widest italic">AI Abstract</span>
                                            </div>
                                            <div class="bg-purple-500/[0.03] border border-purple-500/10 rounded-xl p-4">
                                                <p class="text-sm text-gray-300 leading-relaxed font-serif">"{file().abstract}"</p>
                                            </div>
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

            {/* ── Publish Modal ── */}
            <Presence>
                <Show when={showPublishModal()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setShowPublishModal(false)}
                    >
                        <Motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            class="bg-[#12121a] border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div class="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />

                            <div class="text-center mb-6">
                                <div class="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/20">
                                    <Globe class="w-8 h-8 text-cyan-400" />
                                </div>
                                <h3 class="text-xl font-black text-white italic uppercase tracking-tight">Publish to Market</h3>
                                <p class="text-xs text-gray-500 mt-1">Set a price in VCN for others to purchase access.</p>
                            </div>

                            <div class="space-y-4 mb-8">
                                <div class="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-2">Sale Price (VCN)</div>
                                    <div class="flex items-center gap-3">
                                        <input
                                            type="number"
                                            value={publishPrice()}
                                            onInput={(e) => setPublishPrice(e.currentTarget.value)}
                                            class="flex-1 bg-transparent text-2xl font-black text-white outline-none"
                                            placeholder="0.00"
                                            min="0"
                                        />
                                        <span class="text-sm font-bold text-cyan-400">VCN</span>
                                    </div>
                                </div>

                                <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                                    <div class="flex gap-3">
                                        <Share2 class="w-5 h-5 text-amber-400 shrink-0" />
                                        <div class="text-[11px] text-amber-200/70 leading-relaxed">
                                            Vision Chain takes a <span class="text-amber-400 font-bold">30% commission</span> on all sales. You will receive <span class="text-cyan-400 font-bold">{(parseFloat(publishPrice() || '0') * 0.7).toFixed(2)} VCN</span> per sale.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="flex gap-3">
                                <button
                                    onClick={() => setShowPublishModal(false)}
                                    class="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-white font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePublish}
                                    disabled={publishLoading()}
                                    class="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-tighter rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {publishLoading() ? (
                                        <div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    ) : 'Publish Now'}
                                </button>
                            </div>
                        </Motion.div>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── Share Modal ── */}
            <Presence>
                <Show when={showShareModal() && shareTarget()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <Motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            class="bg-[#1a1a24] border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl"
                        >
                            <div class="flex flex-col items-center text-center mb-6">
                                <div class="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4 border border-blue-500/20">
                                    <Share2 class="w-8 h-8 text-blue-400" />
                                </div>
                                <h1 class="text-xl font-black text-white mb-1 uppercase tracking-tight">Share {shareTarget()!.type}</h1>
                                <p class="text-xs text-gray-500 truncate max-w-[250px]">{shareTarget()!.item.name}</p>
                            </div>

                            <div class="space-y-3 mb-6">
                                <div class="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Search contacts by name</div>
                                    <input
                                        type="text"
                                        value={shareSearchQuery()}
                                        onInput={(e) => setShareSearchQuery(e.currentTarget.value)}
                                        placeholder="Enter name or email..."
                                        autocomplete="off"
                                        class="bg-transparent border-none text-white text-sm font-bold placeholder-gray-700 focus:outline-none w-full"
                                    />
                                </div>

                                {/* Found contacts */}
                                <Show when={shareSearchQuery().length >= 2}>
                                    <div class="max-h-[200px] overflow-y-auto space-y-1 custom-scrollbar">
                                        <For each={contacts().filter((c: any) => {
                                            const q = shareSearchQuery().toLowerCase();
                                            return (c.internalName?.toLowerCase().includes(q) || c.vchainUserUid?.toLowerCase().includes(q)) && c.vchainUserUid;
                                        }).slice(0, 10)}>
                                            {(contact: any) => (
                                                <button
                                                    onClick={() => executeShare(contact.vchainUserUid)}
                                                    disabled={sharingInProgress()}
                                                    class="w-full flex items-center gap-3 p-3 bg-white/[0.02] hover:bg-white/[0.06] rounded-xl transition-all text-left"
                                                >
                                                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-black text-xs border border-blue-500/20">
                                                        {contact.internalName?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <div class="flex-1 min-w-0">
                                                        <div class="text-sm font-bold text-white truncate">{contact.internalName}</div>
                                                        <div class="text-[10px] text-gray-500 truncate">{contact.vchainUserUid}</div>
                                                    </div>
                                                    <Share2 class="w-4 h-4 text-gray-500" />
                                                </button>
                                            )}
                                        </For>
                                        <Show when={contacts().filter((c: any) => {
                                            const q = shareSearchQuery().toLowerCase();
                                            return (c.internalName?.toLowerCase().includes(q) || c.vchainUserUid?.toLowerCase().includes(q)) && c.vchainUserUid;
                                        }).length === 0}>
                                            <div class="text-center py-4 text-xs text-gray-600">No contacts found</div>
                                        </Show>
                                    </div>
                                </Show>
                            </div>

                            <Show when={sharingInProgress()}>
                                <div class="flex items-center justify-center gap-2 py-3 text-sm text-blue-400">
                                    <div class="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                                    Sharing...
                                </div>
                            </Show>

                            <button
                                onClick={() => { setShowShareModal(false); setShareTarget(null); }}
                                class="w-full h-12 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-black uppercase tracking-tight transition-all"
                            >
                                Cancel
                            </button>
                        </Motion.div>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── Create Shared Folder Modal ── */}
            <Presence>
                <Show when={showCreateSharedFolder()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <Motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            class="bg-[#1a1a24] border border-white/10 rounded-[32px] p-8 max-w-md w-full shadow-2xl"
                        >
                            <div class="flex flex-col items-center text-center mb-6">
                                <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-4 border border-cyan-500/20">
                                    <Users class="w-8 h-8 text-cyan-400" />
                                </div>
                                <h1 class="text-xl font-black text-white mb-1 uppercase tracking-tight">New Shared Folder</h1>
                                <p class="text-xs text-gray-500">Create a collaborative folder with team members</p>
                            </div>

                            <div class="space-y-4 mb-6">
                                <div class="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Folder Name</div>
                                    <input
                                        type="text"
                                        value={newSharedFolderName()}
                                        onInput={(e) => setNewSharedFolderName(e.currentTarget.value)}
                                        placeholder="e.g. Team Documents"
                                        class="bg-transparent border-none text-white text-sm font-bold placeholder-gray-700 focus:outline-none w-full"
                                    />
                                </div>

                                <div>
                                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-2">Add Members</div>
                                    <div class="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3">
                                        <input
                                            type="text"
                                            value={shareSearchQuery()}
                                            onInput={(e) => setShareSearchQuery(e.currentTarget.value)}
                                            placeholder="Search contacts..."
                                            autocomplete="off"
                                            class="bg-transparent border-none text-white text-sm font-bold placeholder-gray-700 focus:outline-none w-full"
                                        />
                                    </div>
                                    <Show when={shareSearchQuery().length >= 2}>
                                        <div class="mt-2 max-h-[120px] overflow-y-auto space-y-1 custom-scrollbar">
                                            <For each={contacts().filter((c: any) => {
                                                const q = shareSearchQuery().toLowerCase();
                                                return (c.internalName?.toLowerCase().includes(q) || c.vchainUserUid?.toLowerCase().includes(q)) && c.vchainUserUid && !newSharedFolderMembers().includes(c.vchainUserUid);
                                            }).slice(0, 5)}>
                                                {(contact: any) => (
                                                    <button
                                                        onClick={() => { setNewSharedFolderMembers(p => [...p, contact.vchainUserUid]); setShareSearchQuery(''); }}
                                                        class="w-full flex items-center gap-2 p-2 bg-white/[0.02] hover:bg-white/[0.06] rounded-lg transition-all text-left text-xs"
                                                    >
                                                        <div class="w-6 h-6 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400 font-black text-[10px]">
                                                            {contact.internalName?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <span class="text-white font-bold truncate">{contact.internalName}</span>
                                                        <span class="text-gray-500 truncate ml-auto">{contact.vchainUserUid}</span>
                                                    </button>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                    {/* Selected members */}
                                    <Show when={newSharedFolderMembers().length > 0}>
                                        <div class="flex flex-wrap gap-2 mt-3">
                                            <For each={newSharedFolderMembers()}>
                                                {(memberEmail) => (
                                                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-full text-[10px] font-bold border border-cyan-500/20">
                                                        {(() => { const c = contacts().find((c: any) => c.vchainUserUid === memberEmail); return c?.internalName || memberEmail.split('@')[0]; })()}
                                                        <button onClick={() => setNewSharedFolderMembers(p => p.filter(e => e !== memberEmail))} class="hover:text-white transition-colors">
                                                            <X class="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </div>

                            <div class="flex gap-3">
                                <button
                                    onClick={() => { setShowCreateSharedFolder(false); setNewSharedFolderName(''); setNewSharedFolderMembers([]); setShareSearchQuery(''); }}
                                    class="flex-1 h-12 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-black uppercase tracking-tight transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateSharedFolder}
                                    disabled={!newSharedFolderName().trim()}
                                    class="flex-1 h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-black uppercase tracking-tight shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-30"
                                >
                                    Create
                                </button>
                            </div>
                        </Motion.div>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── Encryption Password Modal ── */}
            <Presence>
                <Show when={showPasswordModal()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <Motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            class="bg-[#1a1a24] border border-white/10 rounded-[32px] p-8 max-w-sm w-full shadow-2xl"
                        >
                            <div class="flex flex-col items-center text-center mb-8">
                                <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20">
                                    <Lock class="w-8 h-8 text-cyan-400" />
                                </div>
                                <h1 class="text-2xl font-black text-white mb-2 uppercase tracking-tight">Encryption Key</h1>
                                <p class="text-sm text-gray-500 leading-relaxed font-medium">This password is required to encrypt your private files. <b>Vision Chain does not store this key.</b></p>
                            </div>

                            <div class="space-y-4 mb-8">
                                <div class="bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
                                    <div class="text-[10px] font-bold text-gray-500 uppercase mb-1">Passphrase</div>
                                    <input
                                        type="password"
                                        value={encryptionPassword()}
                                        onInput={(e) => setEncryptionPassword(e.currentTarget.value)}
                                        placeholder="Min. 4 characters"
                                        class="bg-transparent border-none text-white text-lg font-black placeholder-gray-700 focus:outline-none w-full"
                                    />
                                </div>
                            </div>

                            <div class="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowPasswordModal(false);
                                        setUseEncryption(false);
                                    }}
                                    class="flex-1 h-14 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-black uppercase tracking-tight transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (encryptionPassword().length < 4) {
                                            alert('Password must be at least 4 characters.');
                                            return;
                                        }
                                        setShowPasswordModal(false);
                                        setUseEncryption(true);
                                        // Auto-resume preview with pending file
                                        const pendingPreview = pendingPreviewFile();
                                        if (pendingPreview) {
                                            setPendingPreviewFile(null);
                                            setPreviewFile(pendingPreview);
                                        }
                                        // Auto-resume upload with pending files
                                        const files = pendingFiles();
                                        if (files && files.length > 0) {
                                            setPendingFiles(null);
                                            handleFiles(files);
                                        }
                                    }}
                                    class="flex-1 h-14 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-black uppercase tracking-tight shadow-lg shadow-cyan-500/20 transition-all"
                                >
                                    Enable Encryption
                                </button>
                            </div>
                        </Motion.div>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── Move Modal ── */}
            <Presence>
                <Show when={showMoveModal()}>
                    <Motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        class="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowMoveModal(false)}
                    >
                        <Motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            class="bg-[#1a1a24] border border-white/10 rounded-[32px] p-8 max-w-sm w-full shadow-2xl overflow-hidden flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div class="flex flex-col items-center text-center mb-8">
                                <div class="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 border border-cyan-500/20">
                                    <FolderPlus class="w-8 h-8 text-cyan-400" />
                                </div>
                                <h1 class="text-2xl font-black text-white mb-2 uppercase tracking-tight text-gradient bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">Move to...</h1>
                                <p class="text-xs text-gray-500 font-bold tracking-widest uppercase">Select destination folder</p>
                            </div>

                            <div class="space-y-2 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar flex-1">
                                <button
                                    onClick={() => handleMoveConfirm('/')}
                                    class="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/[0.03] hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all text-left group"
                                >
                                    <HardDrive class="w-5 h-5 text-cyan-500" />
                                    <span class="text-sm font-black text-white group-hover:text-cyan-400 transition-colors italic uppercase">My Disk (Root)</span>
                                </button>

                                <For each={allFolders().filter(f => !selectedItems().has(f.id))}>
                                    {(folder) => (
                                        <button
                                            onClick={() => handleMoveConfirm(folder.path)}
                                            class="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-white/[0.03] hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 transition-all text-left group"
                                        >
                                            <Folder class="w-5 h-5 text-gray-500 group-hover:text-cyan-400" />
                                            <span class="text-sm font-bold text-gray-300 group-hover:text-white transition-colors truncate">{folder.path}</span>
                                        </button>
                                    )}
                                </For>
                            </div>

                            <button
                                onClick={() => setShowMoveModal(false)}
                                class="w-full h-14 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5"
                            >
                                Cancel Move
                            </button>
                        </Motion.div>
                    </Motion.div>
                </Show>
            </Presence>

            {/* ── Batch Action Bar ── */}
            <Presence>
                <Show when={selectedItems().size > 0}>
                    <Motion.div
                        initial={{ y: 100, x: '-50%', opacity: 0 }}
                        animate={{ y: 0, x: '-50%', opacity: 1 }}
                        exit={{ y: 100, x: '-50%', opacity: 0 }}
                        class="fixed bottom-24 lg:bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-[#1a1a24] border border-white/10 rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6 backdrop-blur-xl"
                    >
                        <div class="flex items-center gap-3 pr-6 border-r border-white/10">
                            <div class="w-8 h-8 rounded-lg bg-cyan-500 text-black flex items-center justify-center font-black text-sm">
                                {selectedItems().size}
                            </div>
                            <div class="text-xs font-bold text-white uppercase tracking-wider">Selected</div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button
                                onClick={handleBatchDelete}
                                class="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all text-sm font-bold"
                            >
                                <Trash2 class="w-4 h-4" /> Delete
                            </button>
                            <button
                                onClick={handleBatchMove}
                                class="flex items-center gap-2 px-4 py-2 text-gray-300 hover:bg-white/5 rounded-xl transition-all text-sm font-bold"
                            >
                                <FolderPlus class="w-4 h-4" /> Move
                            </button>
                            <button
                                onClick={clearSelection}
                                class="flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-white rounded-xl transition-all text-sm font-bold"
                            >
                                <X class="w-4 h-4" /> Cancel
                            </button>
                        </div>
                    </Motion.div>
                </Show>
            </Presence>
        </div >
    );
};

export default WalletDisk;
