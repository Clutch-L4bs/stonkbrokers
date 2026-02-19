/**
 * Deploy 20 tokens with WORKING images served from /tokens/*.svg,
 * varied configs, buys, finalization, and swaps.
 *
 * Run:  npx hardhat run scripts/seed-20-v2.js --network robinhoodTestnet
 */
const { ethers } = require("hardhat");

const FACTORY = "0x631f9371Fd6B2C85F8f61d19A90547eE67Fa61A2";
const WETH9   = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const ROUTER  = "0x1b32F47434a7EF83E97d0675C823E547F9266725";

const FactoryABI = [
  "function createLaunch((string name,string symbol,string metadataURI,string imageURI,uint256 totalSupplyWei,uint256 creatorAllocationBps,uint256 saleBpsOfRemaining,uint256 priceWeiPerToken) p) external returns (address token, address launch)",
  "function finalizeLaunch(address launch, uint160 sqrtPriceX96, uint24 fee) external payable",
  "event LaunchCreated(address indexed creator, address indexed token, address indexed launch, string name, string symbol, string metadataURI, string imageURI)"
];
const LaunchABI = [
  "function buy() external payable",
  "function pool() external view returns (address)"
];
const ERC20ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)"
];
const WETHABI = [
  "function deposit() external payable",
  "function approve(address,uint256) external returns (bool)"
];
const RouterABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

function sqrtBigInt(n) {
  if (n < 2n) return n;
  let x0 = n, x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}

function computeSqrtPriceX96(priceWei, memeToken, weth) {
  const meme = memeToken.toLowerCase();
  const w = weth.toLowerCase();
  const token0 = meme < w ? meme : w;
  const Q96 = 2n ** 96n;
  let numerator, denominator;
  if (token0 === meme) {
    numerator = priceWei; denominator = 10n ** 18n;
  } else {
    numerator = 10n ** 18n; denominator = priceWei;
  }
  return sqrtBigInt((numerator * Q96 * Q96) / denominator);
}

function deadline() { return BigInt(Math.floor(Date.now() / 1000)) + 600n; }

const BASE_URL = "https://www.stonkbrokers.cash/tokens";

