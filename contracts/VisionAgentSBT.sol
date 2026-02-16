// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VisionAgentSBT
 * @dev EIP-5192 compliant SoulBound Token for Vision Chain AI Agent identity.
 * Each agent gets a non-transferable NFT that binds their name and wallet on-chain.
 * 
 * Key features:
 * - Non-transferable (SoulBound): _update() override blocks all transfers
 * - EIP-5192 Locked interface: locked() always returns true
 * - On-chain metadata: tokenURI() returns base64-encoded JSON (no IPFS needed)
 * - Minter-restricted: only authorized minters can mint
 * - Name uniqueness: prevents duplicate agent names
 */
contract VisionAgentSBT is ERC721, Ownable {
    // === Events (EIP-5192) ===
    event Locked(uint256 tokenId);
    event Revoked(uint256 indexed tokenId, string agentName);

    // === State ===
    uint256 private _nextTokenId;

    struct AgentInfo {
        string agentName;
        string platform;
        uint256 mintedAt;
    }

    // tokenId => AgentInfo
    mapping(uint256 => AgentInfo) public agentInfo;
    // wallet => tokenId (one SBT per wallet)
    mapping(address => uint256) public agentTokenOf;
    // nameHash => exists (prevent duplicates)
    mapping(bytes32 => bool) public nameExists;
    // authorized minters
    mapping(address => bool) public isMinter;
    // revoked tokens (agent deleted but on-chain record preserved)
    mapping(uint256 => bool) public revoked;

    // === Errors ===
    error SoulBound();
    error NotMinter();
    error AgentNameTaken();
    error AlreadyHasSBT();
    error EmptyName();
    error AlreadyRevoked();
    error TokenNotExists();

    // === Modifiers ===
    modifier onlyMinter() {
        if (!isMinter[msg.sender] && msg.sender != owner()) revert NotMinter();
        _;
    }

    constructor() ERC721("Vision Agent Identity", "VASBT") Ownable(msg.sender) {
        _nextTokenId = 1; // Start from 1, 0 means "no SBT"
        isMinter[msg.sender] = true;
    }

    /**
     * @dev Mints a SoulBound Token to an agent wallet.
     * @param to Agent wallet address
     * @param agentName Agent name (must be unique)
     * @param platform Platform identifier (e.g. "telegram", "discord", "api")
     * @return tokenId The minted token ID
     */
    function mintAgentIdentity(
        address to,
        string calldata agentName,
        string calldata platform
    ) external onlyMinter returns (uint256) {
        if (bytes(agentName).length == 0) revert EmptyName();
        if (agentTokenOf[to] != 0) revert AlreadyHasSBT();

        bytes32 nameHash = keccak256(abi.encodePacked(_toLower(agentName)));
        if (nameExists[nameHash]) revert AgentNameTaken();

        uint256 tokenId = _nextTokenId++;
        nameExists[nameHash] = true;
        agentTokenOf[to] = tokenId;
        agentInfo[tokenId] = AgentInfo({
            agentName: agentName,
            platform: platform,
            mintedAt: block.timestamp
        });

        _safeMint(to, tokenId);

        // EIP-5192: emit Locked immediately after mint
        emit Locked(tokenId);

        return tokenId;
    }

    /**
     * @dev EIP-5192: Returns lock status. Always true for SBTs.
     */
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /**
     * @dev Override _update to prevent any transfers (except mint).
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow mint (from == address(0)), block transfer and burn
        if (from != address(0)) revert SoulBound();
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev On-chain tokenURI — returns base64 JSON metadata.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        AgentInfo memory info = agentInfo[tokenId];

        string memory json = string(abi.encodePacked(
            '{"name":"Agent: ', info.agentName,
            '","description":"Vision Chain AI Agent SoulBound Identity Token (EIP-5192)",',
            '"attributes":[',
            '{"trait_type":"Agent Name","value":"', info.agentName, '"},',
            '{"trait_type":"Platform","value":"', info.platform, '"},',
            '{"trait_type":"Minted At","display_type":"date","value":', _uint2str(info.mintedAt), '},',
            '{"trait_type":"SoulBound","value":"true"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            _base64Encode(bytes(json))
        ));
    }

    /**
     * @dev Get agent info by wallet address.
     */
    function getAgentByAddress(address wallet) external view returns (
        uint256 tokenId,
        string memory agentName,
        string memory platform,
        uint256 mintedAt
    ) {
        tokenId = agentTokenOf[wallet];
        if (tokenId == 0) return (0, "", "", 0);
        AgentInfo memory info = agentInfo[tokenId];
        return (tokenId, info.agentName, info.platform, info.mintedAt);
    }

    /**
     * @dev Total number of SBTs minted.
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @dev EIP-165 supportsInterface: add EIP-5192 interface ID.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // EIP-5192 interface ID = 0xb45a3c0e
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    // === Admin ===

    function setMinter(address minter, bool allowed) external onlyOwner {
        isMinter[minter] = allowed;
    }

    /**
     * @dev Revokes an agent's SBT. Token stays on-chain but is marked as invalid.
     * Used when an agent is deleted — preserves on-chain history.
     * @param tokenId The token ID to revoke
     */
    function revokeIdentity(uint256 tokenId) external onlyMinter {
        if (tokenId == 0 || tokenId >= _nextTokenId) revert TokenNotExists();
        if (revoked[tokenId]) revert AlreadyRevoked();
        revoked[tokenId] = true;
        AgentInfo memory info = agentInfo[tokenId];
        emit Revoked(tokenId, info.agentName);
    }

    /**
     * @dev Check if a token has been revoked.
     */
    function isRevoked(uint256 tokenId) external view returns (bool) {
        return revoked[tokenId];
    }

    // === Internal Helpers ===

    function _toLower(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bLower = new bytes(bStr.length);
        for (uint256 i = 0; i < bStr.length; i++) {
            if (bStr[i] >= 0x41 && bStr[i] <= 0x5A) {
                bLower[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLower[i] = bStr[i];
            }
        }
        return string(bLower);
    }

    function _uint2str(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        bytes memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen + 32);
        bytes memory table = TABLE;

        assembly {
            let tablePtr := add(table, 1)
            let resultPtr := add(result, 32)
            for { let i := 0 } lt(i, mload(data)) { } {
                i := add(i, 3)
                let input := and(mload(add(data, i)), 0xffffff)
                let out := mload(add(tablePtr, and(shr(18, input), 0x3F)))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(12, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(shr(6, input), 0x3F))), 0xFF))
                out := shl(8, out)
                out := add(out, and(mload(add(tablePtr, and(input, 0x3F))), 0xFF))
                mstore(resultPtr, shl(224, out))
                resultPtr := add(resultPtr, 4)
            }
            switch mod(mload(data), 3)
            case 1 { mstore(sub(resultPtr, 2), shl(240, 0x3d3d)) }
            case 2 { mstore(sub(resultPtr, 1), shl(248, 0x3d)) }
            mstore(result, encodedLen)
        }
        return string(result);
    }
}
