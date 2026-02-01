import {
    retryScheduledTask,
    markTaskAsSent
} from '../services/firebaseService';
import { contractService } from '../services/contractService';

// Track in-flight executions to prevent duplicates
const executingTasks = new Set<string>();

export const useTimeLockAgent = (
    userEmail: () => string | undefined,
    queueTasks: () => any[]
) => {

    const handleForceExecute = async (taskId: string) => {
        // CRITICAL: Prevent duplicate execution
        if (executingTasks.has(taskId)) {
            console.warn(`[Agent] Task ${taskId} is already being executed, ignoring duplicate call`);
            return;
        }

        const email = userEmail();
        if (!email) return;

        const task = queueTasks().find(t => t.id === taskId);
        if (!task) return;

        // If task is already executing, confirm before resetting
        if (task.status === 'EXECUTING') {
            const confirmRetry = confirm("This task is currently being processed by the Agent. Do you want to force a reset and retry? (Use this only if the process is stuck)");
            if (!confirmRetry) return;
        }

        // Mark as executing
        executingTasks.add(taskId);

        try {
            // New: Try Client-side Execution First if Overdue
            if (task.contractScheduleId && task.executeAt && Date.now() >= task.executeAt) {
                console.log(`[Agent] Attempting client-side execution for Schedule ID: ${task.contractScheduleId}`);

                try {
                    const tx = await contractService.executeScheduledTransfer(task.contractScheduleId);
                    console.log("[Agent] Client-side execution successful:", tx.hash);

                    await markTaskAsSent(taskId, tx.hash);
                    alert("Force Execution Successful! Task marked as SENT.");
                    return;
                } catch (execErr: any) {
                    console.warn("[Agent] Client-side execution failed, falling back to signal:", execErr);
                    // If error is "not yet unlocked" or revert, maybe warn user?
                    // But for resilience, we fall through to signaling backend.
                }
            }

            console.log(`[Agent] Signaling backend to retry task: ${taskId}`);
            await retryScheduledTask(taskId);
            // The backend runner (schedulerRunner.ts) will pick this up on its next tick
            alert("Signal sent to Agent Network. Task priority boosted.");
        } catch (e: any) {
            console.error("Failed to signal retry:", e);
            alert("Failed to trigger retry. Please try again.");
        } finally {
            // Always clear the executing flag
            executingTasks.delete(taskId);
        }
    };

    // Note: The client-side scheduler interval has been removed.
    // Execution is now handled exclusively by the Backend Runner (scripts/runScheduler.ts)
    // to ensure reliable processing without requiring the user's browser or MetaMask to be active.

    return {
        handleForceExecute
    };
};

