// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title IntentCommitment
 * @dev On-chain commitment of bridge intents before execution.
 * 
 * Security Model:
 * - User commits intent hash on source chain BEFORE locking funds
 * - Intent hash = keccak256(sender, recipient, amount, nonce, expiry, destChainId)
 * - Prevents front-running and ensures user consent
 * 
 * Enhanced Security:
 * - Nonce tracking prevents replay attacks
 * - Expiry prevents stale intents
 * - Rate limiting prevents spam
 */
contract IntentCommitment is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    // Intent struct
    struct Intent {
        address sender;
        address recipient;
        uint256 amount;
        uint256 nonce;
        uint256 expiry;
        uint256 destChainId;
        uint256 committedAt;
        bool used;
        bool cancelled;
    }
    
    // Storage
    mapping(bytes32 => Intent) public intents;
    mapping(address => uint256) public userNonces;
    mapping(address => uint256) public dailyCommitCount;
    mapping(address => uint256) public lastCommitDay;
    
    // Limits
    uint256 public maxDailyCommits = 10;
    uint256 public minAmount = 0.1 ether; // 0.1 VCN minimum
    uint256 public maxAmount = 1_000_000 ether; // 1M VCN maximum
    uint256 public intentValidityPeriod = 24 hours;
    
    // Events
    event IntentCommitted(
        bytes32 indexed intentHash,
        address indexed sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        uint256 destChainId
    );
    
    event IntentUsed(bytes32 indexed intentHash, address indexed user);
    event IntentCancelled(bytes32 indexed intentHash, address indexed user);
    event IntentExpired(bytes32 indexed intentHash);
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }
    
    /**
     * @dev Compute intent hash
     */
    function computeIntentHash(
        address sender,
        address recipient,
        uint256 amount,
        uint256 nonce,
        uint256 expiry,
        uint256 destChainId
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            sender,
            recipient,
            amount,
            nonce,
            expiry,
            destChainId
        ));
    }
    
    /**
     * @dev Commit a bridge intent on-chain
     * User must call this BEFORE locking funds
     */
    function commitIntent(
        address recipient,
        uint256 amount,
        uint256 destChainId
    ) external nonReentrant whenNotPaused returns (bytes32) {
        require(recipient != address(0), "Invalid recipient");
        require(amount >= minAmount, "Amount too small");
        require(amount <= maxAmount, "Amount too large");
        require(destChainId != block.chainid, "Cannot bridge to same chain");
        
        // Rate limiting
        uint256 currentDay = block.timestamp / 1 days;
        if (lastCommitDay[msg.sender] != currentDay) {
            dailyCommitCount[msg.sender] = 0;
            lastCommitDay[msg.sender] = currentDay;
        }
        require(dailyCommitCount[msg.sender] < maxDailyCommits, "Daily limit exceeded");
        dailyCommitCount[msg.sender]++;
        
        // Generate nonce and expiry
        uint256 nonce = userNonces[msg.sender]++;
        uint256 expiry = block.timestamp + intentValidityPeriod;
        
        bytes32 intentHash = computeIntentHash(
            msg.sender,
            recipient,
            amount,
            nonce,
            expiry,
            destChainId
        );
        
        require(intents[intentHash].sender == address(0), "Intent already exists");
        
        intents[intentHash] = Intent({
            sender: msg.sender,
            recipient: recipient,
            amount: amount,
            nonce: nonce,
            expiry: expiry,
            destChainId: destChainId,
            committedAt: block.timestamp,
            used: false,
            cancelled: false
        });
        
        emit IntentCommitted(intentHash, msg.sender, recipient, amount, nonce, expiry, destChainId);
        
        return intentHash;
    }
    
    /**
     * @dev Verify and mark intent as used (called by bridge contract)
     */
    function verifyAndUseIntent(
        bytes32 intentHash,
        address sender,
        address recipient,
        uint256 amount,
        uint256 destChainId
    ) external onlyRole(OPERATOR_ROLE) returns (bool) {
        Intent storage intent = intents[intentHash];
        
        // Verify intent exists and matches
        require(intent.sender == sender, "Sender mismatch");
        require(intent.recipient == recipient, "Recipient mismatch");
        require(intent.amount == amount, "Amount mismatch");
        require(intent.destChainId == destChainId, "Chain mismatch");
        require(!intent.used, "Intent already used");
        require(!intent.cancelled, "Intent cancelled");
        require(block.timestamp <= intent.expiry, "Intent expired");
        
        intent.used = true;
        emit IntentUsed(intentHash, sender);
        
        return true;
    }
    
    /**
     * @dev Cancel an unused intent (only by sender)
     */
    function cancelIntent(bytes32 intentHash) external {
        Intent storage intent = intents[intentHash];
        require(intent.sender == msg.sender, "Not intent owner");
        require(!intent.used, "Intent already used");
        require(!intent.cancelled, "Already cancelled");
        
        intent.cancelled = true;
        emit IntentCancelled(intentHash, msg.sender);
    }
    
    /**
     * @dev Check if intent is valid
     */
    function isIntentValid(bytes32 intentHash) external view returns (bool) {
        Intent storage intent = intents[intentHash];
        return intent.sender != address(0) 
            && !intent.used 
            && !intent.cancelled 
            && block.timestamp <= intent.expiry;
    }
    
    /**
     * @dev Get intent details
     */
    function getIntent(bytes32 intentHash) external view returns (Intent memory) {
        return intents[intentHash];
    }
    
    // Admin functions
    function setLimits(uint256 _maxDaily, uint256 _minAmount, uint256 _maxAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxDailyCommits = _maxDaily;
        minAmount = _minAmount;
        maxAmount = _maxAmount;
    }
    
    function setValidityPeriod(uint256 _period) external onlyRole(DEFAULT_ADMIN_ROLE) {
        intentValidityPeriod = _period;
    }
    
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
