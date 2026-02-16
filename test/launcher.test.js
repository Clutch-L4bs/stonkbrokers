const { expect } = require("chai");
const { ethers } = require("hardhat");

function bn(x) {
  return BigInt(x);
}

describe("Stonk Launcher (meme coins)", function () {
  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address,uint256) returns (bool)",
    "function approve(address,uint256) returns (bool)",
  ];

  async function deploy() {
    const [owner, creator, buyer, treasury] = await ethers.getSigners();

    const WETH9 = await ethers.getContractFactory("WETH9");
    const weth = await WETH9.deploy();

    const PM = await ethers.getContractFactory("MockNonfungiblePositionManager");
    const pm = await PM.deploy();

    const Registry = await ethers.getContractFactory("StonkTokenRegistry");
    const registry = await Registry.deploy(owner.address);

    const Factory = await ethers.getContractFactory("StonkLauncherFactory");
    const factory = await Factory.deploy(owner.address, treasury.address, await weth.getAddress(), await pm.getAddress(), await registry.getAddress());

    // Allow the factory to auto-register launched tokens.
    await registry.connect(owner).setLauncherFactory(await factory.getAddress());

    return { owner, creator, buyer, treasury, weth, pm, registry, factory };
  }

  it("creates launch, sells tokens, and never under-charges due to rounding", async function () {
    const { creator, buyer, treasury, factory, registry } = await deploy();

    // Pick a price that doesn't divide 1e18 cleanly to exercise rounding edge-cases.
    const priceWeiPerToken = bn("300000000000000001"); // 0.300000000000000001 ETH per token (1e18 token units)
    const totalSupplyWei = ethers.parseUnits("1000", 18);

    const tx = await factory.connect(creator).createLaunch({
      name: "STONKCOIN",
      symbol: "STONK",
      metadataURI: "ipfs://meta",
      imageURI: "ipfs://img",
      totalSupplyWei,
      creatorAllocationBps: 500n,
      saleBpsOfRemaining: 6000n,
      priceWeiPerToken
    });
    const rc = await tx.wait();
    const ev = rc.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x) => x && x.name === "LaunchCreated");
    expect(ev).to.not.equal(undefined);
    const launchAddr = ev.args.launch;
    const tokenAddr = ev.args.token;

    const Launch = await ethers.getContractFactory("StonkLaunch");
    const launch = Launch.attach(launchAddr);

    const Meme = await ethers.getContractFactory("StonkMemeCoin");
    const meme = Meme.attach(tokenAddr);

    // Registry should auto-whitelist launched token when configured.
    const info = await registry.getToken(tokenAddr);
    expect(info.whitelisted).to.equal(true);

    // Buyer sends 1 ETH.
    const value = ethers.parseEther("1.0");
    const balEthBefore = await ethers.provider.getBalance(buyer.address);
    const balTokenBefore = await meme.balanceOf(buyer.address);

    const buyTx = await launch.connect(buyer).buy({ value });
    const buyRc = await buyTx.wait();

    const balTokenAfter = await meme.balanceOf(buyer.address);
    expect(balTokenAfter).to.be.gt(balTokenBefore);

    // The ETH actually kept by the contract is (msg.value - refund).
    // Since refund is paid inline, contract ETH balance equals ethRequired.
    const ethKept = await ethers.provider.getBalance(launchAddr);
    expect(ethKept).to.be.gt(0n);
    expect(ethKept).to.be.lte(value);

    // Ensure ethKept is the ceil(tokensOut*price/1e18) (never undercharged).
    const tokensOut = balTokenAfter - balTokenBefore;
    const ethExact = (tokensOut * priceWeiPerToken) / 10n ** 18n;
    const ethCeil = ((tokensOut * priceWeiPerToken) + (10n ** 18n - 1n)) / 10n ** 18n;
    expect(ethKept).to.equal(ethCeil);
    expect(ethKept).to.be.gte(ethExact);

    // Basic sanity: creator got creator allocation and treasury has nothing yet (fees come later).
    expect(await meme.balanceOf(treasury.address)).to.equal(0n);
    const creatorBal = await meme.balanceOf(creator.address);
    expect(creatorBal).to.be.gt(0n);

    // Buyer spent ~ethKept + gas.
    const balEthAfter = await ethers.provider.getBalance(buyer.address);
    const gas = buyRc.gasUsed * buyRc.gasPrice;
    expect(balEthBefore - balEthAfter).to.equal(ethKept + gas);
  });

  it("finalizes with ETH top-up, mints LP into fee splitter, and staking distributes fees", async function () {
    const { owner, creator, treasury, factory, pm, weth } = await deploy();

    const priceWeiPerToken = bn("1000000000000"); // 1e-6 ETH per token
    const totalSupplyWei = ethers.parseUnits("1000", 18);

    const tx = await factory.connect(creator).createLaunch({
      name: "STONK2",
      symbol: "STK2",
      metadataURI: "ipfs://meta2",
      imageURI: "ipfs://img2",
      totalSupplyWei,
      creatorAllocationBps: 1000n, // give creator stake inventory
      saleBpsOfRemaining: 0n,
      priceWeiPerToken
    });
    const rc = await tx.wait();
    const ev = rc.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x) => x && x.name === "LaunchCreated");
    const launchAddr = ev.args.launch;
    const tokenAddr = ev.args.token;

    const launch = (await ethers.getContractFactory("StonkLaunch")).attach(launchAddr);
    const meme = (await ethers.getContractFactory("StonkMemeCoin")).attach(tokenAddr);

    // Finalize needs some ETH so WETH side is non-zero. Provide as msg.value via factory.
    const sqrtPriceX96 = 2n ** 96n; // ~1.0 price
    await factory.connect(creator).finalizeLaunch(launchAddr, sqrtPriceX96, 3000, { value: ethers.parseEther("0.25") });

    expect(await launch.finalized()).to.equal(true);
    const splitterAddr = await launch.feeSplitter();
    const vaultAddr = await launch.stakingVault();
    expect(splitterAddr).to.properAddress;
    expect(vaultAddr).to.properAddress;

    // LP NFT should be held by the splitter.
    const lpTokenId = await launch.lpTokenId();
    expect(lpTokenId).to.be.gt(0n);
    expect(await pm.ownerOf(lpTokenId)).to.equal(splitterAddr);

    // Seed fee balances into the mock position manager, then collect+split.
    // Determine token0/token1 from splitter.
    const splitter = (await ethers.getContractFactory("StonkLpFeeSplitter")).attach(splitterAddr);
    const t0 = await splitter.token0();
    const t1 = await splitter.token1();

    // Transfer some fees into PM so collect() can send them to splitter.
    // We only need *some* fees for the staking flow; WETH fees alone are enough.

    // Deposit WETH for owner so we can seed WETH fees.
    await weth.connect(owner).deposit({ value: ethers.parseEther("2") });
    const wethErc20 = new ethers.Contract(await weth.getAddress(), erc20Abi, owner);
    await wethErc20.transfer(await pm.getAddress(), ethers.parseUnits("2", 18));

    // Collect+split once; if no stakers, vault will store undistributed.
    await splitter.collectAndSplit();

    // Stake 1 token to vault, then ensure undistributed becomes claimable.
    const vault = (await ethers.getContractFactory("StonkYieldStakingVault")).attach(vaultAddr);
    const stakeAmt = ethers.parseUnits("1", 18);

    const creatorBal = await meme.balanceOf(creator.address);
    expect(creatorBal).to.be.gte(stakeAmt);

    await meme.connect(creator).approve(vaultAddr, stakeAmt);
    await vault.connect(creator).stake(stakeAmt);

    const pending = await vault.pendingRewards(creator.address);
    // At least one side should have some rewards (WETH).
    const pending0 = pending[0];
    const pending1 = pending[1];
    expect(pending0 + pending1).to.be.gt(0n);
  });

  it("can sweep forced ETH after finalize", async function () {
    const { creator, treasury, factory } = await deploy();

    const tx = await factory.connect(creator).createLaunch({
      name: "SWEEP",
      symbol: "SWP",
      metadataURI: "ipfs://m",
      imageURI: "ipfs://i",
      totalSupplyWei: ethers.parseUnits("10", 18),
      creatorAllocationBps: 0n,
      saleBpsOfRemaining: 0n,
      priceWeiPerToken: 1n
    });
    const rc = await tx.wait();
    const ev = rc.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x) => x && x.name === "LaunchCreated");
    const launchAddr = ev.args.launch;
    const launch = (await ethers.getContractFactory("StonkLaunch")).attach(launchAddr);

    await factory.connect(creator).finalizeLaunch(launchAddr, 2n ** 96n, 3000, { value: ethers.parseEther("0.01") });

    // Force send ETH into launch after finalize.
    const Force = await ethers.getContractFactory("ForceSend");
    const f = await Force.deploy({ value: ethers.parseEther("0.02") });
    await f.boom(launchAddr);

    expect(await ethers.provider.getBalance(launchAddr)).to.equal(ethers.parseEther("0.02"));

    await expect(launch.connect(treasury).sweepEth(treasury.address)).to.not.be.reverted;
    expect(await ethers.provider.getBalance(launchAddr)).to.equal(0n);
  });

  it("reverts on invalid launch params", async function () {
    const { creator, factory } = await deploy();
    await expect(
      factory.connect(creator).createLaunch({
        name: "BAD",
        symbol: "BAD",
        metadataURI: "",
        imageURI: "",
        totalSupplyWei: 0n,
        creatorAllocationBps: 0n,
        saleBpsOfRemaining: 0n,
        priceWeiPerToken: 0n
      })
    ).to.be.reverted;
  });

  it("only creator/owner can finalize launch", async function () {
    const { creator, buyer, factory } = await deploy();
    const tx = await factory.connect(creator).createLaunch({
      name: "AUTH",
      symbol: "AUT",
      metadataURI: "ipfs://m",
      imageURI: "ipfs://i",
      totalSupplyWei: ethers.parseUnits("10", 18),
      creatorAllocationBps: 0n,
      saleBpsOfRemaining: 0n,
      priceWeiPerToken: 1n
    });
    const rc = await tx.wait();
    const ev = rc.logs
      .map((l) => {
        try {
          return factory.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((x) => x && x.name === "LaunchCreated");
    const launchAddr = ev.args.launch;

    await expect(factory.connect(buyer).finalizeLaunch(launchAddr, 2n ** 96n, 3000)).to.be.reverted;
  });
});

