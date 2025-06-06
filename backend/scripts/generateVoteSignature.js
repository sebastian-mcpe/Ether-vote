const ethers = require("ethers");
const dotenv = require("dotenv");
const fs = require("fs");
dotenv.config();

/**
 * Usage:
 *   node generateVoteSignature.js <socialId> <electionId> <candidate>
 *
 *   e.g.
 *     node generateVoteSignature.js alice123 1 "Alice"
 */
async function main() {
  const [,, socialId, electionIdRaw, candidate] = process.argv;
  if (!socialId || !electionIdRaw || !candidate) {
    console.error("Usage: node generateVoteSignature.js <socialId> <electionId> <candidate>");
    process.exit(1);
  }

  const electionId = Number(electionIdRaw);
  // Load the users.json produced by your API’s /users/register endpoint
  const users = JSON.parse(fs.readFileSync("./users.json", "utf8"));
  const user = users[socialId];
  if (!user) {
    console.error(`No user found for socialId="${socialId}"`);
    process.exit(1);
  }

  const voterAddress = user.address;
  const wallet = new ethers.Wallet(user.privateKey);

  // Recreate on‐chain message: keccak256(electionId, candidate, voterAddress)
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "string", "address"],
    [electionId, candidate, voterAddress]
  );
  const ethMessage = ethers.hashMessage(ethers.getBytes(messageHash));
  const signature = await wallet.signMessage(ethers.getBytes(ethMessage));

  console.log("Signature:", signature);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
