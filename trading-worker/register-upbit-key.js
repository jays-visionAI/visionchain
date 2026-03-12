/**
 * Register Upbit API Key in Firestore and link to live agents.
 * Run from: cd trading-worker && FIREBASE_PROJECT_ID=visionchain-d19ed node /tmp/register-upbit-key.js
 */
const { initFirebase, getDb } = require("./src/firestoreClient");
const crypto = require("crypto");

const ACCESS_KEY = process.env.UPBIT_AK;
const SECRET_KEY = process.env.UPBIT_SK;

if (!ACCESS_KEY || !SECRET_KEY) {
    console.error("Set UPBIT_AK and UPBIT_SK env vars");
    process.exit(1);
}

function getEncryptionKey() {
    const projectId = process.env.FIREBASE_PROJECT_ID || "vision-chain";
    return crypto.createHash("sha256").update(projectId + "_exchange_key_salt_v1").digest();
}

function encryptApiKey(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

async function main() {
    initFirebase();
    const db = getDb();

    // 1. Encrypt and store the key
    const keyDoc = {
        exchange: "upbit",
        encryptedKey: encryptApiKey(ACCESS_KEY),
        encryptedSecret: encryptApiKey(SECRET_KEY),
        isValid: true,
        label: "Upbit Main (34.22.69.189)",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const keyRef = await db.collection("exchangeKeys").add(keyDoc);
    console.log(`Stored exchange key: ${keyRef.id}`);

    // 2. Find all live agents and link them
    const agentSnap = await db.collection("paperAgents")
        .where("tradingMode", "==", "live")
        .where("status", "in", ["running", "active"])
        .get();

    console.log(`Found ${agentSnap.size} live agents`);

    for (const doc of agentSnap.docs) {
        const agent = doc.data();
        const exchange = agent.exchange || "upbit";
        if (exchange === "upbit") {
            await doc.ref.update({
                exchangeAccountId: keyRef.id,
                exchange: "upbit",
            });
            console.log(`  Linked agent ${doc.id} -> ${keyRef.id}`);
        } else {
            console.log(`  Skipped agent ${doc.id} (exchange: ${exchange})`);
        }
    }

    console.log("Done!");
    process.exit(0);
}

main().catch(err => {
    console.error("Error:", err);
    process.exit(1);
});
