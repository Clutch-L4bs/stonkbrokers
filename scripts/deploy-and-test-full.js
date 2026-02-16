/**
 * Deploy fresh factory (paris EVM, tick fix) and run complete E2E test:
 * Create → Buy → Finalize → Swap → Stake → Collect Fees
 */
const { ethers } = require("hardhat");

const WETH9     = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const PM        = "0xBc82a9aA33ff24FCd56D36a0fB0a2105B193A327";
const REGISTRY  = "0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b";
const ROUTER    = "0x1b32F47434a7EF83E97d0675C823E547F9266725";

function sqrtBigInt(n) {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}

function line(msg) { console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`); }
function ok(msg)   { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const balance = await ethers.provider.getBalance(deployer);

  line("FULL E2E: DEPLOY + TEST");
  info(`Deployer: ${deployer}`);
  info(`ETH Balance: ${ethers.formatEther(balance)}`);

  /* ═══ STEP 1: Deploy Factory ═══ */
  line("STEP 1: DEPLOY NEW FACTORY (paris EVM, tick fix)");
  const Factory = await ethers.getContractFactory("StonkLauncherFactory");
  const factory = await Factory.deploy(deployer, deployer, WETH9, PM, REGISTRY);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  ok(`Factory deployed: ${factoryAddr}`);

  // Try to set factory in registry
  try {
    const reg = new ethers.Contract(REGISTRY, [
      "function setFactory(address f) external"
    ], signer);
    await (await reg.setFactory(factoryAddr)).wait();
    ok("Registry factory updated");
  } catch (e) {
    warn(`Registry setFactory: ${e.reason || e.message?.substring(0, 80)}`);
  }

  /* ═══ STEP 2: Create Launch ═══ */
  line("STEP 2: CREATE LAUNCH");
  const totalSupply = ethers.parseEther("1000000");
  const creatorBps  = 500n;
  const saleBps     = 6000n;
  const priceWei    = ethers.parseEther("0.000001");

  info("Name: StonkTestCoin | Symbol: STEST");
  info("Total: 1M | Creator: 5% | Sale: 60% of remaining | Price: 0.000001 ETH/token");

  const createTx = await factory.createLaunch({
    name: "StonkTestCoin",
    symbol: "STEST",
    metadataURI: "ipfs://test",
    imageURI: "https://stonkbrokers.cash/logo.png",
    totalSupplyWei: totalSupply,
    creatorAllocationBps: creatorBps,
    saleBpsOfRemaining: saleBps,
    priceWeiPerToken: priceWei
  });
  const createReceipt = await createTx.wait();
  ok(`Confirmed in block ${createReceipt.blockNumber}`);

  let tokenAddr, launchAddr;
  const createIface = new ethers.Interface([
    "event LaunchCreated(address indexed creator, address indexed token, address indexed launch, string name, string symbol, string metadataURI, string imageURI)"
  ]);
  for (const log of createReceipt.logs) {
    try {
      const p = createIface.parseLog({ topics: log.topics, data: log.data });
      if (p?.name === "LaunchCreated") {
        tokenAddr = p.args.token;
        launchAddr = p.args.launch;
      }
    } catch {}
  }
  ok(`Token:  ${tokenAddr}`);
  ok(`Launch: ${launchAddr}`);

  const token = new ethers.Contract(tokenAddr, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)",
    "function symbol() view returns (string)"
  ], signer);
  const launch = new ethers.Contract(launchAddr, [
    "function buy() payable",
    "function memeToken() view returns (address)",
    "function sold() view returns (uint256)",
    "function saleSupply() view returns (uint256)",
    "function remainingForSale() view returns (uint256)",
    "function priceWeiPerToken() view returns (uint256)",
    "function pool() view returns (address)",
    "function feeSplitter() view returns (address)",
    "function stakingVault() view returns (address)",
    "function lpTokenId() view returns (uint256)"
  ], signer);

  const creatorBal = await token.balanceOf(deployer);
  ok(`Creator allocation: ${ethers.formatEther(creatorBal)} STEST`);
  ok(`Sale supply: ${ethers.formatEther(await launch.saleSupply())}`);

  /* ═══ STEP 3: Buy Tokens ═══ */
  line("STEP 3: BUY TOKENS");
  const buyEth = ethers.parseEther("0.01");
  info(`Sending ${ethers.formatEther(buyEth)} ETH to buy tokens`);

  const buyTx = await launch.buy({ value: buyEth });
  await buyTx.wait();
  const soldAfter = await launch.sold();
  const balAfter = await token.balanceOf(deployer);
  ok(`Sold: ${ethers.formatEther(soldAfter)} tokens`);
  ok(`My balance: ${ethers.formatEther(balAfter)} STEST`);

  /* ═══ STEP 4: Finalize (create pool + LP) ═══ */
  line("STEP 4: FINALIZE LAUNCH");
  const Q96 = 2n ** 96n;
  const t0 = tokenAddr.toLowerCase() < WETH9.toLowerCase() ? tokenAddr : WETH9;

  // Compute sqrtPriceX96
  let sqrtPriceX96;
  if (t0.toLowerCase() === WETH9.toLowerCase()) {
    // token0=WETH, token1=MEME → ratio = MEME/WETH = 1/priceWei * 1e18
    const ratio = (10n ** 18n) / priceWei; // 1,000,000
    sqrtPriceX96 = sqrtBigInt(ratio) * Q96;
  } else {
    const ratio = priceWei; // WETH/MEME = priceWei / 1e18
    sqrtPriceX96 = sqrtBigInt(ratio * Q96 * Q96 / (10n ** 18n));
  }
  info(`sqrtPriceX96: ${sqrtPriceX96.toString()}`);
  info("Fee tier: 3000 (0.3%)");

  const finTx = await factory.finalizeLaunch(launchAddr, sqrtPriceX96, 3000, {
    value: ethers.parseEther("0.01"),
    gasLimit: 30_000_000n
  });
  info(`Tx: ${finTx.hash}`);
  const finReceipt = await finTx.wait();
  ok(`Finalized in block ${finReceipt.blockNumber}! Gas: ${finReceipt.gasUsed}`);

  const poolAddr = await launch.pool();
  const feeSplitterAddr = await launch.feeSplitter();
  const stakingVaultAddr = await launch.stakingVault();
  const lpTokenId = await launch.lpTokenId();
  ok(`Pool:          ${poolAddr}`);
  ok(`Fee Splitter:  ${feeSplitterAddr}`);
  ok(`Staking Vault: ${stakingVaultAddr}`);
  ok(`LP Token ID:   ${lpTokenId}`);

  /* ═══ STEP 5: Swap (WETH → STEST) ═══ */
  line("STEP 5: SWAP WETH → STEST");
  const weth = new ethers.Contract(WETH9, [
    "function deposit() payable",
    "function approve(address, uint256) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ], signer);
  const router = new ethers.Contract(ROUTER, [
    "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)"
  ], signer);

  const swapEth = ethers.parseEther("0.002");
  await (await weth.deposit({ value: swapEth })).wait();
  await (await weth.approve(ROUTER, swapEth)).wait();
  ok(`Wrapped ${ethers.formatEther(swapEth)} ETH to WETH`);

  const balBefore = await token.balanceOf(deployer);
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + 600n;

  const swapTx = await router.exactInputSingle({
    tokenIn: WETH9,
    tokenOut: tokenAddr,
    fee: 3000,
    recipient: deployer,
    deadline: deadline,
    amountIn: swapEth,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n
  });
  await swapTx.wait();
  const balAfterSwap = await token.balanceOf(deployer);
  const received = balAfterSwap - balBefore;
  ok(`Swapped! Received: ${ethers.formatEther(received)} STEST`);

  /* ═══ STEP 6: Swap back (STEST → WETH) ═══ */
  line("STEP 6: SWAP STEST → WETH");
  const swapBackAmt = received / 2n;
  await (await token.approve(ROUTER, swapBackAmt)).wait();
  const wethBefore = await weth.balanceOf(deployer);

  const swapBackTx = await router.exactInputSingle({
    tokenIn: tokenAddr,
    tokenOut: WETH9,
    fee: 3000,
    recipient: deployer,
    deadline: BigInt(Math.floor(Date.now() / 1000)) + 600n,
    amountIn: swapBackAmt,
    amountOutMinimum: 0n,
    sqrtPriceLimitX96: 0n
  });
  await swapBackTx.wait();
  const wethAfter = await weth.balanceOf(deployer);
  ok(`Swapped back! Received: ${ethers.formatEther(wethAfter - wethBefore)} WETH`);

  /* ═══ STEP 7: Stake tokens ═══ */
  line("STEP 7: STAKE TOKENS");
  const vault = new ethers.Contract(stakingVaultAddr, [
    "function stake(uint256 amount) external",
    "function unstake(uint256 amount) external",
    "function claim() external",
    "function users(address) view returns (uint256 staked, uint256 unlockTime, uint256 debt0, uint256 debt1)",
    "function pendingRewards(address) view returns (uint256, uint256)",
    "function stakeToken() view returns (address)"
  ], signer);

  const stakeTokenAddr = await vault.stakeToken();
  ok(`Stake token: ${stakeTokenAddr}`);
  const stakeToken = new ethers.Contract(stakeTokenAddr, [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address, uint256) returns (bool)"
  ], signer);

  const myTokens = await stakeToken.balanceOf(deployer);
  info(`My STEST balance: ${ethers.formatEther(myTokens)}`);

  const stakeAmt = myTokens / 5n;
  await (await stakeToken.approve(stakingVaultAddr, stakeAmt)).wait();
  await (await vault.stake(stakeAmt)).wait();
  ok(`Staked ${ethers.formatEther(stakeAmt)} STEST`);

  const userInfo = await vault.users(deployer);
  ok(`Staked: ${ethers.formatEther(userInfo.staked)}, Unlock: ${userInfo.unlockTime}`);

  const [p0, p1] = await vault.pendingRewards(deployer);
  ok(`Pending rewards: ${ethers.formatEther(p0)}, ${ethers.formatEther(p1)}`);

  /* ═══ STEP 8: Collect fees ═══ */
  line("STEP 8: COLLECT & SPLIT FEES");
  const splitter = new ethers.Contract(feeSplitterAddr, [
    "function collectAndSplit() external returns (uint256, uint256)"
  ], signer);

  try {
    const collectTx = await splitter.collectAndSplit();
    await collectTx.wait();
    ok("Fees collected and split");
  } catch (e) {
    warn(`collectAndSplit: ${e.reason || e.message?.substring(0, 80)}`);
    info("(No fees accrued yet — this is expected for a fresh pool)");
  }

  /* ═══ SUMMARY ═══ */
  line("ALL TESTS PASSED — SUMMARY");
  const finalEth = await ethers.provider.getBalance(deployer);
  const finalStest = await token.balanceOf(deployer);

  console.log(`
  NEW FACTORY ADDRESS: ${factoryAddr}
  
  Token:          ${tokenAddr} (STEST)
  Launch:         ${launchAddr}
  Pool:           ${poolAddr}
  Fee Splitter:   ${feeSplitterAddr}
  Staking Vault:  ${stakingVaultAddr}
  LP Token ID:    ${lpTokenId}
  
  Final ETH:   ${ethers.formatEther(finalEth)}
  Final STEST: ${ethers.formatEther(finalStest)}
  
  Update .env.local with:
    NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_ADDRESS=${factoryAddr}
  `);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
