// Script to add Cloud Sync announcement directly to Firebase using REST API
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Firebase CLI stores its tokens here
const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const refreshToken = config.tokens.refresh_token;

// First, get a fresh access token
function getAccessToken() {
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
        }).toString();

        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const result = JSON.parse(body);
                resolve(result.access_token);
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// Create document in Firestore
function createDocument(accessToken) {
    return new Promise((resolve, reject) => {
        const now = new Date().toISOString();
        const document = {
            fields: {
                title: { stringValue: "Introducing Cloud Wallet Sync - Your Keys, Always Accessible" },
                content: {
                    stringValue: `We are excited to announce Cloud Wallet Sync, a revolutionary feature that makes managing your wallet easier than ever before.

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

Start using Cloud Wallet Sync today and experience the future of wallet management!` },
                type: { stringValue: "feature" },
                priority: { stringValue: "high" },
                isActive: { booleanValue: true },
                createdBy: { stringValue: "jays@visai.io" },
                createdAt: { timestampValue: now },
                updatedAt: { timestampValue: now },
                actionUrl: { stringValue: "https://staging.visionchain.co/wallet/settings" },
                actionLabel: { stringValue: "Open Settings" }
            }
        };

        const body = JSON.stringify(document);

        const req = https.request({
            hostname: 'firestore.googleapis.com',
            path: '/v1/projects/visionchain-d19ed/databases/(default)/documents/global_announcements',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const result = JSON.parse(responseBody);
                    const docId = result.name.split('/').pop();
                    console.log('✅ Announcement created with ID:', docId);
                    resolve(result);
                } else {
                    console.error('❌ Error:', res.statusCode, responseBody);
                    reject(new Error(responseBody));
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function main() {
    try {
        console.log('Getting access token...');
        const accessToken = await getAccessToken();
        console.log('Creating announcement...');
        await createDocument(accessToken);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
