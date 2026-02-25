const admin = require("firebase-admin");
const serviceAccount = require("./firebase-service-account.json"); // Provide fallback or use default credentials?
// No, the user must have logged in.
admin.initializeApp();
const storage = admin.storage();
const bucket = storage.bucket();

async function setCors() {
    const corsConfig = [
        {
            origin: ["*"],
            method: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "HEAD"],
            maxAgeSeconds: 3600,
            responseHeader: ["*"],
        },
    ];

    await bucket.setCorsConfiguration(corsConfig);
    console.log("CORS updated successfully on", bucket.name);
}

setCors().catch(console.error);
