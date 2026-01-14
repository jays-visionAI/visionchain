// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title VisionEqualizer
 * @dev The Heart of the "Network Agnostic" Architecture.
 * Instead of burning tokens, this contract maintains the "Global State" of user liquidity across all chains.
 * It acts as the Clearing House for the Vision Chain Network.
 */
contract VisionEqualizer is AccessControl {
    using ECDSA for bytes32;

    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant VALIDATOR_ROLE = keccak256("VALIDATOR_ROLE");

    // Mapping: User Address -> Chain ID -> Token Symbol -> Balance
    // This represents the user's "Credit" on the Vision Network that can be materialized on any connected chain.
    mapping(address => mapping(uint256 => mapping(string => uint256))) public globalLiquidity;

    // Nonce to prevent replay attacks on cross-chain messages
    mapping(address => uint256) public userNonces;

    event LiquiditySynced(address indexed user, uint256 sourceChainId, string symbol, uint256 amount);
    event LiquidityReleaseRequested(address indexed user, uint256 targetChainId, string symbol, uint256 amount, uint256 nonce);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RELAYER_ROLE, msg.sender); // Initial setup
    }

    /**
     * @dev Called by the Relayer (Listening to Kafka/Satellite Vaults) when a user locks funds on a remote chain.
     * This credits the user's Global Balance without minting new tokens immediately.
     */
    function syncDeposit(
        address user,
        uint256 sourceChainId,
        string memory symbol,
        uint256 amount
    ) external onlyRole(RELAYER_ROLE) {
        globalLiquidity[user][sourceChainId][symbol] += amount;
        emit LiquiditySynced(user, sourceChainId, symbol, amount);
    }

    /**
     * @dev User requests to move their "Credit" from Vision Chain (or another chain) to a specific Target Chain.
     * This emits an event that the Relayer picks up to sign a transaction on the Target Chain's Vault.
     */
    function requestCrossChainMove(
        uint256 sourceChainId,
        uint256 targetChainId,
        string memory symbol,
        uint256 amount
    ) external {
        require(globalLiquidity[msg.sender][sourceChainId][symbol] >= amount, "Insufficient Global Credit");

        // 1. Deduct from Source Ledger (Virtual Move)
        globalLiquidity[msg.sender][sourceChainId][symbol] -= amount;
        
        // 2. Add to Target Ledger (Virtual Move)
        globalLiquidity[msg.sender][targetChainId][symbol] += amount;

        // 3. Emit Signal for Relayer to execute physical unlock/mint on Target
        emit LiquidityReleaseRequested(msg.sender, targetChainId, symbol, amount, userNonces[msg.sender]++);
    }

    /**
     * @dev View function to check a user's cross-chain portfolio
     */
    function getGlobalBalance(address user, uint256 chainId, string memory symbol) external view returns (uint256) {
        return globalLiquidity[user][chainId][symbol];
    }
}
