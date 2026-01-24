
const { ethers } = require('hardhat');

// Configuration
const PAYMASTER_ADDRESS = "0x7a2088a1bFc9d81c55368AE168C2C02570cB814F";
const AMOUNT = "10.0";

async function main() {
    console.log(`Sending ${AMOUNT} ETH to Paymaster at ${PAYMASTER_ADDRESS}...`);

    const [sender] = await ethers.getSigners();
    console.log("Sender:", sender.address);

    const balanceBefore = await ethers.provider.getBalance(PAYMASTER_ADDRESS);
    console.log("Balance Before:", ethers.formatEther(balanceBefore), "ETH");

    const tx = await sender.sendTransaction({
        to: PAYMASTER_ADDRESS,
        value: ethers.parseEther(AMOUNT)
    });

    console.log("Transaction sent! Hash:", tx.hash);
    await tx.wait();

    const balanceAfter = await ethers.provider.getBalance(PAYMASTER_ADDRESS);
    console.log("\nSuccess!");
    console.log("Balance After:", ethers.formatEther(balanceAfter), "ETH");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
