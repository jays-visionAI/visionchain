/**
 * Reward Calculation Engine (C2–C6)
 *
 * Implements the full reward calculation pipeline:
 *   C2: Quality Score (Q_i)
 *   C3: Allocation Pool rewards
 *   C4: Usage Pool rewards
 *   C5: Quality Pool rewards
 *   C6: Integrated engine (end-to-end)
 *
 * All calculations are pure functions that accept data and return results.
 * The integrated engine (C6) orchestrates everything and produces a snapshot.
 */

import type { RewardPolicy } from './rewardPolicyModel';
import type { RewardMetricsMonthly } from './nodeMetricsModel';
import type {
    RewardSnapshotMonthly,
    RewardSnapshotNodeLineItem,
} from './rewardSnapshotModel';
import { generateSnapshotId } from './rewardSnapshotModel';

// ═══════════════════════════════════════════════════════════
// C2 — Quality Score Calculator
// ═══════════════════════════════════════════════════════════

export interface QualityScoreResult {
    qualityScore: number;   // Q_i (0~1)
    latencyScore: number;   // L_i (0~1)
    cutoffApplied: boolean; // true if cutoff zeroed the score
    cutoffReason?: string;  // Why cutoff was applied
}

/**
 * Calculate the quality score Q_i for a single node.
 *
 * Formula:
 *   L_i = clip((latMax - latency) / (latMax - latMin), 0, 1)
 *   Q_i = (uptime ^ w_u) * (auditRate ^ w_v) * (L_i ^ w_l)
 *
 * Cutoff:
 *   If uptime < uptimeCutoff → Q = 0
 *   If auditSuccessRate < auditCutoff → Q = 0
 */
export function calculateQualityScore(
    metrics: RewardMetricsMonthly,
    policy: RewardPolicy,
): QualityScoreResult {
    // ── Cutoff checks ──
    if (metrics.uptime < policy.uptimeCutoff) {
        return {
            qualityScore: 0,
            latencyScore: 0,
            cutoffApplied: true,
            cutoffReason: `uptime ${(metrics.uptime * 100).toFixed(1)}% < cutoff ${(policy.uptimeCutoff * 100).toFixed(1)}%`,
        };
    }

    if (metrics.auditSuccessRate < policy.auditCutoff) {
        return {
            qualityScore: 0,
            latencyScore: 0,
            cutoffApplied: true,
            cutoffReason: `auditRate ${(metrics.auditSuccessRate * 100).toFixed(1)}% < cutoff ${(policy.auditCutoff * 100).toFixed(1)}%`,
        };
    }

    // ── Latency score ──
    // L_i = clip((latMax - lat_i) / (latMax - latMin), 0, 1)
    const latRange = policy.latencyMaxMs - policy.latencyMinMs;
    let latencyScore = 1.0;
    if (latRange > 0) {
        latencyScore = Math.max(0, Math.min(1,
            (policy.latencyMaxMs - metrics.p95LatencyMs) / latRange,
        ));
    }

    // ── Quality score ──
    // Q_i = (U_i ^ w_u) * (V_i ^ w_v) * (L_i ^ w_l)
    const qualityScore =
        Math.pow(metrics.uptime, policy.qualityWeightUptime) *
        Math.pow(metrics.auditSuccessRate, policy.qualityWeightAudit) *
        Math.pow(latencyScore, policy.qualityWeightLatency);

    return {
        qualityScore: round6(qualityScore),
        latencyScore: round6(latencyScore),
        cutoffApplied: false,
    };
}

// ═══════════════════════════════════════════════════════════
// C3 — Allocation Pool Calculator
// ═══════════════════════════════════════════════════════════

export interface NodePoolReward {
    nodeId: string;
    weight: number;
    rewardUSD: number;
}

/**
 * Calculate Allocation Pool rewards for all nodes.
 *
 * Formula (alpha split):
 *   AC_eff = min(AC_i, lambda * UC_i)
 *   W_i^alloc = (alpha * AC_i + (1 - alpha) * AC_eff) * Q_i
 *
 * When alpha = 0.3:
 *   - 30% of weight comes from pure allocation (incentivizes capacity)
 *   - 70% of weight comes from usage-linked allocation (incentivizes real usage)
 *   Reward_i = poolAllocUSD * (W_i / sum(W_j))
 */
