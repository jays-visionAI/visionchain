/**
 * Operations Stability Module (Epic E: E1–E3)
 *
 * E1: Rollover / minimum payout accumulation
 * E2: Bootstrap minimum guarantee (floor rewards)
 * E3: Abuse detection & flagging
 */

import type { RewardMetricsMonthly } from './nodeMetricsModel';
import type { RewardPolicy } from './rewardPolicyModel';

// ═══════════════════════════════════════════════════════════
// E1 — Rollover Balance
// ═══════════════════════════════════════════════════════════

/**
 * NodeRolloverBalance
 * Tracks accumulated unpaid rewards for nodes below minPayout threshold.
 * Collection: `node_rollover_balances` (docId = nodeId)
 */
export interface NodeRolloverBalance {
    nodeId: string;
    accumulatedUSD: number;       // Total unpaid USD
    accumulatedVCN: number;       // Total unpaid VCN
    lastUpdatedMonth: string;     // "YYYY-MM"
    history: RolloverEntry[];     // Per-month breakdown
    createdAt: string;
    updatedAt: string;
}

export interface RolloverEntry {
    month: string;
    amountUSD: number;
    amountVCN: number;
    reason: string;               // "below_min_payout" | "no_wallet"
}

/**
 * Apply rollover logic to payout amounts.
 * Returns adjusted amounts (current + accumulated) and whether payout is eligible.
 */
export function applyRollover(
    currentUSD: number,
    currentVCN: number,
    rollover: NodeRolloverBalance | null,
    minPayoutUsd: number,
): {
    totalUSD: number;
    totalVCN: number;
    eligible: boolean;
    rolloverUSD: number;
    rolloverVCN: number;
} {
    const prevUSD = rollover?.accumulatedUSD ?? 0;
    const prevVCN = rollover?.accumulatedVCN ?? 0;
    const totalUSD = round(currentUSD + prevUSD);
    const totalVCN = round(currentVCN + prevVCN);

    if (totalUSD >= minPayoutUsd) {
        return { totalUSD, totalVCN, eligible: true, rolloverUSD: 0, rolloverVCN: 0 };
    }
    return { totalUSD: 0, totalVCN: 0, eligible: false, rolloverUSD: totalUSD, rolloverVCN: totalVCN };
}

// ═══════════════════════════════════════════════════════════
// E2 — Bootstrap Minimum Guarantee
// ═══════════════════════════════════════════════════════════

/**
 * BootstrapConfig — defines minimum reward floors by allocation tier.
 * Stored as part of RewardPolicy or separately in `bootstrap_config`.
 */
export interface BootstrapConfig {
    enabled: boolean;
    tiers: BootstrapTier[];
    qualityMinUptime: number;       // Min uptime to qualify (e.g. 0.90)
    qualityMinAudit: number;        // Min audit rate (e.g. 0.95)
    totalFloorBudgetUSD: number;    // Max budget for floor subsidies per month
}

export interface BootstrapTier {
    label: string;                  // "10GB", "50GB", "100GB"
    minAllocGb: number;             // Min allocation to qualify
    maxAllocGb: number;             // Max allocation for this tier
    floorUSD: number;               // Guaranteed minimum reward in USD
}

export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapConfig = {
    enabled: false,
    tiers: [
        { label: '10GB', minAllocGb: 10, maxAllocGb: 49, floorUSD: 0.50 },
        { label: '50GB', minAllocGb: 50, maxAllocGb: 99, floorUSD: 2.00 },
        { label: '100GB', minAllocGb: 100, maxAllocGb: 999, floorUSD: 5.00 },
    ],
    qualityMinUptime: 0.90,
    qualityMinAudit: 0.95,
    totalFloorBudgetUSD: 1000,
};

export interface BootstrapAdjustment {
    nodeId: string;
    tier: string;
    originalUSD: number;
    adjustedUSD: number;
    subsidyUSD: number;             // adjustedUSD - originalUSD (can be 0 if above floor)
}

