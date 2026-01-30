/**
 * Multi-Transaction Bridge Test - 3 recipients at 10s intervals
 */

const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const SEPOLIA_RPC = process.env.SEPOLIA_RPC;
const INTENT_COMMITMENT = process.env.SRC_INTENT_COMMITMENT;
const TSS_KEY = process.env.TSS_PRIVATE_KEY;

const DOMAIN = {
    name: 'VisionBridge',
    version: '1',
    chainId: 11155111,
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

// Test recipients (random addresses for testing)
const RECIPIENTS = [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333'
];

async function multiTest() {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = new ethers.Wallet(TSS_KEY, provider);
    const contract = new ethers.Contract(INTENT_COMMITMENT, INTENT_ABI, wallet);

    console.log("=== Multi-Transaction Bridge Test ===\n");
    console.log(`Wallet: ${wallet.address}`);
    console.log(`Recipients: ${RECIPIENTS.length}\n`);

    const results = [];

    for (let i = 0; i < RECIPIENTS.length; i++) {
        const recipient = RECIPIENTS[i];
        console.log(`\n--- Transaction ${i + 1}/${RECIPIENTS.length} ---`);
        console.log(`Recipient: ${recipient}`);

        try {
            const nonce = await contract.getNextNonce(wallet.address);

            const intent = {
                user: wallet.address,
                srcChainId: 11155111n,
                dstChainId: 1337n,
                token: ethers.ZeroAddress,
                amount: ethers.parseEther('0.001'),
                recipient: recipient,
                nonce: nonce,
                expiry: BigInt(Math.floor(Date.now() / 1000) + 3600)
            };

            const signature = await wallet.signTypedData(DOMAIN, TYPES, intent);

            const tx = await contract.commitIntent(intent, signature, { gasLimit: 300000 });
            console.log(`Tx: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`Confirmed in block ${receipt.blockNumber}`);

            results.push({ recipient, success: true, block: receipt.blockNumber });

            // Wait 10 seconds before next (except for last)
            if (i < RECIPIENTS.length - 1) {
                console.log("\nWaiting 10 seconds...");
                await new Promise(r => setTimeout(r, 10000));
            }

        } catch (error) {
            console.error(`Error: ${error.message}`);
            results.push({ recipient, success: false, error: error.message });
        }
    }

    console.log("\n\n=== Results ===");
    results.forEach((r, i) => {
        console.log(`${i + 1}. ${r.recipient.slice(0, 10)}... - ${r.success ? 'SUCCESS' : 'FAILED'}`);
    });

    console.log("\nCheck TSS Signer logs for processing all 3 intents!");
}

multiTest().catch(console.error);
