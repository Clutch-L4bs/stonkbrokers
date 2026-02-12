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
  const legacyExpandedCollection =
    process.env.LEGACY_EXPANDED_NFT_CONTRACT_ADDRESS ||
    process.env.EXPANDED_NFT_CONTRACT_ADDRESS ||
    "";

  const registryAddress = process.env.ERC6551_REGISTRY_ADDRESS;
  const accountImplAddress = process.env.ERC6551_ACCOUNT_IMPLEMENTATION;
  if (!registryAddress || !accountImplAddress) {
    throw new Error("Set ERC6551_REGISTRY_ADDRESS and ERC6551_ACCOUNT_IMPLEMENTATION in .env");
  }

  let startTokenId = process.env.CONTINUATION_START_TOKEN_ID
    ? Number(process.env.CONTINUATION_START_TOKEN_ID)
    : 0;
  const endTokenId = process.env.EXPANDED_END_TOKEN_ID
    ? Number(process.env.EXPANDED_END_TOKEN_ID)
    : 4444;

  if (!startTokenId && legacyExpandedCollection) {
    const legacyAbi = ["function totalSupply() view returns (uint256)"];
    const legacy = new hre.ethers.Contract(legacyExpandedCollection, legacyAbi, deployer);
    const legacySupply = Number(await legacy.totalSupply());
    startTokenId = 445 + legacySupply;
    console.log(`Detected legacy expanded supply: ${legacySupply}`);
  }
  if (!startTokenId) {
    startTokenId = 445;
  }
  if (startTokenId > endTokenId) {
    throw new Error(`Invalid continuation window: start=${startTokenId}, end=${endTokenId}`);
  }
  console.log(`Continuation range: #${startTokenId} -> #${endTokenId}`);

  const Expanded = await hre.ethers.getContractFactory("BrokerWalletPunksExpanded");
  const expanded = await Expanded.deploy(
    stockTokenAddresses,
    startTokenId,
    endTokenId,
    registryAddress,
    accountImplAddress,
    deployer.address
  );
  await expanded.waitForDeployment();
  const expandedAddress = await expanded.getAddress();
  console.log(`BrokerWalletPunksExpanded deployed: ${expandedAddress}`);

  const Marketplace = await hre.ethers.getContractFactory("StonkBrokersMarketplace");
  const marketplace = await Marketplace.deploy(
    originalCollection,
    legacyExpandedCollection || hre.ethers.ZeroAddress,
    expandedAddress,
    deployer.address
  );
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`StonkBrokersMarketplace deployed: ${marketplaceAddress}`);

  console.log("\nCopy these into .env / ui config:");
  console.log(`ORIGINAL_NFT_CONTRACT_ADDRESS=${originalCollection}`);
  console.log(`LEGACY_EXPANDED_NFT_CONTRACT_ADDRESS=${legacyExpandedCollection}`);
  console.log(`EXPANDED_NFT_CONTRACT_ADDRESS=${expandedAddress}`);
  console.log(`MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log(`CONTINUATION_START_TOKEN_ID=${startTokenId}`);
  console.log(`EXPANDED_END_TOKEN_ID=${endTokenId}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
