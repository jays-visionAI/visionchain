/**
 * VPIS Firestore Service
 *
 * Client-side API for VPIS data operations.
 * Used by the admin dashboard and ingestion triggers.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseApp } from '../firebaseService';
import type {
  ConversationTurn,
  FeatureCatalogSnapshot,
  AnalysisJob,
  AnswerEvaluation,
  DailyReport,
  ExtractedItem,
  IssueCluster,
  VpisAction,
} from './vpisTypes';

const db = getFirestore(getFirebaseApp());

// ── Collection References ──────────────────────────────────────────────────

const COLLECTIONS = {
  turns: 'vpis_conversation_turns',
  catalog: 'vpis_feature_catalog',
  jobs: 'vpis_analysis_jobs',
  evaluations: 'vpis_answer_evaluations',
  reports: 'vpis_daily_reports',
  items: 'vpis_extracted_items',
  clusters: 'vpis_issue_clusters',
  actions: 'vpis_actions',
} as const;

// ── PII Masking Utility ────────────────────────────────────────────────────

const PII_PATTERNS = [
  // Email addresses
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Phone numbers (various formats)
  { regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g, replacement: '[PHONE]' },
  // Korean phone numbers
  { regex: /01[0-9]-?\d{3,4}-?\d{4}/g, replacement: '[PHONE]' },
  // Wallet addresses (0x...)
  { regex: /0x[a-fA-F0-9]{40}/g, replacement: '[WALLET_ADDR]' },
  // API keys (vcn_...)
  { regex: /vcn_[a-zA-Z0-9]{20,}/g, replacement: '[API_KEY]' },
  // Mnemonics (12+ words that look like seed phrases)
  { regex: /\b([a-z]{3,8}\s){11,23}[a-z]{3,8}\b/gi, replacement: '[MNEMONIC]' },
];

export function maskPII(text: string): string {
  let masked = text;
  for (const { regex, replacement } of PII_PATTERNS) {
    masked = masked.replace(regex, replacement);
  }
  return masked;
}

// ── Analysis Jobs ──────────────────────────────────────────────────────────

export async function createAnalysisJob(
  job: Omit<AnalysisJob, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.jobs), {
    ...job,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function getAnalysisJobs(limitCount: number = 20): Promise<AnalysisJob[]> {
  const q = query(
    collection(db, COLLECTIONS.jobs),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AnalysisJob));
}

export async function getAnalysisJob(jobId: string): Promise<AnalysisJob | null> {
  const docSnap = await getDoc(doc(db, COLLECTIONS.jobs, jobId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as AnalysisJob;
}

export async function updateAnalysisJob(
  jobId: string,
  updates: Partial<AnalysisJob>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.jobs, jobId), updates);
}

// ── Conversation Turns ─────────────────────────────────────────────────────

export async function getConversationTurns(
  filters: {
    jobId?: string;
    userId?: string;
    analysisStatus?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  limitCount: number = 50
): Promise<ConversationTurn[]> {
  let q = query(collection(db, COLLECTIONS.turns));
  const constraints: any[] = [];

  if (filters.jobId) constraints.push(where('analysisJobId', '==', filters.jobId));
  if (filters.userId) constraints.push(where('userId', '==', filters.userId));
  if (filters.analysisStatus) constraints.push(where('analysisStatus', '==', filters.analysisStatus));

  q = query(collection(db, COLLECTIONS.turns), ...constraints, limit(limitCount));
  const snapshot = await getDocs(q);
  
  let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ConversationTurn));

  // Client-side date filtering (avoids composite index)
  if (filters.dateFrom) {
    results = results.filter(t => t.timestamp >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    results = results.filter(t => t.timestamp <= filters.dateTo!);
  }

  return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ── Feature Catalog ────────────────────────────────────────────────────────

export async function getLatestFeatureCatalog(): Promise<FeatureCatalogSnapshot | null> {
  const q = query(
    collection(db, COLLECTIONS.catalog),
    orderBy('createdAt', 'desc'),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as FeatureCatalogSnapshot;
}

export async function saveFeatureCatalog(
  catalog: Omit<FeatureCatalogSnapshot, 'id' | 'createdAt'>
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTIONS.catalog), {
    ...catalog,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

// ── Daily Reports ──────────────────────────────────────────────────────────

export async function getDailyReports(limitCount: number = 30): Promise<DailyReport[]> {
  const q = query(
    collection(db, COLLECTIONS.reports),
    orderBy('reportDate', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport));
}

export async function getDailyReport(reportDate: string): Promise<DailyReport | null> {
  const q = query(
    collection(db, COLLECTIONS.reports),
    where('reportDate', '==', reportDate),
    limit(1)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() } as DailyReport;
}

// ── Answer Evaluations ─────────────────────────────────────────────────────

export async function getAnswerEvaluations(
  filters: {
    jobId?: string;
    errorSeverity?: string;
    minScore?: number;
    maxScore?: number;
  },
  limitCount: number = 50
): Promise<AnswerEvaluation[]> {
  const constraints: any[] = [];
  if (filters.jobId) constraints.push(where('jobId', '==', filters.jobId));
  if (filters.errorSeverity) constraints.push(where('errorSeverity', '==', filters.errorSeverity));

  const q = query(collection(db, COLLECTIONS.evaluations), ...constraints, limit(limitCount));
  const snapshot = await getDocs(q);
  
  let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AnswerEvaluation));

  // Client-side score filtering
  if (filters.minScore !== undefined) {
    results = results.filter(e => e.overallScore >= filters.minScore!);
  }
  if (filters.maxScore !== undefined) {
    results = results.filter(e => e.overallScore <= filters.maxScore!);
  }

  return results.sort((a, b) => a.overallScore - b.overallScore);
}

// ── Extracted Items ────────────────────────────────────────────────────────

export async function getExtractedItems(
  filters: {
    itemType?: string;
    status?: string;
    primaryCategory?: string;
    clusterId?: string;
  },
  limitCount: number = 50
): Promise<ExtractedItem[]> {
  const constraints: any[] = [];
  if (filters.itemType) constraints.push(where('itemType', '==', filters.itemType));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.primaryCategory) constraints.push(where('primaryCategory', '==', filters.primaryCategory));
  if (filters.clusterId) constraints.push(where('clusterId', '==', filters.clusterId));

  const q = query(collection(db, COLLECTIONS.items), ...constraints, limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as ExtractedItem))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export async function updateExtractedItem(
  itemId: string,
  updates: Partial<ExtractedItem>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.items, itemId), updates);
}

// ── Issue Clusters ─────────────────────────────────────────────────────────

export async function getIssueClusters(
  filters: { status?: string; itemType?: string } = {},
  limitCount: number = 50
): Promise<IssueCluster[]> {
  const constraints: any[] = [];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.itemType) constraints.push(where('itemType', '==', filters.itemType));

  const q = query(collection(db, COLLECTIONS.clusters), ...constraints, limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() } as IssueCluster))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export async function getClusterById(clusterId: string): Promise<IssueCluster | null> {
  const docSnap = await getDoc(doc(db, COLLECTIONS.clusters, clusterId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as IssueCluster;
}

// ── Actions ────────────────────────────────────────────────────────────────

export async function getVpisActions(
  filters: { status?: string; actionType?: string } = {},
  limitCount: number = 50
): Promise<VpisAction[]> {
  const constraints: any[] = [];
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.actionType) constraints.push(where('actionType', '==', filters.actionType));

  const q = query(collection(db, COLLECTIONS.actions), ...constraints, limit(limitCount));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VpisAction));
}

export async function updateVpisAction(
  actionId: string,
  updates: Partial<VpisAction>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.actions, actionId), updates);
}
