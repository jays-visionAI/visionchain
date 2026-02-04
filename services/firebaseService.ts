import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, User, updateProfile } from 'firebase/auth';
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
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';

import { getStorage, ref, uploadBytes, getDownloadURL, FirebaseStorage } from 'firebase/storage';
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

export const searchUsersByPhone = async (phone: string): Promise<{ vid: string, email: string, name: string, address: string }[]> => {
    try {
        const db = getFirebaseDb();
        const usersRef = collection(db, 'users');
        const normalized = normalizePhoneNumber(phone);
        const numericOnly = phone.replace(/\D/g, '');
        const compact = normalized.replace(/-/g, ''); // Remove dashes from normalized

        // Generate multiple search variants to handle different storage formats
        const searchVariants = new Set<string>([
            normalized,                         // +82-10-6650-9865
            compact,                            // +821066509865
            numericOnly,                        // 821066509865
            phone,                              // original input
            phone.replace(/\D/g, ''),           // digits only from original
        ]);

        // Add variants with/without leading country code
        if (numericOnly.startsWith('82')) {
            searchVariants.add('0' + numericOnly.slice(2));  // 01066509865
            searchVariants.add(numericOnly.slice(2));         // 1066509865
            searchVariants.add('+82' + numericOnly.slice(2)); // +821066509865
            searchVariants.add('+82-' + numericOnly.slice(2)); // +82-1066509865
        }
        if (numericOnly.startsWith('0')) {
            searchVariants.add('+82' + numericOnly.slice(1)); // +821066509865 from 01066509865
            searchVariants.add('82' + numericOnly.slice(1));  // 821066509865 from 01066509865
        }
        // Common legacy formats with dashes
        if (numericOnly.length >= 10) {
            const last8 = numericOnly.slice(-8);
            const last9 = numericOnly.slice(-9);
            searchVariants.add('010-' + last8.slice(0, 4) + '-' + last8.slice(4)); // 010-6650-9865
            searchVariants.add('010' + last8); // 0106650 9865
        }

        // Firestore 'in' query limited to 30 values, so we take unique subset
        const uniqueVariants = Array.from(searchVariants).slice(0, 10);

        console.log('[searchUsersByPhone] Searching with variants:', uniqueVariants);

        const q = query(usersRef, where('phone', 'in', uniqueVariants));
        const snapshot = await getDocs(q);

        // Phase 1: Exact match found
        if (snapshot.docs.length > 0) {
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    vid: doc.id,
                    email: data.email,
                    name: data.displayName || data.name || data.email?.split('@')[0] || 'New User',
                    address: data.walletAddress || data.address || ''
                };
            });
        }

        // Phase 2: Suffix-based fuzzy match for legacy formats
        // Get last 8 digits and scan all users (less efficient but handles edge cases)
        const phoneSuffix = numericOnly.slice(-8);
        if (phoneSuffix.length === 8) {
            console.log('[searchUsersByPhone] No exact match, trying suffix match:', phoneSuffix);
            const allUsersSnap = await getDocs(usersRef);
            const fuzzyMatches: { vid: string, email: string, name: string, address: string }[] = [];

            for (const doc of allUsersSnap.docs) {
                const userData = doc.data();
                const userPhone = (userData.phone || '').replace(/\D/g, '');

                // Match if last 8 digits are the same
                if (userPhone.length >= 8 && userPhone.slice(-8) === phoneSuffix) {
                    fuzzyMatches.push({
                        vid: doc.id,
                        email: userData.email,
                        name: userData.displayName || userData.name || userData.email?.split('@')[0] || 'New User',
                        address: userData.walletAddress || userData.address || ''
                    });
                }
            }

            if (fuzzyMatches.length > 0) {
                console.log('[searchUsersByPhone] Found via suffix match:', fuzzyMatches.length);
                return fuzzyMatches;
            }
        }

        return [];
    } catch (e) {
        console.error("User search failed:", e);
        return [];
    }
};

// Kept for backward compatibility if needed by other components
export const searchUserByPhone = async (phone: string) => {
    const results = await searchUsersByPhone(phone);
    return results.length > 0 ? results[0] : null;
};

export const searchUserByEmail = async (email: string): Promise<{ vid: string, email: string, name: string, address: string } | null> => {
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
                name: data.displayName || data.name || data.email?.split('@')[0],
                address: data.walletAddress
            };
        }
        return null;
    } catch (e) {
        console.error("User search by email failed:", e);
        return null;
    }
};

export const searchUserByName = async (name: string): Promise<{ vid: string, email: string, name: string, address: string } | null> => {
    try {
        const db = getFirebaseDb();
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('displayName', '==', name), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const docResult = snapshot.docs[0];
            const data = docResult.data();
            return {
                vid: docResult.id,
                email: data.email,
                name: data.displayName || data.name || data.email?.split('@')[0],
                address: data.walletAddress
            };
        }

        const q2 = query(usersRef, where('name', '==', name), limit(1));
        const snapshot2 = await getDocs(q2);
        if (!snapshot2.empty) {
            const docResult = snapshot2.docs[0];
            const data = docResult.data();
            return {
                vid: docResult.id,
                email: data.email,
                name: data.displayName || data.name || data.email?.split('@')[0],
                address: data.walletAddress
            };
        }
        return null;
    } catch (e) {
        console.error("User search by name failed:", e);
        return null;
    }
};

// --- Referral System Utilities & Processing ---

export interface RankInfo {
    name: string;
    minLvl: number;
    color: string;
    bg: string;
    gradient: string;
    iconName: string;
}

export interface LevelThreshold {
    minLevel: number;
    maxLevel: number;
    invitesPerLevel: number;
}

export interface ReferralConfig {
    tier1Rate: number;
    tier2Rate: number;
    enabledEvents: string[];
    // RPG Level System Config
    baseXpMultiplier: number;
    xpMultiplierPerLevel: number;
    levelThresholds: LevelThreshold[];
    ranks: RankInfo[];
}

export interface DefiConfig {
    stakingApr: number;
    unbondingDays: number;
    instantUnstakeFee: number;
    minStakingAmount: number;
    protocolFee: number;
    sVcnExchangeRate: number; // 1 sVCN = ? VCN
    totalVcnLocked: number;
    totalSVcnIssued: number;
}

// --- Quick Actions Configuration ---
export interface QuickAction {
    id: string;
    label: string;          // Display text (e.g., "Learn about Vision Chain")
    prompt: string;         // Chat prompt to send (e.g., "Tell me about Vision Chain")
    icon: string;           // Icon name (e.g., "BookOpen", "Sparkles", "UserPlus", "Send", "TrendingUp")
    iconColor: string;      // Tailwind color (e.g., "text-yellow-500", "text-purple-400")
    actionType: 'chat' | 'flow';  // 'chat' sends prompt, 'flow' opens a flow
    flowName?: string;      // Flow name if actionType is 'flow' (e.g., "send")
    order: number;          // Display order
    enabled: boolean;       // Whether this action is shown
}

/**
 * Fetches Quick Actions configuration from Firestore.
 */
