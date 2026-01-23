require('dotenv').config();
const { ethers } = require("ethers");
const fs = require('fs');

// --- Configuration ---
// FILL THESE IN AFTER DEPLOYMENT
const HUB_RPC = "https://rpc.visionchain.co";
const HUB_ADDRESS = process.env.HUB_ADDRESS || ""; // VisionEqualizer on VCN

const A_RPC = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const A_VAULT = process.env.POLYGON_VAULT_ADDRESS || ""; // VisionVault on Polygon

const B_RPC = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const B_VAULT = process.env.SEPOLIA_VAULT_ADDRESS || ""; // VisionVault on Sepolia

// Relayer Private Key (Must be RELAYER_ROLE on Hub and VALIDATOR on Vaults)
const RELAYER_PK = process.env.PRIVATE_KEY;

if (!RELAYER_PK) {
    console.error("❌ PRIVATE_KEY is missing in .env");
    process.exit(1);
}

// ABIs
const VisionEqualizerABI = require("../artifacts/contracts/interop/VisionEqualizer.sol/VisionEqualizer.json").abi;
const VisionVaultABI = require("../artifacts/contracts/interop/VisionVault.sol/VisionVault.json").abi;

async function main() {
    console.log("🔄 Starting Vision Relayer Node...");

    // 1. Setup Providers
    const hubProvider = new ethers.JsonRpcProvider(HUB_RPC);
    const hubWallet = new ethers.Wallet(RELAYER_PK, hubProvider);
    const hubContract = new ethers.Contract(HUB_ADDRESS, VisionEqualizerABI, hubWallet);

    console.log(`Listening to Hub (VCN): ${HUB_ADDRESS}`);

    // Helper to setup Spoke listener
    const setupSpoke = async (name, rpcUrl, vaultAddress) => {
        if (!vaultAddress) return;

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = new ethers.Wallet(RELAYER_PK, provider);
        const vaultContract = new ethers.Contract(vaultAddress, VisionVaultABI, wallet);

        console.log(`✅ Monitoring ${name}: ${vaultAddress}`);

        // LISTENER: Deposit on Spoke -> Sync to Hub
        vaultContract.on("LiquidityLocked", async (user, amount, destChainId, timestamp, event) => {
            console.log(`[${name}] 📥 Deposit Detected: ${ethers.formatEther(amount)} tokens from ${user}`);

            try {
                const tx = await hubContract.syncDeposit(user, destChainId, "VCN", amount); // Assuming Symbol 'VCN' for now
                console.log(`  -> Synced to Hub: ${tx.hash}`);
            } catch (err) {
                console.error(`  ❌ Sync Failed: ${err.message}`);
            }
        });
    };

    // LISTENER: Request on Hub -> Release on Spoke
    hubContract.on("LiquidityReleaseRequested", async (user, targetChainId, symbol, amount, nonce, event) => {
        console.log(`[HUB] 📤 Release Requested: ${ethers.formatEther(amount)} ${symbol} to Chain ${targetChainId} for ${user}`);

        // Determine Target Chain
        let targetWallet, targetVault;

        // This mapping should be dynamic in production
        if (targetChainId.toString() === "80002" && A_VAULT) { // Amoy
            const p = new ethers.JsonRpcProvider(A_RPC);
            targetWallet = new ethers.Wallet(RELAYER_PK, p);
            targetVault = new ethers.Contract(A_VAULT, VisionVaultABI, targetWallet);
        } else if (targetChainId.toString() === "11155111" && B_VAULT) { // Sepolia
            const p = new ethers.JsonRpcProvider(B_RPC);
            targetWallet = new ethers.Wallet(RELAYER_PK, p);
            targetVault = new ethers.Contract(B_VAULT, VisionVaultABI, targetWallet);
        }

        if (targetVault) {
            try {
                // Generate Signature
                // Message: (to, amount, fromChainId, nonce, chainId, address(this))
                // Note: The logic in Vault requires signature verification.
                // WE ARE THE VALIDATOR. We sign the "Mint" authority.

                const fromChainId = 3151909; // VCN ID
                const targetChainIdVal = await targetWallet.provider.getNetwork().then(n => n.chainId);

                const messageHash = ethers.solidityPackedKeccak256(
                    ["address", "uint256", "uint256", "uint256", "uint256", "address"],
                    [user, amount, fromChainId, nonce, targetChainIdVal, await targetVault.getAddress()]
                );

                const signature = await targetWallet.signMessage(ethers.getBytes(messageHash));

                // Execute Release (or send signature to user to execute)
                // Here we execute for them (Gas paid by Relayer for standard UX)
                const tx = await targetVault.releaseLiquidity(user, amount, fromChainId, nonce, signature);
                console.log(`  -> Released on Target: ${tx.hash}`);

            } catch (err) {
                console.error(`  ❌ Release Failed: ${err.message}`);
            }
        } else {
            console.log("  ⚠️ Target Chain not configured or unknown.");
        }
    });

    await setupSpoke("Polygon Amoy", A_RPC, A_VAULT);
    await setupSpoke("Sepolia", B_RPC, B_VAULT);
}

main().catch(console.error);
