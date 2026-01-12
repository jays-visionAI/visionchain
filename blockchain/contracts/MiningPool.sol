// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./NodeLicense.sol";

interface IVCNToken is IERC20 {
    function mint(address to, uint256 amount) external;
}

/**
 * @title VisionMiningPool (Advanced Tokenomics)
 * @dev Implements "Conditional Halving" & "Use-it-or-Lose-it" Logic.
 *      Uses "Mint-on-Demand" architecture where MiningPool has MINTER_ROLE.
 * 
 * [Rule Set]
 * 1. Total Supply: 10,000,000,000 (10 Billion) VCN over 20 years.
 * 2. Stage 1 Allocation: 5,000,000,000 (50%).
 * 3. Halving Trigger (whichever comes first):
 *    - Time: 1 Year (365 days) passed since stage start.
 *    - Growth: 250 New Paid Validator Nodes activated in this stage.
 * 4. Burn Logic: Unmined tokens in the current stage are never minted (effectively burned).
 */
contract VisionMiningPool is Ownable, ReentrancyGuard {
    
    VisionNodeLicense public nodeLicense;
    IVCNToken public vcnToken;
    address public oracleAddress;

    // --- Constants ---
    uint256 public constant TOTAL_MINING_SUPPLY = 10_000_000_000 * 10**18;
    uint256 public constant SECONDS_IN_YEAR = 365 days;
    uint256 public constant NODE_GROWTH_TRIGGER = 250; 

    // --- Stage State ---
    struct StageInfo {
        uint256 stageId;
        uint256 startTime;
        uint256 allocatedSupply;   // Max tokens minable in this stage
        uint256 minedAmount;       // Tokens actually mined so far
        uint256 startValidatorCount; // V.Node count at stage start
        uint256 dailyCap;          // DMMV (Daily Max Minable Volume)
    }

    StageInfo public currentStageInfo;
    uint256 public burnedSupply;   // Total tokens lost due to early halving

    uint256 public totalNetworkHashPower;
    
    // AOR: TokenID -> Day -> Score (0-100)
    mapping(uint256 => mapping(uint256 => uint256)) public dailyOperatingRates;
    mapping(uint256 => uint256) public lastClaimTime;

    event RewardClaimed(uint256 indexed tokenId, address indexed owner, uint256 amount);
    event OracleUpdated(uint256 indexed tokenId, uint256 day, uint256 aor);
    event HalvingTriggered(uint256 newStageId, string reason, uint256 burnedAmount);
    event LogDailyMining(uint256 day, uint256 totalDistributed);

    constructor(address _nodeLicense, address _vcnToken, address _oracle) Ownable() {
        nodeLicense = VisionNodeLicense(_nodeLicense);
        vcnToken = IVCNToken(_vcnToken);
        oracleAddress = _oracle;

        // Initialize Stage 1
        // 50% of Total Supply = 5 Billion
        uint256 stage1Supply = TOTAL_MINING_SUPPLY / 2;
        
        currentStageInfo = StageInfo({
            stageId: 1,
            startTime: block.timestamp,
            allocatedSupply: stage1Supply,
            minedAmount: 0,
            startValidatorCount: 0, // Assuming 0 at start
            dailyCap: stage1Supply / 365 // Simple daily spread, dynamic in reality
        });
    }

    // --- Core Operations ---

    /**
     * @dev Check and Trigger Halving if conditions are met.
     * Should be called periodically (e.g., via Cron/Oracle or before claim).
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
        
        // 2.3.1 Burn Logic: Unmined tokens are lost forever (we simply stop allowing mints for them)
        uint256 remainder = 0;
        if (oldStage.allocatedSupply > oldStage.minedAmount) {
            remainder = oldStage.allocatedSupply - oldStage.minedAmount;
            burnedSupply += remainder;
        }

        // Setup Next Stage
        uint256 nextStageId = oldStage.stageId + 1;
        uint256 nextAllocation = oldStage.allocatedSupply / 2; // Standard Halving (50% of prev allocation)
        
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

    /**
     * @dev Pay out rewards.
     */
    function calculateDailyReward(uint256 _tokenId) public view returns (uint256) {
        ( , , uint256 multiplier, , bool isActive) = nodeLicense.nodeDetails(_tokenId);
        
        if (!isActive || totalNetworkHashPower == 0) return 0;

        uint256 currentDay = block.timestamp / 86400;
        uint256 aor = dailyOperatingRates[_tokenId][currentDay - 1]; 
        if (aor == 0) return 0;

        // DMMV based on current stage
        uint256 dmmv = currentStageInfo.dailyCap;

        // Reward = (MyWeight / TotalWeight) * DMMV * (AOR%)
        uint256 theoretical = (dmmv * multiplier) / totalNetworkHashPower;
        return (theoretical * aor) / 100;
    }

    function claimReward(uint256 _tokenId) external nonReentrant {
        checkAndTriggerHalving(); // Check status before update

        require(nodeLicense.ownerOf(_tokenId) == msg.sender, "Not owner");
        
        uint256 reward = calculateDailyReward(_tokenId);
        require(reward > 0, "No valid reward");

        // Cap check: Cannot mine more than allocated for this stage
        require(currentStageInfo.minedAmount + reward <= currentStageInfo.allocatedSupply, "Stage supply exhausted");

        uint256 currentDay = block.timestamp / 86400;
        dailyOperatingRates[_tokenId][currentDay-1] = 0; // Consumption
        lastClaimTime[_tokenId] = block.timestamp;

        currentStageInfo.minedAmount += reward;
        
        // Mint new tokens (Mint-on-Demand)
        vcnToken.mint(msg.sender, reward);
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
}
