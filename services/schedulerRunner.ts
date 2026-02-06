import { ethers } from 'ethers';
import { getFirebaseDb, createNotification, findUserByAddress } from './firebaseService';
import { collection, query, where, limit, getDocs, updateDoc, doc, runTransaction, Timestamp, increment, setDoc } from 'firebase/firestore';

// --- Configuration ---
const MAX_RETRIES = 3;
const EXECUTION_BATCH_SIZE = 50; // Max jobs per tick
const LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes lock
const RPC_URL = "https://api.visionchain.co/rpc-proxy"; // Vision Chain v2
const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PAYMASTER_ADMIN = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Paymaster Transfer API URL
const PAYMASTER_TRANSFER_URL = "https://paymastertransfer-sapjcm3s5a-uc.a.run.app";

// VCN Token ABI for permit and transferFrom
const VCN_TOKEN_ABI = [
    "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
    "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
    "function balanceOf(address account) external view returns (uint256)"
];

interface ScheduleJob {
    id: string; // Document ID
    scheduleId: number; // Contract ID
    status: 'WAITING' | 'EXECUTING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
    retryCount: number;
    nextRetryAt: Timestamp;
    lockExpiresAt?: Timestamp;
    unlockTime: number;
}

/**
 * Main Runner Function: Scheduled to run every minute (e.g. via Cron)
 */
