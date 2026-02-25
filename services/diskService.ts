/**
 * Vision Disk - Decentralized Storage Service
 * Handles file upload, metadata management, and storage tracking via Firebase Storage + Firestore.
 */
import { getFirebaseStorage, getFirebaseDb, getFirebaseApp } from './firebaseService';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject, UploadTask } from 'firebase/storage';
import { collection, doc, setDoc, getDocs, deleteDoc, query, where, orderBy, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

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

// ─── Upload ───

/**
 * Upload a single file to Vision Disk.
 * Returns an UploadTask handle so caller can track progress.
 */
export const uploadDiskFile = (
    email: string,
    file: File,
    folder: string = '/',
    onProgress?: (p: UploadProgress) => void,
    extraMetadata?: any
): Promise<DiskFile> => {
    return new Promise((resolve, reject) => {
        if (!email) { reject(new Error('Email required')); return; }
        if (file.size > MAX_FILE_SIZE_BYTES) {
            reject(new Error(`File "${file.name}" exceeds the 500 MB limit`));
            return;
        }

        const storage = getFirebaseStorage();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
        const timestamp = Date.now();
        const storagePath = `disk/${email.toLowerCase()}${folder === '/' ? '' : folder}/${timestamp}_${sanitizedName}`;
        const storageRef = ref(storage, storagePath);

        const uploadTask = uploadBytesResumable(storageRef, file, {
            contentType: file.type,
            customMetadata: {
                originalName: file.name,
                folder,
                uploadedBy: email.toLowerCase(),
                ...(extraMetadata || {})
            },
        });

        uploadTask.on(
            'state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                onProgress?.({
                    fileName: file.name,
                    progress,
                    bytesTransferred: snapshot.bytesTransferred,
                    totalBytes: snapshot.totalBytes,
                    status: 'uploading',
                });
            },
            (error) => {
                onProgress?.({
                    fileName: file.name,
                    progress: 0,
                    bytesTransferred: 0,
                    totalBytes: file.size,
                    status: 'error',
                    error: error.message,
                });
                reject(error);
            },
            async () => {
                try {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const fileId = `${timestamp}_${sanitizedName}`;
                    const now = new Date().toISOString();

                    const diskFile: DiskFile = {
                        id: fileId,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        folder,
                        downloadURL,
                        storagePath,
                        createdAt: now,
                        updatedAt: now,
                    };

                    // Save metadata to Firestore
                    const col = getUserDiskCollection(email);
                    await setDoc(doc(col, fileId), {
                        ...diskFile,
                        category: getFileCategory(file.type),
                        extension: getFileExtension(file.name),
                    });

                    onProgress?.({
                        fileName: file.name,
                        progress: 100,
                        bytesTransferred: file.size,
                        totalBytes: file.size,
                        status: 'success',
                        downloadURL,
                    });

                    resolve(diskFile);
                } catch (err) {
                    reject(err);
                }
            },
        );
    });
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DiskFile));
};

// ─── Delete ───

export const deleteDiskFile = async (email: string, fileId: string): Promise<void> => {
    const col = getUserDiskCollection(email);
    const fileDocRef = doc(col, fileId);
    const fileSnap = await getDoc(fileDocRef);

    if (!fileSnap.exists()) throw new Error('File not found');

    const fileData = fileSnap.data() as DiskFile;

    // Delete from Firebase Storage
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, fileData.storagePath);
    try {
        await deleteObject(storageRef);
    } catch (e) {
        console.warn('[Disk] Storage deletion failed (file may already be removed):', e);
    }

    // Delete Firestore metadata
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DiskFolder));
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

// ─── Usage ───

export const getDiskSubscription = async (email: string): Promise<DiskSubscription | null> => {
    const db = getFirebaseDb();
    const docSnap = await getDoc(doc(db, 'disk_subscriptions', email.toLowerCase()));
    if (docSnap.exists()) {
        return docSnap.data() as DiskSubscription;
    }
    return null;
};

export const subscribeToDisk = async (gb: number): Promise<{ success: boolean; gb: number; price: number; cycleEnd: number }> => {
    const functions = getFunctions(getFirebaseApp());
    const diskSubscribeCall = httpsCallable<{ gb: number }, { success: boolean; gb: number; price: number; cycleEnd: number }>(functions, 'diskSubscribe');
    const result = await diskSubscribeCall({ gb });
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
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DiskFile));
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
 */
export const purchaseMaterial = async (fileId: string): Promise<{ success: boolean; downloadURL: string }> => {
    const functions = getFunctions(getFirebaseApp());
    const purchaseCall = httpsCallable<{ fileId: string }, { success: boolean; downloadURL: string }>(functions, 'purchasePublishedFile');
    const result = await purchaseCall({ fileId });
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
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv))
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
