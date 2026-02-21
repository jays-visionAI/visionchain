/**
 * Vision Mobile Node - Firebase Auth Service
 *
 * Uses Firebase Web SDK (firebase/auth) for email+password authentication.
 * Returns Firebase ID Token for backend verification.
 */

import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged as fbOnAuthStateChanged,
    User,
    Auth,
} from 'firebase/auth';
// @ts-ignore - React Native needs this polyfill for firebase/auth
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase config from google-services.json
const firebaseConfig = {
    apiKey: 'AIzaSyAZ-wTAWNkQvlHAh1_bh0jIrzYGfOCENQI',
    authDomain: 'visionchain-d19ed.firebaseapp.com',
    projectId: 'visionchain-d19ed',
    storageBucket: 'visionchain-d19ed.firebasestorage.app',
    messagingSenderId: '451188892027',
    appId: '1:451188892027:android:75174a12b89eb198ee1dde',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let auth: Auth;
try {
    auth = getAuth(app);
} catch {
    auth = getAuth(app);
}

export interface AuthResult {
    success: boolean;
    user?: User;
    idToken?: string;
    error?: string;
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
        return { success: false, error: getAuthErrorMessage(err.code) };
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
        return { success: false, error: getAuthErrorMessage(err.code) };
    }
};

/**
 * Sign out
 */
export const firebaseSignOut = async (): Promise<void> => {
    await signOut(auth);
};

/**
 * Get current user
 */
export const getCurrentUser = (): User | null => {
    return auth.currentUser;
};

/**
 * Get fresh ID token for backend API calls
 */
export const getIdToken = async (): Promise<string | null> => {
    const user = auth.currentUser;
    if (!user) { return null; }
    return user.getIdToken(true);
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
 * Translate Firebase error codes to user-friendly messages
 */
const getAuthErrorMessage = (code: string): string => {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please sign in.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/weak-password':
            return 'Password must be at least 6 characters.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        case 'auth/invalid-credential':
            return 'Invalid email or password.';
        default:
            return `Authentication failed (${code})`;
    }
};
