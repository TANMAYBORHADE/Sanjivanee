const hre = require("hardhat");

async function main() {
  const [backendWallet] = await hre.ethers.getSigners();
  console.log("Deploying with account:", backendWallet.address);

  const HerbBatch = await hre.ethers.getContractFactory("HerbBatch");
  const herbBatch = await HerbBatch.deploy(backendWallet.address);
  await herbBatch.waitForDeployment();

  console.log("HerbBatch deployed to:", await herbBatch.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});