export const getQuickActions = async (): Promise<QuickAction[]> => {
    try {
        const db = getFirebaseDb();
        const configSnap = await getDoc(doc(db, 'settings', 'quickActions'));
        if (configSnap.exists()) {
            const data = configSnap.data();
            return (data.actions || []) as QuickAction[];
        }
    } catch (e) {
        console.error("Error fetching quick actions:", e);
    }
    // Default Quick Actions
    return [
        { id: '1', label: 'Learn about Vision Chain', prompt: 'Tell me about Vision Chain', icon: 'BookOpen', iconColor: 'text-yellow-500', actionType: 'chat', order: 1, enabled: true },
        { id: '2', label: 'Receive VCN Gift', prompt: 'I want to receive VCN airdrop', icon: 'Sparkles', iconColor: 'text-purple-400', actionType: 'chat', order: 2, enabled: true },
        { id: '3', label: 'Invite Friends', prompt: 'How do I invite friends?', icon: 'UserPlus', iconColor: 'text-emerald-400', actionType: 'chat', order: 3, enabled: true },
        { id: '4', label: 'Send VCN', prompt: '', icon: 'Send', iconColor: 'text-blue-400', actionType: 'flow', flowName: 'send', order: 4, enabled: true },
        { id: '5', label: 'Check Crypto Prices', prompt: 'Show me the current crypto market prices', icon: 'TrendingUp', iconColor: 'text-red-400', actionType: 'chat', order: 5, enabled: true }
    ];
};

/**
 * Saves Quick Actions configuration to Firestore.
 */
