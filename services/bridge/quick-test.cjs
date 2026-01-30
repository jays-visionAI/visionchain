/**
 * Quick connectivity test for bridge contracts
 */

const { ethers } = require('ethers');

const CONTRACTS = {
    sepolia: {
        rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
        messageInbox: '0xd84967816156F91349c295eF3e61d1aDc3dC7641'
    },
    vision: {
        rpc: 'https://api.visionchain.co/rpc-proxy',
        messageInbox: '0x408F924BAEC71cC3968614Cb2c58E155A35e6890'
    }
};

const ABI = [
    "function TSS_ROLE() view returns (bytes32)"
];

async function test() {
    console.log("=== Bridge Connectivity Test ===\n");

    // Test Vision
    console.log("1. Vision Chain...");
    try {
        const provider = new ethers.JsonRpcProvider(CONTRACTS.vision.rpc);
        const network = await provider.getNetwork();
        console.log(`   Chain ID: ${network.chainId}`);

        const contract = new ethers.Contract(CONTRACTS.vision.messageInbox, ABI, provider);
        const role = await contract.TSS_ROLE();
        console.log(`   TSS_ROLE: ${role.slice(0, 18)}...`);
        console.log("   Status: OK\n");
    } catch (e) {
        console.log(`   Status: FAILED - ${e.message}\n`);
    }

    // Test Sepolia
    console.log("2. Sepolia...");
    try {
        const provider = new ethers.JsonRpcProvider(CONTRACTS.sepolia.rpc);
        const network = await provider.getNetwork();
        console.log(`   Chain ID: ${network.chainId}`);

        const contract = new ethers.Contract(CONTRACTS.sepolia.messageInbox, ABI, provider);
        const role = await contract.TSS_ROLE();
        console.log(`   TSS_ROLE: ${role.slice(0, 18)}...`);
        console.log("   Status: OK\n");
    } catch (e) {
        console.log(`   Status: FAILED - ${e.message}\n`);
    }

    console.log("=== Test Complete ===");
}

test();
