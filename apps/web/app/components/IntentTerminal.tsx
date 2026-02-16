"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ══════════════════════════════════════════════════════════════
   Intent Terminal — comprehensive UI assist command bar
   ══════════════════════════════════════════════════════════════
   Covers EVERY action across Exchange, Launcher, Options,
   NFT, and Marketplace. Users type plain english and forms
   auto-fill or actions execute.
   ══════════════════════════════════════════════════════════════ */

/* ── Intent Types (covers every action) ── */

export type IntentAction =
  /* Exchange — Swap */
  | { type: "swap"; tokenIn?: string; tokenOut?: string; amount?: string; fee?: string; slippage?: string }
  | { type: "flip_tokens" }
  | { type: "max_balance" }
  | { type: "set_fee"; fee: string }
  | { type: "set_slippage"; bps: string }
  /* Exchange — Pools */
  | { type: "add_liquidity"; token0?: string; token1?: string; fee?: string; amount0?: string; amount1?: string; range?: "full" | "custom"; minPrice?: string; maxPrice?: string }
  | { type: "create_pool"; token0?: string; token1?: string; fee?: string; price?: string }
  /* Exchange — Positions */
  | { type: "collect_fees"; positionId?: string }
  | { type: "remove_liquidity"; positionId?: string }
  | { type: "refresh_positions" }
  /* Options */
  | { type: "write_call"; underlying?: string; amount?: string; strike?: string; premium?: string; expiry?: string; twap?: string }
  | { type: "buy_option"; offerId?: string }
  | { type: "exercise"; tokenId?: string }
  | { type: "reclaim"; tokenId?: string }
  | { type: "cancel_option"; offerId?: string }
  | { type: "load_chart"; blocks?: string }
  | { type: "preview_offer"; offerId?: string }
  | { type: "preview_position"; tokenId?: string }
  /* Launcher */
  | { type: "launch_token"; name?: string; symbol?: string; supply?: string; creatorPct?: string; salePct?: string; price?: string }
  | { type: "finalize_launch"; address?: string; price?: string; fee?: string }
  | { type: "buy_token"; amount?: string }
  | { type: "stake"; amount?: string }
  | { type: "unstake" }
  | { type: "claim_rewards" }
  | { type: "collect_lp_fees" }
  | { type: "filter_launches"; filter?: "all" | "open" | "finalized" }
  /* NFT */
  | { type: "mint_nft"; qty?: string }
  | { type: "claim_eth"; brokerId?: string }
  | { type: "claim_tokens"; brokerId?: string; token?: string; amount?: string }
  | { type: "refresh_nfts" }
  /* Marketplace */
  | { type: "list_nft"; tokenId?: string; price?: string }
  | { type: "buy_listing"; listingId?: string }
  | { type: "create_swap_offer"; offeredId?: string; requestedId?: string }
  | { type: "cancel_listing"; listingId?: string }
  | { type: "cancel_swap"; swapId?: string }
  | { type: "accept_swap"; swapId?: string }
  /* Navigation */
  | { type: "switch_tab"; tab: string }
  | { type: "help" }
  | { type: "unknown"; raw: string };

/* ── Suggestion categories with icons ── */

type SuggestionCategory = "exchange" | "pools" | "positions" | "options" | "launcher" | "nft" | "marketplace" | "navigation";

type Suggestion = {
  cat: SuggestionCategory;
  icon: string;
  label: string;
  hint: string;
  description: string;
};

