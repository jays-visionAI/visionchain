import { getFirebaseDb } from './firebaseService';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { createSignal } from 'solid-js';

export interface VcnPriceSettings {
    minPrice: number;
    maxPrice: number;
    volatilityPeriod: number; // Cycle period in seconds
    volatilityRange: number;  // Allowed deviation percentage (0-100)
    enabled: boolean;
    lastUpdate: number;
}

// No DEFAULT_SETTINGS -- Firestore is the ONLY source of truth.
// Initial signal is null until Firestore loads.
const [currentPrice, setCurrentPrice] = createSignal(0);
const [priceHistory, setPriceHistory] = createSignal<number[]>([]);
const [priceSettings, setPriceSettings] = createSignal<VcnPriceSettings | null>(null);

// Multi-chain price cache (lazy, on-demand only)
let cachedEthPrice = 0;
let cachedMaticPrice = 0;
let lastMarketFetchTime = 0;
let marketFetchPromise: Promise<void> | null = null;

// Fibonacci-inspired Price Volatility Engine
// Uses harmonics based on the Golden Ratio (PHI) to simulate natural market cycles
const calculateFibonacciPrice = (settings: VcnPriceSettings, targetTime?: number) => {
    const PHI = 1.61803398875;
    const now = (targetTime || Date.now()) / 1000; // time in seconds

    const period = settings.volatilityPeriod || 60;
    const range = Math.max(0.0001, settings.maxPrice - settings.minPrice);
    const mid = settings.minPrice + range / 2;

    // Scale the range based on user's volatility % (capped by min/max)
    const activeRange = (mid * (settings.volatilityRange / 100)) / 2;

    // Fibonacci Harmonics: Summing waves at phi-scaled frequencies
    let wave = 0;
    wave += Math.sin((2 * Math.PI * now) / period);
    wave += Math.sin((2 * Math.PI * now * PHI) / period) / PHI;
    wave += Math.sin((2 * Math.PI * now * PHI * PHI) / period) / (PHI * PHI);

    const normalizedWave = (wave / 2) * 0.1;
    let result = mid + (normalizedWave * activeRange * 20);

    // Clamp to min/max
    return Math.max(settings.minPrice, Math.min(settings.maxPrice, result));
};

// Lazy market price fetcher -- only called when getEthPrice()/getMaticPrice() is used.
// Cached for 5 minutes. No background polling.
const MARKET_PRICE_COOLDOWN = 5 * 60 * 1000; // 5 minutes
const fetchMarketPricesIfNeeded = async () => {
    if (Date.now() - lastMarketFetchTime < MARKET_PRICE_COOLDOWN) return;
    // Deduplicate concurrent calls
    if (marketFetchPromise) return marketFetchPromise;

    marketFetchPromise = (async () => {
        try {
            const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
            const projectId = hostname.includes('staging') ? 'visionchain-staging' : 'visionchain-d19ed';
            const url = `https://us-central1-${projectId}.cloudfunctions.net/getMarketPrices`;

            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' }
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.prices) {
                    if (result.prices.ETH?.usd) cachedEthPrice = result.prices.ETH.usd;
                    if (result.prices.POL?.usd) cachedMaticPrice = result.prices.POL.usd;
                    lastMarketFetchTime = Date.now();
                    console.debug('[PriceService] Market prices fetched on-demand:', {
                        ETH: cachedEthPrice, POL: cachedMaticPrice,
                        source: result.source, cached: result.cached
                    });
                }
            }
        } catch (err) {
            console.debug('[PriceService] Failed to fetch market prices:', err);
        } finally {
            marketFetchPromise = null;
        }
    })();

    return marketFetchPromise;
};

// Initial Fetch and Subscription
// Use globalThis to survive HMR (Vite hot module replacement)
const INIT_KEY = '__vcn_price_service_initialized__';
const TICKER_KEY = '__vcn_price_service_ticker__';

export const initPriceService = () => {
    if ((globalThis as any)[INIT_KEY]) return;
    (globalThis as any)[INIT_KEY] = true;

    // Clear previously registered ticker (safety net for HMR)
    const oldTicker = (globalThis as any)[TICKER_KEY] as number | undefined;
    if (oldTicker) clearInterval(oldTicker);

    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');

    // Subscribe to Firestore -- the ONLY place settings come from.
    // No hardcoded defaults anywhere. Admin-saved values are the single source of truth.
    onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as VcnPriceSettings;
            setPriceSettings(data);
            console.debug('[PriceService] Loaded settings from Firestore:', data);
        }
        // If no document exists, settings remain null and price engine won't run.
    });

    // VCN price ticker -- only runs when Firestore settings have been loaded
    // NOTE: No market price polling here. ETH/POL prices are fetched lazily on-demand.
    const tickerId = setInterval(() => {
        const settings = priceSettings();
        if (settings && settings.enabled) {
            const newPrice = calculateFibonacciPrice(settings);
            setCurrentPrice(newPrice);

            setPriceHistory(prev => {
                const next = [...prev, newPrice];
                if (next.length > 60) return next.slice(next.length - 60);
                return next;
            });
        }
    }, 1000);

    (globalThis as any)[TICKER_KEY] = tickerId;
};

export const getVcnPrice = () => currentPrice();
export const getVcnPriceHistory = () => priceHistory();
// Provide a safe accessor that returns zeroed fields if Firestore hasn't loaded yet
export const getVcnPriceSettings = () => priceSettings() || { minPrice: 0, maxPrice: 0, volatilityPeriod: 60, volatilityRange: 5, enabled: true, lastUpdate: 0 };

// Multi-chain price getters (lazy fetch -- only calls API when actually used)
export const getEthPrice = () => {
    fetchMarketPricesIfNeeded(); // fire-and-forget, returns cached value immediately
    return cachedEthPrice || 3200;
};
export const getMaticPrice = () => {
    fetchMarketPricesIfNeeded(); // fire-and-forget, returns cached value immediately
    return cachedMaticPrice || 0.45;
};

// Get the price at midnight today (local time)
export const getDailyOpeningPrice = () => {
    const settings = priceSettings();
    if (!settings) return 0;
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return calculateFibonacciPrice(settings, midnight.getTime());
};

export const updateVcnPriceSettings = async (settings: Partial<VcnPriceSettings>) => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');
    const current = priceSettings();
    // Write directly to Firestore -- no merging with any defaults
    await setDoc(docRef, { ...current, ...settings, lastUpdate: Date.now() });
};
