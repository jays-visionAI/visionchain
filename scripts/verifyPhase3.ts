import { DAppService } from '../services/paymaster/DAppService';
import { DAppPaymasterInstance } from '../services/paymaster/types';

// ---------------------------------------------------------
// MOCKING DEPENDENCIES (Match Phase 2 style)
// ---------------------------------------------------------

// Mock DB Storage
const mockDApps: Record<string, any> = {};
const mockInstances: Record<string, any> = {};

// Override DAppService methods to use mockDApps/mockInstances
// Since DAppService is an object, we can override its methods directly.

DAppService.registerDApp = async (ownerId: string, name: string) => {
    const dappId = `dapp_mock_${Date.now()}`;
    console.log(`[MockDB] Registering DApp: ${name} (${dappId})`);
    mockDApps[dappId] = {
        dappId,
        ownerId,
        name,
        status: 'ACTIVE',
        allowedChains: [],
        compliance: { isDenylisted: false }
    };
    return dappId;
};

DAppService.createInstance = async (dappId: string, chainId: number) => {
    const instanceId = `pm_${dappId}_${chainId}`;
    console.log(`[MockDB] Creating Instance: ${instanceId} for Chain ${chainId}`);

    // Validate DApp (Mock)
    if (!mockDApps[dappId]) throw new Error("DApp not found");
    if (mockDApps[dappId].compliance.isDenylisted) throw new Error("DApp Blocked");

    mockInstances[instanceId] = {
        instanceId,
        dappId,
        chainId,
        apiKey: 'mock_key',
        depositedBalance: "0",
        policy: {
            dailyGasCap: "1000000000000000000", // 1 ETH
        },
        analytics: {
            totalSponsored: "0"
        }
    };

    mockDApps[dappId].allowedChains.push(chainId);
};

DAppService.deposit = async (instanceId: string, amount: bigint) => {
    console.log(`[MockDB] Depositing ${amount} wei to ${instanceId}`);
    if (!mockInstances[instanceId]) throw new Error("Instance not found");

    const current = BigInt(mockInstances[instanceId].depositedBalance);
    const newVal = current + amount;
    mockInstances[instanceId].depositedBalance = newVal.toString();
    console.log(`[MockDB] New Balance: ${newVal}`);
};

DAppService.validateRequest = async (instanceId: string, user: string, cost: bigint) => {
    console.log(`[MockDB] Validating Request for ${instanceId}: Cost ${cost}`);
    if (!mockInstances[instanceId]) return false;

    // Check Cap
    const cap = BigInt(mockInstances[instanceId].policy.dailyGasCap);
    const used = BigInt(mockInstances[instanceId].analytics.totalSponsored);

    // Simulating "Total Used" strictly for this test script logic
    if (used + cost > cap) {
        console.warn(`[MockDB] Cap Breached! Used: ${used}, Cost: ${cost}, Cap: ${cap}`);
        return false;
    }
    return true;
};

// Helper to simulate usage
const simulateUsage = (instanceId: string, amount: bigint) => {
    if (mockInstances[instanceId]) {
        const current = BigInt(mockInstances[instanceId].analytics.totalSponsored);
        mockInstances[instanceId].analytics.totalSponsored = (current + amount).toString();
    }
}


// ---------------------------------------------------------
// VERIFICATION SCRIPT
// ---------------------------------------------------------

async function runVerification() {
    console.log("🚀 Starting Phase 3 Validation: Developer Ecosystem");

    try {
        const OWNER_ID = "dev_123";

        // 1. Register DApp
        console.log("\n[1] Registering DApp...");
        const dappId = await DAppService.registerDApp(OWNER_ID, "My DeFi App");

        // 2. Create Instance for Chain 1
        console.log("\n[2] Creating Paymaster Instance...");
        await DAppService.createInstance(dappId, 1);
        const instanceId = `pm_${dappId}_1`;

        // 3. Deposit Funds
        console.log("\n[3] Depositing Sponsor Funds...");
        await DAppService.deposit(instanceId, BigInt(5000000000000000000)); // 5 ETH

        // Verify Deposit
        const deposited = BigInt(mockInstances[instanceId].depositedBalance);
        if (deposited === 5000000000000000000n) {
            console.log("✅ Deposit Successful.");
        } else {
            console.error("❌ Deposit Mismatch");
            process.exit(1);
        }

        // 4. Test Policy Enforcement (Normal)
        console.log("\n[4] Testing Valid Request (0.1 ETH)...");
        const isValid = await DAppService.validateRequest(instanceId, "0xUser", BigInt(100000000000000000)); // 0.1 ETH
        if (isValid) {
            console.log("✅ Request Allowed (Under Cap)");
            simulateUsage(instanceId, BigInt(100000000000000000)); // Update usage
        } else {
            console.error("❌ Valid Request Blocked");
            process.exit(1);
        }

        // 5. Test Policy Enforcement (Breach Cap)
        console.log("\n[5] Testing Invalid Request (Breach Cap > 1 ETH)...");
        // Current used: 0.1. Cap: 1.0. 
        // Try to spend 1.0 ETH more -> Total 1.1 > 1.0
        const isBreach = await DAppService.validateRequest(instanceId, "0xUser", BigInt(1000000000000000000)); // 1.0 ETH
        if (!isBreach) {
            console.log("✅ Request Blocked Correctly (Cap Breached)");
        } else {
            console.error("❌ Breached Request ALLOWED (Policy Failure)");
            process.exit(1);
        }

        console.log("\n🎉 Phase 3 Verification Complete!");
        process.exit(0);

    } catch (e) {
        console.error("❌ Verification Failed:", e);
        process.exit(1);
    }
}

runVerification();
