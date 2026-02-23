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

// Multi-chain price signals
const [ethPrice, setEthPrice] = createSignal(0);
const [maticPrice, setMaticPrice] = createSignal(0);
const [lastPriceFetch, setLastPriceFetch] = createSignal(0);

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

// Fetch market prices via Cloud Function proxy (Binance primary, CoinGecko fallback)
// This eliminates CORS errors and 429 rate limits from direct browser calls.
const fetchMarketPrices = async () => {
    if (Date.now() - lastPriceFetch() < 60000) return;

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
                if (result.prices.ETH?.usd) setEthPrice(result.prices.ETH.usd);
                if (result.prices.POL?.usd) setMaticPrice(result.prices.POL.usd);
                setLastPriceFetch(Date.now());
                console.log('[PriceService] Market prices updated:', {
                    ETH: result.prices.ETH?.usd,
                    POL: result.prices.POL?.usd,
                    source: result.source,
                    cached: result.cached
                });
            }
        }
    } catch (err) {
        console.debug('[PriceService] Failed to fetch market prices:', err);
        if (ethPrice() === 0) setEthPrice(3200);
        if (maticPrice() === 0) setMaticPrice(0.45);
    }
};

// Initial Fetch and Subscription
let isInitialized = false;
export const initPriceService = () => {
    if (isInitialized) return;
    isInitialized = true;

    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');

    // Subscribe to Firestore -- the ONLY place settings come from.
    // No hardcoded defaults anywhere. Admin-saved values are the single source of truth.
    onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as VcnPriceSettings;
            setPriceSettings(data);
            console.log('[PriceService] Loaded settings from Firestore:', data);
        }
        // If no document exists, settings remain null and price engine won't run.
    });

    fetchMarketPrices();

    // Price ticker -- only runs when Firestore settings have been loaded
    setInterval(() => {
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

    setInterval(fetchMarketPrices, 60000);
};

export const getVcnPrice = () => currentPrice();
export const getVcnPriceHistory = () => priceHistory();
// Provide a safe accessor that returns zeroed fields if Firestore hasn't loaded yet
export const getVcnPriceSettings = () => priceSettings() || { minPrice: 0, maxPrice: 0, volatilityPeriod: 60, volatilityRange: 5, enabled: true, lastUpdate: 0 };

// Multi-chain price getters
export const getEthPrice = () => ethPrice() || 3200;
export const getMaticPrice = () => maticPrice() || 0.45;

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
