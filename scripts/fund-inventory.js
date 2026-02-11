const hre = require("hardhat");

async function main() {
  const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
  const tokenAddress = process.env.TOKEN_TO_FUND;
  const amountRaw = process.env.FUND_AMOUNT_WEI;

  if (!nftAddress) throw new Error("Set NFT_CONTRACT_ADDRESS.");
  if (!tokenAddress) throw new Error("Set TOKEN_TO_FUND.");
  if (!amountRaw) throw new Error("Set FUND_AMOUNT_WEI.");

  const amount = BigInt(amountRaw);
  const [signer] = await hre.ethers.getSigners();
  const token = new hre.ethers.Contract(
    tokenAddress,
    ["function transfer(address to, uint256 amount) returns (bool)", "function balanceOf(address account) view returns (uint256)"],
    signer
  );

  const before = await token.balanceOf(nftAddress);
  const tx = await token.transfer(nftAddress, amount);
  await tx.wait();
  const after = await token.balanceOf(nftAddress);

  console.log(`Funded NFT contract ${nftAddress}`);
  console.log(`Token: ${tokenAddress}`);
  console.log(`Amount transferred: ${amount}`);
  console.log(`Balance before: ${before}`);
  console.log(`Balance after : ${after}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