/**
 * Apply bootstrap floor guarantees to reward results.
 * Only nodes meeting quality thresholds get floor protection.
 * Budget cap ensures floor subsidies don't exceed a limit.
 */
export function applyBootstrapFloors(
    nodes: Array<{ nodeId: string; rewardTotalUSD: number; metrics: RewardMetricsMonthly }>,
    config: BootstrapConfig,
): { adjustments: BootstrapAdjustment[]; totalSubsidy: number; budgetExceeded: boolean } {
    if (!config.enabled) {
        return {
            adjustments: nodes.map(n => ({ nodeId: n.nodeId, tier: 'none', originalUSD: n.rewardTotalUSD, adjustedUSD: n.rewardTotalUSD, subsidyUSD: 0 })),
            totalSubsidy: 0,
            budgetExceeded: false,
        };
    }

    let totalSubsidy = 0;
    const adjustments: BootstrapAdjustment[] = [];

    for (const n of nodes) {
        // Check quality thresholds
        const qualityOk = n.metrics.uptime >= config.qualityMinUptime && n.metrics.auditSuccessRate >= config.qualityMinAudit;

        if (!qualityOk) {
            adjustments.push({ nodeId: n.nodeId, tier: 'disqualified', originalUSD: n.rewardTotalUSD, adjustedUSD: n.rewardTotalUSD, subsidyUSD: 0 });
            continue;
        }

        // Find matching tier
        const tier = config.tiers.find(t => n.metrics.AC_gb_month >= t.minAllocGb && n.metrics.AC_gb_month <= t.maxAllocGb);
        if (!tier) {
            adjustments.push({ nodeId: n.nodeId, tier: 'no_tier', originalUSD: n.rewardTotalUSD, adjustedUSD: n.rewardTotalUSD, subsidyUSD: 0 });
            continue;
        }

        if (n.rewardTotalUSD >= tier.floorUSD) {
            adjustments.push({ nodeId: n.nodeId, tier: tier.label, originalUSD: n.rewardTotalUSD, adjustedUSD: n.rewardTotalUSD, subsidyUSD: 0 });
        } else {
            const subsidy = round(tier.floorUSD - n.rewardTotalUSD);
            totalSubsidy += subsidy;
            adjustments.push({ nodeId: n.nodeId, tier: tier.label, originalUSD: n.rewardTotalUSD, adjustedUSD: tier.floorUSD, subsidyUSD: subsidy });
        }
    }

    const budgetExceeded = totalSubsidy > config.totalFloorBudgetUSD;

    // If budget exceeded, scale down subsidies proportionally
    if (budgetExceeded && totalSubsidy > 0) {
        const scale = config.totalFloorBudgetUSD / totalSubsidy;
        for (const adj of adjustments) {
            if (adj.subsidyUSD > 0) {
                const scaledSubsidy = round(adj.subsidyUSD * scale);
                adj.adjustedUSD = round(adj.originalUSD + scaledSubsidy);
                adj.subsidyUSD = scaledSubsidy;
            }
        }
        totalSubsidy = round(config.totalFloorBudgetUSD);
    }

    return { adjustments, totalSubsidy: round(totalSubsidy), budgetExceeded };
}

// ═══════════════════════════════════════════════════════════
// E3 — Abuse Detection
// ═══════════════════════════════════════════════════════════

export type AbuseType = 'alloc_usage_mismatch' | 'no_proof_usage' | 'latency_anomaly' | 'heartbeat_spoof' | 'manual';

export interface AbuseFlag {
    flagId: string;
    nodeId: string;
    month: string;
    type: AbuseType;
    severity: 'low' | 'medium' | 'high';
    description: string;
    detectedAt: string;
    resolvedAt?: string;
    resolvedBy?: string;
    excluded: boolean;              // If true, node is excluded from rewards
    evidence: Record<string, any>;
}

