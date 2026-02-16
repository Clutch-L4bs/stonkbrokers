"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Address, formatUnits, parseUnits } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { fetchWhitelistedTokens, ListedToken } from "../../lib/registry";
import { config } from "../../lib/config";
import { NonfungiblePositionManagerAbi, ERC20Abi, UniswapV3FactoryAbi, UniswapV3PoolAbi } from "../../lib/abis";
import { publicClient } from "../../providers";
import { useWallet } from "../../wallet/WalletProvider";
import { robinhoodTestnet } from "../../providers";
import { useIntentListener, IntentAction } from "../../components/IntentTerminal";

/* ── Fee options with human hints ── */

const FEE_OPTIONS: Array<{ label: string; fee: number; tickSpacing: number; hint: string }> = [
  { label: "0.05%", fee: 500, tickSpacing: 10, hint: "Stables" },
  { label: "0.30%", fee: 3000, tickSpacing: 60, hint: "Standard" },
  { label: "1.00%", fee: 10000, tickSpacing: 200, hint: "Volatile" }
];

const SLIPPAGE_OPTIONS = [
  { label: "0.5%", bps: 50 },
  { label: "1%", bps: 100 },
  { label: "3%", bps: 300 }
];

/* ── Math utilities ── */

function fullRangeTicks(tickSpacing: number) {
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;
  const floor = (tick: number) => {
    let floored = Math.trunc(tick / tickSpacing) * tickSpacing;
    if (tick < 0 && floored > tick) floored -= tickSpacing;
    return floored;
  };
  return { tickLower: floor(MIN_TICK), tickUpper: floor(MAX_TICK) };
}

function clampTick(t: number) {
  if (t < -887272) return -887272;
  if (t > 887272) return 887272;
  return t;
}

function floorTick(tick: number, tickSpacing: number) {
  let floored = Math.trunc(tick / tickSpacing) * tickSpacing;
  if (tick < 0 && floored > tick) floored -= tickSpacing;
  return clampTick(floored);
}

function ceilTick(tick: number, tickSpacing: number) {
  const f = floorTick(tick, tickSpacing);
  if (f === tick) return f;
  return clampTick(f + tickSpacing);
}

function tickToPrice(tick: number, dec0: number, dec1: number): number {
  const rawPrice = Math.pow(1.0001, tick);
  const decimalAdj = Math.pow(10, dec0 - dec1);
  return rawPrice * decimalAdj;
}

function fmtHumanPrice(p: number): string {
  if (p === 0 || !Number.isFinite(p)) return "—";
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `${(p / 1_000).toFixed(2)}K`;
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  if (p >= 0.0000001) return p.toFixed(10);
  return p.toExponential(2);
}

function formatRatio(n: bigint, d: bigint, decimals = 6): string {
  if (d === 0n) return "0";
  const scale = 10n ** BigInt(decimals);
  const v = (n * scale) / d;
  const s = v.toString().padStart(decimals + 1, "0");
  const head = s.slice(0, -decimals);
  const tail = s.slice(-decimals);
  return `${head}.${tail}`.replace(/\.?0+$/, (m) => (m === "." ? "" : ""));
}

function pow10(n: number): bigint {
  if (n <= 0) return 1n;
  return 10n ** BigInt(n);
}

function scalePriceHumanToRawScaled(pHumanScaled1e18: bigint, dec0: number, dec1: number): bigint {
  if (dec1 > dec0) return pHumanScaled1e18 * pow10(dec1 - dec0);
  if (dec0 > dec1) return pHumanScaled1e18 / pow10(dec0 - dec1);
  return pHumanScaled1e18;
}

function sqrtRatioAtTick(tick: number): bigint {
  if (tick < -887272 || tick > 887272) throw new Error("tick out of range");
  let absTick = tick < 0 ? -tick : tick;
  let ratio =
    (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;
  if (tick > 0) ratio = ((1n << 256n) - 1n) / ratio;
  const roundUp = (ratio & ((1n << 32n) - 1n)) !== 0n;
  return (ratio >> 32n) + (roundUp ? 1n : 0n);
}

function priceFromSqrtX96(sqrtPriceX96: bigint): { num: bigint; den: bigint } {
  const Q192 = 2n ** 192n;
  return { num: sqrtPriceX96 * sqrtPriceX96, den: Q192 };
}

function mulDiv(a: bigint, b: bigint, d: bigint): bigint {
  if (d === 0n) throw new Error("div by zero");
  return (a * b) / d;
}

function liqForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  const Q96 = 2n ** 96n;
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return mulDiv(amount0, mulDiv(sqrtA, sqrtB, Q96), sqrtB - sqrtA);
}

function liqForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  const Q96 = 2n ** 96n;
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return mulDiv(amount1, Q96, sqrtB - sqrtA);
}

function amountsForLiquidity(sqrtP: bigint, sqrtA: bigint, sqrtB: bigint, liquidity: bigint): { amount0: bigint; amount1: bigint } {
  const Q96 = 2n ** 96n;
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  if (sqrtP <= sqrtA) {
    return { amount0: mulDiv(liquidity, (sqrtB - sqrtA) * Q96, sqrtA * sqrtB), amount1: 0n };
  }
  if (sqrtP < sqrtB) {
    return {
      amount0: mulDiv(liquidity, (sqrtB - sqrtP) * Q96, sqrtP * sqrtB),
      amount1: mulDiv(liquidity, sqrtP - sqrtA, Q96)
    };
  }
  return { amount0: 0n, amount1: mulDiv(liquidity, sqrtB - sqrtA, Q96) };
}

function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
}

function fmtBal(raw: string): string {
  const num = Number(raw);
  if (isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(6);
  return num.toExponential(2);
}

/* ── Component ── */

export function PoolsPanel() {
  const { address, walletClient, requireCorrectChain, connect } = useWallet();

  const [tokens, setTokens] = useState<ListedToken[]>([]);
  const [token0, setToken0] = useState<Address | "">("");
  const [token1, setToken1] = useState<Address | "">("");
  const [fee, setFee] = useState<number>(3000);
  const [initialPrice1Per0, setInitialPrice1Per0] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sqrtPriceX96Override, setSqrtPriceX96Override] = useState<string>("");
  const [amt0, setAmt0] = useState<string>("");
  const [amt1, setAmt1] = useState<string>("");
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [rangeMode, setRangeMode] = useState<"full" | "custom">("full");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [bal0, setBal0] = useState<string>("");
  const [bal1, setBal1] = useState<string>("");

  const t0 = useMemo(() => tokens.find((t) => t.address === token0), [tokens, token0]);
  const t1 = useMemo(() => tokens.find((t) => t.address === token1), [tokens, token1]);
  const feeMeta = useMemo(() => FEE_OPTIONS.find((f) => f.fee === fee), [fee]);

  const sorted = useMemo(() => {
    if (!token0 || !token1) return null;
    if ((token0 as string).toLowerCase() === (token1 as string).toLowerCase()) return null;
    const a = (token0 as string).toLowerCase() < (token1 as string).toLowerCase() ? (token0 as Address) : (token1 as Address);
    const b = (token0 as string).toLowerCase() < (token1 as string).toLowerCase() ? (token1 as Address) : (token0 as Address);
    return { token0: a, token1: b };
  }, [token0, token1]);

  const s0 = useMemo(() => (sorted ? tokens.find((t) => t.address === sorted.token0) : undefined), [sorted, tokens]);
  const s1 = useMemo(() => (sorted ? tokens.find((t) => t.address === sorted.token1) : undefined), [sorted, tokens]);

  const computedSqrtPriceX96 = useMemo(() => {
    try {
      if (!sorted || !s0 || !s1) return "";
      const pStr = (initialPrice1Per0 || "").trim();
      if (!pStr || pStr === "0") return "";
      const pHumanScaled = parseUnits(pStr, 18);
      if (pHumanScaled <= 0n) return "";
      const pScaled = scalePriceHumanToRawScaled(pHumanScaled, s0.decimals, s1.decimals);
      if (pScaled <= 0n) return "";
      const Q96 = 2n ** 96n;
      const x = (pScaled * (Q96 * Q96)) / 10n ** 18n;
      return sqrtBigInt(x).toString();
    } catch { return ""; }
  }, [initialPrice1Per0, s0, s1, sorted]);

  const sqrtPriceX96 = useMemo(
    () => (sqrtPriceX96Override.trim() ? sqrtPriceX96Override.trim() : computedSqrtPriceX96),
    [computedSqrtPriceX96, sqrtPriceX96Override]
  );

  /* ── Live pool data ── */
  const [poolAddr, setPoolAddr] = useState<Address | "">("");
  const [curTick, setCurTick] = useState<number | null>(null);
  const [curSqrt, setCurSqrt] = useState<bigint | null>(null);
  const [curPriceHuman, setCurPriceHuman] = useState<string>("");

  useEffect(() => {
    async function loadPool() {
      if (!config.uniFactory || !sorted || !feeMeta || !s0 || !s1) {
        setPoolAddr(""); setCurTick(null); setCurSqrt(null); setCurPriceHuman("");
        return;
      }
      try {
        const pool = (await publicClient.readContract({
          address: config.uniFactory, abi: UniswapV3FactoryAbi, functionName: "getPool",
          args: [sorted.token0, sorted.token1, fee]
        })) as Address;
        if (!pool || pool === ("0x0000000000000000000000000000000000000000" as Address)) {
          setPoolAddr(""); setCurTick(null); setCurSqrt(null); setCurPriceHuman("");
          return;
        }
        setPoolAddr(pool);
        const slot0 = (await publicClient.readContract({
          address: pool, abi: UniswapV3PoolAbi, functionName: "slot0"
        })) as unknown as readonly [bigint, number, number, number, number, number, boolean];
        const sqrt = slot0[0];
        const tick = slot0[1];
        setCurSqrt(sqrt);
        setCurTick(tick);
        const raw = priceFromSqrtX96(sqrt);
        const dec0 = BigInt(s0.decimals);
        const dec1 = BigInt(s1.decimals);
        let num = raw.num;
        let den = raw.den;
        if (dec0 > dec1) num = num * 10n ** (dec0 - dec1);
        if (dec1 > dec0) den = den * 10n ** (dec1 - dec0);
        setCurPriceHuman(formatRatio(num, den, 8));
      } catch {
        setPoolAddr(""); setCurTick(null); setCurSqrt(null); setCurPriceHuman("");
      }
    }
    loadPool().catch(() => {});
  }, [fee, feeMeta, s0, s1, sorted]);

  /* ── Balances ── */
  useEffect(() => {
    if (!address) { setBal0(""); setBal1(""); return; }
    (async () => {
      if (token0 && t0) {
        try {
          const b = (await publicClient.readContract({ address: token0, abi: ERC20Abi, functionName: "balanceOf", args: [address] })) as bigint;
          setBal0(formatUnits(b, t0.decimals));
        } catch { setBal0("?"); }
      } else { setBal0(""); }
      if (token1 && t1) {
        try {
          const b = (await publicClient.readContract({ address: token1, abi: ERC20Abi, functionName: "balanceOf", args: [address] })) as bigint;
          setBal1(formatUnits(b, t1.decimals));
        } catch { setBal1("?"); }
      } else { setBal1(""); }
    })();
  }, [address, token0, token1, t0, t1]);

  const rangeTicks = useMemo(() => {
    if (!feeMeta) return null;
    if (rangeMode === "full") return fullRangeTicks(feeMeta.tickSpacing);
    try {
      if (!s0 || !s1) return null;
      const min = (minPrice || "").trim();
      const max = (maxPrice || "").trim();
      if (!min || !max) return null;
      const pMin = Number(min);
      const pMax = Number(max);
      if (!Number.isFinite(pMin) || !Number.isFinite(pMax) || pMin <= 0 || pMax <= 0 || pMin >= pMax) return null;
      const exp = s1.decimals - s0.decimals;
      const rawMin = pMin * Math.pow(10, exp);
      const rawMax = pMax * Math.pow(10, exp);
      if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax) || rawMin <= 0 || rawMax <= 0) return null;
      const tickMin = Math.floor(Math.log(rawMin) / Math.log(1.0001));
      const tickMax = Math.floor(Math.log(rawMax) / Math.log(1.0001));
      return { tickLower: floorTick(tickMin, feeMeta.tickSpacing), tickUpper: ceilTick(tickMax, feeMeta.tickSpacing) };
    } catch { return null; }
  }, [feeMeta, maxPrice, minPrice, rangeMode, s0, s1]);

  /* Human-readable price range */
  const priceRange = useMemo(() => {
    if (!rangeTicks || !s0 || !s1) return null;
    const lower = tickToPrice(rangeTicks.tickLower, s0.decimals, s1.decimals);
    const upper = tickToPrice(rangeTicks.tickUpper, s0.decimals, s1.decimals);
    return { lower, upper };
  }, [rangeTicks, s0, s1]);

  const rangePreview = useMemo(() => {
    if (!rangeTicks || !feeMeta || !t0 || !t1 || !s0 || !s1 || !curSqrt || curTick === null) return null;
    try {
      const sqrtA = sqrtRatioAtTick(rangeTicks.tickLower);
      const sqrtB = sqrtRatioAtTick(rangeTicks.tickUpper);
      const a0In = parseUnits(amt0 || "0", t0.decimals);
      const a1In = parseUnits(amt1 || "0", t1.decimals);
      if (a0In === 0n && a1In === 0n) return { used0: 0n, used1: 0n, note: "Enter amounts to see preview." };
      if (!sorted) return null;
      const amount0Desired = sorted.token0.toLowerCase() === (token0 as string).toLowerCase() ? a0In : a1In;
      const amount1Desired = sorted.token0.toLowerCase() === (token0 as string).toLowerCase() ? a1In : a0In;
      let L: bigint;
      if (curSqrt <= (sqrtA < sqrtB ? sqrtA : sqrtB)) {
        L = liqForAmount0(sqrtA, sqrtB, amount0Desired);
      } else if (curSqrt >= (sqrtA > sqrtB ? sqrtA : sqrtB)) {
        L = liqForAmount1(sqrtA, sqrtB, amount1Desired);
      } else {
        const L0 = liqForAmount0(curSqrt, sqrtB, amount0Desired);
        const L1 = liqForAmount1(sqrtA, curSqrt, amount1Desired);
        L = L0 < L1 ? L0 : L1;
      }
      const { amount0: used0, amount1: used1 } = amountsForLiquidity(curSqrt, sqrtA, sqrtB, L);
      return { used0, used1, note: "" };
    } catch (e: any) {
      return { used0: 0n, used1: 0n, note: String(e?.message || e) };
    }
  }, [amt0, amt1, curSqrt, curTick, feeMeta, rangeTicks, s0, s1, sorted, t0, t1, token0]);

  useEffect(() => {
    fetchWhitelistedTokens()
      .then((list) => {
        setTokens(list);
        if (!token0 && list[0]) setToken0(list[0].address);
        if (!token1 && list[1]) setToken1(list[1].address);
      })
      .catch((e) => { setStatus(String(e?.message || e)); setStatusType("error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Intent listener — auto-fill from IntentTerminal ── */
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  useIntentListener(useCallback((intent: IntentAction) => {
    if (intent.type !== "add_liquidity" && intent.type !== "create_pool") return;
    const toks = tokensRef.current;
    const findToken = (sym?: string): Address | "" => {
      if (!sym) return "";
      const upper = sym.toUpperCase();
      const match = toks.find((t) => t.symbol.toUpperCase() === upper);
      return match?.address || "";
    };
    const t0Addr = findToken(intent.token0);
    const t1Addr = findToken(intent.token1);
    if (t0Addr) setToken0(t0Addr);
    if (t1Addr) setToken1(t1Addr);
    if (intent.fee) setFee(Number(intent.fee));
    if (intent.type === "create_pool" && intent.price) setInitialPrice1Per0(intent.price);
    if (intent.type === "add_liquidity") {
      if (intent.range === "full") setRangeMode("full");
      else if (intent.range === "custom") {
        setRangeMode("custom");
        if (intent.minPrice) setMinPrice(intent.minPrice);
        if (intent.maxPrice) setMaxPrice(intent.maxPrice);
      }
      if (intent.amount0) setAmt0(intent.amount0);
      if (intent.amount1) setAmt1(intent.amount1);
    }
  }, []));

  async function ensureAllowance(owner: Address, spender: Address, token: Address, needed: bigint) {
    const allowance = (await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "allowance", args: [owner, spender] })) as bigint;
    if (allowance >= needed) return;
    setStatus(`Approving ${tokens.find((t) => t.address === token)?.symbol || "token"}...`);
    setStatusType("info");
    if (!walletClient) throw new Error("No wallet client");
    const hash = await walletClient.writeContract({ address: token, abi: ERC20Abi, functionName: "approve", args: [spender, needed], chain: robinhoodTestnet, account: owner });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function createPool() {
    if (!address) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!config.positionManager || !sorted) return;
    const sym0 = t0?.symbol || "Token0";
    const sym1 = t1?.symbol || "Token1";
    setBusy(true);
    try {
      await requireCorrectChain();
      const sp = BigInt(sqrtPriceX96 || "0");
      if (sp === 0n) throw new Error("Set an initial price first (enter a price in the field above).");
      if (!walletClient) throw new Error("No wallet client");
      setStatus(`Creating ${sym0}/${sym1} pool (${feeMeta?.label} fee)...`); setStatusType("info");
      const hash = await walletClient.writeContract({
        address: config.positionManager, abi: NonfungiblePositionManagerAbi,
        functionName: "createAndInitializePoolIfNecessary",
        args: [sorted.token0, sorted.token1, fee, sp], value: 0n,
        chain: robinhoodTestnet, account: address
      });
      setStatus("Confirming pool creation on-chain...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") { setStatus(`Pool created! ${sym0}/${sym1} (${feeMeta?.label}) is now live.`); setStatusType("success"); }
      else { setStatus("Pool creation reverted. The pool may already exist for this pair + fee tier."); setStatusType("error"); }
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled.");
      } else {
        setStatus(`Create pool failed: ${msg}`);
      }
      setStatusType("error");
    } finally { setBusy(false); }
  }

  async function addLiquidity() {
    if (!address) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!config.positionManager || !token0 || !token1 || !t0 || !t1 || !feeMeta || !sorted) return;
    if (!rangeTicks) { setStatus("Invalid price range."); setStatusType("error"); return; }
    setBusy(true);
    try {
      await requireCorrectChain();
      const a0 = parseUnits(amt0 || "0", t0.decimals);
      const a1 = parseUnits(amt1 || "0", t1.decimals);
      if (a0 === 0n && a1 === 0n) throw new Error("Enter amount for at least one token");
      if (!walletClient) throw new Error("No wallet client");

      await ensureAllowance(address, config.positionManager, token0, a0);
      await ensureAllowance(address, config.positionManager, token1, a1);

      const { tickLower, tickUpper } = rangeTicks;
      const amount0Desired = sorted.token0.toLowerCase() === (token0 as string).toLowerCase() ? a0 : a1;
      const amount1Desired = sorted.token0.toLowerCase() === (token0 as string).toLowerCase() ? a1 : a0;
      const slip = BigInt(Math.max(0, Math.min(3000, slippageBps)));
      const amount0Min = (amount0Desired * (10_000n - slip)) / 10_000n;
      const amount1Min = (amount1Desired * (10_000n - slip)) / 10_000n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10);

      setStatus(`Minting LP: ${amt0 || "0"} ${t0.symbol} + ${amt1 || "0"} ${t1.symbol}...`); setStatusType("info");
      const hash = await walletClient.writeContract({
        address: config.positionManager, abi: NonfungiblePositionManagerAbi, functionName: "mint",
        args: [{
          token0: sorted.token0, token1: sorted.token1, fee, tickLower, tickUpper,
          amount0Desired, amount1Desired, amount0Min, amount1Min,
          recipient: address, deadline
        }],
        value: 0n, chain: robinhoodTestnet, account: address
      });
      setStatus("Confirming on-chain...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") { setStatus(`LP position minted! ${t0.symbol}/${t1.symbol} liquidity added. Check the Positions tab.`); setStatusType("success"); }
      else { setStatus("Mint transaction reverted. Check your balances and price range."); setStatusType("error"); }
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled.");
      } else {
        setStatus(`Add liquidity failed: ${msg}`);
      }
      setStatusType("error");
    } finally { setBusy(false); }
  }

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";
  const pairWarning = token0 && token1 && (token0 as string).toLowerCase() === (token1 as string).toLowerCase();

  return (
    <div className="space-y-3">
      {/* ── Pair Selection ── */}
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-3">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Select Token Pair</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Token A</div>
            <select
              className="w-full bg-lm-black border border-lm-terminal-gray hover:border-lm-orange p-2 text-sm h-9 text-white font-bold transition-colors disabled:opacity-40"
              value={token0}
              onChange={(e) => setToken0(e.target.value as Address)}
              disabled={busy}
            >
              {tokens.length === 0 && <option value="" disabled>Loading tokens...</option>}
              {tokens.map((t) => (
                <option key={t.address} value={t.address}>{t.symbol}</option>
              ))}
            </select>
            {bal0 && (
              <div className="text-[10px] text-lm-terminal-lightgray lm-mono">
                Balance: <span className="text-white">{fmtBal(bal0)}</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Token B</div>
            <select
              className="w-full bg-lm-black border border-lm-terminal-gray hover:border-lm-orange p-2 text-sm h-9 text-white font-bold transition-colors disabled:opacity-40"
              value={token1}
              onChange={(e) => setToken1(e.target.value as Address)}
              disabled={busy}
            >
              {tokens.length === 0 && <option value="" disabled>Loading tokens...</option>}
              {tokens.map((t) => (
                <option key={t.address} value={t.address}>{t.symbol}</option>
              ))}
            </select>
            {bal1 && (
              <div className="text-[10px] text-lm-terminal-lightgray lm-mono">
                Balance: <span className="text-white">{fmtBal(bal1)}</span>
              </div>
            )}
          </div>
        </div>
        {pairWarning && <div className="text-lm-red text-xs">Tokens must be different.</div>}

        {/* Fee tier */}
        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Trading Fee</div>
          <div className="flex gap-1">
            {FEE_OPTIONS.map((o) => (
              <button key={o.fee} type="button" onClick={() => setFee(o.fee)}
                className={`flex-1 py-2 border transition-colors text-center ${
                  fee === o.fee ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                }`}>
                <div className="text-xs font-bold">{o.label}</div>
                <div className="text-[9px] opacity-60">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Pool status (Camelot-style card) */}
        {sorted && (
          <div className={`text-xs bg-lm-black border p-3 space-y-1 ${poolAddr ? "border-lm-green/20" : "border-lm-red/20"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`lm-dot ${poolAddr ? "lm-dot-green lm-dot-pulse" : "lm-dot-red"}`} />
                <span className={poolAddr ? "text-lm-green font-bold" : "text-lm-red"}>{poolAddr ? "Pool Active" : "No Pool Found"}</span>
              </div>
              {poolAddr && (
                <a href={explorerAddr(poolAddr)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono text-[10px]">
                  {short(poolAddr)} →
                </a>
              )}
            </div>
            {curPriceHuman && s0 && s1 && (
              <div className="text-[10px] lm-mono flex items-center gap-1.5 pt-0.5">
                <span className="text-lm-terminal-lightgray">Current Price:</span>
                <span className="text-white font-bold">{curPriceHuman}</span>
                <span className="text-lm-terminal-lightgray">{s1.symbol}/{s0.symbol}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Create Pool ── */}
      {sorted && !poolAddr && (
        <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-3">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Initialize New Pool</div>
          <div className="text-lm-terminal-lightgray text-[10px]">
            This pair has no pool yet. Set an initial price to create one.
          </div>
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">
              Initial Price ({s1?.symbol || "B"} per {s0?.symbol || "A"})
            </div>
            <Input value={initialPrice1Per0} onValueChange={setInitialPrice1Per0} placeholder="e.g. 0.001" />
          </div>
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-lm-terminal-lightgray text-[10px] hover:text-lm-orange transition-colors">
            {showAdvanced ? "▾ Hide developer settings" : "▸ Developer settings"}
          </button>
          {showAdvanced && (
            <div className="space-y-1 text-[10px]">
              <div className="text-lm-terminal-lightgray">
                sqrtPriceX96 (auto: <span className="lm-mono text-lm-gray">{computedSqrtPriceX96 || "—"}</span>)
              </div>
              <Input value={sqrtPriceX96Override} onValueChange={setSqrtPriceX96Override} placeholder="Leave blank for auto" className="text-left text-xs" numeric={false} />
            </div>
          )}
          <Button onClick={address ? createPool : connect} loading={busy} disabled={busy || (!!address && !sqrtPriceX96)} variant="primary" size="lg" className="w-full">
            {busy ? "Creating Pool..." : !address ? "Connect Wallet" : "Create Pool"}
          </Button>
        </div>
      )}

      {/* ── Add Liquidity ── */}
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-3">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Add Liquidity</div>

        {/* Range mode */}
        <div className="space-y-1.5">
          <div className="text-lm-terminal-lightgray text-xs">Price Range</div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setRangeMode("full")}
              className={`flex-1 text-xs py-2 border transition-colors ${rangeMode === "full" ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
              <div className="font-bold">Full Range</div>
              <div className="text-[9px] opacity-60">Earn fees at any price</div>
            </button>
            <button type="button" onClick={() => setRangeMode("custom")}
              className={`flex-1 text-xs py-2 border transition-colors ${rangeMode === "custom" ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
              <div className="font-bold">Custom Range</div>
              <div className="text-[9px] opacity-60">Concentrated liquidity</div>
            </button>
          </div>
        </div>

        {/* Custom range inputs */}
        {rangeMode === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-lm-terminal-lightgray text-xs">Min Price ({s1?.symbol || "B"}/{s0?.symbol || "A"})</div>
              <Input value={minPrice} onValueChange={setMinPrice} placeholder="0.0005" />
            </div>
            <div className="space-y-1">
              <div className="text-lm-terminal-lightgray text-xs">Max Price ({s1?.symbol || "B"}/{s0?.symbol || "A"})</div>
              <Input value={maxPrice} onValueChange={setMaxPrice} placeholder="0.0020" />
            </div>
          </div>
        )}

        {/* Price range display */}
        {priceRange && s0 && s1 && (
          <div className="bg-lm-black border border-lm-terminal-gray p-2 flex items-center justify-between text-[10px]">
            <div>
              <span className="text-lm-terminal-lightgray">Low: </span>
              <span className="text-white lm-mono font-bold">{rangeMode === "full" ? "0" : fmtHumanPrice(priceRange.lower)}</span>
            </div>
            <span className="text-lm-terminal-gray">←→</span>
            <div>
              <span className="text-lm-terminal-lightgray">High: </span>
              <span className="text-white lm-mono font-bold">{rangeMode === "full" ? "∞" : fmtHumanPrice(priceRange.upper)}</span>
            </div>
            <span className="text-lm-terminal-lightgray">{s1.symbol}/{s0.symbol}</span>
          </div>
        )}

        {/* Token amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-lm-terminal-lightgray text-xs">{t0?.symbol || "Token A"}</div>
              {bal0 && Number(bal0) > 0 && (
                <button type="button" onClick={() => setAmt0(bal0)} className="text-[10px] text-lm-orange hover:underline">
                  MAX
                </button>
              )}
            </div>
            <Input value={amt0} onValueChange={setAmt0} placeholder="0.0" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-lm-terminal-lightgray text-xs">{t1?.symbol || "Token B"}</div>
              {bal1 && Number(bal1) > 0 && (
                <button type="button" onClick={() => setAmt1(bal1)} className="text-[10px] text-lm-orange hover:underline">
                  MAX
                </button>
              )}
            </div>
            <Input value={amt1} onValueChange={setAmt1} placeholder="0.0" />
          </div>
        </div>

        {/* Slippage */}
        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Slippage Tolerance</div>
          <div className="flex gap-1">
            {SLIPPAGE_OPTIONS.map((o) => (
              <button key={o.bps} type="button" onClick={() => setSlippageBps(o.bps)}
                className={`flex-1 text-xs py-1.5 border transition-colors ${
                  slippageBps === o.bps ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liquidity preview */}
        {rangePreview && (
          <div className="bg-lm-black border border-lm-terminal-gray p-2.5 space-y-1.5 text-[10px]">
            <div className="text-lm-terminal-lightgray lm-upper font-bold tracking-wider">Deposit Preview</div>
            {rangePreview.note ? (
              <div className="text-lm-terminal-lightgray">{rangePreview.note}</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-lm-terminal-lightgray">{s0?.symbol}</span>
                  <span className="text-white lm-mono font-bold">{s0 ? fmtBal(formatUnits(rangePreview.used0, s0.decimals)) : "0"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lm-terminal-lightgray">{s1?.symbol}</span>
                  <span className="text-white lm-mono font-bold">{s1 ? fmtBal(formatUnits(rangePreview.used1, s1.decimals)) : "0"}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <Button onClick={address ? addLiquidity : connect} loading={busy} disabled={busy || (!!address && !rangeTicks)} variant="primary" size="lg" className="w-full">
          {busy ? "Processing..." : !address ? "Connect Wallet" : "Add Liquidity"}
        </Button>
      </div>

      {/* Status */}
      {status && (
        <div className={`text-xs p-2.5 border bg-lm-black flex items-center gap-2 ${statusColor} ${
          statusType === "success" ? "border-lm-green/20" : statusType === "error" ? "border-lm-red/20" : "border-lm-terminal-gray"
        }`}>
          {statusType === "info" && <span className="lm-spinner flex-shrink-0" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
          {statusType === "success" && <span className="lm-dot lm-dot-green flex-shrink-0" />}
          {statusType === "error" && <span className="lm-dot lm-dot-red flex-shrink-0" />}
          <span>{status}</span>
        </div>
      )}
    </div>
  );
}
