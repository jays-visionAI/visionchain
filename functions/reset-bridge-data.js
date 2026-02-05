/**
 * Reset Bridge Data Script
 * Clears Firestore bridge-related collections while preserving token_sales
 * 
 * Collections to clear:
 * - bridgeTransactions
 * - bridge_intents (if exists)
 * 
 * Collections to KEEP:
 * - token_sales (Purchased VCN)
 * - users
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

async function deleteCollection(collectionPath, batchSize = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    let totalDeleted = 0;

    while (true) {
        const snapshot = await query.get();

        if (snapshot.empty) {
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        totalDeleted += snapshot.size;
        console.log(`  Deleted ${totalDeleted} documents from ${collectionPath}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    return totalDeleted;
}

async function main() {
    console.log('='.repeat(60));
    console.log('Vision Chain - Bridge Data Reset');
    console.log('='.repeat(60));
    console.log('');
    console.log('Collections to DELETE:');
    console.log('  - bridgeTransactions');
    console.log('  - bridge_intents');
    console.log('');
    console.log('Collections to KEEP:');
    console.log('  - token_sales (Purchased VCN)');
    console.log('  - users');
    console.log('');

    // Confirm before proceeding
    console.log('Starting deletion in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        // Delete bridgeTransactions
        console.log('\n[1/2] Deleting bridgeTransactions...');
        const deleted1 = await deleteCollection('bridgeTransactions');
        console.log(`  Total deleted: ${deleted1}`);

        // Delete bridge_intents
        console.log('\n[2/2] Deleting bridge_intents...');
        const deleted2 = await deleteCollection('bridge_intents');
        console.log(`  Total deleted: ${deleted2}`);

        console.log('\n' + '='.repeat(60));
        console.log('COMPLETED: Bridge data has been reset');
        console.log('token_sales and users collections are preserved');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    process.exit(0);
}

main();
