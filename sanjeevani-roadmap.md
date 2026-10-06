# Sanjeevani — Full Build Roadmap

Stack: Next.js (frontend) · Express + Prisma/Postgres (backend) · Solidity + Hardhat (smart contracts) · IPFS (Pinata)

Rule for every phase: **don't move to the next one until the current one is actually tested and working**, not just "written."

---

## Overall Progress Summary

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 1** | Database & API foundation | ✅ **Completed & Tested** |
| **Phase 2** | Smart contract (standalone) | ✅ **Completed & Tested** (5/5 unit tests pass) |
| **Phase 3** | Connect backend to the contract | ✅ **Completed & Tested** |
| **Phase 4** | Auth & roles (+ BOLA fix & monotonic supply chain) | ✅ **Completed & Tested** (E2E suite pass) |
| **Phase 5** | IPFS integration (Pinata + SHA-256 hash) | ✅ **Completed & Tested** |
| **Phase 6** | Frontend dashboards | ✅ **Completed & Tested** (Farmer, Admin, Actor dashboards + Next.js build pass) |
| **Phase 7** | QR code + public verification page | ⏳ **Upcoming** |
| **Phase 8** | Polish & deploy | ⏳ **Upcoming** |

---

## Phase 1 — Database & API foundation

- [x] Design `schema.prisma` (User, Batch, BatchEvent, LabCertificate, Product, ProductBatch)
- [x] Set up local Postgres, get `prisma migrate dev` working
- [x] Convert everything to plain JS (`prisma.config.js`, `client.js`)
- [x] `client.js` — Prisma Client wired via `@prisma/adapter-pg`
- [x] `server.js` — Express app, `POST /batches` tested (201 Created)
- [x] `GET /batches/:id` — tested, returns batch + events + farmer
- [x] `GET /batches` — list/search batches (basic pagination)
- [x] `POST /users` — register a new actor (farmer, lab, etc.)
- [x] Basic input validation on routes (reject missing/malformed fields with 400, not a crash)

**Checkpoint:** ✅ **PASSED** — Users and batches can be created and retrieved through HTTP API endpoints with full relations and validation.

---

## Phase 2 — Smart contract (standalone)

- [x] Write `HerbBatch.sol` (role-gated batch creation + stage events; backend gas relayer model)
- [x] Set up Hardhat properly in `smart-contracts/`, confirm `npx hardhat compile` works
- [x] Install OpenZeppelin (`@openzeppelin/contracts`)
- [x] Write `scripts/deploy.js` — deploys to Hardhat's local in-memory blockchain
- [x] Write unit tests in `test/HerbBatch.test.js` (ownership, creation, non-owner rejection, stage addition events, missing batch rejection) — *5/5 passing*
- [x] Write `scripts/interact.js` — interactive script that deploys, creates a batch, adds an event, and inspects history logs

**Checkpoint:** ✅ **PASSED** — Contract compiles, deploys locally, and passes all automated Hardhat unit tests in isolation.

---

## Phase 3 — Connect backend to the contract

- [x] Install `ethers.js` in `backend/`
- [x] Write `backend/src/blockchain/contract.js` — loads deployed contract address + ABI, exposes `createBatchOnChain()`, `addEventOnChain()`
- [x] Update `POST /batches` — writes to Postgres, calls `createBatchOnChain()`, saves returned `txHash` and `onChainId`
- [x] Update `POST /batches/:id/events` — writes event to Postgres, calls `addEventOnChain()`, saves `txHash`
- [x] Decide + document chain failure strategy: implemented `withRetry()`; on persistent chain failure, DB row is retained as source of truth, `txHash` remains null (signaling pending chain sync), returns 201 with warning

**Checkpoint:** ✅ **PASSED** — Creating batches and events updates Postgres and executes on-chain transactions linked by `txHash`.

---

## Phase 4 — Auth & roles

