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
    addDoc,
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

// --- User Presets (Intent Optimization) ---
export interface PaymentPreset {
    primaryAsset: string; // e.g., 'VCN', 'USDC'
    secondaryAsset: string; // e.g., 'ETH'
    preferredChain: string; // e.g., 'Vision Chain', 'Ethereum'
    updatedAt: string;
}

export const getUserPreset = async (vidOrEmail: string): Promise<PaymentPreset | null> => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'user_presets', vidOrEmail.toLowerCase());
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return snapshot.data() as PaymentPreset;
        }
        return null;
    } catch (e) {
        console.error("Error fetching preset:", e);
        return null;
    }
};

export const saveUserPreset = async (vidOrEmail: string, preset: Omit<PaymentPreset, 'updatedAt'>) => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'user_presets', vidOrEmail.toLowerCase());
        await setDoc(docRef, {
            ...preset,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`[Firebase] Saved preset for ${vidOrEmail}`);
    } catch (e) {
        console.error("Error saving preset:", e);
        throw e;
    }
};

// Simplified user search for intent resolution
export const searchUserByPhone = async (phone: string): Promise<{ vid: string, email: string, address: string } | null> => {
    try {
        const db = getFirebaseDb();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('phone', '==', phone), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            return {
                vid: doc.id, // Using email/docID as VID essentially
                email: data.email,
                address: data.walletAddress
            };
        }
        return null;
    } catch (e) {
        console.error("User search failed:", e);
        return null;
    }
};

