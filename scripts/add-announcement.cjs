// Script to add Cloud Sync announcement directly to Firebase
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'visionchain-d19ed'
});

const db = admin.firestore();

async function createAnnouncement() {
    const announcement = {
        title: "Introducing Cloud Wallet Sync - Your Keys, Always Accessible",
        content: `We are excited to announce Cloud Wallet Sync, a revolutionary feature that makes managing your wallet easier than ever before.

What is Cloud Wallet Sync?
Cloud Wallet Sync securely stores your encrypted wallet keys in the cloud, allowing you to access your wallet from any device without manually transferring private keys.

Key Benefits:
• Seamless Access: Log in from any device and instantly access your wallet
• Enhanced Security: Your private keys are encrypted with military-grade AES-256 encryption before being stored
• Automatic Backup: Never worry about losing access to your funds due to device loss or failure
• Zero Hassle: No need to manually back up or import seed phrases across devices

How to Use Cloud Wallet Sync:

1. Enable Cloud Sync
   Navigate to Settings > Security > Cloud Wallet Sync and toggle it ON

2. Set Your Security PIN
   Create a 6-digit PIN that will be used to encrypt your wallet keys

3. Confirm Activation
   Your wallet keys will be securely encrypted and synced to the cloud

4. Access From Any Device
   Simply log in to your Vision Chain account on any device, enter your PIN, and your wallet is ready to use

Important Security Notes:
• Your PIN is never stored on our servers - only you know it
• All encryption happens locally on your device before data is transmitted
• You can disable Cloud Sync at any time from Settings

Start using Cloud Wallet Sync today and experience the future of wallet management!`,
        type: "feature",
        priority: "high",
        isActive: true,
        createdBy: "jays@visai.io",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        actionUrl: "https://staging.visionchain.co/wallet/settings",
        actionLabel: "Open Settings"
    };

    try {
        const docRef = await db.collection('global_announcements').add(announcement);
        console.log('Announcement created with ID:', docRef.id);
        process.exit(0);
    } catch (error) {
        console.error('Error creating announcement:', error);
        process.exit(1);
    }
}

createAnnouncement();
