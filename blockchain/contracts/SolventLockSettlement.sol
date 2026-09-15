// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import { VestingSchedule } from "./SolventLockRegistry.sol";

interface ISolventLockVault {
    function release(uint256 lockId, address to, uint256 amount) external;
}

/**
 * @title SolventLockSettlement
 * @notice Hybrid OTC settlement + linear-vesting ledger for the Solvent Lock market.
 *
 *  Mirrors VisionDEX's DEXSettlement pattern: off-chain price-time matching, then
 *  one batch settlement tx per cycle. Lock balances are an internal ledger; the
 *  quote token (USDT) side settles here too.
 *
 *  ── Vesting accounting (Synthetix-style crystallization) ──────────────────────
 *  A lock token vests linearly to 1 underlying. The naive `balance * f` model
 *  double-counts when balances move on the secondary market (a seller and a later
 *  buyer would both claim the same vested slice). Instead, on EVERY balance change
 *  (buy, sell, claim) we crystallize the holder's accrued entitlement at the
 *  current vested fraction and reset their checkpoint:
 *
 *      accrued[u] += lockBalance[u] * (f(now) - checkpointF[u]) / 1e18
 *      checkpointF[u] = f(now)
 *
 *  This conserves total underlying released (<= totalSupply) regardless of how
 *  tokens are traded mid-vest. `claim()` withdraws `accrued` and zeroes it.
 */
contract SolventLockSettlement is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    bytes32 public constant REGISTRY_ROLE = keccak256("REGISTRY_ROLE");

    uint256 private constant ONE = 1e18; // fixed-point scale for vested fraction

    IERC20 public immutable quoteToken; // USDT
    address public vault;
    address public feeCollector;

    struct LockInfo {
        VestingSchedule vesting;
        uint256 totalSupply;
        bool initialized;
        bool active; // trading allowed (synced from registry)
    }

    // lockId => static lock info
    mapping(uint256 => LockInfo) public lockInfo;

    // user => lockId => tradable lock balance
    mapping(address => mapping(uint256 => uint256)) public lockBalance;
    // user => lockId => crystallized underlying entitlement, not yet withdrawn
    mapping(address => mapping(uint256 => uint256)) public accrued;
    // user => lockId => vested fraction (1e18) at last balance change
    mapping(address => mapping(uint256 => uint256)) public checkpointF;

    // user => quote-token internal balance
    mapping(address => uint256) public quoteBalance;

    // round bookkeeping
    uint256 public lastSettlementRound;
    uint256 public totalSettlements;
    uint256 public totalTradesSettled;

    struct LockTrade {
        address buyer;
        address seller;
        uint256 lockId;
        uint256 lockAmount;    // lock units transferred seller -> buyer (1e18 scale)
        uint256 quoteAmount;   // USDT buyer -> seller
        uint256 buyerFee;      // taker fee in quote
        uint256 sellerFee;     // maker fee in quote
    }

    event Deposited(address indexed user, uint256 indexed lockId, uint256 amount);
    event Withdrawn(address indexed user, uint256 indexed lockId, uint256 amount);
    event QuoteDeposited(address indexed user, uint256 amount);
    event QuoteWithdrawn(address indexed user, uint256 amount);
    event BatchSettled(uint256 indexed round, uint256 tradeCount, uint256 timestamp);
    event TradeSettled(
        uint256 indexed round,
        uint256 indexed lockId,
        address indexed buyer,
        address seller,
        uint256 lockAmount,
        uint256 quoteAmount
    );
    event Claimed(address indexed user, uint256 indexed lockId, uint256 underlyingAmount);
    event LockInitialized(uint256 indexed lockId, address indexed issuer, uint256 totalSupply);

    constructor(address admin, address settler, IERC20 _quoteToken, address _feeCollector) {
        require(address(_quoteToken) != address(0) && _feeCollector != address(0), "Zero addr");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, settler);
        quoteToken = _quoteToken;
        feeCollector = _feeCollector;
    }

    function setVault(address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_vault != address(0), "Zero addr");
        vault = _vault;
    }

    /// @notice Registry contract is granted REGISTRY_ROLE so it can init tokens / toggle activity.
    function grantRegistry(address registry) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(REGISTRY_ROLE, registry);
    }

    function setFeeCollector(address _feeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeCollector != address(0), "Zero addr");
        feeCollector = _feeCollector;
    }

    // ── Registry hooks ─────────────────────────────────────────────────────────

    function initLockToken(
        uint256 lockId,
        address issuer,
        uint256 totalSupply,
        VestingSchedule calldata vesting
    ) external onlyRole(REGISTRY_ROLE) {
        LockInfo storage info = lockInfo[lockId];
        require(!info.initialized, "Already init");
        info.vesting = vesting;
        info.totalSupply = totalSupply;
        info.initialized = true;
        info.active = false;

        // Credit issuer with the full tradable supply. checkpoint at f(now)=0 (pre-TGE).
        checkpointF[issuer][lockId] = vestedFraction(lockId);
        lockBalance[issuer][lockId] = totalSupply;

        emit LockInitialized(lockId, issuer, totalSupply);
    }

    function setLockActive(uint256 lockId, bool active) external onlyRole(REGISTRY_ROLE) {
        require(lockInfo[lockId].initialized, "Unknown lock");
        lockInfo[lockId].active = active;
    }

    // ── Quote deposits/withdrawals (USDT) ────────────────────────────────────────

    function depositQuote(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        quoteToken.safeTransferFrom(msg.sender, address(this), amount);
        quoteBalance[msg.sender] += amount;
        emit QuoteDeposited(msg.sender, amount);
    }

    /// @notice Gasless deposit. `owner` signs an EIP-2612 permit off-chain (no gas, no
    ///         on-chain tx needed by the user — e.g. a signature-only Vision wallet); a
    ///         relayer paying gas submits this. Funds are pulled from and credited to
    ///         `owner` only, so a relayer can never divert them. Front-run safe: if the
    ///         permit nonce was already consumed (someone replayed the permit), we still
    ///         proceed as long as the resulting allowance covers `amount`.
    function depositQuoteWithPermit(
        address owner,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(amount > 0, "Zero amount");
        try IERC20Permit(address(quoteToken)).permit(owner, address(this), amount, deadline, v, r, s) {} catch {}
        quoteToken.safeTransferFrom(owner, address(this), amount);
        quoteBalance[owner] += amount;
        emit QuoteDeposited(owner, amount);
    }

    function withdrawQuote(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(quoteBalance[msg.sender] >= amount, "Insufficient quote");
        quoteBalance[msg.sender] -= amount;
        quoteToken.safeTransfer(msg.sender, amount);
        emit QuoteWithdrawn(msg.sender, amount);
    }

    // ── Lock balance withdrawal (transfer to own custody is N/A; lock units only
    //    exist as internal entitlement — there is no external lock ERC20. Holders
    //    realize value by claiming underlying after vest, or selling on the book.) ─

    // ── Batch settlement ─────────────────────────────────────────────────────────

    function settleBatch(uint256 round, LockTrade[] calldata trades)
        external
        onlyRole(SETTLER_ROLE)
    {
        require(round > lastSettlementRound, "Round already settled");
        require(trades.length > 0, "Empty batch");
        require(trades.length <= 200, "Batch too large");

        for (uint256 i = 0; i < trades.length; i++) {
            LockTrade calldata t = trades[i];
            LockInfo storage info = lockInfo[t.lockId];
            require(info.initialized && info.active, "Lock not active");

            uint256 buyerCost = t.quoteAmount + t.buyerFee;
            require(quoteBalance[t.buyer] >= buyerCost, "Buyer insufficient quote");
            require(lockBalance[t.seller][t.lockId] >= t.lockAmount, "Seller insufficient lock");

            // Crystallize vesting for both sides BEFORE moving lock balances.
            uint256 f = vestedFraction(t.lockId);
            _crystallize(t.seller, t.lockId, f);
            _crystallize(t.buyer, t.lockId, f);

            // Quote side: buyer pays quote + fee, seller receives quote - fee.
            quoteBalance[t.buyer] -= buyerCost;
            quoteBalance[t.seller] += (t.quoteAmount - t.sellerFee);

            // Lock side: seller -> buyer.
            lockBalance[t.seller][t.lockId] -= t.lockAmount;
            lockBalance[t.buyer][t.lockId] += t.lockAmount;

            uint256 totalFee = t.buyerFee + t.sellerFee;
            if (totalFee > 0) {
                quoteBalance[feeCollector] += totalFee;
            }

            emit TradeSettled(round, t.lockId, t.buyer, t.seller, t.lockAmount, t.quoteAmount);
        }

        lastSettlementRound = round;
        totalSettlements++;
        totalTradesSettled += trades.length;
        emit BatchSettled(round, trades.length, block.timestamp);
    }

    // ── Claim vested underlying ──────────────────────────────────────────────────

    function claim(uint256 lockId) external nonReentrant returns (uint256 amount) {
        require(lockInfo[lockId].initialized, "Unknown lock");
        require(vault != address(0), "Vault unset");

        _crystallize(msg.sender, lockId, vestedFraction(lockId));
        amount = accrued[msg.sender][lockId];
        require(amount > 0, "Nothing to claim");
        accrued[msg.sender][lockId] = 0;

        ISolventLockVault(vault).release(lockId, msg.sender, amount);
        emit Claimed(msg.sender, lockId, amount);
    }

    // ── Vesting math ─────────────────────────────────────────────────────────────

    /// @notice Vested fraction in 1e18 fixed point (0..1e18) for a lock token.
    function vestedFraction(uint256 lockId) public view returns (uint256) {
        VestingSchedule memory v = lockInfo[lockId].vesting;
        if (block.timestamp < v.startTime) return 0;
        uint256 elapsed = block.timestamp - v.startTime;
        if (elapsed < v.cliffDuration) return 0;
        if (elapsed >= v.vestingDuration) return ONE;
        return (elapsed * ONE) / v.vestingDuration;
    }

    /// @dev Lock in accrued entitlement at fraction f, then move checkpoint to f.
    function _crystallize(address user, uint256 lockId, uint256 f) internal {
        uint256 cp = checkpointF[user][lockId];
        if (f > cp) {
            uint256 bal = lockBalance[user][lockId];
            if (bal > 0) {
                accrued[user][lockId] += (bal * (f - cp)) / ONE;
            }
            checkpointF[user][lockId] = f;
        }
    }

    // ── Views ──────────────────────────────────────────────────────────────────

    /// @notice Underlying currently claimable by `user` for `lockId`.
    function claimable(address user, uint256 lockId) external view returns (uint256) {
        uint256 f = vestedFraction(lockId);
        uint256 cp = checkpointF[user][lockId];
        uint256 pending = accrued[user][lockId];
        if (f > cp) {
            pending += (lockBalance[user][lockId] * (f - cp)) / ONE;
        }
        return pending;
    }

    function getLockBalance(address user, uint256 lockId) external view returns (uint256) {
        return lockBalance[user][lockId];
    }

    function getStats() external view returns (uint256 round, uint256 settlements, uint256 trades) {
        return (lastSettlementRound, totalSettlements, totalTradesSettled);
    }
}
