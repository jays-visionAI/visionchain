import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
    getFirestore,
    Firestore,
    doc,
    getDoc,
    setDoc,
    collection,
    getDocs,
    writeBatch,
    deleteDoc,
    query,
    limit,
    orderBy,
    where,
    updateDoc,
    initializeFirestore
} from 'firebase/firestore';
import { firebaseConfig } from '../config/firebase.config';

// Helper to send email via Resend API
const sendEmailViaResend = async (options: {
    to: string;
    subject: string;
    html: string;
}) => {
    const API_KEY = (firebaseConfig as any).resendApiKey;
    if (!API_KEY) {
        console.warn('[Email] Resend API Key is missing. Email not sent.');
        return;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'visionchain <onboarding@resend.dev>', // Default Resend test domain
                to: options.to,
                subject: options.subject,
                html: options.html
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Resend API Error: ${JSON.stringify(error)}`);
        }

        console.log(`[Email] Successfully sent to ${options.to}`);
    } catch (err) {
        console.error('[Email] Failed to send email:', err);
        throw err;
    }
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export const initializeFirebase = (useLongPolling = false) => {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        if (useLongPolling) {
            db = initializeFirestore(app, { experimentalForceLongPolling: true });
        } else {
            db = getFirestore(app);
        }
    } else {
        app = getApps()[0];
        auth = getAuth(app);
        if (useLongPolling) {
            db = initializeFirestore(app, { experimentalForceLongPolling: true });
        } else {
            db = getFirestore(app);
        }
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

export const adminRegister = async (email: string, password: string): Promise<User> => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase().trim();

    const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
    const userCredential = await createUserWithEmailAndPassword(auth, emailLower, password);

    // Send Verification Email
    try {
        await sendEmailVerification(userCredential.user);
        console.log('[Auth] Verification email sent to', emailLower);
    } catch (error) {
        console.error('[Auth] Failed to send verification email:', error);
        // Don't block registration if email fails, but log it
    }

    // Check if user doc exists (pre-registered via CSV)
    const userRef = doc(db, 'users', emailLower);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.status === 'PendingActivation') {
            await setDoc(userRef, {
                status: 'Registered',
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Also update token_sales status if it was Pending
            const saleRef = doc(db, 'token_sales', emailLower);
            const saleSnap = await getDoc(saleRef);
            if (saleSnap.exists()) {
                await setDoc(saleRef, { status: 'Registered' }, { merge: true });
            }
        }
    } else {
        // New user from scratch (not in CSV)
        await setDoc(userRef, {
            email: emailLower,
            role: 'user',
            status: 'PendingVerification',
            accountOrigin: 'self-signup',
            createdAt: new Date().toISOString()
        });
    }

    return userCredential.user;
};

export const activateAccount = async (email: string, password: string, partnerCode: string) => {
    const db = getFirebaseDb();

    // 1. Verify Email and Partner Code in token_sales
    const saleRef = doc(db, 'token_sales', email.toLowerCase());
    const saleSnap = await getDoc(saleRef);

    if (!saleSnap.exists()) {
        throw new Error("User not found in whitelist");
    }

    const saleData = saleSnap.data();
    if (saleData.partnerCode !== partnerCode) {
        throw new Error("Partner code mismatch");
    }

    if (saleData.status === 'Registered' || saleData.status === 'WalletCreated') {
        // Already registered, assume they might simply want to reset password or login?
        // For security in this flow, we might allow overwriting or throw error.
        // Let's assume this flow creates the Auth User if not exists.
    }

    // 2. Create Firebase Auth User
    const auth = getFirebaseAuth();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    await createUserWithEmailAndPassword(auth, email, password);

    // 3. Update Status
    await setDoc(saleRef, {
        status: 'Registered'
    }, { merge: true });

    // 4. Create User Profile if needed
    const userRef = doc(db, 'users', email.toLowerCase());
    await setDoc(userRef, {
        email: email,
        role: 'user', // Default role
        createdAt: new Date()
    }, { merge: true });

    return true;
};

// Manual Invitation for a single user
export const manualInviteUser = async (data: {
    email: string;
    partnerCode: string;
    amountToken: number;
    tier: number;
}) => {
    const db = getFirebaseDb();
    const emailLower = data.email.toLowerCase();

    // 1. Create or update token_sales entry
    await setDoc(doc(db, 'token_sales', emailLower), {
        email: emailLower,
        partnerCode: data.partnerCode,
        amountToken: data.amountToken,
        tier: data.tier,
        status: 'Pending',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString()
    }, { merge: true });

    // 2. Pre-register user in users collection if not exists
    const userRef = doc(db, 'users', emailLower);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            email: emailLower,
            role: 'user',
            partnerCode: data.partnerCode,
            status: 'PendingActivation',
            createdAt: new Date().toISOString()
        });
    }

    // 3. Send Invitation Email
    await sendInvitationEmail(emailLower, data.partnerCode, window.location.origin);

    return true;
};

export const adminLogout = async (): Promise<void> => {
    const auth = getFirebaseAuth();
    await signOut(auth);
};

export const onAdminAuthStateChanged = (callback: (user: User | null) => void) => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, callback);
};

// ==================== User & Role Management ====================

export interface UserData {
    email: string;
    role: 'admin' | 'partner' | 'user';
    walletAddress?: string;
    status?: string;
    joinDate?: string;
    isVerified?: boolean;
    tier?: number;
    name?: string;
    phone?: string;
    bio?: string;
    twitter?: string;
    discord?: string;
    walletReady?: boolean;
}

export const getAllUsers = async (limitCount = 50): Promise<UserData[]> => {
    const startTime = Date.now();
    console.log('[Performance] getAllUsers started');
    const db = getFirebaseDb();

    // 10 second timeout for initial fetch
    const timeoutPromise = new Uint8Array(1).map(() => 0); // dummy
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore fetch timeout')), 10000)
    );

    try {
        // Parallel Fetching
        const usersQ = query(collection(db, 'users'), limit(limitCount));
        const salesQ = query(collection(db, 'token_sales'), limit(limitCount));

        const [usersSnap, salesSnap] = await Promise.race([
            Promise.all([
                getDocs(usersQ),
                getDocs(salesQ)
            ]),
            timeout
        ]) as [any, any];

        console.log(`[Performance] Firestore fetch completed in ${Date.now() - startTime}ms`);

        const usersMap = new Map<string, any>();
        usersSnap.forEach((doc: any) => {
            usersMap.set(doc.id, doc.data());
        });

        const salesMap = new Map<string, any>();
        salesSnap.forEach((doc: any) => {
            salesMap.set(doc.id, doc.data()); // doc.id is usually email
        });

        // 3. Merge Data
        const mergedUsers: UserData[] = [];
        const allEmails = new Set([...usersMap.keys(), ...salesMap.keys()]);

        allEmails.forEach(email => {
            const userDoc = usersMap.get(email);
            const saleDoc = salesMap.get(email);

            // Logic for status:
            // 1. If saleDoc exists, use its status (Pending, Registered, WalletCreated, VestingDeployed)
            // 2. If only userDoc exists, it might be an admin or manually added user - default to 'Registered'
            // 3. Fallback to 'Pending' if something is wrong
            let status = 'Pending';
            if (saleDoc?.status) {
                status = saleDoc.status;
            } else if (userDoc) {
                status = 'Registered';
            }

            mergedUsers.push({
                email: email,
                role: userDoc?.role || 'user',
                name: userDoc?.name || email.split('@')[0],
                walletAddress: userDoc?.walletAddress || saleDoc?.walletAddress || 'Not Created',
                status: status,
                joinDate: userDoc?.createdAt ? new Date(userDoc.createdAt.seconds * 1000).toLocaleDateString() : (saleDoc?.date || '2024-01-01'),
                isVerified: !!saleDoc,
                tier: saleDoc?.tier || 0
            });
        });

        return mergedUsers;
    } catch (err) {
        console.error('[Performance] getAllUsers failed:', err);
        // If it timed out, try to re-initialize with Long Polling for future calls
        if (err instanceof Error && err.message === 'Firestore fetch timeout') {
            console.log('[Performance] Attempting re-initialization with Long Polling...');
            initializeFirebase(true);
        }
        throw err;
    }
};
export const getUserRole = async (email: string): Promise<'admin' | 'user' | 'partner'> => {
    try {
        const db = getFirebaseDb();
        const userRef = doc(db, 'users', email.toLowerCase());
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data().role || 'user';
        }
    } catch (error) {
        console.error('Error fetching user role:', error);
    }
    return 'user';
};

export const getUserData = async (email: string): Promise<UserData | null> => {
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase().trim();

    // 1. Try lowercase lookup (Preferred)
    let userSnap = await getDoc(doc(db, 'users', emailLower));
    let saleSnap = await getDoc(doc(db, 'token_sales', emailLower));

    // 2. Fallback to original lookup (Support legacy/case-sensitive IDs)
    if (!userSnap.exists() && email !== emailLower) {
        const legacySnap = await getDoc(doc(db, 'users', email));
        if (legacySnap.exists()) userSnap = legacySnap;
    }
    if (!saleSnap.exists() && email !== emailLower) {
        const legacySnap = await getDoc(doc(db, 'token_sales', email));
        if (legacySnap.exists()) saleSnap = legacySnap;
    }

    // 3. One more fallback: uppercase email (sometimes used in legacy systems)
    if (!userSnap.exists()) {
        const upperSnap = await getDoc(doc(db, 'users', email.toUpperCase()));
        if (upperSnap.exists()) userSnap = upperSnap;
    }

    if (userSnap.exists() || saleSnap.exists()) {
        const user = userSnap.data();
        const sale = saleSnap.data();
        return {
            email: emailLower,
            role: user?.role || 'user',
            name: user?.name || user?.displayName || emailLower.split('@')[0],
            walletAddress: user?.walletAddress || sale?.walletAddress || '',
            status: sale?.status || user?.status || 'Registered',
            isVerified: !!(user?.walletAddress || sale?.walletAddress),
            tier: sale?.tier || user?.tier || 0,
            phone: user?.phone || '',
            bio: user?.bio || '',
            twitter: user?.twitter || '',
            discord: user?.discord || '',
            walletReady: user?.walletReady || sale?.walletReady || false
        };
    }
    return null;
};

// ==================== Token Sale & Vesting ====================

export interface TokenSaleEntry {
    email: string;
    partnerCode: string;
    amountToken: number;
    date: string;
    unlockRatio: number;
    vestingPeriod: number;
    status: 'Pending' | 'Registered' | 'WalletCreated' | 'VestingDeployed';
    walletAddress?: string; // Updated when user connects wallet
    vestingTx?: string; // Updated when admin deploys vesting
}

export const uploadTokenSaleData = async (entries: TokenSaleEntry[]) => {
    const db = getFirebaseDb();
    const newInvitations: { email: string; partnerCode: string }[] = [];
    const existingMembers: string[] = [];

    // Process entries sequentially or in small batches to avoid rate limits
    // For simplicity, we'll process Firestore writes in parallel but limit concurrency if needed.
    // Here we'll just do a loop.

    for (const entry of entries) {
        const emailLower = entry.email.toLowerCase().trim();

        // 1. Update token_sales
        const saleRef = doc(db, 'token_sales', emailLower);
        await setDoc(saleRef, {
            ...entry,
            email: emailLower,
            status: entry.status || 'Pending'
        }, { merge: true });

        // 2. Check users collection
        const userRef = doc(db, 'users', emailLower);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            // New committed user - Pre-register
            await setDoc(userRef, {
                email: emailLower,
                role: 'user',
                partnerCode: entry.partnerCode,
                status: 'PendingActivation',
                createdAt: new Date().toISOString()
            });
            newInvitations.push({ email: emailLower, partnerCode: entry.partnerCode });
        } else {
            existingMembers.push(entry.email);
        }
    }

    // 3. Send Invitation Emails (in parallel)
    console.log(`[Batch] Sending ${newInvitations.length} invitation emails...`);
    const emailPromises = newInvitations.map(invite =>
        sendInvitationEmail(invite.email, invite.partnerCode, window.location.origin)
            .catch(err => console.error(`Failed to send invite to ${invite.email}:`, err))
    );

    await Promise.allSettled(emailPromises);

    return {
        count: entries.length,
        newInvitations: newInvitations.map(i => i.email),
        existingMembers
    };
};



export const updateWalletStatus = async (email: string, walletAddress: string) => {
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase();

    // 1. Update Token Sale Entry (New System)
    const tokenSaleRef = doc(db, 'token_sales', emailLower);
    const tokenSaleSnap = await getDoc(tokenSaleRef);
    if (tokenSaleSnap.exists()) {
        await setDoc(tokenSaleRef, {
            walletAddress: walletAddress,
            status: 'WalletCreated'
        }, { merge: true });
        console.log(`[Firebase] Updated token_sales for ${email}`);
    }

    // 2. Update User Profile (Ensuring top-level and potential sub-structure)
    const userRef = doc(db, 'users', emailLower);
    await setDoc(userRef, {
        walletReady: true,
        walletAddress: walletAddress,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`[Firebase] Saved wallet address ${walletAddress} to users/${emailLower}`);

    // 3. Update Purchases (Legacy)
    // Optional: Only if you still use 'purchases' collection
    /*
    const purchasesCollection = collection(db, 'purchases');
    const snapshot = await getDocs(purchasesCollection);
    const updates = snapshot.docs
        .filter(doc => doc.data().email.toLowerCase() === emailLower)
        .map(async (docSnap) => {
            await setDoc(docSnap.ref, {
                walletReady: true,
                walletAddress: walletAddress
            }, { merge: true });
        });
    await Promise.all(updates);
    */
};

export const deployVestingStatus = async (email: string, txHash: string) => {
    const db = getFirebaseDb();
    const ref = doc(db, 'token_sales', email.toLowerCase());
    await setDoc(ref, {
        vestingTx: txHash,
        status: 'VestingDeployed'
    }, { merge: true });
};

// ... (previous code)

export const getTokenSaleParticipants = async (limitCount = 100): Promise<TokenSaleEntry[]> => {
    const db = getFirebaseDb();
    const q = query(collection(db, 'token_sales'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as TokenSaleEntry);
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

// ==================== VCN Distribution Functions ====================

export interface VcnPurchase {
    id?: string;
    email: string;
    partnerCode: string;
    amount: number;
    initialUnlockRatio: number;
    cliffMonths: number;
    vestingMonths: number;
    status: 'pending' | 'active' | 'completed';
    walletAddress?: string;
    walletReady: boolean;
    vestingContractAddress?: string;
    createdAt: string;
}

export const saveVcnPurchases = async (purchases: Omit<VcnPurchase, 'createdAt' | 'walletReady' | 'status'>[]): Promise<void> => {
    const db = getFirebaseDb();
    const batch = writeBatch(db);

    purchases.forEach((p) => {
        // 1. Record in vcn_purchases (for Admin History)
        const purchaseId = `vcn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const docRef = doc(db, 'vcn_purchases', p.email.toLowerCase());
        // Screenshot implies Unique Email, so let's use Email as ID for simplicity

        batch.set(docRef, {
            ...p,
            status: 'pending',
            walletReady: false,
            createdAt: new Date().toISOString()
        });

        // 2. Critical: Write to token_sales for ActivateAccount.tsx
        const tokenSaleRef = doc(db, 'token_sales', p.email.toLowerCase());
        batch.set(tokenSaleRef, {
            email: p.email.toLowerCase(),
            partnerCode: p.partnerCode,
            amount: p.amount,
            status: 'PendingActivation',
            initialUnlockRatio: p.initialUnlockRatio,
            cliffMonths: p.cliffMonths,
            vestingMonths: p.vestingMonths,
            createdAt: new Date().toISOString()
        }, { merge: true });
    });

    await batch.commit();
};

