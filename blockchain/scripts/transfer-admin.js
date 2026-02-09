/**
 * Transfer admin/owner roles from Hardhat Account #0 to user's secure wallet
 * 
 * OLD Admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Hardhat #0 - PUBLIC KEY)
 * NEW Admin: 0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15 (User's MetaMask)
 * 
 * Usage: node scripts/transfer-admin.js
 */

const { ethers } = require("ethers");

// Vision Chain RPC
const RPC_URL = "https://api.visionchain.co/rpc-proxy";

// OLD admin (Hardhat #0 - we use this to sign the transfer transactions)
const OLD_ADMIN_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// NEW admin (User's MetaMask wallet)
const NEW_ADMIN = "0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15";

// All Vision Chain contracts to transfer
const CONTRACTS = {
    VCN_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    VCN_PAYMASTER: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    BRIDGE_STAKING: "0xc351628EB244ec633d5f21fBD6621e1a683B1181",
    VCN_VESTING: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    NODE_LICENSE: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    MINING_POOL: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
    VISION_BRIDGE: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    INTENT_COMMITMENT: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
    MESSAGE_INBOX: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318",
    VISION_BRIDGE_SECURE: "0x610178dA211FEF7D417bC0e6FeD39F05609AD788",
    TIME_LOCK_AGENT: "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb",
};

// ABIs for admin transfer
const OWNABLE_ABI = [
    "function owner() view returns (address)",
    "function transferOwnership(address newOwner)",
];

const ACCESS_CONTROL_ABI = [
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function grantRole(bytes32 role, address account)",
    "function revokeRole(bytes32 role, address account)",
    "function getRoleAdmin(bytes32 role) view returns (bytes32)",
    "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    "function MINTER_ROLE() view returns (bytes32)",
];

async function main() {
    console.log("\n=== Vision Chain Admin Transfer ===\n");
    console.log("OLD Admin (Hardhat #0):", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    console.log("NEW Admin (User):", NEW_ADMIN);
    console.log("");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const oldAdminWallet = new ethers.Wallet(OLD_ADMIN_PK, provider);

    console.log("Signer:", oldAdminWallet.address);
    const balance = await provider.getBalance(oldAdminWallet.address);
    console.log("Balance:", ethers.formatEther(balance), "VCN\n");

    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash; // 0x00...00

    const results = [];

    for (const [name, address] of Object.entries(CONTRACTS)) {
        console.log(`--- ${name} (${address}) ---`);

        try {
            // Try Ownable pattern first
            const ownableContract = new ethers.Contract(address, OWNABLE_ABI, oldAdminWallet);

            try {
                const currentOwner = await ownableContract.owner();
                console.log(`  Current owner: ${currentOwner}`);

                if (currentOwner.toLowerCase() === NEW_ADMIN.toLowerCase()) {
                    console.log(`  Already transferred to new admin. Skipping.`);
                    results.push({ name, status: "ALREADY_DONE" });
                    continue;
                }

                if (currentOwner.toLowerCase() !== oldAdminWallet.address.toLowerCase()) {
                    console.log(`  Owner is not old admin. Cannot transfer. Skipping.`);
                    results.push({ name, status: "SKIP_NOT_OWNER" });
                    continue;
                }

                console.log(`  Transferring ownership...`);
                const tx = await ownableContract.transferOwnership(NEW_ADMIN, { gasLimit: 100000 });
                await tx.wait();
                console.log(`  Ownership transferred! TX: ${tx.hash}`);
                results.push({ name, status: "TRANSFERRED_OWNABLE", tx: tx.hash });
                continue;
            } catch (ownableErr) {
                // Not Ownable, try AccessControl
            }

            // Try AccessControl pattern
            const acContract = new ethers.Contract(address, ACCESS_CONTROL_ABI, oldAdminWallet);

            try {
                const hasAdminRole = await acContract.hasRole(DEFAULT_ADMIN_ROLE, oldAdminWallet.address);

                if (!hasAdminRole) {
                    console.log(`  Old admin has no DEFAULT_ADMIN_ROLE. Skipping.`);
                    results.push({ name, status: "SKIP_NO_ROLE" });
                    continue;
                }

                const newHasRole = await acContract.hasRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN);

                if (!newHasRole) {
                    console.log(`  Granting DEFAULT_ADMIN_ROLE to new admin...`);
                    const grantTx = await acContract.grantRole(DEFAULT_ADMIN_ROLE, NEW_ADMIN, { gasLimit: 100000 });
                    await grantTx.wait();
                    console.log(`  Granted! TX: ${grantTx.hash}`);
                }

                // Try granting MINTER_ROLE if exists
                try {
                    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
                    const hasMinterRole = await acContract.hasRole(MINTER_ROLE, oldAdminWallet.address);
                    if (hasMinterRole) {
                        const newHasMinter = await acContract.hasRole(MINTER_ROLE, NEW_ADMIN);
                        if (!newHasMinter) {
                            console.log(`  Granting MINTER_ROLE to new admin...`);
                            const mTx = await acContract.grantRole(MINTER_ROLE, NEW_ADMIN, { gasLimit: 100000 });
                            await mTx.wait();
                            console.log(`  MINTER_ROLE granted!`);
                        }
                    }
                } catch (e) { /* MINTER_ROLE doesn't exist on this contract */ }

                // Revoke old admin's DEFAULT_ADMIN_ROLE
                console.log(`  Revoking DEFAULT_ADMIN_ROLE from old admin...`);
                const revokeTx = await acContract.revokeRole(DEFAULT_ADMIN_ROLE, oldAdminWallet.address, { gasLimit: 100000 });
                await revokeTx.wait();
                console.log(`  Revoked! TX: ${revokeTx.hash}`);

                results.push({ name, status: "TRANSFERRED_ACCESS_CONTROL" });
                continue;
            } catch (acErr) {
                console.log(`  AccessControl failed: ${acErr.message.substring(0, 80)}`);
            }

            console.log(`  Could not transfer (no Ownable or AccessControl). Manual check needed.`);
            results.push({ name, status: "MANUAL_CHECK_NEEDED" });

        } catch (err) {
            console.error(`  ERROR: ${err.message.substring(0, 100)}`);
            results.push({ name, status: "ERROR", error: err.message.substring(0, 100) });
        }

        console.log("");
    }

    console.log("\n=== Transfer Summary ===\n");
    for (const r of results) {
        console.log(`${r.name}: ${r.status}`);
    }
    console.log("\nDone!");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
