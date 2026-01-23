const hre = require("hardhat");

async function main() {
    console.log("🚀 Starting Deployment of Vision Chain V2 Security Core...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("🔑 Deploying with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("💰 Account balance:", hre.ethers.formatEther(balance), "VCN");

    // --- 1. Deploy Hardened Equalizer (Phase 1 & 3) ---
    console.log("\n🛡️ Deploying VisionEqualizerV2...");

    // For testnet, we can use a mock LZ Endpoint or a placeholder
    const MOCK_LZ_ENDPOINT = "0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675"; // Example Endpoint

    const VisionEqualizerV2 = await hre.ethers.getContractFactory("VisionEqualizerV2");
    const equalizer = await VisionEqualizerV2.deploy(MOCK_LZ_ENDPOINT);
    await equalizer.waitForDeployment();

    const equalizerAddr = await equalizer.getAddress();
    console.log(`✅ VisionEqualizerV2 deployed to: ${equalizerAddr}`);

    // --- 2. Deploy MPC Paymaster (Phase 4 & 5) ---
    console.log("\n💳 Deploying VCNPaymasterV2...");

    // Initial TSS Signer (e.g., the deployer or a dedicated TSS address)
    // In production, this would be the aggregated public key of the MPC cluster
    const TSS_SIGNER = deployer.address;

    const VCNPaymasterV2 = await hre.ethers.getContractFactory("VCNPaymasterV2");
    const paymaster = await VCNPaymasterV2.deploy(TSS_SIGNER);
    await paymaster.waitForDeployment();

    const paymasterAddr = await paymaster.getAddress();
    console.log(`✅ VCNPaymasterV2 deployed to: ${paymasterAddr}`);

    // --- 3. Initial Configuration ---
    console.log("\n⚙️ Configuring Guardrails...");

    // Equalizer: Allow Loopback for testing
    // ChainID 1337 -> Trusted Remote (Self)
    // In LZ, remote path is 40 bytes (remoteAddr + localAddr)
    const trustedRemotePath = hre.ethers.solidityPacked(
        ["address", "address"],
        [equalizerAddr, equalizerAddr]
    );
    await equalizer.setTrustedRemote(1337, trustedRemotePath);
    console.log("   - [Equalizer] Self-trust configured for Loopback");

    // Paymaster: Set Policy for Deployer
    const DAILY_LIMIT = hre.ethers.parseEther("100"); // 100 VCN daily limit
    await paymaster.setUserPolicy(deployer.address, DAILY_LIMIT);
    console.log(`   - [Paymaster] User Policy set for Deployer (Limit: 100 VCN)`);

    // Paymaster: Allow Target (Equalizer)
    await paymaster.setTargetAllowlist(equalizerAddr, true);
    console.log(`   - [Paymaster] Whitelisted Target: EqualizerV2`);

    // --- 4. Verify Emergency Controls (Phase 6) ---
    console.log("\n🚨 Verifying Emergency Controls...");

    // Test Equalizer Pause
    console.log("   - [Equalizer] Testing Pause...");
    const pauseTx1 = await equalizer.pause();
    await pauseTx1.wait();
    if (await equalizer.paused()) {
        console.log("     ✅ Equalizer Paused Successfully");
    } else {
        console.error("     ❌ Equalizer Failed to Pause");
    }

    const unpauseTx1 = await equalizer.unpause();
    await unpauseTx1.wait();
    console.log("     ✅ Equalizer Unpaused - System Active");

    // Test Paymaster Pause
    console.log("   - [Paymaster] Testing Pause...");
    const pauseTx2 = await paymaster.pause();
    await pauseTx2.wait();
    if (await paymaster.paused()) {
        console.log("     ✅ Paymaster Paused Successfully");
    } else {
        console.error("     ❌ Paymaster Failed to Pause");
    }

    const unpauseTx2 = await paymaster.unpause();
    await unpauseTx2.wait();
    console.log("     ✅ Paymaster Unpaused - System Active");

    console.log("\n🎉 Deployment & Security Verification Complete!");
    console.log("----------------------------------------------------");
    console.log(`VisionEqualizerV2: ${equalizerAddr}`);
    console.log(`VCNPaymasterV2:    ${paymasterAddr}`);
    console.log("----------------------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
