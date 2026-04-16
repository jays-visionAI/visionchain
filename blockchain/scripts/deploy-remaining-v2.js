/**
 * Vision Chain v2 - Deploy remaining contracts (Paymaster + BridgeStaking)
 * VCNToken was already deployed at 0xf8a2F49C782447a8660554F7c3274cbd765b1963
 * 
 * Usage: npx hardhat run scripts/deploy-remaining-v2.js --network visionV2
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const VCN_TOKEN_ADDRESS = "0xf8a2F49C782447a8660554F7c3274cbd765b1963";

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("  Vision Chain v2 - Deploy Remaining Contracts");
    console.log("  (VCNToken already at: " + VCN_TOKEN_ADDRESS + ")");
    console.log("=".repeat(60) + "\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer Balance:", hre.ethers.formatEther(balance), "VCN\n");

    const deployedAddresses = {
        VCN_TOKEN: VCN_TOKEN_ADDRESS
    };

    // ============ 2. Deploy VCNPaymasterNative ============
    console.log("2. Deploying VCNPaymasterNative...");
    try {
        const Paymaster = await hre.ethers.getContractFactory("VCNPaymasterNative");
        const paymaster = await Paymaster.deploy([deployer.address], 1);
        await paymaster.waitForDeployment();
        deployedAddresses.PAYMASTER = await paymaster.getAddress();
        console.log("   VCNPaymasterNative:", deployedAddresses.PAYMASTER);

        // Fund paymaster with 1000 VCN
        console.log("   Funding Paymaster with 1000 VCN...");
        const fundTx = await deployer.sendTransaction({
            to: deployedAddresses.PAYMASTER,
            value: hre.ethers.parseEther("1000")
        });
        await fundTx.wait();
        console.log("   Paymaster funded!");
    } catch (e) {
        console.error("   Paymaster deployment failed:", e.message);
        throw e;
    }

    // ============ 3. Deploy BridgeStaking ============
    console.log("\n3. Deploying BridgeStaking...");
    try {
        const BridgeStaking = await hre.ethers.getContractFactory("BridgeStaking");
        const staking = await BridgeStaking.deploy(VCN_TOKEN_ADDRESS);
        await staking.waitForDeployment();
        deployedAddresses.BRIDGE_STAKING = await staking.getAddress();
        console.log("   BridgeStaking:", deployedAddresses.BRIDGE_STAKING);

        // Set target APY to 12%
        console.log("   Setting target APY to 12%...");
        const setApyTx = await staking.setTargetAPY(1200);
        await setApyTx.wait();
        console.log("   APY set!");
    } catch (e) {
        console.error("   BridgeStaking deployment failed:", e.message);
        throw e;
    }

    // ============ 4. Whitelist contracts in Paymaster ============
    console.log("\n4. Whitelisting contracts in Paymaster...");
    try {
        const Paymaster = await hre.ethers.getContractAt("VCNPaymasterNative", deployedAddresses.PAYMASTER);
        
        // Whitelist VCNToken
        const wlTx1 = await Paymaster.addToWhitelist(VCN_TOKEN_ADDRESS);
        await wlTx1.wait();
        console.log("   Whitelisted VCNToken");

        // Whitelist BridgeStaking
        const wlTx2 = await Paymaster.addToWhitelist(deployedAddresses.BRIDGE_STAKING);
        await wlTx2.wait();
        console.log("   Whitelisted BridgeStaking");
    } catch (e) {
        console.warn("   Whitelisting failed (may not have addToWhitelist):", e.message);
    }

    // ============ Summary ============
    console.log("\n" + "=".repeat(60));
    console.log("  DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log(JSON.stringify(deployedAddresses, null, 2));

    console.log("\n=== Update .env files with these addresses ===");
    console.log(`VITE_VCN_TOKEN_ADDRESS=${deployedAddresses.VCN_TOKEN}`);
    console.log(`VITE_PAYMASTER_ADDRESS=${deployedAddresses.PAYMASTER}`);
    console.log(`VITE_BRIDGE_STAKING_ADDRESS=${deployedAddresses.BRIDGE_STAKING}`);

    // Save deployment
    const deploymentPath = path.join(__dirname, "../deployments/visionV2-latest.json");
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify({
        network: "visionV2",
        chainId: 3151909,
        timestamp: new Date().toISOString(),
        addresses: deployedAddresses
    }, null, 2));
    console.log(`\nSaved to: ${deploymentPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error.message || error);
        process.exit(1);
    });
