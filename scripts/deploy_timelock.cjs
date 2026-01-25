const hre = require("hardhat");

async function main() {
    console.log("Deploying TimeLockAgent to Vision Chain Testnet...");

    const TimeLockAgent = await hre.ethers.getContractFactory("TimeLockAgent");
    const timeLock = await TimeLockAgent.deploy();

    await timeLock.waitForDeployment();

    const address = await timeLock.getAddress();
    console.log("TimeLockAgent deployed to:", address);

    // Verification instruction
    console.log("To verify, run:");
    console.log(`npx hardhat verify --network vision_testnet ${address}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
