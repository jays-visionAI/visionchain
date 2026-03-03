/**
 * biometricAuthService.ts
 *
 * WebAuthn-based biometric authentication for transaction signing approval.
 * - iOS: Face ID / Touch ID
 * - Android: Fingerprint / Face Unlock
 * - Mac: Touch ID
 * - Windows: Windows Hello
 *
 * Flow:
 *   1. First use: register() → creates a credential stored on device
 *   2. Subsequent: authenticate() → prompts Face/Touch ID → returns boolean
 */

const RP_ID = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
const RP_NAME = 'Vision Chain Wallet';
const CREDENTIAL_KEY = 'vcn_biometric_credential_id';

// ── Capability check ─────────────────────────────────────────────────────────
export function isBiometricAvailable(): boolean {
    return !!(
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential === 'function'
    );
}

/**
 * Check if platform authenticator (Face ID / Touch ID / Fingerprint) is available.
 * Returns false on desktop without biometric hardware.
 */
export async function hasPlatformAuthenticator(): Promise<boolean> {
    if (!isBiometricAvailable()) return false;
    try {
        return await (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

// ── Registration (first time) ─────────────────────────────────────────────────
/**
 * Register a biometric credential for the given user.
 * Must be called in a user-gesture context (button click, etc.)
 */
export async function registerBiometric(userId: string, displayName: string): Promise<boolean> {
    if (!isBiometricAvailable()) return false;

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = new TextEncoder().encode(userId);

    const opts: PublicKeyCredentialCreationOptions = {
        rp: { id: RP_ID, name: RP_NAME },
        user: {
            id: userIdBytes,
            name: userId,
            displayName,
        },
        challenge,
        pubKeyCredParams: [
            { alg: -7, type: 'public-key' },   // ES256
            { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
            authenticatorAttachment: 'platform', // Forces built-in biometric
            userVerification: 'required',
            residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
    };

    try {
        const credential = await navigator.credentials.create({ publicKey: opts });
        if (!credential) return false;

        // Store the credential ID for later authentication
        const credId = (credential as PublicKeyCredential).rawId;
        const credIdB64 = btoa(String.fromCharCode(...new Uint8Array(credId)));
        localStorage.setItem(CREDENTIAL_KEY, credIdB64);
        return true;
    } catch (err: any) {
        console.error('[Biometric] Registration failed:', err.message);
        return false;
    }
}

// ── Authentication ────────────────────────────────────────────────────────────
/**
 * Prompt biometric verification. Returns true if the user verified successfully.
 * @param challengeMessage – shown as context (not enforced by all browsers)
 */
export async function authenticateWithBiometric(challengeMessage?: string): Promise<boolean> {
    if (!isBiometricAvailable()) return false;

    const storedCredId = localStorage.getItem(CREDENTIAL_KEY);
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // Encode challenge context in last 8 bytes if message provided
    if (challengeMessage) {
        const msg = new TextEncoder().encode(challengeMessage.slice(0, 8));
        challenge.set(msg, 24);
    }

    const allowCredentials: PublicKeyCredentialDescriptor[] = storedCredId
        ? [{ id: Uint8Array.from(atob(storedCredId), c => c.charCodeAt(0)), type: 'public-key' }]
        : [];

    const opts: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: RP_ID,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000,
    };

    try {
        const assertion = await navigator.credentials.get({ publicKey: opts });
        return !!assertion;
    } catch (err: any) {
        if (err.name === 'NotAllowedError') {
            // User cancelled or timeout
            console.warn('[Biometric] User cancelled authentication');
        } else {
            console.error('[Biometric] Authentication failed:', err.message);
        }
        return false;
    }
}

/**
 * Check if a credential is already registered for this device.
 */
export function isBiometricRegistered(): boolean {
    return !!localStorage.getItem(CREDENTIAL_KEY);
}

/**
 * Remove stored credential (e.g. on logout or reset).
 */
export function clearBiometricCredential(): void {
    localStorage.removeItem(CREDENTIAL_KEY);
}

/**
 * Get a user-friendly label for the available biometric method.
 */
export async function getBiometricLabel(): Promise<string> {
    const available = await hasPlatformAuthenticator();
    if (!available) return 'Password';

    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad/.test(ua)) return 'Face ID / Touch ID';
    if (/android/.test(ua)) return 'Fingerprint / Face Unlock';
    if (/mac/.test(ua)) return 'Touch ID';
    if (/win/.test(ua)) return 'Windows Hello';
    return 'Biometric';
}
