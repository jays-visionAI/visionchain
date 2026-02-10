// Deploy BridgeStaking V2 - Step 2 only (gas already funded)
// Usage: node scripts/deployOnly.js
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const STAKING_ADMIN = "0xAFf852Ee7DF3C036719e7b5461840aA2c66aC0ae";
const PAYMASTER_ADDR = "0x08A1B183a53a0f8f1D875945D504272738E3AF34";

async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(r => rl.question(q, a => r(a.trim())));

    console.log("=== Deploy BridgeStaking V2 ===");
    console.log(`Expected deployer: ${STAKING_ADMIN}\n`);

    const pk = await ask("Paste staking admin private key (0xAFf8... wallet), then press Enter: ");
    rl.close();

    if (!pk || pk.length < 64) {
        console.error(`ERROR: Invalid key length (${pk.length} chars). Need 64+ hex chars.`);
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(pk, provider);
    const addr = await wallet.getAddress();
    console.log(`\nDeployer: ${addr}`);

    if (addr.toLowerCase() !== STAKING_ADMIN.toLowerCase()) {
        console.error(`ERROR: Expected ${STAKING_ADMIN}, got ${addr}`);
        process.exit(1);
    }

    const balance = await provider.getBalance(addr);
    console.log(`Balance: ${ethers.formatEther(balance)} native`);

    if (balance < ethers.parseEther("0.005")) {
        console.error("Insufficient gas balance");
        process.exit(1);
    }

    // Deploy
    const artifactPath = path.join(__dirname, "../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

    console.log("\nDeploying...");
    const staking = await factory.deploy(VCN_TOKEN, {
        gasLimit: 5000000,
        gasPrice: ethers.parseUnits("1", "gwei")
    });
    console.log(`Tx: ${staking.deploymentTransaction().hash}`);
    await staking.waitForDeployment();

    const contractAddr = await staking.getAddress();
    console.log(`\nContract deployed: ${contractAddr}`);

    // Set APY
    console.log("Setting APY to 12%...");
    const apyTx = await staking.setTargetAPY(1200);
    await apyTx.wait();
    console.log("APY set.");

    // Transfer ownership to Paymaster
    console.log(`\nTransferring ownership to Paymaster (${PAYMASTER_ADDR})...`);
    const ownerTx = await staking.transferOwnership(PAYMASTER_ADDR);
    await ownerTx.wait();
    console.log("Ownership transferred.");

    console.log(`\n========================================`);
    console.log(`NEW CONTRACT: ${contractAddr}`);
    console.log(`OLD CONTRACT: 0xc351628EB244ec633d5f21fBD6621e1a683B1181`);
    console.log(`========================================`);
}

main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
