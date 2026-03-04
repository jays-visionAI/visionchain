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

    return null;
}