export const saveQuickActions = async (actions: QuickAction[]): Promise<void> => {
    try {
        const db = getFirebaseDb();
        const configRef = doc(db, 'settings', 'quickActions');
        await setDoc(configRef, { actions, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
        console.error("Error saving quick actions:", e);
        throw e;
    }
};

export interface StakingPosition {
    id?: string;
    email: string;
    vcnAmount: number;
    sVcnAmount: number;
    stakingDate: string;
    status: 'active' | 'unbonding' | 'withdrawn';
    unbondingEndsAt?: string;
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
        enabledEvents: ['subscription', 'token_sale', 'staking'],
        baseXpMultiplier: 1.0,
        xpMultiplierPerLevel: 0.05,
        levelThresholds: [
            { minLevel: 1, maxLevel: 20, invitesPerLevel: 1 },
            { minLevel: 21, maxLevel: 50, invitesPerLevel: 2 },
            { minLevel: 51, maxLevel: 80, invitesPerLevel: 5 },
            { minLevel: 81, maxLevel: 100, invitesPerLevel: 10 }
        ],
        ranks: [
            { name: 'Novice', minLvl: 1, color: 'text-gray-400', bg: 'bg-gray-500', gradient: 'from-gray-600 to-gray-500', iconName: 'Users' },
            { name: 'Scout', minLvl: 10, color: 'text-blue-400', bg: 'bg-blue-500', gradient: 'from-blue-600 to-cyan-500', iconName: 'ExternalLink' },
            { name: 'Ranger', minLvl: 20, color: 'text-emerald-400', bg: 'bg-emerald-500', gradient: 'from-emerald-600 to-green-500', iconName: 'TrendingUp' },
            { name: 'Guardian', minLvl: 30, color: 'text-cyan-400', bg: 'bg-cyan-500', gradient: 'from-cyan-600 to-sky-500', iconName: 'Shield' },
            { name: 'Elite', minLvl: 40, color: 'text-indigo-400', bg: 'bg-indigo-500', gradient: 'from-indigo-600 to-blue-600', iconName: 'Zap' },
            { name: 'Captain', minLvl: 50, color: 'text-violet-400', bg: 'bg-violet-500', gradient: 'from-violet-600 to-purple-600', iconName: 'Award' },
            { name: 'Commander', minLvl: 60, color: 'text-orange-400', bg: 'bg-orange-500', gradient: 'from-orange-600 to-amber-500', iconName: 'Trophy' },
            { name: 'Warlord', minLvl: 70, color: 'text-red-400', bg: 'bg-red-500', gradient: 'from-red-600 to-orange-600', iconName: 'Crosshair' },
            { name: 'Titan', minLvl: 80, color: 'text-rose-400', bg: 'bg-rose-500', gradient: 'from-rose-600 to-pink-600', iconName: 'Crown' },
            { name: 'Visionary', minLvl: 90, color: 'text-yellow-400', bg: 'bg-yellow-500', gradient: 'from-yellow-500 to-amber-300', iconName: 'Star' }
        ]
    };
}

/**
 * Fetches the global De-Fi configuration from Firestore.
 */
export const getDefiConfig = async (): Promise<DefiConfig> => {
    try {
        const db = getFirebaseDb();
        const configSnap = await getDoc(doc(db, 'defi_configs', 'global'));
        if (configSnap.exists()) {
            return configSnap.data() as DefiConfig;
        }
    } catch (e) {
        console.error("Error fetching defi config:", e);
    }
    // Default Fallback
    return {
        stakingApr: 12.5,
        unbondingDays: 14,
        instantUnstakeFee: 3.0,
        minStakingAmount: 100,
        protocolFee: 5.0,
        sVcnExchangeRate: 1.0,
        totalVcnLocked: 0,
        totalSVcnIssued: 0
    };
}

/**
 * Updates the global De-Fi configuration.
 */
export const updateDefiConfig = async (config: Partial<DefiConfig>): Promise<void> => {
    try {
        const db = getFirebaseDb();
        const configRef = doc(db, 'defi_configs', 'global');
        await setDoc(configRef, config, { merge: true });
        console.log("[Firebase] Defi config updated");
    } catch (e) {
        console.error("Error updating defi config:", e);
        throw e;
    }
}

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
 * Generates a unique referral code.
 * Format: Random 6-char Alphanumeric (e.g. X9A2B1)
 */
export const generateReferralCode = async (name: string, email: string): Promise<string> => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

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
 * Fetches the referral leaderboard.
 */
export const getReferralLeaderboard = async (limitCount: number = 50): Promise<any[]> => {
    try {
        const db = getFirebaseDb();
        const usersRef = collection(db, 'users');
        // Index Required: users collection, orderBy referralCount desc
        const q = query(usersRef, orderBy('referralCount', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc, index) => {
            const data = doc.data();
            return {
                rank: index + 1,
                name: data.displayName || data.name || data.email?.split('@')[0] || 'Unknown',
                email: data.email,
                invites: data.referralCount || 0
            };
        });
    } catch (e) {
        console.error("Error fetching leaderboard:", e);
        return [];
    }
};

// ==================== Referral Rush Round System ====================

export interface ReferralRound {
    roundId: number;
    startTime: string;
    endTime: string;
    status: 'active' | 'completed';
    totalNewUsers: number;
    totalRewardPool: number;
    rankings?: RoundRanking[];
}

export interface RoundRanking {
    userId: string;
    name: string;
    invites: number;
    contributionRate: number;
    reward: number;
    nftAwarded?: 'gold' | 'silver' | 'bronze';
}

export interface RoundParticipant {
    roundId: number;
    referrerId: string;
    invitedUsers: string[];
    inviteCount: number;
    contributionRate: number;
    estimatedReward: number;
    claimed: boolean;
}

/**
 * Calculates the current round number based on UTC time.
 * Rounds start at 0, 4, 8, 12, 16, 20 UTC.
 */
export const calculateCurrentRoundId = (): number => {
    const now = new Date();
    const epoch = new Date('2024-01-01T00:00:00Z').getTime();
    const msPerRound = 4 * 60 * 60 * 1000; // 4 hours
    return Math.floor((now.getTime() - epoch) / msPerRound);
};

/**
 * Gets the start and end time for a given round.
 */
export const getRoundTimeRange = (roundId: number): { start: Date; end: Date } => {
    const epoch = new Date('2024-01-01T00:00:00Z').getTime();
    const msPerRound = 4 * 60 * 60 * 1000;
    const start = new Date(epoch + roundId * msPerRound);
    const end = new Date(epoch + (roundId + 1) * msPerRound);
    return { start, end };
};

/**
 * Gets or creates the current round document.
 */
export const getCurrentRound = async (): Promise<ReferralRound> => {
    const db = getFirebaseDb();
    const roundId = calculateCurrentRoundId();
    const roundRef = doc(db, 'referral_rounds', roundId.toString());
    const roundSnap = await getDoc(roundRef);

    if (roundSnap.exists()) {
        return { roundId, ...roundSnap.data() } as ReferralRound;
    }

    // Create new round
    const { start, end } = getRoundTimeRange(roundId);
    const newRound: ReferralRound = {
        roundId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'active',
        totalNewUsers: 0,
        totalRewardPool: 10000 // Base pool: 10,000 VCN per round
    };

    await setDoc(roundRef, newRound);
    return newRound;
};

/**
 * Gets leaderboard for a specific round with contribution rates.
 */
export const getRoundLeaderboard = async (roundId?: number): Promise<{
    round: ReferralRound;
    participants: RoundParticipant[];
}> => {
    const db = getFirebaseDb();
    const targetRoundId = roundId ?? calculateCurrentRoundId();

    // Get round info
    const roundRef = doc(db, 'referral_rounds', targetRoundId.toString());
    const roundSnap = await getDoc(roundRef);

    let round: ReferralRound;
    if (roundSnap.exists()) {
        round = { roundId: targetRoundId, ...roundSnap.data() } as ReferralRound;
    } else {
        round = await getCurrentRound();
    }

    // Get participants for this round
    const participantsRef = collection(db, 'referral_round_participants');
    const q = query(
        participantsRef,
        where('roundId', '==', targetRoundId),
        orderBy('inviteCount', 'desc'),
        limit(50)
    );
    const snapshot = await getDocs(q);

    const participants: RoundParticipant[] = snapshot.docs.map(doc => doc.data() as RoundParticipant);

    // Recalculate contribution rates based on current total
    const totalInvites = participants.reduce((sum, p) => sum + p.inviteCount, 0);
    if (totalInvites > 0) {
        participants.forEach(p => {
            p.contributionRate = p.inviteCount / totalInvites;
            p.estimatedReward = Math.floor(round.totalRewardPool * p.contributionRate);
        });
    }

    return { round, participants };
};

/**
 * Records a new referral for the current round.
 */
export const recordRoundReferral = async (referrerId: string, newUserEmail: string): Promise<void> => {
    const db = getFirebaseDb();
    const roundId = calculateCurrentRoundId();

    // Update round total
    const roundRef = doc(db, 'referral_rounds', roundId.toString());
    const roundSnap = await getDoc(roundRef);

    if (!roundSnap.exists()) {
        await getCurrentRound(); // Create if not exists
    }

    await updateDoc(roundRef, {
        totalNewUsers: (roundSnap.data()?.totalNewUsers || 0) + 1
    });

    // Update participant record
    const participantId = `${roundId}_${referrerId.toLowerCase()}`;
    const participantRef = doc(db, 'referral_round_participants', participantId);
    const participantSnap = await getDoc(participantRef);

    if (participantSnap.exists()) {
        const data = participantSnap.data();
        await updateDoc(participantRef, {
            invitedUsers: [...(data.invitedUsers || []), newUserEmail.toLowerCase()],
            inviteCount: (data.inviteCount || 0) + 1
        });
    } else {
        const newParticipant: RoundParticipant = {
            roundId,
            referrerId: referrerId.toLowerCase(),
            invitedUsers: [newUserEmail.toLowerCase()],
            inviteCount: 1,
            contributionRate: 0,
            estimatedReward: 0,
            claimed: false
        };
        await setDoc(participantRef, newParticipant);
    }

    console.log(`[Referral Round] Recorded referral in round ${roundId}: ${referrerId} -> ${newUserEmail}`);
};

/**
 * Gets past round history.
 */
export const getRoundHistory = async (limitCount: number = 10): Promise<ReferralRound[]> => {
    try {
        const db = getFirebaseDb();
        const roundsRef = collection(db, 'referral_rounds');
        const q = query(roundsRef, where('status', '==', 'completed'), orderBy('roundId', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({ roundId: parseInt(doc.id), ...doc.data() } as ReferralRound));
    } catch (e) {
        console.error("Error fetching round history:", e);
        return [];
    }
};

/**
 * Gets user's claimable rewards across all completed rounds.
 */
export const getUserClaimableRewards = async (email: string): Promise<{
    totalClaimable: number;
    rounds: { roundId: number; reward: number }[];
}> => {
    try {
        const db = getFirebaseDb();
        const participantsRef = collection(db, 'referral_round_participants');
        const q = query(
            participantsRef,
            where('referrerId', '==', email.toLowerCase()),
            where('claimed', '==', false)
        );
        const snapshot = await getDocs(q);

        let totalClaimable = 0;
        const rounds: { roundId: number; reward: number }[] = [];

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as RoundParticipant;
            // Only count completed rounds
            const roundRef = doc(db, 'referral_rounds', data.roundId.toString());
            const roundSnap = await getDoc(roundRef);
            if (roundSnap.exists() && roundSnap.data()?.status === 'completed') {
                totalClaimable += data.estimatedReward;
                rounds.push({ roundId: data.roundId, reward: data.estimatedReward });
            }
        }

        return { totalClaimable, rounds };
    } catch (e) {
        console.error("Error fetching claimable rewards:", e);
        return { totalClaimable: 0, rounds: [] };
    }
};

/**

 * Resolves a recipient identifier (phone, email, name, handle) to a VID and Address.
 */
export const resolveRecipient = async (identifier: string, currentUserEmail?: string): Promise<{ vid: string, email: string, name: string, address: string } | null> => {
    if (!identifier) return null;

    // 1. If it's already a valid address
    if (identifier.startsWith('0x') && identifier.length === 42) {
        return { vid: 'Address', email: '', name: 'New Recipient', address: identifier };
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
                    name: contact.internalName || contact.alias,
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

        // 4. Ensure Referral Code Exists
        let referralCode = user?.referralCode;
        if (!referralCode) {
            console.log(`[Referral] Generating missing code for ${emailLower}`);
            referralCode = await generateReferralCode('', emailLower);
            // Save immediately
            const userRef = doc(db, 'users', emailLower);
            await setDoc(userRef, { referralCode }, { merge: true });
        }

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
            referralCode: referralCode,
            referrerId: user?.referrerId || '',
            grandReferrerId: user?.grandReferrerId || '',
            referralCount: user?.referralCount || 0,
            totalRewardsVCN: user?.totalRewardsVCN || 0,
            totalRewardsUSD: user?.totalRewardsUSD || 0
        };
    }
    return null;
};

