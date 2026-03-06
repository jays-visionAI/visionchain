/**
 * Reward Policy Model & Validation
 *
 * Defines the schema for distributed storage node reward policies.
 * Stored in Firestore collection: `reward_policies`
 *
 * Business Rules:
 *   - Only ONE active policy at a time (isActive = true)
 *   - Pool ratios must sum to exactly 1.0
 *   - Quality weights must sum to exactly 1.0
 *   - effectiveTo must be after effectiveFrom
 *   - Policy is immutable once used (create new version instead)
 */

// ─── Interface ───────────────────────────────────────────────────────

export interface RewardPolicy {
    // Identity
    policyId: string;            // Auto-generated or manual ID
    version: number;             // Incremental version (1, 2, 3...)

    // Effective Period
    effectiveFrom: string;       // ISO 8601 datetime
    effectiveTo: string;         // ISO 8601 datetime (empty = indefinite)

    // Pool Ratios (must sum to 1.0)
    rewardPoolRatio: number;     // Total reward pool percentage (e.g., 0.40 = 40%)
    allocPoolRatio: number;      // Allocation-based pool (storage provided)
    usePoolRatio: number;        // Usage-based pool (actual chunk serves)
    qualityPoolRatio: number;    // Quality-based pool (uptime, audit, latency)

    // Allocation Cap
    allocationCapLambda: number; // Lambda: max ratio of AC credited vs UC (e.g., 1.5 = 150%)
    allocPureRatio: number;      // Alpha: portion of Alloc Pool for pure allocation (0~1, e.g., 0.3 = 30%)

    // Quality Thresholds
    uptimeCutoff: number;        // Minimum uptime ratio to qualify (e.g., 0.90 = 90%)
    auditCutoff: number;         // Minimum audit pass rate (e.g., 0.95 = 95%)
    latencyMinMs: number;        // Best latency threshold in ms (e.g., 50)
    latencyMaxMs: number;        // Worst acceptable latency in ms (e.g., 2000)

    // Quality Weights (must sum to 1.0)
    qualityWeightUptime: number;   // Weight for uptime in quality score (e.g., 0.5)
    qualityWeightAudit: number;    // Weight for audit pass rate (e.g., 0.3)
    qualityWeightLatency: number;  // Weight for latency score (e.g., 0.2)

    // Payout
    minPayoutUsd: number;        // Minimum USDT payout threshold (e.g., 1.00)

    // State
    isActive: boolean;           // Only one active policy at a time
    createdAt: string;           // ISO 8601
    updatedAt: string;           // ISO 8601
}

// ─── Validation ──────────────────────────────────────────────────────

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validates a RewardPolicy before saving to DB.
 * Returns { valid: true } if all checks pass, or { valid: false, errors: [...] }.
 */
