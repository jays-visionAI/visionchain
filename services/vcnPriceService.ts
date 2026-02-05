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

const DEFAULT_SETTINGS: VcnPriceSettings = {
    minPrice: 0.3500,
    maxPrice: 0.8500,
    volatilityPeriod: 60, // 60 seconds for a full major cycle
    volatilityRange: 5,   // 5% default range
    enabled: true,
    lastUpdate: Date.now()
};

const [currentPrice, setCurrentPrice] = createSignal(0.3750);
const [priceHistory, setPriceHistory] = createSignal<number[]>([]);
const [priceSettings, setPriceSettings] = createSignal<VcnPriceSettings>(DEFAULT_SETTINGS);

// Multi-chain price signals
const [ethPrice, setEthPrice] = createSignal(0);
const [maticPrice, setMaticPrice] = createSignal(0);
const [lastPriceFetch, setLastPriceFetch] = createSignal(0);

// Fibonacci-inspired Price Volatility Engine
// Uses harmonics based on the Golden Ratio (PHI) to simulate natural market cycles
const calculateFibonacciPrice = (settings: VcnPriceSettings, targetTime?: number) => {
    const PHI = 1.61803398875;
    const now = (targetTime || Date.now()) / 1000; // time in seconds

    // Period adjustment: 2x slower than previous (previous was ~8s for small cycle, now user-defined)
    // We use settings.volatilityPeriod as the base cycle
    const period = settings.volatilityPeriod || 60;
    const range = Math.max(0.0001, settings.maxPrice - settings.minPrice);
    const mid = settings.minPrice + range / 2;

    // Scale the range based on user's volatility % (capped by min/max)
    const activeRange = (mid * (settings.volatilityRange / 100)) / 2;

    // Fibonacci Harmonics: Summing waves at phi-scaled frequencies
    // This creates "waves within waves" typical of Elliott Wave/Fibonacci theory
    let wave = 0;
    wave += Math.sin((2 * Math.PI * now) / period);             // Primary Wave (1)
    wave += Math.sin((2 * Math.PI * now * PHI) / period) / PHI;  // Secondary Corrective (0.618)
    wave += Math.sin((2 * Math.PI * now * PHI * PHI) / period) / (PHI * PHI); // Noise (0.382)

    // Volatility reduced by 10x for the final signal as requested
    const normalizedWave = (wave / 2) * 0.1;

    let result = mid + (normalizedWave * activeRange * 20); // Scale up to meet the percentage goal

    // Clamp to min/max
    return Math.max(settings.minPrice, Math.min(settings.maxPrice, result));
};

// Fetch market prices from CoinGecko (free API, no key required)
const fetchMarketPrices = async () => {
    // Rate limit: only fetch every 60 seconds
    if (Date.now() - lastPriceFetch() < 60000) return;

    try {
        // Note: MATIC is now POL (polygon-ecosystem-token) on CoinGecko
        const response = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,polygon-ecosystem-token&vs_currencies=usd',
            { headers: { 'Accept': 'application/json' } }
        );

        if (response.ok) {
            const data = await response.json();
            if (data.ethereum?.usd) setEthPrice(data.ethereum.usd);
            if (data['polygon-ecosystem-token']?.usd) setMaticPrice(data['polygon-ecosystem-token'].usd);
            setLastPriceFetch(Date.now());
            console.log('[PriceService] Market prices updated:', { ETH: data.ethereum?.usd, POL: data['polygon-ecosystem-token']?.usd });
        }
    } catch (err) {
        console.debug('[PriceService] Failed to fetch market prices:', err);
        // Use fallback prices if API fails
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

    onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as VcnPriceSettings;
            // Ensure defaults for new fields if they don't exist in DB
            setPriceSettings({
                ...DEFAULT_SETTINGS,
                ...data
            });
        } else {
            setDoc(docRef, DEFAULT_SETTINGS);
        }
    });

    // Fetch market prices immediately
    fetchMarketPrices();

    // Update the live price signal every second
    setInterval(() => {
        if (priceSettings().enabled) {
            const newPrice = calculateFibonacciPrice(priceSettings());
            setCurrentPrice(newPrice);

            // Maintain 60 points of history for the admin chart
            setPriceHistory(prev => {
                const next = [...prev, newPrice];
                if (next.length > 60) return next.slice(next.length - 60);
                return next;
            });
        }
    }, 1000);

    // Refresh market prices every 60 seconds
    setInterval(fetchMarketPrices, 60000);
};

export const getVcnPrice = () => currentPrice();
export const getVcnPriceHistory = () => priceHistory();
export const getVcnPriceSettings = () => priceSettings();

// Multi-chain price getters
export const getEthPrice = () => ethPrice() || 3200; // fallback
export const getMaticPrice = () => maticPrice() || 0.45; // fallback

// Get the price at midnight today (local time)
export const getDailyOpeningPrice = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    return calculateFibonacciPrice(priceSettings(), midnight.getTime());
};

export const updateVcnPriceSettings = async (settings: Partial<VcnPriceSettings>) => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');
    await setDoc(docRef, { ...priceSettings(), ...settings, lastUpdate: Date.now() }, { merge: true });
};
