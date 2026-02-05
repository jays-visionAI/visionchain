/**
 * Generate New Admin Wallet
 * 
 * Creates a new secure wallet for contract administration.
 * This wallet will be used as the admin for all deployed contracts.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("\n=== Generating New Admin Wallet ===\n");

    // Generate new random wallet
    const wallet = ethers.Wallet.createRandom();

    console.log("NEW WALLET GENERATED:");
    console.log("====================");
    console.log("Address:     ", wallet.address);
    console.log("Private Key: ", wallet.privateKey);
    console.log("Mnemonic:    ", wallet.mnemonic?.phrase);
    console.log("");

    console.log("IMPORTANT SECURITY NOTES:");
    console.log("1. Save the private key securely - it will NOT be stored anywhere else");
    console.log("2. Never share this key with anyone");
    console.log("3. Use this key for Firebase Secrets (VCN_EXECUTOR_PK)");
    console.log("4. Back up the mnemonic phrase in a secure location");
    console.log("");

    // Save address only (NOT the private key)
    const outputPath = path.join(__dirname, '../admin-wallet-address.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        address: wallet.address,
        generatedAt: new Date().toISOString(),
        note: "Private key is NOT stored here for security. Store it in Firebase Secrets."
    }, null, 2));
    console.log(`Address saved to: ${outputPath}`);

    console.log("\n=== Next Steps ===");
    console.log("1. Copy the private key above");
    console.log("2. Run: firebase functions:secrets:set VCN_EXECUTOR_PK");
    console.log("3. Paste the private key when prompted");
    console.log("4. Deploy contracts with: ADMIN_PRIVATE_KEY=0x... node scripts/deploy-bridge-secure.js");
    console.log("");

    return wallet;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
