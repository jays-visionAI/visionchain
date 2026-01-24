const { ethers } = require("hardhat");

async function main() {
    const [deployer] = await ethers.getSigners();
    const paymasterAddress = "0x998abeb3E57409262aE5b751f60747921B33613E";
    const entryPointAddress = "0x0000000071727de22e5e9d8baf0edac6f37a0521";

    console.log("Checking Balances on Vision Chain Testnet v2...");
    console.log("-------------------------------------------");

    // 1. Relayer Balance
    const relayerBalance = await ethers.provider.getBalance(deployer.address);
    console.log(`Relayer (EOA: ${deployer.address}) Balance: ${ethers.formatEther(relayerBalance)} ETH`);

    // 2. Paymaster Contract Balance (Native)
    const paymasterBalance = await ethers.provider.getBalance(paymasterAddress);
    console.log(`Paymaster Contract (${paymasterAddress}) Native Balance: ${ethers.formatEther(paymasterBalance)} ETH`);

    // 3. EntryPoint Deposit
    const entryPoint = await ethers.getContractAt([
        "function balanceOf(address account) external view returns (uint256)"
    ], entryPointAddress);

    try {
        const deposit = await entryPoint.balanceOf(paymasterAddress);
        console.log(`Paymaster Deposit in EntryPoint: ${ethers.formatEther(deposit)} ETH`);
    } catch (e) {
        console.log("Failed to fetch EntryPoint deposit (might not be deployed or supported)");
    }
}

main().catch(console.error);
