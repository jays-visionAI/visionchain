/**
 * Node Metrics Models
 *
 * Raw metrics and monthly aggregate models for the distributed storage reward engine.
 *
 * Firestore Collections:
 *   - `node_metrics_allocation`  (B1 raw)
 *   - `node_metrics_usage`       (B1 raw)
 *   - `node_metrics_health`      (B1 raw)
 *   - `reward_metrics_monthly`   (B2 aggregate)
 */

// ═══════════════════════════════════════════════════════════
// B1 — Raw Metric Interfaces
// ═══════════════════════════════════════════════════════════

/**
 * NodeAllocationMetric
 * Tracks how much storage a node has allocated to the network.
 * Written on each heartbeat or allocation change.
 */
export interface NodeAllocationMetric {
    nodeId: string;
    timestamp: string;      // ISO 8601
    allocatedGb: number;    // GB allocated to the network
}

/**
 * NodeUsageMetric
 * Tracks actual chunk serves / reads from a node.
 * Written when proofs are verified or chunks served.
 */
export interface NodeUsageMetric {
    nodeId: string;
    timestamp: string;      // ISO 8601
    usedGb: number;         // GB served in this interval
    proofVerified: boolean; // Whether storage proof was valid
}

/**
 * NodeHealthMetric
 * Tracks node quality signals: online status, latency, audit results.
 * Written on each heartbeat or audit check.
 */
export interface NodeHealthMetric {
    nodeId: string;
    timestamp: string;      // ISO 8601
    isOnline: boolean;
    latencyMs: number;      // Response latency in ms
    auditPassed: boolean;   // Did the storage audit pass
    auditChecked: boolean;  // Was an audit performed in this interval
}

// ═══════════════════════════════════════════════════════════
// B2 — Monthly Aggregate Model
// ═══════════════════════════════════════════════════════════

/**
 * RewardMetricsMonthly
 * Pre-computed monthly aggregation of raw metrics per node.
 * Used by the reward calculation engine (Epic C).
 *
 * Document ID pattern: `{nodeId}_{month}` (e.g., "mn_abc123_2026-04")
 */
export interface RewardMetricsMonthly {
    nodeId: string;
    month: string;                  // Format: "YYYY-MM" (e.g., "2026-04")

    // Allocation (GB-month)
    AC_gb_month: number;            // Sum of (allocatedGb * deltaHours / 730)

    // Usage (GB-month, only proofVerified)
    UC_gb_month: number;            // Sum of (usedGb * deltaHours / 730)

    // Uptime
    uptime: number;                 // Ratio: totalOnlineIntervals / totalObservedIntervals
    totalObservedIntervals: number; // Total metric observations
    totalOnlineIntervals: number;   // Observations where isOnline = true

    // Audit
    auditSuccessRate: number;       // Ratio: totalAuditSuccess / totalAuditChecks
    totalAuditChecks: number;       // Total audits performed
    totalAuditSuccess: number;      // Total audits passed

    // Latency
    p95LatencyMs: number;           // 95th percentile latency

    // Metadata
    createdAt: string;              // ISO 8601
    updatedAt: string;              // ISO 8601
}

// ═══════════════════════════════════════════════════════════
// Collection Constants
// ═══════════════════════════════════════════════════════════

export const COLLECTIONS = {
    ALLOCATION: 'node_metrics_allocation',
    USAGE: 'node_metrics_usage',
    HEALTH: 'node_metrics_health',
    MONTHLY: 'reward_metrics_monthly',
} as const;

// ═══════════════════════════════════════════════════════════
// Monthly Doc ID Helper
// ═══════════════════════════════════════════════════════════

/**
 * Generate a deterministic doc ID for monthly aggregate.
 * Ensures upsert behavior (same ID for same node+month).
 */
export function monthlyDocId(nodeId: string, month: string): string {
    return `${nodeId}_${month}`;
}

// ═══════════════════════════════════════════════════════════
// Seed / Test Samples
// ═══════════════════════════════════════════════════════════

export const SAMPLE_ALLOCATION_METRIC: NodeAllocationMetric = {
    nodeId: 'mn_test001',
    timestamp: '2026-04-01T00:00:00Z',
    allocatedGb: 50,
};

export const SAMPLE_USAGE_METRIC: NodeUsageMetric = {
    nodeId: 'mn_test001',
    timestamp: '2026-04-01T00:05:00Z',
    usedGb: 0.5,
    proofVerified: true,
};

export const SAMPLE_HEALTH_METRIC: NodeHealthMetric = {
    nodeId: 'mn_test001',
    timestamp: '2026-04-01T00:05:00Z',
    isOnline: true,
    latencyMs: 120,
    auditPassed: true,
    auditChecked: true,
};

export const SAMPLE_MONTHLY_AGGREGATE: RewardMetricsMonthly = {
    nodeId: 'mn_test001',
    month: '2026-04',
    AC_gb_month: 50,
    UC_gb_month: 12.5,
    uptime: 0.97,
    totalObservedIntervals: 8640,
    totalOnlineIntervals: 8381,
    auditSuccessRate: 0.99,
    totalAuditChecks: 720,
    totalAuditSuccess: 713,
    p95LatencyMs: 180,
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
};
