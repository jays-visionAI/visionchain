const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const tokenAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

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
