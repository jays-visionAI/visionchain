// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VCN Token (Sepolia)
 * @dev VCN token for Sepolia/Ethereum. Minted when VCN is bridged from Vision Chain.
 * Same ticker (VCN) across all chains for consistency.
 * 
 * Total Supply Conservation:
 * - When user bridges VCN from Vision Chain -> Sepolia: VCN locked on Vision, VCN minted on Sepolia
 * - When user bridges VCN from Sepolia -> Vision Chain: VCN burned on Sepolia, VCN unlocked on Vision
 */
contract VCNToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    event BridgeMint(address indexed to, uint256 amount, bytes32 indexed bridgeId);
    event BridgeBurn(address indexed from, uint256 amount, bytes32 indexed bridgeId);

    constructor(address admin, address bridgeRelayer) 
        ERC20("VCN (Sepolia)", "VCN") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(BRIDGE_ROLE, bridgeRelayer);
        _grantRole(MINTER_ROLE, bridgeRelayer);
    }

    /**
     * @dev Mint wVCN when VCN is bridged from Vision Chain.
     * Can only be called by addresses with BRIDGE_ROLE.
     */
    function bridgeMint(address to, uint256 amount, bytes32 bridgeId) external onlyRole(BRIDGE_ROLE) {
        _mint(to, amount);
        emit BridgeMint(to, amount, bridgeId);
    }

    /**
     * @dev Burn wVCN when bridging back to Vision Chain.
     * User must approve this contract first.
     */
    function bridgeBurn(uint256 amount, bytes32 bridgeId) external {
        _burn(msg.sender, amount);
        emit BridgeBurn(msg.sender, amount, bridgeId);
    }

    /**
     * @dev Standard mint function for admin use.
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