// Initialize Firebase (singleton pattern)

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

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

    if (!storage) {
        storage = getStorage(app);
    }

    return { app, auth, db, storage };
};

// Export getters
export const getFirebaseAuth = () => {
    if (!auth) initializeFirebase();
    return auth;
};

export const getFirebaseStorage = () => {
    if (!storage) initializeFirebase();
    return storage;
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

export const getFirebaseApp = () => {
    if (!app) initializeFirebase();
    return app;
};

/**
 * Uploads a profile image to Firebase Storage and updates user document/profile
 */
export const uploadProfileImage = async (email: string, imageBlob: Blob): Promise<string> => {
    if (!email) throw new Error("Email required for upload");

    try {
        const store = getFirebaseStorage();
        const imageRef = ref(store, `profiles/${email.toLowerCase()}/avatar_${Date.now()}.jpg`);

        await uploadBytes(imageRef, imageBlob, { contentType: 'image/jpeg' });
        const downloadURL = await getDownloadURL(imageRef);

        // 1. Update Firestore
        const firestore = getFirebaseDb();
        const userDocRef = doc(firestore, 'users', email.toLowerCase());
        await updateDoc(userDocRef, {
            photoURL: downloadURL
        });

        // 2. Update Auth Profile
        const firebaseAuth = getFirebaseAuth();
        if (firebaseAuth.currentUser) {
            await updateProfile(firebaseAuth.currentUser, {
                photoURL: downloadURL
            });
        }

        console.log(`[Firebase] Profile image uploaded for ${email}: ${downloadURL}`);
        return downloadURL;
    } catch (e) {
        console.error("Error uploading profile image:", e);
        throw e;
    }
};

// ==================== User Auth Functions (Default App) ====================

export const userLogin = async (email: string, password: string): Promise<User> => {
    const auth = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
};

export const userLogout = async (): Promise<void> => {
    const auth = getFirebaseAuth();
    await signOut(auth);
};

export const onUserAuthStateChanged = (callback: (user: User | null) => void) => {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, callback);
};

// ==================== Admin Auth Functions (Isolated) ====================

export const adminLogin = async (email: string, password: string): Promise<User> => {
    const auth = getAdminFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
};

