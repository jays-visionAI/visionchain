require('dotenv').config();
const { ethers } = require('ethers');
const axios = require('axios');

// Configuration
// In production, these come from .env
const RPC_URL = "https://rpc.visionchain.co";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "YOUR_PRIVATE_KEY"; // Must be the 'oracleAddress' in MiningPool
const MINING_POOL_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; // From previous deploy log
const NODE_LICENSE_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const SEQUENCER_API = "https://api.visionchain.co/health"; // To check network load

// ABIs
const MiningPoolABI = [
    "function submitDailyAOR(uint256 _tokenId, uint256 _aor) external",
    "function calculateDailyReward(uint256 _tokenId) public view returns (uint256)",
    "function owner() view returns (address)"
];

const NodeLicenseABI = [
    "function currentValidatorCount() view returns (uint256)",
    "function currentEnterpriseCount() view returns (uint256)",
    "function currentFounderCount() view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)"
];

async function main() {
    console.log("🧠 Vision AI Oracle Starting...");

    // Setup Provider & Signer
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    // Be careful with Private Keys in code. In prod, use secure vault.
    // For this demo, we assume the deployer (Account 0) is the Oracle.
    // Hardhat Account #0 Private Key for dev/testnet (matches setup_node.sh)
    const wallet = new ethers.Wallet(process.env.VISION_ADMIN_PK, provider);

    const miningPool = new ethers.Contract(MINING_POOL_ADDRESS, MiningPoolABI, wallet);
    const nodeLicense = new ethers.Contract(NODE_LICENSE_ADDRESS, NodeLicenseABI, wallet);

    console.log(`🔗 Connected to Network. Oracle Address: ${wallet.address}`);

    // Main Loop
    setInterval(async () => {
        try {
            await runAIAnalysis(miningPool, nodeLicense);
        } catch (e) {
            console.error("❌ AI Cycle Error:", e);
        }
    }, 60000); // Run every minute (for demo purposes) -> In prod, daily or hourly
}

async function runAIAnalysis(miningPool, nodeLicense) {
    console.log(`\n--- 🕵️‍♀️ AI Analysis Cycle [${new Date().toISOString()}] ---`);

    // 1. Get Network Metrics (Input Features for AI)
    let networkLoad = 0;
    try {
        // Fetch real-time load from Sequencer
        // const res = await axios.get(SEQUENCER_API);
        // networkLoad = res.status === 200 ? 1 : 0; 
        networkLoad = Math.random(); // Simulating load fluctuation
    } catch (e) { console.warn("Sequencer offline?"); }

    // 2. Iterate over all Nodes
    // Note: On mainnet, we would allow batch updates or use Merkle Roots to save gas.
    const vCount = await nodeLicense.currentValidatorCount();
    const eCount = await nodeLicense.currentEnterpriseCount();
    const fCount = await nodeLicense.currentFounderCount();
    const totalNodes = Number(vCount) + Number(eCount) + Number(fCount);

    console.log(`📊 Analyzing ${totalNodes} Active Nodes...`);

    for (let i = 1; i <= totalNodes; i++) {
        const tokenId = i;

        // 3. AI Inference: Calculate AOR (AI Operating Rate)
        // Score = Base (80%) + Uptime (Random) + NetworkContribution (Load)
        const baseScore = 80;
        const uptimeBonus = Math.floor(Math.random() * 20); // 0-20%
        const loadBonus = networkLoad > 0.8 ? 10 : 0; // Bonus during high traffic

        let aor = baseScore + uptimeBonus + loadBonus;
        if (aor > 100) aor = 100;

        // 4. Submit to Chain
        console.log(`   > Node #${tokenId}: AI Score = ${aor}%`);

        try {
            // Check current day to avoid double submittion if we were smarter
            // For demo, we just overwrite (gas heavy, but shows it working)
            const tx = await miningPool.submitDailyAOR(tokenId, aor);
            await tx.wait();
            console.log(`     ✅ On-Chain Updated! (Tx: ${tx.hash.substring(0, 10)}...)`);
        } catch (err) {
            console.error(`     ❌ Update Failed: ${err.message}`);
        }
    }
}

main();
