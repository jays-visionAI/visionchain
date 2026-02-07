/**
 * Environment Configuration Service
 * 
 * Provides environment-aware configuration for Vision Chain application.
 * Supports: development, staging, production
 */

type Environment = 'development' | 'staging' | 'production';

// Detect current environment from URL or env variable
const detectEnvironment = (): Environment => {
    // Check env variable first
    const envVar = import.meta.env.VITE_CHAIN_ENV as Environment;
    if (envVar) return envVar;

    // Auto-detect from hostname
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname.includes('staging.')) return 'staging';
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) return 'development';
        if (hostname.includes('visionchain.co') && !hostname.includes('staging.')) return 'production';
    }

    return 'development';
};

export const ENV: Environment = detectEnvironment();

// Environment-specific configurations
const CONFIGS: Record<Environment, {
    name: string;
    isProduction: boolean;
    rpcUrl: string;
    chainId: number;
    explorerUrl: string;
    apiBaseUrl: string;
}> = {
    development: {
        name: 'Development',
        isProduction: false,
        rpcUrl: 'http://127.0.0.1:8545',
        chainId: 1337,
        explorerUrl: 'http://localhost:3001',
        apiBaseUrl: 'http://localhost:5001',
    },
    staging: {
        name: 'Staging',
        isProduction: false,
        rpcUrl: import.meta.env.VITE_RPC_URL || 'https://api.visionchain.co/rpc-proxy',
        chainId: 3151909,
        explorerUrl: 'https://www.visionchain.co/visionscan',
        apiBaseUrl: 'https://staging-api.visionchain.co',
    },
    production: {
        name: 'Production',
        isProduction: true,
        rpcUrl: import.meta.env.VITE_RPC_URL || 'https://api.visionchain.co/rpc-proxy',
        chainId: 3151909,
        explorerUrl: 'https://www.visionchain.co/visionscan',
        apiBaseUrl: 'https://api.visionchain.co',
    },
};

// Export current environment config
export const CONFIG = CONFIGS[ENV];

// Helper functions
export const isProduction = () => ENV === 'production';
export const isStaging = () => ENV === 'staging';
export const isDevelopment = () => ENV === 'development';

// Console banner for environment awareness
if (typeof window !== 'undefined') {
    const style = ENV === 'production'
        ? 'background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
        : ENV === 'staging'
            ? 'background: #f59e0b; color: black; padding: 4px 8px; border-radius: 4px; font-weight: bold;'
            : 'background: #6366f1; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;';

    console.log(`%c Vision Chain - ${CONFIG.name} Environment `, style);
    console.log(`RPC: ${CONFIG.rpcUrl}`);
}

export default CONFIG;
