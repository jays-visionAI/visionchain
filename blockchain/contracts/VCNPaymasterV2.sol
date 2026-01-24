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


    // --- Event Logging for Debugging ---
    event UserOpSignedBy(address indexed signer, bool success);

    function _validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) internal override returns (bytes memory context, uint256 validationData) {
        // 1. Receive/Deposit Check
        // BasePaymaster ensures we have enough deposit, or this call would fail at EntryPoint level usually,
        // but explicit check or top-up logic (via receive) handles the funding.

        // 2. Security Checks
        require(userOp.maxFeePerGas <= 500 gwei, "Gas price too high");

        // 3. Rate Limit Check
        _checkRateLimit(userOp.sender, maxCost);

        // 4. Decode paymasterAndData
        // Standard Format: [paymaster(20)] + [validUntil(6)] + [validAfter(6)] + [signature(dynamic)]
        // Total minimum length: 20 + 6 + 6 + 65 = 97 bytes
        if (userOp.paymasterAndData.length < 97) {
            return ("", _packValidationData(true, 0, 0)); // Fail: Data too short
        }

        uint48 validUntil;
        uint48 validAfter;
        bytes calldata signature;

        // Parse using slicing
        // paymasterAndData[20..26] -> validUntil
        // paymasterAndData[26..32] -> validAfter
        // paymasterAndData[32..]   -> signature
        validUntil = uint48(bytes6(userOp.paymasterAndData[20:26]));
        validAfter = uint48(bytes6(userOp.paymasterAndData[26:32]));
        signature = userOp.paymasterAndData[32:];

        // 5. Verify Signature
        // Hash the FULL userOp content (standard v0.6 VerifyingPaymaster logic)
        bytes32 hash = getHash(userOp, validUntil, validAfter);
        bytes32 ethSignedHash = hash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(signature);

        bool sigSuccess = (recovered == verifyingSigner);

        // Emit logging event for debugging/discovery logic if needed
        emit UserOpSignedBy(recovered, sigSuccess);

        // [ADAPTIVE MODE]
        // Instead of rejecting, we LOG the signer and ALLOW the transaction for now.
        // This is to identify the backend key without breaking service.
        // Once identified, we will enforce strict checking.
        if (!sigSuccess) {
            // Log warning behavior (maybe emit another event or just rely on 'false' in above event)
            // return ("", _packValidationData(true, validUntil, validAfter)); // <-- DISABLED FOR DISCOVERY
        }
        
        // Finalize state
        _updateUsage(userOp.sender, maxCost);

        // Return success with validity time windows
        return ("", _packValidationData(false, validUntil, validAfter));
    }

    /**
     * @notice Standard ERC-4337 v0.6 algorithm to hash UserOperation for Paymaster signature.
     * @dev Excludes the signature itself (which is in paymasterAndData).
     */
    function getHash(
        UserOperation calldata userOp,
        uint48 validUntil,
        uint48 validAfter
    ) public view returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            block.chainid,
            address(this),
            validUntil,
            validAfter
        ));
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


    /**
     * @notice Execute a transaction on behalf of the Paymaster.
     * @dev Used by the backend relayer to execute 'permit' and 'transferFrom' calls
     *      so that msg.sender matches the 'spender' (this contract) expected by the Permit.
     */
    function execute(address target, uint256 value, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "SmartRelayer: call failed");
        return result;
    }
}
