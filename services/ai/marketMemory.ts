/**
 * Market Memory Service
 * 
 * Provides market intelligence context to the AI chat by:
 * 1. Accumulating Vision Insight articles over time in Firestore (ai_memory collection)
 * 2. Searching historical articles by date range, keywords, and category
 * 3. Injecting relevant context into AI prompts
 * 
 * This bridges the gap between Vision Insight (latest snapshot only)
 * and the AI chat (needs historical context to explain past events).
 */

import { getFirestore, collection, query, where, orderBy, limit, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '../firebaseService';
import { VisionInsightService, type NewsArticle, type MarketBrief, type ASIData } from '../visionInsightService';

const db = getFirestore(getFirebaseApp());
const MEMORY_COLLECTION = 'ai_memory';
const SNAPSHOTS_COLLECTION = 'ai_market_snapshots';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StoredArticle {
    id: string;
    title: string;
    oneLiner: string;
    source: string;
    sourceName: string;
    category: string;
    sentiment: number;
    sentimentLabel: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;
    keywords: string[];
    publishedAt: string;
    storedAt: string;
}

export interface MarketSnapshot {
    id: string;         // date string: "2026-02-24"
    asiScore: number;
    asiTrend: string;
    asiSummary: string;
    tradingBias: string;
    keyRisks: string[];
    opportunities: string[];
    briefAnalysis: string;
    articleCount: number;
    topKeywords: string[];
    createdAt: string;
}

export interface MarketMemoryResult {
    articles: StoredArticle[];
    snapshot: MarketSnapshot | null;
    currentASI: ASIData | null;
    currentBrief: MarketBrief | null;
}

// ─── Ingestion ───────────────────────────────────────────────────────────────

/**
 * Ingest latest Vision Insight articles into the memory store.
 * Called periodically or when AI chat needs fresh data.
 * Deduplicates by article ID to prevent duplicates.
 */
export async function ingestLatestArticles(): Promise<number> {
    try {
        const insight = await VisionInsightService.fetchSnapshot();
        if (!insight.newsFeed || insight.newsFeed.length === 0) return 0;

        let stored = 0;
        const batch: Promise<void>[] = [];

        for (const article of insight.newsFeed) {
            if (!article.id || !article.title) continue;

            const docRef = doc(db, MEMORY_COLLECTION, article.id);
            const storedArticle: StoredArticle = {
                id: article.id,
                title: article.title,
                oneLiner: article.oneLiner || '',
                source: article.source || '',
                sourceName: article.sourceName || '',
                category: article.category || 'general',
                sentiment: article.sentiment || 0,
                sentimentLabel: article.sentimentLabel || 'neutral',
                impactScore: article.impactScore || 0,
                keywords: article.keywords || [],
                publishedAt: article.publishedAt || new Date().toISOString(),
                storedAt: new Date().toISOString(),
            };

            batch.push(
                setDoc(docRef, storedArticle, { merge: true }).then(() => { stored++; })
            );
        }

        // Also store daily market snapshot
        if (insight.asi || insight.marketBrief) {
            const today = new Date().toISOString().split('T')[0]; // "2026-02-24"
            const snapshotRef = doc(db, SNAPSHOTS_COLLECTION, today);
            const snapshot: MarketSnapshot = {
                id: today,
                asiScore: insight.asi?.score ?? 50,
                asiTrend: insight.asi?.trend ?? 'STABLE',
                asiSummary: insight.asi?.summary ?? '',
                tradingBias: insight.marketBrief?.tradingBias ?? 'NEUTRAL',
                keyRisks: insight.marketBrief?.keyRisks ?? [],
                opportunities: insight.marketBrief?.opportunities ?? [],
                briefAnalysis: insight.marketBrief?.analysis ?? '',
                articleCount: insight.newsFeed.length,
                topKeywords: insight.narratives?.trendingKeywords?.slice(0, 10).map(k => k.keyword) ?? [],
                createdAt: new Date().toISOString(),
            };
            batch.push(setDoc(snapshotRef, snapshot, { merge: true }));
        }

        await Promise.all(batch);
        console.debug(`[MarketMemory] Ingested ${stored} articles`);
        return stored;
    } catch (err) {
        console.error('[MarketMemory] Ingestion failed:', err);
        return 0;
    }
}

// ─── Search ──────────────────────────────────────────────────────────────────

/**
 * Search historical articles by keyword, category, and date range.
 * Used by AI tools and prompt context injection.
 */
export async function searchArticles(params: {
    keywords?: string[];
    category?: string;
    sentiment?: 'bullish' | 'bearish' | 'neutral';
    fromDate?: string;  // ISO date string
    toDate?: string;    // ISO date string
    maxResults?: number;
}): Promise<StoredArticle[]> {
    try {
        const colRef = collection(db, MEMORY_COLLECTION);
        const constraints: any[] = [];

        // Date range filter
        if (params.fromDate) {
            constraints.push(where('publishedAt', '>=', params.fromDate));
        }
        if (params.toDate) {
            constraints.push(where('publishedAt', '<=', params.toDate));
        }

        // Category filter
        if (params.category && params.category !== 'all') {
            constraints.push(where('category', '==', params.category));
        }

        // Sentiment filter
        if (params.sentiment) {
            constraints.push(where('sentimentLabel', '==', params.sentiment));
        }

        constraints.push(orderBy('publishedAt', 'desc'));
        constraints.push(limit(params.maxResults || 20));

        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);

        let results: StoredArticle[] = snapshot.docs.map(d => d.data() as StoredArticle);

        // Client-side keyword filtering (Firestore doesn't support full-text)
        if (params.keywords && params.keywords.length > 0) {
            const kwLower = params.keywords.map(k => k.toLowerCase());
            results = results.filter(article => {
                const textToSearch = `${article.title} ${article.oneLiner} ${article.keywords.join(' ')}`.toLowerCase();
                return kwLower.some(kw => textToSearch.includes(kw));
            });
        }

        return results;
    } catch (err) {
        console.error('[MarketMemory] Search failed:', err);
        return [];
    }
}

