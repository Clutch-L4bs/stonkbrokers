export const StonkTokenRegistryAbi = [
  {
    type: "function",
    name: "tokenCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "tokenAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ type: "address" }]
  },
  {
    type: "function",
    name: "getToken",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "whitelisted", type: "bool" },
          { name: "symbol", type: "string" },
          { name: "decimals", type: "uint8" },
          { name: "logoURI", type: "string" },
          { name: "metadataURI", type: "string" }
        ]
      }
    ]
  }
] as const;

export const ERC20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }]
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }]
  }
] as const;

export const QuoterV2Abi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" }
    ]
  }
] as const;

export const SwapRouterAbi = [
  {
    type: "function",
    name: "exactInputSingle",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" }
        ]
      }
    ],
    outputs: [{ name: "amountOut", type: "uint256" }]
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }]
  },
  {
    type: "function",
    name: "unwrapWETH9",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "refundETH",
    stateMutability: "payable",
    inputs: [],
    outputs: []
  }
] as const;

export const NonfungiblePositionManagerAbi = [
  {
    type: "function",
    name: "createAndInitializePoolIfNecessary",
    stateMutability: "payable",
    inputs: [
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "sqrtPriceX96", type: "uint160" }
    ],
    outputs: [{ name: "pool", type: "address" }]
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "token0", type: "address" },
          { name: "token1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "amount0Desired", type: "uint256" },
          { name: "amount1Desired", type: "uint256" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" }
        ]
      }
    ],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "liquidity", type: "uint128" },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" }
    ]
  },
  {
    type: "function",
    name: "collect",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "amount0Max", type: "uint128" },
          { name: "amount1Max", type: "uint128" }
        ]
      }
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "decreaseLiquidity",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "liquidity", type: "uint128" },
          { name: "amount0Min", type: "uint256" },
          { name: "amount1Min", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      }
    ],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" }
    ]
  }
] as const;

export const ERC20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ type: "bool" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }]
  }
] as const;

export const StonkLauncherFactoryAbi = [
  {
    type: "function",
    name: "createLaunch",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "imageURI", type: "string" },
          { name: "totalSupplyWei", type: "uint256" },
          { name: "creatorAllocationBps", type: "uint256" },
          { name: "saleBpsOfRemaining", type: "uint256" },
          { name: "priceWeiPerToken", type: "uint256" }
        ]
      }
    ],
    outputs: [
      { name: "token", type: "address" },
      { name: "launch", type: "address" }
    ]
  },
  {
    type: "function",
    name: "finalizeLaunch",
    stateMutability: "payable",
    inputs: [
      { name: "launch", type: "address" },
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "fee", type: "uint24" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "launches",
    stateMutability: "view",
    inputs: [{ name: "launch", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "token", type: "address" },
          { name: "finalized", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "event",
    name: "LaunchCreated",
    inputs: [
      { name: "creator", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "launch", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "imageURI", type: "string", indexed: false }
    ]
  }
] as const;

export const StonkLaunchAbi = [
  {
    type: "function",
    name: "buy",
    stateMutability: "payable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "remainingForSale",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function",
    name: "priceWeiPerToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }]
  },
  { type: "function", name: "memeToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "sold", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "saleSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "pool", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "feeSplitter", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "stakingVault", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "finalized", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { type: "function", name: "lpTokenId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "imageURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "metadataURI", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] }
] as const;

export const StonkYieldStakingVaultAbi = [
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "unstake",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    name: "users",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "staked", type: "uint256" },
          { name: "unlockTime", type: "uint256" },
          { name: "debt0", type: "uint256" },
          { name: "debt1", type: "uint256" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "pendingRewards",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "pending0", type: "uint256" },
      { name: "pending1", type: "uint256" }
    ]
  },
  { type: "function", name: "stakeToken", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "rewardToken0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "rewardToken1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }
] as const;

