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
    minPrice: 4.20,
    maxPrice: 5.80,
    enabled: true,
    lastUpdate: Date.now()
};

const [currentPrice, setCurrentPrice] = createSignal(4.876);
const [priceSettings, setPriceSettings] = createSignal<VcnPriceSettings>(DEFAULT_SETTINGS);

// Smooth price calculation based on time
// We use a sine wave combined with some noise to simulate a realistic chart
const calculateSmoothPrice = (settings: VcnPriceSettings) => {
    const time = Date.now() / 10000; // Slow down the oscillation
    const range = settings.maxPrice - settings.minPrice;
    const mid = settings.minPrice + range / 2;

    // Base oscillation
    const base = Math.sin(time) * (range / 2);

    // Add some sub-oscillations for "texture"
    const noise = Math.sin(time * 3.7) * (range * 0.05) + Math.sin(time * 11.2) * (range * 0.02);

    return mid + base + noise;
};

// Initial Fetch and Subscription
export const initPriceService = () => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');

    onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data() as VcnPriceSettings;
            setPriceSettings(data);
        } else {
            // Initialize with defaults if not exists
            setDoc(docRef, DEFAULT_SETTINGS);
        }
    });

    // Update the live price signal every second
    setInterval(() => {
        if (priceSettings().enabled) {
            const newPrice = calculateSmoothPrice(priceSettings());
            setCurrentPrice(newPrice);
        }
    }, 1000);
};

export const getVcnPrice = () => currentPrice();
export const getVcnPriceSettings = () => priceSettings();

export const updateVcnPriceSettings = async (settings: Partial<VcnPriceSettings>) => {
    const db = getFirebaseDb();
    const docRef = doc(db, 'settings', 'vcn_price');
    await setDoc(docRef, { ...priceSettings(), ...settings, lastUpdate: Date.now() }, { merge: true });
};
