// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BridgeStaking
 * @notice Validator staking contract for Vision Bridge security with dual-pool rewards
 * @dev Implements stake, unstake with cooldown, slashing, and reward distribution
 * 
 * Reward System:
 * - Subsidy Pool: Foundation-funded incentives for early validators
 * - Fee Pool: Bridge transaction fees distributed to validators
 */
contract BridgeStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant MINIMUM_STAKE = 10_000 * 1e18; // 10,000 VCN
    uint256 public constant COOLDOWN_PERIOD = 7 days;
    uint256 public constant SLASH_PERCENTAGE = 50; // 50%
    uint256 public constant PRECISION = 1e18;

    // ============ State Variables ============
    IERC20 public immutable stakingToken;
    address public bridge;

    // Validator info
    struct ValidatorInfo {
        uint256 stakedAmount;
        uint256 unstakeRequestTime;
        uint256 unstakeAmount;
        uint256 rewardDebt;      // Used for reward calculation
        uint256 pendingRewards;  // Unclaimed rewards
        bool isActive;
    }

    mapping(address => ValidatorInfo) public validators;
    address[] public validatorList;
    uint256 public totalStaked;

    // ============ Reward Pools ============
    uint256 public rewardPool;            // Pre-funded reward pool for fixed APY
    uint256 public feePool;               // Bridge fee revenue pool
    uint256 public accRewardPerShare;     // Accumulated rewards per staked token (scaled by PRECISION)
    uint256 public totalRewardsPaid;      // Total rewards distributed
    uint256 public lastRewardTime;        // Last time rewards were calculated

    // Fixed APY System
    uint256 public targetAPY;             // Target APY in basis points (1200 = 12%)
    uint256 public constant MAX_APY = 5000; // Max 50% APY for safety

    // ============ Events ============
    event Staked(address indexed validator, uint256 amount, uint256 totalStaked);
    event UnstakeRequested(address indexed validator, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed validator, uint256 amount);
    event Slashed(address indexed validator, uint256 amount, address indexed slasher);
    event ValidatorActivated(address indexed validator);
    event ValidatorDeactivated(address indexed validator);
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);
    
    // Reward events
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
    constructor(address _stakingToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid token address");
        stakingToken = IERC20(_stakingToken);
        lastRewardTime = block.timestamp;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Set the bridge contract address
     * @param _bridge Address of the VisionBridge contract
     */
    function setBridge(address _bridge) external onlyOwner {
        require(_bridge != address(0), "Invalid bridge address");
        address oldBridge = bridge;
        bridge = _bridge;
        emit BridgeUpdated(oldBridge, _bridge);
    }

    /**
     * @notice Set the target APY for staking rewards
     * @param _apyBasisPoints APY in basis points (1200 = 12%)
     */
    function setTargetAPY(uint256 _apyBasisPoints) external onlyOwner {
        require(_apyBasisPoints <= MAX_APY, "APY exceeds maximum");
        
        // Update rewards before changing APY
        _updateRewards();
        
        targetAPY = _apyBasisPoints;
        emit TargetAPYSet(_apyBasisPoints);
    }

    /**
     * @notice Fund the reward pool (Foundation pre-funding)
     * @param amount Amount of VCN to add to reward pool
     */
    function fundRewardPool(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        
        emit RewardPoolFunded(amount, rewardPool);
    }

    /**
     * @notice Withdraw from reward pool
     * @param amount Amount to withdraw
     */
    function withdrawRewardPool(uint256 amount) external onlyOwner {
        require(amount <= rewardPool, "Insufficient reward pool");
        
        _updateRewards();
        
        rewardPool -= amount;
        stakingToken.safeTransfer(owner(), amount);
        
        emit RewardPoolWithdrawn(amount, rewardPool);
    }

    // ============ Bridge Functions ============

    /**
     * @notice Deposit bridge fees to the reward pool
     * @param amount Amount of VCN fees collected
     */
    function depositFees(uint256 amount) external onlyBridge {
        require(amount > 0, "Amount must be > 0");
        
        _updateRewards();
        
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        feePool += amount;
        
        // Immediately distribute fees to accRewardPerShare if there are stakers
        if (totalStaked > 0) {
            accRewardPerShare += (amount * PRECISION) / totalStaked;
        }
        
        emit FeesDeposited(amount);
    }

    // ============ Staking Functions ============

    /**
     * @notice Stake VCN tokens to become a validator
     * @param amount Amount of VCN to stake
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        
        // Claim pending rewards before stake changes
        if (validator.stakedAmount > 0) {
            uint256 pending = _calculatePending(msg.sender);
            if (pending > 0) {
                validator.pendingRewards += pending;
            }
        }
        
        uint256 newTotal = validator.stakedAmount + amount;
        require(newTotal >= MINIMUM_STAKE, "Below minimum stake");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        if (validator.stakedAmount == 0) {
            validatorList.push(msg.sender);
        }

        validator.stakedAmount = newTotal;
        validator.rewardDebt = (newTotal * accRewardPerShare) / PRECISION;
        totalStaked += amount;

        // Auto-activate if meeting minimum stake
        if (!validator.isActive && newTotal >= MINIMUM_STAKE) {
            validator.isActive = true;
            emit ValidatorActivated(msg.sender);
        }

        emit Staked(msg.sender, amount, newTotal);
    }

    /**
     * @notice Request to unstake tokens (starts cooldown period)
     * @param amount Amount to unstake
     */
    function requestUnstake(uint256 amount) external onlyActiveValidator nonReentrant {
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        require(amount > 0, "Amount must be > 0");
        require(validator.stakedAmount >= amount, "Insufficient stake");

        // Claim pending rewards before stake changes
        uint256 pending = _calculatePending(msg.sender);
        if (pending > 0) {
            validator.pendingRewards += pending;
        }

        // Check if remaining stake would be below minimum
        uint256 remainingStake = validator.stakedAmount - amount;
        if (remainingStake > 0) {
            require(remainingStake >= MINIMUM_STAKE, "Would drop below minimum");
        }

        validator.unstakeRequestTime = block.timestamp;
        validator.unstakeAmount = amount;
        validator.rewardDebt = (remainingStake * accRewardPerShare) / PRECISION;

        // If fully unstaking, deactivate
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

        stakingToken.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Cancel pending unstake request
     */
    function cancelUnstake() external {
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        require(validator.unstakeAmount > 0, "No pending unstake");

        // Reactivate if was deactivated
        if (!validator.isActive && validator.stakedAmount >= MINIMUM_STAKE) {
            validator.isActive = true;
            emit ValidatorActivated(msg.sender);
        }

        validator.rewardDebt = (validator.stakedAmount * accRewardPerShare) / PRECISION;
        validator.unstakeAmount = 0;
        validator.unstakeRequestTime = 0;
    }

    // ============ Reward Functions ============

    /**
     * @notice Claim pending rewards
     */
    function claimRewards() external nonReentrant {
        _updateRewards();
        
        ValidatorInfo storage validator = validators[msg.sender];
        uint256 pending = _calculatePending(msg.sender) + validator.pendingRewards;
        
        require(pending > 0, "No rewards to claim");
        
        validator.pendingRewards = 0;
        validator.rewardDebt = (validator.stakedAmount * accRewardPerShare) / PRECISION;
        totalRewardsPaid += pending;
        
        stakingToken.safeTransfer(msg.sender, pending);
        
        emit RewardsClaimed(msg.sender, pending);
    }

    /**
     * @notice Update reward accumulator based on fixed APY
     * @dev Calculates: (totalStaked * targetAPY * timeDelta) / (365 days * 10000)
     */
    function _updateRewards() internal {
        if (block.timestamp <= lastRewardTime) {
            return;
        }
        
        if (totalStaked == 0) {
            lastRewardTime = block.timestamp;
            return;
        }
        
        // Calculate fixed APY rewards
        uint256 timeDelta = block.timestamp - lastRewardTime;
        
        if (targetAPY > 0 && rewardPool > 0) {
            // Annual reward = totalStaked * APY / 10000
            // Per-second reward = Annual reward / 365 days
            // Reward for timeDelta = totalStaked * APY * timeDelta / (365 days * 10000)
            uint256 apyReward = (totalStaked * targetAPY * timeDelta) / (365 days * 10000);
            
            // Cap reward to available pool
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

    /**
     * @notice Calculate pending rewards for a validator
     */
    function _calculatePending(address account) internal view returns (uint256) {
        ValidatorInfo storage validator = validators[account];
        if (validator.stakedAmount == 0) {
            return 0;
        }
        return (validator.stakedAmount * accRewardPerShare) / PRECISION - validator.rewardDebt;
    }

    // ============ Slashing Functions ============

    /**
     * @notice Slash a validator's stake (called by bridge on invalid behavior)
     * @param validator Address of validator to slash
     * @param challenger Address of challenger who raised valid challenge
     * @return slashedAmount Amount that was slashed
     */
    function slash(address validator, address challenger) 
        external 
        onlyBridge 
        nonReentrant 
        returns (uint256 slashedAmount) 
    {
        _updateRewards();
        
        ValidatorInfo storage info = validators[validator];
        require(info.stakedAmount > 0, "No stake to slash");

        // Forfeit pending rewards
        info.pendingRewards = 0;

        slashedAmount = (info.stakedAmount * SLASH_PERCENTAGE) / 100;
        info.stakedAmount -= slashedAmount;
        info.rewardDebt = (info.stakedAmount * accRewardPerShare) / PRECISION;
        totalStaked -= slashedAmount;

        // Deactivate if below minimum
        if (info.stakedAmount < MINIMUM_STAKE) {
            info.isActive = false;
            emit ValidatorDeactivated(validator);
        }

        // Transfer slashed amount to challenger as reward
        if (challenger != address(0)) {
            stakingToken.safeTransfer(challenger, slashedAmount);
        }

        emit Slashed(validator, slashedAmount, challenger);
        return slashedAmount;
    }

    // ============ View Functions ============

    /**
     * @notice Get pending rewards for a validator
     */
    function pendingReward(address account) external view returns (uint256) {
        ValidatorInfo storage validator = validators[account];
        if (validator.stakedAmount == 0) {
            return validator.pendingRewards;
        }
        
        uint256 currentAcc = accRewardPerShare;
        
        // Add pending APY rewards
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

    /**
     * @notice Get current target APY (basis points)
     * @dev Returns the base APY set by foundation. Actual APY may be higher with fee distribution.
     */
    function currentAPY() external view returns (uint256) {
        return targetAPY;
    }

    /**
     * @notice Check if address is an active validator
     */
    function isActiveValidator(address account) external view returns (bool) {
        return validators[account].isActive;
    }

    /**
     * @notice Get validator stake amount
     */
    function getStake(address account) external view returns (uint256) {
        return validators[account].stakedAmount;
    }

    /**
     * @notice Get pending unstake info
     */
    function getPendingUnstake(address account) 
        external 
        view 
        returns (uint256 amount, uint256 unlockTime) 
    {
        ValidatorInfo storage info = validators[account];
        return (info.unstakeAmount, info.unstakeRequestTime + COOLDOWN_PERIOD);
    }

    /**
     * @notice Get total number of validators
     */
    function getValidatorCount() external view returns (uint256) {
        return validatorList.length;
    }

    /**
     * @notice Get all active validators
     */
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

    /**
     * @notice Get reward pool info
     */
    function getRewardInfo() external view returns (
        uint256 _rewardPool,
        uint256 _feePool,
        uint256 _targetAPY,
        uint256 _totalStaked,
        uint256 _totalRewardsPaid
    ) {
        return (rewardPool, feePool, targetAPY, totalStaked, totalRewardsPaid);
    }
}
