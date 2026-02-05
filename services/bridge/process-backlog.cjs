/**
 * Process Backlogged Bridge Transactions
 * 
 * Scans Firebase for PENDING bridge transactions and processes them
 */

const { ethers } = require('ethers');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Firebase Admin 초기화
const serviceAccount = require('../../firebase-service-account.json');
initializeApp({
    credential: cert(serviceAccount)
});
const db = getFirestore();

const config = {
    srcChainId: 1337,
    dstChainId: 11155111,
    srcRpc: process.env.VISION_RPC || 'https://api.visionchain.co/rpc-proxy',
    dstRpc: process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
    dstMessageInbox: process.env.SRC_MESSAGE_INBOX,
    tssPrivateKey: process.env.TSS_PRIVATE_KEY
};

const MESSAGE_INBOX_ABI = [
    "function submitPending(uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, bytes32 intentHash, bytes calldata tssSignature) external returns (bytes32)"
];

async function processBacklog() {
    console.log("=== Processing Backlogged Bridge Transactions ===\n");

    const dstProvider = new ethers.JsonRpcProvider(config.dstRpc);
    const signer = new ethers.Wallet(config.tssPrivateKey, dstProvider);
    const messageInbox = new ethers.Contract(config.dstMessageInbox, MESSAGE_INBOX_ABI, signer);

    console.log(`TSS Address: ${signer.address}`);
    console.log(`Sepolia MessageInbox: ${config.dstMessageInbox}\n`);

    // Get PENDING bridge transactions from Firebase
    const snapshot = await db.collection('transactions')
        .where('type', '==', 'Bridge')
        .where('bridgeStatus', '==', 'PENDING')
        .get();

    console.log(`Found ${snapshot.size} pending bridge transactions\n`);

    if (snapshot.size === 0) {
        console.log("No pending transactions to process!");
        process.exit(0);
    }

    let processed = 0;
    let failed = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`\n--- Processing ${doc.id.slice(0, 10)}... ---`);
        console.log(`  From: ${data.from_addr}`);
        console.log(`  Value: ${data.value} VCN`);
        console.log(`  Intent Hash: ${data.intentHash}`);

        if (!data.intentHash) {
            console.log("  SKIP: No intentHash found");
            failed++;
            continue;
        }

        try {
            // Sign the intent
            const intentData = {
                srcChainId: config.srcChainId,
                dstChainId: config.dstChainId,
                token: ethers.ZeroAddress, // Native VCN
                amount: ethers.parseEther(data.value.toString()),
                recipient: data.from_addr,
                intentHash: data.intentHash
            };

            const messageHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint256', 'uint256', 'address', 'uint256', 'address', 'bytes32'],
                    [intentData.srcChainId, intentData.dstChainId, intentData.token, intentData.amount, intentData.recipient, intentData.intentHash]
                )
            );
            const signature = await signer.signMessage(ethers.getBytes(messageHash));
            console.log("  Signed");

            // Submit to Sepolia
            console.log("  Submitting to Sepolia...");
            const tx = await messageInbox.submitPending(
                intentData.srcChainId,
                intentData.dstChainId,
                intentData.token,
                intentData.amount,
                intentData.recipient,
                intentData.intentHash,
                signature,
                { gasLimit: 500000 }
            );

            console.log(`  Tx: ${tx.hash}`);
            await tx.wait();
            console.log("  SUCCESS!");

            // Update Firebase status
            await doc.ref.update({
                bridgeStatus: 'SUBMITTED',
                relayTxHash: tx.hash,
                relayedAt: Date.now()
            });

            processed++;

        } catch (error) {
            console.error(`  ERROR: ${error.message}`);
            failed++;

            // Mark as failed if it's a permanent error
            if (error.message.includes('already processed') || error.message.includes('already exists')) {
                await doc.ref.update({
                    bridgeStatus: 'COMPLETED',
                    note: 'Already processed on destination chain'
                });
            }
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log("\n=== Summary ===");
    console.log(`Processed: ${processed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${snapshot.size}`);

    process.exit(0);
}

processBacklog().catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
});
