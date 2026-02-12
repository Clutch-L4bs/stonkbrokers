require("dotenv").config();

module.exports = [
  process.env.ORIGINAL_NFT_CONTRACT_ADDRESS || process.env.NFT_CONTRACT_ADDRESS,
  process.env.LEGACY_EXPANDED_NFT_CONTRACT_ADDRESS || process.env.EXPANDED_NFT_CONTRACT_ADDRESS,
  process.env.EXPANDED_NFT_CONTRACT_ADDRESS,
  process.env.OWNER_ADDRESS || process.env.DEPLOYER_ADDRESS || "0xF58F19Be7c3ab385500862DC2391f42b6596f978",
];
