require('dotenv').config();
const { Kafka } = require('kafkajs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const KAFKA_BROKERS = [process.env.KAFKA_BROKER || '46.224.221.201:9092'];
const GROUP_ID = 'vision-shared-sequencer-group';
const BATCH_INTERVAL_MS = 500; // Build a block every 500ms (High Throughput)

// SQLite Setup
const dbPath = path.resolve(__dirname, 'sequencer.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        hash TEXT PRIMARY KEY,
        chainId INTEGER,
        type TEXT,
        from_addr TEXT,
        to_addr TEXT,
        value TEXT,
        timestamp INTEGER,
        metadata_json TEXT,
        status TEXT DEFAULT 'sequenced'
    )`);
});

const kafka = new Kafka({
    clientId: 'vision-shared-sequencer-engine',
    brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: GROUP_ID });
const producer = kafka.producer();

// In-memory Mempool: { chainId: [tx1, tx2, ...] }
const mempool = {};

const connectEngine = async () => {
    try {
        await consumer.connect();
        await producer.connect();

        await consumer.subscribe({ topic: 'shared-sequencer-input', fromBeginning: true });
        console.log('✅ Sequencer Engine Started & Subscribed to Inputs');

        // Start processing loop
        consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const payload = JSON.parse(message.value.toString());
                const { chainId, signedTx, type, timestamp, metadata } = payload;

                // 1. Buffer for Batching
                if (!mempool[chainId]) mempool[chainId] = [];
                mempool[chainId].push(payload);

                // 2. Persist to SQLite (VisionScan Indexing)
                // In a real system, we'd extract from/to from signedTx. 
                // For this demo, we assume metadata or basic parsing.
                const mockHash = '0x' + Math.random().toString(16).slice(2, 12) + '...'; // Mock Hash for non-EVM demo

                const stmt = db.prepare(`INSERT OR REPLACE INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                stmt.run(
                    mockHash,
                    chainId,
                    type || 'S200',
                    metadata?.from || '0xUser',
                    metadata?.to || '0xSystem',
                    metadata?.value || '0',
                    timestamp || Date.now(),
                    JSON.stringify(metadata || {}),
                    'sequenced'
                );
                stmt.finalize();

                console.log(`📥 [Chain ${chainId}] Buffered & Indexed. Pool: ${mempool[chainId].length}`);
            },
        });

        // Start Batch Production Interval
        setInterval(produceBatches, BATCH_INTERVAL_MS);

    } catch (err) {
        console.error('Sequencer specific error:', err);
    }
};

const produceBatches = async () => {
    // Iterate over all active chains in the mempool
    const chains = Object.keys(mempool);

    for (const chainId of chains) {
        const txs = mempool[chainId];

        if (txs.length === 0) continue;

        // Drain the pool for this tick
        const batchTxs = [...txs];
        mempool[chainId] = [];

        const batchData = {
            batchId: Date.now(),
            chainId: chainId,
            transactionCount: batchTxs.length,
            transactions: batchTxs.map(t => t.signedTx),
            timestamp: Date.now(),
            sequencerSignature: 'mock-sig-by-vision-sequencer' // Proof of Authority
        };

        const batchTopic = `chain-${chainId}-batches`;

        try {
            await producer.send({
                topic: batchTopic,
                messages: [{ value: JSON.stringify(batchData) }]
            });
            console.log(`📦 [Chain ${chainId}] Batch Produced! ${batchTxs.length} txs -> Topic: ${batchTopic}`);
        } catch (err) {
            console.error(`❌ Failed to produce batch for chain ${chainId}:`, err);
            // Re-queue transactions on failure
            mempool[chainId] = [...batchTxs, ...mempool[chainId]];
        }
    }
};

connectEngine();
