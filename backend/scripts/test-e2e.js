const http = require("http");

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        let json;
        try {
          json = JSON.parse(body);
        } catch {
          json = body;
        }
        resolve({ statusCode: res.statusCode, data: json });
      });
    });
    req.on("error", reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================");
  console.log("  SANJEEVANI E2E BACKEND & BLOCKCHAIN TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // --- Test 1: POST /batches (Create Batch) ---
  console.log("--- 1. Testing POST /batches (Create Batch) ---");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testBatchCode = `SNJ-ASHW-2026-${randomSuffix}`;

  const createRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/batches",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      batchCode: testBatchCode,
      herbSpecies: "Withania somnifera (Ashwagandha)",
      quantityKg: 35.5,
      collectionLat: 19.9975,
      collectionLng: 73.7898,
      farmerEmail: "ramesh.patil@example.com",
    }
  );

  assert(createRes.statusCode === 201, `Status code is 201 Created (got ${createRes.statusCode})`);
  assert(createRes.data.batchCode === testBatchCode, `Batch code matches (${createRes.data.batchCode})`);
  assert(createRes.data.onChainId !== null && createRes.data.onChainId !== undefined, `onChainId exists (${createRes.data.onChainId})`);
  assert(typeof createRes.data.creationTxHash === "string" && createRes.data.creationTxHash.startsWith("0x"), `creationTxHash is valid (${createRes.data.creationTxHash})`);

  const createdBatchId = createRes.data.id;
  console.log(`  -> Batch created with DB ID: ${createdBatchId}, On-Chain ID: ${createRes.data.onChainId}\n`);

  // --- Test 2: POST /batches/:id/events (Add Lifecycle Event) ---
  console.log("--- 2. Testing POST /batches/:id/events (Add Event) ---");
  const eventRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      stage: "PROCESSED",
      actorEmail: "processor@example.com",
      notes: "Steam-sterilized and ground into fine powder.",
      latitude: 19.998,
      longitude: 73.79,
    }
  );

  assert(eventRes.statusCode === 201, `Status code is 201 Created (got ${eventRes.statusCode})`);
  assert(eventRes.data.stage === "PROCESSED", `Event stage is PROCESSED (${eventRes.data.stage})`);
  assert(typeof eventRes.data.txHash === "string" && eventRes.data.txHash.startsWith("0x"), `Event txHash is valid (${eventRes.data.txHash})`);
  assert(eventRes.data.notes === "Steam-sterilized and ground into fine powder.", `Event notes match`);
  console.log(`  -> Event recorded with DB ID: ${eventRes.data.id}, TxHash: ${eventRes.data.txHash}\n`);

  // --- Test 3: GET /batches/:id (Fetch Batch with Events) ---
  console.log("--- 3. Testing GET /batches/:id (Fetch Batch & Events) ---");
  const getRes = await request({
    hostname: "localhost",
    port: 4000,
    path: `/batches/${createdBatchId}`,
    method: "GET",
  });

  assert(getRes.statusCode === 200, `Status code is 200 OK (got ${getRes.statusCode})`);
  assert(getRes.data.status === "PROCESSED", `Batch status was updated to PROCESSED (${getRes.data.status})`);
  assert(Array.isArray(getRes.data.events) && getRes.data.events.length === 1, `Batch contains 1 event in history`);
  assert(getRes.data.farmer && getRes.data.farmer.email === "ramesh.patil@example.com", `Farmer details populated`);
  assert(getRes.data.farmer.passwordHash === undefined, `Sensitive fields (passwordHash) stripped`);
  console.log(`  -> Batch verification complete.\n`);

  // --- Test 4: Negative & Edge Case Tests ---
  console.log("--- 4. Testing Negative / Edge Cases ---");

  // Invalid stage
  const invalidStageRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      stage: "SUPER_PROCESSED",
      actorEmail: "processor@example.com",
    }
  );
  assert(invalidStageRes.statusCode === 400, `Reject invalid stage with 400 (got ${invalidStageRes.statusCode})`);

  // Non-existent actor
  const invalidActorRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      stage: "AGGREGATED",
      actorEmail: "doesnotexist@example.com",
    }
  );
  assert(invalidActorRes.statusCode === 400, `Reject invalid actor with 400 (got ${invalidActorRes.statusCode})`);

  // Non-existent batch ID
  const invalidBatchRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/non-existent-cuid/events`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      stage: "AGGREGATED",
      actorEmail: "processor@example.com",
    }
  );
  assert(invalidBatchRes.statusCode === 404, `Reject non-existent batch with 404 (got ${invalidBatchRes.statusCode})`);

  console.log("\n==================================================");
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
