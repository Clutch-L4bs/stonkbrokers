"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Address, formatEther, formatUnits, parseAbiItem, parseUnits } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../providers";
import { config } from "../../lib/config";
import {
  ERC20Abi,
  ERC20MetadataAbi,
  StonkCoveredCallVaultAbi,
  StonkOptionPositionNFTAbi,
  StonkTokenRegistryAbi
} from "../../lib/abis";
import { TradingViewChart } from "./TradingViewChart";
import type { LineData, UTCTimestamp } from "lightweight-charts";
import { useIntentListener, IntentAction } from "../../components/IntentTerminal";

function asAddress(v: string): Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error("Invalid address");
  return v as Address;
}

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
}

function explorerTx(hash: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/tx/${hash}`;
}

type TokenInfo = { addr: Address; symbol: string; decimals: number };

const CHART_RANGES = [
  { label: "5K", blocks: 5_000n },
  { label: "20K", blocks: 20_000n },
  { label: "80K", blocks: 80_000n }
];

function formatExpiry(ts: number): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function expiryFromDays(days: number): string {
  return String(Math.floor(Date.now() / 1000) + days * 86400);
}

export function OptionsPanel() {
  const { address, walletClient, requireCorrectChain, connect } = useWallet();

  /* ── Token registry ── */
  const [registryTokens, setRegistryTokens] = useState<TokenInfo[]>([]);

  useEffect(() => {
    (async () => {
      if (!config.tokenRegistry) return;
      try {
        const count = Number(await publicClient.readContract({ address: config.tokenRegistry, abi: StonkTokenRegistryAbi, functionName: "tokenCount" }));
        const tokens: TokenInfo[] = [];
        for (let i = 0; i < Math.min(count, 30); i++) {
          const addr = (await publicClient.readContract({ address: config.tokenRegistry, abi: StonkTokenRegistryAbi, functionName: "tokenAt", args: [BigInt(i)] })) as Address;
          let symbol = "???";
          let decimals = 18;
          try { symbol = (await publicClient.readContract({ address: addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /* skip */ }
          try { decimals = Number(await publicClient.readContract({ address: addr, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /* skip */ }
          tokens.push({ addr, symbol, decimals });
        }
        setRegistryTokens(tokens);
      } catch { /* skip */ }
    })();
  }, []);

  /* ── Core state ── */
  const vaultAddr = config.coveredCallVault as Address;
  const [underlying, setUnderlying] = useState<string>("");
  const [underlyingInfo, setUnderlyingInfo] = useState<TokenInfo | null>(null);
  const quoteAddr = config.weth as Address;
  const [quoteInfo, setQuoteInfo] = useState<TokenInfo | null>(null);
  const [pool, setPool] = useState<string>("");

  /* ── Create offer ── */
  const [twapSeconds, setTwapSeconds] = useState<string>("3600");
  const [strikeTick, setStrikeTick] = useState<string>("");
  const [underlyingAmount, setUnderlyingAmount] = useState<string>("");
  const [strikeQuoteAmount, setStrikeQuoteAmount] = useState<string>("");
  const [premiumQuoteAmount, setPremiumQuoteAmount] = useState<string>("");
  const [expiryDays, setExpiryDays] = useState<string>("7");

  /* ── Buy / Exercise ── */
  const [offerId, setOfferId] = useState<string>("");
  const [optionTokenId, setOptionTokenId] = useState<string>("");
  const [loadedOffer, setLoadedOffer] = useState<any | null>(null);
  const [loadedPos, setLoadedPos] = useState<any | null>(null);

  /* ── Shared state ── */
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");

  /* ── Chart ── */
  const [chartBusy, setChartBusy] = useState(false);
  const [chartStatus, setChartStatus] = useState("");
  const [chartPoints, setChartPoints] = useState<LineData[]>([]);
  const [chartBlocksBack, setChartBlocksBack] = useState<bigint>(20_000n);

  /* ── Refs for stable references in intent listener ── */
  const loadOfferRef = useRef<() => void>(() => {});
  const loadPositionRef = useRef<() => void>(() => {});

  /* ── Intent listener — auto-fill from IntentTerminal ── */
  const regTokensRef = useRef(registryTokens);
  regTokensRef.current = registryTokens;

  useIntentListener(useCallback((intent: IntentAction) => {
    if (intent.type === "write_call") {
      const toks = regTokensRef.current;
      if (intent.underlying) {
        const upper = intent.underlying.toUpperCase();
        const match = toks.find((t) => t.symbol.toUpperCase() === upper);
        if (match) setUnderlying(match.addr);
      }
      if (intent.amount) setUnderlyingAmount(intent.amount);
      if (intent.strike) setStrikeQuoteAmount(intent.strike);
      if (intent.premium) setPremiumQuoteAmount(intent.premium);
      if (intent.expiry) setExpiryDays(intent.expiry);
      if (intent.twap) setTwapSeconds(intent.twap);
    } else if (intent.type === "buy_option" && intent.offerId) {
      setOfferId(intent.offerId);
    } else if (intent.type === "preview_offer" && intent.offerId) {
      setOfferId(intent.offerId);
      setTimeout(() => loadOfferRef.current(), 0);
    } else if (intent.type === "exercise" && intent.tokenId) {
      setOptionTokenId(intent.tokenId);
    } else if (intent.type === "reclaim" && intent.tokenId) {
      setOptionTokenId(intent.tokenId);
    } else if (intent.type === "preview_position" && intent.tokenId) {
      setOptionTokenId(intent.tokenId);
      setTimeout(() => loadPositionRef.current(), 0);
    } else if (intent.type === "cancel_option" && intent.offerId) {
      setOfferId(intent.offerId);
    } else if (intent.type === "load_chart") {
      if (intent.blocks) setChartBlocksBack(BigInt(intent.blocks));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  /* ── Decimals cache ── */
  const decimalsCacheRef = useRef<Record<string, number>>({});
  const getDecimals = useCallback(async (token: Address): Promise<number> => {
    const key = token.toLowerCase();
    if (typeof decimalsCacheRef.current[key] === "number") return decimalsCacheRef.current[key];
    const d = Number(await publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "decimals" }));
    decimalsCacheRef.current[key] = d;
    return d;
  }, []);

  /* ── Resolve token info ── */
  useEffect(() => {
    if (!underlying || !/^0x[0-9a-fA-F]{40}$/.test(underlying)) { setUnderlyingInfo(null); return; }
    (async () => {
      try {
        const addr = underlying as Address;
        let symbol = "???";
        let decimals = 18;
        try { symbol = (await publicClient.readContract({ address: addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /* skip */ }
        try { decimals = Number(await publicClient.readContract({ address: addr, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /* skip */ }
        setUnderlyingInfo({ addr, symbol, decimals });
      } catch { setUnderlyingInfo(null); }
    })();
  }, [underlying]);

  useEffect(() => {
    if (!quoteAddr) { setQuoteInfo(null); return; }
    (async () => {
      try {
        let symbol = "WETH";
        let decimals = 18;
        try { symbol = (await publicClient.readContract({ address: quoteAddr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /* skip */ }
        try { decimals = Number(await publicClient.readContract({ address: quoteAddr, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /* skip */ }
        setQuoteInfo({ addr: quoteAddr, symbol, decimals });
      } catch { setQuoteInfo(null); }
    })();
  }, [quoteAddr]);

  /* ── Chart logic ── */
  const safePow1p0001 = useCallback((tick: number) => {
    const v = Math.exp(tick * Math.log(1.0001));
    return Number.isFinite(v) && v > 0 ? v : null;
  }, []);

  const priceFromTick = useCallback(
    async (poolAddr: Address, underlyingAddr: Address, quoteAddr2: Address, tick: number): Promise<number | null> => {
      const poolAbi = [
        { type: "function", name: "token0", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
        { type: "function", name: "token1", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }
      ] as const;
      const [token0, token1] = await Promise.all([
        publicClient.readContract({ address: poolAddr, abi: poolAbi, functionName: "token0" }) as Promise<Address>,
        publicClient.readContract({ address: poolAddr, abi: poolAbi, functionName: "token1" }) as Promise<Address>
      ]);
      const pow = safePow1p0001(tick);
      if (pow === null) return null;
      const d0 = await getDecimals(token0);
      const d1 = await getDecimals(token1);
      const token1PerToken0Human = pow * Math.pow(10, d0 - d1);
      const u = underlyingAddr.toLowerCase();
      const q = quoteAddr2.toLowerCase();
      if (u === token1.toLowerCase() && q === token0.toLowerCase()) return token1PerToken0Human;
      if (u === token0.toLowerCase() && q === token1.toLowerCase()) return token1PerToken0Human === 0 ? null : 1 / token1PerToken0Human;
      return null;
    },
    [getDecimals, safePow1p0001]
  );

  const loadChart = useCallback(async () => {
    setChartBusy(true);
    setChartStatus("Loading swap data...");
    try {
      const poolAddr = asAddress(pool);
      const u = asAddress(underlying);
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > chartBlocksBack ? latest - chartBlocksBack : 0n;
      const swapEvent = parseAbiItem(
        "event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)"
      );
      const logs = await publicClient.getLogs({ address: poolAddr, event: swapEvent, fromBlock, toBlock: latest });
      if (!logs.length) { setChartPoints([]); setChartStatus("No swaps found."); return; }
      const uniqueBlocks = Array.from(new Set(logs.map((l) => l.blockNumber)));
      const blocks = await Promise.all(uniqueBlocks.map((bn) => publicClient.getBlock({ blockNumber: bn })));
      const tsByBlock = new Map<bigint, number>();
      for (const b of blocks) tsByBlock.set(b.number!, Number(b.timestamp));
      const step = Math.max(1, Math.floor(logs.length / 600));
      const pts: LineData[] = [];
      for (let i = 0; i < logs.length; i += step) {
        const l = logs[i];
        const ts = tsByBlock.get(l.blockNumber);
        if (!ts) continue;
        const tick = Number(l.args.tick);
        const price = await priceFromTick(poolAddr, u, quoteAddr, tick);
        if (price === null || !Number.isFinite(price) || price <= 0) continue;
        pts.push({ time: ts as UTCTimestamp, value: Number(price.toPrecision(10)) });
      }
      pts.sort((a, b) => Number(a.time) - Number(b.time));
      setChartPoints(pts);
      setChartStatus(pts.length === 0 ? "Could not resolve prices from swaps." : "");
    } catch (e: any) {
      setChartPoints([]);
      setChartStatus(String(e?.shortMessage || e?.message || e));
    } finally {
      setChartBusy(false);
    }
  }, [chartBlocksBack, pool, underlying, quoteAddr, priceFromTick]);

  const twapHint = useMemo(() => {
    const n = Number(twapSeconds || "0");
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 900) return "Min TWAP is 900s (15 min).";
    return "";
  }, [twapSeconds]);

  /* ── Actions ── */
  async function ensureAllowance(owner: Address, spender: Address, token: Address, needed: bigint) {
    const allowance = (await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "allowance", args: [owner, spender] })) as bigint;
    if (allowance >= needed) return;
    if (!walletClient) throw new Error("No wallet client");
    setStatus("Approving token...");
    const tx = await walletClient.writeContract({
      address: token, abi: ERC20Abi, functionName: "approve", args: [spender, needed],
      chain: robinhoodTestnet, account: owner
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
  }

  async function createOffer() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    const uSym = underlyingInfo?.symbol || "tokens";
    setBusy(true);
    setLastTxHash("");
    try {
      setStatus(`Preparing ${uSym} covered call offer...`);
      setStatusType("info");
      await requireCorrectChain();
      const v = vaultAddr;
      const u = asAddress(underlying);
      const q = quoteAddr;
      const p = asAddress(pool);
      if (!v) throw new Error("Missing vault address in config.");
      const uDec = underlyingInfo?.decimals ?? await getDecimals(u);
      const qDec = quoteInfo?.decimals ?? 18;
      const uAmt = parseUnits(underlyingAmount || "0", uDec);
      const strikeAmt = parseUnits(strikeQuoteAmount || "0", qDec);
      const premAmt = parseUnits(premiumQuoteAmount || "0", qDec);
      const expiry = BigInt(expiryFromDays(Number(expiryDays || "7")));
      if (uAmt <= 0n) throw new Error("Underlying amount must be > 0");
      if (strikeAmt <= 0n) throw new Error("Strike must be > 0");
      if (premAmt <= 0n) throw new Error("Premium must be > 0");

      await ensureAllowance(address, v, u, uAmt);
      setStatus(`Writing ${underlyingAmount} ${uSym} call (${expiryDays}d expiry)...`);
      const tx = await walletClient.writeContract({
        address: v, abi: StonkCoveredCallVaultAbi, functionName: "createOffer",
        args: [u, q, p, Number(twapSeconds || "0"), Number(strikeTick || "0"), uAmt, strikeAmt, premAmt, expiry],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      setStatus("Confirming on-chain...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        setStatus(`Offer created! ${underlyingAmount} ${uSym} escrowed. Premium: ${premiumQuoteAmount} ETH. Expires in ${expiryDays}d.`);
        setStatusType("success");
      } else {
        setStatus("Transaction reverted. Check that you have enough tokens and try again.");
        setStatusType("error");
      }
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled by user.");
      } else {
        setStatus(`Create offer failed: ${msg}`);
      }
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  async function loadOffer() {
    setBusy(true);
    try {
      setStatus("");
      const id = BigInt(offerId || "0");
      const offer = (await publicClient.readContract({ address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "offers", args: [id] })) as any;
      setLoadedOffer(offer);
      setStatus("");
    } catch (e: any) {
      setLoadedOffer(null);
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  async function buy() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      setStatus(`Loading offer #${offerId}...`);
      setStatusType("info");
      await requireCorrectChain();
      const id = BigInt(offerId || "0");
      const offer = (await publicClient.readContract({ address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "offers", args: [id] })) as any;
      if (!offer.active) throw new Error("Offer #" + offerId + " is no longer active (may be expired, sold, or cancelled).");
      const premFmt = formatEther(offer.premiumQuoteAmount as bigint);
      setStatus(`Buying option #${offerId} for ${premFmt} ETH premium...`);
      await ensureAllowance(address, vaultAddr, offer.quote as Address, offer.premiumQuoteAmount as bigint);
      setStatus("Awaiting signature...");
      const tx = await walletClient.writeContract({
        address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "buyOption", args: [id],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      setStatus("Confirming on-chain...");
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus(`Option purchased! You paid ${premFmt} ETH premium. Your option NFT has been minted.`);
      setStatusType("success");
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled by user.");
      } else {
        setStatus(`Buy failed: ${msg}`);
      }
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOffer() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      await requireCorrectChain();
      setStatus("Cancelling...");
      setStatusType("info");
      const id = BigInt(offerId || "0");
      const tx = await walletClient.writeContract({
        address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "cancelOffer", args: [id],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Offer cancelled.");
      setStatusType("success");
      await loadOffer();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  async function loadPosition() {
    setBusy(true);
    try {
      setStatus("");
      const nft = (await publicClient.readContract({ address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "optionNft" })) as Address;
      const id = BigInt(optionTokenId || "0");
      const pos = (await publicClient.readContract({ address: nft, abi: StonkOptionPositionNFTAbi, functionName: "positions", args: [id] })) as any;
      const reclaimed = (await publicClient.readContract({ address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "underlyingReclaimed", args: [id] })) as boolean;
      // Resolve token symbols
      let uSym = "???", qSym = "???";
      let uDec = 18, qDec = 18;
      try { uSym = (await publicClient.readContract({ address: pos.underlying as Address, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /* skip */ }
      try { qSym = (await publicClient.readContract({ address: pos.quote as Address, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /* skip */ }
      try { uDec = Number(await publicClient.readContract({ address: pos.underlying as Address, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /* skip */ }
      try { qDec = Number(await publicClient.readContract({ address: pos.quote as Address, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /* skip */ }
      setLoadedPos({ ...pos, optionNft: nft, reclaimed, uSym, qSym, uDec, qDec });
    } catch (e: any) {
      setLoadedPos(null);
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  loadOfferRef.current = loadOffer;
  loadPositionRef.current = loadPosition;

  async function exercise() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      await requireCorrectChain();
      setStatus(`Loading option NFT #${optionTokenId}...`);
      setStatusType("info");
      const nft = (await publicClient.readContract({ address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "optionNft" })) as Address;
      const pos = (await publicClient.readContract({ address: nft, abi: StonkOptionPositionNFTAbi, functionName: "positions", args: [BigInt(optionTokenId || "0")] })) as any;
      const strikeFmt = formatEther(pos.strikeQuoteAmount as bigint);
      setStatus(`Exercising option #${optionTokenId} — paying ${strikeFmt} ETH strike...`);
      await ensureAllowance(address, vaultAddr, pos.quote as Address, pos.strikeQuoteAmount as bigint);
      setStatus("Awaiting signature...");
      const tx = await walletClient.writeContract({
        address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "exercise", args: [BigInt(optionTokenId || "0")],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      setStatus("Confirming on-chain...");
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus(`Option #${optionTokenId} exercised! You paid ${strikeFmt} ETH and received the underlying tokens.`);
      setStatusType("success");
      await loadPosition();
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled by user.");
      } else if (msg.includes("NOT_ITM")) {
        setStatus("Option is not in-the-money. TWAP price must exceed the strike price to exercise.");
      } else if (msg.includes("EXPIRED")) {
        setStatus("Option has expired. Use 'Reclaim' if you are the writer.");
      } else {
        setStatus(`Exercise failed: ${msg}`);
      }
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  async function reclaimExpired() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      await requireCorrectChain();
      setStatus("Reclaiming...");
      setStatusType("info");
      const tx = await walletClient.writeContract({
        address: vaultAddr, abi: StonkCoveredCallVaultAbi, functionName: "reclaimExpired", args: [BigInt(optionTokenId || "0")],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Expired underlying reclaimed!");
      setStatusType("success");
      await loadPosition();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";
  const expiryTs = Number(expiryFromDays(Number(expiryDays || "7")));

  return (
    <div className="space-y-4">
      {/* ── Price Chart ── */}
      <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-white font-bold text-sm lm-upper">Price Chart</div>
          <div className="flex items-center gap-1">
            {CHART_RANGES.map((r) => (
              <button
                key={r.label}
                type="button"
                onClick={() => setChartBlocksBack(r.blocks)}
                className={`text-[10px] px-2 py-1 border transition-colors ${
                  chartBlocksBack === r.blocks
                    ? "border-lm-orange text-lm-orange bg-lm-orange/5"
                    : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                }`}
              >
                {r.label}
              </button>
            ))}
            <button
              type="button"
              disabled={chartBusy || !pool || !underlying}
              onClick={() => loadChart()}
              className="text-[10px] px-3 py-1 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 disabled:opacity-40 transition-colors"
            >
              {chartBusy ? "..." : "Load"}
            </button>
          </div>
        </div>
        <TradingViewChart
          title={underlyingInfo ? `${underlyingInfo.symbol} / ${quoteInfo?.symbol || "WETH"}` : "Select underlying token"}
          subtitle={pool ? `Pool: ${short(pool)}` : "Enter pool address to load chart"}
          data={chartPoints}
        />
        {chartStatus && <div className="text-lm-red text-xs">{chartStatus}</div>}
      </div>

      {/* ── Write Covered Call ── */}
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-lm-orange flex items-center justify-center">
            <span className="text-lm-orange font-bold text-xs">1</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm lm-upper">Write Covered Call</div>
            <div className="text-lm-terminal-lightgray text-[10px]">Deposit tokens as collateral. Earn premium when someone buys your option.</div>
          </div>
        </div>

        {/* Token selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Collateral Token</div>
            {registryTokens.length > 0 ? (
              <div className="space-y-1">
                <div className="flex gap-1 flex-wrap">
                  {registryTokens.map((t) => (
                    <button key={t.addr} type="button" onClick={() => setUnderlying(t.addr)}
                      className={`text-[10px] px-2 py-1 border transition-colors ${underlying.toLowerCase() === t.addr.toLowerCase() ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
                      {t.symbol}
                    </button>
                  ))}
                </div>
                <Input value={underlying} onValueChange={setUnderlying} numeric={false} placeholder="Or paste token address..." />
              </div>
            ) : (
              <Input value={underlying} onValueChange={setUnderlying} numeric={false} placeholder="0x..." />
            )}
            {underlyingInfo && (
              <div className="text-[10px] text-lm-terminal-lightgray">
                Selected: <span className="text-white font-bold">{underlyingInfo.symbol}</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Settlement Token</div>
            <div className="flex items-center gap-2 h-9 px-3 bg-lm-black border border-lm-terminal-gray text-white text-xs font-bold">
              {quoteInfo?.symbol || "WETH"}
              <span className="text-lm-terminal-lightgray lm-mono text-[10px]">{quoteAddr ? short(quoteAddr) : ""}</span>
            </div>
            <div className="text-lm-terminal-lightgray text-[10px]">Strike and premium paid in this token</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Price Oracle Pool</div>
          <Input value={pool} onValueChange={setPool} numeric={false} placeholder="Uniswap V3 pool address for this pair" />
          <div className="text-lm-terminal-lightgray text-[10px]">Used for TWAP price verification when exercising</div>
        </div>

        {/* Main parameters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Collateral Amount</div>
            <Input value={underlyingAmount} onValueChange={setUnderlyingAmount} placeholder="100" />
            {underlyingInfo && <div className="text-lm-terminal-lightgray text-[10px]">{underlyingInfo.symbol} tokens to lock</div>}
          </div>
          <div className="space-y-1.5">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Expiry</div>
            <div className="flex gap-1">
              {[{ label: "1d", val: "1" }, { label: "7d", val: "7" }, { label: "14d", val: "14" }, { label: "30d", val: "30" }].map((d) => (
                <button key={d.val} type="button" onClick={() => setExpiryDays(d.val)}
                  className={`flex-1 text-[10px] py-1.5 border transition-colors ${expiryDays === d.val ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="text-lm-terminal-lightgray text-[10px]">Expires: {formatExpiry(expiryTs)}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Strike Price ({quoteInfo?.symbol || "WETH"})</div>
            <Input value={strikeQuoteAmount} onValueChange={setStrikeQuoteAmount} placeholder="0.5" />
            <div className="text-lm-terminal-lightgray text-[10px]">Buyer pays this amount to exercise the option</div>
          </div>
          <div className="space-y-1.5">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Premium ({quoteInfo?.symbol || "WETH"})</div>
            <Input value={premiumQuoteAmount} onValueChange={setPremiumQuoteAmount} placeholder="0.01" />
            <div className="text-lm-terminal-lightgray text-[10px]">You earn this when someone buys your option</div>
          </div>
        </div>

        {/* Advanced / developer settings */}
        <details className="text-[10px]">
          <summary className="text-lm-terminal-lightgray hover:text-lm-orange cursor-pointer transition-colors">
            Advanced settings (oracle TWAP, strike tick)
          </summary>
          <div className="grid grid-cols-2 gap-3 mt-2 p-2 bg-lm-black border border-lm-terminal-gray">
            <div className="space-y-1">
              <div className="text-lm-terminal-lightgray text-[10px]">TWAP Window</div>
              <div className="flex gap-1">
                {[{ label: "15m", val: "900" }, { label: "1h", val: "3600" }, { label: "4h", val: "14400" }, { label: "24h", val: "86400" }].map((t) => (
                  <button key={t.val} type="button" onClick={() => setTwapSeconds(t.val)}
                    className={`flex-1 text-[9px] py-1 border transition-colors ${twapSeconds === t.val ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <Input value={twapSeconds} onValueChange={setTwapSeconds} placeholder="3600" />
              {twapHint && <div className="text-lm-red text-[10px]">{twapHint}</div>}
              <div className="text-lm-terminal-lightgray">Price average window for exercise validation</div>
            </div>
            <div className="space-y-1">
              <div className="text-lm-terminal-lightgray text-[10px]">Strike Tick (raw)</div>
              <Input value={strikeTick} onValueChange={setStrikeTick} placeholder="e.g. -23000" />
              <div className="text-lm-terminal-lightgray">Uniswap V3 tick for in-the-money check</div>
            </div>
          </div>
        </details>

        <Button onClick={address ? createOffer : connect} loading={busy} disabled={busy || (!!address && (!underlying || !pool || (Number(twapSeconds) > 0 && Number(twapSeconds) < 900)))} variant="primary" size="lg" className="w-full">
          {busy ? "Writing Call..." : !address ? "Connect Wallet" : `Write Covered Call${underlyingInfo ? ` (${underlyingInfo.symbol})` : ""}`}
        </Button>
      </div>

      {/* ── Buy Option ── */}
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-lm-orange flex items-center justify-center">
            <span className="text-lm-orange font-bold text-xs">2</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm lm-upper">Buy Option</div>
            <div className="text-lm-terminal-lightgray text-[10px]">Purchase an active offer to receive a tradeable option NFT.</div>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Offer ID</div>
            <Input value={offerId} onValueChange={setOfferId} placeholder="Enter offer number" />
          </div>
          <button type="button" onClick={loadOffer} disabled={busy || !offerId}
            className="text-xs px-3 py-1.5 border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange disabled:opacity-40 transition-colors">
            Preview
          </button>
          <Button onClick={buy} loading={busy} disabled={busy || !offerId} variant="primary" className="px-5">
            {busy ? "Buying..." : "Buy Option"}
          </Button>
        </div>

        {loadedOffer && (
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">Offer #{loadedOffer.id?.toString()}</span>
              <span className={`px-1.5 py-0.5 border text-[10px] ${loadedOffer.active ? "border-lm-green text-lm-green" : "border-lm-red text-lm-red"}`}>
                {loadedOffer.active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-lm-terminal-lightgray">Writer</div>
              <a href={explorerAddr(String(loadedOffer.writer))} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(String(loadedOffer.writer))}</a>
              <div className="text-lm-terminal-lightgray">Underlying</div>
              <a href={explorerAddr(String(loadedOffer.underlying))} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(String(loadedOffer.underlying))}</a>
              <div className="text-lm-terminal-lightgray">Amount</div>
              <div className="text-white lm-mono">{loadedOffer.underlyingAmount?.toString()}</div>
              <div className="text-lm-terminal-lightgray">Premium</div>
              <div className="text-white lm-mono">{formatEther(loadedOffer.premiumQuoteAmount || 0n)} ETH</div>
              <div className="text-lm-terminal-lightgray">Strike</div>
              <div className="text-white lm-mono">{formatEther(loadedOffer.strikeQuoteAmount || 0n)} ETH</div>
              <div className="text-lm-terminal-lightgray">Strike Tick</div>
              <div className="text-white lm-mono">{Number(loadedOffer.strikeTick)}</div>
              <div className="text-lm-terminal-lightgray">Expiry</div>
              <div className="text-white">{formatExpiry(Number(loadedOffer.expiry))}</div>
            </div>
            {loadedOffer.active && address?.toLowerCase() === String(loadedOffer.writer).toLowerCase() && (
              <button
                type="button"
                onClick={cancelOffer}
                disabled={busy}
                className="text-[10px] px-2 py-1 border border-lm-red text-lm-red hover:bg-lm-red/5 transition-colors mt-1"
              >
                Cancel Offer (Writer Only)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Exercise / Reclaim ── */}
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 border border-lm-orange flex items-center justify-center">
            <span className="text-lm-orange font-bold text-xs">3</span>
          </div>
          <div>
            <div className="text-white font-bold text-sm lm-upper">Exercise / Reclaim</div>
            <div className="text-lm-terminal-lightgray text-[10px]">Exercise an in-the-money option, or reclaim expired collateral (writer only).</div>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Option NFT ID</div>
            <Input value={optionTokenId} onValueChange={setOptionTokenId} placeholder="Enter NFT token ID" />
          </div>
          <button type="button" onClick={loadPosition} disabled={busy || !optionTokenId}
            className="text-xs px-3 py-1.5 border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange disabled:opacity-40 transition-colors">
            Preview
          </button>
        </div>

        {loadedPos && (
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2 space-y-1 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-bold">Position #{optionTokenId}</span>
              <span className={`px-1.5 py-0.5 border text-[10px] ${
                loadedPos.exercised ? "border-lm-green text-lm-green"
                  : loadedPos.reclaimed ? "border-lm-gray text-lm-gray"
                  : BigInt(loadedPos.expiry) < BigInt(Math.floor(Date.now() / 1000)) ? "border-lm-red text-lm-red"
                  : "border-lm-orange text-lm-orange"
              }`}>
                {loadedPos.exercised ? "EXERCISED" : loadedPos.reclaimed ? "RECLAIMED" : BigInt(loadedPos.expiry) < BigInt(Math.floor(Date.now() / 1000)) ? "EXPIRED" : "ACTIVE"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <div className="text-lm-terminal-lightgray">Writer</div>
              <a href={explorerAddr(String(loadedPos.writer))} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(String(loadedPos.writer))}</a>
              <div className="text-lm-terminal-lightgray">Underlying</div>
              <div className="text-white">{loadedPos.uSym} <span className="lm-mono text-lm-gray">({short(String(loadedPos.underlying))})</span></div>
              <div className="text-lm-terminal-lightgray">Amount</div>
              <div className="text-white lm-mono">{formatUnits(loadedPos.underlyingAmount || 0n, loadedPos.uDec || 18)} {loadedPos.uSym}</div>
              <div className="text-lm-terminal-lightgray">Strike</div>
              <div className="text-white lm-mono">{formatUnits(loadedPos.strikeQuoteAmount || 0n, loadedPos.qDec || 18)} {loadedPos.qSym}</div>
              <div className="text-lm-terminal-lightgray">Premium Paid</div>
              <div className="text-white lm-mono">{formatUnits(loadedPos.premiumQuoteAmount || 0n, loadedPos.qDec || 18)} {loadedPos.qSym}</div>
              <div className="text-lm-terminal-lightgray">Strike Tick</div>
              <div className="text-white lm-mono">{Number(loadedPos.strikeTick)}</div>
              <div className="text-lm-terminal-lightgray">Expiry</div>
              <div className="text-white">{formatExpiry(Number(loadedPos.expiry))}</div>
            </div>

            {!loadedPos.exercised && !loadedPos.reclaimed && (
              <div className="flex gap-2 mt-2">
                <Button onClick={exercise} loading={busy} disabled={busy} variant="primary" size="sm" className="px-4">
                  Exercise
                </Button>
                <Button onClick={reclaimExpired} disabled={busy} size="sm" className="px-4">
                  Reclaim Expired
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Status ── */}
      {status && (
        <div className={`text-xs p-2.5 border bg-lm-black flex items-center justify-between gap-2 ${statusColor} ${
          statusType === "success" ? "border-lm-green/20" : statusType === "error" ? "border-lm-red/20" : "border-lm-terminal-gray"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {statusType === "info" && <span className="lm-spinner flex-shrink-0" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
            {statusType === "success" && <span className="lm-dot lm-dot-green flex-shrink-0" />}
            {statusType === "error" && <span className="lm-dot lm-dot-red flex-shrink-0" />}
            <span className="truncate">{status}</span>
          </div>
          {lastTxHash && (
            <a href={explorerTx(lastTxHash)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline flex-shrink-0">
              View Tx →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
