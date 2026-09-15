import { createContext, useContext, createSignal, createMemo, JSX } from 'solid-js';

// English is the fallback for every other locale and the default, so it is the
// one file that ships with the entry. The other eight are fetched on demand:
// statically importing all nine put ~440 KB of JSON in front of every page,
// including visitors who only ever see English.
import en from './locales/en.json';

const LOADERS: Record<LocaleCode, () => Promise<{ default: NestedRecord }>> = {
    ko: () => import('./locales/ko.json'),
    jp: () => import('./locales/jp.json'),
    th: () => import('./locales/th.json'),
    vi: () => import('./locales/vi.json'),
    zh: () => import('./locales/zh.json'),
    fr: () => import('./locales/fr.json'),
    de: () => import('./locales/de.json'),
    it: () => import('./locales/it.json'),
};

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
/**
 * Which locales exist. Kept separate from what is currently in memory so that
 * detection and validation do not depend on a file having been fetched yet.
 */
const KNOWN: LocaleCode[] = ['en', 'ko', 'jp', 'th', 'vi', 'zh', 'fr', 'de', 'it'];

/**
 * What is loaded right now. English is always present; others appear as their
 * chunk arrives, and the signal makes every `t()` call re-run when they do.
 */
const [tables, setTables] = createSignal<Record<LocaleCode, NestedRecord>>({
    en: en as NestedRecord,
});

const inFlight = new Set<LocaleCode>();

/** Fetch a locale table once. Failure is non-fatal: English keeps rendering. */
async function ensureLoaded(code: LocaleCode) {
    if (code === DEFAULT_LOCALE || tables()[code] || inFlight.has(code)) return;
    const load = LOADERS[code];
    if (!load) return;
    inFlight.add(code);
    try {
        const mod = await load();
        setTables((prev) => ({ ...prev, [code]: (mod.default ?? mod) as NestedRecord }));
    } catch (err) {
        console.warn(`[i18n] could not load locale ${code}`, err);
    } finally {
        inFlight.delete(code);
    }
}

const AVAILABLE_LOCALES = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'ko', label: 'Korean', native: '한국어' },
    { code: 'jp', label: 'Japanese', native: '日本語' },
    { code: 'th', label: 'Thai', native: 'ไทย' },
    { code: 'vi', label: 'Vietnamese', native: 'Tiếng Việt' },
    { code: 'zh', label: 'Chinese', native: '简体中文' },
    { code: 'fr', label: 'French', native: 'Français' },
    { code: 'de', label: 'German', native: 'Deutsch' },
    { code: 'it', label: 'Italian', native: 'Italiano' },
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
        if (stored && KNOWN.includes(stored)) return stored;
    } catch { /* SSR or privacy mode */ }

    // 2. Browser language — map ISO 639-1 codes to our internal locale keys.
    // Browsers report Japanese as 'ja', but our Japanese locale key is 'jp',
    // so without this alias a Japanese browser would fall through to English.
    try {
        const raw = navigator.language?.split('-')[0]?.toLowerCase();
        const alias: Record<string, string> = { ja: 'jp' };
        const browserLang = raw ? (alias[raw] || raw) : undefined;
        if (browserLang && KNOWN.includes(browserLang)) return browserLang;
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
        if (KNOWN.includes(code)) {
            void ensureLoaded(code);
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

    // A browser or stored preference other than English needs its table fetched.
    // Until it lands, `t()` returns English — the same fallback an untranslated
    // key already gets.
    void ensureLoaded(locale());

    const t = (key: string, params?: Record<string, string | number>): string => {
        // Try current locale first
        let value = resolveKey(tables()[locale()] || {}, key);

        // Fallback to English
        if (value === undefined && locale() !== DEFAULT_LOCALE) {
            value = resolveKey(tables()[DEFAULT_LOCALE] || {}, key);
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