export const userRegister = async (email: string, password: string, phone?: string, referralCode?: string): Promise<User> => {
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

            // Record referral for current round (Referral Rush)
            await recordRoundReferral(referrerId, emailLower);

            // 1. Add new user to referrer's contact list (or update existing pending contact)
            const existingContact = await findContactByPhone(referrerId.toLowerCase(), normalizedPhone);

            if (existingContact) {
                // Update existing pending contact with verified info
                const existingContactRef = doc(db, 'users', referrerId.toLowerCase(), 'contacts', existingContact.id);
                await setDoc(existingContactRef, {
                    email: emailLower,
                    vchainUserUid: emailLower,
                    syncStatus: 'verified',
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log(`[Referral] Updated existing contact ${existingContact.id} for ${emailLower}`);
            } else {
                // Create new contact
                const referrerContactsRef = doc(db, 'users', referrerId.toLowerCase(), 'contacts', emailLower);
                await setDoc(referrerContactsRef, {
                    internalName: emailLower.split('@')[0],
                    email: emailLower,
                    phone: normalizedPhone,
                    vchainUserUid: emailLower,
                    syncStatus: 'verified',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                console.log(`[Referral] Created new contact for ${emailLower}`);
            }

            // 2. Add referrer to new user's contact list (Bi-directional)
            const newUserContactsRef = doc(db, 'users', emailLower, 'contacts', referrerId.toLowerCase());
            await setDoc(newUserContactsRef, {
                internalName: referrer.name || referrerId.split('@')[0],
                email: referrerId.toLowerCase(),
                phone: referrer.phone || '',
                vchainUserUid: referrerId.toLowerCase(),
                syncStatus: 'verified',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log(`[Referral] User ${emailLower} referred by ${referrerId}. Bi-directional contacts created.`);
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

    // 2. Create Firebase Auth User
    const auth = getFirebaseAuth();
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);

    // 3. Update Status
    await setDoc(saleRef, {
        status: 'Registered'
    }, { merge: true });

    // 4. Create User Profile if needed
    const userRef = doc(db, 'users', email.toLowerCase());
    await setDoc(userRef, {
        email: email,
        role: 'user', // Default role
        createdAt: new Date().toISOString()
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
    photoURL?: string;

    // Referral System Fields
    referralCode?: string;
    referrerId?: string;       // Email of the person who referred this user
    grandReferrerId?: string;  // Email of the person who referred the referrer
    referralCount?: number;
    totalRewardsVCN?: number;
    totalRewardsUSD?: number;

    // Admin Sent Tracking
    adminSentTotal?: number;   // Total VCN sent by admin to this user
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
    updatedAt?: string;
    syncStatus?: 'verified' | 'ambiguous' | 'pending';
    potentialMatches?: { vid: string, email: string, address: string }[] | null;
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
                email: userDoc?.email || saleDoc?.email || email,
                role: userDoc?.role || 'user',
                name: userDoc?.name || userDoc?.displayName || saleDoc?.name || (email.includes('@') ? email.split('@')[0] : email),
                phone: userDoc?.phone || saleDoc?.phone || '',
                walletAddress: finalWallet,
                status: status,
                joinDate: joinDateStr,
                isVerified: !!saleDoc,
                tier: saleDoc?.tier || 0,
                amountToken: saleDoc?.amountToken || saleDoc?.amount || 0,
                referralCode: userDoc?.referralCode || saleDoc?.referralCode || '',
                referrerId: userDoc?.referrerId || saleDoc?.referrerId || ''
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

/**
 * Find an existing contact by phone number in a user's contact list.
 * Used to check if a pending contact exists before creating a new one.
 */
export const findContactByPhone = async (
    ownerEmail: string,
    phone: string
): Promise<{ id: string, data: any } | null> => {
    if (!phone) return null;

    try {
        const db = getFirebaseDb();
        const ownerEmailLower = ownerEmail.toLowerCase().trim();
        const normalizedPhone = normalizePhoneNumber(phone);
        const phoneDigits = normalizedPhone.replace(/\D/g, '');

        const contactsRef = collection(db, 'users', ownerEmailLower, 'contacts');
        const contactsSnap = await getDocs(contactsRef);

        for (const contactDoc of contactsSnap.docs) {
            const contactData = contactDoc.data();
            const contactPhone = (contactData.phone || '').replace(/\D/g, '');

            // Match by normalized phone digits
            if (contactPhone && (
                contactPhone === phoneDigits ||
                contactPhone.endsWith(phoneDigits.slice(-8)) ||
                phoneDigits.endsWith(contactPhone.slice(-8))
            )) {
                return { id: contactDoc.id, data: contactData };
            }
        }
        return null;
    } catch (e) {
        console.warn('[findContactByPhone] Error:', e);
        return null;
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

export const updateContact = async (userEmail: string, contactId: string, updates: Partial<Contact>) => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const contactRef = doc(db, 'users', userEmailLower, 'contacts', contactId);
        await updateDoc(contactRef, {
            ...updates,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        console.error("Error updating contact:", e);
        throw e;
    }
};

export const deleteContact = async (userEmail: string, contactId: string) => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const contactRef = doc(db, 'users', userEmailLower, 'contacts', contactId);
        await deleteDoc(contactRef);
    } catch (e) {
        console.error("Error deleting contact:", e);
        throw e;
    }
};

export const syncUserContacts = async (userEmail: string): Promise<{ updated: number, ambiguous: number }> => {
    try {
        const db = getFirebaseDb();
        const userEmailLower = userEmail.toLowerCase().trim();
        const contactsRef = collection(db, 'users', userEmailLower, 'contacts');
        const snapshot = await getDocs(contactsRef);

        let updateCount = 0;
        let ambiguousCount = 0;
        const batch = writeBatch(db);

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data() as Contact;
            // Re-sync all contacts to check for new/multiple accounts
            const normalizedPhone = normalizePhoneNumber(data.phone);

            // 1. Try phone search first
            let results = await searchUsersByPhone(normalizedPhone);

            // 2. Fallback to email search if phone not found and contact has email
            if (results.length === 0 && data.email) {
                const emailResult = await searchUserByEmail(data.email);
                if (emailResult) {
                    results = [emailResult];
                    console.log(`[Sync] Phone search failed, found by email: ${data.email}`);
                }
            }

            if (results.length === 1) {
                const resolved = results[0];
                // Only update if data changed or status was not verified
                if (resolved.vid !== data.vchainUserUid || resolved.address !== data.address || data.syncStatus !== 'verified') {
                    batch.update(docSnap.ref, {
                        vchainUserUid: resolved.vid,
                        address: resolved.address,
                        email: resolved.email,
                        syncStatus: 'verified',
                        potentialMatches: null,
                        updatedAt: new Date().toISOString()
                    });
                    updateCount++;
                }
            } else if (results.length > 1) {
                // Multiple accounts found - but respect user's prior selection
                if (data.syncStatus === 'verified' && data.vchainUserUid) {
                    // User already selected an account, check if it still exists in results
                    const stillValid = results.some(r => r.vid === data.vchainUserUid);
                    if (stillValid) {
                        // Update address in case it changed, but keep the selection
                        const selectedMatch = results.find(r => r.vid === data.vchainUserUid);
                        if (selectedMatch && selectedMatch.address !== data.address) {
                            batch.update(docSnap.ref, {
                                address: selectedMatch.address,
                                updatedAt: new Date().toISOString()
                            });
                            updateCount++;
                        }
                        // Skip - user's selection is preserved
                        continue;
                    }
                }
                // Only flag as ambiguous if not already resolved
                batch.update(docSnap.ref, {
                    syncStatus: 'ambiguous',
                    potentialMatches: results,
                    updatedAt: new Date().toISOString()
                });
                ambiguousCount++;
            } else if (data.syncStatus === 'verified' && results.length === 0) {
                // Previously verified but now not found (user deleted or phone changed)
                batch.update(docSnap.ref, {
                    syncStatus: 'pending',
                    vchainUserUid: '',
                    address: '',
                    updatedAt: new Date().toISOString()
                });
                updateCount++;
            }
        }

        if (updateCount > 0 || ambiguousCount > 0) {
            await batch.commit();
        }
        return { updated: updateCount, ambiguous: ambiguousCount };
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
            let status: any = 'WAITING';
            if (data.status === 'SENT' || data.status === 'sent') status = 'SENT';
            else if (data.status === 'FAILED' || data.status === 'failed') status = 'FAILED';
            else if (data.status === 'CANCELLED' || data.status === 'cancelled') status = 'CANCELLED';
            else if (data.status === 'WAITING' || data.status === 'pending' || data.status === 'waiting') {
                status = 'WAITING';
            } else if (data.status === 'EXECUTING' || data.status === 'executing') {
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
                    timeLeft = 'Execution Due';
                    // Keep status as WAITING so user knows they can still cancel/interact
                    status = 'WAITING';
                }
            } else if (status === 'SENT') {
                timeLeft = ''; // Will fallback to label 'Success'
            } else {
                timeLeft = new Date(unlockTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return {
                id: doc.id,
                dbStatus: data.status,
                type: data.type || 'TIMELOCK',
                summary: `${data.amount} ${data.token} → ${data.recipient.slice(0, 6)}...`,
                status: status,
                timeLeft: timeLeft,
                timestamp: data.timestamp || (unlockTime * 1000),
                executeAt: unlockTime * 1000,
                completedAt: data.executedAt ? new Date(data.executedAt).getTime() : undefined,
                recipient: data.recipient,
                amount: data.amount,
                token: data.token,
                scheduleId: data.scheduleId,
                txHash: data.executionTx || data.executedTxHash || data.txHash || data.creationTx,
                error: data.error,
                hiddenFromDesk: data.hiddenFromDesk || false,
                hiddenAt: data.hiddenAt
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
    scheduleId?: string | number;
    status?: 'WAITING' | 'SENT' | 'FAILED' | 'CANCELLED';
    type?: string;
    metadata?: any;
}) => {
    try {
        const db = getFirestore();
        const data: any = {
            ...task,
            scheduleId: task.scheduleId || 0,
            status: task.status || 'WAITING',
            unlockTimeTs: Timestamp.fromMillis(task.unlockTime * 1000),
            nextRetryAt: Timestamp.now(),
            retryCount: 0,
            userEmail: task.userEmail.toLowerCase(),
            createdAt: new Date().toISOString(),
            type: task.type || 'TIMELOCK'
        };

        // If it's a batch item, we use a custom ID to avoid duplicates if re-saved
        const docId = (task.type === 'BATCH' && task.scheduleId) ? String(task.scheduleId) : null;

        if (docId) {
            const docRef = doc(db, 'scheduledTransfers', docId);
            await setDoc(docRef, data, { merge: true });
            return docId;
        } else {
            const docRef = await addDoc(collection(db, 'scheduledTransfers'), data);
            return docRef.id;
        }
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
        await updateDoc(docRef, { status: 'CANCELLED' });
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

// Hide a task from Agent Desk (does NOT delete - preserves in History)
export const hideTaskFromDesk = async (taskId: string) => {
    const db = getFirebaseDb();
    try {
        const docRef = doc(db, 'scheduledTransfers', taskId);
        await updateDoc(docRef, {
            hiddenFromDesk: true,
            hiddenAt: new Date().toISOString()
        });
        console.log("[Queue] Task hidden from desk:", taskId);
        return true;
    } catch (e) {
        console.error("Hide from desk failed:", e);
        throw e;
    }
};

// Legacy: Dismiss (delete) - kept for backwards compatibility but prefer hideTaskFromDesk
export const dismissScheduledTask = async (taskId: string) => {
    // Now just hides instead of deleting to preserve history
    return hideTaskFromDesk(taskId);
};

// Hide a bridge transaction from Agent Desk (updates both collections)
export const hideBridgeFromDesk = async (txId: string) => {
    const db = getFirebaseDb();
    const updateData = {
        hiddenFromDesk: true,
        hiddenAt: new Date().toISOString()
    };

    try {
        // Try updating transactions collection first (primary)
        const txDocRef = doc(db, 'transactions', txId);
        await updateDoc(txDocRef, updateData);
        console.log("[Queue] Bridge hidden from desk (transactions):", txId);
    } catch (e1) {
        console.log("[Queue] transactions update failed, trying bridgeTransactions...");
        // Fallback to bridgeTransactions collection
        try {
            const bridgeDocRef = doc(db, 'bridgeTransactions', txId);
            await updateDoc(bridgeDocRef, updateData);
            console.log("[Queue] Bridge hidden from desk (bridgeTransactions):", txId);
        } catch (e2) {
            console.error("Hide bridge from desk failed:", e2);
            throw e2;
        }
    }
    return true;
};

export const markTaskAsSent = async (taskId: string, txHash: string) => {
    const db = getFirebaseDb();
    try {
        const docRef = doc(db, 'scheduledTransfers', taskId);
        await updateDoc(docRef, {
            status: 'SENT',
            executionTx: txHash,
            executedAt: new Date().toISOString()
        });
        return true;
    } catch (e) {
        console.error("Mark sent failed:", e);
        throw e;
    }
};

export const uploadTokenSaleData = async (entries: TokenSaleEntry[]) => {
    const db = getFirebaseDb();
    const newInvitations: { email: string; partnerCode: string }[] = [];
    const existingMembers: string[] = [];
    const changedAmounts: { email: string; oldAmount: number; newAmount: number }[] = [];
    const newRecords: string[] = [];

    // Process entries sequentially or in small batches to avoid rate limits
    // For simplicity, we'll process Firestore writes in parallel but limit concurrency if needed.
    // Here we'll just do a loop.

    for (const entry of entries) {
        const emailLower = entry.email.toLowerCase().trim();

        // Skip entries with empty or invalid email
        if (!emailLower || !emailLower.includes('@')) {
            console.warn(`[uploadTokenSaleData] Skipping invalid email: "${entry.email}"`);
            continue;
        }

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

        // 1. Update token_sales - Smart merge to preserve existing data
        const saleRef = doc(db, 'token_sales', emailLower);
        const existingSaleSnap = await getDoc(saleRef);

        let updateData: any = {
            email: emailLower,
            status: derivedStatus,
            walletAddress: derivedWallet || null,
            updatedAt: new Date().toISOString()
        };

        if (existingSaleSnap.exists()) {
            // Existing record - check for changes
            const existingData = existingSaleSnap.data();
            const existingAmount = existingData.amountToken || 0;
            const newAmount = entry.amountToken || 0;

            // Check if amount is different and new amount is valid
            if (newAmount > 0 && existingAmount !== newAmount) {
                updateData.amountToken = newAmount;
                changedAmounts.push({
                    email: emailLower,
                    oldAmount: existingAmount,
                    newAmount: newAmount
                });
                console.log(`[uploadTokenSaleData] Amount changed for ${emailLower}: ${existingAmount} -> ${newAmount}`);
            }

            // Only update partnerCode if missing
            if (!existingData.partnerCode && entry.partnerCode) {
                updateData.partnerCode = entry.partnerCode;
            }

            // Only update unlockRatio if missing or zero
            if (!existingData.unlockRatio && entry.unlockRatio) {
                updateData.unlockRatio = entry.unlockRatio;
            }

            // Only update vestingPeriod if missing or zero
            if (!existingData.vestingPeriod && entry.vestingPeriod) {
                updateData.vestingPeriod = entry.vestingPeriod;
            }

            // Only update date if missing
            if (!existingData.date && entry.date) {
                updateData.date = entry.date;
            }

            console.log(`[uploadTokenSaleData] Updating existing record for ${emailLower}:`, updateData);
        } else {
            // New record - include all fields from CSV
            updateData = {
                ...entry,
                email: emailLower,
                status: derivedStatus,
                walletAddress: derivedWallet || null,
                createdAt: new Date().toISOString()
            };
            newRecords.push(emailLower);
            console.log(`[uploadTokenSaleData] Creating new record for ${emailLower}`);
        }

        await setDoc(saleRef, updateData, { merge: true });

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
        existingMembers,
        changedAmounts,  // NEW: Array of { email, oldAmount, newAmount }
        newRecords       // NEW: Array of new record emails
    };
};



import { getFunctions, httpsCallable } from 'firebase/functions';

// ... (existing imports)

export const updateWalletStatus = async (email: string, walletAddress: string, isVerified?: boolean) => {
    console.log(`[Firebase] Securely updating wallet address for ${email}...`);

    // Use Cloud Function to bypass client-side permission issues (Email vs UID mismatch)
    try {
        const functions = getFunctions();
        const updateFn = httpsCallable(functions, 'updateWalletAddress');

        await updateFn({ walletAddress, isVerified });
        console.log(`[Firebase] Cloud update successful for ${email}`);

        return;
    } catch (err) {
        console.error("Cloud function update failed, falling back to direct write:", err);
    }

    // Fallback: Direct Write (Legacy / Admin)
    const db = getFirebaseDb();
    const emailLower = email.toLowerCase();

    // 1. Update Token Sale Entry
    const tokenSaleRef = doc(db, 'token_sales', emailLower);
    const tokenSaleSnap = await getDoc(tokenSaleRef);
    if (tokenSaleSnap.exists()) {
        await setDoc(tokenSaleRef, {
            walletAddress: walletAddress,
            status: 'WalletCreated'
        }, { merge: true });
    }

    // 2. Update User Profile
    const userRef = doc(db, 'users', emailLower);
    const updateData: any = {
        walletReady: true,
        walletAddress: walletAddress,
        status: 'WalletCreated', // Ensure status is synced
        updatedAt: new Date().toISOString()
    };
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    await setDoc(userRef, updateData, { merge: true });

    console.log(`[Firebase] Saved wallet address ${walletAddress} to users/${emailLower}`);

    // 3. Update Referrer's Contact List (Fallback)
    try {
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        if (userData && userData.referrerId) {
            const referrerId = userData.referrerId;
            const refContactRef = doc(db, 'users', referrerId, 'contacts', emailLower);
            await setDoc(refContactRef, {
                email: emailLower,
                internalName: emailLower.split('@')[0],
                address: walletAddress,
                vchainUserUid: emailLower,
                syncStatus: 'verified',
                phone: userData.phone || '',
                updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`[Contact Sync] Updated referrer ${referrerId}'s contact for ${emailLower}`);
        }

        // 3b. Reverse Sync: Find all users who have this user (by phone or email) in their contacts
        // and update their contact entries with the new wallet address
        const phone = userData?.phone;
        if (phone) {
            const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');
            // Query all users' contacts where phone matches
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);

            for (const userDoc of usersSnap.docs) {
                if (userDoc.id === emailLower) continue; // Skip self

                const contactsRef = collection(db, 'users', userDoc.id, 'contacts');
                const contactsSnap = await getDocs(contactsRef);

                for (const contactDoc of contactsSnap.docs) {
                    const contactData = contactDoc.data();
                    const contactPhone = (contactData.phone || '').replace(/[\s\-\(\)]/g, '');

                    // Match by phone or email/vchainUserUid
                    if (
                        (contactPhone && contactPhone === normalizedPhone) ||
                        contactData.email === emailLower ||
                        contactData.vchainUserUid === emailLower
                    ) {
                        // Update this contact with the new wallet address
                        await setDoc(contactDoc.ref, {
                            address: walletAddress,
                            vchainUserUid: emailLower,
                            syncStatus: 'verified',
                            updatedAt: new Date().toISOString()
                        }, { merge: true });
                        console.log(`[Contact Sync] Updated ${userDoc.id}'s contact for ${emailLower} with wallet ${walletAddress}`);
                    }
                }
            }
        }
    } catch (e) {
        console.warn("[Contact Sync] Failed to update contacts (likely permission issue):", e);
    }

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

        // Environment variable fallback when Firebase permissions fail
        const envKeyMap: Record<string, string | undefined> = {
            'deepseek': import.meta.env.VITE_DEEPSEEK_API_KEY,
            'gemini': import.meta.env.VITE_GEMINI_API_KEY,
            'openai': import.meta.env.VITE_OPENAI_API_KEY,
            'anthropic': import.meta.env.VITE_ANTHROPIC_API_KEY
        };

        const envKey = envKeyMap[provider];
        if (envKey) {
            console.log(`[Firebase] Using environment variable fallback for ${provider}`);
            return envKey;
        }

        return null;
    }
};

// Alias for backward compatibility if needed
export const getActiveApiKey = getActiveGlobalApiKey;

// Chatbot Settings
export interface BotConfig {
    systemPrompt: string;
    model: string;           // Text chat model (DeepSeek variants)
    visionModel?: string;    // Image analysis model (Gemini Nano Banana variants)
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
        systemRules: string;
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
                visionModel: 'gemini-2.0-flash-exp',
                temperature: 0.7,
                maxTokens: 2048
            },
            helpdeskBot: {
                systemPrompt: 'You are a helpful support agent for Vision Chain.',
                model: 'deepseek-chat',
                visionModel: 'gemini-2.0-flash-exp',
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
            intentBot: { systemPrompt: '', model: 'deepseek-chat', visionModel: 'gemini-2.0-flash-exp', temperature: 0.7, maxTokens: 2048 },
            helpdeskBot: { systemPrompt: '', model: 'deepseek-chat', visionModel: 'gemini-2.0-flash-exp', temperature: 0.7, maxTokens: 2048 },
            imageSettings: { model: 'imagen-3.0-generate-001', quality: 'standard', size: '1024x1024' },
            voiceSettings: { model: 'deepseek-chat', ttsVoice: 'Kore', sttModel: 'deepseek-chat' }
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

            // Record referral for current round (Referral Rush)
            await recordRoundReferral(referrer.email, email.toLowerCase());
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
    type: 'transfer_received' | 'transfer_scheduled' | 'system_announcement' | 'alert' | 'bridge_started' | 'bridge_completed';
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

// ============================================================================
// PROACTIVE AI ORCHESTRATOR
// ============================================================================

export interface AIModuleConfig {
    enabled: boolean;
    prompt: string;
    updateFrequency?: 'realtime' | 'daily' | 'weekly';
    triggerOn?: 'chat_start' | 'on_demand' | 'scheduled';
    maxItems?: number;
    priorityRules?: string[];
    style?: string;
    templateVars?: string[];
    updatedAt: string;
}

export interface ProactiveAISettings {
    masterEnabled: boolean;
    profileAnalyzer: AIModuleConfig;
    contextEngine: AIModuleConfig;
    actionGenerator: AIModuleConfig;
    greetingGenerator: AIModuleConfig;
    updatedAt: string;
    updatedBy?: string;
}

export interface UserAISummary {
    lastUpdated: string;
    preferredTopics: string[];
    frequentActions: string[];
    personalityType: string;
    lastConversationSummary: string;
    unansweredQuestions: string[];
    pendingTasksCount: number;
    lowBalanceWarning: boolean;
    totalConversations: number;
}

const DEFAULT_AI_SETTINGS: ProactiveAISettings = {
    masterEnabled: true,
    profileAnalyzer: {
        enabled: true,
        prompt: `Analyze the user's conversation history and behavior patterns. Extract:
- Frequently discussed topics
- Common actions performed
- Communication style preference
- Potential unmet needs
Return a JSON object with keys: preferredTopics, frequentActions, personalityType.`,
        updateFrequency: 'daily',
        updatedAt: new Date().toISOString()
    },
    contextEngine: {
        enabled: true,
        prompt: `Given the user's profile summary and current state, determine:
1. What is most relevant to them right now?
2. Are there any urgent matters to address?
3. What conversation would be most valuable?
Consider: pending transfers, low balance, recent activity, time of day.`,
        triggerOn: 'chat_start',
        updatedAt: new Date().toISOString()
    },
    actionGenerator: {
        enabled: true,
        prompt: `Generate personalized quick actions for the user based on their context.`,
        maxItems: 5,
        priorityRules: [
            'Pending time-lock transfers (highest priority)',
            'Low balance warnings (< 10 VCN)',
            'Unclaimed rewards (if available)',
            'User\'s most frequent action',
            'Continue previous conversation (if incomplete)'
        ],
        updatedAt: new Date().toISOString()
    },
    greetingGenerator: {
        enabled: true,
        prompt: `Generate a warm, personalized greeting for the user.
Use these variables: {name}, {time_of_day}, {pending_count}, {last_topic}, {balance}
Keep it under 50 words. Be friendly but professional.`,
        style: 'friendly_professional',
        templateVars: ['name', 'time_of_day', 'pending_count', 'last_topic', 'balance'],
        updatedAt: new Date().toISOString()
    },
    updatedAt: new Date().toISOString()
};

const DEFAULT_USER_AI_SUMMARY: UserAISummary = {
    lastUpdated: new Date().toISOString(),
    preferredTopics: [],
    frequentActions: [],
    personalityType: 'new_user',
    lastConversationSummary: '',
    unansweredQuestions: [],
    pendingTasksCount: 0,
    lowBalanceWarning: false,
    totalConversations: 0
};

// Get Proactive AI settings (admin)
export const getProactiveAISettings = async (): Promise<ProactiveAISettings> => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'admin', 'ai_orchestrator');
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { ...DEFAULT_AI_SETTINGS, ...snapshot.data() } as ProactiveAISettings;
        }
        // Initialize with defaults if not exists
        await setDoc(docRef, DEFAULT_AI_SETTINGS);
        return DEFAULT_AI_SETTINGS;
    } catch (e) {
        console.error('[ProactiveAI] Error fetching settings:', e);
        return DEFAULT_AI_SETTINGS;
    }
};

// Update Proactive AI settings (admin)
export const updateProactiveAISettings = async (settings: Partial<ProactiveAISettings>): Promise<void> => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'admin', 'ai_orchestrator');
        await setDoc(docRef, {
            ...settings,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('[ProactiveAI] Settings updated');
    } catch (e) {
        console.error('[ProactiveAI] Error updating settings:', e);
        throw e;
    }
};

// Get user AI summary (for quick loading on chat start)
export const getUserAISummary = async (userEmail: string): Promise<UserAISummary> => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'users', userEmail.toLowerCase(), 'ai_context', 'summary');
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { ...DEFAULT_USER_AI_SUMMARY, ...snapshot.data() } as UserAISummary;
        }
        return DEFAULT_USER_AI_SUMMARY;
    } catch (e) {
        console.error('[ProactiveAI] Error fetching user summary:', e);
        return DEFAULT_USER_AI_SUMMARY;
    }
};

// Update user AI summary (after analysis)
export const updateUserAISummary = async (userEmail: string, summary: Partial<UserAISummary>): Promise<void> => {
    try {
        const db = getFirebaseDb();
        const docRef = doc(db, 'users', userEmail.toLowerCase(), 'ai_context', 'summary');
        await setDoc(docRef, {
            ...summary,
            lastUpdated: new Date().toISOString()
        }, { merge: true });
        console.log(`[ProactiveAI] Updated AI summary for ${userEmail}`);
    } catch (e) {
        console.error('[ProactiveAI] Error updating user summary:', e);
        throw e;
    }
};

// Subscribe to AI settings changes (real-time)
export const subscribeToProactiveAISettings = (callback: (settings: ProactiveAISettings) => void) => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'admin', 'ai_orchestrator');
    return onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            callback({ ...DEFAULT_AI_SETTINGS, ...snapshot.data() } as ProactiveAISettings);
        } else {
            callback(DEFAULT_AI_SETTINGS);
        }
    });
};

