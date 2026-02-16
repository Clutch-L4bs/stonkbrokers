"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Address, formatEther, parseAbiItem } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../providers";
import { config } from "../../lib/config";
import { ERC721EnumerableAbi, StonkExpandedNftMintAbi } from "../../lib/abis";
import { useIntentListener, IntentAction } from "../../components/IntentTerminal";

type OwnedNft = {
  collection: string;
  address: Address;
  tokenId: bigint;
  image?: string;
};

type MintStats = {
  expandedPriceWei?: bigint;
  expandedSupply?: bigint;
  legacySupply?: bigint;
  originalSupply?: bigint;
};

function short(a: string) { return a.slice(0, 6) + "..." + a.slice(-4); }

function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
}

function explorerTx(hash: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/tx/${hash}`;
}

function parseTokenUriImage(tokenUri: string): string | undefined {
  if (tokenUri.startsWith("data:application/json;base64,")) {
    const b64 = tokenUri.slice("data:application/json;base64,".length);
    const raw = atob(b64);
    const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return json?.image;
  }
  try { return JSON.parse(tokenUri)?.image; } catch { return undefined; }
}

const QTY_PRESETS = [1, 2, 3, 5];

export function NftPanel() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const [qty, setQty] = useState("1");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");
  const [owned, setOwned] = useState<OwnedNft[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(false);
  const [stats, setStats] = useState<MintStats>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [latest, setLatest] = useState<OwnedNft[]>([]);
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestPages, setLatestPages] = useState(1);
  const [userEthBal, setUserEthBal] = useState<bigint | null>(null);

  /* ── Intent listener — auto-fill from IntentTerminal ── */
  useIntentListener(useCallback((intent: IntentAction) => {
    if (intent.type === "mint_nft" && intent.qty) {
      const n = Math.min(5, Math.max(1, parseInt(intent.qty)));
      setQty(String(n));
    }
  }, []));

  const collections = useMemo(() => {
    const out: Array<{ label: string; addr?: Address; tag: string }> = [];
    if (config.originalNft) out.push({ label: "Original (444)", addr: config.originalNft as Address, tag: "MINTED OUT" });
    if (config.legacyExpandedNft) out.push({ label: "Expanded (Legacy)", addr: config.legacyExpandedNft as Address, tag: "LEGACY" });
    if (config.expandedNft) out.push({ label: "Expanded", addr: config.expandedNft as Address, tag: "ACTIVE" });
    return out.filter((c) => c.addr && c.addr !== ("0x" as any));
  }, []);

  const mintedTarget = 4444n;
  const mintedNow = useMemo(() => {
    const e = stats.expandedSupply || 0n;
    const l = stats.legacySupply || 0n;
    return 444n + e + l;
  }, [stats.expandedSupply, stats.legacySupply]);

  const mintPct = mintedNow > 0n ? Number((mintedNow * 10000n) / mintedTarget) / 100 : 0;

  const mintCostEth = useMemo(() => {
    if (!stats.expandedPriceWei) return null;
    const q = BigInt(qty || "1");
    return stats.expandedPriceWei * q;
  }, [stats.expandedPriceWei, qty]);

  async function refreshStats() {
    setStatsLoading(true);
    try {
      const expanded = config.expandedNft as Address;
      const legacy = config.legacyExpandedNft as Address;
      const original = config.originalNft as Address;
      const reads: Array<Promise<unknown>> = [];
      if (expanded) {
        reads.push(publicClient.readContract({ address: expanded, abi: StonkExpandedNftMintAbi, functionName: "MINT_PRICE" }));
        reads.push(publicClient.readContract({ address: expanded, abi: ERC721EnumerableAbi, functionName: "totalSupply" }));
      } else { reads.push(Promise.resolve(undefined)); reads.push(Promise.resolve(0n)); }
      if (legacy) { reads.push(publicClient.readContract({ address: legacy, abi: ERC721EnumerableAbi, functionName: "totalSupply" })); } else { reads.push(Promise.resolve(0n)); }
      if (original) { reads.push(publicClient.readContract({ address: original, abi: ERC721EnumerableAbi, functionName: "totalSupply" })); } else { reads.push(Promise.resolve(undefined)); }
      const [price, expandedSupply, legacySupply, originalSupply] = (await Promise.all(reads)) as [bigint | undefined, bigint, bigint, bigint | undefined];
      setStats({ expandedPriceWei: price, expandedSupply, legacySupply, originalSupply });
    } catch { /* silent */ } finally { setStatsLoading(false); }
  }

  async function refreshUserBalance() {
    if (!address) { setUserEthBal(null); return; }
    try { setUserEthBal(await publicClient.getBalance({ address })); } catch { setUserEthBal(null); }
  }

  async function refreshOwned() {
    if (!address) { setOwned([]); return; }
    setOwnedLoading(true);
    setStatus(""); setStatusType("info");
    const all: OwnedNft[] = [];
    for (const c of collections) {
      const nft = c.addr as Address;
      try {
        const bal = (await publicClient.readContract({ address: nft, abi: ERC721EnumerableAbi, functionName: "balanceOf", args: [address] })) as bigint;
        const cap = bal > 50n ? 50 : Number(bal);
        for (let i = 0; i < cap; i++) {
          const tokenId = (await publicClient.readContract({ address: nft, abi: ERC721EnumerableAbi, functionName: "tokenOfOwnerByIndex", args: [address, BigInt(i)] })) as bigint;
          all.push({ collection: c.label, address: nft, tokenId });
        }
      } catch { /* skip collection */ }
    }
    const BATCH = 10;
    for (let i = 0; i < all.length; i += BATCH) {
      await Promise.all(all.slice(i, i + BATCH).map(async (item) => {
        try {
          const uri = (await publicClient.readContract({ address: item.address, abi: ERC721EnumerableAbi, functionName: "tokenURI", args: [item.tokenId] })) as string;
          item.image = parseTokenUriImage(uri);
        } catch { /* skip */ }
      }));
    }
    all.sort((a, b) => (a.tokenId === b.tokenId ? 0 : a.tokenId > b.tokenId ? 1 : -1));
    setOwned(all);
    setOwnedLoading(false);
  }

  async function refreshLatest() {
    const targets = [
      config.expandedNft ? { label: "Expanded", addr: config.expandedNft as Address } : undefined,
      config.legacyExpandedNft ? { label: "Expanded (Legacy)", addr: config.legacyExpandedNft as Address } : undefined,
      config.originalNft ? { label: "Original", addr: config.originalNft as Address } : undefined
    ].filter(Boolean) as Array<{ label: string; addr: Address }>;
    if (!targets.length) { setLatest([]); return; }
    setLatestLoading(true);
    try {
      const latestBlock = await publicClient.getBlockNumber();
      const WINDOW = 20_000n;
      const p = BigInt(Math.max(1, Math.min(10, latestPages)));
      const fromBlock = latestBlock > WINDOW * p ? latestBlock - WINDOW * p : 0n;
      const transferEv = parseAbiItem("event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)");
      const allLogs = await Promise.all(targets.map((t) => publicClient.getLogs({ address: t.addr, event: transferEv, fromBlock, toBlock: latestBlock })));
      const out: OwnedNft[] = [];
      for (let i = 0; i < targets.length; i++) {
        const minted = allLogs[i].filter((l) => String(l.args.from).toLowerCase() === "0x0000000000000000000000000000000000000000").slice(-80).reverse();
        for (const l of minted) { out.push({ collection: targets[i].label, address: targets[i].addr, tokenId: l.args.tokenId as bigint }); if (out.length >= 120) break; }
        if (out.length >= 120) break;
      }
      const BATCH = 10;
      for (let i = 0; i < out.length; i += BATCH) {
        await Promise.all(out.slice(i, i + BATCH).map(async (item) => {
          try {
            const uri = (await publicClient.readContract({ address: item.address, abi: ERC721EnumerableAbi, functionName: "tokenURI", args: [item.tokenId] })) as string;
            item.image = parseTokenUriImage(uri);
          } catch { /* skip */ }
        }));
      }
      setLatest(out.slice(0, 100));
    } catch { setLatest([]); } finally { setLatestLoading(false); }
  }

  useEffect(() => { refreshOwned().catch(() => {}); refreshUserBalance(); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refreshStats().catch(() => {}); refreshLatest().catch(() => {}); }, [latestPages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function mint() {
    if (!address) { setStatus("Connect wallet first."); setStatusType("error"); return; }
    if (!walletClient) { setStatus("No wallet client detected."); setStatusType("error"); return; }
    if (!config.expandedNft) { setStatus("Missing expanded NFT contract."); setStatusType("error"); return; }
    setBusy(true); setLastTxHash(""); setStatus(""); setStatusType("info");
    try {
      await requireCorrectChain();
      const q = BigInt(qty || "1");
      const price = (await publicClient.readContract({ address: config.expandedNft, abi: StonkExpandedNftMintAbi, functionName: "MINT_PRICE" })) as bigint;
      const value = price * q;
      setStatus("Awaiting wallet signature...");
      const tx = await walletClient.writeContract({
        address: config.expandedNft, abi: StonkExpandedNftMintAbi, functionName: "mint", args: [q],
        value, chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      setStatus("Confirming transaction...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status === "success") {
        setStatus(`Minted ${q.toString()} Stonk Broker${q > 1n ? "s" : ""}!`);
        setStatusType("success");
        refreshOwned().catch(() => {});
        refreshStats().catch(() => {});
        refreshLatest().catch(() => {});
        refreshUserBalance();
      } else {
        setStatus("Transaction reverted."); setStatusType("error");
      }
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e)); setStatusType("error");
    } finally { setBusy(false); }
  }

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";
  const hasLowEth = userEthBal !== null && mintCostEth !== null && userEthBal < mintCostEth;

  return (
    <div className="space-y-4">
      {/* ── Mainnet merge info banner ── */}
      <div className="lm-callout lm-callout-green flex items-start gap-2">
        <span className="lm-badge lm-badge-green flex-shrink-0">INFO</span>
        <div className="text-lm-terminal-lightgray leading-relaxed">
          Original (444) + Expanded collections will merge into one unified collection on Robinhood Chain mainnet.
          Each Stonk Broker comes with an <span className="text-white font-bold">ERC-6551</span> wallet funded with stock tokens at mint.
        </div>
      </div>

      {/* ── Mint Hero ── */}
      <div className="lm-gradient-section border border-lm-terminal-gray p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 border-2 border-lm-orange flex items-center justify-center">
            <span className="text-lm-orange text-2xl font-bold lm-glow">S</span>
          </div>
          <div>
            <div className="text-lm-orange font-bold text-lg lm-upper lm-glow">Mint Stonk Brokers</div>
            <div className="text-lm-terminal-lightgray text-[10px] lm-upper tracking-wider">
              {mintedNow.toString()} / {mintedTarget.toString()} minted — {mintPct.toFixed(1)}% complete
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="lm-progress">
            <div className="lm-progress-fill" style={{ width: `${mintPct}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-lm-terminal-lightgray">
            <span>0</span>
            <span className="text-white font-bold lm-mono">{mintedNow.toString()}</span>
            <span>{mintedTarget.toString()}</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="lm-stat">
            <div className="lm-stat-value">{mintedNow.toString()}</div>
            <div className="lm-stat-label">Total Minted</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-value text-lm-orange">
              {stats.expandedPriceWei ? formatEther(stats.expandedPriceWei) : "—"}
            </div>
            <div className="lm-stat-label">Price (ETH)</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-value text-lm-green">{(stats.expandedSupply || 0n).toString()}</div>
            <div className="lm-stat-label">Expanded</div>
          </div>
          <div className="lm-stat">
            <div className="lm-stat-value">444</div>
            <div className="lm-stat-label">Original</div>
          </div>
        </div>

        {/* Quantity picker */}
        <div className="space-y-2">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Select Quantity</div>
          <div className="flex gap-1.5 items-center">
            {QTY_PRESETS.map((q) => (
              <button key={q} type="button" onClick={() => setQty(String(q))}
                className={`text-xs px-4 py-2 border transition-colors font-bold ${
                  qty === String(q)
                    ? "border-lm-orange text-lm-orange bg-lm-orange/5"
                    : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                }`}>
                {q}
              </button>
            ))}
            <div className="flex-1 max-w-[80px]">
              <Input value={qty} onValueChange={setQty} placeholder="1" />
            </div>
          </div>
        </div>

        {/* Cost preview */}
        {mintCostEth !== null && (
          <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-lm-terminal-lightgray">Total Cost</span>
              <span className="text-white font-bold lm-mono text-lg">{formatEther(mintCostEth)} ETH</span>
            </div>
            {userEthBal !== null && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-lm-terminal-lightgray">Your Balance</span>
                <span className={`lm-mono font-bold ${hasLowEth ? "text-lm-red" : "text-lm-green"}`}>
                  {Number(formatEther(userEthBal)).toFixed(6)} ETH
                </span>
              </div>
            )}
          </div>
        )}

        {/* Low balance warning */}
        {hasLowEth && (
          <div className="lm-callout lm-callout-red text-lm-red flex items-center gap-2">
            <span className="text-lg">⚠</span>
            <div>
              Insufficient ETH balance.{" "}
              <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer" className="underline hover:text-white transition-colors font-bold">
                Get testnet ETH →
              </a>
            </div>
          </div>
        )}

        <div className="text-lm-terminal-lightgray text-[10px]">Limit: 5 mints per wallet</div>

        {/* Mint button */}
        <Button onClick={mint} loading={busy} disabled={busy || !address} variant="primary" size="lg" className="w-full lm-upper tracking-wider">
          {busy ? "Minting..." : !address ? "Connect Wallet to Mint" : `Mint ${qty} Stonk Broker${Number(qty) > 1 ? "s" : ""}`}
        </Button>

        {/* Status */}
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
              <a href={explorerTx(lastTxHash)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline text-[10px] flex-shrink-0">
                View Tx →
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Per-collection breakdown ── */}
      <div className="space-y-2">
        <div className="lm-section-header">Collections</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 lm-card-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold text-xs">Original</span>
              <span className="lm-badge lm-badge-green">COMPLETE</span>
            </div>
            <div className="text-white font-bold lm-mono text-lg">{(stats.originalSupply || 444n).toString()} / 444</div>
            <div className="lm-progress mt-2"><div className="lm-progress-fill w-full bg-lm-green" /></div>
            {config.originalNft && (
              <a href={explorerAddr(config.originalNft)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline text-[10px] lm-mono mt-2 inline-block">{short(config.originalNft)}</a>
            )}
          </div>

          {config.legacyExpandedNft && (
            <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 lm-card-hover">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-xs">Expanded (Legacy)</span>
                <span className="lm-badge lm-badge-gray">LEGACY</span>
              </div>
              <div className="text-white font-bold lm-mono text-lg">{(stats.legacySupply || 0n).toString()}</div>
              <a href={explorerAddr(config.legacyExpandedNft)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline text-[10px] lm-mono mt-2 inline-block">{short(config.legacyExpandedNft)}</a>
            </div>
          )}

          <div className="bg-lm-terminal-darkgray border border-lm-orange/20 p-3 lm-card-hover">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-bold text-xs">Expanded</span>
              <span className="lm-badge lm-badge-orange lm-pulse">MINTING</span>
            </div>
            <div className="text-white font-bold lm-mono text-lg">{(stats.expandedSupply || 0n).toString()}</div>
            <div className="text-lm-terminal-lightgray text-[10px] mt-1">
              Price: <span className="text-lm-orange font-bold">{stats.expandedPriceWei ? `${formatEther(stats.expandedPriceWei)} ETH` : "—"}</span>
            </div>
            {config.expandedNft && (
              <a href={explorerAddr(config.expandedNft)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline text-[10px] lm-mono mt-1 inline-block">{short(config.expandedNft)}</a>
            )}
          </div>
        </div>
      </div>

      {/* ── Latest Mints ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="lm-section-header flex-1">Latest Mints</div>
          <div className="flex gap-1">
            <button type="button" onClick={() => setLatestPages(1)}
              className={`text-[10px] px-2 py-1 border transition-colors ${latestPages === 1 ? "border-lm-orange text-lm-orange" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
              Latest
            </button>
            <button type="button" onClick={() => setLatestPages((p) => Math.min(10, p + 1))}
              className="text-[10px] px-2 py-1 border border-lm-terminal-gray text-lm-gray hover:border-lm-gray transition-colors">
              Older
            </button>
            <button type="button" onClick={() => refreshLatest()} disabled={latestLoading}
              className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors">
              {latestLoading ? "..." : "Refresh"}
            </button>
          </div>
        </div>

        {latestLoading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="lm-nft-card">
                <div className="w-full aspect-square lm-skeleton" />
                <div className="mt-1 h-3 lm-skeleton w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        )}

        {latest.length === 0 && !latestLoading ? (
          <div className="text-center py-8 space-y-1">
            <div className="text-lm-terminal-lightgray text-lg opacity-30">🖼</div>
            <div className="text-lm-terminal-lightgray text-sm">No recent mints found</div>
            <div className="text-lm-terminal-lightgray text-[10px] opacity-60">Mint a broker above to get started</div>
          </div>
        ) : !latestLoading && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {latest.map((o, i) => (
              <div key={`latest:${o.address}:${o.tokenId.toString()}`}
                className="lm-nft-card lm-fade-in"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}>
                <div className="w-full aspect-square bg-lm-black flex items-center justify-center overflow-hidden">
                  {o.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image} alt="" className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <div className="text-lm-gray text-[10px] lm-mono">#{o.tokenId.toString()}</div>
                  )}
                </div>
                <div className="mt-1 text-center">
                  <div className="text-white font-bold text-[10px]">#{o.tokenId.toString()}</div>
                  <div className="text-lm-terminal-lightgray text-[9px]">{o.collection}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── My Brokers ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="lm-section-header flex-1">
            My Stonk Brokers
            {address && owned.length > 0 && (
              <span className="text-lm-orange text-xs ml-2 font-normal">({owned.length})</span>
            )}
          </div>
          <button type="button" onClick={() => refreshOwned()} disabled={ownedLoading}
            className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors">
            {ownedLoading ? "..." : "Refresh"}
          </button>
        </div>

        {!address ? (
          <div className="text-center py-8 space-y-1">
            <div className="text-lm-terminal-lightgray text-lg opacity-30">👤</div>
            <div className="text-lm-terminal-lightgray text-sm">Connect wallet to view your collection</div>
          </div>
        ) : ownedLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="lm-nft-card">
                <div className="w-full aspect-square lm-skeleton" />
                <div className="mt-1 space-y-1">
                  <div className="h-3 lm-skeleton w-1/2" />
                  <div className="h-2 lm-skeleton w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : owned.length === 0 ? (
          <div className="text-center py-8 space-y-1">
            <div className="text-lm-terminal-lightgray text-lg opacity-30">🖼</div>
            <div className="text-lm-terminal-lightgray text-sm">No brokers found</div>
            <div className="text-lm-terminal-lightgray text-[10px] opacity-60">Mint your first Stonk Broker above</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {owned.map((o, i) => (
              <div key={`${o.address}:${o.tokenId.toString()}`}
                className="lm-nft-card lm-fade-in"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}>
                <div className="w-full aspect-square bg-lm-black flex items-center justify-center overflow-hidden">
                  {o.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.image} alt="" className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <div className="text-lm-gray text-[10px] lm-mono">#{o.tokenId.toString()}</div>
                  )}
                </div>
                <div className="mt-1.5 px-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs">#{o.tokenId.toString()}</span>
                    <span className={`lm-badge ${
                      o.collection === "Original (444)" ? "lm-badge-green"
                      : o.collection === "Expanded" ? "lm-badge-orange"
                      : "lm-badge-gray"
                    }`}>
                      {o.collection === "Original (444)" ? "OG" : o.collection === "Expanded" ? "EXP" : "LEG"}
                    </span>
                  </div>
                  <a href={explorerAddr(o.address) + `?a=${o.tokenId.toString()}`} target="_blank" rel="noreferrer"
                    className="text-lm-terminal-lightgray hover:text-lm-orange text-[9px] lm-mono transition-colors mt-0.5 inline-block">
                    View on Explorer →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