export const runSchedulerTick = async () => {
    console.log("Scheduler tick started:", new Date().toISOString());

    const db = getFirebaseDb();
    const now = new Date();
    const nowTs = Timestamp.fromDate(now);

    // --- 0. Recover Stuck Jobs ---
    // Tasks that are 'EXECUTING' but their lock has expired should be reset to 'WAITING'
    // --- 0. Recover Stuck Jobs ---
    // Tasks that are 'EXECUTING' but their lock has expired should be reset to 'WAITING'
    const stuckRef = collection(db, 'scheduledTransfers');
    const stuckQ = query(
        stuckRef,
        where('status', '==', 'EXECUTING'),
        limit(50) // Fetch potential stuck jobs
    );
    const stuckSnapshot = await getDocs(stuckQ);
    if (!stuckSnapshot.empty) {
        const stuckDocs = stuckSnapshot.docs.filter(d => {
            const data = d.data();
            return data.lockExpiresAt && data.lockExpiresAt.toMillis() < now.getTime();
        });

        if (stuckDocs.length > 0) {
            console.log(`-> Recovering ${stuckDocs.length} stuck jobs...`);
            for (const stuckDoc of stuckDocs) {
                await updateDoc(stuckDoc.ref, {
                    status: 'WAITING',
                    lockExpiresAt: null,
                    lastError: 'RECOVERED: Runner lock expired'
                });
            }
        }
    }

    // 1. Query Due Jobs
    const jobsRef = collection(db, 'scheduledTransfers');

    // Optimization: Query only by WAITING status to avoid composite index requirements
    const q = query(
        jobsRef,
        where('status', '==', 'WAITING'),
        limit(100) // Fetch more to filter in memory
    );

    console.log("-> Querying WAITING tasks (in-memory time filter)");
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
        console.log("-> No WAITING jobs found.");
        return;
    }

    // Filter for unlockTime <= now
    const readyJobs = snapshot.docs.filter(docSnap => {
        const data = docSnap.data();
        if (!data.unlockTimeTs) return false;
        return data.unlockTimeTs.toMillis() <= now.getTime();
    });

    if (readyJobs.length === 0) {
        console.log("-> Found WAITING jobs but none are due yet.");
        return;
    }

    // Secondary Filter: only pick those where nextRetryAt <= now
    const eligibleJobs = readyJobs.filter(docSnap => {
        const data = docSnap.data();
        if (!data.nextRetryAt) return true; // Default to due
        return data.nextRetryAt.toMillis() <= now.getTime();
    });

    if (eligibleJobs.length === 0) {
        console.log("-> Found due tasks but none are past their nextRetryAt yet.");
        return;
    }

    // 2. Process Jobs
    console.log(`-> Processing ${eligibleJobs.length} eligible jobs.`);

    const EXECUTOR_PRIVATE_KEY = process.env.VITE_EXECUTOR_PK || '';
    if (!EXECUTOR_PRIVATE_KEY) {
        console.error("Critical: VITE_EXECUTOR_PK is missing.");
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider); // Paymaster/Executor Wallet
    const vcnToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

    // 2. Process Each Job
    for (const jobDoc of eligibleJobs) {
        const jobId = jobDoc.id;
        const jobData = jobDoc.data();

        try {
            await runTransaction(db, async (transaction) => {
                const docRef = doc(db, 'scheduledTransfers', jobId);
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw "Doc missing";

                const data = docSnap.data() as ScheduleJob;

                // Double check conditions inside transaction (Optimistic Locking)
                if (data.status !== 'WAITING') return; // Changed elsewhere
                if (data.lockExpiresAt && data.lockExpiresAt.toMillis() > now.getTime()) return; // Still locked by another runner

                // 3. Acquire Distributed Lock
                transaction.update(docRef, {
                    status: 'EXECUTING',
                    lockAt: nowTs,
                    lockExpiresAt: Timestamp.fromMillis(now.getTime() + LOCK_TIMEOUT_MS),
                    lockOwner: `executor-${Math.random().toString(36).substring(7)}`
                });
            });

            // 4. Execute Transfer using Admin Wallet (Paymaster pattern)
            // The admin wallet executes transferFrom(sender, recipient, amount)
            // This requires the sender to have approved the admin wallet (done via permit during scheduling)
            console.log(`Executing TimeLock Transfer: ${jobId}`);
            console.log(`   From: ${jobData.senderAddress}, To: ${jobData.recipient}, Amount: ${jobData.amount}`);

            const amountBigInt = BigInt(jobData.amount || 0);

            // Execute transferFrom - admin calls on behalf of user
            const tx = await vcnToken.transferFrom(
                jobData.senderAddress,
                jobData.recipient,
                amountBigInt
            );
            console.log(`   Hash: ${tx.hash}`);

            // Wait for confirmation
            await tx.wait(1);

            // 5. Update Success Status
            await updateDoc(doc(db, 'scheduledTransfers', jobId), {
                status: 'SENT',
                executedAt: Timestamp.now(),
                txHash: tx.hash
            });
            console.log(`Success: ${jobId}`);

            // 5b. Record in transactions collection for History page
            const taskData = jobDoc.data();
            try {
                await setDoc(doc(db, 'transactions', tx.hash), {
                    hash: tx.hash,
                    from_addr: taskData.senderAddress?.toLowerCase() || '',
                    to_addr: taskData.recipient?.toLowerCase() || '',
                    value: String(taskData.amount || 0),
                    timestamp: Date.now(),
                    type: 'Time Lock Transfer',
                    status: 'success',
                    block_number: 0, // Will be updated if needed
                    source: 'TIMELOCK_AGENT',
                    scheduleId: taskData.scheduleId
                });
                console.log(`Transaction recorded: ${tx.hash}`);
            } catch (txRecordErr) {
                console.warn("Failed to record transaction:", txRecordErr);
            }

            // 6. Create Notifications
            const symbol = taskData.token || 'VCN';

            // To Sender
            await createNotification(taskData.userEmail, {
                type: 'transfer_scheduled',
                title: 'Scheduled Transfer Complete',
                content: `Successfully sent ${taskData.amount} ${symbol} to ${taskData.recipient.slice(0, 8)}... via Time Lock Agent.`,
                data: { txHash: tx.hash, jobId }
            });

            // To Recipient
            try {
                const recipientUser = await findUserByAddress(taskData.recipient);
                if (recipientUser && recipientUser.email) {
                    await createNotification(recipientUser.email, {
                        type: 'transfer_received',
                        title: 'Token Received',
                        content: `You received ${taskData.amount} ${symbol} from ${taskData.userEmail} via Time Lock Agent.`,
                        data: { txHash: tx.hash, sender: taskData.userEmail }
                    });
                }
            } catch (notifyErr) {
                console.warn("Failed to notify recipient", notifyErr);
            }

        } catch (error: any) {
            console.error(`Failed Job ${jobId}:`, error);

            // 6. Error Handling & Retry Logic
            let newStatus = 'WAITING';
            let nextRetry = null;
            let failureReason = error.message || String(error);

            // Classify Errors
            if (failureReason.includes("Time still locked")) {
                // Determine real unlock time? Keep waiting.
            } else if (failureReason.includes("Transfer already executed") || failureReason.includes("Invalid status")) {
                newStatus = 'SENT'; // Or FAILED/CANCELLED depending on investigation, usually SENT means done elsewhere
            } else if (jobDoc.data().retryCount >= MAX_RETRIES) {
                newStatus = 'FAILED';
            } else {
                // Exponential Backoff with Jitter: 1m, 5m, 15m...
                const retryCount = (jobDoc.data().retryCount || 0) + 1;
                const baseDelayMinutes = Math.pow(3, retryCount); // 3, 9, 27... or custom 1, 5, 15
                const jitter = Math.floor(Math.random() * 60 * 1000); // 0-60s jitter
                const delayMs = (baseDelayMinutes * 60 * 1000) + jitter;
                nextRetry = Timestamp.fromMillis(now.getTime() + delayMs);
            }

            await updateDoc(doc(db, 'scheduledTransfers', jobId), {
                status: newStatus as any,
                lastError: failureReason,
                retryCount: increment(1),
                nextRetryAt: nextRetry || jobDoc.data().nextRetryAt, // Keep old if not retrying
                lockExpiresAt: null // Release lock
            });
        }
    }
};
