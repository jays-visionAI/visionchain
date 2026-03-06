/**
 * AI Memory Storage Platform - Type Definitions (Phase 1: Foundation Data Layer)
 *
 * Defines the core data models for AI-ready storage:
 * - FileObject: Extended file metadata with AI indexing fields
 * - FileChunk: Semantic chunk metadata for retrieval
 * - RetrievalPolicy: Access control and search filtering
 * - IndexJob: Pipeline stage tracking for ingestion
 *
 * Design Principles:
 * 1. Raw storage와 semantic index 분리
 * 2. Document storage와 memory storage 분리
 * 3. OpenAI/Gemini용 retrieval path 분리
 * 4. Dual embedding (OpenAI + Gemini)
 * 5. Hybrid retrieval (vector + keyword + metadata filter)
 */

// ─── Enums & Constants ─────────────────────────────────────────────────────

export type ModelTarget = 'openai' | 'gemini' | 'both';

export type IndexingStatus = 'none' | 'queued' | 'processing' | 'indexed' | 'error';

export type EmbeddingStatus = 'pending' | 'processing' | 'completed' | 'error' | 'skipped';

export type ChunkType = 'text' | 'table' | 'code' | 'heading' | 'list' | 'image_caption' | 'transcript' | 'chat_turn';

export type SourceType = 'document' | 'image' | 'audio' | 'video' | 'chat_log' | 'code' | 'data' | 'other';

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export type IndexStageStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';

export type IndexJobStatus = 'queued' | 'processing' | 'completed' | 'partial' | 'error';

// ─── FileObject (AI-extended DiskFile metadata) ────────────────────────────

/**
 * AI extension fields for DiskFile.
 * These are added as optional fields to the existing DiskFile interface
 * and stored in the same Firestore document (users/{email}/disk_files/{fileId}).
 *
 * This does NOT replace DiskFile — it extends it.
 */
export interface FileObjectAiFields {
    // Content metadata
    language?: string;              // ISO 639-1 (e.g. 'ko', 'en')
    tags?: string[];                // User or auto-generated tags
    sourceType?: SourceType;

    // Parsed content URIs
    parsedTextUri?: string;         // URI to extracted plain text
    transcriptUri?: string;         // URI to audio/video transcript

    // Versioning
    version?: number;
    parentVersionId?: string;       // Previous version's fileId
    contentHash?: string;           // SHA-256 of raw content

    // Access & retention
    aclPolicy?: string;             // Reference to RetrievalPolicy ID
    retentionPolicy?: string;       // 'permanent' | 'auto_expire' | 'user_managed'

    // AI indexing state
    indexingStatus?: IndexingStatus;
    memoryEligibility?: boolean;    // Whether this file can become long-term memory
    modelCompatibility?: ModelTarget;

    // Timestamps
    indexedAt?: string;             // When indexing completed
    lastRetrievedAt?: string;       // Last time this file was used in retrieval
}

// ─── FileChunk ─────────────────────────────────────────────────────────────

/**
 * A semantic chunk derived from a FileObject.
 * Stored in Firestore: users/{email}/ai_chunks/{chunkId}
 *
 * Each chunk is independently embeddable and searchable.
 * Embedding vectors are NOT stored here — they go to the vector index (Phase 3).
 */
export interface FileChunk {
    chunkId: string;
    fileId: string;                 // Parent FileObject ID
    tenantId: string;               // User email (tenant isolation)

    // Position within document
    chunkIndex: number;             // 0-based order within file
    chunkType: ChunkType;
    sectionPath?: string;           // e.g. 'Chapter 2 > Section 2.1'
    pageRange?: { start: number; end: number };
    timeRange?: { startMs: number; endMs: number }; // For audio/video

    // Content
    text: string;                   // The actual chunk text
    summary?: string;               // AI-generated summary of this chunk
    keywords?: string[];            // Extracted keywords
    entities?: string[];            // Named entities (people, orgs, etc.)

    // Metrics
    tokenCount: number;             // Token count for context budget
    sourceHash: string;             // Hash of source text (dedup detection)

    // Embedding status (actual vectors stored separately in Phase 3)
    embeddingOpenAiStatus: EmbeddingStatus;
    embeddingGeminiStatus: EmbeddingStatus;

    // Security
    aclInheritance: boolean;        // true = inherit from parent FileObject

    // Timestamps
    createdAt: string;
    updatedAt?: string;
}

// ─── RetrievalPolicy ───────────────────────────────────────────────────────

/**
 * Access control and retrieval filtering rules.
 * Stored in Firestore: users/{email}/ai_retrieval_policy
 *
 * Applied as pre-filters BEFORE any vector/keyword search.
 */
export interface RetrievalPolicy {
    id: string;
    tenantId: string;               // User email
    workspaceId?: string;           // Optional workspace scope

