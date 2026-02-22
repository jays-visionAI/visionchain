// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StorageRegistry
 * @dev On-chain registry of storage nodes and their allocated capacity.
 *      Records node registrations, capacity pledges, and status updates.
 *      Serves as the source of truth for which nodes participate in storage.
 */
contract StorageRegistry is Ownable, Pausable {

    enum NodeStatus { Inactive, Active, Suspended }

    struct NodeInfo {
        bytes32 nodeId;
        address operator;
        uint256 capacityGB;
        uint256 usedGB;
        string nodeClass;       // "lite", "standard", "full", "agent"
        uint256 registeredAt;
        uint256 lastHeartbeat;
        NodeStatus status;
        uint256 proofSuccessCount;
        uint256 proofFailCount;
    }

    // Storage
    mapping(bytes32 => NodeInfo) public nodes;
    mapping(address => bytes32[]) public operatorNodes;
    bytes32[] public allNodeIds;

    uint256 public totalCapacityGB;
    uint256 public totalUsedGB;
    uint256 public totalActiveNodes;

    // Merkle root registry: fileKey => merkleRoot
    mapping(bytes32 => bytes32) public fileMerkleRoots;
    mapping(bytes32 => uint256) public fileRegisteredAt;

    // Authorized executors (backend services)
    mapping(address => bool) public isExecutor;

    // Events
    event NodeRegistered(bytes32 indexed nodeId, address indexed operator, uint256 capacityGB, string nodeClass);
    event NodeUpdated(bytes32 indexed nodeId, uint256 capacityGB, uint256 usedGB);
    event NodeStatusChanged(bytes32 indexed nodeId, NodeStatus status);
    event HeartbeatRecorded(bytes32 indexed nodeId, uint256 timestamp);
    event MerkleRootRecorded(bytes32 indexed fileKey, bytes32 merkleRoot, uint256 timestamp);
    event ExecutorUpdated(address indexed executor, bool allowed);

    modifier onlyExecutor() {
        require(isExecutor[msg.sender] || msg.sender == owner(), "Not an executor");
        _;
    }

    constructor() Ownable(msg.sender) {
        isExecutor[msg.sender] = true;
    }

    /**
     * @dev Register a new storage node
     */
    function registerNode(
        bytes32 nodeId,
        address operator,
        uint256 capacityGB,
        string calldata nodeClass
    ) external onlyExecutor whenNotPaused {
        require(nodes[nodeId].registeredAt == 0, "Node already registered");
        require(operator != address(0), "Invalid operator");
        require(capacityGB > 0, "Capacity must be > 0");

        nodes[nodeId] = NodeInfo({
            nodeId: nodeId,
            operator: operator,
            capacityGB: capacityGB,
            usedGB: 0,
            nodeClass: nodeClass,
            registeredAt: block.timestamp,
            lastHeartbeat: block.timestamp,
            status: NodeStatus.Active,
            proofSuccessCount: 0,
            proofFailCount: 0
        });

        operatorNodes[operator].push(nodeId);
        allNodeIds.push(nodeId);
        totalCapacityGB += capacityGB;
        totalActiveNodes++;

        emit NodeRegistered(nodeId, operator, capacityGB, nodeClass);
    }

    /**
     * @dev Update node capacity and usage
     */
    function updateNode(
        bytes32 nodeId,
        uint256 capacityGB,
        uint256 usedGB
    ) external onlyExecutor {
        NodeInfo storage node = nodes[nodeId];
        require(node.registeredAt > 0, "Node not registered");

        totalCapacityGB = totalCapacityGB - node.capacityGB + capacityGB;
        totalUsedGB = totalUsedGB - node.usedGB + usedGB;

        node.capacityGB = capacityGB;
        node.usedGB = usedGB;

        emit NodeUpdated(nodeId, capacityGB, usedGB);
    }

    /**
     * @dev Record a heartbeat from a node
     */
    function recordHeartbeat(bytes32 nodeId) external onlyExecutor {
        NodeInfo storage node = nodes[nodeId];
        require(node.registeredAt > 0, "Node not registered");

        node.lastHeartbeat = block.timestamp;
        emit HeartbeatRecorded(nodeId, block.timestamp);
    }

    /**
     * @dev Batch record heartbeats
     */
    function recordHeartbeatBatch(bytes32[] calldata nodeIds) external onlyExecutor {
        for (uint256 i = 0; i < nodeIds.length; i++) {
            if (nodes[nodeIds[i]].registeredAt > 0) {
                nodes[nodeIds[i]].lastHeartbeat = block.timestamp;
                emit HeartbeatRecorded(nodeIds[i], block.timestamp);
            }
        }
    }

    /**
     * @dev Change node status (activate, suspend, deactivate)
     */
    function setNodeStatus(bytes32 nodeId, NodeStatus status) external onlyExecutor {
        NodeInfo storage node = nodes[nodeId];
        require(node.registeredAt > 0, "Node not registered");

        if (node.status == NodeStatus.Active && status != NodeStatus.Active) {
            totalActiveNodes--;
        } else if (node.status != NodeStatus.Active && status == NodeStatus.Active) {
            totalActiveNodes++;
        }

        node.status = status;
        emit NodeStatusChanged(nodeId, status);
    }

    /**
     * @dev Record proof results for a node
     */
    function recordProofResult(bytes32 nodeId, bool passed) external onlyExecutor {
        NodeInfo storage node = nodes[nodeId];
        require(node.registeredAt > 0, "Node not registered");

        if (passed) {
            node.proofSuccessCount++;
        } else {
            node.proofFailCount++;
        }
    }

    /**
     * @dev Record a file's Merkle root on-chain for immutable verification
     */
    function recordMerkleRoot(bytes32 fileKey, bytes32 merkleRoot) external onlyExecutor {
        fileMerkleRoots[fileKey] = merkleRoot;
        fileRegisteredAt[fileKey] = block.timestamp;
        emit MerkleRootRecorded(fileKey, merkleRoot, block.timestamp);
    }

    /**
     * @dev Verify a file's Merkle root
     */
    function verifyMerkleRoot(bytes32 fileKey, bytes32 merkleRoot) external view returns (bool) {
        return fileMerkleRoots[fileKey] == merkleRoot;
    }

    // --- View Functions ---

    function getNode(bytes32 nodeId) external view returns (NodeInfo memory) {
        return nodes[nodeId];
    }

    function getOperatorNodes(address operator) external view returns (bytes32[] memory) {
        return operatorNodes[operator];
    }

    function getTotalNodes() external view returns (uint256) {
        return allNodeIds.length;
    }

    function getNetworkStats() external view returns (
        uint256 _totalNodes,
        uint256 _activeNodes,
        uint256 _totalCapacityGB,
        uint256 _totalUsedGB
    ) {
        return (allNodeIds.length, totalActiveNodes, totalCapacityGB, totalUsedGB);
    }

    // --- Admin ---

    function setExecutor(address executor, bool allowed) external onlyOwner {
        isExecutor[executor] = allowed;
        emit ExecutorUpdated(executor, allowed);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
