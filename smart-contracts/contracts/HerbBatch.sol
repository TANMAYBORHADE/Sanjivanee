// SPDX-License-Identifier: MIT
// smart-contracts/contracts/HerbBatch.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title HerbBatch
/// @notice Minimal on-chain registry for Ayurvedic herb batch provenance.
/// Heavy data (files, images, GPS logs) lives in IPFS/Postgres — this contract
/// only anchors tamper-evident pointers (CIDs/hashes) and stage transitions.
contract HerbBatch is AccessControl {
    bytes32 public constant FARMER_ROLE = keccak256("FARMER_ROLE");
    bytes32 public constant PROCESSOR_ROLE = keccak256("PROCESSOR_ROLE");
    bytes32 public constant LAB_ROLE = keccak256("LAB_ROLE");
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");

    enum Stage {
        Collected,
        Aggregated,
        Processed,
        LabTested,
        Manufactured,
        Packaged,
        Distributed
    }

    struct BatchEvent {
        Stage stage;
        address actor;
        string ipfsCid;   // pointer to supporting record (report, photo, log)
        bytes32 dataHash; // sha256 hash of the off-chain record, for integrity checks
        uint256 timestamp;
    }

    struct Batch {
        string batchCode;     // human-readable code, matches Postgres + QR payload
        string herbSpecies;
        address farmer;
        int256 lat;           // scaled by 1e6 to avoid floats on-chain
        int256 lng;           // scaled by 1e6
        uint256 collectionDate;
        bool exists;
    }

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => BatchEvent[]) public batchHistory;
    uint256 public nextBatchId;

    event BatchCreated(uint256 indexed batchId, string batchCode, address indexed farmer);
    event StageAdded(uint256 indexed batchId, Stage stage, address indexed actor, string ipfsCid);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Admin registers actors before they can write to the chain.
    function registerActor(address actor, bytes32 role) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(role, actor);
    }

    /// @notice Farmer records initial collection — the root of a batch's provenance.
    function createBatch(
        string calldata batchCode,
        string calldata herbSpecies,
        int256 lat,
        int256 lng,
        uint256 collectionDate,
        string calldata ipfsCid,
        bytes32 dataHash
    ) external onlyRole(FARMER_ROLE) returns (uint256) {
        uint256 batchId = nextBatchId++;

        batches[batchId] = Batch({
            batchCode: batchCode,
            herbSpecies: herbSpecies,
            farmer: msg.sender,
            lat: lat,
            lng: lng,
            collectionDate: collectionDate,
            exists: true
        });

        batchHistory[batchId].push(BatchEvent({
            stage: Stage.Collected,
            actor: msg.sender,
            ipfsCid: ipfsCid,
            dataHash: dataHash,
            timestamp: block.timestamp
        }));

        emit BatchCreated(batchId, batchCode, msg.sender);
        emit StageAdded(batchId, Stage.Collected, msg.sender, ipfsCid);
        return batchId;
    }

    /// @notice Any registered downstream actor appends the next lifecycle stage.
    /// Role checks ensure e.g. only a LAB_ROLE holder can push a LabTested stage.
    function addEvent(
        uint256 batchId,
        Stage stage,
        string calldata ipfsCid,
        bytes32 dataHash
    ) external {
        require(batches[batchId].exists, "Batch does not exist");
        require(_actorAllowedForStage(msg.sender, stage), "Not authorized for this stage");

        batchHistory[batchId].push(BatchEvent({
            stage: stage,
            actor: msg.sender,
            ipfsCid: ipfsCid,
            dataHash: dataHash,
            timestamp: block.timestamp
        }));

        emit StageAdded(batchId, stage, msg.sender, ipfsCid);
    }

    function getBatchHistory(uint256 batchId) external view returns (BatchEvent[] memory) {
        return batchHistory[batchId];
    }

    function _actorAllowedForStage(address actor, Stage stage) internal view returns (bool) {
        if (stage == Stage.Processed || stage == Stage.Aggregated) {
            return hasRole(PROCESSOR_ROLE, actor);
        }
        if (stage == Stage.LabTested) {
            return hasRole(LAB_ROLE, actor);
        }
        if (stage == Stage.Manufactured || stage == Stage.Packaged || stage == Stage.Distributed) {
            return hasRole(MANUFACTURER_ROLE, actor);
        }
        return false;
    }
}
