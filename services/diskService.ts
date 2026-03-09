/**
 * Vision Disk - Decentralized Storage Service
 * Handles file upload, metadata management, and storage tracking
 * via Vision Node distributed network (Cloud Function gateway + Firestore metadata).
 *
 * Upload flow:
 *   Browser -> diskUpload Cloud Function -> chunks file -> stages in Firestore
 *   -> Vision Nodes pull chunks during heartbeat -> chunks replicated across network
 *
 * Download flow:
 *   Browser -> diskDownload Cloud Function -> retrieves chunks (staging or nodes)
 *   -> reassembles -> returns to browser
 */
import { getFirebaseDb, getFirebaseApp } from './firebaseService';
import { collection, doc, setDoc, getDocs, deleteDoc, query, where, orderBy, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref, uploadBytesResumable } from 'firebase/storage';

// ─── Types ───

export interface DiskFile {
    id: string;
    name: string;
    size: number;           // bytes
    type: string;           // MIME type
    folder: string;         // virtual folder path, e.g. '/' or '/photos'
    downloadURL: string;
    storagePath: string;    // full Firebase Storage path
    createdAt: string;
    updatedAt: string;
    thumbnail?: string;
    // Publishing metadata
    isPublished?: boolean;
    priceVcn?: number;
    publishedAt?: string;
    publisherEmail?: string;
    purchaseCount?: number;
    // Security
    isEncrypted?: boolean;
    salt?: string;
    iv?: string;
    // Storage Provider
    storageType?: 'cloud' | 'distributed';
    // Distributed storage fields
    cid?: string;
    fileKey?: string;
    merkleRoot?: string;
    chunkCount?: number;
    chunkHashes?: string[];
    replicationStatus?: 'staging' | 'partial' | 'replicated';
    targetReplicas?: number;
    currentReplicas?: number;
    // AI-generated abstract for documents
    abstract?: string;
    // Server-generated thumbnail URL (Firebase Storage signed URL)
    thumbnailURL?: string;
    // Media optimization metadata
    optimized?: boolean;
    preserveOriginal?: boolean;
    originalType?: string;
    originalSize?: number;
    originalExtension?: string;
    // ─── AI Storage Extensions (Phase 1) ───
    language?: string;              // ISO 639-1 (e.g. 'ko', 'en')
    tags?: string[];                // User or auto-generated tags
    sourceType?: 'document' | 'image' | 'audio' | 'video' | 'chat_log' | 'code' | 'data' | 'other';
    parsedTextUri?: string;         // URI to extracted plain text
    transcriptUri?: string;         // URI to audio/video transcript
    version?: number;
    parentVersionId?: string;
    contentHash?: string;           // SHA-256 of raw content
    indexingStatus?: 'none' | 'queued' | 'processing' | 'indexed' | 'error';
    memoryEligibility?: boolean;
    modelCompatibility?: 'openai' | 'gemini' | 'both';
    indexedAt?: string;
    lastRetrievedAt?: string;
}

export interface DiskFolder {
    id: string;
    name: string;
    path: string;           // e.g. '/photos'
    parentPath: string;     // e.g. '/'
    createdAt: string;
    fileCount?: number;
}

export interface DiskUsage {
    totalBytes: number;
    fileCount: number;
    limitBytes: number;     // 50 GB default or based on subscription
    status: 'active' | 'grace_period' | 'overdue' | 'canceled' | 'expired' | 'none';
}

export interface DiskSubscription {
    email: string;
    status: 'active' | 'grace_period' | 'overdue' | 'canceled' | 'expired';
    subscribedGb: number;
    priceVcn: number;
    currentCycleStart: number;
    currentCycleEnd: number;
    autoRenew: boolean;
    cancelAtPeriodEnd: boolean;
    overdueSince?: number;
}

export interface UploadProgress {
    fileName: string;
    progress: number;       // 0 - 100
    bytesTransferred: number;
    totalBytes: number;
    status: 'uploading' | 'success' | 'error';
    error?: string;
    downloadURL?: string;
}

// ─── Constants ───

const STORAGE_LIMIT_BYTES = 50 * 1024 * 1024 * 1024; // 50 GB
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;        // 500 MB per file

// ─── Helpers ───

const getUserDiskCollection = (email: string) => {
    const db = getFirebaseDb();
    return collection(db, 'users', email.toLowerCase(), 'disk_files');
};

const getUserFolderCollection = (email: string) => {
    const db = getFirebaseDb();
    return collection(db, 'users', email.toLowerCase(), 'disk_folders');
};

