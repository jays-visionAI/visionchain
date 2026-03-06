/**
 * Node Metrics Aggregation Service
 *
 * B3: AC/UC monthly aggregation (allocation & usage GB-month)
 * B4: Uptime/Audit/Latency monthly aggregation
 * B5: Batch job entrypoint for monthly aggregation
 *
 * Calculation methods:
 *   AC_i = SUM(A_i_k * delta_k)   where delta_k is hours between samples / 730
 *   UC_i = SUM(S_i_k * delta_k)   only where proofVerified = true
 *   uptime = totalOnline / totalObserved
 *   auditSuccessRate = totalAuditSuccess / totalAuditChecks
 *   p95LatencyMs = 95th percentile of latencyMs values
 *
 * All aggregations are idempotent (upsert via deterministic doc ID).
 */

import {
    NodeAllocationMetric,
    NodeUsageMetric,
    NodeHealthMetric,
    RewardMetricsMonthly,
    COLLECTIONS,
    monthlyDocId,
} from './nodeMetricsModel';

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

/** Average hours in a month (365.25 * 24 / 12) */
const HOURS_PER_MONTH = 730;

// ═══════════════════════════════════════════════════════════
// B3 — AC / UC Aggregation
// ═══════════════════════════════════════════════════════════

/**
 * Calculate AC_gb_month from allocation metrics.
 * AC = SUM(allocatedGb_k * deltaHours_k / 730)
 *
 * Handles irregular intervals by computing actual time deltas between samples.
 */
export function calculateAC(
    metrics: NodeAllocationMetric[],
): number {
    if (metrics.length === 0) return 0;

    // Sort by timestamp ascending
    const sorted = [...metrics].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let ac = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        const deltaMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
        const deltaHours = deltaMs / (1000 * 3600);
        ac += current.allocatedGb * (deltaHours / HOURS_PER_MONTH);
    }

    // For the last sample, credit up to end of the month (or use a small duration)
    // We'll assume the last sample lasts until the next sample would have arrived (same interval as previous)
    if (sorted.length >= 2) {
        const lastDelta = new Date(sorted[sorted.length - 1].timestamp).getTime()
            - new Date(sorted[sorted.length - 2].timestamp).getTime();
        const lastDeltaHours = lastDelta / (1000 * 3600);
        ac += sorted[sorted.length - 1].allocatedGb * (lastDeltaHours / HOURS_PER_MONTH);
    } else if (sorted.length === 1) {
        // Single sample: assume 5 minutes (heartbeat interval)
        ac += sorted[0].allocatedGb * (5 / 60 / HOURS_PER_MONTH);
    }

    return Math.round(ac * 10000) / 10000;
}

/**
 * Calculate UC_gb_month from usage metrics.
 * UC = SUM(usedGb_k * deltaHours_k / 730)  where proofVerified = true
 */
export function calculateUC(
    metrics: NodeUsageMetric[],
): number {
    if (metrics.length === 0) return 0;

    // Filter to only proofVerified
    const verified = metrics.filter(m => m.proofVerified);
    if (verified.length === 0) return 0;

    const sorted = [...verified].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let uc = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        const deltaMs = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
        const deltaHours = deltaMs / (1000 * 3600);
        uc += current.usedGb * (deltaHours / HOURS_PER_MONTH);
    }

    // Last sample
    if (sorted.length >= 2) {
        const lastDelta = new Date(sorted[sorted.length - 1].timestamp).getTime()
            - new Date(sorted[sorted.length - 2].timestamp).getTime();
        const lastDeltaHours = lastDelta / (1000 * 3600);
        uc += sorted[sorted.length - 1].usedGb * (lastDeltaHours / HOURS_PER_MONTH);
    } else if (sorted.length === 1) {
        uc += sorted[0].usedGb * (5 / 60 / HOURS_PER_MONTH);
    }

    return Math.round(uc * 10000) / 10000;
}

// ═══════════════════════════════════════════════════════════
// B4 — Quality Aggregation
// ═══════════════════════════════════════════════════════════

