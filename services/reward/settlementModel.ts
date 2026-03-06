/**
 * Settlement & Payout Models (Epic D)
 *
 * D1: RevenueMonthly — monthly revenue input
 * D3: Snapshot approval workflow status
 * D4: FxRateSnapshot — USD/VCN exchange rate
 * D5: PayoutRequest — per-node payout record
 *
 * Firestore Collections:
 *   - `revenue_monthly`
 *   - `fx_rate_snapshots`
 *   - `payout_requests`
 */

// ═══════════════════════════════════════════════════════════
// D1 — Revenue Monthly
// ═══════════════════════════════════════════════════════════

export interface RevenueMonthly {
    month: string;               // "YYYY-MM" (doc ID)
    grossRevenueUSD: number;     // Total revenue before deductions
    refundUSD: number;           // Refunds/chargebacks
    netRevenueUSD: number;       // grossRevenueUSD - refundUSD
    source: string;              // Where the data comes from (e.g. "stripe", "manual")
    confirmedByAdmin: boolean;   // Admin sign-off
    createdAt: string;           // ISO 8601
    updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// D3 — Snapshot Approval Status
// ═══════════════════════════════════════════════════════════

export type ApprovalStatus = 'DRAFT' | 'FINAL' | 'APPROVED' | 'REJECTED';

export interface SnapshotApproval {
    snapshotId: string;
    status: ApprovalStatus;
    approvedBy?: string;         // Admin user ID
    rejectedBy?: string;
    rejectReason?: string;
    approvedAt?: string;
    rejectedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// D4 — FX Rate Snapshot
// ═══════════════════════════════════════════════════════════

export interface FxRateSnapshot {
    month: string;               // "YYYY-MM" (doc ID)
    usdPerVcn: number;           // How many USD per 1 VCN
    source: string;              // "twap_30d", "manual", "coingecko", etc.
    twapWindow?: string;         // e.g. "30d", "7d"
    createdAt: string;
    updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// D5 — Payout Request
// ═══════════════════════════════════════════════════════════

export type PayoutStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'held' | 'rollover';

export interface PayoutRequest {
    payoutId: string;            // Auto-generated ("po_{ts}_{rand}")
    snapshotId: string;          // FK to RewardSnapshotMonthly
    nodeId: string;
    amountUSD: number;
    amountVCN: number;
    walletAddress: string;       // Node operator's wallet
    status: PayoutStatus;
    txHash?: string;             // On-chain transaction hash (after payout)
    errorMessage?: string;
    holdReason?: string;         // Why this payout is held (e.g. "below minPayout", "no wallet")
    createdAt: string;
    updatedAt?: string;
}

// ═══════════════════════════════════════════════════════════
// Collection Constants
// ═══════════════════════════════════════════════════════════

export const SETTLEMENT_COLLECTIONS = {
    REVENUE: 'revenue_monthly',
    FX_RATES: 'fx_rate_snapshots',
    PAYOUTS: 'payout_requests',
} as const;

// ═══════════════════════════════════════════════════════════
// ID Generators
// ═══════════════════════════════════════════════════════════

export function generatePayoutId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `po_${ts}_${rand}`;
}
