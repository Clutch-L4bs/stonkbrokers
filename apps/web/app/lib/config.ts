export const config = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || "46630"),
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.chain.robinhood.com",
  blockExplorerUrl:
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || "https://explorer.testnet.chain.robinhood.com",

  tokenRegistry: (process.env.NEXT_PUBLIC_STONK_TOKEN_REGISTRY_ADDRESS || "") as `0x${string}`,
  launcherFactory: (process.env.NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_ADDRESS || "") as `0x${string}`,

  weth: (process.env.NEXT_PUBLIC_WETH9_ADDRESS || "") as `0x${string}`,
  uniFactory: (process.env.NEXT_PUBLIC_UNISWAP_V3_FACTORY_ADDRESS || "") as `0x${string}`,
  swapRouter: (process.env.NEXT_PUBLIC_UNISWAP_V3_SWAP_ROUTER_ADDRESS || "") as `0x${string}`,
  quoterV2: (process.env.NEXT_PUBLIC_UNISWAP_V3_QUOTER_V2_ADDRESS || "") as `0x${string}`,
  positionManager: (process.env.NEXT_PUBLIC_UNISWAP_V3_POSITION_MANAGER_ADDRESS || "") as `0x${string}`,

  coveredCallVault: (process.env.NEXT_PUBLIC_STONK_COVERED_CALL_VAULT_ADDRESS || "") as `0x${string}`,

  originalNft: (process.env.NEXT_PUBLIC_ORIGINAL_NFT_ADDRESS || "") as `0x${string}`,
  legacyExpandedNft: (process.env.NEXT_PUBLIC_LEGACY_EXPANDED_NFT_ADDRESS || "") as `0x${string}`,
  expandedNft: (process.env.NEXT_PUBLIC_EXPANDED_NFT_ADDRESS || "") as `0x${string}`,
  marketplace: (process.env.NEXT_PUBLIC_MARKETPLACE_ADDRESS || "") as `0x${string}`
};

