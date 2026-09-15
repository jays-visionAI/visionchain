// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IVisionStableUSD is IERC20 {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function declareReserves(uint256 reserves) external;
}

/**
 * @title  SolventReserve — Phase-2 on-chain 1:1 USDT <-> vUSD reserve/redeemer.
 * @notice Enforces full backing: every vUSD minted here is collateralized by USDT
 *         custodied in this contract. Users mint vUSD by depositing USDT and redeem
 *         vUSD back to USDT, always 1:1 in value.
 *
 *         vUSD is 18-decimal; real USDT is typically 6-decimal. The value peg is 1:1,
 *         so amounts scale by SCALE = 10^(vUSDdec - USDTdec) (e.g. 1e12). This is the
 *         single boundary where the decimal difference is handled.
 *
 *         Requires this contract to hold MINTER_ROLE and ATTESTOR_ROLE on vUSD. On
 *         every mint/redeem it republishes declaredReserves = USDT held * SCALE, so
 *         vUSD's on-chain proof-of-reserves always equals real custody.
 */
contract SolventReserve is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IVisionStableUSD public immutable vusd;
    IERC20 public immutable usdt;
    uint256 public immutable scale; // vUSD units per 1 USDT unit (10^(18-6) = 1e12)

    event Minted(address indexed user, uint256 usdtIn, uint256 vusdOut);
    event Redeemed(address indexed user, uint256 vusdIn, uint256 usdtOut);
    event ReservesSynced(uint256 usdtHeld, uint256 backedVusd);

    constructor(address admin, IVisionStableUSD _vusd, IERC20 _usdt) {
        require(admin != address(0), "admin=0");
        uint8 vDec = IERC20Metadata(address(_vusd)).decimals();
        uint8 uDec = IERC20Metadata(address(_usdt)).decimals();
        require(vDec >= uDec, "vUSD decimals < USDT");
        vusd = _vusd;
        usdt = _usdt;
        scale = 10 ** (vDec - uDec);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// Deposit USDT, receive vUSD 1:1 (by value). Caller must approve USDT first.
    function mint(uint256 usdtAmount) external nonReentrant returns (uint256 vusdOut) {
        require(usdtAmount > 0, "zero");
        usdt.safeTransferFrom(msg.sender, address(this), usdtAmount);
        vusdOut = usdtAmount * scale;
        vusd.mint(msg.sender, vusdOut);
        _sync();
        emit Minted(msg.sender, usdtAmount, vusdOut);
    }

    /// Redeem vUSD back to USDT 1:1 (by value). Caller must approve vUSD to this contract.
    function redeem(uint256 vusdAmount) external nonReentrant returns (uint256 usdtOut) {
        require(vusdAmount > 0, "zero");
        require(vusdAmount % scale == 0, "non-integral USDT");
        usdtOut = vusdAmount / scale;
        require(usdt.balanceOf(address(this)) >= usdtOut, "reserve short");
        vusd.burnFrom(msg.sender, vusdAmount); // burns the caller's vUSD (needs allowance)
        usdt.safeTransfer(msg.sender, usdtOut);
        _sync();
        emit Redeemed(msg.sender, vusdAmount, usdtOut);
    }

    /// Republish vUSD's on-chain reserves = USDT held * scale (callable by anyone).
    function syncReserves() external {
        _sync();
    }

    function _sync() internal {
        uint256 held = usdt.balanceOf(address(this));
        uint256 backed = held * scale;
        // Best-effort: only the ATTESTOR_ROLE on vUSD may publish. If unset, skip.
        try vusd.declareReserves(backed) {} catch {}
        emit ReservesSynced(held, backed);
    }

    /// USDT currently custodied (real reserves backing minted-here vUSD).
    function usdtReserves() external view returns (uint256) {
        return usdt.balanceOf(address(this));
    }
}
