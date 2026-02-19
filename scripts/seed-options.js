/**
 * Seed 20 covered-call options and buy 10 of them.
 * Uses the tokens already created by seed-demo-data.js.
 *
 * Run:  npx hardhat run scripts/seed-options.js --network robinhoodTestnet
 */
const { ethers } = require("hardhat");

const WETH9  = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const VAULT  = "0x055d84908672b9be53275963862614aEA9CDB98B";

const ERC20ABI = [
  "function balanceOf(address) external view returns (uint256)",
  "function approve(address,uint256) external returns (bool)",
  "function symbol() external view returns (string)"
];
const WETH9ABI = [
  "function deposit() external payable",
  "function approve(address,uint256) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)"
];
const VaultABI = [
  "function createOffer(address underlying,address quote,address pool,uint32 twapSeconds,int24 strikeTick,uint256 underlyingAmount,uint256 strikeQuoteAmount,uint256 premiumQuoteAmount,uint256 expiry) external returns (uint256 offerId)",
  "function buyOption(uint256 offerId) external returns (uint256 optionTokenId)",
  "function nextOfferId() external view returns (uint256)"
];
const UniPoolABI = [
  "function slot0() external view returns (uint160 sqrtPriceX96,int24 tick,uint16 observationIndex,uint16 observationCardinality,uint16 observationCardinalityNext,uint8 feeProtocol,bool unlocked)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
  "function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external"
];

function ok(msg)   { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); }
function line(msg) { console.log(`\n${"═".repeat(60)}\n  ${msg}\n${"═".repeat(60)}`); }

