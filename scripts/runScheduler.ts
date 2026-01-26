
import { runSchedulerTick } from '../services/schedulerRunner';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("-----------------------------------------");
    console.log("VISION TIME-LOCK AGENT BACKEND ACTIVE");
    console.log("-----------------------------------------");
    console.log("Monitoring scheduled transfers...");

    // Initial run
    try {
        await runSchedulerTick();
    } catch (e) {
        console.error("Initial tick failed:", e);
    }

    // Interval loop (Every 1 minute)
    setInterval(async () => {
        try {
            await runSchedulerTick();
        } catch (e) {
            console.error("Scheduler tick error:", e);
        }
    }, 60000);
}

main().catch(err => {
    console.error("Fatal Error in TimeLock Runner:", err);
    process.exit(1);
});
