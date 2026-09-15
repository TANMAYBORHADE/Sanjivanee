require("dotenv/config");
const { PinataSDK } = require("pinata");
const crypto = require("crypto");

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
  pinataGateway: process.env.PINATA_GATEWAY,
});

/**
 * Uploads a file buffer to IPFS via Pinata, and computes a sha256 hash of
 * its contents. Returns both — the CID goes on-chain as a pointer, the
 * hash goes on-chain as a fingerprint anyone can use to verify the file
 * they're looking at hasn't been altered since it was originally uploaded.
 */
async function uploadFileToIPFS(buffer, filename, mimeType) {
  const dataHash = "0x" + crypto.createHash("sha256").update(buffer).digest("hex");

  const blob = new Blob([buffer], { type: mimeType });
  const file = new File([blob], filename, { type: mimeType });

  const result = await pinata.upload.public.file(file);

  return {
    ipfsCid: result.cid,
    dataHash,
  };
}

module.exports = { uploadFileToIPFS };