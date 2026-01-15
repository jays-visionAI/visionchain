import { PaymasterPool } from './types';
import { getFirebaseDb } from '../firebaseService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Adapter for Dependency Injection / Mocking
export const FirestoreAdapter = {
    getDoc: async (path: string, id: string) => {
        const db = getFirebaseDb();
        return getDoc(doc(db, path, id));
    },
    updateDoc: async (path: string, id: string, data: any) => {
        const db = getFirebaseDb();
        return updateDoc(doc(db, path, id), data);
    }
};

export class PaymasterAgent {
    public chainId: number;
    public rpcUrl: string;
    public currentMode: 'NORMAL' | 'SAFE_MODE' | 'THROTTLED' | 'PAUSED' = 'NORMAL';
    private minBalance: bigint;
    private poolState: PaymasterPool | null = null;
    private healthCheckInterval: any;

    constructor(config: { chainId: number, rpcUrl: string, gasPriceSources: string[], minBalance: bigint }) {
        this.chainId = config.chainId;
        this.rpcUrl = config.rpcUrl;
        this.minBalance = config.minBalance;

        console.log(`[PaymasterAgent] Initialized for Chain ${this.chainId}`);
        // Start Loop immediately
        this.startLifeCycle();
    }

    private async startLifeCycle() {
        // Initial Health Check
        await this.runHealthCheck();
        // Start Loop
        this.healthCheckInterval = setInterval(() => this.runHealthCheck(), 10000); // 10s
    }

    public stop() {
        if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
        console.log(`[PaymasterAgent] Stopped Agent for Chain ${this.chainId}`);
    }

    /**
     * Core Health Check Logic (State Machine Trigger)
     */
    public async runHealthCheck() {
        try {
            // 1. Fetch Pool State from DB using Adapter
            const poolRefString = `paymaster_pools`;
            const poolId = `pool_${this.chainId}`;
            const snap = await FirestoreAdapter.getDoc(poolRefString, poolId);

            if (!snap.exists()) {
                console.warn(`[PaymasterAgent] Pool not found for chain ${this.chainId}. Initializing local state.`);
                return;
            }

            this.poolState = snap.data() as PaymasterPool;

            // 2. Check Conditions
            const isRpcHealthy = await this.checkRpcHealth();
            const isGasStable = await this.checkGasStability();
            const isBalanceSufficient = BigInt(this.poolState.balance) > this.minBalance;

            // 3. Determine Mode
            let newMode: 'NORMAL' | 'SAFE_MODE' | 'THROTTLED' | 'PAUSED' = 'NORMAL';

            if (this.poolState.mode === 'PAUSED') {
                newMode = 'PAUSED'; // Admin Override
            } else if (!isRpcHealthy || !isGasStable || !isBalanceSufficient) {
                newMode = 'SAFE_MODE';
            } else {
                newMode = 'NORMAL';
            }

            // 4. Transition if needed
            if (this.currentMode !== newMode) {
                await this.transitionMode(newMode, "Health Check Auto-update");
            }

        } catch (error) {
            console.error(`[PaymasterAgent] Health Check Failed`, error);
        }
    }

    private async transitionMode(newMode: 'NORMAL' | 'SAFE_MODE' | 'THROTTLED' | 'PAUSED', reason: string) {
        console.log(`[PaymasterAgent] Mode Transition: ${this.currentMode} -> ${newMode} (${reason})`);
        this.currentMode = newMode;

        // Persist to DB using Adapter
        const poolId = `pool_${this.chainId}`;
        await FirestoreAdapter.updateDoc('paymaster_pools', poolId, {
            mode: newMode,
            lastHealthCheck: Date.now()
        });
    }

    // --- Helpers ---

    private async checkRpcHealth(): Promise<boolean> {
        return true; // Mock
    }

    private async checkGasStability(): Promise<boolean> {
        return true; // Mock
    }
}
