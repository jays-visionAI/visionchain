/**
 * Environment Configuration Service
 * 
 * Provides environment-aware configuration for Vision Chain application.
 * Supports: development, staging, production
 */

type Environment = 'development' | 'staging' | 'production';

// Detect current environment
export const ENV: Environment = (import.meta.env.VITE_CHAIN_ENV as Environment) || 'development';

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
        rpcUrl: import.meta.env.VITE_RPC_URL || 'http://46.224.221.201:8545',
        chainId: 1337,
        explorerUrl: 'https://www.visionchain.co/visionscan',
        apiBaseUrl: 'https://staging-api.visionchain.co',
    },
    production: {
        name: 'Production',
        isProduction: true,
        rpcUrl: import.meta.env.VITE_RPC_URL || 'http://46.224.221.201:8545',
        chainId: 1337,
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
