/**
 * Vision Mobile Node - Firebase Auth Service
 *
 * Wraps @react-native-firebase/auth for email+password authentication.
 * Returns Firebase ID Token for backend verification.
 */

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface AuthResult {
    success: boolean;
    user?: FirebaseAuthTypes.User;
    idToken?: string;
    error?: string;
}

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
        const credential = await auth().signInWithEmailAndPassword(email, password);
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
        const credential = await auth().createUserWithEmailAndPassword(email, password);
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
    await auth().signOut();
};

/**
 * Get current user
 */
export const getCurrentUser = (): FirebaseAuthTypes.User | null => {
    return auth().currentUser;
};

/**
 * Get fresh ID token for backend API calls
 */
export const getIdToken = async (): Promise<string | null> => {
    const user = auth().currentUser;
    if (!user) { return null; }
    return user.getIdToken(true);
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChanged = (
    callback: (user: FirebaseAuthTypes.User | null) => void,
): (() => void) => {
    return auth().onAuthStateChanged(callback);
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
