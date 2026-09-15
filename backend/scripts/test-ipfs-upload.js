const fs = require("fs");
const { uploadFileToIPFS } = require("../src/ipfs/upload");

async function main() {
  const buffer = fs.readFileSync("./scripts/test-ipfs-upload.js"); // uploads this script itself, just as a test file
  const result = await uploadFileToIPFS(buffer, "test-file.js", "text/plain");
  console.log("Uploaded! CID:", result.ipfsCid);
  console.log("Hash:", result.dataHash);
  console.log(`View at: https://${process.env.PINATA_GATEWAY}/ipfs/${result.ipfsCid}`);
}

main().catch(console.error);