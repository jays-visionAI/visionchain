/**
 * Configure roles for deployed bridge contracts (Sepolia)
 */
const hre = require("hardhat");

async function main() {
    console.log("\\n=== Configuring Roles for Sepolia Contracts ===\\n");

    // Deployed contract addresses on Sepolia
    const CONTRACTS = {
        intentCommitment: "0x26Ad5a840F8828ecDF5563fFcf0A1a9ea318Dc0b",
        messageInbox: "0xd84967816156F91349c295eF3e61d1aDc3dC7641",
        challengeManager: "0x2855AfE6CAd2384A51baC518f57B4039FDad8aD6",
        equalizer: "0x6e6E465594cED9cA33995939b9579a8A29194983"
    };

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Get contract instances
    const intentCommitment = await hre.ethers.getContractAt("IntentCommitment", CONTRACTS.intentCommitment);
    const messageInbox = await hre.ethers.getContractAt("MessageInbox", CONTRACTS.messageInbox);

    // Check and grant BRIDGE_ROLE on IntentCommitment
    const BRIDGE_ROLE = await intentCommitment.BRIDGE_ROLE();
    const hasBridgeRole = await intentCommitment.hasRole(BRIDGE_ROLE, CONTRACTS.messageInbox);
    if (!hasBridgeRole) {
        console.log("Granting BRIDGE_ROLE to MessageInbox...");
        const tx1 = await intentCommitment.grantRole(BRIDGE_ROLE, CONTRACTS.messageInbox, { gasLimit: 100000 });
        await tx1.wait();
        console.log("Done!");
    } else {
        console.log("BRIDGE_ROLE already granted to MessageInbox");
    }

    // Check and grant CHALLENGER_ROLE on MessageInbox
    const CHALLENGER_ROLE = await messageInbox.CHALLENGER_ROLE();
    const hasChallengerRole = await messageInbox.hasRole(CHALLENGER_ROLE, CONTRACTS.challengeManager);
    if (!hasChallengerRole) {
        console.log("Granting CHALLENGER_ROLE to ChallengeManager...");
        const tx2 = await messageInbox.grantRole(CHALLENGER_ROLE, CONTRACTS.challengeManager, { gasLimit: 100000 });
        await tx2.wait();
        console.log("Done!");
    } else {
        console.log("CHALLENGER_ROLE already granted to ChallengeManager");
    }

    // Check and grant TSS_ROLE on MessageInbox
    const TSS_ROLE = await messageInbox.TSS_ROLE();
    const hasTssRole = await messageInbox.hasRole(TSS_ROLE, deployer.address);
    if (!hasTssRole) {
        console.log("Granting TSS_ROLE to deployer...");
        const tx3 = await messageInbox.grantRole(TSS_ROLE, deployer.address, { gasLimit: 100000 });
        await tx3.wait();
        console.log("Done!");
    } else {
        console.log("TSS_ROLE already granted to deployer");
    }

    console.log("\\n=== Role Configuration Complete ===\\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
