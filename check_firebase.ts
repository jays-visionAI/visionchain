import { initializeFirebase, getDocuments } from './services/firebaseService';

async function check() {
    console.log("Checking Firestore documents...");
    initializeFirebase();
    const docs = await getDocuments();
    console.log("Found", docs.length, "documents:");
    docs.forEach(d => {
        console.log(`- [${d.id}] ${d.title} (Updated: ${d.updatedAt})`);
    });
    process.exit(0);
}

check();
