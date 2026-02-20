/**
 * Vision Mobile Node - Storage Cache Service
 *
 * Provides local caching of network data to serve nearby users:
 * 1. On-chain messenger message history (encrypted)
 * 2. NFT metadata (images, JSON)
 * 3. Recent block headers for fast verification
 *
 * The cache acts as a distributed CDN for Vision Chain dApps,
 * reducing load on centralized servers and earning +0.1x weight.
 *
 * Cache eviction: LRU (least recently used) when max size reached.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiUrl } from './config';
import { CONFIG } from './config';

const CACHE_PREFIX = '@vmn_cache/';
const CACHE_INDEX_KEY = '@vmn_cache_index';

export interface CacheEntry {
    key: string;
    data: string;
    type: 'message' | 'nft_metadata' | 'block_header' | 'other';
    size: number;
    lastAccessed: number;
    createdAt: number;
    ttlMs: number; // time-to-live in ms, 0 = no expiry
}

export interface CacheStats {
    isRunning: boolean;
    totalEntries: number;
    totalSizeBytes: number;
    maxSizeBytes: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
}

type CacheCallback = (stats: CacheStats) => void;

class StorageCache {
    private entries: Map<string, CacheEntry> = new Map();
    private listeners: CacheCallback[] = [];
    private apiKey: string | null = null;
    private syncTimer: ReturnType<typeof setInterval> | null = null;
    private stats: CacheStats = {
        isRunning: false,
        totalEntries: 0,
        totalSizeBytes: 0,
        maxSizeBytes: CONFIG.MAX_CACHE_SIZE_MB * 1024 * 1024,
        cacheHits: 0,
        cacheMisses: 0,
        hitRate: 0,
    };

    // Sync with backend every 5 minutes
    private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000;

    /**
     * Start the cache service
     */
    async start(apiKey: string, maxSizeMb?: number): Promise<void> {
        if (this.stats.isRunning) {
            return;
        }

        this.apiKey = apiKey;
        if (maxSizeMb) {
            this.stats.maxSizeBytes = maxSizeMb * 1024 * 1024;
        }

        // Load cached index from AsyncStorage
        await this.loadIndex();

        this.stats.isRunning = true;

        // Start periodic sync with backend
        this.syncTimer = setInterval(() => this.syncWithBackend(), this.SYNC_INTERVAL_MS);

        this.notifyListeners();
        console.log(
            `[StorageCache] Started (${this.entries.size} entries, ${(this.stats.totalSizeBytes / 1024).toFixed(1)} KB)`,
        );
    }

    /**
     * Stop the cache service
     */
    async stop(): Promise<void> {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }

        await this.saveIndex();
        this.stats.isRunning = false;
        this.notifyListeners();
        console.log('[StorageCache] Stopped');
    }

    /**
     * Get a cached item
     */
    async get(key: string): Promise<string | null> {
        const entry = this.entries.get(key);
        if (!entry) {
            this.stats.cacheMisses++;
            this.updateHitRate();
            return null;
        }

        // Check TTL expiry
        if (entry.ttlMs > 0 && Date.now() - entry.createdAt > entry.ttlMs) {
            await this.remove(key);
            this.stats.cacheMisses++;
            this.updateHitRate();
            return null;
        }

        // Update last accessed time
        entry.lastAccessed = Date.now();
        this.stats.cacheHits++;
        this.updateHitRate();

        return entry.data;
    }

    /**
     * Store an item in cache
     */
    async put(
        key: string,
        data: string,
        type: CacheEntry['type'] = 'other',
        ttlMs: number = 0,
    ): Promise<void> {
        const size = data.length * 2; // Rough estimate for UTF-16

        // Evict if needed
        while (this.stats.totalSizeBytes + size > this.stats.maxSizeBytes) {
            const evicted = this.evictLRU();
            if (!evicted) {
                break; // Nothing left to evict
            }
        }

        // Check if we have room after eviction
        if (this.stats.totalSizeBytes + size > this.stats.maxSizeBytes) {
            console.warn('[StorageCache] Cannot fit entry, skipping');
            return;
        }

        const entry: CacheEntry = {
            key,
            data,
            type,
            size,
            lastAccessed: Date.now(),
            createdAt: Date.now(),
            ttlMs,
        };

        // Remove old entry size if overwriting
        const existing = this.entries.get(key);
        if (existing) {
            this.stats.totalSizeBytes -= existing.size;
        }

        this.entries.set(key, entry);
        this.stats.totalSizeBytes += size;
        this.stats.totalEntries = this.entries.size;

        // Persist to AsyncStorage
        await AsyncStorage.setItem(CACHE_PREFIX + key, data);

        this.notifyListeners();
    }

    /**
     * Remove an item from cache
     */
    async remove(key: string): Promise<void> {
        const entry = this.entries.get(key);
        if (entry) {
            this.stats.totalSizeBytes -= entry.size;
            this.entries.delete(key);
            this.stats.totalEntries = this.entries.size;
            await AsyncStorage.removeItem(CACHE_PREFIX + key);
        }
    }

    /**
     * Evict the least recently used entry
     */
    private evictLRU(): boolean {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.entries) {
            if (entry.lastAccessed < oldestTime) {
                oldestTime = entry.lastAccessed;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            const entry = this.entries.get(oldestKey)!;
            this.stats.totalSizeBytes -= entry.size;
            this.entries.delete(oldestKey);
            this.stats.totalEntries = this.entries.size;
            AsyncStorage.removeItem(CACHE_PREFIX + oldestKey).catch(() => { });
            console.log(`[StorageCache] Evicted: ${oldestKey}`);
            return true;
        }

        return false;
    }

    /**
     * Clear entire cache
     */
    async clear(): Promise<void> {
        const keys = Array.from(this.entries.keys());
        for (const key of keys) {
            await AsyncStorage.removeItem(CACHE_PREFIX + key);
        }
        this.entries.clear();
        this.stats.totalEntries = 0;
        this.stats.totalSizeBytes = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        this.stats.hitRate = 0;
        await AsyncStorage.removeItem(CACHE_INDEX_KEY);
        this.notifyListeners();
    }

    /**
     * Sync cache status with backend (report what we're caching)
     */
    private async syncWithBackend(): Promise<void> {
        if (!this.apiKey) {
            return;
        }

        try {
            await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mobile_node.cache_report',
                    api_key: this.apiKey,
                    cache_stats: {
                        total_entries: this.stats.totalEntries,
                        total_size_bytes: this.stats.totalSizeBytes,
                        max_size_bytes: this.stats.maxSizeBytes,
                        hit_rate: this.stats.hitRate,
                        entry_types: this.getTypeBreakdown(),
                    },
                }),
            });
        } catch {
            // Non-critical
        }
    }

    /**
     * Get breakdown of cache entries by type
     */
    private getTypeBreakdown(): Record<string, number> {
        const breakdown: Record<string, number> = {};
        for (const entry of this.entries.values()) {
            breakdown[entry.type] = (breakdown[entry.type] || 0) + 1;
        }
        return breakdown;
    }

    /**
     * Load cache index from persistent storage
     */
    private async loadIndex(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(CACHE_INDEX_KEY);
            if (raw) {
                const index: Array<Omit<CacheEntry, 'data'>> = JSON.parse(raw);
                let totalSize = 0;

                for (const meta of index) {
                    const data = await AsyncStorage.getItem(CACHE_PREFIX + meta.key);
                    if (data) {
                        this.entries.set(meta.key, { ...meta, data } as CacheEntry);
                        totalSize += meta.size;
                    }
                }

                this.stats.totalEntries = this.entries.size;
                this.stats.totalSizeBytes = totalSize;
            }
        } catch (err) {
            console.warn('[StorageCache] Failed to load index:', err);
        }
    }

    /**
     * Save cache index to persistent storage (metadata only, not data)
     */
    private async saveIndex(): Promise<void> {
        try {
            const index = Array.from(this.entries.values()).map(
                ({ key, type, size, lastAccessed, createdAt, ttlMs }) => ({
                    key,
                    type,
                    size,
                    lastAccessed,
                    createdAt,
                    ttlMs,
                }),
            );
            await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
        } catch (err) {
            console.warn('[StorageCache] Failed to save index:', err);
        }
    }

    private updateHitRate(): void {
        const total = this.stats.cacheHits + this.stats.cacheMisses;
        this.stats.hitRate = total > 0 ? Math.round((this.stats.cacheHits / total) * 100) : 0;
    }

    getStats(): CacheStats {
        return { ...this.stats };
    }

    onChange(callback: CacheCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notifyListeners(): void {
        const stats = this.getStats();
        this.listeners.forEach(cb => cb(stats));
    }
}

export const storageCache = new StorageCache();
