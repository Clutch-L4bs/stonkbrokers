"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { Panel } from "../../components/Terminal";
import { TerminalTabs } from "../../components/Tabs";
import { Button } from "../../components/Button";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient } from "../../providers";
import { config } from "../../lib/config";
import { NonfungiblePositionManagerAbi, ERC20MetadataAbi, UniswapV3PoolAbi, UniswapV3FactoryAbi } from "../../lib/abis";
import { IntentTerminal, IntentAction, dispatchIntent } from "../../components/IntentTerminal";

type LpPos = {
  tokenId: bigint;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  sym0: string;
  sym1: string;
  dec0: number;
  dec1: number;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  priceLower: number;
  priceUpper: number;
  currentPrice: number;
  inRange: boolean;
};

function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function explorerTx(hash: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/tx/${hash}`;
}

function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
}

const MAX_UINT128 = 2n ** 128n - 1n;

function tickToPrice(tick: number, dec0: number, dec1: number): number {
  const rawPrice = Math.pow(1.0001, tick);
  const decimalAdj = Math.pow(10, dec0 - dec1);
  return rawPrice * decimalAdj;
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

function fmtHumanPrice(p: number): string {
  if (p === 0 || !Number.isFinite(p)) return "—";
  if (p >= 1e12) return `${(p / 1e12).toFixed(2)}T`;
  if (p >= 1e9) return `${(p / 1e9).toFixed(2)}B`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(2)}M`;
  if (p >= 1e3) return `${(p / 1e3).toFixed(2)}K`;
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  return fmtSmall(p);
}

function rangeBarPositions(lower: number, upper: number, current: number): { lo: number; hi: number; cur: number } | null {
  if (lower <= 0 || upper <= 0 || current <= 0) return null;
  const logLo = Math.log(lower);
  const logHi = Math.log(upper);
  const logCur = Math.log(current);
  const span = logHi - logLo;
  const padding = Math.max(span * 0.5, Math.abs(logCur - (logLo + logHi) / 2) * 1.2);
  const viewMin = Math.min(logLo, logCur) - padding * 0.3;
  const viewMax = Math.max(logHi, logCur) + padding * 0.3;
  const viewSpan = viewMax - viewMin;
  if (viewSpan <= 0) return null;
  return {
    lo: Math.max(0, Math.min(100, ((logLo - viewMin) / viewSpan) * 100)),
    hi: Math.max(0, Math.min(100, ((logHi - viewMin) / viewSpan) * 100)),
    cur: Math.max(0, Math.min(100, ((logCur - viewMin) / viewSpan) * 100))
  };
}

