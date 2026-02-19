"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Address, encodeFunctionData, formatEther, formatUnits, parseAbiItem, parseEther, parseUnits } from "viem";
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
  ERC20MetadataAbi,
  UniswapV3PoolAbi,
  QuoterV2Abi,
  SwapRouterAbi
} from "../../lib/abis";
import { IntentTerminal, IntentAction } from "../../components/IntentTerminal";
import { useEthPrice, fmtUsd as fmtUsdShared, ethToUsd, usdTag } from "../../lib/useEthPrice";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function isTradingLaunch(x: { finalized: boolean; pool?: Address }): boolean {
  return Boolean(x.finalized || (x.pool && x.pool !== ZERO));
}

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

/* ── Mini Swap Modal ── */

function MiniSwapModal({ open, onClose, token, symbol, imageURI }: {
  open: boolean; onClose: () => void;
  token: Address; symbol: string; imageURI?: string;
}) {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const [amountIn, setAmountIn] = useState("");
  const [quoteStr, setQuoteStr] = useState("");
  const [quoteRaw, setQuoteRaw] = useState(0n);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info"|"success"|"error">("info");
  const [ethBal, setEthBal] = useState("");
  const [tokenBal, setTokenBal] = useState("");
  const [tokenDec, setTokenDec] = useState(18);
  const [direction, setDirection] = useState<"buy"|"sell">("buy");
  const [lastTxHash, setLastTxHash] = useState("");
  const quoteTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    if (!open) return;
    setAmountIn(""); setQuoteStr(""); setQuoteRaw(0n); setStatus(""); setLastTxHash(""); setDirection("buy");
  }, [open, token]);

  useEffect(() => {
    if (!open || !token) return;
    (async () => {
      try {
        const dec = await publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "decimals" });
        setTokenDec(Number(dec));
      } catch { setTokenDec(18); }
    })();
  }, [open, token]);

  useEffect(() => {
    if (!open || !address) { setEthBal(""); setTokenBal(""); return; }
    (async () => {
      try { setEthBal(formatUnits(await publicClient.getBalance({ address }), 18)); } catch { setEthBal("?"); }
      try {
        const b = await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "balanceOf", args: [address] }) as bigint;
        setTokenBal(formatUnits(b, tokenDec));
      } catch { setTokenBal("?"); }
    })();
  }, [open, address, token, tokenDec, busy]);

  const FEE = 3000;
  const SLIPPAGE = 100n;

  const refreshQuote = useCallback(async () => {
    if (!config.quoterV2 || !config.weth || !token) return;
    const raw = amountIn.trim();
    if (!raw || raw === "0") { setQuoteRaw(0n); setQuoteStr(""); return; }
    setQuoting(true);
    try {
      const inAddr = direction === "buy" ? config.weth as Address : token;
      const outAddr = direction === "buy" ? token : config.weth as Address;
      const inDec = direction === "buy" ? 18 : tokenDec;
      const outDec = direction === "buy" ? tokenDec : 18;
      const amt = parseUnits(raw, inDec);
      if (amt === 0n) { setQuoteRaw(0n); setQuoteStr(""); return; }

      const feeOrder = [3000, 500, 10000];
      let outAmt: bigint|null = null;
      for (const f of feeOrder) {
        try {
          const res = await publicClient.readContract({
            address: config.quoterV2, abi: QuoterV2Abi, functionName: "quoteExactInputSingle",
            args: [{ tokenIn: inAddr, tokenOut: outAddr, amountIn: amt, fee: f, sqrtPriceLimitX96: 0n }]
          }) as unknown as readonly [bigint, bigint, number, bigint];
          if (res[0] > 0n) { outAmt = res[0]; break; }
        } catch {}
      }
      if (outAmt === null) { setQuoteRaw(0n); setQuoteStr("No liquidity"); return; }
      setQuoteRaw(outAmt);
      setQuoteStr(formatUnits(outAmt, outDec));
    } catch { setQuoteRaw(0n); setQuoteStr(""); }
    finally { setQuoting(false); }
  }, [amountIn, token, tokenDec, direction]);

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => { refreshQuote().catch(() => {}); }, 350);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  }, [refreshQuote]);

  async function doSwap() {
    if (!address || !walletClient || !config.swapRouter || !config.weth) return;
    setBusy(true); setLastTxHash("");
    try {
      const raw = amountIn.trim();
      const inDec = direction === "buy" ? 18 : tokenDec;
      const amt = parseUnits(raw || "0", inDec);
      if (amt === 0n) throw new Error("Enter an amount");

      await requireCorrectChain();
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const mOut = quoteRaw > 0n ? (quoteRaw * (10_000n - SLIPPAGE)) / 10_000n : 0n;

      const inAddr = direction === "buy" ? config.weth as Address : token;
      const outAddr = direction === "buy" ? token : config.weth as Address;
      const isBuy = direction === "buy";

      setStatus(isBuy ? `Swapping ${raw} ETH → $${symbol}...` : `Selling ${raw} $${symbol} → ETH...`);
      setStatusType("info");

      let hash: `0x${string}`;

      if (isBuy) {
        // ETH → Token: send ETH value, receive token to self
        hash = await walletClient.writeContract({
          address: config.swapRouter, abi: SwapRouterAbi, functionName: "exactInputSingle",
          args: [{ tokenIn: inAddr, tokenOut: outAddr, fee: FEE, recipient: address, deadline, amountIn: amt, amountOutMinimum: mOut, sqrtPriceLimitX96: 0n }],
          value: amt, chain: robinhoodTestnet, account: address
        });
      } else {
        // Token → ETH: approve first, then swap, unwrap WETH to ETH
        const allowance = await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "allowance", args: [address, config.swapRouter] }) as bigint;
        if (allowance < amt) {
          setStatus(`Approving $${symbol}...`); setStatusType("info");
          const ah = await walletClient.writeContract({ address: token, abi: ERC20Abi, functionName: "approve", args: [config.swapRouter, amt], chain: robinhoodTestnet, account: address });
          await publicClient.waitForTransactionReceipt({ hash: ah });
        }
        setStatus(`Selling ${raw} $${symbol} → ETH...`); setStatusType("info");
        const swapData = encodeFunctionData({
          abi: SwapRouterAbi, functionName: "exactInputSingle",
          args: [{ tokenIn: inAddr, tokenOut: outAddr, fee: FEE, recipient: config.swapRouter, deadline, amountIn: amt, amountOutMinimum: mOut, sqrtPriceLimitX96: 0n }]
        });
        const unwrapData = encodeFunctionData({ abi: SwapRouterAbi, functionName: "unwrapWETH9", args: [mOut, address] });
        hash = await walletClient.writeContract({
          address: config.swapRouter, abi: SwapRouterAbi, functionName: "multicall",
          args: [[swapData, unwrapData]], value: 0n, chain: robinhoodTestnet, account: address
        });
      }

      setLastTxHash(hash);
      setStatus("Confirming..."); setStatusType("info");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        const outSym = isBuy ? `$${symbol}` : "ETH";
        setStatus(`Swap confirmed! Received ~${quoteStr ? fmtNum(Number(quoteStr)) : "?"} ${outSym}`);
        setStatusType("success");
        setAmountIn(""); setQuoteRaw(0n); setQuoteStr("");
      } else {
        setStatus("Transaction reverted."); setStatusType("error");
      }
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      setStatus(msg.includes("rejected") || msg.includes("denied") ? "Cancelled." : `Failed: ${msg}`);
      setStatusType("error");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  const isBuy = direction === "buy";
  const bal = isBuy ? ethBal : tokenBal;
  const inSym = isBuy ? "ETH" : `$${symbol}`;
  const outSym = isBuy ? `$${symbol}` : "ETH";
  const qDisplay = quoting ? "Quoting..." : quoteStr && quoteStr !== "No liquidity"
    ? `~${fmtNum(Number(quoteStr))} ${outSym}`
    : quoteStr || "—";
  const canSwap = amountIn && Number(amountIn) > 0 && quoteRaw > 0n && !busy;
  const overBal = bal && amountIn && Number(amountIn) > Number(bal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-lm-black border border-lm-orange w-full max-w-[380px] mx-4 shadow-2xl shadow-orange-900/20" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-lm-terminal-gray">
          <div className="flex items-center gap-2">
            {imageURI && !imageURI.endsWith("/logo.png") && (
              <img src={resolveImageURI(imageURI || "")} alt="" className="w-6 h-6 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <div>
              <span className="text-white font-bold text-sm">Swap {symbol.toUpperCase()}</span>
              <span className="text-lm-terminal-lightgray text-[10px] ml-2 lm-mono">{token.slice(0,6)}...{token.slice(-4)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-lm-gray hover:text-white text-lg leading-none px-1">&times;</button>
        </div>

        <div className="p-4 space-y-3">
          {/* Buy / Sell toggle */}
          <div className="flex gap-1">
            <button type="button" onClick={() => { setDirection("buy"); setAmountIn(""); setQuoteRaw(0n); setQuoteStr(""); setStatus(""); }}
              className={`flex-1 py-1.5 text-xs font-bold border transition-colors ${isBuy ? "border-lm-green text-lm-green bg-lm-green/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
              Buy
            </button>
            <button type="button" onClick={() => { setDirection("sell"); setAmountIn(""); setQuoteRaw(0n); setQuoteStr(""); setStatus(""); }}
              className={`flex-1 py-1.5 text-xs font-bold border transition-colors ${!isBuy ? "border-lm-red text-lm-red bg-lm-red/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
              Sell
            </button>
          </div>

          {/* Input */}
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-lm-terminal-lightgray lm-upper font-bold tracking-wider">You Pay</span>
              {bal && <span className="text-lm-terminal-lightgray lm-mono">Bal: <span className="text-white">{fmtNum(Number(bal))}</span></span>}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-white font-bold text-sm min-w-[60px]">{inSym}</div>
              <Input value={amountIn} onValueChange={setAmountIn} placeholder="0.0" className="h-9 text-sm font-bold flex-1" />
              {bal && Number(bal) > 0 && (
                <button type="button" onClick={() => setAmountIn(bal)} className="text-[9px] px-1.5 py-0.5 border border-lm-orange/30 text-lm-orange hover:border-lm-orange font-bold">MAX</button>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-1">
            <div className="w-8 h-8 flex items-center justify-center bg-lm-terminal-darkgray border border-lm-terminal-gray text-lm-terminal-lightgray">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clipRule="evenodd" />
              </svg>
            </div>
          </div>

          {/* Output */}
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-1.5">
            <div className="text-[10px] text-lm-terminal-lightgray lm-upper font-bold tracking-wider">You Receive</div>
            <div className="flex items-center gap-2">
              <div className="text-white font-bold text-sm min-w-[60px]">{outSym}</div>
              <div className={`flex-1 text-right text-sm lm-mono ${quoteRaw > 0n ? "text-white font-bold" : "text-lm-terminal-lightgray"}`}>
                {qDisplay}
              </div>
            </div>
          </div>

          {/* Insufficient balance warning */}
          {overBal && (
            <div className="text-lm-red text-[10px] flex items-center gap-1.5 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-lm-red flex-shrink-0" />
              Insufficient {inSym} balance
            </div>
          )}

          {/* Swap button */}
          <Button
            onClick={doSwap}
            loading={busy}
            disabled={!canSwap || !!overBal || !address}
            variant={canSwap && !overBal ? "primary" : "default"}
            size="lg"
            className={`w-full ${canSwap && !overBal ? (isBuy ? "bg-lm-green text-black hover:bg-lm-green/80" : "bg-lm-red text-white hover:bg-lm-red/80") : ""}`}
          >
            {busy ? "Processing..." : !address ? "Connect Wallet" : !amountIn || Number(amountIn) <= 0 ? "Enter Amount" : overBal ? `Insufficient ${inSym}` : quoteStr === "No liquidity" ? "No Liquidity" : isBuy ? `Buy ${symbol.toUpperCase()}` : `Sell ${symbol.toUpperCase()}`}
          </Button>

          {/* Status */}
          {status && (
            <div className={`text-[10px] p-2 border ${statusType === "success" ? "text-lm-green border-lm-green/20" : statusType === "error" ? "text-lm-red border-lm-red/20" : "text-lm-gray border-lm-terminal-gray"} flex items-center gap-2`}>
              {statusType === "info" && <span className="lm-spinner flex-shrink-0" style={{ width: 10, height: 10, borderWidth: 1.5 }} />}
              {statusType === "success" && <span className="w-1.5 h-1.5 rounded-full bg-lm-green flex-shrink-0" />}
              {statusType === "error" && <span className="w-1.5 h-1.5 rounded-full bg-lm-red flex-shrink-0" />}
              <span className="truncate">{status}</span>
              {lastTxHash && (
                <a href={`${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/tx/${lastTxHash}`}
                  target="_blank" rel="noreferrer" className="text-lm-orange hover:underline ml-auto flex-shrink-0">Tx →</a>
              )}
            </div>
          )}

          {/* Quick info */}
          <div className="text-[9px] text-lm-terminal-lightgray text-center">
            0.3% fee tier · 1% max slippage · {isBuy ? "Auto-wraps ETH" : "Auto-unwraps to ETH"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Human-friendly formatters ── */

function short(a: string) { return a.slice(0, 6) + "..." + a.slice(-4); }

function resolveImageURI(uri: string): string {
  if (!uri) return uri;
  const match = uri.match(/^https?:\/\/(?:www\.)?stonkbrokers\.cash(\/tokens\/.+)$/);
  if (match) return match[1];
  return uri;
}

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

function fmtSmall(num: number): string {
  if (num <= 0 || !Number.isFinite(num)) return "0";
  if (num >= 0.01) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(6);
  const s = num.toFixed(20);
  const match = s.match(/^0\.(0+)(\d{2,4})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2].replace(/0+$/, "") || match[2].slice(0, 2);
    const sub = String(zeros).split("").map(d => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]).join("");
    return `0.0${sub}${sig}`;
  }
  return num.toFixed(8);
}

function fmtNum(num: number): string {
  if (num === 0 || !Number.isFinite(num)) return "0";
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  return fmtSmall(num);
}

function fmtTokens(wei: bigint, decimals = 18): string {
  const raw = formatUnits(wei, decimals);
  const num = Number(raw);
  if (num === 0) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return fmtSmall(num);
}

function fmtEth(wei: bigint): string {
  if (wei === 0n) return "0";
  const num = Number(formatUnits(wei, 18));
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.01) return num.toFixed(4);
  if (num >= 0.001) return num.toFixed(6);
  return fmtSmall(num);
}

function fmtSupply(wei: bigint, decimals = 18): string {
  const num = Number(formatUnits(wei, decimals));
  if (num === 0) return "0";
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtUsd(usd: number): string {
  return fmtUsdShared(usd);
}

function fmtEthShort(num: number): string {
  if (!num || !Number.isFinite(num) || num <= 0) return "—";
  if (num >= 1) return `${num.toFixed(4)} ETH`;
  if (num >= 0.001) return `${num.toFixed(6)} ETH`;
  return `${fmtSmall(num)} ETH`;
}

function fmtPrice(weiPerToken: bigint, ethUsd: number): string {
  if (weiPerToken === 0n) return "—";
  const ethVal = Number(formatEther(weiPerToken));
  return fmtUsd(ethVal * ethUsd);
}

function fmtPriceEth(weiPerToken: bigint): string {
  if (weiPerToken === 0n) return "—";
  return fmtEthShort(Number(formatEther(weiPerToken)));
}

function displayPrice(x: { marketPriceEth?: number; priceWeiPerToken: bigint; finalized: boolean; pool?: Address }, ethUsd: number): { label: string; usd: string; eth: string } {
  const trading = Boolean(x.finalized || (x.pool && x.pool !== ZERO));
  if (trading && x.marketPriceEth && x.marketPriceEth > 0) {
    return { label: "Price", usd: fmtUsd(x.marketPriceEth * ethUsd), eth: fmtEthShort(x.marketPriceEth) };
  }
  if (x.priceWeiPerToken > 0n) {
    const ethVal = Number(formatEther(x.priceWeiPerToken));
    return { label: trading ? "Sale" : "Price", usd: fmtUsd(ethVal * ethUsd), eth: fmtEthShort(ethVal) };
  }
  return { label: "Price", usd: "—", eth: "—" };
}

function mcapStr(x: { marketPriceEth?: number; priceWeiPerToken: bigint; saleSupply: bigint; finalized: boolean; pool?: Address }, ethUsd: number): string {
  const trading = Boolean(x.finalized || (x.pool && x.pool !== ZERO));
  let priceEth = 0;
  if (trading && x.marketPriceEth && x.marketPriceEth > 0) {
    priceEth = x.marketPriceEth;
  } else if (x.priceWeiPerToken > 0n) {
    priceEth = Number(formatEther(x.priceWeiPerToken));
  }
  if (priceEth <= 0 || x.saleSupply <= 0n) return "—";
  const supply = Number(formatUnits(x.saleSupply, 18));
  const fdvUsd = priceEth * ethUsd * supply;
  return fmtUsd(fdvUsd);
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

/* ── Derived sale metrics ── */
function salePct(x: { sold: bigint; saleSupply: bigint; remaining: bigint }): number {
  if (x.saleSupply === 0n) return 0;
  const effectiveSold = x.sold > 0n ? x.sold : (x.remaining < x.saleSupply ? x.saleSupply - x.remaining : 0n);
  if (effectiveSold === 0n) return 0;
  return Number((effectiveSold * 10000n) / x.saleSupply) / 100;
}

function effectiveSold(x: { sold: bigint; saleSupply: bigint; remaining: bigint }): bigint {
  if (x.sold > 0n) return x.sold;
  if (x.saleSupply > 0n && x.remaining < x.saleSupply) return x.saleSupply - x.remaining;
  return 0n;
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
  blockNumber?: bigint;
  blockTimestamp?: number;
  marketPriceEth?: number;
};

type LaunchCacheEntryV1 = {
  v: 1;
  launch: Address;
  creator: Address;
  token: Address;
  symbol: string;
  name: string;
  imageURI: string;
  finalized?: boolean;
  pool?: Address;
  feeSplitter?: Address;
  stakingVault?: Address;
  sold?: string;
  saleSupply?: string;
  priceWeiPerToken?: string;
  remaining?: string;
  blockNumber?: string;
  blockTimestamp?: number;
  lastUpdatedAt?: number;
  marketPriceEth?: number;
};

function cacheKeyForLaunches(factory: Address): string {
  return `stonk.launches.v1.${config.chainId}.${factory.toLowerCase()}`;
}

function indexStateKey(factory: Address): string {
  return `stonk.launches.indexState.v1.${config.chainId}.${factory.toLowerCase()}`;
}

function loadIndexedToBlock(factory: Address): bigint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(indexStateKey(factory));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const bn = safeParseBigInt(parsed?.indexedToBlock);
    return bn ?? null;
  } catch {
    return null;
  }
}

function saveIndexedToBlock(factory: Address, indexedToBlock: bigint) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(indexStateKey(factory), JSON.stringify({ v: 1, indexedToBlock: indexedToBlock.toString() }));
  } catch {
    // best-effort
  }
}

function safeParseBigInt(v: unknown): bigint | undefined {
  if (typeof v !== "string" || !/^\d+$/.test(v)) return undefined;
  try { return BigInt(v); } catch { return undefined; }
}

function loadLaunchCache(factory: Address): LaunchData[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(cacheKeyForLaunches(factory));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const out: LaunchData[] = [];
    for (const e of parsed) {
      const x = e as Partial<LaunchCacheEntryV1>;
      if (x.v !== 1) continue;
      if (!x.launch || !x.creator || !x.token) continue;
      // Basic sanity on addresses; if these look wrong, ignore the entry.
      if (!/^0x[0-9a-fA-F]{40}$/.test(String(x.launch))) continue;
      if (!/^0x[0-9a-fA-F]{40}$/.test(String(x.creator))) continue;
      if (!/^0x[0-9a-fA-F]{40}$/.test(String(x.token))) continue;

      out.push({
        launch: x.launch,
        creator: x.creator,
        token: x.token,
        symbol: x.symbol || "TOKEN",
        name: x.name || "LAUNCH",
        imageURI: x.imageURI || "",
        finalized: Boolean(x.finalized),
        pool: x.pool,
        feeSplitter: x.feeSplitter,
        stakingVault: x.stakingVault,
        sold: safeParseBigInt(x.sold) ?? 0n,
        saleSupply: safeParseBigInt(x.saleSupply) ?? 0n,
        priceWeiPerToken: safeParseBigInt(x.priceWeiPerToken) ?? 0n,
        remaining: safeParseBigInt(x.remaining) ?? 0n,
        blockNumber: safeParseBigInt(x.blockNumber),
        blockTimestamp: typeof x.blockTimestamp === "number" ? x.blockTimestamp : undefined,
        marketPriceEth: typeof x.marketPriceEth === "number" && x.marketPriceEth > 0 ? x.marketPriceEth : undefined
      });
    }

    // Keep newest first.
    out.sort((a, b) => {
      const at = a.blockTimestamp ?? 0;
      const bt = b.blockTimestamp ?? 0;
      if (bt !== at) return bt - at;
      const abn = a.blockNumber ?? 0n;
      const bbn = b.blockNumber ?? 0n;
      return bbn > abn ? 1 : bbn < abn ? -1 : 0;
    });
    return out;
  } catch {
    return [];
  }
}

function saveLaunchCache(factory: Address, launches: LaunchData[]) {
  if (typeof window === "undefined") return;
  try {
    const entries: LaunchCacheEntryV1[] = launches.map((x) => ({
      v: 1,
      launch: x.launch,
      creator: x.creator,
      token: x.token,
      symbol: x.symbol,
      name: x.name,
      imageURI: x.imageURI,
      finalized: x.finalized,
      pool: x.pool,
      feeSplitter: x.feeSplitter,
      stakingVault: x.stakingVault,
      sold: x.sold.toString(),
      saleSupply: x.saleSupply.toString(),
      priceWeiPerToken: x.priceWeiPerToken.toString(),
      remaining: x.remaining.toString(),
      blockNumber: x.blockNumber?.toString(),
      blockTimestamp: x.blockTimestamp,
      lastUpdatedAt: Date.now(),
      marketPriceEth: x.marketPriceEth
    }));
    window.localStorage.setItem(cacheKeyForLaunches(factory), JSON.stringify(entries));
  } catch {
    // Ignore quota/serialization errors; caching is a best-effort UX enhancement.
  }
}

/* ══════════════════════════════════════════════════════
   Featured Carousel
   ══════════════════════════════════════════════════════ */

function FeaturedCarousel({
  launches,
  onSelect,
  onTrade,
  ethUsd
}: {
  launches: LaunchData[];
  onSelect: (x: LaunchData) => void;
  onTrade: (token: Address, symbol: string, imageURI?: string) => void;
  ethUsd: number;
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
          const pct = salePct(x);
          const sold = effectiveSold(x);
          const soldOut = x.remaining === 0n && x.saleSupply > 0n;
          const ethRaised = x.priceWeiPerToken > 0n && sold > 0n ? (sold * x.priceWeiPerToken) / (10n ** 18n) : 0n;
          const grad = symbolColor(x.symbol);
          const trading = isTradingLaunch(x);
          const hasSaleActivity = pct > 0;
          const hasCustomImage = Boolean(x.imageURI && (x.imageURI.startsWith("http") || x.imageURI.startsWith("/")) && !x.imageURI.endsWith("/logo.png"));
          const dp = displayPrice(x, ethUsd);

          return (
            <div
              key={x.launch}
              onClick={() => onSelect(x)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(x);
              }}
              role="button"
              tabIndex={0}
              className="snap-start flex-shrink-0 w-[280px] sm:w-[320px] bg-lm-black border border-lm-terminal-gray hover:border-lm-orange transition-all group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-lm-orange/40"
            >
              {/* Gradient banner */}
              <div className={`h-20 bg-gradient-to-br ${grad} relative overflow-hidden`}>
                {hasCustomImage && (
                  <img
                    src={resolveImageURI(x.imageURI)}
                    alt={x.symbol}
                    className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-2">
                  <div className="w-9 h-9 bg-black/50 border border-white/20 flex items-center justify-center text-white font-bold text-sm backdrop-blur-sm overflow-hidden">
                    {hasCustomImage ? (
                      <img src={resolveImageURI(x.imageURI)} alt={x.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).replaceWith(document.createTextNode(x.symbol.slice(0,2).toUpperCase())); }} />
                    ) : x.symbol.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-bold text-sm leading-tight truncate max-w-[140px]">${x.symbol}</div>
                    <div className="text-white/70 text-[10px] leading-tight truncate max-w-[140px]">{x.name}</div>
                  </div>
                </div>
                {trading && x.token && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTrade(x.token, x.symbol, x.imageURI); }}
                    className="absolute bottom-2 right-2 text-[9px] px-2 py-1 border border-lm-green text-lm-green bg-black/40 hover:bg-lm-green/10 transition-colors font-bold"
                  >
                    Trade
                  </button>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`text-[9px] px-1.5 py-0.5 font-bold ${
                    trading
                      ? "bg-lm-green/20 text-lm-green border border-lm-green/40"
                      : soldOut
                        ? "bg-white/10 text-white/60 border border-white/20"
                        : "bg-lm-orange/20 text-lm-orange border border-lm-orange/40"
                  }`}>
                    {trading ? "TRADING" : soldOut ? "SOLD OUT" : "SALE OPEN"}
                  </span>
                </div>
              </div>

              {/* Card body */}
              <div className="p-3 space-y-2">
                {hasSaleActivity && x.saleSupply > 0n && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-lm-terminal-lightgray">Sale {fmtSupply(sold)} / {fmtSupply(x.saleSupply)}</span>
                      <span className="text-white font-bold">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1 bg-lm-terminal-darkgray">
                      <div
                        className={`h-full transition-all ${trading ? "bg-lm-green" : "bg-lm-orange"}`}
                        style={{ width: `${Math.min(100, Math.max(pct > 0 ? 1 : 0, pct))}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center justify-between text-[10px]">
                  <div title={dp.eth}>
                    <span className="text-lm-terminal-lightgray">{dp.label} </span>
                    <span className={`lm-mono font-bold ${trading && x.marketPriceEth ? "text-lm-green" : "text-white"}`}>{dp.usd}</span>
                  </div>
                  {(() => { const mcap = mcapStr(x, ethUsd); return mcap !== "—" ? (
                    <div title={dp.eth}>
                      <span className="text-lm-terminal-lightgray">Mcap </span>
                      <span className="text-white lm-mono font-bold">{mcap}</span>
                    </div>
                  ) : ethRaised > 0n ? (
                    <div title={`${fmtEth(ethRaised)} ETH`}>
                      <span className="text-lm-terminal-lightgray">Raised </span>
                      <span className="text-white lm-mono font-bold">{fmtUsd(Number(formatUnits(ethRaised, 18)) * ethUsd)}</span>
                    </div>
                  ) : x.saleSupply > 0n ? (
                    <div>
                      <span className="text-lm-terminal-lightgray">Supply </span>
                      <span className="text-white lm-mono font-bold">{fmtSupply(x.saleSupply)}</span>
                    </div>
                  ) : null; })()}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] pt-1 border-t border-lm-terminal-gray">
                  <span className="text-lm-terminal-lightgray">{x.blockTimestamp ? timeAgo(x.blockTimestamp) : ""}</span>
                  <span className="text-lm-orange group-hover:underline font-bold">View Details →</span>
                </div>
              </div>
            </div>
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
  onBuy,
  onTrade,
  ethUsd
}: {
  x: LaunchData;
  onClose: () => void;
  onBuy: (x: LaunchData, ethAmount: string) => void;
  onTrade?: (token: Address, symbol: string, imageURI?: string) => void;
  ethUsd: number;
}) {
  const [buyAmt, setBuyAmt] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const trading = isTradingLaunch(x);
  const pct = salePct(x);
  const sold = effectiveSold(x);
  const soldOut = x.remaining === 0n && x.saleSupply > 0n;
  const ethRaised = x.priceWeiPerToken > 0n && sold > 0n ? (sold * x.priceWeiPerToken) / (10n ** 18n) : 0n;
  const showBar = x.saleSupply > 0n && (pct > 0 || !trading);
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
          {x.imageURI && (x.imageURI.startsWith("http") || x.imageURI.startsWith("/")) && !x.imageURI.endsWith("/logo.png") && (
            <img
              src={resolveImageURI(x.imageURI)}
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
            <div className="w-12 h-12 bg-black/50 border border-white/20 flex items-center justify-center text-white font-bold text-lg backdrop-blur-sm overflow-hidden">
              {x.imageURI && (x.imageURI.startsWith("http") || x.imageURI.startsWith("/")) && !x.imageURI.endsWith("/logo.png") ? (
                <img src={resolveImageURI(x.imageURI)} alt={x.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).replaceWith(document.createTextNode(x.symbol.slice(0,2).toUpperCase())); }} />
              ) : x.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-white font-bold text-lg leading-tight truncate max-w-[200px]">${x.symbol}</div>
              <div className="text-white/70 text-xs leading-tight truncate max-w-[200px]">{x.name}</div>
            </div>
          </div>
          <div className="absolute bottom-3 right-4">
            <span className={`text-[10px] px-2 py-1 font-bold ${
              trading
                ? "bg-lm-green/20 text-lm-green border border-lm-green/40"
                : soldOut
                  ? "bg-white/10 text-white/60 border border-white/20"
                  : "bg-lm-orange/20 text-lm-orange border border-lm-orange/40"
            }`}>
              {trading ? "TRADING LIVE" : soldOut ? "SOLD OUT" : "SALE OPEN"}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Sale Progress */}
          {showBar && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-lm-terminal-lightgray">Sale Progress</span>
                <span className="text-white font-bold">{pct.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-lm-terminal-darkgray border border-lm-terminal-gray">
                <div
                  className={`h-full transition-all ${trading ? "bg-lm-green" : "bg-lm-orange"}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-lm-terminal-lightgray">
                <span><span className="text-white lm-mono">{fmtTokens(sold)}</span> sold</span>
                <span><span className="text-white lm-mono">{fmtTokens(x.remaining)}</span> remaining</span>
              </div>
            </div>
          )}

          {/* Stats */}
          {(() => { const dp = displayPrice(x, ethUsd); const mcap = mcapStr(x, ethUsd); const ethRaisedUsd = Number(formatUnits(ethRaised, 18)) * ethUsd; return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2" title={dp.eth}>
              <div className="text-lm-terminal-lightgray text-[10px]">{dp.label}</div>
              <div className={`lm-mono font-bold ${trading && x.marketPriceEth ? "text-lm-green" : "text-white"}`}>{dp.usd}</div>
              <div className="text-lm-terminal-lightgray text-[9px] lm-mono mt-0.5">{dp.eth}</div>
            </div>
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
              <div className="text-lm-terminal-lightgray text-[10px]">Market Cap</div>
              <div className="text-white lm-mono font-bold">{mcap}</div>
            </div>
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2" title={ethRaised > 0n ? `${fmtEth(ethRaised)} ETH` : ""}>
              <div className="text-lm-terminal-lightgray text-[10px]">{ethRaised > 0n ? "Total Raised" : "Sale Supply"}</div>
              <div className="text-white lm-mono font-bold">{ethRaised > 0n ? fmtUsd(ethRaisedUsd) : fmtSupply(x.saleSupply)}</div>
              {ethRaised > 0n && <div className="text-lm-terminal-lightgray text-[9px] lm-mono mt-0.5">{fmtEth(ethRaised)} ETH</div>}
            </div>
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
              <div className="text-lm-terminal-lightgray text-[10px]">{ethRaised > 0n ? "Supply" : "Remaining"}</div>
              <div className="text-white lm-mono font-bold">{ethRaised > 0n ? fmtSupply(x.saleSupply) : fmtSupply(x.remaining)}</div>
            </div>
          </div>
          ); })()}

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
          {!trading && x.remaining > 0n && (
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
            {trading && x.pool && x.pool !== ZERO && (
              <button type="button" onClick={() => { onClose(); onTrade?.(x.token, x.symbol, x.imageURI); }}
                className="text-xs px-3 py-1.5 border border-lm-green text-lm-green hover:bg-lm-green/5 transition-colors">
                Trade
              </button>
            )}
            {trading && x.stakingVault && x.stakingVault !== ZERO && (
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

function LaunchesIndex({ ethUsd }: { ethUsd: number }) {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const [launches, setLaunches] = useState<LaunchData[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "finalized">("all");
  const [buyStatus, setBuyStatus] = useState<Record<string, string>>({});
  const [buyType, setBuyType] = useState<Record<string, "info" | "success" | "error">>({});
  const [buyAmounts, setBuyAmounts] = useState<Record<string, string>>({});
  const [selectedLaunch, setSelectedLaunch] = useState<LaunchData | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ token: Address; symbol: string; imageURI?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "mcap" | "price" | "sale">("newest");
  const [visibleCount, setVisibleCount] = useState(12);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const factory = config.launcherFactory as Address;
  const cacheHydratedRef = useRef(false);
  const lastFactoryRef = useRef<Address | null>(null);
  const launchesRef = useRef<LaunchData[]>([]);
  const indexedToBlockRef = useRef<bigint | null>(null);

  useEffect(() => {
    launchesRef.current = launches;
  }, [launches]);

  useEffect(() => {
    if (!factory) return;
    if (lastFactoryRef.current && lastFactoryRef.current.toLowerCase() !== factory.toLowerCase()) {
      cacheHydratedRef.current = false;
      indexedToBlockRef.current = null;
    }
    lastFactoryRef.current = factory;
    // Hydrate once per factory so launches don't "disappear" across reloads.
    if (cacheHydratedRef.current) return;
    const cached = loadLaunchCache(factory);
    if (cached.length > 0) setLaunches(cached);
    indexedToBlockRef.current = loadIndexedToBlock(factory);
    cacheHydratedRef.current = true;
  }, [factory]);

  async function enrichOne(prev: LaunchData): Promise<LaunchData> {
    const out = { ...prev };

    const read = async <T,>(fn: string, fallback: T): Promise<T> => {
      try {
        return (await publicClient.readContract({ address: prev.launch, abi: StonkLaunchAbi, functionName: fn as any })) as T;
      } catch { return fallback; }
    };

    const [sold, saleSupply, priceWeiPerToken, remaining, pool, feeSplitter, stakingVault] = await Promise.all([
      read<bigint>("sold", prev.sold),
      read<bigint>("saleSupply", prev.saleSupply),
      read<bigint>("priceWeiPerToken", prev.priceWeiPerToken),
      read<bigint>("remainingForSale", prev.remaining),
      read<Address>("pool", prev.pool ?? ZERO),
      read<Address>("feeSplitter", prev.feeSplitter ?? ZERO),
      read<Address>("stakingVault", prev.stakingVault ?? ZERO),
    ]);

    out.sold = sold;
    out.saleSupply = saleSupply;
    out.priceWeiPerToken = priceWeiPerToken;
    out.remaining = remaining;
    out.pool = pool;
    out.feeSplitter = feeSplitter;
    out.stakingVault = stakingVault;

    // Derive sold from saleSupply - remaining when the stored `sold` looks stale.
    if (out.sold === 0n && out.saleSupply > 0n && out.remaining < out.saleSupply) {
      out.sold = out.saleSupply - out.remaining;
    }

    let finalized = prev.finalized;
    try {
      const rec = (await publicClient.readContract({
        address: factory,
        abi: StonkLauncherFactoryAbi,
        functionName: "launches",
        args: [prev.launch]
      })) as any;
      finalized = Boolean(rec?.finalized) || finalized;
    } catch {
      // Factory mapping read is best-effort; pool != 0 is enough to treat it as live.
    }

    const trading = Boolean(out.pool && out.pool !== ZERO);
    out.finalized = finalized || trading;

    if (trading && out.pool && out.pool !== ZERO) {
      try {
        const poolToken0Abi = [{ type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const;
        const [slot0Result, poolToken0] = await Promise.all([
          publicClient.readContract({ address: out.pool, abi: UniswapV3PoolAbi, functionName: "slot0" }),
          publicClient.readContract({ address: out.pool, abi: poolToken0Abi, functionName: "token0" })
        ]);
        const tick = Number((slot0Result as any).tick ?? (slot0Result as any)[1]);
        const rawPrice = Math.pow(1.0001, tick);
        const isToken0 = (poolToken0 as Address).toLowerCase() === out.token.toLowerCase();
        out.marketPriceEth = isToken0 ? rawPrice : 1 / rawPrice;
      } catch { /* pool price best-effort */ }
    }

    return out;
  }

  async function refresh(opts?: { silent?: boolean; fullReindex?: boolean }) {
    if (!factory) { setStatus("Missing launcher factory address."); setLaunches([]); return; }
    if (!opts?.silent) setLoading(true);
    if (!opts?.silent) setStatus("");
    try {
      const latest = await publicClient.getBlockNumber();
      const configuredStart = BigInt(Math.max(0, Number(config.launcherFactoryStartBlock || 0)));
      const startBlock = configuredStart;

      // Index strategy:
      // - Full reindex: scan from factory deployment (or 0) to latest.
      // - Incremental: scan from last indexed block + 1 to latest.
      const indexedTo = indexedToBlockRef.current ?? loadIndexedToBlock(factory);
      const fromBlock = opts?.fullReindex
        ? startBlock
        : (indexedTo !== null ? indexedTo + 1n : startBlock);

      const ev = parseAbiItem(
        "event LaunchCreated(address indexed creator,address indexed token,address indexed launch,string name,string symbol,string metadataURI,string imageURI)"
      );
      const CHUNK = 80_000n;
      const allLogs: any[] = [];
      if (fromBlock <= latest) {
        for (let s = fromBlock; s <= latest; s += CHUNK) {
          const e = (s + CHUNK - 1n) > latest ? latest : (s + CHUNK - 1n);
          // eslint-disable-next-line no-await-in-loop
          const chunkLogs = await publicClient.getLogs({ address: factory, event: ev, fromBlock: s, toBlock: e });
          allLogs.push(...chunkLogs);
        }
      }
      const newestFirst = [...allLogs].reverse();

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
      }

      const blockNums = [...new Set(raw.map((r) => r.blockNumber))];
      const blockMap = new Map<bigint, number>();
      await Promise.all(blockNums.map(async (bn) => {
        try {
          const b = await publicClient.getBlock({ blockNumber: bn });
          blockMap.set(bn, Number(b.timestamp));
        } catch { /* skip */ }
      }));

      const baseFromLogs: LaunchData[] = raw.map((x) => ({
        ...x,
        finalized: false,
        sold: 0n,
        saleSupply: 0n,
        priceWeiPerToken: 0n,
        remaining: 0n,
        blockTimestamp: blockMap.get(x.blockNumber)
      }));

      // Merge into existing set (so older launches never get dropped).
      const mergedMap = new Map<string, LaunchData>();
      for (const cur of launchesRef.current) mergedMap.set(cur.launch.toLowerCase(), cur);
      for (const b of baseFromLogs) {
        const k = b.launch.toLowerCase();
        const cur = mergedMap.get(k);
        if (cur) {
          mergedMap.set(k, {
            ...cur,
            creator: b.creator,
            token: b.token,
            symbol: b.symbol || cur.symbol,
            name: b.name || cur.name,
            imageURI: b.imageURI || cur.imageURI,
            blockNumber: b.blockNumber ?? cur.blockNumber,
            blockTimestamp: b.blockTimestamp ?? cur.blockTimestamp
          });
        } else {
          mergedMap.set(k, b);
        }
      }

      let merged = Array.from(mergedMap.values());
      merged.sort((a, b) => {
        const at = a.blockTimestamp ?? 0;
        const bt = b.blockTimestamp ?? 0;
        if (bt !== at) return bt - at;
        const abn = a.blockNumber ?? 0n;
        const bbn = b.blockNumber ?? 0n;
        return bbn > abn ? 1 : bbn < abn ? -1 : 0;
      });

      // Enrich a bounded subset to keep RPC load predictable.
      // Priority order: new from logs → stale data (sold=0 with saleSupply>0) → non-trading → recent trading
      const enrichSet = new Set<string>();
      for (const b of baseFromLogs) enrichSet.add(b.launch.toLowerCase());
      for (const x of merged) {
        if (enrichSet.size >= 80) break;
        if (x.sold === 0n && x.saleSupply === 0n) enrichSet.add(x.launch.toLowerCase());
      }
      for (const x of merged) {
        if (enrichSet.size >= 80) break;
        if (!isTradingLaunch(x)) enrichSet.add(x.launch.toLowerCase());
      }
      for (const x of merged) {
        if (enrichSet.size >= 80) break;
        enrichSet.add(x.launch.toLowerCase());
      }
      const enrichTargets = merged.filter((x) => enrichSet.has(x.launch.toLowerCase()));
      const enrichedTargets = await Promise.all(enrichTargets.map(enrichOne));
      const enrichedMap = new Map(enrichedTargets.map((x) => [x.launch.toLowerCase(), x]));
      merged = merged.map((x) => enrichedMap.get(x.launch.toLowerCase()) || x);

      setLaunches(merged);
      // Keep the modal in sync if it's open.
      if (selectedLaunch) {
        const updated = merged.find((l) => l.launch.toLowerCase() === selectedLaunch.launch.toLowerCase());
        if (updated) setSelectedLaunch(updated);
      }
      saveLaunchCache(factory, merged);
      indexedToBlockRef.current = latest;
      saveIndexedToBlock(factory, latest);
      if (merged.length === 0) setStatus("No launches found yet.");
    } catch (e: any) {
      // Preserve whatever we already have (cache / prior fetch) so the UI doesn't go blank.
      if (!opts?.silent) setStatus(String(e?.shortMessage || e?.message || e));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  useEffect(() => { refresh({ fullReindex: true }).catch(() => {}); }, [factory]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!factory) return;
    // Keep launches fresh without requiring manual refresh.
    const iv = setInterval(() => { refresh({ silent: true }).catch(() => {}); }, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factory]);

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

  /* Deduplicate launches sharing the same token address OR the same symbol
     (case-insensitive) — keep the one with the most activity. */
  const deduped = useMemo(() => {
    function score(l: LaunchData): number {
      let s = 0;
      if (isTradingLaunch(l)) s += 1000;
      if (l.sold > 0n || (l.saleSupply > 0n && l.remaining < l.saleSupply)) s += 100;
      s += (l.blockTimestamp ?? 0) / 1e6;
      return s;
    }

    const byToken = new Map<string, LaunchData>();
    const bySymbol = new Map<string, LaunchData>();
    for (const l of launches) {
      const tk = l.token.toLowerCase();
      const sym = l.symbol.toLowerCase();
      const existToken = byToken.get(tk);
      const existSymbol = bySymbol.get(sym);
      const existing = existToken || existSymbol;
      if (!existing) {
        byToken.set(tk, l);
        bySymbol.set(sym, l);
        continue;
      }
      if (score(l) > score(existing)) {
        if (existToken) byToken.set(tk, l);
        if (existSymbol) bySymbol.set(sym, l);
        if (!existToken) byToken.set(tk, l);
        if (!existSymbol) bySymbol.set(sym, l);
      }
    }
    const seen = new Set<string>();
    const result: LaunchData[] = [];
    for (const l of bySymbol.values()) {
      const k = l.launch.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      result.push(l);
    }
    result.sort((a, b) => (b.blockTimestamp ?? 0) - (a.blockTimestamp ?? 0));
    return result;
  }, [launches]);

  const filtered = useMemo(() => {
    if (filter === "open") return deduped.filter((l) => !isTradingLaunch(l));
    if (filter === "finalized") return deduped.filter((l) => isTradingLaunch(l));
    return deduped;
  }, [deduped, filter]);

  const searched = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((l) =>
      l.symbol.toLowerCase().includes(q) ||
      l.name.toLowerCase().includes(q) ||
      l.token.toLowerCase().includes(q)
    );
  }, [filtered, searchQuery]);

  function getMcapNum(x: LaunchData): number {
    let priceEth = 0;
    const trading = isTradingLaunch(x);
    if (trading && x.marketPriceEth && x.marketPriceEth > 0) priceEth = x.marketPriceEth;
    else if (x.priceWeiPerToken > 0n) priceEth = Number(formatEther(x.priceWeiPerToken));
    if (priceEth <= 0 || x.saleSupply <= 0n) return 0;
    return priceEth * ethUsd * Number(formatUnits(x.saleSupply, 18));
  }

  function getPriceNum(x: LaunchData): number {
    const trading = isTradingLaunch(x);
    if (trading && x.marketPriceEth && x.marketPriceEth > 0) return x.marketPriceEth * ethUsd;
    if (x.priceWeiPerToken > 0n) return Number(formatEther(x.priceWeiPerToken)) * ethUsd;
    return 0;
  }

  const sorted = useMemo(() => {
    const arr = [...searched];
    switch (sortBy) {
      case "mcap": arr.sort((a, b) => getMcapNum(b) - getMcapNum(a)); break;
      case "price": arr.sort((a, b) => getPriceNum(b) - getPriceNum(a)); break;
      case "sale": arr.sort((a, b) => salePct(b) - salePct(a)); break;
      default: break;
    }
    return arr;
  }, [searched, sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);
  const hasMore = visibleCount < sorted.length;

  useEffect(() => { setVisibleCount(12); }, [filter, searchQuery, sortBy]);

  function copyAddress(addr: string) {
    navigator.clipboard.writeText(addr).catch(() => {});
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr((c) => c === addr ? null : c), 1500);
  }

  const liveCount = deduped.filter((l) => isTradingLaunch(l)).length;
  const openCount = deduped.filter((l) => !isTradingLaunch(l)).length;

  return (
    <div className="space-y-4">
      {/* ── Featured Carousel ── */}
      {(() => {
        const featured = deduped
          .filter((l) => isTradingLaunch(l) || (l.saleSupply > 0n && l.remaining > 0n))
          .slice(0, 8);
        return featured.length > 0 ? (
          <FeaturedCarousel launches={featured} onSelect={setSelectedLaunch} onTrade={(token, symbol, imageURI) => setSwapTarget({ token, symbol, imageURI })} ethUsd={ethUsd} />
        ) : null;
      })()}

      {/* ── Modals ── */}
      {selectedLaunch && (
        <LaunchDetailModal
          x={selectedLaunch}
          onClose={() => setSelectedLaunch(null)}
          onBuy={(x, amt) => quickBuy(x, amt)}
          onTrade={(token, symbol, imageURI) => setSwapTarget({ token, symbol, imageURI })}
          ethUsd={ethUsd}
        />
      )}
      {swapTarget && (
        <MiniSwapModal open onClose={() => setSwapTarget(null)} token={swapTarget.token} symbol={swapTarget.symbol} imageURI={swapTarget.imageURI} />
      )}

      {/* ── Stats Banner ── */}
      {deduped.length > 0 && !loading && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2.5 text-center">
            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Total Tokens</div>
            <div className="text-white font-bold text-lg lm-mono">{deduped.length}</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2.5 text-center">
            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Live Trading</div>
            <div className="text-lm-green font-bold text-lg lm-mono">{liveCount}</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2.5 text-center">
            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Open Sales</div>
            <div className="text-lm-orange font-bold text-lg lm-mono">{openCount}</div>
          </div>
        </div>
      )}

      {/* ── Search + Sort + Filters Toolbar ── */}
      <div className="space-y-2">
        {/* Search bar */}
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lm-terminal-lightgray pointer-events-none">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, symbol, or address..."
            className="w-full h-9 pl-9 pr-3 bg-lm-terminal-darkgray border border-lm-terminal-gray text-white text-sm placeholder:text-lm-terminal-lightgray focus:outline-none focus:border-lm-orange transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-lm-terminal-lightgray hover:text-white text-lg leading-none px-1">&times;</button>
          )}
        </div>

        {/* Filters + Sort + Actions row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {(["all", "finalized", "open"] as const).map((f) => {
              const count = f === "all" ? deduped.length : f === "open" ? openCount : liveCount;
              const label = f === "all" ? "All" : f === "finalized" ? "Live" : "Open";
              return (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={`text-[11px] px-3 py-1.5 border transition-colors font-medium ${
                    filter === f
                      ? f === "finalized" ? "border-lm-green text-lm-green bg-lm-green/5" : f === "open" ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-orange text-lm-orange bg-lm-orange/5"
                      : "border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-gray hover:text-white"
                  }`}>
                  {label} <span className="opacity-60 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-[11px] h-8 px-2 bg-lm-terminal-darkgray border border-lm-terminal-gray text-lm-terminal-lightgray focus:outline-none focus:border-lm-orange cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="mcap">Market Cap ↓</option>
              <option value="price">Price ↓</option>
              <option value="sale">Sale % ↓</option>
            </select>

            {/* Refresh */}
            <button type="button" onClick={() => refresh()} disabled={loading}
              className="text-[11px] h-8 px-3 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors disabled:opacity-40 font-medium flex items-center gap-1.5">
              {loading ? (
                <span className="lm-spinner flex-shrink-0" style={{ width: 10, height: 10, borderWidth: 1.5 }} />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M13.836 2.477a.75.75 0 01.75.75v3.182a.75.75 0 01-.75.75h-3.182a.75.75 0 010-1.5h1.37l-.84-.841a4.5 4.5 0 00-7.08.932.75.75 0 01-1.3-.75 6 6 0 019.44-1.242l.842.84V3.227a.75.75 0 01.75-.75zm-.911 7.5A.75.75 0 0113.199 11a6 6 0 01-9.44 1.241l-.84-.84v1.371a.75.75 0 01-1.5 0V9.591a.75.75 0 01.75-.75h3.182a.75.75 0 010 1.5h-1.37l.84.84a4.5 4.5 0 007.08-.932.75.75 0 011.224-.272z" clipRule="evenodd" />
                </svg>
              )}
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading Skeletons ── */}
      {loading && deduped.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-lm-black border border-lm-terminal-gray animate-pulse">
              <div className="h-20 bg-lm-terminal-darkgray" />
              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-14 bg-lm-terminal-darkgray rounded" />
                  <div className="h-14 bg-lm-terminal-darkgray rounded" />
                </div>
                <div className="h-1 bg-lm-terminal-darkgray rounded" />
                <div className="flex gap-2">
                  <div className="h-7 w-16 bg-lm-terminal-darkgray rounded" />
                  <div className="h-7 w-16 bg-lm-terminal-darkgray rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {status && !loading && <div className="text-lm-red text-xs px-1">{status}</div>}

      {/* ── Search results info ── */}
      {searchQuery && !loading && (
        <div className="text-[11px] text-lm-terminal-lightgray px-1">
          {sorted.length === 0 ? (
            <span>No tokens match &ldquo;<span className="text-white">{searchQuery}</span>&rdquo;</span>
          ) : (
            <span>Showing <span className="text-white font-bold">{sorted.length}</span> result{sorted.length !== 1 ? "s" : ""} for &ldquo;<span className="text-white">{searchQuery}</span>&rdquo;</span>
          )}
        </div>
      )}

      {/* ── Empty State ── */}
      {sorted.length === 0 && !loading && !searchQuery ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-lm-terminal-lightgray text-3xl">🚀</div>
          <div className="text-white font-bold text-sm">No launches found yet</div>
          <div className="text-lm-terminal-lightgray text-xs max-w-xs mx-auto">Be the first to launch a token! Switch to the Create tab to deploy your own meme coin with instant DEX liquidity.</div>
        </div>
      ) : sorted.length > 0 ? (
        <>
          {/* ── Token Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((x) => {
              const key = x.launch;
              const pct = salePct(x);
              const xSold = effectiveSold(x);
              const soldOut = x.remaining === 0n && x.saleSupply > 0n;
              const ethRaised = x.priceWeiPerToken > 0n && xSold > 0n ? (xSold * x.priceWeiPerToken) / (10n ** 18n) : 0n;
              const trading = isTradingLaunch(x);
              const hasSaleActivity = pct > 0;
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
              const dp = displayPrice(x, ethUsd);
              const grad = symbolColor(x.symbol);
              const hasCustomImage = Boolean(x.imageURI && (x.imageURI.startsWith("http") || x.imageURI.startsWith("/")) && !x.imageURI.endsWith("/logo.png"));
              const imgSrc = resolveImageURI(x.imageURI);
              const isNew = x.blockTimestamp && (Date.now() / 1000 - x.blockTimestamp) < 86400;

              return (
                <div key={key} className={`bg-lm-black border transition-all duration-200 group cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
                  trading ? "border-lm-terminal-gray hover:border-lm-green/60 hover:shadow-lm-green/5" : "border-lm-terminal-gray hover:border-lm-orange/60 hover:shadow-lm-orange/5"
                }`}>
                  {/* Card banner */}
                  <div className={`h-20 bg-gradient-to-br ${grad} relative overflow-hidden`} onClick={() => setSelectedLaunch(x)}>
                    {hasCustomImage && (
                      <img src={imgSrc} alt="" className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-50" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Token identity */}
                    <div className="absolute bottom-2.5 left-3 flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-lg bg-black/60 border border-white/20 flex items-center justify-center text-white font-bold text-xs backdrop-blur-sm overflow-hidden shadow-lg">
                        {hasCustomImage ? (
                          <img src={imgSrc} alt={x.symbol} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).replaceWith(document.createTextNode(x.symbol.slice(0,2).toUpperCase())); }} />
                        ) : x.symbol.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-bold text-sm leading-tight truncate max-w-[130px]">${x.symbol}</div>
                        <div className="text-white/50 text-[10px] leading-tight truncate max-w-[130px]">{x.name}</div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex items-center gap-1">
                      {isNew && (
                        <span className="text-[7px] px-1 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-400/40 font-bold">NEW</span>
                      )}
                      <span className={`text-[8px] px-1.5 py-0.5 font-bold ${
                        trading
                          ? "bg-lm-green/20 text-lm-green border border-lm-green/40"
                          : soldOut
                            ? "bg-white/10 text-white/60 border border-white/20"
                            : "bg-lm-orange/20 text-lm-orange border border-lm-orange/40"
                      }`}>
                        {trading ? "LIVE" : soldOut ? "SOLD OUT" : "SALE"}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-3 space-y-2.5">
                    {/* Price + Mcap */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-lm-terminal-darkgray/50 border border-lm-terminal-gray/50 p-2 rounded-sm" title={dp.eth}>
                        <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">{dp.label}</div>
                        <div className={`lm-mono text-xs font-bold mt-0.5 ${trading && x.marketPriceEth ? "text-lm-green" : "text-white"}`}>{dp.usd}</div>
                        <div className="text-lm-terminal-lightgray text-[8px] lm-mono mt-0.5">{dp.eth}</div>
                      </div>
                      <div className="bg-lm-terminal-darkgray/50 border border-lm-terminal-gray/50 p-2 rounded-sm">
                        {(() => { const mcap = mcapStr(x, ethUsd); return mcap !== "—" ? (
                          <>
                            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Mcap</div>
                            <div className="text-white lm-mono text-xs font-bold mt-0.5">{mcap}</div>
                          </>
                        ) : ethRaised > 0n ? (
                          <>
                            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Raised</div>
                            <div className="text-white lm-mono text-xs font-bold mt-0.5" title={`${fmtEth(ethRaised)} ETH`}>{fmtUsd(Number(formatUnits(ethRaised, 18)) * ethUsd)}</div>
                          </>
                        ) : x.saleSupply > 0n ? (
                          <>
                            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Supply</div>
                            <div className="text-white lm-mono text-xs font-bold mt-0.5">{fmtSupply(x.saleSupply)}</div>
                          </>
                        ) : (
                          <>
                            <div className="text-lm-terminal-lightgray text-[9px] lm-upper tracking-wider">Status</div>
                            <div className="text-white lm-mono text-xs font-bold mt-0.5">{trading ? "Live" : "New"}</div>
                          </>
                        ); })()}
                      </div>
                    </div>

                    {/* Sale progress bar */}
                    {hasSaleActivity && x.saleSupply > 0n && (
                      <div>
                        <div className="flex justify-between text-[9px] mb-1">
                          <span className="text-lm-terminal-lightgray">{fmtSupply(xSold)} / {fmtSupply(x.saleSupply)}</span>
                          <span className="text-white font-bold">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-lm-terminal-darkgray rounded-full overflow-hidden">
                          <div className={`h-full transition-all rounded-full ${trading ? "bg-gradient-to-r from-lm-green/80 to-lm-green" : "bg-gradient-to-r from-lm-orange/80 to-lm-orange"}`} style={{ width: `${Math.min(100, Math.max(pct > 0 ? 2 : 0, pct))}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Quick Buy */}
                    {!trading && x.remaining > 0n && (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5 items-end">
                          <div className="flex-1">
                            <Input
                              value={buyAmounts[key] || ""}
                              onValueChange={(v) => setBuyAmounts((p) => ({ ...p, [key]: v }))}
                              placeholder="ETH amount"
                            />
                          </div>
                          <button type="button" onClick={() => quickBuy(x)} disabled={!address || buyType[key] === "info"}
                            className="text-[10px] px-3 py-1.5 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap rounded-sm">
                            {buyType[key] === "info" ? "..." : "Buy"}
                          </button>
                        </div>
                        {tokenEstimate && <div className="text-[9px] text-lm-terminal-lightgray">≈ <span className="text-white font-bold">{tokenEstimate} ${x.symbol}</span></div>}
                        {bStatus && <div className={`text-[9px] ${bColor}`}>{bStatus}</div>}
                      </div>
                    )}

                    {/* Actions row */}
                    {trading && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {x.pool && x.pool !== ZERO && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); setSwapTarget({ token: x.token, symbol: x.symbol, imageURI: x.imageURI }); }}
                            className="text-[10px] px-2.5 py-1 border border-lm-green text-lm-green hover:bg-lm-green/10 transition-colors font-bold rounded-sm">Trade</button>
                        )}
                        {x.stakingVault && x.stakingVault !== ZERO && (
                          <Link href={`/launcher/${x.launch}`} className="text-[10px] px-2.5 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/10 transition-colors font-bold rounded-sm">Stake</Link>
                        )}
                        {x.feeSplitter && x.feeSplitter !== ZERO && (
                          <button type="button" onClick={() => collectFees(x)} disabled={buyType[feeKey] === "info"} className="text-[10px] px-2.5 py-1 border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange transition-colors disabled:opacity-40 rounded-sm">{buyType[feeKey] === "info" ? "..." : "Fees"}</button>
                        )}
                        {feeStatus && <span className={`text-[9px] ${feeColor} truncate max-w-[120px]`}>{feeStatus}</span>}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-lm-terminal-gray/30">
                      <div className="flex items-center gap-2 text-[10px] text-lm-terminal-lightgray">
                        {x.blockTimestamp && <span>{timeAgo(x.blockTimestamp)}</span>}
                        <button type="button" onClick={(e) => { e.stopPropagation(); copyAddress(x.token); }}
                          title="Copy token address" className="hover:text-lm-orange transition-colors lm-mono flex items-center gap-1">
                          {short(x.token)}
                          {copiedAddr === x.token ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-lm-green"><path fillRule="evenodd" d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z" clipRule="evenodd" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-40"><path d="M5.5 3.5A1.5 1.5 0 017 2h2.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 01.439 1.061V9.5A1.5 1.5 0 0112 11V3.5H5.5z" /><path d="M3.5 5A1.5 1.5 0 002 6.5v6A1.5 1.5 0 003.5 14h5a1.5 1.5 0 001.5-1.5V6.5A1.5 1.5 0 008.5 5h-5z" /></svg>
                          )}
                        </button>
                      </div>
                      <button type="button" onClick={() => setSelectedLaunch(x)} className="text-[10px] text-lm-orange hover:underline font-bold">
                        Details →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Load More ── */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button type="button" onClick={() => setVisibleCount((c) => c + 12)}
                className="text-xs px-6 py-2 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-medium">
                Load More <span className="opacity-60 ml-1">({sorted.length - visibleCount} remaining)</span>
              </button>
            </div>
          )}

          {/* ── Showing count ── */}
          {sorted.length > 0 && (
            <div className="text-[10px] text-lm-terminal-lightgray text-center">
              Showing {Math.min(visibleCount, sorted.length)} of {sorted.length} tokens
            </div>
          )}
        </>
      ) : null}
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
      const startBlock = BigInt(Math.max(0, Number(config.launcherFactoryStartBlock || 0)));
      const ev = parseAbiItem(
        "event LaunchCreated(address indexed creator,address indexed token,address indexed launch,string name,string symbol,string metadataURI,string imageURI)"
      );
      const CHUNK = 80_000n;
      const allLogs: any[] = [];
      for (let s = startBlock; s <= latest; s += CHUNK) {
        const e = (s + CHUNK - 1n) > latest ? latest : (s + CHUNK - 1n);
        const chunk = await publicClient.getLogs({ address: factory, event: ev, fromBlock: s, toBlock: e });
        allLogs.push(...chunk);
      }
      const seen = new Set<string>();
      const launchAddrs: Address[] = [];
      for (const l of allLogs) {
        const la = (l.args.launch as Address).toLowerCase();
        if (seen.has(la)) continue;
        seen.add(la);
        launchAddrs.push(l.args.launch as Address);
      }

      async function probeStake(launchAddr: Address): Promise<StakeInfo | null> {
        try {
          const vaultAddr = (await publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "stakingVault" })) as Address;
          if (!vaultAddr || vaultAddr === ZERO) return null;
          const userInfo = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "users", args: [address!] })) as any;
          const staked = userInfo.staked as bigint;
          if (staked <= 0n) return null;
          const stakeToken = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "stakeToken" })) as Address;
          let stakeSymbol = "TOKEN", stakeDecimals = 18;
          try { stakeSymbol = (await publicClient.readContract({ address: stakeToken, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /**/ }
          try { stakeDecimals = Number(await publicClient.readContract({ address: stakeToken, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /**/ }
          let pending0 = 0n, pending1 = 0n;
          try {
            const pr = (await publicClient.readContract({ address: vaultAddr, abi: StonkYieldStakingVaultAbi, functionName: "pendingRewards", args: [address!] })) as any;
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
          return { launchAddr, vaultAddr, stakeTokenAddr: stakeToken, stakeSymbol, stakeDecimals, staked, unlockTime: userInfo.unlockTime as bigint, pending0, pending1, rewardToken0Symbol, rewardToken1Symbol };
        } catch { return null; }
      }

      const probed = await Promise.all(launchAddrs.map(probeStake));
      const results = probed.filter((x): x is StakeInfo => x !== null);

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
      { id: "launches", label: "Launcher", hint: "Discover + trade tokens" },
      { id: "create", label: "Create", hint: "Launch a new token" },
      { id: "stake", label: "Stake/Yield", hint: "Your staking positions" }
    ],
    []
  );
  const [active, setActive] = useState("launches");
  const [infoOpen, setInfoOpen] = useState(false);
  const ethUsd = useEthPrice();

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
            <span className="text-[10px] text-lm-terminal-lightgray lm-mono hidden sm:inline-flex items-center gap-1" title="Live ETH/USD price from CoinGecko">
              <span className="w-1.5 h-1.5 rounded-full bg-lm-green animate-pulse" />
              ETH <span className="text-white font-bold">${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </span>
            <TerminalTabs tabs={tabs} active={active} onChange={setActive} />
            <Button variant="ghost" size="sm" onClick={() => setInfoOpen(true)} aria-label="Launcher information">
              Info
            </Button>
          </div>
        )}
      >
        {active === "launches" ? <LaunchesIndex ethUsd={ethUsd} /> : null}
        {active === "create" ? <LauncherPanel /> : null}
        {active === "stake" ? <StakeTab /> : null}
      </Panel>
      <LauncherInfoModal open={infoOpen} onClose={() => setInfoOpen(false)} />
    </div>
  );
}
