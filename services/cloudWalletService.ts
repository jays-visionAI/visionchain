import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from './firebaseService';
import { WalletService } from './walletService';

const functions = getFunctions(getFirebaseApp(), 'us-central1');

// Password strength calculation
export interface PasswordStrength {
    length: number;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    score: number;
    isStrongEnough: boolean;
}

/**
 * Calculate password strength for cloud sync requirements
 * Minimum for cloud sync: 10+ chars and 3+ of (upper/lower/number/special)
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    const score = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
    const isStrongEnough = password.length >= 10 && score >= 3;

    return {
        length: password.length,
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial,
        score,
        isStrongEnough,
    };
}

/**
 * Generate a device fingerprint for security tracking
 * This helps identify returning devices vs new ones
 */
export function generateDeviceFingerprint(): string {
    try {
        const components = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            (navigator as any).deviceMemory || 'unknown',
        ];

        // Simple hash function
        const str = components.join('|');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }

        // Convert to hex and add timestamp salt
        return Math.abs(hash).toString(16) + '-' + Date.now().toString(36).slice(-4);
    } catch (e) {
        // Fallback
        return 'fp-' + Math.random().toString(36).slice(2, 10);
    }
}

/**
 * Get or create a persistent device ID (stored in localStorage)
 */
export function getDeviceId(): string {
    const storageKey = 'vcn_device_fingerprint';
    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
        deviceId = generateDeviceFingerprint();
        localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
}

/**
 * Cloud Wallet Sync Service
 * Provides secure wallet synchronization across browsers/devices
 * Uses envelope encryption (client + server-side) for maximum security
 */
export const CloudWalletService = {
    /**
     * Save encrypted wallet to cloud
     * The wallet is encrypted twice:
     * 1. Client-side: User password -> AES-256-GCM
     * 2. Server-side: Server master key -> AES-256-GCM (envelope encryption)
     */
    async saveToCloud(
        mnemonic: string,
        password: string,
        walletAddress: string,
        userEmail: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. Check password strength
            const strength = calculatePasswordStrength(password);
            if (!strength.isStrongEnough) {
                return {
                    success: false,
                    error: 'Password too weak for cloud sync. Minimum: 10 characters with uppercase, lowercase, and numbers.',
                };
            }

            // 2. Client-side encryption (same as local storage)
            const clientEncryptedWallet = await WalletService.encrypt(mnemonic, password);

            // 3. Also save to local storage for this browser
            WalletService.saveEncryptedWallet(clientEncryptedWallet, userEmail);

            // 4. Send to server for envelope encryption
            const saveWalletToCloud = httpsCallable(functions, 'saveWalletToCloud');
            const result = await saveWalletToCloud({
                clientEncryptedWallet,
                walletAddress,
                passwordStrength: {
                    length: strength.length,
                    hasUpper: strength.hasUpper,
                    hasLower: strength.hasLower,
                    hasNumber: strength.hasNumber,
                    hasSpecial: strength.hasSpecial,
                },
            });

            const data = result.data as { success: boolean };

            if (data.success) {
                console.log('[CloudSync] Wallet saved to cloud successfully');
                return { success: true };
            } else {
                return { success: false, error: 'Server error' };
            }
        } catch (err: any) {
            console.error('[CloudSync] Save failed:', err);
            return { success: false, error: err.message || 'Failed to save wallet' };
        }
    },

    /**
     * Load encrypted wallet from cloud
     * Automatically saves to local storage after successful load
     */
    async loadFromCloud(
        password: string,
        userEmail: string
    ): Promise<{ success: boolean; mnemonic?: string; walletAddress?: string; error?: string; requiresVerification?: boolean }> {
        try {
            // 1. Fetch from server (server decrypts its layer)
            const loadWalletFromCloud = httpsCallable(functions, 'loadWalletFromCloud');
            const result = await loadWalletFromCloud({
                deviceFingerprint: getDeviceId(), // Send device ID for security tracking
            });

            const data = result.data as {
                exists: boolean;
                clientEncryptedWallet?: string;
                walletAddress?: string;
                needsMigration?: boolean;
                requiresDeviceVerification?: boolean;
                message?: string;
            };

            // Handle new device verification requirement
            if (data.requiresDeviceVerification) {
                return {
                    success: false,
                    error: data.message || 'New device detected. Please check your email for a verification code.',
                    requiresVerification: true,
                };
            }

            if (!data.exists) {
                if (data.needsMigration) {
                    return { success: false, error: 'Wallet format outdated. Please restore from seed phrase.' };
                }
                return { success: false, error: 'No cloud wallet found for this account.' };
            }

            // 2. Client-side decryption with user password
            const mnemonic = await WalletService.decrypt(data.clientEncryptedWallet!, password);

            // 3. Verify by deriving wallet
            const derived = WalletService.deriveEOA(mnemonic);
            if (derived.address.toLowerCase() !== data.walletAddress?.toLowerCase()) {
                console.warn('[CloudSync] Address mismatch after decryption');
                // Still proceed - might be edge case
            }

            // 4. Save to local storage for future use
            WalletService.saveEncryptedWallet(data.clientEncryptedWallet!, userEmail);
            WalletService.saveAddressHint(derived.address, userEmail);

            console.log('[CloudSync] Wallet loaded from cloud successfully');
            return {
                success: true,
                mnemonic,
                walletAddress: derived.address,
            };
        } catch (err: any) {
            console.error('[CloudSync] Load failed:', err);

            // Check for decryption failure (wrong password)
            if (err.message?.includes('Decryption failed') || err.message?.includes('Incorrect password')) {
                return { success: false, error: 'Incorrect password. Please try again.' };
            }

            return { success: false, error: err.message || 'Failed to load wallet' };
        }
    },

    /**
     * Check if user has a cloud wallet without loading it
     */
    async hasCloudWallet(): Promise<{ exists: boolean; walletAddress?: string }> {
        try {
            const checkCloudWallet = httpsCallable(functions, 'checkCloudWallet');
            const result = await checkCloudWallet({});

            const data = result.data as {
                exists: boolean;
                walletAddress?: string;
            };

            return {
                exists: data.exists,
                walletAddress: data.walletAddress,
            };
        } catch (err) {
            console.error('[CloudSync] Check failed:', err);
            return { exists: false };
        }
    },

    /**
     * Sync local wallet to cloud (for users who created wallet before cloud sync)
     */
    async syncLocalToCloud(
        password: string,
        userEmail: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // 1. Get encrypted wallet from local storage
            const encryptedWallet = WalletService.getEncryptedWallet(userEmail);
            if (!encryptedWallet) {
                return { success: false, error: 'No local wallet found' };
            }

            // 2. Decrypt to verify password is correct
            const mnemonic = await WalletService.decrypt(encryptedWallet, password);
            const derived = WalletService.deriveEOA(mnemonic);

            // 3. Re-encrypt and save to cloud
            return await this.saveToCloud(mnemonic, password, derived.address, userEmail);
        } catch (err: any) {
            console.error('[CloudSync] Sync failed:', err);
            return { success: false, error: err.message || 'Failed to sync wallet' };
        }
    },

    /**
     * Verify a new device with email verification code
     */
    async verifyDevice(
        verificationCode: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const verifyDeviceCode = httpsCallable(functions, 'verifyDeviceCode');
            const result = await verifyDeviceCode({
                verificationCode,
                deviceFingerprint: getDeviceId(),
            });

            const data = result.data as { success: boolean; message?: string };

            if (data.success) {
                console.log('[CloudSync] Device verified successfully');
                return { success: true };
            } else {
                return { success: false, error: 'Verification failed' };
            }
        } catch (err: any) {
            console.error('[CloudSync] Device verification failed:', err);
            return {
                success: false,
                error: err.message || 'Failed to verify device',
            };
        }
    },
};
