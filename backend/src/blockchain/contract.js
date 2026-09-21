require("dotenv/config");
const { ethers } = require("ethers");
const HerbBatchArtifact = require("./HerbBatch.json");

// Connects to the blockchain (local Hardhat node for now, a real testnet later)
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// This is your backend's own wallet — the ONLY account that ever signs
// transactions on this contract (Model A: backend pays all gas)
const backendWallet = new ethers.Wallet(process.env.BACKEND_WALLET_PRIVATE_KEY, provider);

// The actual contract instance, ready to call functions on
const herbBatchContract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  HerbBatchArtifact.abi,
  backendWallet
);

/**
 * Creates a batch on-chain. Mirrors what interact.js does manually,
 * but callable from anywhere in the backend (e.g. the POST /batches route).
 * Returns { txHash, onChainId } to be saved back onto the Postgres Batch row.
 */
async function createBatchOnChain({ batchCode, herbSpecies, farmerId, lat, lng, collectionDate, ipfsCid, dataHash }) {
  const tx = await herbBatchContract.createBatch(
    batchCode,
    herbSpecies,
    farmerId,
    lat,
    lng,
    collectionDate,
    ipfsCid,
    dataHash
  );
  const receipt = await tx.wait();

  // Same event-parsing pattern from interact.js — function return values
  // aren't directly accessible from ethers.js, so we read the emitted event instead
  let onChainId;
  for (const log of receipt.logs) {
    try {
      const parsedLog = herbBatchContract.interface.parseLog(log);
      if (parsedLog && parsedLog.name === "BatchCreated") {
        onChainId = parsedLog.args.batchId.toString();
        break;
      }
    } catch {
      // ignore logs that don't belong to this contract
    }
  }

  return { txHash: receipt.hash, onChainId };
}

/**
 * Adds a lifecycle event (processed, tested, etc.) to an existing on-chain batch.
 */
async function addEventOnChain({ onChainId, stage, actorId, ipfsCid, dataHash }) {
  const tx = await herbBatchContract.addEvent(onChainId, stage, actorId, ipfsCid, dataHash);
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}



module.exports = { createBatchOnChain, addEventOnChain };