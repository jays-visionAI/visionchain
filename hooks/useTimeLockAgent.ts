
import { createEffect, onCleanup } from 'solid-js';
import {
    updateScheduledTaskStatus,
    createNotification,
    findUserByAddress,
    cancelScheduledTask
} from '../services/firebaseService';
import { contractService } from '../services/contractService';

// Helper for generic short address if not imported
const shortAddr = (str: string) => str ? `${str.slice(0, 6)}...${str.slice(-4)}` : '';

export const useTimeLockAgent = (
    userEmail: () => string | undefined,
    queueTasks: () => any[]
) => {

    const processScheduledTask = async (task: any, isForced: boolean = false) => {
        const email = userEmail();
        if (!email) return;

        // Fresh DB check: Avoid re-executing
        const currentDbStatus = task.dbStatus || task.status;
        if (!task || currentDbStatus === 'SENT' || currentDbStatus === 'executed') {
            return;
        }

        // Only block if it's REALLY being processed in DB (not just optimistic UI)
        if (!isForced && (currentDbStatus === 'EXECUTING' || currentDbStatus === 'processing')) {
            return;
        }


        // If Forced (Manual Retry) on an Executing task, ask for confirmation
        if (isForced && task.status === 'EXECUTING') {
            const confirmRetry = confirm("This task is marked as 'Processing'. Do you want to force retry? (Only do this if the transaction is stuck)");
            if (!confirmRetry) return;
        }

        try {
            console.log(`[Scheduler] Executing Task ${task.id}...`);
            await updateScheduledTaskStatus(email, task.id, { status: 'EXECUTING' });

            // Ensure Wallet is Connected
            if (!contractService.isWalletConnected()) {
                // If Auto-Scheduler: Do NOT disturb user with popup. Just skip.
                if (!isForced) {
                    console.log("[Scheduler] Wallet not connected. Skipping execution.");
                    return;
                }

                // If Force Execute (Manual): Try to connect because user asked for it.
                console.log("[Force Run] Attempting to connect wallet...");
                await contractService.connectWallet();
                if (!contractService.isWalletConnected()) {
                    throw new Error("Wallet connection failed. Please connect your wallet to execute.");
                }
            }

            // Execute Transfer
            const symbol = task.token || 'VCN';
            const receipt = await contractService.sendTokens(task.recipient, task.amount, symbol);
            const txHash = receipt.hash || "0xMockHash";

            // Update status to SENT
            await updateScheduledTaskStatus(email, task.id, {
                status: 'SENT',
                txHash,
                executedAt: new Date().toISOString()
            });

            // Notify Sender
            await createNotification(email, {
                type: 'transfer_scheduled',
                title: 'Scheduled Transfer Complete',
                content: `Successfully sent ${task.amount} ${symbol} to ${shortAddr(task.recipient)}.`,
                data: { txHash, scheduleId: task.id }
            });

            // Notify Recipient
            try {
                const recipientUser = await findUserByAddress(task.recipient);
                if (recipientUser && recipientUser.email) {
                    await createNotification(recipientUser.email, {
                        type: 'transfer_received',
                        title: 'Token Received',
                        content: `You received ${task.amount} ${symbol} from ${email} via Time Lock Agent.`,
                        data: { txHash, sender: email }
                    });
                }
            } catch (notifyErr) {
                console.warn("Failed to notify recipient", notifyErr);
            }

        } catch (e: any) {
            console.error("Scheduled execution failed:", e);
            await updateScheduledTaskStatus(email, task.id, {
                status: 'FAILED',
                error: e.message || "Execution error"
            });
        }
    };

    const handleForceExecute = (taskId: string) => {
        const task = queueTasks().find(t => t.id === taskId);
        if (task) processScheduledTask(task, true);
    };

    // Scheduler Interval
    createEffect(() => {
        const tasks = queueTasks();
        if (!tasks.some(t => ['WAITING', 'EXECUTING'].includes(t.status))) return;

        const timer = setInterval(() => {
            const now = Date.now();
            // Use fresh tasks reference inside interval if possible, 
            // but in SolidJS effect re-runs when dependency changes.
            // Since interval is inside effect that depends on queueTasks(), 
            // it will be recreated when tasks change. This is acceptable for now.
            // Better: use a ref for tasks or ensure queueTasks() is accessed inside?
            // Actually, if queueTasks() changes, this effect re-runs and restarts interval.
            // That's fine as long as updates aren't super frequent (seconds).

            tasks.forEach(task => {
                const isPending = task.dbStatus === 'pending' || task.status === 'WAITING';
                if (isPending && task.executeAt && task.executeAt <= now) {
                    processScheduledTask(task);
                }
            });
        }, 2000);

        onCleanup(() => clearInterval(timer));
    });

    return {
        processScheduledTask,
        handleForceExecute
    };
};
