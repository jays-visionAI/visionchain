/**
 * AI Memory Storage Service - Phase 1: Foundation Data Layer
 *
 * Frontend service for interacting with AI storage backend.
 * Provides CRUD operations for AI metadata, chunk listing, and indexing control.
 *
 * Firestore structure:
 *   users/{email}/disk_files/{fileId}         ← existing + AI extension fields
 *   users/{email}/ai_chunks/{chunkId}         ← FileChunk docs
 *   users/{email}/ai_index_jobs/{jobId}       ← IndexJob docs
 *   users/{email}/ai_retrieval_policy         ← RetrievalPolicy (single doc)
 */
import { getFirebaseDb, getFirebaseApp } from '../firebaseService';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type {
    FileObjectAiFields,
    FileChunk,
    IndexJob,
    IndexStatusResponse,
    RetrievalPolicy,
    RequestIndexingParams,
    ListChunksResponse,
    ModelTarget,
    IndexingStatus,
} from './types';
import { createDefaultStages } from './types';

// ─── Firestore Collection Helpers ──────────────────────────────────────────

const getAiChunksCollection = (email: string) => {
    const db = getFirebaseDb();
    return collection(db, 'users', email.toLowerCase(), 'ai_chunks');
};

const getAiIndexJobsCollection = (email: string) => {
    const db = getFirebaseDb();
    return collection(db, 'users', email.toLowerCase(), 'ai_index_jobs');
};

const getAiRetrievalPolicyDoc = (email: string) => {
    const db = getFirebaseDb();
    return doc(db, 'users', email.toLowerCase(), 'ai_retrieval_policy', 'default');
};

const getDiskFileDoc = (email: string, fileId: string) => {
    const db = getFirebaseDb();
    return doc(db, 'users', email.toLowerCase(), 'disk_files', fileId);
};

// ─── File AI Metadata ──────────────────────────────────────────────────────

/**
 * Get AI extension fields for a DiskFile.
 * Returns only the AI-specific fields, not the full DiskFile.
 */
export async function getFileAiMetadata(
    email: string,
    fileId: string
): Promise<FileObjectAiFields | null> {
    try {
        const fileRef = getDiskFileDoc(email, fileId);
        const snap = await getDoc(fileRef);
        if (!snap.exists()) return null;

        const data = snap.data();
        // Extract only AI-related fields
        return {
            language: data.language,
            tags: data.tags,
            sourceType: data.sourceType,
            parsedTextUri: data.parsedTextUri,
            transcriptUri: data.transcriptUri,
            version: data.version,
            parentVersionId: data.parentVersionId,
            contentHash: data.contentHash,
            aclPolicy: data.aclPolicy,
            retentionPolicy: data.retentionPolicy,
            indexingStatus: data.indexingStatus || 'none',
            memoryEligibility: data.memoryEligibility ?? false,
            modelCompatibility: data.modelCompatibility || 'both',
            indexedAt: data.indexedAt,
            lastRetrievedAt: data.lastRetrievedAt,
        };
    } catch (err) {
        console.error('[AI Storage] getFileAiMetadata error:', err);
        return null;
    }
}

/**
 * Update AI extension fields on an existing DiskFile.
 * Only updates the specified fields — does not touch other DiskFile fields.
 */
export async function updateFileAiMetadata(
    email: string,
    fileId: string,
    updates: Partial<FileObjectAiFields>
): Promise<boolean> {
    try {
        const fileRef = getDiskFileDoc(email, fileId);
        await updateDoc(fileRef, {
            ...updates,
            updatedAt: new Date().toISOString(),
        });
        return true;
    } catch (err) {
        console.error('[AI Storage] updateFileAiMetadata error:', err);
        return false;
    }
}

// ─── File Chunks ───────────────────────────────────────────────────────────

/**
 * List semantic chunks for a file.
 * Results are ordered by chunkIndex for reading order.
 */
export async function listFileChunks(
    email: string,
    fileId: string,
    offsetIndex: number = 0,
    pageSize: number = 50
): Promise<ListChunksResponse> {
    try {
        const col = getAiChunksCollection(email);
        const q = query(
            col,
            where('fileId', '==', fileId),
            orderBy('chunkIndex'),
            limit(pageSize + 1) // Fetch one extra to check hasMore
        );
        const snap = await getDocs(q);

        const chunks: FileChunk[] = [];
        snap.docs.slice(0, pageSize).forEach((d) => {
            chunks.push({ chunkId: d.id, ...d.data() } as FileChunk);
        });

        return {
            chunks,
            total: chunks.length,
            hasMore: snap.docs.length > pageSize,
        };
    } catch (err) {
        console.error('[AI Storage] listFileChunks error:', err);
        return { chunks: [], total: 0, hasMore: false };
    }
}

/**
 * Get a single chunk by ID.
 */