// Initialize Firebase (singleton pattern)

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export const initializeFirebase = (useLongPolling = true) => {
    if (!app) {
        const apps = getApps();
        app = apps.length ? apps[0] : initializeApp(firebaseConfig);
    }

    if (!auth) {
        auth = getAuth(app);
    }

    // Only initialize Firestore if not already set
    if (!db) {
        if (useLongPolling) {
            console.log('[Firebase] Initializing Firestore with Long Polling...');
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
    amountToken?: number; // Added
    name?: string;
    phone?: string;
    bio?: string;
    twitter?: string;
    discord?: string;
    walletReady?: boolean;
}

export const getAllUsers = async (limitCount = 500): Promise<UserData[]> => {
    const startTime = Date.now();
    console.log('[Performance] getAllUsers started');

    let currentDb: Firestore;
    try {
        currentDb = getFirebaseDb();
    } catch (e) {
        initializeFirebase();
        currentDb = getFirebaseDb();
    }

    // 10 second timeout for initial fetch in Admin Panel
    const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore fetch timeout')), 10000)
    );

    try {
        // Parallel Fetching
        const usersQ = query(collection(currentDb, 'users'), limit(limitCount));
        const salesQ = query(collection(currentDb, 'token_sales'), limit(limitCount));

        const [usersResult, salesResult] = await Promise.race([
            Promise.allSettled([
                getDocs(usersQ),
                getDocs(salesQ)
            ]),
            timeout.then(() => Promise.reject(new Error('Timeout')))
        ]) as [PromiseSettledResult<any>, PromiseSettledResult<any>];

        console.log(`[Performance] Firestore fetch completed in ${Date.now() - startTime}ms`);

        const usersMap = new Map<string, any>();
        if (usersResult.status === 'fulfilled') {
            usersResult.value.forEach((doc: any) => {
                usersMap.set(doc.id.toLowerCase(), doc.data());
            });
        } else {
            console.error('[getAllUsers] Failed to fetch users collection:', usersResult.reason);
        }

        const salesMap = new Map<string, any>();
        if (salesResult.status === 'fulfilled') {
            salesResult.value.forEach((doc: any) => {
                salesMap.set(doc.id.toLowerCase(), doc.data());
            });
        } else {
            console.error('[getAllUsers] Failed to fetch token_sales collection:', salesResult.reason);
        }

        // 3. Merge Data
        const mergedUsers: UserData[] = [];
        const allEmails = new Set([...usersMap.keys(), ...salesMap.keys()]);

        const formatJoinDate = (dateField: any) => {
            if (!dateField) return '2024-01-01';
            try {
                // If it's a Firestore Timestamp
                if (dateField && typeof dateField === 'object' && 'seconds' in dateField) {
                    return new Date(dateField.seconds * 1000).toISOString().split('T')[0];
                }

                // If it's already a string or ISO date
                const d = new Date(dateField);
                if (isNaN(d.getTime())) return '2024-01-01';
                return d.toISOString().split('T')[0];
            } catch (e) {
                return '2024-01-01';
            }
        };

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

            const validWallet = (userDoc?.walletAddress && userDoc.walletAddress.startsWith('0x')) ||
                (saleDoc?.walletAddress && saleDoc.walletAddress.startsWith('0x'));

            if (validWallet && (status === 'Pending' || status === 'Registered' || status === 'PendingActivation')) {
                status = 'WalletCreated';
            }

            // Ensure we pick the valid 0x address if one is invalid
            let finalWallet = 'Not Created';
            if (userDoc?.walletAddress && userDoc.walletAddress.startsWith('0x')) {
                finalWallet = userDoc.walletAddress;
            } else if (saleDoc?.walletAddress && saleDoc.walletAddress.startsWith('0x')) {
                finalWallet = saleDoc.walletAddress;
            }

            const joinDateStr = formatJoinDate(userDoc?.createdAt || saleDoc?.date || saleDoc?.createdAt);

            mergedUsers.push({
                email: email,
                role: userDoc?.role || 'user',
                name: userDoc?.name || userDoc?.displayName || email.split('@')[0],
                walletAddress: finalWallet,
                status: status,
                joinDate: joinDateStr,
                isVerified: !!saleDoc,
                tier: saleDoc?.tier || 0,
                amountToken: saleDoc?.amountToken || saleDoc?.amount || 0
            });
        });

        return mergedUsers;
    } catch (err) {
        console.error('[Performance] getAllUsers failed:', err);
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

        // 0. Check for existing User Wallet Status (Prevention of Overwriting Status)
        const userRef = doc(db, 'users', emailLower);
        const userSnap = await getDoc(userRef);
        let derivedStatus = entry.status || 'Pending';
        let derivedWallet = entry.walletAddress;

        if (userSnap.exists()) {
            const userData = userSnap.data();
            if (userData.walletAddress) {
                derivedStatus = 'WalletCreated';
                derivedWallet = userData.walletAddress;
            }
        }

        // 1. Update token_sales
        const saleRef = doc(db, 'token_sales', emailLower);
        await setDoc(saleRef, {
            ...entry,
            email: emailLower,
            status: derivedStatus,
            walletAddress: derivedWallet || null
        }, { merge: true });

        // 2. Check users collection
        // Reuse userRef and userSnap from above
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

    // 4. Auto-Distribute Testnet VCN (10% Rule)
    try {
        const tokenSaleRef = doc(db, 'token_sales', emailLower);
        const saleSnap = await getDoc(tokenSaleRef);

        if (saleSnap.exists()) {
            const data = saleSnap.data();
            // Check if already distributed
            if (!data.testnetDistributed && data.amountToken > 0) {
                const distributionAmount = Math.floor(data.amountToken * 0.1); // 10%
                console.log(`[Distribution] Sending ${distributionAmount} VCN (10%) to ${emailLower}...`);

                // Dynamic Import to avoid cycle
                const { contractService } = await import('./contractService');

                // Admin Action: Send from Company Treasury/Admin Wallet
                // NOTE: This usually requires a secure signer. 
                // We will use a dedicated endpoint or the Relayer.
                // For MVP: We call a new helper 'adminDistribute'

                await contractService.adminSendVCN(walletAddress, distributionAmount.toString());

                // Update Flag
                await setDoc(tokenSaleRef, {
                    testnetDistributed: true,
                    distributedAmount: distributionAmount,
                    distributedAt: new Date().toISOString()
                }, { merge: true });

                console.log(`[Distribution] Success!`);
            }
        }
    } catch (err) {
        console.error("[Distribution] Failed to auto-distribute:", err);
    }

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


export const getTokenSaleParticipants = async (limitCount = 500): Promise<TokenSaleEntry[]> => {
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
    provider: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
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

/**
 * Fetches the active API key for a given provider from the global settings.
 * Priority: isActive=true, isValid=true, deleted=false
 */
export const getActiveGlobalApiKey = async (provider: string = 'gemini'): Promise<string | null> => {
    try {
        const db = getFirebaseDb();
        const keysCollection = collection(db, 'settings', 'api_keys', 'keys');
        const snapshot = await getDocs(keysCollection);

        if (snapshot.empty) {
            console.warn(`[Firebase] No API keys found in settings/api_keys/keys for provider: ${provider}`);
            return null;
        }

        const keys = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ApiKeyData));

        // Find the first matching active, valid, and non-deleted key
        const activeKey = keys.find(k =>
            k.isActive &&
            k.isValid &&
            k.provider === provider &&
            !(k as any).deleted
        );

        if (activeKey) {
            console.log(`[Firebase] Resolved active global key for ${provider}: ${activeKey.id}`);
            return activeKey.key;
        }

        console.warn(`[Firebase] No active/valid key found for provider: ${provider}`);
        return null;
    } catch (error) {
        console.error(`[Firebase] Error fetching active global key for ${provider}:`, error);
        // If it's a permission error, we might want to return null instead of throwing
        return null;
    }
};

