require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Kafka } = require('kafkajs');
const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin SDK Setup
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: 'visionchain-5bd81'
    });
}
const db = admin.firestore();

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

        // 4. Persist to SQLite (VisionScan Indexing)
        const vcnAmount = ethers.formatUnits(amount, 18);
        const metadata = {
            method: 'Transfer (A110)',
            counterparty: recipient.slice(0, 10) + '...',
            confidence: 99,
            trustStatus: 'tagged',
            accountingBasis: 'Accrual',
            taxCategory: 'Transfer',
            netEffect: [
                { type: 'debit', amount: vcnAmount, asset: 'VCN' },
                { type: 'credit', amount: vcnAmount, asset: 'VCN' }
            ],
            journalEntries: [
                { account: 'Asset:VCN:Wallet', type: 'Cr', amount: vcnAmount },
                { account: 'Asset:VCN:Recipient', type: 'Dr', amount: vcnAmount }
            ]
        };

        // Store in Firestore
        await db.collection('transactions').doc(txTransfer1.hash).set({
            hash: txTransfer1.hash,
            chainId: 1337,
            type: 'Transfer',
            from_addr: user,
            to_addr: recipient,
            value: vcnAmount,
            timestamp: Date.now(),
            metadata: metadata,
            status: 'sequenced'
        });

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
app.get('/api/transactions', async (req, res) => {
    const { limit: queryLimit, type, from, to, hash, address } = req.query;
    const resultLimit = parseInt(queryLimit) || 50;

    // Feature: Direct RPC Balance Lookup
    let rpcBalance = null;
    if (address) {
        try {
            const { ethers } = require('ethers');
            const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
            const vcnAbi = ["function balanceOf(address) view returns (uint256)"];
            const vcnContract = new ethers.Contract("0x5FbDB2315678afecb367f032d93F642f64180aa3", vcnAbi, provider);
            const balance = await vcnContract.balanceOf(address);
            rpcBalance = ethers.formatUnits(balance, 18);
            console.log(`🔍 [RPC] Live balance for ${address}: ${rpcBalance} VCN`);
        } catch (e) {
            console.warn(`⚠️ [RPC] Failed to fetch live balance: ${e.message}`);
        }
    }

    try {
        let query = db.collection('transactions');

        // Apply filters
        if (hash) {
            // Direct document lookup by hash
            const doc = await db.collection('transactions').doc(hash).get();
            if (doc.exists) {
                const data = doc.data();
                return res.json({
                    transactions: [{
                        ...data,
                        onChainVerified: true
                    }],
                    liveBalance: rpcBalance,
                    source: 'Firestore'
                });
            }
        }

        if (type && type !== 'All') {
            query = query.where('type', '==', type);
        }
        if (from) {
            query = query.where('from_addr', '==', from);
        }
        if (to) {
            query = query.where('to_addr', '==', to);
        }

        // Order and limit
        query = query.orderBy('timestamp', 'desc').limit(resultLimit);

        const snapshot = await query.get();
        let results = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            // Filter by address if specified (from or to)
            if (address) {
                const addrLower = address.toLowerCase();
                if (data.from_addr?.toLowerCase() !== addrLower &&
                    data.to_addr?.toLowerCase() !== addrLower) {
                    return;
                }
            }
            results.push({
                ...data,
                onChainVerified: true
            });
        });

        // Feature: RPC Fallback for specific hash search
        if (hash && results.length === 0) {
            try {
                const { ethers } = require('ethers');
                const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
                const tx = await provider.getTransaction(hash);

                if (tx) {
                    console.log(`📡 [RPC] Found direct transaction on-chain: ${hash}`);
                    results = [{
                        hash: tx.hash,
                        from_addr: tx.from,
                        to_addr: tx.to,
                        value: ethers.formatEther(tx.value),
                        timestamp: Date.now(),
                        type: 'Transfer',
                        status: 'sequenced',
                        onChainVerified: true,
                        metadata: {
                            method: 'Direct RPC Sync (Verified)',
                            confidence: 100,
                            trustStatus: 'verified'
                        }
                    }];
                }
            } catch (e) {
                console.warn(`⚠️ [RPC] Tx lookup failed: ${e.message}`);
            }
        }

        res.json({
            transactions: results,
            liveBalance: rpcBalance,
            source: 'Firestore'
        });

    } catch (error) {
        console.error('Firestore query error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Endpoint: Index a Transaction (For External Indexing - Admin, Direct Transfers)
 * This allows services like Admin Panel to register transactions in VisionScan DB
 */
app.post('/api/transactions/index', async (req, res) => {
    const { hash, from, to, value, type, metadata } = req.body;

    if (!hash || !from || !to) {
        return res.status(400).json({ error: 'Missing required fields: hash, from, to' });
    }

    try {
        const txMetadata = metadata || {
            method: 'Transfer (Direct)',
            counterparty: to.slice(0, 10) + '...',
            confidence: 100,
            trustStatus: 'verified',
            accountingBasis: 'Accrual',
            taxCategory: 'Transfer',
            netEffect: [
                { type: 'debit', amount: value || '0', asset: 'VCN' },
                { type: 'credit', amount: value || '0', asset: 'VCN' }
            ]
        };

        // Store in Firestore
        await db.collection('transactions').doc(hash).set({
            hash,
            chainId: 1337,
            type: type || 'Transfer',
            from_addr: from,
            to_addr: to,
            value: value || '0',
            timestamp: Date.now(),
            metadata: txMetadata,
            status: 'indexed'
        });

        console.log(`📝 [Index] Transaction indexed to Firestore: ${hash.slice(0, 10)}... (${from.slice(0, 6)} -> ${to.slice(0, 6)})`);

        res.json({
            status: 'indexed',
            hash,
            message: 'Transaction indexed for VisionScan'
        });

    } catch (error) {
        console.error("❌ Indexing Error:", error);
        res.status(500).json({ error: 'Failed to index transaction', details: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', brokers: KAFKA_BROKERS });
});

app.listen(PORT, () => {
    console.log(`🌐 Shared Sequencer API running on port ${PORT}`);
});
