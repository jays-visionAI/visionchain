/**
 * Paper Trading Service
 *
 * Firestore CRUD for paper trading agents, trades, and competitions.
 */

import { getFirebaseDb, getFirebaseAuth } from '../firebaseService';
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
    query, where, orderBy, limit, onSnapshot, serverTimestamp, increment,
    Timestamp,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import type {
    PaperAgent, PaperTrade, PaperAgentStatus, BudgetConfig,
    Competition, CompetitionEntry, PerformanceReport, ReportPeriod,
} from './types';
import { PAPER_TRADING_SEED } from './types';

// ─── Constants ─────────────────────────────────────────────────────────────

const COLLECTIONS = {
    PAPER_AGENTS: 'paperAgents',
    PAPER_TRADES: 'paperTrades',
    COMPETITIONS: 'competitions',
    COMPETITION_ENTRIES: 'competitionEntries',
} as const;

// ─── Paper Agent CRUD ──────────────────────────────────────────────────────

/** Create a new trading agent (paper or live) */
export async function createPaperAgent(config: {
    strategyId: string;
    strategyName: string;
    selectedAssets: string[];
    params: Record<string, number | string | boolean>;
    budgetConfig: BudgetConfig;
    riskProfile: 'conservative' | 'balanced' | 'aggressive';
    seedCurrency: 'KRW' | 'USDT';
    tradingMode?: 'paper' | 'live';
    competitionId?: string;
}): Promise<PaperAgent> {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const mode = config.tradingMode || 'paper';
    const seed = mode === 'paper'
        ? (config.seedCurrency === 'KRW' ? PAPER_TRADING_SEED.KRW : PAPER_TRADING_SEED.USDT)
        : (config.budgetConfig.totalBudgetEnabled ? config.budgetConfig.totalBudget : (config.seedCurrency === 'KRW' ? PAPER_TRADING_SEED.KRW : PAPER_TRADING_SEED.USDT));
    const now = new Date().toISOString();
    const prefix = mode === 'live' ? 'la' : 'pa';
    const agentId = `${prefix}_${user.uid}_${Date.now()}`;

    const agent: PaperAgent = {
        id: agentId,
        userId: user.uid,
        userEmail: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',

        // Strategy
        strategyId: config.strategyId,
        strategyName: config.strategyName,
        selectedAssets: config.selectedAssets,
        params: config.params,
        budgetConfig: config.budgetConfig,
        riskProfile: config.riskProfile,

        // Trading mode
        tradingMode: mode,

        // Seed
        seed,
        seedCurrency: config.seedCurrency,

        // Portfolio
        cashBalance: seed,
        positions: [],
        totalValue: seed,
        totalPnl: 0,
        totalPnlPercent: 0,

        // Stats
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        bestTrade: 0,
        worstTrade: 0,

        // Status
        status: 'running',
        competitionId: mode === 'paper' ? (config.competitionId || null) : null,

        // Timestamps
        createdAt: now,
        updatedAt: now,
        lastTradeAt: null,
    };

    await setDoc(doc(db, COLLECTIONS.PAPER_AGENTS, agentId), agent);
    return agent;
}

/** Get all paper agents for the current user */
export async function getUserPaperAgents(): Promise<PaperAgent[]> {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return [];

    const q = query(
        collection(db, COLLECTIONS.PAPER_AGENTS),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as PaperAgent);
}

/** Get a single paper agent by ID */
export async function getPaperAgent(agentId: string): Promise<PaperAgent | null> {
    const db = getFirebaseDb();
    const snap = await getDoc(doc(db, COLLECTIONS.PAPER_AGENTS, agentId));
    return snap.exists() ? (snap.data() as PaperAgent) : null;
}

/** Update paper agent status */
export async function updatePaperAgentStatus(agentId: string, status: PaperAgentStatus): Promise<void> {
    const db = getFirebaseDb();
    await updateDoc(doc(db, COLLECTIONS.PAPER_AGENTS, agentId), {
        status,
        updatedAt: new Date().toISOString(),
    });
}

/** Delete a paper agent */
export async function deletePaperAgent(agentId: string): Promise<void> {
    const db = getFirebaseDb();
    await deleteDoc(doc(db, COLLECTIONS.PAPER_AGENTS, agentId));
}

/** Update paper agent configuration (assets, params, risk profile) */
export async function updatePaperAgentConfig(agentId: string, updates: {
    selectedAssets?: string[];
    params?: Record<string, number | string | boolean>;
    riskProfile?: 'conservative' | 'balanced' | 'aggressive';
    budgetConfig?: BudgetConfig;
}): Promise<void> {
    const db = getFirebaseDb();
    const data: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (updates.selectedAssets) data.selectedAssets = updates.selectedAssets;
    if (updates.params) data.params = updates.params;
    if (updates.riskProfile) data.riskProfile = updates.riskProfile;
    if (updates.budgetConfig) data.budgetConfig = updates.budgetConfig;
    await updateDoc(doc(db, COLLECTIONS.PAPER_AGENTS, agentId), data);
}