export const getVcnPurchases = async (limitCount = 100): Promise<VcnPurchase[]> => {
    const db = getFirebaseDb();
    const purchasesCollection = collection(db, 'vcn_purchases');
    const q = query(purchasesCollection, limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VcnPurchase));
};

export const getUserPurchases = async (email: string): Promise<VcnPurchase[]> => {
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase().trim();
    const purchasesCollection = collection(db, 'vcn_purchases');

    // 1. Get from vcn_purchases
    const q = query(purchasesCollection, where('email', 'in', [emailLower, email]));
    const snapshot = await getDocs(q);
    const purchases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VcnPurchase));

    // 2. Fallback to token_sales (Integration for CSV-uploaded data)
    const saleRef = doc(db, 'token_sales', emailLower);
    const saleSnap = await getDoc(saleRef);
    if (saleSnap.exists()) {
        const saleData = saleSnap.data() as TokenSaleEntry;

        // Prevent duplication if it already exists in vcn_purchases
        const isDuplicate = purchases.some(p => Math.abs(p.amount - saleData.amountToken) < 0.01);

        if (!isDuplicate) {
            purchases.push({
                id: 'sale_' + emailLower,
                email: saleData.email,
                amount: saleData.amountToken,
                purchaseDate: saleData.date,
                initialUnlockRatio: saleData.unlockRatio,
                cliffMonths: 0, // CSV doesn't have cliff currently
                vestingMonths: saleData.vestingPeriod,
                status: 'active',
                createdAt: saleData.date || new Date().toISOString()
            });
        }
    }

    return purchases;
};