/**
 * Get a daily market snapshot for a specific date.
 */
export async function getMarketSnapshot(date: string): Promise<MarketSnapshot | null> {
    try {
        const docRef = doc(db, SNAPSHOTS_COLLECTION, date);
        const { getDoc } = await import('firebase/firestore');
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? snapshot.data() as MarketSnapshot : null;
    } catch (err) {
        console.error('[MarketMemory] Snapshot fetch failed:', err);
        return null;
    }
}

// ─── AI Context Generation ───────────────────────────────────────────────────

// Cache to avoid redundant ingestion within the same session
let lastIngestTime = 0;
const INGEST_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get market context for the AI prompt.
 * Automatically ingests latest articles if stale, then searches for relevant context.
 * 
 * @param userQuery - The user's question (used to determine search parameters)
 * @returns Formatted context string to inject into the AI prompt, or empty string
 */
export async function getMarketMemoryContext(userQuery: string): Promise<string> {
    try {
        // Auto-ingest if stale
        if (Date.now() - lastIngestTime > INGEST_COOLDOWN_MS) {
            ingestLatestArticles().catch(() => { }); // fire-and-forget
            lastIngestTime = Date.now();
        }

        // Detect time references in the query
        const dateRange = extractDateRange(userQuery);

        // Extract coin/topic keywords
        const keywords = extractMarketKeywords(userQuery);

        if (keywords.length === 0 && !dateRange.from) {
            return ''; // Not a market-related question
        }

        // Parallel: search articles + get current insight
        const [articles, currentInsight] = await Promise.all([
            searchArticles({
                keywords,
                fromDate: dateRange.from,
                toDate: dateRange.to,
                maxResults: 7,
            }),
            VisionInsightService.fetchSnapshot().catch(() => null),
        ]);

        if (articles.length === 0 && !currentInsight) {
            return '';
        }

        // Build context string
        let context = '\n\n[MARKET INTELLIGENCE CONTEXT - Vision Insight]\n';
        context += 'Use this data to provide evidence-based answers. Cite sources.\n\n';

        if (articles.length > 0) {
            context += `Related Articles (${articles.length} found):\n`;
            articles.forEach((a, i) => {
                const timeLabel = formatTimeLabel(a.publishedAt);
                const badge = a.sentimentLabel === 'bullish' ? 'Bullish'
                    : a.sentimentLabel === 'bearish' ? 'Bearish' : 'Neutral';
                context += `${i + 1}. "${a.title}" (${a.sourceName || a.source}, ${timeLabel}, Impact: ${a.impactScore}/10, ${badge})\n`;
                if (a.oneLiner) context += `   -> ${a.oneLiner}\n`;
                context += '\n';
            });
        }

        // Add current market state
        if (currentInsight) {
            if (currentInsight.asi) {
                context += `[Current Market Sentiment: ASI ${currentInsight.asi.score}/100 (${currentInsight.asi.trend})]\n`;
                if (currentInsight.asi.summary) {
                    context += `[ASI Summary: ${currentInsight.asi.summary}]\n`;
                }
            }
            if (currentInsight.marketBrief) {
                context += `[Trading Bias: ${currentInsight.marketBrief.tradingBias}]\n`;
                if (currentInsight.marketBrief.keyRisks?.length) {
                    context += `[Key Risks: ${currentInsight.marketBrief.keyRisks.join('; ')}]\n`;
                }
                if (currentInsight.marketBrief.opportunities?.length) {
                    context += `[Opportunities: ${currentInsight.marketBrief.opportunities.join('; ')}]\n`;
                }
            }
        }

        context += '\nINSTRUCTION: When explaining market movements, cite these sources. ';
        context += 'Say "Vision Insight에 따르면..." or "According to Vision Insight analysis...".\n';

        return context;
    } catch (err) {
        console.debug('[MarketMemory] Context generation failed:', err);
        return '';
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COIN_MAP: Record<string, string[]> = {
    'bitcoin': ['비트코인', 'btc', 'bitcoin', '비코'],
    'ethereum': ['이더리움', 'eth', 'ethereum', '이더'],
    'solana': ['솔라나', 'sol', 'solana'],
    'xrp': ['리플', 'xrp', 'ripple'],
    'dogecoin': ['도지코인', 'doge', 'dogecoin', '도지'],
    'bnb': ['bnb', '바이낸스'],
    'cardano': ['에이다', 'ada', 'cardano'],
    'polkadot': ['폴카닷', 'dot', 'polkadot'],
    'polygon': ['폴리곤', 'matic', 'pol', 'polygon'],
    'avalanche': ['아발란체', 'avax', 'avalanche'],
};

const MARKET_KEYWORDS_MAP: string[] = [
    '시장', '시세', '가격', '올랐', '떨어', '급등', '급락', '폭락', '폭등',
    '상승', '하락', '전망', '분석', '트렌드', '뉴스', '이슈', '왜',
    'market', 'price', 'pump', 'dump', 'rally', 'crash', 'surge', 'drop',
    'bull', 'bear', 'trend', 'news', 'why', 'reason', 'analysis',
    'etf', 'fed', '금리', 'rate', '규제', 'regulation', 'sec',
    '반감기', 'halving', '스테이블', 'stablecoin', 'defi',
];

function extractMarketKeywords(query: string): string[] {
    const lq = query.toLowerCase();
    const keywords: string[] = [];

    // Check coin names
    for (const [canonical, aliases] of Object.entries(COIN_MAP)) {
        if (aliases.some(a => lq.includes(a))) {
            keywords.push(canonical);
            // Also add the matched alias for article search
            const matched = aliases.find(a => lq.includes(a));
            if (matched && matched !== canonical) keywords.push(matched);
        }
    }

    // Check market keywords
    for (const kw of MARKET_KEYWORDS_MAP) {
        if (lq.includes(kw) && !keywords.includes(kw)) {
            keywords.push(kw);
        }
    }

    return keywords;
}

function extractDateRange(query: string): { from?: string; to?: string } {
    const now = new Date();
    const lq = query.toLowerCase();

    // "어제" / "yesterday"
    if (/어제|yesterday/i.test(lq)) {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        return { from: startOfDay(d), to: endOfDay(d) };
    }
    // "그저께" / "day before yesterday"
    if (/그저께|그제|day before yesterday/i.test(lq)) {
        const d = new Date(now); d.setDate(d.getDate() - 2);
        return { from: startOfDay(d), to: endOfDay(d) };
    }
    // "지난주" / "last week"
    if (/지난\s?주|last\s?week/i.test(lq)) {
        const from = new Date(now); from.setDate(from.getDate() - 7);
        return { from: startOfDay(from), to: endOfDay(now) };
    }
    // "지난달" / "last month"
    if (/지난\s?달|last\s?month/i.test(lq)) {
        const from = new Date(now); from.setMonth(from.getMonth() - 1);
        return { from: startOfDay(from), to: endOfDay(now) };
    }
    // "이번 주" / "this week"
    if (/이번\s?주|this\s?week/i.test(lq)) {
        const from = new Date(now);
        from.setDate(from.getDate() - from.getDay()); // Start of week (Sunday)
        return { from: startOfDay(from), to: endOfDay(now) };
    }
    // "N일 전" / "N days ago"
    const daysAgoMatch = lq.match(/(\d+)\s?(일|days?)\s?(전|ago)/);
    if (daysAgoMatch) {
        const days = parseInt(daysAgoMatch[1]);
        const from = new Date(now); from.setDate(from.getDate() - days);
        return { from: startOfDay(from), to: endOfDay(now) };
    }
    // "N주 전" / "N weeks ago"
    const weeksAgoMatch = lq.match(/(\d+)\s?(주|weeks?)\s?(전|ago)/);
    if (weeksAgoMatch) {
        const weeks = parseInt(weeksAgoMatch[1]);
        const from = new Date(now); from.setDate(from.getDate() - weeks * 7);
        return { from: startOfDay(from), to: endOfDay(now) };
    }
    // "N개월 전" / "N months ago"
    const monthsAgoMatch = lq.match(/(\d+)\s?(개월|months?)\s?(전|ago)/);
    if (monthsAgoMatch) {
        const months = parseInt(monthsAgoMatch[1]);
        const from = new Date(now); from.setMonth(from.getMonth() - months);
        return { from: startOfDay(from), to: endOfDay(now) };
    }
    // Specific month references: "1월", "2월", "January", etc.
    const koMonthMatch = lq.match(/(\d{1,2})월/);
    if (koMonthMatch) {
        const month = parseInt(koMonthMatch[1]) - 1; // 0-indexed
        const year = month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
        const from = new Date(year, month, 1);
        const to = new Date(year, month + 1, 0);
        return { from: startOfDay(from), to: endOfDay(to) };
    }

    // Default: no specific date → search recent 3 days
    if (MARKET_KEYWORDS_MAP.some(kw => lq.includes(kw))) {
        const from = new Date(now); from.setDate(from.getDate() - 3);
        return { from: startOfDay(from) };
    }

    return {};
}

function startOfDay(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
}

function endOfDay(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
}

function formatTimeLabel(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(isoString).toLocaleDateString();
}
