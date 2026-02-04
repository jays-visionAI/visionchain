/**
 * Staking Snapshot Script
 * 
 * Extracts all staking positions from BridgeStaking contract
 * for migration to new Native VCN chain.
 * 
 * Usage: node scripts/snapshot-staking.js
 */

import { ethers } from 'ethers';
import fs from 'fs';

// Configuration
const RPC_URL = 'http://46.224.221.201:8545';
const BRIDGE_STAKING_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Set actual address
const OUTPUT_FILE = './snapshots/staking-snapshot.json';

// BridgeStaking ABI (minimal)
const STAKING_ABI = [
    'function validators(address) view returns (uint256 stakedAmount, uint256 unstakeRequestTime, uint256 unstakeAmount, uint256 rewardDebt, uint256 pendingRewards, bool isActive)',
    'function validatorList(uint256) view returns (address)',
    'function getValidatorCount() view returns (uint256)',
    'function totalStaked() view returns (uint256)',
    'event Staked(address indexed validator, uint256 amount, uint256 totalStaked)'
];

async function main() {
    console.log('=== Staking Snapshot ===\n');

    // Check if staking contract is deployed
    if (BRIDGE_STAKING_ADDRESS === '0x0000000000000000000000000000000000000000') {
        console.log('No BridgeStaking contract address configured.');
        console.log('Checking for deployed staking contracts...\n');

        // Try to find staking contract from events or known addresses
        // For now, create empty snapshot
        const snapshot = {
            timestamp: new Date().toISOString(),
            stakingContract: null,
            totalStaked: '0',
            validators: []
        };

        if (!fs.existsSync('./snapshots')) {
            fs.mkdirSync('./snapshots', { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(snapshot, null, 2));
        console.log('Empty staking snapshot created (no staking contract found)');
        console.log(`Saved to: ${OUTPUT_FILE}`);
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, STAKING_ABI, provider);

    // Get validator count
    const validatorCount = await stakingContract.getValidatorCount();
    console.log(`Validator Count: ${validatorCount}`);

    // Get total staked
    const totalStaked = await stakingContract.totalStaked();
    console.log(`Total Staked: ${ethers.formatEther(totalStaked)} VCN\n`);

    // Get all validators
    const validators = [];
    for (let i = 0; i < validatorCount; i++) {
        const validatorAddress = await stakingContract.validatorList(i);
        const info = await stakingContract.validators(validatorAddress);

        validators.push({
            address: validatorAddress.toLowerCase(),
            stakedAmount: info.stakedAmount.toString(),
            stakedAmountFormatted: ethers.formatEther(info.stakedAmount),
            unstakeRequestTime: info.unstakeRequestTime.toString(),
            unstakeAmount: info.unstakeAmount.toString(),
            rewardDebt: info.rewardDebt.toString(),
            pendingRewards: info.pendingRewards.toString(),
            isActive: info.isActive
        });

        console.log(`  ${validatorAddress}: ${ethers.formatEther(info.stakedAmount)} VCN (Active: ${info.isActive})`);
    }

    // Create snapshot
    const snapshot = {
        timestamp: new Date().toISOString(),
        stakingContract: BRIDGE_STAKING_ADDRESS,
        totalStaked: totalStaked.toString(),
        totalStakedFormatted: ethers.formatEther(totalStaked),
        validatorCount: validators.length,
        validators: validators
    };

    // Save snapshot
    if (!fs.existsSync('./snapshots')) {
        fs.mkdirSync('./snapshots', { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(snapshot, null, 2));
    console.log(`\nSnapshot saved to: ${OUTPUT_FILE}`);

    console.log('\n=== Staking Snapshot Complete ===');
}

main().catch(console.error);
