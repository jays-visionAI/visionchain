import { createContext, useContext, createSignal, createMemo, JSX } from 'solid-js';

// Import locale files
import en from './locales/en.json';
import ko from './locales/ko.json';

// ============================================================
// Types
// ============================================================
type NestedRecord = { [key: string]: string | NestedRecord };
type LocaleCode = string;

interface I18nContextValue {
    /** Translate a key. Supports nested keys like 'auth.login.title'. Falls back to English, then returns the key itself. */
    t: (key: string, params?: Record<string, string | number>) => string;
    /** Current locale code (e.g. 'en', 'ko') */
    locale: () => LocaleCode;
    /** Change locale */
    setLocale: (code: LocaleCode) => void;
    /** All available locale codes */
    availableLocales: { code: string; label: string; native: string }[];
}

// ============================================================
// Locale Registry
// ============================================================
const LOCALES: Record<LocaleCode, NestedRecord> = {
    en: en as NestedRecord,
    ko: ko as NestedRecord,
};

const AVAILABLE_LOCALES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ko', label: 'Korean', native: '한국어' },
];

const STORAGE_KEY = 'visionchain_locale';
const DEFAULT_LOCALE = 'en';

// ============================================================
// Helper: resolve a nested key like 'auth.login.title'
// ============================================================
function resolveKey(obj: NestedRecord, key: string): string | undefined {
    const keys = key.split('.');
    let current: NestedRecord | string | undefined = obj;

    for (const k of keys) {
        if (current === undefined || typeof current === 'string') return undefined;
        current = current[k];
    }

    return typeof current === 'string' ? current : undefined;
}

// ============================================================
// Detect initial locale
// ============================================================
function detectLocale(): LocaleCode {
    // 1. localStorage
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && LOCALES[stored]) return stored;
    } catch { /* SSR or privacy mode */ }

    // 2. Browser language
    try {
        const browserLang = navigator.language?.split('-')[0];
        if (browserLang && LOCALES[browserLang]) return browserLang;
    } catch { /* SSR */ }

    return DEFAULT_LOCALE;
}

// ============================================================
// Context
// ============================================================
const I18nContext = createContext<I18nContextValue>();

export function I18nProvider(props: { children: JSX.Element }) {
    const [locale, setLocaleSignal] = createSignal<LocaleCode>(detectLocale());

    const setLocale = (code: LocaleCode) => {
        if (LOCALES[code]) {
            setLocaleSignal(code);
            try {
                localStorage.setItem(STORAGE_KEY, code);
            } catch { /* ignore */ }
            // Update HTML lang attribute
            document.documentElement.lang = code;
        } else {
            console.warn(`[i18n] Unknown locale: ${code}`);
        }
    };

    // Set initial HTML lang
    document.documentElement.lang = locale();

    const t = (key: string, params?: Record<string, string | number>): string => {
        // Try current locale first
        let value = resolveKey(LOCALES[locale()] || {}, key);

        // Fallback to English
        if (value === undefined && locale() !== DEFAULT_LOCALE) {
            value = resolveKey(LOCALES[DEFAULT_LOCALE] || {}, key);
        }

        // Fallback to key itself
        if (value === undefined) return key;

        // Parameter substitution: {{name}} -> value
        if (params) {
            return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
                return params[paramKey]?.toString() ?? `{{${paramKey}}}`;
            });
        }

        return value;
    };

    const contextValue: I18nContextValue = {
        t,
        locale,
        setLocale,
        availableLocales: AVAILABLE_LOCALES,
    };

    return (
        <I18nContext.Provider value={contextValue}>
            {props.children}
        </I18nContext.Provider>
    );
}

export function useI18n(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return ctx;
}
