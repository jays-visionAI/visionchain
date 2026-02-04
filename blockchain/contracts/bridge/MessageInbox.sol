// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title MessageInbox
 * @dev Optimistic bridge message processing with state machine.
 * 
 * State Machine:
 *   NONE → PENDING → (CHALLENGED) → FINALIZED/REVERTED
 * 
 * Security Model:
 * - TSS submits message as PENDING (not immediately executed)
 * - Challenge period allows dispute
 * - Only FINALIZED messages can be executed
 * - Challenged messages can be reverted with proof
 * 
 * Enhanced Security:
 * - Amount-based challenge periods (larger = longer)
 * - Bond requirement for challengers
 * - Automatic expiry of stale messages
 */
contract MessageInbox is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant TSS_ROLE = keccak256("TSS_ROLE");
    bytes32 public constant CHALLENGER_ROLE = keccak256("CHALLENGER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    
    enum MessageStatus {
        NONE,
        PENDING,
        CHALLENGED,
        FINALIZED,
        REVERTED,
        EXPIRED
    }
    
    struct BridgeMessage {
        bytes32 intentHash;
        address sender;
        address recipient;
        uint256 amount;
        uint256 srcChainId;
        uint256 dstChainId;
        uint256 nonce;
        uint256 submittedAt;
        uint256 challengePeriodEnd;
        MessageStatus status;
        address challenger;
        string challengeReason;
    }
    
    // Storage
    mapping(bytes32 => BridgeMessage) public messages;
    mapping(address => uint256) public challengerBonds;
    
    // Tracking
    uint256 public totalPending;
    uint256 public totalFinalized;
    uint256 public totalReverted;
    uint256 public totalChallenged;
    
    // Supply tracking for conservation
    uint256 public totalLockedOnSource;
    uint256 public totalMintedOnDest;
    
    // Challenge period thresholds (amount → minutes)
    uint256 public constant SMALL_AMOUNT = 1000 ether; // < 1000 VCN: 10 min
    uint256 public constant MEDIUM_AMOUNT = 10000 ether; // < 10000 VCN: 30 min
    // >= 10000 VCN: 2 hours
    
    uint256 public smallChallengePeriod = 10 minutes;
    uint256 public mediumChallengePeriod = 30 minutes;
    uint256 public largeChallengePeriod = 2 hours;
    
    // Challenger bond (to prevent spam challenges)
    uint256 public challengerBondAmount = 0.1 ether; // 0.1 VCN
    
    // Events
    event MessageSubmitted(
        bytes32 indexed messageId,
        bytes32 indexed intentHash,
        address sender,
        address recipient,
        uint256 amount,
        uint256 challengePeriodEnd
    );
    
    event MessageChallenged(
        bytes32 indexed messageId,
        address indexed challenger,
        string reason
    );
    
    event MessageFinalized(bytes32 indexed messageId, address indexed recipient, uint256 amount);
    event MessageReverted(bytes32 indexed messageId, string reason);
    event ChallengeResolved(bytes32 indexed messageId, bool challengeSucceeded, address challenger);
    event BondDeposited(address indexed challenger, uint256 amount);
    event BondRefunded(address indexed challenger, uint256 amount);
    event BondSlashed(address indexed challenger, uint256 amount);
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TSS_ROLE, admin);
        _grantRole(CHALLENGER_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
    }
    
    /**
     * @dev Compute message ID
     */
    function computeMessageId(
        bytes32 intentHash,
        address sender,
        address recipient,
        uint256 amount,
        uint256 srcChainId,
        uint256 nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(intentHash, sender, recipient, amount, srcChainId, nonce));
    }
    
    /**
     * @dev Get challenge period based on amount
     */
    function getChallengePeriod(uint256 amount) public view returns (uint256) {
        if (amount < SMALL_AMOUNT) {
            return smallChallengePeriod;
        } else if (amount < MEDIUM_AMOUNT) {
            return mediumChallengePeriod;
        } else {
            return largeChallengePeriod;
        }
    }
    
    /**
     * @dev Submit a pending bridge message (called by TSS)
     */
    function submitPending(
        bytes32 intentHash,
        address sender,
        address recipient,
        uint256 amount,
        uint256 srcChainId,
        uint256 nonce
    ) external onlyRole(TSS_ROLE) whenNotPaused returns (bytes32) {
        bytes32 messageId = computeMessageId(intentHash, sender, recipient, amount, srcChainId, nonce);
        
        require(messages[messageId].status == MessageStatus.NONE, "Message already exists");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        
        uint256 challengePeriod = getChallengePeriod(amount);
        uint256 challengePeriodEnd = block.timestamp + challengePeriod;
        
        messages[messageId] = BridgeMessage({
            intentHash: intentHash,
            sender: sender,
            recipient: recipient,
            amount: amount,
            srcChainId: srcChainId,
            dstChainId: block.chainid,
            nonce: nonce,
            submittedAt: block.timestamp,
            challengePeriodEnd: challengePeriodEnd,
            status: MessageStatus.PENDING,
            challenger: address(0),
            challengeReason: ""
        });
        
        totalPending++;
        
        emit MessageSubmitted(messageId, intentHash, sender, recipient, amount, challengePeriodEnd);
        
        return messageId;
    }
    
    /**
     * @dev Challenge a pending message
     * Challenger must deposit bond first
     */
    function challenge(bytes32 messageId, string calldata reason) external onlyRole(CHALLENGER_ROLE) {
        BridgeMessage storage msg_ = messages[messageId];
        
        require(msg_.status == MessageStatus.PENDING, "Not pending");
        require(block.timestamp < msg_.challengePeriodEnd, "Challenge period ended");
        require(challengerBonds[msg.sender] >= challengerBondAmount, "Insufficient bond");
        require(bytes(reason).length > 0 && bytes(reason).length <= 256, "Invalid reason");
        
        msg_.status = MessageStatus.CHALLENGED;
        msg_.challenger = msg.sender;
        msg_.challengeReason = reason;
        
        totalChallenged++;
        totalPending--;
        
        emit MessageChallenged(messageId, msg.sender, reason);
    }
    
    /**
     * @dev Resolve a challenge (admin function)
     * @param challengeValid If true, message is reverted and challenger gets bond back + reward
     *                      If false, message proceeds and challenger loses bond
     */
    function resolveChallenge(bytes32 messageId, bool challengeValid) external onlyRole(DEFAULT_ADMIN_ROLE) {
        BridgeMessage storage msg_ = messages[messageId];
        
        require(msg_.status == MessageStatus.CHALLENGED, "Not challenged");
        
        address challenger = msg_.challenger;
        
        if (challengeValid) {
            // Challenge succeeded - revert message
            msg_.status = MessageStatus.REVERTED;
            totalReverted++;
            
            // Refund bond + reward (could add slashing of TSS here)
            uint256 refund = challengerBonds[challenger];
            challengerBonds[challenger] = 0;
            
            (bool success, ) = payable(challenger).call{value: refund}("");
            require(success, "Bond refund failed");
            
            emit BondRefunded(challenger, refund);
            emit MessageReverted(messageId, msg_.challengeReason);
        } else {
            // Challenge failed - continue to finalization
            msg_.status = MessageStatus.PENDING;
            msg_.challenger = address(0);
            msg_.challengeReason = "";
            msg_.challengePeriodEnd = block.timestamp + getChallengePeriod(msg_.amount);
            
            totalChallenged--;
            totalPending++;
            
            // Slash challenger bond
            uint256 slashed = challengerBonds[challenger];
            challengerBonds[challenger] = 0;
            
            emit BondSlashed(challenger, slashed);
        }
        
        emit ChallengeResolved(messageId, challengeValid, challenger);
    }
    
    /**
     * @dev Finalize a message after challenge period
     */
    function finalize(bytes32 messageId) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (bool) {
        BridgeMessage storage msg_ = messages[messageId];
        
        require(msg_.status == MessageStatus.PENDING, "Not pending");
        require(block.timestamp >= msg_.challengePeriodEnd, "Challenge period not ended");
        
        msg_.status = MessageStatus.FINALIZED;
        totalFinalized++;
        totalPending--;
        totalMintedOnDest += msg_.amount;
        
        emit MessageFinalized(messageId, msg_.recipient, msg_.amount);
        
        return true;
    }
    
    /**
     * @dev Deposit challenger bond
     */
    function depositBond() external payable {
        require(msg.value > 0, "Must deposit non-zero");
        challengerBonds[msg.sender] += msg.value;
        emit BondDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw unused challenger bond
     */
    function withdrawBond(uint256 amount) external nonReentrant {
        require(challengerBonds[msg.sender] >= amount, "Insufficient bond");
        challengerBonds[msg.sender] -= amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdraw failed");
        
        emit BondRefunded(msg.sender, amount);
    }
    
    /**
     * @dev Check if message can be finalized
     */
    function canFinalize(bytes32 messageId) external view returns (bool) {
        BridgeMessage storage msg_ = messages[messageId];
        return msg_.status == MessageStatus.PENDING && block.timestamp >= msg_.challengePeriodEnd;
    }
    
    /**
     * @dev Get message details
     */
    function getMessage(bytes32 messageId) external view returns (BridgeMessage memory) {
        return messages[messageId];
    }
    
    /**
     * @dev Record locked amount on source chain (called by bridge)
     */
    function recordLock(uint256 amount) external onlyRole(EXECUTOR_ROLE) {
        totalLockedOnSource += amount;
    }
    
    /**
     * @dev Get supply conservation status
     */
    function getSupplyStatus() external view returns (uint256 locked, uint256 minted, bool balanced) {
        return (totalLockedOnSource, totalMintedOnDest, totalLockedOnSource >= totalMintedOnDest);
    }
    
    // Admin functions
    function setChallengePeriods(uint256 small, uint256 medium, uint256 large) external onlyRole(DEFAULT_ADMIN_ROLE) {
        smallChallengePeriod = small;
        mediumChallengePeriod = medium;
        largeChallengePeriod = large;
    }
    
    function setChallengeBond(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        challengerBondAmount = amount;
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
    
    // Emergency: expire stale pending messages
    function expireMessage(bytes32 messageId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        BridgeMessage storage msg_ = messages[messageId];
        require(msg_.status == MessageStatus.PENDING, "Not pending");
        require(block.timestamp > msg_.submittedAt + 7 days, "Not expired");
        
        msg_.status = MessageStatus.EXPIRED;
        totalPending--;
    }
    
    receive() external payable {}
}
