require("dotenv/config");
const express = require("express");
const { prisma } = require("./prisma/client");

const app = express();
app.use(express.json());

// Create a new batch (for now, farmer is looked up by wallet address)
app.post("/batches", async (req, res) => {
  try {
    const { batchCode, herbSpecies, quantityKg, collectionLat, collectionLng, farmerWalletAddress } = req.body;

    const farmer = await prisma.user.findUnique({
      where: { walletAddress: farmerWalletAddress },
    });
    if (!farmer) return res.status(404).json({ error: "Farmer not found" });

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

// Fetch a batch with its full event history
app.get("/batches/:id", async (req, res) => {
  const batch = await prisma.batch.findUnique({
    where: { id: req.params.id },
    include: { events: true, farmer: true },
  });
  if (!batch) return res.status(404).json({ error: "Batch not found" });
  res.json(batch);
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));