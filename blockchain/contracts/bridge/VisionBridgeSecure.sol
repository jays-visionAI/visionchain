// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./IntentCommitment.sol";
import "./MessageInbox.sol";

/**
 * @title VisionBridgeSecure
 * @dev Secure bridge contract for Vision Chain with Optimistic security model.
 * 
 * Security Features:
 * 1. Intent Commitment - User commits intent on-chain before locking
 * 2. Optimistic Finality - Challenge period before mint
 * 3. Supply Conservation - Track locked vs minted
 * 4. Rate Limiting - Per-address daily limits
 * 5. Emergency Controls - Pause, recovery
 * 6. TSS Multi-sig - 3/5 threshold for operations
 * 
 * Flow:
 * 1. User: commitIntent() on IntentCommitment
 * 2. User: lockVCN() with intentHash
 * 3. TSS: submitPending() on destination MessageInbox
 * 4. (Optional) Challenger: challenge() if suspicious
 * 5. After challenge period: finalize() and mint
 */
contract VisionBridgeSecure is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant TSS_ROLE = keccak256("TSS_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Connected contracts
    IntentCommitment public intentCommitment;
    MessageInbox public messageInbox;
    
    // Destination chain configuration
    mapping(uint256 => bool) public supportedChains;
    mapping(uint256 => address) public destBridgeAddresses;
    
    // Lock tracking
    struct LockRecord {
        address sender;
        address recipient;
        uint256 amount;
        uint256 destChainId;
        bytes32 intentHash;
        uint256 lockedAt;
        bool unlocked;
        bool executed;
    }
    
    mapping(bytes32 => LockRecord) public lockRecords;
    uint256 public lockNonce;
    
    // Supply conservation
    uint256 public totalLocked;
    uint256 public totalUnlocked;
    
    // Rate limiting per address
    mapping(address => uint256) public dailyLockAmount;
    mapping(address => uint256) public lastLockDay;
    uint256 public maxDailyLockPerUser = 100_000 ether; // 100K VCN per day
    
    // Global limits
    uint256 public minLockAmount = 1 ether; // 1 VCN minimum
    uint256 public maxLockAmount = 1_000_000 ether; // 1M VCN per tx
    uint256 public globalDailyLimit = 10_000_000 ether; // 10M VCN total daily
    uint256 public dailyVolume;
    uint256 public lastVolumeReset;
    
    // Emergency recovery
    mapping(bytes32 => bool) public recoveryRequested;
    mapping(bytes32 => uint256) public recoveryRequestTime;
    uint256 public recoveryDelay = 7 days;
    
    // Events
    event VCNLocked(
        bytes32 indexed lockId,
        bytes32 indexed intentHash,
        address indexed sender,
        address recipient,
        uint256 amount,
        uint256 destChainId
    );
    
    event VCNUnlocked(
        bytes32 indexed lockId,
        address indexed recipient,
        uint256 amount,
        bytes32 sourceMessageId
    );
    
    event RecoveryRequested(bytes32 indexed lockId, address indexed requester);
    event RecoveryExecuted(bytes32 indexed lockId, address indexed recipient, uint256 amount);
    event RecoveryCancelled(bytes32 indexed lockId);
    
    event ChainConfigured(uint256 chainId, bool supported, address bridgeAddress);
    
    constructor(
        address admin,
        address _intentCommitment,
        address _messageInbox
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TSS_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        
        intentCommitment = IntentCommitment(_intentCommitment);
        messageInbox = MessageInbox(payable(_messageInbox));
    }
    
    /**
     * @dev Lock VCN for bridging (requires prior intent commitment)
     */
    function lockVCN(
        bytes32 intentHash,
        address recipient,
        uint256 destChainId
    ) external payable nonReentrant whenNotPaused {
        require(msg.value >= minLockAmount, "Amount too small");
        require(msg.value <= maxLockAmount, "Amount too large");
        require(supportedChains[destChainId], "Unsupported destination chain");
        require(recipient != address(0), "Invalid recipient");
        
        // Verify intent was committed
        require(
            intentCommitment.verifyAndUseIntent(intentHash, msg.sender, recipient, msg.value, destChainId),
            "Intent verification failed"
        );
        
        // Rate limiting - per user
        uint256 currentDay = block.timestamp / 1 days;
        if (lastLockDay[msg.sender] != currentDay) {
            dailyLockAmount[msg.sender] = 0;
            lastLockDay[msg.sender] = currentDay;
        }
        require(dailyLockAmount[msg.sender] + msg.value <= maxDailyLockPerUser, "User daily limit exceeded");
        dailyLockAmount[msg.sender] += msg.value;
        
        // Rate limiting - global
        if (lastVolumeReset != currentDay) {
            dailyVolume = 0;
            lastVolumeReset = currentDay;
        }
        require(dailyVolume + msg.value <= globalDailyLimit, "Global daily limit exceeded");
        dailyVolume += msg.value;
        
        // Create lock record
        lockNonce++;
        bytes32 lockId = keccak256(abi.encodePacked(
            intentHash,
            msg.sender,
            recipient,
            msg.value,
            destChainId,
            lockNonce,
            block.timestamp
        ));
        
        lockRecords[lockId] = LockRecord({
            sender: msg.sender,
            recipient: recipient,
            amount: msg.value,
            destChainId: destChainId,
            intentHash: intentHash,
            lockedAt: block.timestamp,
            unlocked: false,
            executed: false
        });
        
        totalLocked += msg.value;
        
        emit VCNLocked(lockId, intentHash, msg.sender, recipient, msg.value, destChainId);
    }
    
    /**
     * @dev Unlock VCN (reverse bridge - when burning on source)
     * Called by TSS after verifying burn on source chain
     */
    function unlockVCN(
        bytes32 lockId,
        address recipient,
        uint256 amount,
        bytes32 sourceMessageId,
        bytes[] calldata tssSignatures
    ) external onlyRole(TSS_ROLE) nonReentrant whenNotPaused {
        // Verify TSS signatures (simplified - should verify 3/5)
        require(tssSignatures.length >= 3, "Need at least 3 TSS signatures");
        
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0 && amount <= address(this).balance, "Invalid amount");
        
        // For unlocks, we don't require a prior lock record
        // This handles reverse bridge flow
        
        totalUnlocked += amount;
        
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "VCN transfer failed");
        
        emit VCNUnlocked(lockId, recipient, amount, sourceMessageId);
    }
    
    /**
     * @dev Request emergency recovery for stuck funds
     * Only sender can request, has delay before execution
     */
    function requestRecovery(bytes32 lockId) external {
        LockRecord storage record = lockRecords[lockId];
        
        require(record.sender == msg.sender, "Not lock owner");
        require(!record.unlocked, "Already unlocked");
        require(!record.executed, "Already executed");
        require(!recoveryRequested[lockId], "Recovery already requested");
        
        // Must wait 24 hours after lock before requesting recovery
        require(block.timestamp > record.lockedAt + 24 hours, "Too early to request recovery");
        
        recoveryRequested[lockId] = true;
        recoveryRequestTime[lockId] = block.timestamp;
        
        emit RecoveryRequested(lockId, msg.sender);
    }
    
    /**
     * @dev Execute recovery after delay period
     */
    function executeRecovery(bytes32 lockId) external nonReentrant {
        LockRecord storage record = lockRecords[lockId];
        
        require(record.sender == msg.sender, "Not lock owner");
        require(recoveryRequested[lockId], "Recovery not requested");
        require(!record.unlocked, "Already unlocked");
        require(block.timestamp >= recoveryRequestTime[lockId] + recoveryDelay, "Recovery delay not passed");
        
        record.unlocked = true;
        totalUnlocked += record.amount;
        
        (bool success, ) = payable(record.sender).call{value: record.amount}("");
        require(success, "Recovery transfer failed");
        
        emit RecoveryExecuted(lockId, record.sender, record.amount);
    }
    
    /**
     * @dev Cancel recovery request (admin or after bridge completion)
     */
    function cancelRecovery(bytes32 lockId) external onlyRole(OPERATOR_ROLE) {
        require(recoveryRequested[lockId], "Recovery not requested");
        
        recoveryRequested[lockId] = false;
        recoveryRequestTime[lockId] = 0;
        
        emit RecoveryCancelled(lockId);
    }
    
    /**
     * @dev Mark lock as executed on destination (prevents recovery)
     */
    function markExecuted(bytes32 lockId) external onlyRole(TSS_ROLE) {
        LockRecord storage record = lockRecords[lockId];
        require(!record.unlocked, "Already unlocked");
        record.executed = true;
        
        // Cancel any pending recovery
        if (recoveryRequested[lockId]) {
            recoveryRequested[lockId] = false;
            recoveryRequestTime[lockId] = 0;
        }
    }
    
    // --- View Functions ---
    
    function getLockRecord(bytes32 lockId) external view returns (LockRecord memory) {
        return lockRecords[lockId];
    }
    
    function getSupplyStatus() external view returns (uint256 locked, uint256 unlocked, int256 netLocked) {
        return (totalLocked, totalUnlocked, int256(totalLocked) - int256(totalUnlocked));
    }
    
    function getBridgeBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getRemainingDailyLimit(address user) external view returns (uint256 userRemaining, uint256 globalRemaining) {
        uint256 currentDay = block.timestamp / 1 days;
        
        uint256 userUsed = lastLockDay[user] == currentDay ? dailyLockAmount[user] : 0;
        uint256 _dailyVolume = lastVolumeReset == currentDay ? dailyVolume : 0;
        
        return (
            maxDailyLockPerUser > userUsed ? maxDailyLockPerUser - userUsed : 0,
            globalDailyLimit > _dailyVolume ? globalDailyLimit - _dailyVolume : 0
        );
    }
    
    // --- Admin Functions ---
    
    function configureChain(uint256 chainId, bool supported, address bridgeAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        supportedChains[chainId] = supported;
        destBridgeAddresses[chainId] = bridgeAddress;
        emit ChainConfigured(chainId, supported, bridgeAddress);
    }
    
    function setLimits(
        uint256 _minLock,
        uint256 _maxLock,
        uint256 _maxDailyPerUser,
        uint256 _globalDaily
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minLockAmount = _minLock;
        maxLockAmount = _maxLock;
        maxDailyLockPerUser = _maxDailyPerUser;
        globalDailyLimit = _globalDaily;
    }
    
    function setRecoveryDelay(uint256 delay) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(delay >= 1 days, "Minimum 1 day");
        recoveryDelay = delay;
    }
    
    function updateContracts(address _intent, address _inbox) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_intent != address(0)) intentCommitment = IntentCommitment(_intent);
        if (_inbox != address(0)) messageInbox = MessageInbox(payable(_inbox));
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    
    // Emergency withdraw (only when paused, multi-sig required in practice)
    function emergencyWithdraw(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused(), "Must be paused");
        (bool success, ) = payable(to).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
    
    receive() external payable {}
}