export function calculateAllocPool(
    nodes: Array<{ nodeId: string; metrics: RewardMetricsMonthly; qualityScore: number }>,
    policy: RewardPolicy,
    poolAllocUSD: number,
): NodePoolReward[] {
    const alpha = policy.allocPureRatio ?? 0.3;

    // Calculate weights
    const weighted = nodes.map(n => {
        const acEff = Math.min(n.metrics.AC_gb_month, policy.allocationCapLambda * n.metrics.UC_gb_month);
        const weight = (alpha * n.metrics.AC_gb_month + (1 - alpha) * acEff) * n.qualityScore;
        return { nodeId: n.nodeId, weight };
    });

    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

    return weighted.map(w => ({
        nodeId: w.nodeId,
        weight: round6(w.weight),
        rewardUSD: totalWeight > 0
            ? round6(poolAllocUSD * (w.weight / totalWeight))
            : 0,
    }));
}

// ═══════════════════════════════════════════════════════════
// C4 — Usage Pool Calculator
// ═══════════════════════════════════════════════════════════

/**
 * Calculate Usage Pool rewards for all nodes.
 *
 * Formula:
 *   W_i^use = UC_i * Q_i
 *   Reward_i = poolUseUSD * (W_i / sum(W_j))
 */
export function calculateUsePool(
    nodes: Array<{ nodeId: string; metrics: RewardMetricsMonthly; qualityScore: number }>,
    poolUseUSD: number,
): NodePoolReward[] {
    const weighted = nodes.map(n => ({
        nodeId: n.nodeId,
        weight: n.metrics.UC_gb_month * n.qualityScore,
    }));

    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

    return weighted.map(w => ({
        nodeId: w.nodeId,
        weight: round6(w.weight),
        rewardUSD: totalWeight > 0
            ? round6(poolUseUSD * (w.weight / totalWeight))
            : 0,
    }));
}

// ═══════════════════════════════════════════════════════════
// C5 — Quality Pool Calculator
// ═══════════════════════════════════════════════════════════

/**
 * Calculate Quality Pool rewards for all nodes.
 *
 * Formula:
 *   W_i^qual = sqrt(UC_i) * Q_i
 *   Reward_i = poolQualUSD * (W_i / sum(W_j))
 */
export function calculateQualityPool(
    nodes: Array<{ nodeId: string; metrics: RewardMetricsMonthly; qualityScore: number }>,
    poolQualUSD: number,
): NodePoolReward[] {
    const weighted = nodes.map(n => ({
        nodeId: n.nodeId,
        weight: Math.sqrt(n.metrics.UC_gb_month) * n.qualityScore,
    }));

    const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

    return weighted.map(w => ({
        nodeId: w.nodeId,
        weight: round6(w.weight),
        rewardUSD: totalWeight > 0
            ? round6(poolQualUSD * (w.weight / totalWeight))
            : 0,
    }));
}

// ═══════════════════════════════════════════════════════════
// C6 — Integrated Reward Engine
// ═══════════════════════════════════════════════════════════

export interface RewardEngineInput {
    month: string;                       // "YYYY-MM"
    revenueUSD: number;                  // Total monthly revenue
    fxRateUsdPerVcn: number;             // USD/VCN exchange rate
    policy: RewardPolicy;                // Active reward policy
    nodeMetrics: RewardMetricsMonthly[]; // All node metrics for the month
}

export interface RewardEngineOutput {
    snapshot: RewardSnapshotMonthly;
    lineItems: RewardSnapshotNodeLineItem[];
    summary: {
        totalPoolUSD: number;
        allocPoolResult: number;
        usePoolResult: number;
        qualPoolResult: number;
        nodesRewarded: number;
        nodesCutoff: number;
        verificationOk: boolean;         // true if sum == poolUSD (within tolerance)
    };
}

/**
 * Run the full reward calculation engine.
 *
 * Pipeline:
 *   1. Calculate pool budgets from revenue + policy
 *   2. Calculate quality scores for all nodes
 *   3. Calculate alloc/use/qual pool rewards
 *   4. Merge into per-node line items
 *   5. Build snapshot with totals
 */
