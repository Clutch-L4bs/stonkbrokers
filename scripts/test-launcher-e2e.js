/**
 * End-to-end test: Meme Coin Launcher → Buy → Finalize → Swap → Stake
 *
 * Uses the deployer wallet to exercise every launcher function on Robinhood testnet.
 * Run: npx hardhat run scripts/test-launcher-e2e.js --network robinhoodTestnet
 */
const { ethers } = require("hardhat");

/* ── Addresses from .env.local ── */
const FACTORY   = "0xEA095646EC6A56EDbFEe84cCcf23eFCec12566A0";
const WETH9     = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const ROUTER    = "0x1b32F47434a7EF83E97d0675C823E547F9266725";
const REGISTRY  = "0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b";

/* ── Minimal ABIs ── */
const FactoryABI = [
  "function createLaunch((string name,string symbol,string metadataURI,string imageURI,uint256 totalSupplyWei,uint256 creatorAllocationBps,uint256 saleBpsOfRemaining,uint256 priceWeiPerToken) p) external returns (address token, address launch)",
  "function finalizeLaunch(address launch, uint160 sqrtPriceX96, uint24 fee) external payable",
  "function launches(address launch) external view returns (address creator, address token, bool finalized)",
  "event LaunchCreated(address indexed creator, address indexed token, address indexed launch, string name, string symbol, string metadataURI, string imageURI)"
];

const LaunchABI = [
  "function buy() external payable",
  "function memeToken() external view returns (address)",
  "function sold() external view returns (uint256)",
  "function saleSupply() external view returns (uint256)",
  "function remainingForSale() external view returns (uint256)",
  "function priceWeiPerToken() external view returns (uint256)",
  "function pool() external view returns (address)",
  "function feeSplitter() external view returns (address)",
  "function stakingVault() external view returns (address)"
];

const VaultABI = [
  "function stake(uint256 amount) external",
  "function unstake(uint256 amount) external",
  "function claim() external",
  "function users(address user) external view returns (uint256 staked, uint256 unlockTime, uint256 debt0, uint256 debt1)",
  "function pendingRewards(address user) external view returns (uint256 pending0, uint256 pending1)",
  "function stakeToken() external view returns (address)"
];

const FeeSplitterABI = [
  "function collectAndSplit() external returns (uint256 amount0, uint256 amount1)"
];

const ERC20ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)",
  "function totalSupply() external view returns (uint256)"
];

const RouterABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
  "function multicall(bytes[] data) external payable returns (bytes[] results)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) external payable",
  "function refundETH() external payable"
];

const WETH9ABI = [
  "function deposit() external payable",
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
];

const RegistryABI = [
  "function addToken(address token, string calldata symbol, uint8 decimals, bool whitelisted) external"
];

/* ── Helpers ── */
function sqrtBigInt(n) {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}

function computeSqrtPriceX96(priceWei, memeToken, weth) {
  // priceWei = ETH per token (18 decimals), i.e. cost of 1 token in wei
  // Both tokens have 18 decimals, so no decimal adjustment needed.
  // Uniswap V3 sqrtPriceX96 = sqrt(token1/token0) * 2^96
  // token0 < token1 by address sort.
  const meme = memeToken.toLowerCase();
  const w = weth.toLowerCase();
  const token0 = meme < w ? meme : w;
  const Q96 = 2n ** 96n;

  // price ratio = WETH/MEME = priceWei / 1e18 (how much WETH for 1 MEME)
  // If token0 = MEME, token1 = WETH: ratio = price (WETH per MEME)
  // If token0 = WETH, token1 = MEME: ratio = 1/price (MEME per WETH)

  let numerator, denominator;
  if (token0 === meme) {
    // sqrtPrice = sqrt(WETH/MEME) * Q96 = sqrt(priceWei/1e18) * Q96
    numerator = priceWei;
    denominator = 10n ** 18n;
  } else {
    // sqrtPrice = sqrt(MEME/WETH) * Q96 = sqrt(1e18/priceWei) * Q96
    numerator = 10n ** 18n;
    denominator = priceWei;
  }

  // sqrtPriceX96 = sqrt(numerator/denominator) * Q96
  // = Q96 * sqrt(numerator) / sqrt(denominator)
  // To avoid precision loss, multiply by high precision first:
  // = sqrt(numerator * Q96^2 / denominator)
  const val = (numerator * Q96 * Q96) / denominator;
  return sqrtBigInt(val);
}

