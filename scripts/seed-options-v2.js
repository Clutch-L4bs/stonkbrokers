/**
 * Seed 20 covered-call option offers across 5 tokens.
 * Uses demo tokens (DOGE, PEPE, MOON, WAGMI, SROCK) which have pools and balances.
 *
 * Run:  npx hardhat run scripts/seed-options-v2.js --network robinhoodTestnet
 */
const { ethers } = require("hardhat");

const WETH9   = "0x37E402B8081eFcE1D82A09a066512278006e4691";
const VAULT   = "0x055d84908672b9be53275963862614aEA9CDB98B";
const FACTORY = "0xFECCB63CD759d768538458Ea56F47eA8004323c1";

const ERC20ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function symbol() view returns (string)"
];
const WETHABI = [
  "function deposit() payable",
  "function approve(address,uint256) returns (bool)",
  "function balanceOf(address) view returns (uint256)"
];
const VaultABI = [
  "function createOffer(address underlying,address quote,address pool,uint32 twapSeconds,int24 strikeTick,uint256 underlyingAmount,uint256 strikeQuoteAmount,uint256 premiumQuoteAmount,uint256 expiry) returns (uint256 offerId)",
  "function nextOfferId() view returns (uint256)"
];
const PoolABI = [
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
  "function increaseObservationCardinalityNext(uint16)"
];
const FactoryABI = [
  "function getPool(address,address,uint24) view returns (address)"
];

function ok(m)   { console.log(`  ✅ ${m}`); }
function info(m) { console.log(`  ℹ️  ${m}`); }
function warn(m) { console.log(`  ⚠️  ${m}`); }
function line(m) { console.log(`\n${"═".repeat(60)}\n  ${m}\n${"═".repeat(60)}`); }

