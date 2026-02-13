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

export interface InsightSnapshot {
    asi: ASIData;
    alphaAlerts: AlphaAlert[];
    whaleWatch: WhaleWatchData;
    narratives: NarrativesData;
    articlesAnalyzed: number;
    lastUpdated: string | null;
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

/**
 * Vision Insight Service
 * Fetches data from the getVisionInsight Cloud Function
 */
export const VisionInsightService = {
    /**
     * Fetch the latest insight snapshot for UI rendering
     */
    async fetchSnapshot(): Promise<InsightSnapshot> {
        try {
            const getVisionInsight = httpsCallable(functions, 'getVisionInsight');
            const result = await getVisionInsight({ format: 'ui' });
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
            };
        } catch (err: any) {
            console.error('[VisionInsight] Failed to fetch snapshot:', err);
            // Return placeholder data on error
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
