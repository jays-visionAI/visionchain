/**
 * Create Test Intent on Sepolia with EIP-712 Signature
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const SEPOLIA_RPC = process.env.SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com';
const INTENT_COMMITMENT = process.env.SRC_INTENT_COMMITMENT;
const TSS_KEY = process.env.TSS_PRIVATE_KEY;

const INTENT_ABI = [
    "function commitIntent((address user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry) intent, bytes signature) external returns (bytes32)",
    "function getNextNonce(address user) view returns (uint256)",
    "function domainSeparator() view returns (bytes32)",
    "event IntentCommitted(bytes32 indexed intentHash, address indexed user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry)"
];

// EIP-712
const DOMAIN = {
    name: 'VisionBridge',
    version: '1',
    chainId: 11155111,  // Sepolia
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

async function createTestIntent() {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(TSS_KEY, provider);

    console.log("=== Create Test Intent on Sepolia (EIP-712) ===\n");
    console.log(`Wallet: ${wallet.address}`);
    console.log(`IntentCommitment: ${INTENT_COMMITMENT}`);

    const balance = await provider.getBalance(wallet.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);

    const contract = new ethers.Contract(INTENT_COMMITMENT, INTENT_ABI, wallet);

    // Get next nonce
    const nonce = await contract.getNextNonce(wallet.address);
    console.log(`Using nonce: ${nonce}`);

    // Intent data
    const intent = {
        user: wallet.address,
        srcChainId: 11155111n,  // Sepolia
        dstChainId: 1337n,       // Vision
        token: ethers.ZeroAddress,
        amount: ethers.parseEther('0.001'),
        recipient: wallet.address,
        nonce: nonce,
        expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
    };

    console.log("\nIntent:");
    console.log(`  srcChainId: ${intent.srcChainId}`);
    console.log(`  dstChainId: ${intent.dstChainId}`);
    console.log(`  token: ${intent.token}`);
    console.log(`  amount: ${ethers.formatEther(intent.amount)}`);
    console.log(`  recipient: ${intent.recipient}`);
    console.log(`  expiry: ${new Date(Number(intent.expiry) * 1000).toISOString()}`);

    // Sign with EIP-712
    console.log("\nSigning with EIP-712...");
    const signature = await wallet.signTypedData(DOMAIN, TYPES, intent);
    console.log(`Signature: ${signature.slice(0, 20)}...`);

    // Submit
    console.log("\nSubmitting commitIntent...");
    try {
        const tx = await contract.commitIntent(intent, signature, { gasLimit: 300000 });
        console.log(`Tx: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`Confirmed in block ${receipt.blockNumber}`);

        // Parse event
        for (const log of receipt.logs) {
            try {
                const parsed = contract.interface.parseLog(log);
                if (parsed && parsed.name === 'IntentCommitted') {
                    console.log(`\nIntent committed!`);
                    console.log(`  IntentHash: ${parsed.args[0]}`);
                }
            } catch { }
        }

        console.log("\n=== SUCCESS! TSS Signer should pick this up ===");

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
}

createTestIntent();
