import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from './firebaseService';

const functions = getFunctions(getFirebaseApp(), 'us-central1');

// Types for Vision Insight data
export interface ASIData {
    score: number;
    label: string;
    trend: 'BULLISH' | 'BEARISH' | 'STABLE';
    summary: string;
    previousScore?: number;
}

export interface AlphaAlert {
    articleId: string;
    headline: string;
    severity: 'critical' | 'warning' | 'info';
    impactScore: number;
    impactDirection: 'bullish' | 'bearish' | 'neutral';
    agentConsensus: string;
    source: string;
    url: string;
}

export interface LargeTx {
    symbol: string;
    amount: number;
    amountUsd: number;
    from: string;
    to: string;
    hash: string;
    timestamp: number;
}

export interface AgentMove {
    agentName: string;
    action: string;
    amount: string;
    timestamp: any;
}

export interface WhaleWatchData {
    netFlow: number;
    flowDirection: 'accumulation' | 'distribution' | 'neutral';
    exchangeInflow: number;
    exchangeOutflow: number;
    largeTxs: LargeTx[];
    topAgentMoves: AgentMove[];
    topSector: string;
    dataSource: string;
}

export interface CalendarEvent {
    label: string;
    date: string;
    daysUntil: number;
    impact: 'high' | 'medium' | 'low';
    previous?: number | null;
    estimate?: number | null;
    actual?: number | null;
}

export interface TrendingKeyword {
    keyword: string;
    count: number;
}

export interface NarrativesData {
    trendingKeywords: TrendingKeyword[];
    calendar: CalendarEvent[];
}

// News feed types
export interface NewsArticle {
    id: string;
    title: string;
    url: string;
    source: string;
    sourceName: string;
    category: string;
    language: string;
    sentiment: number;
    sentimentLabel: 'bullish' | 'bearish' | 'neutral';
    impactScore: number;
    severity: 'critical' | 'warning' | 'info';
    oneLiner: string;
    keywords: string[];
    publishedAt: string | null;
    collectedAt: string | null;
}

export interface CategoryInfo {
    id: string;
    label: string;
    labelKo: string;
}

export interface InsightSnapshot {
    asi: ASIData;
    alphaAlerts: AlphaAlert[];
    whaleWatch: WhaleWatchData;
    narratives: NarrativesData;
    articlesAnalyzed: number;
    lastUpdated: string | null;
    categories: CategoryInfo[];
    newsFeed: NewsArticle[];
}

export interface AgentViewData {
    timestamp: string;
    market_pulse: {
        sentiment_score: number;
        trend: string;
        consensus: string;
    };
    alpha_signals: Array<{
        id: string;
        headline: string;
        impact_score: number;
        severity: string;
        impact_direction: string;
        source: string;
        url: string;
    }>;
    whale_activity: {
        net_flow: number;
        flow_direction: string;
        exchange_inflow: number;
        exchange_outflow: number;
        large_txs: LargeTx[];
        top_sector: string;
    };
    narratives: {
        trending: string[];
        upcoming_events: Array<{
            label: string;
            date: string;
            days_until: number;
            impact: string;
        }>;
    };
}

// Default categories fallback
const DEFAULT_CATEGORIES: CategoryInfo[] = [
    { id: 'all', label: 'All', labelKo: '전체' },
    { id: 'bitcoin', label: 'Bitcoin & ETF', labelKo: '비트코인' },
    { id: 'ethereum', label: 'Ethereum & L2', labelKo: '이더리움' },
    { id: 'defi', label: 'DeFi & DEX', labelKo: '디파이' },
    { id: 'regulation', label: 'Regulation', labelKo: '규제/정책' },
    { id: 'ai_web3', label: 'AI & Web3', labelKo: 'AI & Web3' },
    { id: 'nft_gaming', label: 'NFT & Gaming', labelKo: 'NFT/게임' },
    { id: 'altcoin', label: 'Altcoins', labelKo: '알트코인' },
    { id: 'korea', label: 'Korea', labelKo: '한국' },
];

/**
 * Vision Insight Service
 * Fetches data from the getVisionInsight Cloud Function
 */
export const VisionInsightService = {
    /**
     * Fetch the latest insight snapshot + news feed for UI rendering
     */
    async fetchSnapshot(category?: string): Promise<InsightSnapshot> {
        try {
            const getVisionInsight = httpsCallable(functions, 'getVisionInsight');
            const result = await getVisionInsight({ format: 'ui', category: category || 'all' });
            const data = result.data as InsightSnapshot;

            return {
                asi: data.asi || { score: 50, label: 'Neutral', trend: 'STABLE', summary: 'Loading...' },
                alphaAlerts: data.alphaAlerts || [],
                whaleWatch: data.whaleWatch || {
                    netFlow: 0, flowDirection: 'neutral',
                    exchangeInflow: 0, exchangeOutflow: 0,
                    largeTxs: [], topAgentMoves: [],
                    topSector: 'N/A', dataSource: 'placeholder',
                },
                narratives: data.narratives || { trendingKeywords: [], calendar: [] },
                articlesAnalyzed: data.articlesAnalyzed || 0,
                lastUpdated: data.lastUpdated || null,
                categories: data.categories || DEFAULT_CATEGORIES,
                newsFeed: data.newsFeed || [],
            };
        } catch (err: any) {
            console.error('[VisionInsight] Failed to fetch snapshot:', err);
            return {
                asi: { score: 50, label: 'Neutral', trend: 'STABLE', summary: 'Data loading...' },
                alphaAlerts: [],
                whaleWatch: {
                    netFlow: 0, flowDirection: 'neutral',
                    exchangeInflow: 0, exchangeOutflow: 0,
                    largeTxs: [], topAgentMoves: [],
                    topSector: 'N/A', dataSource: 'placeholder',
                },
                narratives: { trendingKeywords: [], calendar: [] },
                articlesAnalyzed: 0,
                lastUpdated: null,
                categories: DEFAULT_CATEGORIES,
                newsFeed: [],
            };
        }
    },

    /**
     * Fetch raw JSON data for Agent View
     */
    async fetchAgentViewData(): Promise<AgentViewData | null> {
        try {
            const getVisionInsight = httpsCallable(functions, 'getVisionInsight');
            const result = await getVisionInsight({ format: 'json' });
            return result.data as AgentViewData;
        } catch (err: any) {
            console.error('[VisionInsight] Failed to fetch agent data:', err);
            return null;
        }
    },
};
