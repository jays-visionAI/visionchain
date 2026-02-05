/**
 * Deploy Secure Bridge Contracts
 * 
 * Deploys the Phase 1 security-enhanced bridge system:
 * 1. IntentCommitment - On-chain intent registration
 * 2. MessageInbox - Optimistic message processing
 * 3. VisionBridgeSecure - Main bridge with all security features
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RPC_URL = 'http://46.224.221.201:8545';
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

if (!ADMIN_PRIVATE_KEY) {
    console.error('ERROR: ADMIN_PRIVATE_KEY environment variable is required');
    console.error('Usage: ADMIN_PRIVATE_KEY=0x... node scripts/deploy-bridge-secure.js');
    process.exit(1);
}

// Supported destination chains
const SEPOLIA_CHAIN_ID = 11155111;

// Load artifact
function loadArtifact(contractPath, contractName) {
    const artifactPath = path.join(__dirname, '../artifacts/contracts', contractPath, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found: ${artifactPath}`);
    }
    return JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
}

async function main() {
    console.log("\n=== Vision Bridge Secure Deployment ===");
    console.log("Phase 1: Optimistic Security Model\n");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    console.log("Deployer:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Deployer VCN Balance:", ethers.formatEther(balance), "VCN\n");

    const chainId = (await provider.getNetwork()).chainId;
    console.log("Chain ID:", chainId.toString(), "\n");

    const deployedAddresses = {};

    // 1. Deploy IntentCommitment
    console.log("1. Deploying IntentCommitment...");
    const intentArtifact = loadArtifact('bridge/IntentCommitment.sol', 'IntentCommitment');
    const IntentFactory = new ethers.ContractFactory(intentArtifact.abi, intentArtifact.bytecode, wallet);
    const intent = await IntentFactory.deploy(wallet.address);
    await intent.waitForDeployment();
    deployedAddresses.INTENT_COMMITMENT = await intent.getAddress();
    console.log("   IntentCommitment:", deployedAddresses.INTENT_COMMITMENT);

    // 2. Deploy MessageInbox
    console.log("2. Deploying MessageInbox...");
    const inboxArtifact = loadArtifact('bridge/MessageInbox.sol', 'MessageInbox');
    const InboxFactory = new ethers.ContractFactory(inboxArtifact.abi, inboxArtifact.bytecode, wallet);
    const inbox = await InboxFactory.deploy(wallet.address);
    await inbox.waitForDeployment();
    deployedAddresses.MESSAGE_INBOX = await inbox.getAddress();
    console.log("   MessageInbox:", deployedAddresses.MESSAGE_INBOX);

    // 3. Deploy VisionBridgeSecure
    console.log("3. Deploying VisionBridgeSecure...");
    const bridgeArtifact = loadArtifact('bridge/VisionBridgeSecure.sol', 'VisionBridgeSecure');
    const BridgeFactory = new ethers.ContractFactory(bridgeArtifact.abi, bridgeArtifact.bytecode, wallet);
    const bridge = await BridgeFactory.deploy(
        wallet.address,
        deployedAddresses.INTENT_COMMITMENT,
        deployedAddresses.MESSAGE_INBOX
    );
    await bridge.waitForDeployment();
    deployedAddresses.VISION_BRIDGE_SECURE = await bridge.getAddress();
    console.log("   VisionBridgeSecure:", deployedAddresses.VISION_BRIDGE_SECURE);

    // 4. Configure IntentCommitment - grant OPERATOR_ROLE to bridge
    console.log("\n4. Configuring contracts...");
    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const tx1 = await intent.grantRole(OPERATOR_ROLE, deployedAddresses.VISION_BRIDGE_SECURE);
    await tx1.wait();
    console.log("   Granted OPERATOR_ROLE to bridge on IntentCommitment");

    // 5. Configure MessageInbox - grant roles
    const TSS_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TSS_ROLE"));
    const EXECUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("EXECUTOR_ROLE"));

    const tx2 = await inbox.grantRole(TSS_ROLE, wallet.address);
    await tx2.wait();
    const tx3 = await inbox.grantRole(EXECUTOR_ROLE, deployedAddresses.VISION_BRIDGE_SECURE);
    await tx3.wait();
    console.log("   Granted TSS_ROLE and EXECUTOR_ROLE on MessageInbox");

    // 6. Configure bridge - add supported chain (Sepolia)
    const tx4 = await bridge.configureChain(SEPOLIA_CHAIN_ID, true, ethers.ZeroAddress);
    await tx4.wait();
    console.log("   Configured Sepolia (11155111) as supported chain");

    // Summary
    console.log("\n=== Deployment Summary ===");
    console.log(JSON.stringify(deployedAddresses, null, 2));

    // Save to file
    const outputPath = path.join(__dirname, '../deployed-bridge-secure.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        ...deployedAddresses,
        ADMIN: wallet.address,
        CHAIN_ID: Number(chainId),
        DEPLOYED_AT: new Date().toISOString(),
        SECURITY_MODEL: "Optimistic + Intent Commitment"
    }, null, 2));
    console.log(`\nSaved to: ${outputPath}`);

    // Security features summary
    console.log("\n=== Security Features Enabled ===");
    console.log("1. Intent Commitment: Users must commit intent on-chain before locking");
    console.log("2. Optimistic Finality: Challenge period before mint (10min-2hr based on amount)");
    console.log("3. Rate Limiting: 100K VCN/user/day, 10M VCN global/day");
    console.log("4. Emergency Recovery: 7-day delay for stuck fund recovery");
    console.log("5. Supply Tracking: On-chain locked vs minted tracking");
    console.log("6. Challenge System: Challengers can dispute suspicious transactions");

    return deployedAddresses;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment Error:", error);
        process.exit(1);
    });
