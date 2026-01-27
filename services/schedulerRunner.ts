import { ethers } from 'ethers';
import { getFirebaseDb, createNotification, findUserByAddress } from './firebaseService';
import { collection, query, where, limit, getDocs, updateDoc, doc, runTransaction, Timestamp, increment } from 'firebase/firestore';

// --- Configuration ---
const MAX_RETRIES = 3;
const EXECUTION_BATCH_SIZE = 50; // Max jobs per tick
const LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes lock
const EXECUTOR_PRIVATE_KEY = process.env.VITE_EXECUTOR_PK || '';
const RPC_URL = "http://46.224.221.201:8545"; // Testnet Cluster
const TIMELOCK_ADDRESS = "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb";

// ABI for execute function only
const TIMELOCK_ABI = [
    "function executeTransfer(uint256 scheduleId) external"
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
    const wallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider); // Paymaster/Executor Wallet
    const contract = new ethers.Contract(TIMELOCK_ADDRESS, TIMELOCK_ABI, wallet);

    // 2. Process Each Job
    for (const jobDoc of eligibleJobs) {
        const jobId = jobDoc.id;
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

            // 4. Submit Execute Transaction (Real Blockchain Interaction)
            console.log(`Executing Schedule ID: ${jobDoc.data().scheduleId}`);

            // Note: This is where we use the Paymaster wallet directly. 
            // In a more complex Paymaster setup (ERC-4337), this would build a UserOp.
            // But per requirement, we use existing Paymaster pipeline which usually means 
            // the server wallet IS the paymaster for these admin actions.
            const tx = await contract.executeTransfer(jobDoc.data().scheduleId);
            console.log(`   Hash: ${tx.hash}`);

            // Wait for confirmation (optional, but good for immediate status update)
            await tx.wait(1);

            // 5. Update Success Status
            await updateDoc(doc(db, 'scheduledTransfers', jobId), {
                status: 'SENT',
                executedAt: Timestamp.now(),
                txHash: tx.hash
            });
            console.log(`Success: ${jobId}`);

            // 6. Create Notifications
            const taskData = jobDoc.data();
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
