/**
 * Deploy 20 diverse tokens with images, varied configs, buy significant amounts,
 * and finalize most into Uniswap V3 pools with swaps.
 *
 * Run:  npx hardhat run scripts/seed-20-tokens.js --network robinhoodTestnet
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

// 20 unique tokens — varied themes, supplies, prices, and allocation strategies
const TOKENS = [
  // ── Meme / Culture Coins ──
  { name: "Chad Finance", symbol: "CHAD", supply: "1000000000", price: "0.00000001", creatorBps: 200, saleBps: 7000, buyEth: "0.1", finalize: true,
    image: "https://i.imgur.com/8bGz0Xl.png" },
  { name: "GigaBrain Token", symbol: "GIGA", supply: "420690000", price: "0.00000005", creatorBps: 300, saleBps: 6000, buyEth: "0.08", finalize: true,
    image: "https://i.imgur.com/wSTFkRM.png" },
  { name: "Based Protocol", symbol: "BASED", supply: "100000000", price: "0.0000001", creatorBps: 500, saleBps: 5000, buyEth: "0.15", finalize: true,
    image: "https://i.imgur.com/l4FnQ5v.png" },
  { name: "Wojak Coin", symbol: "WOJAK", supply: "69420000000", price: "0.000000001", creatorBps: 100, saleBps: 8000, buyEth: "0.05", finalize: true,
    image: "https://i.imgur.com/P0m5sLy.png" },
  { name: "Diamond Hands", symbol: "DIAMND", supply: "21000000", price: "0.000001", creatorBps: 400, saleBps: 5500, buyEth: "0.2", finalize: true,
    image: "https://i.imgur.com/v3OUQwu.png" },

  // ── DeFi / Tech Coins ──
  { name: "Yield Machine", symbol: "YIELD", supply: "50000000", price: "0.0000005", creatorBps: 300, saleBps: 4000, buyEth: "0.12", finalize: true,
    image: "https://i.imgur.com/6Rn6ZLP.png" },
  { name: "Flash Protocol", symbol: "FLASH", supply: "200000000", price: "0.00000008", creatorBps: 250, saleBps: 6500, buyEth: "0.1", finalize: true,
    image: "https://i.imgur.com/hqRY7BK.png" },
  { name: "Vault Token", symbol: "VAULT", supply: "10000000", price: "0.000002", creatorBps: 500, saleBps: 3000, buyEth: "0.18", finalize: true,
    image: "https://i.imgur.com/R9B3G4j.png" },
  { name: "Oracle Network", symbol: "ORCL", supply: "75000000", price: "0.0000003", creatorBps: 350, saleBps: 5000, buyEth: "0.1", finalize: true,
    image: "https://i.imgur.com/xlLJfmX.png" },
  { name: "Bridge Finance", symbol: "BRDGE", supply: "150000000", price: "0.0000001", creatorBps: 200, saleBps: 7000, buyEth: "0.08", finalize: true,
    image: "https://i.imgur.com/eDr5uHS.png" },

  // ── Gaming / NFT Coins ──
  { name: "Pixel Warriors", symbol: "PIXEL", supply: "500000000", price: "0.00000003", creatorBps: 300, saleBps: 6000, buyEth: "0.06", finalize: true,
    image: "https://i.imgur.com/J6fDnCG.png" },
  { name: "Loot Box Token", symbol: "LOOT", supply: "300000000", price: "0.00000005", creatorBps: 400, saleBps: 7500, buyEth: "0.07", finalize: true,
    image: "https://i.imgur.com/X0nB6vV.png" },
  { name: "Boss Key Coin", symbol: "BOSS", supply: "42000000", price: "0.0000004", creatorBps: 250, saleBps: 5000, buyEth: "0.12", finalize: true,
    image: "https://i.imgur.com/c8ALFnq.png" },

  // ── Animal / Fun Coins ──
  { name: "CatCoin", symbol: "MEOW", supply: "888888888", price: "0.000000002", creatorBps: 100, saleBps: 9000, buyEth: "0.04", finalize: true,
    image: "https://i.imgur.com/G3Zcrbs.png" },
  { name: "Frog Finance", symbol: "FROG", supply: "420000000", price: "0.000000004", creatorBps: 200, saleBps: 8000, buyEth: "0.05", finalize: true,
    image: "https://i.imgur.com/aJB3yzk.png" },
  { name: "Ape Together", symbol: "APE2", supply: "69000000", price: "0.0000002", creatorBps: 300, saleBps: 6000, buyEth: "0.1", finalize: true,
    image: "https://i.imgur.com/9zzJp8T.png" },

  // ── Sale-only (not finalized — still in presale) ──
  { name: "Stealth Launch", symbol: "STLTH", supply: "100000000", price: "0.0000001", creatorBps: 0, saleBps: 10000, buyEth: "0.02", finalize: false,
    image: "https://i.imgur.com/kJQnFc4.png" },
  { name: "Presale Gem", symbol: "PGEM", supply: "250000000", price: "0.00000005", creatorBps: 100, saleBps: 9500, buyEth: "0.03", finalize: false,
    image: "https://i.imgur.com/b0EfGPv.png" },
  { name: "Alpha Coin", symbol: "ALPHA", supply: "50000000", price: "0.0000005", creatorBps: 200, saleBps: 8000, buyEth: "0.05", finalize: false,
    image: "https://i.imgur.com/VxIrXDP.png" },
  { name: "Moon Mission", symbol: "MMOON", supply: "1000000000", price: "0.00000001", creatorBps: 0, saleBps: 10000, buyEth: "0.01", finalize: false,
    image: "https://i.imgur.com/YwKLaVR.png" }
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

    const priceWei = ethers.parseEther(t.price);
    const totalSupply = ethers.parseEther(t.supply);
    let tokenAddr, launchAddr;

    // 1) Create
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
      console.log(`  ✅ Created token=${tokenAddr.slice(0,10)}... launch=${launchAddr.slice(0,10)}...`);
    } catch (e) {
      console.log(`  ❌ Create failed: ${e.reason || e.message}`);
      continue;
    }

    // 2) Buy
    const launch = new ethers.Contract(launchAddr, LaunchABI, signer);
    try {
      await (await launch.buy({ value: ethers.parseEther(t.buyEth) })).wait();
      console.log(`  ✅ Bought with ${t.buyEth} ETH`);
    } catch (e) {
      console.log(`  ⚠️  Buy failed: ${e.reason || e.message}`);
    }

    // 3) Finalize (if configured)
    if (t.finalize) {
      const sqrtPrice = computeSqrtPriceX96(priceWei, tokenAddr, WETH9);
      try {
        await (await factory.finalizeLaunch(launchAddr, sqrtPrice, FEE, {
          value: ethers.parseEther("0.005"), gasLimit: 10_000_000n
        })).wait();
        const pool = await launch.pool();
        console.log(`  ✅ Finalized — pool=${pool.slice(0,10)}...`);
        created.push({ token: tokenAddr, launch: launchAddr, pool, symbol: t.symbol });
      } catch (e) {
        console.log(`  ⚠️  Finalize failed: ${e.reason || e.message}`);
        created.push({ token: tokenAddr, launch: launchAddr, pool: null, symbol: t.symbol });
      }
    } else {
      console.log(`  ℹ️  Skipping finalize (presale only)`);
      created.push({ token: tokenAddr, launch: launchAddr, pool: null, symbol: t.symbol });
    }
  }

  // Phase 2: Swaps to generate market activity on finalized pools
  console.log(`\n── SWAPS ──`);
  const tradeable = created.filter(c => c.pool && c.pool !== ethers.ZeroAddress);

  const totalSwapEth = ethers.parseEther("0.3");
  try {
    await (await weth.deposit({ value: totalSwapEth })).wait();
    await (await weth.approve(ROUTER, totalSwapEth)).wait();
    console.log(`  ✅ Wrapped ${ethers.formatEther(totalSwapEth)} ETH`);
  } catch (e) {
    console.log(`  ❌ Wrap failed: ${e.reason || e.message}`);
  }

  // Buy swaps: WETH → TOKEN (varied sizes)
  for (let i = 0; i < tradeable.length; i++) {
    const c = tradeable[i];
    const amounts = ["0.01", "0.005", "0.008", "0.012", "0.003"];
    const swapAmt = ethers.parseEther(amounts[i % amounts.length]);
    try {
      await (await router.exactInputSingle({
        tokenIn: WETH9, tokenOut: c.token, fee: FEE,
        recipient: deployer, deadline: deadline(),
        amountIn: swapAmt, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
      })).wait();
      console.log(`  ✅ Swap ${ethers.formatEther(swapAmt)} WETH → $${c.symbol}`);
    } catch (e) {
      console.log(`  ⚠️  Swap failed $${c.symbol}: ${e.reason || e.message}`);
    }
  }

  // Sell swaps: TOKEN → WETH (first 8 tokens)
  for (const c of tradeable.slice(0, 8)) {
    const token = new ethers.Contract(c.token, ERC20ABI, signer);
    try {
      const bal = await token.balanceOf(deployer);
      const amt = bal / 10n;
      if (amt === 0n) continue;
      await (await token.approve(ROUTER, amt)).wait();
      await (await router.exactInputSingle({
        tokenIn: c.token, tokenOut: WETH9, fee: FEE,
        recipient: deployer, deadline: deadline(),
        amountIn: amt, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
      })).wait();
      console.log(`  ✅ Sold some $${c.symbol} → WETH`);
    } catch (e) {
      console.log(`  ⚠️  Sell failed $${c.symbol}: ${e.reason || e.message}`);
    }
  }

  // Summary
  console.log(`\n══ DONE ══`);
  console.log(`  Created: ${created.length} tokens`);
  console.log(`  Trading: ${tradeable.length} with pools`);
  console.log(`  Presale: ${created.length - tradeable.length} without pools`);
  const finalBal = await ethers.provider.getBalance(deployer);
  console.log(`  Balance: ${ethers.formatEther(finalBal)} ETH\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
