const hre = require("hardhat");

function parseStockTokens() {
  const raw = process.env.STOCK_TOKEN_ADDRESSES || "";
  return raw
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying with: ${deployer.address}`);

  const stockTokenAddresses = parseStockTokens();
  if (stockTokenAddresses.length === 0) {
    throw new Error("Set STOCK_TOKEN_ADDRESSES in .env");
  }

  const originalCollection = process.env.ORIGINAL_NFT_CONTRACT_ADDRESS || process.env.NFT_CONTRACT_ADDRESS;
  if (!originalCollection) {
    throw new Error("Set ORIGINAL_NFT_CONTRACT_ADDRESS (or NFT_CONTRACT_ADDRESS) in .env");
  }

  const registryAddress = process.env.ERC6551_REGISTRY_ADDRESS;
  const accountImplAddress = process.env.ERC6551_ACCOUNT_IMPLEMENTATION;
  if (!registryAddress || !accountImplAddress) {
    throw new Error("Set ERC6551_REGISTRY_ADDRESS and ERC6551_ACCOUNT_IMPLEMENTATION in .env");
  }

  const Expanded = await hre.ethers.getContractFactory("BrokerWalletPunksExpanded");
  const expanded = await Expanded.deploy(
    stockTokenAddresses,
    registryAddress,
    accountImplAddress,
    deployer.address
  );
  await expanded.waitForDeployment();
  const expandedAddress = await expanded.getAddress();
  console.log(`BrokerWalletPunksExpanded deployed: ${expandedAddress}`);

  const Marketplace = await hre.ethers.getContractFactory("StonkBrokersMarketplace");
  const marketplace = await Marketplace.deploy(originalCollection, expandedAddress, deployer.address);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`StonkBrokersMarketplace deployed: ${marketplaceAddress}`);

  console.log("\nCopy these into .env / ui config:");
  console.log(`ORIGINAL_NFT_CONTRACT_ADDRESS=${originalCollection}`);
  console.log(`EXPANDED_NFT_CONTRACT_ADDRESS=${expandedAddress}`);
  console.log(`MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
