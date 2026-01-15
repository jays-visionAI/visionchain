import { AdminService } from '../admin/AdminService';
import { getFirebaseDb } from '../firebaseService';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { PaymasterPool } from './types';

export class GrandOrchestrator {
    private rebalanceInterval: any;
    private readonly VAULT_ADDRESS = "0xVAULT_MOCK_ADDRESS";

    constructor() {
        // Run scheduler (every 6 hours in prod, but every 60s for demo)
        this.rebalanceInterval = setInterval(() => this.runRebalanceJob(), 60000);
    }

    /**
     * Main Rebalancing Job (Batch)
     */
    public async runRebalanceJob() {
        console.log(`[Orchestrator] Starting Rebalance Job ID: ${Date.now()}`);
        const chains = await AdminService.getAllChains();

        for (const chain of chains) {
            const pool = await AdminService.getPool(chain.chainId);
            if (!pool) continue;

            const needsTopUp = await this.evaluatePoolHealth(pool);
            if (needsTopUp) {
                await this.executeTopUp(pool, 'BATCH_SCHEDULER');
            }
        }
    }

    /**
     * Emergency Trigger (called by Agent or Alert System)
     */
    public async triggerEmergencyTopUp(chainId: number) {
        console.log(`[Orchestrator] Handling EMERGENCY TopUp for Chain ${chainId}`);
        const pool = await AdminService.getPool(chainId);
        if (pool) {
            await this.executeTopUp(pool, 'EMERGENCY_TRIGGER');
        }
    }

    private async evaluatePoolHealth(pool: PaymasterPool): Promise<boolean> {
        // Logic: if balance < targetBalance * 80%, refill it
        const target = pool.targetBalance;
        const current = pool.balance;

        // Simple threshold check
        return current < (target * 80n / 100n);
    }

    private async executeTopUp(pool: PaymasterPool, reason: string) {
        try {
            const amountNeeded = pool.targetBalance - pool.balance;
            console.log(`[Orchestrator] Executing TopUp for Chain ${pool.chainId}: ${amountNeeded} wei (${reason})`);

            // 1. Mock On-Chain Transfer (Vault -> Gas Account)
            // In real world, this would verify Multi-sig confirmation or check automated allowance
            const txHash = `0xmock_topup_tx_${Date.now()}`;

            // 2. Update DB Balance
            const db = getFirebaseDb();
            const poolRef = doc(db, 'paymaster_pools', pool.poolId);

            // Serialize BigInt for Firestore
            // Note: In real app, we should use atomic transactions
            await updateDoc(poolRef, {
                balance: (pool.balance + amountNeeded).toString(),
                lastTopUpAt: Date.now(),
                mode: 'NORMAL' // Auto-recovery if it was in Safe Mode due to low balance
            });

            // 3. Log Event
            await addDoc(collection(db, 'paymaster_events'), {
                type: 'REBALANCE',
                chainId: pool.chainId,
                amount: amountNeeded.toString(),
                reason,
                txHash,
                timestamp: Date.now()
            });

            console.log(`[Orchestrator] TopUp Success. Chain ${pool.chainId} restored to target balance.`);

        } catch (error) {
            console.error(`[Orchestrator] TopUp Failed for Chain ${pool.chainId}`, error);
            // Trigger PagerDuty / Alert
        }
    }

    public stop() {
        clearInterval(this.rebalanceInterval);
    }
}
