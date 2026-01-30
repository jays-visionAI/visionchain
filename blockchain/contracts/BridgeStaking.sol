// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title BridgeStaking
 * @notice Validator staking contract for Vision Bridge security
 * @dev Implements stake, unstake with cooldown, and slashing mechanisms
 */
contract BridgeStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant MINIMUM_STAKE = 10_000 * 1e18; // 10,000 VCN
    uint256 public constant COOLDOWN_PERIOD = 7 days;
    uint256 public constant SLASH_PERCENTAGE = 50; // 50%

    // ============ State Variables ============
    IERC20 public immutable stakingToken;
    address public bridge;

    struct ValidatorInfo {
        uint256 stakedAmount;
        uint256 unstakeRequestTime;
        uint256 unstakeAmount;
        bool isActive;
    }

    mapping(address => ValidatorInfo) public validators;
    address[] public validatorList;
    uint256 public totalStaked;

    // ============ Events ============
    event Staked(address indexed validator, uint256 amount, uint256 totalStaked);
    event UnstakeRequested(address indexed validator, uint256 amount, uint256 unlockTime);
    event Withdrawn(address indexed validator, uint256 amount);
    event Slashed(address indexed validator, uint256 amount, address indexed slasher);
    event ValidatorActivated(address indexed validator);
    event ValidatorDeactivated(address indexed validator);
    event BridgeUpdated(address indexed oldBridge, address indexed newBridge);

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

    // ============ Staking Functions ============

    /**
     * @notice Stake VCN tokens to become a validator
     * @param amount Amount of VCN to stake
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        ValidatorInfo storage validator = validators[msg.sender];
        uint256 newTotal = validator.stakedAmount + amount;
        require(newTotal >= MINIMUM_STAKE, "Below minimum stake");

        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        if (validator.stakedAmount == 0) {
            validatorList.push(msg.sender);
        }

        validator.stakedAmount = newTotal;
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
        ValidatorInfo storage validator = validators[msg.sender];
        require(amount > 0, "Amount must be > 0");
        require(validator.stakedAmount >= amount, "Insufficient stake");

        // Check if remaining stake would be below minimum
        uint256 remainingStake = validator.stakedAmount - amount;
        if (remainingStake > 0) {
            require(remainingStake >= MINIMUM_STAKE, "Would drop below minimum");
        }

        validator.unstakeRequestTime = block.timestamp;
        validator.unstakeAmount = amount;

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
        ValidatorInfo storage validator = validators[msg.sender];
        require(validator.unstakeAmount > 0, "No pending unstake");

        // Reactivate if was deactivated
        if (!validator.isActive && validator.stakedAmount >= MINIMUM_STAKE) {
            validator.isActive = true;
            emit ValidatorActivated(msg.sender);
        }

        validator.unstakeAmount = 0;
        validator.unstakeRequestTime = 0;
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
        ValidatorInfo storage info = validators[validator];
        require(info.stakedAmount > 0, "No stake to slash");

        slashedAmount = (info.stakedAmount * SLASH_PERCENTAGE) / 100;
        info.stakedAmount -= slashedAmount;
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
}
