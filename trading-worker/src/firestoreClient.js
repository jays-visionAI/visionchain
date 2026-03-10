/**
 * Firebase Admin SDK Client
 *
 * Connects to Firestore using service account credentials.
 * Railway environment variable: FIREBASE_SERVICE_ACCOUNT (JSON string)
 */

const admin = require("firebase-admin");

let _db = null;

function initFirebase() {
    if (_db) return _db;

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
        throw new Error(
            "FIREBASE_SERVICE_ACCOUNT environment variable not set. " +
            "Set it to the JSON string of your Firebase service account key."
        );
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    _db = admin.firestore();
    console.log("[Firebase] Connected to Firestore");
    return _db;
}

function getDb() {
    if (!_db) return initFirebase();
    return _db;
}

module.exports = { initFirebase, getDb };
