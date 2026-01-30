/**
 * Deploy Vision Bridge Phase 1 Contracts
 * 
 * Usage: npx hardhat run scripts/deploy-bridge-v3.js --network sepolia
 */

const hre = require("hardhat");

async function main() {
    console.log("\\n=== Vision Bridge Phase 1 Deployment ===\\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");

    const network = hre.network.name;
    console.log("Network:", network);
    console.log("");

    // 1. Deploy IntentCommitment
    console.log("1. Deploying IntentCommitment...");
    const IntentCommitment = await hre.ethers.getContractFactory("IntentCommitment");
    const intentCommitment = await IntentCommitment.deploy();
    await intentCommitment.waitForDeployment();
    const intentCommitmentAddr = await intentCommitment.getAddress();
    console.log("   IntentCommitment:", intentCommitmentAddr);

    // 2. Deploy MessageInbox
    console.log("2. Deploying MessageInbox...");
    const MessageInbox = await hre.ethers.getContractFactory("MessageInbox");
    const messageInbox = await MessageInbox.deploy();
    await messageInbox.waitForDeployment();
    const messageInboxAddr = await messageInbox.getAddress();
    console.log("   MessageInbox:", messageInboxAddr);

    // 3. Deploy ChallengeManager (requires MessageInbox address)
    console.log("3. Deploying ChallengeManager...");
    const ChallengeManager = await hre.ethers.getContractFactory("ChallengeManager");
    const challengeManager = await ChallengeManager.deploy(messageInboxAddr);
    await challengeManager.waitForDeployment();
    const challengeManagerAddr = await challengeManager.getAddress();
    console.log("   ChallengeManager:", challengeManagerAddr);

    // 4. Deploy VisionEqualizerV3 (requires addresses)
    console.log("4. Deploying VisionEqualizerV3...");

    // Use placeholder addresses for LZ endpoint and VCN token (to be updated later)
    const lzEndpointPlaceholder = "0x0000000000000000000000000000000000000001";
    const vcnTokenPlaceholder = "0x0000000000000000000000000000000000000002";

    const VisionEqualizerV3 = await hre.ethers.getContractFactory("VisionEqualizerV3");
    const equalizer = await VisionEqualizerV3.deploy(
        lzEndpointPlaceholder,
        messageInboxAddr,
        intentCommitmentAddr,
        vcnTokenPlaceholder
    );
    await equalizer.waitForDeployment();
    const equalizerAddr = await equalizer.getAddress();
    console.log("   VisionEqualizerV3:", equalizerAddr);

    // 5. Configure roles
    console.log("\\n5. Configuring roles...");

    // Grant BRIDGE_ROLE to MessageInbox on IntentCommitment
    const BRIDGE_ROLE = await intentCommitment.BRIDGE_ROLE();
    await intentCommitment.grantRole(BRIDGE_ROLE, messageInboxAddr);
    console.log("   IntentCommitment: Granted BRIDGE_ROLE to MessageInbox");

    // Grant CHALLENGER_ROLE to ChallengeManager on MessageInbox
    const CHALLENGER_ROLE = await messageInbox.CHALLENGER_ROLE();
    await messageInbox.grantRole(CHALLENGER_ROLE, challengeManagerAddr);
    console.log("   MessageInbox: Granted CHALLENGER_ROLE to ChallengeManager");

    // Grant TSS_ROLE to deployer (for testing)
    const TSS_ROLE = await messageInbox.TSS_ROLE();
    await messageInbox.grantRole(TSS_ROLE, deployer.address);
    console.log("   MessageInbox: Granted TSS_ROLE to deployer (for testing)");

    // Summary
    console.log("\\n=== Deployment Complete ===\\n");
    console.log("Contract Addresses:");
    console.log("-------------------");
    console.log(`IntentCommitment:  ${intentCommitmentAddr}`);
    console.log(`MessageInbox:      ${messageInboxAddr}`);
    console.log(`ChallengeManager:  ${challengeManagerAddr}`);
    console.log(`VisionEqualizerV3: ${equalizerAddr}`);
    console.log("");
    console.log("Save these addresses to your .env file!");
    console.log("");

    // Return for verification
    return {
        intentCommitment: intentCommitmentAddr,
        messageInbox: messageInboxAddr,
        challengeManager: challengeManagerAddr,
        equalizer: equalizerAddr
    };
}

main()
    .then((addresses) => {
        console.log("Deployment successful!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });
