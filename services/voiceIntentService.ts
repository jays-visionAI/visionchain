/**
 * voiceIntentService.ts
 *
 * 1. normalizeBlockchainTerms() — phonetic post-processing layer
 *    Corrects common Korean/Japanese pronunciations of crypto terms
 *    that Web Speech API (or even Gemini) might transcribe phonetically.
 *
 * 2. buildBlockchainGrammar() — SpeechGrammarList helper
 *    Hints the browser's speech engine about known blockchain vocabulary.
 *
 * 3. parseVoiceIntent() — NLP intent parser
 *    Extracts { action, amount, token, recipient } from natural language.
 *
 * Examples:
 *   "박지현에게 10 VCN 보내줘" → { action: 'send', amount: '10', token: 'VCN', recipient: '박지현' }
 *   "Send 10 VCN to 박지현"   → { action: 'send', amount: '10', token: 'VCN', recipient: '박지현' }
 *   "스테이킹 100 VCN"         → { action: 'stake', amount: '100', token: 'VCN' }
 */

export type VoiceAction = 'send' | 'stake' | 'unstake' | 'swap' | 'bridge' | 'unknown';

export interface VoiceIntent {
    action: VoiceAction;
    amount: string | null;
    token: string;           // default 'VCN'
    recipient: string | null; // name or address
    rawText: string;
    confidence: number;       // 0–1
}

// ── Phonetic normalization map ───────────────────────────────────────────────
// Maps Korean/Japanese phonetic spellings → correct English crypto term
// This acts as a post-processing layer AFTER speech-to-text
const PHONETIC_CORRECTIONS: [RegExp, string][] = [
    // ── VCN ──
    [/비씨엔/g, 'VCN'],
    [/브이씨엔/g, 'VCN'],
    [/브씨엔/g, 'VCN'],
    [/ビーシーエヌ/g, 'VCN'],
    // ── ETH / Ethereum ──
    [/이더리움/g, 'Ethereum'],
    [/이더(?!리움)/g, 'ETH'],             // "이더" alone → ETH, not if followed by 리움
    [/イーサリアム/g, 'Ethereum'],
    [/イーサ(?!リアム)/g, 'ETH'],
    // ── Bitcoin / BTC ──
    [/비트코인/g, 'Bitcoin'],
    [/비트/g, 'BTC'],
    [/ビットコイン/g, 'Bitcoin'],
    [/ビット(?!コイン)/g, 'BTC'],
    // ── Solana / SOL ──
    [/솔라나/g, 'Solana'],
    [/솔/g, 'SOL'],
    [/ソラナ/g, 'Solana'],
    // ── USDT / Tether ──
    [/테더/g, 'USDT'],
    [/테더코인/g, 'USDT'],
    [/テザー/g, 'USDT'],
    // ── BNB ──
    [/비앤비/g, 'BNB'],
    [/바이낸스코인/g, 'BNB'],
    [/バイナンスコイン/g, 'BNB'],
    // ── XRP ──
    [/엑스알피/g, 'XRP'],
    [/리플/g, 'XRP'],
    [/リップル/g, 'XRP'],
    // ── MATIC / Polygon ──
    [/매틱/g, 'MATIC'],
    [/폴리곤/g, 'MATIC'],
    [/ポリゴン/g, 'MATIC'],
    // ── AVAX / Avalanche ──
    [/아발란체/g, 'AVAX'],
    [/アバランチ/g, 'AVAX'],
    // ── Action words — keep in Korean but normalize common typos ──
    [/스테이킹/g, '스테이킹'],    // already correct, keep
    [/언스테이킹/g, '언스테이킹'],
    [/브릿지/g, '브릿지'],
    [/스왑/g, '스왑'],
];

/**
 * Apply phonetic corrections to a raw speech transcript.
 * Run this BEFORE parseVoiceIntent() when using Web Speech API (fallback mode).
 * When using Gemini transcription, this acts as a secondary safety net.
 */
export function normalizeBlockchainTerms(text: string): string {
    let result = text;
    for (const [pattern, replacement] of PHONETIC_CORRECTIONS) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

/**
 * Build a SpeechGrammarList with known blockchain vocabulary.
 * Assign to recognition.grammars to boost recognition confidence for these terms.
 * Only has effect in Chrome / Chromium-based browsers.
 */
export function buildBlockchainGrammar(): any | null {
    const SpeechGrammarList = (window as any).SpeechGrammarList || (window as any).webkitSpeechGrammarList;
    if (!SpeechGrammarList) return null;

    const tokens = [
        'VCN', 'ETH', 'BTC', 'USDT', 'SOL', 'BNB', 'XRP', 'MATIC', 'AVAX', 'LINK', 'DOT', 'ADA',
        'Ethereum', 'Bitcoin', 'Solana', 'Tether', 'Polygon', 'Avalanche',
        'staking', 'unstaking', 'bridge', 'swap', 'send', 'transfer',
        '보내', '전송', '송금', '스테이킹', '언스테이킹', '브릿지', '스왑'
    ];

    // JSGF (Java Speech Grammar Format) — the format browsers accept
    const grammar = `#JSGF V1.0; grammar blockchain; public <token> = ${tokens.join(' | ')} ;`;
    const list = new SpeechGrammarList();
    list.addFromString(grammar, 1); // weight = 1 (highest priority)
    return list;
}

const TOKEN_ALIASES: Record<string, string> = {
    'vcn': 'VCN',
    'vision': 'VCN',
    'eth': 'ETH',
    'ethereum': 'ETH',
    'usdt': 'USDT',
    'tether': 'USDT',
    'btc': 'BTC',
    'bitcoin': 'BTC',
};

// ── Action keywords (Korean + English) ───────────────────────────────────────
const ACTION_PATTERNS: { action: VoiceAction; patterns: RegExp[] }[] = [
    {
        action: 'send',
        patterns: [
            /보내/i,           // 보내줘, 보내
            /전송/i,           // 전송해줘
            /송금/i,           // 송금해
            /\bsend\b/i,
            /\btransfer\b/i,
        ]
    },
    {
        action: 'stake',
        patterns: [
            /스테이킹/i,
            /스테이크/i,
            /\bstake\b/i,
        ]
    },
    {
        action: 'unstake',
        patterns: [
            /언스테이킹/i,
            /언스테이크/i,
            /\bunstake\b/i,
        ]
    },
    {
        action: 'swap',
        patterns: [
            /교환/i,
            /스왑/i,
            /\bswap\b/i,
            /\bexchange\b/i,
        ]
    },
    {
        action: 'bridge',
        patterns: [
            /브릿지/i,
            /브리지/i,
            /\bbridge\b/i,
        ]
    },
];

// ── Amount extractor ──────────────────────────────────────────────────────────
// Matches: "10", "10.5", "1,000", "10만", "1천"
const KOREAN_UNITS: Record<string, number> = {
    '만': 10000,
    '천': 1000,
    '백': 100,
    '억': 100000000,
};

function extractAmount(text: string): string | null {
    // Korean unit numbers: e.g. "10만 VCN" → 100000
    for (const [unit, multiplier] of Object.entries(KOREAN_UNITS)) {
        const match = text.match(new RegExp(`([\\d,\\.]+)\\s*${unit}`, 'i'));
        if (match) {
            const num = parseFloat(match[1].replace(/,/g, ''));
            return String(num * multiplier);
        }
    }
    // Standard number (possibly with comma separators)
    const match = text.match(/([\d,]+\.?\d*)/);
    if (match) {
        return match[1].replace(/,/g, '');
    }
    return null;
}

// ── Token extractor ───────────────────────────────────────────────────────────
function extractToken(text: string): string {
    const lower = text.toLowerCase();
    for (const [alias, canonical] of Object.entries(TOKEN_ALIASES)) {
        // Look for word-boundary match
        const re = new RegExp(`\\b${alias}\\b`, 'i');
        if (re.test(lower)) return canonical;
    }
    return 'VCN'; // default
}

// ── Recipient extractor ───────────────────────────────────────────────────────
// Strips action words & amounts to get the recipient name/address
function extractRecipient(text: string, amount: string | null, token: string): string | null {
    let cleaned = text;

    // Phase 1: Strip Korean postpositions/particles attached to names (no space between)
    // These attach directly: 박지현에게 → 박지현, 박지현한테 → 박지현
    const koreanSuffixes = ['에게서', '에게로', '에게', '한테서', '한테', '으로', '로', '을', '를', '이', '가', '의'];
    for (const suffix of koreanSuffixes) {
        cleaned = cleaned.replace(new RegExp(suffix, 'g'), ' ');
    }

    // Phase 2: Remove Korean action words (standalone)
    const koreanActions = ['보내줘', '보내', '전송해줘', '전송해', '전송', '송금해줘', '송금해', '송금',
        '줘', '해줘', '주세요', '보내주세요', '전송하다'];
    for (const w of koreanActions) {
        cleaned = cleaned.replace(new RegExp(w, 'g'), ' ');
    }

    // Phase 3: Remove English action words (word boundary works for English)
    const englishActions = ['send', 'transfer', 'to', 'for', 'stake', 'bridge', 'swap'];
    for (const w of englishActions) {
        cleaned = cleaned.replace(new RegExp(`\\b${w}\\b`, 'gi'), ' ');
    }

    // Remove amount
    if (amount) {
        cleaned = cleaned.replace(new RegExp(amount.replace(/\./g, '\\.'), 'g'), ' ');
    }

    // Remove token name
    cleaned = cleaned.replace(new RegExp(`\\b${token}\\b`, 'gi'), ' ');
    cleaned = cleaned.replace(/VCN|ETH|BTC|USDT/gi, ' ');

    // Remove punctuation / Korean particles that aren't names
    cleaned = cleaned.replace(/[。、,\.!?]/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // If it looks like an ethereum address, return directly
    if (/^0x[0-9a-fA-F]{40}$/.test(cleaned.trim())) {
        return cleaned.trim();
    }

    return cleaned.trim() || null;
}

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseVoiceIntent(rawText: string): VoiceIntent {
    const text = rawText.trim();

    // Detect action
    let action: VoiceAction = 'unknown';
    let confidence = 0;

    for (const { action: a, patterns } of ACTION_PATTERNS) {
        for (const re of patterns) {
            if (re.test(text)) {
                action = a;
                confidence = 0.8;
                break;
            }
        }
        if (action !== 'unknown') break;
    }

    const token = extractToken(text);
    const amount = extractAmount(text);

    let recipient: string | null = null;
    if (action === 'send') {
        recipient = extractRecipient(text, amount, token);
        // Boost confidence if we have all three
        if (recipient && amount) confidence = 0.95;
        else if (amount) confidence = 0.7;
    }

    return { action, amount, token, recipient, rawText: text, confidence };
}

// ── Contact resolver ──────────────────────────────────────────────────────────
export interface Contact {
    internalName: string;
    alias?: string;
    address: string;
}

/**
 * Given a parsed intent and a contact list, try to resolve recipient name -> address.
 * Returns the address if found, or null.
 */
export function resolveIntentRecipient(intent: VoiceIntent, contacts: Contact[]): string | null {
    if (!intent.recipient) return null;

    // If it's already an address
    if (/^0x[0-9a-fA-F]{40}$/.test(intent.recipient)) return intent.recipient;

    const needle = intent.recipient.toLowerCase().trim();

    // Phase 1: Exact match
    const exactMatch = contacts.find(c =>
        c.internalName?.toLowerCase() === needle ||
        c.alias?.toLowerCase() === needle
    );
    if (exactMatch?.address) return exactMatch.address;

    // Phase 2: Bidirectional partial match (contact name in query, or query in contact name)
    const partialMatch = contacts.find(c => {
        const name = c.internalName?.toLowerCase() || '';
        const alias = c.alias?.toLowerCase() || '';
        return (
            name.includes(needle) || needle.includes(name) ||
            (alias && (alias.includes(needle) || needle.includes(alias)))
        );
    });
    if (partialMatch?.address) return partialMatch.address;

    // Phase 3: Cross-language phonetic matching
    // Romanizes Korean voice input and compares with English contact names
    let bestPhoneticMatch: Contact | null = null;
    let bestPhoneticScore = 0;
    for (const c of contacts) {
        const nameSim = crossLanguagePhoneticSimilarity(intent.recipient, c.internalName || '');
        const aliasSim = c.alias ? crossLanguagePhoneticSimilarity(intent.recipient, c.alias) : 0;
        const best = Math.max(nameSim, aliasSim);
        if (best > bestPhoneticScore) {
            bestPhoneticScore = best;
            bestPhoneticMatch = c;
        }
    }
    // Only auto-resolve if a single high-confidence phonetic match is found
    // Lower-confidence matches will be shown as fuzzy candidates in the UI
    if (bestPhoneticMatch && bestPhoneticScore >= 0.6) {
        // Check if there are other contacts with similar scores (potential ambiguity)
        const closeMatches = contacts.filter(c => {
            const nameSim = crossLanguagePhoneticSimilarity(intent.recipient!, c.internalName || '');
            const aliasSim = c.alias ? crossLanguagePhoneticSimilarity(intent.recipient!, c.alias) : 0;
            return Math.max(nameSim, aliasSim) >= bestPhoneticScore - 0.1;
        });
        // Only auto-resolve if there's exactly one clear winner
        if (closeMatches.length === 1 && bestPhoneticScore >= 0.7) {
            return bestPhoneticMatch.address;
        }
    }

    return null;
}

// ── Korean Jamo Decomposition (자모 분리) ──────────────────────────────────────
// Decomposes Hangul syllables into constituent jamo (consonants + vowels)
// e.g. '박' → 'ㅂㅏㄱ', '지' → 'ㅈㅣ', '현' → 'ㅎㅕㄴ'
const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

function decomposeKorean(text: string): string {
    let result = '';
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        // Hangul syllable range: 0xAC00 ~ 0xD7A3
        if (code >= 0xAC00 && code <= 0xD7A3) {
            const offset = code - 0xAC00;
            const cho = Math.floor(offset / (21 * 28));
            const jung = Math.floor((offset % (21 * 28)) / 28);
            const jong = offset % 28;
            result += CHO[cho] + JUNG[jung] + JONG[jong];
        } else {
            result += ch.toLowerCase();
        }
    }
    return result;
}

/**
 * Calculate similarity between two strings using jamo decomposition.
 * Returns 0~1 (1 = identical).
 */
function jamoSimilarity(a: string, b: string): number {
    const ja = decomposeKorean(a);
    const jb = decomposeKorean(b);
    if (ja === jb) return 1;
    if (!ja || !jb) return 0;

    // Levenshtein distance on jamo sequences
    const m = ja.length, n = jb.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = ja[i - 1] === jb[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return 1 - dp[m][n] / Math.max(m, n);
}

// ── Cross-Language Phonetic Matching (한국어 ↔ English) ──────────────────────
// Romanizes Korean jamo into approximate English phonetics for cross-language
// name matching. e.g. "징크" → "jingk" ≈ "zynk"

// Initial consonant (초성) → romanized English sound
const CHO_ROMAN: Record<string, string> = {
    'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'tt',
    'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'pp', 'ㅅ': 's',
    'ㅆ': 'ss', 'ㅇ': '', 'ㅈ': 'j', 'ㅉ': 'jj', 'ㅊ': 'ch',
    'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
};

// Vowel (중성) → romanized English sound
const JUNG_ROMAN: Record<string, string> = {
    'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'eo',
    'ㅔ': 'e', 'ㅕ': 'yeo', 'ㅖ': 'ye', 'ㅗ': 'o', 'ㅘ': 'wa',
    'ㅙ': 'wae', 'ㅚ': 'oe', 'ㅛ': 'yo', 'ㅜ': 'u', 'ㅝ': 'wo',
    'ㅞ': 'we', 'ㅟ': 'wi', 'ㅠ': 'yu', 'ㅡ': 'eu', 'ㅢ': 'ui',
    'ㅣ': 'i',
};

// Final consonant (종성) → romanized English sound
const JONG_ROMAN: Record<string, string> = {
    '': '', 'ㄱ': 'k', 'ㄲ': 'k', 'ㄳ': 'ks', 'ㄴ': 'n',
    'ㄵ': 'nj', 'ㄶ': 'n', 'ㄷ': 't', 'ㄹ': 'l', 'ㄺ': 'lk',
    'ㄻ': 'lm', 'ㄼ': 'lb', 'ㄽ': 'ls', 'ㄾ': 'lt', 'ㄿ': 'lp',
    'ㅀ': 'l', 'ㅁ': 'm', 'ㅂ': 'p', 'ㅄ': 'ps', 'ㅅ': 't',
    'ㅆ': 't', 'ㅇ': 'ng', 'ㅈ': 't', 'ㅊ': 't', 'ㅋ': 'k',
    'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
};

/**
 * Convert Korean text to romanized phonetic form.
 * e.g. "징크" → "jingk", "박지현" → "bakjihyeon"
 */
function koreanToRomanized(text: string): string {
    let result = '';
    for (const ch of text) {
        const code = ch.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            const offset = code - 0xAC00;
            const cho = Math.floor(offset / (21 * 28));
            const jung = Math.floor((offset % (21 * 28)) / 28);
            const jong = offset % 28;
            result += (CHO_ROMAN[CHO[cho]] || '') + (JUNG_ROMAN[JUNG[jung]] || '') + (JONG_ROMAN[JONG[jong]] || '');
        } else {
            result += ch.toLowerCase();
        }
    }
    return result;
}

/**
 * Normalize an English string to a simplified phonetic key.
 * Strips common silent patterns and simplifies phonemes for better
 * cross-language comparison.
 * e.g. "ZYNK" → "zink", "phone" → "fone"
 */
function englishPhoneticNormalize(text: string): string {
    let s = text.toLowerCase().trim();
    // Simplify common English phoneme patterns
    s = s.replace(/ph/g, 'f');
    s = s.replace(/ck/g, 'k');
    s = s.replace(/gh/g, '');       // silent gh (e.g. "knight")
    s = s.replace(/wr/g, 'r');      // wr → r
    s = s.replace(/kn/g, 'n');      // kn → n
    s = s.replace(/wh/g, 'w');      // wh → w
    s = s.replace(/th/g, 't');      // approximation for cross-lang
    s = s.replace(/sh/g, 's');      // approximation
    s = s.replace(/ch/g, 'ch');     // keep ch
    // Map y → i when used as a vowel (between/after consonants)
    s = s.replace(/([bcdfghjklmnpqrstvwxz])y([bcdfghjklmnpqrstvwxz]|$)/g, '$1i$2');
    // Remove doubled consonants
    s = s.replace(/([bcdfghjklmnpqrstvwxz])\1/g, '$1');
    // Remove trailing silent e
    s = s.replace(/([bcdfghjklmnpqrstvwxz])e$/, '$1');
    return s;
}

/**
 * Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

/**
 * Check if a string contains any Hangul characters.
 */
function containsKorean(text: string): boolean {
    return /[\uAC00-\uD7A3\u3131-\u3163]/.test(text);
}

/**
 * Cross-language phonetic similarity.
 * Converts Korean to romanized form and English to a phonetic key,
 * then compares using Levenshtein distance.
 * Returns 0~1 (1 = identical phonetics).
 */
function crossLanguagePhoneticSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;

    // Romanize each side depending on language
    const phoneticA = containsKorean(a) ? koreanToRomanized(a) : englishPhoneticNormalize(a);
    const phoneticB = containsKorean(b) ? koreanToRomanized(b) : englishPhoneticNormalize(b);

    if (phoneticA === phoneticB) return 1;
    if (!phoneticA || !phoneticB) return 0;

    const dist = levenshteinDistance(phoneticA, phoneticB);
    const maxLen = Math.max(phoneticA.length, phoneticB.length);
    return 1 - dist / maxLen;
}

