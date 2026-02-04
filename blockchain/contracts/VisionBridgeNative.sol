// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title VisionBridgeNative
 * @dev Bridge contract on Vision Chain for native VCN.
 * 
 * Flow:
 * 1. User locks VCN on Vision Chain (this contract)
 * 2. Relayer detects LockEvent and mints wVCN on Sepolia
 * 3. User burns wVCN on Sepolia
 * 4. Relayer detects BurnEvent and unlocks VCN on Vision Chain
 */
contract VisionBridgeNative is Ownable, ReentrancyGuard, Pausable {
    
    // Relayer addresses (MPC signers)
    mapping(address => bool) public relayers;
    uint256 public relayerCount;
    uint256 public requiredSignatures;
    
    // Nonce for preventing replay attacks
    mapping(bytes32 => bool) public processedTxs;
    uint256 public lockNonce;
    
    // Bridge limits
    uint256 public minBridgeAmount = 1 ether; // 1 VCN minimum
    uint256 public maxBridgeAmount = 1_000_000 ether; // 1M VCN maximum per tx
    uint256 public dailyLimit = 10_000_000 ether; // 10M VCN daily
    
    // Daily tracking
    uint256 public currentDayVolume;
    uint256 public lastDayReset;
    
    // Destination chain info
    uint256 public constant SEPOLIA_CHAIN_ID = 11155111;
    
    // Events
    event VCNLocked(
        address indexed sender,
        address indexed recipient,
        uint256 amount,
        uint256 nonce,
        uint256 destinationChainId,
        uint256 timestamp
    );
    
    event VCNUnlocked(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed sourceTransactionHash,
        uint256 sourceChainId
    );
    
    event RelayerAdded(address indexed relayer);
    event RelayerRemoved(address indexed relayer);
    event LimitsUpdated(uint256 minAmount, uint256 maxAmount, uint256 dailyLimit);
    
    constructor(address[] memory _relayers, uint256 _requiredSignatures) Ownable() {
        require(_relayers.length >= _requiredSignatures, "Not enough relayers");
        require(_requiredSignatures > 0, "Need at least 1 signature");
        
        for (uint256 i = 0; i < _relayers.length; i++) {
            relayers[_relayers[i]] = true;
        }
        relayerCount = _relayers.length;
        requiredSignatures = _requiredSignatures;
        lastDayReset = block.timestamp;
    }
    
    /**
     * @dev Lock VCN to bridge to Sepolia
     * @param recipient Address to receive wVCN on Sepolia
     */
    function lockVCN(address recipient) external payable nonReentrant whenNotPaused {
        require(msg.value >= minBridgeAmount, "Below minimum bridge amount");
        require(msg.value <= maxBridgeAmount, "Exceeds maximum bridge amount");
        require(recipient != address(0), "Invalid recipient");
        
        // Check and reset daily limit
        if (block.timestamp >= lastDayReset + 1 days) {
            currentDayVolume = 0;
            lastDayReset = block.timestamp;
        }
        
        require(currentDayVolume + msg.value <= dailyLimit, "Daily limit exceeded");
        currentDayVolume += msg.value;
        
        lockNonce++;
        
        emit VCNLocked(
            msg.sender,
            recipient,
            msg.value,
            lockNonce,
            SEPOLIA_CHAIN_ID,
            block.timestamp
        );
    }
    
    /**
     * @dev Unlock VCN after burn on Sepolia (called by relayer)
     * @param recipient Address to receive VCN
     * @param amount Amount of VCN to unlock
     * @param sourceTransactionHash Transaction hash from Sepolia burn
     * @param signatures Signatures from relayers
     */
    function unlockVCN(
        address recipient,
        uint256 amount,
        bytes32 sourceTransactionHash,
        bytes[] calldata signatures
    ) external nonReentrant whenNotPaused {
        require(!processedTxs[sourceTransactionHash], "Already processed");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(address(this).balance >= amount, "Insufficient bridge balance");
        require(signatures.length >= requiredSignatures, "Not enough signatures");
        
        // Verify signatures
        bytes32 messageHash = keccak256(abi.encodePacked(
            recipient,
            amount,
            sourceTransactionHash,
            block.chainid
        ));
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n32",
            messageHash
        ));
        
        uint256 validSignatures = 0;
        address[] memory signers = new address[](signatures.length);
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(ethSignedHash, signatures[i]);
            
            // Check if valid relayer and not duplicate
            if (relayers[signer]) {
                bool isDuplicate = false;
                for (uint256 j = 0; j < i; j++) {
                    if (signers[j] == signer) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (!isDuplicate) {
                    signers[i] = signer;
                    validSignatures++;
                }
            }
        }
        
        require(validSignatures >= requiredSignatures, "Insufficient valid signatures");
        
        processedTxs[sourceTransactionHash] = true;
        
        // Transfer VCN
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "VCN transfer failed");
        
        emit VCNUnlocked(recipient, amount, sourceTransactionHash, SEPOLIA_CHAIN_ID);
    }
    
    // --- Admin Functions ---
    
    function addRelayer(address relayer) external onlyOwner {
        require(!relayers[relayer], "Already a relayer");
        relayers[relayer] = true;
        relayerCount++;
        emit RelayerAdded(relayer);
    }
    
    function removeRelayer(address relayer) external onlyOwner {
        require(relayers[relayer], "Not a relayer");
        require(relayerCount > requiredSignatures, "Cannot remove: too few relayers");
        relayers[relayer] = false;
        relayerCount--;
        emit RelayerRemoved(relayer);
    }
    
    function setLimits(uint256 _minAmount, uint256 _maxAmount, uint256 _dailyLimit) external onlyOwner {
        minBridgeAmount = _minAmount;
        maxBridgeAmount = _maxAmount;
        dailyLimit = _dailyLimit;
        emit LimitsUpdated(_minAmount, _maxAmount, _dailyLimit);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyWithdraw(address to) external onlyOwner {
        require(paused(), "Must be paused");
        (bool success, ) = payable(to).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
    
    // --- View Functions ---
    
    function getBridgeBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getRemainingDailyLimit() external view returns (uint256) {
        if (block.timestamp >= lastDayReset + 1 days) {
            return dailyLimit;
        }
        return dailyLimit > currentDayVolume ? dailyLimit - currentDayVolume : 0;
    }
    
    // --- Internal Functions ---
    
    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        return ecrecover(hash, v, r, s);
    }
    
    // Allow contract to receive VCN
    receive() external payable {}
}
