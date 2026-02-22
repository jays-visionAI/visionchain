// Quick sync: just 4 main users to staging (no contacts)
const admin = require("firebase-admin");

const prodApp = admin.initializeApp({ projectId: "visionchain-d19ed" }, "prod");
const stagingApp = admin.initializeApp({ projectId: "visionchain-staging" }, "staging");
const prodDb = prodApp.firestore();
const stagingDb = stagingApp.firestore();
const stagingAuth = stagingApp.auth();

const EMAILS = ["sangky94@gmail.com", "mazingaai@gmail.com", "johnryu77@naver.com", "hamyung1234@gmail.com"];

(async () => {
    console.log("Reading 4 users from production...");
    for (const email of EMAILS) {
        const snap = await prodDb.collection("users").doc(email).get();
        if (!snap.exists) { console.log("  NOT FOUND:", email); continue; }
        const data = snap.data();

        // Write to staging Firestore
        await stagingDb.collection("users").doc(email).set(data);
        console.log("  Firestore OK:", email);

        // Create Auth user
        try {
            await stagingAuth.createUser({ email, password: "VisionTest2026!", displayName: data.displayName || data.name || email.split("@")[0] });
            console.log("  Auth OK:", email);
        } catch (e) {
            console.log("  Auth:", e.code === "auth/email-already-exists" ? "exists" : e.message);
        }
    }
    console.log("\nDONE! Password: VisionTest2026!");
    process.exit(0);
})();
