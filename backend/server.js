require("dotenv/config");
const express = require("express");
const cors = require("cors");
const { prisma } = require("./prisma/client");

const app = express();
app.use(cors());
app.use(express.json({ limit: "100kb" }));

// Create a new batch
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

    res.status(201).json(batch);
  } catch (err) {
    console.error(err);
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