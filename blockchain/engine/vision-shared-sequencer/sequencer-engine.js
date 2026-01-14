require('dotenv').config();
const { Kafka } = require('kafkajs');

const KAFKA_BROKERS = [process.env.KAFKA_BROKER || '46.224.221.201:9092'];
const GROUP_ID = 'vision-shared-sequencer-group';
const BATCH_INTERVAL_MS = 500; // Build a block every 500ms (High Throughput)

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
                const { chainId, signedTx } = payload;

                if (!mempool[chainId]) mempool[chainId] = [];
                mempool[chainId].push(payload);

                console.log(`📥 [Chain ${chainId}] Buffered Tx. Pool Size: ${mempool[chainId].length}`);
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
