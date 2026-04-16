/**
 * Verify user purchase data in Firebase
 * Checks both 'users' and 'token_sales' collections for a given email
 */
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, query, where, getDocs } = require('firebase/firestore');

// Use production Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCR4ITFD6KCK6zaJYEWbJF0A8kVog-U-Sc",
    authDomain: "visionchain-staging.firebaseapp.com",
    projectId: "visionchain-staging",
    storageBucket: "visionchain-staging.firebasestorage.app",
    messagingSenderId: "678764770999",
    appId: "1:678764770999:web:1db11616686d5016bd3f32",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const EMAIL = 'tkdtkwiwja@naver.com';
const PARTNER_CODE = '42N12F';

async function checkUser() {
    console.log(`\n=== Checking data for: ${EMAIL} ===\n`);

    // 1. Check 'users' collection
    console.log('--- [1] users collection ---');
    const userRef = doc(db, 'users', EMAIL.toLowerCase());
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const data = userSnap.data();
        console.log('  EXISTS: true');
        console.log('  email:', data.email);
        console.log('  status:', data.status);
        console.log('  partnerCode:', data.partnerCode);
        console.log('  walletAddress:', data.walletAddress || 'NOT SET');
        console.log('  role:', data.role);
        console.log('  amountToken:', data.amountToken);
        console.log('  createdAt:', data.createdAt);
        console.log('  adminSentTotal:', data.adminSentTotal || 0);
        console.log('  vestingTx:', data.vestingTx || 'NONE');
        console.log('  Full data:', JSON.stringify(data, null, 2));
    } else {
        console.log('  EXISTS: false -- NOT found in users collection');
    }

    // 2. Check 'token_sales' collection
    console.log('\n--- [2] token_sales collection ---');
    const saleRef = doc(db, 'token_sales', EMAIL.toLowerCase());
    const saleSnap = await getDoc(saleRef);
    if (saleSnap.exists()) {
        const data = saleSnap.data();
        console.log('  EXISTS: true');
        console.log('  email:', data.email);
        console.log('  partnerCode:', data.partnerCode);
        console.log('  amountToken:', data.amountToken || data.amount);
        console.log('  status:', data.status);
        console.log('  tier:', data.tier);
        console.log('  date:', data.date);
        console.log('  walletAddress:', data.walletAddress || 'NOT SET');
        console.log('  vestingTx:', data.vestingTx || 'NONE');
        console.log('  Full data:', JSON.stringify(data, null, 2));
    } else {
        console.log('  EXISTS: false -- NOT found in token_sales collection');
    }

    // 3. Check 'vcn_purchases' collection
    console.log('\n--- [3] vcn_purchases collection ---');
    const purchaseRef = doc(db, 'vcn_purchases', EMAIL.toLowerCase());
    const purchaseSnap = await getDoc(purchaseRef);
    if (purchaseSnap.exists()) {
        const data = purchaseSnap.data();
        console.log('  EXISTS: true');
        console.log('  Full data:', JSON.stringify(data, null, 2));
    } else {
        console.log('  EXISTS: false');
    }

    // 4. Check partner code validity
    console.log(`\n--- [4] Partner Code "${PARTNER_CODE}" verification ---`);
    try {
        const partnersRef = collection(db, 'partners');
        const pSnap = await getDocs(partnersRef);
        let found = false;
        pSnap.forEach(doc => {
            const data = doc.data();
            if (doc.id === PARTNER_CODE || data.code === PARTNER_CODE) {
                found = true;
                console.log('  FOUND partner:', doc.id);
                console.log('  Partner data:', JSON.stringify(data, null, 2));
            }
        });
        if (!found) {
            console.log('  NOT FOUND in partners collection');
        }
    } catch (e) {
        console.log('  Error checking partners:', e.message);
    }

    // 5. Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    const inUsers = userSnap.exists();
    const inSales = saleSnap.exists();
    const inPurchases = purchaseSnap.exists();

    if (inSales) {
        const saleData = saleSnap.data();
        const expectedAmount = 63500;
        const actualAmount = saleData.amountToken || saleData.amount || 0;
        
        console.log(`  token_sales record: YES`);
        console.log(`  Expected amount: ${expectedAmount.toLocaleString()} VCN`);
        console.log(`  Actual amount:   ${actualAmount.toLocaleString()} VCN`);
        console.log(`  Amount match:    ${actualAmount === expectedAmount ? 'YES' : 'NO - MISMATCH!'}`);
        console.log(`  Partner code:    ${saleData.partnerCode} ${saleData.partnerCode === PARTNER_CODE ? '(MATCH)' : '(MISMATCH!)'}`);
        console.log(`  Status:          ${saleData.status}`);
        console.log(`  Wallet:          ${saleData.walletAddress || 'NOT CONNECTED'}`);
    } else {
        console.log(`  token_sales record: NO -- Purchase data NOT reflected!`);
    }

    if (inUsers) {
        const userData = userSnap.data();
        console.log(`  users record:    YES (status: ${userData.status})`);
    } else {
        console.log(`  users record:    NO`);
    }

    console.log(`\n  Data properly reflected: ${inSales ? 'YES' : 'NO'}`);
    console.log('');
    
    process.exit(0);
}

checkUser().catch(err => {
    console.error('Script error:', err);
    process.exit(1);
});
