/**
 * Fund new admin wallet with VCN for gas
 */

import { ethers } from 'ethers';

const RPC_URL = 'http://46.224.221.201:8545';

// Hardhat default account (has VCN from genesis)
const FUNDER_PK = process.env.VISION_ADMIN_PK;

// New admin wallet (user's MetaMask wallet)
const NEW_ADMIN = '0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15';

// Amount to send (for gas)
const AMOUNT = '100'; // 100 VCN

async function main() {
    console.log("\n=== Funding New Admin Wallet ===\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const funder = new ethers.Wallet(FUNDER_PK, provider);

    console.log("From:", funder.address);
    console.log("To:  ", NEW_ADMIN);
    console.log("Amount:", AMOUNT, "VCN");

    const balanceBefore = await provider.getBalance(NEW_ADMIN);
    console.log("\nNew wallet balance before:", ethers.formatEther(balanceBefore), "VCN");

    const tx = await funder.sendTransaction({
        to: NEW_ADMIN,
        value: ethers.parseEther(AMOUNT),
    });

    console.log("TX sent:", tx.hash);
    await tx.wait();
    console.log("TX confirmed!");

    const balanceAfter = await provider.getBalance(NEW_ADMIN);
    console.log("New wallet balance after:", ethers.formatEther(balanceAfter), "VCN");

    console.log("\n=== Done! New admin wallet is funded ===\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
