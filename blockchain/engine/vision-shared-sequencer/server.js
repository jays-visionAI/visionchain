require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Kafka } = require('kafkajs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const KAFKA_BROKERS = [process.env.KAFKA_BROKER || '46.224.221.201:9092'];

// SQLite Setup (Reader)
const dbPath = path.resolve(__dirname, 'sequencer.db');
const db = new sqlite3.Database(dbPath);

const kafka = new Kafka({
    clientId: 'vision-shared-sequencer-api',
    brokers: KAFKA_BROKERS,
});

const producer = kafka.producer();

// Connect to Kafka
const connectKafka = async () => {
    try {
        await producer.connect();
        console.log('✅ Connected to Kafka Broker as Producer');
    } catch (err) {
        console.error('❌ Failed to connect to Kafka:', err);
        setTimeout(connectKafka, 5000); // Retry logic
    }
};

connectKafka();

/**
 * Endpoint: Submit Transaction with Metadata (VisionScan Support)
 */
app.post('/rpc/submit', async (req, res) => {
    const { chainId, signedTx, type, metadata } = req.body;

    if (!chainId || !signedTx) {
        return res.status(400).json({ error: 'Missing chainId or signedTx' });
    }

    try {
        await producer.send({
            topic: 'shared-sequencer-input',
            messages: [
                {
                    key: String(chainId),
                    value: JSON.stringify({
                        chainId,
                        signedTx,
                        timestamp: Date.now(),
                        type: type || 'evm',
                        metadata: metadata || {} // VisionScan Metadata (e.g., Tax Category)
                    })
                },
            ],
        });

        console.log(`🚀 [Chain:${chainId}] Tx Ingested: ${signedTx.substring(0, 10)}... | Meta: ${!!metadata}`);

        res.json({
            status: 'sequenced',
            sequencerTxId: Date.now(),
            message: 'Transaction accepted by Shared Sequencer'
        });

    } catch (error) {
        console.error('Failed to send to Kafka:', error);
        res.status(500).json({ error: 'Internal Sequencer Error' });
    }
});

/**
 * Endpoint: Get Transactions (VisionScan Explorer)
 */
app.get('/api/transactions', (req, res) => {
    const { limit, type, from, to } = req.query;
    let query = `SELECT * FROM transactions WHERE 1=1`;
    const params = [];

    if (type && type !== 'All') {
        query += ` AND type = ?`;
        params.push(type);
    }
    if (from) {
        query += ` AND from_addr LIKE ?`;
        params.push(`%${from}%`);
    }
    if (to) {
        query += ` AND to_addr LIKE ?`;
        params.push(`%${to}%`);
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit || 50);

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        // Parse metadata_json back to object
        const results = rows.map(r => ({
            ...r,
            metadata: JSON.parse(r.metadata_json || '{}')
        }));
        res.json(results);
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', brokers: KAFKA_BROKERS });
});

app.listen(PORT, () => {
    console.log(`🌐 Shared Sequencer API running on port ${PORT}`);
});
