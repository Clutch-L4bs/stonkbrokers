"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Address, encodeFunctionData, formatEther, formatUnits, parseUnits } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { fetchWhitelistedTokens, ListedToken } from "../../lib/registry";
import { publicClient } from "../../providers";
import { config } from "../../lib/config";
import { QuoterV2Abi, SwapRouterAbi, ERC20Abi, ERC20MetadataAbi } from "../../lib/abis";
import { useWallet } from "../../wallet/WalletProvider";
import { robinhoodTestnet } from "../../providers";
import { useIntentListener, IntentAction } from "../../components/IntentTerminal";

/* ── Helpers ── */

const FEE_OPTIONS: Array<{ label: string; fee: number; hint: string }> = [
  { label: "0.05%", fee: 500, hint: "Stables" },
  { label: "0.30%", fee: 3000, hint: "Standard" },
  { label: "1.00%", fee: 10000, hint: "Volatile" }
];

const SLIPPAGE_OPTIONS = [
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "3%", bps: 300 }
];

// Minimal WETH9 ABI for wrap/unwrap without needing a pool.
const Weth9Abi = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "wad", type: "uint256" }], outputs: [] }
] as const;

const ETH_VIRTUAL: ListedToken = {
  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address,
  symbol: "ETH",
  decimals: 18,
  logoURI: ""
};

function isEthVirtual(addr: string): boolean {
  return addr.toLowerCase() === ETH_VIRTUAL.address.toLowerCase();
}

function isWeth(addr: string): boolean {
  return !!config.weth && addr.toLowerCase() === (config.weth as string).toLowerCase();
}

