const hre = require("hardhat");

function parseStockTokens() {
  return (process.env.STOCK_TOKEN_ADDRESSES || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

async function main() {
  const nftAddress = process.env.TARGET_NFT_CONTRACT_ADDRESS
    || process.env.EXPANDED_NFT_CONTRACT_ADDRESS
    || process.env.NFT_CONTRACT_ADDRESS;
  const stockTokens = parseStockTokens();
  const humanAmount = process.env.FUND_TOKEN_AMOUNT || "5";

  if (!nftAddress) throw new Error("Set TARGET_NFT_CONTRACT_ADDRESS, EXPANDED_NFT_CONTRACT_ADDRESS, or NFT_CONTRACT_ADDRESS in .env");
  if (stockTokens.length === 0) throw new Error("Set STOCK_TOKEN_ADDRESSES in .env");

  const [signer] = await hre.ethers.getSigners();
  console.log(`Seeding from: ${signer.address}`);
  console.log(`Target NFT contract: ${nftAddress}`);
  console.log(`Per token amount: ${humanAmount}`);

  for (const tokenAddress of stockTokens) {
    const token = new hre.ethers.Contract(
      tokenAddress,
      [
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
        "function balanceOf(address) view returns (uint256)",
        "function transfer(address,uint256) returns (bool)",
      ],
      signer
    );

    const [decimals, symbol, signerBalBefore, nftBalBefore] = await Promise.all([
      token.decimals(),
      token.symbol(),
      token.balanceOf(signer.address),
      token.balanceOf(nftAddress),
    ]);

    const amount = hre.ethers.parseUnits(humanAmount, Number(decimals));
    if (signerBalBefore < amount) {
      throw new Error(`Insufficient ${symbol} balance. Need ${amount}, have ${signerBalBefore}`);
    }

    const tx = await token.transfer(nftAddress, amount);
    await tx.wait();

    const [signerBalAfter, nftBalAfter] = await Promise.all([token.balanceOf(signer.address), token.balanceOf(nftAddress)]);
    console.log(`Seeded ${symbol} (${tokenAddress})`);
    console.log(`  amount: ${amount}`);
    console.log(`  signer balance: ${signerBalBefore} -> ${signerBalAfter}`);
    console.log(`  nft balance   : ${nftBalBefore} -> ${nftBalAfter}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
