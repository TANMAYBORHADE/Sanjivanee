require("dotenv/config");
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
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

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // expects "Bearer <token>"
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // now every route below has access to req.user.userId and req.user.role
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `This action requires one of these roles: ${allowedRoles.join(", ")}` });
    }
    next();
  };
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

// ---------- User Routes ----------

const SELF_REGISTERABLE_ROLES = ["FARMER", "AGGREGATOR", "PROCESSOR", "LAB", "MANUFACTURER", "DISTRIBUTOR"];

app.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, phone, orgName, region } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password, and role are required" });
    }
    if (!SELF_REGISTERABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${SELF_REGISTERABLE_ROLES.join(", ")}` });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, role, phone, orgName, region, passwordHash },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        orgName: true,
        region: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    if (err.code === "P2002") return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Deliberately vague error for both "no such user" and "wrong password" —
    // telling an attacker WHICH one was wrong helps them guess valid emails
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Admin approves a user (farmer, lab, processor, etc.)
app.patch("/users/:id/verify", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { isVerified: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isVerified: true,
      },
    });
    res.json(updatedUser);
  } catch (err) {
    console.error(err);
    if (err.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ---------- Batch Routes ----------

app.post("/batches", requireAuth, requireRole("FARMER"), async (req, res) => {
  try {
    const { batchCode, herbSpecies, quantityKg, collectionLat, collectionLng } = req.body;

    if (!batchCode || !herbSpecies || quantityKg == null || collectionLat == null || collectionLng == null) {
      return res.status(400).json({
        error: "batchCode, herbSpecies, quantityKg, collectionLat, and collectionLng are required",
      });
    }

    const parsedQuantity = parseFloat(quantityKg);
    const parsedLat = parseFloat(collectionLat);
    const parsedLng = parseFloat(collectionLng);

    if (isNaN(parsedQuantity) || isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({
        error: "quantityKg, collectionLat, and collectionLng must be valid numbers",
      });
    }

    // farmer identity comes from the verified JWT now, not the request body
    const farmer = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, isVerified: true },
    });

    if (!farmer) {
      return res.status(401).json({ error: "User no longer exists" });
    }

    if (!farmer.isVerified) {
      return res.status(403).json({ error: "Farmer account is pending admin verification" });
    }

    const batch = await prisma.batch.create({
      data: {
        batchCode,
        herbSpecies,
        quantityKg: parsedQuantity,
        collectionLat: parsedLat,
        collectionLng: parsedLng,
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
          lat: Math.round(parsedLat * 1e6),
          lng: Math.round(parsedLng * 1e6),
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

// Which roles are allowed to submit each stage — mirrors the logic that
// used to live inside HerbBatch.sol's _actorAllowedForStage(), before we
// moved trust to the backend under the Model A gas design
const STAGE_ALLOWED_ROLES = {
  AGGREGATED: ["AGGREGATOR"],
  PROCESSED: ["PROCESSOR"],
  LAB_TESTED: ["LAB"],
  MANUFACTURED: ["MANUFACTURER"],
  PACKAGED: ["MANUFACTURER"],
  DISTRIBUTED: ["DISTRIBUTOR"],
};

// Append a lifecycle event to an existing batch (processed, tested, etc.)
// — writes to Postgres AND records it on-chain, same pattern as POST /batches
app.post("/batches/:id/events", requireAuth, async (req, res) => {
  try {
    const { stage, notes, latitude, longitude } = req.body;

    if (!(stage in STAGE_TO_CHAIN_INDEX)) {
      return res.status(400).json({ error: `Invalid stage. Must be one of: ${Object.keys(STAGE_TO_CHAIN_INDEX).join(", ")}` });
    }

    const allowedRoles = STAGE_ALLOWED_ROLES[stage];
    if (!allowedRoles || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Stage ${stage} requires role: ${allowedRoles ? allowedRoles.join(", ") : "none allowed"}` });
    }

    const batch = await prisma.batch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    if (batch.onChainId === null) {
      return res.status(400).json({ error: "Batch has no on-chain record yet — cannot add an event" });
    }

    // actor identity comes from the verified JWT now, not the request body
    const actor = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, isVerified: true },
    });
    if (!actor) return res.status(401).json({ error: "User no longer exists" });
    if (!actor.isVerified) return res.status(403).json({ error: "Account is pending admin verification" });

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
app.get("/batches", async (req, res) => {
  try {
    const { herbSpecies, status, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const where = {
      ...(herbSpecies && { herbSpecies: { contains: herbSpecies, mode: "insensitive" } }),
      ...(status && { status }),
    };

    const [batches, total] = await prisma.$transaction([
      prisma.batch.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: "desc" },
        include: { farmer: { select: { id: true, name: true, region: true } } },
      }),
      prisma.batch.count({ where }),
    ]);

    res.json({
      batches,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
});
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