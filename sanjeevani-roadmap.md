# Sanjeevani — Full Build Roadmap

Stack: Next.js (frontend) · Express + Prisma/Postgres (backend) · Solidity + Hardhat (smart contracts) · IPFS

Rule for every phase: **don't move to the next one until the current one is actually tested and working**, not just "written."

---

## Phase 1 — Database & API foundation

- [x] Design `schema.prisma` (User, Batch, BatchEvent, LabCertificate, Product, ProductBatch)
- [x] Set up local Postgres, get `prisma migrate dev` working
- [x] Convert everything to plain JS (`prisma.config.js`, `client.js`)
- [x] `client.js` — Prisma Client wired via `@prisma/adapter-pg`
- [x] `server.js` — Express app, `POST /batches` tested (201 Created)
- [ ] `GET /batches/:id` — tested, returns batch + events + farmer
- [ ] `GET /batches` — list/search batches (basic pagination)
- [ ] `POST /users` — register a new actor (farmer, lab, etc.)
- [ ] Basic input validation on routes (reject missing/malformed fields with 400, not a crash)

**Checkpoint:** you can create users and batches, and fetch a batch's full details, all through HTTP — no blockchain involved yet.

---

## Phase 2 — Smart contract (standalone)

- [x] Write `HerbBatch.sol` (role-gated batch creation + stage events)
- [ ] Set up Hardhat properly in `smart-contracts/`, confirm `npx hardhat compile` works
- [ ] Install OpenZeppelin (`@openzeppelin/contracts`)
- [ ] Write `scripts/deploy.js` — deploys to Hardhat's local in-memory blockchain
- [ ] Write a few basic tests in `test/HerbBatch.test.js` (create a batch, add an event, confirm role checks reject unauthorized callers)
- [ ] Write `scripts/interact.js` — a throwaway script that deploys the contract and calls `createBatch()` / `addEvent()` from the command line, prints results

**Checkpoint:** you can deploy the contract locally and call its functions from a script, entirely separate from the backend — proves the contract logic works in isolation.

---

## Phase 3 — Connect backend to the contract

- [ ] Install `ethers.js` in `backend/`
- [ ] Write `backend/src/blockchain/contract.js` — loads the deployed contract address + ABI, exposes `createBatchOnChain()`, `addEventOnChain()` functions
- [ ] Update `POST /batches` — after creating the Postgres row, also call `createBatchOnChain()`, save the returned `txHash` and `onChainId` back onto the `Batch` row
- [ ] Update `POST /batches/:id/events` (new route) — same pattern: write to Postgres AND call the contract, save `txHash`
- [ ] Decide + document what happens if the blockchain call fails after the DB write succeeds (retry? mark batch as "pending chain sync"? — this is a real design decision, not a throwaway detail)

**Checkpoint:** creating a batch through your API results in both a Postgres row *and* a real on-chain transaction, linked by `txHash`.

---

## Phase 4 — Auth & roles

- [ ] Decide auth approach: simplest for a personal project is wallet-based (MetaMask sign-in) since you already need wallet addresses; alternative is email/password + JWT
- [ ] Middleware: `requireAuth`, `requireRole(['FARMER'])` etc. — reject requests from the wrong actor type
- [ ] Lock down routes: only a `FARMER` can call `POST /batches`, only a `LAB` can add a `LAB_TESTED` event, etc. — mirrors the role checks already in `HerbBatch.sol`

**Checkpoint:** a logged-in farmer can create batches; a logged-in lab cannot.

---

## Phase 5 — IPFS integration

- [ ] Pick a pinning service (Pinata or web3.storage — both have free tiers)
- [ ] `backend/src/ipfs/upload.js` — uploads a file (lab report PDF, photo) and returns a CID
- [ ] Wire file uploads into the event-creation route (e.g. lab uploads their PDF report as part of adding a `LAB_TESTED` event) — CID gets stored in Postgres and passed to the contract call

**Checkpoint:** uploading a lab report actually produces a real IPFS CID, stored both in Postgres and on-chain.

---

## Phase 6 — Frontend, one dashboard at a time

Build and test each of these fully before starting the next:

- [ ] **Farmer dashboard** — form to create a batch (species, quantity, GPS — can auto-fill from browser geolocation), list of their past batches
- [ ] **Lab dashboard** — list of batches awaiting testing, form to upload report + result for one
- [ ] **Processor/Manufacturer dashboard** — similar pattern for their stage
- [ ] **Admin panel** — approve/verify new users before they can act (matches `isVerified` in your schema)
- [ ] Shared components: batch timeline view (shows all `BatchEvent`s in order), status badges

**Checkpoint:** a batch can be walked through its full lifecycle using only the UI, no manual API calls.

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


