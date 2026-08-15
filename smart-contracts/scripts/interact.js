const hre = require("hardhat");

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // paste your deployed address here

async function main() {
  const herbBatch = await hre.ethers.getContractAt("HerbBatch", CONTRACT_ADDRESS);

  // Simulate: backend calls this after a farmer submits a "create batch" form
  const tx = await herbBatch.createBatch(
    "SNJ-ASHW-2026-0001",              // batchCode
    "Withania somnifera (Ashwagandha)", // herbSpecies
    "cmsqg7nii0000ckwucp62ho9v",        // farmerId — real id from your Postgres test farmer
    20005900,                           // lat, scaled by 1e6 (20.0059 * 1e6)
    73791000,                           // lng, scaled by 1e6 (73.791 * 1e6)
    Math.floor(Date.now() / 1000),      // collectionDate, unix timestamp
    "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi", // fake ipfsCid for now
    hre.ethers.id("fake-report-content") // fake dataHash for now
  );

  const receipt = await tx.wait();
  console.log("Batch created! Tx hash:", receipt.hash);

  // batchId is 0 since it's the first batch ever created on this contract
  const history = await herbBatch.getBatchHistory(0);
  console.log("Batch history:", history);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});