const getFileCategory = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
    if (mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('csv')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar') || mimeType.includes('compress')) return 'archive';
    if (mimeType.includes('text/')) return 'text';
    return 'other';
};

export const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(i >= 3 ? 2 : 1)) + ' ' + sizes[i];
};

export const getFileExtension = (name: string): string => {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
};

// ─── Thumbnail Generation (Browser-side) ───

/**
 * Generate a thumbnail from an image file using canvas.
 * Returns a base64 data URL or empty string on failure.
 */
/**
 * Optimize image: convert to WebP with resize and compression.
 * Uses Canvas API (client-side). Returns a new File with .webp extension.
 * Falls back to original file on any error.
 */
export const optimizeImage = async (
    file: File,
    maxDimension: number = 2048,
    quality: number = 0.85
): Promise<File> => {
    // Skip if already WebP and small enough
    if (file.type === 'image/webp' && file.size < 500 * 1024) return file;
    // Skip SVG (vector, can't rasterize well)
    if (file.type === 'image/svg+xml') return file;

    return new Promise((resolve) => {
        try {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                try {
                    let w = img.width, h = img.height;
                    // Resize if larger than maxDimension
                    if (w > maxDimension || h > maxDimension) {
                        if (w > h) {
                            h = Math.round(h * maxDimension / w);
                            w = maxDimension;
                        } else {
                            w = Math.round(w * maxDimension / h);
                            h = maxDimension;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(
                        (blob) => {
                            URL.revokeObjectURL(url);
                            if (!blob) { resolve(file); return; }
                            // Build new filename with .webp extension
                            const baseName = file.name.replace(/\.[^.]+$/, '');
                            const optimizedFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
                            console.log(`[Disk] Image optimized: ${file.name} (${(file.size / 1024).toFixed(0)}KB) → ${optimizedFile.name} (${(optimizedFile.size / 1024).toFixed(0)}KB)`);
                            resolve(optimizedFile);
                        },
                        'image/webp',
                        quality
                    );
                } catch { URL.revokeObjectURL(url); resolve(file); }
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        } catch { resolve(file); }
    });
};

export const generateImageThumbnail = async (file: File, maxSize: number = 200): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                else { w = Math.round(w * maxSize / h); h = maxSize; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/webp', 0.7));
                } else {
                    resolve('');
                }
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
            img.src = url;
        } catch { resolve(''); }
    });
};

/**
 * Generate a thumbnail from a video file by capturing a frame.
 * Returns a base64 data URL or empty string on failure.
 */
export const generateVideoThumbnail = async (file: File, maxSize: number = 200): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const video = document.createElement('video');
            const url = URL.createObjectURL(file);
            video.preload = 'auto';
            video.muted = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.crossOrigin = 'anonymous';

            let resolved = false;
            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    URL.revokeObjectURL(url);
                }
            };

            const captureFrame = () => {
                if (resolved) return;
                try {
                    const canvas = document.createElement('canvas');
                    let w = video.videoWidth, h = video.videoHeight;
                    if (!w || !h) { cleanup(); resolve(''); return; }
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, w, h);
                        resolved = true;
                        resolve(canvas.toDataURL('image/webp', 0.7));
                    } else {
                        resolve('');
                    }
                    video.pause();
                    cleanup();
                } catch {
                    cleanup();
                    resolve('');
                }
            };

            video.onseeked = captureFrame;
            video.onloadeddata = () => {
                // Seek to 1 second or 10% of video, whichever is less
                video.currentTime = Math.min(1, video.duration * 0.1);
            };
            // Fallback: try capturing on canplay if loadeddata/seeked doesn't fire (mobile)
            video.oncanplay = () => {
                if (!resolved && video.currentTime === 0) {
                    video.currentTime = Math.min(1, video.duration * 0.1);
                }
            };
            video.onerror = () => { cleanup(); resolve(''); };
            // Timeout fallback - longer for mobile
            setTimeout(() => {
                if (!resolved) { cleanup(); resolve(''); }
            }, 15000);
            video.src = url;
            // On iOS, call load() explicitly to start buffering
            video.load();
        } catch { resolve(''); }
    });
};

/**
 * Generate thumbnail from a Blob URL (for backfilling distributed files).
 * Works for images; returns base64 data URL or empty string.
 */
export const generateThumbnailFromBlob = async (blobUrl: string, maxSize: number = 200): Promise<string> => {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                else { w = Math.round(w * maxSize / h); h = maxSize; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/webp', 0.7));
                } else {
                    resolve('');
                }
            };
            img.onerror = () => resolve('');
            setTimeout(() => resolve(''), 8000);
            img.src = blobUrl;
        } catch { resolve(''); }
    });
};

