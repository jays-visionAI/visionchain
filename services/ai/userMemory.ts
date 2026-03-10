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

    if (memory.language) {
        context += `CONFIRMED_RESPONSE_LANGUAGE: ${memory.language} (This is the user's confirmed language preference from past conversations. ALWAYS respond in this language. This overrides browser locale.)\n`;
    }

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
/**
 * Detect the primary language of a user message.
 * Returns ISO code: 'ko', 'en', 'ja', 'zh', etc. or null if ambiguous.
 */
function detectMessageLanguage(text: string): string | null {
    const clean = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
    if (clean.length < 2) return null;

    const koreanChars = (clean.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
    const japaneseChars = (clean.match(/[\u3040-\u309F\u30A0-\u30FF]/g) || []).length;
    const chineseChars = (clean.match(/[\u4E00-\u9FFF]/g) || []).length;
    const latinChars = (clean.match(/[a-zA-Z]/g) || []).length;
    const total = clean.length;

    if (total === 0) return null;

    // Require at least 30% of characters to be in a script to detect it
    if (koreanChars / total > 0.3) return 'ko';
    if (japaneseChars / total > 0.3) return 'ja';
    if (chineseChars / total > 0.3) return 'zh';
    if (latinChars / total > 0.5) return 'en';

    return null;
}

export async function extractAndStoreMemory(
    userEmail: string,
    userMessage: string,
    aiResponse: string
): Promise<void> {
    if (!userEmail) return;

    try {
        const lowerMsg = userMessage.toLowerCase();
        const memory = await getUserMemory(userEmail);

        // Detect and store language preference
        const detectedLang = detectMessageLanguage(userMessage);
        if (detectedLang && detectedLang !== memory.language) {
            // Only update language on 2+ consistent detections a row
            // We track via a convention: store detected lang immediately
            // The system prompt handles the "ask before switching" logic
            // But we DO store the detected language to help future prompts
            const browserLocale = typeof navigator !== 'undefined' ? navigator.language?.substring(0, 2) : 'en';

            if (!memory.language) {
                // First time: set to browser locale or detected language
                const langToSet = detectedLang === browserLocale ? detectedLang : browserLocale;
                await updateUserMemory(userEmail, { language: langToSet });
                console.log(`[UserMemory] Initial language set: ${langToSet}`);
            } else if (detectedLang !== memory.language) {
                // Language mismatch: check if user explicitly requested a switch
                const switchPatterns = [
                    /(?:please|plz)?\s*(?:reply|respond|answer|speak|talk)\s+(?:in|to me in)\s+(english|korean|japanese|chinese|한국어|영어|일본어|중국어)/i,
                    /(영어|한국어|일본어|중국어|english|korean|japanese|chinese)로\s*(?:대답|답변|말|응답)/i,
                ];
                const isExplicitSwitch = switchPatterns.some(p => p.test(userMessage));

                if (isExplicitSwitch) {
                    await updateUserMemory(userEmail, { language: detectedLang });
                    console.log(`[UserMemory] Language switched explicitly: ${memory.language} -> ${detectedLang}`);
                }
                // If not explicit, the system prompt's "ask before switching" logic handles it
            }
        }

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
