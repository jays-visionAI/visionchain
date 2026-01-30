/**
 * Grant TSS_ROLE to the TSS signer wallet on Vision Chain MessageInbox
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Use the admin key from root .env
const ADMIN_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TSS_ADDRESS = '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794';
const MESSAGE_INBOX = process.env.DST_MESSAGE_INBOX;
const VISION_RPC = process.env.VISION_RPC;

const ABI = [
    "function grantRole(bytes32 role, address account) external",
    "function TSS_ROLE() view returns (bytes32)",
    "function hasRole(bytes32 role, address account) view returns (bool)"
];

async function grantTSSRole() {
    const provider = new ethers.JsonRpcProvider(VISION_RPC);
    const admin = new ethers.Wallet(ADMIN_KEY, provider);

    console.log("=== Grant TSS_ROLE ===\n");
    console.log(`Admin: ${admin.address}`);
    console.log(`TSS: ${TSS_ADDRESS}`);
    console.log(`MessageInbox: ${MESSAGE_INBOX}\n`);

    const contract = new ethers.Contract(MESSAGE_INBOX, ABI, admin);

    // Get TSS_ROLE hash
    const tssRole = await contract.TSS_ROLE();
    console.log(`TSS_ROLE: ${tssRole}`);

    // Check if already has role
    const hasRole = await contract.hasRole(tssRole, TSS_ADDRESS);
    console.log(`Already has role: ${hasRole}`);

    if (hasRole) {
        console.log("\nAlready has TSS_ROLE!");
        return;
    }

    // Grant role
    console.log("\nGranting TSS_ROLE...");
    const tx = await contract.grantRole(tssRole, TSS_ADDRESS, { gasLimit: 100000 });
    console.log(`Tx: ${tx.hash}`);
    await tx.wait();
    console.log("Done!");

    // Verify
    const hasRoleAfter = await contract.hasRole(tssRole, TSS_ADDRESS);
    console.log(`Has role now: ${hasRoleAfter}`);
}

grantTSSRole().catch(console.error);
