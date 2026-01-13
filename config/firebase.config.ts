// Firebase configuration
// Replace these values with your Firebase project credentials
// Get them from: Firebase Console > Project Settings > General > Your apps > Web app

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
    apiKey: "AIzaSyBOhaRLa86vxEp0vCqS5adp54RqBt1RtHc",
    authDomain: "visionchain-d19ed.firebaseapp.com",
    projectId: "visionchain-d19ed",
    storageBucket: "visionchain-d19ed.firebasestorage.app",
    messagingSenderId: "451188892027",
    appId: "1:451188892027:web:1c5232d790dc32cfee1dde",
    resendApiKey: "re_EY5c8G5T_9cKh8egXdvZTCe5ASeyH1e86"
};
