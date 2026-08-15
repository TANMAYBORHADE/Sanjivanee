// SPDX-License-Identifier: MIT
// smart-contracts/contracts/HerbBatch.sol
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HerbBatch
/// @notice Minimal on-chain registry for Ayurvedic herb batch provenance.
/// Heavy data (files, images, GPS logs) lives in IPFS/Postgres — this contract
/// only anchors tamper-evident pointers (CIDs/hashes) and stage transitions.
///
/// GAS MODEL: the backend pays all gas and is the ONLY address that ever
/// calls this contract (see Phase 3 of the roadmap). Because of that, Solidity
/// role-checks like `onlyRole(FARMER_ROLE)` can't tell farmers and labs apart —
/// every call arrives from the same backend wallet. So real permission
/// enforcement (who's allowed to act as which role) lives in the BACKEND's
/// own auth/login system (Phase 4), not here. This contract's job is just to
/// record, immutably, WHO the backend says did it (`actorId`) and WHAT
/// happened — it trusts the backend the same way a database trusts its
/// application layer.
contract HerbBatch is Ownable {
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
        string actorId;    // Postgres User.id of whoever the backend says did this
        string ipfsCid;    // pointer to supporting record (report, photo, log)
        bytes32 dataHash;  // sha256 hash of the off-chain record, for integrity checks
        uint256 timestamp;
    }

    struct Batch {
        string batchCode;     // human-readable code, matches Postgres + QR payload
        string herbSpecies;
        string farmerId;      // Postgres User.id of the farmer
        int256 lat;            // scaled by 1e6 to avoid floats on-chain
        int256 lng;            // scaled by 1e6
        uint256 collectionDate;
        bool exists;
    }

    mapping(uint256 => Batch) public batches;
    mapping(uint256 => BatchEvent[]) public batchHistory;
    uint256 public nextBatchId;

    event BatchCreated(uint256 indexed batchId, string batchCode, string farmerId);
    event StageAdded(uint256 indexed batchId, Stage stage, string actorId, string ipfsCid);

    constructor(address backendWallet) Ownable(backendWallet) {}

    /// @notice Records initial collection — the root of a batch's provenance.
    /// onlyOwner = only the backend's wallet can call this. The backend is
    /// responsible for having already checked (via its own login system)
    /// that `farmerId` really is a logged-in, verified farmer.
    function createBatch(
        string calldata batchCode,
        string calldata herbSpecies,
        string calldata farmerId,
        int256 lat,
        int256 lng,
        uint256 collectionDate,
        string calldata ipfsCid,
        bytes32 dataHash
    ) external onlyOwner returns (uint256) {
        uint256 batchId = nextBatchId++;

        batches[batchId] = Batch({
            batchCode: batchCode,
            herbSpecies: herbSpecies,
            farmerId: farmerId,
            lat: lat,
            lng: lng,
            collectionDate: collectionDate,
            exists: true
        });

        batchHistory[batchId].push(BatchEvent({
            stage: Stage.Collected,
            actorId: farmerId,
            ipfsCid: ipfsCid,
            dataHash: dataHash,
            timestamp: block.timestamp
        }));

        emit BatchCreated(batchId, batchCode, farmerId);
        emit StageAdded(batchId, Stage.Collected, farmerId, ipfsCid);
        return batchId;
    }

    /// @notice Appends the next lifecycle stage. Same trust model as above:
    /// the backend has already verified (in Phase 4 auth) that `actorId`
    /// is a real, logged-in user allowed to perform this stage.
    function addEvent(
        uint256 batchId,
        Stage stage,
        string calldata actorId,
        string calldata ipfsCid,
        bytes32 dataHash
    ) external onlyOwner {
        require(batches[batchId].exists, "Batch does not exist");

        batchHistory[batchId].push(BatchEvent({
            stage: stage,
            actorId: actorId,
            ipfsCid: ipfsCid,
            dataHash: dataHash,
            timestamp: block.timestamp
        }));

        emit StageAdded(batchId, stage, actorId, ipfsCid);
    }

    function getBatchHistory(uint256 batchId) external view returns (BatchEvent[] memory) {
        return batchHistory[batchId];
    }
}
