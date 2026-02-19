/**
 * Seed demo data for hackathon presentation.
 *
 * Creates 5 tokens (with logos), buys from each, finalizes into Uniswap V3
 * pools, runs swaps, then writes 20 covered-call options and buys half.
 *
 * Run:  npx hardhat run scripts/seed-demo-data.js --network robinhoodTestnet
 */
const { ethers } = require("hardhat");

/* ── Contract addresses ── */
const FACTORY = "0x631f9371Fd6B2C85F8f61d19A90547eE67Fa61A2";
const WETH9   = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const ROUTER  = "0x1b32F47434a7EF83E97d0675C823E547F9266725";
const VAULT   = "0x055d84908672b9be53275963862614aEA9CDB98B";
const UNI_FACTORY = "0xFECCB63CD759d768538458Ea56F47eA8004323c1";

/* ── Minimal ABIs ── */
const FactoryABI = [
  "function createLaunch((string name,string symbol,string metadataURI,string imageURI,uint256 totalSupplyWei,uint256 creatorAllocationBps,uint256 saleBpsOfRemaining,uint256 priceWeiPerToken) p) external returns (address token, address launch)",
  "function finalizeLaunch(address launch, uint160 sqrtPriceX96, uint24 fee) external payable",
  "event LaunchCreated(address indexed creator, address indexed token, address indexed launch, string name, string symbol, string metadataURI, string imageURI)"
];
const LaunchABI = [
  "function buy() external payable",
  "function memeToken() external view returns (address)",
  "function pool() external view returns (address)",
  "function priceWeiPerToken() external view returns (uint256)"
];
const ERC20ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)",
  "function symbol() external view returns (string)"
];
const WETH9ABI = [
  "function deposit() external payable",
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)"
];
const RouterABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];
const VaultABI = [
  "function createOffer(address underlying,address quote,address pool,uint32 twapSeconds,int24 strikeTick,uint256 underlyingAmount,uint256 strikeQuoteAmount,uint256 premiumQuoteAmount,uint256 expiry) external returns (uint256 offerId)",
  "function buyOption(uint256 offerId) external returns (uint256 optionTokenId)",
  "function nextOfferId() external view returns (uint256)"
];
const UniPoolABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)"
];
const UniFactoryABI = [
  "function getPool(address,address,uint24) external view returns (address)"
];

