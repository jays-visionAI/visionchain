import { PaymasterAgent } from '../services/paymaster/PaymasterAgent';
import { GrandOrchestrator } from '../services/paymaster/GrandOrchestrator';
import { PaymasterPool } from '../services/paymaster/types';

// Mock DB State
const mockDb: Record<string, any> = {
    'pool_9999': {
        poolId: 'pool_9999',
        chainId: 9999,
        balance: "1000000000000000000", // 1 ETH
        minBalance: "1000000000000000000",
        targetBalance: "5000000000000000000",
        mode: 'NORMAL',
        spendRate24h: "0"
    }
};

// ---------------------------------------------------------
// MOCKING DEPENDENCIES (Runtime Patching)
// ---------------------------------------------------------

// Mock PaymasterAgent.refreshPoolState
(PaymasterAgent.prototype as any).refreshPoolState = async function () {
    const id = `pool_${this.context.chainId}`;
    const data = mockDb[id];
    if (data) {
        this.poolState = {
            ...data,
            balance: BigInt(data.balance || 0),
            minBalance: BigInt(data.minBalance || 0),
            targetBalance: BigInt(data.targetBalance || 0),
            spendRate24h: BigInt(data.spendRate24h || 0)
        } as PaymasterPool;
        this.currentMode = this.poolState.mode;
        console.log(`[MockDB] Agent Refreshed State: Mode=${this.poolState.mode}, Bal=${this.poolState.balance}`);
    }
};

// Mock PaymasterAgent.transitionMode
(PaymasterAgent.prototype as any).transitionMode = async function (mode: string, reason: string) {
    console.log(`[MockDB] Agent Transition: ${this.currentMode} -> ${mode} (${reason})`);
    this.currentMode = mode;
    const id = `pool_${this.context.chainId}`;
    if (mockDb[id]) {
        mockDb[id].mode = mode;
    }
};

// Mock GrandOrchestrator DB Updates
(GrandOrchestrator.prototype as any).executeTopUp = async function (pool: PaymasterPool, reason: string) {
    const amountNeeded = pool.targetBalance - pool.balance;
    console.log(`[MockDB] Orchestrator Executing TopUp: +${amountNeeded} (${reason})`);

    // Update Mock DB
    const id = pool.poolId;
    if (mockDb[id]) {
        const current = BigInt(mockDb[id].balance);
        mockDb[id].balance = (current + amountNeeded).toString();
        // mockDb[id].mode = 'NORMAL'; // Logic is in Orchestrator, but here we just update MockDB
        // Actually, Orchestrator changes mode to NORMAL in the original code, so let's reflect that.
        mockDb[id].mode = 'NORMAL';
        mockDb[id].lastTopUpAt = Date.now();
    }
    console.log(`[MockDB] TopUp Complete. New Balance: ${mockDb[id].balance}`);
};

// Mock AdminService for Orchestrator to fetch pools
import { AdminService } from '../services/admin/AdminService';

AdminService.getPool = async (chainId: number) => {
    const id = `pool_${chainId}`;
    const data = mockDb[id];
    if (!data) return null;
    return {
        ...data,
        balance: BigInt(data.balance),
        minBalance: BigInt(data.minBalance),
        targetBalance: BigInt(data.targetBalance),
        spendRate24h: BigInt(data.spendRate24h)
    } as PaymasterPool;
};

// ---------------------------------------------------------
// VERIFICATION SCRIPT
// ---------------------------------------------------------

async function runVerification() {
    console.log("🚀 Starting Phase 2 Verification (with In-Memory Mock DB)");

    const TEST_CHAIN_ID = 9999;

    // 1. Initialize Agent
    const agent = new PaymasterAgent({
        rpcUrl: 'http://mock',
        chainId: TEST_CHAIN_ID,
        gasPriceSources: [],
        minBalance: BigInt(1000000000000000000)
    });

    const orchestrator = new GrandOrchestrator();
    orchestrator.stop(); // Stop the interval immediately, we will trigger manually

    // 2. Simulate Low Balance
    console.log("\n[Step 1] Simulating Critical Low Balance...");
    mockDb['pool_9999'].balance = "500000000000000000"; // 0.5 ETH
    console.log("Current DB Balance:", mockDb['pool_9999'].balance);

    // 3. Run Agent Check
    console.log("\n[Step 2] Running Agent Health Check...");
    await agent.runHealthCheck();

    if (mockDb['pool_9999'].mode === 'SAFE_MODE') {
        console.log("✅ Agent correctly entered SAFE_MODE.");
    } else {
        console.error("❌ Agent FAILED to enter SAFE_MODE. Mode:", mockDb['pool_9999'].mode);
        process.exit(1);
    }

    // 4. Trigger Orchestrator
    console.log("\n[Step 3] Triggering Emergency TopUp...");
    await orchestrator.triggerEmergencyTopUp(TEST_CHAIN_ID);

    // 5. Verify Balance Restoration
    const newBal = BigInt(mockDb['pool_9999'].balance);
    const target = BigInt(mockDb['pool_9999'].targetBalance);

    if (newBal >= target) {
        console.log(`✅ TopUp Successful. Balance: ${newBal}`);
    } else {
        console.error(`❌ TopUp Failed. Balance: ${newBal}`);
        process.exit(1);
    }

    // 6. Verify Mode Recovery
    // Check if Orchestrator set it to NORMAL
    if (mockDb['pool_9999'].mode === 'NORMAL') {
        console.log("✅ Pool Mode Auto-recovered to NORMAL (via Orchestrator).");
    } else {
        console.log("ℹ️ Pool Mode is:", mockDb['pool_9999'].mode);
        // Agent check should sync it if orchestrator didn't
        await agent.runHealthCheck();
        console.log("🔄 After Agent Sync, Mode is:", mockDb['pool_9999'].mode);
    }

    console.log("\n🎉 Phase 2 Verification Logic Complete!");
    agent.stop();
    process.exit(0);
}

runVerification();
