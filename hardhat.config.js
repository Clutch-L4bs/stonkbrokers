require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const privateKey = process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.startsWith("0x")
    ? process.env.PRIVATE_KEY
    : `0x${process.env.PRIVATE_KEY}`
  : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    // Uniswap v3-core/periphery targets Solidity 0.7.6, while Stonk contracts
    // target 0.8.24. Hardhat supports multi-compiler builds.
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: { enabled: true, runs: 200 },
          // Keeps the expanded NFT compile stable (avoids stack-too-deep).
          viaIR: true,
          // Use paris EVM (no PUSH0) for max chain compatibility.
          evmVersion: "paris",
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: { enabled: true, runs: 200 },
        },
      },
    ],
  },
  networks: {
    robinhoodTestnet: {
      url: process.env.ROBINHOOD_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
      accounts: privateKey ? [privateKey] : [],
      chainId: process.env.ROBINHOOD_CHAIN_ID
        ? Number(process.env.ROBINHOOD_CHAIN_ID)
        : 46630,
    },
  },
  etherscan: {
    apiKey: {
      robinhoodTestnet: "empty",
    },
    customChains: [
      {
        network: "robinhoodTestnet",
        chainId: 46630,
        urls: {
          apiURL: "https://explorer.testnet.chain.robinhood.com/api",
          browserURL: "https://explorer.testnet.chain.robinhood.com",
        },
      },
    ],
  },
};
