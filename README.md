Terminal 1 — local blockchain (leave running)

bash
cd smart-contracts
npx hardhat node

Terminal 2 — deploy the contract (only if the node above just started fresh)

bash
cd smart-contracts
npx hardhat run scripts/deploy.js --network localhost


Terminal 3 — backend (leave running)

bash
cd backend
node server.js


Terminal 4 — frontend (leave running)

bash
cd frontend
npm run dev