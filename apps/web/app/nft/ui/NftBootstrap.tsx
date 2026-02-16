"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Address, encodeFunctionData, formatEther, formatUnits, parseUnits } from "viem";
import { Panel } from "../../components/Terminal";
import { TerminalTabs } from "../../components/Tabs";
import { TerminalTable } from "../../components/Table";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient } from "../../providers";
import { config } from "../../lib/config";
import { IntentTerminal, IntentAction } from "../../components/IntentTerminal";
import {
  ERC721EnumerableAbi,
  ERC20Abi,
  ERC20MetadataAbi,
  BrokerNftAbi,
  StonkBroker6551AccountAbi,
  StonkTokenRegistryAbi
} from "../../lib/abis";

/* ── Constants ── */
const STOCK_TOKENS: Address[] = [
  "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E",
  "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02",
  "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0",
  "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93",
  "0x71178BAc73cBeb415514eB542a8995b82669778d"
] as Address[];

type BrokerWallet = {
  collection: string;
  nft: Address;
  tokenId: bigint;
  image?: string;
  walletAddr?: Address;
};

type TokenBalance = {
  token: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
};

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

function short(a: string) { return a.slice(0, 6) + "..." + a.slice(-4); }

/* ── Shared: load all owned brokers ── */
async function loadOwnedBrokers(owner: Address): Promise<BrokerWallet[]> {
  const collections: Array<{ label: string; addr: Address }> = [];
  if (config.originalNft) collections.push({ label: "Original", addr: config.originalNft as Address });
  if (config.legacyExpandedNft) collections.push({ label: "Expanded (Legacy)", addr: config.legacyExpandedNft as Address });
  if (config.expandedNft) collections.push({ label: "Expanded", addr: config.expandedNft as Address });

  const all: BrokerWallet[] = [];
  for (const c of collections) {
    try {
      const bal = (await publicClient.readContract({ address: c.addr, abi: ERC721EnumerableAbi, functionName: "balanceOf", args: [owner] })) as bigint;
      const cap = bal > 30n ? 30 : Number(bal);
      for (let i = 0; i < cap; i++) {
        const tokenId = (await publicClient.readContract({ address: c.addr, abi: ERC721EnumerableAbi, functionName: "tokenOfOwnerByIndex", args: [owner, BigInt(i)] })) as bigint;
        all.push({ collection: c.label, nft: c.addr, tokenId });
      }
    } catch { /* skip */ }
  }
  all.sort((a, b) => (a.tokenId === b.tokenId ? 0 : a.tokenId > b.tokenId ? 1 : -1));
  return all;
}

/* ══════════════════════════════════════════════════════════════
   WALLETS TAB
   ══════════════════════════════════════════════════════════════ */

