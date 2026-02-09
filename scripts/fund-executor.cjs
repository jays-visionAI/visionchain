const { ethers } = require('ethers');

const RPC_URL = 'https://api.visionchain.co/rpc-proxy';
const ADMIN_PK = process.env.VISION_ADMIN_PK;
const EXECUTOR_ADDRESS = '0x08A1B183a53a0f8f1D875945D504272738E3AF34';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(ADMIN_PK, provider);

    console.log('Admin wallet:', adminWallet.address);

    // Check admin balance
    const adminBalance = await provider.getBalance(adminWallet.address);
    console.log('Admin VCN balance:', ethers.formatEther(adminBalance), 'VCN');

    // Check executor balance before
    const executorBalanceBefore = await provider.getBalance(EXECUTOR_ADDRESS);
    console.log('Executor balance before:', ethers.formatEther(executorBalanceBefore), 'VCN');

    // Send 1000 VCN to executor
    const amount = ethers.parseEther('1000');
    console.log('Sending 1000 VCN to executor...');

    const tx = await adminWallet.sendTransaction({
        to: EXECUTOR_ADDRESS,
        value: amount,
        gasLimit: 21000
    });

    console.log('TX Hash:', tx.hash);
    await tx.wait();
    console.log('TX confirmed!');

    // Check executor balance after
    const executorBalanceAfter = await provider.getBalance(EXECUTOR_ADDRESS);
    console.log('Executor balance after:', ethers.formatEther(executorBalanceAfter), 'VCN');
}

main().catch(console.error);
