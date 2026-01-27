
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { firebaseConfig } from './config/firebase.config.js'; // Use .js for consistency with tsx run

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkTasks() {
    console.log("Checking scheduledTransfers...");
    const q = query(collection(db, 'scheduledTransfers'), orderBy('createdAt', 'desc'), limit(10));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log("No tasks found.");
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Recipient: ${data.recipient}`);
        console.log(`  Amount: ${data.amount}`);
        console.log(`  UnlockTimeTs: ${data.unlockTimeTs?.toDate()}`);
        console.log(`  NextRetryAt: ${data.nextRetryAt?.toDate()}`);
        console.log(`  LastError: ${data.lastError || 'None'}`);
        console.log(`  TxHash: ${data.txHash || 'None'}`);
        console.log("--------------------");
    });
}

checkTasks().catch(console.error);
