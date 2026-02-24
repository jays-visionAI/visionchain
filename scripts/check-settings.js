const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
    console.log("Adding dummy data to see if it even persists");
    await db.doc("dex/config/trading-settings/current").set({ test: 1 }, { merge: true });
    const snap = await db.doc("dex/config/trading-settings/current").get();
    console.log(snap.data());
}
run();
