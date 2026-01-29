// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title IntentCommitment
 * @dev On-chain commitment of user intents for cross-chain bridge transfers.
 * Uses EIP-712 for structured, typed data signing.
 */
contract IntentCommitment is EIP712, AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    // EIP-712 TypeHash for BridgeIntent
    bytes32 public constant BRIDGE_INTENT_TYPEHASH = keccak256(
        "BridgeIntent(address user,uint256 srcChainId,uint256 dstChainId,address token,uint256 amount,address recipient,uint256 nonce,uint256 expiry)"
    );

    struct BridgeIntent {
        address user;
        uint256 srcChainId;
        uint256 dstChainId;
        address token;
        uint256 amount;
        address recipient;
        uint256 nonce;
        uint256 expiry;
    }

    // User => Nonce => Committed
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    // IntentHash => Commitment timestamp
    mapping(bytes32 => uint256) public commitments;
    
    // IntentHash => Intent data
    mapping(bytes32 => BridgeIntent) public intents;

    event IntentCommitted(
        bytes32 indexed intentHash,
        address indexed user,
        uint256 srcChainId,
        uint256 dstChainId,
        address token,
        uint256 amount,
        address recipient,
        uint256 nonce,
        uint256 expiry
    );

    event IntentConsumed(bytes32 indexed intentHash, address indexed consumer);

    constructor() EIP712("VisionBridge", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Commit an intent with user's EIP-712 signature
     */
    function commitIntent(
        BridgeIntent calldata intent,
        bytes calldata signature
    ) external nonReentrant returns (bytes32 intentHash) {
        // Verify expiry
        require(block.timestamp < intent.expiry, "Intent expired");
        
        // Verify nonce not used
        require(!usedNonces[intent.user][intent.nonce], "Nonce already used");
        
        // Compute intent hash
        intentHash = _hashTypedDataV4(
            keccak256(abi.encode(
                BRIDGE_INTENT_TYPEHASH,
                intent.user,
                intent.srcChainId,
                intent.dstChainId,
                intent.token,
                intent.amount,
                intent.recipient,
                intent.nonce,
                intent.expiry
            ))
        );
        
        // Verify signature
        address signer = ECDSA.recover(intentHash, signature);
        require(signer == intent.user, "Invalid signature");
        
        // Mark nonce as used
        usedNonces[intent.user][intent.nonce] = true;
        
        // Store commitment
        commitments[intentHash] = block.timestamp;
        intents[intentHash] = intent;
        
        emit IntentCommitted(
            intentHash,
            intent.user,
            intent.srcChainId,
            intent.dstChainId,
            intent.token,
            intent.amount,
            intent.recipient,
            intent.nonce,
            intent.expiry
        );
        
        return intentHash;
    }

    /**
     * @dev Verify an intent exists and is valid
     */
    function verifyIntent(bytes32 intentHash) external view returns (bool valid, BridgeIntent memory intent) {
        uint256 commitTime = commitments[intentHash];
        if (commitTime == 0) {
            return (false, intent);
        }
        
        intent = intents[intentHash];
        
        // Check not expired
        if (block.timestamp >= intent.expiry) {
            return (false, intent);
        }
        
        return (true, intent);
    }

    /**
     * @dev Mark intent as consumed (called by MessageInbox after finalization)
     */
    function consumeIntent(bytes32 intentHash) external onlyRole(BRIDGE_ROLE) {
        require(commitments[intentHash] != 0, "Intent not found");
        delete commitments[intentHash];
        emit IntentConsumed(intentHash, msg.sender);
    }

    /**
     * @dev Check if a nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }

    /**
     * @dev Get the next available nonce for a user
     */
    function getNextNonce(address user) external view returns (uint256) {
        uint256 nonce = 0;
        while (usedNonces[user][nonce]) {
            nonce++;
        }
        return nonce;
    }

    /**
     * @dev Returns the domain separator used in the encoding of the signature for EIP-712
     */
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
