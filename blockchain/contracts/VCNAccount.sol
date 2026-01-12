// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// Logic updated for OZ v4
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";
import "@account-abstraction/contracts/samples/callback/TokenCallbackHandler.sol";

/**
  * @title VCNAccount
  * @dev Custom AA wallet for VCN (v0.6.0 compatible).
  */
contract VCNAccount is BaseAccount, TokenCallbackHandler, UUPSUpgradeable, Initializable {
    address public owner;

    IEntryPoint private immutable _entryPoint;

    event VCNAccountInitialized(IEntryPoint indexed entryPoint, address indexed owner);

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    /// @inheritdoc BaseAccount
    function entryPoint() public view virtual override returns (IEntryPoint) {
        return _entryPoint;
    }

    receive() external payable {}

    constructor(IEntryPoint anEntryPoint) {
        _entryPoint = anEntryPoint;
        _disableInitializers();
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner || msg.sender == address(this), "only owner");
    }

    function initialize(address anOwner) public virtual initializer {
        _initialize(anOwner);
    }

    function _initialize(address anOwner) internal virtual {
        owner = anOwner;
        emit VCNAccountInitialized(_entryPoint, owner);
    }

    function _requireForExecute() internal view {
        require(msg.sender == address(entryPoint()) || msg.sender == owner, "account: not Owner or EntryPoint");
    }

    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256 validationData) {
        bytes32 hash = ECDSA.toEthSignedMessageHash(userOpHash);
        if (owner != ECDSA.recover(hash, userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0; // Success
    }

    function _authorizeUpgrade(address newImplementation) internal view override {
        (newImplementation);
        _onlyOwner();
    }
    
    // Function to execute calls
    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireForExecute();
        _call(dest, value, func);
    }

    function executeBatch(address[] calldata dest, bytes[] calldata func) external {
        _requireForExecute();
        require(dest.length == func.length, "wrong array lengths");
        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], 0, func[i]);
        }
    }

    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value : value}(data);
        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }
}