/**
 * Backfill thumbnail for a distributed file that doesn't have one.
 * Downloads the full file, generates thumbnail, saves to Firestore, and returns the data URL.
 * This is designed to run lazily and in the background.
 */
export const backfillThumbnail = async (email: string, file: DiskFile): Promise<string> => {
    if (!file.chunkHashes?.length || file.isEncrypted) return '';
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return '';

    try {
        // Download full file
        const blob = await downloadDiskFileGranular(file, () => { }, 10);
        const blobUrl = URL.createObjectURL(blob);

        let thumbnail = '';
        if (file.type.startsWith('image/')) {
            thumbnail = await generateThumbnailFromBlob(blobUrl);
        } else if (file.type.startsWith('video/')) {
            // For video, create a temp video element to capture frame
            thumbnail = await new Promise<string>((resolve) => {
                const video = document.createElement('video');
                video.muted = true;
                video.preload = 'metadata';
                video.onloadeddata = () => {
                    video.currentTime = 1;
                };
                video.onseeked = () => {
                    const canvas = document.createElement('canvas');
                    let w = video.videoWidth, h = video.videoHeight;
                    const maxSize = 200;
                    if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
                    else { w = Math.round(w * maxSize / h); h = maxSize; }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0, w, h);
                        resolve(canvas.toDataURL('image/webp', 0.7));
                    } else { resolve(''); }
                    URL.revokeObjectURL(blobUrl);
                };
                video.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(''); };
                setTimeout(() => { URL.revokeObjectURL(blobUrl); resolve(''); }, 15000);
                video.src = blobUrl;
            });
        }

        if (!thumbnail) {
            URL.revokeObjectURL(blobUrl);
            return '';
        }

        // Save to Firestore for future instant loading
        const col = getUserDiskCollection(email);
        const fileRef = doc(col, file.id);
        await updateDoc(fileRef, { thumbnail });

        URL.revokeObjectURL(blobUrl);
        return thumbnail;
    } catch (err) {
        console.error('[Disk] Backfill thumbnail failed:', err);
        return '';
    }
};

// ─── Upload (Distributed Storage via Cloud Function) ───

/**
 * Upload a single file to Vision Disk via distributed storage.
 * File is sent to Cloud Function which chunks it and stages for Vision Node replication.
 */
