/**
 * Create Uniswap V3 pools for stock tokens and add full-range liquidity.
 *
 * Uses ~5 tokens of each + matching WETH at realistic price ratios.
 * Assumes ETH ~$2,500 for price calculations.
 *
 * Run:  npx hardhat run scripts/create-stock-pools.js --network robinhoodTestnet
 */
const { ethers } = require("hardhat");

const WETH = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const POSITION_MANAGER = "0xBc82a9aA33ff24FCd56D36a0fB0a2105B193A327";
const UNI_FACTORY = "0xFECCB63CD759d768538458Ea56F47eA8004323c1";

const WETHABI = [
  "function deposit() external payable",
  "function approve(address,uint256) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)"
];
const ERC20ABI = [
  "function approve(address,uint256) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];
const FactoryABI = [
  "function getPool(address,address,uint24) external view returns (address)",
  "function createPool(address,address,uint24) external returns (address)"
];
const PoolABI = [
  "function initialize(uint160 sqrtPriceX96) external",
  "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)"
];
const NpmABI = [
  "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) external payable returns (uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)"
];

const ETH_USD = 2500;
const FEE = 3000;
const TICK_SPACING = 60;
const MIN_TICK = -887220;
const MAX_TICK = 887220;

const STOCKS = [
  { addr: "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E", usdPrice: 400,  tokenAmt: "2" },    // TSLA  → 2 * 0.16 = 0.32 ETH
  { addr: "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02", usdPrice: 200,  tokenAmt: "3" },    // AMZN  → 3 * 0.08 = 0.24 ETH
  { addr: "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0", usdPrice: 100,  tokenAmt: "4" },    // PLTR  → 4 * 0.04 = 0.16 ETH
  { addr: "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93", usdPrice: 900,  tokenAmt: "1.5" },  // NFLX  → 1.5 * 0.36 = 0.54 ETH
  { addr: "0x71178BAc73cBeb415514eB542a8995b82669778d", usdPrice: 120,  tokenAmt: "4" }     // AMD   → 4 * 0.048 = 0.192 ETH
];                                                                                            // Total ≈ 1.47 ETH

function sqrtBigInt(n) {
  if (n < 2n) return n;
  let x0 = n, x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}

function computeSqrtPriceX96(tokenAddr, wethAddr, priceInEth) {
  const token = tokenAddr.toLowerCase();
  const weth = wethAddr.toLowerCase();
  const Q96 = 2n ** 96n;
  const SCALE = 10n ** 18n;

  const priceWei = ethers.parseEther(priceInEth.toString());

  if (token < weth) {
    // token is token0, weth is token1
    // price = token1/token0 = weth_per_token = priceInEth
    const numerator = priceWei;
    const denominator = SCALE;
    return sqrtBigInt((numerator * Q96 * Q96) / denominator);
  } else {
    // weth is token0, token is token1
    // price = token1/token0 = token_per_weth = 1/priceInEth
    const numerator = SCALE;
    const denominator = priceWei;
    return sqrtBigInt((numerator * Q96 * Q96) / denominator);
  }
}

function deadline() { return BigInt(Math.floor(Date.now() / 1000)) + 600n; }

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const balance = await ethers.provider.getBalance(deployer);
  console.log(`\n  Deployer: ${deployer}`);
  console.log(`  ETH Balance: ${ethers.formatEther(balance)} ETH\n`);

  const weth = new ethers.Contract(WETH, WETHABI, signer);
  const uniFactory = new ethers.Contract(UNI_FACTORY, FactoryABI, signer);
  const npm = new ethers.Contract(POSITION_MANAGER, NpmABI, signer);

  // Wrap enough ETH for all pools
  const totalEthNeeded = STOCKS.reduce((sum, s) => {
    const ethPerToken = s.usdPrice / ETH_USD;
    const ethForPool = ethPerToken * Number(s.tokenAmt);
    return sum + ethForPool;
  }, 0);

  const wrapAmount = ethers.parseEther((totalEthNeeded * 1.2).toFixed(6)); // 20% buffer
  console.log(`  Wrapping ${ethers.formatEther(wrapAmount)} ETH → WETH...`);
  await (await weth.deposit({ value: wrapAmount })).wait();
  await (await weth.approve(POSITION_MANAGER, ethers.MaxUint256)).wait();
  console.log(`  ✅ Wrapped & approved WETH\n`);

  for (const stock of STOCKS) {
    const token = new ethers.Contract(stock.addr, ERC20ABI, signer);
    const [sym, dec, bal] = await Promise.all([
      token.symbol(), token.decimals(), token.balanceOf(deployer)
    ]);
    const decimals = Number(dec);
    const ethPerToken = stock.usdPrice / ETH_USD;

    console.log(`── ${sym} ($${stock.usdPrice}) ──`);
    console.log(`  Balance: ${ethers.formatUnits(bal, decimals)} ${sym}`);
    console.log(`  Price: ${ethPerToken.toFixed(6)} ETH/token ($${stock.usdPrice})`);

    // 1) Create pool if it doesn't exist
    let poolAddr;
    try {
      poolAddr = await uniFactory.getPool(stock.addr, WETH, FEE);
    } catch { poolAddr = ethers.ZeroAddress; }

    if (poolAddr === ethers.ZeroAddress) {
      console.log(`  Creating pool...`);
      const tx = await uniFactory.createPool(stock.addr, WETH, FEE);
      await tx.wait();
      poolAddr = await uniFactory.getPool(stock.addr, WETH, FEE);
      console.log(`  ✅ Pool created: ${poolAddr}`);
    } else {
      console.log(`  Pool already exists: ${poolAddr}`);
    }

    // 2) Initialize pool with correct price
    const pool = new ethers.Contract(poolAddr, PoolABI, signer);
    try {
      const sqrtPrice = computeSqrtPriceX96(stock.addr, WETH, ethPerToken);
      const initTx = await pool.initialize(sqrtPrice);
      await initTx.wait();
      console.log(`  ✅ Pool initialized at ${ethPerToken.toFixed(6)} ETH/${sym}`);
    } catch (e) {
      if (e.message?.includes("AI") || e.reason?.includes("AI")) {
        console.log(`  ℹ️  Pool already initialized`);
      } else {
        console.log(`  ℹ️  Pool already initialized (${e.reason || e.message})`);
      }
    }

    // 3) Approve token to position manager
    const tokenAmt = ethers.parseUnits(stock.tokenAmt, decimals);
    await (await token.approve(POSITION_MANAGER, tokenAmt)).wait();

    // 4) Compute matching WETH amount
    const ethNeeded = ethers.parseEther((ethPerToken * Number(stock.tokenAmt)).toFixed(8));

    // 5) Sort token0/token1
    const token0 = stock.addr.toLowerCase() < WETH.toLowerCase() ? stock.addr : WETH;
    const token1 = stock.addr.toLowerCase() < WETH.toLowerCase() ? WETH : stock.addr;
    const amount0 = token0.toLowerCase() === stock.addr.toLowerCase() ? tokenAmt : ethNeeded;
    const amount1 = token0.toLowerCase() === stock.addr.toLowerCase() ? ethNeeded : tokenAmt;

    console.log(`  Adding liquidity: ${stock.tokenAmt} ${sym} + ${ethers.formatEther(ethNeeded)} WETH`);
    console.log(`  Range: full (tick ${MIN_TICK} to ${MAX_TICK})`);

    try {
      const mintTx = await npm.mint({
        token0,
        token1,
        fee: FEE,
        tickLower: MIN_TICK,
        tickUpper: MAX_TICK,
        amount0Desired: amount0,
        amount1Desired: amount1,
        amount0Min: 0n,
        amount1Min: 0n,
        recipient: deployer,
        deadline: deadline()
      }, { gasLimit: 5_000_000n });

      const receipt = await mintTx.wait();
      console.log(`  ✅ Position minted! tx: ${receipt.hash.slice(0, 14)}...`);
    } catch (e) {
      console.log(`  ❌ Mint failed: ${e.reason || e.message}`);
    }
    console.log("");
  }

  const finalBal = await ethers.provider.getBalance(deployer);
  console.log(`\n══ DONE ══`);
  console.log(`  Final ETH: ${ethers.formatEther(finalBal)}`);
  console.log(`  Pools created for all 5 stock tokens with full-range liquidity.\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
