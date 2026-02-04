// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VCNPaymasterNative
 * @dev Paymaster for sponsoring gas fees on Vision Chain (Native VCN).
 * 
 * This paymaster:
 * 1. Receives VCN from users (deposit)
 * 2. Sponsors gas fees for whitelisted operations
 * 3. Uses MPC signatures for security
 * 
 * Since VCN is native, gas is paid in VCN directly.
 */
contract VCNPaymasterNative is Ownable, ReentrancyGuard {
    
    // MPC Signers
    mapping(address => bool) public mpcSigners;
    uint256 public signerCount;
    uint256 public requiredSignatures;
    
    // User deposits
    mapping(address => uint256) public deposits;
    
    // Sponsored operations
    mapping(bytes32 => bool) public processedOps;
    
    // Daily gas limit per user
    mapping(address => uint256) public dailyGasUsed;
    mapping(address => uint256) public lastGasReset;
    uint256 public maxDailyGasPerUser = 0.1 ether; // 0.1 VCN per day
    
    // Whitelisted contracts (operations on these are free)
    mapping(address => bool) public whitelistedContracts;
    
    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event GasSponsored(address indexed user, address indexed target, uint256 gasUsed, bytes32 opHash);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event ContractWhitelisted(address indexed contractAddr, bool status);
    
    constructor(address[] memory _signers, uint256 _requiredSignatures) Ownable() {
        require(_signers.length >= _requiredSignatures, "Not enough signers");
        require(_requiredSignatures > 0, "Need at least 1 signature");
        
        for (uint256 i = 0; i < _signers.length; i++) {
            mpcSigners[_signers[i]] = true;
        }
        signerCount = _signers.length;
        requiredSignatures = _requiredSignatures;
    }
    
    /**
     * @dev Deposit VCN for future gas sponsorship
     */
    function deposit() external payable {
        require(msg.value > 0, "Must deposit non-zero amount");
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw deposited VCN
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(deposits[msg.sender] >= amount, "Insufficient deposit");
        deposits[msg.sender] -= amount;
        
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Withdraw failed");
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Sponsor gas for a user operation
     * Called by relayer after verifying MPC signatures
     */
    function sponsorGas(
        address user,
        address target,
        uint256 gasAmount,
        bytes32 opHash,
        bytes[] calldata signatures
    ) external nonReentrant {
        require(!processedOps[opHash], "Operation already processed");
        require(gasAmount > 0, "Invalid gas amount");
        
        // Check daily limit
        if (block.timestamp >= lastGasReset[user] + 1 days) {
            dailyGasUsed[user] = 0;
            lastGasReset[user] = block.timestamp;
        }
        
        // If target is whitelisted, sponsor from pool
        // Otherwise, deduct from user deposit
        if (whitelistedContracts[target]) {
            require(address(this).balance >= gasAmount, "Insufficient pool balance");
            require(dailyGasUsed[user] + gasAmount <= maxDailyGasPerUser, "Daily limit exceeded");
            dailyGasUsed[user] += gasAmount;
        } else {
            require(deposits[user] >= gasAmount, "Insufficient user deposit");
            deposits[user] -= gasAmount;
        }
        
        // Verify signatures
        bytes32 messageHash = keccak256(abi.encodePacked(user, target, gasAmount, opHash, block.chainid));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        uint256 validSignatures = 0;
        address[] memory signers = new address[](signatures.length);
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = recoverSigner(ethSignedHash, signatures[i]);
            if (mpcSigners[signer]) {
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
        
        processedOps[opHash] = true;
        
        emit GasSponsored(user, target, gasAmount, opHash);
    }
    
    // --- Admin Functions ---
    
    function addSigner(address signer) external onlyOwner {
        require(!mpcSigners[signer], "Already a signer");
        mpcSigners[signer] = true;
        signerCount++;
        emit SignerAdded(signer);
    }
    
    function removeSigner(address signer) external onlyOwner {
        require(mpcSigners[signer], "Not a signer");
        require(signerCount > requiredSignatures, "Cannot remove: too few signers");
        mpcSigners[signer] = false;
        signerCount--;
        emit SignerRemoved(signer);
    }
    
    function setWhitelistedContract(address contractAddr, bool status) external onlyOwner {
        whitelistedContracts[contractAddr] = status;
        emit ContractWhitelisted(contractAddr, status);
    }
    
    function setMaxDailyGas(uint256 amount) external onlyOwner {
        maxDailyGasPerUser = amount;
    }
    
    function fundPool() external payable onlyOwner {
        // Just receive VCN to fund the gas pool
    }
    
    function withdrawPool(address to, uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Withdraw failed");
    }
    
    // --- View Functions ---
    
    function getPoolBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    function getUserDeposit(address user) external view returns (uint256) {
        return deposits[user];
    }
    
    function getRemainingDailyGas(address user) external view returns (uint256) {
        if (block.timestamp >= lastGasReset[user] + 1 days) {
            return maxDailyGasPerUser;
        }
        return maxDailyGasPerUser > dailyGasUsed[user] ? maxDailyGasPerUser - dailyGasUsed[user] : 0;
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
