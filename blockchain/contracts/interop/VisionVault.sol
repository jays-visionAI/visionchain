// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VisionVault
 * @dev Deployed on Satellite Chains (e.g., Ethereum, Polygon, Base).
 * Holds assets physically. Releases them only when authorized by Vision Consensus (Validator Signature).
 */
contract VisionVault is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");
    
    IERC20 public supportedToken;
    uint256 public chainId; // The ID of THIS chain

    event LiquidityLocked(address indexed user, uint256 amount, uint256 destinationChainId, uint256 timestamp);
    event LiquidityReleased(address indexed user, uint256 amount, uint256 fromChainId);

    // Replay protection for signatures
    mapping(bytes32 => bool) public processedSignatures;

    constructor(address _tokenAddress, uint256 _chainId) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        supportedToken = IERC20(_tokenAddress);
        chainId = _chainId;
    }

    /**
     * @dev User deposits funds to move them into the Vision Network (or another connected chain).
     * Funds are LOCKED here. The VisionConnect Relayer picks up this event.
     */
    function depositToVision(uint256 amount, uint256 destinationChainId) external {
        require(amount > 0, "Amount must be > 0");
        require(supportedToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit LiquidityLocked(msg.sender, amount, destinationChainId, block.timestamp);
    }

    /**
     * @dev Release funds to user. Requires a signature from the Vision Chain Validators.
     * This acts as the "Mint" or "Unlock" side of the bridge, but driven by the Equalizer's command.
     */
    function releaseLiquidity(
        address to, 
        uint256 amount, 
        uint256 fromChainId, 
        uint256 nonce,
        bytes memory signature
    ) external {
        bytes32 messageHash = keccak256(abi.encodePacked(to, amount, fromChainId, nonce, chainId, address(this)));
        bytes32 ethSignedMessageHash = messageHash.toEthSignedMessageHash();

        require(!processedSignatures[ethSignedMessageHash], "Signature already used");
        require(_verifyValidator(ethSignedMessageHash, signature), "Invalid Validator Signature");

        processedSignatures[ethSignedMessageHash] = true;
        require(supportedToken.transfer(to, amount), "Transfer failed");

        emit LiquidityReleased(to, amount, fromChainId);
    }

    function _verifyValidator(bytes32 hash, bytes memory signature) internal view returns (bool) {
        address signer = hash.recover(signature);
        return hasRole(VALIDATOR_ROLE, signer);
    }
}
