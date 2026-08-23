require("dotenv/config");
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const { prisma } = require("./prisma/client");
const { createBatchOnChain } = require("./src/blockchain/contract");

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

// Create a new batch — writes to Postgres AND records it on-chain
app.post("/batches", async (req, res) => {
  try {
    const { batchCode, herbSpecies, quantityKg, collectionLat, collectionLng, farmerEmail } = req.body;

    const farmer = await prisma.user.findUnique({
      where: { email: farmerEmail },
    });
    if (!farmer || farmer.role !== "FARMER") {
      return res.status(400).json({ error: "A valid registered farmer is required" });
    }

    // 1. Write to Postgres first — this is our source of truth for querying
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
      // failed — see the explanation below about what this "half-written"
      // state means and why we're not treating it as a hard failure.
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

const PORT = 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));