// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VCNVesting
 * @dev Vesting contract for VCN token distribution.
 * Features:
 * - Cliff period (e.g., 3 months)
 * - Monthly unlock (e.g., 5% per month)
 * - "Ceil" rounding for number of rounds
 * - convertToNode function for foundation's special decision
 */
contract VCNVesting is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 releasedAmount;
        uint256 startTime;
        uint256 cliffDuration;
        uint256 vestingDuration;
        uint256 initialUnlockAmount;
        uint256 interval;
        bool isTerminated;
    }

    IERC20 public immutable vcnToken;
    mapping(address => VestingSchedule) public vestingSchedules;
    
    event VestingCreated(address indexed beneficiary, uint256 totalAmount, uint256 startTime);
    event TokensClaimed(address indexed beneficiary, uint256 amount);
    event VestingTerminated(address indexed beneficiary, uint256 remainingLocked);
    event ConvertedToNode(address indexed beneficiary, uint256 amount);

    constructor(address defaultAdmin, address vcnTokenAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(OPERATOR_ROLE, defaultAdmin);
        vcnToken = IERC20(vcnTokenAddress);
    }

    function createVestingSchedule(
        address beneficiary,
        uint256 totalAmount,
        uint256 initialUnlockRatio,
        uint256 cliffMonths,
        uint256 vestingMonths,
        uint256 startTime
    ) external onlyRole(OPERATOR_ROLE) {
        require(vestingSchedules[beneficiary].totalAmount == 0, "Vesting already exists");
        require(initialUnlockRatio <= 100, "Invalid ratio");

        uint256 initialUnlockAmount = (totalAmount * initialUnlockRatio) / 100;
        
        vestingSchedules[beneficiary] = VestingSchedule({
            totalAmount: totalAmount,
            releasedAmount: 0,
            startTime: startTime,
            cliffDuration: cliffMonths * 30 days,
            vestingDuration: vestingMonths * 30 days,
            initialUnlockAmount: initialUnlockAmount,
            interval: 30 days,
            isTerminated: false
        });

        emit VestingCreated(beneficiary, totalAmount, startTime);
    }

    function availableToClaim(address beneficiary) public view returns (uint256) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        if (schedule.totalAmount == 0 || schedule.isTerminated) return 0;

        uint256 currentTime = block.timestamp;
        if (currentTime < schedule.startTime) return 0;

        uint256 totalVested = schedule.initialUnlockAmount;

        uint256 cliffEnd = schedule.startTime + schedule.cliffDuration;
        if (currentTime >= cliffEnd) {
            uint256 timePassedSinceCliff = currentTime - cliffEnd;
            uint256 lockedAmount = schedule.totalAmount - schedule.initialUnlockAmount;
            
            // "Ceil" rounding for number of intervals
            // (time + interval - 1) / interval logic
            uint256 totalIntervals = (schedule.vestingDuration + schedule.interval - 1) / schedule.interval;
            
            if (timePassedSinceCliff >= schedule.vestingDuration) {
                totalVested = schedule.totalAmount;
            } else {
                uint256 intervalsPassed = (timePassedSinceCliff / schedule.interval) + 1;
                
                if (intervalsPassed >= totalIntervals) {
                    totalVested = schedule.totalAmount;
                } else {
                    uint256 amountPerInterval = lockedAmount / totalIntervals;
                    totalVested += (intervalsPassed * amountPerInterval);
                }
            }
        }

        if (totalVested > schedule.totalAmount) {
            totalVested = schedule.totalAmount;
        }

        return totalVested - schedule.releasedAmount;
    }

    function claim() external nonReentrant {
        uint256 amount = availableToClaim(msg.sender);
        require(amount > 0, "Nothing to claim");

        vestingSchedules[msg.sender].releasedAmount += amount;
        require(vcnToken.transfer(msg.sender, amount), "Transfer failed");

        emit TokensClaimed(msg.sender, amount);
    }

    function convertToNode(address beneficiary) external onlyRole(DEFAULT_ADMIN_ROLE) {
        VestingSchedule storage schedule = vestingSchedules[beneficiary];
        require(schedule.totalAmount > 0, "No vesting exists");
        require(!schedule.isTerminated, "Already terminated");

        uint256 currentlyVested = availableToClaim(beneficiary) + schedule.releasedAmount;
        uint256 lockedAmount = schedule.totalAmount - currentlyVested;

        schedule.isTerminated = true;
        // Logic to issue Node/NFT would go here or be handled by the backend following this event
        
        emit ConvertedToNode(beneficiary, lockedAmount);
        emit VestingTerminated(beneficiary, lockedAmount);
    }
}
