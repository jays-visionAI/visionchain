const hre = require("hardhat");

async function main() {
    // Usage: npx hardhat run scripts/test_bridge_flow.js --network amoy
    const NETWORK = hre.network.name;
    console.log(`🧪 Starting Cross-Chain Test on ${NETWORK}...`);

    const SPOKE_VAULT = process.env.POLYGON_VAULT_ADDRESS || ""; // Set this!
    const SPOKE_TOKEN = process.env.SPOKE_TOKEN_ADDRESS || ""; // Set this!

    if (!SPOKE_VAULT || !SPOKE_TOKEN) {
        console.error("❌ Please set POLYGON_VAULT_ADDRESS (or equivalent) and SPOKE_TOKEN_ADDRESS in .env");
        process.exit(1);
    }

    const [user] = await hre.ethers.getSigners();
    const amount = hre.ethers.parseEther("10");
    const destChainId = 3151909; // Target: VCN

    const token = await hre.ethers.getContractAt("VCNToken", SPOKE_TOKEN);
    const vault = await hre.ethers.getContractAt("VisionVault", SPOKE_VAULT);

    // 1. Approve
    console.log("Step 1: Approving Vault..."); // Fixed typo from 'Approiving'
    const txApprove = await token.approve(SPOKE_VAULT, amount);
    await txApprove.wait();
    console.log("✅ Approved.");

    // 2. Deposit
    console.log(`Step 2: Depositing 10 tokens to Chain ${destChainId}...`);
    const txDeposit = await vault.depositToVision(amount, destChainId);
    console.log(`⏳ Transaction sent: ${txDeposit.hash}`);
    await txDeposit.wait();
    console.log("✅ Deposit Confirmed! Watch the Relayer console.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
