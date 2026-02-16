"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Address, formatEther, formatUnits, parseAbiItem, parseEther } from "viem";
import { Button } from "../../components/Button";
import { Panel } from "../../components/Terminal";
import { TerminalTabs } from "../../components/Tabs";
import { Input } from "../../components/Input";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../providers";
import { config } from "../../lib/config";
import {
  ERC20Abi,
  StonkLaunchAbi,
  StonkLauncherFactoryAbi,
  StonkLpFeeSplitterAbi,
  StonkYieldStakingVaultAbi,
  ERC20MetadataAbi
} from "../../lib/abis";
import { IntentTerminal, IntentAction } from "../../components/IntentTerminal";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function LauncherInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Stonk Launcher information"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl bg-lm-terminal-darkgray border-4 border-lm-orange border-dashed p-4 md:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-white font-bold text-lg lm-upper">How Stonk Launcher Works</div>
            <div className="text-lm-gray text-xs mt-1">
              Launch a token, create a Uniswap v3 pool, and share LP fees with stakers.
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close info">
            Close
          </Button>
        </div>

        <div className="space-y-3 text-sm text-lm-terminal-lightgray">
          <div>
            <div className="text-white font-bold text-xs lm-upper tracking-wider">1) Create a Launch</div>
            <div className="mt-1">
              Use the `Create` tab to set your token name/symbol, total supply, sale allocation, and sale price. This deploys a launch contract
              and a token, and prepares the sale.
            </div>
          </div>

          <div>
            <div className="text-white font-bold text-xs lm-upper tracking-wider">2) Finalize and Create the Pool</div>
            <div className="mt-1">
              Finalizing creates the trading pool and initializes pricing. After finalization, trading is live on the `Exchange` page.
            </div>
          </div>

          <div>
            <div className="text-white font-bold text-xs lm-upper tracking-wider">3) LP Fees and Fee Splitting</div>
            <div className="mt-1">
              Trading fees accrue in the Uniswap v3 pool. The launch includes a fee splitter that can collect LP fees and route them to the staking
              system for distribution.
            </div>
          </div>

          <div>
            <div className="text-white font-bold text-xs lm-upper tracking-wider">4) Stake to Earn Your Share</div>
            <div className="mt-1">
              Stake the launched token to earn a pro-rata share of the collected LP fees. You can manage staking in the `Stake/Yield` tab or by
              opening a specific launch and using `Stake & Earn`. Staking positions have a minimum lock period (typically ~2 weeks).
            </div>
          </div>

          <div className="text-[11px] text-lm-gray">
            Tip: You can also use the intent terminal at the top (e.g. `launch PEPE PEP 1M`, `buy 0.01 ETH`, `stake 1000`, `claim rewards`).
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Human-friendly formatters ── */

function short(a: string) { return a.slice(0, 6) + "..." + a.slice(-4); }

function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtTokens(wei: bigint, decimals = 18): string {
  const raw = formatUnits(wei, decimals);
  const num = Number(raw);
  if (num === 0) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 0.01) return num.toFixed(4);
  return num.toExponential(2);
}

function fmtEth(wei: bigint): string {
  if (wei === 0n) return "0";
  const raw = formatUnits(wei, 18);
  const num = Number(raw);
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.001) return num.toFixed(6);
  if (num >= 0.000001) return num.toFixed(8);
  return num.toExponential(2);
}

function fmtPrice(weiPerToken: bigint): string {
  if (weiPerToken === 0n) return "—";
  const num = Number(formatEther(weiPerToken));
  if (num >= 1) return `${num.toFixed(4)} ETH`;
  if (num >= 0.001) return `${num.toFixed(6)} ETH`;
  if (num >= 0.000001) return `${(num * 1_000_000).toFixed(2)} µETH`;
  return `${num.toExponential(2)} ETH`;
}

