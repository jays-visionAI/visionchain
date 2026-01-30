/**
 * Test Intent on Vision Chain (for reverse bridge)
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const VISION_RPC = process.env.VISION_RPC;
const INTENT_COMMITMENT = process.env.DST_INTENT_COMMITMENT;  // Vision IntentCommitment
const TSS_KEY = process.env.TSS_PRIVATE_KEY;

const DOMAIN = {
    name: 'VisionBridge',
    version: '1',
    chainId: 1337,  // Vision Chain
    verifyingContract: INTENT_COMMITMENT
};

const TYPES = {
    BridgeIntent: [
        { name: 'user', type: 'address' },
        { name: 'srcChainId', type: 'uint256' },
        { name: 'dstChainId', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'recipient', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'expiry', type: 'uint256' }
    ]
};

const INTENT_ABI = [
    "function commitIntent((address user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry) intent, bytes signature) external returns (bytes32)",
    "function getNextNonce(address user) view returns (uint256)"
];

async function createReverseIntent() {
    const provider = new ethers.JsonRpcProvider(VISION_RPC);
    const wallet = new ethers.Wallet(TSS_KEY, provider);
    const contract = new ethers.Contract(INTENT_COMMITMENT, INTENT_ABI, wallet);

    console.log("=== Create Reverse Intent (Vision → Sepolia) ===\n");
    console.log(`Wallet: ${wallet.address}`);
    console.log(`Vision IntentCommitment: ${INTENT_COMMITMENT}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} VCN\n`);

    const nonce = await contract.getNextNonce(wallet.address);
    console.log(`Using nonce: ${nonce}`);

    const intent = {
        user: wallet.address,
        srcChainId: 1337n,        // Vision (source)
        dstChainId: 11155111n,    // Sepolia (destination)
        token: ethers.ZeroAddress,
        amount: ethers.parseEther('0.001'),
        recipient: wallet.address,
        nonce: nonce,
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };

    console.log("\nIntent:");
    console.log(`  srcChainId: ${intent.srcChainId} (Vision)`);
    console.log(`  dstChainId: ${intent.dstChainId} (Sepolia)`);
    console.log(`  amount: ${ethers.formatEther(intent.amount)}`);
    console.log(`  recipient: ${intent.recipient}`);

    console.log("\nSigning with EIP-712...");
    const signature = await wallet.signTypedData(DOMAIN, TYPES, intent);

    console.log("\nSubmitting commitIntent...");
    try {
        const tx = await contract.commitIntent(intent, signature, { gasLimit: 300000 });
        console.log(`Tx: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`Confirmed in block ${receipt.blockNumber}`);

        console.log("\n=== SUCCESS! Reverse Signer should pick this up ===");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

createReverseIntent().catch(console.error);
