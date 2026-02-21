/**
 * Vision Mobile Node - Firebase Auth Service
 *
 * Uses Firebase Auth REST API directly instead of SDK.
 * This avoids all React Native + Firebase SDK compatibility issues.
 * https://firebase.google.com/docs/reference/rest/auth
 */

const FIREBASE_API_KEY = 'AIzaSyAZ-wTAWNkQvlHAh1_bh0jIrzYGfOCENQI';
const AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

/** Error codes for scenario-specific UI handling */
export type AuthErrorCode =
    | 'user-not-found'
    | 'wrong-password'
    | 'invalid-credential'
    | 'email-in-use'
    | 'weak-password'
    | 'too-many-requests'
    | 'network-error'
    | 'invalid-email'
    | 'unknown';

export interface AuthResult {
    success: boolean;
    idToken?: string;
    email?: string;
    localId?: string;
    error?: string;
    errorCode?: AuthErrorCode;
}

/**
 * Sign in with email and password via Firebase REST API
 */
export const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
        console.log('[Auth] Calling Firebase REST signInWithPassword...');
        const response = await fetch(
            `${AUTH_BASE_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true,
                }),
            },
        );

        const data = await response.json();
        console.log('[Auth] signIn response status:', response.status);

        if (!response.ok || data.error) {
            const errorCode = mapFirebaseError(data.error?.message || '');
            const errorMsg = getAuthErrorMessage(data.error?.message || '');
            console.log('[Auth] signIn error:', data.error?.message, '->', errorCode);
            return { success: false, error: errorMsg, errorCode };
        }

        console.log('[Auth] signIn success, got idToken');
        return {
            success: true,
            idToken: data.idToken,
            email: data.email,
            localId: data.localId,
        };
    } catch (err: any) {
        console.warn('[Auth] signIn network error:', err?.message);
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorCode: 'network-error',
        };
    }
};

/**
 * Sign up with email and password via Firebase REST API
 */
export const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
        console.log('[Auth] Calling Firebase REST signUp...');
        const response = await fetch(
            `${AUTH_BASE_URL}:signUp?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    returnSecureToken: true,
                }),
            },
        );

        const data = await response.json();
        console.log('[Auth] signUp response status:', response.status);

        if (!response.ok || data.error) {
            const errorCode = mapFirebaseError(data.error?.message || '');
            const errorMsg = getAuthErrorMessage(data.error?.message || '');
            console.log('[Auth] signUp error:', data.error?.message, '->', errorCode);
            return { success: false, error: errorMsg, errorCode };
        }

        console.log('[Auth] signUp success, got idToken');
        return {
            success: true,
            idToken: data.idToken,
            email: data.email,
            localId: data.localId,
        };
    } catch (err: any) {
        console.warn('[Auth] signUp network error:', err?.message);
        return {
            success: false,
            error: 'Network error. Please check your connection.',
            errorCode: 'network-error',
        };
    }
};

/**
 * Sign out (no-op for REST API -- we just clear local state)
 */
export const firebaseSignOut = async (): Promise<void> => {
    // REST API doesn't maintain session state -- handled by clearing credentials
    console.log('[Auth] signOut (REST API no-op)');
};

/**
 * Get ID token -- not available via REST API, return null
 * (ID token is returned directly from signIn/signUp)
 */
export const getIdToken = async (): Promise<string | null> => {
    return null;
};

/**
 * Map Firebase REST API error messages to our AuthErrorCode
 */
const mapFirebaseError = (message: string): AuthErrorCode => {
    const msg = message.toUpperCase();
    if (msg.includes('EMAIL_NOT_FOUND')) { return 'user-not-found'; }
    if (msg.includes('INVALID_PASSWORD')) { return 'wrong-password'; }
    if (msg.includes('INVALID_LOGIN_CREDENTIALS')) { return 'invalid-credential'; }
    if (msg.includes('EMAIL_EXISTS')) { return 'email-in-use'; }
    if (msg.includes('WEAK_PASSWORD')) { return 'weak-password'; }
    if (msg.includes('TOO_MANY_ATTEMPTS')) { return 'too-many-requests'; }
    if (msg.includes('INVALID_EMAIL')) { return 'invalid-email'; }
    return 'unknown';
};

/**
 * Translate Firebase REST API errors to user-friendly messages
 */
const getAuthErrorMessage = (message: string): string => {
    const msg = message.toUpperCase();
    if (msg.includes('EMAIL_NOT_FOUND')) {
        return 'No account found with this email.';
    }
    if (msg.includes('INVALID_PASSWORD')) {
        return 'Incorrect password.';
    }
    if (msg.includes('INVALID_LOGIN_CREDENTIALS')) {
        return 'Invalid email or password.';
    }
    if (msg.includes('EMAIL_EXISTS')) {
        return 'This email is already registered.';
    }
    if (msg.includes('WEAK_PASSWORD')) {
        return 'Password must be at least 6 characters.';
    }
    if (msg.includes('TOO_MANY_ATTEMPTS')) {
        return 'Too many attempts. Please wait and try again.';
    }
    if (msg.includes('INVALID_EMAIL')) {
        return 'Please enter a valid email address.';
    }
    return `Authentication failed. Please try again.`;
};