export const uploadDiskFile = async (
    email: string,
    file: File,
    folder: string = '/',
    onProgress?: (p: UploadProgress) => void,
    extraMetadata?: any
): Promise<DiskFile> => {
    if (!email) throw new Error('Email required');
    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`File "${file.name}" exceeds the 500 MB limit`);
    }

    // Report initial progress
    onProgress?.({
        fileName: file.name,
        progress: 5,
        bytesTransferred: 0,
        totalBytes: file.size,
        status: 'uploading',
    });

    // Generate thumbnail for images and videos
    // For encrypted files, use pre-generated thumbnail from original file
    let thumbnailDataUrl = extraMetadata?.preEncryptionThumbnail || '';
    if (!thumbnailDataUrl) {
        if (file.type.startsWith('image/')) {
            thumbnailDataUrl = await generateImageThumbnail(file);
        } else if (file.type.startsWith('video/')) {
            thumbnailDataUrl = await generateVideoThumbnail(file);
        }
    }

    onProgress?.({
        fileName: file.name,
        progress: 15,
        bytesTransferred: 0,
        totalBytes: file.size,
        status: 'uploading',
    });

    // Threshold for direct base64 upload via callable function
    const DIRECT_UPLOAD_LIMIT = 5 * 1024 * 1024; // 5MB (base64 encodes to ~6.65MB, safe under 10MB httpsCallable limit)

    // Call Cloud Function for distributed upload
    const functions = getFunctions(getFirebaseApp());
    const diskUploadCall = httpsCallable<
        { fileData?: string; tempStoragePath?: string; fileName: string; fileType: string; folder: string; fileSize: number; thumbnail?: string },
        {
            success: boolean; fileId: string; fileKey: string; cid: string;
            merkleRoot: string; chunkCount: number; totalSize: number; storageType: string;
            abstract?: string; thumbnailURL?: string;
        }
    >(functions, 'diskUpload', { timeout: 300000 });

    let callPayload: any;

    if (file.size <= DIRECT_UPLOAD_LIMIT) {
        // Small files: send base64 directly (fast path)
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);

        onProgress?.({
            fileName: file.name,
            progress: 40,
            bytesTransferred: file.size * 0.4,
            totalBytes: file.size,
            status: 'uploading',
        });

        callPayload = {
            fileData: base64,
            fileName: file.name,
            fileType: file.type,
            folder,
            fileSize: file.size,
            thumbnail: thumbnailDataUrl || undefined,
        };
    } else {
        // Large files: upload to Firebase Storage first, then pass path
        const storage = getStorage(getFirebaseApp());
        const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tempPath = `disk_temp/${email}/${tempId}`;
        const storageRef = ref(storage, tempPath);

        // Upload with real progress tracking
        await new Promise<void>((resolve, reject) => {
            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: file.type,
            });

            uploadTask.on('state_changed',
                (snapshot) => {
                    // Map Storage upload progress to 15% - 70% range
                    const pct = (snapshot.bytesTransferred / snapshot.totalBytes);
                    const mappedProgress = 15 + Math.round(pct * 55);
                    onProgress?.({
                        fileName: file.name,
                        progress: mappedProgress,
                        bytesTransferred: snapshot.bytesTransferred,
                        totalBytes: snapshot.totalBytes,
                        status: 'uploading',
                    });
                },
                (error) => reject(error),
                () => resolve(),
            );
        });

        onProgress?.({
            fileName: file.name,
            progress: 70,
            bytesTransferred: file.size * 0.7,
            totalBytes: file.size,
            status: 'uploading',
        });

        callPayload = {
            tempStoragePath: tempPath,
            fileName: file.name,
            fileType: file.type,
            folder,
            fileSize: file.size,
            thumbnail: thumbnailDataUrl || undefined,
        };
    }

    // Simulate gradual progress during Cloud Function call (70% → 95%)
    let simulatedProgress = callPayload.fileData ? 40 : 70;
    const progressInterval = setInterval(() => {
        if (simulatedProgress < 95) {
            const increment = simulatedProgress < 80 ? 3 : simulatedProgress < 90 ? 2 : 0.5;
            simulatedProgress = Math.min(95, simulatedProgress + increment);
            onProgress?.({
                fileName: file.name,
                progress: Math.round(simulatedProgress),
                bytesTransferred: file.size * (simulatedProgress / 100),
                totalBytes: file.size,
                status: 'uploading',
            });
        }
    }, 500);

    let result;
    try {
        result = await diskUploadCall(callPayload);
    } finally {
        clearInterval(progressInterval);
    }

    const data = result.data;
    const now = new Date().toISOString();

    const diskFile: DiskFile = {
        id: data.fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        folder,
        downloadURL: (data as any).downloadURL || '',
        storagePath: (data as any).storagePath || `distributed://${data.cid}`,
        createdAt: now,
        updatedAt: now,
        storageType: (data.storageType as any) || 'distributed',
        cid: data.cid,
        fileKey: data.fileKey,
        merkleRoot: data.merkleRoot,
        chunkCount: data.chunkCount,
        replicationStatus: 'staging',
        thumbnail: thumbnailDataUrl || undefined,
        thumbnailURL: data.thumbnailURL || undefined,
        abstract: data.abstract || undefined,
    };

    onProgress?.({
        fileName: file.name,
        progress: 100,
        bytesTransferred: file.size,
        totalBytes: file.size,
        status: 'success',
    });

    return diskFile;
};

/** Convert ArrayBuffer to base64 string (mobile-safe) */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    // Use small chunks with String.fromCharCode.apply to avoid stack overflow on mobile
    const chunkSize = 1024;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        binary += String.fromCharCode.apply(null, chunk as any);
    }
    return btoa(binary);
}

// ─── Download (Distributed Storage via Cloud Function) ───

/**
 * Download a file from distributed storage.
 * Retrieves chunks via Cloud Function, reassembles, and returns as Blob.
 */
export const downloadDiskFile = async (email: string, fileId: string): Promise<{ blob: Blob; fileName: string; fileType: string }> => {
    const functions = getFunctions(getFirebaseApp());
    const diskDownloadCall = httpsCallable<
        { fileId: string },
        { success: boolean; fileData: string; fileName: string; fileType: string; size: number; cid: string; storageType: string }
    >(functions, 'diskDownload');

    const result = await diskDownloadCall({ fileId });
    const data = result.data;

    // Convert base64 back to Blob
    const binaryStr = atob(data.fileData);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: data.fileType });

    return {
        blob,
        fileName: data.fileName,
        fileType: data.fileType,
    };
};

/**
 * Resolve chunk hashes to storage node endpoints via agentGateway.
 */
