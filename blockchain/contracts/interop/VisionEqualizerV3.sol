// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./MessageInbox.sol";
import "./IntentCommitment.sol";

/**
 * @title VisionEqualizerV3 (Optimistic Finality Edition)
 * @dev Integrates LayerZero messaging with Optimistic Finality model.
 * Instead of instant minting, messages go through MessageInbox for challenge period.
 */
contract VisionEqualizerV3 is AccessControl, Pausable, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant TSS_SIGNER_ROLE = keccak256("TSS_SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // External contract references
    address public lzEndpoint;
    MessageInbox public messageInbox;
    IntentCommitment public intentCommitment;
    
    // Token contract for minting
    address public vcnToken;

    // Allowlist: ChainId -> SourceContract -> bool
    mapping(uint16 => mapping(bytes => bool)) public trustedRemoteLookup;

    // Mapping: User -> ChainId -> Symbol -> Balance (virtual liquidity)
    mapping(address => mapping(uint256 => mapping(string => uint256))) public globalLiquidity;
    
    // Idempotency: MessageHash -> Processed bool
    mapping(bytes32 => bool) public processedMessages;
    
    // MessageHash -> Minted bool
    mapping(bytes32 => bool) public mintedMessages;

    // Non-blocking: Failed Message Hash -> Payload (for retry)
    mapping(bytes32 => bytes) public failedMessages;

    // Accounting: ChainId -> Symbol -> Total Liquidity
    mapping(uint256 => mapping(string => uint256)) public chainBalance;

    // Events
    event MessageReceived(uint16 srcChainId, bytes srcAddress, uint64 nonce, bytes payload);
    event MessageSubmittedToPending(bytes32 indexed messageHash, address recipient, uint256 amount);
    event MintExecuted(bytes32 indexed messageHash, address recipient, uint256 amount);
    event LiquiditySynced(address user, uint256 chainId, string symbol, uint256 amount);
    event MessageFailed(uint16 srcChainId, bytes srcAddress, uint64 nonce, bytes payload, bytes reason);

    constructor(
        address _lzEndpoint,
        address _messageInbox,
        address _intentCommitment,
        address _vcnToken
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
        lzEndpoint = _lzEndpoint;
        messageInbox = MessageInbox(_messageInbox);
        intentCommitment = IntentCommitment(_intentCommitment);
        vcnToken = _vcnToken;
    }

    // --- Configuration ---

    function setTrustedRemote(uint16 _srcChainId, bytes calldata _path) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedRemoteLookup[_srcChainId][_path] = true;
    }

    function updateLzEndpoint(address _newEndpoint) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lzEndpoint = _newEndpoint;
    }
    
    function setMessageInbox(address _inbox) external onlyRole(DEFAULT_ADMIN_ROLE) {
        messageInbox = MessageInbox(_inbox);
    }
    
    function setIntentCommitment(address _commitment) external onlyRole(DEFAULT_ADMIN_ROLE) {
        intentCommitment = IntentCommitment(_commitment);
    }

    // --- Receive Path (LayerZero) ---

    /**
     * @dev Hardened Receive Function - Now submits to MessageInbox instead of instant mint
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external whenNotPaused nonReentrant {
        // 1. Authenticate Sender
        require(msg.sender == lzEndpoint, "Invalid endpoint caller");

        // 2. Authenticate Source
        require(trustedRemoteLookup[_srcChainId][_srcAddress], "Invalid source contract");

        // 3. Idempotency
        bytes32 msgHash = keccak256(abi.encodePacked(_srcChainId, _srcAddress, _nonce, _payload));
        require(!processedMessages[msgHash], "Message already processed");
        processedMessages[msgHash] = true;

        // 4. Non-blocking: Submit to Pending instead of instant execution
        try this.submitToPending(_srcChainId, _payload) {
            emit MessageReceived(_srcChainId, _srcAddress, _nonce, _payload);
        } catch (bytes memory reason) {
            failedMessages[msgHash] = _payload;
            emit MessageFailed(_srcChainId, _srcAddress, _nonce, _payload, reason);
        }
    }

    /**
     * @dev Submit message to MessageInbox as PENDING (called internally)
     */
    function submitToPending(
        uint16 _srcChainId,
        bytes calldata _payload
    ) external {
        require(msg.sender == address(this), "Caller must be self");
        
        (address recipient, string memory symbol, uint256 amount, bytes32 intentHash) = 
            abi.decode(_payload, (address, string, uint256, bytes32));
        
        // Verify intent commitment exists and is valid
        (bool valid, ) = intentCommitment.verifyIntent(intentHash);
        require(valid, "Invalid or expired intent");
        
        // Submit to MessageInbox
        bytes32 messageHash = messageInbox.submitPending(
            uint256(_srcChainId),    // srcChainId
            block.chainid,            // dstChainId
            vcnToken,                 // token
            amount,                   // amount
            recipient,                // recipient
            intentHash,               // intentHash
            ""                        // tssSignature (already verified in lzReceive)
        );
        
        // Update virtual liquidity
        globalLiquidity[recipient][uint256(_srcChainId)][symbol] += amount;
        chainBalance[uint256(_srcChainId)][symbol] += amount;
        
        emit MessageSubmittedToPending(messageHash, recipient, amount);
        emit LiquiditySynced(recipient, uint256(_srcChainId), symbol, amount);
    }

    /**
     * @dev Execute mint after message is finalized (called after challenge period)
     */
    function executeMint(bytes32 messageHash) external whenNotPaused nonReentrant {
        // Verify finalized in MessageInbox
        require(messageInbox.isFinalized(messageHash), "Message not finalized");
        require(!mintedMessages[messageHash], "Already minted");
        
        // Get message details
        MessageInbox.BridgeMessage memory msg_ = messageInbox.getMessage(messageHash);
        
        // Mark as minted
        mintedMessages[messageHash] = true;
        
        // Consume intent
        intentCommitment.consumeIntent(msg_.intentHash);
        
        // Execute mint (simplified - in production would call token contract)
        // IERC20Mintable(vcnToken).mint(msg_.recipient, msg_.amount);
        
        emit MintExecuted(messageHash, msg_.recipient, msg_.amount);
    }

    /**
     * @dev Retry failed message
     */
    function retryMessage(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external whenNotPaused nonReentrant {
        bytes32 msgHash = keccak256(abi.encodePacked(_srcChainId, _srcAddress, _nonce, _payload));
        require(failedMessages[msgHash].length > 0, "Message not found");
        
        delete failedMessages[msgHash];
        
        this.submitToPending(_srcChainId, _payload);
    }

    // --- Outbound: Request Bridge ---

    /**
     * @dev Request TSS migration with intent commitment
     */
    function requestBridgeWithIntent(
        uint256 sourceChainId,
        uint256 targetChainId,
        string memory symbol,
        uint256 amount,
        bytes32 intentHash
    ) external whenNotPaused nonReentrant {
        require(globalLiquidity[msg.sender][sourceChainId][symbol] >= amount, "Insufficient Credit");
        
        // Verify intent
        (bool valid, ) = intentCommitment.verifyIntent(intentHash);
        require(valid, "Invalid or expired intent");

        // Lock on Global Ledger
        globalLiquidity[msg.sender][sourceChainId][symbol] -= amount;
        chainBalance[sourceChainId][symbol] -= amount;

        // Emit for TSS to pick up and sign
        emit BridgeRequested(msg.sender, sourceChainId, targetChainId, symbol, amount, intentHash);
    }
    
    event BridgeRequested(
        address indexed user,
        uint256 sourceChainId,
        uint256 targetChainId,
        string symbol,
        uint256 amount,
        bytes32 intentHash
    );

    // --- Emergency ---

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