function WalletsTab() {
  const { address } = useWallet();
  const [wallets, setWallets] = useState<BrokerWallet[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ethBalances, setEthBalances] = useState<Record<string, bigint>>({});

  async function refresh() {
    if (!address) { setWallets([]); return; }
    setBusy(true);
    setStatus("Loading broker wallets...");
    try {
      const all = await loadOwnedBrokers(address);
      const BATCH = 6;
      for (let i = 0; i < all.length; i += BATCH) {
        await Promise.all(all.slice(i, i + BATCH).map(async (item) => {
          try { item.walletAddr = (await publicClient.readContract({ address: item.nft, abi: BrokerNftAbi, functionName: "predictWallet", args: [item.tokenId] })) as Address; } catch { /**/ }
          try { const uri = (await publicClient.readContract({ address: item.nft, abi: ERC721EnumerableAbi, functionName: "tokenURI", args: [item.tokenId] })) as string; item.image = parseTokenUriImage(uri); } catch { /**/ }
        }));
      }
      const bals: Record<string, bigint> = {};
      await Promise.all(all.filter((w) => w.walletAddr && w.walletAddr !== "0x0000000000000000000000000000000000000000").map(async (w) => {
        try { bals[w.walletAddr!] = await publicClient.getBalance({ address: w.walletAddr! }); } catch { /**/ }
      }));
      setEthBalances(bals);
      setWallets(all);
      setStatus(all.length === 0 ? "No brokers found." : "");
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
    } finally { setBusy(false); }
  }

  useEffect(() => { refresh().catch(() => {}); }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const walletsWithAddr = wallets.filter((w) => w.walletAddr && w.walletAddr !== "0x0000000000000000000000000000000000000000");
  const totalEth = Object.values(ethBalances).reduce((sum, v) => sum + v, 0n);

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="lm-stat">
          <div className="lm-stat-value">{wallets.length}</div>
          <div className="lm-stat-label">Brokers</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value text-lm-green">{walletsWithAddr.length}</div>
          <div className="lm-stat-label">Active Wallets</div>
        </div>
        <div className="lm-stat">
          <div className="lm-stat-value text-lm-orange">{totalEth > 0n ? Number(formatEther(totalEth)).toFixed(4) : "0"}</div>
          <div className="lm-stat-label">Total ETH</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">
          {busy ? <span className="lm-pulse">Scanning wallets...</span> : `${wallets.length} Broker Wallet${wallets.length !== 1 ? "s" : ""}`}
        </div>
        <button type="button" onClick={() => refresh()} disabled={busy}
          className="text-[10px] px-2 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-bold">
          {busy ? "..." : "Refresh"}
        </button>
      </div>

      <div className="lm-callout lm-callout-green">
        <span className="lm-badge lm-badge-green mr-2">ERC-6551</span>
        Each Stonk Broker has a token-bound wallet holding stock tokens granted at mint. Use the <span className="text-lm-orange font-bold">Claim</span> tab to withdraw tokens.
      </div>

      {!address ? (
        <div className="text-center py-8 space-y-1">
          <div className="text-lm-terminal-lightgray text-lg opacity-30">👤</div>
          <div className="text-lm-terminal-lightgray text-sm">Connect wallet to view broker wallets</div>
        </div>
      ) : wallets.length === 0 && !busy ? (
        <div className="text-center py-8 space-y-1">
          <div className="text-lm-terminal-lightgray text-lg opacity-30">🏦</div>
          <div className="text-lm-terminal-lightgray text-sm">{status || "No brokers found"}</div>
          <div className="text-lm-terminal-lightgray text-[10px] opacity-60">Mint a Stonk Broker to get a funded wallet</div>
        </div>
      ) : busy ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-lm-black border border-lm-terminal-gray p-2 flex gap-2">
              <div className="w-16 h-16 lm-skeleton flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 lm-skeleton w-1/3" />
                <div className="h-2 lm-skeleton w-2/3" />
                <div className="h-2 lm-skeleton w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {wallets.map((w, i) => {
            const ethBal = w.walletAddr ? ethBalances[w.walletAddr] : undefined;
            const hasWallet = w.walletAddr && w.walletAddr !== "0x0000000000000000000000000000000000000000";
            return (
              <div key={`${w.nft}:${w.tokenId}`}
                className="bg-lm-black border border-lm-terminal-gray p-2.5 lm-card-hover lm-fade-in"
                style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
                <div className="flex gap-2.5">
                  <div className="w-16 h-16 border border-lm-terminal-gray bg-lm-terminal-darkgray flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {w.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.image} alt="" className="w-full h-full object-contain" loading="lazy" />
                    ) : (
                      <span className="text-lm-gray text-[10px] lm-mono">#{w.tokenId.toString()}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-xs">#{w.tokenId.toString()}</span>
                      <span className={`lm-badge ${w.collection === "Original" ? "lm-badge-green" : w.collection === "Expanded" ? "lm-badge-orange" : "lm-badge-gray"}`}>
                        {w.collection === "Original" ? "OG" : w.collection === "Expanded" ? "EXP" : "LEG"}
                      </span>
                    </div>
                    {hasWallet ? (
                      <div className="mt-1 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-lm-green flex-shrink-0 lm-pulse" />
                          <a href={`${config.blockExplorerUrl}/address/${w.walletAddr}`} target="_blank" rel="noreferrer"
                            className="text-lm-orange hover:underline text-[10px] lm-mono truncate">{short(w.walletAddr!)}</a>
                        </div>
                        {ethBal !== undefined && ethBal > 0n && (
                          <div className="text-[10px] text-lm-terminal-lightgray">
                            ETH: <span className="text-white lm-mono font-bold">{Number(formatEther(ethBal)).toFixed(6)}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <a href={`${config.blockExplorerUrl}/token/${w.nft}?a=${w.tokenId.toString()}`} target="_blank" rel="noreferrer"
                        className="text-lm-orange text-[10px] hover:underline mt-1 inline-block">View on Explorer →</a>
                    )}
                  </div>
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
   CLAIM TAB
   ══════════════════════════════════════════════════════════════ */

function ClaimTab() {
  const { address, walletClient } = useWallet();
  const [brokers, setBrokers] = useState<BrokerWallet[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(-1);
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [ethBal, setEthBal] = useState<bigint>(0n);
  const [loadStatus, setLoadStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [txStatus, setTxStatus] = useState("");
  const [txType, setTxType] = useState<"info" | "success" | "error">("info");
  const [claimToken, setClaimToken] = useState<Address | "">("");
  const [claimAmount, setClaimAmount] = useState("");

  useEffect(() => {
    if (!address) { setBrokers([]); return; }
    setLoadStatus("Loading your brokers...");
    loadOwnedBrokers(address)
      .then(async (list) => {
        const BATCH = 6;
        for (let i = 0; i < list.length; i += BATCH) {
          await Promise.all(
            list.slice(i, i + BATCH).map(async (item) => {
              try { item.walletAddr = (await publicClient.readContract({ address: item.nft, abi: BrokerNftAbi, functionName: "predictWallet", args: [item.tokenId] })) as Address; } catch { /**/ }
              try { const uri = (await publicClient.readContract({ address: item.nft, abi: ERC721EnumerableAbi, functionName: "tokenURI", args: [item.tokenId] })) as string; item.image = parseTokenUriImage(uri); } catch { /**/ }
            })
          );
        }
        setBrokers(list);
        setLoadStatus(list.length === 0 ? "No brokers found." : "");
      })
      .catch((e) => setLoadStatus(String(e?.message || e)));
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = selectedIdx >= 0 && selectedIdx < brokers.length ? brokers[selectedIdx] : null;

  useEffect(() => {
    if (!selected?.walletAddr || selected.walletAddr === "0x0000000000000000000000000000000000000000") {
      setBalances([]); setEthBal(0n); return;
    }
    const walletAddr = selected.walletAddr;
    setLoadStatus("Loading wallet balances...");
    (async () => {
      try {
        const ethBalance = await publicClient.getBalance({ address: walletAddr });
        setEthBal(ethBalance);

        let tokensToCheck = [...STOCK_TOKENS];
        if (config.tokenRegistry) {
          try {
            const count = (await publicClient.readContract({ address: config.tokenRegistry, abi: StonkTokenRegistryAbi, functionName: "tokenCount" })) as bigint;
            for (let i = 0n; i < count && i < 50n; i++) {
              const addr = (await publicClient.readContract({ address: config.tokenRegistry, abi: StonkTokenRegistryAbi, functionName: "tokenAt", args: [i] })) as Address;
              if (!tokensToCheck.some((t) => t.toLowerCase() === addr.toLowerCase())) tokensToCheck.push(addr);
            }
          } catch { /**/ }
        }

        const bals: TokenBalance[] = [];
        const symCache: Record<string, { symbol: string; decimals: number }> = {};
        await Promise.all(tokensToCheck.map(async (token) => {
          try {
            const balance = (await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "balanceOf", args: [walletAddr] })) as bigint;
            if (balance <= 0n) return;
            if (!symCache[token.toLowerCase()]) {
              let sym = token.slice(0, 6), dec = 18;
              try { sym = (await publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "symbol" })) as string; } catch { /**/ }
              try { dec = Number(await publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "decimals" })); } catch { /**/ }
              symCache[token.toLowerCase()] = { symbol: sym, decimals: dec };
            }
            const meta = symCache[token.toLowerCase()];
            bals.push({ token, symbol: meta.symbol, decimals: meta.decimals, balance });
          } catch { /**/ }
        }));
        bals.sort((a, b) => a.symbol.localeCompare(b.symbol));
        setBalances(bals);
        setLoadStatus("");
      } catch (e: any) {
        setLoadStatus(String(e?.shortMessage || e?.message || e));
      }
    })();
  }, [selected?.walletAddr]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClaim() {
    if (!selected?.walletAddr || !claimToken || !address || !walletClient) return;
    const tokenMeta = balances.find((b) => b.token === claimToken);
    if (!tokenMeta) return;
    let amountWei: bigint;
    try { amountWei = parseUnits(claimAmount || "0", tokenMeta.decimals); } catch { setTxStatus("Invalid amount"); setTxType("error"); return; }
    if (amountWei <= 0n) { setTxStatus("Enter an amount > 0"); setTxType("error"); return; }
    if (amountWei > tokenMeta.balance) { setTxStatus("Amount exceeds wallet balance"); setTxType("error"); return; }

    setBusy(true);
    setTxStatus("Preparing transfer..."); setTxType("info");
    try {
      const transferData = encodeFunctionData({ abi: ERC20Abi, functionName: "transfer", args: [address, amountWei] });
      setTxStatus("Awaiting wallet signature...");
      const hash = await walletClient.writeContract({
        address: selected.walletAddr, abi: StonkBroker6551AccountAbi, functionName: "executeCall",
        args: [claimToken, 0n, transferData], chain: walletClient.chain, account: address
      });
      setTxStatus(`Confirming... ${short(hash)}`);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus(`Claimed ${claimAmount} ${tokenMeta.symbol} successfully!`);
      setTxType("success");
      const updated = (await publicClient.readContract({ address: claimToken, abi: ERC20Abi, functionName: "balanceOf", args: [selected.walletAddr] })) as bigint;
      setBalances((prev) => prev.map((b) => (b.token === claimToken ? { ...b, balance: updated } : b)).filter((b) => b.balance > 0n));
      setClaimAmount("");
    } catch (e: any) {
      setTxStatus(String(e?.shortMessage || e?.message || e)); setTxType("error");
    } finally { setBusy(false); }
  }

  async function handleClaimEth() {
    if (!selected?.walletAddr || !address || !walletClient) return;
    if (ethBal <= 0n) { setTxStatus("No ETH in wallet"); setTxType("error"); return; }
    setBusy(true);
    setTxStatus("Sending ETH from broker wallet..."); setTxType("info");
    try {
      const hash = await walletClient.writeContract({
        address: selected.walletAddr, abi: StonkBroker6551AccountAbi, functionName: "executeCall",
        args: [address, ethBal, "0x" as `0x${string}`], chain: walletClient.chain, account: address
      });
      setTxStatus(`Confirming... ${short(hash)}`);
      await publicClient.waitForTransactionReceipt({ hash });
      setTxStatus(`Claimed ${formatEther(ethBal)} ETH successfully!`);
      setTxType("success");
      setEthBal(0n);
    } catch (e: any) {
      setTxStatus(String(e?.shortMessage || e?.message || e)); setTxType("error");
    } finally { setBusy(false); }
  }

  const txColor = txType === "success" ? "text-lm-green border-lm-green/30" : txType === "error" ? "text-lm-red border-lm-red/30" : "text-lm-gray border-lm-terminal-gray";

  if (!address) {
    return (
      <div className="text-center py-8 space-y-1">
        <div className="text-lm-terminal-lightgray text-lg opacity-30">🔐</div>
        <div className="text-lm-terminal-lightgray text-sm">Connect wallet to manage claims</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Select Broker */}
      <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="lm-step"><span className="lm-step-num">1</span></div>
          <div>
            <div className="text-white font-bold text-sm lm-upper">Select Broker</div>
            <div className="text-lm-terminal-lightgray text-[10px]">Choose which broker&apos;s wallet to withdraw from</div>
          </div>
        </div>
        {brokers.length === 0 ? (
          <div className="text-lm-terminal-lightgray text-xs py-4 text-center">{loadStatus || "No brokers found. Mint one first."}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {brokers.map((b, idx) => (
              <button
                key={`${b.nft}:${b.tokenId}`}
                type="button"
                onClick={() => { setSelectedIdx(idx); setClaimToken(""); setClaimAmount(""); setTxStatus(""); }}
                className={`border p-1 transition-all ${
                  selectedIdx === idx
                    ? "border-lm-orange bg-lm-orange/10 shadow-[0_0_8px_rgba(207,255,4,0.1)]"
                    : "border-lm-terminal-gray hover:border-lm-gray"
                }`}>
                <div className="w-16 h-16 bg-lm-terminal-darkgray flex items-center justify-center overflow-hidden">
                  {b.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.image} alt="" className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <span className="text-lm-gray text-[10px] lm-mono">#{b.tokenId.toString()}</span>
                  )}
                </div>
                <div className="text-center text-[10px] text-white font-bold mt-0.5">#{b.tokenId.toString()}</div>
                <div className="text-center">
                  <span className={`lm-badge ${b.collection === "Original" ? "lm-badge-green" : b.collection === "Expanded" ? "lm-badge-orange" : "lm-badge-gray"}`}>
                    {b.collection === "Original" ? "OG" : b.collection === "Expanded" ? "EXP" : "LEG"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Wallet Balances */}
      {selected && (
        <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3 lm-fade-in">
          <div className="flex items-center gap-3">
            <div className="lm-step"><span className="lm-step-num">2</span></div>
            <div>
              <div className="text-white font-bold text-sm lm-upper">Broker #{selected.tokenId.toString()} Wallet</div>
              <div className="text-lm-terminal-lightgray text-[10px]">View token balances and select what to claim</div>
            </div>
          </div>

          {selected.walletAddr && selected.walletAddr !== "0x0000000000000000000000000000000000000000" ? (
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-lm-green lm-pulse" />
                <span className="text-lm-terminal-lightgray">Wallet:</span>
                <a href={`${config.blockExplorerUrl}/address/${selected.walletAddr}`} target="_blank" rel="noreferrer"
                  className="text-lm-orange hover:underline lm-mono">{short(selected.walletAddr)}</a>
              </div>

              {/* ETH Balance */}
              <div className="flex items-center justify-between bg-lm-terminal-darkgray border border-lm-terminal-gray p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-white font-bold text-sm">ETH</span>
                  <span className="text-lm-terminal-lightgray text-xs lm-mono">{Number(formatEther(ethBal)).toFixed(8)}</span>
                </div>
                {ethBal > 0n && (
                  <button type="button" onClick={handleClaimEth} disabled={busy}
                    className="text-xs px-3 py-1.5 bg-lm-green/10 text-lm-green border border-lm-green/30 hover:bg-lm-green/20 transition-colors font-bold">
                    Claim ETH
                  </button>
                )}
              </div>

              {/* Token Balances */}
              {balances.length > 0 ? (
                <div className="space-y-1">
                  {balances.map((b) => (
                    <div key={b.token} className={`flex items-center justify-between p-2.5 border transition-colors ${
                      claimToken === b.token
                        ? "bg-lm-orange/5 border-lm-orange/30"
                        : "bg-lm-terminal-darkgray border-lm-terminal-gray hover:border-lm-gray"
                    }`}>
                      <div>
                        <div className="text-white font-bold text-sm">{b.symbol}</div>
                        <div className="text-lm-terminal-lightgray text-[10px] lm-mono">{formatUnits(b.balance, b.decimals)}</div>
                      </div>
                      <button type="button"
                        onClick={() => { setClaimToken(b.token); setClaimAmount(formatUnits(b.balance, b.decimals)); }}
                        className={`text-[10px] px-3 py-1 border font-bold transition-colors ${
                          claimToken === b.token
                            ? "border-lm-orange text-lm-orange"
                            : "border-lm-terminal-gray text-lm-gray hover:border-lm-orange hover:text-lm-orange"
                        }`}>
                        {claimToken === b.token ? "SELECTED" : "SELECT"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-lm-terminal-lightgray text-xs text-center py-4">
                  {loadStatus || "No token balances found in this broker's wallet."}
                </div>
              )}
            </>
          ) : (
            <div className="text-lm-terminal-lightgray text-xs py-4 text-center">
              Could not resolve wallet address.{" "}
              <a href={`${config.blockExplorerUrl}/token/${selected.nft}?a=${selected.tokenId.toString()}`} target="_blank" rel="noreferrer"
                className="text-lm-orange hover:underline">View on Explorer →</a>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Claim */}
      {selected && claimToken && (
        <div className="bg-lm-black border border-lm-orange/20 p-3 space-y-3 lm-fade-in">
          <div className="flex items-center gap-3">
            <div className="lm-step"><span className="lm-step-num">3</span></div>
            <div>
              <div className="text-white font-bold text-sm lm-upper">Claim Tokens</div>
              <div className="text-lm-terminal-lightgray text-[10px]">
                Transfer from Broker #{selected.tokenId.toString()} → your wallet
              </div>
            </div>
          </div>

          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-lm-terminal-lightgray">Token</span>
              <span className="text-white font-bold">{balances.find((b) => b.token === claimToken)?.symbol || short(claimToken)}</span>
            </div>
            <div className="space-y-1">
              <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">Amount</div>
              <div className="flex gap-2">
                <Input value={claimAmount} onValueChange={setClaimAmount} placeholder="0.0" className="flex-1" />
                <button type="button"
                  onClick={() => { const meta = balances.find((b) => b.token === claimToken); if (meta) setClaimAmount(formatUnits(meta.balance, meta.decimals)); }}
                  className="text-[10px] px-3 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors font-bold">
                  MAX
                </button>
              </div>
            </div>
          </div>

          <Button onClick={handleClaim} loading={busy} disabled={busy || !claimAmount} variant="primary" size="lg" className="w-full lm-upper tracking-wider">
            {busy ? "Claiming..." : `Claim ${balances.find((b) => b.token === claimToken)?.symbol || "Tokens"}`}
          </Button>
        </div>
      )}

      {/* Status */}
      {txStatus && (
        <div className={`text-xs p-2.5 border bg-lm-black flex items-center gap-2 ${txColor} ${
          txColor.includes("green") ? "border-lm-green/20" : txColor.includes("red") ? "border-lm-red/20" : "border-lm-terminal-gray"
        }`}>
          {txColor.includes("green") && <span className="lm-dot lm-dot-green flex-shrink-0" />}
          {txColor.includes("red") && <span className="lm-dot lm-dot-red flex-shrink-0" />}
          {!txColor.includes("green") && !txColor.includes("red") && <span className="lm-spinner flex-shrink-0" style={{ width: 12, height: 12, borderWidth: 1.5 }} />}
          <span>{txStatus}</span>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ══════════════════════════════════════════════════════════════ */

export function NftBootstrap({ NftPanel }: { NftPanel: React.ComponentType }) {
  const tabs = useMemo(
    () => [
      { id: "mint", label: "Mint", hint: "Mint expanded collection" },
      { id: "wallets", label: "Wallets", hint: "Token-bound wallets" },
      { id: "claim", label: "Claim", hint: "Claim stock tokens from brokers" }
    ],
    []
  );
  const [active, setActive] = useState("mint");

  const handleIntent = useCallback((intent: IntentAction) => {
    if (intent.type === "mint_nft") setActive("mint");
    else if (intent.type === "refresh_nfts") setActive("wallets");
    else if (intent.type === "claim_eth" || intent.type === "claim_tokens") setActive("claim");
    else if (intent.type === "switch_tab" && ["mint","wallets","claim"].includes(intent.tab)) setActive(intent.tab);
  }, []);

  return (
    <div className="space-y-4">
      <IntentTerminal
        context="nft"
        onIntent={handleIntent}
        placeholder="mint 3 · claim eth from broker #5 · claim tokens · refresh brokers · help"
      />
      <Panel
        title="Collection Console"
        hint="Original + expanded collections present as one timeline."
        right={<TerminalTabs tabs={tabs} active={active} onChange={setActive} />}
      >
        {active === "mint" ? <NftPanel /> : null}
        {active === "wallets" ? <WalletsTab /> : null}
        {active === "claim" ? <ClaimTab /> : null}
      </Panel>
    </div>
  );
}
