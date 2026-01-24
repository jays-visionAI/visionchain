// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VisionProfileRegistry
 * @dev Stores user identities (VNS) and their settlement preferences.
 * AI Agents query this contract to resolve "Who" needs "What" on "Which Chain".
 */
contract VisionProfileRegistry is Ownable {
    
    struct Profile {
        address walletAddress;
        uint256 preferredChainId; // e.g. 1 (ETH), 137 (Polygon), 1337 (Vision)
        address preferredToken;   // e.g. 0x... (USDC)
        bool exists;
    }

    // Mapping: "jays" -> Profile
    mapping(string => Profile) public profiles;
    
    // Reverse mapping: Address -> "jays"
    mapping(address => string) public primaryHandle;

    event ProfileRegistered(string handle, address indexed wallet, uint256 chainId, address token);
    event ProfileUpdated(string handle, uint256 chainId, address token);

    constructor() {}

    /**
     * @dev Registers a new Vision ID (VID). 
     * Simple first-come-first-serve logic for demo.
     */
    function registerProfile(
        string calldata handle, 
        uint256 chainId, 
        address token
    ) external {
        require(bytes(handle).length > 2, "Handle too short");
        require(!profiles[handle].exists, "Handle already taken");
        require(bytes(primaryHandle[msg.sender]).length == 0, "Address already has a handle");

        profiles[handle] = Profile({
            walletAddress: msg.sender,
            preferredChainId: chainId,
            preferredToken: token,
            exists: true
        });

        primaryHandle[msg.sender] = handle;
        
        emit ProfileRegistered(handle, msg.sender, chainId, token);
    }

    /**
     * @dev Updates settlement preferences.
     * Only the owner of the handle can update it.
     */
    function updatePreference(uint256 chainId, address token) external {
        string memory handle = primaryHandle[msg.sender];
        require(bytes(handle).length > 0, "No profile found");

        profiles[handle].preferredChainId = chainId;
        profiles[handle].preferredToken = token;

        emit ProfileUpdated(handle, chainId, token);
    }

    /**
     * @dev Resolves a handle to its full settlement details.
     */
    function getProfile(string calldata handle) external view returns (Profile memory) {
        require(profiles[handle].exists, "Profile does not exist");
        return profiles[handle];
    }
}
