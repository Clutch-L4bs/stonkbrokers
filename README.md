# StonkBrokers

StonkBrokers is an end-to-end onchain product suite for Robinhood Chain testnet:
- An NFT collection that bootstraps community and token-bound wallets (ERC-6551 style)
- A token launcher (fixed-price sale -> finalize into Uniswap v3 liquidity)
- An exchange (swap + ETH<->WETH wrap/unwrap)
- A pools interface (create pools + mint LP positions, including native ETH deposits)
- An options module (covered calls: writers escrow collateral; buyers receive option NFTs)
- A marketplace module for NFT trading UX

The app is designed to be demo-friendly for hackathons: a judge can go from "fresh wallet" to "launched token with trading" and "option market activity" in minutes.

## Contents

- What You Can Demo
- Architecture Overview
- Modules
- Contracts Map
- Configuration
- Local Development
- Deploying to Testnet
- Troubleshooting
- Security Notes

## What You Can Demo

Suggested judge flow (10-15 minutes):
1. Open the web app and connect a wallet on Robinhood testnet.
2. Go to `Launcher`:
   - Create a token launch (name/symbol/supply + fixed sale price).
   - Buy from the sale (ETH in, token out).
   - Finalize the launch to create a Uniswap v3 pool and LP position.
3. Go to `Exchange`:
   - Swap ETH -> launched token (or wrap ETH -> WETH).
4. Go to `Pools`:
   - Add liquidity to the launched token pool.
   - Use native ETH on one side (it wraps to WETH under the hood).
5. Go to `Options`:
   - Write a covered call (escrow underlying tokens, set strike/premium/expiry).
   - Buy an option and exercise it (TWAP-checked ITM condition).
6. Go to `NFT` / `Marketplace`:
   - Explore the fully minted NFT collection and its token-bound account pattern.

Screenshots are in `exchange-screenshots/`.

## Architecture Overview

StonkBrokers is a hybrid of smart contracts + a client-only UI:
- Contracts are deployed with Hardhat (`contracts/`, `scripts/`).
- The web app is Next.js (`apps/web/`).
- For launcher discovery, the UI indexes factory `LaunchCreated` events directly onchain.
  - It caches launch records locally so launches do not disappear over time.
  - It supports an optional "factory start block" to speed up indexing.

Uniswap v3 notes:
- Pools/positions use ERC20 tokens (native ETH is not a pool asset).
- Native ETH UX is supported by:
  - Wrapping/unwrapping in the swap UI (direct WETH9 calls)
  - Providing native ETH as `msg.value` to the position manager when minting LP

## Modules

### NFT Collection (Community Bootstrap)

The NFT collection is intended to create an initial community/user base:
- Fixed supply collection (original "444" style collection and continuation/expanded variants)
- Each NFT has an associated token-bound wallet (ERC-6551 pattern)
- Minting can seed a wallet with configured tokens to create immediate engagement

Key contracts:
- `contracts/BrokerWalletPunks.sol`
- `contracts/BrokerWalletPunksExpanded.sol`
- `contracts/ERC6551Registry.sol`
- `contracts/StonkBroker6551Account.sol`

### Launcher (Fixed-Price Sale -> Uniswap v3 Liquidity)

The launcher lifecycle:
1. A creator launches a new ERC20 + sale contract.
2. Buyers send ETH to `buy()` during the sale and receive tokens at a fixed price.
3. Finalization wraps raised ETH into WETH, creates/initializes a Uniswap v3 pool, and mints a full-range LP position.
4. A fee splitter and staking vault are wired so fee flows can be routed to stakers.

Key contracts:
- `contracts/launcher/StonkLauncherFactory.sol`
- `contracts/launcher/StonkLaunch.sol`
- `contracts/fees/StonkLpFeeSplitter.sol`
- `contracts/staking/StonkYieldStakingVault.sol`

UI:
- Route `apps/web/app/launcher/`
- The launch list indexes `LaunchCreated` logs from the factory and refreshes incrementally.

### Exchange (Swap + ETH<->WETH)

Swap uses Uniswap v3:
- Quoting via QuoterV2
- Swapping via SwapRouter
- Fee tier auto-detection in the UI (common cause of "No liquidity" is selecting the wrong tier)

ETH<->WETH:
- When the pair is ETH<->WETH, the UI enters a wrap/unwrap mode (no pool required).

UI:
- Route `apps/web/app/exchange/` (Swap tab)

### Pools (Create Pools + Mint LP Positions)

Pools UI supports:
- Creating a pool (createAndInitializePoolIfNecessary)
- Adding liquidity (mint) with optional range selection
- Native ETH deposits on one side (wrapped to WETH internally)