const fetchChunkLocations = async (
    hashes: string[]
): Promise<Record<string, Array<{ node_id: string; endpoint: string }>>> => {
    try {
        const app = getFirebaseApp();
        const projectId = (app as any).options?.projectId || 'visionchain-staging';
        const gatewayUrl = `https://us-central1-${projectId}.cloudfunctions.net/agentGateway`;
        const resp = await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'chunk.locations', hashes }),
        });
        if (!resp.ok) return {};
        const data = await resp.json();
        return data.locations || {};
    } catch {
        return {};
    }
};

/**
 * Fetch a single chunk directly from a storage node via HTTP.
 */
const fetchChunkFromNode = async (
    endpoint: string,
    hash: string,
    timeoutMs: number = 8000
): Promise<Uint8Array | null> => {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const resp = await fetch(`${endpoint}/chunks/${hash}`, {
            signal: controller.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) return null;
        const buf = await resp.arrayBuffer();
        return new Uint8Array(buf);
    } catch {
        return null;
    }
};

/**
 * Download a file from distributed storage chunk by chunk.
 * Tries direct download from storage nodes first, falls back to Firestore.
 * @param batchSize - Number of parallel chunk requests (default 5, recommended 10-15 for video)
 */
export const downloadDiskFileGranular = async (
    file: DiskFile,
    onProgress: (chunkIndex: number, totalChunks: number) => void,
    batchSize: number = 5
): Promise<Blob> => {
    const chunkHashes = file.chunkHashes || [];
    if (chunkHashes.length === 0) {
        const resp = await fetch(file.downloadURL);
        return await resp.blob();
    }

    const functions = getFunctions(getFirebaseApp());
    const getChunkCall = httpsCallable<
        { chunkHash: string },
        { success: boolean; data: string }
    >(functions, 'diskGetChunk');

    // Resolve chunk locations from storage nodes
    const locations = await fetchChunkLocations(chunkHashes);

    const chunks: Uint8Array[] = [];
    let nodeHits = 0;
    let firestoreHits = 0;

    for (let i = 0; i < chunkHashes.length; i += batchSize) {
        const batch = chunkHashes.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(async (hash) => {
                // Try storage nodes first
                const nodeEndpoints = locations[hash] || [];
                for (const node of nodeEndpoints) {
                    const data = await fetchChunkFromNode(node.endpoint, hash);
                    if (data) {
                        nodeHits++;
                        return data;
                    }
                }

                // Fallback to Firestore via Cloud Function
                const res = await getChunkCall({ chunkHash: hash });
                const binaryStr = atob(res.data.data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let j = 0; j < binaryStr.length; j++) {
                    bytes[j] = binaryStr.charCodeAt(j);
                }
                firestoreHits++;
                return bytes;
            })
        );

        for (const data of results) {
            chunks.push(data);
        }

        const currentCount = Math.min(i + batchSize, chunkHashes.length);
        onProgress(currentCount, chunkHashes.length);
    }

    console.log(`[Disk] Download complete: ${nodeHits} from nodes, ${firestoreHits} from Firestore`);
    return new Blob(chunks as BlobPart[], { type: file.type });
};

/**
 * Stream video chunks progressively.
 * Downloads chunks in order with high parallelism and provides intermediate blobs
 * for early playback start. Returns a Promise that resolves with the full blob.
 *
 * @param file - The DiskFile to stream
 * @param onProgress - Called after each batch with current/total chunks downloaded
 * @param onBufferReady - Called when enough data is buffered for playback (partial blob URL)
 * @param bufferThresholdBytes - Minimum bytes before calling onBufferReady (default 2MB)
 */
