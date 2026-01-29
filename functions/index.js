
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { ethers } = require("ethers");

admin.initializeApp();
const db = admin.firestore();

// Configuration
const RPC_URL = "http://46.224.221.201:8545"; // Testnet
// Secret for Executor Private Key (set via: firebase functions:secrets:set EXECUTOR_PK)
const executorPkSecret = defineSecret("EXECUTOR_PK");
// Fallback key for testnet (Hardhat default account #0)
const TESTNET_EXECUTOR_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TIMELOCK_ADDRESS = "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb";
const TIMELOCK_ABI = [
  "function executeTransfer(uint256 scheduleId) external",
  "function scheduleTransferNative(address to, uint256 unlockTime) external payable returns (uint256)",
  "event TransferScheduled(uint256 indexed scheduleId, address indexed creator, address indexed to, uint256 amount, uint256 unlockTime)",
];

// --- Paymaster TimeLock (Gasless Scheduled Transfers) ---
exports.paymasterTimeLock = onRequest({ cors: true, invoker: "public", secrets: [executorPkSecret] }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user, recipient, amount, unlockTime, fee, deadline } = req.body;

    // Validation
    if (!user || !recipient || !amount || !unlockTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify deadline
    if (deadline && Math.floor(Date.now() / 1000) > deadline) {
      return res.status(400).json({ error: "Request expired" });
    }

    console.log(`[Paymaster] TimeLock request from ${user}`);
    console.log(`[Paymaster] Recipient: ${recipient}, Amount: ${amount}, UnlockTime: ${unlockTime}`);

    // Setup Blockchain Connection with Admin Wallet
    // Use secret if available, otherwise fallback to testnet key
    const executorKey = executorPkSecret.value() || TESTNET_EXECUTOR_KEY;
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(executorKey, provider);
    const contract = new ethers.Contract(TIMELOCK_ADDRESS, TIMELOCK_ABI, adminWallet);

    // Execute TimeLock Schedule on behalf of user
    const amountWei = BigInt(amount);
    const tx = await contract.scheduleTransferNative(recipient, unlockTime, { value: amountWei });
    console.log(`[Paymaster] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Paymaster] TX confirmed in block ${receipt.blockNumber}`);

    // Parse scheduleId from event
    let scheduleId = null;
    for (const log of receipt.logs || []) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "TransferScheduled") {
          scheduleId = parsed.args.scheduleId.toString();
          break;
        }
      } catch (e) {
        // Not our event
      }
    }

    // Save to Firestore for scheduler to execute later
    const jobRef = await db.collection("scheduledTransfers").add({
      scheduleId: scheduleId,
      from: user,
      to: recipient,
      amount: amount,
      unlockTimeTs: admin.firestore.Timestamp.fromMillis(unlockTime * 1000),
      status: "WAITING",
      createdAt: admin.firestore.Timestamp.now(),
      txHash: tx.hash,
      fee: fee || "0",
      type: "TIMELOCK_PAYMASTER",
    });

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      scheduleId: scheduleId,
      jobId: jobRef.id,
    });
  } catch (err) {
    console.error("[Paymaster] TimeLock Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// --- Secure Wallet Update ---
exports.updateWalletAddress = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { walletAddress, isVerified } = request.data;
  const email = request.auth.token.email; // Trust auth token email

  if (!email) {
    throw new HttpsError("failed-precondition",
      "User email missing from auth token.");
  }

  const emailLower = email.toLowerCase();

  try {
    // 1. Update User Profile
    const updateData = {
      walletReady: true,
      walletAddress: walletAddress,
      updatedAt: new Date().toISOString(),
    };
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    await db.collection("users").doc(emailLower).set(updateData, { merge: true });

    // 2. Update Token Sales (if exists)
    const tokenSaleRef = db.collection("token_sales").doc(emailLower);
    const tsDoc = await tokenSaleRef.get();
    if (tsDoc.exists) {
      await tokenSaleRef.update({
        walletAddress: walletAddress,
        status: "WalletCreated",
      });
    }

    // 3. Update Referrer's Contact List (Force Sync)
    const userSnap = await db.collection("users").doc(emailLower).get();
    const userData = userSnap.data();

    if (userData && userData.referrerId) {
      const referrerId = userData.referrerId;
      console.log(`[Wallet] Updating referrer ${referrerId} contact list...`);

      // Add/Update contact in referrer's list
      const refContactRef = db.collection("users").doc(referrerId).collection("contacts").doc(emailLower);

      // We use set with merge to ensure it exists or updates
      await refContactRef.set({
        email: emailLower,
        internalName: emailLower.split("@")[0], // Default name if missing
        address: walletAddress,
        vchainUserUid: emailLower,
        syncStatus: "verified",
        phone: userData.phone || "",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return { success: true };
  } catch (err) {
    console.error("Update Wallet Failed:", err);
    throw new HttpsError("internal", "Database update failed");
  }
});

exports.scheduledTransferTrigger = onSchedule("every 1 minutes",
  async (_event) => {
    console.log("Scheduler triggered:", new Date().toISOString());
    const nowTs = admin.firestore.Timestamp.now();
    const nowMillis = Date.now();

    // 0. Recover Stuck Jobs
    try {
      const stuckSnapshot = await db.collection("scheduledTransfers")
        .where("status", "==", "EXECUTING")
        .where("lockExpiresAt", "<", nowTs)
        .limit(50)
        .get();

      if (!stuckSnapshot.empty) {
        console.log(`Recovering ${stuckSnapshot.size} stuck jobs...`);
        const batch = db.batch();
        stuckSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "WAITING",
            lockExpiresAt: null,
            lastError: "RECOVERED: Lock expired",
          });
        });
        await batch.commit();
      }
    } catch (e) {
      // Fallback if index missing: Fetch all EXECUTING and filter in memory
      const stuckSnapshot = await db.collection("scheduledTransfers")
        .where("status", "==", "EXECUTING")
        .limit(50)
        .get();

      const stuckDocs = stuckSnapshot.docs.filter((d) => {
        const dData = d.data();
        return dData.lockExpiresAt &&
          dData.lockExpiresAt.toMillis() < nowMillis;
      });

      if (stuckDocs.length > 0) {
        console.log(`Recovering ${stuckDocs.length} stuck jobs (Manual)...`);
        const batch = db.batch();
        stuckDocs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "WAITING",
            lockExpiresAt: null,
            lastError: "RECOVERED: Lock expired",
          });
        });
        await batch.commit();
      }
    }

    // 1. Fetch WAITING jobs
    // Querying without time filter to avoid composite index reqs
    const jobsRef = db.collection("scheduledTransfers");
    const q = jobsRef.where("status", "==", "WAITING").limit(50);

    const snapshot = await q.get();
    if (snapshot.empty) {
      console.log("No WAITING jobs found.");
      return;
    }

    // 2. Filter in-memory for due jobs
    const dueJobs = snapshot.docs.filter((doc) => {
      const data = doc.data();
      // Check Unlock Time
      if (!data.unlockTimeTs ||
        data.unlockTimeTs.toMillis() > nowMillis) return false;
      // Check Retry Time (if exists)
      if (data.nextRetryAt &&
        data.nextRetryAt.toMillis() > nowMillis) return false;
      return true;
    });

    if (dueJobs.length === 0) {
      console.log("Found jobs, but none are due yet.");
      return;
    }

    console.log(`Processing ${dueJobs.length} due jobs...`);

    // 3. Setup Blockchain Connection
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(TESTNET_EXECUTOR_KEY, provider);
    const contract = new ethers.Contract(TIMELOCK_ADDRESS,
      TIMELOCK_ABI, wallet);

    // 4. Execute Jobs
    // Note: We execute sequentially to manage nonce automatically.
    // Parallel execution would require explicit nonce management.
    let currentNonce = await wallet.getNonce();

    for (const docSnap of dueJobs) {
      const jobId = docSnap.id;
      const data = docSnap.data();
      let skipped = false;

      try {
        // Optimistic Locking
        await db.runTransaction(async (t) => {
          const freshDoc = await t.get(docSnap.ref);
          const freshData = freshDoc.data();
          if (freshData.status !== "WAITING") {
            throw new Error("Status changed");
          }

          t.update(docSnap.ref, {
            status: "EXECUTING",
            lockAt: nowTs,
          });
        });
      } catch (e) {
        console.log(`Skipping ${jobId}: ${e.message}`);
        skipped = true;
      }

      if (skipped) continue;

      try {
        console.log(`Executing ID: ${data.scheduleId} nonce ${currentNonce}`);

        // Execute with specific nonce to prevent race conditions
        const tx = await contract.executeTransfer(data.scheduleId, {
          nonce: currentNonce,
        });

        console.log(`   Hash: ${tx.hash}`);

        // Increment Local Nonce immediately to unblock next job
        currentNonce++;

        // Update Success (Async)
        // We don't await tx.wait() inside the loop to speed up processing
        // But valid nonce management relies on the order.
        // Since we use the same wallet, we SHOULD ideally wait or manage
        // pending nonces.
        // For stability, we wait for 1 confirmation.
        await tx.wait(1);

        await docSnap.ref.update({
          status: "SENT",
          executedAt: admin.firestore.Timestamp.now(),
          txHash: tx.hash,
          error: null, // Clear prev errors
        });
        console.log(`Success: ${jobId}`);
      } catch (err) {
        console.error(`Failed Job ${jobId}:`, err);

        // CRITICAL: If nonce issue, reset nonce from network
        if (err.message && (err.message.includes("nonce") ||
          err.message.includes("replacement"))) {
          console.log("Refetching nonce due to error...");
          currentNonce = await wallet.getNonce();
        } else {
          // For other errors (reverts), we bump nonce to prevent stuck queue?
          // Actually, if it failed locally (pre-mining), nonce isn't used.
          // If it reverted on chain, nonce IS used.
          // It's hard to distinguish without parsing.
          // Safer strategy: Always refetch nonce on error.
          currentNonce = await wallet.getNonce();
        }

        // Retry Logic
        const retryCount = (data.retryCount || 0) + 1;
        let newStatus = "WAITING";
        let nextRetry = null;

        if (retryCount >= 5) { // Increased max retries
          newStatus = "FAILED";
        } else {
          nextRetry = admin.firestore.Timestamp.fromMillis(
            nowMillis + (retryCount * 60000), // 1m, 2m, 3m...
          );
        }

        await docSnap.ref.update({
          status: newStatus,
          lastError: err.message, // Store error for UI
          retryCount: retryCount,
          nextRetryAt: nextRetry,
        });
      }
    }
  });
