/**
 * Redeploy BridgeStaking V2 with stakeFor/unstakeFor/etc functions
 * Uses EXECUTOR wallet which has native VCN for gas
 * Owner stays as EXECUTOR EOA so Cloud Function can call onlyOwner functions
 */
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const RPC_URL = "https://api.visionchain.co/rpc-proxy";
const CHAIN_ID = 3151909;
const VCN_TOKEN = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const OLD_STAKING = "0xf3c337cA02f3370f85F54e9644890a497cFD762D";

// EXECUTOR private key (same as Cloud Function's VCN_EXECUTOR_PK)
const EXECUTOR_PK = process.env.EXECUTOR_PK;

async function main() {
    if (!EXECUTOR_PK) {
        console.error("ERROR: Set EXECUTOR_PK environment variable");
        process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("  Redeploy BridgeStaking V2 (with stakeFor support)");
    console.log("=".repeat(60) + "\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
    const wallet = new ethers.Wallet(EXECUTOR_PK, provider);
    const deployerAddress = wallet.address;

    console.log("Deployer (will remain owner):", deployerAddress);
    console.log("VCN Token:", VCN_TOKEN);
    console.log("Old Staking (no stakeFor):", OLD_STAKING);

    const nativeBal = await provider.getBalance(deployerAddress);
    console.log("Native VCN (gas):", ethers.formatEther(nativeBal), "VCN\n");

    if (nativeBal === 0n) {
        console.error("ERROR: No native VCN for gas!");
        process.exit(1);
    }

    // 1. Compile check - ensure artifact has stakeFor
    console.log("1. Loading compiled artifact...");
    const artifactPath = path.join(__dirname, '../artifacts/contracts/BridgeStaking.sol/BridgeStaking.json');
    if (!fs.existsSync(artifactPath)) {
        console.error("ERROR: Artifact not found. Run: npx hardhat compile");
        process.exit(1);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // Verify stakeFor exists in ABI
    const hasStakeFor = artifact.abi.some(item => item.name === 'stakeFor');
    console.log("   Artifact has stakeFor:", hasStakeFor);
    if (!hasStakeFor) {
        console.error("ERROR: Artifact missing stakeFor! Recompile the contract.");
        process.exit(1);
    }

    // 2. Deploy
    console.log("\n2. Deploying BridgeStaking...");
    const gasOpts = { gasPrice: ethers.parseUnits("1", "gwei") };
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const staking = await factory.deploy(VCN_TOKEN, gasOpts);
    await staking.waitForDeployment();
    const newAddress = await staking.getAddress();
    console.log("   NEW BridgeStaking:", newAddress);

    // 3. Verify stakeFor selector exists in deployed code
    const code = await provider.getCode(newAddress);
    const iface = new ethers.Interface(['function stakeFor(address,uint256) external']);
    const selector = iface.getFunction('stakeFor').selector.slice(2);
    console.log("\n3. Verifying stakeFor in bytecode...");
    console.log("   stakeFor selector found:", code.includes(selector));

    // 4. Set APY to 12%
    console.log("\n4. Setting target APY to 12%...");
    const setApyTx = await staking.setTargetAPY(1200, { gasLimit: 100000, ...gasOpts });
    await setApyTx.wait();
    const apy = await staking.targetAPY();
    console.log("   APY:", apy.toString(), "bps");

    // 5. Verify owner
    const owner = await staking.owner();
    console.log("\n5. Owner verification:");
    console.log("   Owner:", owner);
    console.log("   Is EXECUTOR EOA:", owner.toLowerCase() === deployerAddress.toLowerCase());

    // 6. Recover tokens from old staking contract (if any)
    const tokenABI = ['function balanceOf(address) view returns (uint256)'];
    const token = new ethers.Contract(VCN_TOKEN, tokenABI, provider);
    const oldBalance = await token.balanceOf(OLD_STAKING);
    console.log("\n6. Old staking contract VCN balance:", ethers.formatEther(oldBalance));
    if (oldBalance > 0n) {
        console.log("   WARNING: Old contract still holds", ethers.formatEther(oldBalance), "VCN");
        console.log("   These tokens cannot be recovered without a withdraw function on the old contract.");
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("  DEPLOYMENT COMPLETE");
    console.log("=".repeat(60));
    console.log("\n  NEW STAKING ADDRESS:", newAddress);
    console.log("\n  UPDATE REQUIRED:");
    console.log("  1. functions/index.js  -> BRIDGE_STAKING_ADDRESS");
    console.log("  2. Frontend contract address (WalletStaking.tsx or contractService.ts)");
    console.log("  3. Redeploy Cloud Functions");

    return newAddress;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error.message);
        process.exit(1);
    });
