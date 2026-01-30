// scripts/reindex-transactions.ts
// Run this script to re-index historical VCN Transfer events from blockchain to Firestore
// Usage: npx tsx scripts/reindex-transactions.ts

import { ethers } from 'ethers';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Firebase config (same as client)
const firebaseConfig = {
    apiKey: "AIzaSyBOhaRLa86vxEp0vCqS5adp54RqBt1RtHc",
    authDomain: "visionchain-d19ed.firebaseapp.com",
    projectId: "visionchain-d19ed",
    storageBucket: "visionchain-d19ed.firebasestorage.app",
    messagingSenderId: "451188892027",
    appId: "1:451188892027:web:1c5232d790dc32cfee1dde"
};

const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const RPC_URL = "http://46.224.221.201:8545";
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function main() {
    console.log("Starting historical transaction re-indexing...");

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Initialize provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);

    // Query Transfer events from block 0 to current (or limit as needed)
    const startBlock = 0;
    const endBlock = currentBlock;

    console.log(`Querying Transfer events from block ${startBlock} to ${endBlock}...`);

    const filter = {
        address: VCN_TOKEN,
        topics: [TRANSFER_TOPIC],
        fromBlock: startBlock,
        toBlock: endBlock
    };

    const logs = await provider.getLogs(filter);
    console.log(`Found ${logs.length} Transfer events`);

    // Parse and index each event
    let indexed = 0;
    for (const log of logs) {
        try {
            // Decode Transfer event: from (indexed), to (indexed), value
            const from = "0x" + log.topics[1].slice(26).toLowerCase();
            const to = "0x" + log.topics[2].slice(26).toLowerCase();
            const value = ethers.formatUnits(log.data, 18);

            // Get block timestamp
            const block = await provider.getBlock(log.blockNumber);
            const timestamp = block ? block.timestamp * 1000 : Date.now();

            // Index to Firestore
            await setDoc(doc(db, 'transactions', log.transactionHash), {
                hash: log.transactionHash,
                chainId: 1337,
                type: 'Transfer',
                from_addr: from,
                to_addr: to,
                value: value,
                timestamp: timestamp,
                block_number: log.blockNumber,
                status: 'indexed',
                metadata: {
                    method: 'VCN Token Transfer',
                    source: 'historical_reindex'
                }
            });

            indexed++;
            if (indexed % 10 === 0) {
                console.log(`Indexed ${indexed}/${logs.length} transactions...`);
            }
        } catch (e) {
            console.error(`Failed to index tx ${log.transactionHash}:`, e);
        }
    }

    console.log(`\nDone! Indexed ${indexed} transactions to Firestore.`);
}

main().catch(console.error);