/* ── Helpers ── */
function sqrtBigInt(n) {
  if (n < 0n) throw new Error("sqrt of negative");
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

function ok(msg)   { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function line(msg) { console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`); }
function deadline() { return BigInt(Math.floor(Date.now() / 1000)) + 600n; }

/* ── Token definitions ── */
const TOKENS = [
  {
    name: "DogeStonk", symbol: "DOGE", supply: "10000000", price: "0.0000005",
    creatorBps: 500n, saleBps: 6000n, buyEth: "0.005",
    image: "https://upload.wikimedia.org/wikipedia/en/5/5f/Original_Doge_meme.jpg"
  },
  {
    name: "PepeCoin", symbol: "PEPE", supply: "5000000", price: "0.000001",
    creatorBps: 300n, saleBps: 7000n, buyEth: "0.004",
    image: "https://i.imgur.com/cfq6Kfv.png"
  },
  {
    name: "MoonShot Token", symbol: "MOON", supply: "2000000", price: "0.000005",
    creatorBps: 200n, saleBps: 5000n, buyEth: "0.006",
    image: "https://i.imgur.com/7QGk9mN.png"
  },
  {
    name: "WAGMI Finance", symbol: "WAGMI", supply: "8000000", price: "0.0000008",
    creatorBps: 400n, saleBps: 6500n, buyEth: "0.004",
    image: "https://i.imgur.com/aTKqRSE.png"
  },
  {
    name: "StonkRocket", symbol: "SROCK", supply: "3000000", price: "0.000003",
    creatorBps: 600n, saleBps: 5500n, buyEth: "0.005",
    image: "https://i.imgur.com/3THbOhT.png"
  }
];

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const balance = await ethers.provider.getBalance(deployer);

  line("SEED DEMO DATA");
  info(`Deployer: ${deployer}`);
  info(`Balance:  ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.15")) {
    throw new Error("Need at least 0.15 ETH to seed demo data. Use the faucet first.");
  }

  const factory = new ethers.Contract(FACTORY, FactoryABI, signer);
  const router  = new ethers.Contract(ROUTER, RouterABI, signer);
  const weth    = new ethers.Contract(WETH9, WETH9ABI, signer);
  const vault   = new ethers.Contract(VAULT, VaultABI, signer);
  const uniFactory = new ethers.Contract(UNI_FACTORY, UniFactoryABI, signer);

  const FEE = 3000;
  const created = []; // { token, launch, pool, symbol, price }

  /* ═══════════════════════════════════════════════════════
   * PHASE 1: Create & Buy & Finalize 5 Tokens
   * ═══════════════════════════════════════════════════════ */
  for (let i = 0; i < TOKENS.length; i++) {
    const t = TOKENS[i];
    line(`TOKEN ${i + 1}/${TOKENS.length}: $${t.symbol}`);

    const priceWei = ethers.parseEther(t.price);
    const totalSupply = ethers.parseEther(t.supply);

    // 1) Create launch
    info(`Creating ${t.name} (${t.symbol})...`);
    let tokenAddr, launchAddr;
    try {
      const tx = await factory.createLaunch({
        name: t.name, symbol: t.symbol,
        metadataURI: "", imageURI: t.image,
        totalSupplyWei: totalSupply,
        creatorAllocationBps: t.creatorBps,
        saleBpsOfRemaining: t.saleBps,
        priceWeiPerToken: priceWei
      });
      const receipt = await tx.wait();
      const iface = new ethers.Interface(FactoryABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: log.topics, data: log.data });
          if (parsed && parsed.name === "LaunchCreated") {
            tokenAddr = parsed.args.token;
            launchAddr = parsed.args.launch;
          }
        } catch { /* skip */ }
      }
      if (!launchAddr) throw new Error("No LaunchCreated event");
      ok(`Token: ${tokenAddr} | Launch: ${launchAddr}`);
    } catch (e) {
      warn(`Create failed: ${e.reason || e.message} — skipping`);
      continue;
    }

    // 2) Buy tokens to raise ETH
    const launch = new ethers.Contract(launchAddr, LaunchABI, signer);
    try {
      const buyTx = await launch.buy({ value: ethers.parseEther(t.buyEth) });
      await buyTx.wait();
      ok(`Bought with ${t.buyEth} ETH`);
    } catch (e) {
      warn(`Buy failed: ${e.reason || e.message}`);
    }

    // 3) Finalize — create pool
    const sqrtPrice = computeSqrtPriceX96(priceWei, tokenAddr, WETH9);
    try {
      const finTx = await factory.finalizeLaunch(launchAddr, sqrtPrice, FEE, {
        value: ethers.parseEther("0.005"),
        gasLimit: 10_000_000n
      });
      await finTx.wait();
      const poolAddr = await launch.pool();
      ok(`Finalized — Pool: ${poolAddr}`);
      created.push({ token: tokenAddr, launch: launchAddr, pool: poolAddr, symbol: t.symbol, price: priceWei });
    } catch (e) {
      warn(`Finalize failed: ${e.reason || e.message}`);
      created.push({ token: tokenAddr, launch: launchAddr, pool: null, symbol: t.symbol, price: priceWei });
    }
  }

  /* ═══════════════════════════════════════════════════════
   * PHASE 2: Swaps on each pool
   * ═══════════════════════════════════════════════════════ */
  line("SWAPS");
  const tradeable = created.filter((c) => c.pool && c.pool !== ethers.ZeroAddress);

  // Wrap some ETH for all swaps
  const totalSwapEth = ethers.parseEther("0.02");
  try {
    const wrapTx = await weth.deposit({ value: totalSwapEth });
    await wrapTx.wait();
    ok(`Wrapped ${ethers.formatEther(totalSwapEth)} ETH → WETH`);
    const approveTx = await weth.approve(ROUTER, totalSwapEth);
    await approveTx.wait();
    ok("Approved WETH for router");
  } catch (e) {
    warn(`WETH wrap/approve failed: ${e.reason || e.message}`);
  }

  for (const c of tradeable) {
    const swapAmt = ethers.parseEther("0.003");
    try {
      info(`Swap ${ethers.formatEther(swapAmt)} WETH → $${c.symbol}...`);
      const swapTx = await router.exactInputSingle({
        tokenIn: WETH9, tokenOut: c.token, fee: FEE,
        recipient: deployer, deadline: deadline(),
        amountIn: swapAmt, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
      });
      await swapTx.wait();
      ok(`Swapped WETH → $${c.symbol}`);
    } catch (e) {
      warn(`Swap failed for $${c.symbol}: ${e.reason || e.message}`);
    }
  }

  // Swap some tokens back (TOKEN → WETH)
  for (const c of tradeable.slice(0, 3)) {
    const token = new ethers.Contract(c.token, ERC20ABI, signer);
    try {
      const bal = await token.balanceOf(deployer);
      const amt = bal / 20n;
      if (amt === 0n) continue;
      await (await token.approve(ROUTER, amt)).wait();
      info(`Swap ${ethers.formatEther(amt)} $${c.symbol} → WETH...`);
      const swapTx = await router.exactInputSingle({
        tokenIn: c.token, tokenOut: WETH9, fee: FEE,
        recipient: deployer, deadline: deadline(),
        amountIn: amt, amountOutMinimum: 0n, sqrtPriceLimitX96: 0n
      });
      await swapTx.wait();
      ok(`Swapped $${c.symbol} → WETH`);
    } catch (e) {
      warn(`Reverse swap failed for $${c.symbol}: ${e.reason || e.message}`);
    }
  }

  /* ═══════════════════════════════════════════════════════
   * PHASE 3: Write 20 covered-call options & buy 10
   * ═══════════════════════════════════════════════════════ */
  line("COVERED CALL OPTIONS (20 offers, buy 10)");

  // Ensure we have WETH for premiums
  try {
    const wrapTx = await weth.deposit({ value: ethers.parseEther("0.01") });
    await wrapTx.wait();
    await (await weth.approve(VAULT, ethers.MaxUint256)).wait();
    ok("Wrapped 0.01 ETH for premiums + approved vault");
  } catch (e) {
    warn(`Premium WETH prep: ${e.reason || e.message}`);
  }

  const optionTokens = tradeable.length >= 4 ? tradeable.slice(0, 5) : tradeable;
  const offersPerToken = Math.ceil(20 / Math.max(optionTokens.length, 1));
  const now = Math.floor(Date.now() / 1000);
  const offerIds = [];

  for (const c of optionTokens) {
    const token = new ethers.Contract(c.token, ERC20ABI, signer);
    const bal = await token.balanceOf(deployer);
    if (bal === 0n) { warn(`No $${c.symbol} balance — skipping options`); continue; }

    // Approve underlying tokens to the vault
    try {
      await (await token.approve(VAULT, ethers.MaxUint256)).wait();
    } catch (e) {
      warn(`Approve $${c.symbol} to vault failed: ${e.reason || e.message}`);
      continue;
    }

    // Get current pool tick for strike calculation
    let currentTick = 0;
    try {
      // Find the actual pool address from the factory
      let poolAddr = c.pool;
      if (!poolAddr || poolAddr === ethers.ZeroAddress) {
        poolAddr = await uniFactory.getPool(c.token, WETH9, FEE);
      }
      if (poolAddr && poolAddr !== ethers.ZeroAddress) {
        const pool = new ethers.Contract(poolAddr, UniPoolABI, signer);
        const slot = await pool.slot0();
        currentTick = Number(slot.tick);
        info(`$${c.symbol} pool tick: ${currentTick}`);
      }
    } catch (e) {
      warn(`Couldn't read pool tick for $${c.symbol}: ${e.reason || e.message}`);
    }

    // Round tick to nearest 60 (tick spacing for 0.3% fee)
    const tickSpacing = 60;
    const roundedTick = Math.round(currentTick / tickSpacing) * tickSpacing;

    for (let j = 0; j < offersPerToken; j++) {
      // Vary strike, size, premium, and expiry across offers
      const strikeMult = 1.1 + j * 0.15;
      const strikeTick = roundedTick + (j + 1) * tickSpacing * 2;

      const sizeFraction = BigInt(5 + j * 2);
      const underlyingAmt = bal / (100n / sizeFraction);
      if (underlyingAmt === 0n) continue;

      const strikeQuote = (underlyingAmt * c.price) / (10n ** 18n);
      const strikeAdj = (strikeQuote * BigInt(Math.round(strikeMult * 100))) / 100n;
      const premium = strikeAdj / 10n;
      const expiry = now + 86400 * (3 + j * 2);

      try {
        info(`Writing call on $${c.symbol}: strike tick ${strikeTick}, expiry +${3 + j * 2}d...`);
        const tx = await vault.createOffer(
          c.token,     // underlying
          WETH9,       // quote
          c.pool,      // pool
          300,         // twapSeconds (5 min)
          strikeTick,
          underlyingAmt,
          strikeAdj > 0n ? strikeAdj : 1n,
          premium > 0n ? premium : 1n,
          expiry,
          { gasLimit: 1_000_000n }
        );
        const receipt = await tx.wait();

        // Parse OfferCreated event
        const iface = new ethers.Interface([
          "event OfferCreated(uint256 indexed offerId, address indexed writer, address indexed underlying, uint256 underlyingAmount)"
        ]);
        let offerId = null;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "OfferCreated") {
              offerId = parsed.args.offerId;
            }
          } catch { /* skip */ }
        }
        if (offerId !== null) {
          offerIds.push(offerId);
          ok(`Offer #${offerId} created for $${c.symbol}`);
        } else {
          // Fallback: read nextOfferId
          const nextId = await vault.nextOfferId();
          offerIds.push(nextId - 1n);
          ok(`Offer created for $${c.symbol} (id ~${nextId - 1n})`);
        }
      } catch (e) {
        warn(`Option write failed for $${c.symbol}: ${e.reason || e.message}`);
      }
    }
  }

  // Buy 10 of the options
  line(`BUYING OPTIONS (${Math.min(10, offerIds.length)} of ${offerIds.length})`);
  const toBuy = offerIds.slice(0, 10);
  let bought = 0;
  for (const oid of toBuy) {
    try {
      info(`Buying option offer #${oid}...`);
      const tx = await vault.buyOption(oid, { gasLimit: 500_000n });
      await tx.wait();
      ok(`Bought option #${oid}`);
      bought++;
    } catch (e) {
      warn(`Buy option #${oid} failed: ${e.reason || e.message}`);
    }
  }

  /* ═══════════════════════════════════════════════════════
   * SUMMARY
   * ═══════════════════════════════════════════════════════ */
  line("SEED COMPLETE — SUMMARY");
  const finalEth = await ethers.provider.getBalance(deployer);
  console.log(`\n  Tokens created: ${created.length}`);
  for (const c of created) {
    const hasPool = c.pool && c.pool !== ethers.ZeroAddress;
    console.log(`    $${c.symbol.padEnd(6)} Token: ${c.token}  Pool: ${hasPool ? c.pool : "N/A"}`);
  }
  console.log(`  Options written: ${offerIds.length}`);
  console.log(`  Options bought:  ${bought}`);
  console.log(`  Final ETH balance: ${ethers.formatEther(finalEth)}`);
  console.log(`\n  All data should now be visible on the UI.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
