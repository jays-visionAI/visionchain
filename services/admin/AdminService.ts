import {
    getFirebaseDb
} from '../firebaseService';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    query,
    where,
    updateDoc,
    addDoc,
    Timestamp
} from 'firebase/firestore';
import {
    ChainConfig,
    PaymasterPool,
    AuditLog
} from '../paymaster/types';

// Mock Timelock validation
const checkTimelock = async (adminId: string, action: string): Promise<boolean> => {
    console.log(`[Timelock] Verifying action '${action}' by ${adminId}...`);
    // In production, this would query a smart contract or a delay queue.
    return true; // Auto-pass for Testnet MVP
};

export const AdminService = {
    /**
     * Verify Chain RPC Connectivity
     */
    validateRpc: async (url: string, chainId: number): Promise<boolean> => {
        try {
            console.log(`[AdminService] Verifying RPC ${url} for Chain ${chainId}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_chainId',
                    params: []
                })
            });
            const data = await response.json();
            const rpcChainId = parseInt(data.result, 16);
            if (rpcChainId !== chainId) {
                console.warn(`Chain ID Mismatch: Expected ${chainId}, got ${rpcChainId}`);
                return false;
            }
            return true;
        } catch (e) {
            console.error("RPC Validation Failed", e);
            return false;
        }
    },

    /**
     * Register a new compatible chain.
     * Triggers automatic Pool creation.
     */
    registerChain: async (adminId: string, config: ChainConfig): Promise<void> => {
        const db = getFirebaseDb();
        const chainRef = doc(db, 'chains', config.chainId.toString());

        // 1. Check existing
        const exists = (await getDoc(chainRef)).exists();
        if (exists) throw new Error(`Chain ${config.chainId} already registered.`);

        // 2. Register Chain (with extended metadata)
        await setDoc(chainRef, {
            ...config,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        // 3. Auto-Initialize Paymaster Pool (Ops Automation)
        const poolId = `pool_${config.chainId}`;
        const poolRef = doc(db, 'paymaster_pools', poolId);

        const initialPool: PaymasterPool = {
            poolId,
            chainId: config.chainId,
            gasAccountAddress: config.security?.agentWalletAddr || '0x0000000000000000000000000000000000000000',
            vaultAddress: '0x0000000000000000000000000000000000000000',
            balance: BigInt(0),
            minBalance: BigInt(1000000000000000000), // 1 ETH default
            targetBalance: BigInt(5000000000000000000), // 5 ETH default
            mode: 'INIT',
            spendRate24h: BigInt(0),
            pendingTx: 0,
            lastTopUpAt: 0,
            anomalyScore: 0
        };

        // Firestore storage for BigInt
        await setDoc(poolRef, JSON.parse(JSON.stringify(initialPool, (_, v) => typeof v === 'bigint' ? v.toString() : v)));

        // 4. Audit Log
        await AdminService.logAudit(adminId, 'REGISTER_CHAIN', config.chainId.toString(), { config });
    },

    /**
     * Change Chain Status (e.g., Active -> Paused)
     * Requires Timelock check for ACTIVATE.
     */
    updateChainStatus: async (adminId: string, chainId: number, status: 'Active' | 'Paused'): Promise<void> => {
        const db = getFirebaseDb();

        if (status === 'Active') {
            const allowed = await checkTimelock(adminId, 'ACTIVATE_CHAIN');
            if (!allowed) throw new Error("Timelock verification failed.");
        }

        const chainRef = doc(db, 'chains', chainId.toString());
        await updateDoc(chainRef, {
            status,
            updatedAt: Date.now()
        });

        await AdminService.logAudit(adminId, 'UPDATE_CHAIN_STATUS', chainId.toString(), { status });
    },

    /**
     * Manual Pool Control (Pause/Resume)
     */
    setPoolMode: async (adminId: string, chainId: number, mode: 'NORMAL' | 'PAUSED'): Promise<void> => {
        const db = getFirebaseDb();
        const poolId = `pool_${chainId}`;
        const poolRef = doc(db, 'paymaster_pools', poolId);

        await updateDoc(poolRef, { mode });
        await AdminService.logAudit(adminId, 'SET_POOL_MODE', poolId, { mode });
    },

    /**
     * Append-only Audit Log
     */
    logAudit: async (adminId: string, action: string, targetId: string, changes: any): Promise<void> => {
        const db = getFirebaseDb();
        await addDoc(collection(db, 'audit_trails'), {
            adminId,
            action,
            targetId,
            changes,
            timestamp: Date.now()
        });
        console.log(`[Audit] ${action} on ${targetId} by ${adminId}`);
    },

    /**
     * Get Aggregated Dashboard Metrics (Mock for MVP functionality)
     */
    getDashboardMetrics: async () => {
        // In real impl, query 'paymaster_stats' collection
        return {
            totalSpend24h: '124.5 ETH',
            totalRevenue24h: '3450.00 USDT',
            globalFailureRate: 0.12, // 0.12%
            activeChains: 3
        };
    },

    /**
     * Get all registered chains
     */
    getAllChains: async (): Promise<ChainConfig[]> => {
        const db = getFirebaseDb();
        const snap = await getDocs(collection(db, 'chains'));
        return snap.docs.map(d => d.data() as ChainConfig);
    },

    /**
     * Get specific pool
     */
    getPool: async (chainId: number): Promise<PaymasterPool | null> => {
        const db = getFirebaseDb();
        const snap = await getDoc(doc(db, 'paymaster_pools', `pool_${chainId}`));
        if (!snap.exists()) return null;

        // Deserialize BigInt
        const data = snap.data();
        return {
            ...data,
            balance: BigInt(data.balance),
            minBalance: BigInt(data.minBalance),
            targetBalance: BigInt(data.targetBalance),
            spendRate24h: BigInt(data.spendRate24h)
        } as PaymasterPool;
    }
};
