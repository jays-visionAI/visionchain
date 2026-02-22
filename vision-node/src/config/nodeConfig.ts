/**
 * Vision Node - Configuration
 *
 * Manages node configuration stored in ~/.visionnode/config.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export type NodeClass = 'lite' | 'standard' | 'full' | 'agent';
export type Environment = 'staging' | 'production';

export interface NodeConfig {
    // Identity
    nodeId: string;
    email: string;
    apiKey: string;
    walletAddress: string;
    referralCode: string;

    // Node settings
    nodeClass: NodeClass;
    environment: Environment;
    storagePath: string;
    storageMaxGB: number;

    // Network
    heartbeatIntervalMs: number;
    dashboardPort: number;
    p2pPort: number;

    // API endpoints
    apiUrl: string;
    wsRpcUrl: string;

    // State
    registered: boolean;
    firstLaunch: string;
    lastLaunch: string;
}

const DEFAULT_CONFIG: NodeConfig = {
    nodeId: '',
    email: '',
    apiKey: '',
    walletAddress: '',
    referralCode: '',
    nodeClass: 'standard',
    environment: 'production',
    storagePath: '',
    storageMaxGB: 50,
    heartbeatIntervalMs: 5 * 60 * 1000, // 5 minutes
    dashboardPort: 9090,
    p2pPort: 4001,
    apiUrl: 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway',
    wsRpcUrl: 'wss://ws.rpc.visionchain.co',
    registered: false,
    firstLaunch: '',
    lastLaunch: '',
};

const STAGING_API = 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';
const PRODUCTION_API = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';

export class ConfigManager {
    private config: NodeConfig;
    private configDir: string;
    private configPath: string;

    constructor() {
        this.configDir = join(homedir(), '.visionnode');
        this.configPath = join(this.configDir, 'config.json');
        this.config = { ...DEFAULT_CONFIG };

        // Set default storage path
        this.config.storagePath = join(this.configDir, 'storage');
    }

    /**
     * Load config from disk, or create default if missing
     */
    load(): NodeConfig {
        if (!existsSync(this.configDir)) {
            mkdirSync(this.configDir, { recursive: true });
        }

        if (existsSync(this.configPath)) {
            try {
                const raw = readFileSync(this.configPath, 'utf-8');
                const saved = JSON.parse(raw);
                this.config = { ...DEFAULT_CONFIG, ...saved };
            } catch {
                // Corrupted config, use defaults
                this.config = { ...DEFAULT_CONFIG };
                this.config.storagePath = join(this.configDir, 'storage');
            }
        }

        return this.config;
    }

    /**
     * Save current config to disk
     */
    save(): void {
        if (!existsSync(this.configDir)) {
            mkdirSync(this.configDir, { recursive: true });
        }
        writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    }

    /**
     * Get current config (in-memory)
     */
    get(): NodeConfig {
        return this.config;
    }

    /**
     * Update config values
     */
    update(partial: Partial<NodeConfig>): void {
        this.config = { ...this.config, ...partial };

        // Auto-set API URL based on environment
        if (partial.environment) {
            this.config.apiUrl = partial.environment === 'staging' ? STAGING_API : PRODUCTION_API;
        }
    }

    /**
     * Check if node is initialized (has been through init)
     */
    isInitialized(): boolean {
        return !!this.config.email && this.config.email.length > 0;
    }

    /**
     * Check if node is registered with the backend
     */
    isRegistered(): boolean {
        return this.config.registered && !!this.config.apiKey;
    }

    /**
     * Get the config directory path
     */
    getConfigDir(): string {
        return this.configDir;
    }

    /**
     * Get the storage directory path
     */
    getStoragePath(): string {
        return this.config.storagePath;
    }
}

export const configManager = new ConfigManager();
