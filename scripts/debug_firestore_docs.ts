import { initializeFirebase, getFirebaseDb } from '../services/firebaseService';
import { collection, getDocs } from 'firebase/firestore';

// Initialize
initializeFirebase();
const db = getFirebaseDb();

async function inspectCollection(name: string) {
    console.log(`\n--- Inspecting Collection: ${name} ---`);
    try {
        const snap = await getDocs(collection(db, name));
        if (snap.empty) {
            console.log(`[${name}] is EMPTY.`);
        } else {
            console.log(`[${name}] contains ${snap.size} documents:`);
            snap.forEach(d => {
                const data = d.data();
                console.log(` - ID: ${d.id}, Title: "${data.title || 'No Title'}", Updated: ${data.updatedAt}`);
            });
        }
    } catch (e) {
        console.error(`[${name}] Error:`, e.message);
    }
}

async function run() {
    await inspectCollection('system_documents');
    await inspectCollection('documents');
    await inspectCollection('admin_documents');
    process.exit(0);
}

run();
