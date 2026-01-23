require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const RPC_URL = "http://172.20.0.11:8545";
const SEQUENCER_URL = "http://localhost:3000/rpc/submit";
const CHAIN_ID = 1337;

// Test Parameters
const TARGET_TPS = parseInt(process.env.TARGET_TPS || "3000");
const DURATION_SECONDS = parseInt(process.env.DURATION || "30");
const BATCH_SIZE = 500; // Increased batch size

console.log(`\n========================================`);
console.log(`  VISION CHAIN ULTRA-HIGH LOAD TEST`);
console.log(`========================================`);
console.log(`Target TPS: ${TARGET_TPS}`);
console.log(`Duration: ${DURATION_SECONDS}s`);
console.log(`========================================\n`);

let totalSent = 0;
let totalSuccess = 0;
let totalFailed = 0;
let startTime = Date.now();

const sendBatch = async () => {
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
        promises.push(
            axios.post(SEQUENCER_URL, {
                chainId: CHAIN_ID,
                signedTx: "0x" + Math.random().toString(16).slice(2).padEnd(64, '0'),
                type: "ULTRA_LOAD_TEST",
                metadata: { high_load: true }
            }).then(() => {
                totalSuccess++;
            }).catch(() => {
                totalFailed++;
            })
        );
    }
    totalSent += BATCH_SIZE;
    await Promise.allSettled(promises);
};

const runTest = async () => {
    const endTime = startTime + (DURATION_SECONDS * 1000);
    const intervalMs = 1000 / (TARGET_TPS / BATCH_SIZE);

    console.log(`Batch Interval: ${intervalMs.toFixed(2)}ms`);

    const ticker = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentTps = totalSent / elapsed;
        console.log(`[${elapsed.toFixed(1)}s] Sent: ${totalSent} | Success: ${totalSuccess} | Failed: ${totalFailed} | Actual TPS: ${currentTps.toFixed(1)}`);

        if (Date.now() > endTime) {
            clearInterval(ticker);
            const finalElapsed = (Date.now() - startTime) / 1000;
            const finalTps = totalSent / finalElapsed;
            console.log(`\n========================================`);
            console.log(`  FINAL RESULTS`);
            console.log(`========================================`);
            console.log(`Avg TPS: ${finalTps.toFixed(2)}`);
            console.log(`Total TX: ${totalSent}`);
            console.log(`Success Rate: ${((totalSuccess / totalSent) * 100).toFixed(2)}%`);
            process.exit(0);
        }
    }, 5000);

    while (Date.now() < endTime) {
        sendBatch(); // Don't await here to allow true parallelism
        await new Promise(r => setTimeout(r, intervalMs));
    }
};

runTest().catch(console.error);