// Alias for backward compatibility if needed
export const getActiveApiKey = getActiveGlobalApiKey;

// Chatbot Settings
export interface BotConfig {
    systemPrompt: string;
    model: string;
    temperature: number;
    maxTokens: number;
}

export interface ChatbotSettings {
    knowledgeBase: string;
    intentBot: BotConfig;
    helpdeskBot: BotConfig;
    imageSettings: {
        model: string;
        quality: string;
        size: string;
    };
    voiceSettings: {
        model: string;
        ttsVoice: string;
        sttModel: string;
    };
}

export interface SystemSettings {
    simulatorPassword?: string;
    maintenanceMode?: boolean;
    activeChainsCount?: number;
}

// Helper to standardise provider resolution from model name
export const getProviderFromModel = (modelName: string = ''): string => {
    const lower = modelName.toLowerCase();
    if (lower.includes('deepseek')) return 'deepseek';
    if (lower.includes('gpt')) return 'openai';
    if (lower.includes('claude')) return 'anthropic';
    if (lower.includes('gemini')) return 'gemini';
    return ''; // Unknown or empty
};

export const getChatbotSettings = async (): Promise<ChatbotSettings | null> => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'settings', 'chatbot');
        const snapshot = await getDoc(docRef);

        const defaultSettings: ChatbotSettings = {
            knowledgeBase: '',
            intentBot: {
                systemPrompt: 'You are Vision AI, an advanced blockchain assistant capable of executing transactions and analyzing chain data.',
                model: 'gemini-1.5-pro',
                temperature: 0.7,
                maxTokens: 2048
            },
            helpdeskBot: {
                systemPrompt: 'You are a helpful support agent for Vision Chain.',
                model: 'gemini-1.5-pro',
                temperature: 0.7,
                maxTokens: 2048
            },
            imageSettings: {
                model: 'imagen-3.0-generate-001',
                quality: 'standard',
                size: '1024x1024'
            },
            voiceSettings: {
                model: 'gemini-1.5-pro',
                ttsVoice: 'Kore',
                sttModel: 'gemini-1.5-pro'
            }
        };

        if (!snapshot.exists()) {
            console.warn('[Firebase] Chatbot settings not found, using defaults.');
            return defaultSettings;
        }

        const data = snapshot.data();
        return {
            knowledgeBase: data.knowledgeBase || defaultSettings.knowledgeBase,
            intentBot: data.intentBot || defaultSettings.intentBot,
            helpdeskBot: data.helpdeskBot || defaultSettings.helpdeskBot,
            imageSettings: data.imageSettings || defaultSettings.imageSettings,
            voiceSettings: data.voiceSettings || defaultSettings.voiceSettings
        } as ChatbotSettings;
    } catch (e) {
        console.error("Error fetching chatbot settings:", e);
        // Fallback robustly
        return {
            knowledgeBase: '',
            intentBot: { systemPrompt: '', model: 'gemini-2.0-flash-exp', temperature: 0.7, maxTokens: 2048 },
            helpdeskBot: { systemPrompt: '', model: 'gemini-2.0-flash-exp', temperature: 0.7, maxTokens: 2048 },
            imageSettings: { model: 'imagen-3.0-generate-001', quality: 'standard', size: '1024x1024' },
            voiceSettings: { model: 'gemini-2.0-flash-exp', ttsVoice: 'Kore', sttModel: 'gemini-2.0-flash-exp' }
        };
    }
};