export function validateRewardPolicy(
    policy: Partial<RewardPolicy>,
): ValidationResult {
    const errors: string[] = [];

    // Required fields
    const requiredFields: (keyof RewardPolicy)[] = [
        'version',
        'effectiveFrom',
        'rewardPoolRatio',
        'allocPoolRatio',
        'usePoolRatio',
        'qualityPoolRatio',
        'allocationCapLambda',
        'uptimeCutoff',
        'auditCutoff',
        'latencyMinMs',
        'latencyMaxMs',
        'qualityWeightUptime',
        'qualityWeightAudit',
        'qualityWeightLatency',
        'minPayoutUsd',
    ];

    for (const field of requiredFields) {
        if (policy[field] === undefined || policy[field] === null) {
            errors.push(`Missing required field: ${field}`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // ── Pool Ratio Validation ──
    // rewardPoolRatio is the total pool (0~1), the sub-pools must sum to 1.0
    const poolSum = round4(
        (policy.allocPoolRatio ?? 0) +
        (policy.usePoolRatio ?? 0) +
        (policy.qualityPoolRatio ?? 0),
    );
    if (poolSum !== 1.0) {
        errors.push(
            `Pool ratios must sum to 1.0 (allocPoolRatio + usePoolRatio + qualityPoolRatio = ${poolSum})`,
        );
    }

    // rewardPoolRatio must be 0 < ratio <= 0.30
    if ((policy.rewardPoolRatio ?? 0) <= 0 || (policy.rewardPoolRatio ?? 0) > 0.30) {
        errors.push(`rewardPoolRatio must be between 0 (exclusive) and 0.30 (inclusive). Got: ${policy.rewardPoolRatio}`);
    }

    // ── Quality Weight Validation ──
    const qualitySum = round4(
        (policy.qualityWeightUptime ?? 0) +
        (policy.qualityWeightAudit ?? 0) +
        (policy.qualityWeightLatency ?? 0),
    );
    if (qualitySum !== 1.0) {
        errors.push(
            `Quality weights must sum to 1.0 (uptime + audit + latency = ${qualitySum})`,
        );
    }

    // ── Range Validations ──
    if ((policy.version ?? 0) < 1) {
        errors.push(`version must be >= 1. Got: ${policy.version}`);
    }

    if ((policy.allocationCapLambda ?? 0) <= 0 || (policy.allocationCapLambda ?? 0) > 100) {
        errors.push(`allocationCapLambda must be 0 < lambda <= 100. Got: ${policy.allocationCapLambda}`);
    }

    if ((policy.allocPureRatio ?? -1) < 0 || (policy.allocPureRatio ?? -1) > 1) {
        errors.push(`allocPureRatio must be between 0 and 1. Got: ${policy.allocPureRatio}`);
    }

    if ((policy.uptimeCutoff ?? 0) < 0 || (policy.uptimeCutoff ?? 0) > 1) {
        errors.push(`uptimeCutoff must be between 0 and 1. Got: ${policy.uptimeCutoff}`);
    }

    if ((policy.auditCutoff ?? 0) < 0 || (policy.auditCutoff ?? 0) > 1) {
        errors.push(`auditCutoff must be between 0 and 1. Got: ${policy.auditCutoff}`);
    }

    if ((policy.latencyMinMs ?? 0) < 0) {
        errors.push(`latencyMinMs must be >= 0. Got: ${policy.latencyMinMs}`);
    }

    if ((policy.latencyMaxMs ?? 0) <= (policy.latencyMinMs ?? 0)) {
        errors.push(
            `latencyMaxMs (${policy.latencyMaxMs}) must be greater than latencyMinMs (${policy.latencyMinMs})`,
        );
    }

    if ((policy.minPayoutUsd ?? 0) < 0) {
        errors.push(`minPayoutUsd must be >= 0. Got: ${policy.minPayoutUsd}`);
    }

    // ── Date Validations ──
    if (policy.effectiveFrom) {
        const fromDate = new Date(policy.effectiveFrom);
        if (isNaN(fromDate.getTime())) {
            errors.push(`effectiveFrom is not a valid date: ${policy.effectiveFrom}`);
        }
    }

    if (policy.effectiveTo && policy.effectiveTo !== '') {
        const toDate = new Date(policy.effectiveTo);
        if (isNaN(toDate.getTime())) {
            errors.push(`effectiveTo is not a valid date: ${policy.effectiveTo}`);
        } else if (policy.effectiveFrom) {
            const fromDate = new Date(policy.effectiveFrom);
            if (toDate <= fromDate) {
                errors.push(`effectiveTo must be after effectiveFrom`);
            }
        }
    }

    // ── Each ratio/weight must be non-negative ──
    const nonNegativeFields: (keyof RewardPolicy)[] = [
        'rewardPoolRatio',
        'allocPoolRatio',
        'usePoolRatio',
        'qualityPoolRatio',
        'qualityWeightUptime',
        'qualityWeightAudit',
        'qualityWeightLatency',
    ];
    for (const field of nonNegativeFields) {
        const val = policy[field] as number;
        if (val !== undefined && val < 0) {
            errors.push(`${field} must be >= 0. Got: ${val}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// ─── Helper ──────────────────────────────────────────────────────────

/** Round to 4 decimal places to avoid floating-point comparison issues */
function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

// ─── Default / Seed Policy ──────────────────────────────────────────

/**
 * Default seed policy matching the design spec:
 *   - 40% reward pool from total revenue
 *   - Allocation: 40%, Usage: 35%, Quality: 25%
 *   - Quality: Uptime 50%, Audit 30%, Latency 20%
 *   - Min payout: $1.00 USDT
 */
export const DEFAULT_REWARD_POLICY: Omit<RewardPolicy, 'policyId' | 'createdAt' | 'updatedAt'> = {
    version: 1,
    effectiveFrom: '2026-04-01T00:00:00Z',
    effectiveTo: '',

    // Pool distribution
    rewardPoolRatio: 0.30,       // 30% of revenue goes to node rewards (max 30%)
    allocPoolRatio: 0.40,        // 40% of reward pool -> allocation-based
    usePoolRatio: 0.35,          // 35% of reward pool -> usage-based
    qualityPoolRatio: 0.25,      // 25% of reward pool -> quality-based

    // Allocation cap
    allocationCapLambda: 1.5,    // Max AC credited = 1.5 * UC
    allocPureRatio: 0.3,         // 30% of Alloc Pool rewards pure allocation

    // Quality thresholds
    uptimeCutoff: 0.90,          // 90% uptime required
    auditCutoff: 0.95,           // 95% audit pass rate required
    latencyMinMs: 50,            // Best latency
    latencyMaxMs: 2000,          // Worst acceptable latency

    // Quality score weights
    qualityWeightUptime: 0.50,   // 50% uptime
    qualityWeightAudit: 0.30,    // 30% audit
    qualityWeightLatency: 0.20,  // 20% latency

    // Payout
    minPayoutUsd: 1.00,          // Min $1.00 USDT

    // State
    isActive: true,
};
