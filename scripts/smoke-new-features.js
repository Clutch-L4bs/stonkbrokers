const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function nowIso() {
  return new Date().toISOString();
}

async function codeSize(address) {
  const code = await hre.ethers.provider.getCode(address);
  if (!code || code === "0x") return 0;
  // bytes length = (hexLen-2)/2
  return (code.length - 2) / 2;
}

async function safeCall(contract, fn, args = []) {
  try {
    const res = await contract[fn](...args);
    return { ok: true, res };
  } catch (e) {
    return { ok: false, err: e };
  }
}

async function main() {
  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  // Defaults to the addresses we deployed in this session, but can be overridden by env.
  const ADDR = {
    WETH9: process.env.WETH9_ADDRESS || "0x37E402B8081eFcE1D82A09a066512278006e4691",
    UNISWAP_V3_FACTORY:
      process.env.UNISWAP_V3_FACTORY_ADDRESS || "0xFECCB63CD759d768538458Ea56F47eA8004323c1",
    UNISWAP_V3_SWAP_ROUTER:
      process.env.UNISWAP_V3_SWAP_ROUTER_ADDRESS || "0x1b32F47434a7EF83E97d0675C823E547F9266725",
    UNISWAP_V3_QUOTER_V2:
      process.env.UNISWAP_V3_QUOTER_V2_ADDRESS || "0x126f1c1F29A0f49c5D33e0139a5Da1FE25590dB1",
    UNISWAP_V3_POSITION_MANAGER:
      process.env.UNISWAP_V3_POSITION_MANAGER_ADDRESS || "0xBc82a9aA33ff24FCd56D36a0fB0a2105B193A327",
    UNISWAP_V3_TICK_LENS:
      process.env.UNISWAP_V3_TICK_LENS_ADDRESS || "0xE66Db3CB63A48175479c75D7335d7E4969F2E4b5",
    UNISWAP_V3_TOKEN_DESCRIPTOR:
      process.env.UNISWAP_V3_TOKEN_DESCRIPTOR_ADDRESS || "0x46b3416643685C27Acea90eF091052B80208B732",
    UNISWAP_V3_NFT_DESCRIPTOR_LIB:
      process.env.UNISWAP_V3_NFT_DESCRIPTOR_LIB || "0x29b6eA577382BAA093e10d87dCC9Ca1016CA91Ad",

    STONK_TOKEN_REGISTRY:
      process.env.STONK_TOKEN_REGISTRY_ADDRESS || "0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b",
    STONK_LAUNCHER_FACTORY:
      process.env.STONK_LAUNCHER_FACTORY_ADDRESS || "0xEA095646EC6A56EDbFEe84cCcf23eFCec12566A0",
    STONK_TWAP_ORACLE:
      process.env.STONK_TWAP_ORACLE_ADDRESS || "0x0C587FcEEAAB8E7AAae0135B89536b8E66F0D4Ac",
    STONK_OPTION_NFT:
      process.env.STONK_OPTION_NFT_ADDRESS || "0x0bc280c373505e2C429f9416da32f3d7adAA4050",
    STONK_COVERED_CALL_VAULT:
      process.env.STONK_COVERED_CALL_VAULT_ADDRESS || "0x055d84908672b9be53275963862614aEA9CDB98B",
    STONK_FAUCET:
      process.env.FAUCET_CONTRACT_ADDRESS || "0x270DDc8a2cd712770c7981383cce7517974D5047",
  };

  const lines = [];
  lines.push(`# Smoke Test: New Features`);
  lines.push(``);
  lines.push(`- Time: ${nowIso()}`);
  lines.push(`- Network: ${network}`);
  lines.push(`- ChainId: ${chainId}`);
  lines.push(``);

  async function checkContract(name, address, calls = []) {
    const size = await codeSize(address);
    const ok = size > 0;
    lines.push(`## ${name}`);
    lines.push(`- Address: \`${address}\``);
    lines.push(`- Code: ${ok ? `OK (${size} bytes)` : "MISSING (no bytecode)"}`);
    if (!ok) {
      lines.push(``);
      return { ok: false };
    }

    for (const c of calls) {
      const { label, contract, fn, args } = c;
      const r = await safeCall(contract, fn, args || []);
      if (r.ok) {
        lines.push(`- ${label}: OK`);
      } else {
        lines.push(`- ${label}: FAIL (${String(r.err?.message || r.err)})`);
      }
    }
    lines.push(``);
    return { ok: true };
  }

  // WETH9
  const wethAbi = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
  ];
  const weth = new hre.ethers.Contract(ADDR.WETH9, wethAbi, hre.ethers.provider);
  await checkContract("WETH9", ADDR.WETH9, [
    { label: "name()", contract: weth, fn: "name" },
    { label: "symbol()", contract: weth, fn: "symbol" },
    { label: "decimals()", contract: weth, fn: "decimals" },
    { label: "totalSupply()", contract: weth, fn: "totalSupply" },
  ]);

  // Uniswap core/periphery (bytecode presence only; interfaces vary by build)
  await checkContract("UniswapV3Factory", ADDR.UNISWAP_V3_FACTORY);
  await checkContract("SwapRouter", ADDR.UNISWAP_V3_SWAP_ROUTER);
  await checkContract("QuoterV2", ADDR.UNISWAP_V3_QUOTER_V2);
  await checkContract("NonfungiblePositionManager", ADDR.UNISWAP_V3_POSITION_MANAGER);
  await checkContract("TickLens", ADDR.UNISWAP_V3_TICK_LENS);
  await checkContract("TokenPositionDescriptor", ADDR.UNISWAP_V3_TOKEN_DESCRIPTOR);
  await checkContract("NFTDescriptorLibrary", ADDR.UNISWAP_V3_NFT_DESCRIPTOR_LIB);

  // Registry
  const registryAbi = [
    "function tokenCount() view returns (uint256)",
    "function launcherFactory() view returns (address)",
  ];
  const reg = new hre.ethers.Contract(ADDR.STONK_TOKEN_REGISTRY, registryAbi, hre.ethers.provider);
  await checkContract("StonkTokenRegistry", ADDR.STONK_TOKEN_REGISTRY, [
    { label: "tokenCount()", contract: reg, fn: "tokenCount" },
    { label: "launcherFactory()", contract: reg, fn: "launcherFactory" },
  ]);

  // Launcher factory
  const launcherAbi = [
    "function treasury() view returns (address)",
    "function weth() view returns (address)",
    "function positionManager() view returns (address)",
    "function registry() view returns (address)",
  ];
  const launcher = new hre.ethers.Contract(ADDR.STONK_LAUNCHER_FACTORY, launcherAbi, hre.ethers.provider);
  await checkContract("StonkLauncherFactory", ADDR.STONK_LAUNCHER_FACTORY, [
    { label: "treasury()", contract: launcher, fn: "treasury" },
    { label: "weth()", contract: launcher, fn: "weth" },
    { label: "positionManager()", contract: launcher, fn: "positionManager" },
    { label: "registry()", contract: launcher, fn: "registry" },
  ]);

  // Options
  await checkContract("StonkTwapOracle", ADDR.STONK_TWAP_ORACLE);
  await checkContract("StonkOptionPositionNFT", ADDR.STONK_OPTION_NFT);
  const coveredAbi = [
    "function oracle() view returns (address)",
    "function optionNft() view returns (address)",
    "function nextOfferId() view returns (uint256)",
  ];
  const covered = new hre.ethers.Contract(ADDR.STONK_COVERED_CALL_VAULT, coveredAbi, hre.ethers.provider);
  await checkContract("StonkCoveredCallVault", ADDR.STONK_COVERED_CALL_VAULT, [
    { label: "oracle()", contract: covered, fn: "oracle" },
    { label: "optionNft()", contract: covered, fn: "optionNft" },
    { label: "nextOfferId()", contract: covered, fn: "nextOfferId" },
  ]);

  // Faucet
  const faucetAbi = [
    "function claimAmountWei() view returns (uint256)",
    "function canClaim(address) view returns (bool)",
  ];
  const faucet = new hre.ethers.Contract(ADDR.STONK_FAUCET, faucetAbi, hre.ethers.provider);
  const [signer] = await hre.ethers.getSigners();
  await checkContract("StonkEthFaucet", ADDR.STONK_FAUCET, [
    { label: "claimAmountWei()", contract: faucet, fn: "claimAmountWei" },
    { label: "canClaim(deployer)", contract: faucet, fn: "canClaim", args: [signer.address] },
  ]);

  const outPath = path.join(process.cwd(), "smoke-test-new-features.md");
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

