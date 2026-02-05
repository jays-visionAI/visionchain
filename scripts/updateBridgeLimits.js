/**
 * Update VisionBridgeSecure contract limits
 * 
 * This script calls setLimits() to change minLockAmount from 1 VCN to 0.1 VCN
 * 
 * Usage:
 *   node scripts/updateBridgeLimits.js
 * 
 * Requirements:
 *   - VCN_EXECUTOR_PK environment variable must be set (admin private key)
 */

import { ethers } from 'ethers';

// Contract addresses
const VISION_BRIDGE_SECURE_ADDRESS = '0xFDA890183E1e18eE7b02A94d9DF195515D914655';

// Vision Chain RPC (direct node access)
const VISION_RPC_URL = 'http://46.224.221.201:8545';

// VisionBridgeSecure ABI (only setLimits function)
const BRIDGE_ABI = [
    "function setLimits(uint256 _minLock, uint256 _maxLock, uint256 _maxDailyPerUser, uint256 _globalDaily) external",
    "function minLockAmount() view returns (uint256)",
    "function maxLockAmount() view returns (uint256)",
    "function maxDailyLockPerUser() view returns (uint256)",
    "function globalDailyLimit() view returns (uint256)"
];

async function main() {
    // Get admin private key from environment
    const adminPK = process.env.VCN_EXECUTOR_PK;
    if (!adminPK) {
        console.error('ERROR: VCN_EXECUTOR_PK environment variable not set');
        console.log('Usage: VCN_EXECUTOR_PK=0x... node scripts/updateBridgeLimits.js');
        process.exit(1);
    }

    // Connect to Vision Chain
    const provider = new ethers.JsonRpcProvider(VISION_RPC_URL);
    const adminWallet = new ethers.Wallet(adminPK, provider);
    const contract = new ethers.Contract(VISION_BRIDGE_SECURE_ADDRESS, BRIDGE_ABI, adminWallet);

    console.log('=== VisionBridgeSecure Limits Update ===');
    console.log('Contract:', VISION_BRIDGE_SECURE_ADDRESS);
    console.log('Admin:', adminWallet.address);
    console.log('');

    // Get current limits
    console.log('Current Limits:');
    try {
        const minLock = await contract.minLockAmount();
        const maxLock = await contract.maxLockAmount();
        const maxDaily = await contract.maxDailyLockPerUser();
        const globalDaily = await contract.globalDailyLimit();

        console.log(`  minLockAmount: ${ethers.formatEther(minLock)} VCN`);
        console.log(`  maxLockAmount: ${ethers.formatEther(maxLock)} VCN`);
        console.log(`  maxDailyLockPerUser: ${ethers.formatEther(maxDaily)} VCN`);
        console.log(`  globalDailyLimit: ${ethers.formatEther(globalDaily)} VCN`);
        console.log('');
    } catch (e) {
        console.log('  (Could not read current limits)');
        console.log('');
    }

    // New limits
    const newMinLock = ethers.parseEther("0.1");        // 0.1 VCN (was 1 VCN)
    const newMaxLock = ethers.parseEther("1000000");    // 1M VCN per tx
    const newMaxDailyPerUser = ethers.parseEther("100000"); // 100K VCN per day per user
    const newGlobalDaily = ethers.parseEther("10000000");   // 10M VCN total daily

    console.log('New Limits:');
    console.log(`  minLockAmount: ${ethers.formatEther(newMinLock)} VCN`);
    console.log(`  maxLockAmount: ${ethers.formatEther(newMaxLock)} VCN`);
    console.log(`  maxDailyLockPerUser: ${ethers.formatEther(newMaxDailyPerUser)} VCN`);
    console.log(`  globalDailyLimit: ${ethers.formatEther(newGlobalDaily)} VCN`);
    console.log('');

    // Send transaction
    console.log('Sending setLimits transaction...');
    try {
        const tx = await contract.setLimits(
            newMinLock,
            newMaxLock,
            newMaxDailyPerUser,
            newGlobalDaily
        );
        console.log('TX Hash:', tx.hash);

        const receipt = await tx.wait();
        console.log('Confirmed in block:', receipt.blockNumber);
        console.log('');
        console.log('SUCCESS! Bridge limits updated.');
    } catch (e) {
        console.error('FAILED:', e.message);
        if (e.message.includes('denied')) {
            console.log('');
            console.log('Note: Only DEFAULT_ADMIN_ROLE can call setLimits()');
        }
        process.exit(1);
    }
}

main().catch(console.error);
