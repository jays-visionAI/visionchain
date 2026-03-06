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

// ─── Phase 3: Embedding & Retrieval ────────────────────────────────────────

/**
 * Generate dual embeddings (OpenAI + Gemini) for a file's chunks.
 * Calls aiGenerateEmbeddings Cloud Function.
 */
export interface GenerateEmbeddingsResult {
    fileId: string;
    chunksProcessed: number;
    openaiEmbeddings: number;
    geminiEmbeddings: number;
    errors: number;
}

export async function generateEmbeddings(
    fileId: string,
    modelTarget: ModelTarget = 'both'
): Promise<GenerateEmbeddingsResult | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable<
            { fileId: string; modelTarget: string },
            GenerateEmbeddingsResult
        >(functions, 'aiGenerateEmbeddings', { timeout: 540000 });

        const result = await fn({ fileId, modelTarget });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] generateEmbeddings error:', err);
        return null;
    }
}

/**
 * Hybrid retrieval: vector search + keyword search + metadata filter.
 * Calls aiRetrieve Cloud Function.
 */
export interface RetrievalFilters {
    fileIds?: string[];
    sourceType?: string;
    language?: string;
    tags?: string[];
}

export interface RetrievalHit {
    chunkId: string;
    fileId: string;
    score: number;
    vectorScore: number;
    keywordScore: number;
    text?: string;
    summary?: string;
    keywords?: string[];
    chunkType?: string;
    chunkIndex?: number;
    matchType: 'vector' | 'keyword' | 'hybrid';
}

export interface RetrievalResponse {
    results: RetrievalHit[];
    query: string;
    modelUsed: string;
    totalChunksSearched: number;
    searchTimeMs: number;
}

export async function retrieve(
    query: string,
    modelTarget: ModelTarget = 'openai',
    topK: number = 10,
    filters?: RetrievalFilters,
    includeText: boolean = true
): Promise<RetrievalResponse | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable<
            { query: string; modelTarget: string; topK: number; filters?: RetrievalFilters; includeText: boolean },
            RetrievalResponse
        >(functions, 'aiRetrieve', { timeout: 60000 });

        const result = await fn({ query, modelTarget, topK, filters, includeText });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] retrieve error:', err);
        return null;
    }
}

// ─── Phase 4: Context Caching & Long-Term Memory ───────────────────────────

/**
 * Create a Gemini context cache from indexed files.
 */
export async function createContextCache(
    fileIds: string[],
    modelId: string = 'gemini-2.0-flash',
    ttlSeconds: number = 3600,
    displayName?: string
): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiCreateContextCache', { timeout: 120000 });
        const result = await fn({ fileIds, modelId, ttlSeconds, displayName });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] createContextCache error:', err);
        return null;
    }
}

/**
 * Store a new memory entry.
 */
export async function storeMemory(
    content: string,
    type?: 'episodic' | 'semantic' | 'procedural',
    importance?: number,
    source?: { type: string; referenceId?: string },
    keywords?: string[]
): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiMemoryStore', { timeout: 60000 });
        const result = await fn({ action: 'create', content, type, importance, source, keywords });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] storeMemory error:', err);
        return null;
    }
}

/**
 * Search memories by query with relevance scoring.
 */
export async function searchMemories(
    query: string,
    type?: 'episodic' | 'semantic' | 'procedural',
    topK: number = 10,
    minImportance: number = 0
): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiMemoryStore', { timeout: 60000 });
        const result = await fn({ action: 'search', query, type, topK, minImportance });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] searchMemories error:', err);
        return null;
    }
}

/**
 * List memories by type.
 */
export async function listMemories(
    type?: 'episodic' | 'semantic' | 'procedural',
    limit: number = 20
): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiMemoryStore', { timeout: 30000 });
        const result = await fn({ action: 'list', type, limit });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] listMemories error:', err);
        return null;
    }
}

/**
 * Update a memory entry.
 */
export async function updateMemory(
    memoryId: string,
    updates: { content?: string; type?: string; importance?: number; keywords?: string[] }
): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiMemoryStore', { timeout: 30000 });
        const result = await fn({ action: 'update', memoryId, updates });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] updateMemory error:', err);
        return null;
    }
}

/**
 * Delete a memory entry.
 */
export async function deleteMemory(memoryId: string): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiMemoryStore', { timeout: 30000 });
        const result = await fn({ action: 'delete', memoryId });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] deleteMemory error:', err);
        return null;
    }
}

/**
 * Consolidate old/duplicate memories.
 */
export async function consolidateMemories(
    strategy: 'summarize' | 'deduplicate' | 'importance_prune' = 'summarize',
    maxAge: number = 30,
    minCount: number = 5,
    importanceThreshold: number = 0.3
): Promise<any | null> {
    try {
        const functions = getFunctions(getFirebaseApp());
        const fn = httpsCallable(functions, 'aiMemoryConsolidate', { timeout: 300000 });
        const result = await fn({ strategy, maxAge, minCount, importanceThreshold });
        return result.data;
    } catch (err) {
        console.error('[AI Storage] consolidateMemories error:', err);
        return null;
    }
}
