// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title SolventPerp
 * @notice Cross-margin perpetual futures settlement for Solvent on Vision Chain.
 *
 *  Hybrid design (same family as DEXSettlement / SolventLockSettlement):
 *    - Off-chain engine matches orders and computes fills.
 *    - SETTLER_ROLE pushes matched fills via settleBatch (1 tx / cycle).
 *    - Mark price is posted by an oracle/settler; PnL and liquidation use it.
 *
 *  Accounting:
 *    - Collateral is a single quote token (USDT), cross-margin per account.
 *    - A position has signed size (long > 0, short < 0) and a weighted-average
 *      entry price. Reducing/closing realizes PnL into collateral.
 *    - equity = collateral + unrealizedPnL; an account is liquidatable when
 *      equity < maintenance margin requirement.
 *
 *  MVP scope (documented intentionally): single oracle mark price, no funding
 *  accrual curve (funding applied externally via applyFunding), no insurance
 *  fund / ADL, linear maintenance margin. Production needs those before real
 *  money. The position math and liquidation gate are the load-bearing parts
 *  and are unit-tested.
 */
contract SolventPerp is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    int256 private constant ONE = 1e18;

    IERC20 public immutable collateralToken;
    address public feeCollector;

    struct Market {
        uint256 markPrice;          // 1e18, quote per 1 base
        uint32 maintenanceMarginBps; // e.g. 500 = 5%
        uint32 initialMarginBps;     // e.g. 1000 = 10% (=> 10x max leverage)
        bool active;
    }

    struct Position {
        int256 size;       // signed base size, 1e18 (long > 0, short < 0)
        uint256 entryPrice; // 1e18 weighted-average entry
    }

    mapping(address => uint256) public collateral;                 // free collateral (quote)
    mapping(uint256 => Market) public markets;                     // marketId => params
    mapping(uint256 => mapping(address => Position)) public positions; // marketId => trader => pos

    uint256 public lastSettlementRound;
    uint256 public totalTradesSettled;

    struct PerpTrade {
        uint256 marketId;
        address buyer;     // goes long (+size)
        address seller;    // goes short (-size)
        uint256 size;      // base size, 1e18
        uint256 price;     // execution price, 1e18
        uint256 buyerFee;  // quote
        uint256 sellerFee; // quote
    }

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event MarketConfigured(uint256 indexed marketId, uint32 maintenanceMarginBps, uint32 initialMarginBps);
    event MarkPriceSet(uint256 indexed marketId, uint256 price);
    event PositionChanged(uint256 indexed marketId, address indexed trader, int256 newSize, uint256 entryPrice, int256 realizedPnl);
    event BatchSettled(uint256 indexed round, uint256 tradeCount);
    event Liquidated(uint256 indexed marketId, address indexed trader, address indexed liquidator, int256 sizeClosed, int256 realizedPnl);
    event FundingApplied(uint256 indexed marketId, address indexed trader, int256 amount);

    constructor(address admin, address settler, address oracle, IERC20 _collateral, address _feeCollector) {
        require(address(_collateral) != address(0) && _feeCollector != address(0), "Zero addr");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, settler);
        _grantRole(ORACLE_ROLE, oracle);
        collateralToken = _collateral;
        feeCollector = _feeCollector;
    }

    // ── Admin / oracle ──────────────────────────────────────────────────────────

    function configureMarket(uint256 marketId, uint32 maintenanceMarginBps, uint32 initialMarginBps)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(maintenanceMarginBps > 0 && maintenanceMarginBps < initialMarginBps, "Bad margins");
        require(initialMarginBps <= 10_000, "IM too high");
        Market storage m = markets[marketId];
        m.maintenanceMarginBps = maintenanceMarginBps;
        m.initialMarginBps = initialMarginBps;
        m.active = true;
        emit MarketConfigured(marketId, maintenanceMarginBps, initialMarginBps);
    }

    function setMarkPrice(uint256 marketId, uint256 price) external onlyRole(ORACLE_ROLE) {
        require(markets[marketId].active, "Inactive market");
        require(price > 0, "Zero price");
        markets[marketId].markPrice = price;
        emit MarkPriceSet(marketId, price);
    }

    function setFeeCollector(address _feeCollector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeCollector != address(0), "Zero addr");
        feeCollector = _feeCollector;
    }

    // ── Collateral ────────────────────────────────────────────────────────────────

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        collateral[msg.sender] += amount;
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Withdraw free collateral. Blocked if it would breach initial margin
    ///         on any held position (checked per-market the caller still has open).
    function withdraw(uint256 amount, uint256[] calldata heldMarkets) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(collateral[msg.sender] >= amount, "Insufficient collateral");
        collateral[msg.sender] -= amount;
        // Ensure still initial-margin-solvent across the markets the caller declares.
        for (uint256 i = 0; i < heldMarkets.length; i++) {
            require(_meetsInitialMargin(heldMarkets[i], msg.sender), "Would breach margin");
        }
        collateralToken.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    // ── Settlement ──────────────────────────────────────────────────────────────────

    function settleBatch(uint256 round, PerpTrade[] calldata trades) external onlyRole(SETTLER_ROLE) {
        require(round > lastSettlementRound, "Round settled");
        require(trades.length > 0 && trades.length <= 200, "Bad batch size");

        for (uint256 i = 0; i < trades.length; i++) {
            PerpTrade calldata t = trades[i];
            require(markets[t.marketId].active, "Inactive market");
            require(t.size > 0 && t.price > 0, "Bad trade");

            // Fees first (debit from collateral, credit collector).
            _chargeFee(t.buyer, t.buyerFee);
            _chargeFee(t.seller, t.sellerFee);

            // Buyer goes long (+), seller goes short (-).
            _applyFill(t.marketId, t.buyer, int256(t.size), t.price);
            _applyFill(t.marketId, t.seller, -int256(t.size), t.price);

            // Both sides must satisfy initial margin after the fill.
            require(_meetsInitialMargin(t.marketId, t.buyer), "Buyer IM");
            require(_meetsInitialMargin(t.marketId, t.seller), "Seller IM");
        }

        lastSettlementRound = round;
        totalTradesSettled += trades.length;
        emit BatchSettled(round, trades.length);
    }

    /// @notice Apply an externally-computed funding payment (signed) to a trader.
    ///         Positive credits the trader; negative debits. Settler-driven for MVP.
    function applyFunding(uint256 marketId, address trader, int256 amount) external onlyRole(SETTLER_ROLE) {
        if (amount > 0) {
            collateral[trader] += uint256(amount);
        } else if (amount < 0) {
            uint256 debit = uint256(-amount);
            collateral[trader] = collateral[trader] > debit ? collateral[trader] - debit : 0;
        }
        emit FundingApplied(marketId, trader, amount);
    }

    // ── Liquidation ────────────────────────────────────────────────────────────────

    /// @notice Liquidate an underwater account: close its position at mark price,
    ///         realize PnL, and reward the liquidator from remaining collateral.
    function liquidate(uint256 marketId, address trader) external nonReentrant {
        Market storage m = markets[marketId];
        require(m.active, "Inactive market");
        require(!_meetsMaintenanceMargin(marketId, trader), "Not liquidatable");

        Position storage p = positions[marketId][trader];
        int256 sizeClosed = p.size;
        require(sizeClosed != 0, "No position");

        // Realize PnL by closing the whole position at mark.
        int256 realized = _pnl(sizeClosed, p.entryPrice, m.markPrice);
        _creditPnl(trader, realized);
        p.size = 0;
        p.entryPrice = 0;

        // Liquidation penalty: take up to maintenance requirement from trader, to liquidator.
        uint256 notional = _absNotional(sizeClosed, m.markPrice);
        uint256 penalty = (notional * m.maintenanceMarginBps) / 10_000;
        uint256 take = collateral[trader] < penalty ? collateral[trader] : penalty;
        collateral[trader] -= take;
        collateral[msg.sender] += take;

        emit Liquidated(marketId, trader, msg.sender, sizeClosed, realized);
        emit PositionChanged(marketId, trader, 0, 0, realized);
    }

    // ── Internal: position math ──────────────────────────────────────────────────────

    function _applyFill(uint256 marketId, address trader, int256 delta, uint256 price) internal {
        Position storage p = positions[marketId][trader];
        int256 s = p.size;
        int256 realized = 0;

        if (s == 0) {
            p.size = delta;
            p.entryPrice = price;
        } else if ((s > 0) == (delta > 0)) {
            // Increasing same direction: weighted-average entry.
            uint256 absS = _abs(s);
            uint256 absD = _abs(delta);
            p.entryPrice = (absS * p.entryPrice + absD * price) / (absS + absD);
            p.size = s + delta;
        } else {
            // Opposing: reduce/close/flip. Realize PnL on the closed portion.
            uint256 absS = _abs(s);
            uint256 absD = _abs(delta);
            uint256 closeQty = absD < absS ? absD : absS;
            realized = _pnl(s > 0 ? int256(closeQty) : -int256(closeQty), p.entryPrice, price);
            _creditPnl(trader, realized);

            if (absD < absS) {
                p.size = s + delta;          // partial close, entry unchanged
            } else if (absD == absS) {
                p.size = 0;
                p.entryPrice = 0;            // fully closed
            } else {
                p.size = s + delta;          // flipped to opposite side
                p.entryPrice = price;        // new entry for the residual
            }
        }
        emit PositionChanged(marketId, trader, p.size, p.entryPrice, realized);
    }

    /// @dev Signed PnL for closing `size` opened at `entry`, marked at `mark`.
    function _pnl(int256 size, uint256 entry, uint256 mark) internal pure returns (int256) {
        // long: (mark - entry) * size ; short handled by sign of size.
        return (size * (int256(mark) - int256(entry))) / ONE;
    }

    function _creditPnl(address trader, int256 realized) internal {
        if (realized > 0) {
            collateral[trader] += uint256(realized);
        } else if (realized < 0) {
            uint256 loss = uint256(-realized);
            collateral[trader] = collateral[trader] > loss ? collateral[trader] - loss : 0;
        }
    }

    function _chargeFee(address trader, uint256 fee) internal {
        if (fee == 0) return;
        require(collateral[trader] >= fee, "Insufficient for fee");
        collateral[trader] -= fee;
        collateral[feeCollector] += fee;
    }

    // ── Internal: margin checks ────────────────────────────────────────────────────

    function _equity(uint256 marketId, address trader) internal view returns (int256) {
        Position storage p = positions[marketId][trader];
        int256 upnl = p.size == 0 ? int256(0) : _pnl(p.size, p.entryPrice, markets[marketId].markPrice);
        return int256(collateral[trader]) + upnl;
    }

    function _meetsInitialMargin(uint256 marketId, address trader) internal view returns (bool) {
        Position storage p = positions[marketId][trader];
        if (p.size == 0) return true;
        uint256 req = (_absNotional(p.size, markets[marketId].markPrice) * markets[marketId].initialMarginBps) / 10_000;
        int256 eq = _equity(marketId, trader);
        return eq >= int256(req);
    }

    function _meetsMaintenanceMargin(uint256 marketId, address trader) internal view returns (bool) {
        Position storage p = positions[marketId][trader];
        if (p.size == 0) return true;
        uint256 req = (_absNotional(p.size, markets[marketId].markPrice) * markets[marketId].maintenanceMarginBps) / 10_000;
        int256 eq = _equity(marketId, trader);
        return eq >= int256(req);
    }

    function _absNotional(int256 size, uint256 price) internal pure returns (uint256) {
        return (_abs(size) * price) / uint256(ONE);
    }

    function _abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    // ── Views ──────────────────────────────────────────────────────────────────────

    function getPosition(uint256 marketId, address trader) external view returns (int256 size, uint256 entryPrice) {
        Position storage p = positions[marketId][trader];
        return (p.size, p.entryPrice);
    }

    function equity(uint256 marketId, address trader) external view returns (int256) {
        return _equity(marketId, trader);
    }

    function isLiquidatable(uint256 marketId, address trader) external view returns (bool) {
        return !_meetsMaintenanceMargin(marketId, trader);
    }
}
