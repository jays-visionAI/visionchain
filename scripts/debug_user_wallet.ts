
import { initializeFirebase, getFirebaseDb } from '../services/firebaseService';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

async function debugUser() {
    initializeFirebase();
    const db = getFirebaseDb();
    const email = 'johnryu7777@gmail.com';

    console.log(`Checking data for: ${email}`);

    // Check Users Collection
    const userRef = doc(db, 'users', email);
    const userSnap = await getDoc(userRef);

    console.log('\n--- Users Collection ---');
    if (userSnap.exists()) {
        console.log('Document ID:', userSnap.id);
        console.log('Data:', userSnap.data());
    } else {
        console.log('Document does not exist (checking lowercase ID)');
    }

    // Check Token Sales
    const saleRef = doc(db, 'token_sales', email);
    const saleSnap = await getDoc(saleRef);

    console.log('\n--- Token Sales Collection ---');
    if (saleSnap.exists()) {
        console.log('Document ID:', saleSnap.id);
        console.log('Data:', saleSnap.data());
    } else {
        console.log('Document does not exist');
    }

    // Check All Users to see if there's a case sensitivity issue or weird ID
    console.log('\n--- Searching by Field ---');
    const q = query(collection(db, 'users'), where('email', '==', email));
    const qSnap = await getDocs(q);
    qSnap.forEach(d => {
        console.log(`Found via query: ID=${d.id}, Data=`, d.data());
    });
}

debugUser().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
