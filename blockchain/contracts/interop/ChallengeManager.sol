// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MessageInbox.sol";

/**
 * @title ChallengeManager
 * @dev Manages challenges against bridge messages.
 * Enables whitelisted challengers to dispute invalid messages.
 */
contract ChallengeManager is AccessControl, ReentrancyGuard {
    
    bytes32 public constant CHALLENGER_ROLE = keccak256("CHALLENGER_ROLE");
    bytes32 public constant RESOLVER_ROLE = keccak256("RESOLVER_ROLE");

    enum ChallengeType {
        LOCK_NOT_EXISTS,      // No Lock event on source chain
        INTENT_MISMATCH,      // Intent hash doesn't match commitment
        NONCE_REUSE,          // Nonce already used
        EXPIRY_EXCEEDED,      // Message expired
        AMOUNT_MISMATCH,      // Amount differs from intent
        RECIPIENT_MISMATCH    // Recipient differs from intent
    }

    enum ChallengeStatus {
        PENDING,
        RESOLVED_VALID,      // Challenge was valid, message reverted
        RESOLVED_INVALID     // Challenge was invalid, message continues
    }

    struct Challenge {
        bytes32 messageHash;
        ChallengeType challengeType;
        address challenger;
        bytes evidence;
        uint256 submittedAt;
        ChallengeStatus status;
        string resolution;
    }

    // Reference to MessageInbox
    MessageInbox public messageInbox;
    
    // ChallengeId => Challenge
    mapping(bytes32 => Challenge) public challenges;
    
    // MessageHash => ChallengeIds
    mapping(bytes32 => bytes32[]) public messageChallenges;
    
    // Challenger deposit requirement (anti-spam)
    uint256 public challengeDeposit = 0.01 ether;
    
    // Challenger => Deposited amount
    mapping(address => uint256) public deposits;
    
    // Reward percentage for valid challenges (30%)
    uint256 public challengeRewardBps = 3000;

    // Events
    event ChallengeSubmitted(
        bytes32 indexed challengeId,
        bytes32 indexed messageHash,
        ChallengeType challengeType,
        address indexed challenger
    );
    
    event ChallengeResolved(
        bytes32 indexed challengeId,
        ChallengeStatus status,
        string resolution
    );
    
    event DepositReceived(address indexed challenger, uint256 amount);
    event DepositWithdrawn(address indexed challenger, uint256 amount);
    event RewardPaid(address indexed challenger, uint256 amount);

    constructor(address _messageInbox) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RESOLVER_ROLE, msg.sender);
        messageInbox = MessageInbox(_messageInbox);
    }

    // --- Deposit Management ---

    function deposit() external payable {
        deposits[msg.sender] += msg.value;
        emit DepositReceived(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(deposits[msg.sender] >= amount, "Insufficient deposit");
        deposits[msg.sender] -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit DepositWithdrawn(msg.sender, amount);
    }

    // --- Challenge Submission ---

    /**
     * @dev Submit a challenge against a pending message
     */
    function submitChallenge(
        bytes32 messageHash,
        ChallengeType challengeType,
        bytes calldata evidence
    ) external onlyRole(CHALLENGER_ROLE) nonReentrant returns (bytes32 challengeId) {
        // Verify deposit
        require(deposits[msg.sender] >= challengeDeposit, "Insufficient deposit");
        
        // Generate challenge ID
        challengeId = keccak256(abi.encode(
            messageHash,
            challengeType,
            msg.sender,
            block.timestamp
        ));
        
        require(challenges[challengeId].submittedAt == 0, "Challenge exists");
        
        // Store challenge
        challenges[challengeId] = Challenge({
            messageHash: messageHash,
            challengeType: challengeType,
            challenger: msg.sender,
            evidence: evidence,
            submittedAt: block.timestamp,
            status: ChallengeStatus.PENDING,
            resolution: ""
        });
        
        messageChallenges[messageHash].push(challengeId);
        
        // Lock deposit
        deposits[msg.sender] -= challengeDeposit;
        
        // Trigger challenge in MessageInbox
        messageInbox.challenge(messageHash, challengeId);
        
        emit ChallengeSubmitted(challengeId, messageHash, challengeType, msg.sender);
        
        return challengeId;
    }

    // --- Challenge Resolution ---

    /**
     * @dev Resolve a challenge (only by resolver/admin)
     */
    function resolveChallenge(
        bytes32 challengeId,
        bool isValid,
        string calldata resolution
    ) external onlyRole(RESOLVER_ROLE) nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.status == ChallengeStatus.PENDING, "Already resolved");
        
        if (isValid) {
            c.status = ChallengeStatus.RESOLVED_VALID;
            
            // Revert the message
            messageInbox.revertMessage(c.messageHash);
            
            // Return deposit + reward
            uint256 reward = (challengeDeposit * challengeRewardBps) / 10000;
            uint256 totalPayout = challengeDeposit + reward;
            
            (bool success, ) = c.challenger.call{value: totalPayout}("");
            require(success, "Reward transfer failed");
            
            emit RewardPaid(c.challenger, totalPayout);
        } else {
            c.status = ChallengeStatus.RESOLVED_INVALID;
            
            // Deposit is forfeited (kept in contract as treasury)
        }
        
        c.resolution = resolution;
        
        emit ChallengeResolved(challengeId, c.status, resolution);
    }

    // --- View Functions ---

    function getChallenge(bytes32 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    function getMessageChallenges(bytes32 messageHash) external view returns (bytes32[] memory) {
        return messageChallenges[messageHash];
    }

    function getChallengeCount(bytes32 messageHash) external view returns (uint256) {
        return messageChallenges[messageHash].length;
    }

    // --- Configuration ---

    function setChallengeDeposit(uint256 _deposit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        challengeDeposit = _deposit;
    }

    function setChallengeRewardBps(uint256 _bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_bps <= 10000, "Invalid bps");
        challengeRewardBps = _bps;
    }

    function setMessageInbox(address _inbox) external onlyRole(DEFAULT_ADMIN_ROLE) {
        messageInbox = MessageInbox(_inbox);
    }

    // --- Treasury ---

    function withdrawTreasury(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "Invalid address");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    receive() external payable {}
}
