export type PaymasterMode = 'INIT' | 'NORMAL' | 'SAFE_MODE' | 'THROTTLED' | 'PAUSED' | 'RECOVERY';

export interface ChainConfig {
    chainId: number;
    name: string;

    // Connectivity
    rpcConfig: {
        primary: string; // HTTP
        websocket?: string;
        secondary?: string; // Failover
        nodeType: 'MANAGED' | 'SELF_HOSTED';
    };

    // Properties
    nativeGasToken: string;
    explorerUrl: string;
    feeModel: 'EIP1559' | 'LEGACY';
    finalityConfirmations: number; // e.g., 64 blocks

    // Operational
    status: 'TESTING' | 'ACTIVE_RESTRICTED' | 'ACTIVE_PUBLIC' | 'PAUSED';
    health?: {
        lastCheck: number;
        status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    };

    // Adapters (Contracts)
    contracts?: {
        entryPoint: string;
        paymasterFactory: string;
        bridgeAdapter: string;
    };

    // Legacy/Compat (to be refactored)
    security?: {
        agentWalletAddr: string;
        checkKeyId: string;
    };
    policy?: {
        surchargePct: number;
        dailyCap: string;
        maxGasPrice: string;
    };
}

export interface AuditLog {
    logId: string;
    action: string;
    adminId: string;
    targetId: string; // ChainID, PoolID, or DAppID
    changes: Record<string, any>;
    timestamp: number;
}

export interface ComplianceHooks {
    isDenylisted: boolean;
    fraudFlag: boolean;
    riskScore: number;
    freezeReason?: string;
}

export interface DAppAccount {
    dappId: string;
    ownerId: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
    allowedChains: number[];
    compliance: ComplianceHooks;
    createdAt: number;
}

export interface PaymasterPool {
    poolId: string;
    chainId: number;
    gasAccountAddress: string;
    vaultAddress: string;
    balance: bigint;
    minBalance: bigint;
    targetBalance: bigint;
    mode: PaymasterMode;
    spendRate24h: bigint;
    pendingTx: number;
    lastTopUpAt: number;
    anomalyScore: number;
}

export interface DAppPaymasterInstance {
    instanceId: string;
    dappId: string;
    chainId: number;
    apiKey: string;
    webhookUrl?: string; // Optional URL for events
    depositedBalance: bigint; // For self-funded dApps
    policy: {
        sponsorScheme: 'FULL' | 'DISCOUNT' | 'SUBSIDIZED';
        dailyGasCap: bigint;
        perUserDailyCap: bigint;
        whitelistTokens: string[];
    };
    analytics: {
        totalSponsored: bigint;
        txCount: number;
        userCount: number;
    };
}

export interface FeeQuote {
    quoteId: string;
    routeId: string;           // e.g., keccak256("VCN/BASE")
    dappId: string;
    userId: string;
    chainId: number;
    tokenIn: string;
    amountIn: bigint;          // Transfer request amount
    baseCostNative: bigint;    // Destination gas cost in native
    surchargeRateBps: number;  // 2000-5000 bps
    totalMaxTokenIn: bigint;
    baseCost: bigint;
    surcharge: bigint;
    buffer: bigint;
    expiry: number;
    status: 'PENDING' | 'EXECUTED' | 'SETTLED' | 'EXPIRED' | 'DECLINED';
    declineReason?: string;    // CAP_EXCEEDED, POOL_PAUSED, OUT_OF_POLICY, etc.
}

// ============================================
// EXPLORER INDEXING EVENT SCHEMA (PRD v1.1 §3)
// ============================================

/** FeeQuoted - Quote issuance proof */
export interface FeeQuotedEvent {
    quoteId: string;
    routeId: string;
    dappId: string;
    userAddress: string;
    tokenIn: string;
    amountIn: bigint;
    baseCostNative: bigint;
    surchargeRateBps: number;
    totalMaxTokenIn: bigint;
    expiry: number;
    timestamp: number;
}

/** FeeDeducted - Deduction from user/dApp pool */
export interface FeeDeductedEvent {
    quoteId: string;
    tokenIn: string;
    deductedAmount: bigint;
    payerType: 'USER' | 'DAPP_POOL';
    payerAddress: string;
    timestamp: number;
}

/** SponsoredExecutionSubmitted - Destination tx relay proof */
export interface SponsoredExecutionSubmittedEvent {
    quoteId: string;
    destChainId: number;
    relayerAddress: string;
    gasPayerAddress: string;  // Paymaster gas account
    destTxHash?: string;
    submissionId: string;
    timestamp: number;
}

/** FeeSettled - Final cost confirmation and revenue */
export interface FeeSettledEvent {
    quoteId: string;
    actualGasCostNative: bigint;
    actualSurchargeNative: bigint;
    actualSurchargeTokenIn: bigint;
    refundTokenIn: bigint;
    creditTokenIn: bigint;
    revenueReceiver: string;  // Revenue vault address
    timestamp: number;
}

/** PaymasterRebalanced - Pool top-up proof */
export interface PaymasterRebalancedEvent {
    routeId: string;
    chainId: number;
    amountNativeGasToken: bigint;
    fromVault: string;
    toGasAccount: string;
    reasonCode: 'BATCH' | 'EMERGENCY';
    jobId: string;
    timestamp: number;
}

/** ModeChanged - State transition tracking */
export interface ModeChangedEvent {
    routeId: string;
    chainId: number;
    oldMode: PaymasterMode;
    newMode: PaymasterMode;
    reasonCode: string;  // e.g., 'LOW_BALANCE', 'GAS_SPIKE', 'MANUAL_PAUSE'
    triggeredBy: 'SYSTEM' | 'ADMIN';
    timestamp: number;
}

/** Union type for all Explorer events */
export type ExplorerEvent =
    | { type: 'FeeQuoted'; data: FeeQuotedEvent }
    | { type: 'FeeDeducted'; data: FeeDeductedEvent }
    | { type: 'SponsoredExecutionSubmitted'; data: SponsoredExecutionSubmittedEvent }
    | { type: 'FeeSettled'; data: FeeSettledEvent }
    | { type: 'PaymasterRebalanced'; data: PaymasterRebalancedEvent }
    | { type: 'ModeChanged'; data: ModeChangedEvent };

// Legacy PaymasterEvent (keep for backward compat)
export interface PaymasterEvent {
    type: 'QUOTE' | 'DEDUCT' | 'EXECUTE' | 'SETTLE' | 'REBALANCE' | 'MODE_CHANGE';
    quoteId?: string;
    chainId?: number;
    amount?: bigint;
    token?: string;
    txHash?: string;
    reason?: string;
    timestamp: number;
}