const TOKENS = [
  { addr: "0xc8e18b9155586c524DEe981cf751627fFA5283Df", sym: "DOGE" },
  { addr: "0x227E228859cfBA27E1c8Fe66CC925D19637ebd03", sym: "PEPE" },
  { addr: "0xA7F94470b0bd8cb7cC08aBdA6E6deaa5b202B556", sym: "MOON" },
  { addr: "0x187Ad45c80C225ceC37ebBDEB3C87ec2fAeaf0bA", sym: "WAGMI" },
  { addr: "0xe2bA5d05D5A1e5444B14aE5df59D686E4461c7C8", sym: "SROCK" },
];

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = signer.address;
  const vault   = new ethers.Contract(VAULT, VaultABI, signer);
  const weth    = new ethers.Contract(WETH9, WETHABI, signer);
  const factory = new ethers.Contract(FACTORY, FactoryABI, signer);

  line("SEED OPTIONS v2 — 20 FRESH OFFERS");
  const ethBal = await ethers.provider.getBalance(deployer);
  info(`Deployer: ${deployer}`);
  info(`ETH Balance: ${ethers.formatEther(ethBal)}`);

  const startId = await vault.nextOfferId();
  info(`Current nextOfferId: ${startId}`);

  const FEE_TIERS = [10000, 3000, 500];
  const TICK_SPACING = 200;
  const MIN_TWAP = 900;
  const now = Math.floor(Date.now() / 1000);
  const OFFERS_PER_TOKEN = 4;

  const tokenData = [];
  for (const t of TOKENS) {
    const erc20 = new ethers.Contract(t.addr, ERC20ABI, signer);
    const bal = await erc20.balanceOf(deployer);
    info(`$${t.sym} balance: ${ethers.formatEther(bal)}`);

    let poolAddr = ethers.ZeroAddress;
    let fee = 0;
    for (const f of FEE_TIERS) {
      const p = await factory.getPool(t.addr, WETH9, f);
      if (p !== ethers.ZeroAddress) { poolAddr = p; fee = f; break; }
    }

    if (poolAddr === ethers.ZeroAddress) {
      warn(`No pool for $${t.sym} — skipping`);
      continue;
    }
    if (bal === 0n) {
      warn(`No balance for $${t.sym} — skipping`);
      continue;
    }

    let currentTick = 0;
    try {
      const pool = new ethers.Contract(poolAddr, PoolABI, signer);
      const slot = await pool.slot0();
      currentTick = Number(slot[1]);
      info(`$${t.sym} pool=${poolAddr.slice(0,10)}... fee=${fee} tick=${currentTick}`);
    } catch (e) {
      warn(`Cannot read slot0 for $${t.sym}: ${e.reason || e.message}`);
    }

    tokenData.push({ ...t, bal, poolAddr, fee, currentTick, erc20 });
  }

  line("INCREASE OBSERVATION CARDINALITY");
  for (const t of tokenData) {
    try {
      const pool = new ethers.Contract(t.poolAddr, PoolABI, signer);
      const tx = await pool.increaseObservationCardinalityNext(100);
      await tx.wait();
      ok(`$${t.sym} cardinality → 100`);
    } catch (e) {
      info(`$${t.sym} cardinality: ${e.reason || e.message}`);
    }
  }

  line("APPROVE TOKENS TO VAULT");
  for (const t of tokenData) {
    try {
      await (await t.erc20.approve(VAULT, ethers.MaxUint256)).wait();
      ok(`$${t.sym} approved`);
    } catch (e) {
      warn(`$${t.sym} approve: ${e.reason || e.message}`);
    }
  }

  line("WRITING 20 OFFERS");
  const offerIds = [];

  for (const t of tokenData) {
    const tickSpacing = t.fee === 10000 ? 200 : t.fee === 3000 ? 60 : 10;
    const roundedTick = Math.round(t.currentTick / tickSpacing) * tickSpacing;

    for (let j = 0; j < OFFERS_PER_TOKEN; j++) {
      const strikeTick = roundedTick + (j + 1) * tickSpacing * 3;
      const pctNum = 2n + BigInt(j);
      const underlyingAmt = t.bal * pctNum / 100n;
      if (underlyingAmt === 0n) { warn(`$${t.sym} offer #${j+1}: zero amount`); continue; }

      const strikeQuote = ethers.parseEther("0.0002") * (BigInt(j) + 1n);
      const premium     = ethers.parseEther("0.00002") * (BigInt(j) + 1n);
      const expiry      = now + 86400 * (7 + j * 7);

      const expiryDate = new Date(expiry * 1000).toLocaleDateString();
      info(`$${t.sym} call #${j+1}: strike tick=${strikeTick}, expires ${expiryDate}, size=${ethers.formatEther(underlyingAmt)}`);

      try {
        const tx = await vault.createOffer(
          t.addr,
          WETH9,
          t.poolAddr,
          MIN_TWAP,
          strikeTick,
          underlyingAmt,
          strikeQuote,
          premium,
          expiry,
          { gasLimit: 600_000n }
        );
        const receipt = await tx.wait();

        const iface = new ethers.Interface([
          "event OfferCreated(uint256 indexed offerId, address indexed writer, address indexed underlying, uint256 underlyingAmount)"
        ]);
        let offerId = null;
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed?.name === "OfferCreated") offerId = parsed.args.offerId;
          } catch { /* skip */ }
        }

        if (offerId !== null) {
          offerIds.push(offerId);
          ok(`Offer #${offerId} — $${t.sym}`);
        } else {
          const nid = await vault.nextOfferId();
          offerIds.push(nid - 1n);
          ok(`Offer ~#${nid - 1n} — $${t.sym}`);
        }
      } catch (e) {
        warn(`Write failed $${t.sym} #${j+1}: ${e.reason || e.message}`);
      }
    }
  }

  line("SEED OPTIONS v2 COMPLETE");
  const finalId = await vault.nextOfferId();
  console.log(`  Offers written: ${offerIds.length}`);
  console.log(`  Offer ID range: ${startId} → ${finalId - 1n}`);
  console.log(`  Final ETH: ${ethers.formatEther(await ethers.provider.getBalance(deployer))}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
