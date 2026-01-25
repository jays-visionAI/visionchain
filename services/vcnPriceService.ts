import { getFirebaseDb } from './firebaseService';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { createSignal } from 'solid-js';

export interface VcnPriceSettings {
    minPrice: number;
    maxPrice: number;
    enabled: boolean;
    lastUpdate: number;
}

const DEFAULT_SETTINGS: VcnPriceSettings = {
    minPrice: 0.3500,
    maxPrice: 0.8500,
    enabled: true,
    lastUpdate: Date.now()
};

const [currentPrice, setCurrentPrice] = createSignal(0.3750);
const [priceHistory, setPriceHistory] = createSignal<number[]>([]);
const [priceSettings, setPriceSettings] = createSignal<VcnPriceSettings>(DEFAULT_SETTINGS);

// Smooth price calculation based on time
// We use a sine wave combined with some noise to simulate a realistic chart
const calculateSmoothPrice = (settings: VcnPriceSettings) => {
    const time = Date.now() / 8000; // Slightly faster oscillation for visual feedback
    const range = Math.max(0.0001, settings.maxPrice - settings.minPrice);
    const mid = settings.minPrice + range / 2;

    // Base oscillation
    const base = Math.sin(time) * (range / 2);

    // Add some sub-oscillations for "texture"
    const noise = Math.sin(time * 3.7) * (range * 0.08) + Math.sin(time * 11.2) * (range * 0.04);

    return mid + base + noise;
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
            setPriceSettings(data);
        } else {
            setDoc(docRef, DEFAULT_SETTINGS);
        }
    });

    // Update the live price signal every second
    setInterval(() => {
        if (priceSettings().enabled) {
            const newPrice = calculateSmoothPrice(priceSettings());
            setCurrentPrice(newPrice);

            // Maintain 60 points of history
            setPriceHistory(prev => {
                const next = [...prev, newPrice];
                if (next.length > 60) return next.slice(next.length - 60);
                return next;
            });
        }
    }, 1000);
};

export const getVcnPrice = () => currentPrice();
export const getVcnPriceHistory = () => priceHistory();
export const getVcnPriceSettings = () => priceSettings();

export const updateVcnPriceSettings = async (settings: Partial<VcnPriceSettings>) => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');
    await setDoc(docRef, { ...priceSettings(), ...settings, lastUpdate: Date.now() }, { merge: true });
};