// ==================== Global Announcements System ====================

export interface GlobalAnnouncement {
    id?: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'critical' | 'maintenance' | 'feature';
    priority: 'low' | 'normal' | 'high' | 'urgent';
    createdAt: any;
    updatedAt?: any;
    expiresAt?: any;
    isActive: boolean;
    createdBy: string;
    // Optional metadata
    actionUrl?: string;
    actionLabel?: string;
    imageUrl?: string;
}

// Get all active announcements
export const getGlobalAnnouncements = async (): Promise<GlobalAnnouncement[]> => {
    try {
        const db = getFirebaseDb();
        const announcementsRef = collection(db, 'global_announcements');
        const q = query(announcementsRef, where('isActive', '==', true), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GlobalAnnouncement));
    } catch (e) {
        console.error('[Announcements] Error fetching:', e);
        return [];
    }
};

// Subscribe to announcements (real-time)
export const subscribeToAnnouncements = (callback: (announcements: GlobalAnnouncement[]) => void) => {
    const db = getFirebaseDb();
    const announcementsRef = collection(db, 'global_announcements');
    // Only filter by isActive, sort on client to avoid composite index requirement
    const q = query(announcementsRef, where('isActive', '==', true));

    return onSnapshot(q, (snapshot) => {
        const announcements = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GlobalAnnouncement));
        // Sort by createdAt descending on client
        announcements.sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bTime.getTime() - aTime.getTime();
        });
        callback(announcements);
    }, (error) => {
        console.error('[Announcements] Subscribe error:', error);
        callback([]);
    });
};


