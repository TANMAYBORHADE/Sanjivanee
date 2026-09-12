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

  // --- 0. Authenticating actors ---
  console.log("--- 0. Authenticating Actors ---");
  const farmerLogin = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "ramesh.patil@example.com", password: "Password123!" }
  );
  assert(farmerLogin.statusCode === 200, `Farmer login succeeded (${farmerLogin.statusCode})`);
  const farmerToken = farmerLogin.data?.token;

  const procLogin = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "processor@example.com", password: "Password123!" }
  );
  assert(procLogin.statusCode === 200, `Processor login succeeded (${procLogin.statusCode})`);
  const procToken = procLogin.data?.token;

  const aggLogin = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "aggregator@example.com", password: "Password123!" }
  );
  assert(aggLogin.statusCode === 200, `Aggregator login succeeded (${aggLogin.statusCode})`);
  const aggToken = aggLogin.data?.token;
  console.log("  -> All test actors authenticated.\n");

  // --- 1. POST /batches (Create Batch) ---
  console.log("--- 1. Testing POST /batches (Create Batch) ---");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const testBatchCode = `SNJ-ASHW-2026-${randomSuffix}`;

  const createRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/batches",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmerToken}`,
      },
    },
    {
      batchCode: testBatchCode,
      herbSpecies: "Withania somnifera (Ashwagandha)",
      quantityKg: 35.5,
      collectionLat: 19.9975,
      collectionLng: 73.7898,
    }
  );

  assert(createRes.statusCode === 201, `Status code is 201 Created (${createRes.statusCode})`);
  assert(createRes.data.batchCode === testBatchCode, `Batch code matches (${createRes.data.batchCode})`);
  assert(createRes.data.status === "COLLECTED", `Initial status is COLLECTED (${createRes.data.status})`);

  const createdBatchId = createRes.data.id;
  console.log(`  -> Batch created with DB ID: ${createdBatchId}\n`);

  // --- 2. Testing Forward Jump: COLLECTED -> PROCESSED (skipping AGGREGATED) ---
  console.log("--- 2. Testing Forward Jump (skipping AGGREGATED) ---");
  const forwardEventRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${procToken}`,
      },
    },
    {
      stage: "PROCESSED",
      notes: "Steam-sterilized and ground into fine powder.",
      latitude: 19.998,
      longitude: 73.79,
    }
  );

  assert(forwardEventRes.statusCode === 201, `Forward jump succeeds with 201 Created (got ${forwardEventRes.statusCode})`);
  assert(forwardEventRes.data.stage === "PROCESSED", `Event stage is PROCESSED (${forwardEventRes.data.stage})`);
  console.log(`  -> Forward jump recorded successfully.\n`);

  // --- 3. Testing Backward Transition: PROCESSED -> AGGREGATED (should fail 409) ---
  console.log("--- 3. Testing Backward Transition Rejection ---");
  const backwardEventRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aggToken}`,
      },
    },
    {
      stage: "AGGREGATED",
      notes: "Attempting backward aggregation",
    }
  );

  assert(backwardEventRes.statusCode === 409, `Backward transition rejected with 409 Conflict (got ${backwardEventRes.statusCode})`);
  assert(
    typeof backwardEventRes.data?.error === "string" && backwardEventRes.data.error.includes("forward only"),
    `Error message explains forward-only rule (${backwardEventRes.data?.error})`
  );
  console.log(`  -> Backward transition safely blocked.\n`);

  // --- 4. Testing Duplicate Stage Transition: PROCESSED -> PROCESSED (should fail 409) ---
  console.log("--- 4. Testing Duplicate Stage Rejection ---");
  const duplicateEventRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${procToken}`,
      },
    },
    {
      stage: "PROCESSED",
      notes: "Attempting second processing stage",
    }
  );

  assert(duplicateEventRes.statusCode === 409, `Duplicate stage rejected with 409 Conflict (got ${duplicateEventRes.statusCode})`);
  console.log(`  -> Duplicate stage safely blocked.\n`);

  // --- 5. GET /batches/:id (Fetch Batch with Events) ---
  console.log("--- 5. Testing GET /batches/:id (Fetch Batch & Events) ---");
  const getRes = await request({
    hostname: "localhost",
    port: 4000,
    path: `/batches/${createdBatchId}`,
    method: "GET",
  });

  assert(getRes.statusCode === 200, `Status code is 200 OK (${getRes.statusCode})`);
  assert(getRes.data.status === "PROCESSED", `Batch status is PROCESSED (${getRes.data.status})`);
  assert(Array.isArray(getRes.data.events) && getRes.data.events.length === 1, `Batch contains exactly 1 event`);
  assert(getRes.data.farmer && getRes.data.farmer.name !== undefined, `Farmer details populated`);
  assert(getRes.data.farmer.passwordHash === undefined, `Sensitive fields (passwordHash) stripped`);
  console.log(`  -> Batch state verified.\n`);

  // --- 6. Testing Negative / Edge Cases ---
  console.log("--- 6. Testing Negative / Edge Cases ---");

  // Invalid stage (authenticated)
  const invalidStageRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/${createdBatchId}/events`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${procToken}`,
      },
    },
    { stage: "INVALID_STAGE" }
  );
  assert(invalidStageRes.statusCode === 400, `Reject invalid stage with 400 (got ${invalidStageRes.statusCode})`);

  // Non-existent batch ID
  const invalidBatchRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: `/batches/non-existent-cuid/events`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${procToken}`,
      },
    },
    { stage: "PROCESSED" }
  );
  assert(invalidBatchRes.statusCode === 404, `Reject non-existent batch with 404 (got ${invalidBatchRes.statusCode})`);

  // Unauthenticated batch creation (no token)
  const unauthBatchRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/batches",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      batchCode: "SNJ-TEST-UNAUTH",
      herbSpecies: "Ashwagandha",
      quantityKg: 10,
      collectionLat: 20.0,
      collectionLng: 73.0,
    }
  );
  assert(unauthBatchRes.statusCode === 401, `Reject unauthenticated batch creation with 401 (got ${unauthBatchRes.statusCode})`);

  // Processor attempting to create a batch (role check)
  const wrongRoleRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/batches",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${procToken}`,
      },
    },
    {
      batchCode: "SNJ-TEST-WRONG-ROLE",
      herbSpecies: "Ashwagandha",
      quantityKg: 10,
      collectionLat: 20.0,
      collectionLng: 73.0,
    }
  );
  assert(wrongRoleRes.statusCode === 403, `Reject non-farmer batch creation with 403 (got ${wrongRoleRes.statusCode})`);

  // Missing required batch fields
  const missingFieldRes = await request(
    {
      hostname: "localhost",
      port: 4000,
      path: "/batches",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${farmerToken}`,
      },
    },
    { batchCode: "SNJ-TEST-INCOMPLETE" }
  );
  assert(missingFieldRes.statusCode === 400, `Reject batch with missing required fields with 400 (got ${missingFieldRes.statusCode})`);

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
