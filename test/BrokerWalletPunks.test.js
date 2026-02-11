const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BrokerWalletPunks", function () {
  async function deployFixture() {
    const [owner, user, attacker] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("RobinhoodStockToken");
    const token = await Token.deploy(owner.address);
    await token.waitForDeployment();

    const Registry = await ethers.getContractFactory("ERC6551Registry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();

    const AccountImpl = await ethers.getContractFactory("StonkBroker6551Account");
    const accountImpl = await AccountImpl.deploy();
    await accountImpl.waitForDeployment();

    const NFT = await ethers.getContractFactory("BrokerWalletPunks");
    const nft = await NFT.deploy(
      [await token.getAddress()],
      await registry.getAddress(),
      await accountImpl.getAddress(),
      owner.address
    );
    await nft.waitForDeployment();

    await token.setMinter(owner.address);
    await token.mint(await nft.getAddress(), ethers.parseUnits("1000000", 18));
    return { owner, user, attacker, token, nft, registry, accountImpl };
  }

  it("mints and funds a dedicated wallet per NFT", async function () {
    const { user, token, nft } = await deployFixture();
    const mintPrice = await nft.MINT_PRICE();

    await nft.connect(user).mint(1, { value: mintPrice });
    expect(await nft.totalSupply()).to.equal(1);
    expect(await nft.ownerOf(1)).to.equal(user.address);
    const wallet = await nft.tokenWallet(1);
    expect(wallet).to.not.equal(ethers.ZeroAddress);
    expect(wallet).to.equal(await nft.predictWallet(1));
    expect(await token.balanceOf(wallet)).to.be.gt(0);
  });

  it("lets NFT owner operate wallet and blocks others", async function () {
    const { user, attacker, token, nft } = await deployFixture();
    const mintPrice = await nft.MINT_PRICE();

    await nft.connect(user).mint(1, { value: mintPrice });
    const walletAddress = await nft.tokenWallet(1);
    const fundedToken = await nft.fundedToken(1);
    expect(fundedToken).to.equal(await token.getAddress());
    const funded = await token.balanceOf(walletAddress);
    const wallet = await ethers.getContractAt("StonkBroker6551Account", walletAddress);

    await expect(
      wallet.connect(attacker).executeTokenTransfer(await token.getAddress(), attacker.address, 1)
    ).to.be.revertedWith("not token owner");

    await wallet.connect(user).executeTokenTransfer(await token.getAddress(), user.address, funded);
    expect(await token.balanceOf(walletAddress)).to.equal(0);
    expect(await token.balanceOf(user.address)).to.equal(funded);
  });
});
