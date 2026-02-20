/**
 * Vision Mobile Node - Local Storage Service
 *
 * Manages persistent storage for API keys, node info, and settings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    API_KEY: '@vmn/api_key',
    NODE_ID: '@vmn/node_id',
    EMAIL: '@vmn/email',
    WALLET_ADDRESS: '@vmn/wallet_address',
    REFERRAL_CODE: '@vmn/referral_code',
    SETTINGS: '@vmn/settings',
};

export interface NodeCredentials {
    apiKey: string;
    nodeId: string;
    email: string;
    walletAddress: string;
    referralCode: string;
}

export interface AppSettings {
    cellularAllowed: boolean;
    autoPauseBelowBattery: number; // percentage, 0 = disabled
    maxCacheSizeMb: number;
    notificationsEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
    cellularAllowed: false,
    autoPauseBelowBattery: 20,
    maxCacheSizeMb: 50,
    notificationsEnabled: true,
};

/**
 * Save node credentials after registration
 */
export const saveCredentials = async (creds: NodeCredentials): Promise<void> => {
    await AsyncStorage.multiSet([
        [KEYS.API_KEY, creds.apiKey],
        [KEYS.NODE_ID, creds.nodeId],
        [KEYS.EMAIL, creds.email],
        [KEYS.WALLET_ADDRESS, creds.walletAddress],
        [KEYS.REFERRAL_CODE, creds.referralCode],
    ]);
};

/**
 * Load saved credentials (returns null if not registered)
 */
export const loadCredentials = async (): Promise<NodeCredentials | null> => {
    const pairs = await AsyncStorage.multiGet([
        KEYS.API_KEY,
        KEYS.NODE_ID,
        KEYS.EMAIL,
        KEYS.WALLET_ADDRESS,
        KEYS.REFERRAL_CODE,
    ]);

    const apiKey = pairs[0][1];
    const nodeId = pairs[1][1];

    if (!apiKey || !nodeId) {
        return null;
    }

    return {
        apiKey,
        nodeId,
        email: pairs[2][1] || '',
        walletAddress: pairs[3][1] || '',
        referralCode: pairs[4][1] || '',
    };
};

/**
 * Clear all stored credentials (logout)
 */
export const clearCredentials = async (): Promise<void> => {
    await AsyncStorage.multiRemove([
        KEYS.API_KEY,
        KEYS.NODE_ID,
        KEYS.EMAIL,
        KEYS.WALLET_ADDRESS,
        KEYS.REFERRAL_CODE,
    ]);
};

/**
 * Load app settings
 */
export const loadSettings = async (): Promise<AppSettings> => {
    const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
    if (!raw) {
        return DEFAULT_SETTINGS;
    }
    try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_SETTINGS;
    }
};

/**
 * Save app settings
 */
export const saveSettings = async (settings: AppSettings): Promise<void> => {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
};