export const StonkCoveredCallVaultAbi = [
  { type: "function", name: "optionNft", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "createOffer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "underlying", type: "address" },
      { name: "quote", type: "address" },
      { name: "pool", type: "address" },
      { name: "twapSeconds", type: "uint32" },
      { name: "strikeTick", type: "int24" },
      { name: "underlyingAmount", type: "uint256" },
      { name: "strikeQuoteAmount", type: "uint256" },
      { name: "premiumQuoteAmount", type: "uint256" },
      { name: "expiry", type: "uint256" }
    ],
    outputs: [{ name: "offerId", type: "uint256" }]
  },
  {
    type: "function",
    name: "buyOption",
    stateMutability: "nonpayable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [{ name: "optionTokenId", type: "uint256" }]
  },
  {
    type: "function",
    name: "exercise",
    stateMutability: "nonpayable",
    inputs: [{ name: "optionTokenId", type: "uint256" }],
    outputs: []
  },
  { type: "function", name: "cancelOffer", stateMutability: "nonpayable", inputs: [{ name: "offerId", type: "uint256" }], outputs: [] },
  { type: "function", name: "reclaimExpired", stateMutability: "nonpayable", inputs: [{ name: "optionTokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "underlyingReclaimed", stateMutability: "view", inputs: [{ name: "optionTokenId", type: "uint256" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "offers",
    stateMutability: "view",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "writer", type: "address" },
          { name: "underlying", type: "address" },
          { name: "quote", type: "address" },
          { name: "pool", type: "address" },
          { name: "twapSeconds", type: "uint32" },
          { name: "strikeTick", type: "int24" },
          { name: "underlyingAmount", type: "uint256" },
          { name: "strikeQuoteAmount", type: "uint256" },
          { name: "premiumQuoteAmount", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "active", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "event",
    name: "OfferCreated",
    inputs: [
      { name: "offerId", type: "uint256", indexed: true },
      { name: "writer", type: "address", indexed: true },
      { name: "underlying", type: "address", indexed: true },
      { name: "underlyingAmount", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "OptionPurchased",
    inputs: [
      { name: "optionTokenId", type: "uint256", indexed: true },
      { name: "offerId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true }
    ]
  },
  { type: "function", name: "nextOfferId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const;

export const StonkOptionPositionNFTAbi = [
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "vault", type: "address" },
          { name: "writer", type: "address" },
          { name: "underlying", type: "address" },
          { name: "quote", type: "address" },
          { name: "pool", type: "address" },
          { name: "twapSeconds", type: "uint32" },
          { name: "strikeTick", type: "int24" },
          { name: "underlyingAmount", type: "uint256" },
          { name: "strikeQuoteAmount", type: "uint256" },
          { name: "premiumQuoteAmount", type: "uint256" },
          { name: "expiry", type: "uint256" },
          { name: "exercised", type: "bool" }
        ]
      }
    ]
  }
] as const;

export const ERC721EnumerableAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenOfOwnerByIndex", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "index", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "tokenURI", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "tokenId", type: "uint256" }], outputs: [] },
  { type: "function", name: "getApproved", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] },
  { type: "function", name: "isApprovedForAll", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "setApprovalForAll", stateMutability: "nonpayable", inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }], outputs: [] }
] as const;

export const StonkLpFeeSplitterAbi = [
  { type: "function", name: "collectAndSplit", stateMutability: "nonpayable", inputs: [], outputs: [{ name: "amount0", type: "uint256" }, { name: "amount1", type: "uint256" }] }
] as const;

export const StonkExpandedNftMintAbi = [
  { type: "function", name: "mint", stateMutability: "payable", inputs: [{ name: "quantity", type: "uint256" }], outputs: [] },
  { type: "function", name: "MINT_PRICE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }
] as const;

export const StonkMarketplaceAbi = [
  { type: "function", name: "nextListingId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "nextSwapId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "createEthListing", stateMutability: "nonpayable", inputs: [{ name: "nft", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "price", type: "uint256" }], outputs: [{ name: "listingId", type: "uint256" }] },
  { type: "function", name: "cancelListing", stateMutability: "nonpayable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "buyWithEth", stateMutability: "payable", inputs: [{ name: "listingId", type: "uint256" }], outputs: [] },
  { type: "function", name: "createSwapOffer", stateMutability: "nonpayable", inputs: [{ name: "offeredNft", type: "address" }, { name: "offeredTokenId", type: "uint256" }, { name: "requestedNft", type: "address" }, { name: "requestedTokenId", type: "uint256" }], outputs: [{ name: "swapId", type: "uint256" }] },
  { type: "function", name: "cancelSwapOffer", stateMutability: "nonpayable", inputs: [{ name: "swapId", type: "uint256" }], outputs: [] },
  { type: "function", name: "acceptSwapOffer", stateMutability: "nonpayable", inputs: [{ name: "swapId", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "listings",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "seller", type: "address" },
          { name: "nft", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "kind", type: "uint8" },
          { name: "paymentToken", type: "address" },
          { name: "price", type: "uint256" },
          { name: "active", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "swaps",
    stateMutability: "view",
    inputs: [{ name: "swapId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "maker", type: "address" },
          { name: "offeredNft", type: "address" },
          { name: "offeredTokenId", type: "uint256" },
          { name: "requestedNft", type: "address" },
          { name: "requestedTokenId", type: "uint256" },
          { name: "active", type: "bool" }
        ]
      }
    ]
  },
  {
    type: "event",
    name: "ListingCreated",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "nft", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "kind", type: "uint8", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "price", type: "uint256", indexed: false }
    ]
  },
  {
    type: "event",
    name: "SwapCreated",
    inputs: [
      { name: "swapId", type: "uint256", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "offeredNft", type: "address", indexed: true },
      { name: "offeredTokenId", type: "uint256", indexed: false },
      { name: "requestedNft", type: "address", indexed: false },
      { name: "requestedTokenId", type: "uint256", indexed: false }
    ]
  }
] as const;

export const UniswapV3FactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "fee", type: "uint24" }
    ],
    outputs: [{ type: "address" }]
  }
] as const;

export const UniswapV3PoolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "feeProtocol", type: "uint8" },
      { name: "unlocked", type: "bool" }
    ]
  }
] as const;

export const BrokerNftAbi = [
  {
    type: "function",
    name: "predictWallet",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }]
  }
] as const;

export const StonkBroker6551AccountAbi = [
  {
    type: "function",
    name: "executeCall",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "data", type: "bytes" }
    ],
    outputs: [{ type: "bytes" }]
  }
] as const;
