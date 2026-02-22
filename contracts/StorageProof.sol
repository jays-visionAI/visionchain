// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title StorageProof
 * @dev On-chain storage proof challenge and verification system.
 *      Backend issues challenges, nodes respond with proofs,
 *      and verification results are recorded immutably on-chain.
 */
contract StorageProof is Ownable {

    enum ChallengeStatus { Pending, Verified, Failed, Expired }

    struct Challenge {
        bytes32 challengeId;
        bytes32 nodeId;
        bytes32 chunkHash;
        uint256 offset;
        uint256 readBytes;
        uint256 createdAt;
        uint256 expiresAt;
        ChallengeStatus status;
        bytes32 expectedHash;   // set by backend after verification
        bytes32 submittedHash;  // proof submitted by node
    }

    // Storage
    mapping(bytes32 => Challenge) public challenges;
    bytes32[] public allChallengeIds;

    // Node proof stats
    mapping(bytes32 => uint256) public nodeProofsPassed;
    mapping(bytes32 => uint256) public nodeProofsFailed;
    mapping(bytes32 => uint256) public nodeLastChallenge;

    // Challenge configuration
    uint256 public challengeExpirySeconds = 300; // 5 minutes
    uint256 public maxChallengesPerBatch = 10;

    // Authorized executors
    mapping(address => bool) public isExecutor;

    // Events
    event ChallengeIssued(bytes32 indexed challengeId, bytes32 indexed nodeId, bytes32 chunkHash, uint256 offset);
    event ProofSubmitted(bytes32 indexed challengeId, bytes32 indexed nodeId, bytes32 proofHash);
    event ProofVerified(bytes32 indexed challengeId, bytes32 indexed nodeId, bool passed);
    event ChallengeExpired(bytes32 indexed challengeId, bytes32 indexed nodeId);
    event ExecutorUpdated(address indexed executor, bool allowed);

    modifier onlyExecutor() {
        require(isExecutor[msg.sender] || msg.sender == owner(), "Not an executor");
        _;
    }

    constructor() Ownable(msg.sender) {
        isExecutor[msg.sender] = true;
    }

    /**
     * @dev Issue a batch of storage proof challenges
     */
    function issueChallenges(
        bytes32[] calldata challengeIds,
        bytes32[] calldata nodeIds,
        bytes32[] calldata chunkHashes,
        uint256[] calldata offsets,
        uint256[] calldata readBytesArr
    ) external onlyExecutor {
        require(
            challengeIds.length == nodeIds.length &&
            challengeIds.length == chunkHashes.length &&
            challengeIds.length == offsets.length &&
            challengeIds.length == readBytesArr.length,
            "Array length mismatch"
        );
        require(challengeIds.length <= maxChallengesPerBatch, "Too many challenges");

        uint256 expiresAt = block.timestamp + challengeExpirySeconds;

        for (uint256 i = 0; i < challengeIds.length; i++) {
            require(challenges[challengeIds[i]].createdAt == 0, "Challenge already exists");

            challenges[challengeIds[i]] = Challenge({
                challengeId: challengeIds[i],
                nodeId: nodeIds[i],
                chunkHash: chunkHashes[i],
                offset: offsets[i],
                readBytes: readBytesArr[i],
                createdAt: block.timestamp,
                expiresAt: expiresAt,
                status: ChallengeStatus.Pending,
                expectedHash: bytes32(0),
                submittedHash: bytes32(0)
            });

            allChallengeIds.push(challengeIds[i]);
            nodeLastChallenge[nodeIds[i]] = block.timestamp;

            emit ChallengeIssued(challengeIds[i], nodeIds[i], chunkHashes[i], offsets[i]);
        }
    }

    /**
     * @dev Submit proof responses for challenges
     */
    function submitProofs(
        bytes32[] calldata challengeIds,
        bytes32[] calldata proofHashes
    ) external onlyExecutor {
        require(challengeIds.length == proofHashes.length, "Array length mismatch");

        for (uint256 i = 0; i < challengeIds.length; i++) {
            Challenge storage c = challenges[challengeIds[i]];
            require(c.createdAt > 0, "Challenge not found");
            require(c.status == ChallengeStatus.Pending, "Challenge not pending");

            if (block.timestamp > c.expiresAt) {
                c.status = ChallengeStatus.Expired;
                nodeProofsFailed[c.nodeId]++;
                emit ChallengeExpired(challengeIds[i], c.nodeId);
                continue;
            }

            c.submittedHash = proofHashes[i];
            emit ProofSubmitted(challengeIds[i], c.nodeId, proofHashes[i]);
        }
    }

    /**
     * @dev Verify submitted proofs against expected hashes
     *      Called by the backend after independently computing the expected hash
     */
    function verifyProofs(
        bytes32[] calldata challengeIds,
        bytes32[] calldata expectedHashes
    ) external onlyExecutor {
        require(challengeIds.length == expectedHashes.length, "Array length mismatch");

        for (uint256 i = 0; i < challengeIds.length; i++) {
            Challenge storage c = challenges[challengeIds[i]];
            require(c.createdAt > 0, "Challenge not found");

            if (c.status != ChallengeStatus.Pending) continue;

            c.expectedHash = expectedHashes[i];

            bool passed = (c.submittedHash == expectedHashes[i] && c.submittedHash != bytes32(0));

            if (passed) {
                c.status = ChallengeStatus.Verified;
                nodeProofsPassed[c.nodeId]++;
            } else {
                c.status = ChallengeStatus.Failed;
                nodeProofsFailed[c.nodeId]++;
            }

            emit ProofVerified(challengeIds[i], c.nodeId, passed);
        }
    }

    /**
     * @dev Expire pending challenges that have passed their deadline
     */
    function expireChallenges(bytes32[] calldata challengeIds) external onlyExecutor {
        for (uint256 i = 0; i < challengeIds.length; i++) {
            Challenge storage c = challenges[challengeIds[i]];
            if (c.status == ChallengeStatus.Pending && block.timestamp > c.expiresAt) {
                c.status = ChallengeStatus.Expired;
                nodeProofsFailed[c.nodeId]++;
                emit ChallengeExpired(challengeIds[i], c.nodeId);
            }
        }
    }

    // --- View Functions ---

    function getChallenge(bytes32 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    function getNodeProofStats(bytes32 nodeId) external view returns (
        uint256 passed,
        uint256 failed,
        uint256 lastChallenge,
        uint256 successRate // basis points (0-10000)
    ) {
        passed = nodeProofsPassed[nodeId];
        failed = nodeProofsFailed[nodeId];
        lastChallenge = nodeLastChallenge[nodeId];
        uint256 total = passed + failed;
        successRate = total > 0 ? (passed * 10000) / total : 0;
    }

    function getTotalChallenges() external view returns (uint256) {
        return allChallengeIds.length;
    }

    // --- Admin ---

    function setChallengeExpiry(uint256 seconds_) external onlyOwner {
        challengeExpirySeconds = seconds_;
    }

    function setMaxBatchSize(uint256 maxBatch) external onlyOwner {
        maxChallengesPerBatch = maxBatch;
    }

    function setExecutor(address executor, bool allowed) external onlyOwner {
        isExecutor[executor] = allowed;
        emit ExecutorUpdated(executor, allowed);
    }
}
