// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TimeLockAgent
 * @dev A contract to schedule VCN native token transfers securely.
 * The user deposits funds which are released by an authorized executor after a specific unlock time.
 */
contract TimeLockAgent is ReentrancyGuard, Pausable, Ownable {
    // Defines the possible states of a scheduled transfer
    enum Status { Waiting, Executed, Cancelled, Expired }

    struct ScheduledTransfer {
        uint256 id;
        address creator;
        address to;
        uint256 amount;
        uint256 unlockTime;
        Status status;
        uint256 createdAt;
    }

    // State Variables
    uint256 public nextScheduleId;
    uint256 public gracePeriod = 7 days; // Time after unlockTime when it can be expired
    mapping(uint256 => ScheduledTransfer) public transfers;
    
    // Whitelisted addresses that can trigger execution
    mapping(address => bool) public isExecutor;

    // Events
    event TransferScheduled(uint256 indexed scheduleId, address indexed creator, address indexed to, uint256 amount, uint256 unlockTime);
    event TransferExecuted(uint256 indexed scheduleId, address indexed executor, uint256 executedAt);
    event TransferCancelled(uint256 indexed scheduleId, uint256 cancelledAt);
    event TransferExpired(uint256 indexed scheduleId, uint256 expiredAt);
    event ExecutorUpdated(address indexed executor, bool allowed);
    event GracePeriodUpdated(uint256 newGracePeriod);

    // Modifiers
    modifier onlyExecutor() {
        require(isExecutor[msg.sender] || msg.sender == owner(), "TimeLockAgent: Caller is not an executor");
        _;
    }

    modifier onlyCreator(uint256 scheduleId) {
        require(transfers[scheduleId].creator == msg.sender, "TimeLockAgent: Caller is not the creator");
        _;
    }

    modifier exists(uint256 scheduleId) {
        require(transfers[scheduleId].createdAt != 0, "TimeLockAgent: Transfer does not exist");
        _;
    }

    modifier inStatus(uint256 scheduleId, Status status) {
        require(transfers[scheduleId].status == status, "TimeLockAgent: Invalid status");
        _;
    }

    constructor() Ownable(msg.sender) {
        // Deployer is automatically an executor
        isExecutor[msg.sender] = true;
        emit ExecutorUpdated(msg.sender, true);
    }

    /**
     * @dev Schedules a native token transfer.
     * @param to The recipient address.
     * @param unlockTime The unix timestamp when funds can be released.
     */
    function scheduleTransferNative(address to, uint256 unlockTime) external payable whenNotPaused returns (uint256) {
        require(msg.value > 0, "TimeLockAgent: Amount must be greater than 0");
        require(to != address(0), "TimeLockAgent: Invalid recipient");
        require(unlockTime > block.timestamp, "TimeLockAgent: Unlock time must be in future");

        uint256 scheduleId = nextScheduleId++;

        transfers[scheduleId] = ScheduledTransfer({
            id: scheduleId,
            creator: msg.sender,
            to: to,
            amount: msg.value,
            unlockTime: unlockTime,
            status: Status.Waiting,
            createdAt: block.timestamp
        });

        emit TransferScheduled(scheduleId, msg.sender, to, msg.value, unlockTime);
        return scheduleId;
    }

    /**
     * @dev Executes a scheduled transfer if the unlock time has passed.
     * Only authorized executors can call this to prevent griefing or redundant calls.
     * @param scheduleId The ID of the transfer to execute.
     */
    function executeTransfer(uint256 scheduleId) 
        external 
        nonReentrant 
        whenNotPaused
        onlyExecutor 
        exists(scheduleId) 
        inStatus(scheduleId, Status.Waiting) 
    {
        ScheduledTransfer storage transfer = transfers[scheduleId];
        
        require(block.timestamp >= transfer.unlockTime, "TimeLockAgent: Time locked");
        
        // Update status first to prevent reentrancy (CEI pattern)
        transfer.status = Status.Executed;

        (bool success, ) = transfer.to.call{value: transfer.amount}("");
        require(success, "TimeLockAgent: Transfer failed");

        emit TransferExecuted(scheduleId, msg.sender, block.timestamp);
    }

    /**
     * @dev Executes multiple scheduled transfers in a single transaction.
     * @param scheduleIds An array of schedule IDs to execute.
     */
    function executeBatch(uint256[] calldata scheduleIds) 
        external 
        nonReentrant 
        whenNotPaused
        onlyExecutor
    {
        for (uint256 i = 0; i < scheduleIds.length; i++) {
            uint256 scheduleId = scheduleIds[i];
            ScheduledTransfer storage transfer = transfers[scheduleId];

            // Skip if doesn't exist, not waiting, or not yet unlockable
            if (transfer.createdAt == 0 || transfer.status != Status.Waiting || block.timestamp < transfer.unlockTime) {
                continue;
            }

            transfer.status = Status.Executed;
            (bool success, ) = transfer.to.call{value: transfer.amount}("");
            
            if (success) {
                emit TransferExecuted(scheduleId, msg.sender, block.timestamp);
            } else {
                // If one fails, we revert it back to Waiting so it can be retried individually
                transfer.status = Status.Waiting;
            }
        }
    }

    /**
     * @dev Cancels a scheduled transfer and refunds the creator.
     * Can only be called before execution and before expiration logic takes over (though expiration also refunds).
     * @param scheduleId The ID of the transfer to cancel.
     */
    function cancelTransfer(uint256 scheduleId) 
        external 
        nonReentrant
        exists(scheduleId)
        onlyCreator(scheduleId)
        inStatus(scheduleId, Status.Waiting)
    {
        require(block.timestamp < transfers[scheduleId].unlockTime, "TimeLockAgent: Too late to cancel, use expire if stale");

        ScheduledTransfer storage transfer = transfers[scheduleId];
        transfer.status = Status.Cancelled;

        (bool success, ) = transfer.creator.call{value: transfer.amount}("");
        require(success, "TimeLockAgent: Refund failed");

        emit TransferCancelled(scheduleId, block.timestamp);
    }

    /**
     * @dev Expires a stale transfer and refunds the creator.
     * Can be called by anyone (or restricted to creator/executor) if the grace period has passed.
     * This prevents funds from being stuck forever if the executor fails.
     * @param scheduleId The ID of the transfer to expire.
     */
    function expireTransfer(uint256 scheduleId) 
        external 
        nonReentrant
        exists(scheduleId)
        inStatus(scheduleId, Status.Waiting)
    {
        ScheduledTransfer storage transfer = transfers[scheduleId];
        require(block.timestamp > transfer.unlockTime + gracePeriod, "TimeLockAgent: Grace period not passed");

        transfer.status = Status.Expired;

        (bool success, ) = transfer.creator.call{value: transfer.amount}("");
        require(success, "TimeLockAgent: Refund failed");

        emit TransferExpired(scheduleId, block.timestamp);
    }

    // --- Admin Functions ---

    function setExecutor(address executor, bool allowed) external onlyOwner {
        isExecutor[executor] = allowed;
        emit ExecutorUpdated(executor, allowed);
    }

    function setGracePeriod(uint256 newGracePeriod) external onlyOwner {
        gracePeriod = newGracePeriod;
        emit GracePeriodUpdated(newGracePeriod);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Fallback to receive native tokens (should usually be via schedule functions)
    receive() external payable {}
}
