// Deploy BridgeStaking V2 - Two-step deploy
// Step 1: Fund staking admin with gas from Paymaster admin
// Step 2: Deploy contract from staking admin
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const STAKING_ADMIN = "0xAFf852Ee7DF3C036719e7b5461840aA2c66aC0ae";

function askSecret(query) {
    return new Promise(resolve => {
        process.stdout.write(query);
        const stdin = process.stdin;
        stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');
        let input = '';
        stdin.on('data', (ch) => {
            if (ch === '\r' || ch === '\n') {
                stdin.setRawMode(false);
                stdin.pause();
                stdin.removeAllListeners('data');
                process.stdout.write('\n');
                resolve(input.trim());
            } else if (ch === '\u0003') {
                process.exit();
            } else if (ch === '\u007F') {
                if (input.length > 0) {
                    input = input.slice(0, -1);
                    process.stdout.write('\b \b');
                }
            } else {
                input += ch;
                process.stdout.write('*');
            }
        });
    });
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Check staking admin balance
    const stakingBalance = await provider.getBalance(STAKING_ADMIN);
    console.log(`\nStaking Admin (${STAKING_ADMIN})`);
    console.log(`  Native balance: ${ethers.formatEther(stakingBalance)}`);

    const needsGas = stakingBalance < ethers.parseEther("0.01");

    if (needsGas) {
        console.log("\n=== STEP 1: Fund staking admin with gas ===");
        const paymasterPK = await askSecret("Enter PAYMASTER admin private key (0x08A1... wallet): ");

        const paymasterWallet = new ethers.Wallet(paymasterPK, provider);
        const paymasterAddr = await paymasterWallet.getAddress();
        console.log(`Paymaster address: ${paymasterAddr}`);

        const pmBalance = await provider.getBalance(paymasterAddr);
        console.log(`Paymaster balance: ${ethers.formatEther(pmBalance)} native`);

        if (pmBalance < ethers.parseEther("1")) {
            console.error("Paymaster has insufficient gas balance");
            process.exit(1);
        }

        console.log(`Sending 1 native to ${STAKING_ADMIN}...`);
        const tx = await paymasterWallet.sendTransaction({
            to: STAKING_ADMIN,
            value: ethers.parseEther("1"),
            gasLimit: 21000,
            gasPrice: ethers.parseUnits("1", "gwei")
        });
        console.log(`Tx: ${tx.hash}`);
        await tx.wait();
        console.log("Gas funded successfully!");
    } else {
        console.log("Staking admin has sufficient gas, skipping funding step.");
    }

    // STEP 2: Deploy from staking admin
    console.log("\n=== STEP 2: Deploy BridgeStaking V2 ===");
    const stakingPK = await askSecret("Enter STAKING admin private key (0xAFf8... wallet): ");

    const stakingWallet = new ethers.Wallet(stakingPK, provider);
    const deployAddr = await stakingWallet.getAddress();
    console.log(`Deployer address: ${deployAddr}`);

    if (deployAddr.toLowerCase() !== STAKING_ADMIN.toLowerCase()) {
        console.error(`ERROR: Expected ${STAKING_ADMIN} but got ${deployAddr}`);
        process.exit(1);
    }

    const artifactPath = path.join(__dirname, "../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, stakingWallet);
    console.log("Deploying...");
    const staking = await factory.deploy(VCN_TOKEN, {
        gasLimit: 5000000,
        gasPrice: ethers.parseUnits("1", "gwei")
    });

    console.log(`Tx: ${staking.deploymentTransaction().hash}`);
    await staking.waitForDeployment();

    const contractAddr = await staking.getAddress();
    console.log(`\n=== SUCCESS ===`);
    console.log(`BridgeStaking V2: ${contractAddr}`);
    console.log(`Owner: ${deployAddr}`);

    // Set APY 12%
    console.log("\nSetting APY to 12%...");
    const apyTx = await staking.setTargetAPY(1200);
    await apyTx.wait();
    console.log("APY set.");

    // Transfer ownership to Paymaster (0x08A1...) so it can call stakeFor
    console.log("\n=== STEP 3: Transfer ownership to Paymaster ===");
    const PAYMASTER_ADDR = "0x08A1B183a53a0f8f1D875945D504272738E3AF34";
    console.log(`Transferring ownership to ${PAYMASTER_ADDR}...`);
    const ownerTx = await staking.transferOwnership(PAYMASTER_ADDR);
    await ownerTx.wait();
    console.log("Ownership transferred!");

    console.log(`\n========================================`);
    console.log(`NEW CONTRACT: ${contractAddr}`);
    console.log(`OLD CONTRACT: 0xc351628EB244ec633d5f21fBD6621e1a683B1181`);
    console.log(`========================================`);
    console.log(`Update in:`);
    console.log(`  1. ValidatorStaking.tsx`);
    console.log(`  2. functions/index.js`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
