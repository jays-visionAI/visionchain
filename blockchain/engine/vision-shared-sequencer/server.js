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
            chainId: 1337,
            name: 'vision_testnet_v2'
        }, { staticNetwork: true });
        const block = await provider.getBlockNumber();
        res.json({ status: 'online', blockNumber: block, chainId: 1337 });
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
    const PAYMASTER_ADDRESS = process.env.PAYMASTER_ADDRESS || "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf";
    const PAYMASTER_PK = process.env.PAYMASTER_PK || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Account #0 (Owner)
    const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Account #2

    try {
        const { ethers } = require('ethers');
        const rpcProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", {
            chainId: 1337,
            name: 'vision_testnet_v2'
        }, { staticNetwork: true });

        const relayerWallet = new ethers.Wallet(PAYMASTER_PK, rpcProvider);

        // ABIs
        const tokenAbi = [
            "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
            "function transferFrom(address from, address to, uint256 value) external returns (bool)",
            "function interfaceId() view returns (bytes4)" // helper
        ];
        const paymasterAbi = [
            "function execute(address target, uint256 value, bytes calldata data) external returns (bytes memory)"
        ];

        const tokenInterface = new ethers.Interface(tokenAbi);
        const paymasterContract = new ethers.Contract(PAYMASTER_ADDRESS, paymasterAbi, relayerWallet);

        const sig = ethers.Signature.from(signature);
        const totalValue = BigInt(amount) + BigInt(fee);

        console.log(`⚡️ Smart Relayer Processing: User ${user} -> Recipient ${recipient} (${amount})`);
        console.log(`   Executing through Paymaster: ${PAYMASTER_ADDRESS}`);
        let txPermit, txTransfer1, txTransfer2;

        // 1. Proxy Permit
        console.log(`   Step 1: Proxying Permit via Paymaster (User: ${user}, Spender: ${PAYMASTER_ADDRESS})...`);
        const permitData = tokenInterface.encodeFunctionData("permit", [
            user,
            PAYMASTER_ADDRESS, // Spender is the Paymaster contract
            totalValue,
            deadline,
            sig.v,
            sig.r,
            sig.s
        ]);

        try {
            txPermit = await paymasterContract.execute(token, 0, permitData);
            console.log("      Transaction sent, waiting for receipt...");
            await txPermit.wait();
            console.log("   ✅ Proxy Permit Successful:", txPermit.hash);
        } catch (e) {
            console.error("   ❌ Step 1 (Permit) FAILED:", e.message);
            throw new Error(`Permit Failed: ${e.message}`);
        }

        // 2. Proxy Transfer to Recipient
        console.log(`   Step 2: Proxying Transfer to Recipient (To: ${recipient}, Value: ${amount})...`);
        const transferData1 = tokenInterface.encodeFunctionData("transferFrom", [user, recipient, amount]);
        try {
            txTransfer1 = await paymasterContract.execute(token, 0, transferData1);
            await txTransfer1.wait();
            console.log("   ✅ Proxy Transfer 1 Successful:", txTransfer1.hash);
        } catch (e) {
            console.error("   ❌ Step 2 (Transfer) FAILED:", e.message);
            throw new Error(`Transfer 1 Failed: ${e.message}`);
        }

        // 3. Proxy Transfer Fee to Treasury
        console.log(`   Step 3: Proxying Fee to Treasury (Treasury: ${TREASURY_ADDRESS}, Fee: ${fee})...`);
        const transferData2 = tokenInterface.encodeFunctionData("transferFrom", [user, TREASURY_ADDRESS, fee]);
        try {
            txTransfer2 = await paymasterContract.execute(token, 0, transferData2);
            await txTransfer2.wait();
            console.log("   ✅ Proxy Transfer 2 Successful:", txTransfer2.hash);
        } catch (e) {
            console.error("   ❌ Step 3 (Fee) FAILED:", e.message);
            throw new Error(`Fee Transfer Failed: ${e.message}`);
        }

        res.json({
            status: 'success',
            txHashes: {
                permit: txPermit?.hash,
                transfer: txTransfer1?.hash,
                fee: txTransfer2?.hash
            },
            message: 'Gasless transfer completed via Smart Relayer Proxy'
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
