"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Address, formatEther, parseAbiItem, parseEther } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../providers";
import { config } from "../../lib/config";
import { ERC721EnumerableAbi, StonkMarketplaceAbi } from "../../lib/abis";

/* ── Helpers ── */
function short(a: string) {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

function explorerAddr(addr: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/address/${addr}`;
}

function explorerTx(hash: string) {
  return `${config.blockExplorerUrl || "https://explorer.testnet.chain.robinhood.com"}/tx/${hash}`;
}

function collectionLabel(addr: Address): string {
  const a = addr.toLowerCase();
  if (config.originalNft && a === (config.originalNft as string).toLowerCase()) return "OG";
  if (config.legacyExpandedNft && a === (config.legacyExpandedNft as string).toLowerCase()) return "Expanded (v1)";
  if (config.expandedNft && a === (config.expandedNft as string).toLowerCase()) return "Expanded";
  return short(addr);
}

/* ── NFT metadata/image helpers (client-side) ── */
const NFT_IMAGE_CACHE = new Map<string, string | null>();
const NFT_IMAGE_INFLIGHT = new Map<string, Promise<string | null>>();

function normalizeUri(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith("ipfs://")) return `https://cloudflare-ipfs.com/ipfs/${uri.slice("ipfs://".length)}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice("ar://".length)}`;
  return uri;
}

function tryParseJsonFromDataUri(uri: string): any | null {
  // Common patterns:
  // - data:application/json;base64,....
  // - data:application/json;utf8,{...}
  if (!uri.startsWith("data:application/json")) return null;
  const comma = uri.indexOf(",");
  if (comma < 0) return null;
  const meta = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  try {
    if (meta.includes(";base64")) {
      const json = atob(payload);
      return JSON.parse(json);
    }
    // assume utf8/plain
    return JSON.parse(decodeURIComponent(payload));
  } catch {
    return null;
  }
}

async function resolveNftImage(nft: Address, tokenId: bigint): Promise<string | null> {
  const key = `${nft.toLowerCase()}:${tokenId.toString()}`;
  if (NFT_IMAGE_CACHE.has(key)) return NFT_IMAGE_CACHE.get(key) ?? null;
  if (NFT_IMAGE_INFLIGHT.has(key)) return (await NFT_IMAGE_INFLIGHT.get(key)!) ?? null;

  const p = (async () => {
    try {
      const tokenUriRaw = (await publicClient.readContract({
        address: nft,
        abi: ERC721EnumerableAbi,
        functionName: "tokenURI",
        args: [tokenId]
      })) as string;

      // Handle on-chain data: JSON
      const parsed = tryParseJsonFromDataUri(tokenUriRaw);
      if (parsed && typeof parsed?.image === "string") {
        const img = normalizeUri(parsed.image);
        NFT_IMAGE_CACHE.set(key, img);
        return img;
      }

      const tokenUri = normalizeUri(tokenUriRaw);
      const res = await fetch(tokenUri);
      if (!res.ok) throw new Error(`tokenURI fetch failed: ${res.status}`);
      const meta = await res.json().catch(() => null);
      const imgField = meta?.image || meta?.image_url || meta?.imageUrl;
      if (typeof imgField !== "string" || !imgField) {
        NFT_IMAGE_CACHE.set(key, null);
        return null;
      }
      const img = normalizeUri(imgField);
      NFT_IMAGE_CACHE.set(key, img);
      return img;
    } catch {
      NFT_IMAGE_CACHE.set(key, null);
      return null;
    } finally {
      NFT_IMAGE_INFLIGHT.delete(key);
    }
  })();

  NFT_IMAGE_INFLIGHT.set(key, p);
  return (await p) ?? null;
}

function NftThumb({ nft, tokenId, label }: { nft: Address; tokenId: bigint; label: string }) {
  const [img, setImg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    resolveNftImage(nft, tokenId).then((u) => { if (!cancelled) setImg(u); });
    return () => { cancelled = true; };
  }, [nft, tokenId]);

  return (
    <div className="w-12 h-12 flex items-center justify-center bg-lm-black border border-lm-terminal-gray overflow-hidden flex-shrink-0">
      {img ? (
        // Using <img> is fine for small thumbs and avoids Next <Image> config needs.
        <img src={img} alt={label} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="text-[10px] text-lm-gray lm-mono">NO IMG</div>
      )}
    </div>
  );
}

/* ── Types ── */
export type ListingItem = {
  kind: "listing";
  id: bigint;
  seller: Address;
  nft: Address;
  tokenId: bigint;
  price: bigint;
  active: boolean;
};

export type SwapItem = {
  kind: "swap";
  id: bigint;
  maker: Address;
  offeredNft: Address;
  offeredTokenId: bigint;
  requestedNft: Address;
  requestedTokenId: bigint;
  active: boolean;
};

