require("dotenv/config");
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { prisma } = require("./prisma/client");
const { createBatchOnChain, addEventOnChain } = require("./src/blockchain/contract");

// Fail loudly at startup if required config is missing, instead of a
// confusing crash the first time some route actually needs it
function validateEnv() {
  const required = ["DATABASE_URL", "RPC_URL", "BACKEND_WALLET_PRIVATE_KEY", "CONTRACT_ADDRESS"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
}
validateEnv();

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Retries a flaky async operation (like a blockchain call) a few times
// before giving up — local nodes/networks can hiccup transiently
async function withRetry(fn, { retries = 2, delayMs = 1000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        console.warn(`Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`, err.message);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

// Maps Prisma's BatchStage enum names to the numeric index HerbBatch.sol's
// Stage enum expects (Solidity enums are just numbers under the hood, in
// the exact order they're declared: Collected=0, Aggregated=1, ...)
const STAGE_TO_CHAIN_INDEX = {
  COLLECTED: 0,
  AGGREGATED: 1,
  PROCESSED: 2,
  LAB_TESTED: 3,
  MANUFACTURED: 4,
  PACKAGED: 5,
  DISTRIBUTED: 6,
};

app.post("/batches", async (req, res) => {
  try {
    const { batchCode, herbSpecies, quantityKg, collectionLat, collectionLng, farmerEmail } = req.body;

    const farmer = await prisma.user.findUnique({
      where: { email: farmerEmail },
    });
    if (!farmer || farmer.role !== "FARMER") {
      return res.status(400).json({ error: "A valid registered farmer is required" });
    }

    const batch = await prisma.batch.create({
      data: {
        batchCode,
        herbSpecies,
        quantityKg,
        collectionLat,
        collectionLng,
        collectionDate: new Date(),
        farmerId: farmer.id,
      },
    });

    // 2. Record it on-chain — scale lat/lng by 1e6 since Solidity has no floats
    // Wrapped in a retry since local/testnet RPC calls can fail transiently
    let onChainResult;
    try {
      onChainResult = await withRetry(() =>
        createBatchOnChain({
          batchCode: batch.batchCode,
          herbSpecies: batch.herbSpecies,
          farmerId: farmer.id,
          lat: Math.round(collectionLat * 1e6),
          lng: Math.round(collectionLng * 1e6),
          collectionDate: Math.floor(batch.collectionDate.getTime() / 1000),
          ipfsCid: "", // real IPFS upload comes in Phase 5 — empty for now
          dataHash: ethers.ZeroHash, // placeholder until Phase 5 hashes real files
        })
      );
    } catch (chainErr) {
      // The Postgres row already exists at this point but the chain write
      // failed even after retries. We keep the DB row (source of truth) and
      // flag it rather than rejecting the whole request.
      console.error("On-chain write failed:", chainErr);
      return res.status(201).json({
        ...batch,
        warning: "Saved to database, but blockchain recording failed. Will need manual sync.",
      });
    }

    // 3. Save the on-chain proof back onto the Postgres row
    const updatedBatch = await prisma.batch.update({
      where: { id: batch.id },
      data: {
        onChainId: onChainResult.onChainId,
        creationTxHash: onChainResult.txHash,
      },
    });

    res.status(201).json(updatedBatch);
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Batch code already exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Batch record not found during update" });
    }
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Append a lifecycle event to an existing batch (processed, tested, etc.)
// — writes to Postgres AND records it on-chain, same pattern as POST /batches
app.post("/batches/:id/events", async (req, res) => {
  try {
    const { stage, actorEmail, notes, latitude, longitude } = req.body;

    if (!(stage in STAGE_TO_CHAIN_INDEX)) {
      return res.status(400).json({ error: `Invalid stage. Must be one of: ${Object.keys(STAGE_TO_CHAIN_INDEX).join(", ")}` });
    }

    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    if (batch.onChainId === null) {
      // Can't append an on-chain event to a batch that was never confirmed on-chain
      return res.status(400).json({ error: "Batch has no on-chain record yet — cannot add an event" });
    }

    const actor = await prisma.user.findUnique({ where: { email: actorEmail } });
    if (!actor) return res.status(400).json({ error: "A valid registered actor is required" });

    // 1. Write to Postgres first
    const event = await prisma.batchEvent.create({
      data: {
        batchId: batch.id,
        stage,
        actorId: actor.id,
        notes,
        latitude,
        longitude,
      },
    });

    // 2. Try the on-chain write — don't return early on failure, since the
    // event genuinely happened regardless of whether the chain confirms it.
    // event.txHash staying null IS our "pending chain sync" signal, so we
    // don't need a separate status field for this.
    let onChainResult = null;
    let chainWarning = null;
    try {
      onChainResult = await withRetry(() =>
        addEventOnChain({
          onChainId: batch.onChainId,
          stage: STAGE_TO_CHAIN_INDEX[stage],
          actorId: actor.id,
          ipfsCid: "",
          dataHash: ethers.ZeroHash,
        })
      );
    } catch (chainErr) {
      console.error("On-chain event write failed:", chainErr);
      chainWarning = "Saved to database, but blockchain recording failed. Event's txHash remains null until manually synced.";
    }

    // 3. batch.status ALWAYS reflects what really happened, regardless of
    // chain-write success. txHash is only set if the chain call succeeded.
    const [updatedEvent] = await prisma.$transaction([
      prisma.batchEvent.update({
        where: { id: event.id },
        data: onChainResult ? { txHash: onChainResult.txHash } : {},
      }),
      prisma.batch.update({
        where: { id: batch.id },
        data: { status: stage },
      }),
    ]);

    const responseBody = chainWarning ? { ...updatedEvent, warning: chainWarning } : updatedEvent;
    res.status(201).json(responseBody);
  } catch (err) {
    console.error(err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found during update" });
    }
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Fetch a batch with its full event history (excluding sensitive fields like passwordHash)
app.get("/batches/:id", async (req, res) => {
  try {
    const batch = await prisma.batch.findUnique({
      where: { id: req.params.id },
      include: {
        events: true,
        farmer: {
          select: {
            id: true,
            name: true,
            role: true,
            email: true,
            phone: true,
            orgName: true,
            region: true,
            isVerified: true,
            createdAt: true,
          },
        },
      },
    });
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    res.json(batch);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));