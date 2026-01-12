const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Amoy EntryPoint address
    const ENTRY_POINT = "0x0000000071727De22E5E9d8BAf0edAc6f37a0521";

    // 1. Deploy VCNToken
    const VCNToken = await hre.ethers.getContractFactory("VCNToken");
    const token = await VCNToken.deploy(deployer.address, deployer.address);
    await token.waitForDeployment();
    console.log("VCNToken deployed to:", await token.getAddress());

    // 2. Deploy VCNVesting
    const VCNVesting = await hre.ethers.getContractFactory("VCNVesting");
    const vesting = await VCNVesting.deploy(deployer.address, await token.getAddress());
    await vesting.waitForDeployment();
    console.log("VCNVesting deployed to:", await vesting.getAddress());

    // 3. Deploy VCNAccountFactory (Skipped for Node/Mining Test)
    // const VCNAccountFactory = await hre.ethers.getContractFactory("VCNAccountFactory");
    // const factory = await VCNAccountFactory.deploy(ENTRY_POINT);
    // await factory.waitForDeployment();
    // console.log("VCNAccountFactory deployed to:", await factory.getAddress());

    // 4. Deploy VCNPaymaster (Skipped for Node/Mining Test)
    // const VCNPaymaster = await hre.ethers.getContractFactory("VCNPaymaster");
    // const paymaster = await VCNPaymaster.deploy(ENTRY_POINT, deployer.address);
    // await paymaster.waitForDeployment();
    // console.log("VCNPaymaster deployed to:", await paymaster.getAddress());

    // 5. Deploy NodeLicense (Needs VCNToken address)
    const NodeLicense = await hre.ethers.getContractFactory("VisionNodeLicense");
    const nodeLicense = await NodeLicense.deploy(await token.getAddress());
    await nodeLicense.waitForDeployment();
    console.log("VisionNodeLicense deployed to:", await nodeLicense.getAddress());

    // 6. Deploy VisionMiningPool (Needs NodeLicense, VCNToken, Oracle)
    // Using deployer as initial Oracle
    const MiningPool = await hre.ethers.getContractFactory("VisionMiningPool");
    const miningPool = await MiningPool.deploy(
        await nodeLicense.getAddress(),
        await token.getAddress(),
        deployer.address
    );
    await miningPool.waitForDeployment();
    console.log("VisionMiningPool deployed to:", await miningPool.getAddress());

    // 7. Setup & Permissions
    // Grant MINTER_ROLE to MiningPool so it can mint rewards on demand
    const MINTER_ROLE = await token.MINTER_ROLE();
    await token.grantRole(MINTER_ROLE, await miningPool.getAddress());
    console.log("Granted MINTER_ROLE to VisionMiningPool");

    console.log("Deployment & Initial Setup complete.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
