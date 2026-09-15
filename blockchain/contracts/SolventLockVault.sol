// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SolventLockVault
 * @notice Pure custody of escrowed underlying tokens for the Solvent Lock market.
 *
 *  - Registry (REGISTRY_ROLE) escrows the full underlying supply at registration
 *    via acceptDeposit().
 *  - Settlement (SETTLER_ROLE) is the ONLY caller allowed to release underlying to
 *    holders when they claim vested amounts.
 *  - Per-lock escrow accounting is tracked so one lock token can never release more
 *    than was escrowed for it (isolation between issuers/tokens).
 */
contract SolventLockVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");
    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    // lockId => underlying token escrowed for that lock
    mapping(uint256 => IERC20) public underlyingOf;
    // lockId => remaining escrowed balance available to release
    mapping(uint256 => uint256) public escrowed;
    // lockId => total released so far (bookkeeping)
    mapping(uint256 => uint256) public released;

    event Escrowed(uint256 indexed lockId, address indexed underlying, address indexed from, uint256 amount);
    event Released(uint256 indexed lockId, address indexed to, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function grantRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REGISTRY_ROLE, registry);
    }

    function grantSettler(address settlement) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(SETTLER_ROLE, settlement);
    }

    /**
     * @notice Escrow the full underlying supply for a lock token at registration.
     * @dev Called by Registry. `from` (the issuer) must have approved this Vault.
     */
    function acceptDeposit(uint256 lockId, IERC20 underlying, uint256 amount, address from)
        external
        nonReentrant
        onlyRole(REGISTRY_ROLE)
    {
        require(amount > 0, "Zero amount");
        require(address(underlyingOf[lockId]) == address(0), "Already escrowed");
        require(address(underlying) != address(0), "Invalid underlying");

        underlyingOf[lockId] = underlying;
        underlying.safeTransferFrom(from, address(this), amount);
        escrowed[lockId] += amount;

        emit Escrowed(lockId, address(underlying), from, amount);
    }

    /**
     * @notice Release vested underlying to a claiming holder.
     * @dev Only Settlement may call. Bounded by per-lock escrow to isolate tokens.
     */
    function release(uint256 lockId, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(SETTLER_ROLE)
    {
        require(amount > 0, "Zero amount");
        require(escrowed[lockId] >= amount, "Exceeds escrow");
        IERC20 underlying = underlyingOf[lockId];
        require(address(underlying) != address(0), "Unknown lock");

        escrowed[lockId] -= amount;
        released[lockId] += amount;
        underlying.safeTransfer(to, amount);

        emit Released(lockId, to, amount);
    }
}
