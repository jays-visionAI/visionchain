/**
 * Environment Configuration Service
 * 
 * Provides environment-aware configuration for Vision Chain application.
 * Supports: development, staging, production
 */

type Environment = 'development' | 'staging' | 'production';

// Detect current environment from URL or env variable
// Hostname detection takes priority (runtime truth), env variable is fallback
const detectEnvironment = (): Environment => {
    // 1. Auto-detect from hostname at runtime (most reliable)
    if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname;

        // Check staging FIRST (more specific)
        if (hostname.startsWith('staging.') || hostname.includes('staging.')) {
            return 'staging';
        }

        // Check localhost/dev
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('localhost')) {
            return 'development';
        }

        // Production is any visionchain.co without staging
        if (hostname.includes('visionchain.co')) {
            return 'production';
        }
    }

    // 2. Fallback to env variable (build-time override)
    const envVar = import.meta.env.VITE_CHAIN_ENV as Environment;
    if (envVar && ['development', 'staging', 'production'].includes(envVar)) {
        return envVar;
    }

    // Default fallback
    return 'development';
};

// Execute detection at module load time (which is runtime in browser)
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
