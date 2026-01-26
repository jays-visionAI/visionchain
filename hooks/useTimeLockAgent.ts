
import {
    retryScheduledTask
} from '../services/firebaseService';

export const useTimeLockAgent = (
    userEmail: () => string | undefined,
    queueTasks: () => any[]
) => {

    const handleForceExecute = async (taskId: string) => {
        const email = userEmail();
        if (!email) return;

        const task = queueTasks().find(t => t.id === taskId);
        if (!task) return;

        // If task is already executing, confirm before resetting
        if (task.status === 'EXECUTING') {
            const confirmRetry = confirm("This task is currently being processed by the Agent. Do you want to force a reset and retry? (Use this only if the process is stuck)");
            if (!confirmRetry) return;
        }

        try {
            console.log(`[Agent] Signaling backend to retry task: ${taskId}`);
            await retryScheduledTask(taskId);
            // The backend runner (schedulerRunner.ts) will pick this up on its next tick
        } catch (e: any) {
            console.error("Failed to signal retry:", e);
            alert("Failed to trigger retry. Please try again.");
        }
    };

    // Note: The client-side scheduler interval has been removed.
    // Execution is now handled exclusively by the Backend Runner (scripts/runScheduler.ts)
    // to ensure reliable processing without requiring the user's browser or MetaMask to be active.

    return {
        handleForceExecute
    };
};

