import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from './firebaseService';

// CEX Cloud Functions are deployed to asia-northeast3
const cexFunctions = getFunctions(getFirebaseApp(), 'asia-northeast3');

// =============================================================================
// Type Definitions
// =============================================================================

export interface CexCredential {
    id: string;
    exchange: 'upbit' | 'bithumb';
    label: string;
    status: 'active' | 'validating' | 'expired' | 'error';
    statusMessage: string;
    permissions: string[];
    lastSyncAt: string | null;
    lastSyncStatus: 'success' | 'error' | null;
    registeredAt: string | null;
}

export interface CexAsset {
    currency: string;
    balance: number;
    locked: number;
    avgBuyPrice: number;
    currentPrice: number;
    currentPriceUsd: number;
    valueKrw: number;
    valueUsd: number;
    profitLoss: number;
    profitLossPercent: number;
    allocationPercent: number;
    sources?: string[];
}

export interface CexPortfolioSnapshot {
    id: string;
    exchange: string;
    credentialId: string;
    assets: CexAsset[];
    totalValueKrw: number;
    totalValueUsd: number;
    totalProfitLoss: number;
    totalProfitLossPercent: number;
    snapshotAt: string | null;
    syncDurationMs: number;
}

export interface AggregatedPortfolio {
    totalValueKrw: number;
    totalValueUsd: number;
    assets: CexAsset[];
    lastUpdated: string | null;
}

// =============================================================================
// CEX Service Functions
// =============================================================================

/**
 * Register a new CEX API key.
 * The key is validated against the exchange, encrypted, and stored server-side.
 * An initial portfolio sync is triggered automatically.
 */
export async function registerCexApiKey(params: {
    exchange: 'upbit' | 'bithumb';
    accessKey: string;
    secretKey: string;
    label?: string;
}): Promise<{ success: boolean; credentialId: string; exchange: string; label: string }> {
    const fn = httpsCallable(cexFunctions, 'registerCexApiKey');
    const result = await fn(params);
    return result.data as { success: boolean; credentialId: string; exchange: string; label: string };
}

/**
 * Delete a CEX API key and all related portfolio snapshots.
 */
export async function deleteCexApiKey(credentialId: string): Promise<{ success: boolean }> {
    const fn = httpsCallable(cexFunctions, 'deleteCexApiKey');
    const result = await fn({ credentialId });
    return result.data as { success: boolean };
}

/**
 * List all registered CEX API keys for the current user.
 * Returns metadata only - raw API keys are NEVER exposed to the client.
 */
export async function listCexApiKeys(): Promise<CexCredential[]> {
    const fn = httpsCallable(cexFunctions, 'listCexApiKeys');
    const result = await fn({});
    return result.data as CexCredential[];
}

/**
 * Manually trigger a portfolio sync for a specific credential.
 * Fetches latest balances and prices from the exchange.
 */
export async function syncCexPortfolio(credentialId: string): Promise<{
    success: boolean;
    snapshot: CexPortfolioSnapshot;
}> {
    const fn = httpsCallable(cexFunctions, 'syncCexPortfolio');
    const result = await fn({ credentialId });
    return result.data as { success: boolean; snapshot: CexPortfolioSnapshot };
}

/**
 * Get aggregated portfolio data from all connected exchanges.
 * Returns individual exchange snapshots and a combined aggregation.
 */
export async function getCexPortfolio(): Promise<{
    portfolios: CexPortfolioSnapshot[];
    aggregated: AggregatedPortfolio | null;
}> {
    const fn = httpsCallable(cexFunctions, 'getCexPortfolio');
    const result = await fn({});
    return result.data as {
        portfolios: CexPortfolioSnapshot[];
        aggregated: AggregatedPortfolio | null;
    };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get coin icon URL for a given symbol.
 * Returns empty string - the UI renders a fallback with the symbol's initials.
 * Icon URLs can be extended in the future by fetching from the backend snapshot data.
 */
export function getCoinIconUrl(_symbol: string): string {
    return '';
}

/**
 * Format KRW value with commas
 */
export function formatKrw(value: number): string {
    return value.toLocaleString('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 });
}

/**
 * Format USD value
 */
export function formatUsd(value: number): string {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Get relative time string (e.g., "2 min ago", "1 hour ago")
 */
export function getRelativeTime(isoString: string | null): string {
    if (!isoString) return 'Never';
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;

    if (diffMs < 60_000) return 'Just now';
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return `${Math.floor(diffMs / 86_400_000)}d ago`;
}
