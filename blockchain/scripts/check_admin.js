const hre = require("hardhat");

async function main() {
    console.log("🔍 Checking Admin Wallet Status...");

    // This gets the account configured in hardhat.config.js (PRIVATE_KEY)
    const [admin] = await hre.ethers.getSigners();

    if (!admin) {
        console.error("❌ No account configured in hardhat.config.js");
        return;
    }

    console.log(`Admin Address: ${admin.address}`);

    const balance = await hre.ethers.provider.getBalance(admin.address);
    console.log(`Native Balance (ETH/MATIC/VCN): ${hre.ethers.formatEther(balance)}`);

    // Check VCN Token Balance if VCN Token address is known
    // Vision Testnet V2 VCN Token
    const vcnAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
    const code = await hre.ethers.provider.getCode(vcnAddress);

    if (code !== "0x") {
        try {
            const VCN = await hre.ethers.getContractAt("VCNToken", vcnAddress);
            const tokenBalance = await VCN.balanceOf(admin.address);
            console.log(`VCN Token Balance: ${hre.ethers.formatEther(tokenBalance)} VCN`);
        } catch (e) {
            console.log("Could not fetch VCN Token balance (ABI mismatch or verify failed).");
        }
    } else {
        console.log("⚠️ VCN Token contract not found at default address.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