UI:
- Route `apps/web/app/exchange/` (Pools tab)

### Options (Covered Calls + Option NFTs)

Covered calls are implemented as a simple market:
- Writers escrow underlying tokens and publish an offer (strike, premium, expiry, TWAP window, pool).
- Buyers pay premium and receive an ERC-721 option position NFT.
- Exercising is only allowed when the option is in-the-money according to TWAP.
- If the option expires unexercised, the writer can reclaim the escrowed collateral.

This module is designed as an incentive layer:
- Calls can encourage bullish behavior since holders gain upside by pushing price beyond strike.
- Other users can lock tokens to pursue longer-term fee/yield alignment (staking/lockups).

Key contracts:
- `contracts/options/StonkCoveredCallVault.sol`
- `contracts/options/StonkOptionPositionNFT.sol`
- `contracts/options/StonkTwapOracle.sol`

UI:
- Route `apps/web/app/options/`

### Marketplace

Marketplace module for NFT trading UX:
- `contracts/StonkBrokersMarketplace.sol`
- Route `apps/web/app/marketplace/`

### Token Registry

The registry provides a simple onchain list of UI tokens:
- A launcher factory can auto-register launched tokens as whitelisted (so they appear in UI token lists).
- The swap UI also supports custom token addresses via query params.

Key contract:
- `contracts/StonkTokenRegistry.sol`

## Contracts Map

High-level ownership/integration:
- NFT mint -> token-bound account (via ERC-6551 registry) -> seeded tokens (optional)
- Token launch -> sale -> finalize -> Uniswap v3 pool + LP -> fee splitter -> staking vault
- Options vault uses:
  - Uniswap v3 pool address only for TWAP validation
  - WETH as quote/settlement token in the UI (configurable via env)

## Configuration

### Contracts / Hardhat env (root `.env`)

Root `.env` is used by Hardhat scripts under `scripts/`:
- `PRIVATE_KEY` (do not commit)
- `ROBINHOOD_RPC_URL`
- `ROBINHOOD_CHAIN_ID`
- plus any script-specific variables (see `.env.example`)

### Web app env (`apps/web/.env.local`)