    // Access control
    allowedRoles: string[];         // Roles that can access (e.g. 'owner', 'viewer')
    regionConstraint?: string;      // Geographic restriction (e.g. 'kr', 'us')
    sensitivityLevel: SensitivityLevel;

    // Model access
    modelAccessRule: ModelTarget;   // Which models can use this data

    // Metadata
    createdAt: string;
    updatedAt?: string;
}

// ─── IndexJob ──────────────────────────────────────────────────────────────

/**
 * Tracks the progress of the ingestion pipeline for a single file.
 * Stored in Firestore: users/{email}/ai_index_jobs/{jobId}
 *
 * Pipeline stages (Phase 2-3 will implement the actual processing):
 *   parse → chunk → embed_openai → embed_gemini → keyword_index → vector_index
 */
export interface IndexJobStage {
    status: IndexStageStatus;
    startedAt?: string;
    completedAt?: string;
    errorMessage?: string;
    itemCount?: number;             // e.g. number of chunks created
}

export interface IndexJob {
    jobId: string;
    fileId: string;                 // Target file
    tenantId: string;               // User email

    // Pipeline stages
    stages: {
        parse: IndexJobStage;
        chunk: IndexJobStage;
        embed_openai: IndexJobStage;
        embed_gemini: IndexJobStage;
        keyword_index: IndexJobStage;
        vector_index: IndexJobStage;
    };

    // Overall status
    status: IndexJobStatus;
    modelTarget: ModelTarget;       // Which models to index for

    // Timing
    startedAt: string;
    completedAt?: string;
    errorMessage?: string;

    // Metadata
    createdAt: string;
    updatedAt?: string;
}

// ─── Helper: Default Stage ─────────────────────────────────────────────────

export const createDefaultStage = (): IndexJobStage => ({
    status: 'pending',
});

export const createDefaultStages = (): IndexJob['stages'] => ({
    parse: createDefaultStage(),
    chunk: createDefaultStage(),
    embed_openai: createDefaultStage(),
    embed_gemini: createDefaultStage(),
    keyword_index: createDefaultStage(),
    vector_index: createDefaultStage(),
});

// ─── Request/Response types for Cloud Functions ────────────────────────────

export interface RequestIndexingParams {
    fileId: string;
    modelTarget?: ModelTarget;      // Default: 'both'
    force?: boolean;                // Re-index even if already indexed
}

export interface IndexStatusResponse {
    jobId: string;
    fileId: string;
    status: IndexJobStatus;
    stages: IndexJob['stages'];
    startedAt: string;
    completedAt?: string;
    errorMessage?: string;
}

export interface ListChunksParams {
    fileId: string;
    offset?: number;
    limit?: number;
}

export interface ListChunksResponse {
    chunks: FileChunk[];
    total: number;
    hasMore: boolean;
}

// ─── Phase 3: Embedding & Retrieval Types ──────────────────────────────────

/**
 * Embedding vector record.
 * Stored in Firestore:
 *   users/{email}/ai_embeddings_openai/{chunkId}
 *   users/{email}/ai_embeddings_gemini/{chunkId}
 */
export interface EmbeddingRecord {
    chunkId: string;
    fileId: string;
    vector: number[];               // Embedding vector
    model: string;                  // e.g. 'text-embedding-3-small' or 'text-embedding-004'
    dimensions: number;             // Vector dimensionality
    createdAt: string;
}

/**
 * Hybrid retrieval request.
 */
export interface RetrievalRequest {
    query: string;
    modelTarget: ModelTarget;       // Which embedding index to search
    topK?: number;                  // Default: 10
    filters?: {
        fileIds?: string[];         // Restrict to specific files
        sourceType?: SourceType;
        language?: string;
        tags?: string[];
    };
    includeText?: boolean;          // Include chunk text in results (default: true)
}

/**
 * Single retrieval hit.
 */
export interface RetrievalHit {
    chunkId: string;
    fileId: string;
    score: number;                  // Combined relevance score (0-1)
    vectorScore: number;            // Cosine similarity score
    keywordScore: number;           // Keyword match score
    text?: string;
    summary?: string;
    keywords?: string[];
    chunkType?: ChunkType;
    chunkIndex?: number;
    matchType: 'vector' | 'keyword' | 'hybrid';
}

/**
 * Retrieval response.
 */
export interface RetrievalResponse {
    results: RetrievalHit[];
    query: string;
    modelUsed: string;
    totalChunksSearched: number;
    searchTimeMs: number;
}

/**
 * Embedding generation result.
 */
export interface GenerateEmbeddingsResult {
    fileId: string;
    chunksProcessed: number;
    openaiEmbeddings: number;
    geminiEmbeddings: number;
    errors: number;
}
