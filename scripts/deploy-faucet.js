const hre = require("hardhat");

function parseEthToWei(value, fallback) {
  const raw = (value || "").trim();
  const safe = raw.length ? raw : fallback;
  return hre.ethers.parseEther(safe);
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying faucet with: ${deployer.address}`);

  const claimAmountWei = process.env.FAUCET_CLAIM_AMOUNT_WEI
    ? BigInt(process.env.FAUCET_CLAIM_AMOUNT_WEI)
    : parseEthToWei(process.env.FAUCET_CLAIM_AMOUNT_ETH, "0.012");
  const initialFundWei = process.env.FAUCET_INITIAL_FUND_WEI
    ? BigInt(process.env.FAUCET_INITIAL_FUND_WEI)
    : parseEthToWei(process.env.FAUCET_INITIAL_FUND_ETH, "1.0");

  const Faucet = await hre.ethers.getContractFactory("StonkEthFaucet");
  const faucet = await Faucet.deploy(claimAmountWei, deployer.address);
  await faucet.waitForDeployment();
  const faucetAddress = await faucet.getAddress();
  console.log(`StonkEthFaucet deployed: ${faucetAddress}`);
  console.log(`Claim amount: ${hre.ethers.formatEther(claimAmountWei)} ETH`);

  if (initialFundWei > 0n) {
    const fundTx = await deployer.sendTransaction({ to: faucetAddress, value: initialFundWei });
    await fundTx.wait();
    console.log(`Funded faucet with: ${hre.ethers.formatEther(initialFundWei)} ETH`);
    console.log(`Fund tx: ${fundTx.hash}`);
  }

  console.log("\nCopy these into .env / ui config:");
  console.log(`FAUCET_CONTRACT_ADDRESS=${faucetAddress}`);
  console.log(`FAUCET_CLAIM_AMOUNT_WEI=${claimAmountWei.toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
