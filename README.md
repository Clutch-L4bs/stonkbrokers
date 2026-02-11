# Stonk Brokers (Robinhood Testnet)

This project implements a 444-supply onchain-style pixel NFT collection where each mint creates an ERC-6551-style token-bound account and funds it with one random stock token from your configured set.

## What this includes

- `BrokerWalletPunks` (ERC721): max supply `444`, mint price `0.01 ETH`, onchain SVG metadata.
- Configurable stock token basket: each minted NFT gets one random token + a fractional random amount.
- `ERC6551Registry`: deterministic account creation per NFT.
- `StonkBroker6551Account`: token-bound account implementation controlled by NFT ownership.
- Random stock funding: each wallet gets a deterministic pseudo-random fractional grant at mint, sized to preserve inventory across the full supply.
- Wallet operations: only the current NFT owner can move tokens out of that wallet.
- Mint UI: connect wallet, mint, view each owned NFT's wallet address, funded token, and balance.

## Prerequisites

- Node.js 20+
- A funded wallet on Robinhood testnet
- Robinhood testnet RPC URL and chain ID (from docs)

Reference docs: [Robinhood Chain Documentation](https://docs.robinhood.com/chain/)

Robinhood Chain testnet parameters:

- Network Name: `Robinhood Chain Testnet`
- RPC URL: `https://rpc.testnet.chain.robinhood.com`
- Chain ID: `46630`
- Currency Symbol: `ETH`
- Block Explorer: `https://explorer.testnet.chain.robinhood.com`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Fill `.env` with:

- `PRIVATE_KEY`
- `ROBINHOOD_RPC_URL`
- `ROBINHOOD_CHAIN_ID`
- `STOCK_TOKEN_ADDRESSES` (comma-separated token addresses)

## Compile and test locally

```bash
npm run compile
npm test
```

## Deploy to Robinhood testnet

```bash
npm run deploy:robinhood
```

Save the deployed NFT address in `.env` as `NFT_CONTRACT_ADDRESS`.

The deploy script also outputs:

- `STOCK_TOKEN_ADDRESSES`
- `ERC6551_REGISTRY_ADDRESS`
- `ERC6551_ACCOUNT_IMPLEMENTATION`

## Mint

```bash
npm run mint:robinhood
```

This sends `MINT_QUANTITY * 0.01 ETH` and mints NFTs. Each token gets:

- its own wallet contract address
- one random stock token from `STOCK_TOKEN_ADDRESSES`
- a random fractional amount of that token transferred from collection inventory

## Fund collection inventory (required before mint)

The NFT contract must hold token balances so mints can fund wallets.

```bash
TOKEN_TO_FUND=0xYourToken FUND_AMOUNT_WEI=100000000000000000000 npm run fund:robinhood
```

Run this once per stock token you want available in mints.

## Move stock tokens from NFT wallet

Set `TOKEN_ID` in `.env`, then:

```bash
npm run claim:robinhood
```

Optional:

- set `CLAIM_AMOUNT_WEI` to move only part of the wallet balance
- leave `CLAIM_AMOUNT_WEI` empty to move full wallet balance

## Run mint UI

1. Copy UI config and fill values:

```bash
cp ui/config.example.js ui/config.js
```

2. Put deployed contract addresses and chain config in `ui/config.js`.
   - Set `faucetUrl` to the Robinhood faucet page you want users to use.
   - Optionally set `thirdwebWalletUrl` (default points to thirdweb wallets page).
   - Set `thirdwebClientId` for Thirdweb deep links/connect UX.

3. Start UI server:

```bash
npm run ui:serve
```

4. Open:

`http://localhost:8080`

The mint UI now includes:
- a Thirdweb wallet connect option (works with Thirdweb-compatible injected wallets)
- a direct Robinhood testnet faucet link for onboarding users

## Generate visual previews

Generate one NFT preview SVG (defaults to `TOKEN_ID=1`):

```bash
npm run preview:nft
```

Generate a specific token preview:

```bash
TOKEN_ID=42 npm run preview:nft
```

Generate all 444 previews:

```bash
npm run preview:all
```

Preview files are written to `previews/`.

## Important notes

- This is a functional MVP contract set, not a fully optimized production launch setup.
- Onchain metadata/SVG are generated in-contract, but this is not a full CryptoPunks byte-level clone.
- This implementation uses a registry + token-bound account pattern so wallet control follows NFT ownership.

# stonkbrokers
