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

// ─── Phase 4: Context Caching & Long-Term Memory Types ─────────────────────

export type MemoryType = 'episodic' | 'semantic' | 'procedural';

/**
 * Gemini context cache reference.
 * Stored in Firestore: users/{email}/ai_context_cache/{cacheId}
 */
export interface ContextCache {
    cacheId: string;
    tenantId: string;
    displayName?: string;
    modelId: string;                // e.g. 'gemini-2.0-flash'
    sourceFileIds: string[];        // Files included in this cache
    tokenCount: number;
    ttlSeconds: number;
    geminiCacheName?: string;       // Gemini API cache resource name
    status: 'active' | 'expired' | 'error';
    createdAt: string;
    expireAt: string;
    lastUsedAt?: string;
}

/**
 * Long-term memory entry.
 * Stored in Firestore: users/{email}/ai_memories/{memoryId}
 */
export interface MemoryEntry {
    memoryId: string;
    tenantId: string;
    type: MemoryType;
    content: string;                // The memory text
    summary?: string;               // Condensed version
    importance: number;             // 0-1 relevance score
    source: {
        type: 'conversation' | 'file' | 'user_input' | 'system' | 'consolidation';
        referenceId?: string;       // Conversation ID, file ID, etc.
    };
    keywords?: string[];
    accessCount: number;
    lastAccessedAt?: string;
    expiresAt?: string;             // Optional auto-expiry
    isConsolidated: boolean;        // Whether merged into another memory
    consolidatedInto?: string;      // ID of the merged memory
    createdAt: string;
    updatedAt?: string;
}

/**
 * Memory consolidation record.
 * Stored in Firestore: users/{email}/ai_memory_consolidations/{id}
 */
export interface MemoryConsolidation {
    id: string;
    tenantId: string;
    sourceMemoryIds: string[];
    mergedContent: string;
    mergedMemoryId: string;         // New memory created from merge
    strategy: 'summarize' | 'deduplicate' | 'importance_prune';
    memoriesRemoved: number;
    createdAt: string;
}

/**
 * Store memory request.
 */
export interface StoreMemoryParams {
    content: string;
    type?: MemoryType;
    importance?: number;
    source?: MemoryEntry['source'];
    keywords?: string[];
    expiresAt?: string;
}

/**
 * Search memories request.
 */
export interface SearchMemoriesParams {
    query: string;
    type?: MemoryType;
    topK?: number;
    minImportance?: number;
}

/**
 * Create context cache request.
 */
export interface CreateContextCacheParams {
    fileIds: string[];
    modelId?: string;
    ttlSeconds?: number;
    displayName?: string;
}

// ─── Phase 5: Multi-tenant Access Control & Workspace ──────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type SharePermission = 'read' | 'write' | 'search';
export type AuditAction = 'file_access' | 'file_modify' | 'file_delete' | 'share_create' | 'share_access'
    | 'memory_create' | 'memory_delete' | 'search_query' | 'workspace_invite' | 'workspace_remove'
    | 'index_request' | 'embedding_generate' | 'cache_create';

/**
 * AI workspace for multi-tenant isolation.
 * Stored in Firestore: users/{email}/ai_workspaces/{workspaceId}
 */
export interface Workspace {
    workspaceId: string;
    name: string;
    description?: string;
    ownerId: string;
    members: WorkspaceMember[];
    settings: {
        defaultModelTarget: ModelTarget;
        autoIndex: boolean;
        retentionDays: number;
        maxStorageGb: number;
    };
    fileCount: number;
    totalSize: number;
    createdAt: string;
    updatedAt?: string;
}

export interface WorkspaceMember {
    email: string;
    role: WorkspaceRole;
    invitedAt: string;
    acceptedAt?: string;
    lastActiveAt?: string;
}

/**
 * Data sharing link.
 * Stored in Firestore: users/{email}/ai_data_shares/{shareId}
 */
export interface DataShareLink {
    shareId: string;
    creatorId: string;
    workspaceId?: string;
    resourceType: 'file' | 'chunk' | 'memory' | 'workspace';
    resourceIds: string[];
    permissions: SharePermission[];
    accessCount: number;
    maxAccessCount?: number;
    password?: string;
    expireAt?: string;
    isActive: boolean;
    createdAt: string;
}

/**
 * Audit log entry.
 * Stored in Firestore: users/{email}/ai_audit_logs/{logId}
 */
export interface AuditLogEntry {
    logId: string;
    tenantId: string;
    workspaceId?: string;
    action: AuditAction;
    actor: string;
    resourceType: string;
    resourceId: string;
    details?: Record<string, any>;
    ipAddress?: string;
    timestamp: string;
}

// ─── Phase 6: Monitoring & Analytics Types ─────────────────────────────────

/**
 * Daily usage metrics.
 * Stored in Firestore: users/{email}/ai_usage_metrics/{date}
 */
export interface UsageMetrics {
    date: string;                   // YYYY-MM-DD
    tenantId: string;
    apiCalls: {
        indexing: number;
        embedding: number;
        retrieval: number;
        memory: number;
        cache: number;
        total: number;
    };
    tokens: {
        embeddingOpenai: number;
        embeddingGemini: number;
        enrichmentDeepseek: number;
        cacheGemini: number;
        total: number;
    };
    storage: {
        chunksCreated: number;
        embeddingsCreated: number;
        memoriesCreated: number;
        filesIndexed: number;
    };
    updatedAt: string;
}

/**
 * System health status.
 */
export interface SystemHealth {
    timestamp: string;
    overall: 'healthy' | 'degraded' | 'down';
    components: {
        firestore: ComponentHealth;
        openaiApi: ComponentHealth;
        geminiApi: ComponentHealth;
        deepseekApi: ComponentHealth;
        contextCache: ComponentHealth;
    };
    latencyMs: {
        firestoreRead: number;
        firestoreWrite: number;
        embeddingOpenai: number;
        embeddingGemini: number;
    };
}

export interface ComponentHealth {
    status: 'healthy' | 'degraded' | 'down' | 'unconfigured';
    latencyMs?: number;
    message?: string;
    lastChecked: string;
}

/**
 * Cost breakdown by model and feature.
 */
export interface CostBreakdown {
    period: string;                 // YYYY-MM or YYYY-MM-DD
    tenantId: string;
    byModel: {
        openai: { tokens: number; estimatedCost: number };
        gemini: { tokens: number; estimatedCost: number };
        deepseek: { tokens: number; estimatedCost: number };
    };
    byFeature: {
        indexing: number;
        embedding: number;
        retrieval: number;
        memory: number;
        cache: number;
    };
    totalEstimatedCost: number;
}

/**
 * Storage analytics summary.
 */
export interface StorageAnalytics {
    tenantId: string;
    files: { total: number; indexed: number; pending: number; error: number };
    chunks: { total: number; withOpenaiEmbedding: number; withGeminiEmbedding: number };
    memories: { total: number; episodic: number; semantic: number; procedural: number; consolidated: number };
    caches: { total: number; active: number; expired: number };
    workspaces: { total: number; totalMembers: number };
    shares: { total: number; active: number };
    timestamp: string;
}
