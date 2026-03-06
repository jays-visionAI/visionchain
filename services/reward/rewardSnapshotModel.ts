/**
 * Reward Snapshot Models (C1)
 *
 * Stores monthly reward calculation results.
 *
 * Firestore Collections:
 *   - `reward_snapshots`           (master)
 *   - `reward_snapshot_line_items`  (detail per node)
 *
 * Relationship: RewardSnapshotMonthly (1) → (N) RewardSnapshotNodeLineItem
 */

// ═══════════════════════════════════════════════════════════
// Master — Monthly Snapshot
// ═══════════════════════════════════════════════════════════

export type SnapshotStatus = 'draft' | 'calculated' | 'approved' | 'paid' | 'cancelled';

export interface RewardSnapshotMonthly {
    snapshotId: string;           // Auto-generated ("rs_{timestamp}_{rand}")
    month: string;                // "YYYY-MM"
    policyVersion: number;        // Policy version used for this calculation
    revenueUSD: number;           // Total monthly revenue in USD
    poolUSD: number;              // revenueUSD * rewardPoolRatio
    poolAllocUSD: number;         // poolUSD * allocPoolRatio
    poolUseUSD: number;           // poolUSD * usePoolRatio
    poolQualUSD: number;          // poolUSD * qualityPoolRatio
    fxRateUsdPerVcn: number;      // USD/VCN exchange rate at snapshot time
    totalNodesRewarded: number;   // Number of nodes receiving rewards
    totalRewardUSD: number;       // Sum of all node rewards (should equal poolUSD)
    totalRewardVCN: number;       // Sum of all VCN rewards
    status: SnapshotStatus;
    createdAt: string;            // ISO 8601
}

// ═══════════════════════════════════════════════════════════
// Detail — Per-Node Line Item
// ═══════════════════════════════════════════════════════════

export interface RewardSnapshotNodeLineItem {
    snapshotId: string;           // FK to RewardSnapshotMonthly
    nodeId: string;

    // Input metrics (copied from RewardMetricsMonthly)
    AC_gb_month: number;
    UC_gb_month: number;
    uptime: number;
    auditSuccessRate: number;
    p95LatencyMs: number;

    // Quality calculation
    qualityScore: number;         // Q_i (0~1)
    cutoffApplied: boolean;       // true if uptime/audit below threshold

    // Reward breakdown
    rewardAllocUSD: number;       // Allocation pool share
    rewardUseUSD: number;         // Usage pool share
    rewardQualUSD: number;        // Quality pool share
    rewardTotalUSD: number;       // Sum of all 3 pools
    rewardVCN: number;            // rewardTotalUSD / fxRateUsdPerVcn

    createdAt: string;            // ISO 8601
}

// ═══════════════════════════════════════════════════════════
// Collection Constants
// ═══════════════════════════════════════════════════════════

export const SNAPSHOT_COLLECTIONS = {
    SNAPSHOTS: 'reward_snapshots',
    LINE_ITEMS: 'reward_snapshot_line_items',
} as const;

// ═══════════════════════════════════════════════════════════
// ID Generator
// ═══════════════════════════════════════════════════════════

export function generateSnapshotId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `rs_${ts}_${rand}`;
}
