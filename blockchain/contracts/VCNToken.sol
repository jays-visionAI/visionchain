// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VCNToken
 */
contract VCNToken is ERC20, ERC20Burnable, ERC20Permit, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 10**18;

    constructor(address defaultAdmin, address initialMinter)
        ERC20("Vision Chain Token", "VCN")
        ERC20Permit("Vision Chain Token")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(MINTER_ROLE, initialMinter);

        _mint(defaultAdmin, 4_000_000_000 * 10**18);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "VCN: Max supply exceeded");
        _mint(to, amount);
    }
}
