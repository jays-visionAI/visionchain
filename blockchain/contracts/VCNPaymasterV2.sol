// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VCNPaymasterV2 (MPC-TSS Powered)
 * @dev Replaces single-signer paymaster with a Threshold Signature validation model.
 * In the Vision ecosystem, gasless transactions are only sponsored if m-of-n 
 * Validator nodes agree on the validity of the user's intent.
 */
contract VCNPaymasterV2 is Ownable, Pausable {
    using ECDSA for bytes32;

    // Phase 4: Single TSS Key (No loop)
    address public tssSigner;
    uint256 public currentEpoch;

    // Phase 5: Policy Guardrails
    struct Policy {
        bool allowed;
        uint256 dailyLimit;
        uint256 usedToday;
        uint256 lastReset;
    }
    
    // Whitelisted Target Contracts (e.g., VisionVault, Uniswap)
    mapping(address => bool) public targetAllowlist;
    
    // User Rate Limiting
    mapping(address => Policy) public userPolicies;
    
    // Replay protection
    mapping(bytes32 => bool) public processedOps;
    
    // Emergency: Pauser whitelist (simplified for now, Owner is Pauser)
    mapping(address => bool) public pausers;

    event GasSponsored(address indexed user, bytes32 indexed opHash, uint256 amount);
    event TSSRotated(uint256 epoch, address newSigner);
    event PolicyUpdated(address indexed user, uint256 limit);
    event PauserAdded(address account);
    event PauserRemoved(address account);

    modifier onlyPauser() {
        require(owner() == msg.sender || pausers[msg.sender], "Caller is not a pauser");
        _;
    }

    constructor(address _tssSigner) {
        tssSigner = _tssSigner;
        currentEpoch = 1;
        _grantPauser(msg.sender); // Deployer can pause
    }

    // --- Emergency Controls ---

    function pause() external onlyPauser {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setPauser(address account, bool status) external onlyOwner {
        if (status) _grantPauser(account);
        else _revokePauser(account);
    }

    function _grantPauser(address account) internal {
        pausers[account] = true;
        emit PauserAdded(account);
    }

    function _revokePauser(address account) internal {
        pausers[account] = false;
        emit PauserRemoved(account);
    }

    /**
     * @dev Validates a request against Policy & TSS Signature.
     * This is the entry point for the EntryPoint contract.
     */
    function validatePaymasterOp(
        bytes32 opHash,
        address user,
        address target,
        uint256 amount,
        uint256 validUntil,
        bytes calldata signature
    ) external whenNotPaused {
        // 1. Check Basic Validity
        require(block.timestamp <= validUntil, "Signature expired");
        require(!processedOps[opHash], "Operation already processed");
        require(targetAllowlist[target], "Target not allowed");

        // 2. Policy Check (Phase 5: Gripping Prevention)
        _checkRateLimit(user, amount);

        // 3. Verify TSS Signature (Phase 4: Single Key)
        // The signature must come from the aggregate public key of the MPC cluster
        bytes32 ethSignedHash = keccak256(abi.encodePacked(opHash, user, amount, currentEpoch, block.chainid))
            .toEthSignedMessageHash();
            
        address recovered = ethSignedHash.recover(signature);
        require(recovered == tssSigner, "Invalid TSS signature");

        // 4. Finalize
        processedOps[opHash] = true;
        _updateUsage(user, amount);

        emit GasSponsored(user, opHash, amount);
    }

    // --- Internal Policy Logic ---

    function _checkRateLimit(address user, uint256 amount) internal view {
        Policy memory policy = userPolicies[user];
        if (block.timestamp > policy.lastReset + 1 days) {
            // New day, limit resets
            return; 
        }
        require(policy.usedToday + amount <= policy.dailyLimit, "Daily gas limit exceeded");
    }

    function _updateUsage(address user, uint256 amount) internal {
        Policy storage policy = userPolicies[user];
        if (block.timestamp > policy.lastReset + 1 days) {
            policy.usedToday = amount;
            policy.lastReset = block.timestamp;
        } else {
            policy.usedToday += amount;
        }
    }

    // --- Admin Functions ---

    function rotateTSSKey(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid key");
        tssSigner = _newSigner;
        currentEpoch++;
        emit TSSRotated(currentEpoch, _newSigner);
    }

    function setTargetAllowlist(address _target, bool _status) external onlyOwner {
        targetAllowlist[_target] = _status;
    }

    function setUserPolicy(address _user, uint256 _dailyLimit) external onlyOwner {
        userPolicies[_user].allowed = true;
        userPolicies[_user].dailyLimit = _dailyLimit;
        emit PolicyUpdated(_user, _dailyLimit);
    }
}