const ALL_SUGGESTIONS: Suggestion[] = [
  /* ── Exchange — Swap ── */
  { cat: "exchange", icon: "⇄", label: "Swap tokens", hint: "swap 10 ETH for TSLA", description: "Exchange one token for another" },
  { cat: "exchange", icon: "⇄", label: "Buy tokens", hint: "buy 100 TSLA with ETH", description: "Buy a specific token with another" },
  { cat: "exchange", icon: "↕", label: "Flip tokens", hint: "flip tokens", description: "Reverse input/output tokens" },
  { cat: "exchange", icon: "⬆", label: "Use max balance", hint: "max", description: "Fill input with your full balance" },
  { cat: "exchange", icon: "%", label: "Set fee tier", hint: "fee 0.3%", description: "Change trading fee (0.05%, 0.3%, 1%)" },
  { cat: "exchange", icon: "%", label: "Set slippage", hint: "slippage 1%", description: "Change slippage tolerance (0.5%, 1%, 3%)" },

  /* ── Exchange — Pools ── */
  { cat: "pools", icon: "💧", label: "Add liquidity", hint: "add liquidity TSLA WETH 0.3%", description: "Provide liquidity to earn fees" },
  { cat: "pools", icon: "💧", label: "Add full-range LP", hint: "add full range TSLA WETH", description: "Add liquidity across the full price range" },
  { cat: "pools", icon: "💧", label: "Add custom range", hint: "add range TSLA WETH 0.5 to 2.0", description: "Add liquidity in a specific price range" },
  { cat: "pools", icon: "🏗", label: "Create pool", hint: "create pool TSLA WETH 0.3%", description: "Create a new Uniswap V3 pool" },
  { cat: "pools", icon: "🏗", label: "Create pool with price", hint: "create pool TSLA WETH at 0.001", description: "Create pool and set initial price" },

  /* ── Exchange — Positions ── */
  { cat: "positions", icon: "💰", label: "Collect fees", hint: "collect fees", description: "Claim uncollected LP fees" },
  { cat: "positions", icon: "💰", label: "Collect fees for position", hint: "collect fees #1", description: "Claim fees from a specific position" },
  { cat: "positions", icon: "🔥", label: "Remove liquidity", hint: "remove liquidity #1", description: "Remove all liquidity from a position" },
  { cat: "positions", icon: "🔄", label: "Refresh positions", hint: "refresh positions", description: "Reload your LP positions" },

  /* ── Options ── */
  { cat: "options", icon: "✍", label: "Write covered call", hint: "write call TSLA 100 strike 0.5 premium 0.01 7d", description: "Escrow tokens and write a call option" },
  { cat: "options", icon: "🛒", label: "Buy option", hint: "buy option #5", description: "Purchase an option by offer ID" },
  { cat: "options", icon: "👁", label: "Preview offer", hint: "preview offer #5", description: "View details of an offer before buying" },
  { cat: "options", icon: "⚡", label: "Exercise option", hint: "exercise #3", description: "Exercise an in-the-money option" },
  { cat: "options", icon: "↩", label: "Reclaim expired", hint: "reclaim #3", description: "Reclaim collateral from expired option" },
  { cat: "options", icon: "❌", label: "Cancel offer", hint: "cancel offer #5", description: "Cancel your active option offer" },
  { cat: "options", icon: "👁", label: "Preview position", hint: "preview position #3", description: "View your option NFT details" },
  { cat: "options", icon: "📊", label: "Load price chart", hint: "load chart 20000 blocks", description: "Load TWAP price chart for the pool" },

  /* ── Launcher ── */
  { cat: "launcher", icon: "🚀", label: "Launch meme coin", hint: "launch Pepe PEPE 1M", description: "Create a new ERC-20 token" },
  { cat: "launcher", icon: "🚀", label: "Launch with details", hint: "launch Pepe PEPE 1M creator 5% sale 60% price 0.000001", description: "Launch with allocation and price" },
  { cat: "launcher", icon: "✅", label: "Finalize launch", hint: "finalize 0x1234... price 0.000001", description: "Seed DEX liquidity for your token" },
  { cat: "launcher", icon: "🛒", label: "Buy launched token", hint: "buy 0.01 ETH of tokens", description: "Purchase tokens from an active sale" },
  { cat: "launcher", icon: "📌", label: "Stake tokens", hint: "stake 1000", description: "Stake tokens to earn yield" },
  { cat: "launcher", icon: "📤", label: "Unstake tokens", hint: "unstake", description: "Withdraw your staked tokens" },
  { cat: "launcher", icon: "🎁", label: "Claim staking rewards", hint: "claim rewards", description: "Collect earned staking rewards" },
  { cat: "launcher", icon: "💰", label: "Collect LP fees", hint: "collect lp fees", description: "Collect your share of LP fees" },
  { cat: "launcher", icon: "🔍", label: "Filter launches", hint: "show open launches", description: "Filter by all / open / finalized" },

  /* ── NFT ── */
  { cat: "nft", icon: "🎨", label: "Mint Stonk Broker", hint: "mint 3", description: "Mint NFTs from the expanded collection" },
  { cat: "nft", icon: "💎", label: "Claim ETH from broker", hint: "claim eth from broker #5", description: "Withdraw ETH from your broker wallet" },
  { cat: "nft", icon: "💎", label: "Claim tokens from broker", hint: "claim tokens from broker #5", description: "Withdraw ERC-20 tokens from broker wallet" },
  { cat: "nft", icon: "🔄", label: "Refresh my brokers", hint: "refresh brokers", description: "Reload your broker collection and wallets" },

  /* ── Marketplace ── */
  { cat: "marketplace", icon: "🏷", label: "List broker for sale", hint: "list broker #10 for 0.5 ETH", description: "Create an ETH listing for your broker" },
  { cat: "marketplace", icon: "🛒", label: "Buy listed broker", hint: "buy listing #3", description: "Purchase a broker from a listing" },
  { cat: "marketplace", icon: "🔄", label: "Create swap offer", hint: "swap broker #10 for #20", description: "Offer to trade one broker for another" },
  { cat: "marketplace", icon: "✅", label: "Accept swap offer", hint: "accept swap #5", description: "Accept an incoming swap offer" },
  { cat: "marketplace", icon: "❌", label: "Cancel listing", hint: "cancel listing #3", description: "Remove your listing from the marketplace" },
  { cat: "marketplace", icon: "❌", label: "Cancel swap offer", hint: "cancel swap #5", description: "Cancel your pending swap offer" },

  /* ── Navigation ── */
  { cat: "navigation", icon: "→", label: "Go to Swap", hint: "go to swap", description: "Navigate to the Swap tab" },
  { cat: "navigation", icon: "→", label: "Go to Pools", hint: "go to pools", description: "Navigate to the Pools tab" },
  { cat: "navigation", icon: "→", label: "Go to Positions", hint: "go to positions", description: "View your LP positions" },
  { cat: "navigation", icon: "→", label: "Go to Trade options", hint: "go to trade", description: "Browse and buy options" },
  { cat: "navigation", icon: "→", label: "Go to Earn", hint: "go to earn", description: "Write options and earn premiums" },
  { cat: "navigation", icon: "→", label: "Go to Write/Chart", hint: "go to write", description: "Create offers and view charts" },
  { cat: "navigation", icon: "→", label: "Go to Launches", hint: "go to launches", description: "Browse meme coin launches" },
  { cat: "navigation", icon: "→", label: "Go to Create", hint: "go to create", description: "Launch your own token" },
  { cat: "navigation", icon: "→", label: "Go to Stake", hint: "go to stake", description: "Manage staking positions" },
  { cat: "navigation", icon: "?", label: "Show all commands", hint: "help", description: "List every available command" },
];

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  exchange: "Swap",
  pools: "Pools & LP",
  positions: "Positions",
  options: "Options",
  launcher: "Meme Launcher",
  nft: "NFT Collection",
  marketplace: "Marketplace",
  navigation: "Navigation",
};