// Create a new announcement (Admin only)
export const createAnnouncement = async (announcement: Omit<GlobalAnnouncement, 'id' | 'createdAt'>): Promise<string | null> => {
    try {
        const db = getFirebaseDb();
        const docRef = await addDoc(collection(db, 'global_announcements'), {
            ...announcement,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('[Announcements] Created:', docRef.id);
        return docRef.id;
    } catch (e) {
        console.error('[Announcements] Error creating:', e);
        return null;
    }
};

// Update an announcement (Admin only)
export const updateAnnouncement = async (id: string, data: Partial<GlobalAnnouncement>): Promise<boolean> => {
    try {
        const db = getFirebaseDb();
        await updateDoc(doc(db, 'global_announcements', id), {
            ...data,
            updatedAt: serverTimestamp()
        });
        console.log('[Announcements] Updated:', id);
        return true;
    } catch (e) {
        console.error('[Announcements] Error updating:', e);
        return false;
    }
};

// Delete an announcement (Admin only)
export const deleteAnnouncement = async (id: string): Promise<boolean> => {
    try {
        const db = getFirebaseDb();
        await deleteDoc(doc(db, 'global_announcements', id));
        console.log('[Announcements] Deleted:', id);
        return true;
    } catch (e) {
        console.error('[Announcements] Error deleting:', e);
        return false;
    }
};

// Get all announcements for admin (including inactive)
export const getAllAnnouncementsAdmin = async (): Promise<GlobalAnnouncement[]> => {
    try {
        const db = getFirebaseDb();
        const announcementsRef = collection(db, 'global_announcements');
        const q = query(announcementsRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GlobalAnnouncement));
    } catch (e) {
        console.error('[Announcements] Error fetching all:', e);
        return [];
    }
};

// Mark announcement as read by user
export const markAnnouncementRead = async (userEmail: string, announcementId: string): Promise<void> => {
    try {
        const db = getFirebaseDb();
        await setDoc(
            doc(db, 'users', userEmail.toLowerCase(), 'read_announcements', announcementId),
            { readAt: serverTimestamp() }
        );
    } catch (e) {
        console.error('[Announcements] Error marking read:', e);
    }
};

// Get user's read announcement IDs
export const getReadAnnouncementIds = async (userEmail: string): Promise<string[]> => {
    try {
        const db = getFirebaseDb();
        const readRef = collection(db, 'users', userEmail.toLowerCase(), 'read_announcements');
        const snapshot = await getDocs(readRef);
        return snapshot.docs.map(doc => doc.id);
    } catch (e) {
        console.error('[Announcements] Error getting read IDs:', e);
        return [];
    }
};

// Subscribe to user's read announcements (real-time)
export const subscribeToReadAnnouncements = (userEmail: string, callback: (ids: string[]) => void) => {
    const db = getFirebaseDb();
    const readRef = collection(db, 'users', userEmail.toLowerCase(), 'read_announcements');

    return onSnapshot(query(readRef), (snapshot) => {
        callback(snapshot.docs.map(doc => doc.id));
    }, (error) => {
        console.error('[Announcements] Subscribe read error:', error);
        callback([]);
    });
};
