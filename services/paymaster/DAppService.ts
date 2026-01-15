import { getFirebaseDb } from '../firebaseService';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { DAppAccount, DAppPaymasterInstance, ComplianceHooks } from './types';
import { AdminService } from '../admin/AdminService';

export const DAppService = {
    /**
     * Register a new DApp Account
     */
    registerDApp: async (ownerId: string, name: string): Promise<string> => {
        const db = getFirebaseDb();
        const dappId = `dapp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const newDApp: DAppAccount = {
            dappId,
            ownerId,
            name,
            status: 'ACTIVE',
            allowedChains: [],
            compliance: {
                isDenylisted: false,
                fraudFlag: false,
                riskScore: 0
            },
            createdAt: Date.now()
        };

        await setDoc(doc(db, 'paymaster_dapps', dappId), newDApp);
        // Audit Log via AdminService
        await AdminService.logAudit(ownerId, 'REGISTER_DAPP', dappId, { name });

        return dappId;
    },

    /**
     * Create Paymaster Instance for a specific Chain
     */
    createInstance: async (dappId: string, chainId: number): Promise<void> => {
        const db = getFirebaseDb();

        // 1. Validate DApp Compliance
        const dappRef = doc(db, 'paymaster_dapps', dappId);
        const dappSnap = await getDoc(dappRef);
        if (!dappSnap.exists()) throw new Error("DApp not found");

        const dappData = dappSnap.data() as DAppAccount;
        if (dappData.compliance.isDenylisted || dappData.status !== 'ACTIVE') {
            throw new Error("DApp is blocked from creating instances.");
        }

        // 2. Create Instance
        const instanceId = `pm_${dappId}_${chainId}`;
        const instance: DAppPaymasterInstance = {
            instanceId,
            dappId,
            chainId,
            apiKey: `vk_${Math.random().toString(36).substr(2)}`, // Simple Mock Key
            webhookUrl: '',
            depositedBalance: BigInt(0), // Initial balance
            policy: {
                sponsorScheme: 'FULL',
                dailyGasCap: BigInt(1000000000000000000), // 1 ETH default
                perUserDailyCap: BigInt(50000000000000000), // 0.05 ETH default
                whitelistTokens: []
            },
            analytics: {
                totalSponsored: BigInt(0),
                txCount: 0,
                userCount: 0
            }
        };

        // Handle BigInt for Firestore
        const safeInstance = JSON.parse(JSON.stringify(instance, (_, v) => typeof v === 'bigint' ? v.toString() : v));
        await setDoc(doc(db, 'paymaster_instances', instanceId), safeInstance);

        // 3. Update DApp allowed chains
        await updateDoc(dappRef, {
            allowedChains: [...dappData.allowedChains, chainId]
        });
    },

    /**
     * Deposit Funds (Sponsor Pool)
     */
    deposit: async (instanceId: string, amount: bigint) => {
        const db = getFirebaseDb();
        const instanceRef = doc(db, 'paymaster_instances', instanceId);
        const snap = await getDoc(instanceRef);

        if (!snap.exists()) throw new Error("Instance not found");

        const currentBalance = BigInt(snap.data()?.depositedBalance || 0);
        const newBalance = currentBalance + amount;

        await updateDoc(instanceRef, {
            depositedBalance: newBalance.toString()
        });
    },

    /**
     * Update Policies (Caps, Whitelist)
     */
    updatePolicy: async (instanceId: string, policyUpdates: Partial<DAppPaymasterInstance['policy']>) => {
        const db = getFirebaseDb();
        // Convert BigInts if present in updates
        const safeUpdates = JSON.parse(JSON.stringify(policyUpdates, (_, v) => typeof v === 'bigint' ? v.toString() : v));

        await updateDoc(doc(db, 'paymaster_instances', instanceId), {
            [`policy`]: safeUpdates // Note: This might overwrite nested fields if not careful with proper dot notation in real Firestore
            // For MVP simplicty, we accept full policy object overwrite or use specific fields
        });
        // Better: We should merge provided fields carefully.
        // But for this prototype, assume the UI sends the full policy object or we construct it.
    },

    /**
     * Validate Request against Policy & Compliance (The "Gatekeeper")
     */
    validateRequest: async (instanceId: string, userAddress: string, estimatedGasCost: bigint): Promise<boolean> => {
        const db = getFirebaseDb();
        const instanceRef = doc(db, 'paymaster_instances', instanceId);
        const snap = await getDoc(instanceRef);

        if (!snap.exists()) return false;
        const instance = snap.data(); // Need to parse BigInts back if we were using them seriously here

        // 1. Check Global Status
        const dappSnap = await getDoc(doc(db, 'paymaster_dapps', instance.dappId));
        if (dappSnap.data()?.status !== 'ACTIVE') return false;
        if (dappSnap.data()?.compliance.isDenylisted) return false;

        // 2. Check Daily Cap
        // (Simplified: assuming 'dailyGasCap' is stored as string)
        const dailyCap = BigInt(instance.policy.dailyGasCap);
        const usedToday = BigInt(instance.analytics.totalSponsored); // This is total, logic needs "today's" usage. 
        // For MVP, we'll confirm total cap isn't blown, or skipped for precise daily logic.

        if (usedToday + estimatedGasCost > dailyCap) {
            console.warn(`[Policy] Daily Cap Breached for ${instanceId}`);
            return false;
        }

        return true;
    },

    getInstances: async (ownerId: string): Promise<DAppPaymasterInstance[]> => {
        const db = getFirebaseDb();
        // 1. Get user's DApps
        const dappsQuery = query(collection(db, 'paymaster_dapps'), where('ownerId', '==', ownerId));
        const dappsSnap = await getDocs(dappsQuery);
        const dappIds = dappsSnap.docs.map(d => d.id);

        if (dappIds.length === 0) return [];

        // 2. Get Instances for those DApps
        const instancesQuery = query(collection(db, 'paymaster_instances'), where('dappId', 'in', dappIds));
        const instSnap = await getDocs(instancesQuery);

        return instSnap.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                policy: {
                    ...data.policy,
                    dailyGasCap: BigInt(data.policy.dailyGasCap),
                    perUserDailyCap: BigInt(data.policy.perUserDailyCap)
                },
                analytics: {
                    ...data.analytics,
                    totalSponsored: BigInt(data.analytics.totalSponsored)
                }
            } as DAppPaymasterInstance;
        });
    }
};