function explorerTx(hash: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/tx/${hash}`;
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

function fmtBal(raw: string, maxDecimals = 6): string {
  const num = Number(raw);
  if (isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(Math.min(4, maxDecimals));
  if (num >= 0.0001) return num.toFixed(maxDecimals);
  return fmtSmall(num);
}

function fmtRate(rate: number): string {
  if (rate === 0 || isNaN(rate)) return "—";
  if (rate >= 1_000_000) return `${(rate / 1_000_000).toFixed(2)}M`;
  if (rate >= 1_000) return `${(rate / 1_000).toFixed(2)}K`;
  if (rate >= 1) return rate.toFixed(4);
  if (rate >= 0.0001) return rate.toFixed(6);
  return fmtSmall(rate);
}

/* ── Token Selector ── */

function TokenSelector({
  tokens,
  value,
  onChange,
  customAddr,
  onCustomAddr,
  customMeta,
  label,
  balance,
  symbol,
  onMax,
  amount,
  onAmountChange,
  amountReadonly,
  quoteDisplay,
  isNativeEth
}: {
  tokens: ListedToken[];
  value: string;
  onChange: (v: string) => void;
  customAddr: string;
  onCustomAddr: (v: string) => void;
  customMeta: ListedToken | null;
  label: string;
  balance?: string;
  symbol?: string;
  onMax?: () => void;
  amount?: string;
  onAmountChange?: (v: string) => void;
  amountReadonly?: boolean;
  quoteDisplay?: string;
  isNativeEth?: boolean;
}) {
  const isCustom = value === "__custom__";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = [
    { addr: ETH_VIRTUAL.address, symbol: "ETH", hint: "Native", isEth: true },
    ...tokens.map((t) => ({ addr: t.address, symbol: t.symbol, hint: t.address.slice(0, 6) + "...", isEth: false })),
    { addr: "__custom__" as Address, symbol: "Custom", hint: "Paste address", isEth: false }
  ];

  const selectedSymbol = isCustom
    ? (customMeta?.symbol || "Custom")
    : (symbol || allOptions.find((o) => o.addr === value)?.symbol || "Select");

  return (
    <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-2">
      {/* Row 1: label + balance */}
      <div className="flex items-center justify-between">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">{label}</div>
        {balance !== undefined && (
          <div className="text-lm-terminal-lightgray text-[10px] lm-mono flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5 opacity-60">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 3h1v1h-1V4zm-1 2h3v1h-1v3h1v1h-3V10h1V7h-1V6z" />
            </svg>
            <span className="text-white">{fmtBal(balance)}</span>
          </div>
        )}
      </div>

      {/* Row 2: token picker + amount */}
      <div className="flex items-center gap-2">
        {/* Token button */}
        <div className="relative flex-shrink-0" ref={ref}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 h-10 px-3 bg-lm-black border border-lm-terminal-gray hover:border-lm-orange transition-colors min-w-[100px]"
          >
            <span className="text-white font-bold text-sm">{selectedSymbol}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-lm-terminal-lightgray">
              <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-lm-black border border-lm-orange w-56 max-h-60 overflow-y-auto shadow-lg">
              {allOptions.map((o) => {
                const isSelected = value === o.addr;
                return (
                  <button
                    key={o.addr}
                    type="button"
                    onClick={() => {
                      onChange(o.addr);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-lm-orange/10 text-lm-orange"
                        : "text-white hover:bg-lm-terminal-darkgray"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-sm">{o.symbol}</span>
                      {o.isEth && <span className="text-lm-terminal-lightgray text-[10px] ml-1.5">Native</span>}
                    </div>
                    <span className="text-lm-terminal-lightgray text-[10px] lm-mono">{o.hint}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Amount input / quote display */}
        <div className="flex-1 relative">
          {amountReadonly && quoteDisplay !== undefined ? (
            <div className="h-10 bg-lm-black border border-lm-terminal-gray px-3 flex items-center justify-end">
              <span className={`lm-mono text-sm ${quoteDisplay && quoteDisplay !== "No liquidity" ? "text-white font-bold" : "text-lm-terminal-lightgray"}`}>
                {quoteDisplay || "—"}
              </span>
            </div>
          ) : (
            <Input value={amount || ""} onValueChange={onAmountChange} placeholder="0.0" className="h-10 text-sm font-bold" />
          )}
        </div>

        {/* MAX button */}
        {onMax && balance && Number(balance) > 0 && (
          <button
            type="button"
            onClick={onMax}
            className="h-10 px-2 text-[10px] font-bold text-lm-orange border border-lm-orange/30 hover:border-lm-orange hover:bg-lm-orange/5 transition-colors lm-upper"
          >
            Max
          </button>
        )}
      </div>

      {/* Custom address input */}
      {isCustom && (
        <div className="space-y-1">
          <input
            className="lm-input text-left text-xs h-8"
            placeholder="Paste token address (0x...)"
            value={customAddr}
            onChange={(e) => onCustomAddr(e.target.value)}
          />
          {customMeta ? (
            <div className="text-lm-green text-[10px] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-lm-green" />
              Detected: <span className="text-white font-bold">{customMeta.symbol}</span> ({customMeta.decimals} decimals)
            </div>
          ) : customAddr.length === 42 ? (
            <div className="text-lm-terminal-lightgray text-[10px] animate-pulse">Detecting token...</div>
          ) : null}
        </div>
      )}

      {/* Native ETH info */}
      {isNativeEth && (
        <div className="text-[9px] text-lm-terminal-lightgray flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.5 3h1v1h-1V4zm-1 2h3v1h-1v3h1v1h-3V10h1V7h-1V6z" />
          </svg>
          Auto-wraps to WETH for the swap
        </div>
      )}
    </div>
  );
}

/* ── Main Swap Panel ── */

export function SwapPanel() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const searchParams = useSearchParams();

  const [tokens, setTokens] = useState<ListedToken[]>([]);
  const [tokenInSelector, setTokenInSelector] = useState<string>("");
  const [tokenOutSelector, setTokenOutSelector] = useState<string>("");
  const [customInAddr, setCustomInAddr] = useState<string>("");
  const [customOutAddr, setCustomOutAddr] = useState<string>("");
  const [customInMeta, setCustomInMeta] = useState<ListedToken | null>(null);
  const [customOutMeta, setCustomOutMeta] = useState<ListedToken | null>(null);
  const [fee, setFee] = useState<number>(3000);
  const [amountIn, setAmountIn] = useState<string>("");
  const [quoteRaw, setQuoteRaw] = useState<bigint>(0n);
  const [quoteStr, setQuoteStr] = useState<string>("");
  const [quoting, setQuoting] = useState(false);
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [showSettings, setShowSettings] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [balanceIn, setBalanceIn] = useState<string>("");
  const [balanceOut, setBalanceOut] = useState<string>("");
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedQueryRef = useRef<string>("");
  const lastAutoFeeKeyRef = useRef<string>("");

  /* ── Derived token info ── */

  const tokenIn = useMemo(() => {
    if (isEthVirtual(tokenInSelector)) {
      return { addr: config.weth as Address, meta: { ...ETH_VIRTUAL, address: config.weth as Address }, isNativeEth: true };
    }
    if (tokenInSelector === "__custom__" && customInMeta && /^0x[0-9a-fA-F]{40}$/.test(customInAddr)) {
      return { addr: customInAddr as Address, meta: customInMeta, isNativeEth: false };
    }
    const found = tokens.find((t) => t.address === tokenInSelector);
    if (found) return { addr: found.address, meta: found, isNativeEth: false };
    return { addr: "" as Address, meta: null, isNativeEth: false };
  }, [tokenInSelector, customInAddr, customInMeta, tokens]);

  const tokenOut = useMemo(() => {
    if (isEthVirtual(tokenOutSelector)) {
      return { addr: config.weth as Address, meta: { ...ETH_VIRTUAL, address: config.weth as Address }, isNativeEth: true };
    }
    if (tokenOutSelector === "__custom__" && customOutMeta && /^0x[0-9a-fA-F]{40}$/.test(customOutAddr)) {
      return { addr: customOutAddr as Address, meta: customOutMeta, isNativeEth: false };
    }
    const found = tokens.find((t) => t.address === tokenOutSelector);
    if (found) return { addr: found.address, meta: found, isNativeEth: false };
    return { addr: "" as Address, meta: null, isNativeEth: false };
  }, [tokenOutSelector, customOutAddr, customOutMeta, tokens]);

  const wrapMode = useMemo(() => {
    // Wrap/unwap is always 1:1 and doesn't require a Uniswap pool.
    if (!config.weth) return null as null | { direction: "wrap" | "unwrap" };
    const inIsEth = tokenIn.isNativeEth;
    const outIsEth = tokenOut.isNativeEth;
    const inIsW = !!tokenIn.addr && isWeth(tokenIn.addr);
    const outIsW = !!tokenOut.addr && isWeth(tokenOut.addr);
    if (inIsEth && outIsW) return { direction: "wrap" as const };
    if (inIsW && outIsEth) return { direction: "unwrap" as const };
    return null;
  }, [tokenIn.addr, tokenIn.isNativeEth, tokenOut.addr, tokenOut.isNativeEth]);

  /* ── Custom token detection ── */

  useEffect(() => {
    if (tokenInSelector !== "__custom__" || !/^0x[0-9a-fA-F]{40}$/.test(customInAddr)) {
      setCustomInMeta(null); return;
    }
    (async () => {
      try {
        const [sym, dec] = await Promise.all([
          publicClient.readContract({ address: customInAddr as Address, abi: ERC20MetadataAbi, functionName: "symbol" }),
          publicClient.readContract({ address: customInAddr as Address, abi: ERC20MetadataAbi, functionName: "decimals" })
        ]);
        setCustomInMeta({ address: customInAddr as Address, symbol: sym as string, decimals: Number(dec), logoURI: "" });
      } catch { setCustomInMeta(null); }
    })();
  }, [tokenInSelector, customInAddr]);

  useEffect(() => {
    if (tokenOutSelector !== "__custom__" || !/^0x[0-9a-fA-F]{40}$/.test(customOutAddr)) {
      setCustomOutMeta(null); return;
    }
    (async () => {
      try {
        const [sym, dec] = await Promise.all([
          publicClient.readContract({ address: customOutAddr as Address, abi: ERC20MetadataAbi, functionName: "symbol" }),
          publicClient.readContract({ address: customOutAddr as Address, abi: ERC20MetadataAbi, functionName: "decimals" })
        ]);
        setCustomOutMeta({ address: customOutAddr as Address, symbol: sym as string, decimals: Number(dec), logoURI: "" });
      } catch { setCustomOutMeta(null); }
    })();
  }, [tokenOutSelector, customOutAddr]);

  /* ── Token list fetch ── */

  useEffect(() => {
    fetchWhitelistedTokens()
      .then((list) => {
        setTokens(list);
        if (!tokenInSelector) setTokenInSelector(ETH_VIRTUAL.address);
        if (!tokenOutSelector && list[0]) setTokenOutSelector(list[0].address);
      })
      .catch((e) => { setStatus(String(e?.message || e)); setStatusType("error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Allow deep-linking from other pages (Launcher, Marketplace, etc) without retyping addresses.
  // Examples:
  // - /exchange?out=0xToken&in=ETH
  // - /exchange?token=0xToken (defaults to in=ETH)
  // - /exchange?tokenIn=0xTokenA&tokenOut=0xTokenB
  useEffect(() => {
    const qIn = (searchParams.get("in") || searchParams.get("tokenIn") || "").trim();
    const qOut = (searchParams.get("out") || searchParams.get("tokenOut") || searchParams.get("token") || "").trim();
    const qFee = (searchParams.get("fee") || searchParams.get("feeTier") || "").trim();
    if (!qIn && !qOut) return;

    const key = `${qIn}|${qOut}|${qFee}`;
    if (appliedQueryRef.current === key) return;

    const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);
    const isEth = (s: string) => {
      const u = s.toUpperCase();
      return u === "ETH" || u === "WETH" || u === ETH_VIRTUAL.address.toUpperCase();
    };

    const setFromQuery = (side: "in" | "out", raw: string) => {
      if (!raw) return;
      if (isEth(raw)) {
        if (side === "in") setTokenInSelector(ETH_VIRTUAL.address);
        else setTokenOutSelector(ETH_VIRTUAL.address);
        return;
      }

      let addr = "";
      if (isAddr(raw)) addr = raw;
      else {
        const match = tokens.find((t) => t.symbol.toUpperCase() === raw.toUpperCase());
        if (match) addr = match.address;
      }
      if (!addr) return;

      const inList = tokens.find((t) => t.address.toLowerCase() === addr.toLowerCase());
      if (inList) {
        if (side === "in") setTokenInSelector(inList.address);
        else setTokenOutSelector(inList.address);
      } else {
        if (side === "in") {
          setTokenInSelector("__custom__");
          setCustomInAddr(addr);
        } else {
          setTokenOutSelector("__custom__");
          setCustomOutAddr(addr);
        }
      }
    };

    // If only token/out provided, default to buying (in=ETH).
    if (!qIn && qOut) setFromQuery("in", "ETH");
    if (qIn) setFromQuery("in", qIn);
    if (qOut) setFromQuery("out", qOut);

    if (qFee) {
      const n = Number(qFee);
      if ([500, 3000, 10000].includes(n)) setFee(n);
    }

    appliedQueryRef.current = key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tokens]);

  /* ── Intent listener — auto-fill from IntentTerminal ── */

  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const flipTokensRef = useRef(flipTokens);
  flipTokensRef.current = flipTokens;
  const balanceInRef = useRef(balanceIn);
  balanceInRef.current = balanceIn;

  useIntentListener(useCallback((intent: IntentAction) => {
    if (intent.type === "swap") {
      const toks = tokensRef.current;
      const findToken = (sym?: string): string | undefined => {
        if (!sym) return undefined;
        const upper = sym.toUpperCase();
        if (upper === "ETH" || upper === "WETH") return ETH_VIRTUAL.address;
        const match = toks.find((t) => t.symbol.toUpperCase() === upper);
        return match?.address;
      };
      const inAddr = findToken(intent.tokenIn);
      const outAddr = findToken(intent.tokenOut);
      if (inAddr) setTokenInSelector(inAddr);
      if (outAddr) setTokenOutSelector(outAddr);
      if (intent.amount) setAmountIn(intent.amount);
      if (intent.fee) setFee(Number(intent.fee));
      if (intent.slippage) setSlippageBps(Number(intent.slippage));
    } else if (intent.type === "flip_tokens") {
      flipTokensRef.current();
    } else if (intent.type === "max_balance") {
      if (balanceInRef.current) setAmountIn(balanceInRef.current);
    } else if (intent.type === "set_fee") {
      setFee(Number(intent.fee));
    } else if (intent.type === "set_slippage") {
      setSlippageBps(Number(intent.bps));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  /* ── Balance fetch ── */

  useEffect(() => {
    if (!address) { setBalanceIn(""); setBalanceOut(""); return; }
    (async () => {
      if (tokenIn.isNativeEth) {
        try { setBalanceIn(formatUnits(await publicClient.getBalance({ address }), 18)); } catch { setBalanceIn("?"); }
      } else if (tokenIn.addr && tokenIn.meta) {
        try {
          const bal = (await publicClient.readContract({ address: tokenIn.addr, abi: ERC20Abi, functionName: "balanceOf", args: [address] })) as bigint;
          setBalanceIn(formatUnits(bal, tokenIn.meta.decimals));
        } catch { setBalanceIn("?"); }
      } else { setBalanceIn(""); }

      if (tokenOut.isNativeEth) {
        try { setBalanceOut(formatUnits(await publicClient.getBalance({ address }), 18)); } catch { setBalanceOut("?"); }
      } else if (tokenOut.addr && tokenOut.meta) {
        try {
          const bal = (await publicClient.readContract({ address: tokenOut.addr, abi: ERC20Abi, functionName: "balanceOf", args: [address] })) as bigint;
          setBalanceOut(formatUnits(bal, tokenOut.meta.decimals));
        } catch { setBalanceOut("?"); }
      } else { setBalanceOut(""); }
    })();
  }, [address, tokenIn.addr, tokenIn.isNativeEth, tokenIn.meta, tokenOut.addr, tokenOut.isNativeEth, tokenOut.meta]);

  /* ── Quote engine ── */

  const refreshQuote = useCallback(async () => {
    if (wrapMode) {
      setQuoting(false);
      const raw = (amountIn || "").trim();
      if (!raw || raw === "0" || raw === "0." || raw === ".") { setQuoteRaw(0n); setQuoteStr(""); return; }
      try {
        const amt = parseUnits(raw, 18);
        setQuoteRaw(amt);
        setQuoteStr(raw);
      } catch {
        setQuoteRaw(0n);
        setQuoteStr("");
      }
      return;
    }

    if (!config.quoterV2 || !tokenIn.addr || !tokenOut.addr || !tokenIn.meta || !tokenOut.meta) return;
    const raw = (amountIn || "").trim();
    if (!raw || raw === "0" || raw === "0." || raw === ".") { setQuoteRaw(0n); setQuoteStr(""); return; }
    setQuoting(true);
    try {
      const amt = parseUnits(raw, tokenIn.meta.decimals);
      if (amt === 0n) { setQuoteRaw(0n); setQuoteStr(""); return; }

      const tryQuote = async (feeTier: number) => {
        const res = (await publicClient.readContract({
          address: config.quoterV2,
          abi: QuoterV2Abi,
          functionName: "quoteExactInputSingle",
          args: [{ tokenIn: tokenIn.addr, tokenOut: tokenOut.addr, amountIn: amt, fee: feeTier, sqrtPriceLimitX96: 0n }]
        })) as unknown as readonly [bigint, bigint, number, bigint];
        return res[0];
      };

      // Common "No liquidity" false negative: pool exists but at a different fee tier.
      const feeOrder = [fee, ...FEE_OPTIONS.map((o) => o.fee).filter((f) => f !== fee)];
      let outAmt: bigint | null = null;
      let usedFee = fee;
      for (const f of feeOrder) {
        try {
          const q = await tryQuote(f);
          if (q > 0n) { outAmt = q; usedFee = f; break; }
        } catch { /* try next tier */ }
      }

      if (outAmt === null) {
        setQuoteRaw(0n);
        setQuoteStr("No liquidity");
        return;
      }

      setQuoteRaw(outAmt);
      setQuoteStr(formatUnits(outAmt, tokenOut.meta.decimals));

      // Auto-switch the UI fee tier only when we detect a better one; avoid thrashing.
      const autoKey = `${tokenIn.addr.toLowerCase()}|${tokenOut.addr.toLowerCase()}|${amt.toString()}`;
      if (usedFee !== fee && lastAutoFeeKeyRef.current !== autoKey) {
        lastAutoFeeKeyRef.current = autoKey;
        setFee(usedFee);
      }
    } finally {
      setQuoting(false);
    }
  }, [amountIn, fee, tokenIn.addr, tokenIn.meta, tokenOut.addr, tokenOut.meta, wrapMode]);

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => { refreshQuote().catch(() => {}); }, 400);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  }, [refreshQuote]);

  /* ── Computed swap details ── */

  const exchangeRate = useMemo(() => {
    if (!amountIn || !quoteStr || quoteStr === "No liquidity" || !tokenIn.meta || !tokenOut.meta) return null;
    const inNum = Number(amountIn);
    const outNum = Number(quoteStr);
    if (inNum <= 0 || outNum <= 0) return null;
    return {
      forward: outNum / inNum,
      inverse: inNum / outNum,
      inSymbol: tokenIn.isNativeEth ? "ETH" : tokenIn.meta.symbol,
      outSymbol: tokenOut.isNativeEth ? "ETH" : tokenOut.meta.symbol
    };
  }, [amountIn, quoteStr, tokenIn.meta, tokenIn.isNativeEth, tokenOut.meta, tokenOut.isNativeEth]);

  const minReceived = useMemo(() => {
    if (quoteRaw <= 0n) return 0n;
    return (quoteRaw * (10_000n - BigInt(slippageBps))) / 10_000n;
  }, [quoteRaw, slippageBps]);

  /* ── Swap action ── */

  async function ensureAllowance(owner: Address, spender: Address, token: Address, needed: bigint, symbol: string) {
    const allowance = (await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "allowance", args: [owner, spender] })) as bigint;
    if (allowance >= needed) return;
    setStatus(`Approving ${symbol}...`);
    setStatusType("info");
    if (!walletClient) throw new Error("No wallet client");
    const hash = await walletClient.writeContract({ address: token, abi: ERC20Abi, functionName: "approve", args: [spender, needed], chain: robinhoodTestnet, account: owner });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function doSwap() {
    if (!address) { setStatus("Connect wallet to swap."); setStatusType("error"); return; }
    if (!config.swapRouter || !tokenIn.addr || !tokenOut.addr || !tokenIn.meta || !tokenOut.meta) { setStatus("Select valid tokens."); setStatusType("error"); return; }

    const iSymbol = tokenIn.isNativeEth ? "ETH" : tokenIn.meta.symbol;
    const oSymbol = tokenOut.isNativeEth ? "ETH" : tokenOut.meta.symbol;

    setBusy(true);
    setLastTxHash("");
    try {
      const raw = (amountIn || "").trim();
      const amt = parseUnits(raw || "0", tokenIn.meta.decimals);
      if (amt === 0n) throw new Error("Amount must be greater than 0");

      // Balance check
      if (balanceIn) {
        const userBal = parseUnits(balanceIn, tokenIn.meta.decimals);
        if (amt > userBal) {
          setStatus(`Insufficient ${iSymbol} balance. You have ${fmtBal(balanceIn)} but need ${raw}.`);
          setStatusType("error");
          setBusy(false);
          return;
        }
      }

      setStatus(`Preparing swap: ${raw} ${iSymbol} → ${oSymbol}...`);
      setStatusType("info");
      await requireCorrectChain();
      if (!walletClient) throw new Error("No wallet client");

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);
      const slip = BigInt(Math.max(0, Math.min(3000, slippageBps)));

      let mOut = 0n;
      try {
        const q = (await publicClient.readContract({
          address: config.quoterV2,
          abi: QuoterV2Abi,
          functionName: "quoteExactInputSingle",
          args: [{ tokenIn: tokenIn.addr, tokenOut: tokenOut.addr, amountIn: amt, fee, sqrtPriceLimitX96: 0n }]
        })) as unknown as readonly [bigint, bigint, number, bigint];
        mOut = (q[0] * (10_000n - slip)) / 10_000n;
      } catch {
        setStatus("Could not fetch quote. Pool may not have liquidity for this pair.");
        setStatusType("error");
        setBusy(false);
        return;
      }

      const ethIn = tokenIn.isNativeEth;
      const ethOut = tokenOut.isNativeEth;

      let hash: `0x${string}`;

      if (ethOut) {
        if (!ethIn) await ensureAllowance(address, config.swapRouter, tokenIn.addr, amt, iSymbol);
        setStatus(`Swapping ${raw} ${iSymbol} → ~${quoteStr ? fmtBal(quoteStr) : "?"} ${oSymbol}...`);
        setStatusType("info");
        const swapData = encodeFunctionData({
          abi: SwapRouterAbi,
          functionName: "exactInputSingle",
          args: [{
            tokenIn: tokenIn.addr, tokenOut: tokenOut.addr, fee,
            recipient: config.swapRouter, deadline, amountIn: amt,
            amountOutMinimum: mOut, sqrtPriceLimitX96: 0n
          }]
        });
        const unwrapData = encodeFunctionData({
          abi: SwapRouterAbi,
          functionName: "unwrapWETH9",
          args: [mOut, address]
        });
        hash = await walletClient.writeContract({
          address: config.swapRouter, abi: SwapRouterAbi, functionName: "multicall",
          args: [[swapData, unwrapData]], value: ethIn ? amt : 0n,
          chain: robinhoodTestnet, account: address
        });
      } else {
        if (!ethIn) await ensureAllowance(address, config.swapRouter, tokenIn.addr, amt, iSymbol);
        setStatus(`Swapping ${raw} ${iSymbol} → ~${quoteStr ? fmtBal(quoteStr) : "?"} ${oSymbol}...`);
        setStatusType("info");
        hash = await walletClient.writeContract({
          address: config.swapRouter, abi: SwapRouterAbi, functionName: "exactInputSingle",
          args: [{
            tokenIn: tokenIn.addr, tokenOut: tokenOut.addr, fee,
            recipient: address, deadline, amountIn: amt,
            amountOutMinimum: mOut, sqrtPriceLimitX96: 0n
          }],
          value: ethIn ? amt : 0n, chain: robinhoodTestnet, account: address
        });
      }

      setLastTxHash(hash);
      setStatus("Confirming on-chain...");
      setStatusType("info");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        setStatus(`Swap confirmed! Received ~${quoteStr ? fmtBal(quoteStr) : "?"} ${oSymbol}`);
        setStatusType("success");
        setAmountIn("");
      } else {
        setStatus("Transaction reverted. The price may have moved beyond your slippage tolerance.");
        setStatusType("error");
      }
      refreshQuote().catch(() => {});
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled by user.");
      } else {
        setStatus(`Swap failed: ${msg}`);
      }
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  async function doWrapOrUnwrap() {
    if (!wrapMode) return;
    if (!address) { setStatus("Connect wallet to wrap."); setStatusType("error"); return; }
    if (!walletClient) { setStatus("Connect wallet to wrap."); setStatusType("error"); return; }
    if (!config.weth) { setStatus("Missing WETH address in config."); setStatusType("error"); return; }

    setBusy(true);
    setLastTxHash("");
    try {
      const raw = (amountIn || "").trim();
      const amt = parseUnits(raw || "0", 18);
      if (amt === 0n) throw new Error("Amount must be greater than 0");
      await requireCorrectChain();

      if (wrapMode.direction === "wrap") {
        setStatus(`Wrapping ${raw} ETH → WETH...`);
        setStatusType("info");
        const hash = await walletClient.writeContract({
          address: config.weth as Address,
          abi: Weth9Abi,
          functionName: "deposit",
          args: [],
          value: amt,
          chain: robinhoodTestnet,
          account: address
        });
        setLastTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus("Wrap confirmed!");
        setStatusType("success");
      } else {
        setStatus(`Unwrapping ${raw} WETH → ETH...`);
        setStatusType("info");
        const hash = await walletClient.writeContract({
          address: config.weth as Address,
          abi: Weth9Abi,
          functionName: "withdraw",
          args: [amt],
          chain: robinhoodTestnet,
          account: address
        });
        setLastTxHash(hash);
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus("Unwrap confirmed!");
        setStatusType("success");
      }

      setAmountIn("");
      setQuoteRaw(0n);
      setQuoteStr("");
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled by user.");
      } else {
        setStatus(`Wrap failed: ${msg}`);
      }
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  function flipTokens() {
    const tmpSel = tokenInSelector;
    const tmpCustom = customInAddr;
    const tmpMeta = customInMeta;
    setTokenInSelector(tokenOutSelector);
    setCustomInAddr(customOutAddr);
    setCustomInMeta(customOutMeta);
    setTokenOutSelector(tmpSel);
    setCustomOutAddr(tmpCustom);
    setCustomOutMeta(tmpMeta);
    setAmountIn("");
    setQuoteRaw(0n);
    setQuoteStr("");
  }

  const inSymbol = tokenIn.isNativeEth ? "ETH" : (tokenIn.meta?.symbol || "");
  const outSymbol = tokenOut.isNativeEth ? "ETH" : (tokenOut.meta?.symbol || "");
  const quoteDisplay = quoting
    ? "Quoting..."
    : quoteStr && quoteStr !== "No liquidity"
      ? `${fmtBal(quoteStr)} ${outSymbol}`
      : quoteStr;
  const canSwap = tokenIn.addr && tokenOut.addr && amountIn && Number(amountIn) > 0 && quoteStr && quoteStr !== "No liquidity";

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";

  /* ── Price impact ── */
  const priceImpact = useMemo(() => {
    if (!exchangeRate || !quoteStr || quoteStr === "No liquidity") return null;
    return null; // Would need a reference price; show as low for now
  }, [exchangeRate, quoteStr]);

  const insufficientBal = !!balanceIn && !!amountIn && Number(amountIn) > Number(balanceIn);

  /* ── Button label ── */
  const btnLabel = busy
    ? "Processing..."
    : !address
      ? "Connect Wallet"
      : !tokenIn.addr || !tokenOut.addr
        ? "Select Tokens"
        : !amountIn || Number(amountIn) <= 0
          ? "Enter Amount"
          : wrapMode
            ? (wrapMode.direction === "wrap" ? "Wrap ETH to WETH" : "Unwrap WETH to ETH")
            : quoteStr === "No liquidity"
            ? "No Liquidity for This Pair"
            : insufficientBal
              ? `Insufficient ${inSymbol} Balance`
              : `Swap ${inSymbol} for ${outSymbol}`;

  const btnDisabled = wrapMode
    ? (!amountIn || Number(amountIn) <= 0 || busy || insufficientBal)
    : (!canSwap || busy || insufficientBal);

  return (
    <div className="lm-swap-card p-1">
      {/* ── You Pay ── */}
      <TokenSelector
        tokens={tokens}
        value={tokenInSelector}
        onChange={setTokenInSelector}
        customAddr={customInAddr}
        onCustomAddr={setCustomInAddr}
        customMeta={customInMeta}
        label="You Pay"
        balance={balanceIn || undefined}
        symbol={inSymbol}
        onMax={() => { if (balanceIn) setAmountIn(balanceIn); }}
        amount={amountIn}
        onAmountChange={setAmountIn}
        isNativeEth={tokenIn.isNativeEth}
      />

      {/* ── Flip Button (Uniswap-style centered) ── */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          type="button"
          onClick={flipTokens}
          disabled={busy}
          className="w-10 h-10 flex items-center justify-center bg-lm-terminal-darkgray border-2 border-lm-terminal-gray hover:border-lm-orange hover:bg-lm-black text-lm-terminal-lightgray hover:text-lm-orange group disabled:opacity-40 disabled:pointer-events-none"
          title="Flip tokens"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300">
            <path fillRule="evenodd" d="M2.24 6.8a.75.75 0 001.06-.04l1.95-2.1v8.59a.75.75 0 001.5 0V4.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L2.2 5.74a.75.75 0 00.04 1.06zm8 6.4a.75.75 0 00-.04 1.06l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75a.75.75 0 00-1.5 0v8.59l-1.95-2.1a.75.75 0 00-1.06-.04z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── You Receive ── */}
      <TokenSelector
        tokens={tokens}
        value={tokenOutSelector}
        onChange={setTokenOutSelector}
        customAddr={customOutAddr}
        onCustomAddr={setCustomOutAddr}
        customMeta={customOutMeta}
        label="You Receive"
        balance={balanceOut || undefined}
        symbol={outSymbol}
        amountReadonly
        quoteDisplay={quoteDisplay}
        isNativeEth={tokenOut.isNativeEth}
      />

      {/* ── Swap Details (Uniswap-style expandable) ── */}
      {(exchangeRate || canSwap) && (
        <div className="mx-1 mt-2">
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center justify-between w-full py-2 px-2 text-[10px] hover:bg-lm-terminal-darkgray/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-lm-terminal-lightgray">
              {exchangeRate && (
                <span className="text-white lm-mono">
                  1 {exchangeRate.inSymbol} = {fmtRate(exchangeRate.forward)} {exchangeRate.outSymbol}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-lm-terminal-lightgray">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                <path fillRule="evenodd" d="M6.955 1.45A.5.5 0 017.452 1h1.096a.5.5 0 01.497.45l.17 1.699c.484.12.94.312 1.356.562l1.321-.916a.5.5 0 01.67.033l.774.775a.5.5 0 01.033.67l-.916 1.32c.25.417.443.873.563 1.357l1.699.17a.5.5 0 01.45.497v1.096a.5.5 0 01-.45.497l-1.699.17c-.12.484-.312.94-.562 1.356l.916 1.321a.5.5 0 01-.034.67l-.774.774a.5.5 0 01-.67.033l-1.32-.916c-.417.25-.873.443-1.357.563l-.17 1.699a.5.5 0 01-.497.45H7.452a.5.5 0 01-.497-.45l-.17-1.699a4.973 4.973 0 01-1.356-.562l-1.321.916a.5.5 0 01-.67-.034l-.774-.774a.5.5 0 01-.034-.67l.916-1.32a4.973 4.973 0 01-.562-1.357l-1.699-.17A.5.5 0 011 8.548V7.452a.5.5 0 01.45-.497l1.699-.17c.12-.484.312-.94.562-1.356l-.916-1.321a.5.5 0 01.034-.67l.774-.774a.5.5 0 01.67-.033l1.32.916c.417-.25.873-.443 1.357-.563l.17-1.699zM8 10a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${showSettings ? "rotate-180" : ""}`}>
                <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
              </svg>
            </div>
          </button>

          {showSettings && (
            <div className="bg-lm-black border border-lm-terminal-gray/50 p-3 space-y-3 mt-1 lm-fade-in">
              {/* Swap summary */}
              {canSwap && tokenOut.meta && (
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-lm-terminal-lightgray">Minimum received</span>
                    <span className="text-white lm-mono font-bold">
                      {fmtBal(formatUnits(minReceived, tokenOut.meta.decimals))} {outSymbol}
                    </span>
                  </div>
                  {(tokenIn.isNativeEth || tokenOut.isNativeEth) && (
                    <div className="flex items-center justify-between">
                      <span className="text-lm-terminal-lightgray">Route</span>
                      <div className="flex items-center gap-1 text-white lm-mono">
                        <span>{inSymbol}</span>
                        <span className="text-lm-terminal-lightgray">→</span>
                        {tokenIn.isNativeEth && <><span className="text-lm-terminal-lightgray">WETH</span><span className="text-lm-terminal-lightgray">→</span></>}
                        {tokenOut.isNativeEth && <><span className="text-lm-terminal-lightgray">WETH</span><span className="text-lm-terminal-lightgray">→</span></>}
                        <span>{outSymbol}</span>
                      </div>
                    </div>
                  )}
                  <div className="h-px bg-lm-terminal-gray/30 my-1" />
                </div>
              )}

              {/* Fee Tier */}
              <div className="space-y-1.5">
                <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Fee Tier</div>
                <div className="flex gap-1">
                  {FEE_OPTIONS.map((o) => (
                    <button
                      key={o.fee}
                      type="button"
                      onClick={() => setFee(o.fee)}
                      className={`flex-1 py-2 border text-center ${
                        fee === o.fee
                          ? "border-lm-orange text-lm-orange bg-lm-orange/5"
                          : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                      }`}
                    >
                      <div className="text-xs font-bold">{o.label}</div>
                      <div className="text-[9px] opacity-60">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Slippage */}
              <div className="space-y-1.5">
                <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Max Slippage</div>
                <div className="flex gap-1">
                  {SLIPPAGE_OPTIONS.map((o) => (
                    <button
                      key={o.bps}
                      type="button"
                      onClick={() => setSlippageBps(o.bps)}
                      className={`flex-1 text-xs py-2 border ${
                        slippageBps === o.bps
                          ? "border-lm-orange text-lm-orange bg-lm-orange/5"
                          : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="text-[9px] text-lm-terminal-lightgray">
                  Swap reverts if price moves beyond this tolerance.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Balance Warning ── */}
      {insufficientBal && (
        <div className="mx-1 mt-1.5 lm-callout lm-callout-red text-[10px] flex items-center gap-2">
          <span className="lm-dot lm-dot-red" />
          <span>Insufficient balance. You have <span className="text-white font-bold">{fmtBal(balanceIn)}</span> {inSymbol} but need <span className="text-white font-bold">{amountIn}</span>.</span>
        </div>
      )}

      {/* ── Action Button ── */}
      <div className="p-1 pt-2">
        <Button
          onClick={wrapMode ? doWrapOrUnwrap : doSwap}
          loading={busy}
          disabled={btnDisabled}
          variant={btnDisabled ? "default" : "primary"}
          size="lg"
          className={`w-full ${!btnDisabled ? "bg-lm-orange text-black" : ""}`}
        >
          {btnLabel}
        </Button>
      </div>

      {/* ── Status ── */}
      {status && (
        <div className={`mx-1 mb-1 text-xs p-2.5 border bg-lm-black flex items-center justify-between gap-2 ${statusColor} ${
          statusType === "success" ? "border-lm-green/20" : statusType === "error" ? "border-lm-red/20" : "border-lm-terminal-gray"
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            {statusType === "info" && <span className="lm-spinner flex-shrink-0" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
            {statusType === "success" && <span className="lm-dot lm-dot-green flex-shrink-0" />}
            {statusType === "error" && <span className="lm-dot lm-dot-red flex-shrink-0" />}
            <span className="truncate">{status}</span>
          </div>
          {lastTxHash && (
            <a
              href={explorerTx(lastTxHash)}
              target="_blank"
              rel="noreferrer"
              className="text-lm-orange hover:underline text-[10px] flex-shrink-0"
            >
              View Tx →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
