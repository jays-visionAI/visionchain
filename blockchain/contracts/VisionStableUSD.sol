// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  Vision USD (vUSD)
 * @notice RWA-style, USD-pegged settlement asset for the Solvent DEX on Vision Chain.
 *
 * Unlike MockUSDT (testnet faucet), issuance here is CONTROLLED: only MINTER_ROLE
 * (the treasury) can mint, so circulating supply equals a liability the treasury
 * commits to back 1:1. The intended lifecycle:
 *
 *   Phase 1 (pilot): treasury mints vUSD to seed market-maker agents and a capped
 *                    pilot faucet. Clearly a pilot instrument — NOT for retail real
 *                    money until reserves are real.
 *   Phase 2 (backed): real USDT is custodied; `declareReserves` publishes the
 *                     backing on-chain (proof-of-reserves), targeting 100% (1:1).
 *                     A later Redeemer contract can enforce on-chain USDT<->vUSD.
 *
 * 18 decimals — the Solvent backend/orderbook works in 1e18 fixed point and never
 * reads token decimals (quoteAmount = lockAmount * price / 1e18), so the quote token
 * MUST be 18-decimal for amounts and UI (fromWei ÷1e18) to be correct. The USD peg is
 * a VALUE peg, not a decimal peg: when real USDT (6 dec) is later custodied, the Phase-2
 * Redeemer mints vUSD at 1 USDT → 1 vUSD, scaling by 1e12 at that single boundary.
 */
contract VisionStableUSD is ERC20, ERC20Burnable, ERC20Pausable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ATTESTOR_ROLE = keccak256("ATTESTOR_ROLE");

    uint8 private constant _DECIMALS = 18;

    /// Declared off-chain USDT reserves backing the supply (expressed in vUSD's 18-dec scale).
    uint256 public declaredReserves;
    /// Timestamp of the last reserve attestation.
    uint256 public reservesUpdatedAt;

    event ReservesDeclared(uint256 reserves, uint256 supply, uint256 timestamp);
    event Minted(address indexed to, uint256 amount);
    event Redeemed(address indexed from, uint256 amount);

    constructor(address admin) ERC20("Vision USD", "vUSD") ERC20Permit("Vision USD") {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(ATTESTOR_ROLE, admin);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    // ── Controlled issuance ──────────────────────────────────────────────────────
    /// Mint vUSD. Restricted to MINTER_ROLE (treasury). Supply is a backed liability.
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /// Burn caller's vUSD as a redemption signal (treasury releases USDT off-chain in
    /// Phase 1; an on-chain Redeemer supersedes this in Phase 2). ERC20Burnable's
    /// burn/burnFrom remain available for standard tooling.
    function redeem(uint256 amount) external {
        _burn(msg.sender, amount);
        emit Redeemed(msg.sender, amount);
    }

    // ── RWA proof-of-reserves ────────────────────────────────────────────────────
    /// Publish the USDT reserves currently backing supply (off-chain attested).
    function declareReserves(uint256 reserves) external onlyRole(ATTESTOR_ROLE) {
        declaredReserves = reserves;
        reservesUpdatedAt = block.timestamp;
        emit ReservesDeclared(reserves, totalSupply(), block.timestamp);
    }

    /// @return Collateralization in basis points (reserves / supply); 10000 = 100% (1:1).
    function collateralizationBps() external view returns (uint256) {
        uint256 s = totalSupply();
        if (s == 0) return type(uint256).max;
        return (declaredReserves * 10_000) / s;
    }

    // ── Emergency controls ───────────────────────────────────────────────────────
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ERC20 and ERC20Pausable both hook _beforeTokenTransfer — resolve the override.
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