export const activateVesting = async (purchaseId: string, contractAddress: string): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'purchases', purchaseId);
    await setDoc(docRef, {
        status: 'active',
        vestingContractAddress: contractAddress
    }, { merge: true });

    // Also update user's vestingActivated flag
    const purchase = (await getDoc(docRef)).data() as VcnPurchase;
    if (purchase) {
        const userRef = doc(db, 'users', purchase.email.toLowerCase());
        await setDoc(userRef, { vestingActivated: true }, { merge: true });
    }
};

// ==================== Partner Management Functions ====================

export interface Partner {
    code: string;
    name: string;
    createdAt: string;
}

export const getPartners = async (limitCount = 100): Promise<Partner[]> => {
    const db = getFirebaseDb();
    const partnersCollection = collection(db, 'partners');
    const q = query(partnersCollection, limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map(doc => ({ code: doc.id, ...doc.data() } as Partner))
        .filter(p => !(p as any).deleted);
};

export const savePartner = async (partner: Omit<Partner, 'createdAt'>): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'partners', partner.code.toUpperCase());
    await setDoc(docRef, {
        ...partner,
        createdAt: new Date().toISOString()
    });
};

export const deletePartner = async (code: string): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'partners', code.toUpperCase());
    await setDoc(docRef, { deleted: true }, { merge: true });
};

