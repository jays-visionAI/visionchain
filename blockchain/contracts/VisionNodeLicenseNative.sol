// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VisionNodeLicenseNative
 * @dev Node License NFT for Vision Chain v2 with native VCN payments.
 * 
 * Implements the 3-Tier Node System:
 * - Founder Node (12 Max, 30x Multiplier) - Locked
 * - Enterprise Node (500 Max, 12x Multiplier)
 * - Validator Node (5000 Max, 1x Multiplier)
 */
contract VisionNodeLicenseNative is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    address public treasury;

    enum NodeTier { VALIDATOR, ENTERPRISE, FOUNDER }

    struct NodeAttributes {
        string uuid;
        NodeTier tier;
        uint256 multiplier;
        uint256 activationTime;
        bool isActive;
    }

    mapping(uint256 => NodeAttributes) public nodeDetails;
    mapping(string => uint256) public uuidToTokenId;

    // --- Supply Caps & Counters ---
    uint256 public constant MAX_FOUNDER = 12;
    uint256 public constant MAX_ENTERPRISE = 500;
    uint256 public constant MAX_VALIDATOR = 5000;

    uint256 public currentFounderCount;
    uint256 public currentEnterpriseCount;
    uint256 public currentValidatorCount;

    // --- Pricing in Native VCN ---
    uint256 public enterprisePrice = 500000 * 10**18;
    uint256 public validatorPrice = 70000 * 10**18;

    event LicenseMinted(address indexed owner, uint256 indexed tokenId, NodeTier tier, uint256 multiplier);
    event NodeActivated(uint256 indexed tokenId, uint256 timestamp);
    event NodeDeactivated(uint256 indexed tokenId, uint256 timestamp);
    event PriceUpdated(NodeTier tier, uint256 newPrice);

    constructor(address _treasury) ERC721("VisionNodeLicense", "VNODE") Ownable() {
        treasury = _treasury;
    }

    /**
     * @dev Purchase a Validator or Enterprise Node License with native VCN.
     */
    function purchaseLicense(string memory _uuid, NodeTier _tier) external payable {
        require(uuidToTokenId[_uuid] == 0, "UUID already registered");
        require(_tier != NodeTier.FOUNDER, "Founder Nodes are not for sale");

        uint256 price;
        uint256 multiplier;

        if (_tier == NodeTier.ENTERPRISE) {
            require(currentEnterpriseCount < MAX_ENTERPRISE, "Enterprise Node Cap Reached");
            price = enterprisePrice;
            multiplier = 12;
            currentEnterpriseCount++;
        } else {
            require(currentValidatorCount < MAX_VALIDATOR, "Validator Node Cap Reached");
            price = validatorPrice;
            multiplier = 1;
            currentValidatorCount++;
        }

        // Payment in native VCN
        require(msg.value >= price, "Insufficient VCN payment");

        // Send payment to treasury
        (bool success, ) = payable(treasury).call{value: price}("");
        require(success, "Payment transfer failed");

        // Refund excess
        if (msg.value > price) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - price}("");
            require(refundSuccess, "Refund failed");
        }

        _mintLicense(msg.sender, _uuid, _tier, multiplier);
    }

    /**
     * @dev Admin-only mint for Founder Nodes (Allocated, not sold).
     */
    function distributeFounderNode(address _to, string memory _uuid) external onlyOwner {
        require(currentFounderCount < MAX_FOUNDER, "Founder Node Cap Reached");
        require(uuidToTokenId[_uuid] == 0, "UUID already registered");

        currentFounderCount++;
        _mintLicense(_to, _uuid, NodeTier.FOUNDER, 30);
    }

    function _mintLicense(address _to, string memory _uuid, NodeTier _tier, uint256 _multiplier) internal {
        _tokenIdCounter++;
        uint256 newItemId = _tokenIdCounter;

        _mint(_to, newItemId);

        nodeDetails[newItemId] = NodeAttributes({
            uuid: _uuid,
            tier: _tier,
            multiplier: _multiplier,
            activationTime: 0,
            isActive: false
        });

        uuidToTokenId[_uuid] = newItemId;
        emit LicenseMinted(_to, newItemId, _tier, _multiplier);
    }

    // --- Node Operation Logic ---

    function activateNode(uint256 _tokenId) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        nodeDetails[_tokenId].isActive = true;
        if (nodeDetails[_tokenId].activationTime == 0) {
            nodeDetails[_tokenId].activationTime = block.timestamp;
        }
        emit NodeActivated(_tokenId, block.timestamp);
    }

    function deactivateNode(uint256 _tokenId) external {
        require(ownerOf(_tokenId) == msg.sender, "Not owner");
        nodeDetails[_tokenId].isActive = false;
        emit NodeDeactivated(_tokenId, block.timestamp);
    }

    // --- Admin Functions ---

    function setPrice(NodeTier _tier, uint256 _newPrice) external onlyOwner {
        require(_tier != NodeTier.FOUNDER, "Cannot set Founder price");
        if (_tier == NodeTier.ENTERPRISE) {
            enterprisePrice = _newPrice;
        } else {
            validatorPrice = _newPrice;
        }
        emit PriceUpdated(_tier, _newPrice);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        treasury = _newTreasury;
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
}
