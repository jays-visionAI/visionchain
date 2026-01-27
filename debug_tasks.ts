
import { initializeFirebase, getFirebaseDb } from './services/firebaseService';
import { collection, getDocs, query, where } from 'firebase/firestore';

async function debugTasks() {
    try {
        initializeFirebase();
        const db = getFirebaseDb();
        const q = query(collection(db, 'scheduledTransfers'));
        const snapshot = await getDocs(q);

        console.log(`Found ${snapshot.size} tasks in total.`);
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log(`ID: ${doc.id}, Status: ${data.status}, unlockTime: ${data.unlockTime}, unlockTimeTs: ${data.unlockTimeTs?.toDate?.() || data.unlockTimeTs}`);
        });
    } catch (e) {
        console.error(e);
    }
}

debugTasks();
