import { PaymasterAgent, FirestoreAdapter } from '../services/paymaster/PaymasterAgent';

// ---------------------------------------------------------
// MOCKING DEPENDENCIES
// ---------------------------------------------------------

const mockPools: Record<string, any> = {
    'pool_1': { chainId: 1, balance: "5000000000000000000", mode: "NORMAL" }
};

// Patch FirestoreAdapter methods
FirestoreAdapter.getDoc = async (path: string, id: string) => {
    // console.log(`[MockAdapter] getDoc: ${path}/${id}`);
    if (path === 'paymaster_pools' && mockPools[id]) {
        return {
            exists: () => true,
            data: () => mockPools[id],
            id
        } as any;
    }
    return { exists: () => false } as any;
}

FirestoreAdapter.updateDoc = async (path: string, id: string, data: any) => {
    // console.log(`[MockAdapter] updateDoc: ${path}/${id}`, data);
    if (path === 'paymaster_pools' && mockPools[id]) {
        mockPools[id] = { ...mockPools[id], ...data };
    }
}

// ---------------------------------------------------------
// VERIFICATION SCRIPT (Simulate UI + Agent Loop)
// ---------------------------------------------------------

async function runVerification() {
    console.log("🚀 Starting Phase 6 Verification: System Integration");

    try {
        const CHAIN_ID = 1;
        const POOL_ID = `pool_${CHAIN_ID}`;

        // 1. Initialize Agent
        console.log("\n[1] Starting Agent...");
        // Agent constructor now calls startLifeCycle immediately, which calls runHealthCheck
        // To avoid async race in constructor logging, we just init
        const agent = new PaymasterAgent({
            chainId: CHAIN_ID,
            rpcUrl: 'mock',
            gasPriceSources: [],
            minBalance: BigInt(1000000000000000000)
        });

        // 2. Simulate User Action: "Drain Funds" (Admin UI)
        console.log("\n[2] User Clicks 'Simulate Drain' (Mocking DB Update)...");
        // Manually update mockDB
        mockPools[POOL_ID].balance = "100000000000000000"; // 0.1 ETH
        console.log(`[MockDB] Balance updated to ${mockPools[POOL_ID].balance}`);

        // 3. Agent Detects Low Balance (Manually Trigger Check)
        console.log("\n[3] Triggering Agent Health Check...");
        await agent.runHealthCheck();

        // 4. Verify Agent Reaction (State Change)
        console.log("\n[4] Verifying State Transition to SAFE_MODE...");

        if (mockPools[POOL_ID].mode === 'SAFE_MODE') {
            console.log("✅ Agent successfully transitioned to SAFE_MODE after Drain.");
        } else {
            console.error("❌ Agent failed to react. Current Mode:", mockPools[POOL_ID].mode);
            process.exit(1);
        }

        agent.stop(); // Stop interval
        console.log("\n🎉 Phase 6 Integration Verified!");
        process.exit(0);

    } catch (e) {
        console.error("❌ Verification Failed:", e);
        process.exit(1);
    }
}

runVerification();
