/**
 * voiceIntentService.ts
 *
 * Parses natural language voice commands into structured transaction intents.
 * Supports Korean and English.
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

// ── Token aliases ────────────────────────────────────────────────────────────
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

    // Remove action keywords
    const actionWords = ['보내줘', '보내', '전송해줘', '전송해', '전송', '송금해', '송금', '에게', '한테',
        'send', 'transfer', 'to', 'for', 'stake', 'bridge', 'swap'];
    for (const w of actionWords) {
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
 * Given a parsed intent and a contact list, try to resolve recipient name → address.
 * Returns the address if found, or null.
 */
export function resolveIntentRecipient(intent: VoiceIntent, contacts: Contact[]): string | null {
    if (!intent.recipient) return null;

    // If it's already an address
    if (/^0x[0-9a-fA-F]{40}$/.test(intent.recipient)) return intent.recipient;

    const needle = intent.recipient.toLowerCase();
    const match = contacts.find(c =>
        c.internalName?.toLowerCase().includes(needle) ||
        c.alias?.toLowerCase().includes(needle)
    );
    return match?.address || null;
}
