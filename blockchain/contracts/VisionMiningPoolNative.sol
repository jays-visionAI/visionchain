// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./VisionNodeLicenseNative.sol";

/**
 * @title VisionMiningPoolNative
 * @dev Mining pool for Vision Chain v2 with native VCN rewards.
 * 
 * Uses Native VCN instead of ERC-20 token.
 * Contract must be funded with VCN to pay out rewards.
 * 
 * [Rule Set]
 * 1. Total Supply: 10,000,000,000 (10 Billion) VCN over 20 years.
 * 2. Stage 1 Allocation: 5,000,000,000 (50%).
 * 3. Halving Trigger (whichever comes first):
 *    - Time: 1 Year (365 days) passed since stage start.
 *    - Growth: 250 New Paid Validator Nodes activated in this stage.
 */
contract VisionMiningPoolNative is Ownable, ReentrancyGuard {
    
    VisionNodeLicenseNative public nodeLicense;
    address public oracleAddress;

    // --- Constants ---
    uint256 public constant TOTAL_MINING_SUPPLY = 10_000_000_000 * 10**18;
    uint256 public constant SECONDS_IN_YEAR = 365 days;
    uint256 public constant NODE_GROWTH_TRIGGER = 250; 

    // --- Stage State ---
    struct StageInfo {
        uint256 stageId;
        uint256 startTime;
        uint256 allocatedSupply;
        uint256 minedAmount;
        uint256 startValidatorCount;
        uint256 dailyCap;
    }

    StageInfo public currentStageInfo;
    uint256 public burnedSupply;
    uint256 public totalNetworkHashPower;
    
    // AOR: TokenID -> Day -> Score (0-100)
    mapping(uint256 => mapping(uint256 => uint256)) public dailyOperatingRates;
    mapping(uint256 => uint256) public lastClaimTime;

    event RewardClaimed(uint256 indexed tokenId, address indexed owner, uint256 amount);
    event OracleUpdated(uint256 indexed tokenId, uint256 day, uint256 aor);
    event HalvingTriggered(uint256 newStageId, string reason, uint256 burnedAmount);
    event Funded(address indexed funder, uint256 amount);

    constructor(address _nodeLicense, address _oracle) Ownable() {
        nodeLicense = VisionNodeLicenseNative(_nodeLicense);
        oracleAddress = _oracle;

        // Initialize Stage 1 (50% of Total)
        uint256 stage1Supply = TOTAL_MINING_SUPPLY / 2;
        
        currentStageInfo = StageInfo({
            stageId: 1,
            startTime: block.timestamp,
            allocatedSupply: stage1Supply,
            minedAmount: 0,
            startValidatorCount: 0,
            dailyCap: stage1Supply / 365
        });
    }

    /**
     * @dev Fund the contract with native VCN for mining rewards
     */
    receive() external payable {
        emit Funded(msg.sender, msg.value);
    }

    /**
     * @dev Check and Trigger Halving if conditions are met.
     */
    function checkAndTriggerHalving() public {
        StageInfo storage stage = currentStageInfo;
        
        uint256 currentValidators = nodeLicense.currentValidatorCount();
        bool timeTrigger = block.timestamp >= stage.startTime + SECONDS_IN_YEAR;
        bool growthTrigger = currentValidators >= stage.startValidatorCount + NODE_GROWTH_TRIGGER;

        if (timeTrigger || growthTrigger) {
            _executeHalving(timeTrigger ? "TIME_LIMIT" : "NODE_GROWTH");
        }
    }

    function _executeHalving(string memory reason) internal {
        StageInfo memory oldStage = currentStageInfo;
        
        uint256 remainder = 0;
        if (oldStage.allocatedSupply > oldStage.minedAmount) {
            remainder = oldStage.allocatedSupply - oldStage.minedAmount;
            burnedSupply += remainder;
        }

        uint256 nextStageId = oldStage.stageId + 1;
        uint256 nextAllocation = oldStage.allocatedSupply / 2;
        
        currentStageInfo = StageInfo({
            stageId: nextStageId,
            startTime: block.timestamp,
            allocatedSupply: nextAllocation,
            minedAmount: 0,
            startValidatorCount: nodeLicense.currentValidatorCount(),
            dailyCap: nextAllocation / 365
        });

        emit HalvingTriggered(nextStageId, reason, remainder);
    }

    function calculateDailyReward(uint256 _tokenId) public view returns (uint256) {
        (,,uint256 multiplier,, bool isActive) = nodeLicense.nodeDetails(_tokenId);
        
        if (!isActive || totalNetworkHashPower == 0) return 0;

        uint256 currentDay = block.timestamp / 86400;
        uint256 aor = dailyOperatingRates[_tokenId][currentDay - 1]; 
        if (aor == 0) return 0;

        uint256 dmmv = currentStageInfo.dailyCap;

        // Reward = (MyWeight / TotalWeight) * DMMV * (AOR%)
        uint256 theoretical = (dmmv * multiplier) / totalNetworkHashPower;
        return (theoretical * aor) / 100;
    }

    /**
     * @dev Claim mining reward in native VCN
     */
    function claimReward(uint256 _tokenId) external nonReentrant {
        checkAndTriggerHalving();

        require(nodeLicense.ownerOf(_tokenId) == msg.sender, "Not owner");
        
        uint256 reward = calculateDailyReward(_tokenId);
        require(reward > 0, "No valid reward");
        require(address(this).balance >= reward, "Insufficient pool balance");
        require(currentStageInfo.minedAmount + reward <= currentStageInfo.allocatedSupply, "Stage supply exhausted");

        uint256 currentDay = block.timestamp / 86400;
        dailyOperatingRates[_tokenId][currentDay-1] = 0;
        lastClaimTime[_tokenId] = block.timestamp;

        currentStageInfo.minedAmount += reward;
        
        // Transfer native VCN reward
        (bool success, ) = payable(msg.sender).call{value: reward}("");
        require(success, "Reward transfer failed");

        emit RewardClaimed(_tokenId, msg.sender, reward);
    }

    // --- Oracle & Admin ---

    function submitDailyAOR(uint256 _tokenId, uint256 _aor) external {
        require(msg.sender == oracleAddress, "Only Oracle");
        uint256 currentDay = block.timestamp / 86400;
        dailyOperatingRates[_tokenId][currentDay] = _aor;
        emit OracleUpdated(_tokenId, currentDay, _aor);
    }

    function updateNetworkHash(uint256 _delta, bool _isAdding) external onlyOwner {
        if (_isAdding) totalNetworkHashPower += _delta;
        else totalNetworkHashPower -= _delta;
    }

    function setOracle(address _newOracle) external onlyOwner {
        oracleAddress = _newOracle;
    }

    function getPoolBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
