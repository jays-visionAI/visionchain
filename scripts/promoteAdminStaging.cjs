const admin = require('firebase-admin');

// Initialize with environment variables or default local credentials
admin.initializeApp({
    projectId: 'visionchain-staging'
});

const db = admin.firestore();
const email = 'jays@visai.io';

async function promoteAdmin() {
    try {
        const userRef = db.collection('users').doc(email.toLowerCase());
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log(`User ${email} not found. Creating user document...`);
            await userRef.set({
                email: email.toLowerCase(),
                role: 'admin',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } else {
            console.log(`Found user ${email}. Updating role to admin...`);
            await userRef.update({
                role: 'admin',
                updatedAt: new Date().toISOString()
            });
        }
        console.log('Successfully promoted user to admin on staging.');
    } catch (error) {
        console.error('Error promoting admin:', error);
        process.exit(1);
    }
}

promoteAdmin();