function line(msg) {
  console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`);
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const balance = await ethers.provider.getBalance(deployer);
  
  line("LAUNCHER E2E TEST");
  info(`Deployer: ${deployer}`);
  info(`Balance:  ${ethers.formatEther(balance)} ETH`);

  const factory = new ethers.Contract(FACTORY, FactoryABI, signer);

  /* ════════════════════════════════════════════════════════════
   * STEP 1: Create Launch
   * ════════════════════════════════════════════════════════════ */
  line("STEP 1: CREATE LAUNCH");

  const totalSupply = ethers.parseEther("1000000");  // 1M tokens
  const creatorBps  = 500n;   // 5%
  const saleBps     = 6000n;  // 60% of remaining
  const priceWei    = ethers.parseEther("0.000001"); // 0.000001 ETH per token

  info(`Name: StonkTestCoin | Symbol: STEST`);
  info(`Total supply: 1,000,000 | Creator: 5% | Sale: 60%`);
  info(`Price: 0.000001 ETH/token`);

  let tokenAddr, launchAddr;
  try {
    const tx = await factory.createLaunch({
      name: "StonkTestCoin",
      symbol: "STEST",
      metadataURI: "ipfs://test-metadata",
      imageURI: "https://stonkbrokers.cash/logo.png",
      totalSupplyWei: totalSupply,
      creatorAllocationBps: creatorBps,
      saleBpsOfRemaining: saleBps,
      priceWeiPerToken: priceWei
    });
    info(`Tx sent: ${tx.hash}`);
    const receipt = await tx.wait();
    ok(`Confirmed in block ${receipt.blockNumber}`);

    // Parse event
    const iface = new ethers.Interface(FactoryABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed && parsed.name === "LaunchCreated") {
          tokenAddr = parsed.args.token;
          launchAddr = parsed.args.launch;
          ok(`Token:  ${tokenAddr}`);
          ok(`Launch: ${launchAddr}`);
          ok(`Symbol: ${parsed.args.symbol}`);
        }
      } catch { /* not our event */ }
    }
    if (!launchAddr) throw new Error("No LaunchCreated event found");
  } catch (e) {
    fail(`createLaunch failed: ${e.message}`);
    return;
  }

  // Verify launch record
  const [creator, tok, finalized] = await factory.launches(launchAddr);
  ok(`Factory.launches() → creator=${creator}, token=${tok}, finalized=${finalized}`);
  if (creator.toLowerCase() !== deployer.toLowerCase()) fail("Creator mismatch!");
  if (finalized) fail("Should not be finalized yet!");

  /* ════════════════════════════════════════════════════════════
   * STEP 2: Check Launch State
   * ════════════════════════════════════════════════════════════ */
  line("STEP 2: CHECK LAUNCH STATE");
  const launch = new ethers.Contract(launchAddr, LaunchABI, signer);
  const token = new ethers.Contract(tokenAddr, ERC20ABI, signer);

  const memeToken = await launch.memeToken();
  const saleSupply = await launch.saleSupply();
  const remaining = await launch.remainingForSale();
  const price = await launch.priceWeiPerToken();
  const sold = await launch.sold();

  ok(`memeToken:       ${memeToken}`);
  ok(`saleSupply:      ${ethers.formatEther(saleSupply)} tokens`);
  ok(`remainingForSale:${ethers.formatEther(remaining)} tokens`);
  ok(`priceWeiPerToken:${ethers.formatEther(price)} ETH`);
  ok(`sold:            ${ethers.formatEther(sold)} tokens`);

  // Check creator got allocation
  const creatorBal = await token.balanceOf(deployer);
  ok(`Creator token balance: ${ethers.formatEther(creatorBal)}`);
  if (creatorBal === 0n) warn("Creator allocation is 0 — may be normal if 0 bps");

  /* ════════════════════════════════════════════════════════════
   * STEP 3: Buy Tokens
   * ════════════════════════════════════════════════════════════ */
  line("STEP 3: BUY TOKENS");

  const buyEthAmount = ethers.parseEther("0.01"); // 0.01 ETH
  const expectedTokens = (buyEthAmount * (10n ** 18n)) / price;
  info(`Sending ${ethers.formatEther(buyEthAmount)} ETH`);
  info(`Expected ~${ethers.formatEther(expectedTokens)} tokens`);

  try {
    const buyTx = await launch.buy({ value: buyEthAmount });
    info(`Tx sent: ${buyTx.hash}`);
    const buyReceipt = await buyTx.wait();
    ok(`Confirmed in block ${buyReceipt.blockNumber}`);

    const balAfterBuy = await token.balanceOf(deployer);
    const soldAfterBuy = await launch.sold();
    const remainingAfterBuy = await launch.remainingForSale();
    ok(`Token balance after buy: ${ethers.formatEther(balAfterBuy)}`);
    ok(`Sold:     ${ethers.formatEther(soldAfterBuy)}`);
    ok(`Remaining:${ethers.formatEther(remainingAfterBuy)}`);
  } catch (e) {
    fail(`buy() failed: ${e.message}`);
    return;
  }

  /* ════════════════════════════════════════════════════════════
   * STEP 4: Finalize (create pool + LP)
   * ════════════════════════════════════════════════════════════ */
  line("STEP 4: FINALIZE LAUNCH");

  const sqrtPriceX96 = computeSqrtPriceX96(price, tokenAddr, WETH9);
  const feeTier = 3000; // 0.3%
  info(`sqrtPriceX96: ${sqrtPriceX96.toString()}`);
  info(`Fee tier: ${feeTier} (0.3%)`);

  // Debug: check ordering and sqrtPriceX96 value
  const t0 = tokenAddr.toLowerCase() < WETH9.toLowerCase() ? tokenAddr : WETH9;
  const t1 = tokenAddr.toLowerCase() < WETH9.toLowerCase() ? WETH9 : tokenAddr;
  info(`token0: ${t0} (${t0.toLowerCase() === tokenAddr.toLowerCase() ? "MEME" : "WETH"})`);
  info(`token1: ${t1} (${t1.toLowerCase() === tokenAddr.toLowerCase() ? "MEME" : "WETH"})`);

  const ethToSend = ethers.parseEther("0.01");
  info(`Sending ${ethers.formatEther(ethToSend)} ETH with finalize`);

  try {
    // First try estimateGas to get better error
    try {
      const gas = await factory.finalizeLaunch.estimateGas(launchAddr, sqrtPriceX96, feeTier, {
        value: ethToSend
      });
      info(`Estimated gas: ${gas.toString()}`);
    } catch (estErr) {
      warn(`Gas estimate failed: ${estErr.reason || estErr.message}`);
      if (estErr.data) info(`Revert data: ${estErr.data}`);
      // Continue to try anyway
    }

    const finTx = await factory.finalizeLaunch(launchAddr, sqrtPriceX96, feeTier, {
      value: ethToSend,
      gasLimit: 10_000_000n // high gas limit for complex tx
    });
    info(`Tx sent: ${finTx.hash}`);
    const finReceipt = await finTx.wait();
    ok(`Confirmed in block ${finReceipt.blockNumber}, gas: ${finReceipt.gasUsed.toString()}`);

    // Verify finalized
    const [, , fin] = await factory.launches(launchAddr);
    ok(`Finalized: ${fin}`);
    if (!fin) { fail("Launch not marked finalized!"); return; }

    const poolAddr = await launch.pool();
    const feeSplitterAddr = await launch.feeSplitter();
    const stakingVaultAddr = await launch.stakingVault();
    ok(`Pool:          ${poolAddr}`);
    ok(`Fee Splitter:  ${feeSplitterAddr}`);
    ok(`Staking Vault: ${stakingVaultAddr}`);

    if (poolAddr === ethers.ZeroAddress) { fail("Pool is zero address!"); return; }
    if (feeSplitterAddr === ethers.ZeroAddress) warn("Fee splitter is zero address");
    if (stakingVaultAddr === ethers.ZeroAddress) warn("Staking vault is zero address");
  } catch (e) {
    fail(`finalizeLaunch failed: ${e.reason || e.message}`);
    if (e.data) info(`Revert data: ${e.data}`);
    // Try to decode
    if (e.error && e.error.data) info(`Inner revert: ${e.error.data}`);
    return;
  }

  /* ════════════════════════════════════════════════════════════
   * STEP 5: Swap on DEX (WETH → STEST)
   * ════════════════════════════════════════════════════════════ */
  line("STEP 5: SWAP ON DEX (ETH → STEST)");

  const router = new ethers.Contract(ROUTER, RouterABI, signer);
  const weth = new ethers.Contract(WETH9, WETH9ABI, signer);
  const swapEthAmount = ethers.parseEther("0.002");

  try {
    // First wrap ETH to WETH
    info("Wrapping ETH → WETH...");
    const wrapTx = await weth.deposit({ value: swapEthAmount });
    await wrapTx.wait();
    ok(`Wrapped ${ethers.formatEther(swapEthAmount)} ETH to WETH`);

    // Approve router
    info("Approving WETH for router...");
    const approveTx = await weth.approve(ROUTER, swapEthAmount);
    await approveTx.wait();
    ok("WETH approved for router");

    const balBefore = await token.balanceOf(deployer);
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + 600n;

    info(`Swapping ${ethers.formatEther(swapEthAmount)} WETH → STEST...`);
    const swapTx = await router.exactInputSingle({
      tokenIn: WETH9,
      tokenOut: tokenAddr,
      fee: feeTier,
      recipient: deployer,
      deadline: deadline,
      amountIn: swapEthAmount,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n
    });
    const swapReceipt = await swapTx.wait();
    ok(`Swap confirmed in block ${swapReceipt.blockNumber}`);

    const balAfter = await token.balanceOf(deployer);
    const received = balAfter - balBefore;
    ok(`Received: ${ethers.formatEther(received)} STEST`);
    if (received === 0n) warn("Received 0 tokens from swap — check pool liquidity");
  } catch (e) {
    fail(`Swap failed: ${e.message}`);
    if (e.data) info(`Revert data: ${e.data}`);
  }

  /* ════════════════════════════════════════════════════════════
   * STEP 6: Swap back (STEST → WETH)
   * ════════════════════════════════════════════════════════════ */
  line("STEP 6: SWAP BACK (STEST → WETH)");

  try {
    const stestBal = await token.balanceOf(deployer);
    const swapBackAmount = stestBal / 10n; // swap 10% of balance
    if (swapBackAmount === 0n) { warn("No STEST to swap back"); } else {
      info(`Approving ${ethers.formatEther(swapBackAmount)} STEST for router...`);
      const appTx = await token.approve(ROUTER, swapBackAmount);
      await appTx.wait();
      ok("STEST approved");

      const wethBefore = await weth.balanceOf(deployer);
      const deadline2 = BigInt(Math.floor(Date.now() / 1000)) + 600n;

      info(`Swapping ${ethers.formatEther(swapBackAmount)} STEST → WETH...`);
      const swapTx2 = await router.exactInputSingle({
        tokenIn: tokenAddr,
        tokenOut: WETH9,
        fee: feeTier,
        recipient: deployer,
        deadline: deadline2,
        amountIn: swapBackAmount,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n
      });
      const rec2 = await swapTx2.wait();
      ok(`Swap confirmed in block ${rec2.blockNumber}`);

      const wethAfter = await weth.balanceOf(deployer);
      ok(`WETH received: ${ethers.formatEther(wethAfter - wethBefore)}`);
    }
  } catch (e) {
    fail(`Swap back failed: ${e.message}`);
  }

  /* ════════════════════════════════════════════════════════════
   * STEP 7: Stake Tokens
   * ════════════════════════════════════════════════════════════ */
  line("STEP 7: STAKE TOKENS");

  const vaultAddr = await launch.stakingVault();
  if (vaultAddr === ethers.ZeroAddress) {
    warn("No staking vault — skipping");
  } else {
    const vault = new ethers.Contract(vaultAddr, VaultABI, signer);

    try {
      const stakeTokenAddr = await vault.stakeToken();
      ok(`Stake token: ${stakeTokenAddr}`);

      const stakeToken = new ethers.Contract(stakeTokenAddr, ERC20ABI, signer);
      const myBal = await stakeToken.balanceOf(deployer);
      info(`My ${await stakeToken.symbol()} balance: ${ethers.formatEther(myBal)}`);

      if (myBal === 0n) {
        warn("No tokens to stake");
      } else {
        const stakeAmount = myBal / 5n; // stake 20%
        info(`Staking ${ethers.formatEther(stakeAmount)}...`);

        // Approve vault
        const appTx = await stakeToken.approve(vaultAddr, stakeAmount);
        await appTx.wait();
        ok("Token approved for vault");

        const stakeTx = await vault.stake(stakeAmount);
        const stakeReceipt = await stakeTx.wait();
        ok(`Staked in block ${stakeReceipt.blockNumber}`);

        // Check user info
        const userInfo = await vault.users(deployer);
        ok(`Staked amount: ${ethers.formatEther(userInfo.staked)}`);
        ok(`Unlock time:   ${userInfo.unlockTime.toString()} (unix)`);

        const [p0, p1] = await vault.pendingRewards(deployer);
        ok(`Pending rewards: token0=${ethers.formatEther(p0)}, token1=${ethers.formatEther(p1)}`);
      }
    } catch (e) {
      fail(`Staking failed: ${e.message}`);
    }
  }

  /* ════════════════════════════════════════════════════════════
   * STEP 8: Collect & Split Fees
   * ════════════════════════════════════════════════════════════ */
  line("STEP 8: COLLECT & SPLIT FEES");

  const splitterAddr = await launch.feeSplitter();
  if (splitterAddr === ethers.ZeroAddress) {
    warn("No fee splitter — skipping");
  } else {
    const splitter = new ethers.Contract(splitterAddr, FeeSplitterABI, signer);
    try {
      const collectTx = await splitter.collectAndSplit();
      const collectReceipt = await collectTx.wait();
      ok(`Fees collected in block ${collectReceipt.blockNumber}`);
    } catch (e) {
      // May fail if no fees have accrued yet — that's OK
      warn(`collectAndSplit: ${e.reason || e.message}`);
    }
  }

  /* ════════════════════════════════════════════════════════════
   * STEP 9: Register token in TokenRegistry
   * ════════════════════════════════════════════════════════════ */
  line("STEP 9: REGISTER TOKEN IN REGISTRY");

  try {
    const registry = new ethers.Contract(REGISTRY, RegistryABI, signer);
    const regTx = await registry.addToken(tokenAddr, "STEST", 18, true);
    await regTx.wait();
    ok(`STEST registered in StonkTokenRegistry`);
  } catch (e) {
    warn(`Registry: ${e.reason || e.message}`);
  }

  /* ════════════════════════════════════════════════════════════
   * FINAL SUMMARY
   * ════════════════════════════════════════════════════════════ */
  line("TEST COMPLETE — SUMMARY");

  const finalBal = await token.balanceOf(deployer);
  const finalEth = await ethers.provider.getBalance(deployer);

  console.log(`
  Token Address:   ${tokenAddr}
  Launch Address:  ${launchAddr}
  Pool:            ${await launch.pool()}
  Fee Splitter:    ${await launch.feeSplitter()}
  Staking Vault:   ${await launch.stakingVault()}
  
  Final STEST balance: ${ethers.formatEther(finalBal)}
  Final ETH balance:   ${ethers.formatEther(finalEth)}
  
  UI Address for .env.local testing:
    Launch page: /launcher/${launchAddr}
  `);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
