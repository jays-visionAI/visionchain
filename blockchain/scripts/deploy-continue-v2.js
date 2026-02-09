/**
 * Vision Chain v2 - Continue Deployment
 * VCNToken already deployed at 0x5FbDB2315678afecb367f032d93F642f64180aa3
 */

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const ADMIN_KEY = process.env.VISION_ADMIN_PK;
const CHAIN_ID = 3151909;

// Already deployed
const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Continue Deployment");
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("Deployer:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Native VCN Balance:", ethers.formatEther(balance), "VCN\n");

    const deployedAddresses = {
        VCN_TOKEN: VCN_TOKEN_ADDRESS
    };

    console.log("1. VCNToken already deployed:", VCN_TOKEN_ADDRESS);

    // ============ 2. Deploy VCNPaymasterNative ============
    console.log("\n2. Deploying VCNPaymasterNative...");
    const paymasterPath = path.join(__dirname, '../artifacts/contracts/VCNPaymasterNative.sol/VCNPaymasterNative.json');
    const paymasterArtifact = JSON.parse(fs.readFileSync(paymasterPath, 'utf8'));

    const signers = [wallet.address];
    const requiredSignatures = 1;

    const paymasterFactory = new ethers.ContractFactory(paymasterArtifact.abi, paymasterArtifact.bytecode, wallet);
    const paymaster = await paymasterFactory.deploy(signers, requiredSignatures);
    await paymaster.waitForDeployment();
    deployedAddresses.PAYMASTER = await paymaster.getAddress();
    console.log("   VCNPaymasterNative:", deployedAddresses.PAYMASTER);

    // Fund paymaster
    console.log("   Funding Paymaster with 1000 VCN...");
    const fundTx = await wallet.sendTransaction({
        to: deployedAddresses.PAYMASTER,
        value: ethers.parseEther("1000")
    });
    await fundTx.wait();
    console.log("   Paymaster funded!");

    // Whitelist VCN Token for free transfers
    console.log("   Whitelisting VCN Token...");
    const paymasterContract = new ethers.Contract(deployedAddresses.PAYMASTER, paymasterArtifact.abi, wallet);
    const whitelistTx = await paymasterContract.setWhitelistedContract(VCN_TOKEN_ADDRESS, true);
    await whitelistTx.wait();
    console.log("   VCN Token whitelisted!");

    // ============ 3. Deploy BridgeStaking ============
    console.log("\n3. Deploying BridgeStaking...");
    const stakingPath = path.join(__dirname, '../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json');
    const stakingArtifact = JSON.parse(fs.readFileSync(stakingPath, 'utf8'));

    const stakingFactory = new ethers.ContractFactory(stakingArtifact.abi, stakingArtifact.bytecode, wallet);
    const staking = await stakingFactory.deploy(VCN_TOKEN_ADDRESS);
    await staking.waitForDeployment();
    deployedAddresses.BRIDGE_STAKING = await staking.getAddress();
    console.log("   BridgeStaking:", deployedAddresses.BRIDGE_STAKING);

    // Set APY
    console.log("   Setting target APY to 12%...");
    const setApyTx = await staking.setTargetAPY(1200);
    await setApyTx.wait();

    // Whitelist staking contract
    console.log("   Whitelisting BridgeStaking for Paymaster...");
    const whitelistStakingTx = await paymasterContract.setWhitelistedContract(deployedAddresses.BRIDGE_STAKING, true);
    await whitelistStakingTx.wait();
    console.log("   BridgeStaking whitelisted!");

    // ============ 4. Restore Snapshot ============
    console.log("\n4. Restoring balances from snapshot...");
    const snapshotPath = path.join(__dirname, '../../snapshots/vcn-snapshot.json');

    // Load VCN Token contract
    const vcnTokenPath = path.join(__dirname, '../artifacts/contracts/VCNToken.sol/VCNToken.json');
    const vcnTokenArtifact = JSON.parse(fs.readFileSync(vcnTokenPath, 'utf8'));
    const vcnToken = new ethers.Contract(VCN_TOKEN_ADDRESS, vcnTokenArtifact.abi, wallet);

    if (!fs.existsSync(snapshotPath)) {
        console.log("   WARNING: Snapshot file not found, skipping");
    } else {
        const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
        const balances = snapshot.balances;

        const deployerLower = wallet.address.toLowerCase();
        const addressesToRestore = Object.entries(balances).filter(
            ([addr]) => addr.toLowerCase() !== deployerLower
        );

        console.log(`   Found ${addressesToRestore.length} addresses to restore`);

        let restored = 0;
        for (const [address, amount] of addressesToRestore) {
            try {
                const tx = await vcnToken.transfer(address, amount);
                await tx.wait();
                restored++;
                if (restored % 10 === 0) {
                    console.log(`   Restored ${restored}/${addressesToRestore.length}...`);
                }
            } catch (err) {
                console.log(`   Failed: ${address} - ${err.message.slice(0, 50)}`);
            }
        }
        console.log(`   Snapshot restoration complete! (${restored}/${addressesToRestore.length})`);
    }

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("  Deployment Summary");
    console.log("=".repeat(60));
    console.log(JSON.stringify(deployedAddresses, null, 2));

    console.log("\n=== Update .env files ===");
    console.log(`NEXT_PUBLIC_VCN_TOKEN_ADDRESS=${deployedAddresses.VCN_TOKEN}`);
    console.log(`NEXT_PUBLIC_PAYMASTER_ADDRESS=${deployedAddresses.PAYMASTER}`);
    console.log(`NEXT_PUBLIC_BRIDGE_STAKING_ADDRESS=${deployedAddresses.BRIDGE_STAKING}`);

    // Save deployment
    const deploymentPath = path.join(__dirname, '../deployments/visionV2.json');
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: CHAIN_ID,
        timestamp: new Date().toISOString(),
        addresses: deployedAddresses
    }, null, 2));
    console.log(`\nDeployment saved to: ${deploymentPath}`);

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
