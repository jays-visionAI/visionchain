// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MessageInbox
 * @dev State machine for cross-chain bridge messages with Optimistic Finality.
 * Messages go through: PENDING → CHALLENGED/FINALIZED → REVERTED/EXECUTED
 */
contract MessageInbox is AccessControl, Pausable, ReentrancyGuard {
    
    bytes32 public constant TSS_ROLE = keccak256("TSS_ROLE");
    bytes32 public constant CHALLENGER_ROLE = keccak256("CHALLENGER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    enum MessageState {
        NONE,
        PENDING,
        CHALLENGED,
        FINALIZED,
        REVERTED
    }

    struct BridgeMessage {
        uint256 srcChainId;
        uint256 dstChainId;
        address token;
        uint256 amount;
        address recipient;
        bytes32 intentHash;
        uint256 submittedAt;
        uint256 challengePeriodEnd;
        MessageState state;
        address challenger;
        bytes32 challengeId;
    }

    // MessageHash => BridgeMessage
    mapping(bytes32 => BridgeMessage) public messages;
    
    // Track all pending messages for monitoring
    bytes32[] public pendingMessages;
    mapping(bytes32 => uint256) public pendingIndex;

    // Challenge period configurations (in seconds)
    uint256 public constant SMALL_AMOUNT_THRESHOLD = 1000 ether;    // < 1000 VCN
    uint256 public constant MEDIUM_AMOUNT_THRESHOLD = 10000 ether;  // < 10000 VCN
    
    uint256 public smallChallengePeriod = 10 minutes;
    uint256 public mediumChallengePeriod = 30 minutes;
    uint256 public largeChallengePeriod = 2 hours;

    // Events
    event MessageSubmitted(
        bytes32 indexed messageHash,
        uint256 srcChainId,
        uint256 dstChainId,
        address token,
        uint256 amount,
        address recipient,
        bytes32 intentHash,
        uint256 challengePeriodEnd
    );
    
    event MessageChallenged(
        bytes32 indexed messageHash,
        address indexed challenger,
        bytes32 challengeId
    );
    
    event MessageFinalized(bytes32 indexed messageHash, address indexed recipient, uint256 amount);
    event MessageReverted(bytes32 indexed messageHash, bytes32 challengeId);
    event ChallengePeriodUpdated(uint256 small, uint256 medium, uint256 large);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // --- Configuration ---

    function setChallengePeriods(
        uint256 _small,
        uint256 _medium,
        uint256 _large
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_small >= 5 minutes, "Small period too short");
        require(_medium >= _small, "Medium must be >= small");
        require(_large >= _medium, "Large must be >= medium");
        
        smallChallengePeriod = _small;
        mediumChallengePeriod = _medium;
        largeChallengePeriod = _large;
        
        emit ChallengePeriodUpdated(_small, _medium, _large);
    }

    // --- Core Functions ---

    /**
     * @dev Submit a pending message (called by TSS after signing)
     */
    function submitPending(
        uint256 srcChainId,
        uint256 dstChainId,
        address token,
        uint256 amount,
        address recipient,
        bytes32 intentHash,
        bytes calldata tssSignature
    ) external onlyRole(TSS_ROLE) whenNotPaused nonReentrant returns (bytes32 messageHash) {
        // Compute message hash
        messageHash = keccak256(abi.encode(
            srcChainId, dstChainId, token, amount, recipient, intentHash
        ));
        
        require(messages[messageHash].state == MessageState.NONE, "Message already exists");
        
        // Determine challenge period based on amount
        uint256 challengePeriod = _getChallengePeriod(amount);
        uint256 challengePeriodEnd = block.timestamp + challengePeriod;
        
        // Store message
        messages[messageHash] = BridgeMessage({
            srcChainId: srcChainId,
            dstChainId: dstChainId,
            token: token,
            amount: amount,
            recipient: recipient,
            intentHash: intentHash,
            submittedAt: block.timestamp,
            challengePeriodEnd: challengePeriodEnd,
            state: MessageState.PENDING,
            challenger: address(0),
            challengeId: bytes32(0)
        });
        
        // Track pending
        pendingMessages.push(messageHash);
        pendingIndex[messageHash] = pendingMessages.length;
        
        emit MessageSubmitted(
            messageHash,
            srcChainId,
            dstChainId,
            token,
            amount,
            recipient,
            intentHash,
            challengePeriodEnd
        );
        
        return messageHash;
    }

    /**
     * @dev Challenge a pending message
     */
    function challenge(
        bytes32 messageHash,
        bytes32 challengeId
    ) external onlyRole(CHALLENGER_ROLE) whenNotPaused nonReentrant {
        BridgeMessage storage msg_ = messages[messageHash];
        
        require(msg_.state == MessageState.PENDING, "Not pending");
        require(block.timestamp < msg_.challengePeriodEnd, "Challenge period ended");
        
        msg_.state = MessageState.CHALLENGED;
        msg_.challenger = msg.sender;
        msg_.challengeId = challengeId;
        
        emit MessageChallenged(messageHash, msg.sender, challengeId);
    }

    /**
     * @dev Finalize a message after challenge period (anyone can call)
     */
    function finalize(bytes32 messageHash) external whenNotPaused nonReentrant {
        BridgeMessage storage msg_ = messages[messageHash];
        
        require(msg_.state == MessageState.PENDING, "Not pending");
        require(block.timestamp >= msg_.challengePeriodEnd, "Challenge period not ended");
        
        msg_.state = MessageState.FINALIZED;
        
        // Remove from pending list
        _removePending(messageHash);
        
        emit MessageFinalized(messageHash, msg_.recipient, msg_.amount);
        
        // The actual mint is triggered by VisionEqualizerV2.executeMint()
    }

    /**
     * @dev Revert a challenged message (called after challenge resolution)
     */
    function revertMessage(bytes32 messageHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        BridgeMessage storage msg_ = messages[messageHash];
        
        require(msg_.state == MessageState.CHALLENGED, "Not challenged");
        
        msg_.state = MessageState.REVERTED;
        
        _removePending(messageHash);
        
        emit MessageReverted(messageHash, msg_.challengeId);
    }

    // --- View Functions ---

    function getMessage(bytes32 messageHash) external view returns (BridgeMessage memory) {
        return messages[messageHash];
    }

    function getMessageState(bytes32 messageHash) external view returns (MessageState) {
        return messages[messageHash].state;
    }

    function isFinalized(bytes32 messageHash) external view returns (bool) {
        return messages[messageHash].state == MessageState.FINALIZED;
    }

    function getPendingCount() external view returns (uint256) {
        return pendingMessages.length;
    }

    function getTimeRemaining(bytes32 messageHash) external view returns (uint256) {
        BridgeMessage memory msg_ = messages[messageHash];
        if (msg_.state != MessageState.PENDING) return 0;
        if (block.timestamp >= msg_.challengePeriodEnd) return 0;
        return msg_.challengePeriodEnd - block.timestamp;
    }

    // --- Internal ---

    function _getChallengePeriod(uint256 amount) internal view returns (uint256) {
        if (amount < SMALL_AMOUNT_THRESHOLD) {
            return smallChallengePeriod;
        } else if (amount < MEDIUM_AMOUNT_THRESHOLD) {
            return mediumChallengePeriod;
        } else {
            return largeChallengePeriod;
        }
    }

    function _removePending(bytes32 messageHash) internal {
        uint256 index = pendingIndex[messageHash];
        if (index > 0) {
            uint256 lastIndex = pendingMessages.length;
            if (index < lastIndex) {
                bytes32 lastHash = pendingMessages[lastIndex - 1];
                pendingMessages[index - 1] = lastHash;
                pendingIndex[lastHash] = index;
            }
            pendingMessages.pop();
            delete pendingIndex[messageHash];
        }
    }

    // --- Emergency ---

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
