const { expect } = require("chai");
const hre = require("hardhat");

describe("HerbBatch", function () {
  // Runs before EVERY test below — deploys a brand new contract each time,
  // so no test's leftover data can affect another test.
  async function deployFixture() {
    const [backendWallet, someoneElse] = await hre.ethers.getSigners();

    const HerbBatch = await hre.ethers.getContractFactory("HerbBatch");
    const herbBatch = await HerbBatch.deploy(backendWallet.address);
    await herbBatch.waitForDeployment();

    return { herbBatch, backendWallet, someoneElse };
  }

  it("sets the deployer as owner", async function () {
    const { herbBatch, backendWallet } = await deployFixture();
    expect(await herbBatch.owner()).to.equal(backendWallet.address);
  });

  it("lets the owner create a batch", async function () {
    const { herbBatch } = await deployFixture();

    const tx = await herbBatch.createBatch(
      "SNJ-ASHW-2026-TEST",
      "Ashwagandha",
      "farmer-123",
      20005900,
      73791000,
      Math.floor(Date.now() / 1000),
      "fake-cid",
      hre.ethers.id("fake-data")
    );
    await tx.wait();

    const history = await herbBatch.getBatchHistory(0);
    expect(history.length).to.equal(1);
    expect(history[0].actorId).to.equal("farmer-123");
  });

  it("rejects createBatch from a non-owner", async function () {
    const { herbBatch, someoneElse } = await deployFixture();

    // .connect(someoneElse) sends this call AS a different account,
    // simulating someone who isn't your backend trying to call the contract
    await expect(
      herbBatch.connect(someoneElse).createBatch(
        "FAKE-BATCH",
        "Ashwagandha",
        "fake-farmer",
        0, 0, 0,
        "cid",
        hre.ethers.id("x")
      )
    ).to.be.revertedWithCustomError(herbBatch, "OwnableUnauthorizedAccount");
  });

  it("appends a new stage to an existing batch's history and emits StageAdded", async function () {
    const { herbBatch } = await deployFixture();
    const dataHash2 = hre.ethers.id("data2");

    await (await herbBatch.createBatch(
      "SNJ-ASHW-2026-TEST", "Ashwagandha", "farmer-123",
      0, 0, Math.floor(Date.now() / 1000), "cid1", hre.ethers.id("data1")
    )).wait();

    await expect(
      herbBatch.addEvent(
        0,               // batchId
        2,               // Stage.Processed (index 2 in the enum)
        "processor-456", // actorId
        "cid2",
        dataHash2
      )
    )
      .to.emit(herbBatch, "StageAdded")
      .withArgs(0, 2, "processor-456", "cid2", dataHash2);

    const history = await herbBatch.getBatchHistory(0);
    expect(history.length).to.equal(2);
    expect(history[1].stage).to.equal(2n); // Stage.Processed
    expect(history[1].actorId).to.equal("processor-456");
    expect(history[1].dataHash).to.equal(dataHash2);
  });

  it("rejects addEvent on a batch that doesn't exist", async function () {
    const { herbBatch } = await deployFixture();

    await expect(
      herbBatch.addEvent(999, 2, "someone", "cid", hre.ethers.id("x"))
    ).to.be.revertedWith("Batch does not exist");
  });
});