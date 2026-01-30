/**
 * Grant TSS_ROLE on Sepolia MessageInbox
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const SEPOLIA_RPC = process.env.SEPOLIA_RPC;
const MESSAGE_INBOX = process.env.SRC_MESSAGE_INBOX;  // Sepolia
const TSS_ADDRESS = '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794';
const TSS_KEY = process.env.TSS_PRIVATE_KEY;  // Use TSS wallet as admin too (same deployer)

const ABI = [
    "function grantRole(bytes32 role, address account) external",
    "function TSS_ROLE() view returns (bytes32)",
    "function hasRole(bytes32 role, address account) view returns (bool)"
];

async function grantTSSRole() {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const admin = new ethers.Wallet(TSS_KEY, provider);

    console.log("=== Grant TSS_ROLE on Sepolia ===\n");
    console.log(`Wallet: ${admin.address}`);
    console.log(`MessageInbox: ${MESSAGE_INBOX}\n`);

    const contract = new ethers.Contract(MESSAGE_INBOX, ABI, admin);

    const tssRole = await contract.TSS_ROLE();
    console.log(`TSS_ROLE: ${tssRole.slice(0, 20)}...`);

    const hasRole = await contract.hasRole(tssRole, TSS_ADDRESS);
    console.log(`Already has role: ${hasRole}`);

    if (hasRole) {
        console.log("\nAlready has TSS_ROLE!");
        return;
    }

    console.log("\nGranting TSS_ROLE...");
    const tx = await contract.grantRole(tssRole, TSS_ADDRESS, { gasLimit: 100000 });
    console.log(`Tx: ${tx.hash}`);
    await tx.wait();
    console.log("Done!");
}

grantTSSRole().catch(console.error);
