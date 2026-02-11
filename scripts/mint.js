const hre = require("hardhat");

async function main() {
  const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
  if (!nftAddress) {
    throw new Error("Set NFT_CONTRACT_ADDRESS in your environment.");
  }

  const quantity = Number(process.env.MINT_QUANTITY || "1");
  const nft = await hre.ethers.getContractAt("BrokerWalletPunks", nftAddress);
  const price = await nft.MINT_PRICE();
  const value = price * BigInt(quantity);

  const tx = await nft.mint(quantity, { value });
  const receipt = await tx.wait();
  console.log(`Minted ${quantity} token(s). Tx: ${receipt.hash}`);

  const totalSupply = Number(await nft.totalSupply());
  const firstMinted = totalSupply - quantity + 1;
  for (let tokenId = firstMinted; tokenId <= totalSupply; tokenId++) {
    const wallet = await nft.tokenWallet(tokenId);
    const token = await nft.fundedToken(tokenId);
    const initialGrant = await nft.initialWalletGrant(tokenId);
    console.log(`Token #${tokenId} wallet: ${wallet}, token: ${token}, initial grant: ${initialGrant}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