/**
 * Calculate uptime ratio from health metrics.
 * uptime = totalOnlineIntervals / totalObservedIntervals
 */
export function calculateUptime(
    metrics: NodeHealthMetric[],
): { uptime: number; totalObserved: number; totalOnline: number } {
    if (metrics.length === 0) {
        return { uptime: 0, totalObserved: 0, totalOnline: 0 };
    }

    const totalObserved = metrics.length;
    const totalOnline = metrics.filter(m => m.isOnline).length;
    const uptime = Math.round((totalOnline / totalObserved) * 10000) / 10000;

    return { uptime, totalObserved, totalOnline };
}

/**
 * Calculate audit success rate from health metrics.
 * auditSuccessRate = totalAuditSuccess / totalAuditChecks
 * If totalAuditChecks = 0, returns { rate: 1.0 } (no audits = no failures)
 */
export function calculateAuditRate(
    metrics: NodeHealthMetric[],
): { rate: number; totalChecks: number; totalSuccess: number } {
    const audited = metrics.filter(m => m.auditChecked);
    const totalChecks = audited.length;

    if (totalChecks === 0) {
        return { rate: 1.0, totalChecks: 0, totalSuccess: 0 };
    }

    const totalSuccess = audited.filter(m => m.auditPassed).length;
    const rate = Math.round((totalSuccess / totalChecks) * 10000) / 10000;

    return { rate, totalChecks, totalSuccess };
}

/**
 * Calculate p95 latency from health metrics.
 * Only considers metrics where isOnline = true.
 */
export function calculateP95Latency(
    metrics: NodeHealthMetric[],
): number {
    const onlineLatencies = metrics
        .filter(m => m.isOnline && m.latencyMs > 0)
        .map(m => m.latencyMs)
        .sort((a, b) => a - b);

    if (onlineLatencies.length === 0) return 0;

    const idx = Math.ceil(onlineLatencies.length * 0.95) - 1;
    return onlineLatencies[Math.min(idx, onlineLatencies.length - 1)];
}

// ═══════════════════════════════════════════════════════════
// B5 — Batch Aggregation
// ═══════════════════════════════════════════════════════════

/**
 * Aggregate all metrics for a single node in a given month.
 * Returns a RewardMetricsMonthly object ready to be saved.
 */
export function aggregateNodeMonth(
    nodeId: string,
    month: string,
    allocMetrics: NodeAllocationMetric[],
    usageMetrics: NodeUsageMetric[],
    healthMetrics: NodeHealthMetric[],
): RewardMetricsMonthly {
    const ac = calculateAC(allocMetrics);
    const uc = calculateUC(usageMetrics);
    const { uptime, totalObserved, totalOnline } = calculateUptime(healthMetrics);
    const { rate: auditRate, totalChecks, totalSuccess } = calculateAuditRate(healthMetrics);
    const p95 = calculateP95Latency(healthMetrics);

    const now = new Date().toISOString();

    return {
        nodeId,
        month,
        AC_gb_month: ac,
        UC_gb_month: uc,
        uptime,
        totalObservedIntervals: totalObserved,
        totalOnlineIntervals: totalOnline,
        auditSuccessRate: auditRate,
        totalAuditChecks: totalChecks,
        totalAuditSuccess: totalSuccess,
        p95LatencyMs: p95,
        createdAt: now,
        updatedAt: now,
    };
}

// ═══════════════════════════════════════════════════════════
// Server-side batch runner (for use in Cloud Functions)
// ═══════════════════════════════════════════════════════════

/**
 * Run monthly aggregation batch for all nodes.
 *
 * This function is designed to be called from a server context
 * (Cloud Function) with admin Firestore access.
 *
 * @param db - Admin Firestore instance
 * @param month - Target month (e.g., "2026-04")
 * @returns Summary of aggregation results
 */
