/**
 * User Memory Service
 * 
 * Stores and retrieves per-user personalization data for the AI chat:
 * - Preferred name (how the user wants to be called)
 * - Investment preferences and style
 * - Frequently asked topics
 * - Custom notes from conversations
 * 
 * Data is stored in Firestore under users/{uid}/ai_memory/profile
 * and automatically injected into AI prompts.
 */

import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from '../firebaseService';

const db = getFirestore(getFirebaseApp());

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserMemory {
    preferredName: string | null;       // "재석님", "Jay", etc.
    investmentStyle: string | null;     // "conservative", "aggressive", "swing trader"
    interests: string[];                // ["bitcoin", "defi", "nft"]
    favoriteCoins: string[];            // ["btc", "eth", "sol"]
    riskTolerance: string | null;       // "low", "medium", "high"
    language: string | null;            // Detected/confirmed language preference
    notes: string[];                    // AI-generated conversation notes (max 20)
    lastInteraction: string | null;
    interactionCount: number;
    createdAt: string;
    updatedAt: string;
}

const DEFAULT_MEMORY: UserMemory = {
    preferredName: null,
    investmentStyle: null,
    interests: [],
    favoriteCoins: [],
    riskTolerance: null,
    language: null,
    notes: [],
    lastInteraction: null,
    interactionCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
};

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

const memoryCache: Map<string, { data: UserMemory; fetchedAt: number }> = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Get user memory, with in-memory caching.
 */
export async function getUserMemory(userEmail: string): Promise<UserMemory> {
    if (!userEmail) return { ...DEFAULT_MEMORY };

    // Check cache
    const cached = memoryCache.get(userEmail);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.data;
    }

    try {
        const docRef = doc(db, 'users', userEmail, 'ai_memory', 'profile');
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
            const data = { ...DEFAULT_MEMORY, ...snapshot.data() } as UserMemory;
            memoryCache.set(userEmail, { data, fetchedAt: Date.now() });
            return data;
        }

        // First time - create default
        await setDoc(docRef, DEFAULT_MEMORY);
        memoryCache.set(userEmail, { data: { ...DEFAULT_MEMORY }, fetchedAt: Date.now() });
        return { ...DEFAULT_MEMORY };
    } catch (err) {
        console.error('[UserMemory] Failed to get:', err);
        return { ...DEFAULT_MEMORY };
    }
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * Update specific fields in user memory.
 */
