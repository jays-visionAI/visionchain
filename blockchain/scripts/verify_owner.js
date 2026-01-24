const { ethers } = require("hardhat");

async function main() {
    const paymasterAddress = "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf";
    const paymaster = await ethers.getContractAt([
        "function owner() external view returns (address)"
    ], paymasterAddress);

    const owner = await paymaster.owner();
    console.log(`Paymaster Address: ${paymasterAddress}`);
    console.log(`Paymaster Owner: ${owner}`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer (Account #0): ${deployer.address}`);

    if (owner.toLowerCase() === deployer.address.toLowerCase()) {
        console.log("✅ Ownership Match!");
    } else {
        console.log("❌ Ownership Mismatch!");
    }
}

main().catch(console.error);