export async function runMonthlyAggregationBatch(
    db: any, // admin.firestore.Firestore
    month: string,
): Promise<{
    processed: number;
    failed: string[];
    skipped: number;
}> {
    const result = { processed: 0, failed: [] as string[], skipped: 0 };

    console.log(`[MetricsAggregation] Starting batch for month: ${month}`);

    // 1. Get all unique nodeIds from allocation metrics for this month
    const monthStart = `${month}-01T00:00:00Z`;
    const nextMonth = getNextMonth(month);
    const monthEnd = `${nextMonth}-01T00:00:00Z`;

    // Query allocation metrics for the month to get unique nodeIds
    const allocSnap = await db.collection(COLLECTIONS.ALLOCATION)
        .where('timestamp', '>=', monthStart)
        .where('timestamp', '<', monthEnd)
        .get();

    const nodeIds = new Set<string>();
    allocSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.nodeId) nodeIds.add(data.nodeId);
    });

    // Also check health metrics for nodes with no allocation
    const healthSnap = await db.collection(COLLECTIONS.HEALTH)
        .where('timestamp', '>=', monthStart)
        .where('timestamp', '<', monthEnd)
        .get();

    healthSnap.docs.forEach((d: any) => {
        const data = d.data();
        if (data.nodeId) nodeIds.add(data.nodeId);
    });

    console.log(`[MetricsAggregation] Found ${nodeIds.size} nodes to process`);

    if (nodeIds.size === 0) {
        console.log(`[MetricsAggregation] No nodes found for ${month}, skipping`);
        return result;
    }

    // 2. Process each node
    for (const nodeId of nodeIds) {
        try {
            // Fetch all 3 metric types for this node+month
            const [allocDocs, usageDocs, healthDocs] = await Promise.all([
                db.collection(COLLECTIONS.ALLOCATION)
                    .where('nodeId', '==', nodeId)
                    .where('timestamp', '>=', monthStart)
                    .where('timestamp', '<', monthEnd)
                    .orderBy('timestamp', 'asc')
                    .get(),
                db.collection(COLLECTIONS.USAGE)
                    .where('nodeId', '==', nodeId)
                    .where('timestamp', '>=', monthStart)
                    .where('timestamp', '<', monthEnd)
                    .orderBy('timestamp', 'asc')
                    .get(),
                db.collection(COLLECTIONS.HEALTH)
                    .where('nodeId', '==', nodeId)
                    .where('timestamp', '>=', monthStart)
                    .where('timestamp', '<', monthEnd)
                    .orderBy('timestamp', 'asc')
                    .get(),
            ]);

            const allocMetrics = allocDocs.docs.map((d: any) => d.data() as NodeAllocationMetric);
            const usageMetrics = usageDocs.docs.map((d: any) => d.data() as NodeUsageMetric);
            const healthMetrics = healthDocs.docs.map((d: any) => d.data() as NodeHealthMetric);

            // Skip if no data at all
            if (allocMetrics.length === 0 && usageMetrics.length === 0 && healthMetrics.length === 0) {
                result.skipped++;
                continue;
            }

            // Aggregate
            const aggregate = aggregateNodeMonth(nodeId, month, allocMetrics, usageMetrics, healthMetrics);

            // Upsert (deterministic doc ID prevents duplicates)
            const docId = monthlyDocId(nodeId, month);

            // Check if existing doc to preserve createdAt
            const existingDoc = await db.collection(COLLECTIONS.MONTHLY).doc(docId).get();
            if (existingDoc.exists) {
                aggregate.createdAt = existingDoc.data().createdAt;
            }

            await db.collection(COLLECTIONS.MONTHLY).doc(docId).set(aggregate);
            result.processed++;

        } catch (e: any) {
            console.error(`[MetricsAggregation] Failed for node ${nodeId}:`, e.message);
            result.failed.push(nodeId);
        }
    }

    console.log(`[MetricsAggregation] Batch complete: ${result.processed} processed, ${result.failed.length} failed, ${result.skipped} skipped`);
    return result;
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Get the next month string from a "YYYY-MM" format.
 * e.g., "2026-04" -> "2026-05", "2026-12" -> "2027-01"
 */
function getNextMonth(month: string): string {
    const [year, mon] = month.split('-').map(Number);
    if (mon === 12) return `${year + 1}-01`;
    return `${year}-${String(mon + 1).padStart(2, '0')}`;
}