Copy the template:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Required variables for core functionality:
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_BLOCK_EXPLORER_URL`
- `NEXT_PUBLIC_WETH9_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_FACTORY_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_SWAP_ROUTER_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_QUOTER_V2_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_POSITION_MANAGER_ADDRESS`
- `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_ADDRESS`
- `NEXT_PUBLIC_STONK_TOKEN_REGISTRY_ADDRESS`

Optional performance variable:
- `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_START_BLOCK` (set to the factory deployment block so launcher indexing is fast)

## Local Development

Install dependencies:

```bash
npm install
npm --prefix apps/web install
```

Run the web app:

```bash
npm --prefix apps/web run dev
```

Build/lint:

```bash
npm --prefix apps/web run lint
npm --prefix apps/web run build
```

Compile/test contracts:

```bash
npm run compile
npm test
```

## Deploying to Robinhood Chain Testnet

This repo includes deploy scripts:
- `npm run deploy:uniswap`
- `npm run deploy:registry`
- `npm run deploy:launcher`
- `npm run deploy:options`
- `npm run deploy:expanded` (expanded NFT + marketplace flows)

After deployment:
1. Copy addresses into `apps/web/.env.local` as `NEXT_PUBLIC_*` variables.
2. Set `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_START_BLOCK` to the factory deployment block number.
3. Restart the Next.js dev server.

### Deploy Checklist (Script -> Output Env Vars)

This section maps each `npm run deploy:*` script to:
- what it deploys
- the env vars it prints (contracts side, root `.env`)
- which `apps/web/.env.local` variables those correspond to (frontend `NEXT_PUBLIC_*`)

Notes:
- Hardhat deploy scripts print values in `KEY=VALUE` format; you copy/paste into your root `.env`.
- The frontend uses `NEXT_PUBLIC_*` variables (see `apps/web/.env.example`).
- Some contracts require a follow-up config transaction after deployment (called out below).

#### `npm run deploy:uniswap` (`scripts/deploy-uniswap.js`)

Deploys:
- `WETH9` (testnet wrapper)
- Uniswap v3 Factory
- Uniswap v3 periphery: PositionManager, SwapRouter, QuoterV2
- Support: TickLens, token descriptor libraries

Prints (copy into root `.env`):
- `WETH9_ADDRESS`
- `UNISWAP_V3_FACTORY_ADDRESS`
- `UNISWAP_V3_SWAP_ROUTER_ADDRESS`
- `UNISWAP_V3_QUOTER_V2_ADDRESS`
- `UNISWAP_V3_POSITION_MANAGER_ADDRESS`
- `UNISWAP_V3_TICK_LENS_ADDRESS` (optional)
- `UNISWAP_V3_TOKEN_DESCRIPTOR_ADDRESS` (optional)
- `UNISWAP_V3_NFT_DESCRIPTOR_LIB` (optional)

Frontend mapping (`apps/web/.env.local`):
- `NEXT_PUBLIC_WETH9_ADDRESS = WETH9_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_FACTORY_ADDRESS = UNISWAP_V3_FACTORY_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_SWAP_ROUTER_ADDRESS = UNISWAP_V3_SWAP_ROUTER_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_QUOTER_V2_ADDRESS = UNISWAP_V3_QUOTER_V2_ADDRESS`
- `NEXT_PUBLIC_UNISWAP_V3_POSITION_MANAGER_ADDRESS = UNISWAP_V3_POSITION_MANAGER_ADDRESS`

#### `npm run deploy:registry` (`scripts/deploy-registry.js`)

Deploys:
- `StonkTokenRegistry`

Prints (copy into root `.env`):
- `STONK_TOKEN_REGISTRY_ADDRESS`

Frontend mapping:
- `NEXT_PUBLIC_STONK_TOKEN_REGISTRY_ADDRESS = STONK_TOKEN_REGISTRY_ADDRESS`

#### `npm run deploy:launcher` (`scripts/deploy-launcher.js`)

Deploys:
- `StonkLauncherFactory` (creates launches)

Requires in root `.env`:
- `WETH9_ADDRESS` (from `deploy:uniswap`)
- `UNISWAP_V3_POSITION_MANAGER_ADDRESS` (from `deploy:uniswap`)
- `STONK_TOKEN_REGISTRY_ADDRESS` (from `deploy:registry`)
- Optional: `TREASURY_ADDRESS` (defaults to deployer)

Prints (copy into root `.env`):
- `STONK_LAUNCHER_FACTORY_ADDRESS`
- `TREASURY_ADDRESS`

Frontend mapping:
- `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_ADDRESS = STONK_LAUNCHER_FACTORY_ADDRESS`

Post-deploy required action:
- Set the token registry’s `launcherFactory` so launched tokens can be auto-registered/whitelisted:
  - Call `StonkTokenRegistry.setLauncherFactory(STONK_LAUNCHER_FACTORY_ADDRESS)` as the registry owner.

Indexer performance (recommended):
- Set `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_START_BLOCK` to the block where the factory was deployed.

#### `npm run deploy:options` (`scripts/deploy-options.js`)

Deploys:
- `StonkTwapOracle`
- `StonkOptionPositionNFT` (ERC-721 option positions)
- `StonkCoveredCallVault` (covered call market)

Prints (copy into root `.env`):
- `STONK_TWAP_ORACLE_ADDRESS`
- `STONK_OPTION_NFT_ADDRESS`
- `STONK_COVERED_CALL_VAULT_ADDRESS`

Frontend mapping:
- `NEXT_PUBLIC_STONK_COVERED_CALL_VAULT_ADDRESS = STONK_COVERED_CALL_VAULT_ADDRESS`

Notes:
- The deploy script transfers option NFT ownership to the vault so only the vault can mint/mark exercised.
- Options use a Uniswap v3 pool address for TWAP validation.

#### `npm run deploy:faucet` (`scripts/deploy-faucet.js`)

Deploys:
- `StonkEthFaucet`

Uses (optional) root `.env` inputs:
- `FAUCET_CLAIM_AMOUNT_WEI` or `FAUCET_CLAIM_AMOUNT_ETH`
- `FAUCET_INITIAL_FUND_WEI` or `FAUCET_INITIAL_FUND_ETH`

Prints (copy into root `.env`):
- `FAUCET_CONTRACT_ADDRESS`
- `FAUCET_CLAIM_AMOUNT_WEI`

#### `npm run deploy:robinhood` (`scripts/deploy.js`)

Deploys:
- `ERC6551Registry`
- `StonkBroker6551Account` (token-bound account implementation)
- `BrokerWalletPunks` (original NFT collection)
- Optionally deploys a mock stock token if `STOCK_TOKEN_ADDRESSES` is not provided

Prints (copy into root `.env`):
- `NFT_CONTRACT_ADDRESS`
- `STOCK_TOKEN_ADDRESSES`
- `ERC6551_REGISTRY_ADDRESS`
- `ERC6551_ACCOUNT_IMPLEMENTATION`

Frontend mapping (optional pages):
- `NEXT_PUBLIC_ORIGINAL_NFT_ADDRESS = NFT_CONTRACT_ADDRESS` (or set explicitly)

#### `npm run deploy:expanded` (`scripts/deploy-expanded-marketplace.js`)

Deploys:
- `BrokerWalletPunksExpanded` (continuation / expanded NFT collection)
- `StonkBrokersMarketplace`

Requires in root `.env`:
- `STOCK_TOKEN_ADDRESSES`
- `ERC6551_REGISTRY_ADDRESS`
- `ERC6551_ACCOUNT_IMPLEMENTATION`
- `ORIGINAL_NFT_CONTRACT_ADDRESS` (or `NFT_CONTRACT_ADDRESS`)
- Optional: `LEGACY_EXPANDED_NFT_CONTRACT_ADDRESS`
- Optional: `CONTINUATION_START_TOKEN_ID`, `EXPANDED_END_TOKEN_ID`

Prints (copy into root `.env`):
- `ORIGINAL_NFT_CONTRACT_ADDRESS`
- `LEGACY_EXPANDED_NFT_CONTRACT_ADDRESS`
- `EXPANDED_NFT_CONTRACT_ADDRESS`
- `MARKETPLACE_CONTRACT_ADDRESS`
- `CONTINUATION_START_TOKEN_ID`
- `EXPANDED_END_TOKEN_ID`

Frontend mapping:
- `NEXT_PUBLIC_ORIGINAL_NFT_ADDRESS = ORIGINAL_NFT_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_LEGACY_EXPANDED_NFT_ADDRESS = LEGACY_EXPANDED_NFT_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_EXPANDED_NFT_ADDRESS = EXPANDED_NFT_CONTRACT_ADDRESS`
- `NEXT_PUBLIC_MARKETPLACE_ADDRESS = MARKETPLACE_CONTRACT_ADDRESS`

### Contract Addresses (Robinhood Chain Testnet)

These are the current testnet addresses from `apps/web/.env.local` in this repo. If you redeploy, update this section.

Network:
- Chain ID: `46630`
- RPC: `https://rpc.testnet.chain.robinhood.com`
- Explorer: `https://explorer.testnet.chain.robinhood.com`

