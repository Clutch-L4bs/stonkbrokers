"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatUnits } from "viem";
import { Panel } from "../../components/Terminal";
import { TerminalTabs } from "../../components/Tabs";
import { Button } from "../../components/Button";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../providers";
import { config } from "../../lib/config";
import { IntentTerminal, IntentAction } from "../../components/IntentTerminal";
import { useEthPrice, fmtUsd as fmtUsdLive } from "../../lib/useEthPrice";
import {
  ERC20MetadataAbi,
  StonkCoveredCallVaultAbi,
  StonkOptionPositionNFTAbi,
  ERC721EnumerableAbi
} from "../../lib/abis";

/* ── Shared Types ── */
type OfferData = {
  id: bigint;
  writer: Address;
  underlying: Address;
  quote: Address;
  underlyingAmount: bigint;
  strikeQuoteAmount: bigint;
  premiumQuoteAmount: bigint;
  expiry: number;
  active: boolean;
  strikeTick: number;
  uSym: string;
  qSym: string;
  uDec: number;
  qDec: number;
};

type PositionData = {
  tokenId: bigint;
  underlying: Address;
  quote: Address;
  writer: Address;
  strikeTick: number;
  underlyingAmount: bigint;
  strikeQuoteAmount: bigint;
  premiumQuoteAmount: bigint;
  expiry: number;
  exercised: boolean;
  uSym: string;
  qSym: string;
  uDec: number;
  qDec: number;
};

