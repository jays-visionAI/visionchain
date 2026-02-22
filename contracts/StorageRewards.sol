// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StorageRewards
 * @dev On-chain reward distribution for storage node operators.
 *      Calculates rewards based on uptime, storage capacity, proof success rate,
 *      and node class weight. Supports slashing for misbehavior.
 *
 *      Reward pool is funded by the contract owner (admin) via fundPool().
 *      Nodes claim accumulated rewards through claimReward().
 */
contract StorageRewards is Ownable, ReentrancyGuard, Pausable {

    struct RewardInfo {
        uint256 pendingReward;
        uint256 totalClaimed;
        uint256 lastCalculation;
        uint256 slashCount;
        bool slashed; // currently slashed (no rewards)
    }

    // Storage
    mapping(bytes32 => RewardInfo) public rewards;
    bytes32[] public rewardedNodes;

    // Reward configuration
    uint256 public baseRewardPerDay = 1 ether;       // 1 VCN base per day
    uint256 public storageBonusMultiplier = 100;      // per GB, basis points (1%)
    uint256 public proofBonusMultiplier = 500;        // for 100% proof rate, basis points (5%)
    uint256 public slashPenaltyPercent = 50;          // 50% of pending rewards slashed
    uint256 public slashCooldownDays = 7;

    // Pool
    uint256 public rewardPoolBalance;
    uint256 public totalDistributed;

    // Authorized executors
    mapping(address => bool) public isExecutor;

    // Node operator wallets (nodeId => wallet)
    mapping(bytes32 => address) public nodeWallets;

    // Events
    event RewardAccrued(bytes32 indexed nodeId, uint256 amount, uint256 totalPending);
    event RewardClaimed(bytes32 indexed nodeId, address indexed wallet, uint256 amount);
    event NodeSlashed(bytes32 indexed nodeId, uint256 penaltyAmount, string reason);
    event PoolFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event NodeWalletSet(bytes32 indexed nodeId, address wallet);
    event ExecutorUpdated(address indexed executor, bool allowed);

    modifier onlyExecutor() {
        require(isExecutor[msg.sender] || msg.sender == owner(), "Not an executor");
        _;
    }

    constructor() Ownable(msg.sender) {
        isExecutor[msg.sender] = true;
    }

    /**
     * @dev Fund the reward pool with native VCN
     */
    function fundPool() external payable {
        require(msg.value > 0, "Must send VCN");
        rewardPoolBalance += msg.value;
        emit PoolFunded(msg.sender, msg.value, rewardPoolBalance);
    }

    /**
     * @dev Set the wallet address for a node
     */
    function setNodeWallet(bytes32 nodeId, address wallet) external onlyExecutor {
        require(wallet != address(0), "Invalid wallet");
        nodeWallets[nodeId] = wallet;

        // Initialize reward tracker if first time
        if (rewards[nodeId].lastCalculation == 0) {
            rewards[nodeId].lastCalculation = block.timestamp;
            rewardedNodes.push(nodeId);
        }

        emit NodeWalletSet(nodeId, wallet);
    }

    /**
     * @dev Accrue rewards for a node based on its contribution
     * @param nodeId The node identifier
     * @param uptimeHours Node uptime in hours since last calculation
     * @param capacityGB Allocated storage capacity
     * @param proofSuccessRate Success rate in basis points (0-10000)
     * @param weightBp Node class weight in basis points (100 = 1x)
     */
    function accrueReward(
        bytes32 nodeId,
        uint256 uptimeHours,
        uint256 capacityGB,
        uint256 proofSuccessRate,
        uint256 weightBp
    ) external onlyExecutor whenNotPaused {
        RewardInfo storage info = rewards[nodeId];

        // Skip if currently slashed
        if (info.slashed) return;

        // Initialize if needed
        if (info.lastCalculation == 0) {
            info.lastCalculation = block.timestamp;
            rewardedNodes.push(nodeId);
        }

        // Calculate reward:
        // reward = baseRate * weight * (1 + storageBonus + proofBonus) * (uptimeHours / 24)
        uint256 dayFraction = (uptimeHours * 1e18) / 24;
        uint256 weightedBase = (baseRewardPerDay * weightBp) / 10000;

        // Storage bonus: capacityGB * storageBonusMultiplier / 10000
        uint256 storageBonus = (capacityGB * storageBonusMultiplier);

        // Proof bonus: proofSuccessRate * proofBonusMultiplier / 10000
        uint256 proofBonus = (proofSuccessRate * proofBonusMultiplier) / 10000;

        // Total multiplier = 10000 (base) + storageBonus + proofBonus
        uint256 totalMultiplier = 10000 + storageBonus + proofBonus;

        uint256 reward = (weightedBase * totalMultiplier * dayFraction) / (10000 * 1e18);

        if (reward > 0) {
            info.pendingReward += reward;
            info.lastCalculation = block.timestamp;
            emit RewardAccrued(nodeId, reward, info.pendingReward);
        }
    }

    /**
     * @dev Batch accrue rewards for multiple nodes
     */
    function accrueRewardBatch(
        bytes32[] calldata nodeIds,
        uint256[] calldata uptimeHours,
        uint256[] calldata capacityGBs,
        uint256[] calldata proofRates,
        uint256[] calldata weights
    ) external onlyExecutor whenNotPaused {
        require(
            nodeIds.length == uptimeHours.length &&
            nodeIds.length == capacityGBs.length &&
            nodeIds.length == proofRates.length &&
            nodeIds.length == weights.length,
            "Array length mismatch"
        );

        for (uint256 i = 0; i < nodeIds.length; i++) {
            RewardInfo storage info = rewards[nodeIds[i]];
            if (info.slashed) continue;

            if (info.lastCalculation == 0) {
                info.lastCalculation = block.timestamp;
                rewardedNodes.push(nodeIds[i]);
            }

            uint256 dayFraction = (uptimeHours[i] * 1e18) / 24;
            uint256 weightedBase = (baseRewardPerDay * weights[i]) / 10000;
            uint256 storageBonus = capacityGBs[i] * storageBonusMultiplier;
            uint256 proofBonus = (proofRates[i] * proofBonusMultiplier) / 10000;
            uint256 totalMultiplier = 10000 + storageBonus + proofBonus;
            uint256 reward = (weightedBase * totalMultiplier * dayFraction) / (10000 * 1e18);

            if (reward > 0) {
                info.pendingReward += reward;
                info.lastCalculation = block.timestamp;
                emit RewardAccrued(nodeIds[i], reward, info.pendingReward);
            }
        }
    }

    /**
     * @dev Claim pending rewards for a node
     */
    function claimReward(bytes32 nodeId) external nonReentrant whenNotPaused {
        address wallet = nodeWallets[nodeId];
        require(wallet != address(0), "No wallet set");
        require(msg.sender == wallet || isExecutor[msg.sender] || msg.sender == owner(), "Not authorized");

        RewardInfo storage info = rewards[nodeId];
        uint256 amount = info.pendingReward;
        require(amount > 0, "No pending rewards");
        require(rewardPoolBalance >= amount, "Insufficient pool balance");

        info.pendingReward = 0;
        info.totalClaimed += amount;
        rewardPoolBalance -= amount;
        totalDistributed += amount;

        (bool success, ) = wallet.call{value: amount}("");
        require(success, "Transfer failed");

        emit RewardClaimed(nodeId, wallet, amount);
    }

    /**
     * @dev Slash a node's rewards for misbehavior
     */
    function slashNode(bytes32 nodeId, string calldata reason) external onlyExecutor {
        RewardInfo storage info = rewards[nodeId];

        uint256 penalty = (info.pendingReward * slashPenaltyPercent) / 100;
        info.pendingReward -= penalty;
        info.slashCount++;
        info.slashed = true;

        // Return penalty to pool
        rewardPoolBalance += penalty;

        emit NodeSlashed(nodeId, penalty, reason);
    }

    /**
     * @dev Unslash a node (restore rewards eligibility)
     */
    function unslashNode(bytes32 nodeId) external onlyExecutor {
        rewards[nodeId].slashed = false;
        rewards[nodeId].lastCalculation = block.timestamp;
    }

    // --- View Functions ---

    function getRewardInfo(bytes32 nodeId) external view returns (RewardInfo memory) {
        return rewards[nodeId];
    }

    function calculatePendingReward(bytes32 nodeId) external view returns (uint256) {
        return rewards[nodeId].pendingReward;
    }

    function getPoolStats() external view returns (
        uint256 poolBalance,
        uint256 distributed,
        uint256 totalNodes
    ) {
        return (rewardPoolBalance, totalDistributed, rewardedNodes.length);
    }

    // --- Admin ---

    function setBaseReward(uint256 rewardPerDay) external onlyOwner {
        baseRewardPerDay = rewardPerDay;
    }

    function setStorageBonusMultiplier(uint256 multiplier) external onlyOwner {
        storageBonusMultiplier = multiplier;
    }

    function setProofBonusMultiplier(uint256 multiplier) external onlyOwner {
        proofBonusMultiplier = multiplier;
    }

    function setSlashPenalty(uint256 percent) external onlyOwner {
        require(percent <= 100, "Invalid percent");
        slashPenaltyPercent = percent;
    }

    function setExecutor(address executor, bool allowed) external onlyOwner {
        isExecutor[executor] = allowed;
        emit ExecutorUpdated(executor, allowed);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // Emergency withdraw
    function emergencyWithdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool success, ) = owner().call{value: bal}("");
        require(success, "Withdraw failed");
    }

    receive() external payable {
        rewardPoolBalance += msg.value;
    }
}
