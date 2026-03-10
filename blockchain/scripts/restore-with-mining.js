/**
 * Vision Chain v2 - Snapshot Restoration + Mining Rewards
 *
 * 1. Restores ERC-20 VCN balances from vcn-snapshot.json
 * 2. Queries Firestore mobile_nodes for unclaimed + claimed VCN mined since snapshot
 * 3. Adds mined VCN to each user's restored balance (or creates new entry)
 * 4. Transfers the final total to each wallet on-chain
 *
 * Usage:
 *   VISION_ADMIN_PK=0x... node blockchain/scripts/restore-with-mining.js [--dry-run]
 *
 * Flags:
 *   --dry-run   Print what would be transferred without executing any TX
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const admin = require(require('path').join(__dirname, '../../functions/node_modules/firebase-admin'));

// ─── Configuration ──────────────────────────────────────────────────────────
const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const ADMIN_KEY = process.env.VISION_ADMIN_PK;
const CHAIN_ID = 3151909;
const DRY_RUN = process.argv.includes('--dry-run');

const DEPLOYED = {
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    PAYMASTER: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

// ─── Firebase Admin Init ────────────────────────────────────────────────────
// Automatically creates a valid ADC from Firebase CLI's stored credentials.
// This ensures Firestore access works even when gcloud CLI is not installed
// or when the ADC has expired (invalid_rapt).
const os = require('os');

function setupFirebaseCredentials() {
    const configPath = path.join(os.homedir(), '.config/configstore/firebase-tools.json');
    if (!fs.existsSync(configPath)) {
        console.warn("WARNING: Firebase CLI config not found. Falling back to default credentials.");
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.tokens || !config.tokens.refresh_token) {
            console.warn("WARNING: No refresh token in Firebase CLI config. Run 'firebase login' first.");
            return;
        }

        // Write a standard ADC (authorized_user) JSON that firebase-admin can use
        const adcContent = {
            type: 'authorized_user',
            client_id: config.user?.azp || '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
            refresh_token: config.tokens.refresh_token,
        };

        const adcPath = path.join(os.tmpdir(), 'vision-chain-adc.json');
        fs.writeFileSync(adcPath, JSON.stringify(adcContent, null, 2));
        process.env.GOOGLE_APPLICATION_CREDENTIALS = adcPath;
        console.log(`  Firebase credentials loaded from CLI config (${config.user?.email || 'unknown'})`);
    } catch (e) {
        console.warn("WARNING: Failed to load Firebase CLI credentials:", e.message);
    }
}

setupFirebaseCredentials();

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'visionchain-d19ed' });
}
const db = admin.firestore();

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatVCN(weiStr) {
    return parseFloat(ethers.formatEther(weiStr)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6
    });
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
    console.log("\n" + "=".repeat(70));
    console.log("  Vision Chain v2 - Snapshot Restoration + Mining Rewards");
    console.log("=".repeat(70));
    if (DRY_RUN) console.log("  ** DRY RUN MODE - No transactions will be executed **");
    console.log();

    if (!ADMIN_KEY && !DRY_RUN) {
        console.error("ERROR: VISION_ADMIN_PK environment variable is required");
        process.exit(1);
    }

    // ─── Step 1: Load snapshot ───────────────────────────────────────────
    console.log("Step 1: Loading snapshot...");
    const snapshotPath = path.join(__dirname, '../../snapshots/vcn-snapshot.json');

    if (!fs.existsSync(snapshotPath)) {
        console.error("ERROR: Snapshot file not found at", snapshotPath);
        process.exit(1);
    }

    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    console.log(`  Snapshot date: ${snapshot.timestamp}`);
    console.log(`  Snapshot block: ${snapshot.blockNumber}`);
    console.log(`  Addresses: ${snapshot.addressCount}`);
    console.log(`  Total supply: ${snapshot.totalSupplyFormatted} VCN\n`);

    // Build a map: wallet_address (lowercase) -> balance (BigInt, wei)
    const walletBalances = new Map();
    for (const [addr, balance] of Object.entries(snapshot.balances)) {
        walletBalances.set(addr.toLowerCase(), BigInt(balance));
    }

    // ─── Step 2: Query Firestore for mining rewards ─────────────────────
    console.log("Step 2: Querying Firestore for mining rewards since snapshot...\n");

    const mobileNodesSnap = await db.collection("mobile_nodes").get();
    let totalMinedVCN = 0;
    let nodesWithRewards = 0;
    const miningRewards = []; // { wallet, email, pending, claimed, total }

    for (const doc of mobileNodesSnap.docs) {
        const data = doc.data();
        const wallet = (data.wallet_address || "").toLowerCase();
        if (!wallet) continue;

        const pending = parseFloat(data.pending_reward || "0");
        const claimed = parseFloat(data.claimed_reward || "0");
        const totalMined = pending + claimed;

        if (totalMined > 0.000001) {
            miningRewards.push({
                nodeId: doc.id,
                wallet,
                email: data.email || "unknown",
                pending,
                claimed,
                totalMined,
            });
            totalMinedVCN += totalMined;
            nodesWithRewards++;

            console.log(`  Node ${doc.id.slice(0, 12)}... | ${wallet.slice(0, 10)}... | ` +
                `pending: ${pending.toFixed(6)} | claimed: ${claimed.toFixed(6)} | ` +
                `total: ${totalMined.toFixed(6)} VCN`);
        }
    }

    console.log(`\n  Nodes with rewards: ${nodesWithRewards}`);
    console.log(`  Total mined VCN: ${totalMinedVCN.toFixed(6)} VCN\n`);

    // ─── Step 3: Merge snapshot + mining rewards ────────────────────────
    console.log("Step 3: Merging snapshot balances with mining rewards...\n");

    // Add mining rewards to the wallet balance map
    let newWallets = 0;
    for (const reward of miningRewards) {
        const minedWei = ethers.parseEther(reward.totalMined.toFixed(6));
        const existing = walletBalances.get(reward.wallet) || BigInt(0);

        if (!walletBalances.has(reward.wallet)) {
            newWallets++;
            console.log(`  NEW wallet (miner only): ${reward.wallet.slice(0, 16)}... +${reward.totalMined.toFixed(6)} VCN`);
        } else {
            console.log(`  MERGE: ${reward.wallet.slice(0, 16)}... ` +
                `snapshot: ${formatVCN(existing.toString())} + mined: ${reward.totalMined.toFixed(6)} VCN`);
        }

        walletBalances.set(reward.wallet, existing + minedWei);
    }

    console.log(`\n  Total wallets to restore: ${walletBalances.size}`);
    console.log(`  New wallets (miners not in snapshot): ${newWallets}\n`);

    // ─── Step 4: Execute transfers ──────────────────────────────────────
    console.log("Step 4: Executing on-chain transfers...\n");

    let provider, wallet, vcnToken;

    if (!DRY_RUN) {
        provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
        wallet = new ethers.Wallet(ADMIN_KEY, provider);
        console.log(`  Deployer: ${wallet.address}`);

        const vcnTokenPath = path.join(__dirname, '../artifacts/contracts/VCNToken.sol/VCNToken.json');
        const vcnTokenArtifact = JSON.parse(fs.readFileSync(vcnTokenPath, 'utf8'));
        vcnToken = new ethers.Contract(DEPLOYED.VCN_TOKEN, vcnTokenArtifact.abi, wallet);

        const deployerBalance = await vcnToken.balanceOf(wallet.address);
        console.log(`  Deployer VCN Balance: ${formatVCN(deployerBalance.toString())} VCN\n`);
    }

    // Filter out the deployer address
    const deployerLower = DRY_RUN ? "" : wallet.address.toLowerCase();
    const transferEntries = Array.from(walletBalances.entries())
        .filter(([addr]) => addr !== deployerLower && addr !== "0x0000000000000000000000000000000000000000")
        .filter(([, balance]) => balance > BigInt(0));

    console.log(`  Addresses to transfer: ${transferEntries.length}\n`);

    let restored = 0;
    let failed = 0;
    let totalTransferred = BigInt(0);

    // Sort by balance descending for visibility
    transferEntries.sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

    for (const [address, amount] of transferEntries) {
        const formatted = formatVCN(amount.toString());
        const idx = restored + failed + 1;

        if (DRY_RUN) {
            console.log(`  [DRY ${idx}/${transferEntries.length}] ${address} -> ${formatted} VCN`);
            restored++;
            totalTransferred += amount;
        } else {
            try {
                process.stdout.write(`  [${idx}/${transferEntries.length}] ${address.slice(0, 14)}... -> ${formatted} VCN ... `);
                const tx = await vcnToken.transfer(address, amount);
                await tx.wait();
                restored++;
                totalTransferred += amount;
                console.log("OK");
            } catch (err) {
                failed++;
                console.log(`FAILED: ${err.message.slice(0, 60)}`);
            }
        }
    }

    // ─── Step 5: Summary ────────────────────────────────────────────────
    console.log("\n" + "=".repeat(70));
    console.log("  Restoration Complete");
    console.log("=".repeat(70));
    console.log(`  Snapshot addresses:     ${snapshot.addressCount}`);
    console.log(`  Mining reward wallets:  ${nodesWithRewards} (${newWallets} new)`);
    console.log(`  Total wallets:          ${walletBalances.size}`);
    console.log(`  Transferred:            ${restored}`);
    console.log(`  Failed:                 ${failed}`);
    console.log(`  Total VCN transferred:  ${formatVCN(totalTransferred.toString())} VCN`);
    console.log(`    - From snapshot:      ${snapshot.totalSupplyFormatted} VCN`);
    console.log(`    - From mining:        ${totalMinedVCN.toFixed(6)} VCN`);

    if (!DRY_RUN && vcnToken) {
        const finalBalance = await vcnToken.balanceOf(wallet.address);
        console.log(`\n  Deployer remaining:     ${formatVCN(finalBalance.toString())} VCN`);
    }

    // ─── Step 6: Save restoration log ───────────────────────────────────
    const logPath = path.join(__dirname, '../../snapshots/restoration-log.json');
    const log = {
        timestamp: new Date().toISOString(),
        dryRun: DRY_RUN,
        snapshotDate: snapshot.timestamp,
        snapshotBlock: snapshot.blockNumber,
        snapshotAddresses: snapshot.addressCount,
        miningNodes: nodesWithRewards,
        newMinerWallets: newWallets,
        totalWallets: walletBalances.size,
        restored,
        failed,
        totalVCNTransferred: ethers.formatEther(totalTransferred),
        totalMinedVCNAdded: totalMinedVCN.toFixed(6),
        miningDetails: miningRewards.map(r => ({
            nodeId: r.nodeId,
            wallet: r.wallet,
            email: r.email,
            pending: r.pending.toFixed(6),
            claimed: r.claimed.toFixed(6),
            totalMined: r.totalMined.toFixed(6),
        })),
    };

    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log(`\n  Restoration log saved to: ${logPath}`);
    console.log();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("FATAL ERROR:", error);
        process.exit(1);
    });