/* ── Utilities ── */
function short(a: string) { return a.slice(0, 6) + "..." + a.slice(-4); }
function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
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
function fmtBal(raw: string): string {
  const num = Number(raw);
  if (isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.0001) return num.toFixed(6);
  return fmtSmall(num);
}
function formatExpiry(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function timeLeft(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  if (ts < now) return "Expired";
  const diff = ts - now;
  if (diff < 3600) return `${Math.ceil(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  return `${Math.floor(diff / 86400)}d ${Math.floor((diff % 86400) / 3600)}h`;
}
function expiryColor(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  if (ts < now) return "lm-badge-red";
  if (ts - now < 86400) return "lm-badge-orange";
  return "lm-badge-green";
}

/* ── Token metadata cache ── */
const metaCache: Record<string, { sym: string; dec: number }> = {};
async function getMeta(addr: Address): Promise<{ sym: string; dec: number }> {
  const key = addr.toLowerCase();
  if (metaCache[key]) return metaCache[key];
  let sym = addr.slice(0, 6), dec = 18;
  try { sym = (await publicClient.readContract({ address: addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /**/ }
  try { dec = Number(await publicClient.readContract({ address: addr, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /**/ }
  metaCache[key] = { sym, dec };
  return metaCache[key];
}

/* ══════════════════════════════════════════════════════════════
   TRADE TAB — Browse active offers and buy options
   ══════════════════════════════════════════════════════════════ */

function TradeTab() {
  const ethUsd = useEthPrice();
  const { address, walletClient, requireCorrectChain } = useWallet();
  const vault = config.coveredCallVault as Address;
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [positions, setPositions] = useState<PositionData[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<Record<string, "info" | "success" | "error">>({});
  const [view, setView] = useState<"market" | "positions">("market");

  /* ── Load market offers ── */
  async function refreshMarket() {
    if (!vault) { setOffers([]); return; }
    setLoading(true); setStatus("");
    try {
      const total = Number(
        await publicClient.readContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "nextOfferId" })
      );

      const batchSize = 10;
      const list: OfferData[] = [];

      for (let start = 0; start < total; start += batchSize) {
        const end = Math.min(start + batchSize, total);
        const batch = await Promise.all(
          Array.from({ length: end - start }, (_, i) =>
            publicClient
              .readContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "offers", args: [BigInt(start + i)] })
              .catch(() => null)
          )
        );
        for (let i = 0; i < batch.length; i++) {
          const offer = batch[i] as any;
          if (!offer || !offer.active) continue;
          const now = Math.floor(Date.now() / 1000);
          if (Number(offer.expiry) < now) continue;
          try {
            const [u, q] = await Promise.all([
              getMeta(offer.underlying as Address),
              getMeta(offer.quote as Address)
            ]);
            list.push({
              id: BigInt(start + i), writer: offer.writer as Address, underlying: offer.underlying as Address,
              quote: offer.quote as Address, underlyingAmount: offer.underlyingAmount as bigint,
              strikeQuoteAmount: offer.strikeQuoteAmount as bigint, premiumQuoteAmount: offer.premiumQuoteAmount as bigint,
              expiry: Number(offer.expiry), active: true, strikeTick: Number(offer.strikeTick),
              uSym: u.sym, qSym: q.sym, uDec: u.dec, qDec: q.dec
            });
          } catch { /**/ }
        }
      }

      list.sort((a, b) => Number(b.id - a.id));
      setOffers(list.slice(0, 50));
      if (list.length === 0) setStatus("No active offers available.");
    } catch (e: any) { setStatus(String(e?.shortMessage || e?.message || e)); }
    finally { setLoading(false); }
  }

  /* ── Load purchased positions ── */
  async function refreshPositions() {
    if (!address || !vault) { setPositions([]); return; }
    try {
      const nft = (await publicClient.readContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "optionNft" })) as Address;
      const bal = Number(await publicClient.readContract({ address: nft, abi: ERC721EnumerableAbi, functionName: "balanceOf", args: [address] }));
      const list: PositionData[] = [];
      for (let i = 0; i < Math.min(bal, 30); i++) {
        const tokenId = (await publicClient.readContract({ address: nft, abi: ERC721EnumerableAbi, functionName: "tokenOfOwnerByIndex", args: [address, BigInt(i)] })) as bigint;
        const pos = (await publicClient.readContract({ address: nft, abi: StonkOptionPositionNFTAbi, functionName: "positions", args: [tokenId] })) as any;
        const u = await getMeta(pos.underlying as Address);
        const q = await getMeta(pos.quote as Address);
        list.push({
          tokenId, underlying: pos.underlying as Address, quote: pos.quote as Address,
          writer: pos.writer as Address, strikeTick: Number(pos.strikeTick),
          underlyingAmount: pos.underlyingAmount as bigint, strikeQuoteAmount: pos.strikeQuoteAmount as bigint,
          premiumQuoteAmount: pos.premiumQuoteAmount as bigint, expiry: Number(pos.expiry),
          exercised: Boolean(pos.exercised), uSym: u.sym, qSym: q.sym, uDec: u.dec, qDec: q.dec
        });
      }
      setPositions(list);
    } catch { /**/ }
  }

  useEffect(() => { refreshMarket().catch(() => {}); }, []); // eslint-disable-line
  useEffect(() => { if (address) refreshPositions().catch(() => {}); }, [address]); // eslint-disable-line

  async function buyOffer(o: OfferData) {
    const key = o.id.toString();
    if (!address || !walletClient) { setActionStatus((s) => ({ ...s, [key]: "Connect wallet first." })); setActionType((s) => ({ ...s, [key]: "error" })); return; }
    setActionStatus((s) => ({ ...s, [key]: "Approving premium..." }));
    setActionType((s) => ({ ...s, [key]: "info" }));
    try {
      await requireCorrectChain();
      const allowance = (await publicClient.readContract({ address: o.quote, abi: [{ type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ type: "uint256" }] }] as const, functionName: "allowance", args: [address, vault] })) as bigint;
      if (allowance < o.premiumQuoteAmount) {
        const tx = await walletClient.writeContract({ address: o.quote, abi: [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "", type: "address" }, { name: "", type: "uint256" }], outputs: [{ type: "bool" }] }] as const, functionName: "approve", args: [vault, o.premiumQuoteAmount], chain: robinhoodTestnet, account: address });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionStatus((s) => ({ ...s, [key]: "Purchasing option..." }));
      const tx = await walletClient.writeContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "buyOption", args: [o.id], chain: robinhoodTestnet, account: address });
      setActionStatus((s) => ({ ...s, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((s) => ({ ...s, [key]: "Option purchased! NFT minted." }));
      setActionType((s) => ({ ...s, [key]: "success" }));
      await refreshMarket(); await refreshPositions();
    } catch (e: any) {
      setActionStatus((s) => ({ ...s, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((s) => ({ ...s, [key]: "error" }));
    }
  }

  async function exerciseOption(p: PositionData) {
    const key = `ex-${p.tokenId}`;
    if (!address || !walletClient) { setActionStatus((s) => ({ ...s, [key]: "Connect wallet first." })); setActionType((s) => ({ ...s, [key]: "error" })); return; }
    setActionStatus((s) => ({ ...s, [key]: "Approving strike..." }));
    setActionType((s) => ({ ...s, [key]: "info" }));
    try {
      await requireCorrectChain();
      const allowance = (await publicClient.readContract({ address: p.quote, abi: [{ type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "", type: "address" }, { name: "", type: "address" }], outputs: [{ type: "uint256" }] }] as const, functionName: "allowance", args: [address, vault] })) as bigint;
      if (allowance < p.strikeQuoteAmount) {
        const tx = await walletClient.writeContract({ address: p.quote, abi: [{ type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "", type: "address" }, { name: "", type: "uint256" }], outputs: [{ type: "bool" }] }] as const, functionName: "approve", args: [vault, p.strikeQuoteAmount], chain: robinhoodTestnet, account: address });
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setActionStatus((s) => ({ ...s, [key]: "Exercising..." }));
      const tx = await walletClient.writeContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "exercise", args: [p.tokenId], chain: robinhoodTestnet, account: address });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((s) => ({ ...s, [key]: "Exercised!" }));
      setActionType((s) => ({ ...s, [key]: "success" }));
      await refreshPositions();
    } catch (e: any) {
      setActionStatus((s) => ({ ...s, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((s) => ({ ...s, [key]: "error" }));
    }
  }

  /* ── Market stats ── */
  const totalPremium = offers.reduce((acc, o) => acc + Number(formatUnits(o.premiumQuoteAmount, o.qDec)), 0);
  const totalCollateral = offers.reduce((acc, o) => acc + Number(formatUnits(o.underlyingAmount, o.uDec)), 0);

  return (
    <div className="space-y-3">
      {/* ── Market Stats Banner ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="lm-stat">
          <div className="lm-stat-value">{offers.length}</div>
          <div className="lm-stat-label">Active Offers</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value text-lm-orange">{fmtBal(String(totalPremium))}</div>
          <div className="lm-stat-label">Total Premium</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value">{fmtBal(String(totalCollateral))}</div>
          <div className="lm-stat-label">Total Collateral</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value">{positions.length}</div>
          <div className="lm-stat-label">Your Options</div>
        </div>
      </div>

      {/* ── Sub-nav ── */}
      <div className="flex gap-1">
        <button type="button" onClick={() => setView("market")}
          className={`flex-1 text-xs py-2 border transition-colors font-bold ${view === "market" ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
          <div>Available Options</div>
          <div className="text-[9px] opacity-60 font-normal">Browse & buy from market</div>
        </button>
        <button type="button" onClick={() => setView("positions")}
          className={`flex-1 text-xs py-2 border transition-colors font-bold ${view === "positions" ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
          <div>My Positions {positions.length > 0 && `(${positions.length})`}</div>
          <div className="text-[9px] opacity-60 font-normal">Exercise & manage</div>
        </button>
      </div>

      {/* ── Market View ── */}
      {view === "market" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">
              {loading ? "Scanning chain..." : `${offers.length} Active Option${offers.length !== 1 ? "s" : ""}`}
            </div>
            <button type="button" onClick={() => refreshMarket()} disabled={loading}
              className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-bold">
              {loading ? "..." : "Refresh"}
            </button>
          </div>

          {offers.length === 0 && !loading ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-lm-terminal-lightgray text-lg">No Options Available</div>
              <div className="text-lm-terminal-lightgray text-xs opacity-60">{status || "Writers can create offers in the Earn tab."}</div>
            </div>
          ) : (
            <div className="space-y-2">
              {offers.map((o) => {
                const key = o.id.toString();
                const act = actionStatus[key];
                const actTp = actionType[key] || "info";
                const actCol = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";
                const isOwn = address?.toLowerCase() === o.writer.toLowerCase();
                const tl = timeLeft(o.expiry);

                return (
                  <div key={key} className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 lm-card-hover transition-all">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm">{o.uSym}/{o.qSym}</span>
                        <span className="text-lm-terminal-lightgray text-[10px] lm-mono">#{key}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`lm-badge ${expiryColor(o.expiry)}`}>{tl}</span>
                      </div>
                    </div>

                    {/* Option details grid */}
                    <div className="grid grid-cols-4 gap-2 text-[10px] mb-3">
                      <div className="bg-lm-black p-2 border border-lm-terminal-gray">
                        <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Collateral</div>
                        <div className="text-white lm-mono text-xs font-bold mt-0.5">{fmtBal(formatUnits(o.underlyingAmount, o.uDec))}</div>
                        <div className="text-lm-terminal-lightgray">{o.uSym}</div>
                        {(o.uSym === "WETH" || o.uSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(o.underlyingAmount, o.uDec)) * ethUsd)}</div>}
                      </div>
                      <div className="bg-lm-black p-2 border border-lm-terminal-gray">
                        <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Strike</div>
                        <div className="text-white lm-mono text-xs font-bold mt-0.5">{fmtBal(formatUnits(o.strikeQuoteAmount, o.qDec))}</div>
                        <div className="text-lm-terminal-lightgray">{o.qSym}</div>
                        {(o.qSym === "WETH" || o.qSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(o.strikeQuoteAmount, o.qDec)) * ethUsd)}</div>}
                      </div>
                      <div className="bg-lm-black p-2 border border-lm-orange/20">
                        <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Premium</div>
                        <div className="text-lm-orange lm-mono text-xs font-bold mt-0.5">{fmtBal(formatUnits(o.premiumQuoteAmount, o.qDec))}</div>
                        <div className="text-lm-terminal-lightgray">{o.qSym}</div>
                        {(o.qSym === "WETH" || o.qSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(o.premiumQuoteAmount, o.qDec)) * ethUsd)}</div>}
                      </div>
                      <div className="bg-lm-black p-2 border border-lm-terminal-gray">
                        <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Expires</div>
                        <div className="text-white text-xs font-bold mt-0.5">{formatExpiry(o.expiry)}</div>
                        <div className="text-lm-terminal-lightgray">{tl}</div>
                      </div>
                    </div>

                    {/* Action row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="text-[10px] text-lm-terminal-lightgray">
                        Writer: <a href={explorerAddr(o.writer)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">{short(o.writer)}</a>
                      </div>
                      <div className="flex items-center gap-2">
                        {act && <span className={`text-[10px] ${actCol}`}>{act}</span>}
                        {address && !isOwn ? (
                          <button type="button" onClick={() => buyOffer(o)}
                            disabled={actionType[o.id.toString()] === "info"}
                            className="text-xs px-4 py-1.5 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                            {actionType[o.id.toString()] === "info" ? "Processing..." : `Buy for ${fmtBal(formatUnits(o.premiumQuoteAmount, o.qDec))} ${o.qSym}`}
                          </button>
                        ) : isOwn ? (
                          <span className="text-[10px] text-lm-terminal-lightgray">Your offer — manage in Earn tab</span>
                        ) : (
                          <span className="text-[10px] text-lm-terminal-lightgray">Connect wallet to buy</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Positions View ── */}
      {view === "positions" && (
        <div className="space-y-2">
          {!address ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-lm-terminal-lightgray text-lg">No Wallet Connected</div>
              <div className="text-lm-terminal-lightgray text-xs opacity-60">Connect your wallet to view purchased options.</div>
            </div>
          ) : positions.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="text-lm-terminal-lightgray text-lg">No Options Owned</div>
              <div className="text-lm-terminal-lightgray text-xs opacity-60">Buy an option from the market to start trading.</div>
            </div>
          ) : (
            positions.map((p) => {
              const key = `ex-${p.tokenId}`;
              const isExpired = p.expiry < Math.floor(Date.now() / 1000);
              const canExercise = !p.exercised && !isExpired;
              const act = actionStatus[key];
              const actTp = actionType[key] || "info";
              const actCol = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";

              return (
                <div key={p.tokenId.toString()} className={`bg-lm-terminal-darkgray border p-3 transition-colors ${
                  p.exercised ? "border-lm-green/20" : isExpired ? "border-lm-red/20 opacity-60" : "border-lm-orange/20"
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lm-terminal-lightgray text-[10px] lm-mono">NFT #{p.tokenId.toString()}</span>
                      <span className="text-white font-bold text-sm">{p.uSym}/{p.qSym}</span>
                    </div>
                    <span className={`lm-badge ${p.exercised ? "lm-badge-green" : isExpired ? "lm-badge-red" : expiryColor(p.expiry)}`}>
                      {p.exercised ? "EXERCISED" : isExpired ? "EXPIRED" : timeLeft(p.expiry)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] mb-2">
                    <div>
                      <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Collateral</div>
                      <div className="text-white lm-mono text-xs font-bold">{fmtBal(formatUnits(p.underlyingAmount, p.uDec))} {p.uSym}</div>
                      {(p.uSym === "WETH" || p.uSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(p.underlyingAmount, p.uDec)) * ethUsd)}</div>}
                    </div>
                    <div>
                      <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Exercise Cost</div>
                      <div className="text-white lm-mono text-xs font-bold">{fmtBal(formatUnits(p.strikeQuoteAmount, p.qDec))} {p.qSym}</div>
                      {(p.qSym === "WETH" || p.qSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(p.strikeQuoteAmount, p.qDec)) * ethUsd)}</div>}
                    </div>
                    <div>
                      <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Premium Paid</div>
                      <div className="text-lm-terminal-lightgray lm-mono text-xs">{fmtBal(formatUnits(p.premiumQuoteAmount, p.qDec))} {p.qSym}</div>
                      {(p.qSym === "WETH" || p.qSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(p.premiumQuoteAmount, p.qDec)) * ethUsd)}</div>}
                    </div>
                    <div>
                      <div className="text-lm-terminal-lightgray lm-upper tracking-wider">Expires</div>
                      <div className="text-white text-xs">{formatExpiry(p.expiry)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {canExercise && (
                      <button type="button" onClick={() => exerciseOption(p)}
                        disabled={actionType[`ex-${p.tokenId}`] === "info"}
                        className="text-xs px-4 py-1.5 bg-lm-green/90 text-black font-bold hover:bg-lm-green transition-colors disabled:opacity-40 disabled:pointer-events-none">
                        {actionType[`ex-${p.tokenId}`] === "info" ? "Processing..." : `Exercise — Pay ${fmtBal(formatUnits(p.strikeQuoteAmount, p.qDec))} ${p.qSym}, Receive ${fmtBal(formatUnits(p.underlyingAmount, p.uDec))} ${p.uSym}`}
                      </button>
                    )}
                    {act && <span className={`text-[10px] ${actCol}`}>{act}</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EARN TAB — Write options and earn premiums
   ══════════════════════════════════════════════════════════════ */

function EarnTab() {
  const ethUsd = useEthPrice();
  const { address, walletClient, requireCorrectChain } = useWallet();
  const vault = config.coveredCallVault as Address;
  const [offers, setOffers] = useState<OfferData[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<Record<string, "info" | "success" | "error">>({});

  async function refresh() {
    if (!address || !vault) { setOffers([]); return; }
    setLoading(true); setStatus("");
    try {
      const total = Number(
        await publicClient.readContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "nextOfferId" })
      );

      const batchSize = 10;
      const list: OfferData[] = [];

      for (let start = 0; start < total; start += batchSize) {
        const end = Math.min(start + batchSize, total);
        const batch = await Promise.all(
          Array.from({ length: end - start }, (_, i) =>
            publicClient
              .readContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "offers", args: [BigInt(start + i)] })
              .catch(() => null)
          )
        );
        for (let i = 0; i < batch.length; i++) {
          const offer = batch[i] as any;
          if (!offer) continue;
          if ((offer.writer as Address).toLowerCase() !== address.toLowerCase()) continue;
          try {
            const [u, q] = await Promise.all([
              getMeta(offer.underlying as Address),
              getMeta(offer.quote as Address)
            ]);
            list.push({
              id: BigInt(start + i), writer: offer.writer as Address, underlying: offer.underlying as Address,
              quote: offer.quote as Address, underlyingAmount: offer.underlyingAmount as bigint,
              strikeQuoteAmount: offer.strikeQuoteAmount as bigint, premiumQuoteAmount: offer.premiumQuoteAmount as bigint,
              expiry: Number(offer.expiry), active: Boolean(offer.active), strikeTick: Number(offer.strikeTick),
              uSym: u.sym, qSym: q.sym, uDec: u.dec, qDec: q.dec
            });
          } catch { /**/ }
        }
      }

      list.sort((a, b) => Number(b.id - a.id));
      setOffers(list.slice(0, 30));
      if (list.length === 0) setStatus("No offers found. Write your first covered call below.");
    } catch (e: any) { setStatus(String(e?.shortMessage || e?.message || e)); }
    finally { setLoading(false); }
  }

  async function cancelOffer(id: bigint) {
    const key = id.toString();
    if (!address || !walletClient) { setActionStatus((s) => ({ ...s, [key]: "Connect wallet first." })); setActionType((s) => ({ ...s, [key]: "error" })); return; }
    setActionStatus((s) => ({ ...s, [key]: "Cancelling..." }));
    setActionType((s) => ({ ...s, [key]: "info" }));
    try {
      await requireCorrectChain();
      const tx = await walletClient.writeContract({ address: vault, abi: StonkCoveredCallVaultAbi, functionName: "cancelOffer", args: [id], chain: robinhoodTestnet, account: address });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((s) => ({ ...s, [key]: "Cancelled! Collateral returned." }));
      setActionType((s) => ({ ...s, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      setActionStatus((s) => ({ ...s, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((s) => ({ ...s, [key]: "error" }));
    }
  }

  /* reclaimExpired requires an option token ID (not offer ID).
     Writers should use the Write/Chart tab's Exercise/Reclaim section. */

  useEffect(() => { if (address) refresh().catch(() => {}); }, [address]); // eslint-disable-line

  /* Stats */
  const activeOffers = offers.filter((o) => o.active);
  const filledOffers = offers.filter((o) => !o.active);
  const totalPremiumEarnable = activeOffers.reduce((acc, o) => acc + Number(formatUnits(o.premiumQuoteAmount, o.qDec)), 0);
  const totalCollateralLocked = activeOffers.reduce((acc, o) => acc + Number(formatUnits(o.underlyingAmount, o.uDec)), 0);

  if (!address) return (
    <div className="text-center py-10 space-y-2">
      <div className="text-lm-terminal-lightgray text-lg">No Wallet Connected</div>
      <div className="text-lm-terminal-lightgray text-xs opacity-60">Connect your wallet to write covered calls and earn premiums.</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* ── How it works ── */}
      <div className="bg-lm-terminal-darkgray border border-lm-green/20 p-3 space-y-2">
        <div className="text-lm-green font-bold text-xs lm-upper">How You Earn</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] text-lm-terminal-lightgray">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 border border-lm-green flex items-center justify-center flex-shrink-0">
              <span className="text-lm-green font-bold text-[9px]">1</span>
            </div>
            <div><span className="text-white font-bold">Deposit collateral</span> — lock tokens as backing for the option</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 border border-lm-green flex items-center justify-center flex-shrink-0">
              <span className="text-lm-green font-bold text-[9px]">2</span>
            </div>
            <div><span className="text-white font-bold">Earn premium</span> — a buyer pays you upfront to purchase the option</div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 border border-lm-green flex items-center justify-center flex-shrink-0">
              <span className="text-lm-green font-bold text-[9px]">3</span>
            </div>
            <div><span className="text-white font-bold">Reclaim or settle</span> — if the option expires unused, reclaim your collateral</div>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="lm-stat">
          <div className="lm-stat-value text-lm-green">{activeOffers.length}</div>
          <div className="lm-stat-label">Active Offers</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value">{filledOffers.length}</div>
          <div className="lm-stat-label">Filled / Cancelled</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value text-lm-orange">{fmtBal(String(totalPremiumEarnable))}</div>
          <div className="lm-stat-label">Premium Earnable</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value">{fmtBal(String(totalCollateralLocked))}</div>
          <div className="lm-stat-label">Collateral Locked</div>
        </div>
      </div>

      {/* ── Your Offers ── */}
      <div className="flex items-center justify-between">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Your Offers</div>
        <button type="button" onClick={() => refresh()} disabled={loading}
          className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-bold">
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      {offers.length === 0 ? (
        <div className="text-center py-6 text-lm-terminal-lightgray text-xs opacity-60">
          {status || "No offers yet. Create one using the Write/Trade tab."}
        </div>
      ) : (
        <div className="space-y-2">
          {offers.map((o) => {
            const key = o.id.toString();
            const isExpired = o.expiry < Math.floor(Date.now() / 1000);
            const act = actionStatus[key];
            const actTp = actionType[key] || "info";
            const actCol = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";

            return (
              <div key={key} className={`bg-lm-terminal-darkgray border p-3 transition-colors ${
                o.active ? "border-lm-green/20" : "border-lm-terminal-gray opacity-60"
              }`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lm-terminal-lightgray text-[10px] lm-mono">#{key}</span>
                    <span className="text-white font-bold text-sm">{o.uSym}/{o.qSym}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`lm-badge ${o.active ? "lm-badge-green" : "lm-badge-gray"}`}>
                      {o.active ? "ACTIVE" : "CLOSED"}
                    </span>
                    {o.active && <span className={`lm-badge ${expiryColor(o.expiry)}`}>{timeLeft(o.expiry)}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] mb-2">
                  <div>
                    <div className="text-lm-terminal-lightgray">Collateral Locked</div>
                    <div className="text-white lm-mono font-bold">{fmtBal(formatUnits(o.underlyingAmount, o.uDec))} {o.uSym}</div>
                    {(o.uSym === "WETH" || o.uSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(o.underlyingAmount, o.uDec)) * ethUsd)}</div>}
                  </div>
                  <div>
                    <div className="text-lm-terminal-lightgray">Strike Price</div>
                    <div className="text-white lm-mono font-bold">{fmtBal(formatUnits(o.strikeQuoteAmount, o.qDec))} {o.qSym}</div>
                    {(o.qSym === "WETH" || o.qSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(o.strikeQuoteAmount, o.qDec)) * ethUsd)}</div>}
                  </div>
                  <div>
                    <div className="text-lm-terminal-lightgray">Your Premium</div>
                    <div className="text-lm-green lm-mono font-bold">{fmtBal(formatUnits(o.premiumQuoteAmount, o.qDec))} {o.qSym}</div>
                    {(o.qSym === "WETH" || o.qSym === "ETH") && <div className="text-lm-terminal-lightgray text-[8px] lm-mono">{fmtUsdLive(Number(formatUnits(o.premiumQuoteAmount, o.qDec)) * ethUsd)}</div>}
                  </div>
                  <div>
                    <div className="text-lm-terminal-lightgray">Expires</div>
                    <div className="text-white">{formatExpiry(o.expiry)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {o.active && !isExpired && (
                    <button type="button" onClick={() => cancelOffer(o.id)}
                      disabled={actionType[o.id.toString()] === "info"}
                      className="text-[10px] px-3 py-1 bg-lm-red/10 text-lm-red border border-lm-red/30 hover:bg-lm-red/20 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                      {actionType[o.id.toString()] === "info" ? "Cancelling..." : "Cancel & Return Collateral"}
                    </button>
                  )}
                  {!o.active && isExpired && (
                    <span className="text-[10px] text-lm-terminal-lightgray">
                      Filled & expired — use Write/Chart tab to reclaim with the option NFT ID
                    </span>
                  )}
                  {act && <span className={`text-[10px] ${actCol}`}>{act}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP — Main layout with tabs
   ══════════════════════════════════════════════════════════════ */

export function OptionsBootstrap({ OptionsPanel }: { OptionsPanel: React.ComponentType }) {
  const tabs = useMemo(
    () => [
      { id: "trade", label: "Trade", hint: "Buy options from available liquidity" },
      { id: "earn", label: "Earn", hint: "Write covered calls, earn premiums" },
      { id: "write", label: "Write/Chart", hint: "Create offers + price chart" }
    ],
    []
  );
  const [active, setActive] = useState("trade");
  const ethUsd = useEthPrice();

  const handleIntent = useCallback((intent: IntentAction) => {
    const tradeTypes = ["buy_option", "preview_offer"];
    const earnTypes = ["cancel_option"];
    const writeTypes = ["write_call", "exercise", "reclaim", "preview_position", "load_chart"];
    if (tradeTypes.includes(intent.type)) setActive("trade");
    else if (earnTypes.includes(intent.type)) setActive("earn");
    else if (writeTypes.includes(intent.type)) setActive("write");
    else if (intent.type === "switch_tab" && ["trade","earn","write"].includes(intent.tab)) setActive(intent.tab);
  }, []);

  return (
    <div className="space-y-4">
      <IntentTerminal
        context="options"
        onIntent={handleIntent}
        placeholder="write call TSLA 100 strike 0.5 premium 0.01 7d · buy option #5 · exercise #3 · help"
      />
      <Panel
        title="Options"
        hint="Covered calls backed by escrowed collateral. Each position is a tradeable ERC-721 NFT."
        right={(
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-lm-terminal-lightgray lm-mono hidden sm:inline-flex items-center gap-1" title="Live ETH/USD">
              <span className="w-1.5 h-1.5 rounded-full bg-lm-green animate-pulse" />
              ETH <span className="text-white font-bold">${ethUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </span>
            <TerminalTabs tabs={tabs} active={active} onChange={setActive} />
          </div>
        )}
      >
        {active === "trade" ? <TradeTab /> : null}
        {active === "earn" ? <EarnTab /> : null}
        {active === "write" ? <OptionsPanel /> : null}
      </Panel>
    </div>
  );
}
