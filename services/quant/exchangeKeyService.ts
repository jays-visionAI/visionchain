/**
 * Exchange Key Service - API Key Registration, Validation, and Management
 *
 * Handles secure storage and retrieval of user exchange API keys.
 * All keys are encrypted server-side (Cloud Functions) before Firestore storage.
 * Frontend only stores masked references.
 *
 * Firestore path: exchangeKeys/{keyId}
 */

import { getFirebaseDb } from '../firebaseService';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// ─── Types ─────────────────────────────────────────────────────────────────

export type SupportedExchange =
    | 'upbit' | 'bithumb' | 'coinone'            // KRW
    | 'binance' | 'bybit' | 'bitget' | 'okx'     // USDT (futures)
    | 'kucoin' | 'mexc' | 'cryptocom'             // USDT
    | 'bitkub'                                     // THB
    | 'coinbase'                                   // USD
    | 'bitflyer' | 'gmo' | 'coincheck';           // JPY

export interface ExchangeKeyInfo {
    id: string;
    userId: string;
    exchange: SupportedExchange;
    label: string;
    /** Masked key for display: "xxxx...xxxx" */
    maskedKey: string;
    /** Permissions verified at registration */
    permissions: string[];
    /** Whether this key has been validated against the exchange */
    isValid: boolean;
    /** Whether withdrawal permission was detected (should always be false) */
    hasWithdrawPermission: boolean;
    /** Whether this exchange requires a passphrase */
    requiresPassphrase?: boolean;
    /** Exchange capabilities (spot, futures, margin) */
    capabilities?: { spot?: boolean; futures?: boolean; margin?: boolean; baseCurrency?: string };
    lastValidatedAt: string;
    createdAt: string;
}

export interface RegisterKeyParams {
    exchange: SupportedExchange;
    label: string;
    apiKey: string;
    apiSecret: string;
    /** Required for bitget, okx, kucoin, cryptocom */
    passphrase?: string;
}

export interface RegisterKeyResult {
    success: boolean;
    keyId?: string;
    maskedKey?: string;
    permissions?: string[];
    error?: string;
}

// ─── Service Functions ─────────────────────────────────────────────────────

const functions = getFunctions(undefined, 'us-central1');

/**
 * Register a new exchange API key.
 * The key is sent to Cloud Functions for validation and encrypted storage.
 * Frontend never stores the raw key.
 */
export async function registerExchangeKey(params: RegisterKeyParams): Promise<RegisterKeyResult> {
    try {
        const registerFn = httpsCallable(functions, 'registerExchangeKey');
        const result = await registerFn(params);
        return result.data as RegisterKeyResult;
    } catch (err: any) {
        console.error('[ExchangeKeyService] Registration failed:', err);
        return {
            success: false,
            error: err.message || 'Failed to register API key',
        };
    }
}

/**
 * Get all registered exchange keys for a user (masked, no secrets).
 */
export async function getUserExchangeKeys(userId: string, exchangeFilter?: SupportedExchange): Promise<ExchangeKeyInfo[]> {
    try {
        const db = getFirebaseDb();
        const constraints: any[] = [where('userId', '==', userId)];
        if (exchangeFilter) {
            constraints.push(where('exchange', '==', exchangeFilter));
        }
        const q = query(collection(db, 'exchangeKeys'), ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data() as ExchangeKeyInfo);
    } catch (err) {
        console.error('[ExchangeKeyService] Failed to fetch keys:', err);
        return [];
    }
}

/**
 * Re-validate an existing key against the exchange.
 */
export async function revalidateKey(keyId: string): Promise<{ valid: boolean; error?: string }> {
    try {
        const revalidateFn = httpsCallable(functions, 'revalidateExchangeKey');
        const result = await revalidateFn({ keyId });
        return result.data as { valid: boolean; error?: string };
    } catch (err: any) {
        return { valid: false, error: err.message };
    }
}

/**
 * Delete an exchange API key.
 * Only allowed if no active Live agents are using this key.
 */
export async function deleteExchangeKey(keyId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const deleteFn = httpsCallable(functions, 'deleteExchangeKey');
        const result = await deleteFn({ keyId });
        return result.data as { success: boolean; error?: string };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

/**
 * Check if the Quant Engine global kill switch is active.
 * Used by frontend to display warnings.
 */
export async function checkGlobalKillSwitch(): Promise<boolean> {
    try {
        const db = getFirebaseDb();
        const configDoc = await getDoc(doc(db, 'quantEngine', 'config'));
        if (configDoc.exists()) {
            const data = configDoc.data();
            return data.globalPause === true;
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * Mask an API key for display: shows first 4 and last 4 characters.
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}