function symbolColor(sym: string): string {
  const colors = [
    "from-orange-500 to-yellow-400",
    "from-cyan-500 to-blue-500",
    "from-emerald-500 to-green-400",
    "from-purple-500 to-pink-500",
    "from-red-500 to-orange-400",
    "from-indigo-500 to-cyan-400",
    "from-amber-400 to-red-500",
    "from-lime-400 to-emerald-500"
  ];
  let hash = 0;
  for (let i = 0; i < sym.length; i++) hash = ((hash << 5) - hash + sym.charCodeAt(i)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

/* ── Types ── */
type LaunchData = {
  creator: Address;
  token: Address;
  launch: Address;
  symbol: string;
  name: string;
  imageURI: string;
  finalized: boolean;
  pool?: Address;
  feeSplitter?: Address;
  stakingVault?: Address;
  sold: bigint;
  saleSupply: bigint;
  priceWeiPerToken: bigint;
  remaining: bigint;
  blockTimestamp?: number;
};

/* ══════════════════════════════════════════════════════
   Featured Carousel
   ══════════════════════════════════════════════════════ */

function FeaturedCarousel({
  launches,
  onSelect
}: {
  launches: LaunchData[];
  onSelect: (x: LaunchData) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = launches.length;

  const scrollTo = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const child = el.children[idx] as HTMLElement;
    if (child) {
      el.scrollTo({ left: child.offsetLeft - 12, behavior: "smooth" });
      setActiveIdx(idx);
    }
  }, []);

  // Auto-advance every 5s
  useEffect(() => {
    if (count <= 1 || paused) return;
    const iv = setInterval(() => {
      setActiveIdx((prev) => {
        const next = (prev + 1) % count;
        scrollTo(next);
        return next;
      });
    }, 5000);
    return () => clearInterval(iv);
  }, [count, paused, scrollTo]);

  // Track scroll position for dot indicator
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (!el) { ticking = false; return; }
        const children = Array.from(el.children) as HTMLElement[];
        const scrollCenter = el.scrollLeft + el.clientWidth / 2;
        let closest = 0;
        let minDist = Infinity;
        children.forEach((child, i) => {
          const center = child.offsetLeft + child.clientWidth / 2;
          const dist = Math.abs(center - scrollCenter);
          if (dist < minDist) { minDist = dist; closest = i; }
        });
        setActiveIdx(closest);
        ticking = false;
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (count === 0) return null;

  return (
    <div
      className="space-y-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Carousel header */}
      <div className="flex items-center justify-between px-1">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Featured Launches</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollTo(Math.max(0, activeIdx - 1))}
            className="w-6 h-6 flex items-center justify-center border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange transition-colors"
            aria-label="Previous"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 010 1.06L7.06 8l2.72 2.72a.75.75 0 11-1.06 1.06L5.47 8.53a.75.75 0 010-1.06l3.25-3.25a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollTo(Math.min(count - 1, activeIdx + 1))}
            className="w-6 h-6 flex items-center justify-center border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange transition-colors"
            aria-label="Next"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {launches.map((x, i) => {
          const soldPct = x.saleSupply === 0n ? 0 : Number((x.sold * 10000n) / x.saleSupply) / 100;
          const soldOut = x.remaining === 0n && x.saleSupply > 0n;
          const ethRaised = x.priceWeiPerToken > 0n && x.sold > 0n ? (x.sold * x.priceWeiPerToken) / (10n ** 18n) : 0n;
          const grad = symbolColor(x.symbol);

          return (
            <button
              type="button"
              key={x.launch}
              onClick={() => onSelect(x)}
              className="snap-start flex-shrink-0 w-[280px] sm:w-[320px] bg-lm-black border border-lm-terminal-gray hover:border-lm-orange transition-all group text-left"
            >
              {/* Gradient banner */}
              <div className={`h-20 bg-gradient-to-br ${grad} relative overflow-hidden`}>
                {x.imageURI && x.imageURI.startsWith("http") && (
                  <img
                    src={x.imageURI}
                    alt={x.symbol}
                    className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-2">
                  <div className="w-9 h-9 bg-black/50 border border-white/20 flex items-center justify-center text-white font-bold text-sm backdrop-blur-sm">
                    {x.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-white font-bold text-sm leading-tight">${x.symbol}</div>
                    <div className="text-white/70 text-[10px] leading-tight truncate max-w-[180px]">{x.name}</div>
                  </div>
                </div>
                <div className="absolute top-2 right-2">
                  <span className={`text-[9px] px-1.5 py-0.5 font-bold ${
                    x.finalized
                      ? "bg-lm-green/20 text-lm-green border border-lm-green/40"
                      : soldOut
                        ? "bg-white/10 text-white/60 border border-white/20"
                        : "bg-lm-orange/20 text-lm-orange border border-lm-orange/40"
                  }`}>
                    {x.finalized ? "TRADING" : soldOut ? "SOLD OUT" : "SALE OPEN"}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 space-y-2">
                {/* Progress bar */}
                {x.saleSupply > 0n && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-lm-terminal-lightgray">Sale</span>
                      <span className="text-white font-bold">{soldPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 bg-lm-terminal-darkgray">
                      <div
                        className={`h-full transition-all ${x.finalized ? "bg-lm-green" : "bg-lm-orange"}`}
                        style={{ width: `${Math.min(100, soldPct)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center justify-between text-[10px]">
                  <div>
                    <span className="text-lm-terminal-lightgray">Price </span>
                    <span className="text-white lm-mono font-bold">{fmtPrice(x.priceWeiPerToken)}</span>
                  </div>
                  <div>
                    <span className="text-lm-terminal-lightgray">Raised </span>
                    <span className="text-white lm-mono font-bold">{fmtEth(ethRaised)} ETH</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-lm-terminal-gray">
                  <span className="text-lm-terminal-lightgray">{x.blockTimestamp ? timeAgo(x.blockTimestamp) : ""}</span>
                  <span className="text-lm-orange group-hover:underline font-bold">View Details →</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dot indicators */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {launches.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              className={`transition-all ${
                i === activeIdx
                  ? "w-5 h-1.5 bg-lm-orange"
                  : "w-1.5 h-1.5 bg-lm-terminal-gray hover:bg-lm-terminal-lightgray"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Launch Detail Modal
   ══════════════════════════════════════════════════════ */

function LaunchDetailModal({
  x,
  onClose,
  onBuy
}: {
  x: LaunchData;
  onClose: () => void;
  onBuy: (x: LaunchData, ethAmount: string) => void;
}) {
  const [buyAmt, setBuyAmt] = useState("");
  const soldPct = x.saleSupply === 0n ? 0 : Number((x.sold * 10000n) / x.saleSupply) / 100;
  const soldOut = x.remaining === 0n && x.saleSupply > 0n;
  const ethRaised = x.priceWeiPerToken > 0n && x.sold > 0n ? (x.sold * x.priceWeiPerToken) / (10n ** 18n) : 0n;
  const tokenEstimate = (() => {
    try {
      const e = parseEther(buyAmt || "0");
      return e > 0n && x.priceWeiPerToken > 0n ? fmtTokens((e * 10n ** 18n) / x.priceWeiPerToken) : "";
    } catch { return ""; }
  })();
  const grad = symbolColor(x.symbol);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative bg-lm-dark-gray border-2 border-dashed border-lm-orange w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className={`h-28 bg-gradient-to-br ${grad} relative overflow-hidden`}>
          {x.imageURI && x.imageURI.startsWith("http") && (
            <img
              src={x.imageURI}
              alt={x.symbol}
              className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/50 border border-white/20 text-white hover:text-lm-orange transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
          <div className="absolute bottom-3 left-4 flex items-center gap-3">
            <div className="w-12 h-12 bg-black/50 border border-white/20 flex items-center justify-center text-white font-bold text-lg backdrop-blur-sm">
              {x.symbol.slice(0, 2)}
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">${x.symbol}</div>
              <div className="text-white/70 text-xs leading-tight">{x.name}</div>
            </div>
          </div>
          <div className="absolute bottom-3 right-4">
            <span className={`text-[10px] px-2 py-1 font-bold ${
              x.finalized
                ? "bg-lm-green/20 text-lm-green border border-lm-green/40"
                : soldOut
                  ? "bg-white/10 text-white/60 border border-white/20"
                  : "bg-lm-orange/20 text-lm-orange border border-lm-orange/40"
            }`}>
              {x.finalized ? "TRADING LIVE" : soldOut ? "SOLD OUT" : "SALE OPEN"}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Sale Progress */}
          {x.saleSupply > 0n && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-lm-terminal-lightgray">Sale Progress</span>
                <span className="text-white font-bold">{soldPct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-lm-terminal-darkgray border border-lm-terminal-gray">
                <div
                  className={`h-full transition-all ${x.finalized ? "bg-lm-green" : "bg-lm-orange"}`}
                  style={{ width: `${Math.min(100, soldPct)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-lm-terminal-lightgray">
                <span><span className="text-white lm-mono">{fmtTokens(x.sold)}</span> sold</span>
                <span><span className="text-white lm-mono">{fmtTokens(x.remaining)}</span> remaining</span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
              <div className="text-lm-terminal-lightgray text-[10px]">Price per Token</div>
              <div className="text-white lm-mono font-bold">{fmtPrice(x.priceWeiPerToken)}</div>
            </div>
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
              <div className="text-lm-terminal-lightgray text-[10px]">Total Raised</div>
              <div className="text-white lm-mono font-bold">{fmtEth(ethRaised)} ETH</div>
            </div>
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
              <div className="text-lm-terminal-lightgray text-[10px]">Total Supply</div>
              <div className="text-white lm-mono font-bold">{fmtTokens(x.saleSupply)}</div>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <div className="text-lm-terminal-lightgray">Creator</div>
              <a href={explorerAddr(x.creator)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(x.creator)}</a>
            </div>
            <div>
              <div className="text-lm-terminal-lightgray">Token</div>
              <a href={explorerAddr(x.token)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(x.token)}</a>
            </div>
            {x.pool && x.pool !== ZERO && (
              <div>
                <div className="text-lm-terminal-lightgray">Trading Pool</div>
                <a href={explorerAddr(x.pool)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(x.pool)}</a>
              </div>
            )}
            <div>
              <div className="text-lm-terminal-lightgray">Launch Contract</div>
              <a href={explorerAddr(x.launch)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(x.launch)}</a>
            </div>
          </div>

          {x.blockTimestamp && (
            <div className="text-[10px] text-lm-terminal-lightgray">
              Launched {timeAgo(x.blockTimestamp)}
            </div>
          )}

          {/* Quick Buy for open launches */}
          {!x.finalized && x.remaining > 0n && (
            <div className="space-y-2 bg-lm-terminal-darkgray border border-lm-terminal-gray p-3">
              <div className="text-white font-bold text-xs lm-upper">Quick Buy</div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    value={buyAmt}
                    onValueChange={setBuyAmt}
                    placeholder="ETH to spend"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => { onBuy(x, buyAmt); onClose(); }}
                  className="text-xs px-4 py-1.5 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 transition-colors whitespace-nowrap"
                >
                  Buy ${x.symbol}
                </button>
              </div>
              {tokenEstimate && (
                <div className="text-[10px] text-lm-terminal-lightgray">
                  You&apos;ll receive ≈ <span className="text-white font-bold">{tokenEstimate} ${x.symbol}</span>
                </div>
              )}
            </div>
          )}

          {/* Actions for finalized */}
          <div className="flex items-center gap-2 flex-wrap">
            {x.finalized && x.pool && x.pool !== ZERO && (
              <Link href={`/exchange?in=ETH&out=${x.token}`} className="text-xs px-3 py-1.5 border border-lm-green text-lm-green hover:bg-lm-green/5 transition-colors" onClick={onClose}>
                Trade on DEX
              </Link>
            )}
            {x.finalized && x.stakingVault && x.stakingVault !== ZERO && (
              <Link href={`/launcher/${x.launch}`} className="text-xs px-3 py-1.5 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors" onClick={onClose}>
                Stake ${x.symbol}
              </Link>
            )}
            <Link href={`/launcher/${x.launch}`} className="text-xs px-3 py-1.5 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 transition-colors" onClick={onClose}>
              Full Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Launches Index (with carousel + grid)
   ══════════════════════════════════════════════════════ */

function LaunchesIndex() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "finalized">("all");
  const [buyStatus, setBuyStatus] = useState<Record<string, string>>({});
  const [buyType, setBuyType] = useState<Record<string, "info" | "success" | "error">>({});
  const [buyAmounts, setBuyAmounts] = useState<Record<string, string>>({});
  const [selectedLaunch, setSelectedLaunch] = useState<LaunchData | null>(null);
  const factory = config.launcherFactory as Address;

  async function refresh() {
    if (!factory) { setStatus("Missing launcher factory address."); setLaunches([]); return; }
    setLoading(true);
    setStatus("");
    try {
      const latest = await publicClient.getBlockNumber();
      const WINDOW = 30_000n;
      const p = BigInt(Math.max(1, Math.min(10, pages)));
      const fromBlock = latest > WINDOW * p ? latest - WINDOW * p : 0n;

      const ev = parseAbiItem(
        "event LaunchCreated(address indexed creator,address indexed token,address indexed launch,string name,string symbol,string metadataURI,string imageURI)"
      );
      const logs = await publicClient.getLogs({ address: factory, event: ev, fromBlock, toBlock: latest });
      const newestFirst = [...logs].reverse();

      const seen = new Set<string>();
      const raw: Array<{ creator: Address; token: Address; launch: Address; symbol: string; name: string; imageURI: string; blockNumber: bigint }> = [];
      for (const l of newestFirst) {
        const la = l.args.launch as Address;
        if (seen.has(la.toLowerCase())) continue;
        seen.add(la.toLowerCase());
        raw.push({
          creator: l.args.creator as Address, token: l.args.token as Address, launch: la,
          symbol: (l.args.symbol as string) || "TOKEN", name: (l.args.name as string) || "LAUNCH",
          imageURI: (l.args.imageURI as string) || "", blockNumber: l.blockNumber
        });
        if (raw.length >= 30) break;
      }

      const blockNums = [...new Set(raw.map((r) => r.blockNumber))];
      const blockMap = new Map<bigint, number>();
      await Promise.all(blockNums.map(async (bn) => {
        try {
          const b = await publicClient.getBlock({ blockNumber: bn });
          blockMap.set(bn, Number(b.timestamp));
        } catch { /* skip */ }
      }));

      const enriched: LaunchData[] = await Promise.all(
        raw.map(async (x) => {
          try {
            const rec = (await publicClient.readContract({ address: factory, abi: StonkLauncherFactoryAbi, functionName: "launches", args: [x.launch] })) as any;
            const finalized = Boolean(rec.finalized);
            const [sold, saleSupply, priceWeiPerToken, remaining] = await Promise.all([
              publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "sold" }) as Promise<bigint>,
              publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "saleSupply" }) as Promise<bigint>,
              publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "priceWeiPerToken" }) as Promise<bigint>,
              publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "remainingForSale" }) as Promise<bigint>
            ]);
            let pool: Address | undefined, feeSplitter: Address | undefined, stakingVault: Address | undefined;
            if (finalized) {
              [pool, feeSplitter, stakingVault] = await Promise.all([
                publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "pool" }) as Promise<Address>,
                publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "feeSplitter" }) as Promise<Address>,
                publicClient.readContract({ address: x.launch, abi: StonkLaunchAbi, functionName: "stakingVault" }) as Promise<Address>
              ]);
            }
            return { ...x, finalized, pool, feeSplitter, stakingVault, sold, saleSupply, priceWeiPerToken, remaining, blockTimestamp: blockMap.get(x.blockNumber) };
          } catch {
            return { ...x, finalized: false, sold: 0n, saleSupply: 0n, priceWeiPerToken: 0n, remaining: 0n };
          }
        })
      );

      setLaunches(enriched);
      if (enriched.length === 0) setStatus("No launches found in recent blocks.");
    } catch (e: any) {
      setLaunches([]);
      setStatus(String(e?.shortMessage || e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh().catch(() => {}); }, [pages, factory]); // eslint-disable-line react-hooks/exhaustive-deps

  async function quickBuy(x: LaunchData, ethAmtStr?: string) {
    const key = x.launch;
    const ethStr = ethAmtStr || buyAmounts[key] || "";
    if (!address || !walletClient) { setBuyStatus((p) => ({ ...p, [key]: "Connect wallet." })); setBuyType((p) => ({ ...p, [key]: "error" })); return; }
    let ethVal: bigint;
    try { ethVal = parseEther(ethStr || "0"); } catch { setBuyStatus((p) => ({ ...p, [key]: "Invalid ETH amount." })); setBuyType((p) => ({ ...p, [key]: "error" })); return; }
    if (ethVal <= 0n) { setBuyStatus((p) => ({ ...p, [key]: "Enter an ETH amount." })); setBuyType((p) => ({ ...p, [key]: "error" })); return; }
    setBuyStatus((p) => ({ ...p, [key]: `Buying ${ethStr} ETH of ${x.symbol}...` }));
    setBuyType((p) => ({ ...p, [key]: "info" }));
    try {
      await requireCorrectChain();
      const tx = await walletClient.writeContract({
        address: x.launch, abi: StonkLaunchAbi, functionName: "buy", args: [],
        value: ethVal, chain: robinhoodTestnet, account: address
      });
      setBuyStatus((p) => ({ ...p, [key]: "Confirming on-chain..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setBuyStatus((p) => ({ ...p, [key]: `Purchased ${x.symbol} tokens for ${ethStr} ETH!` }));
      setBuyType((p) => ({ ...p, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setBuyStatus((p) => ({ ...p, [key]: "Transaction cancelled." }));
      } else {
        setBuyStatus((p) => ({ ...p, [key]: `Buy failed: ${msg}` }));
      }
      setBuyType((p) => ({ ...p, [key]: "error" }));
    }
  }

  async function collectFees(x: LaunchData) {
    const key = x.launch + "-fee";
    if (!address || !walletClient) { setBuyStatus((p) => ({ ...p, [key]: "Connect wallet." })); setBuyType((p) => ({ ...p, [key]: "error" })); return; }
    if (!x.feeSplitter || x.feeSplitter === ZERO) { setBuyStatus((p) => ({ ...p, [key]: "No fee splitter for this launch." })); setBuyType((p) => ({ ...p, [key]: "error" })); return; }
    setBuyStatus((p) => ({ ...p, [key]: "Collecting fees..." }));
    setBuyType((p) => ({ ...p, [key]: "info" }));
    try {
      await requireCorrectChain();
      const tx = await walletClient.writeContract({
        address: x.feeSplitter, abi: StonkLpFeeSplitterAbi, functionName: "collectAndSplit", args: [],
        chain: robinhoodTestnet, account: address
      });
      setBuyStatus((p) => ({ ...p, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setBuyStatus((p) => ({ ...p, [key]: "Fees collected & split!" }));
      setBuyType((p) => ({ ...p, [key]: "success" }));
    } catch (e: any) {
      setBuyStatus((p) => ({ ...p, [key]: String(e?.shortMessage || e?.message || e) }));
      setBuyType((p) => ({ ...p, [key]: "error" }));
    }
  }

  const filtered = useMemo(() => {
    if (filter === "open") return launches.filter((l) => !l.finalized);
    if (filter === "finalized") return launches.filter((l) => l.finalized);
    return launches;
  }, [launches, filter]);

  return (
    <div className="space-y-4">
      {/* ── Featured Carousel ── */}
      {launches.length > 0 && (
        <FeaturedCarousel
          launches={launches}
          onSelect={setSelectedLaunch}
        />
      )}

      {/* ── Detail Modal ── */}
      {selectedLaunch && (
        <LaunchDetailModal
          x={selectedLaunch}
          onClose={() => setSelectedLaunch(null)}
          onBuy={(x, amt) => quickBuy(x, amt)}
        />
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          {(["all", "open", "finalized"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-1 border transition-colors capitalize ${filter === f ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
              {f === "all" ? `All (${launches.length})` : f === "open" ? `Open (${launches.filter((l) => !l.finalized).length})` : `Live (${launches.filter((l) => l.finalized).length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => setPages(1)} className={`text-[10px] px-2 py-1 border transition-colors ${pages === 1 ? "border-lm-orange text-lm-orange" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>Latest</button>
          <button type="button" onClick={() => setPages((p) => Math.min(10, p + 1))} className="text-[10px] px-2 py-1 border border-lm-terminal-gray text-lm-gray hover:border-lm-gray transition-colors">Older</button>
          <button type="button" onClick={() => refresh()} disabled={loading} className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors disabled:opacity-40 disabled:pointer-events-none">{loading ? "..." : "Refresh"}</button>
        </div>
      </div>

      {loading && <div className="text-lm-gray text-xs animate-pulse text-center py-4">Indexing launches...</div>}
      {status && !loading && <div className="text-lm-red text-xs">{status}</div>}

      {/* ── Grid List ── */}
      {filtered.length === 0 && !loading ? (
        <div className="text-lm-gray text-sm text-center py-8">No launches found. Be the first to create one!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((x) => {
            const key = x.launch;
            const soldPct = x.saleSupply === 0n ? 0 : Number((x.sold * 10000n) / x.saleSupply) / 100;
            const soldOut = x.remaining === 0n && x.saleSupply > 0n;
            const ethRaised = x.priceWeiPerToken > 0n && x.sold > 0n ? (x.sold * x.priceWeiPerToken) / (10n ** 18n) : 0n;
            const tokenEstimate = (buyAmounts[key] && x.priceWeiPerToken > 0n) ? (() => {
              try { const e = parseEther(buyAmounts[key] || "0"); return e > 0n ? fmtTokens((e * 10n ** 18n) / x.priceWeiPerToken) : ""; } catch { return ""; }
            })() : "";
            const bStatus = buyStatus[key];
            const bType = buyType[key] || "info";
            const bColor = bType === "success" ? "text-lm-green" : bType === "error" ? "text-lm-red" : "text-lm-gray";
            const feeKey = key + "-fee";
            const feeStatus = buyStatus[feeKey];
            const feeType = buyType[feeKey] || "info";
            const feeColor = feeType === "success" ? "text-lm-green" : feeType === "error" ? "text-lm-red" : "text-lm-gray";

            return (
              <div key={key} className="bg-lm-black border border-lm-terminal-gray hover:border-lm-terminal-lightgray transition-colors p-3 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => setSelectedLaunch(x)} className="flex items-center gap-2 min-w-0 text-left group">
                    {x.imageURI && x.imageURI.startsWith("http") ? (
                      <img src={x.imageURI} alt={x.symbol} className="w-8 h-8 border border-lm-terminal-gray object-cover flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className={`w-8 h-8 bg-gradient-to-br ${symbolColor(x.symbol)} flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0`}>
                        {x.symbol.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white font-bold text-sm group-hover:text-lm-orange transition-colors">${x.symbol}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 border ${x.finalized ? "border-lm-green text-lm-green" : soldOut ? "border-lm-gray text-lm-gray" : "border-lm-orange text-lm-orange"}`}>
                          {x.finalized ? "TRADING" : soldOut ? "SOLD OUT" : "SALE OPEN"}
                        </span>
                      </div>
                      <div className="text-lm-terminal-lightgray text-[10px] truncate">{x.name}</div>
                    </div>
                  </button>
                  <div className="text-right flex-shrink-0">
                    {x.blockTimestamp && <div className="text-lm-terminal-lightgray text-[10px]">{timeAgo(x.blockTimestamp)}</div>}
                    <a href={explorerAddr(x.creator)} target="_blank" rel="noreferrer" className="text-lm-terminal-lightgray hover:text-lm-orange text-[10px] lm-mono transition-colors">
                      by {short(x.creator)}
                    </a>
                  </div>
                </div>

                {/* Sale Progress */}
                {x.saleSupply > 0n && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-lm-terminal-lightgray">Sale</span>
                      <span className="text-white font-bold">{soldPct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-lm-terminal-darkgray border border-lm-terminal-gray">
                      <div className={`h-full transition-all ${x.finalized ? "bg-lm-green" : "bg-lm-orange"}`} style={{ width: `${Math.min(100, soldPct)}%` }} />
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-[10px]">
                  <div>
                    <span className="text-lm-terminal-lightgray">Price </span>
                    <span className="text-white lm-mono font-bold">{fmtPrice(x.priceWeiPerToken)}</span>
                  </div>
                  <div>
                    <span className="text-lm-terminal-lightgray">Raised </span>
                    <span className="text-white lm-mono font-bold">{fmtEth(ethRaised)} ETH</span>
                  </div>
                </div>

                {/* Quick Buy */}
                {!x.finalized && x.remaining > 0n && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5 items-end">
                      <div className="flex-1">
                        <Input
                          value={buyAmounts[key] || ""}
                          onValueChange={(v) => setBuyAmounts((p) => ({ ...p, [key]: v }))}
                          placeholder="ETH to spend"
                        />
                      </div>
                      <button type="button" onClick={() => quickBuy(x)} disabled={!address || buyType[key] === "info"}
                        className="text-xs px-3 py-1.5 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap">
                        {buyType[key] === "info" ? "..." : "Buy"}
                      </button>
                    </div>
                    {tokenEstimate && (
                      <div className="text-[10px] text-lm-terminal-lightgray">
                        ≈ <span className="text-white font-bold">{tokenEstimate} ${x.symbol}</span>
                      </div>
                    )}
                    {bStatus && <div className={`text-[10px] ${bColor}`}>{bStatus}</div>}
                  </div>
                )}

                {/* Finalized actions */}
                {x.finalized && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {x.pool && x.pool !== ZERO && (
                      <Link href={`/exchange?in=ETH&out=${x.token}`} className="text-[10px] px-2 py-1 border border-lm-green text-lm-green hover:bg-lm-green/5 transition-colors">Trade</Link>
                    )}
                    {x.stakingVault && x.stakingVault !== ZERO && (
                      <Link href={`/launcher/${x.launch}`} className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors">Stake</Link>
                    )}
                    {x.feeSplitter && x.feeSplitter !== ZERO && (
                      <button type="button" onClick={() => collectFees(x)} disabled={buyType[x.launch + "-fee"] === "info"} className="text-[10px] px-2 py-1 border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange transition-colors disabled:opacity-40 disabled:pointer-events-none">{buyType[x.launch + "-fee"] === "info" ? "..." : "Fees"}</button>
                    )}
                    {feeStatus && <span className={`text-[10px] ${feeColor}`}>{feeStatus}</span>}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-lm-terminal-gray">
                  <a href={explorerAddr(x.launch)} target="_blank" rel="noreferrer" className="text-[10px] text-lm-terminal-lightgray hover:text-lm-orange transition-colors lm-mono">{short(x.launch)}</a>
                  <button type="button" onClick={() => setSelectedLaunch(x)} className="text-[10px] px-2 py-1 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 transition-colors">
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Aggregate Stake/Yield Tab
   ══════════════════════════════════════════════════════ */

type StakeInfo = {
  launchAddr: Address;
  vaultAddr: Address;
  stakeTokenAddr: Address;
  stakeSymbol: string;
  stakeDecimals: number;
  staked: bigint;
  unlockTime: bigint;
  pending0: bigint;
  pending1: bigint;
  rewardToken0Symbol: string;
  rewardToken1Symbol: string;
};

function StakeTab() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const [stakes, setStakes] = useState<StakeInfo[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<Record<string, "info" | "success" | "error">>({});
  const factory = config.launcherFactory as Address;

  async function refresh() {
    if (!address || !factory) { setStakes([]); return; }
    setLoading(true);
    setStatus("");
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;
      const ev = parseAbiItem(
        "event LaunchCreated(address indexed creator,address indexed token,address indexed launch,string name,string symbol,string metadataURI,string imageURI)"
      );
      const logs = await publicClient.getLogs({ address: factory, event: ev, fromBlock, toBlock: latest });
      const seen = new Set<string>();
      const launchAddrs: Address[] = [];
      for (const l of logs) {
        const la = (l.args.launch as Address).toLowerCase();
        if (seen.has(la)) continue;
        seen.add(la);
        launchAddrs.push(l.args.launch as Address);
      }
      const results: StakeInfo[] = [];
      for (const launchAddr of launchAddrs) {
        try {
          const vaultAddr = (await publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "stakingVault" })) as Address;
          if (!vaultAddr || vaultAddr === ZERO) continue;
          const userInfo = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "users", args: [address] })) as any;
          const staked = userInfo.staked as bigint;
          if (staked <= 0n) continue;
          const stakeToken = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "stakeToken" })) as Address;
          let stakeSymbol = "TOKEN", stakeDecimals = 18;
          try { stakeSymbol = (await publicClient.readContract({ address: stakeToken, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /**/ }
          try { stakeDecimals = Number(await publicClient.readContract({ address: stakeToken, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /**/ }
          let pending0 = 0n, pending1 = 0n;
          try {
            const pr = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "pendingRewards", args: [address] })) as any;
            pending0 = pr.pending0 as bigint || pr[0] as bigint || 0n;
            pending1 = pr.pending1 as bigint || pr[1] as bigint || 0n;
          } catch { /**/ }
          let rewardToken0Symbol = "WETH", rewardToken1Symbol = stakeSymbol;
          try {
            const token0Addr = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "rewardToken0" })) as Address;
            const token1Addr = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "rewardToken1" })) as Address;
            try { rewardToken0Symbol = (await publicClient.readContract({ address: token0Addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /**/ }
            try { rewardToken1Symbol = (await publicClient.readContract({ address: token1Addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /**/ }
          } catch { /**/ }
          results.push({ launchAddr, vaultAddr, stakeTokenAddr: stakeToken, stakeSymbol, stakeDecimals, staked, unlockTime: userInfo.unlockTime as bigint, pending0, pending1, rewardToken0Symbol, rewardToken1Symbol });
        } catch { /**/ }
      }
      setStakes(results);
      if (results.length === 0) setStatus("No active stakes found.");
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
    } finally { setLoading(false); }
  }

  async function claimRewards(s: StakeInfo) {
    if (!address || !walletClient) return;
    const key = s.vaultAddr;
    setActionStatus((p) => ({ ...p, [key]: "Claiming..." })); setActionType((p) => ({ ...p, [key]: "info" }));
    try {
      await requireCorrectChain();
      const hash = await walletClient.writeContract({ address: s.vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "claim", args: [], chain: walletClient.chain, account: address });
      setActionStatus((p) => ({ ...p, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash });
      setActionStatus((p) => ({ ...p, [key]: "Claimed!" })); setActionType((p) => ({ ...p, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      setActionStatus((p) => ({ ...p, [key]: String(e?.shortMessage || e?.message || e) })); setActionType((p) => ({ ...p, [key]: "error" }));
    }
  }

  async function unstake(s: StakeInfo) {
    if (!address || !walletClient) return;
    const key = s.vaultAddr;
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (s.unlockTime > now) {
      setActionStatus((p) => ({ ...p, [key]: `Still locked for ~${Math.ceil(Number(s.unlockTime - now) / 3600)} hours` })); setActionType((p) => ({ ...p, [key]: "error" }));
      return;
    }
    setActionStatus((p) => ({ ...p, [key]: "Unstaking..." })); setActionType((p) => ({ ...p, [key]: "info" }));
    try {
      await requireCorrectChain();
      const hash = await walletClient.writeContract({ address: s.vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "unstake", args: [s.staked], chain: walletClient.chain, account: address });
      setActionStatus((p) => ({ ...p, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash });
      setActionStatus((p) => ({ ...p, [key]: "Unstaked!" })); setActionType((p) => ({ ...p, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      setActionStatus((p) => ({ ...p, [key]: String(e?.shortMessage || e?.message || e) })); setActionType((p) => ({ ...p, [key]: "error" }));
    }
  }

  useEffect(() => { refresh().catch(() => {}); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!address) return <div className="text-lm-gray text-sm text-center py-6">Connect wallet to view your stakes.</div>;

  return (
    <div className="space-y-3">
      {stakes.length > 0 && (
        <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2 flex items-center justify-between text-xs">
          <div><span className="text-lm-terminal-lightgray">Active Positions: </span><span className="text-white font-bold">{stakes.length}</span></div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="text-lm-terminal-lightgray text-xs">{loading ? <span className="animate-pulse">Scanning vaults...</span> : <span>{stakes.length} position{stakes.length !== 1 ? "s" : ""}</span>}</div>
        <button type="button" onClick={() => refresh()} disabled={loading} className="text-xs px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors">{loading ? "..." : "Refresh"}</button>
      </div>
      {status && stakes.length === 0 && <div className="text-lm-gray text-sm text-center py-6">{status}</div>}
      {stakes.length > 0 && (
        <div className="space-y-2">
          {stakes.map((s) => {
            const key = s.vaultAddr;
            const now = BigInt(Math.floor(Date.now() / 1000));
            const locked = s.unlockTime > now;
            const hoursLeft = locked ? Math.ceil(Number(s.unlockTime - now) / 3600) : 0;
            const hasPending = s.pending0 > 0n || s.pending1 > 0n;
            const actStatus = actionStatus[key];
            const actTp = actionType[key] || "info";
            const actColor = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";
            return (
              <div key={key} className="bg-lm-black border border-lm-terminal-gray p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">${s.stakeSymbol}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 border ${locked ? "border-lm-red text-lm-red" : "border-lm-green text-lm-green"}`}>{locked ? `LOCKED — ${hoursLeft}h left` : "UNLOCKED"}</span>
                  </div>
                  <Link href={`/launcher/${s.launchAddr}`} className="text-[10px] text-lm-orange hover:underline lm-mono">{short(s.vaultAddr)}</Link>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><div className="text-lm-terminal-lightgray">Staked</div><div className="text-white lm-mono font-bold">{fmtTokens(s.staked, s.stakeDecimals)}</div></div>
                  <div><div className="text-lm-terminal-lightgray">Rewards ({s.rewardToken0Symbol})</div><div className="text-lm-orange lm-mono">{fmtEth(s.pending0)}</div></div>
                  <div><div className="text-lm-terminal-lightgray">Rewards ({s.rewardToken1Symbol})</div><div className="text-lm-orange lm-mono">{fmtEth(s.pending1)}</div></div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {hasPending && <button type="button" onClick={() => claimRewards(s)} className="text-xs px-3 py-1 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 transition-colors">Claim</button>}
                  <button type="button" onClick={() => unstake(s)} disabled={locked} className={`text-xs px-3 py-1 border border-lm-orange text-lm-orange transition-colors ${locked ? "opacity-40" : "hover:bg-lm-orange/5"}`}>Unstake All</button>
                  {actStatus && <span className={`text-[10px] ${actColor}`}>{actStatus}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Bootstrap
   ══════════════════════════════════════════════════════ */

export function LauncherBootstrap({ LauncherPanel }: { LauncherPanel: React.ComponentType }) {
  const tabs = useMemo(
    () => [
      { id: "launches", label: "Launches", hint: "Discover + buy tokens" },
      { id: "create", label: "Create", hint: "Launch a new meme coin" },
      { id: "stake", label: "Stake/Yield", hint: "Your staking positions" }
    ],
    []
  );
  const [active, setActive] = useState("launches");
  const [infoOpen, setInfoOpen] = useState(false);

  const handleIntent = useCallback((intent: IntentAction) => {
    const createTypes = ["launch_token", "finalize_launch"];
    const launchTypes = ["buy_token", "filter_launches", "collect_lp_fees"];
    const stakeTypes = ["stake", "unstake", "claim_rewards"];
    if (createTypes.includes(intent.type)) setActive("create");
    else if (launchTypes.includes(intent.type)) setActive("launches");
    else if (stakeTypes.includes(intent.type)) setActive("stake");
    else if (intent.type === "switch_tab" && ["launches", "create", "stake"].includes(intent.tab)) setActive(intent.tab);
  }, []);

  return (
    <div className="space-y-4">
      <IntentTerminal
        context="launcher"
        onIntent={handleIntent}
        placeholder="launch PEPE PEP 1M · buy 0.01 ETH · stake 1000 · claim rewards · help"
      />
      <Panel
        title="Stonk Launcher"
        hint="Launch meme coins with instant DEX liquidity, fee splitting, and staking rewards."
        right={(
          <div className="flex flex-wrap items-center gap-2">
            <TerminalTabs tabs={tabs} active={active} onChange={setActive} />
            <Button variant="ghost" size="sm" onClick={() => setInfoOpen(true)} aria-label="Launcher information">
              Info
            </Button>
          </div>
        )}
      >
        {active === "launches" ? <LaunchesIndex /> : null}
        {active === "create" ? <LauncherPanel /> : null}
        {active === "stake" ? <StakeTab /> : null}
      </Panel>
      <LauncherInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}