const TOKENS = [
  { token: "0xc8e18b9155586c524DEe981cf751627fFA5283Df", pool: "0xB7ff2a6CeD28C7ab778a86D417090b2b523746f8", symbol: "DOGE" },
  { token: "0x227E228859cfBA27E1c8Fe66CC925D19637ebd03", pool: "0xD07267Ee1D7e709f9E395FFD59841BE4A3A57688", symbol: "PEPE" },
  { token: "0xA7F94470b0bd8cb7cC08aBdA6E6deaa5b202B556", pool: "0xD280Ad6a91852d8e64246A1c3a3A14e355f231c4", symbol: "MOON" },
  { token: "0x187Ad45c80C225ceC37ebBDEB3C87ec2fAeaf0bA", pool: "0x5c2cf8f000aC67E34851750e59723F6C0fC30b3A", symbol: "WAGMI" },
  { token: "0xe2bA5d05D5A1e5444B14aE5df59D686E4461c7C8", pool: "0xfc87261fDA4C471f7e1e17b3E5b69ef678FC367a", symbol: "SROCK" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const vault = new ethers.Contract(VAULT, VaultABI, signer);
  const weth  = new ethers.Contract(WETH9, WETH9ABI, signer);

  line("SEED OPTIONS — 20 OFFERS + BUY 10");
  info(`Deployer: ${deployer}`);
  info(`Balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer))} ETH`);

  // Wrap WETH for premiums + approve vault
  try {
    const wrapTx = await weth.deposit({ value: ethers.parseEther("0.02") });
    await wrapTx.wait();
    await (await weth.approve(VAULT, ethers.MaxUint256)).wait();
    ok("Wrapped 0.02 ETH → WETH, approved vault for WETH");
  } catch (e) {
    warn(`WETH prep: ${e.reason || e.message}`);
  }

  const TICK_SPACING = 60;
  const MIN_TWAP = 900; // 15 min (contract minimum)
  const now = Math.floor(Date.now() / 1000);
  const offersPerToken = 4;
  const offerIds = [];

  // First, increase observation cardinality on each pool so TWAP works
  line("INCREASING POOL OBSERVATION CARDINALITY");
  for (const t of TOKENS) {
    try {
      const pool = new ethers.Contract(t.pool, UniPoolABI, signer);
      const tx = await pool.increaseObservationCardinalityNext(100);
      await tx.wait();
      ok(`$${t.symbol} pool cardinality increased to 100`);
    } catch (e) {
      warn(`$${t.symbol} cardinality: ${e.reason || e.message}`);
    }
  }

  line("WRITING 20 OPTIONS");
  for (const t of TOKENS) {
    const token = new ethers.Contract(t.token, ERC20ABI, signer);
    const bal = await token.balanceOf(deployer);
    info(`$${t.symbol} balance: ${ethers.formatEther(bal)}`);
    if (bal === 0n) { warn(`No $${t.symbol} — skipping`); continue; }

    // Approve underlying to vault
    await (await token.approve(VAULT, ethers.MaxUint256)).wait();

    // Read current tick
    let currentTick = 0;
    try {
      const pool = new ethers.Contract(t.pool, UniPoolABI, signer);
      const slot = await pool.slot0();
      currentTick = Number(slot.tick);
      info(`$${t.symbol} current tick: ${currentTick}`);
    } catch (e) {
      warn(`Could not read tick for $${t.symbol}: ${e.reason || e.message}`);
    }

    const roundedTick = Math.round(currentTick / TICK_SPACING) * TICK_SPACING;

    for (let j = 0; j < offersPerToken; j++) {
      // Each offer varies in: strike (progressively higher), size, premium, expiry
      const strikeTick = roundedTick + (j + 1) * TICK_SPACING * 3;
      const sizePct = 2n + BigInt(j);
      const underlyingAmt = bal * sizePct / 100n;
      if (underlyingAmt === 0n) continue;

      // Strike = number of WETH to exercise. Scale relative to pool price.
      // Use a small fixed value that makes sense for tiny token prices.
      const strikeQuote = ethers.parseEther("0.0001") * (BigInt(j) + 1n);
      const premium = ethers.parseEther("0.00001") * (BigInt(j) + 1n);
      const expiry = now + 86400 * (3 + j * 3); // 3d, 6d, 9d, 12d

      try {
        info(`Writing call #${j + 1} on $${t.symbol}: strikeTick=${strikeTick}, expiry +${3 + j * 3}d, size=${ethers.formatEther(underlyingAmt)}...`);
        const tx = await vault.createOffer(
          t.token,       // underlying
          WETH9,         // quote
          t.pool,        // pool
          MIN_TWAP,      // twapSeconds (15 min — contract minimum)
          strikeTick,
          underlyingAmt,
          strikeQuote,
          premium,
          expiry,
          { gasLimit: 500_000n }
        );
        const receipt = await tx.wait();

        const iface = new ethers.Interface([
          "event OfferCreated(uint256 indexed offerId, address indexed writer, address indexed underlying, uint256 underlyingAmount)"
        ]);
        let offerId = null;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "OfferCreated") offerId = parsed.args.offerId;
          } catch { /* skip */ }
        }
        if (offerId !== null) {
          offerIds.push(offerId);
          ok(`Offer #${offerId} — $${t.symbol}`);
        } else {
          const nid = await vault.nextOfferId();
          offerIds.push(nid - 1n);
          ok(`Offer ~#${nid - 1n} — $${t.symbol}`);
        }
      } catch (e) {
        warn(`Write failed for $${t.symbol} #${j + 1}: ${e.reason || e.message}`);
      }
    }
  }

  // Buy 10 of the offers
  line(`BUYING OPTIONS (${Math.min(10, offerIds.length)} of ${offerIds.length})`);
  let bought = 0;
  for (const oid of offerIds.slice(0, 10)) {
    try {
      info(`Buying offer #${oid}...`);
      const tx = await vault.buyOption(oid, { gasLimit: 500_000n });
      await tx.wait();
      ok(`Bought option from offer #${oid}`);
      bought++;
    } catch (e) {
      warn(`Buy #${oid} failed: ${e.reason || e.message}`);
    }
  }

  line("OPTIONS SEED COMPLETE");
  console.log(`  Written: ${offerIds.length}`);
  console.log(`  Bought:  ${bought}`);
  console.log(`  Final ETH: ${ethers.formatEther(await ethers.provider.getBalance(deployer))}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