const CONTEXT_CATS: Record<string, SuggestionCategory[]> = {
  exchange: ["exchange", "pools", "positions", "navigation"],
  launcher: ["launcher", "navigation"],
  options: ["options", "navigation"],
  nft: ["nft", "navigation"],
  marketplace: ["marketplace", "navigation"],
};

/* ══════════════════════════════════════════════════════════════
   Number / Fee / Expiry parsers
   ══════════════════════════════════════════════════════════════ */

function parseNum(s: string): string | undefined {
  const cleaned = s.replace(/,/g, "");
  if (/^\d+\.?\d*$/.test(cleaned)) return cleaned;
  const match = cleaned.match(/^(\d+\.?\d*)\s*([kmbt])$/i);
  if (match) {
    const num = parseFloat(match[1]);
    const mult: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
    return String(num * (mult[match[2].toLowerCase()] || 1));
  }
  return undefined;
}

function parseFee(s: string): string | undefined {
  const m = s.match(/(\d+\.?\d*)%?/);
  if (!m) return undefined;
  const pct = parseFloat(m[1]);
  if (pct === 0.05 || pct === 500) return "500";
  if (pct === 0.3 || pct === 0.30 || pct === 3000) return "3000";
  if (pct === 1 || pct === 10000) return "10000";
  return String(Math.round(pct * 10000));
}

function parseExpiry(s: string): string | undefined {
  const m = s.match(/(\d+)\s*d/i);
  if (m) return m[1];
  const mw = s.match(/(\d+)\s*w/i);
  if (mw) return String(parseInt(mw[1]) * 7);
  const mm = s.match(/(\d+)\s*h/i);
  if (mm) return String(Math.ceil(parseInt(mm[1]) / 24));
  return undefined;
}

function parseTwap(s: string): string | undefined {
  const m = s.match(/twap\s+(\d+)\s*([smh])?/i);
  if (!m) return undefined;
  const n = parseInt(m[1]);
  const unit = (m[2] || "s").toLowerCase();
  if (unit === "m") return String(n * 60);
  if (unit === "h") return String(n * 3600);
  return String(n);
}

/* ══════════════════════════════════════════════════════════════
   Intent Parser — comprehensive
   ══════════════════════════════════════════════════════════════ */

