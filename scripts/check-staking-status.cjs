/**
 * Check Staking Contract Status
 * 
 * Queries on-chain data to see current staking state
 */

const { ethers } = require('ethers');

const RPC_URL = 'https://api.visionchain.co/rpc-proxy';
const BRIDGE_STAKING_ADDRESS = '0x746a48E39dC57Ff14B872B8979E20efE5E5100B1';

const STAKING_ABI = [
    'function totalStaked() external view returns (uint256)',
    'function getActiveValidators() external view returns (address[])',
    'function MINIMUM_STAKE() external view returns (uint256)',
    'function COOLDOWN_PERIOD() external view returns (uint256)',
    'function SLASH_PERCENTAGE() external view returns (uint256)',
    'function currentAPY() external view returns (uint256)',
    'function getRewardInfo() external view returns (uint256 subsidyPool, uint256 feePool, uint256 subsidyRatePerSecond, uint256 subsidyEndTime, uint256 totalRewardsPaid)',
    'function validators(address) external view returns (uint256 stakedAmount, uint256 unstakeRequestTime, uint256 unstakeAmount, uint256 rewardDebt, uint256 pendingRewards, bool isActive)',
    'function owner() external view returns (address)',
    'function getStake(address account) external view returns (uint256)'
];

async function checkStakingStatus() {
    console.log("=== Staking Contract Status ===\n");
    console.log(`Contract: ${BRIDGE_STAKING_ADDRESS}`);
    console.log(`RPC: ${RPC_URL}\n`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, STAKING_ABI, provider);

    try {
        // Basic contract info
        const [totalStaked, minStake, cooldown, slash] = await Promise.all([
            staking.totalStaked(),
            staking.MINIMUM_STAKE(),
            staking.COOLDOWN_PERIOD(),
            staking.SLASH_PERCENTAGE()
        ]);

        console.log("--- Contract Parameters ---");
        console.log(`Total Staked: ${ethers.formatEther(totalStaked)} VCN`);
        console.log(`Minimum Stake: ${ethers.formatEther(minStake)} VCN`);
        console.log(`Cooldown Period: ${Number(cooldown) / (24 * 60 * 60)} days`);
        console.log(`Slash Percentage: ${Number(slash)}%`);

        // Owner
        try {
            const owner = await staking.owner();
            console.log(`Contract Owner: ${owner}`);
        } catch {
            console.log(`Contract Owner: (not available)`);
        }

        // APY and Rewards
        try {
            const apy = await staking.currentAPY();
            console.log(`Current APY: ${Number(apy) / 100}%`);

            const rewardInfo = await staking.getRewardInfo();
            console.log(`Subsidy Pool: ${ethers.formatEther(rewardInfo[0])} VCN`);
            console.log(`Fee Pool: ${ethers.formatEther(rewardInfo[1])} VCN`);
        } catch (e) {
            console.log(`APY/Rewards: Not available - ${e.message}`);
        }

        // Active validators
        console.log("\n--- Active Validators ---");
        try {
            const validators = await staking.getActiveValidators();
            console.log(`Count: ${validators.length}`);

            if (validators.length > 0) {
                for (const addr of validators) {
                    try {
                        const info = await staking.validators(addr);
                        console.log(`\n  ${addr}:`);
                        console.log(`    Staked: ${ethers.formatEther(info.stakedAmount)} VCN`);
                        console.log(`    Active: ${info.isActive}`);
                        console.log(`    Pending Unstake: ${ethers.formatEther(info.unstakeAmount)} VCN`);
                    } catch (e) {
                        console.log(`  ${addr}: Error - ${e.message}`);
                    }
                }
            } else {
                console.log("No active validators found.");
            }
        } catch (e) {
            console.log(`Error fetching validators: ${e.message}`);
        }

        // Check a few known addresses
        console.log("\n--- Known Address Checks ---");
        const knownAddresses = [
            '0x6872E5cda7a24Fa38d8861Efe961fdF5E801d31d', // sangky94
            '0x6605Acc98E5F9dE16D82885ad84a25D95C94F794', // TSS
            '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'  // Hardhat default
        ];

        for (const addr of knownAddresses) {
            try {
                const stake = await staking.getStake(addr);
                if (stake > 0n) {
                    const info = await staking.validators(addr);
                    console.log(`\n${addr}:`);
                    console.log(`  Staked: ${ethers.formatEther(stake)} VCN`);
                    console.log(`  Active: ${info.isActive}`);
                }
            } catch {
                // Not a validator
            }
        }

    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkStakingStatus().catch(console.error);
