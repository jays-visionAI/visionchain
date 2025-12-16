import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase.config';

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export const initializeFirebase = () => {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        app = getApps()[0];
        auth = getAuth(app);
        db = getFirestore(app);
    }
    return { app, auth, db };
};

// Export getters
export const getFirebaseAuth = () => {
    if (!auth) initializeFirebase();
    return auth;
};

export const getFirebaseDb = () => {
    if (!db) initializeFirebase();
    return db;
};

// ==================== Auth Functions ====================

export const adminLogin = async (email: string, password: string): Promise<User> => {
    const auth = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
};

export const adminLogout = async (): Promise<void> => {
    const auth = getFirebaseAuth();
    await signOut(auth);
};

export const onAdminAuthStateChanged = (callback: (user: User | null) => void) => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, callback);
};

export const getCurrentUser = (): User | null => {
    const auth = getFirebaseAuth();
    return auth.currentUser;
};

// ==================== Settings Functions ====================

// API Keys
export interface ApiKeyData {
    id: string;
    name: string;
    provider: 'gemini' | 'openai' | 'anthropic';
    key: string;
    isActive: boolean;
    isValid: boolean;
    lastTested?: string;
    createdAt: string;
}

export const getApiKeys = async (): Promise<ApiKeyData[]> => {
    const db = getFirebaseDb();
    const keysCollection = collection(db, 'settings', 'api_keys', 'keys');
    const snapshot = await getDocs(keysCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApiKeyData));
};

export const saveApiKey = async (keyData: Omit<ApiKeyData, 'id' | 'createdAt'>): Promise<string> => {
    const db = getFirebaseDb();
    const id = `key_${Date.now()}`;
    const docRef = doc(db, 'settings', 'api_keys', 'keys', id);
    await setDoc(docRef, {
        ...keyData,
        createdAt: new Date().toISOString()
    });
    return id;
};

export const updateApiKey = async (id: string, updates: Partial<ApiKeyData>): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'api_keys', 'keys', id);
    await setDoc(docRef, updates, { merge: true });
};

export const deleteApiKey = async (id: string): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'api_keys', 'keys', id);
    await setDoc(docRef, { deleted: true }, { merge: true });
};

export const getActiveApiKey = async (provider: string = 'gemini'): Promise<string | null> => {
    const keys = await getApiKeys();
    const activeKey = keys.find(k => k.isActive && k.isValid && k.provider === provider && !((k as any).deleted));
    return activeKey?.key || null;
};

// Chatbot Settings
export interface ChatbotSettings {
    knowledgeBase: string;
    systemPrompt: string;
    modelSettings: {
        temperature: number;
        maxTokens: number;
        topP: number;
    };
}

export const getChatbotSettings = async (): Promise<ChatbotSettings | null> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'chatbot');
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? snapshot.data() as ChatbotSettings : null;
};

export const saveChatbotSettings = async (settings: ChatbotSettings): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'chatbot');
    await setDoc(docRef, settings);
};

// Initialize on import
initializeFirebase();
