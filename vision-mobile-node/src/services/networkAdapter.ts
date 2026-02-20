/**
 * Vision Mobile Node - Network Adapter
 *
 * Detects current network state (WiFi / Cellular / Offline)
 * and adjusts node contribution level accordingly.
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { CONFIG } from './config';

export type NetworkMode = 'wifi' | 'cellular' | 'offline';

export interface ContributionLevel {
    mode: NetworkMode;
    heartbeatIntervalMs: number;
    blockObserverEnabled: boolean;
    relayEnabled: boolean;
    cacheEnabled: boolean;
    weight: number;
}

const CONTRIBUTION_LEVELS: Record<NetworkMode, ContributionLevel> = {
    wifi: {
        mode: 'wifi',
        heartbeatIntervalMs: CONFIG.HEARTBEAT_INTERVAL_WIFI_MS,
        blockObserverEnabled: true,
        relayEnabled: true,
        cacheEnabled: true,
        weight: 0.5,
    },
    cellular: {
        mode: 'cellular',
        heartbeatIntervalMs: CONFIG.HEARTBEAT_INTERVAL_CELLULAR_MS,
        blockObserverEnabled: false,
        relayEnabled: false,
        cacheEnabled: false,
        weight: 0.1,
    },
    offline: {
        mode: 'offline',
        heartbeatIntervalMs: 0,
        blockObserverEnabled: false,
        relayEnabled: false,
        cacheEnabled: false,
        weight: 0,
    },
};

type NetworkChangeCallback = (level: ContributionLevel) => void;

class NetworkAdapter {
    private currentMode: NetworkMode = 'offline';
    private listeners: NetworkChangeCallback[] = [];
    private unsubscribe: (() => void) | null = null;

    /**
     * Start monitoring network state changes
     */
    start(): void {
        this.unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            const newMode = this.detectMode(state);
            if (newMode !== this.currentMode) {
                this.currentMode = newMode;
                const level = this.getContributionLevel();
                console.log(
                    `[NetworkAdapter] Mode changed: ${newMode} (weight: ${level.weight}x)`,
                );
                this.listeners.forEach(cb => cb(level));
            }
        });
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    /**
     * Get current contribution level
     */
    getContributionLevel(): ContributionLevel {
        return CONTRIBUTION_LEVELS[this.currentMode];
    }

    /**
     * Get current network mode
     */
    getMode(): NetworkMode {
        return this.currentMode;
    }

    /**
     * Subscribe to network mode changes
     */
    onChange(callback: NetworkChangeCallback): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Force refresh network state
     */
    async refresh(): Promise<ContributionLevel> {
        const state = await NetInfo.fetch();
        this.currentMode = this.detectMode(state);
        return this.getContributionLevel();
    }

    private detectMode(state: NetInfoState): NetworkMode {
        if (!state.isConnected) {
            return 'offline';
        }
        if (state.type === NetInfoStateType.wifi || state.type === NetInfoStateType.ethernet) {
            return 'wifi';
        }
        if (state.type === NetInfoStateType.cellular) {
            return 'cellular';
        }
        // Default to cellular for unknown connected states
        return 'cellular';
    }
}

export const networkAdapter = new NetworkAdapter();