export const saveChatbotSettings = async (settings: ChatbotSettings): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'chatbot');
    await setDoc(docRef, settings, { merge: true });
};

// Global System Settings
export const getSystemSettings = async (): Promise<SystemSettings | null> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'system');
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return null;
    return snapshot.data() as SystemSettings;
};

export const saveSystemSettings = async (settings: Partial<SystemSettings>): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'system');
    await setDoc(docRef, settings, { merge: true });
};

// getActiveGlobalApiKey implementation moved and consolidated above

export interface AiConversation {
    id: string;
    userId: string;
    botType: 'intent' | 'helpdesk';
    messages: { role: 'user' | 'assistant'; text: string; timestamp: string }[];
    lastMessage: string;
    createdAt: string;
    status: 'completed' | 'ongoing' | 'error';
}

export const saveConversation = async (conversation: Omit<AiConversation, 'id'>): Promise<string> => {
    const db = getFirebaseDb();
    const docRef = await addDoc(collection(db, 'conversations'), {
        ...conversation,
        createdAt: new Date().toISOString()
    });
    return docRef.id;
};

export const getRecentConversations = async (limitCount: number = 20): Promise<AiConversation[]> => {
    const db = getFirebaseDb();
    const conversationsCollection = collection(db, 'conversations');
    const q = query(conversationsCollection, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiConversation));
};

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
                partnerCode: saleData.partnerCode || 'LEGACY',
                amount: saleData.amountToken,
                initialUnlockRatio: saleData.unlockRatio,
                cliffMonths: 0, // CSV doesn't have cliff currently
                vestingMonths: saleData.vestingPeriod,
                status: 'active',
                walletReady: false,
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

// ==================== Document Management ====================

export interface AdminDocument {
    id: string;
    title: string;
    category: string;
    type: string;
    content: string;
    author: string;
    updatedAt: string;
    attachments: string[];
}

export const getDocuments = async (): Promise<AdminDocument[]> => {
    try {
        const db = getFirebaseDb();
        const docsCollection = collection(db, 'system_documents');
        const q = query(docsCollection); // Client-side sort to avoid composite index requirement
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AdminDocument));
    } catch (error) {
        console.error('Error fetching documents:', error);
        throw error; // Propagate error so UI knows
    }
};

export const saveAdminDocument = async (docData: AdminDocument): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'system_documents', docData.id);
    await setDoc(docRef, {
        ...docData,
        updatedAt: new Date().toISOString().split('T')[0]
    });
};

export const deleteAdminDocument = async (id: string): Promise<void> => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'system_documents', id);
    await deleteDoc(docRef);
};

// Initialize on import
initializeFirebase();
