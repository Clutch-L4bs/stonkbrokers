const hre = require("hardhat");

function loadArtifact(path) {
  // eslint-disable-next-line import/no-dynamic-require,global-require
  return require(path);
}

async function deployFromArtifact(artifact, signer, args = [], opts = {}) {
  const factory = await hre.ethers.getContractFactoryFromArtifact(artifact, signer);
  const contract = await factory.deploy(...args, opts);
  await contract.waitForDeployment();
  return contract;
}

async function deployLinkedFromArtifact(artifact, signer, libraries, args = []) {
  const factory = await hre.ethers.getContractFactoryFromArtifact(artifact, {
    signer,
    libraries,
  });
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Network: ${hre.network.name} (chainId=${hre.network.config.chainId})`);

  // 1) WETH9 (wrapper) - local 0.8.24 contract for testnet use
  const WETH9 = await hre.ethers.getContractFactory("WETH9");
  const weth = await WETH9.deploy();
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log(`WETH9: ${wethAddress}`);

  // 2) Uniswap v3 core
  const factoryArt = loadArtifact("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json");
  const uniFactory = await deployFromArtifact(factoryArt, deployer);
  const uniFactoryAddress = await uniFactory.getAddress();
  console.log(`UniswapV3Factory: ${uniFactoryAddress}`);

  // 3) Periphery libraries / descriptors
  const nftDescriptorArt = loadArtifact("@uniswap/v3-periphery/artifacts/contracts/libraries/NFTDescriptor.sol/NFTDescriptor.json");
  const nftDescriptorLib = await deployFromArtifact(nftDescriptorArt, deployer);
  const nftDescriptorLibAddress = await nftDescriptorLib.getAddress();
  console.log(`NFTDescriptor (lib): ${nftDescriptorLibAddress}`);

  const tokenPosDescArt = loadArtifact("@uniswap/v3-periphery/artifacts/contracts/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json");
  const nativeLabelBytes = hre.ethers.encodeBytes32String("ETH");
  const tokenPosDescriptor = await deployLinkedFromArtifact(
    tokenPosDescArt,
    deployer,
    { NFTDescriptor: nftDescriptorLibAddress },
    [wethAddress, nativeLabelBytes]
  );
  const tokenPosDescriptorAddress = await tokenPosDescriptor.getAddress();
  console.log(`NonfungibleTokenPositionDescriptor: ${tokenPosDescriptorAddress}`);

  // 4) NonfungiblePositionManager
  const npmArt = loadArtifact("@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json");
  const positionManager = await deployFromArtifact(npmArt, deployer, [
    uniFactoryAddress,
    wethAddress,
    tokenPosDescriptorAddress,
  ]);
  const positionManagerAddress = await positionManager.getAddress();
  console.log(`NonfungiblePositionManager: ${positionManagerAddress}`);

  // 5) Router + Quoter + TickLens
  const routerArt = loadArtifact("@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json");
  const router = await deployFromArtifact(routerArt, deployer, [uniFactoryAddress, wethAddress]);
  const routerAddress = await router.getAddress();
  console.log(`SwapRouter: ${routerAddress}`);

  const quoterV2Art = loadArtifact("@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json");
  const quoterV2 = await deployFromArtifact(quoterV2Art, deployer, [uniFactoryAddress, wethAddress]);
  const quoterV2Address = await quoterV2.getAddress();
  console.log(`QuoterV2: ${quoterV2Address}`);

  const tickLensArt = loadArtifact("@uniswap/v3-periphery/artifacts/contracts/lens/TickLens.sol/TickLens.json");
  const tickLens = await deployFromArtifact(tickLensArt, deployer, []);
  const tickLensAddress = await tickLens.getAddress();
  console.log(`TickLens: ${tickLensAddress}`);

  console.log("\nCopy these into .env / frontend config:");
  console.log(`WETH9_ADDRESS=${wethAddress}`);
  console.log(`UNISWAP_V3_FACTORY_ADDRESS=${uniFactoryAddress}`);
  console.log(`UNISWAP_V3_SWAP_ROUTER_ADDRESS=${routerAddress}`);
  console.log(`UNISWAP_V3_QUOTER_V2_ADDRESS=${quoterV2Address}`);
  console.log(`UNISWAP_V3_POSITION_MANAGER_ADDRESS=${positionManagerAddress}`);
  console.log(`UNISWAP_V3_TICK_LENS_ADDRESS=${tickLensAddress}`);
  console.log(`UNISWAP_V3_TOKEN_DESCRIPTOR_ADDRESS=${tokenPosDescriptorAddress}`);
  console.log(`UNISWAP_V3_NFT_DESCRIPTOR_LIB=${nftDescriptorLibAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

