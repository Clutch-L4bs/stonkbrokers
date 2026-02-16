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

function fmtHumanPrice(p: number): string {
  if (p === 0 || !Number.isFinite(p)) return "—";
  if (p >= 1_000_000_000) return `${(p / 1_000_000_000).toFixed(2)}B`;
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(2)}M`;
  if (p >= 1_000) return `${(p / 1_000).toFixed(2)}K`;
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.0001) return p.toFixed(6);
  if (p >= 0.0000001) return p.toFixed(10);
  return p.toExponential(2);
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
      const list: LpPos[] = [];
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

      for (let i = 0; i < cap; i++) {
        const tokenId = (await publicClient.readContract({
          address: npm, abi: NonfungiblePositionManagerAbi, functionName: "tokenOfOwnerByIndex",
          args: [address, BigInt(i)]
        })) as bigint;
        const pos = (await publicClient.readContract({
          address: npm, abi: NonfungiblePositionManagerAbi, functionName: "positions", args: [tokenId]
        })) as any;
        const t0Addr = pos.token0 as Address;
        const t1Addr = pos.token1 as Address;
        const m0 = await getMeta(t0Addr);
        const m1 = await getMeta(t1Addr);
        const positionFee = Number(pos.fee);

        const priceLower = tickToPrice(Number(pos.tickLower), m0.dec, m1.dec);
        const priceUpper = tickToPrice(Number(pos.tickUpper), m0.dec, m1.dec);

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
              })) as unknown as readonly [bigint, number, number, number, number, number, boolean];
              currentPrice = tickToPrice(slot0[1], m0.dec, m1.dec);
            }
          } catch { /* skip */ }
          poolPriceCache[poolKey] = currentPrice;
        }

        const inRange = currentPrice >= priceLower && currentPrice <= priceUpper;

        list.push({
          tokenId, token0: t0Addr, token1: t1Addr, fee: positionFee,
          tickLower: Number(pos.tickLower), tickUpper: Number(pos.tickUpper),
          liquidity: pos.liquidity as bigint, sym0: m0.sym, sym1: m1.sym,
          dec0: m0.dec, dec1: m1.dec,
          tokensOwed0: pos.tokensOwed0 as bigint, tokensOwed1: pos.tokensOwed1 as bigint,
          priceLower, priceUpper, currentPrice, inRange
        });
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

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {positions.length > 0 && (
            <>
              <span className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">
                {activePositions.length} Active
              </span>
              {closedPositions.length > 0 && (
                <span className="text-lm-terminal-lightgray text-[10px] lm-upper tracking-wider opacity-50">
                  {closedPositions.length} Closed
                </span>
              )}
            </>
          )}
        </div>
        <Button onClick={refresh} disabled={busy} className="text-lm-orange text-xs border border-lm-terminal-gray hover:border-lm-orange px-3 py-1 transition-colors">
          {busy ? "Loading..." : "Refresh"}
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

            return (
              <div key={key} className={`bg-lm-terminal-darkgray border transition-all lm-card-hover ${
                hasLiq && p.inRange ? "border-lm-green/30 lm-in-range" : hasLiq ? "border-lm-orange/30 lm-out-of-range" : "border-lm-terminal-gray"
              }`}>
                {/* Card header (Camelot-style) */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : key)}
                  className="w-full p-3 flex items-center justify-between text-left hover:bg-lm-black/20"
                >
                  <div className="flex items-center gap-2.5">
                    {/* Status dot */}
                    <span className={`lm-dot ${hasLiq ? (p.inRange ? "lm-dot-green lm-dot-pulse" : "lm-dot-red") : "lm-dot-gray"}`} />
                    <span className="text-white font-bold text-sm">{p.sym0}/{p.sym1}</span>
                    <span className="text-lm-terminal-lightgray text-[10px] bg-lm-black px-1.5 py-0.5 border border-lm-terminal-gray lm-mono">{feeStr}</span>
                    <span className="text-lm-terminal-lightgray text-[10px] lm-mono opacity-50">#{p.tokenId.toString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasLiq ? (
                      <span className={`lm-badge font-bold ${
                        p.inRange ? "lm-badge-filled-green" : "lm-badge-filled-red"
                      }`}>
                        {p.inRange ? "IN RANGE" : "OUT OF RANGE"}
                      </span>
                    ) : (
                      <span className="lm-badge lm-badge-gray">CLOSED</span>
                    )}
                    {hasFees && <span className="lm-badge lm-badge-filled-green">FEES</span>}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 text-lm-terminal-lightgray transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* Compact summary always visible */}
                <div className="px-3 pb-2 flex items-center gap-4 text-[10px] flex-wrap">
                  {p.currentPrice > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-lm-terminal-lightgray">Price:</span>
                      <span className="text-white lm-mono font-bold">{fmtHumanPrice(p.currentPrice)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-lm-terminal-lightgray">Range:</span>
                    <span className="text-white lm-mono">{fmtHumanPrice(p.priceLower)}</span>
                    <span className="text-lm-terminal-gray">—</span>
                    <span className="text-white lm-mono">{fmtHumanPrice(p.priceUpper)}</span>
                  </div>
                </div>

                {/* Range bar visualization */}
                {hasLiq && p.currentPrice > 0 && (
                  <div className="px-3 pb-2">
                    <div className="relative h-1.5 bg-lm-black rounded-full overflow-hidden">
                      <div className="absolute inset-0 bg-lm-orange/20 rounded-full"
                        style={{
                          left: "10%",
                          right: "10%"
                        }}
                      />
                      {(() => {
                        const minP = Math.min(p.priceLower, p.currentPrice * 0.5);
                        const maxP = Math.max(p.priceUpper, p.currentPrice * 2);
                        const rangeWidth = maxP - minP;
                        if (rangeWidth <= 0) return null;
                        const lo = ((p.priceLower - minP) / rangeWidth) * 100;
                        const hi = ((p.priceUpper - minP) / rangeWidth) * 100;
                        const cur = ((p.currentPrice - minP) / rangeWidth) * 100;
                        return (
                          <>
                            <div className={`absolute top-0 h-full ${p.inRange ? "bg-lm-green/40" : "bg-lm-orange/40"}`}
                              style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
                            <div className="absolute top-0 w-1 h-full bg-white rounded-full"
                              style={{ left: `${cur}%`, transform: "translateX(-50%)" }} />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-lm-terminal-gray">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 text-[10px]">
                      <div>
                        <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Price Range ({p.sym1}/{p.sym0})</div>
                        <div className="text-white lm-mono text-xs mt-0.5">
                          {fmtHumanPrice(p.priceLower)} — {fmtHumanPrice(p.priceUpper)}
                        </div>
                      </div>
                      {p.currentPrice > 0 && (
                        <div>
                          <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Current Price</div>
                          <div className="text-white lm-mono text-xs mt-0.5">
                            {fmtHumanPrice(p.currentPrice)} {p.sym1}/{p.sym0}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Fee Tier</div>
                        <div className="text-white text-xs mt-0.5">{feeStr}</div>
                      </div>
                    </div>

                    {hasFees && (
                      <div className="bg-lm-black border border-lm-green/20 p-2 text-xs space-y-0.5">
                        <div className="text-lm-green text-[10px] font-bold lm-upper tracking-wider">Uncollected Fees</div>
                        <div className="flex gap-4 text-white lm-mono">
                          {p.tokensOwed0 > 0n && <span>{fmtBal(formatUnits(p.tokensOwed0, p.dec0))} {p.sym0}</span>}
                          {p.tokensOwed1 > 0n && <span>{fmtBal(formatUnits(p.tokensOwed1, p.dec1))} {p.sym1}</span>}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <Button
                        size="sm"
                        className="bg-lm-green/10 text-lm-green border-lm-green/30 hover:bg-lm-green/20 hover:border-lm-green"
                        onClick={() => collectFees(p)} disabled={busy}>
                        Collect Fees
                      </Button>
                      {hasLiq && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => removeLiquidity(p)} disabled={busy}>
                          Remove All Liquidity
                        </Button>
                      )}
                      {actStatus && (
                        <div className="flex items-center gap-1.5">
                          {actType === "info" && <span className="lm-spinner" style={{ width: 10, height: 10, borderWidth: 1 }} />}
                          {actType === "success" && <span className="lm-dot lm-dot-green" />}
                          {actType === "error" && <span className="lm-dot lm-dot-red" />}
                          <span className={`text-[10px] ${actColor}`}>{actStatus}</span>
                        </div>
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
          <span className="lm-dot lm-dot-red flex-shrink-0" />
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