function fmtBal(raw: string): string {
  const num = Number(raw);
  if (isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  return fmtSmall(num);
}

function PositionsTab() {
  const { address, walletClient } = useWallet();
  const [positions, setPositions] = useState<LpPos[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<Record<string, "info" | "success" | "error">>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const npm = config.positionManager as Address;

  async function refresh() {
    if (!address || !npm) { setPositions([]); return; }
    setBusy(true);
    setStatus("Loading positions...");
    try {
      const bal = (await publicClient.readContract({
        address: npm, abi: NonfungiblePositionManagerAbi, functionName: "balanceOf", args: [address]
      })) as bigint;

      const cap = bal > 50n ? 50 : Number(bal);
      if (cap === 0) { setPositions([]); setStatus(""); setBusy(false); return; }

      const metaCache: Record<string, { sym: string; dec: number }> = {};

      async function getMeta(token: Address) {
        const key = token.toLowerCase();
        if (metaCache[key]) return metaCache[key];
        let sym = token.slice(0, 6);
        let dec = 18;
        try { sym = (await publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /* skip */ }
        try { dec = Number(await publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /* skip */ }
        metaCache[key] = { sym, dec };
        return metaCache[key];
      }

      const poolPriceCache: Record<string, number> = {};

      const tokenIdResults = await Promise.all(
        Array.from({ length: cap }, (_, i) =>
          publicClient.readContract({
            address: npm, abi: NonfungiblePositionManagerAbi, functionName: "tokenOfOwnerByIndex",
            args: [address, BigInt(i)]
          }).catch(() => null)
        )
      );
      const tokenIds = tokenIdResults.filter((id): id is bigint => id !== null);

      if (tokenIds.length === 0) { setPositions([]); setStatus(""); setBusy(false); return; }

      const posResults = await Promise.all(
        tokenIds.map((tokenId) =>
          publicClient.readContract({
            address: npm, abi: NonfungiblePositionManagerAbi, functionName: "positions", args: [tokenId]
          }).catch(() => null)
        )
      );

      const list: LpPos[] = [];

      for (let idx = 0; idx < tokenIds.length; idx++) {
        const tokenId = tokenIds[idx];
        const pos = posResults[idx] as any;
        if (!pos) continue;

        try {
          const t0Addr = (pos.token0 ?? pos[2]) as Address;
          const t1Addr = (pos.token1 ?? pos[3]) as Address;
          if (!t0Addr || !t1Addr) continue;

          const [m0, m1] = await Promise.all([getMeta(t0Addr), getMeta(t1Addr)]);
          const positionFee = Number(pos.fee ?? pos[4]);
          const tickLower = Number(pos.tickLower ?? pos[5]);
          const tickUpper = Number(pos.tickUpper ?? pos[6]);
          const liquidity = (pos.liquidity ?? pos[7]) as bigint;
          const tokensOwed0 = (pos.tokensOwed0 ?? pos[10]) as bigint;
          const tokensOwed1 = (pos.tokensOwed1 ?? pos[11]) as bigint;

          const priceLower = tickToPrice(tickLower, m0.dec, m1.dec);
          const priceUpper = tickToPrice(tickUpper, m0.dec, m1.dec);

          let currentPrice = 0;
          const poolKey = `${t0Addr.toLowerCase()}-${t1Addr.toLowerCase()}-${positionFee}`;
          if (poolPriceCache[poolKey] !== undefined) {
            currentPrice = poolPriceCache[poolKey];
          } else if (config.uniFactory) {
            try {
              const pool = (await publicClient.readContract({
                address: config.uniFactory, abi: UniswapV3FactoryAbi, functionName: "getPool",
                args: [t0Addr, t1Addr, positionFee]
              })) as Address;
              if (pool && pool !== "0x0000000000000000000000000000000000000000") {
                const slot0 = (await publicClient.readContract({
                  address: pool, abi: UniswapV3PoolAbi, functionName: "slot0"
                })) as any;
                const tick = Number(slot0.tick ?? slot0[1]);
                currentPrice = tickToPrice(tick, m0.dec, m1.dec);
              }
            } catch { /* skip */ }
            poolPriceCache[poolKey] = currentPrice;
          }

          const inRange = currentPrice >= priceLower && currentPrice <= priceUpper;

          list.push({
            tokenId, token0: t0Addr, token1: t1Addr, fee: positionFee,
            tickLower, tickUpper, liquidity, sym0: m0.sym, sym1: m1.sym,
            dec0: m0.dec, dec1: m1.dec, tokensOwed0, tokensOwed1,
            priceLower, priceUpper, currentPrice, inRange
          });
        } catch { /* skip failed position */ }
      }

      setPositions(list);
      setStatus("");
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function collectFees(pos: LpPos) {
    if (!address || !walletClient || !npm) return;
    setBusy(true);
    const key = pos.tokenId.toString();
    setActionStatus((s) => ({ ...s, [key]: "Collecting fees..." }));
    setActionType((s) => ({ ...s, [key]: "info" }));
    try {
      const hash = await walletClient.writeContract({
        address: npm, abi: NonfungiblePositionManagerAbi, functionName: "collect",
        args: [{ tokenId: pos.tokenId, recipient: address, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
        chain: walletClient.chain, account: address
      });
      setActionStatus((s) => ({ ...s, [key]: "Confirming..." }));
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        setActionStatus((s) => ({ ...s, [key]: "Fees collected!" }));
        setActionType((s) => ({ ...s, [key]: "success" }));
      } else {
        setActionStatus((s) => ({ ...s, [key]: "Tx failed" }));
        setActionType((s) => ({ ...s, [key]: "error" }));
      }
      await refresh();
    } catch (e: any) {
      setActionStatus((s) => ({ ...s, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((s) => ({ ...s, [key]: "error" }));
    } finally {
      setBusy(false);
    }
  }

  async function removeLiquidity(pos: LpPos) {
    if (!address || !walletClient || !npm || pos.liquidity <= 0n) return;
    setBusy(true);
    const key = pos.tokenId.toString();
    setActionStatus((s) => ({ ...s, [key]: "Removing liquidity..." }));
    setActionType((s) => ({ ...s, [key]: "info" }));
    try {
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      const hash1 = await walletClient.writeContract({
        address: npm, abi: NonfungiblePositionManagerAbi, functionName: "decreaseLiquidity",
        args: [{ tokenId: pos.tokenId, liquidity: pos.liquidity as unknown as bigint, amount0Min: 0n, amount1Min: 0n, deadline }],
        chain: walletClient.chain, account: address
      });
      setActionStatus((s) => ({ ...s, [key]: "Removing... collecting tokens" }));
      await publicClient.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await walletClient.writeContract({
        address: npm, abi: NonfungiblePositionManagerAbi, functionName: "collect",
        args: [{ tokenId: pos.tokenId, recipient: address, amount0Max: MAX_UINT128, amount1Max: MAX_UINT128 }],
        chain: walletClient.chain, account: address
      });
      await publicClient.waitForTransactionReceipt({ hash: hash2 });
      setActionStatus((s) => ({ ...s, [key]: "Liquidity removed!" }));
      setActionType((s) => ({ ...s, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      setActionStatus((s) => ({ ...s, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((s) => ({ ...s, [key]: "error" }));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  if (!address) {
    return (
      <div className="text-lm-gray text-sm p-6 text-center">
        <div className="text-lm-terminal-lightgray text-lg mb-1">No Wallet Connected</div>
        <div className="text-lm-terminal-lightgray text-xs">Connect your wallet to view and manage LP positions.</div>
      </div>
    );
  }

  const activePositions = positions.filter((p) => p.liquidity > 0n);
  const closedPositions = positions.filter((p) => p.liquidity <= 0n);
  const inRangeCount = activePositions.filter((p) => p.inRange).length;

  return (
    <div className="space-y-3">
      {/* Summary stats bar */}
      {positions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">Active</div>
            <div className="text-white font-bold text-sm lm-mono mt-0.5">{activePositions.length}</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">In Range</div>
            <div className="text-lm-green font-bold text-sm lm-mono mt-0.5">{inRangeCount} / {activePositions.length}</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">With Fees</div>
            <div className="text-lm-orange font-bold text-sm lm-mono mt-0.5">{positions.filter((p) => p.tokensOwed0 > 0n || p.tokensOwed1 > 0n).length}</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">Closed</div>
            <div className="text-lm-terminal-lightgray font-bold text-sm lm-mono mt-0.5">{closedPositions.length}</div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">
          {busy ? "Loading positions..." : `${positions.length} Position${positions.length !== 1 ? "s" : ""}`}
        </div>
        <Button onClick={refresh} disabled={busy} className="text-lm-orange text-xs border border-lm-terminal-gray hover:border-lm-orange px-3 py-1 transition-colors">
          {busy ? "..." : "Refresh"}
        </Button>
      </div>

      {positions.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <div className="text-lm-terminal-lightgray text-lg">{busy ? "Loading..." : "No Positions"}</div>
          <div className="text-lm-terminal-lightgray text-xs opacity-60">
            {status || "Create an LP position in the Pools tab to start earning fees."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {positions.map((p) => {
            const key = p.tokenId.toString();
            const hasLiq = p.liquidity > 0n;
            const hasFees = p.tokensOwed0 > 0n || p.tokensOwed1 > 0n;
            const actStatus = actionStatus[key];
            const actType = actionType[key] || "info";
            const actColor = actType === "success" ? "text-lm-green" : actType === "error" ? "text-lm-red" : "text-lm-gray";
            const isExpanded = expanded === key;
            const feeStr = `${(p.fee / 10000).toFixed(p.fee < 1000 ? 2 : p.fee < 10000 ? 1 : 0)}%`;
            const barPos = hasLiq ? rangeBarPositions(p.priceLower, p.priceUpper, p.currentPrice) : null;

            return (
              <div key={key} className={`bg-lm-black border transition-all ${
                hasLiq && p.inRange
                  ? "border-lm-green/30 hover:border-lm-green/50"
                  : hasLiq
                    ? "border-lm-orange/30 hover:border-lm-orange/50"
                    : "border-lm-terminal-gray hover:border-lm-terminal-lightgray"
              }`}>
                {/* Card header — always visible, clickable to expand */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasLiq ? (p.inRange ? "bg-lm-green animate-pulse" : "bg-lm-orange") : "bg-lm-terminal-gray"}`} />
                      <span className="text-white font-bold text-sm">{p.sym0}/{p.sym1}</span>
                      <span className="text-lm-terminal-lightgray text-[9px] bg-lm-terminal-darkgray px-1.5 py-0.5 border border-lm-terminal-gray lm-mono">{feeStr}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {hasLiq ? (
                        <span className={`text-[8px] px-1.5 py-0.5 font-bold ${
                          p.inRange
                            ? "bg-lm-green/15 text-lm-green border border-lm-green/40"
                            : "bg-lm-orange/15 text-lm-orange border border-lm-orange/40"
                        }`}>
                          {p.inRange ? "IN RANGE" : "OUT OF RANGE"}
                        </span>
                      ) : (
                        <span className="text-[8px] px-1.5 py-0.5 font-bold bg-white/5 text-lm-terminal-lightgray border border-lm-terminal-gray">CLOSED</span>
                      )}
                      {hasFees && (
                        <span className="text-[8px] px-1.5 py-0.5 font-bold bg-lm-green/15 text-lm-green border border-lm-green/40">FEES</span>
                      )}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 text-lm-terminal-lightgray transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>

                  {/* Price + Range row */}
                  <div className="mt-2 flex items-center gap-4 text-[10px] flex-wrap">
                    {p.currentPrice > 0 && (
                      <div>
                        <span className="text-lm-terminal-lightgray">Current </span>
                        <span className={`lm-mono font-bold ${p.inRange ? "text-lm-green" : "text-lm-orange"}`}>{fmtHumanPrice(p.currentPrice)}</span>
                        <span className="text-lm-terminal-lightgray ml-0.5">{p.sym1}/{p.sym0}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-lm-terminal-lightgray">Range </span>
                      <span className="text-white lm-mono">{fmtHumanPrice(p.priceLower)}</span>
                      <span className="text-lm-terminal-gray mx-0.5">↔</span>
                      <span className="text-white lm-mono">{fmtHumanPrice(p.priceUpper)}</span>
                    </div>
                    <div className="text-lm-terminal-lightgray lm-mono">#{key}</div>
                  </div>

                  {/* Range bar */}
                  {barPos && (
                    <div className="mt-2">
                      <div className="relative h-2 bg-lm-terminal-darkgray rounded-sm overflow-hidden">
                        {/* Range band */}
                        <div className={`absolute top-0 h-full rounded-sm ${p.inRange ? "bg-lm-green/25" : "bg-lm-orange/25"}`}
                          style={{ left: `${barPos.lo}%`, width: `${Math.max(1, barPos.hi - barPos.lo)}%` }} />
                        {/* Range edges */}
                        <div className={`absolute top-0 w-px h-full ${p.inRange ? "bg-lm-green/60" : "bg-lm-orange/60"}`}
                          style={{ left: `${barPos.lo}%` }} />
                        <div className={`absolute top-0 w-px h-full ${p.inRange ? "bg-lm-green/60" : "bg-lm-orange/60"}`}
                          style={{ left: `${barPos.hi}%` }} />
                        {/* Current price marker */}
                        <div className="absolute top-0 w-0.5 h-full bg-white rounded-full shadow-[0_0_4px_rgba(255,255,255,0.5)]"
                          style={{ left: `${barPos.cur}%`, transform: "translateX(-50%)" }} />
                      </div>
                      <div className="flex justify-between mt-0.5 text-[8px] lm-mono text-lm-terminal-lightgray">
                        <span>{fmtHumanPrice(p.priceLower)}</span>
                        <span>{fmtHumanPrice(p.priceUpper)}</span>
                      </div>
                    </div>
                  )}

                  {/* Fees preview — always visible when fees exist */}
                  {hasFees && (
                    <div className="mt-2 flex items-center gap-1 text-[10px]">
                      <span className="text-lm-green font-bold">Fees:</span>
                      {p.tokensOwed0 > 0n && <span className="text-white lm-mono">{fmtBal(formatUnits(p.tokensOwed0, p.dec0))} {p.sym0}</span>}
                      {p.tokensOwed0 > 0n && p.tokensOwed1 > 0n && <span className="text-lm-terminal-gray">+</span>}
                      {p.tokensOwed1 > 0n && <span className="text-white lm-mono">{fmtBal(formatUnits(p.tokensOwed1, p.dec1))} {p.sym1}</span>}
                    </div>
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3 border-t border-lm-terminal-gray/50">
                    {/* Detail stats grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3">
                      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
                        <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">Min Price</div>
                        <div className="text-white lm-mono text-xs font-bold mt-0.5">{fmtHumanPrice(p.priceLower)}</div>
                        <div className="text-lm-terminal-lightgray text-[8px]">{p.sym1} per {p.sym0}</div>
                      </div>
                      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
                        <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">Max Price</div>
                        <div className="text-white lm-mono text-xs font-bold mt-0.5">{fmtHumanPrice(p.priceUpper)}</div>
                        <div className="text-lm-terminal-lightgray text-[8px]">{p.sym1} per {p.sym0}</div>
                      </div>
                      {p.currentPrice > 0 && (
                        <div className={`bg-lm-terminal-darkgray border p-2 ${p.inRange ? "border-lm-green/30" : "border-lm-orange/30"}`}>
                          <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">Current Price</div>
                          <div className={`lm-mono text-xs font-bold mt-0.5 ${p.inRange ? "text-lm-green" : "text-lm-orange"}`}>{fmtHumanPrice(p.currentPrice)}</div>
                          <div className="text-lm-terminal-lightgray text-[8px]">{p.sym1} per {p.sym0}</div>
                        </div>
                      )}
                      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
                        <div className="text-lm-terminal-lightgray text-[8px] lm-upper tracking-wider">Fee Tier</div>
                        <div className="text-white lm-mono text-xs font-bold mt-0.5">{feeStr}</div>
                        <div className="text-lm-terminal-lightgray text-[8px]">Tick {p.tickLower}→{p.tickUpper}</div>
                      </div>
                    </div>

                    {/* Uncollected fees detail */}
                    {hasFees && (
                      <div className="bg-lm-terminal-darkgray border border-lm-green/20 p-2.5">
                        <div className="text-lm-green text-[9px] font-bold lm-upper tracking-wider mb-1.5">Uncollected Fees</div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-lm-terminal-lightgray text-[8px]">{p.sym0}</div>
                            <div className="text-white lm-mono text-sm font-bold">{fmtBal(formatUnits(p.tokensOwed0, p.dec0))}</div>
                          </div>
                          <div>
                            <div className="text-lm-terminal-lightgray text-[8px]">{p.sym1}</div>
                            <div className="text-white lm-mono text-sm font-bold">{fmtBal(formatUnits(p.tokensOwed1, p.dec1))}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Token addresses */}
                    <div className="flex items-center gap-3 text-[9px] text-lm-terminal-lightgray">
                      <a href={explorerAddr(p.token0)} target="_blank" rel="noreferrer" className="hover:text-lm-orange transition-colors lm-mono">{p.sym0}: {short(p.token0)}</a>
                      <a href={explorerAddr(p.token1)} target="_blank" rel="noreferrer" className="hover:text-lm-orange transition-colors lm-mono">{p.sym1}: {short(p.token1)}</a>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {hasFees && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); collectFees(p); }} disabled={busy}
                          className="text-[10px] px-3 py-1.5 bg-lm-green/10 text-lm-green border border-lm-green/30 hover:bg-lm-green/20 font-bold transition-colors disabled:opacity-40">
                          Collect Fees
                        </button>
                      )}
                      {hasLiq && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeLiquidity(p); }} disabled={busy}
                          className="text-[10px] px-3 py-1.5 bg-lm-red/10 text-lm-red border border-lm-red/30 hover:bg-lm-red/20 font-bold transition-colors disabled:opacity-40">
                          Remove Liquidity
                        </button>
                      )}
                      {!hasFees && !hasLiq && (
                        <span className="text-[10px] text-lm-terminal-lightgray">Position is closed with no remaining fees.</span>
                      )}
                      {actStatus && (
                        <span className={`text-[10px] ${actColor}`}>{actStatus}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {status && positions.length > 0 && (
        <div className="text-xs p-2.5 border border-lm-red/20 bg-lm-black flex items-center gap-2 text-lm-red">
          <span className="w-1.5 h-1.5 rounded-full bg-lm-red flex-shrink-0" />
          <span>{status}</span>
        </div>
      )}
    </div>
  );
}

export function ExchangeBootstrap({
  SwapPanel,
  PoolsPanel
}: {
  SwapPanel: React.ComponentType;
  PoolsPanel: React.ComponentType;
}) {
  const tabs = useMemo(
    () => [
      { id: "swap", label: "Swap", hint: "Quote + swap any token pair" },
      { id: "pools", label: "Pools", hint: "Create pools + add liquidity" },
      { id: "positions", label: "Positions", hint: "Manage your LP positions" }
    ],
    []
  );
  const [active, setActive] = useState("swap");

  const handleIntent = useCallback((intent: IntentAction) => {
    const swapTypes = ["swap", "flip_tokens", "max_balance", "set_fee", "set_slippage"];
    const poolTypes = ["add_liquidity", "create_pool"];
    const posTypes = ["collect_fees", "remove_liquidity", "refresh_positions"];
    if (swapTypes.includes(intent.type)) setActive("swap");
    else if (poolTypes.includes(intent.type)) setActive("pools");
    else if (posTypes.includes(intent.type)) setActive("positions");
    else if (intent.type === "switch_tab" && ["swap","pools","positions"].includes(intent.tab)) setActive(intent.tab);
  }, []);

  return (
    <div className="space-y-4">
      <IntentTerminal
        context="exchange"
        onIntent={handleIntent}
        placeholder="swap 10 ETH for TSLA · add liquidity · create pool · collect fees · help"
      />
      <Panel
        title="Exchange"
        hint="Swap any token pair. Native ETH supported. Create and manage LP positions."
        right={<TerminalTabs tabs={tabs} active={active} onChange={setActive} />}
      >
        {active === "swap" ? <SwapPanel /> : null}
        {active === "pools" ? <PoolsPanel /> : null}
        {active === "positions" ? <PositionsTab /> : null}
      </Panel>
    </div>
  );
}
