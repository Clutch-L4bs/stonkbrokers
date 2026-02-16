const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying options with: ${deployer.address}`);

  const Oracle = await hre.ethers.getContractFactory("StonkTwapOracle");
  const oracle = await Oracle.deploy();
  await oracle.waitForDeployment();
  const oracleAddr = await oracle.getAddress();
  console.log(`StonkTwapOracle: ${oracleAddr}`);

  const Nft = await hre.ethers.getContractFactory("StonkOptionPositionNFT");
  const nft = await Nft.deploy(deployer.address);
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log(`StonkOptionPositionNFT: ${nftAddr}`);

  const Vault = await hre.ethers.getContractFactory("StonkCoveredCallVault");
  const vault = await Vault.deploy(oracleAddr, nftAddr, deployer.address);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`StonkCoveredCallVault: ${vaultAddr}`);

  // Transfer minting authority to the vault.
  const tx = await nft.transferOwnership(vaultAddr);
  await tx.wait();
  console.log(`Option NFT ownership -> vault: ${tx.hash}`);

  console.log("\nCopy into .env / frontend config:");
  console.log(`STONK_TWAP_ORACLE_ADDRESS=${oracleAddr}`);
  console.log(`STONK_OPTION_NFT_ADDRESS=${nftAddr}`);
  console.log(`STONK_COVERED_CALL_VAULT_ADDRESS=${vaultAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