// ── Fuzzy Contact Matching ────────────────────────────────────────────────────
export interface FuzzyContactMatch {
    name: string;
    alias?: string;
    address: string;
    similarity: number; // 0~1
}

/**
 * Find contacts with names similar to the query using both Korean jamo
 * decomposition AND cross-language phonetic matching.
 * Returns candidates sorted by similarity (highest first), filtered by threshold.
 * Handles Korean↔Korean (jamo) and Korean↔English (romanization) comparisons.
 */
export function findFuzzyContactMatches(
    query: string,
    contacts: Contact[],
    threshold: number = 0.45
): FuzzyContactMatch[] {
    if (!query || contacts.length === 0) return [];
    const q = query.trim();

    const results: FuzzyContactMatch[] = [];

    for (const c of contacts) {
        const name = c.internalName || '';
        const alias = c.alias || '';

        // Method 1: Korean jamo similarity (best for Korean↔Korean)
        const jamoNameSim = jamoSimilarity(q, name);
        const jamoAliasSim = alias ? jamoSimilarity(q, alias) : 0;

        // Method 2: Cross-language phonetic similarity (best for Korean↔English)
        const phoneticNameSim = crossLanguagePhoneticSimilarity(q, name);
        const phoneticAliasSim = alias ? crossLanguagePhoneticSimilarity(q, alias) : 0;

        // Take the best score from all methods
        const bestSim = Math.max(jamoNameSim, jamoAliasSim, phoneticNameSim, phoneticAliasSim);

        if (bestSim >= threshold) {
            results.push({
                name: name,
                alias: alias || undefined,
                address: c.address,
                similarity: bestSim,
            });
        }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);
    return results;
}
