const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

async function setAdmin() {
    const email = "mazingaai@gmail.com";
    const ref = db.collection("users").doc(email);
    const snap = await ref.get();
    if (snap.exists) {
        console.log("Current role:", snap.data().role);
        await ref.update({ role: "admin" });
        console.log("DONE: role updated to admin for", email);
    } else {
        await ref.set({ email, role: "admin", createdAt: new Date().toISOString() });
        console.log("DONE: admin user created for", email);
    }
    process.exit(0);
}

setAdmin().catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
});
