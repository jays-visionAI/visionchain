// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DEXSettlement
 * @notice Hybrid DEX: off-chain matching, on-chain batch settlement.
 *
 * Flow:
 *   1. Users deposit tokens into this contract
 *   2. Off-chain engine matches orders (fast, no latency)
 *   3. Engine admin calls settleBatch() once per cycle (~1 min)
 *   4. Users withdraw tokens at any time
 *
 * No Paymaster - admin wallet pays gas for settlement.
 * 
 * Gas optimization: all token movements happen within internal
 * balance mappings, no external ERC20 transfers during settlement.
 */
contract DEXSettlement is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    // user => token => balance (internal ledger)
    mapping(address => mapping(address => uint256)) public balances;

    // fee collector
    address public feeCollector;

    // settlement round tracking
    uint256 public lastSettlementRound;
    uint256 public totalSettlements;
    uint256 public totalTradesSettled;

    struct Trade {
        address buyer;
        address seller;
        address baseToken;   // VCN
        address quoteToken;  // USDT
        uint256 baseAmount;  // VCN amount transferred seller -> buyer
        uint256 quoteAmount; // USDT amount transferred buyer -> seller
        uint256 buyerFee;    // taker fee in quoteToken
        uint256 sellerFee;   // maker fee in quoteToken
    }

    // Events
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event BatchSettled(uint256 indexed round, uint256 tradeCount, uint256 timestamp);
    event TradeSettled(
        uint256 indexed round,
        address indexed buyer,
        address indexed seller,
        uint256 baseAmount,
        uint256 quoteAmount
    );

    constructor(address admin, address settler, address _feeCollector) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SETTLER_ROLE, settler);
        feeCollector = _feeCollector;
    }

    // ── Deposit ────────────────────────────────────────────────────────────

    /**
     * @notice Deposit ERC20 tokens into the DEX
     * @param token ERC20 token address
     * @param amount Amount to deposit (in token's smallest unit)
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token] += amount;
        emit Deposited(msg.sender, token, amount);
    }

    /**
     * @notice Admin deposits on behalf of a user (for agent setup)
     * @param user Beneficiary address
     * @param token ERC20 token address
     * @param amount Amount to deposit
     */
    function depositFor(address user, address token, uint256 amount)
        external
        nonReentrant
        onlyRole(SETTLER_ROLE)
    {
        require(amount > 0, "Zero amount");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[user][token] += amount;
        emit Deposited(user, token, amount);
    }

    // ── Withdraw ───────────────────────────────────────────────────────────

    /**
     * @notice Withdraw tokens from the DEX
     * @param token ERC20 token address
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(balances[msg.sender][token] >= amount, "Insufficient balance");
        balances[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    // ── Batch Settlement ───────────────────────────────────────────────────

    /**
     * @notice Settle a batch of trades in one transaction.
     *         Only callable by SETTLER_ROLE (engine admin).
     *         All movements happen within internal balances (no ERC20 transfers).
     *
     * @param round The settlement round number
     * @param trades Array of trades to settle
     */
    function settleBatch(uint256 round, Trade[] calldata trades)
        external
        onlyRole(SETTLER_ROLE)
    {
        require(round > lastSettlementRound, "Round already settled");
        require(trades.length > 0, "Empty batch");
        require(trades.length <= 200, "Batch too large");

        for (uint256 i = 0; i < trades.length; i++) {
            Trade calldata t = trades[i];

            // Buyer pays quoteAmount + buyerFee, receives baseAmount
            uint256 buyerQuoteCost = t.quoteAmount + t.buyerFee;
            require(
                balances[t.buyer][t.quoteToken] >= buyerQuoteCost,
                "Buyer insufficient quote"
            );

            // Seller pays baseAmount, receives quoteAmount - sellerFee
            require(
                balances[t.seller][t.baseToken] >= t.baseAmount,
                "Seller insufficient base"
            );

            // Execute internal transfers
            // Buyer: -quoteAmount-fee, +baseAmount
            balances[t.buyer][t.quoteToken] -= buyerQuoteCost;
            balances[t.buyer][t.baseToken] += t.baseAmount;

            // Seller: -baseAmount, +quoteAmount-fee
            balances[t.seller][t.baseToken] -= t.baseAmount;
            balances[t.seller][t.quoteToken] += (t.quoteAmount - t.sellerFee);

            // Fees to collector
            uint256 totalFee = t.buyerFee + t.sellerFee;
            if (totalFee > 0) {
                balances[feeCollector][t.quoteToken] += totalFee;
            }

            emit TradeSettled(round, t.buyer, t.seller, t.baseAmount, t.quoteAmount);
        }

        lastSettlementRound = round;
        totalSettlements++;
        totalTradesSettled += trades.length;

        emit BatchSettled(round, trades.length, block.timestamp);
    }

    // ── Admin ──────────────────────────────────────────────────────────────

    function setFeeCollector(address _feeCollector)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        feeCollector = _feeCollector;
    }

    /**
     * @notice Credit internal balance without actual token transfer.
     *         Used for initial agent setup with virtual balances.
     *         Tokens must be pre-funded to the contract separately.
     */
    function creditBalance(address user, address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        balances[user][token] += amount;
    }

    // ── View ───────────────────────────────────────────────────────────────

    function getBalance(address user, address token)
        external
        view
        returns (uint256)
    {
        return balances[user][token];
    }

    function getStats()
        external
        view
        returns (uint256 round, uint256 settlements, uint256 trades)
    {
        return (lastSettlementRound, totalSettlements, totalTradesSettled);
    }
}