export const streamVideoChunks = async (
    file: DiskFile,
    onProgress: (current: number, total: number, bytesLoaded: number) => void,
    onBufferReady: (blobUrl: string) => void,
    bufferThresholdBytes: number = 2 * 1024 * 1024
): Promise<Blob> => {
    const chunkHashes = file.chunkHashes || [];
    if (chunkHashes.length === 0) {
        const resp = await fetch(file.downloadURL);
        const blob = await resp.blob();
        onBufferReady(URL.createObjectURL(blob));
        return blob;
    }

    const functions = getFunctions(getFirebaseApp());
    const getChunkCall = httpsCallable<
        { chunkHash: string },
        { success: boolean; data: string }
    >(functions, 'diskGetChunk');

    // Resolve chunk locations from storage nodes
    const locations = await fetchChunkLocations(chunkHashes);

    const chunks: Uint8Array[] = [];
    let totalBytesLoaded = 0;
    let bufferNotified = false;

    // Use larger batch size for video streaming (12 parallel)
    const STREAM_BATCH = 12;

    for (let i = 0; i < chunkHashes.length; i += STREAM_BATCH) {
        const batch = chunkHashes.slice(i, i + STREAM_BATCH);
        const results = await Promise.all(
            batch.map(async (hash) => {
                // Try storage nodes first
                const nodeEndpoints = locations[hash] || [];
                for (const node of nodeEndpoints) {
                    const data = await fetchChunkFromNode(node.endpoint, hash);
                    if (data) return data;
                }

                // Fallback to Firestore via Cloud Function
                const res = await getChunkCall({ chunkHash: hash });
                const binaryStr = atob(res.data.data);
                const bytes = new Uint8Array(binaryStr.length);
                for (let j = 0; j < binaryStr.length; j++) {
                    bytes[j] = binaryStr.charCodeAt(j);
                }
                return bytes;
            })
        );

        for (const data of results) {
            chunks.push(data);
            totalBytesLoaded += data.length;
        }

        const currentCount = Math.min(i + STREAM_BATCH, chunkHashes.length);
        onProgress(currentCount, chunkHashes.length, totalBytesLoaded);

        // Notify when buffer threshold reached (first time only)
        if (!bufferNotified && totalBytesLoaded >= bufferThresholdBytes) {
            const partialBlob = new Blob(chunks as BlobPart[], { type: file.type });
            onBufferReady(URL.createObjectURL(partialBlob));
            bufferNotified = true;
        }
    }

    // Final complete blob
    const fullBlob = new Blob(chunks as BlobPart[], { type: file.type });

    // If buffer wasn't enough for early notification, notify now with full blob
    if (!bufferNotified) {
        onBufferReady(URL.createObjectURL(fullBlob));
    }

    return fullBlob;
};

// ─── List / Read ───

/**
 * List all files for a user, optionally filtered by folder.
 */
