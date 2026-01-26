
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

    const processScheduledTask = async (task: any) => {
        const email = userEmail();
        if (!email) return;

        // Double Check: Avoid re-executing
        if (!task || task.status !== 'WAITING') {
            if (task && (task.status === 'EXECUTING' || task.status === 'SENT')) {
                alert("이미 실행된 컨트랙트입니다. (Transaction already processed)");
            }
            return;
        }

        try {
            console.log(`[Scheduler] Executing Task ${task.id}...`);
            await updateScheduledTaskStatus(email, task.id, { status: 'EXECUTING' });

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
        if (task) processScheduledTask(task);
    };

    // Scheduler Interval
    createEffect(() => {
        const tasks = queueTasks();
        if (!tasks.some(t => t.status === 'WAITING')) return;

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
                if (task.status === 'WAITING' && task.executeAt && task.executeAt <= now) {
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
