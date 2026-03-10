/**
 * Vision Chain - Locale Utilities
 *
 * Detects user's browser language and provides Korean/English labels.
 */

/**
 * Returns true if the user's browser language is Korean.
 */
export function isKorean(): boolean {
    if (typeof navigator === 'undefined') return false;
    const lang = navigator.language || '';
    return lang.startsWith('ko');
}

/**
 * Returns the localized string based on user's browser language.
 * If Korean, returns `ko`. Otherwise returns `en`.
 */
export function t(en: string, ko: string): string {
    return isKorean() ? ko : en;
}
