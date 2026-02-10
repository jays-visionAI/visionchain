// Firebase configuration
// Uses environment variables set by Vite (from .env.staging or .env.production)
// Fallback to production values for backward compatibility

// Helper to safely get env variable
const getEnv = (key: string, defaultValue: string): string => {
    try {
        // @ts-ignore - Vite injects import.meta.env at build time
        return import.meta.env?.[key] || defaultValue;
    } catch {
        return defaultValue;
    }
};

export const firebaseConfig = {
    apiKey: getEnv("VITE_FIREBASE_API_KEY", "AIzaSyBOhaRLa86vxEp0vCqS5adp54RqBt1RtHc"),
    authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN", "visionchain-d19ed.firebaseapp.com"),
    projectId: getEnv("VITE_FIREBASE_PROJECT_ID", "visionchain-d19ed"),
    storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET", "visionchain-d19ed.firebasestorage.app"),
    messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "451188892027"),
    appId: getEnv("VITE_FIREBASE_APP_ID", "1:451188892027:web:1c5232d790dc32cfee1dde"),
    resendApiKey: getEnv("VITE_RESEND_API_KEY", "re_EY5c8G5T_9cKh8egXdvZTCe5ASeyH1e86")
};

// Secondary Firebase config for server Firestore (visionchain-5bd81)
// Used for transaction indexing to match the server's database
export const serverFirebaseConfig = {
    apiKey: "AIzaSyDServerFirebaseKey", // Will be updated with actual key
    authDomain: "visionchain-5bd81.firebaseapp.com",
    projectId: "visionchain-5bd81",
    storageBucket: "visionchain-5bd81.firebasestorage.app",
    messagingSenderId: "",
    appId: ""
};