/** Subscribe to user's paper agents (realtime) */
export function subscribeToPaperAgents(
    callback: (agents: PaperAgent[]) => void,
): () => void {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
        callback([]);
        return () => { };
    }

    const q = query(
        collection(db, COLLECTIONS.PAPER_AGENTS),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
    );

    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => d.data() as PaperAgent));
    }, (err) => {
        console.error('[subscribeToPaperAgents] Snapshot error:', err.message, err.code);
        callback([]);
    });
}

// ─── Paper Trades ──────────────────────────────────────────────────────────

/** Get trades for a paper agent */
export async function getPaperTrades(agentId: string, max = 50): Promise<PaperTrade[]> {
    const db = getFirebaseDb();
    const q = query(
        collection(db, COLLECTIONS.PAPER_TRADES),
        where('agentId', '==', agentId),
        orderBy('timestamp', 'desc'),
        limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as PaperTrade);
}

// ─── Competition ───────────────────────────────────────────────────────────

/** Get active competition (returns first found) */
export async function getActiveCompetition(): Promise<Competition | null> {
    const db = getFirebaseDb();
    const q = query(
        collection(db, COLLECTIONS.COMPETITIONS),
        where('status', '==', 'active'),
        limit(1),
    );
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as Competition);
}

/** Get all active competitions (for both divisions) */
export async function getActiveCompetitions(): Promise<Competition[]> {
    const db = getFirebaseDb();
    const q = query(
        collection(db, COLLECTIONS.COMPETITIONS),
        where('status', '==', 'active'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Competition);
}

/** Get all competitions */
export async function getCompetitions(max = 10): Promise<Competition[]> {
    const db = getFirebaseDb();
    const q = query(
        collection(db, COLLECTIONS.COMPETITIONS),
        orderBy('startDate', 'desc'),
        limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Competition);
}

/** Get leaderboard for a competition */
export async function getCompetitionLeaderboard(competitionId: string, max = 50): Promise<CompetitionEntry[]> {
    const db = getFirebaseDb();
    const q = query(
        collection(db, COLLECTIONS.COMPETITION_ENTRIES),
        where('competitionId', '==', competitionId),
        orderBy('currentPnlPercent', 'desc'),
        limit(max),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ ...d.data(), rank: i + 1 } as CompetitionEntry));
}

/** Join a competition */
export async function joinCompetition(competitionId: string, agent: PaperAgent): Promise<void> {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const entryId = `${competitionId}_${user.uid}`;
    const entry: CompetitionEntry & { competitionId: string } = {
        competitionId,
        userId: user.uid,
        userEmail: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        agentId: agent.id,
        strategyName: agent.strategyName,
        selectedAssets: agent.selectedAssets,
        currentValue: agent.seed,
        currentPnl: 0,
        currentPnlPercent: 0,
        totalTrades: 0,
        winRate: 0,
        rank: 0,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, COLLECTIONS.COMPETITION_ENTRIES, entryId), entry);

    // Increment participant count
    await updateDoc(doc(db, COLLECTIONS.COMPETITIONS, competitionId), {
        participantCount: increment(1),
    });
}

/** Subscribe to competition leaderboard (realtime) */
export function subscribeToLeaderboard(
    competitionId: string,
    callback: (entries: CompetitionEntry[]) => void,
): () => void {
    const db = getFirebaseDb();
    const q = query(
        collection(db, COLLECTIONS.COMPETITION_ENTRIES),
        where('competitionId', '==', competitionId),
        orderBy('currentPnlPercent', 'desc'),
        limit(50),
    );

    return onSnapshot(q, (snap) => {
        callback(snap.docs.map((d, i) => ({ ...d.data(), rank: i + 1 } as CompetitionEntry)));
    }, () => callback([]));
}

// ─── Paper Trades Subscription ─────────────────────────────────────────────

/** Subscribe to recent trades for a paper agent (realtime) */
export function subscribeToPaperTrades(
    agentId: string,
    callback: (trades: PaperTrade[]) => void,
    max = 50,
): () => void {
    const db = getFirebaseDb();
    const q = query(
        collection(db, 'paperTrades'),
        where('agentId', '==', agentId),
        orderBy('timestamp', 'desc'),
        limit(max),
    );

    return onSnapshot(q, (snap) => {
        callback(snap.docs.map(d => d.data() as PaperTrade));
    }, (err) => {
        console.error('[subscribeToPaperTrades] Error:', err.message);
        callback([]);
    });
}

// ─── Performance Reports ───────────────────────────────────────────────────

/** Fetch performance report from Cloud Function */
export async function fetchPaperReport(
    agentId: string,
    period: ReportPeriod = 'weekly',
): Promise<PerformanceReport | null> {
    try {
        const functions = getFunctions();
        const callable = httpsCallable(functions, 'getPaperReport');
        const result = await callable({ agentId, period });
        const data = result.data as { success: boolean; report?: PerformanceReport };
        return data.success && data.report ? data.report : null;
    } catch (err: any) {
        console.error('[fetchPaperReport] Error:', err.message);
        return null;
    }
}