export const listDiskFiles = async (email: string, folder?: string): Promise<DiskFile[]> => {
    const col = getUserDiskCollection(email);
    let q;
    if (folder && folder !== '/') {
        q = query(col, where('folder', '==', folder), orderBy('createdAt', 'desc'));
    } else if (folder === '/') {
        q = query(col, where('folder', '==', '/'), orderBy('createdAt', 'desc'));
    } else {
        q = query(col, orderBy('createdAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DiskFile));
};

// ─── Delete (via Cloud Function for distributed cleanup) ───

export const deleteDiskFile = async (email: string, fileId: string): Promise<void> => {
    const col = getUserDiskCollection(email);
    const fileDocRef = doc(col, fileId);
    const fileSnap = await getDoc(fileDocRef);

    if (!fileSnap.exists()) throw new Error('File not found');

    const fileData = fileSnap.data() as DiskFile;

    // For distributed files, use Cloud Function to clean up chunks
    if (fileData.storageType === 'distributed' || fileData.cid) {
        const functions = getFunctions(getFirebaseApp());
        const diskDeleteCall = httpsCallable<{ fileId: string }, { success: boolean }>(functions, 'diskDelete');
        await diskDeleteCall({ fileId });
        return;
    }

    // Legacy: direct Firestore delete for old files without distributed storage
    await deleteDoc(fileDocRef);
};

export const renameDiskFile = async (email: string, fileId: string, newName: string): Promise<void> => {
    const col = getUserDiskCollection(email);
    const fileDocRef = doc(col, fileId);
    await updateDoc(fileDocRef, {
        name: newName,
        updatedAt: new Date().toISOString()
    });
};

export const moveDiskFile = async (email: string, fileId: string, newFolder: string): Promise<void> => {
    const col = getUserDiskCollection(email);
    const fileDocRef = doc(col, fileId);
    await updateDoc(fileDocRef, {
        folder: newFolder,
        updatedAt: new Date().toISOString()
    });
};

// ─── Folders ───

export const createDiskFolder = async (email: string, name: string, parentPath: string = '/'): Promise<DiskFolder> => {
    const folderId = `${Date.now()}_${name.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
    const path = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
    const now = new Date().toISOString();

    const folder: DiskFolder = {
        id: folderId,
        name,
        path,
        parentPath,
        createdAt: now,
    };

    const col = getUserFolderCollection(email);
    await setDoc(doc(col, folderId), folder);
    return folder;
};

export const listDiskFolders = async (email: string, parentPath: string = '/'): Promise<DiskFolder[]> => {
    const col = getUserFolderCollection(email);
    const q = query(col, where('parentPath', '==', parentPath), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DiskFolder));
};

export const listAllDiskFolders = async (email: string): Promise<DiskFolder[]> => {
    const col = getUserFolderCollection(email);
    const snapshot = await getDocs(col);
    return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DiskFolder));
};

export const deleteDiskFolder = async (email: string, folderId: string): Promise<void> => {
    const col = getUserFolderCollection(email);
    await deleteDoc(doc(col, folderId));
    // Note: files inside the folder are NOT auto-deleted - caller should handle this
};

export const renameDiskFolder = async (email: string, folderId: string, newName: string): Promise<void> => {
    const col = getUserFolderCollection(email);
    const folderDocRef = doc(col, folderId);
    const folderSnap = await getDoc(folderDocRef);

    if (!folderSnap.exists()) throw new Error('Folder not found');
    const folderData = folderSnap.data() as DiskFolder;
    const oldPath = folderData.path;

    // Calculate new path
    const pathParts = oldPath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    await updateDoc(folderDocRef, {
        name: newName,
        path: newPath
    });

    // Update all files in this folder to the new path
    const filesCol = getUserDiskCollection(email);
    const q = query(filesCol, where('folder', '==', oldPath));
    const snapshot = await getDocs(q);

    const batch = writeBatch(getFirebaseDb());
    snapshot.docs.forEach(d => {
        batch.update(d.ref, { folder: newPath });
    });

    // If we support nested folders, update subfolders too
    const subfoldersCol = getUserFolderCollection(email);
    const q2 = query(subfoldersCol, where('parentPath', '==', oldPath));
    const snapshot2 = await getDocs(q2);
    snapshot2.docs.forEach(d => {
        batch.update(d.ref, {
            parentPath: newPath,
            path: `${newPath}/${d.data().name}`
        });
    });

    await batch.commit();
};

export const moveDiskFolder = async (email: string, folderId: string, newParentPath: string): Promise<void> => {
    const col = getUserFolderCollection(email);
    const folderDocRef = doc(col, folderId);
    const folderSnap = await getDoc(folderDocRef);

    if (!folderSnap.exists()) throw new Error('Folder not found');
    const folderData = folderSnap.data() as DiskFolder;
    const oldPath = folderData.path;

    const newPath = newParentPath === '/' ? `/${folderData.name}` : `${newParentPath}/${folderData.name}`;
    if (newPath === oldPath) return;

    const batch = writeBatch(getFirebaseDb());

    // 1. Update folder itself
    batch.update(folderDocRef, {
        parentPath: newParentPath,
        path: newPath
    });

    // 2. Update child files
    const filesCol = getUserDiskCollection(email);
    const filesQ = query(filesCol, where('folder', '==', oldPath));
    const filesSnap = await getDocs(filesQ);
    filesSnap.docs.forEach(d => {
        batch.update(d.ref, { folder: newPath });
    });

    // 3. Update direct subfolders
    const foldersQ = query(col, where('parentPath', '==', oldPath));
    const foldersSnap = await getDocs(foldersQ);
    foldersSnap.docs.forEach(d => {
        const subData = d.data() as DiskFolder;
        batch.update(d.ref, {
            parentPath: newPath,
            path: `${newPath}/${subData.name}`
        });
    });

    await batch.commit();
};

// ─── Usage ───

export const getDiskSubscription = async (email: string): Promise<DiskSubscription | null> => {
    const db = getFirebaseDb();
    const docSnap = await getDoc(doc(db, 'disk_subscriptions', email.toLowerCase()));
    if (docSnap.exists()) {
        return docSnap.data() as DiskSubscription;
    }
    return null;
};

export const subscribeToDisk = async (
    gb: number,
    signature?: string,
    deadline?: number,
    owner?: string
): Promise<{ success: boolean; gb: number; price: number; cycleEnd: number }> => {
    const functions = getFunctions(getFirebaseApp());
    const diskSubscribeCall = httpsCallable<
        { gb: number; signature?: string; deadline?: number; owner?: string },
        { success: boolean; gb: number; price: number; cycleEnd: number }
    >(functions, 'diskSubscribe');
    const result = await diskSubscribeCall({ gb, signature, deadline, owner });
    return result.data;
};

export const cancelDiskSubscription = async (): Promise<{ success: boolean }> => {
    const functions = getFunctions(getFirebaseApp());
    const cancelCall = httpsCallable<{}, { success: boolean }>(functions, 'diskCancelSubscription');
    const result = await cancelCall({});
    return result.data;
};

export const getDiskUsage = async (email: string): Promise<DiskUsage> => {
    const files = await listDiskFiles(email); // no folder filter = all files
    const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);

    let limitBytes = 0; // default 0 if no sub
    let status: DiskUsage['status'] = 'none';

    try {
        const sub = await getDiskSubscription(email);
        if (sub) {
            limitBytes = sub.subscribedGb * 1024 * 1024 * 1024;
            status = sub.status;
        }
    } catch (e) {
        console.warn('Failed to get disk subscription:', e);
    }

    return {
        totalBytes,
        fileCount: files.length,
        limitBytes,
        status,
    };
};

// ─── Publishing & Marketplace ───

/**
 * Publish a file to the global market.
 */
export const publishDiskFile = async (email: string, fileId: string, priceVcn: number): Promise<void> => {
    const db = getFirebaseDb();
    const userFileRef = doc(getUserDiskCollection(email), fileId);
    const fileSnap = await getDoc(userFileRef);

    if (!fileSnap.exists()) throw new Error('File not found');
    const fileData = fileSnap.data() as DiskFile;

    const now = new Date().toISOString();
    const updateData = {
        isPublished: true,
        priceVcn,
        publishedAt: now,
        publisherEmail: email.toLowerCase()
    };

    // 1. Update user's file metadata
    await updateDoc(userFileRef, updateData);

    // 2. Add to global market collection
    const marketRef = doc(db, 'published_materials', fileId);
    await setDoc(marketRef, {
        ...(fileData as any),
        ...updateData,
        purchaseCount: 0
    });
};

/**
 * Remove a file from the global market.
 */
export const unpublishDiskFile = async (email: string, fileId: string): Promise<void> => {
    const db = getFirebaseDb();
    const userFileRef = doc(getUserDiskCollection(email), fileId);

    // 1. Update user's file metadata
    await updateDoc(userFileRef, {
        isPublished: false,
        priceVcn: 0
    });

    // 2. Remove from global market collection
    await deleteDoc(doc(db, 'published_materials', fileId));
};

/**
 * List all published materials in the market.
 */
export const listPublishedMaterials = async (category?: string): Promise<DiskFile[]> => {
    const db = getFirebaseDb();
    const col = collection(db, 'published_materials');
    let q;
    if (category) {
        q = query(col, where('category', '==', category), orderBy('publishedAt', 'desc'));
    } else {
        q = query(col, orderBy('publishedAt', 'desc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) } as DiskFile));
};

/**
 * Check if user has already purchased a file.
 */
export const checkPurchaseStatus = async (email: string, fileId: string): Promise<boolean> => {
    const db = getFirebaseDb();
    const purchaseRef = doc(db, 'users', email.toLowerCase(), 'purchased_files', fileId);
    const snap = await getDoc(purchaseRef);
    return snap.exists();
};

/**
 * Purchase a published material. Calls a Cloud Function to handle VCN split.
 * Uses Permit (EIP-2612) for gasless payment via Paymaster.
 */
export const purchaseMaterial = async (
    fileId: string,
    permitData?: { signature: string; deadline: number; owner: string }
): Promise<{ success: boolean; downloadURL: string }> => {
    const functions = getFunctions(getFirebaseApp());
    const purchaseCall = httpsCallable<
        { fileId: string; signature?: string; deadline?: number; owner?: string },
        { success: boolean; downloadURL: string }
    >(functions, 'purchasePublishedFile');
    const result = await purchaseCall({
        fileId,
        ...(permitData ? {
            signature: permitData.signature,
            deadline: permitData.deadline,
            owner: permitData.owner,
        } : {}),
    });
    return result.data;
};

// ─── Client-side Encryption (AES-GCM) ───

const ENCRYPTION_ALGO = 'AES-GCM';
const KEY_ALGO = 'PBKDF2';

/**
 * Derives a key from a password and salt.
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        "PBKDF2",
        false,
        ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt as any,
            iterations: 100000,
            hash: 'SHA-256'
        } as any,
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ['encrypt', 'decrypt']
    ) as any;
}

/**
 * Encrypts a File and returns an ArrayBuffer.
 */
export const encryptFile = async (file: File, password: string): Promise<{ encryptedData: ArrayBuffer; salt: string; iv: string }> => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);

    const fileBuffer = await file.arrayBuffer();
    const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        fileBuffer
    );

    return {
        encryptedData,
        salt: btoa(String.fromCharCode(...Array.from(salt))),
        iv: btoa(String.fromCharCode(...Array.from(iv)))
    };
};

/**
 * Decrypts an ArrayBuffer and returns a Blob.
 */
export const decryptFile = async (data: ArrayBuffer, password: string, saltBase64: string, ivBase64: string, type: string): Promise<Blob> => {
    const salt = new Uint8Array(atob(saltBase64).split('').map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
    const key = await deriveKey(password, salt);

    const decryptedData = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data
    );

    return new Blob([decryptedData], { type });
};