export const ABUSE_COLLECTION = 'abuse_flags';

/**
 * Run automated abuse detection on monthly metrics.
 * Returns a list of suspicious flags to review.
 */
export function detectAbuse(
    metrics: RewardMetricsMonthly[],
    policy: RewardPolicy,
): AbuseFlag[] {
    const flags: AbuseFlag[] = [];
    const now = new Date().toISOString();

    for (const m of metrics) {
        const flagId = () => `af_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

        // 1. Alloc vs Usage mismatch: allocated >> used (ratio > 20x with significant alloc)
        if (m.AC_gb_month > 10 && m.UC_gb_month > 0 && m.AC_gb_month / m.UC_gb_month > 20) {
            flags.push({
                flagId: flagId(), nodeId: m.nodeId, month: m.month,
                type: 'alloc_usage_mismatch', severity: 'medium',
                description: `Allocation/usage ratio ${(m.AC_gb_month / m.UC_gb_month).toFixed(1)}x (AC=${m.AC_gb_month.toFixed(1)} vs UC=${m.UC_gb_month.toFixed(1)})`,
                detectedAt: now, excluded: false,
                evidence: { AC_gb_month: m.AC_gb_month, UC_gb_month: m.UC_gb_month, ratio: m.AC_gb_month / m.UC_gb_month },
            });
        }

        // 2. Usage without proof: high usage but very low audit checks
        if (m.UC_gb_month > 5 && m.totalAuditChecks < 10) {
            flags.push({
                flagId: flagId(), nodeId: m.nodeId, month: m.month,
                type: 'no_proof_usage', severity: 'high',
                description: `High usage (${m.UC_gb_month.toFixed(1)} GB) with only ${m.totalAuditChecks} audit checks`,
                detectedAt: now, excluded: false,
                evidence: { UC_gb_month: m.UC_gb_month, totalAuditChecks: m.totalAuditChecks },
            });
        }

        // 3. Latency anomaly: extremely low latency (suspiciously fast, could be spoofed)
        if (m.p95LatencyMs > 0 && m.p95LatencyMs < policy.latencyMinMs * 0.5 && m.totalObservedIntervals > 100) {
            flags.push({
                flagId: flagId(), nodeId: m.nodeId, month: m.month,
                type: 'latency_anomaly', severity: 'low',
                description: `p95 latency ${m.p95LatencyMs}ms is suspiciously low (< ${policy.latencyMinMs * 0.5}ms)`,
                detectedAt: now, excluded: false,
                evidence: { p95LatencyMs: m.p95LatencyMs, latencyMinMs: policy.latencyMinMs },
            });
        }

        // 4. Heartbeat spoof: perfect uptime with zero usage (possible fake heartbean)
        if (m.uptime >= 0.999 && m.UC_gb_month === 0 && m.AC_gb_month > 5 && m.totalObservedIntervals > 500) {
            flags.push({
                flagId: flagId(), nodeId: m.nodeId, month: m.month,
                type: 'heartbeat_spoof', severity: 'high',
                description: `Perfect uptime (${(m.uptime * 100).toFixed(2)}%) with zero usage despite ${m.AC_gb_month.toFixed(1)} GB allocated`,
                detectedAt: now, excluded: false,
                evidence: { uptime: m.uptime, UC_gb_month: m.UC_gb_month, AC_gb_month: m.AC_gb_month, intervals: m.totalObservedIntervals },
            });
        }
    }

    return flags;
}

// ═══════════════════════════════════════════════════════════
// Collection Constants
// ═══════════════════════════════════════════════════════════

export const OPS_COLLECTIONS = {
    ROLLOVER: 'node_rollover_balances',
    BOOTSTRAP: 'bootstrap_config',
    ABUSE: 'abuse_flags',
} as const;

// ═══════════════════════════════════════════════════════════

function round(n: number): number {
    return Math.round(n * 1000000) / 1000000;
}
