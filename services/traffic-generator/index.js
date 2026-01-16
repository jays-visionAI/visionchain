require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
const RPC_URL = process.env.RPC_URL || "http://46.224.221.201:8545";
const SEQUENCER_URL = process.env.SEQUENCER_URL || "http://46.224.221.201:3000/rpc/submit";
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "3151909"); // Vision Testnet ID

// Private key of the Master Faucet (In a real scenario, use environment variables)
// Using a placeholder for now - User should provide this or we use a known testnet faucet
const MASTER_KEY = process.env.MASTER_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const provider = new ethers.JsonRpcProvider(RPC_URL);
const masterWallet = new ethers.Wallet(MASTER_KEY, provider);

// Memory in-memory wallet store
let activeWallets = [];

const TX_TYPES = ['A110', 'S200', 'B410', 'R500', 'D600', 'X-BRIDGE'];
const TAX_CATEGORIES = ['Taxable', 'Exempt', 'Cross-border', 'N/A'];
const METHODS = ['Swap', 'Transfer', 'Stake', 'Mint', 'Settle'];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Generate random accounting metadata
 */
const generateMetadata = (type) => {
    const isBridge = type === 'X-BRIDGE';
    return {
        method: isBridge ? "Bridge-In" : METHODS[Math.floor(Math.random() * METHODS.length)],
        counterparty: isBridge ? "Ethereum-Sepolia Bridge" : "Simulated Agent #" + getRandomInt(1, 100),
        accountingBasis: "Cash",
        taxCategory: isBridge ? "Cross-border" : TAX_CATEGORIES[Math.floor(Math.random() * TAX_CATEGORIES.length)],
        confidence: getRandomInt(85, 100),
        trustStatus: "inferred",
        bridgeContext: isBridge ? {
            sourceChain: "Ethereum Sepolia",
            destinationChain: "Vision Testnet v2",
            isCrossChain: true,
            originalAsset: "fVCN",
            bridgedAsset: "VCN"
        } : null,
        netEffect: [
            { account: "Cash/VCN", amount: getRandomInt(10, 500), type: "debit" },
            { account: "Exp/Gas", amount: getRandomInt(1, 10), type: "credit" }
        ],
        journalEntries: isBridge ? [
            { account: "Interchain-Transit", dr: getRandomInt(10, 100), cr: 0 },
            { account: "VCN-Asset", dr: 0, cr: getRandomInt(10, 100) }
        ] : [
            { account: "VCN-Asset", dr: getRandomInt(10, 100), cr: 0 },
            { account: "Revenue-Sim", dr: 0, cr: getRandomInt(10, 100) }
        ]
    };
};

/**
 * Submit transaction to the Shared Sequencer
 */
const submitToSequencer = async (signedTx, type, metadata) => {
    try {
        const response = await axios.post(SEQUENCER_URL, {
            chainId: CHAIN_ID,
            signedTx,
            type,
            metadata
        });
        console.log(`✅ [Sequencer] Tx Submitted: ${response.data.status} | TxId: ${response.data.sequencerTxId}`);
    } catch (error) {
        console.error(`❌ [Sequencer] Submission Failed:`, error.response?.data || error.message);
    }
};

/**
 * Simulate the traffic loop
 */
const startTrafficLoop = async () => {
    console.log("🚀 Vision Chain Traffic Simulator Started...");
    console.log(`📡 Linked to RPC: ${RPC_URL}`);
    console.log(`🔗 Sequencer Endpoint: ${SEQUENCER_URL}`);

    while (true) {
        try {
            // 1. Random Interval (10 to 25 seconds)
            const waitTime = getRandomInt(10 * 1000, 25 * 1000);
            console.log(`\n🕒 Next action in ${waitTime / 1000}s...`);
            await sleep(waitTime);

            // 2. Decide Action: Create New Wallet or Send from Existing
            const shouldCreateNew = activeWallets.length < 5 || Math.random() > 0.6;

            if (shouldCreateNew) {
                // Create Wallet
                const newWallet = ethers.Wallet.createRandom().connect(provider);
                console.log(`🆕 Created New Wallet: ${newWallet.address}`);

                // Fund from Master
                console.log(`💰 Funding ${newWallet.address} from Master Faucet...`);
                const tx = {
                    to: newWallet.address,
                    value: ethers.parseEther("0.1"), // Send 0.1 VCN
                };

                const signedTx = await masterWallet.signTransaction(tx);
                const metadata = generateMetadata('A110');
                await submitToSequencer(signedTx, 'A110', metadata);

                activeWallets.push(newWallet);
            } else if (activeWallets.length > 0) {
                // Send from one random wallet to another or to a fixed address
                const sender = activeWallets[Math.floor(Math.random() * activeWallets.length)];
                const receiver = activeWallets[Math.floor(Math.random() * activeWallets.length)].address;

                if (sender.address === receiver) continue; // Skip self-transfer

                console.log(`💸 Sending Tx: ${sender.address} -> ${receiver}`);

                const tx = {
                    to: receiver,
                    value: ethers.parseEther((Math.random() * 0.05).toFixed(4)),
                };

                const signedTx = await sender.signTransaction(tx);
                const type = TX_TYPES[Math.floor(Math.random() * TX_TYPES.length)];
                const metadata = generateMetadata(type);

                await submitToSequencer(signedTx, type, metadata);
            }

            // Cleanup: Keep pool small for demo
            if (activeWallets.length > 20) {
                activeWallets.shift();
            }

        } catch (err) {
            console.error("💥 Error in Simulation Loop:", err);
            await sleep(5000);
        }
    }
};

startTrafficLoop();
