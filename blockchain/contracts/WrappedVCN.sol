// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title WrappedVCN (wVCN)
 * @dev Wrapped version of native VCN for use with ERC-20 compatible contracts.
 * 
 * Users can:
 * - deposit() native VCN to receive wVCN
 * - withdraw() wVCN to receive native VCN
 * 
 * This allows existing contracts that expect ERC-20 tokens to work with native VCN.
 */
contract WrappedVCN is ERC20, ERC20Burnable, ERC20Permit {
    
    event Deposit(address indexed account, uint256 amount);
    event Withdrawal(address indexed account, uint256 amount);

    constructor() 
        ERC20("Wrapped Vision Chain Token", "wVCN") 
        ERC20Permit("Wrapped Vision Chain Token")
    {}

    /**
     * @dev Deposit native VCN and receive wVCN
     */
    function deposit() public payable {
        require(msg.value > 0, "Must deposit non-zero amount");
        _mint(msg.sender, msg.value);
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev Withdraw native VCN by burning wVCN
     */
    function withdraw(uint256 amount) public {
        require(balanceOf(msg.sender) >= amount, "Insufficient wVCN balance");
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
        emit Withdrawal(msg.sender, amount);
    }

    /**
     * @dev Receive native VCN and auto-mint wVCN
     */
    receive() external payable {
        deposit();
    }
}
