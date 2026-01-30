/**
 * Test connectivity to deployed bridge contracts
 */

import { ethers } from 'ethers';
import { BRIDGE_CONTRACTS } from './types';

const MESSAGE_INBOX_ABI = [
    "function pendingMessagesCount() view returns (uint256)",
    "function TSS_ROLE() view returns (bytes32)",
    "function CHALLENGER_ROLE() view returns (bytes32)"
];

const INTENT_COMMITMENT_ABI = [
    "function domainSeparator() view returns (bytes32)",
    "function BRIDGE_ROLE() view returns (bytes32)"
];

async function testConnectivity() {
    console.log("=== Bridge Contract Connectivity Test ===\n");

    // Test Vision Testnet
    console.log("1. Testing Vision Testnet...");
    try {
        const visionProvider = new ethers.JsonRpcProvider(BRIDGE_CONTRACTS.vision.rpc);
        const network = await visionProvider.getNetwork();
        console.log(`   Connected! Chain ID: ${network.chainId}`);

        const messageInbox = new ethers.Contract(
            BRIDGE_CONTRACTS.vision.messageInbox,
            MESSAGE_INBOX_ABI,
            visionProvider
        );
        const tssRole = await messageInbox.TSS_ROLE();
        console.log(`   MessageInbox TSS_ROLE: ${tssRole.slice(0, 18)}...`);
        console.log("   Vision Testnet: OK\n");
    } catch (error: any) {
        console.log(`   Vision Testnet: FAILED - ${error.message}\n`);
    }

    // Test Sepolia
    console.log("2. Testing Sepolia...");
    try {
        const sepoliaProvider = new ethers.JsonRpcProvider(BRIDGE_CONTRACTS.sepolia.rpc);
        const network = await sepoliaProvider.getNetwork();
        console.log(`   Connected! Chain ID: ${network.chainId}`);

        const intentCommitment = new ethers.Contract(
            BRIDGE_CONTRACTS.sepolia.intentCommitment,
            INTENT_COMMITMENT_ABI,
            sepoliaProvider
        );
        const domainSeparator = await intentCommitment.domainSeparator();
        console.log(`   IntentCommitment Domain: ${domainSeparator.slice(0, 18)}...`);
        console.log("   Sepolia: OK\n");
    } catch (error: any) {
        console.log(`   Sepolia: FAILED - ${error.message}\n`);
    }

    console.log("=== Test Complete ===");
}

testConnectivity().catch(console.error);
