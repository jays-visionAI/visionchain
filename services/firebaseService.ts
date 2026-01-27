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
    initializeFirestore,
    onSnapshot,
    Timestamp
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

// --- Phone Normalization Utility ---
export const normalizePhoneNumber = (phone: string): string => {
    if (!phone) return '';
    const trimmed = phone.trim();

    // If already starts with +, assume user provided country code
    if (trimmed.startsWith('+')) {
        // Just return as is if it looks formatted, or clean it up
        if (trimmed.includes('-')) return trimmed;
        const numeric = trimmed.replace(/\D/g, '');
        return `+${numeric}`;
    }

    // Remove all non-numeric characters for processing
    const clean = trimmed.replace(/\D/g, '');
    if (!clean) return '';

    // Detect Country Code from Browser Locale
    let countryCode = '82'; // Default to Korea (as per project context)
    try {
        if (typeof navigator !== 'undefined') {
            const locale = navigator.language || 'ko-KR';
            const country = (locale.split('-')[1] || '').toUpperCase();

            const mapping: Record<string, string> = {
                'KR': '82', 'US': '1', 'JP': '81', 'CN': '86', 'GB': '44',
                'DE': '49', 'FR': '33', 'CA': '1', 'AU': '61', 'SG': '65'
            };

            if (mapping[country]) {
                countryCode = mapping[country];
            } else {
                // Try to infer from language if country part is missing
                const lang = locale.split('-')[0].toLowerCase();
                if (lang === 'ko') countryCode = '82';
                else if (lang === 'ja') countryCode = '81';
                else if (lang === 'zh') countryCode = '86';
            }
        }
    } catch (e) {
        console.warn('[Phone] Failed to detect locale, falling back to +82');
    }

    // Specialized formatting for Korea (common use case)
    if (countryCode === '82') {
        if (clean.startsWith('010') && clean.length === 11) {
            return `+82-10-${clean.slice(3, 7)}-${clean.slice(7)}`;
        }
        if (clean.startsWith('10') && (clean.length === 10 || clean.length === 11)) {
            const digits = clean.startsWith('10') ? clean : clean.slice(1);
            return `+82-10-${digits.slice(2, 6)}-${digits.slice(6)}`;
        }
        if (clean.startsWith('8210') && clean.length === 12) {
            return `+82-10-${clean.slice(4, 8)}-${clean.slice(8)}`;
        }
    }

    // Generic formatting for other countries
    let processedDigits = clean;
    // Remove leading zero if present in local format
    if (processedDigits.startsWith('0') && processedDigits.length > 5) {
        processedDigits = processedDigits.slice(1);
    }

    return `+${countryCode}-${processedDigits}`;
};

// Simplified user search for intent resolution
export const searchUserByPhone = async (phone: string): Promise<{ vid: string, email: string, address: string } | null> => {
    try {
        const db = getFirebaseDb();
        const usersRef = collection(db, 'users');
        const normalized = normalizePhoneNumber(phone);

        // Search by normalized phone
        const q = query(usersRef, where('phone', '==', normalized), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            return {
                vid: doc.id,
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

export const searchUserByEmail = async (email: string): Promise<{ vid: string, email: string, address: string } | null> => {
    try {
        const db = getFirebaseDb();
        const emailLower = email.toLowerCase().trim();
        const docRef = doc(db, 'users', emailLower);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = snapshot.data();
            return {
                vid: snapshot.id,
                email: data.email,
                address: data.walletAddress
            };
        }
        return null;
    } catch (e) {
        console.error("User search by email failed:", e);
        return null;
    }
};

export const searchUserByName = async (name: string): Promise<{ vid: string, email: string, address: string } | null> => {
    try {
        const db = getFirebaseDb();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('displayName', '==', name), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docResult = snapshot.docs[0];
            const data = docResult.data();
            return { vid: docResult.id, email: data.email, address: data.walletAddress };
        }

        const q2 = query(usersRef, where('name', '==', name), limit(1));
        const snapshot2 = await getDocs(q2);
        if (!snapshot2.empty) {
            const docResult = snapshot2.docs[0];
            const data = docResult.data();
            return { vid: docResult.id, email: data.email, address: data.walletAddress };
        }
        return null;
    } catch (e) {
        console.error("User search by name failed:", e);
        return null;
    }
};

// --- Referral System Utilities & Processing ---

export interface ReferralConfig {
    tier1Rate: number;
    tier2Rate: number;
    enabledEvents: string[];
}

/**
 * Fetches the global referral configuration from Firestore.
 */
export const getReferralConfig = async (): Promise<ReferralConfig> => {
    try {
        const db = getFirebaseDb();
        const configSnap = await getDoc(doc(db, 'referral_configs', 'global'));
        if (configSnap.exists()) {
            return configSnap.data() as ReferralConfig;
        }
    } catch (e) {
        console.error("Error fetching referral config:", e);
    }
    // Default Fallback
    return {
        tier1Rate: 0.10, // 10%
        tier2Rate: 0.02, // 2%
        enabledEvents: ['subscription', 'token_sale', 'staking']
    };
};

/**
 * Processes referral rewards when a revenue event occurs.
 */
export const processReferralRewards = async (
    event: string,
    fromUserEmail: string,
    amount: number,
    currency: 'USD' | 'VCN' = 'USD',
    txHash?: string
): Promise<void> => {
    try {
        const db = getFirebaseDb();
        const fromUser = await getUserData(fromUserEmail);
        if (!fromUser || !fromUser.referrerId) return;

        const config = await getReferralConfig();
        if (!config.enabledEvents.includes(event)) return;

        // 1. Tier 1 Reward
        const referrer = await getUserData(fromUser.referrerId);
        if (referrer) {
            const rewardAmount = amount * config.tier1Rate;
            await addDoc(collection(db, 'referral_rewards'), {
                userId: referrer.email,
                fromUserId: fromUserEmail,
                amount: rewardAmount,
                currency,
                tier: 1,
                event,
                percentage: config.tier1Rate,
                status: 'pending',
                timestamp: new Date().toISOString(),
                txHash
            });

            // Update Referrer Totals
            const rRef = doc(db, 'users', referrer.email.toLowerCase());
            const totalField = currency === 'VCN' ? 'totalRewardsVCN' : 'totalRewardsUSD';
            await updateDoc(rRef, {
                [totalField]: (referrer[totalField] || 0) + rewardAmount
            });
            console.log(`[Referral] Distributed ${rewardAmount} ${currency} to 1st tier referrer ${referrer.email}`);
        }

        // 2. Tier 2 Reward
        if (fromUser.grandReferrerId) {
            const grandReferrer = await getUserData(fromUser.grandReferrerId);
            if (grandReferrer) {
                const rewardAmount = amount * config.tier2Rate;
                await addDoc(collection(db, 'referral_rewards'), {
                    userId: grandReferrer.email,
                    fromUserId: fromUserEmail,
                    amount: rewardAmount,
                    currency,
                    tier: 2,
                    event,
                    percentage: config.tier2Rate,
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    txHash
                });

                // Update Grand Referrer Totals
                const grRef = doc(db, 'users', grandReferrer.email.toLowerCase());
                const totalField = currency === 'VCN' ? 'totalRewardsVCN' : 'totalRewardsUSD';
                await updateDoc(grRef, {
                    [totalField]: (grandReferrer[totalField] || 0) + rewardAmount
                });
                console.log(`[Referral] Distributed ${rewardAmount} ${currency} to 2nd tier referrer ${grandReferrer.email}`);
            }
        }
    } catch (e) {
        console.error("Failed to process referral rewards:", e);
    }
};

/**
 * Generates a unique referral code based on the user's name or email.
 * Format: NAME_RANDOM (e.g., JAY_X92K)
 */
export const generateReferralCode = async (name: string, email: string): Promise<string> => {
    const prefix = (name || email.split('@')[0]).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 4);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${prefix}_${random}`;

    const db = getFirebaseDb();
    const q = query(collection(db, 'users'), where('referralCode', '==', code));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        return generateReferralCode(name, email);
    }

    return code;
};

/**
 * Finds a user by their referral code.
 */
export const getUserByReferralCode = async (code: string): Promise<UserData | null> => {
    const db = getFirebaseDb();
    const q = query(collection(db, 'users'), where('referralCode', '==', code));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as UserData;
};

/**
 * Gets the list of users referred by a specific email.
 */
export const getUserReferrals = async (email: string): Promise<UserData[]> => {
    const db = getFirebaseDb();
    const q = query(collection(db, 'users'), where('referrerId', '==', email.toLowerCase()));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UserData);
};

/**
 * Resolves a recipient identifier (phone, email, name, handle) to a VID and Address.
 */
export const resolveRecipient = async (identifier: string, currentUserEmail?: string): Promise<{ vid: string, email: string, address: string } | null> => {
    if (!identifier) return null;

    // 1. If it's already a valid address
    if (identifier.startsWith('0x') && identifier.length === 42) {
        return { vid: 'Address', email: '', address: identifier };
    }

    const cleanId = identifier.startsWith('@') ? identifier.slice(1) : identifier;

    // 2. Search by Phone
    const phoneClean = cleanId.replace(/\D/g, '');
    if (phoneClean.length >= 8) {
        const result = await searchUserByPhone(cleanId);
        if (result) return result;
    }

    // 3. Search by Email
    if (cleanId.includes('@')) {
        const result = await searchUserByEmail(cleanId);
        if (result) return result;
    }

    // 4. Search in User's Address Book (Contacts) - Crucial for human-readable names
    if (currentUserEmail) {
        try {
            const contacts = await getUserContacts(currentUserEmail);
            const contact = contacts.find(c =>
                c.internalName.toLowerCase() === cleanId.toLowerCase() ||
                c.alias?.toLowerCase() === cleanId.toLowerCase() ||
                c.tags?.some(t => t.toLowerCase() === cleanId.toLowerCase()) ||
                c.vchainUserUid?.toLowerCase() === cleanId.toLowerCase()
            );

            if (contact && contact.address) {
                return {
                    vid: contact.vchainUserUid || contact.internalName,
                    email: contact.email,
                    address: contact.address
                };
            }
        } catch (e) {
            console.warn("[Firebase] Address book search failed:", e);
        }
    }

    // 5. Global Name Lookup
    const nameResult = await searchUserByName(cleanId);
    if (nameResult) return nameResult;

    // 6. Try direct VID lookup (via searchUserByEmail as it matches doc ID)
    return await searchUserByEmail(cleanId);
};

// Initialize Firebase (singleton pattern)

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

export const initializeFirebase = (useLongPolling = false) => {
    if (!app) {
        const apps = getApps();
        // Explicitly look for the default app, or create it. 
        // DO NOT take apps[0] blindly as it might be the isolated Admin app.
        app = apps.find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);
    }

    if (!auth) {
        auth = getAuth(app);
    }

    // Only initialize Firestore if not already set
    if (!db) {
        if (useLongPolling) {
            console.info('[Firebase] Firestore: Using Long Polling fallback.');
            db = initializeFirestore(app, { experimentalForceLongPolling: true });
        } else {
            // Standard Cloud Firestore initialization (Websockets/GRPC)
            db = getFirestore(app);
            console.log('[Firebase] Infrastructure initialized successfully.');
        }
    }

    return { app, auth, db };
};

// Export getters
export const getFirebaseAuth = () => {
    if (!auth) initializeFirebase();
    return auth;
};

// --- Isolated Admin Auth (Prevents Session Conflict) ---
let adminApp: FirebaseApp;
let adminAuth: Auth;

export const getAdminFirebaseAuth = () => {
    if (!adminAuth) {
        // Create a named app for Admin to segregate storage/auth state
        const apps = getApps();
        adminApp = apps.find(a => a.name === 'AdminConsole') || initializeApp(firebaseConfig, 'AdminConsole');
        adminAuth = getAuth(adminApp);
    }
    return adminAuth;
};

export const getFirebaseDb = () => {
    if (!db) initializeFirebase();
    return db;
};

// ==================== Auth Functions ====================

export const adminLogin = async (email: string, password: string): Promise<User> => {
    const auth = getAdminFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
};

export const adminRegister = async (email: string, password: string, phone?: string, referralCode?: string): Promise<User> => {
    const auth = getFirebaseAuth();
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase().trim();
    const normalizedPhone = phone ? normalizePhoneNumber(phone) : '';

    const { createUserWithEmailAndPassword, sendEmailVerification } = await import('firebase/auth');
    const userCredential = await createUserWithEmailAndPassword(auth, emailLower, password);

    // Send Verification Email
    try {
        await sendEmailVerification(userCredential.user);
        console.log('[Auth] Verification email sent to', emailLower);
    } catch (error) {
        console.error('[Auth] Failed to send verification email:', error);
    }

    // Referral Logic
    let referrerId = '';
    let grandReferrerId = '';

    if (referralCode) {
        const referrer = await getUserByReferralCode(referralCode);
        if (referrer) {
            referrerId = referrer.email;
            grandReferrerId = referrer.referrerId || '';

            // Increment referrer's count
            const rRef = doc(db, 'users', referrerId.toLowerCase());
            await updateDoc(rRef, {
                referralCount: (referrer.referralCount || 0) + 1
            });
            console.log(`[Referral] User ${emailLower} referred by ${referrerId}`);
        }
    }

    // Generate my own referral code
    const myReferralCode = await generateReferralCode('', emailLower);

    // Check if user doc exists (pre-registered via CSV)
    const userRef = doc(db, 'users', emailLower);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.status === 'PendingActivation') {
            await setDoc(userRef, {
                status: 'Registered',
                phone: normalizedPhone || userData.phone || '',
                referralCode: myReferralCode,
                referrerId,
                grandReferrerId,
                referralCount: 0,
                totalRewardsVCN: 0,
                totalRewardsUSD: 0,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            // Also update token_sales status if it was Pending
            const saleRef = doc(db, 'token_sales', emailLower);
            const saleSnap = await getDoc(saleRef);
            if (saleSnap.exists()) {
                await setDoc(saleRef, { status: 'Registered' }, { merge: true });
            }

            // AUTO-ADD TO REFERRER'S ADDRESS BOOK
            if (referrerId) {
                try {
                    await saveUserContacts(referrerId, [{
                        internalName: (userCredential.user as any).displayName || emailLower.split('@')[0],
                        phone: normalizedPhone || userData.phone || '',
                        email: emailLower,
                        vchainUserUid: emailLower,
                        address: ''
                    }]);
                } catch (err) {
                    console.warn("[Referral] Auto-add failed:", err);
                }
            }
        }
    } else {
        // New user signup
        await setDoc(userRef, {
            email: emailLower,
            phone: normalizedPhone,
            role: 'user',
            status: 'PendingVerification',
            accountOrigin: 'self-signup',
            referralCode: myReferralCode,
            referrerId,
            grandReferrerId,
            referralCount: 0,
            totalRewardsVCN: 0,
            totalRewardsUSD: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // AUTO-ADD TO REFERRER'S ADDRESS BOOK
        if (referrerId) {
            try {
                await saveUserContacts(referrerId, [{
                    internalName: emailLower.split('@')[0],
                    phone: normalizedPhone,
                    email: emailLower,
                    vchainUserUid: emailLower,
                    address: ''
                }]);
            } catch (err) {
                console.warn("[Referral] Auto-add failed:", err);
            }
        }
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
    const auth = getAdminFirebaseAuth();
    await signOut(auth);
};

export const onAdminAuthStateChanged = (callback: (user: User | null) => void) => {
    const auth = getAdminFirebaseAuth();
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
    amountToken?: number;
    name?: string;
    phone?: string;
    bio?: string;
    twitter?: string;
    discord?: string;
    walletReady?: boolean;

    // Referral System Fields
    referralCode?: string;
    referrerId?: string;       // Email of the person who referred this user
    grandReferrerId?: string;  // Email of the person who referred the referrer
    referralCount?: number;
    totalRewardsVCN?: number;
    totalRewardsUSD?: number;
}

export interface ReferralReward {
    id?: string;
    userId: string;         // The user who earned the reward (email)
    fromUserId: string;     // The user whose action triggered the reward (email)
    amount: number;         // Amount in USD or VCN
    currency: 'USD' | 'VCN';
    tier: 1 | 2;            // 1st tier (Direct) or 2nd tier (Indirect)
    event: string;          // 'subscription', 'token_sale', 'staking', etc.
    percentage: number;     // The rate applied (e.g., 0.1 for 10%)
    status: 'pending' | 'distributed' | 'failed';
    timestamp: string;
    txHash?: string;        // Blockchain transaction hash if distributed
}

export interface Contact {
    id?: string;
    internalName: string;
    alias?: string;
    tags?: string[];
    phone: string;
    email?: string;
    address?: string;
    vchainUserUid?: string;
    isFavorite?: boolean;
    createdAt: string;
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
            walletReady: user?.walletReady || sale?.walletReady || false,
            // Referral Fields
            referralCode: user?.referralCode || '',
            referrerId: user?.referrerId || '',
            grandReferrerId: user?.grandReferrerId || '',
            referralCount: user?.referralCount || 0,
            totalRewardsVCN: user?.totalRewardsVCN || 0,
            totalRewardsUSD: user?.totalRewardsUSD || 0
        };
    }
    return null;
};

export const updateUserData = async (email: string, updates: Partial<UserData>) => {
    try {
        const db = getFirebaseDb();
        const emailLower = email.toLowerCase().trim();
        const userRef = doc(db, 'users', emailLower);

        const preparedUpdates = { ...updates };
        if (preparedUpdates.phone) {
            preparedUpdates.phone = normalizePhoneNumber(preparedUpdates.phone);
        }

        await setDoc(userRef, {
            ...preparedUpdates,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log(`[Firebase] Updated profile for ${emailLower}`);
    } catch (e) {
        console.error("Error updating user data:", e);
        throw e;
    }
};

// --- Contact Management ---

export const saveUserContacts = async (userEmail: string, contacts: Omit<Contact, 'createdAt'>[]) => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const batch = writeBatch(db);

        for (const contact of contacts) {
            const contactRef = doc(collection(db, 'users', userEmailLower, 'contacts'));
            const normalizedPhone = normalizePhoneNumber(contact.phone);

            // Try to resolve VID/Address immediately if possible
            const resolved = await searchUserByPhone(normalizedPhone);

            batch.set(contactRef, {
                ...contact,
                phone: normalizedPhone,
                email: (contact as any).email ? (contact as any).email.toLowerCase().trim() : null,
                vchainUserUid: resolved?.vid || (contact as any).vchainUserUid || null,
                address: resolved?.address || (contact as any).address || null,
                createdAt: new Date().toISOString()
            });
        }

        await batch.commit();
        console.log(`[Firebase] Saved ${contacts.length} contacts for ${userEmailLower}`);
    } catch (e) {
        console.error("Error saving contacts:", e);
        throw e;
    }
};

export const toggleContactFavorite = async (userEmail: string, contactId: string, isFavorite: boolean): Promise<void> => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const contactRef = doc(db, 'users', userEmailLower, 'contacts', contactId);
        await updateDoc(contactRef, {
            isFavorite,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error toggling favorite:", e);
        throw e;
    }
};

export const getUserContacts = async (userEmail: string): Promise<Contact[]> => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const contactsRef = collection(db, 'users', userEmailLower, 'contacts');
        const q = query(contactsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Contact));
    } catch (e) {
        console.error("Error fetching contacts:", e);
        return [];
    }
};

export const syncUserContacts = async (userEmail: string): Promise<number> => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const contactsRef = collection(db, 'users', userEmailLower, 'contacts');
        const snapshot = await getDocs(contactsRef);

        let updateCount = 0;
        const batch = writeBatch(db);

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as Contact;
            // Only sync those without vchainUserUid or address
            if (!data.vchainUserUid || !data.address) {
                const normalizedPhone = normalizePhoneNumber(data.phone);
                const resolved = await searchUserByPhone(normalizedPhone);

                if (resolved && (resolved.vid !== data.vchainUserUid || resolved.address !== data.address)) {
                    batch.update(docSnap.ref, {
                        vchainUserUid: resolved.vid,
                        address: resolved.address,
                        updatedAt: new Date().toISOString()
                    });
                    updateCount++;
                }
            }
        }

        if (updateCount > 0) {
            await batch.commit();
        }
        return updateCount;
    } catch (e) {
        console.error("Error syncing contacts:", e);
        throw e;
    }
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

// --- Scheduled Task Queue Subscription ---
export const subscribeToQueue = (
    userEmail: string,
    callback: (tasks: any[]) => void
) => {
    const db = getFirebaseDb();
    const q = query(
        collection(db, 'scheduledTransfers'),
        where('userEmail', '==', userEmail.toLowerCase())
    );

    // Assuming onSnapshot is imported or available. If not, add to imports.
    // Re-using the top-level imports structure.

    return onSnapshot(q, (snapshot: any) => {
        const tasks = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            // Map DB status to UI status (Aligned with Backend Runner)
            if (data.status === 'SENT') status = 'SENT';
            else if (data.status === 'FAILED') status = 'FAILED';
            else if (data.status === 'CANCELLED') status = 'CANCELLED';
            else if (data.status === 'WAITING' || data.status === 'pending') {
                status = 'WAITING';
            } else if (data.status === 'EXECUTING') {
                status = 'EXECUTING';
            }

            // Calculate relative time or formatted time
            const unlockTime = data.unlockTime; // Unix timestamp (seconds)
            const now = Math.floor(Date.now() / 1000);
            const diff = unlockTime - now;
            let timeLeft = '';

            if (status === 'WAITING') {
                if (diff > 0) {
                    if (diff > 3600) timeLeft = `In ${Math.ceil(diff / 3600)}h`;
                    else timeLeft = `In ${Math.ceil(diff / 60)}m`;
                } else {
                    timeLeft = 'Processing...';
                    status = 'EXECUTING'; // Optimistic status when time passed
                }
            } else {
                timeLeft = new Date(unlockTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return {
                id: doc.id,
                dbStatus: data.status,
                type: 'TIMELOCK',
                summary: `${data.amount} ${data.token} → ${data.recipient.slice(0, 6)}...`,
                status: status,
                timeLeft: timeLeft,
                timestamp: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
                // Extra fields for Drawer
                recipient: data.recipient,
                amount: data.amount,
                token: data.token,
                scheduleId: doc.id,
                executeAt: data.unlockTime * 1000,
                txHash: data.executionTx || data.creationTx
            };
        });

        // Sort: Active (EXECUTING > WAITING) first, then by time
        const sorted = tasks.sort((a: any, b: any) => {
            // 1. Status Priority
            const priority = (s: string) => {
                if (s === 'EXECUTING') return 0;
                if (s === 'WAITING') return 1;
                return 2; // History
            };
            if (priority(a.status) !== priority(b.status)) return priority(a.status) - priority(b.status);

            // 2. Time (Ascending for Waiting/Active, Descending for History)
            if (priority(a.status) < 2) return a.timestamp - b.timestamp; // Nearest first
            return b.timestamp - a.timestamp; // Newest finished first
        });

        callback(sorted);
    });
};

export const saveScheduledTransfer = async (task: {
    userEmail: string;
    recipient: string;
    amount: string;
    token: string;
    unlockTime: number; // Unix timestamp
    creationTx: string;
    scheduleId?: string; // ID from smart contract
    status: 'WAITING' | 'SENT' | 'FAILED' | 'CANCELLED';
}) => {
    try {
        const db = getFirestore(); // Ensure we use the right db instance
        const docRef = await addDoc(collection(db, 'scheduledTransfers'), {
            ...task,
            scheduleId: task.scheduleId || 0, // Fallback if not provided
            status: 'WAITING', // Set to WAITING for backend runner
            unlockTimeTs: Timestamp.fromMillis(task.unlockTime * 1000), // Indexable field for runner
            nextRetryAt: Timestamp.now(), // First try immediately when due
            retryCount: 0,
            userEmail: task.userEmail.toLowerCase(),
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (e) {
        console.error("Save scheduled transfer failed:", e);
        return null;
    }
};

export const cancelScheduledTask = async (scheduleId: string) => {
    const db = getFirebaseDb();
    // In real app, we call Smart Contract cancel first!
    // Here we just update DB to 'cancelled' for UI demo
    try {
        const docRef = doc(db, 'scheduledTransfers', scheduleId);
        await updateDoc(docRef, { status: 'cancelled' });
        return true;
    } catch (e) {
        console.error("Cancel failed:", e);
        throw e;
    }
};

export const retryScheduledTask = async (taskId: string) => {
    const db = getFirebaseDb();
    try {
        const docRef = doc(db, 'scheduledTransfers', taskId);
        await updateDoc(docRef, {
            status: 'WAITING',
            nextRetryAt: Timestamp.now(),
            retryCount: 0,
            error: null
        });
        return true;
    } catch (e) {
        console.error("Retry failed:", e);
        throw e;
    }
};

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
    promptTuning?: {
        recipientIntent: string;
        senderIntent: string;
        processingRoute: string;
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
                model: 'deepseek-chat',
                temperature: 0.7,
                maxTokens: 2048
            },
            helpdeskBot: {
                systemPrompt: 'You are a helpful support agent for Vision Chain.',
                model: 'deepseek-chat',
                temperature: 0.7,
                maxTokens: 2048
            },
            imageSettings: {
                model: 'imagen-3.0-generate-001',
                quality: 'standard',
                size: '1024x1024'
            },
            voiceSettings: {
                model: 'deepseek-chat',
                ttsVoice: 'Kore',
                sttModel: 'deepseek-chat'
            }
        };

        if (!snapshot.exists()) {
            console.info('[Firebase] Chatbot settings not found. Seeding default configuration...');
            try {
                // Self-healing: Create the default doc so the warning doesn't repeat
                await setDoc(docRef, defaultSettings);
                console.log('[Firebase] Successfully seeded default chatbot settings.');
            } catch (seedErr) {
                console.warn('[Firebase] Failed to seed default settings (check permissions):', seedErr);
            }
            return defaultSettings;
        }

        const data = snapshot.data();
        return {
            knowledgeBase: data.knowledgeBase || defaultSettings.knowledgeBase,
            intentBot: data.intentBot || defaultSettings.intentBot,
            helpdeskBot: data.helpdeskBot || defaultSettings.helpdeskBot,
            imageSettings: data.imageSettings || defaultSettings.imageSettings,
            voiceSettings: data.voiceSettings || defaultSettings.voiceSettings,
            promptTuning: data.promptTuning
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
    updatedAt?: string;
    status: 'completed' | 'ongoing' | 'error';
}

export const saveConversation = async (conversation: Omit<AiConversation, 'id' | 'createdAt' | 'updatedAt'>, existingId?: string): Promise<string> => {
    const db = getFirebaseDb();
    if (existingId) {
        const docRef = doc(db, 'conversations', existingId);
        await setDoc(docRef, {
            ...conversation,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        return existingId;
    } else {
        const docRef = await addDoc(collection(db, 'conversations'), {
            ...conversation,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return docRef.id;
    }
};

export const deleteConversation = async (id: string): Promise<boolean> => {
    try {
        const db = getFirebaseDb();
        await deleteDoc(doc(db, 'conversations', id));
        return true;
    } catch (e) {
        console.error("Delete conversation failed:", e);
        return false;
    }
};

export const getUserConversations = async (userId: string, limitCount: number = 30): Promise<AiConversation[]> => {
    try {
        const db = getFirebaseDb();
        const q = query(
            collection(db, 'conversations'),
            where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiConversation));

        // Client-side sort to avoid composite index requirement
        return conversations
            .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
            .slice(0, limitCount);
    } catch (error) {
        console.error("Error fetching user conversations:", error);
        return [];
    }
};

export const getConversationById = async (id: string): Promise<AiConversation | null> => {
    const db = getFirebaseDb();
    const docSnap = await getDoc(doc(db, 'conversations', id));
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as AiConversation;
    }
    return null;
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

    // Referral Logic
    let grandReferrerId = '';
    if (partnerCode) {
        // In invitation flow, partnerCode is usually the referrer's ID or code
        // Let's check if it's a code first
        const referrer = await getUserByReferralCode(partnerCode);
        if (referrer) {
            grandReferrerId = referrer.referrerId || '';

            // Increment referrer's count
            const rRef = doc(db, 'users', referrer.email.toLowerCase());
            await updateDoc(rRef, {
                referralCount: (referrer.referralCount || 0) + 1
            });
            console.log(`[Referral] User ${email.toLowerCase()} invited by ${referrer.email}`);
        }
    }

    // Generate my own referral code
    const myReferralCode = await generateReferralCode('', email.toLowerCase());

    // 4. Update User Profile
    const userRef = doc(db, 'users', email.toLowerCase());
    await setDoc(userRef, {
        email: email.toLowerCase(),
        role: 'user',
        status: 'Registered',
        accountOrigin: 'invitation',
        referralCode: myReferralCode,
        referrerId: partnerCode || '', // Assuming partnerCode is the referrer email if not found as code
        grandReferrerId,
        referralCount: 0,
        totalRewardsVCN: 0,
        totalRewardsUSD: 0,
        updatedAt: new Date().toISOString()
    }, { merge: true });

    // 5. Mark Token as Used
    await markTokenAsUsed(token);

    return { email, partnerCode, referralCode: myReferralCode };
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

// --- Notification Engine ---

export interface NotificationData {
    type: 'transfer_received' | 'transfer_scheduled' | 'system_announcement' | 'alert';
    title: string;
    content: string;
    data?: any;
}

export const createNotification = async (email: string, notification: NotificationData) => {
    if (!email) return;
    try {
        const db = getFirebaseDb();
        const notificationRef = collection(db, 'users', email.toLowerCase(), 'notifications');
        await addDoc(notificationRef, {
            ...notification,
            timestamp: new Date().toISOString(),
            read: false
        });
        console.log(`[Notification] Created for ${email}: ${notification.title}`);
    } catch (error) {
        console.error('[Notification] Error creating:', error);
    }
};

// Initialize on import
initializeFirebase();

export const updateScheduledTaskStatus = async (userEmail: string, taskId: string, updates: any) => {
    const db = getFirebaseDb();
    const taskRef = doc(db, 'users', userEmail.toLowerCase(), 'queue', taskId);
    await setDoc(taskRef, updates, { merge: true });
};

export const findUserByAddress = async (address: string): Promise<User | null> => {
    const db = getFirebaseDb();
    const q = query(collection(db, 'users'), where('walletAddress', '==', address));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return snapshot.docs[0].data() as User;
    }
    return null;
};