export function parseIntent(raw: string): IntentAction {
  const text = raw.trim().toLowerCase();
  if (!text) return { type: "unknown", raw };

  /* ── Help ── */
  if (text === "help" || text === "?" || text === "commands") return { type: "help" };

  /* ── Simple commands ── */
  if (text === "flip" || text === "flip tokens" || text === "reverse") return { type: "flip_tokens" };
  if (text === "max" || text === "max balance" || text === "use max") return { type: "max_balance" };
  if (text === "unstake" || text === "unstake all") return { type: "unstake" };
  if (text === "claim rewards" || text === "claim staking rewards") return { type: "claim_rewards" };
  if (text === "collect lp fees" || text === "collect fees from lp") return { type: "collect_lp_fees" };
  if (text === "refresh positions" || text === "reload positions") return { type: "refresh_positions" };
  if (text === "refresh brokers" || text === "refresh nfts" || text === "refresh my brokers") return { type: "refresh_nfts" };

  /* ── Fee: "fee 0.3%", "set fee 0.05%" ── */
  {
    const m = text.match(/^(?:set\s+)?fee\s+(\S+)/i);
    if (m) {
      const f = parseFee(m[1]);
      if (f) return { type: "set_fee", fee: f };
    }
  }

  /* ── Slippage: "slippage 1%", "set slippage 0.5%" ── */
  {
    const m = text.match(/^(?:set\s+)?slippage\s+(\d+\.?\d*)%?/i);
    if (m) {
      const pct = parseFloat(m[1]);
      return { type: "set_slippage", bps: String(Math.round(pct * 100)) };
    }
  }

  /* ── Swap: "swap 10 ETH for TSLA", "swap ETH to TSLA", "buy 10 TSLA with ETH" ── */
  {
    const m = text.match(/^swap\s+(\S+)\s+(\S+)\s+(?:for|to|into)\s+(\S+)/i);
    if (m) {
      const amt = parseNum(m[1]);
      if (amt) return { type: "swap", amount: amt, tokenIn: m[2].toUpperCase(), tokenOut: m[3].toUpperCase() };
      return { type: "swap", tokenIn: m[1].toUpperCase(), tokenOut: m[3].toUpperCase() };
    }
    const m2 = text.match(/^swap\s+(\S+)\s+(?:for|to|into)\s+(\S+)/i);
    if (m2) return { type: "swap", tokenIn: m2[1].toUpperCase(), tokenOut: m2[2].toUpperCase() };
    const m3 = text.match(/^buy\s+(\S+)\s+(\S+)\s+(?:with|using)\s+(\S+)/i);
    if (m3) {
      const amt = parseNum(m3[1]);
      if (amt) return { type: "swap", amount: amt, tokenIn: m3[3].toUpperCase(), tokenOut: m3[2].toUpperCase() };
    }
    if (/^swap$/.test(text)) return { type: "switch_tab", tab: "swap" };
  }

  /* ── Add liquidity: "add liquidity TSLA WETH 0.3%", "add full range ...", "add range ... 0.5 to 2.0" ── */
  {
    const rangeMatch = text.match(/^add\s+(?:custom\s+)?range\s+(\S+)\s+(\S+)(?:\s+(\S+)\s+to\s+(\S+))?/i);
    if (rangeMatch) {
      return {
        type: "add_liquidity",
        token0: rangeMatch[1].toUpperCase(),
        token1: rangeMatch[2].toUpperCase(),
        range: "custom",
        minPrice: rangeMatch[3],
        maxPrice: rangeMatch[4],
      };
    }
    const fullMatch = text.match(/^add\s+full\s+range\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i);
    if (fullMatch) {
      return {
        type: "add_liquidity",
        token0: fullMatch[1].toUpperCase(),
        token1: fullMatch[2].toUpperCase(),
        fee: fullMatch[3] ? parseFee(fullMatch[3]) : undefined,
        range: "full",
      };
    }
    const m = text.match(/^(?:add\s+)?(?:liquidity|lp)\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i);
    if (m) return { type: "add_liquidity", token0: m[1].toUpperCase(), token1: m[2].toUpperCase(), fee: m[3] ? parseFee(m[3]) : undefined };
    if (text.match(/^(?:add\s+)?(?:liquidity|lp)$/)) return { type: "switch_tab", tab: "pools" };
  }

  /* ── Create pool: "create pool TSLA WETH 0.3%", "create pool TSLA WETH at 0.001" ── */
  {
    const mp = text.match(/^create\s+pool\s+(\S+)\s+(\S+)\s+(?:at|price)\s+(\S+)/i);
    if (mp) return { type: "create_pool", token0: mp[1].toUpperCase(), token1: mp[2].toUpperCase(), price: parseNum(mp[3]) };
    const m = text.match(/^create\s+pool\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i);
    if (m) return { type: "create_pool", token0: m[1].toUpperCase(), token1: m[2].toUpperCase(), fee: m[3] ? parseFee(m[3]) : undefined };
    if (text.startsWith("create pool")) return { type: "switch_tab", tab: "pools" };
  }

  /* ── Collect fees (positions): "collect fees", "collect fees #1" ── */
  {
    const m = text.match(/^collect\s+fees?\s*(?:#?(\d+))?$/i);
    if (m && !text.includes("lp")) return { type: "collect_fees", positionId: m[1] };
  }

  /* ── Remove liquidity: "remove liquidity #1", "remove all liquidity" ── */
  {
    const m = text.match(/^remove\s+(?:all\s+)?liquidity\s*(?:#?(\d+))?/i);
    if (m) return { type: "remove_liquidity", positionId: m[1] };
  }

  /* ── Write covered call: "write call TSLA 100 strike 0.5 premium 0.01 7d" ── */
  {
    const m = text.match(/^write\s+(?:call|option|covered)/i);
    if (m) {
      const underlying = text.match(/(?:write\s+(?:call|option|covered)\s+)(\w+)/i)?.[1]?.toUpperCase();
      const amount = text.match(/(\d+\.?\d*)\s*(?:tokens?|amount|collateral)/i)?.[1] ||
                     text.match(/(?:call|option|covered)\s+\w+\s+(\d+\.?\d*)/i)?.[1];
      const strike = text.match(/strike\s+(\d+\.?\d*)/i)?.[1];
      const premium = text.match(/premium\s+(\d+\.?\d*)/i)?.[1];
      const expiry = parseExpiry(text);
      const twap = parseTwap(text);
      return { type: "write_call", underlying, amount, strike, premium, expiry, twap };
    }
  }

  /* ── Buy option: "buy option #5", "buy offer 5" ── */
  {
    const m = text.match(/^buy\s+(?:option|offer)\s+#?(\d+)/i);
    if (m) return { type: "buy_option", offerId: m[1] };
  }

  /* ── Preview offer: "preview offer #5" ── */
  {
    const m = text.match(/^(?:preview|view|show|load)\s+offer\s+#?(\d+)/i);
    if (m) return { type: "preview_offer", offerId: m[1] };
  }

  /* ── Exercise: "exercise #3", "exercise option 3" ── */
  {
    const m = text.match(/^exercise\s+(?:option\s+)?#?(\d+)/i);
    if (m) return { type: "exercise", tokenId: m[1] };
  }

  /* ── Reclaim: "reclaim #3" ── */
  {
    const m = text.match(/^reclaim\s+(?:expired\s+)?(?:option\s+)?#?(\d+)/i);
    if (m) return { type: "reclaim", tokenId: m[1] };
  }

  /* ── Cancel option offer: "cancel offer #5" ── */
  {
    const m = text.match(/^cancel\s+offer\s+#?(\d+)/i);
    if (m) return { type: "cancel_option", offerId: m[1] };
  }

  /* ── Preview position: "preview position #3" ── */
  {
    const m = text.match(/^(?:preview|view|show|load)\s+position\s+#?(\d+)/i);
    if (m) return { type: "preview_position", tokenId: m[1] };
  }

  /* ── Load chart: "load chart 20000 blocks", "chart 5k" ── */
  {
    const m = text.match(/^(?:load\s+)?chart\s*(?:(\S+)\s*(?:blocks?)?)?/i);
    if (m) return { type: "load_chart", blocks: m[1] ? parseNum(m[1]) : undefined };
  }

  /* ── Launch token: "launch Pepe PEPE 1M creator 5% sale 60% price 0.000001" ── */
  {
    const m = text.match(/^launch\s+(\S+)\s+(\S+)(?:\s+(\S+))?/i);
    if (m) {
      const creatorPct = text.match(/creator\s+(\d+)%?/i)?.[1];
      const salePct = text.match(/sale\s+(\d+)%?/i)?.[1];
      const price = text.match(/price\s+(\d+\.?\d*)/i)?.[1];
      return { type: "launch_token", name: m[1], symbol: m[2].toUpperCase(), supply: m[3] ? parseNum(m[3]) : undefined, creatorPct, salePct, price };
    }
  }

  /* ── Finalize: "finalize 0x1234..." ── */
  {
    const m = text.match(/^finalize\s+(\S+)(?:\s+price\s+(\S+))?(?:\s+fee\s+(\S+))?/i);
    if (m) return { type: "finalize_launch", address: m[1], price: m[2], fee: m[3] ? parseFee(m[3]) : undefined };
    if (text === "finalize") return { type: "switch_tab", tab: "create" };
  }

  /* ── Buy token (launcher): "buy 0.01 ETH", "buy 0.01 eth of tokens" ── */
  {
    const m = text.match(/^buy\s+(\d+\.?\d*)\s*(?:eth|tokens?)/i);
    if (m) return { type: "buy_token", amount: m[1] };
  }

  /* ── Stake: "stake 1000" ── */
  {
    const m = text.match(/^stake\s+(\S+)/i);
    if (m) { const amt = parseNum(m[1]); if (amt) return { type: "stake", amount: amt }; }
  }

  /* ── Filter launches: "show open launches", "filter finalized" ── */
  {
    const m = text.match(/^(?:show|filter)\s+(all|open|finalized)\s*(?:launches?)?/i);
    if (m) return { type: "filter_launches", filter: m[1] as "all" | "open" | "finalized" };
  }

  /* ── Mint NFT: "mint 3", "mint 5 nft" ── */
  {
    const m = text.match(/^mint\s+(\d+)(?:\s+nfts?)?/i);
    if (m) return { type: "mint_nft", qty: m[1] };
    if (text === "mint") return { type: "mint_nft" };
  }

  /* ── Claim ETH from broker: "claim eth from broker #5" ── */
  {
    const m = text.match(/^claim\s+eth\s+(?:from\s+)?(?:broker\s+)?#?(\d+)/i);
    if (m) return { type: "claim_eth", brokerId: m[1] };
    if (text === "claim eth") return { type: "claim_eth" };
  }

  /* ── Claim tokens from broker: "claim tokens from broker #5" ── */
  {
    const m = text.match(/^claim\s+tokens?\s+(?:from\s+)?(?:broker\s+)?#?(\d+)/i);
    if (m) return { type: "claim_tokens", brokerId: m[1] };
    if (text.startsWith("claim token")) return { type: "claim_tokens" };
  }

  /* ── List NFT: "list broker #10 for 0.5 ETH" ── */
  {
    const m = text.match(/^list\s+(?:broker\s+)?#?(\d+)\s+(?:for\s+)?(\d+\.?\d*)\s*eth/i);
    if (m) return { type: "list_nft", tokenId: m[1], price: m[2] };
    const m2 = text.match(/^list\s+(?:broker\s+)?#?(\d+)/i);
    if (m2) return { type: "list_nft", tokenId: m2[1] };
    if (text === "list" || text === "sell") return { type: "switch_tab", tab: "sell" };
  }

  /* ── Buy listing: "buy listing #3" ── */
  {
    const m = text.match(/^buy\s+listing\s+#?(\d+)/i);
    if (m) return { type: "buy_listing", listingId: m[1] };
  }

  /* ── Swap brokers: "swap broker #10 for #20" ── */
  {
    const m = text.match(/^swap\s+broker\s+#?(\d+)\s+(?:for|with)\s+#?(\d+)/i);
    if (m) return { type: "create_swap_offer", offeredId: m[1], requestedId: m[2] };
  }

  /* ── Accept swap: "accept swap #5" ── */
  {
    const m = text.match(/^accept\s+swap\s+#?(\d+)/i);
    if (m) return { type: "accept_swap", swapId: m[1] };
  }

  /* ── Cancel listing: "cancel listing #3" ── */
  {
    const m = text.match(/^cancel\s+listing\s+#?(\d+)/i);
    if (m) return { type: "cancel_listing", listingId: m[1] };
  }

  /* ── Cancel swap: "cancel swap #5" ── */
  {
    const m = text.match(/^cancel\s+swap\s+#?(\d+)/i);
    if (m) return { type: "cancel_swap", swapId: m[1] };
  }

  /* ── Tab switching: "go to swap", "open pools", "show earn" ── */
  {
    const tabMap: Record<string, string> = {
      swap: "swap", trade: "trade", exchange: "swap",
      pool: "pools", pools: "pools", liquidity: "pools",
      position: "positions", positions: "positions",
      earn: "earn", write: "write", chart: "write",
      market: "trade", browse: "browse",
      launch: "launches", launches: "launches", create: "create",
      stake: "stake", staking: "stake", yield: "stake",
      mint: "mint", nft: "mint", wallets: "wallets", claim: "claim",
      sell: "sell", activity: "activity", "my activity": "activity",
    };
    const m = text.match(/^(?:go\s+to|open|show|switch\s+to|navigate\s+to)\s+(.+)$/i);
    if (m && tabMap[m[1].toLowerCase().trim()]) return { type: "switch_tab", tab: tabMap[m[1].toLowerCase().trim()] };
  }

  return { type: "unknown", raw };
}

/* ── Intent description for live preview ── */

function describeIntent(intent: IntentAction): string {
  switch (intent.type) {
    case "swap": return `Swap${intent.amount ? ` ${intent.amount}` : ""} ${intent.tokenIn || "?"} → ${intent.tokenOut || "?"}`;
    case "flip_tokens": return "Flip input/output tokens";
    case "max_balance": return "Use max balance";
    case "set_fee": return `Set fee tier to ${intent.fee === "500" ? "0.05%" : intent.fee === "3000" ? "0.3%" : intent.fee === "10000" ? "1%" : intent.fee}`;
    case "set_slippage": return `Set slippage to ${Number(intent.bps) / 100}%`;
    case "add_liquidity": return `Add${intent.range === "custom" ? " custom range" : intent.range === "full" ? " full range" : ""} LP: ${intent.token0 || "?"}/${intent.token1 || "?"}`;
    case "create_pool": return `Create pool: ${intent.token0 || "?"}/${intent.token1 || "?"}${intent.price ? ` @ ${intent.price}` : ""}`;
    case "collect_fees": return `Collect fees${intent.positionId ? ` from #${intent.positionId}` : ""}`;
    case "remove_liquidity": return `Remove liquidity${intent.positionId ? ` from #${intent.positionId}` : ""}`;
    case "refresh_positions": return "Refresh LP positions";
    case "write_call": return `Write call: ${intent.underlying || "?"}${intent.amount ? ` × ${intent.amount}` : ""}${intent.strike ? ` @ ${intent.strike}` : ""}${intent.expiry ? ` (${intent.expiry}d)` : ""}`;
    case "buy_option": return `Buy option offer #${intent.offerId}`;
    case "preview_offer": return `Preview offer #${intent.offerId}`;
    case "exercise": return `Exercise option #${intent.tokenId}`;
    case "reclaim": return `Reclaim expired #${intent.tokenId}`;
    case "cancel_option": return `Cancel offer #${intent.offerId}`;
    case "preview_position": return `View position #${intent.tokenId}`;
    case "load_chart": return `Load chart${intent.blocks ? ` (${intent.blocks} blocks)` : ""}`;
    case "launch_token": return `Launch ${intent.symbol || "?"} (${intent.name || "?"})${intent.supply ? ` — ${intent.supply} supply` : ""}`;
    case "finalize_launch": return `Finalize launch${intent.address ? ` @ ${intent.address.slice(0, 8)}...` : ""}`;
    case "buy_token": return `Buy ${intent.amount || "?"} ETH of tokens`;
    case "stake": return `Stake ${intent.amount || "?"} tokens`;
    case "unstake": return "Unstake all tokens";
    case "claim_rewards": return "Claim staking rewards";
    case "collect_lp_fees": return "Collect LP fee share";
    case "filter_launches": return `Show ${intent.filter || "all"} launches`;
    case "mint_nft": return `Mint${intent.qty ? ` ${intent.qty}` : ""} Stonk Broker(s)`;
    case "claim_eth": return `Claim ETH${intent.brokerId ? ` from broker #${intent.brokerId}` : ""}`;
    case "claim_tokens": return `Claim tokens${intent.brokerId ? ` from broker #${intent.brokerId}` : ""}`;
    case "refresh_nfts": return "Refresh brokers";
    case "list_nft": return `List #${intent.tokenId || "?"}${intent.price ? ` for ${intent.price} ETH` : ""}`;
    case "buy_listing": return `Buy listing #${intent.listingId}`;
    case "create_swap_offer": return `Swap broker #${intent.offeredId || "?"} for #${intent.requestedId || "?"}`;
    case "accept_swap": return `Accept swap #${intent.swapId}`;
    case "cancel_listing": return `Cancel listing #${intent.listingId}`;
    case "cancel_swap": return `Cancel swap #${intent.swapId}`;
    case "switch_tab": return `Go to ${intent.tab}`;
    case "help": return "Show all commands";
    case "unknown": return "Could not parse — try a different wording";
  }
}

function intentColor(intent: IntentAction): string {
  if (intent.type === "unknown") return "text-red-400";
  if (intent.type === "switch_tab" || intent.type === "help") return "text-lm-terminal-lightgray";
  return "text-lm-green";
}

/* ══════════════════════════════════════════════════════════════
   Global intent dispatch (pub/sub)
   ══════════════════════════════════════════════════════════════ */

type IntentListener = (intent: IntentAction) => void;
const intentListeners = new Set<IntentListener>();

export function dispatchIntent(intent: IntentAction) {
  intentListeners.forEach((fn) => fn(intent));
}

export function useIntentListener(callback: IntentListener) {
  const ref = React.useRef(callback);
  ref.current = callback;
  React.useEffect(() => {
    const fn: IntentListener = (i) => ref.current(i);
    intentListeners.add(fn);
    return () => { intentListeners.delete(fn); };
  }, []);
}

/* ══════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════ */

type Props = {
  onIntent: (intent: IntentAction) => void;
  placeholder?: string;
  context?: "exchange" | "launcher" | "options" | "nft" | "marketplace";
};

export function IntentTerminal({ onIntent, placeholder, context }: Props) {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const intent = useMemo(() => input.trim() ? parseIntent(input) : null, [input]);

  /* Filter suggestions to context + text match */
  const filteredSuggestions = useMemo(() => {
    const allowedCats = context ? CONTEXT_CATS[context] || [] : Object.keys(CATEGORY_LABELS) as SuggestionCategory[];

    if (!input.trim()) {
      return ALL_SUGGESTIONS.filter((s) => allowedCats.includes(s.cat) && s.cat !== "navigation").slice(0, 8);
    }
    const lower = input.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    return ALL_SUGGESTIONS.filter((s) => {
      if (!allowedCats.includes(s.cat)) return false;
      const searchable = `${s.label} ${s.hint} ${s.description}`.toLowerCase();
      return words.every((w) => searchable.includes(w));
    }).slice(0, 8);
  }, [input, context]);

  /* Group by category */
  const groupedSuggestions = useMemo(() => {
    const groups: { cat: SuggestionCategory; items: (Suggestion & { flatIdx: number })[] }[] = [];
    let flatIdx = 0;
    const seen = new Set<SuggestionCategory>();
    for (const s of filteredSuggestions) {
      if (!seen.has(s.cat)) {
        seen.add(s.cat);
        groups.push({ cat: s.cat, items: [] });
      }
      const g = groups.find((g) => g.cat === s.cat)!;
      g.items.push({ ...s, flatIdx });
      flatIdx++;
    }
    return groups;
  }, [filteredSuggestions]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    const parsed = parseIntent(input);
    if (parsed.type === "help") {
      setShowHelp(true);
      setInput("");
      return;
    }
    onIntent(parsed);
    dispatchIntent(parsed);
    setInput("");
    setFocused(false);
    inputRef.current?.blur();
  }, [input, onIntent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (selectedSuggestion >= 0 && filteredSuggestions[selectedSuggestion]) {
        setInput(filteredSuggestions[selectedSuggestion].hint);
        setSelectedSuggestion(-1);
        return;
      }
      handleSubmit();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestion((s) => Math.min(s + 1, filteredSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestion((s) => Math.max(s - 1, -1));
    } else if (e.key === "Escape") {
      if (showHelp) { setShowHelp(false); return; }
      setInput("");
      setFocused(false);
      inputRef.current?.blur();
    } else if (e.key === "Tab" && filteredSuggestions.length > 0) {
      e.preventDefault();
      const idx = selectedSuggestion >= 0 ? selectedSuggestion : 0;
      setInput(filteredSuggestions[idx].hint);
      setSelectedSuggestion(-1);
    }
  }, [handleSubmit, selectedSuggestion, filteredSuggestions, showHelp]);

  /* Global Cmd+K shortcut */
  useEffect(() => {
    function handleGlobal(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
    }
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, []);

  /* Scroll active item into view */
  useEffect(() => {
    if (selectedSuggestion >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.querySelector(`[data-idx="${selectedSuggestion}"]`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedSuggestion]);

  return (
    <div className="relative">
      {/* ── Input bar ── */}
      <div className={`flex items-center gap-2 bg-lm-black border transition-all ${
        focused ? "border-lm-orange shadow-[0_0_12px_rgba(207,255,4,0.12)]" : "border-lm-terminal-gray hover:border-lm-gray"
      }`}>
        <div className="pl-3 flex items-center gap-1.5 flex-shrink-0">
          <span className="text-lm-orange text-sm font-bold">&gt;_</span>
          {!focused && !input && (
            <span className="text-lm-terminal-lightgray text-[10px] lm-mono hidden sm:inline">
              <kbd className="border border-lm-terminal-gray px-1 py-0.5 text-[9px] rounded-sm">⌘K</kbd>
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setSelectedSuggestion(-1); setShowHelp(false); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => { setFocused(false); }, 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type what you want to do... (or 'help' for all commands)"}
          className="flex-1 bg-transparent text-white text-xs lm-mono py-2.5 pr-3 outline-none placeholder:text-lm-terminal-lightgray/40"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {/* Live intent preview */}
        {input && intent && (
          <div className="pr-3 flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] ${intentColor(intent)} lm-mono truncate max-w-[200px]`}>{describeIntent(intent)}</span>
            <button type="button" onClick={handleSubmit}
              className="text-[10px] px-2.5 py-1 bg-lm-orange text-black font-bold hover:brightness-110 transition-all flex-shrink-0">
              GO
            </button>
          </div>
        )}
        {/* Help toggle */}
        {!input && (
          <button type="button" onClick={() => setShowHelp(!showHelp)}
            className="pr-3 text-lm-terminal-lightgray hover:text-lm-orange transition-colors text-[10px] lm-mono flex-shrink-0"
            title="Show all commands">
            ?
          </button>
        )}
      </div>

      {/* ── Suggestions dropdown ── */}
      {focused && !showHelp && filteredSuggestions.length > 0 && (
        <div ref={dropdownRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 bg-lm-black border border-lm-terminal-gray shadow-xl max-h-80 overflow-y-auto">
          {groupedSuggestions.map((group) => (
            <div key={group.cat}>
              <div className="px-3 py-1 text-[9px] text-lm-terminal-lightgray lm-upper tracking-wider bg-lm-terminal-darkgray/50 border-b border-lm-terminal-gray/30 sticky top-0">
                {CATEGORY_LABELS[group.cat]}
              </div>
              {group.items.map((s) => (
                <button
                  key={s.label + s.hint}
                  data-idx={s.flatIdx}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setInput(s.hint); setSelectedSuggestion(-1); }}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                    s.flatIdx === selectedSuggestion ? "bg-lm-orange/10 text-lm-orange" : "text-white hover:bg-lm-terminal-darkgray"
                  }`}>
                  <span className="text-sm w-5 text-center flex-shrink-0 opacity-70">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{s.label}</div>
                    <div className="text-[9px] text-lm-terminal-lightgray truncate">{s.description}</div>
                  </div>
                  <span className="text-lm-terminal-lightgray text-[10px] lm-mono flex-shrink-0 hidden sm:inline">{s.hint}</span>
                </button>
              ))}
            </div>
          ))}
          <div className="px-3 py-1.5 border-t border-lm-terminal-gray text-[9px] text-lm-terminal-lightgray flex items-center gap-3 bg-lm-terminal-darkgray/30">
            <span><kbd className="border border-lm-terminal-gray px-1 py-0.5 rounded-sm">↑↓</kbd> navigate</span>
            <span><kbd className="border border-lm-terminal-gray px-1 py-0.5 rounded-sm">Tab</kbd> complete</span>
            <span><kbd className="border border-lm-terminal-gray px-1 py-0.5 rounded-sm">Enter</kbd> execute</span>
            <span><kbd className="border border-lm-terminal-gray px-1 py-0.5 rounded-sm">Esc</kbd> close</span>
            <span className="ml-auto">Type <span className="text-lm-orange">help</span> for all commands</span>
          </div>
        </div>
      )}

      {/* ── Full help overlay ── */}
      {showHelp && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-lm-black border border-lm-orange shadow-xl max-h-[70vh] overflow-y-auto">
          <div className="px-4 py-3 border-b border-lm-terminal-gray flex items-center justify-between sticky top-0 bg-lm-black z-10">
            <div>
              <div className="text-sm font-bold text-white">All Available Commands</div>
              <div className="text-[10px] text-lm-terminal-lightgray">Type any command in the terminal above. Parameters in italics are optional.</div>
            </div>
            <button type="button" onClick={() => setShowHelp(false)}
              className="text-lm-terminal-lightgray hover:text-white text-lg leading-none px-2">×</button>
          </div>
          {(Object.keys(CATEGORY_LABELS) as SuggestionCategory[]).map((cat) => {
            const items = ALL_SUGGESTIONS.filter((s) => s.cat === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="border-b border-lm-terminal-gray/30 last:border-0">
                <div className="px-4 py-2 text-[10px] text-lm-orange lm-upper tracking-wider font-bold bg-lm-terminal-darkgray/40">
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="divide-y divide-lm-terminal-gray/20">
                  {items.map((s) => (
                    <button
                      key={s.label + s.hint}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setInput(s.hint); setShowHelp(false); inputRef.current?.focus(); }}
                      className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-lm-terminal-darkgray transition-colors group">
                      <span className="text-sm w-5 text-center flex-shrink-0 opacity-60">{s.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-bold text-white group-hover:text-lm-orange transition-colors">{s.label}</span>
                        <span className="text-[9px] text-lm-terminal-lightgray ml-2">{s.description}</span>
                      </div>
                      <code className="text-[10px] text-lm-green/70 lm-mono flex-shrink-0 bg-lm-terminal-darkgray px-2 py-0.5">{s.hint}</code>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="px-4 py-2.5 text-[9px] text-lm-terminal-lightgray bg-lm-terminal-darkgray/30 sticky bottom-0 border-t border-lm-terminal-gray">
            Click any command to populate the terminal. Supports shortcuts: 1M = 1,000,000 · 1K = 1,000 · 7d = 7 days · 1h = 1 hour
          </div>
        </div>
      )}
    </div>
  );
}
