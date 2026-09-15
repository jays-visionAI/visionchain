/**
 * Live vUSD mint test on visionV2 — proves minting works and shows where tokens land.
 *   npx hardhat run blockchain/scripts/mint-test.js --network visionV2 --config blockchain/hardhat.config.js
 */
const { ethers } = require("hardhat");
const vdep = require("../deployed-vusd.visionV2.json");

async function main() {
  const [treasury] = await ethers.getSigners();
  const vusdAddr = vdep.contracts.VisionStableUSD;
  const vusd = await ethers.getContractAt("VisionStableUSD", vusdAddr, treasury);

  // A fresh recipient — stands in for a user's wallet address (e.g. a Vision Chain EOA).
  const recipient = ethers.Wallet.createRandom();
  console.log("vUSD:", vusdAddr, "| symbol:", await vusd.symbol(), "| decimals:", (await vusd.decimals()).toString());
  console.log("Minter (treasury, has MINTER_ROLE):", treasury.address);
  console.log("Recipient (fresh wallet):", recipient.address);

  const hasRole = await vusd.hasRole(await vusd.MINTER_ROLE(), treasury.address);
  console.log("treasury has MINTER_ROLE:", hasRole);

  const before = await vusd.balanceOf(recipient.address);
  const amount = ethers.parseEther("1000"); // 1,000 vUSD (18 dec)
  console.log("\nMinting 1000 vUSD to recipient...");
  const tx = await vusd.mint(recipient.address, amount);
  const rcpt = await tx.wait();
  const after = await vusd.balanceOf(recipient.address);

  console.log("tx:", rcpt.hash);
  console.log("recipient vUSD balance:", ethers.formatEther(before), "->", ethers.formatEther(after));
  console.log("explorer:", `https://www.visionchain.co/visionscan/tx/${rcpt.hash}`);
  console.log("token in wallet:", `https://www.visionchain.co/visionscan/token/${vusdAddr}?a=${recipient.address}`);
  if (after - before !== amount) throw new Error("mint amount mismatch");
  console.log("\n✅ Minting works on testnet. Tokens are a standard ERC-20 balance held at the recipient's address.");
}
main().catch((e) => { console.error("💥", e.message || e); process.exit(1); });
