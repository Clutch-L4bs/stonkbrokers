const hre = require("hardhat");

async function main() {
  const nftAddress = process.env.NFT_CONTRACT_ADDRESS;
  const tokenId = Number(process.env.TOKEN_ID || "1");
  const amountEnv = process.env.CLAIM_AMOUNT_WEI;

  if (!nftAddress) {
    throw new Error("Set NFT_CONTRACT_ADDRESS in your environment.");
  }

  const nft = await hre.ethers.getContractAt("BrokerWalletPunks", nftAddress);
  const walletAddress = await nft.tokenWallet(tokenId);
  if (walletAddress === hre.ethers.ZeroAddress) {
    throw new Error(`Token #${tokenId} has no wallet account.`);
  }

  const stockTokenAddress = await nft.fundedToken(tokenId);
  const token = new hre.ethers.Contract(stockTokenAddress, ["function balanceOf(address) view returns (uint256)"], hre.ethers.provider);
  const wallet = await hre.ethers.getContractAt("StonkBroker6551Account", walletAddress);
  const [caller] = await hre.ethers.getSigners();

  const balance = await token.balanceOf(walletAddress);
  if (balance === 0n) {
    console.log(`Wallet for token #${tokenId} has no stock tokens.`);
    return;
  }

  const amount = amountEnv ? BigInt(amountEnv) : balance;
  if (amount > balance) {
    throw new Error("CLAIM_AMOUNT_WEI exceeds wallet balance");
  }

  const tx = await wallet.executeTokenTransfer(stockTokenAddress, caller.address, amount);
  const receipt = await tx.wait();
  console.log(`Transferred ${amount} wei of token ${stockTokenAddress} from token #${tokenId} wallet. Tx: ${receipt.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
