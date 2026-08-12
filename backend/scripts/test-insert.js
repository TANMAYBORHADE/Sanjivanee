const { prisma } = require("../prisma/client");

async function main() {
  const farmer = await prisma.user.create({
    data: {
      name: "Ramesh Patil",
      role: "FARMER",
      email: "ramesh.patil@example.com",
      passwordHash: "temp-placeholder-hash", // real hashing comes in Phase 4 (auth)
      region: "Nashik, Maharashtra",
    },
  });
  console.log("Created farmer:", farmer);

  const batch = await prisma.batch.create({
    data: {
      batchCode: "SNJ-ASHW-2026-0001",
      herbSpecies: "Withania somnifera (Ashwagandha)",
      quantityKg: 25.5,
      collectionLat: 20.0059,
      collectionLng: 73.791,
      collectionDate: new Date(),
      farmerId: farmer.id,
    },
  });
  console.log("Created batch:", batch);
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());