export function runRewardEngine(input: RewardEngineInput): RewardEngineOutput {
    const { month, revenueUSD, fxRateUsdPerVcn, policy, nodeMetrics } = input;

    // ── Step 1: Pool budgets ──
    const poolUSD = round6(revenueUSD * policy.rewardPoolRatio);
    const poolAllocUSD = round6(poolUSD * policy.allocPoolRatio);
    const poolUseUSD = round6(poolUSD * policy.usePoolRatio);
    const poolQualUSD = round6(poolUSD * policy.qualityPoolRatio);

    // ── Step 2: Quality scores ──
    const nodesWithQuality = nodeMetrics.map(m => {
        const qResult = calculateQualityScore(m, policy);
        return {
            nodeId: m.nodeId,
            metrics: m,
            qualityScore: qResult.qualityScore,
            cutoffApplied: qResult.cutoffApplied,
            cutoffReason: qResult.cutoffReason,
        };
    });

    // ── Step 3: Pool rewards ──
    const allocRewards = calculateAllocPool(nodesWithQuality, policy, poolAllocUSD);
    const useRewards = calculateUsePool(nodesWithQuality, poolUseUSD);
    const qualRewards = calculateQualityPool(nodesWithQuality, poolQualUSD);

    // Build lookup maps
    const allocMap = new Map(allocRewards.map(r => [r.nodeId, r]));
    const useMap = new Map(useRewards.map(r => [r.nodeId, r]));
    const qualMap = new Map(qualRewards.map(r => [r.nodeId, r]));

    // ── Step 4: Build line items ──
    const now = new Date().toISOString();
    const snapshotId = generateSnapshotId();

    const lineItems: RewardSnapshotNodeLineItem[] = nodesWithQuality.map(n => {
        const alloc = allocMap.get(n.nodeId)?.rewardUSD ?? 0;
        const use = useMap.get(n.nodeId)?.rewardUSD ?? 0;
        const qual = qualMap.get(n.nodeId)?.rewardUSD ?? 0;
        const totalUSD = round6(alloc + use + qual);
        const vcn = fxRateUsdPerVcn > 0 ? round6(totalUSD / fxRateUsdPerVcn) : 0;

        return {
            snapshotId,
            nodeId: n.nodeId,
            AC_gb_month: n.metrics.AC_gb_month,
            UC_gb_month: n.metrics.UC_gb_month,
            uptime: n.metrics.uptime,
            auditSuccessRate: n.metrics.auditSuccessRate,
            p95LatencyMs: n.metrics.p95LatencyMs,
            qualityScore: n.qualityScore,
            cutoffApplied: n.cutoffApplied,
            rewardAllocUSD: alloc,
            rewardUseUSD: use,
            rewardQualUSD: qual,
            rewardTotalUSD: totalUSD,
            rewardVCN: vcn,
            createdAt: now,
        };
    });

    // ── Step 5: Totals & snapshot ──
    const totalRewardUSD = round6(lineItems.reduce((s, li) => s + li.rewardTotalUSD, 0));
    const totalRewardVCN = round6(lineItems.reduce((s, li) => s + li.rewardVCN, 0));
    const nodesRewarded = lineItems.filter(li => li.rewardTotalUSD > 0).length;
    const nodesCutoff = lineItems.filter(li => li.cutoffApplied).length;

    // Verification: total reward should equal poolUSD within floating-point tolerance
    const verificationOk = Math.abs(totalRewardUSD - poolUSD) < 0.01;

    const snapshot: RewardSnapshotMonthly = {
        snapshotId,
        month,
        policyVersion: policy.version,
        revenueUSD,
        poolUSD,
        poolAllocUSD,
        poolUseUSD,
        poolQualUSD,
        fxRateUsdPerVcn,
        totalNodesRewarded: nodesRewarded,
        totalRewardUSD,
        totalRewardVCN,
        status: 'calculated',
        createdAt: now,
    };

    return {
        snapshot,
        lineItems,
        summary: {
            totalPoolUSD: poolUSD,
            allocPoolResult: round6(allocRewards.reduce((s, r) => s + r.rewardUSD, 0)),
            usePoolResult: round6(useRewards.reduce((s, r) => s + r.rewardUSD, 0)),
            qualPoolResult: round6(qualRewards.reduce((s, r) => s + r.rewardUSD, 0)),
            nodesRewarded,
            nodesCutoff,
            verificationOk,
        },
    };
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function round6(n: number): number {
    return Math.round(n * 1000000) / 1000000;
}
