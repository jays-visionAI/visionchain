const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
    const snap = await db.doc("dex/config/trading-settings").get();
    console.log("trading-settings exists:", snap.exists, snap.data());
    const snap2 = await db.doc("dex/config/trading-settings/current").get();
    console.log("current exists:", snap2.exists, snap2.data());
}
run();