Core infra:
- WETH9: `0x37E402B8081eFcE1D82A09a066512278006e4691`
- Uniswap v3 Factory: `0xFECCB63CD759d768538458Ea56F47eA8004323c1`
- Uniswap v3 SwapRouter: `0x1b32F47434a7EF83E97d0675C823E547F9266725`
- Uniswap v3 QuoterV2: `0x126f1c1F29A0f49c5D33e0139a5Da1FE25590dB1`
- Uniswap v3 PositionManager: `0xBc82a9aA33ff24FCd56D36a0fB0a2105B193A327`

Stonk contracts:
- Token Registry: `0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b`
- Launcher Factory: `0x631f9371Fd6B2C85F8f61d19A90547eE67Fa61A2`
- Covered Call Vault: `0x055d84908672b9be53275963862614aEA9CDB98B`

NFT + marketplace:
- Original NFT: `0x2Bb22c9E3394272351FEffEDbEa079Be4FB10a8d`
- Legacy Expanded NFT: `0x8a032E21E7D97685c262eB04a49Dd17acDB11B0F`
- Expanded NFT: `0x5fDAeBE166490c69B4C34F99E049b4e16c9EF80a`
- Marketplace: `0x5a091dB1c58686f4625c14eD204BE85d83BD4aA6`

## Troubleshooting

- "No liquidity" on swap:
  - Usually a fee tier mismatch; the UI tries other tiers automatically, but ensure pool exists and has liquidity.
- Launcher list missing launches:
  - Ensure `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_ADDRESS` is correct.
  - Set `NEXT_PUBLIC_STONK_LAUNCHER_FACTORY_START_BLOCK` for fast, complete indexing.
  - Use `Index All` in the launcher toolbar.
- LP minting with ETH:
  - LP positions are WETH-based; selecting "ETH" will wrap to WETH via the position manager.
  - Ensure `NEXT_PUBLIC_WETH9_ADDRESS` and `NEXT_PUBLIC_UNISWAP_V3_POSITION_MANAGER_ADDRESS` are correct.

## Security Notes

- This is a hackathon MVP; treat contracts as experimental.
- Never commit secrets. `.env*` files are ignored by default.
- Rotate any private keys used during development if they were ever shared/logged.