- [x] Decide auth approach: Email/Password + JWT with `bcryptjs` password hashing
- [x] Middleware: `requireAuth`, `requireRole(['FARMER'])` etc. — rejects unauthorized actor requests
- [x] Lock down routes: only `FARMER` can call `POST /batches`, only authorized roles for each stage transition
- [x] Admin verification gate: `isVerified` flag checked on actor actions; added `PATCH /users/:id/verify` for admin approvals
- [x] Monotonic supply chain enforcement: stages move strictly forward (`COLLECTED` -> `AGGREGATED` -> `PROCESSED` -> `LAB_TESTED` -> `MANUFACTURED` -> `PACKAGED` -> `DISTRIBUTED`), rejecting backward or duplicate steps (409 Conflict)
- [x] Custody tracking & BOLA fix: `currentCustodianId` field on `Batch`, `POST /batches/:id/transfer-custody`, ensuring only the active custodian (or admin) can advance the batch

**Checkpoint:** ✅ **PASSED** — Full RBAC, custody authorization, and lifecycle guards verified via `backend/scripts/test-e2e.js`.

---

## Phase 5 — IPFS integration

- [x] Pick a pinning service: Pinata SDK (`pinata`)
- [x] `backend/src/ipfs/upload.js` — uploads file buffer to IPFS, computes SHA-256 `dataHash`, returns CID & hash
- [x] Wire file uploads into event-creation route: `multer` memory storage on `POST /batches/:id/events` (`report` field), pins file to IPFS, stores CID in Postgres, and passes CID + SHA-256 hash to the smart contract

**Checkpoint:** ✅ **PASSED** — Uploading reports produces real IPFS CIDs anchored both in Postgres and on-chain; verified with `backend/scripts/test-ipfs-upload.js`.

---

## Phase 6 — Frontend, one dashboard at a time

- [x] Next.js project setup with Tailwind CSS (`frontend/`)
- [x] **Farmer dashboard** (`FarmerDashboard.js`) — batch creation form with browser GPS auto-fill, list of batches in custody (`/my-batches`)
- [x] **Lab dashboard** (`ActorDashboard.js`) — testing stage submission (`LAB_TESTED`), report file attachment pinned to IPFS, onward custody handoff
- [x] **Processor / Manufacturer / Aggregator / Distributor dashboards** (`ActorDashboard.js`) — stage transitions (`AGGREGATED`, `PROCESSED`, `MANUFACTURED`, `PACKAGED`, `DISTRIBUTED`), optional file attachments, and custody transfer picker (`GET /actors`)
- [x] **Admin panel** (`AdminDashboard.js`) — user verification queue (`PATCH /users/:id/verify`), verified user roster, and global batch monitoring
- [x] Shared components & views — batch timeline with on-chain `txHash` & IPFS gateway links, status badges (`STAGE_BADGE`)
- [x] Backend API support — `GET /actors` registered at top-level for verified actor lookup by role

**Checkpoint:** ✅ **PASSED** — All dashboards built and connected with backend APIs, authentication, and IPFS uploads; Next.js production build passing.

---

## Phase 7 — QR code + public verification page

- [ ] Generate a QR code per `Product` (encodes a URL like `/verify/{qrCode}`)
- [ ] Build `/verify/[code]` page — public, no login — shows the product's full batch history: species, farmer region, collection date, every stage, lab result, all backed by on-chain `txHash` links (e.g. to a testnet explorer)

**Checkpoint:** this is the actual "wow" moment of the demo — scan a QR, see a verified, tamper-evident supply chain history.

---

## Phase 8 — Polish & deploy

- [ ] Deploy contract to a public testnet (Polygon Amoy or Sepolia) instead of local Hardhat
- [ ] Deploy backend (Railway/Render) + frontend (Vercel)
- [ ] Basic error states/loading states across the UI
- [ ] Write a real README explaining the architecture (good for a portfolio/resume too)

---



