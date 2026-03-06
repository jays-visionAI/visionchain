/**
 * Reward Engine - Barrel Export (Complete)
 */

// ── Epic A: Policy ──
export type { RewardPolicy, ValidationResult } from './rewardPolicyModel';
export { validateRewardPolicy, DEFAULT_REWARD_POLICY } from './rewardPolicyModel';
export {
    createRewardPolicy, getActiveRewardPolicy, getRewardPolicyById,
    listRewardPolicies, updateRewardPolicy, activatePolicy, deactivatePolicy,
    deactivateCurrentPolicy, seedDefaultRewardPolicy, setRewardPolicyDb,
} from './rewardPolicyService';

// ── Epic B: Metrics ──
export type { NodeAllocationMetric, NodeUsageMetric, NodeHealthMetric, RewardMetricsMonthly } from './nodeMetricsModel';
export { COLLECTIONS, monthlyDocId } from './nodeMetricsModel';
export {
    calculateAC, calculateUC, calculateUptime, calculateAuditRate,
    calculateP95Latency, aggregateNodeMonth, runMonthlyAggregationBatch,
} from './metricsAggregationService';

// ── Epic C: Snapshots + Engine ──
export type { RewardSnapshotMonthly, RewardSnapshotNodeLineItem, SnapshotStatus } from './rewardSnapshotModel';
export { SNAPSHOT_COLLECTIONS, generateSnapshotId } from './rewardSnapshotModel';
export type { QualityScoreResult, NodePoolReward, RewardEngineInput, RewardEngineOutput } from './rewardCalculationEngine';
export {
    calculateQualityScore, calculateAllocPool, calculateUsePool,
    calculateQualityPool, runRewardEngine,
} from './rewardCalculationEngine';

// ── Epic D: Settlement ──
export type { RevenueMonthly, ApprovalStatus, SnapshotApproval, FxRateSnapshot, PayoutRequest, PayoutStatus } from './settlementModel';
export { SETTLEMENT_COLLECTIONS, generatePayoutId } from './settlementModel';

// ── Epic E: Operations ──
export type { NodeRolloverBalance, RolloverEntry, BootstrapConfig, BootstrapTier, BootstrapAdjustment, AbuseFlag, AbuseType } from './operationsService';
export { applyRollover, applyBootstrapFloors, detectAbuse, DEFAULT_BOOTSTRAP_CONFIG, OPS_COLLECTIONS } from './operationsService';
