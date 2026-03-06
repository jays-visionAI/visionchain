/**
 * Reward Policy Service
 *
 * CRUD operations for RewardPolicy documents in Firestore.
 * Collection: `reward_policies`
 *
 * Key rules:
 *   - Only one policy can be active (isActive = true) at a time
 *   - When activating a new policy, the previous active one is deactivated
 *   - Policies are versioned; new versions are created instead of editing
 */

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    updateDoc,
    Timestamp,
} from 'firebase/firestore';

import {
    RewardPolicy,
    validateRewardPolicy,
    ValidationResult,
    DEFAULT_REWARD_POLICY,
} from './rewardPolicyModel';

// ─── Collection Name ─────────────────────────────────────────────────
const COLLECTION = 'reward_policies';

// ─── Helper to get Firestore instance ────────────────────────────────
// Uses the same pattern as the rest of the codebase
let _db: ReturnType<typeof getFirestore> | null = null;

function getDb() {
    if (!_db) {
        _db = getFirestore();
    }
    return _db;
}

export function setRewardPolicyDb(db: ReturnType<typeof getFirestore>) {
    _db = db;
}

// ─── Generate Policy ID ─────────────────────────────────────────────

function generatePolicyId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    return `rp_${ts}_${rand}`;
}

// ─── CRUD Operations ─────────────────────────────────────────────────

/**
 * Create a new reward policy.
 * Validates the policy before saving.
 * If isActive = true, deactivates any previously active policy.
 */
export async function createRewardPolicy(
    policyInput: Omit<RewardPolicy, 'policyId' | 'createdAt' | 'updatedAt'>,
): Promise<{ success: boolean; policyId?: string; errors?: string[] }> {
    // Validate
    const validation = validateRewardPolicy(policyInput);
    if (!validation.valid) {
        return { success: false, errors: validation.errors };
    }

    const db = getDb();
    const now = new Date().toISOString();
    const policyId = generatePolicyId();

    const fullPolicy: RewardPolicy = {
        ...policyInput,
        policyId,
        createdAt: now,
        updatedAt: now,
    };

    // If this policy is active, deactivate the current active one
    if (fullPolicy.isActive) {
        await deactivateCurrentPolicy();
    }

    const docRef = doc(db, COLLECTION, policyId);
    await setDoc(docRef, fullPolicy);

    console.log(`[RewardPolicy] Created policy ${policyId} v${fullPolicy.version}`);
    return { success: true, policyId };
}

/**
 * Get the currently active reward policy.
 * Returns null if no active policy exists.
 */
export async function getActiveRewardPolicy(): Promise<RewardPolicy | null> {
    try {
        const db = getDb();
        const q = query(
            collection(db, COLLECTION),
            where('isActive', '==', true),
            limit(1),
        );
        const snap = await getDocs(q);

        if (snap.empty) return null;
        return snap.docs[0].data() as RewardPolicy;
    } catch (e) {
        console.error('[RewardPolicy] Error fetching active policy:', e);
        return null;
    }
}

/**
 * Get a specific policy by ID.
 */
export async function getRewardPolicyById(
    policyId: string,
): Promise<RewardPolicy | null> {
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION, policyId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) return null;
        return snap.data() as RewardPolicy;
    } catch (e) {
        console.error(`[RewardPolicy] Error fetching policy ${policyId}:`, e);
        return null;
    }
}

/**
 * List all reward policies, ordered by version descending.
 */
export async function listRewardPolicies(): Promise<RewardPolicy[]> {
    try {
        const db = getDb();
        const q = query(
            collection(db, COLLECTION),
            orderBy('version', 'desc'),
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as RewardPolicy);
    } catch (e) {
        console.error('[RewardPolicy] Error listing policies:', e);
        return [];
    }
}

/**
 * Update an existing reward policy.
 * Merges updates with existing data, then re-validates the entire policy.
 * If updating isActive to true, deactivates the currently active policy.
 */
export async function updateRewardPolicy(
    policyId: string,
    updates: Partial<Omit<RewardPolicy, 'policyId' | 'createdAt'>>,
): Promise<{ success: boolean; errors?: string[] }> {
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION, policyId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            return { success: false, errors: [`Policy ${policyId} not found`] };
        }

        const existing = snap.data() as RewardPolicy;
        const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };

        // Re-validate the merged policy
        const validation = validateRewardPolicy(merged);
        if (!validation.valid) {
            return { success: false, errors: validation.errors };
        }

        // If activating, deactivate current
        if (updates.isActive === true && !existing.isActive) {
            await deactivateCurrentPolicy();
        }

        await updateDoc(docRef, { ...updates, updatedAt: merged.updatedAt });

        console.log(`[RewardPolicy] Updated policy ${policyId}`);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, errors: [msg] };
    }
}

/**
 * Deactivate a specific policy by ID.
 */
export async function deactivatePolicy(
    policyId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION, policyId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            return { success: false, error: `Policy ${policyId} not found` };
        }

        await updateDoc(docRef, {
            isActive: false,
            updatedAt: new Date().toISOString(),
        });

        console.log(`[RewardPolicy] Deactivated policy ${policyId}`);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
    }
}

/**
 * Activate a specific policy (and deactivate the currently active one).
 */
export async function activatePolicy(
    policyId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const db = getDb();
        const docRef = doc(db, COLLECTION, policyId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            return { success: false, error: `Policy ${policyId} not found` };
        }

        // Deactivate current
        await deactivateCurrentPolicy();

        // Activate target
        await updateDoc(docRef, {
            isActive: true,
            updatedAt: new Date().toISOString(),
        });

        console.log(`[RewardPolicy] Activated policy ${policyId}`);
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { success: false, error: msg };
    }
}

/**
 * Deactivate the currently active policy.
 */
export async function deactivateCurrentPolicy(): Promise<void> {
    try {
        const db = getDb();
        const q = query(
            collection(db, COLLECTION),
            where('isActive', '==', true),
        );
        const snap = await getDocs(q);

        for (const d of snap.docs) {
            await updateDoc(d.ref, {
                isActive: false,
                updatedAt: new Date().toISOString(),
            });
        }
    } catch (e) {
        console.error('[RewardPolicy] Error deactivating current policy:', e);
    }
}

/**
 * Seed the default reward policy if none exists.
 * Safe to call multiple times (idempotent).
 */
export async function seedDefaultRewardPolicy(): Promise<{
    seeded: boolean;
    policyId?: string;
}> {
    const existing = await getActiveRewardPolicy();
    if (existing) {
        console.log(`[RewardPolicy] Active policy already exists: ${existing.policyId} v${existing.version}`);
        return { seeded: false };
    }

    const result = await createRewardPolicy({
        ...DEFAULT_REWARD_POLICY,
        isActive: true,
    });

    if (result.success) {
        console.log(`[RewardPolicy] Seeded default policy: ${result.policyId}`);
        return { seeded: true, policyId: result.policyId };
    }

    console.error('[RewardPolicy] Failed to seed default policy:', result.errors);
    return { seeded: false };
}
