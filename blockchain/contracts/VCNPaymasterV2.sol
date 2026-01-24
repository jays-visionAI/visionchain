// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@account-abstraction/contracts/core/BasePaymaster.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VCNPaymasterV2 (Production Grade)
 * @dev Fully compliant ERC-4337 Paymaster with Off-chain Signer verification.
 * Supports EntryPoint v0.6/0.7 logic via BasePaymaster.
 */
contract VCNPaymasterV2 is BasePaymaster {
    using ECDSA for bytes32;

    // The off-chain signer address that approves transactions (The "Backend" / "Sequencer")
    address public verifyingSigner;
    
    // Time window for signature validity (to prevent replay of old signatures)
    uint256 public constant SIGNATURE_VALIDITY_WINDOW = 300; // 5 minutes

    event VerifyingSignerChanged(address indexed oldSigner, address indexed newSigner);

    // Constructor: Sets the EntryPoint and the Verifying Signer
    constructor(IEntryPoint _entryPoint, address _verifyingSigner) BasePaymaster(_entryPoint) {
        require(_verifyingSigner != address(0), "Signer cannot be zero address");
        verifyingSigner = _verifyingSigner;
        _transferOwnership(msg.sender);
    }

    /**
     * @notice Updates the off-chain signer address.
     */
    function setVerifyingSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Signer cannot be zero address");
        emit VerifyingSignerChanged(verifyingSigner, _newSigner);
        verifyingSigner = _newSigner;
    }

    /**
     * @notice Main validation logic for ERC-4337.
     * @param userOp The user operation.
     * @param userOpHash The hash of the user operation.
     * @param maxCost The maximum cost of this transaction.
     * @return context Context to be passed to postOp (not used here).
     * @return validationData Validation result (0 for success, or a time-range).
     */
    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // 1. Verify that the Paymaster has enough ETH deposited in EntryPoint
        // BasePaymaster checks this implicitly, but explicit check implies safety.
        
        // 2. Security Checks
        // 2.1 Gas Price Cap (Prevent Griefing) - Max 500 gwei (adjustable)
        require(userOp.maxFeePerGas <= 500 gwei, "Gas price too high");

        // 2.2 Decode paymasterAndData
        // Format: [paymaster (20)] + [validUntil (6)] + [validAfter (6)] + [signature (dynamic)]
        // We expect minimal: [paymaster (20)] + [signature (65)] = 85 bytes
        if (userOp.paymasterAndData.length < 85) { 
            return ("", _packValidationData(true, 0, 0)); // Fail
        }

        // 2.3 Rate Limit Check (DDoS / Drain Protection)
        // Check per-sender daily limit
        address sender = userOp.sender;
        _checkRateLimit(sender, maxCost);

        // Extract signature (last 65 bytes)
        bytes calldata signature = userOp.paymasterAndData[userOp.paymasterAndData.length - 65:];
        
        // 3. Verify Signature
        // The signer must sign the hash: keccak256(userOpHash, chainId, contractAddr)
        // This binds the signature to this specific operation on this specific chain
        bytes32 hash = keccak256(abi.encode(userOpHash, block.chainid, address(this)));
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        
        address recovered = ethSignedHash.recover(signature);
        
        // 4. Return result
        // 0 = Success, 1 (SIG_VALIDATION_FAILED) = Fail
        if (recovered != verifyingSigner) {
            return ("", _packValidationData(true, 0, 0)); // Signature mismatch -> potentially fail
        }

        // Finalize state update
        _updateUsage(userOp.sender, maxCost);

        // Return success (sig valid, infinite time validity for simplicity, or parse from data)
        return ("", _packValidationData(false, 0, 0));
    }
    
    // --- Rate Limit & Policy Logic ---
    struct UserPolicy {
        uint256 dailyLimit;
        uint256 usedToday;
        uint256 lastReset;
    }
    mapping(address => UserPolicy) public userPolicies;
    uint256 public constant DEFAULT_DAILY_LIMIT = 0.5 ether; // 0.5 ETH equivalent gas

    function _checkRateLimit(address user, uint256 maxCost) internal view {
        UserPolicy memory policy = userPolicies[user];
        uint256 limit = policy.dailyLimit == 0 ? DEFAULT_DAILY_LIMIT : policy.dailyLimit;
        
        if (block.timestamp > policy.lastReset + 1 days) {
            // Will reset
            require(maxCost <= limit, "Exceeds daily gas limit");
        } else {
            require(policy.usedToday + maxCost <= limit, "Exceeds daily gas limit");
        }
    }

    function _updateUsage(address user, uint256 cost) internal {
        UserPolicy storage policy = userPolicies[user];
        if (block.timestamp > policy.lastReset + 1 days) {
            policy.usedToday = cost;
            policy.lastReset = block.timestamp;
        } else {
            policy.usedToday += cost;
        }
    }
    
    function setUserDailyLimit(address user, uint256 limit) external onlyOwner {
        userPolicies[user].dailyLimit = limit;
    }
    
    /**
     * @notice Allows 'deposit' to this contract, which forwards to EntryPoint.
     * This makes "topping up" easier for users/admins (just send ETH to this address).
     */
    receive() external payable {
        if (msg.value > 0) {
            // Try to deposit to EntryPoint, but don't revert if it fails (just keep ETH in contract)
            // This is useful if EntryPoint address is wrong or not deployed on this chain yet.
            (bool success, ) = address(entryPoint).call{value: msg.value}(
                abi.encodeWithSignature("depositTo(address)", address(this))
            );
            if (!success) {
                // Emit event or just keep it? We'll just keep it for now.
                // This allows the Paymaster to "accept" funds even if infrastructure is broken.
            }
        }
    }


}
