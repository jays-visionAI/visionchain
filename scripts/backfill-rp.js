/**
 * Backfill RP Script
 * 
 * Retroactively awards Reward Points for all existing users based on their referralCount.
 * - Referral RP: referralCount * 10 RP per referral
 * - Level-up bonuses: +100 RP for each 10th level milestone (LVL 10, 20, 30...)
 * 
 * Level formula: level = floor((1 + sqrt(1 + 8*count)) / 2), capped at 100
 * 
 * Usage: node scripts/backfill-rp.js [--project visionchain-d19ed] [--dry-run]
 */

const admin = require('firebase-admin');

// Parse arguments
const args = process.argv.slice(2);
const projectIndex = args.indexOf('--project');
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : 'visionchain-d19ed';
const dryRun = args.includes('--dry-run');

// Constants (matching firebaseService.ts)
const RP_PER_REFERRAL = 10;
const RP_LEVELUP_BONUS = 100;
const LEVELUP_INTERVAL = 10;

function calculateLevelFromRefs(count) {
    const level = Math.floor((1 + Math.sqrt(1 + 8 * count)) / 2);
    return Math.min(level, 100);
}

async function main() {
    console.log(`\n=== RP Backfill Script ===`);
    console.log(`Project: ${projectId}`);
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will write to Firestore)'}\n`);

    // Initialize Firebase Admin
    const app = admin.initializeApp({ projectId });
    const db = admin.firestore();

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Total users found: ${usersSnapshot.size}\n`);

    let processed = 0;
    let awarded = 0;
    let skipped = 0;
    let totalRPAwarded = 0;
    const details = [];

    for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const email = userDoc.id;
        const referralCount = userData.referralCount || 0;

        if (referralCount <= 0) {
            skipped++;
            continue;
        }

        processed++;

        // Calculate expected referral RP
        const referralRP = referralCount * RP_PER_REFERRAL;

        // Calculate level & level-up bonuses
        const currentLevel = calculateLevelFromRefs(referralCount);
        let levelupRP = 0;
        for (let lvl = 1; lvl <= currentLevel; lvl++) {
            if (lvl % LEVELUP_INTERVAL === 0) {
                levelupRP += RP_LEVELUP_BONUS;
            }
        }

        const expectedTotalRP = referralRP + levelupRP;

        // Check existing RP
        const rpDoc = await db.collection('user_reward_points').doc(email).get();
        const existingRP = rpDoc.exists ? (rpDoc.data().totalRP || 0) : 0;
        const existingAvailable = rpDoc.exists ? (rpDoc.data().availableRP || 0) : 0;
        const existingClaimed = rpDoc.exists ? (rpDoc.data().claimedRP || 0) : 0;

        const rpToAward = expectedTotalRP - existingRP;

        if (rpToAward <= 0) {
            skipped++;
            details.push({ email, referrals: referralCount, level: currentLevel, existing: existingRP, expected: expectedTotalRP, awarded: 0, status: 'SKIP (already enough)' });
            continue;
        }

        // Calculate breakdown
        const backfillReferralRP = Math.max(0, referralRP - existingRP);
        const backfillLevelupRP = rpToAward - Math.max(0, backfillReferralRP);

        console.log(`[${email}]`);
        console.log(`  Referrals: ${referralCount}, Level: ${currentLevel}`);
        console.log(`  Existing RP: ${existingRP}, Expected: ${expectedTotalRP}`);
        console.log(`  Awarding: +${rpToAward} RP (referral: +${backfillReferralRP}, levelup: +${backfillLevelupRP})`);

        if (!dryRun) {
            const now = new Date().toISOString();

            // Award referral RP backfill
            if (backfillReferralRP > 0) {
                await db.collection('rp_history').add({
                    userId: email,
                    type: 'referral',
                    amount: backfillReferralRP,
                    source: `Backfill: ${referralCount} referrals`,
                    timestamp: now
                });
            }

            // Award level-up RP backfill
            if (backfillLevelupRP > 0) {
                await db.collection('rp_history').add({
                    userId: email,
                    type: 'levelup',
                    amount: backfillLevelupRP,
                    source: `Backfill: Level milestones up to LVL ${currentLevel}`,
                    timestamp: now
                });
            }

            // Update user RP document
            if (rpDoc.exists) {
                await db.collection('user_reward_points').doc(email).update({
                    totalRP: existingRP + rpToAward,
                    availableRP: existingAvailable + rpToAward,
                    updatedAt: now
                });
            } else {
                await db.collection('user_reward_points').doc(email).set({
                    userId: email,
                    totalRP: rpToAward,
                    claimedRP: 0,
                    availableRP: rpToAward,
                    createdAt: now,
                    updatedAt: now
                });
            }

            console.log(`  -> DONE`);
        } else {
            console.log(`  -> DRY RUN (no changes)`);
        }

        awarded++;
        totalRPAwarded += rpToAward;
        details.push({
            email,
            referrals: referralCount,
            level: currentLevel,
            existing: existingRP,
            expected: expectedTotalRP,
            awarded: rpToAward,
            status: dryRun ? 'WOULD AWARD' : 'AWARDED'
        });
    }

    console.log(`\n=== Summary ===`);
    console.log(`Users with referrals: ${processed}`);
    console.log(`Users awarded RP: ${awarded}`);
    console.log(`Users skipped: ${skipped}`);
    console.log(`Total RP awarded: ${totalRPAwarded}`);
    console.log(`\n--- Details ---`);
    console.table(details);

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
