// Firebase configuration
// Uses environment variables set by Vite (from .env.staging or .env.production)
// Fallback to production values for backward compatibility

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || (import.meta.env.VITE_CHAIN_ENV === 'staging' ? "AIzaSyCR4ITFD6KCK6zaJYEWbJF0A8kVog-U-Sc" : "AIzaSyBOhaRLa86vxEp0vCqS5adp54RqBt1RtHc"),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (import.meta.env.VITE_CHAIN_ENV === 'staging' ? "visionchain-staging.firebaseapp.com" : "visionchain-d19ed.firebaseapp.com"),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || (import.meta.env.VITE_CHAIN_ENV === 'staging' ? "visionchain-staging" : "visionchain-d19ed"),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (import.meta.env.VITE_CHAIN_ENV === 'staging' ? "visionchain-staging.firebasestorage.app" : "visionchain-d19ed.firebasestorage.app"),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || (import.meta.env.VITE_CHAIN_ENV === 'staging' ? "678764770999" : "451188892027"),
    appId: import.meta.env.VITE_FIREBASE_APP_ID || (import.meta.env.VITE_CHAIN_ENV === 'staging' ? "1:678764770999:web:1db11616686d5016bd3f32" : "1:451188892027:web:1c5232d790dc32cfee1dde"),
    resendApiKey: import.meta.env.VITE_RESEND_API_KEY || "re_EY5c8G5T_9cKh8egXdvZTCe5ASeyH1e86"
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
