/**
 * Firebase Admin SDK Client
 *
 * Connects to Firestore using:
 * 1. FIREBASE_SERVICE_ACCOUNT env var (JSON string) - for Railway/standalone
 * 2. Application Default Credentials (ADC) - for Cloud Run/GCP (automatic)
 */

const admin = require("firebase-admin");

let _db = null;

function initFirebase() {
    if (_db) return _db;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    const projectId = process.env.FIREBASE_PROJECT_ID || "visionchain-d19ed";

    if (serviceAccountJson) {
        // Option 1: Explicit service account key (Railway, local dev)
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        console.log("[Firebase] Connected via Service Account key");
    } else {
        // Option 2: Application Default Credentials (Cloud Run, GCE, GKE)
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId,
        });
        console.log("[Firebase] Connected via Application Default Credentials");
    }

    _db = admin.firestore();
    console.log(`[Firebase] Firestore ready (project: ${projectId})`);
    return _db;
}

function getDb() {
    if (!_db) return initFirebase();
    return _db;
}

module.exports = { initFirebase, getDb };
