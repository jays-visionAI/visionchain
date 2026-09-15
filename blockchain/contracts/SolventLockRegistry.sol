// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VestingTypes
 * @notice Shared vesting schedule struct used across the Solvent Lock market.
 */
struct VestingSchedule {
    uint64 startTime;        // Vesting start (typically TGE). Must be >= now at registration.
    uint64 cliffDuration;    // Cliff in seconds: nothing claimable until startTime + cliff.
    uint64 vestingDuration;  // Total linear vesting duration in seconds (from startTime).
}

interface ISolventLockSettlement {
    function initLockToken(
        uint256 lockId,
        address issuer,
        uint256 totalSupply,
        VestingSchedule calldata vesting
    ) external;

    function setLockActive(uint256 lockId, bool active) external;
}

interface ISolventLockVault {
    function acceptDeposit(uint256 lockId, IERC20 underlying, uint256 amount, address from) external;
}

/**
 * @title SolventLockRegistry
 * @notice Registry for VC-issued lock tokens (pre-TGE OTC market on Vision Chain).
 *
 *  Design decisions (locked in with the team):
 *    - Secondary market enabled: lock balances trade freely user-to-user.
 *    - LINEAR vesting only (cliff + linear) for MVP.
 *    - Full underlying escrow at registration (issuer escrows 100% up front).
 *
 *  Registration flow:
 *    1. Admin grants ISSUER_ROLE to a VC / project team.
 *    2. Issuer approves `totalSupply` of underlying to the Vault.
 *    3. Issuer calls registerLockToken():
 *         - Vault pulls and escrows the full underlying supply.
 *         - Settlement records the vesting schedule and credits the issuer
 *           with `totalSupply` lock balance so they can list sell orders.
 *    4. Trading stays disabled until Admin flips it on.
 */
contract SolventLockRegistry is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct LockToken {
        uint256 id;
        address issuer;
        IERC20 underlying;
        uint256 totalSupply;
        VestingSchedule vesting;
        uint256 listingPrice;    // reference quote price at listing (quote smallest-unit per 1e18 lock)
        bool tradingEnabled;
        bool cancelled;
    }

    uint256 public nextLockId = 1;
    mapping(uint256 => LockToken) private _lockTokens;

    address public settlement;
    address public vault;
    bool public wired;

    event LockTokenRegistered(
        uint256 indexed id,
        address indexed issuer,
        address indexed underlying,
        uint256 totalSupply
    );
    event LockTokenCancelled(uint256 indexed id);
    event TradingToggled(uint256 indexed id, bool enabled);
    event WiringSet(address settlement, address vault);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Wire registry to its settlement + vault. One-time, admin only.
    function setWiring(address _settlement, address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!wired, "Already wired");
        require(_settlement != address(0) && _vault != address(0), "Zero addr");
        settlement = _settlement;
        vault = _vault;
        wired = true;
        emit WiringSet(_settlement, _vault);
    }

    function registerLockToken(
        IERC20 underlying,
        uint256 totalSupply,
        VestingSchedule calldata vesting,
        uint256 listingPrice
    ) external onlyRole(ISSUER_ROLE) returns (uint256 lockId) {
        require(wired, "Not wired");
        require(address(underlying) != address(0), "Invalid underlying");
        require(totalSupply > 0, "Zero supply");
        require(vesting.vestingDuration > 0, "Invalid duration");
        require(vesting.cliffDuration <= vesting.vestingDuration, "Cliff > vesting");
        require(vesting.startTime >= block.timestamp, "Past startTime");

        lockId = nextLockId++;

        _lockTokens[lockId] = LockToken({
            id: lockId,
            issuer: msg.sender,
            underlying: underlying,
            totalSupply: totalSupply,
            vesting: vesting,
            listingPrice: listingPrice,
            tradingEnabled: false,
            cancelled: false
        });

        // Escrow the full underlying supply in the Vault (issuer must pre-approve Vault).
        ISolventLockVault(vault).acceptDeposit(lockId, underlying, totalSupply, msg.sender);

        // Record schedule + credit issuer's tradable lock balance in Settlement.
        ISolventLockSettlement(settlement).initLockToken(lockId, msg.sender, totalSupply, vesting);

        emit LockTokenRegistered(lockId, msg.sender, address(underlying), totalSupply);
    }

    function setTradingEnabled(uint256 lockId, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        LockToken storage t = _lockTokens[lockId];
        require(t.id != 0, "Unknown lock");
        require(!t.cancelled, "Cancelled");
        t.tradingEnabled = enabled;
        ISolventLockSettlement(settlement).setLockActive(lockId, enabled);
        emit TradingToggled(lockId, enabled);
    }

    function cancelLockToken(uint256 lockId) external {
        LockToken storage t = _lockTokens[lockId];
        require(t.id != 0, "Unknown lock");
        require(t.issuer == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(!t.cancelled, "Already cancelled");
        require(!t.tradingEnabled, "Disable trading first");
        t.cancelled = true;
        ISolventLockSettlement(settlement).setLockActive(lockId, false);
        emit LockTokenCancelled(lockId);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getLockToken(uint256 lockId) external view returns (LockToken memory) {
        return _lockTokens[lockId];
    }

    function getVesting(uint256 lockId) external view returns (VestingSchedule memory) {
        return _lockTokens[lockId].vesting;
    }

    function isTradable(uint256 lockId) external view returns (bool) {
        LockToken memory t = _lockTokens[lockId];
        return t.id != 0 && t.tradingEnabled && !t.cancelled;
    }
}
