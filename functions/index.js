
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const {ethers} = require("ethers");

admin.initializeApp();
const db = admin.firestore();

// Configuration
const RPC_URL = "http://46.224.221.201:8545"; // Testnet
// Note: In production, use defineSecret('EXECUTOR_PK')
const EXECUTOR_PRIVATE_KEY = process.env.VITE_EXECUTOR_PK ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TIMELOCK_ADDRESS = "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb";
const TIMELOCK_ABI = ["function executeTransfer(uint256 scheduleId) external"];

exports.scheduledTransferTrigger = onSchedule("every 1 minutes",
    async (event) => {
      console.log("Scheduler triggered:", new Date().toISOString());
      const nowTs = admin.firestore.Timestamp.now();
      const nowMillis = Date.now();

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
      const wallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
      const contract = new ethers.Contract(TIMELOCK_ADDRESS,
          TIMELOCK_ABI, wallet);

      // 4. Execute Jobs
      // Note: We execute sequentially to manage nonce automatically.
      // Parallel execution would require explicit nonce management.
      let currentNonce = await wallet.getNonce();

      for (const docSnap of dueJobs) {
        const jobId = docSnap.id;
        const data = docSnap.data();

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

          console.log(`Executing ID: ${data.scheduleId} nonce ${currentNonce}`);

          // Execute with specific nonce to prevent race conditions if scaling
          const tx = await contract.executeTransfer(data.scheduleId, {
            nonce: currentNonce,
          });

          console.log(`   Hash: ${tx.hash}`);

          // Wait for 1 confirmation to ensure ordering
          await tx.wait(1);

          // Increment Local Nonce
          currentNonce++;

          // Update Success
          await docSnap.ref.update({
            status: "SENT",
            executedAt: admin.firestore.Timestamp.now(),
            txHash: tx.hash,
          });
          console.log(`Success: ${jobId}`);
        } catch (err) {
          console.error(`Failed Job ${jobId}:`, err);

          // If execution failed but NOT due to status change...
          // reset nonce just in case
          if (err.message && err.message.includes("nonce")) {
          // Refresh nonce for next iteration just in case
            currentNonce = await wallet.getNonce();
          }

          // Retry Logic
          const retryCount = (data.retryCount || 0) + 1;
          let newStatus = "WAITING";
          let nextRetry = null;

          if (retryCount >= 3) {
            newStatus = "FAILED";
          } else {
            nextRetry = admin.firestore.Timestamp.fromMillis(
                nowMillis + (retryCount * 60000),
            );
          }

          // Only update if it wasn't a Status Changed error
          if (err.message !== "Status changed") {
            await docSnap.ref.update({
              status: newStatus,
              lastError: err.message,
              retryCount: retryCount,
              nextRetryAt: nextRetry,
            });
          }
        }
      }
    });
