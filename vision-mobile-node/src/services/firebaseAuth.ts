/**
 * Vision Mobile Node - Firebase Auth Service
 *
 * Uses Firebase Web SDK (firebase/auth) for email+password authentication.
 * Properly initialized for React Native with AsyncStorage persistence.
 */

import { initializeApp, getApps } from 'firebase/app';
import {
    initializeAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged as fbOnAuthStateChanged,
    User,
    Auth,
    // @ts-ignore - available in firebase 10.x for React Native
    getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config
const firebaseConfig = {
    apiKey: 'AIzaSyAZ-wTAWNkQvlHAh1_bh0jIrzYGfOCENQI',
    authDomain: 'visionchain-d19ed.firebaseapp.com',
    projectId: 'visionchain-d19ed',
    storageBucket: 'visionchain-d19ed.firebasestorage.app',
    messagingSenderId: '451188892027',
    appId: '1:451188892027:android:75174a12b89eb198ee1dde',
};

// Initialize Firebase App (only once)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with React Native persistence (NOT getAuth which uses browser persistence)
let auth: Auth;
try {
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
} catch (err: any) {
    // If already initialized (hot reload), just get the existing auth instance
    // initializeAuth can only be called once per app
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
}

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
    user?: User;
    idToken?: string;
    error?: string;
    errorCode?: AuthErrorCode;
}

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await credential.user.getIdToken();
        return { success: true, user: credential.user, idToken };
    } catch (err: any) {
        console.warn('[Firebase Auth] signIn error:', err?.code, err?.message);
        const errorCode = mapErrorCode(err?.code || '');
        return {
            success: false,
            error: getAuthErrorMessage(err?.code || ''),
            errorCode,
        };
    }
};

/**
 * Sign up with email and password
 */
export const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const idToken = await credential.user.getIdToken();
        return { success: true, user: credential.user, idToken };
    } catch (err: any) {
        console.warn('[Firebase Auth] signUp error:', err?.code, err?.message);
        const errorCode = mapErrorCode(err?.code || '');
        return {
            success: false,
            error: getAuthErrorMessage(err?.code || ''),
            errorCode,
        };
    }
};

/**
 * Sign out
 */
export const firebaseSignOut = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch (err) {
        console.warn('[Firebase Auth] signOut error:', err);
    }
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
    try {
        return auth.currentUser;
    } catch {
        return null;
    }
};

/**
 * Get fresh ID token for backend API calls
 */
export const getIdToken = async (): Promise<string | null> => {
    try {
        const user = auth.currentUser;
        if (!user) { return null; }
        return await user.getIdToken(true);
    } catch (err) {
        console.warn('[Firebase Auth] getIdToken error:', err);
        return null;
    }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChanged = (
    callback: (user: User | null) => void,
): (() => void) => {
    return fbOnAuthStateChanged(auth, callback);
};

/**
 * Map Firebase error code string to our AuthErrorCode enum
 */
const mapErrorCode = (code: string): AuthErrorCode => {
    switch (code) {
        case 'auth/user-not-found':
            return 'user-not-found';
        case 'auth/wrong-password':
            return 'wrong-password';
        case 'auth/invalid-credential':
            return 'invalid-credential';
        case 'auth/email-already-in-use':
            return 'email-in-use';
        case 'auth/weak-password':
            return 'weak-password';
        case 'auth/too-many-requests':
            return 'too-many-requests';
        case 'auth/network-request-failed':
            return 'network-error';
        case 'auth/invalid-email':
            return 'invalid-email';
        default:
            return 'unknown';
    }
};

/**
 * Translate Firebase error codes to user-friendly messages
 */
const getAuthErrorMessage = (code: string): string => {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email. Please sign up.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a moment and try again.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.';
        case 'auth/invalid-credential':
            return 'Invalid email or password. Please check and try again.';
        default:
            return `Authentication failed. Please try again.`;
    }
};
