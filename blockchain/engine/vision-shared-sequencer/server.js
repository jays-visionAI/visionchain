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

// Manual RPC Proxy to handle Geth connectivity and CORS
app.post('/rpc-proxy', async (req, res) => {
    // Explicitly set CORS for preflight and actual requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const http = require('http');
    const postData = JSON.stringify(req.body);

    const options = {
        hostname: '127.0.0.1',
        port: 8545,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 10000
    };

    const proxyReq = http.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => {
            try {
                res.json(JSON.parse(data));
            } catch (e) {
                res.status(500).json({ error: 'Invalid JSON from node', raw: data });
            }
        });
    });

    proxyReq.on('error', (err) => {
        console.error('RPC Proxy Error:', err.message);
        res.status(504).json({
            error: 'Gateway Timeout',
            details: err.message,
            node: '127.0.0.1:8545'
        });
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.status(504).json({ error: 'Request Timeout', node: '127.0.0.1:8545' });
    });

    proxyReq.write(postData);
    proxyReq.end();
});

// Diagnostic endpoint
app.get('/debug-rpc', async (req, res) => {
    try {
        const { ethers } = require('ethers');
        const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", {
            chainId: 3151909,
            name: 'vision_testnet_v2'
        }, { staticNetwork: true });
        const block = await provider.getBlockNumber();
        res.json({ status: 'online', blockNumber: block, chainId: 3151909 });
    } catch (e) {
        res.status(500).json({ status: 'offline', error: e.message });
    }
});

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
 * Endpoint: Paymaster Gasless Transfer (Relayer)
 */
app.post('/rpc/paymaster/transfer', async (req, res) => {
    const { user, token, recipient, amount, fee, deadline, signature } = req.body;

    // Minimal validation
    if (!user || !token || !recipient || !amount || !signature) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    /* 
       Paymaster Configuration 
       In a real scenario, these would be loaded from secure vaults.
       WE USE HARDCODED KEYS FOR DEMO PURPOSES ONLY.
    */
    const PAYMASTER_PK = process.env.PAYMASTER_PK || "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Account #2
    const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account #3

    try {
        const { ethers } = require('ethers');
        // Setup Provider
        // Use Internal RPC with Static Network to prevent detection failures under load
        const rpcProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", {
            chainId: 3151909,
            name: 'vision_testnet_v2'
        }, { staticNetwork: true });

        const paymasterWallet = new ethers.Wallet(PAYMASTER_PK, rpcProvider);

        // Minimal ABI for Permit + TransferFrom
        const abi = [
            "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
            "function transferFrom(address from, address to, uint256 value) external returns (bool)",
            "function nonces(address owner) external view returns (uint256)"
        ];

        const tokenContract = new ethers.Contract(token, abi, paymasterWallet);

        // Parse Signature
        const sig = ethers.Signature.from(signature);

        console.log(`⚡️ Paymaster Processing: User ${user} -> Recipient ${recipient} (${amount})`);
        console.log(`   Fee: ${fee} -> Treasury ${TREASURY_ADDRESS}`);

        // 1. Submit Permit (Gas paid by Paymaster)
        // Note: value for permit should be amount + fee
        const totalValue = BigInt(amount) + BigInt(fee);

        console.log("   Step 1: Executing Permit...");
        // We need to be careful with Nonces if sending multiple txs rapidly.
        // Ideally we used a Multicall, but we will chain transactions here.

        const txPermit = await tokenContract.permit(
            user,
            paymasterWallet.address,
            totalValue,
            deadline,
            sig.v,
            sig.r,
            sig.s
        );
        await txPermit.wait();
        console.log("   ✅ Permit Successful:", txPermit.hash);

        // 2. Transfer to Recipient
        console.log("   Step 2: Transferring to Recipient...");
        const txTransfer1 = await tokenContract.transferFrom(user, recipient, amount);
        await txTransfer1.wait();
        console.log("   ✅ Transfer 1 Successful:", txTransfer1.hash);

        // 3. Transfer Fee to Treasury
        console.log("   Step 3: Transferring Fee to Treasury...");
        const txTransfer2 = await tokenContract.transferFrom(user, TREASURY_ADDRESS, fee);
        await txTransfer2.wait();
        console.log("   ✅ Transfer 2 Successful:", txTransfer2.hash);

        res.json({
            status: 'success',
            txHashes: {
                permit: txPermit.hash,
                transfer: txTransfer1.hash,
                fee: txTransfer2.hash
            },
            message: 'Gasless transfer completed successfully'
        });

    } catch (error) {
        console.error("❌ Paymaster Error:", error);
        res.status(500).json({
            error: 'Paymaster execution failed',
            details: error.message
        });
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
