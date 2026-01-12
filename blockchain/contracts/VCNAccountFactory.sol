// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./VCNAccount.sol";

/**
 * @title VCNAccountFactory
 * @dev Factory for creating VCNAccount proxies.
 */
contract VCNAccountFactory {
    VCNAccount public immutable accountImplementation;

    constructor(IEntryPoint _entryPoint) {
        accountImplementation = new VCNAccount(_entryPoint);
    }

    function createAccount(address owner, uint256 salt) public returns (VCNAccount) {
        address addr = getAddress(owner, salt);
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return VCNAccount(payable(addr));
        }
        
        ERC1967Proxy proxy = new ERC1967Proxy{salt: bytes32(salt)}(
            address(accountImplementation),
            abi.encodeCall(VCNAccount.initialize, (owner))
        );
        return VCNAccount(payable(address(proxy)));
    }

    function getAddress(address owner, uint256 salt) public view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(abi.encodePacked(
                type(ERC1967Proxy).creationCode,
                abi.encode(address(accountImplementation), abi.encodeCall(VCNAccount.initialize, (owner)))
            ))
        )))));
    }
}
