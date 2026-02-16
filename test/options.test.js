const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Options (covered calls)", function () {
  async function deploy() {
    const [deployer, writer, buyer] = await ethers.getSigners();

    const MockOracle = await ethers.getContractFactory("MockTwapOracle");
    const oracle = await MockOracle.deploy();

    const OptionNFT = await ethers.getContractFactory("StonkOptionPositionNFT");
    const opt = await OptionNFT.deploy(deployer.address);

    const Vault = await ethers.getContractFactory("StonkCoveredCallVault");
    const vault = await Vault.deploy(await oracle.getAddress(), await opt.getAddress(), deployer.address);

    // Vault must own the option NFT for mint/markExercised.
    await opt.transferOwnership(await vault.getAddress());

    const WETH9 = await ethers.getContractFactory("WETH9");
    const quote = await WETH9.deploy();

    const Meme = await ethers.getContractFactory("StonkMemeCoin");
    const underlying = await Meme.deploy("UNDER", "UND", ethers.parseUnits("1000000", 18), writer.address, "ipfs://m");

    // Buyer needs quote for premium/strike.
    await quote.connect(buyer).deposit({ value: ethers.parseEther("10") });

    const Pool = await ethers.getContractFactory("MockUniswapV3Pool");
    const poolUQ = await Pool.deploy(await underlying.getAddress(), await quote.getAddress()); // token0=underlying token1=quote
    const poolQU = await Pool.deploy(await quote.getAddress(), await underlying.getAddress()); // token0=quote token1=underlying

    return { deployer, writer, buyer, oracle, opt, vault, quote, underlying, poolUQ, poolQU };
  }

  it("create offer -> buy -> exercise uses quote/underlying tick orientation (token0=underlying)", async function () {
    const { writer, buyer, oracle, vault, quote, underlying, poolUQ, opt } = await deploy();

    const underlyingAmount = ethers.parseUnits("100", 18);
    const strikeQuoteAmount = ethers.parseUnits("1", 18);
    const premiumQuoteAmount = ethers.parseUnits("0.1", 18);
    const expiry = (await ethers.provider.getBlock("latest")).timestamp + 3600;

    // strikeTick is quote/underlying tick. For token0=underlying token1=quote, pool tick already is quote/underlying.
    const strikeTick = 100;

    await underlying.connect(writer).approve(await vault.getAddress(), underlyingAmount);
    const offerTx = await vault.connect(writer).createOffer(
      await underlying.getAddress(),
      await quote.getAddress(),
      await poolUQ.getAddress(),
      3600,
      strikeTick,
      underlyingAmount,
      strikeQuoteAmount,
      premiumQuoteAmount,
      expiry
    );
    await offerTx.wait();

    await quote.connect(buyer).approve(await vault.getAddress(), premiumQuoteAmount);
    const buyTx = await vault.connect(buyer).buyOption(1);
    const buyRc = await buyTx.wait();
    expect(buyRc).to.not.equal(null);

    // Option tokenId should be 1.
    expect(await opt.ownerOf(1)).to.equal(buyer.address);

    // OTM: twap tick below strike
    await oracle.setTick(await poolUQ.getAddress(), 50);
    await quote.connect(buyer).approve(await vault.getAddress(), strikeQuoteAmount);
    await expect(vault.connect(buyer).exercise(1)).to.be.revertedWith("not ITM");

    // ITM: twap tick above strike
    await oracle.setTick(await poolUQ.getAddress(), 150);
    const undBefore = await underlying.balanceOf(buyer.address);
    const quoteBefore = await quote.balanceOf(writer.address);
    await vault.connect(buyer).exercise(1);
    expect(await underlying.balanceOf(buyer.address)).to.equal(undBefore + underlyingAmount);
    expect(await quote.balanceOf(writer.address)).to.equal(quoteBefore + strikeQuoteAmount);
  });

  it("supports pool token ordering flip by inverting spot tick (token0=quote)", async function () {
    const { writer, buyer, oracle, vault, quote, underlying, poolQU, opt } = await deploy();

    const underlyingAmount = ethers.parseUnits("10", 18);
    const strikeQuoteAmount = ethers.parseUnits("1", 18);
    const premiumQuoteAmount = ethers.parseUnits("0.1", 18);
    const expiry = (await ethers.provider.getBlock("latest")).timestamp + 3600;

    // strikeTick is ALWAYS in canonical Uniswap pool tick space: price(token1/token0).
    // For this pool token0=quote token1=underlying => tick is underlying/quote.
    // If you conceptually want a strike in quote/underlying, you'd invert it (negate tick).
    const strikeTick = -100;

    await underlying.connect(writer).approve(await vault.getAddress(), underlyingAmount);
    await vault.connect(writer).createOffer(
      await underlying.getAddress(),
      await quote.getAddress(),
      await poolQU.getAddress(),
      3600,
      strikeTick,
      underlyingAmount,
      strikeQuoteAmount,
      premiumQuoteAmount,
      expiry
    );

    await quote.connect(buyer).approve(await vault.getAddress(), premiumQuoteAmount);
    await vault.connect(buyer).buyOption(1);
    expect(await opt.ownerOf(1)).to.equal(buyer.address);

    // For token0=quote token1=underlying, pool tick is underlying/quote.
    // Since underlying is token1, ITM when twapTick <= strikeTick.
    await oracle.setTick(await poolQU.getAddress(), -50); // -50 > -100 => OTM
    await quote.connect(buyer).approve(await vault.getAddress(), strikeQuoteAmount);
    await expect(vault.connect(buyer).exercise(1)).to.be.revertedWith("not ITM");

    await oracle.setTick(await poolQU.getAddress(), -150); // -150 <= -100 => ITM
    await expect(vault.connect(buyer).exercise(1)).to.not.be.reverted;
  });

  it("writer can reclaim expired underlying if unexercised", async function () {
    const { writer, buyer, oracle, vault, quote, underlying, poolUQ, opt } = await deploy();

    const underlyingAmount = ethers.parseUnits("5", 18);
    const strikeQuoteAmount = ethers.parseUnits("1", 18);
    const premiumQuoteAmount = ethers.parseUnits("0.1", 18);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    const expiry = now + 600; // must be > now + 5 minutes (contract guard)

    await underlying.connect(writer).approve(await vault.getAddress(), underlyingAmount);
    await vault.connect(writer).createOffer(
      await underlying.getAddress(),
      await quote.getAddress(),
      await poolUQ.getAddress(),
      3600,
      0,
      underlyingAmount,
      strikeQuoteAmount,
      premiumQuoteAmount,
      expiry
    );

    await quote.connect(buyer).approve(await vault.getAddress(), premiumQuoteAmount);
    await vault.connect(buyer).buyOption(1);
    expect(await opt.ownerOf(1)).to.equal(buyer.address);

    // Expire without exercising.
    await oracle.setTick(await poolUQ.getAddress(), 999);
    await ethers.provider.send("evm_increaseTime", [700]);
    await ethers.provider.send("evm_mine");

    const writerUndBefore = await underlying.balanceOf(writer.address);
    await vault.connect(writer).reclaimExpired(1);
    expect(await underlying.balanceOf(writer.address)).to.equal(writerUndBefore + underlyingAmount);
  });
});

