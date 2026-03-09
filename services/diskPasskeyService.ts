/**
 * Vision Disk Passkey Service
 * Manages encryption password storage with WebAuthn biometric authentication.
 *
 * Flow:
 * 1. User enters encryption password for the first time
 * 2. If device supports biometrics, offer to save with passkey
 * 3. Next time, user authenticates with fingerprint/face → password auto-retrieved
 * 4. Devices without biometrics fall back to manual password entry
 *
 * Storage: IndexedDB (encrypted passwords keyed by credential ID)
 * Auth: WebAuthn Platform Authenticator (fingerprint, Face ID, etc.)
 */

const DB_NAME = 'vision_disk_passkeys';
const DB_VERSION = 1;
const STORE_NAME = 'passwords';

// ─── IndexedDB Helpers ───

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbGet(id: string): Promise<any> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbPut(record: any): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function dbDelete(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

async function dbGetAll(): Promise<any[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

// ─── WebAuthn Helpers ───

/**
 * Check if the device supports WebAuthn platform authenticator (biometrics).
 */
export async function isBiometricAvailable(): Promise<boolean> {
    try {
        if (typeof window === 'undefined') return false;
        if (!window.PublicKeyCredential) return false;
        // Check for platform authenticator (fingerprint, Face ID, Windows Hello)
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
    } catch {
        return false;
    }
}

/**
 * Check if an encryption password is saved for a given email (user).
 */
export async function hasStoredPassword(userEmail: string): Promise<boolean> {
    try {
        const record = await dbGet(`passkey_${userEmail}`);
        return !!record?.password;
    } catch {
        return false;
    }
}

/**
 * Generate a random challenge for WebAuthn operations.
 */
function generateChallenge(): Uint8Array {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge;
}

/**
 * Convert string to ArrayBuffer for WebAuthn.
 */
function strToBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str).buffer as ArrayBuffer;
}

/**
 * Register a passkey and save the encryption password.
 * Triggers biometric prompt (fingerprint/Face ID).
 * 
 * @param userEmail - User's email (used as unique identifier)
 * @param password - The encryption password to save
 * @returns true if saved successfully, false if cancelled/failed
 */
export async function savePasswordWithBiometric(userEmail: string, password: string): Promise<boolean> {
    try {
        const available = await isBiometricAvailable();
        if (!available) return false;

        const challenge = generateChallenge();
        const userId = strToBuffer(userEmail);

        // Create a new credential (triggers biometric prompt)
        const credential = await navigator.credentials.create({
            publicKey: {
                challenge: challenge.buffer as ArrayBuffer,
                rp: {
                    name: 'Vision Disk',
                    id: window.location.hostname,
                },
                user: {
                    id: new Uint8Array(userId) as BufferSource,
                    name: userEmail,
                    displayName: `Vision Disk (${userEmail.split('@')[0]})`,
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },   // ES256
                    { alg: -257, type: 'public-key' },  // RS256
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',  // Force platform (biometric)
                    userVerification: 'required',
                    residentKey: 'preferred',
                },
                timeout: 60000,
            },
        }) as PublicKeyCredential | null;

        if (!credential) return false;

        // Store the credential ID and password in IndexedDB
        const credentialId = Array.from(new Uint8Array(credential.rawId))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        await dbPut({
            id: `passkey_${userEmail}`,
            credentialId,
            credentialIdRaw: Array.from(new Uint8Array(credential.rawId)),
            password,  // Stored locally on device only
            createdAt: new Date().toISOString(),
            userEmail,
        });

        console.log('[DiskPasskey] Password saved with biometric for', userEmail);
        return true;
    } catch (err: any) {
        // User cancelled or biometric failed
        if (err.name === 'NotAllowedError') {
            console.log('[DiskPasskey] User cancelled biometric registration');
            return false;
        }
        console.error('[DiskPasskey] Registration failed:', err);
        return false;
    }
}

/**
 * Authenticate with biometric and retrieve the stored encryption password.
 * Triggers biometric prompt (fingerprint/Face ID).
 * 
 * @param userEmail - User's email
 * @returns The stored password if authenticated, null if failed/cancelled
 */
export async function getPasswordWithBiometric(userEmail: string): Promise<string | null> {
    try {
        const record = await dbGet(`passkey_${userEmail}`);
        if (!record?.credentialIdRaw || !record?.password) return null;

        const challenge = generateChallenge();
        const credentialIdBuffer = new Uint8Array(record.credentialIdRaw).buffer as ArrayBuffer;

        // Authenticate (triggers biometric prompt) 
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: challenge.buffer as ArrayBuffer,
                allowCredentials: [{
                    id: credentialIdBuffer,
                    type: 'public-key',
                    transports: ['internal'],
                }],
                userVerification: 'required',
                timeout: 60000,
            },
        }) as PublicKeyCredential | null;

        if (!assertion) return null;

        // Biometric verified - return the stored password
        console.log('[DiskPasskey] Biometric authentication successful for', userEmail);
        return record.password;
    } catch (err: any) {
        if (err.name === 'NotAllowedError') {
            console.log('[DiskPasskey] User cancelled biometric authentication');
            return null;
        }
        console.error('[DiskPasskey] Authentication failed:', err);
        return null;
    }
}

/**
 * Remove stored passkey and password for a user.
 */
export async function removePasskey(userEmail: string): Promise<void> {
    try {
        await dbDelete(`passkey_${userEmail}`);
        console.log('[DiskPasskey] Passkey removed for', userEmail);
    } catch (err) {
        console.error('[DiskPasskey] Remove failed:', err);
    }
}

/**
 * Update the stored password (e.g., after password change).
 * Does NOT re-trigger biometric - just updates the stored value.
 */
export async function updateStoredPassword(userEmail: string, newPassword: string): Promise<boolean> {
    try {
        const record = await dbGet(`passkey_${userEmail}`);
        if (!record) return false;
        record.password = newPassword;
        record.updatedAt = new Date().toISOString();
        await dbPut(record);
        return true;
    } catch {
        return false;
    }
}

/**
 * Get all stored passkey entries (for settings/management UI).
 */
export async function listStoredPasskeys(): Promise<Array<{ userEmail: string; createdAt: string }>> {
    try {
        const all = await dbGetAll();
        return all.map(r => ({ userEmail: r.userEmail, createdAt: r.createdAt }));
    } catch {
        return [];
    }
}