const TOKENS = [
  // Finalized + trading (16 tokens)
  { name: "Neon Protocol",    symbol: "NEON",   supply: "500000000",  price: "0.00000004", creatorBps: 200, saleBps: 6000, buyEth: "0.015", finalize: true,
    image: `${BASE_URL}/neon.svg` },
  { name: "Blaze Token",      symbol: "BLAZE",  supply: "100000000",  price: "0.0000002",  creatorBps: 300, saleBps: 5000, buyEth: "0.02",  finalize: true,
    image: `${BASE_URL}/blaze.svg` },
  { name: "Pulse Finance",    symbol: "PULSE",  supply: "250000000",  price: "0.00000008", creatorBps: 250, saleBps: 7000, buyEth: "0.01",  finalize: true,
    image: `${BASE_URL}/pulse.svg` },
  { name: "CryoSwap",         symbol: "CRYO",   supply: "1000000000", price: "0.00000001", creatorBps: 100, saleBps: 8000, buyEth: "0.008", finalize: true,
    image: `${BASE_URL}/cryo.svg` },
  { name: "Turbo Chain",      symbol: "TURBO",  supply: "420690000",  price: "0.00000005", creatorBps: 400, saleBps: 6500, buyEth: "0.018", finalize: true,
    image: `${BASE_URL}/turbo.svg` },
  { name: "Forge Labs",       symbol: "FORGE",  supply: "50000000",   price: "0.0000005",  creatorBps: 500, saleBps: 4000, buyEth: "0.025", finalize: true,
    image: `${BASE_URL}/forge.svg` },
  { name: "Nova DAO",         symbol: "NOVA",   supply: "200000000",  price: "0.0000001",  creatorBps: 300, saleBps: 5500, buyEth: "0.02",  finalize: true,
    image: `${BASE_URL}/nova.svg` },
  { name: "Drift Network",    symbol: "DRIFT",  supply: "750000000",  price: "0.00000002", creatorBps: 150, saleBps: 7500, buyEth: "0.01",  finalize: true,
    image: `${BASE_URL}/drift.svg` },
  { name: "Ember DeFi",       symbol: "EMBER",  supply: "300000000",  price: "0.00000006", creatorBps: 350, saleBps: 6000, buyEth: "0.015", finalize: true,
    image: `${BASE_URL}/ember.svg` },
  { name: "Zenith Markets",   symbol: "ZENITH", supply: "80000000",   price: "0.0000003",  creatorBps: 200, saleBps: 5000, buyEth: "0.022", finalize: true,
    image: `${BASE_URL}/zenith.svg` },
  { name: "Flux Exchange",    symbol: "FLUX",   supply: "600000000",  price: "0.00000003", creatorBps: 250, saleBps: 6500, buyEth: "0.012", finalize: true,
    image: `${BASE_URL}/flux.svg` },
  { name: "Prism Token",      symbol: "PRISM",  supply: "150000000",  price: "0.00000015", creatorBps: 300, saleBps: 5500, buyEth: "0.02",  finalize: true,
    image: `${BASE_URL}/prism.svg` },
  { name: "Volt Energy",      symbol: "VOLT",   supply: "400000000",  price: "0.00000005", creatorBps: 200, saleBps: 7000, buyEth: "0.015", finalize: true,
    image: `${BASE_URL}/volt.svg` },
  { name: "Rune Network",     symbol: "RUNE2",  supply: "120000000",  price: "0.0000002",  creatorBps: 350, saleBps: 5000, buyEth: "0.018", finalize: true,
    image: `${BASE_URL}/rune.svg` },
  { name: "Titan Shield",     symbol: "TITAN",  supply: "69000000",   price: "0.0000004",  creatorBps: 400, saleBps: 4500, buyEth: "0.025", finalize: true,
    image: `${BASE_URL}/titan.svg` },
  { name: "Spark AI",         symbol: "SPARK",  supply: "350000000",  price: "0.00000007", creatorBps: 200, saleBps: 6000, buyEth: "0.015", finalize: true,
    image: `${BASE_URL}/spark.svg` },

  // Presale only (4 tokens)
  { name: "Orbit Space",      symbol: "ORBIT",  supply: "800000000",  price: "0.00000002", creatorBps: 0,   saleBps: 10000, buyEth: "0.005", finalize: false,
    image: `${BASE_URL}/orbit.svg` },
  { name: "Hyper Labs",       symbol: "HYPER",  supply: "500000000",  price: "0.00000004", creatorBps: 100, saleBps: 9000,  buyEth: "0.008", finalize: false,
    image: `${BASE_URL}/hyper.svg` },
  { name: "Venom Protocol",   symbol: "VENOM",  supply: "200000000",  price: "0.0000001",  creatorBps: 200, saleBps: 8500,  buyEth: "0.01",  finalize: false,
    image: `${BASE_URL}/venom.svg` },
  { name: "Chaos Engine",     symbol: "CHAOS",  supply: "666000000",  price: "0.00000003", creatorBps: 0,   saleBps: 10000, buyEth: "0.003", finalize: false,
    image: `${BASE_URL}/chaos.svg` }
];

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const balance = await ethers.provider.getBalance(deployer);
  console.log(`\n  Deployer: ${deployer}`);
  console.log(`  Balance:  ${ethers.formatEther(balance)} ETH`);

  const factory = new ethers.Contract(FACTORY, FactoryABI, signer);
  const router  = new ethers.Contract(ROUTER, RouterABI, signer);
  const weth    = new ethers.Contract(WETH9, WETHABI, signer);
  const FEE = 3000;
  const created = [];

  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i];
    console.log(`\n── [${i+1}/${TOKENS.length}] $${t.symbol} — ${t.name} ──`);
    console.log(`  Image: ${t.image}`);

    const priceWei = ethers.parseEther(t.price);
    const totalSupply = ethers.parseEther(t.supply);
    let tokenAddr, launchAddr;

    try {
      const tx = await factory.createLaunch({
        name: t.name, symbol: t.symbol,
        metadataURI: "", imageURI: t.image,
        totalSupplyWei: totalSupply,
        creatorAllocationBps: BigInt(t.creatorBps),
        saleBpsOfRemaining: BigInt(t.saleBps),
        priceWeiPerToken: priceWei
      });
      const receipt = await tx.wait();
      const iface = new ethers.Interface(FactoryABI);
      for (const log of receipt.logs) {
        try {
          const p = iface.parseLog({ topics: log.topics, data: log.data });
          if (p?.name === "LaunchCreated") { tokenAddr = p.args.token; launchAddr = p.args.launch; }
        } catch {}
      }
      if (!launchAddr) throw new Error("No event");
      console.log(`  ✅ Created`);
    } catch (e) {
      console.log(`  ❌ Create failed: ${e.reason || e.message}`);
      continue;
    }

    const launch = new ethers.Contract(launchAddr, LaunchABI, signer);
    try {
      await (await launch.buy({ value: ethers.parseEther(t.buyEth) })).wait();
      console.log(`  ✅ Bought with ${t.buyEth} ETH`);
    } catch (e) {
      console.log(`  ⚠️  Buy failed: ${e.reason || e.message}`);
    }

    if (t.finalize) {
      const sqrtPrice = computeSqrtPriceX96(priceWei, tokenAddr, WETH9);
      try {
        await (await factory.finalizeLaunch(launchAddr, sqrtPrice, FEE, {
          value: ethers.parseEther("0.003"), gasLimit: 10_000_000n
        })).wait();
        const pool = await launch.pool();
        console.log(`  ✅ Finalized — pool=${pool.slice(0,10)}...`);
        created.push({ token: tokenAddr, launch: launchAddr, pool, symbol: t.symbol });
      } catch (e) {
        console.log(`  ⚠️  Finalize failed: ${e.reason || e.message}`);
        created.push({ token: tokenAddr, launch: launchAddr, pool: null, symbol: t.symbol });
      }
    } else {
      console.log(`  ℹ️  Presale only`);
      created.push({ token: tokenAddr, launch: launchAddr, pool: null, symbol: t.symbol });
    }
  }

  // Swaps
  console.log(`\n── SWAPS ──`);
  const tradeable = created.filter(c => c.pool && c.pool !== ethers.ZeroAddress);
  const swapTotal = ethers.parseEther("0.15");
  try {
    await (await weth.deposit({ value: swapTotal })).wait();
    await (await weth.approve(ROUTER, swapTotal)).wait();
    console.log(`  ✅ Wrapped ${ethers.formatEther(swapTotal)} ETH`);
  } catch (e) { console.log(`  ❌ Wrap: ${e.message}`); }

  for (const c of tradeable) {
    try {
      await (await router.exactInputSingle({
        tokenIn: WETH9, tokenOut: c.token, fee: FEE,
        recipient: deployer, deadline: deadline(),
        amountIn: ethers.parseEther("0.005"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
      })).wait();
      console.log(`  ✅ Swap WETH → $${c.symbol}`);
    } catch (e) { console.log(`  ⚠️  Swap $${c.symbol}: ${e.reason || e.message}`); }
  }

  console.log(`\n══ DONE ══`);
  console.log(`  Created: ${created.length} tokens`);
  console.log(`  Trading: ${tradeable.length}`);
  console.log(`  Presale: ${created.length - tradeable.length}`);
  const finalBal = await ethers.provider.getBalance(deployer);
  console.log(`  Balance: ${ethers.formatEther(finalBal)} ETH\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
