const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
    await db.doc("dex/config/trading-settings/current").update({
        "priceDirection": {
            targetPrice: 0.14,
            mode: "bullish",
            phase: "Markup",
            trendBias: 0.3,
            trendSpeed: "fast",
            currentBasePrice: 0.1000
        }
    });
    console.log("Restored basic dummy data for demo purposes");
}
run();
