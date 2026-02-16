const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying StonkTokenRegistry with: ${deployer.address}`);

  const Registry = await hre.ethers.getContractFactory("StonkTokenRegistry");
  const registry = await Registry.deploy(deployer.address);
  await registry.waitForDeployment();
  const addr = await registry.getAddress();
  console.log(`StonkTokenRegistry deployed: ${addr}`);

  console.log("\nCopy into .env / frontend config:");
  console.log(`STONK_TOKEN_REGISTRY_ADDRESS=${addr}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

