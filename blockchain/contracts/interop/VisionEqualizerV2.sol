// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VisionEqualizerV2 (Hybrid Interop Edition)
 * @dev Integrates LayerZero messaging with a virtual liquidity ledger.
 * This contract acts as the "Source of Truth" for user credits across the Vision ecosystem.
 */
contract VisionEqualizerV2 is AccessControl, Pausable {
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant TSS_SIGNER_ROLE = keccak256("TSS_SIGNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // LayerZero Endpoint Address (Mock or Real)
    address public lzEndpoint;

    // Allowlist: ChainId -> SourceContract -> bool
    mapping(uint16 => mapping(bytes => bool)) public trustedRemoteLookup;

    // Mapping: User -> ChainId -> Symbol -> Balance
    mapping(address => mapping(uint256 => mapping(string => uint256))) public globalLiquidity;
    
    // Idempotency: MessageHash -> Processed bool
    mapping(bytes32 => bool) public processedMessages;

    // Non-blocking: Failed Message Hash -> Payload (for retry)
    mapping(bytes32 => bytes) public failedMessages;

    // Accounting: ChainId -> Symbol -> Total Liquidity Bridged In
    mapping(uint256 => mapping(string => uint256)) public chainBalance;

    // TSS Request State Machine
    enum RequestStatus { PENDING, SIGNED, EXECUTED }
    struct TSSRequest {
        address user;
        uint256 targetChainId;
        string symbol;
        uint256 amount;
        RequestStatus status;
    }
    mapping(bytes32 => TSSRequest) public tssRequests;

    event MessageReceived(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _payload);
    event LiquiditySynced(address user, uint256 chainId, string symbol, uint256 amount);
    event TSSRequestEmitted(bytes32 indexed requestId, address user, uint256 targetChainId, uint256 amount);
    event MessageFailed(uint16 _srcChainId, bytes _srcAddress, uint64 _nonce, bytes _payload, bytes _reason);
    event MessageRetried(bytes32 _msgHash);

    constructor(address _lzEndpoint) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender); // Admin can pause by default
        lzEndpoint = _lzEndpoint;
    }

    // --- Emergency Controls ---

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // --- Configuration ---

    function setTrustedRemote(uint16 _srcChainId, bytes calldata _path) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trustedRemoteLookup[_srcChainId][_path] = true;
    }

    function updateLzEndpoint(address _newEndpoint) external onlyRole(DEFAULT_ADMIN_ROLE) {
        lzEndpoint = _newEndpoint;
    }

    // --- Receive Path ---

    /**
     * @dev Hardened Receive Function (lzReceive equivalent)
     * 1. Checks Sender (must be LZ Endpoint)
     * 2. Checks Trusted Remote (must be whitelisted peer)
     * 3. Checks Idempotency (prevent replay)
     * 4. Non-blocking (try-catch execution)
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external whenNotPaused {
        // 1. Authenticate Sender: Must be the LayerZero Endpoint
        require(msg.sender == lzEndpoint, "Invalid endpoint caller");

        // 2. Authenticate Source: Must be a trusted peer on the source chain
        // Note: LZ sends _srcAddress as abi.encodePacked(remoteAddress, localAddress) typically
        // For simplicity here we check the raw bytes.
        require(trustedRemoteLookup[_srcChainId][_srcAddress], "Invalid source contract");

        // 3. Idempotency: Generate unique hash for this specific message
        bytes32 msgHash = keccak256(abi.encodePacked(_srcChainId, _srcAddress, _nonce, _payload));
        require(!processedMessages[msgHash], "Message already processed");
        processedMessages[msgHash] = true;

        // 4. Non-blocking Execution
        try this.nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload) {
            emit MessageReceived(_srcChainId, _srcAddress, _nonce, _payload);
        } catch (bytes memory reason) {
            // Store failed message for manual retry
            failedMessages[msgHash] = _payload;
            emit MessageFailed(_srcChainId, _srcAddress, _nonce, _payload, reason);
        }
    }

    /**
     * @dev Public for try-catch but restricted to self-call
     */
    function nonblockingLzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external {
        require(msg.sender == address(this), "Caller must be self");
        
        (address user, string memory symbol, uint256 amount) = abi.decode(_payload, (address, string, uint256));
        
        // --- Business Logic ---
        // 1. Update Global Ledger (User Credit)
        globalLiquidity[user][uint256(_srcChainId)][symbol] += amount;

        // 2. Update System Accounting (Solvency Tracking)
        chainBalance[uint256(_srcChainId)][symbol] += amount;

        emit LiquiditySynced(user, uint256(_srcChainId), symbol, amount);
    }

    /**
     * @dev Manual Retry for failed messages
     */
    function retryMessage(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external whenNotPaused {
        bytes32 msgHash = keccak256(abi.encodePacked(_srcChainId, _srcAddress, _nonce, _payload));
        require(failedMessages[msgHash].length > 0, "Message not found or already processed");
        
        // Clear before execution (Checks-Effects-Interactions)
        delete failedMessages[msgHash];

        // Execute directly (if it fails again, it reverts transaction)
        this.nonblockingLzReceive(_srcChainId, _srcAddress, _nonce, _payload);
        
        emit MessageRetried(msgHash);
    }

    // --- Send Path ---

    function requestTSSMigration(
        uint256 sourceChainId,
        uint256 targetChainId,
        string memory symbol,
        uint256 amount
    ) external whenNotPaused {
        require(globalLiquidity[msg.sender][sourceChainId][symbol] >= amount, "Insufficient Credit");
        
        // Invariant Check: Cannot bridge out more than total system balance (optional per-chain check)
        // require(chainBalance[sourceChainId][symbol] >= amount, "System Solvency Limit Reached");

        // Lock on Global Ledger
        globalLiquidity[msg.sender][sourceChainId][symbol] -= amount;
        
        // Accounting Update
        chainBalance[sourceChainId][symbol] -= amount;

        bytes32 requestId = keccak256(abi.encodePacked(msg.sender, block.timestamp, amount, targetChainId));
        
        tssRequests[requestId] = TSSRequest({
            user: msg.sender,
            targetChainId: targetChainId,
            symbol: symbol,
            amount: amount,
            status: RequestStatus.PENDING
        });

        // This event is the trigger for MPC nodes to start Threshold Signing
        emit TSSRequestEmitted(requestId, msg.sender, targetChainId, amount);
    }
}