export type FeedItem = ListingItem | SwapItem;
export type Owned = { nft: Address; tokenId: bigint; label: string };

/* ── Shared hook for owned brokers + supported NFTs ── */
export function useSupportedNfts() {
  return useMemo(() => {
    const list: Address[] = [];
    if (config.originalNft) list.push(config.originalNft as Address);
    if (config.legacyExpandedNft) list.push(config.legacyExpandedNft as Address);
    if (config.expandedNft) list.push(config.expandedNft as Address);
    return list;
  }, []);
}

export function useOwnedBrokers() {
  const { address } = useWallet();
  const supportedNfts = useSupportedNfts();
  const [owned, setOwned] = useState<Owned[]>([]);
  const [loading, setLoading] = useState(false);

  async function refreshOwned() {
    if (!address) { setOwned([]); return; }
    setLoading(true);
    try {
      const all: Owned[] = [];
      for (const nft of supportedNfts) {
        try {
          const bal = Number(await publicClient.readContract({ address: nft, abi: ERC721EnumerableAbi, functionName: "balanceOf", args: [address] }));
          const cap = Math.min(bal, 30);
          for (let i = 0; i < cap; i++) {
            const tokenId = (await publicClient.readContract({ address: nft, abi: ERC721EnumerableAbi, functionName: "tokenOfOwnerByIndex", args: [address, BigInt(i)] })) as bigint;
            all.push({ nft, tokenId, label: `${collectionLabel(nft)} #${tokenId.toString()}` });
          }
        } catch { /* skip collection */ }
      }
      setOwned(all);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshOwned().catch(() => {}); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  return { owned, refreshOwned, loadingOwned: loading };
}

/* ── Feed Tab ── */
export function FeedTab() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const marketplace = config.marketplace as Address;
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<Record<string, "info" | "success" | "error">>({});

  async function refreshFeed() {
    if (!marketplace) { setStatus("Missing marketplace address."); return; }
    setLoading(true);
    setStatus("");
    try {
      const items: FeedItem[] = [];

      // Preferred path: read next IDs directly (works even if listings are old).
      // Fallback path: scan recent blocks for created events.
      let usedFallback = false;
      try {
        const p = Math.max(1, Math.min(10, pages));
        const scanPerPage = 75; // ids per page, per kind
        // Always scan a reasonable window even on page=1.
        const maxScan = Math.min(500, Math.max(scanPerPage, scanPerPage * p + 200));

        const [nextListingId, nextSwapId] = await Promise.all([
          publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "nextListingId" }) as Promise<bigint>,
          publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "nextSwapId" }) as Promise<bigint>
        ]);

        const lastListing = Number(nextListingId > 0n ? nextListingId - 1n : 0n);
        const lastSwap = Number(nextSwapId > 0n ? nextSwapId - 1n : 0n);

        const listingIds: bigint[] = [];
        for (let i = 0; i < Math.min(maxScan, lastListing); i++) listingIds.push(BigInt(lastListing - i));

        const swapIds: bigint[] = [];
        for (let i = 0; i < Math.min(maxScan, lastSwap); i++) swapIds.push(BigInt(lastSwap - i));

        // Read in small chunks to avoid huge RPC fanout.
        const CHUNK = 25;
        for (let i = 0; i < listingIds.length; i += CHUNK) {
          const chunk = listingIds.slice(i, i + CHUNK);
          const res = await Promise.all(chunk.map(async (id) => {
            try {
              const l = (await publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "listings", args: [id] })) as any;
              // Uninitialized mapping entries return zeroed struct with id=0.
              if (!l || (l.id as bigint) === 0n) return null;
              return { kind: "listing" as const, id, seller: l.seller as Address, nft: l.nft as Address, tokenId: l.tokenId as bigint, price: l.price as bigint, active: Boolean(l.active) };
            } catch {
              return null;
            }
          }));
          for (const it of res) if (it) items.push(it);
        }

        for (let i = 0; i < swapIds.length; i += CHUNK) {
          const chunk = swapIds.slice(i, i + CHUNK);
          const res = await Promise.all(chunk.map(async (id) => {
            try {
              const s = (await publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "swaps", args: [id] })) as any;
              if (!s || (s.id as bigint) === 0n) return null;
              return { kind: "swap" as const, id, maker: s.maker as Address, offeredNft: s.offeredNft as Address, offeredTokenId: s.offeredTokenId as bigint, requestedNft: s.requestedNft as Address, requestedTokenId: s.requestedTokenId as bigint, active: Boolean(s.active) };
            } catch {
              return null;
            }
          }));
          for (const it of res) if (it) items.push(it);
        }
      } catch {
        usedFallback = true;
        const latest = await publicClient.getBlockNumber();
        const WINDOW = 50_000n;
        const p = BigInt(Math.max(1, Math.min(10, pages)));
        const fromBlock = latest > WINDOW * p ? latest - WINDOW * p : 0n;

        const listingEvent = parseAbiItem(
          "event ListingCreated(uint256 indexed listingId,address indexed seller,address indexed nft,uint256 tokenId,uint8 kind,address paymentToken,uint256 price)"
        );
        const swapEvent = parseAbiItem(
          "event SwapCreated(uint256 indexed swapId,address indexed maker,address indexed offeredNft,uint256 offeredTokenId,address requestedNft,uint256 requestedTokenId)"
        );

        const [listingLogs, swapLogs] = await Promise.all([
          publicClient.getLogs({ address: marketplace, event: listingEvent, fromBlock, toBlock: latest }),
          publicClient.getLogs({ address: marketplace, event: swapEvent, fromBlock, toBlock: latest })
        ]);

        for (const id of [...new Set(listingLogs.map((l) => l.args.listingId as bigint))].slice(-75)) {
          try {
            const l = (await publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "listings", args: [id] })) as any;
            if (!l || (l.id as bigint) === 0n) continue;
            items.push({ kind: "listing", id, seller: l.seller as Address, nft: l.nft as Address, tokenId: l.tokenId as bigint, price: l.price as bigint, active: Boolean(l.active) });
          } catch { /* skip */ }
        }

        for (const id of [...new Set(swapLogs.map((l) => l.args.swapId as bigint))].slice(-75)) {
          try {
            const s = (await publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "swaps", args: [id] })) as any;
            if (!s || (s.id as bigint) === 0n) continue;
            items.push({ kind: "swap", id, maker: s.maker as Address, offeredNft: s.offeredNft as Address, offeredTokenId: s.offeredTokenId as bigint, requestedNft: s.requestedNft as Address, requestedTokenId: s.requestedTokenId as bigint, active: Boolean(s.active) });
          } catch { /* skip */ }
        }
      }

      items.sort((a, b) => (a.id === b.id ? 0 : a.id > b.id ? -1 : 1));
      setFeed(items);
      if (items.length === 0) setStatus("No listings or swaps found.");
      else if (usedFallback) setStatus("Loaded items (fallback: recent log scan).");
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshFeed().catch(() => {}); }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  async function buyListing(it: ListingItem) {
    const key = `l-${it.id}`;
    if (!address || !walletClient) { setActionStatus((prev) => ({ ...prev, [key]: "Connect wallet first." })); setActionType((prev) => ({ ...prev, [key]: "error" })); return; }
    setActionStatus((prev) => ({ ...prev, [key]: "Awaiting signature..." }));
    setActionType((prev) => ({ ...prev, [key]: "info" }));
    try {
      await requireCorrectChain();
      const tx = await walletClient.writeContract({
        address: marketplace, abi: StonkMarketplaceAbi, functionName: "buyWithEth", args: [it.id],
        value: it.price, chain: robinhoodTestnet, account: address
      });
      setActionStatus((prev) => ({ ...prev, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((prev) => ({ ...prev, [key]: "Purchased!" }));
      setActionType((prev) => ({ ...prev, [key]: "success" }));
      await refreshFeed();
    } catch (e: any) {
      setActionStatus((prev) => ({ ...prev, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  async function acceptSwap(it: SwapItem) {
    const key = `s-${it.id}`;
    if (!address || !walletClient) { setActionStatus((prev) => ({ ...prev, [key]: "Connect wallet first." })); setActionType((prev) => ({ ...prev, [key]: "error" })); return; }
    setActionStatus((prev) => ({ ...prev, [key]: "Approving NFT..." }));
    setActionType((prev) => ({ ...prev, [key]: "info" }));
    try {
      await requireCorrectChain();
      // Ensure the requested NFT is approved
      const approved = (await publicClient.readContract({ address: it.requestedNft, abi: ERC721EnumerableAbi, functionName: "getApproved", args: [it.requestedTokenId] })) as Address;
      const isAll = (await publicClient.readContract({ address: it.requestedNft, abi: ERC721EnumerableAbi, functionName: "isApprovedForAll", args: [address, marketplace] })) as boolean;
      if (approved?.toLowerCase() !== marketplace.toLowerCase() && !isAll) {
        const appTx = await walletClient.writeContract({
          address: it.requestedNft, abi: ERC721EnumerableAbi, functionName: "approve", args: [marketplace, it.requestedTokenId],
          chain: robinhoodTestnet, account: address
        });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }
      setActionStatus((prev) => ({ ...prev, [key]: "Accepting swap..." }));
      const tx = await walletClient.writeContract({
        address: marketplace, abi: StonkMarketplaceAbi, functionName: "acceptSwapOffer", args: [it.id],
        chain: robinhoodTestnet, account: address
      });
      setActionStatus((prev) => ({ ...prev, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((prev) => ({ ...prev, [key]: "Swap completed!" }));
      setActionType((prev) => ({ ...prev, [key]: "success" }));
      await refreshFeed();
    } catch (e: any) {
      setActionStatus((prev) => ({ ...prev, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  const displayed = showInactive ? feed : feed.filter((f) => f.active);
  const listingCount = displayed.filter((f) => f.kind === "listing").length;
  const swapCount = displayed.filter((f) => f.kind === "swap").length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-lm-terminal-lightgray text-xs">
            {loading ? <span className="animate-pulse">Scanning blocks...</span> : (
              <span>
                <span className="text-white font-bold">{displayed.length}</span> items
                {listingCount > 0 && <span className="text-lm-orange ml-2">{listingCount} sales</span>}
                {swapCount > 0 && <span className="text-lm-green ml-2">{swapCount} swaps</span>}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setShowInactive(!showInactive)}
            className={`text-[10px] px-2 py-1 border transition-colors ${showInactive ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
            {showInactive ? "Show All" : "Active Only"}
          </button>
          <button type="button" onClick={() => setPages(1)}
            className={`text-[10px] px-2 py-1 border transition-colors ${pages === 1 ? "border-lm-orange text-lm-orange" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
            Latest
          </button>
          <button type="button" onClick={() => setPages((p) => Math.min(10, p + 1))}
            className="text-[10px] px-2 py-1 border border-lm-terminal-gray text-lm-gray hover:border-lm-gray transition-colors">
            Older
          </button>
          <button type="button" onClick={() => refreshFeed()} disabled={loading}
            className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-bold disabled:opacity-40 disabled:pointer-events-none">
            {loading ? "..." : "Refresh"}
          </button>
        </div>
      </div>

      {status && <div className="text-lm-red text-xs p-2 border border-lm-red/30 bg-lm-black">{status}</div>}

      {displayed.length === 0 && !loading ? (
        <div className="text-center py-10 space-y-2">
          <div className="text-lm-terminal-lightgray text-lg">No Items Found</div>
          <div className="text-lm-terminal-lightgray text-xs opacity-60">List a broker in the Sell tab or create a swap offer.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((it) => {
            const key = `${it.kind[0]}-${it.id}`;
            const actStatus = actionStatus[key];
            const actTp = actionType[key] || "info";
            const actColor = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";
            const isSale = it.kind === "listing";

            if (isSale) {
              const title = `${collectionLabel(it.nft)} #${it.tokenId.toString()}`;
              return (
                <div key={key} className={`bg-lm-terminal-darkgray border transition-colors p-3 space-y-2 lm-card-hover ${it.active ? "border-lm-orange/20" : "border-lm-terminal-gray opacity-60"}`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {it.active ? <NftThumb nft={it.nft} tokenId={it.tokenId} label={title} /> : null}
                      <span className="lm-badge lm-badge-orange">SALE</span>
                      <span className="text-white font-bold text-sm truncate">{title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold lm-mono text-sm">{formatEther(it.price)} ETH</span>
                      <span className={`lm-badge ${it.active ? "lm-badge-green" : "lm-badge-gray"}`}>
                        {it.active ? "ACTIVE" : "SOLD"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]">
                    <div>
                      <span className="text-lm-terminal-lightgray">Seller: </span>
                      <a href={explorerAddr(it.seller)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                        {short(it.seller)}
                      </a>
                    </div>
                    <div>
                      <span className="text-lm-terminal-lightgray">Collection: </span>
                      <span className="text-white">{collectionLabel(it.nft)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {it.active && address && address.toLowerCase() !== it.seller.toLowerCase() && (
                      <button type="button" onClick={() => buyListing(it)}
                        disabled={actionType[`l-${it.id}`] === "info"}
                        className="text-xs px-4 py-1.5 bg-lm-orange text-black font-bold hover:bg-lm-orange/80 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                        {actionType[`l-${it.id}`] === "info" ? "Processing..." : `Buy for ${formatEther(it.price)} ETH`}
                      </button>
                    )}
                    {it.active && address && address.toLowerCase() === it.seller.toLowerCase() && (
                      <span className="text-[10px] text-lm-terminal-lightgray">Your listing — manage in My Activity</span>
                    )}
                    {!address && it.active && <span className="text-[10px] text-lm-terminal-lightgray">Connect wallet to buy</span>}
                    {actStatus && <span className={`text-[10px] ${actColor}`}>{actStatus}</span>}
                  </div>
                </div>
              );
            }

            return (
              <div key={key} className={`bg-lm-terminal-darkgray border transition-colors p-3 space-y-2 lm-card-hover ${it.active ? "border-lm-green/20" : "border-lm-terminal-gray opacity-60"}`}>
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="lm-badge lm-badge-green">SWAP</span>
                    <span className="text-white font-bold text-sm">{collectionLabel(it.offeredNft)} #{it.offeredTokenId.toString()}</span>
                    <span className="text-lm-orange text-xs font-bold">→</span>
                    <span className="text-white font-bold text-sm">{collectionLabel(it.requestedNft)} #{it.requestedTokenId.toString()}</span>
                  </div>
                  <span className={`lm-badge ${it.active ? "lm-badge-green" : "lm-badge-gray"}`}>
                    {it.active ? "OPEN" : "FILLED"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <div>
                    <span className="text-lm-terminal-lightgray">Maker: </span>
                    <a href={explorerAddr(it.maker)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                      {short(it.maker)}
                    </a>
                  </div>
                  <div>
                    <span className="text-lm-terminal-lightgray">Wants: </span>
                    <span className="text-white font-bold">{collectionLabel(it.requestedNft)} #{it.requestedTokenId.toString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {it.active && address && address.toLowerCase() !== it.maker.toLowerCase() && (
                    <button type="button" onClick={() => acceptSwap(it)}
                      disabled={actionType[`s-${it.id}`] === "info"}
                      className="text-xs px-4 py-1.5 bg-lm-green/90 text-black font-bold hover:bg-lm-green transition-colors disabled:opacity-40 disabled:pointer-events-none">
                      {actionType[`s-${it.id}`] === "info" ? "Processing..." : "Accept Swap"}
                    </button>
                  )}
                  {it.active && address && address.toLowerCase() === it.maker.toLowerCase() && (
                    <span className="text-[10px] text-lm-terminal-lightgray">Your offer — manage in My Activity</span>
                  )}
                  {!address && it.active && <span className="text-[10px] text-lm-terminal-lightgray">Connect wallet to accept</span>}
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

/* ── Create Listing Tab ── */
export function ListTab() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const marketplace = config.marketplace as Address;
  const supportedNfts = useSupportedNfts();
  const { owned, refreshOwned } = useOwnedBrokers();

  const [listNft, setListNft] = useState<Address>((config.expandedNft || config.originalNft || "") as Address);
  const [listTokenId, setListTokenId] = useState<string>("");
  const [listPriceEth, setListPriceEth] = useState<string>("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");

  const filteredOwned = useMemo(() => owned.filter((o) => o.nft.toLowerCase() === listNft?.toLowerCase()), [owned, listNft]);

  async function createListing() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!listTokenId) { setStatus("Select a broker to list."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      setStatus("Preparing listing...");
      setStatusType("info");
      await requireCorrectChain();
      const tokenId = BigInt(listTokenId);
      const price = parseEther(listPriceEth || "0");
      if (price <= 0n) throw new Error("Set a price > 0");

      // Approve
      const approved = (await publicClient.readContract({ address: listNft, abi: ERC721EnumerableAbi, functionName: "getApproved", args: [tokenId] })) as Address;
      const isAll = (await publicClient.readContract({ address: listNft, abi: ERC721EnumerableAbi, functionName: "isApprovedForAll", args: [address, marketplace] })) as boolean;
      if (approved?.toLowerCase() !== marketplace.toLowerCase() && !isAll) {
        setStatus("Approving marketplace...");
        const appTx = await walletClient.writeContract({
          address: listNft, abi: ERC721EnumerableAbi, functionName: "approve", args: [marketplace, tokenId],
          chain: robinhoodTestnet, account: address
        });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }

      setStatus("Awaiting signature...");
      const tx = await walletClient.writeContract({
        address: marketplace, abi: StonkMarketplaceAbi, functionName: "createEthListing", args: [listNft, tokenId, price],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      setStatus("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Listing created!");
      setStatusType("success");
      setListTokenId("");
      setListPriceEth("");
      await refreshOwned();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";

  return (
    <div className="space-y-4">
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-4 space-y-3">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">List Broker for Sale</div>
        <div className="text-lm-terminal-lightgray text-xs">
          Your broker will be escrowed in the marketplace contract until sold or you cancel.
        </div>

        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-xs">Collection</div>
          <div className="flex gap-1 flex-wrap">
            {supportedNfts.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setListNft(n); setListTokenId(""); }}
                className={`text-xs px-2 py-1 border transition-colors ${
                  listNft?.toLowerCase() === n.toLowerCase()
                    ? "border-lm-orange text-lm-orange bg-lm-orange/5"
                    : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                }`}
              >
                {collectionLabel(n)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-xs">Your Broker</div>
          {filteredOwned.length === 0 ? (
            <div className="text-lm-gray text-xs py-2">{address ? "No brokers from this collection." : "Connect wallet to see your brokers."}</div>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {filteredOwned.map((o) => (
                <button
                  key={`${o.nft}:${o.tokenId}`}
                  type="button"
                  onClick={() => setListTokenId(o.tokenId.toString())}
                  className={`text-xs px-2 py-1 border transition-colors ${
                    listTokenId === o.tokenId.toString()
                      ? "border-lm-orange text-lm-orange bg-lm-orange/5"
                      : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"
                  }`}
                >
                  #{o.tokenId.toString()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-xs">Price (ETH)</div>
          <Input value={listPriceEth} onValueChange={setListPriceEth} placeholder="0.05" />
        </div>

        <Button onClick={createListing} loading={busy} disabled={busy || !listTokenId} variant="primary" size="lg" className="w-full">
          {busy ? "Creating Listing..." : !address ? "Connect Wallet" : "Create Listing"}
        </Button>
      </div>

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
          {lastTxHash && <a href={explorerTx(lastTxHash)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline flex-shrink-0">View Tx →</a>}
        </div>
      )}
    </div>
  );
}

/* ── Create Swap Tab ── */
export function SwapTab() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const marketplace = config.marketplace as Address;
  const supportedNfts = useSupportedNfts();
  const { owned, refreshOwned } = useOwnedBrokers();

  const [offeredNft, setOfferedNft] = useState<Address>((config.expandedNft || config.originalNft || "") as Address);
  const [offeredTokenId, setOfferedTokenId] = useState<string>("");
  const [requestedNft, setRequestedNft] = useState<Address>((config.expandedNft || config.originalNft || "") as Address);
  const [requestedTokenId, setRequestedTokenId] = useState<string>("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");

  const offeredFiltered = useMemo(() => owned.filter((o) => o.nft.toLowerCase() === offeredNft?.toLowerCase()), [owned, offeredNft]);

  async function createSwap() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!offeredTokenId) { setStatus("Select your broker to offer."); setStatusType("error"); return; }
    if (!requestedTokenId) { setStatus("Enter the token ID you want."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      setStatus("Preparing swap...");
      setStatusType("info");
      await requireCorrectChain();
      const oId = BigInt(offeredTokenId);
      const rId = BigInt(requestedTokenId);

      const approved = (await publicClient.readContract({ address: offeredNft, abi: ERC721EnumerableAbi, functionName: "getApproved", args: [oId] })) as Address;
      const isAll = (await publicClient.readContract({ address: offeredNft, abi: ERC721EnumerableAbi, functionName: "isApprovedForAll", args: [address, marketplace] })) as boolean;
      if (approved?.toLowerCase() !== marketplace.toLowerCase() && !isAll) {
        setStatus("Approving marketplace...");
        const appTx = await walletClient.writeContract({
          address: offeredNft, abi: ERC721EnumerableAbi, functionName: "approve", args: [marketplace, oId],
          chain: robinhoodTestnet, account: address
        });
        await publicClient.waitForTransactionReceipt({ hash: appTx });
      }

      setStatus("Awaiting signature...");
      const tx = await walletClient.writeContract({
        address: marketplace, abi: StonkMarketplaceAbi, functionName: "createSwapOffer", args: [offeredNft, oId, requestedNft, rId],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(tx);
      setStatus("Confirming...");
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setStatus("Swap offer created!");
      setStatusType("success");
      setOfferedTokenId("");
      setRequestedTokenId("");
      await refreshOwned();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally {
      setBusy(false);
    }
  }

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";

  return (
    <div className="space-y-4">
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-4 space-y-3">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Create Swap Offer</div>
        <div className="text-lm-terminal-lightgray text-xs">
          Trade your broker for another. Your NFT is escrowed until the swap is accepted or you cancel.
        </div>

        {/* Offering */}
        <div className="space-y-1">
          <div className="text-lm-orange text-xs font-bold">YOU OFFER</div>
          <div className="flex gap-1 flex-wrap">
            {supportedNfts.map((n) => (
              <button key={n} type="button" onClick={() => { setOfferedNft(n); setOfferedTokenId(""); }}
                className={`text-xs px-2 py-1 border transition-colors ${offeredNft?.toLowerCase() === n.toLowerCase() ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
                {collectionLabel(n)}
              </button>
            ))}
          </div>
          {offeredFiltered.length === 0 ? (
            <div className="text-lm-gray text-xs py-1">{address ? "No brokers from this collection." : "Connect wallet."}</div>
          ) : (
            <div className="flex gap-1 flex-wrap">
              {offeredFiltered.map((o) => (
                <button key={`${o.nft}:${o.tokenId}`} type="button" onClick={() => setOfferedTokenId(o.tokenId.toString())}
                  className={`text-xs px-2 py-1 border transition-colors ${offeredTokenId === o.tokenId.toString() ? "border-lm-orange text-lm-orange bg-lm-orange/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
                  #{o.tokenId.toString()}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="text-center text-lm-gray text-xs">↓ for ↓</div>

        {/* Requesting */}
        <div className="space-y-1">
          <div className="text-lm-green text-xs font-bold">YOU WANT</div>
          <div className="flex gap-1 flex-wrap">
            {supportedNfts.map((n) => (
              <button key={n} type="button" onClick={() => setRequestedNft(n)}
                className={`text-xs px-2 py-1 border transition-colors ${requestedNft?.toLowerCase() === n.toLowerCase() ? "border-lm-green text-lm-green bg-lm-green/5" : "border-lm-terminal-gray text-lm-gray hover:border-lm-gray"}`}>
                {collectionLabel(n)}
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Token ID</div>
            <Input value={requestedTokenId} onValueChange={setRequestedTokenId} placeholder="e.g. 445" />
          </div>
        </div>

        <Button onClick={createSwap} loading={busy} disabled={busy || !offeredTokenId || !requestedTokenId} variant="primary" size="lg" className="w-full">
          {busy ? "Creating Swap..." : !address ? "Connect Wallet" : "Create Swap Offer"}
        </Button>
      </div>

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
          {lastTxHash && <a href={explorerTx(lastTxHash)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline flex-shrink-0">View Tx →</a>}
        </div>
      )}
    </div>
  );
}

/* ── My Activity Tab ── */
export function MyActivityTab() {
  const { address, walletClient, requireCorrectChain } = useWallet();
  const marketplace = config.marketplace as Address;
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [swaps, setSwaps] = useState<SwapItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<Record<string, string>>({});
  const [actionType, setActionType] = useState<Record<string, "info" | "success" | "error">>({});

  async function refresh() {
    if (!address || !marketplace) { setListings([]); setSwaps([]); return; }
    setLoading(true);
    setStatus("");
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 50_000n ? latest - 50_000n : 0n;

      const [lLogs, sLogs] = await Promise.all([
        publicClient.getLogs({
          address: marketplace,
          event: parseAbiItem("event ListingCreated(uint256 indexed listingId,address indexed seller,address indexed nft,uint256 tokenId,uint8 kind,address paymentToken,uint256 price)"),
          args: { seller: address },
          fromBlock, toBlock: latest
        }),
        publicClient.getLogs({
          address: marketplace,
          event: parseAbiItem("event SwapCreated(uint256 indexed swapId,address indexed maker,address indexed offeredNft,uint256 offeredTokenId,address requestedNft,uint256 requestedTokenId)"),
          args: { maker: address },
          fromBlock, toBlock: latest
        })
      ]);

      const myListings: ListingItem[] = [];
      for (const id of [...new Set(lLogs.map((l) => l.args.listingId as bigint))].reverse().slice(0, 30)) {
        try {
          const l = (await publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "listings", args: [id] })) as any;
          myListings.push({ kind: "listing", id, seller: l.seller as Address, nft: l.nft as Address, tokenId: l.tokenId as bigint, price: l.price as bigint, active: Boolean(l.active) });
        } catch { /* skip */ }
      }

      const mySwaps: SwapItem[] = [];
      for (const id of [...new Set(sLogs.map((l) => l.args.swapId as bigint))].reverse().slice(0, 30)) {
        try {
          const s = (await publicClient.readContract({ address: marketplace, abi: StonkMarketplaceAbi, functionName: "swaps", args: [id] })) as any;
          mySwaps.push({ kind: "swap", id, maker: s.maker as Address, offeredNft: s.offeredNft as Address, offeredTokenId: s.offeredTokenId as bigint, requestedNft: s.requestedNft as Address, requestedTokenId: s.requestedTokenId as bigint, active: Boolean(s.active) });
        } catch { /* skip */ }
      }

      setListings(myListings);
      setSwaps(mySwaps);
      if (myListings.length === 0 && mySwaps.length === 0) setStatus("No activity found in recent blocks.");
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function cancelListing(id: bigint) {
    if (!address || !walletClient) return;
    const key = `cl-${id}`;
    setActionStatus((prev) => ({ ...prev, [key]: "Cancelling..." }));
    setActionType((prev) => ({ ...prev, [key]: "info" }));
    try {
      await requireCorrectChain();
      const tx = await walletClient.writeContract({
        address: marketplace, abi: StonkMarketplaceAbi, functionName: "cancelListing", args: [id],
        chain: robinhoodTestnet, account: address
      });
      setActionStatus((prev) => ({ ...prev, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((prev) => ({ ...prev, [key]: "Cancelled!" }));
      setActionType((prev) => ({ ...prev, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      setActionStatus((prev) => ({ ...prev, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  async function cancelSwapOffer(id: bigint) {
    if (!address || !walletClient) return;
    const key = `cs-${id}`;
    setActionStatus((prev) => ({ ...prev, [key]: "Cancelling..." }));
    setActionType((prev) => ({ ...prev, [key]: "info" }));
    try {
      await requireCorrectChain();
      const tx = await walletClient.writeContract({
        address: marketplace, abi: StonkMarketplaceAbi, functionName: "cancelSwapOffer", args: [id],
        chain: robinhoodTestnet, account: address
      });
      setActionStatus((prev) => ({ ...prev, [key]: "Confirming..." }));
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setActionStatus((prev) => ({ ...prev, [key]: "Cancelled!" }));
      setActionType((prev) => ({ ...prev, [key]: "success" }));
      await refresh();
    } catch (e: any) {
      setActionStatus((prev) => ({ ...prev, [key]: String(e?.shortMessage || e?.message || e) }));
      setActionType((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  useEffect(() => { refresh().catch(() => {}); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!address) return (
    <div className="text-center py-10 space-y-2">
      <div className="text-lm-terminal-lightgray text-lg">No Wallet Connected</div>
      <div className="text-lm-terminal-lightgray text-xs opacity-60">Connect your wallet to view your marketplace activity.</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs">
          {listings.length > 0 && <span className="text-lm-orange font-bold">{listings.length} listing{listings.length !== 1 ? "s" : ""}</span>}
          {swaps.length > 0 && <span className="text-lm-green font-bold">{swaps.length} swap{swaps.length !== 1 ? "s" : ""}</span>}
          {listings.length === 0 && swaps.length === 0 && !loading && <span className="text-lm-terminal-lightgray">No activity</span>}
        </div>
        <button type="button" onClick={() => refresh()} disabled={loading}
          className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-bold">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {status && listings.length === 0 && swaps.length === 0 && (
        <div className="text-center py-8 space-y-2">
          <div className="text-lm-terminal-lightgray text-lg">No Activity Yet</div>
          <div className="text-lm-terminal-lightgray text-xs opacity-60">{status}</div>
        </div>
      )}

      {/* My listings */}
      {listings.length > 0 && (
        <div className="space-y-2">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Your Listings</div>
          {listings.map((it) => {
            const key = `cl-${it.id}`;
            const actStatus = actionStatus[key];
            const actTp = actionType[key] || "info";
            const actColor = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";

            return (
              <div key={key} className={`bg-lm-terminal-darkgray border p-3 flex items-center justify-between gap-3 flex-wrap ${it.active ? "border-lm-orange/20" : "border-lm-terminal-gray opacity-60"}`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{collectionLabel(it.nft)} #{it.tokenId.toString()}</span>
                    <span className={`lm-badge ${it.active ? "lm-badge-green" : "lm-badge-gray"}`}>
                      {it.active ? "ACTIVE" : "SOLD"}
                    </span>
                  </div>
                  <div className="text-white text-xs lm-mono font-bold">{formatEther(it.price)} ETH</div>
                </div>
                <div className="flex items-center gap-2">
                  {it.active && (
                    <button type="button" onClick={() => cancelListing(it.id)}
                      disabled={actionType[`cl-${it.id}`] === "info"}
                      className="text-xs px-3 py-1.5 bg-lm-red/10 text-lm-red border border-lm-red/30 hover:bg-lm-red/20 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                      {actionType[`cl-${it.id}`] === "info" ? "Cancelling..." : "Cancel Listing"}
                    </button>
                  )}
                  {actStatus && <span className={`text-[10px] ${actColor}`}>{actStatus}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* My swaps */}
      {swaps.length > 0 && (
        <div className="space-y-2">
          <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Your Swap Offers</div>
          {swaps.map((it) => {
            const key = `cs-${it.id}`;
            const actStatus = actionStatus[key];
            const actTp = actionType[key] || "info";
            const actColor = actTp === "success" ? "text-lm-green" : actTp === "error" ? "text-lm-red" : "text-lm-gray";

            return (
              <div key={key} className={`bg-lm-terminal-darkgray border p-3 flex items-center justify-between gap-3 flex-wrap ${it.active ? "border-lm-green/20" : "border-lm-terminal-gray opacity-60"}`}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">{collectionLabel(it.offeredNft)} #{it.offeredTokenId.toString()}</span>
                    <span className="text-lm-orange text-xs font-bold">→</span>
                    <span className="text-white font-bold text-sm">{collectionLabel(it.requestedNft)} #{it.requestedTokenId.toString()}</span>
                    <span className={`lm-badge ${it.active ? "lm-badge-green" : "lm-badge-gray"}`}>
                      {it.active ? "OPEN" : "FILLED"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {it.active && (
                    <button type="button" onClick={() => cancelSwapOffer(it.id)}
                      disabled={actionType[`cs-${it.id}`] === "info"}
                      className="text-xs px-3 py-1.5 bg-lm-red/10 text-lm-red border border-lm-red/30 hover:bg-lm-red/20 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                      {actionType[`cs-${it.id}`] === "info" ? "Cancelling..." : "Cancel Swap"}
                    </button>
                  )}
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

/* ── Legacy export for backward compat ── */
export function MarketplacePanel() {
  return <FeedTab />;
}
