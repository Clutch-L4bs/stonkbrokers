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

  let stockTokenAddresses = parseStockTokens();
  let mockTokenAddress = null;

  if (stockTokenAddresses.length === 0) {
    console.log("No STOCK_TOKEN_ADDRESSES provided. Deploying local mock stock token.");
    const Token = await hre.ethers.getContractFactory("RobinhoodStockToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();
    mockTokenAddress = await token.getAddress();
    stockTokenAddresses = [mockTokenAddress];
    console.log(`RobinhoodStockToken deployed: ${mockTokenAddress}`);
  } else {
    console.log(`Using ${stockTokenAddresses.length} provided stock tokens.`);
  }

  const Registry = await hre.ethers.getContractFactory("ERC6551Registry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`ERC6551Registry deployed: ${registryAddress}`);

  const AccountImpl = await hre.ethers.getContractFactory("StonkBroker6551Account");
  const accountImpl = await AccountImpl.deploy();
  await accountImpl.waitForDeployment();
  const accountImplAddress = await accountImpl.getAddress();
  console.log(`StonkBroker6551Account impl deployed: ${accountImplAddress}`);

  const NFT = await hre.ethers.getContractFactory("BrokerWalletPunks");
  const nft = await NFT.deploy(stockTokenAddresses, registryAddress, accountImplAddress, deployer.address);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log(`BrokerWalletPunks deployed: ${nftAddress}`);

  if (mockTokenAddress) {
    const token = await hre.ethers.getContractAt("RobinhoodStockToken", mockTokenAddress);
    const tx1 = await token.setMinter(deployer.address);
    await tx1.wait();
    const inventory = hre.ethers.parseUnits("1000000", 18);
    const tx2 = await token.mint(nftAddress, inventory);
    await tx2.wait();
    console.log(`Prefunded NFT contract with mock inventory: ${inventory}`);
  }

  console.log("\nCopy these into .env / ui config:");
  console.log(`NFT_CONTRACT_ADDRESS=${nftAddress}`);
  console.log(`STOCK_TOKEN_ADDRESSES=${stockTokenAddresses.join(",")}`);
  console.log(`ERC6551_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`ERC6551_ACCOUNT_IMPLEMENTATION=${accountImplAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
