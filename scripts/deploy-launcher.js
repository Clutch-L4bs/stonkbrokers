require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying launcher with: ${deployer.address}`);

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const weth = process.env.WETH9_ADDRESS;
  const positionManager = process.env.UNISWAP_V3_POSITION_MANAGER_ADDRESS;
  const registry = process.env.STONK_TOKEN_REGISTRY_ADDRESS;

  if (!weth) throw new Error("Missing WETH9_ADDRESS in .env");
  if (!positionManager) throw new Error("Missing UNISWAP_V3_POSITION_MANAGER_ADDRESS in .env");
  if (!registry) throw new Error("Missing STONK_TOKEN_REGISTRY_ADDRESS in .env");

  const Factory = await hre.ethers.getContractFactory("StonkLauncherFactory");
  const factory = await Factory.deploy(deployer.address, treasury, weth, positionManager, registry);
  await factory.waitForDeployment();
  const addr = await factory.getAddress();
  console.log(`StonkLauncherFactory deployed: ${addr}`);

  console.log("\nCopy into .env / frontend config:");
  console.log(`STONK_LAUNCHER_FACTORY_ADDRESS=${addr}`);
  console.log(`TREASURY_ADDRESS=${treasury}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

