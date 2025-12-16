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
    apiKey: getEnv('VITE_FIREBASE_API_KEY', "YOUR_API_KEY"),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', "YOUR_PROJECT_ID.firebaseapp.com"),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID', "YOUR_PROJECT_ID"),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', "YOUR_PROJECT_ID.appspot.com"),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', "YOUR_SENDER_ID"),
    appId: getEnv('VITE_FIREBASE_APP_ID', "YOUR_APP_ID")
};