export async function getChunk(
    email: string,
    chunkId: string
): Promise<FileChunk | null> {
    try {
        const col = getAiChunksCollection(email);
        const chunkRef = doc(col, chunkId);
        const snap = await getDoc(chunkRef);
        if (!snap.exists()) return null;
        return { chunkId: snap.id, ...snap.data() } as FileChunk;
    } catch (err) {
        console.error('[AI Storage] getChunk error:', err);
        return null;
    }
}

// ─── Index Jobs ────────────────────────────────────────────────────────────

/**
 * Request AI indexing for a file.
 * Calls the aiRequestIndexing Cloud Function which creates an IndexJob.
 */
export async function requestIndexing(
    params: RequestIndexingParams
): Promise<IndexStatusResponse | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable<RequestIndexingParams, IndexStatusResponse>(
            functions,
            'aiRequestIndexing'
        );
        const result = await fn(params);
        return result.data;
    } catch (err) {
        console.error('[AI Storage] requestIndexing error:', err);
        return null;
    }
}

/**
 * Get the current indexing status for a file.
 * Calls the aiGetIndexStatus Cloud Function.
 */
export async function getIndexStatus(
    fileId: string
): Promise<IndexStatusResponse | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable<{ fileId: string }, IndexStatusResponse>(
            functions,
            'aiGetIndexStatus'
        );
        const result = await fn({ fileId });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] getIndexStatus error:', err);
        return null;
    }
}

/**
 * Trigger the full ingestion pipeline for a file.
 * Calls aiProcessIngestion Cloud Function which runs: parse → chunk → enrich → save.
 */
export interface IngestionResult {
    jobId: string;
    fileId: string;
    status: string;
    chunksCreated: number;
    language?: string;
    totalTokens?: number;
    message?: string;
}

export async function triggerIngestion(
    fileId: string,
    jobId?: string,
    modelTarget: ModelTarget = 'both'
): Promise<IngestionResult | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable<
            { fileId: string; jobId?: string; modelTarget: string },
            IngestionResult
        >(functions, 'aiProcessIngestion', { timeout: 540000 });

        const result = await fn({ fileId, jobId, modelTarget });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] triggerIngestion error:', err);
        return null;
    }
}

/**
 * List all index jobs for a user (most recent first).
 */
export async function listIndexJobs(
    email: string,
    pageSize: number = 20
): Promise<IndexJob[]> {
    try {
        const col = getAiIndexJobsCollection(email);
        const q = query(col, orderBy('createdAt', 'desc'), limit(pageSize));
        const snap = await getDocs(q);

        return snap.docs.map((d) => ({
            jobId: d.id,
            ...d.data(),
        })) as IndexJob[];
    } catch (err) {
        console.error('[AI Storage] listIndexJobs error:', err);
        return [];
    }
}

// ─── Retrieval Policy ──────────────────────────────────────────────────────

/**
 * Get the user's retrieval policy.
 */
export async function getRetrievalPolicy(
    email: string
): Promise<RetrievalPolicy | null> {
    try {
        const policyRef = getAiRetrievalPolicyDoc(email);
        const snap = await getDoc(policyRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as RetrievalPolicy;
    } catch (err) {
        console.error('[AI Storage] getRetrievalPolicy error:', err);
        return null;
    }
}

/**
 * Create or update the user's retrieval policy.
 */
export async function setRetrievalPolicy(
    email: string,
    policy: Omit<RetrievalPolicy, 'id' | 'createdAt' | 'updatedAt'>
): Promise<boolean> {
    try {
        const policyRef = getAiRetrievalPolicyDoc(email);
        const now = new Date().toISOString();
        const existing = await getDoc(policyRef);

        if (existing.exists()) {
            await updateDoc(policyRef, {
                ...policy,
                updatedAt: now,
            });
        } else {
            await setDoc(policyRef, {
                ...policy,
                createdAt: now,
                updatedAt: now,
            });
        }
        return true;
    } catch (err) {
        console.error('[AI Storage] setRetrievalPolicy error:', err);
        return false;
    }
}

// ─── Utility: Batch AI Status Check ────────────────────────────────────────

/**
 * Check indexing status for multiple files at once.
 * Returns a map of fileId → IndexingStatus.
 */
export async function batchGetIndexingStatus(
    email: string,
    fileIds: string[]
): Promise<Record<string, IndexingStatus>> {
    const result: Record<string, IndexingStatus> = {};
    try {
        // Read from disk_files directly for the indexingStatus field
        await Promise.all(
            fileIds.map(async (fileId) => {
                const fileRef = getDiskFileDoc(email, fileId);
                const snap = await getDoc(fileRef);
                result[fileId] = snap.exists()
                    ? (snap.data().indexingStatus || 'none')
                    : 'none';
            })
        );
    } catch (err) {
        console.error('[AI Storage] batchGetIndexingStatus error:', err);
    }
    return result;
}
