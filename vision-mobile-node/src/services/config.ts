/**
 * Vision Mobile Node - Configuration
 *
 * Environment-specific endpoints and constants.
 */

export const CONFIG = {
    // API Endpoints
    STAGING_API: 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway',
    PRODUCTION_API: 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway',

    // RPC WebSocket Endpoints (for Block Observer)
    STAGING_WS_RPC: 'wss://ws.rpc.visionchain.co',
    PRODUCTION_WS_RPC: 'wss://ws.rpc.visionchain.co',

    // Chain Config
    CHAIN_ID: 3151909,
    BLOCK_PERIOD_SECONDS: 5,

    // Heartbeat
    HEARTBEAT_INTERVAL_WIFI_MS: 5 * 60 * 1000, // 5 minutes
    HEARTBEAT_INTERVAL_CELLULAR_MS: 30 * 60 * 1000, // 30 minutes

    // Block Observer
    BLOCK_VERIFY_INTERVAL_MS: 5 * 60 * 1000, // Check every 5 minutes
    ATTESTATION_BATCH_SIZE: 10, // Submit attestation every 10 blocks

    // Storage Cache
    MAX_CACHE_SIZE_MB: 50,

    // App Info
    APP_VERSION: '1.0.0',
    BUILD_NUMBER: 1,
};

export type Environment = 'staging' | 'production';

let currentEnv: Environment = __DEV__ ? 'staging' : 'production';

export const getApiUrl = (): string => {
    return currentEnv === 'staging' ? CONFIG.STAGING_API : CONFIG.PRODUCTION_API;
};

export const getWsRpcUrl = (): string => {
    return currentEnv === 'staging' ? CONFIG.STAGING_WS_RPC : CONFIG.PRODUCTION_WS_RPC;
};

export const setEnvironment = (env: Environment): void => {
    currentEnv = env;
};

export const getEnvironment = (): Environment => currentEnv;
