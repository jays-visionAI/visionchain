const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const tokenAddress = "0xf8a2F49C782447a8660554F7c3274cbd765b1963";

    console.log(`Checking VCN Balance for ${deployer.address} at ${tokenAddress}...`);

    const vcn = await ethers.getContractAt([
        "function balanceOf(address account) external view returns (uint256)",
        "function name() external view returns (string)"
    ], tokenAddress);

    try {
        const name = await vcn.name();
        const balance = await vcn.balanceOf(deployer.address);
        console.log(`Token Name: ${name}`);
        console.log(`Balance: ${ethers.formatUnits(balance, 18)} VCN`);
    } catch (e) {
        console.error("VCN Token NOT FOUND or Error:", e.message);
    }
}

main().catch(console.error);
