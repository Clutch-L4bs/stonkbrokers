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
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
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
