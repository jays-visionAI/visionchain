export type PaymasterMode = 'INIT' | 'NORMAL' | 'SAFE_MODE' | 'THROTTLED' | 'PAUSED' | 'RECOVERY';

export interface ChainConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    nativeGasToken: string;
    explorerUrl: string;
    status: 'Testing' | 'Active' | 'Paused';
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
    dappId: string;
    userId: string;
    chainId: number;
    tokenIn: string;
    totalMaxTokenIn: bigint;
    baseCost: bigint;
    surcharge: bigint;
    buffer: bigint;
    expiry: number;
    status: 'PENDING' | 'EXECUTED' | 'SETTLED' | 'EXPIRED' | 'DECLINED';
}

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
