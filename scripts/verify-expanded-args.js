require("dotenv").config();

const stockTokens = (process.env.STOCK_TOKEN_ADDRESSES || "")
  .split(",")
  .map((addr) => addr.trim())
  .filter(Boolean);

module.exports = [
  stockTokens,
  Number(process.env.CONTINUATION_START_TOKEN_ID || "445"),
  Number(process.env.EXPANDED_END_TOKEN_ID || "4444"),
  process.env.ERC6551_REGISTRY_ADDRESS,
  process.env.ERC6551_ACCOUNT_IMPLEMENTATION,
  process.env.DEPLOYER_ADDRESS || "0xF58F19Be7c3ab385500862DC2391f42b6596f978",
];
