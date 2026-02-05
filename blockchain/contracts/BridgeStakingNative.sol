// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BridgeStakingNative
 * @notice Validator staking contract for Vision Bridge security using native VCN
 * @dev All staking is done with native VCN (msg.value) instead of ERC-20
 */
contract BridgeStakingNative is Ownable, ReentrancyGuard {

    // ============ Constants ============
    uint256 public constant MINIMUM_STAKE = 10_000 * 1e18; // 10,000 VCN
    uint256 public constant COOLDOWN_PERIOD = 7 days;
    uint256 public constant SLASH_PERCENTAGE = 50; // 50%
    uint256 public constant PRECISION = 1e18;

    // ============ State Variables ============
    address public bridge;

    // Validator info
    struct ValidatorInfo {
        uint256 stakedAmount;
        uint256 unstakeRequestTime;
        uint256 unstakeAmount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        bool isActive;
    }

    mapping(address => ValidatorInfo) public validators;
    address[] public validatorList;
    uint256 public totalStaked;

    // ============ Reward Pools ============
    uint256 public rewardPool;
    uint256 public feePool;
    uint256 public accRewardPerShare;
    uint256 public totalRewardsPaid;
    uint256 public lastRewardTime;

    // Fixed APY System
    uint256 public targetAPY; // in basis points (1200 = 12%)
    uint256 public constant MAX_APY = 5000; // Max 50%

    // ============ Events ============
    event Staked(address indexed validator, uint256 amount, uint256 totalStaked);
    event UnstakeRequested(address indexed validator, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed validator, uint256 amount);
    event Slashed(address indexed validator, uint256 amount, address indexed slasher);
    event ValidatorActivated(address indexed validator);
    event ValidatorDeactivated(address indexed validator);
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    
    event TargetAPYSet(uint256 apyBasisPoints);
    event RewardPoolFunded(uint256 amount, uint256 newBalance);
    event RewardPoolWithdrawn(uint256 amount, uint256 newBalance);
    event FeesDeposited(uint256 amount);
    event RewardsClaimed(address indexed validator, uint256 amount);
    event RewardsUpdated(uint256 accRewardPerShare, uint256 totalRewardsPaid);

    // ============ Modifiers ============
    modifier onlyBridge() {
        require(msg.sender == bridge, "Only bridge can call");
        _;
    }

    modifier onlyActiveValidator() {
        require(validators[msg.sender].isActive, "Not an active validator");
        _;
    }

    // ============ Constructor ============
    constructor() {
        lastRewardTime = block.timestamp;
    }

    // ============ Admin Functions ============
    
    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid bridge address");
        address oldBridge = bridge;
        bridge = _bridge;
        emit BridgeUpdated(oldBridge, _bridge);
    }

    function setTargetAPY(uint256 _apyBasisPoints) external onlyOwner {
        require(_apyBasisPoints <= MAX_APY, "APY exceeds maximum");
        _updateRewards();
        targetAPY = _apyBasisPoints;
        emit TargetAPYSet(_apyBasisPoints);
    }

    /**
     * @notice Fund the reward pool with native VCN
     */
    function fundRewardPool() external payable onlyOwner {
        require(msg.value > 0, "Amount must be > 0");
        rewardPool += msg.value;
        emit RewardPoolFunded(msg.value, rewardPool);
    }

    function withdrawRewardPool(uint256 amount) external onlyOwner {
        require(amount <= rewardPool, "Insufficient reward pool");
        _updateRewards();
        rewardPool -= amount;
        payable(owner()).transfer(amount);
        emit RewardPoolWithdrawn(amount, rewardPool);
    }

    // ============ Bridge Functions ============

    /**
     * @notice Deposit bridge fees (native VCN)
     */
    function depositFees() external payable onlyBridge {
        require(msg.value > 0, "Amount must be > 0");
        _updateRewards();
        feePool += msg.value;
        
        if (totalStaked > 0) {
            accRewardPerShare += (msg.value * PRECISION) / totalStaked;
        }
        
        emit FeesDeposited(msg.value);
    }

    // ============ Staking Functions ============

    /**
     * @notice Stake native VCN to become a validator
     */
    function stake() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");
        
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        
        if (validator.stakedAmount > 0) {
            uint256 pending = _calculatePending(msg.sender);
            if (pending > 0) {
                validator.pendingRewards += pending;
            }
        }
        
        uint256 newTotal = validator.stakedAmount + msg.value;
        require(newTotal >= MINIMUM_STAKE, "Below minimum stake");

        if (validator.stakedAmount == 0) {
            validatorList.push(msg.sender);
        }

        validator.stakedAmount = newTotal;
        validator.rewardDebt = (newTotal * accRewardPerShare) / PRECISION;
        totalStaked += msg.value;

        if (!validator.isActive && newTotal >= MINIMUM_STAKE) {
            validator.isActive = true;
            emit ValidatorActivated(msg.sender);
        }

        emit Staked(msg.sender, msg.value, newTotal);
    }

    /**
     * @notice Request to unstake tokens
     */
    function requestUnstake(uint256 amount) external onlyActiveValidator nonReentrant {
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        require(amount > 0, "Amount must be > 0");
        require(validator.stakedAmount >= amount, "Insufficient stake");

        uint256 pending = _calculatePending(msg.sender);
        if (pending > 0) {
            validator.pendingRewards += pending;
        }

        uint256 remainingStake = validator.stakedAmount - amount;
        if (remainingStake > 0) {
            require(remainingStake >= MINIMUM_STAKE, "Would drop below minimum");
        }

        validator.unstakeRequestTime = block.timestamp;
        validator.unstakeAmount = amount;
        validator.rewardDebt = (remainingStake * accRewardPerShare) / PRECISION;

        if (remainingStake == 0) {
            validator.isActive = false;
            emit ValidatorDeactivated(msg.sender);
        }

        emit UnstakeRequested(msg.sender, amount, block.timestamp + COOLDOWN_PERIOD);
    }

    /**
     * @notice Withdraw unstaked tokens after cooldown
     */
    function withdraw() external nonReentrant {
        ValidatorInfo storage validator = validators[msg.sender];
        require(validator.unstakeAmount > 0, "No pending unstake");
        require(
            block.timestamp >= validator.unstakeRequestTime + COOLDOWN_PERIOD,
            "Cooldown not complete"
        );

        uint256 amount = validator.unstakeAmount;
        validator.stakedAmount -= amount;
        validator.unstakeAmount = 0;
        validator.unstakeRequestTime = 0;
        totalStaked -= amount;

        payable(msg.sender).transfer(amount);

        emit Withdrawn(msg.sender, amount);
    }

    function cancelUnstake() external {
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        require(validator.unstakeAmount > 0, "No pending unstake");

        if (!validator.isActive && validator.stakedAmount >= MINIMUM_STAKE) {
            validator.isActive = true;
            emit ValidatorActivated(msg.sender);
        }

        validator.rewardDebt = (validator.stakedAmount * accRewardPerShare) / PRECISION;
        validator.unstakeAmount = 0;
        validator.unstakeRequestTime = 0;
    }

    // ============ Reward Functions ============

    function claimRewards() external nonReentrant {
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        uint256 pending = _calculatePending(msg.sender) + validator.pendingRewards;
        
        require(pending > 0, "No rewards to claim");
        
        validator.pendingRewards = 0;
        validator.rewardDebt = (validator.stakedAmount * accRewardPerShare) / PRECISION;
        totalRewardsPaid += pending;
        
        payable(msg.sender).transfer(pending);
        
        emit RewardsClaimed(msg.sender, pending);
    }

    function _updateRewards() internal {
        if (block.timestamp <= lastRewardTime) {
            return;
        }
        
        if (totalStaked == 0) {
            lastRewardTime = block.timestamp;
            return;
        }
        
        uint256 timeDelta = block.timestamp - lastRewardTime;
        
        if (targetAPY > 0 && rewardPool > 0) {
            uint256 apyReward = (totalStaked * targetAPY * timeDelta) / (365 days * 10000);
            
            if (apyReward > rewardPool) {
                apyReward = rewardPool;
            }
            
            if (apyReward > 0) {
                rewardPool -= apyReward;
                accRewardPerShare += (apyReward * PRECISION) / totalStaked;
            }
        }
        
        lastRewardTime = block.timestamp;
        emit RewardsUpdated(accRewardPerShare, totalRewardsPaid);
    }

    function _calculatePending(address account) internal view returns (uint256) {
        ValidatorInfo storage validator = validators[account];
        if (validator.stakedAmount == 0) {
            return 0;
        }
        return (validator.stakedAmount * accRewardPerShare) / PRECISION - validator.rewardDebt;
    }

    // ============ Slashing Functions ============

    function slash(address validator, address challenger) 
        external 
        onlyBridge 
        nonReentrant 
        returns (uint256 slashedAmount) 
    {
        _updateRewards();
        
        ValidatorInfo storage info = validators[validator];
        require(info.stakedAmount > 0, "No stake to slash");

        info.pendingRewards = 0;

        slashedAmount = (info.stakedAmount * SLASH_PERCENTAGE) / 100;
        info.stakedAmount -= slashedAmount;
        info.rewardDebt = (info.stakedAmount * accRewardPerShare) / PRECISION;
        totalStaked -= slashedAmount;

        if (info.stakedAmount < MINIMUM_STAKE) {
            info.isActive = false;
            emit ValidatorDeactivated(validator);
        }

        if (challenger != address(0)) {
            payable(challenger).transfer(slashedAmount);
        }

        emit Slashed(validator, slashedAmount, challenger);
        return slashedAmount;
    }

    // ============ View Functions ============

    function pendingReward(address account) external view returns (uint256) {
        ValidatorInfo storage validator = validators[account];
        if (validator.stakedAmount == 0) {
            return validator.pendingRewards;
        }
        
        uint256 currentAcc = accRewardPerShare;
        
        if (totalStaked > 0 && targetAPY > 0 && rewardPool > 0 && block.timestamp > lastRewardTime) {
            uint256 timeDelta = block.timestamp - lastRewardTime;
            uint256 apyReward = (totalStaked * targetAPY * timeDelta) / (365 days * 10000);
            if (apyReward > rewardPool) {
                apyReward = rewardPool;
            }
            currentAcc += (apyReward * PRECISION) / totalStaked;
        }
        
        return (validator.stakedAmount * currentAcc) / PRECISION - validator.rewardDebt + validator.pendingRewards;
    }

    function currentAPY() external view returns (uint256) {
        return targetAPY;
    }

    function isActiveValidator(address account) external view returns (bool) {
        return validators[account].isActive;
    }

    function getStake(address account) external view returns (uint256) {
        return validators[account].stakedAmount;
    }

    function getPendingUnstake(address account) 
        external 
        view 
        returns (uint256 amount, uint256 unlockTime) 
    {
        ValidatorInfo storage info = validators[account];
        return (info.unstakeAmount, info.unstakeRequestTime + COOLDOWN_PERIOD);
    }

    function getValidatorCount() external view returns (uint256) {
        return validatorList.length;
    }

    function getActiveValidators() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeValidators = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeValidators[index++] = validatorList[i];
            }
        }
        return activeValidators;
    }

    function getRewardInfo() external view returns (
        uint256 _rewardPool,
        uint256 _feePool,
        uint256 _targetAPY,
        uint256 _totalStaked,
        uint256 _totalRewardsPaid
    ) {
        return (rewardPool, feePool, targetAPY, totalStaked, totalRewardsPaid);
    }

    // Allow contract to receive native VCN
    receive() external payable {}
}
