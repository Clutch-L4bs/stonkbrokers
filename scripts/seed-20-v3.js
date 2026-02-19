/**
 * Deploy 20 tokens (batch 3) with varied launch styles and working images.
 * Budget: ~0.55 ETH total (creation gas + buys + finalization + swaps)
 *
 * Run:  npx hardhat run scripts/seed-20-v3.js --network robinhoodTestnet
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
  let num, den;
  if (token0 === meme) { num = priceWei; den = 10n ** 18n; }
  else { num = 10n ** 18n; den = priceWei; }
  return sqrtBigInt((num * Q96 * Q96) / den);
}

function deadline() { return BigInt(Math.floor(Date.now() / 1000)) + 600n; }

const BASE = "https://www.stonkbrokers.cash/tokens";

/*
 * Mix of launch types:
 *  - Standard finalized (DEX live)
 *  - Whale launch (big creator alloc, small sale)
 *  - Community (0% creator, 100% sale)
 *  - Micro-cap (tiny supply)
 *  - Mega supply (billions)
 *  - High-price (expensive per token)
 *  - Presale only (not finalized)
 *  - Just-created (no buys)
 */
const TOKENS = [
  // ── Finalized & active (10) ──
  { name: "Apex Protocol",    symbol: "APEX",   supply: "200000000",   price: "0.0000001",   creatorBps: 300, saleBps: 6000, buyEth: "0.008", finalize: true,  fee: 3000, image: `${BASE}/apex.svg` },
  { name: "Comet Rocket",     symbol: "COMET",  supply: "500000000",   price: "0.00000004",  creatorBps: 200, saleBps: 7000, buyEth: "0.006", finalize: true,  fee: 3000, image: `${BASE}/comet.svg` },
  { name: "Dusk Protocol",    symbol: "DUSK",   supply: "100000000",   price: "0.0000002",   creatorBps: 100, saleBps: 8000, buyEth: "0.007", finalize: true,  fee: 3000, image: `${BASE}/dusk.svg` },
  { name: "Echo Network",     symbol: "ECHO2",  supply: "350000000",   price: "0.00000006",  creatorBps: 250, saleBps: 6500, buyEth: "0.005", finalize: true,  fee: 3000, image: `${BASE}/echo2.svg` },
  { name: "Fury Chain",       symbol: "FURY",   supply: "69420000",    price: "0.0000003",   creatorBps: 400, saleBps: 5000, buyEth: "0.008", finalize: true,  fee: 10000, image: `${BASE}/fury.svg` },
  { name: "Glyph Labs",       symbol: "GLYPH",  supply: "150000000",   price: "0.00000015",  creatorBps: 350, saleBps: 5500, buyEth: "0.006", finalize: true,  fee: 3000, image: `${BASE}/glyph.svg` },
  { name: "Haze Finance",     symbol: "HAZE",   supply: "250000000",   price: "0.00000008",  creatorBps: 150, saleBps: 7500, buyEth: "0.005", finalize: true,  fee: 3000, image: `${BASE}/haze.svg` },
  { name: "Ion Energy",       symbol: "ION",    supply: "400000000",   price: "0.00000005",  creatorBps: 200, saleBps: 6000, buyEth: "0.007", finalize: true,  fee: 3000, image: `${BASE}/ion.svg` },
  { name: "Jade Vault",       symbol: "JADE",   supply: "80000000",    price: "0.0000003",   creatorBps: 500, saleBps: 4000, buyEth: "0.009", finalize: true,  fee: 10000, image: `${BASE}/jade.svg` },
  { name: "Krypto Lock",      symbol: "KRYPTO", supply: "300000000",   price: "0.00000007",  creatorBps: 200, saleBps: 7000, buyEth: "0.005", finalize: true,  fee: 3000, image: `${BASE}/krypto.svg` },

  // ── Community launch: 0% creator, 100% for sale (2) ──
  { name: "Lynx Community",   symbol: "LYNX",   supply: "1000000000",  price: "0.00000001",  creatorBps: 0,   saleBps: 10000, buyEth: "0.004", finalize: true,  fee: 3000, image: `${BASE}/lynx.svg` },
  { name: "Mystic DAO",       symbol: "MYST",   supply: "777000000",   price: "0.00000002",  creatorBps: 0,   saleBps: 10000, buyEth: "0.003", finalize: true,  fee: 3000, image: `${BASE}/myst.svg` },

  // ── Micro-cap: tiny supply, higher price (2) ──
  { name: "Nexus Core",       symbol: "NEXUS",  supply: "1000000",     price: "0.0001",      creatorBps: 100, saleBps: 9000, buyEth: "0.008", finalize: true,  fee: 3000, image: `${BASE}/nexus.svg` },
  { name: "Omega Prime",      symbol: "OMEGA",  supply: "10000000",    price: "0.00001",     creatorBps: 200, saleBps: 8000, buyEth: "0.006", finalize: true,  fee: 3000, image: `${BASE}/omega.svg` },

  // ── Presale only (not finalized) (3) ──
  { name: "Pyro Burn",        symbol: "PYRO",   supply: "420000000",   price: "0.00000005",  creatorBps: 300, saleBps: 6000, buyEth: "0.003", finalize: false, fee: 3000, image: `${BASE}/pyro.svg` },
  { name: "Quake Force",      symbol: "QUAKE",  supply: "250000000",   price: "0.00000008",  creatorBps: 0,   saleBps: 10000, buyEth: "0.002", finalize: false, fee: 3000, image: `${BASE}/quake.svg` },
  { name: "Rift Portal",      symbol: "RIFT",   supply: "600000000",   price: "0.00000003",  creatorBps: 100, saleBps: 9000, buyEth: "0.002", finalize: false, fee: 3000, image: `${BASE}/rift.svg` },

  // ── Just created, no buys (3) ──
  { name: "Shard Protocol",   symbol: "SHARD",  supply: "500000000",   price: "0.00000004",  creatorBps: 200, saleBps: 7000, buyEth: "0",     finalize: false, fee: 3000, image: `${BASE}/shard.svg` },
  { name: "Thorr Power",      symbol: "THORR",  supply: "100000000",   price: "0.0000002",   creatorBps: 300, saleBps: 5000, buyEth: "0",     finalize: false, fee: 3000, image: `${BASE}/thorr.svg` },
  { name: "Ultra Beam",       symbol: "ULTRA",  supply: "888000000",   price: "0.00000002",  creatorBps: 0,   saleBps: 10000, buyEth: "0",     finalize: false, fee: 3000, image: `${BASE}/ultra.svg` },
];

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const bal = await ethers.provider.getBalance(deployer);
  console.log(`\n  Deployer: ${deployer}`);
  console.log(`  Balance:  ${ethers.formatEther(bal)} ETH\n`);

  const factory = new ethers.Contract(FACTORY, FactoryABI, signer);
  const router  = new ethers.Contract(ROUTER, RouterABI, signer);
  const weth    = new ethers.Contract(WETH9, WETHABI, signer);
  const created = [];

  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i];
    const tag = t.buyEth === "0" ? "FRESH" : t.finalize ? "LIVE" : "PRESALE";
    console.log(`── [${i+1}/${TOKENS.length}] $${t.symbol} — ${t.name} [${tag}] ──`);

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
      console.log(`  ✅ Created  token=${tokenAddr.slice(0,10)}...`);
    } catch (e) {
      console.log(`  ❌ Create failed: ${e.reason || e.message}`);
      continue;
    }

    if (t.buyEth !== "0") {
      const launch = new ethers.Contract(launchAddr, LaunchABI, signer);
      try {
        await (await launch.buy({ value: ethers.parseEther(t.buyEth) })).wait();
        console.log(`  ✅ Bought ${t.buyEth} ETH`);
      } catch (e) {
        console.log(`  ⚠️  Buy: ${e.reason || e.message}`);
      }

      if (t.finalize) {
        const sqrtPrice = computeSqrtPriceX96(priceWei, tokenAddr, WETH9);
        try {
          await (await factory.finalizeLaunch(launchAddr, sqrtPrice, t.fee, {
            value: ethers.parseEther("0.002"), gasLimit: 10_000_000n
          })).wait();
          const pool = await launch.pool();
          console.log(`  ✅ Finalized  pool=${pool.slice(0,10)}...  fee=${t.fee}`);
          created.push({ token: tokenAddr, symbol: t.symbol, pool });
        } catch (e) {
          console.log(`  ⚠️  Finalize: ${e.reason || e.message}`);
          created.push({ token: tokenAddr, symbol: t.symbol, pool: null });
        }
      }
    } else {
      console.log(`  ℹ️  No buy — fresh listing`);
    }
  }

  // Swaps on finalized pools
  const tradeable = created.filter(c => c.pool && c.pool !== ethers.ZeroAddress);
  if (tradeable.length > 0) {
    console.log(`\n── SWAPS (${tradeable.length} pools) ──`);
    const wrapAmt = ethers.parseEther(String(tradeable.length * 0.003));
    try {
      await (await weth.deposit({ value: wrapAmt })).wait();
      await (await weth.approve(ROUTER, wrapAmt)).wait();
      console.log(`  Wrapped ${ethers.formatEther(wrapAmt)} ETH`);
    } catch (e) { console.log(`  ❌ Wrap: ${e.message}`); }

    for (const c of tradeable) {
      try {
        const fee = TOKENS.find(t => t.symbol === c.symbol)?.fee || 3000;
        await (await router.exactInputSingle({
          tokenIn: WETH9, tokenOut: c.token, fee,
          recipient: deployer, deadline: deadline(),
          amountIn: ethers.parseEther("0.003"), amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
        })).wait();
        console.log(`  ✅ Swap → $${c.symbol}`);
      } catch (e) { console.log(`  ⚠️  Swap $${c.symbol}: ${e.reason || e.message}`); }
    }
  }

  const finalBal = await ethers.provider.getBalance(deployer);
  console.log(`\n══ DONE ══`);
  console.log(`  Tokens created: ${TOKENS.length}`);
  console.log(`  Live (finalized): ${tradeable.length}`);
  console.log(`  Presale: ${TOKENS.filter(t => t.buyEth !== "0" && !t.finalize).length}`);
  console.log(`  Fresh (no buys): ${TOKENS.filter(t => t.buyEth === "0").length}`);
  console.log(`  Balance: ${ethers.formatEther(finalBal)} ETH\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