// ==================== Phase 3: Auth & Email Functions ====================

export const checkUserAndRegister = async (email: string, partnerCode: string): Promise<boolean> => {
    const db = getFirebaseDb();
    const userRef = doc(db, 'users', email.toLowerCase());
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.partnerCode.toUpperCase() === partnerCode.toUpperCase()) {
            // Match found, registration allowed (or already registered)
            return true;
        }
    }
    return false;
};

export const requestPasswordChange = async (email: string): Promise<string> => {
    const db = getFirebaseDb();
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    // Send email via Resend instead of Firestore queue
    await sendEmailViaResend({
        to: email,
        subject: '[Vision Chain] Password Change Verification Code',
        html: `Your verification code is: <b>${code}</b>. It stays valid for 30 minutes.`
    });

    return code;
};

// ==================== Activation Token & Email Functions ====================

// Generate secure random token
const generateActivationToken = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
};

export interface ActivationToken {
    email: string;
    partnerCode: string;
    expiresAt: string;
    used: boolean;
    invalidated: boolean;
    createdAt: string;
}

// Send invitation email with activation token
export const sendInvitationEmail = async (email: string, partnerCode: string, baseUrl: string = 'https://visionchain.co'): Promise<string> => {
    const db = getFirebaseDb();
    const token = generateActivationToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // 1. Save activation token
    await setDoc(doc(db, 'activation_tokens', token), {
        email: email.toLowerCase(),
        partnerCode: partnerCode,
        expiresAt: expiresAt.toISOString(),
        used: false,
        invalidated: false,
        createdAt: new Date().toISOString()
    });

    // Send invitation email via Resend
    await sendEmailViaResend({
        to: email,
        subject: '[Vision Chain] Welcome! Set up your account',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h1 style="color: #06b6d4;">Welcome to Vision Chain</h1>
                <p>Your account has been created. Click the button below to set your password and activate your account:</p>
                <a href="${baseUrl}/activate?token=${token}" 
                   style="display: inline-block; background: linear-gradient(to right, #06b6d4, #3b82f6); 
                          color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; 
                          font-weight: bold; margin: 20px 0;">
                    Activate Account
                </a>
                <p style="color: #666; font-size: 14px;">This link expires in 72 hours.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            </div>
        `
    });

    console.log(`[Email] Sent invitation email to ${email} via Resend`);
    return token;
};

// Resend activation email (invalidates old tokens)
export const resendActivationEmail = async (email: string, baseUrl: string = 'https://visionchain.co'): Promise<void> => {
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase();

    // 1. Invalidate all existing tokens for this email
    const tokensQuery = query(
        collection(db, 'activation_tokens'),
        where('email', '==', emailLower)
    );
    const snapshot = await getDocs(tokensQuery);

    for (const docSnap of snapshot.docs) {
        await updateDoc(docSnap.ref, { invalidated: true });
    }
    console.log(`[Email] Invalidated ${snapshot.docs.length} old tokens for ${email}`);

    // 2. Get user's partner code from token_sales
    const saleDoc = await getDoc(doc(db, 'token_sales', emailLower));
    const partnerCode = saleDoc.exists() ? saleDoc.data()?.partnerCode || '' : '';

    // 3. Send new invitation email
    await sendInvitationEmail(emailLower, partnerCode, baseUrl);
};

// Validate activation token
export const validateActivationToken = async (token: string): Promise<{
    valid: boolean;
    error?: string;
    email?: string;
    partnerCode?: string
}> => {
    const db = getFirebaseDb();
    const tokenDoc = await getDoc(doc(db, 'activation_tokens', token));

    if (!tokenDoc.exists()) {
        return { valid: false, error: 'Invalid or expired activation link.' };
    }

    const data = tokenDoc.data() as ActivationToken;

    if (data.used) {
        return { valid: false, error: 'This activation link has already been used.' };
    }

    if (data.invalidated) {
        return { valid: false, error: 'This activation link has been invalidated. Please request a new one.' };
    }

    if (new Date(data.expiresAt) < new Date()) {
        return { valid: false, error: 'This activation link has expired. Please request a new one.' };
    }

    return {
        valid: true,
        email: data.email,
        partnerCode: data.partnerCode
    };
};

// Mark token as used after successful activation
export const markTokenAsUsed = async (token: string): Promise<void> => {
    const db = getFirebaseDb();
    const tokenRef = doc(db, 'activation_tokens', token);
    await updateDoc(tokenRef, {
        used: true,
        usedAt: new Date().toISOString()
    });
};

// Activate account using token
export const activateAccountWithToken = async (token: string, password: string) => {
    const db = getFirebaseDb();

    // 1. Validate Token
    const validation = await validateActivationToken(token);
    if (!validation.valid) {
        throw new Error(validation.error || 'Invalid token');
    }

    const { email, partnerCode } = validation;
    if (!email || !partnerCode) {
        throw new Error('Token data is incomplete');
    }

    // 2. Create Firebase Auth User
    const auth = getFirebaseAuth();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    try {
        await createUserWithEmailAndPassword(auth, email, password);
    } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
            // If already in Auth, maybe they are just resetting? 
            // But normally this is for new users.
            // For now, let's just throw the error or handle it.
            throw authErr;
        }
        throw authErr;
    }

    // 3. Update Status in token_sales
    const saleRef = doc(db, 'token_sales', email.toLowerCase());
    await updateDoc(saleRef, {
        status: 'Registered'
    });

    // 4. Update User Profile
    const userRef = doc(db, 'users', email.toLowerCase());
    await setDoc(userRef, {
        email: email.toLowerCase(),
        role: 'user',
        status: 'Registered',
        accountOrigin: 'invitation',
        updatedAt: new Date().toISOString()
    }, { merge: true });

    // 5. Mark Token as Used
    await markTokenAsUsed(token);

    return { email, partnerCode };
};

// Function removed (Duplicate of updateWalletStatus above)

// Initialize on import
initializeFirebase();