export async function updateUserMemory(
    userEmail: string,
    updates: Partial<Pick<UserMemory, 'preferredName' | 'investmentStyle' | 'riskTolerance' | 'language'>>
): Promise<void> {
    if (!userEmail) return;

    try {
        const docRef = doc(db, 'users', userEmail, 'ai_memory', 'profile');
        await setDoc(docRef, {
            ...updates,
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        // Update cache
        const cached = memoryCache.get(userEmail);
        if (cached) {
            cached.data = { ...cached.data, ...updates, updatedAt: new Date().toISOString() };
        }
    } catch (err) {
        console.error('[UserMemory] Failed to update:', err);
    }
}

/**
 * Add an interest or favorite coin.
 */
export async function addUserInterest(userEmail: string, interest: string): Promise<void> {
    if (!userEmail || !interest) return;

    try {
        const docRef = doc(db, 'users', userEmail, 'ai_memory', 'profile');
        await updateDoc(docRef, {
            interests: arrayUnion(interest.toLowerCase()),
            updatedAt: new Date().toISOString(),
        });

        // Update cache
        const cached = memoryCache.get(userEmail);
        if (cached && !cached.data.interests.includes(interest.toLowerCase())) {
            cached.data.interests.push(interest.toLowerCase());
        }
    } catch (err) {
        console.error('[UserMemory] Failed to add interest:', err);
    }
}

/**
 * Add a conversation note (max 20, FIFO).
 */
export async function addConversationNote(userEmail: string, note: string): Promise<void> {
    if (!userEmail || !note) return;

    try {
        const memory = await getUserMemory(userEmail);
        const notes = [...memory.notes, note].slice(-20); // Keep latest 20

        const docRef = doc(db, 'users', userEmail, 'ai_memory', 'profile');
        await setDoc(docRef, {
            notes,
            interactionCount: (memory.interactionCount || 0) + 1,
            lastInteraction: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });

        // Update cache
        const cached = memoryCache.get(userEmail);
        if (cached) {
            cached.data.notes = notes;
            cached.data.interactionCount = (memory.interactionCount || 0) + 1;
            cached.data.lastInteraction = new Date().toISOString();
        }
    } catch (err) {
        console.error('[UserMemory] Failed to add note:', err);
    }
}

/**
 * Record user's interaction (increment count, update timestamp).
 */
export async function recordInteraction(userEmail: string): Promise<void> {
    if (!userEmail) return;

    try {
        const memory = await getUserMemory(userEmail);
        const docRef = doc(db, 'users', userEmail, 'ai_memory', 'profile');
        await setDoc(docRef, {
            interactionCount: (memory.interactionCount || 0) + 1,
            lastInteraction: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { merge: true });
    } catch (err) {
        console.debug('[UserMemory] Failed to record interaction:', err);
    }
}

// ─── AI Context Generation ───────────────────────────────────────────────────

/**
 * Generate the [USER MEMORY] context block for AI prompt injection.
 */
export function generateUserMemoryContext(memory: UserMemory): string {
    if (!memory.preferredName && memory.interests.length === 0 && memory.notes.length === 0) {
        // No memory yet - prompt AI to ask for name
        return '\n\n[USER MEMORY]\nThis is a new user. No personalization data yet.\nOn your FIRST interaction, politely ask their preferred name.\n';
    }

    let context = '\n\n[USER MEMORY]\n';

    if (memory.preferredName) {
        context += `Preferred Name: ${memory.preferredName} (ALWAYS use this name to address the user)\n`;
    }

    if (memory.investmentStyle) {
        context += `Investment Style: ${memory.investmentStyle}\n`;
    }

    if (memory.riskTolerance) {
        context += `Risk Tolerance: ${memory.riskTolerance}\n`;
    }

    if (memory.interests.length > 0) {
        context += `Interests: ${memory.interests.join(', ')}\n`;
    }

    if (memory.favoriteCoins.length > 0) {
        context += `Favorite Coins: ${memory.favoriteCoins.join(', ')}\n`;
    }

    if (memory.notes.length > 0) {
        // Only include last 5 notes for context window efficiency
        const recentNotes = memory.notes.slice(-5);
        context += `Recent Conversation Notes:\n`;
        recentNotes.forEach(n => { context += `  - ${n}\n`; });
    }

    if (memory.interactionCount > 0) {
        context += `Interaction Count: ${memory.interactionCount} (returning user)\n`;
    }

    return context;
}

// ─── AI Response Parsing ─────────────────────────────────────────────────────

/**
 * Parse AI response for memory-worthy information.
 * Call this after each AI response to extract and store learnings.
 */
export async function extractAndStoreMemory(
    userEmail: string,
    userMessage: string,
    aiResponse: string
): Promise<void> {
    if (!userEmail) return;

    try {
        const lowerMsg = userMessage.toLowerCase();
        const memory = await getUserMemory(userEmail);

        // Detect name introduction
        const namePatterns = [
            /(?:제?\s?이름은|나는|저는|call me|my name is|i'm|i am)\s+([가-힣]{2,4}|[A-Za-z]+)/i,
            /([가-힣]{2,4}|[A-Za-z]+)(?:이라고|라고)\s+(?:불러|해)/i,
        ];

        for (const pattern of namePatterns) {
            const match = userMessage.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim();
                // Avoid storing common words as names
                const skipWords = ['비트코인', 'bitcoin', '이더리움', '가격', 'vcn', 'price'];
                if (!skipWords.includes(name.toLowerCase()) && name.length >= 2) {
                    await updateUserMemory(userEmail, { preferredName: name });
                    console.log(`[UserMemory] Stored name: ${name}`);
                    break;
                }
            }
        }

        // Detect coin interests from repeated mentions
        const coinMentions: Record<string, string[]> = {
            'bitcoin': ['비트코인', 'btc', 'bitcoin'],
            'ethereum': ['이더리움', 'eth', 'ethereum'],
            'solana': ['솔라나', 'sol', 'solana'],
            'xrp': ['리플', 'xrp', 'ripple'],
        };

        for (const [coin, aliases] of Object.entries(coinMentions)) {
            if (aliases.some(a => lowerMsg.includes(a)) && !memory.favoriteCoins.includes(coin)) {
                // Only add after multiple mentions (check interaction count)
                if (memory.interactionCount > 3) {
                    await addUserInterest(userEmail, coin);
                }
            }
        }

        // Record interaction
        await recordInteraction(userEmail);
    } catch (err) {
        console.debug('[UserMemory] Extract failed (non-critical):', err);
    }
}
