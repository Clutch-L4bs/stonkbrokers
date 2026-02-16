"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Address, formatEther, formatUnits, parseEther, parseUnits } from "viem";
import { Button } from "../../../components/Button";
import { Input } from "../../../components/Input";
import { useWallet } from "../../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../../providers";
import { config } from "../../../lib/config";
import Link from "next/link";
import {
  ERC20Abi,
  ERC20MetadataAbi,
  StonkLaunchAbi,
  StonkLpFeeSplitterAbi,
  StonkYieldStakingVaultAbi
} from "../../../lib/abis";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;

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

function fmtTokens(wei: bigint, decimals = 18): string {
  const raw = formatUnits(wei, decimals);
  const num = Number(raw);
  if (num === 0) return "0";
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (num >= 0.01) return num.toFixed(4);
  return num.toExponential(2);
}

function fmtEth(wei: bigint): string {
  if (wei === 0n) return "0";
  const raw = formatUnits(wei, 18);
  const num = Number(raw);
  if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.001) return num.toFixed(6);
  if (num >= 0.000001) return num.toFixed(8);
  return num.toExponential(2);
}

function fmtPrice(weiPerToken: bigint): string {
  if (weiPerToken === 0n) return "—";
  const num = Number(formatEther(weiPerToken));
  if (num >= 1) return `${num.toFixed(4)} ETH`;
  if (num >= 0.001) return `${num.toFixed(6)} ETH`;
  if (num >= 0.000001) return `${(num * 1_000_000).toFixed(2)} µETH`;
  return `${num.toExponential(2)} ETH`;
}

function formatUnlockTime(ts: bigint): string {
  if (ts === 0n) return "—";
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (ts <= now) return "Unlocked";
  const diff = Number(ts - now);
  if (diff < 3600) return `~${Math.ceil(diff / 60)} minutes remaining`;
  if (diff < 86400) return `~${Math.ceil(diff / 3600)} hours remaining`;
  return `~${Math.ceil(diff / 86400)} days remaining`;
}

export function LaunchView({ launch }: { launch: string }) {
  const launchAddr = useMemo(() => asAddress(launch), [launch]);
  const { address, walletClient, requireCorrectChain } = useWallet();

  const [memeToken, setMemeToken] = useState<Address | undefined>();
  const [stakingVault, setStakingVault] = useState<Address | undefined>();
  const [feeSplitter, setFeeSplitter] = useState<Address | undefined>();
  const [pool, setPool] = useState<Address | undefined>();
  const [sold, setSold] = useState<bigint>(0n);
  const [saleSupply, setSaleSupply] = useState<bigint>(0n);
  const [priceWeiPerToken, setPriceWeiPerToken] = useState<bigint>(0n);

  const [tokenSymbol, setTokenSymbol] = useState<string>("TOKEN");
  const [tokenDecimals, setTokenDecimals] = useState<number>(18);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);

  const [reward0Symbol, setReward0Symbol] = useState("WETH");
  const [reward1Symbol, setReward1Symbol] = useState("TOKEN");

  const [buyEth, setBuyEth] = useState<string>("");
  const [stakeAmt, setStakeAmt] = useState<string>("");
  const [userStaked, setUserStaked] = useState<bigint>(0n);
  const [unlockTime, setUnlockTime] = useState<bigint>(0n);
  const [pending0, setPending0] = useState<bigint>(0n);
  const [pending1, setPending1] = useState<bigint>(0n);

  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"buy" | "stake" | "claim" | "unstake" | null>(null);
  const [lastTxHash, setLastTxHash] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [token, sold_, supply_, price_, pool_, splitter_, vault_] = await Promise.all([
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "memeToken" }) as Promise<Address>,
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "sold" }) as Promise<bigint>,
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "saleSupply" }) as Promise<bigint>,
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "priceWeiPerToken" }) as Promise<bigint>,
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "pool" }) as Promise<Address>,
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "feeSplitter" }) as Promise<Address>,
        publicClient.readContract({ address: launchAddr, abi: StonkLaunchAbi, functionName: "stakingVault" }) as Promise<Address>
      ]);

      setMemeToken(token);
      setSold(sold_);
      setSaleSupply(supply_);
      setPriceWeiPerToken(price_);
      setPool(pool_);
      setFeeSplitter(splitter_);
      setStakingVault(vault_);

      const [sym, dec] = await Promise.all([
        publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "symbol" }) as Promise<string>,
        publicClient.readContract({ address: token, abi: ERC20MetadataAbi, functionName: "decimals" }) as Promise<number>
      ]);
      setTokenSymbol(sym);
      setTokenDecimals(Number(dec));

      if (vault_ && vault_ !== ZERO_ADDR) {
        try {
          const token0Addr = (await publicClient.readContract({ address: vault_, abi: StonkYieldStakingVaultAbi, functionName: "rewardToken0" })) as Address;
          const token1Addr = (await publicClient.readContract({ address: vault_, abi: StonkYieldStakingVaultAbi, functionName: "rewardToken1" })) as Address;
          try { setReward0Symbol((await publicClient.readContract({ address: token0Addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string); } catch { setReward0Symbol("WETH"); }
          try { setReward1Symbol((await publicClient.readContract({ address: token1Addr, abi: ERC20MetadataAbi, functionName: "symbol" })) as string); } catch { setReward1Symbol(sym); }
        } catch { setReward0Symbol("WETH"); setReward1Symbol(sym); }
      }

      if (address) {
        try {
          const bal = (await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "balanceOf", args: [address] })) as bigint;
          setTokenBalance(bal);
        } catch { setTokenBalance(0n); }

        if (vault_ && vault_ !== ZERO_ADDR) {
          // Make vault reads resilient to contract mismatch/reverts.
          try {
            const u = (await publicClient.readContract({
              address: vault_, abi: StonkYieldStakingVaultAbi, functionName: "users", args: [address]
            })) as any;
            setUserStaked((u?.staked as bigint) || 0n);
            setUnlockTime((u?.unlockTime as bigint) || 0n);
          } catch {
            setUserStaked(0n);
            setUnlockTime(0n);
          }
          try {
            const pending = (await publicClient.readContract({
              address: vault_, abi: StonkYieldStakingVaultAbi, functionName: "pendingRewards", args: [address]
            })) as readonly [bigint, bigint];
            setPending0(pending?.[0] || 0n);
            setPending1(pending?.[1] || 0n);
          } catch {
            setPending0(0n);
            setPending1(0n);
          }
        }
      }
    } catch (e: any) {
      setStatus(String(e?.message || e));
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, launchAddr]);

  async function buy() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    setBusy(true); setBusyAction("buy");
    setLastTxHash("");
    try {
      setStatus("Preparing purchase..."); setStatusType("info");
      await requireCorrectChain();
      let value: bigint;
      try {
        value = parseEther(buyEth || "0");
      } catch {
        throw new Error("Invalid ETH amount");
      }
      if (value <= 0n) throw new Error("Enter an ETH amount greater than 0");
      setStatus("Awaiting signature...");
      const txHash = await walletClient.writeContract({
        address: launchAddr, abi: StonkLaunchAbi, functionName: "buy", args: [],
        value, chain: robinhoodTestnet, account: address
      });
      setLastTxHash(txHash);
      setStatus("Confirming...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "success") {
        setStatus("Purchase confirmed!");
        setStatusType("success");
      } else {
        setStatus("Transaction reverted.");
        setStatusType("error");
      }
      await refresh();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally { setBusy(false); setBusyAction(null); }
  }

  async function ensureAllowance(owner: Address, spender: Address, token: Address, needed: bigint) {
    const allowance = (await publicClient.readContract({ address: token, abi: ERC20Abi, functionName: "allowance", args: [owner, spender] })) as bigint;
    if (allowance >= needed) return;
    if (!walletClient) throw new Error("No wallet client");
    setStatus(`Approving $${tokenSymbol}...`);
    const txHash = await walletClient.writeContract({
      address: token, abi: ERC20Abi, functionName: "approve", args: [spender, needed],
      chain: robinhoodTestnet, account: owner
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  async function stake() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!memeToken || !stakingVault || stakingVault === ZERO_ADDR) { setStatus("Not finalized yet."); setStatusType("error"); return; }
    setBusy(true); setBusyAction("stake");
    setLastTxHash("");
    try {
      setStatus("Preparing stake..."); setStatusType("info");
      await requireCorrectChain();
      let amt: bigint;
      try {
        amt = parseUnits(stakeAmt || "0", tokenDecimals);
      } catch {
        throw new Error(`Invalid ${tokenSymbol} amount`);
      }
      if (amt === 0n) throw new Error("Enter an amount greater than 0");
      if (amt > tokenBalance) throw new Error("Amount exceeds wallet balance");
      await ensureAllowance(address, stakingVault, memeToken, amt);
      setStatus("Staking...");
      const txHash = await walletClient.writeContract({
        address: stakingVault, abi: StonkYieldStakingVaultAbi, functionName: "stake", args: [amt],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("Staked successfully!");
      setStatusType("success");
      await refresh();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally { setBusy(false); setBusyAction(null); }
  }

  async function claim() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!stakingVault || stakingVault === ZERO_ADDR) { setStatus("Staking vault not available yet."); setStatusType("error"); return; }
    setBusy(true); setBusyAction("claim");
    setLastTxHash("");
    try {
      await requireCorrectChain();
      setStatus("Claiming rewards..."); setStatusType("info");
      const txHash = await walletClient.writeContract({
        address: stakingVault, abi: StonkYieldStakingVaultAbi, functionName: "claim", args: [],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("Rewards claimed!");
      setStatusType("success");
      await refresh();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally { setBusy(false); setBusyAction(null); }
  }

  async function unstake() {
    if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!stakingVault || stakingVault === ZERO_ADDR) { setStatus("Staking vault not available yet."); setStatusType("error"); return; }
    setBusy(true); setBusyAction("unstake");
    setLastTxHash("");
    try {
      await requireCorrectChain();
      let amt: bigint;
      try {
        amt = parseUnits(stakeAmt || "0", tokenDecimals);
      } catch {
        throw new Error(`Invalid ${tokenSymbol} amount`);
      }
      if (amt === 0n) throw new Error("Enter an amount greater than 0");
      if (amt > userStaked) throw new Error("Amount exceeds your staked balance");
      setStatus("Unstaking...");
      setStatusType("info");
      const txHash = await walletClient.writeContract({
        address: stakingVault, abi: StonkYieldStakingVaultAbi, functionName: "unstake", args: [amt],
        chain: robinhoodTestnet, account: address
      });
      setLastTxHash(txHash);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      setStatus("Unstaked!");
      setStatusType("success");
      await refresh();
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally { setBusy(false); setBusyAction(null); }
  }

  const soldPct = saleSupply === 0n ? 0 : Number((sold * 10_000n) / saleSupply) / 100;
  const remaining = saleSupply > sold ? saleSupply - sold : 0n;
  const ethRaised = priceWeiPerToken > 0n && sold > 0n ? (sold * priceWeiPerToken) / (10n ** 18n) : 0n;
  const isFinalized = pool !== undefined && pool !== ZERO_ADDR;
  const hasPending = pending0 > 0n || pending1 > 0n;
  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isLocked = unlockTime > now;

  const buyEstimate = useMemo(() => {
    if (!buyEth || priceWeiPerToken <= 0n) return "";
    try {
      const ethWei = parseEther(buyEth);
      if (ethWei <= 0n) return "";
      return fmtTokens((ethWei * 10n ** 18n) / priceWeiPerToken);
    } catch { return ""; }
  }, [buyEth, priceWeiPerToken]);

  if (loading) {
    return (
      <div className="text-lm-gray text-sm text-center py-8 animate-pulse">Loading launch data...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Launch Info ── */}
      <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-lg">${tokenSymbol}</span>
            <span className={`text-xs px-2 py-0.5 border ${isFinalized ? "border-lm-green text-lm-green" : "border-lm-orange text-lm-orange"}`}>
              {isFinalized ? "TRADING LIVE" : "SALE OPEN"}
            </span>
          </div>
          <Button onClick={() => refresh()} disabled={busy} className="text-lm-orange text-xs">
            Refresh
          </Button>
        </div>

        {/* Sale progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-lm-gray">Sale Progress</span>
            <span className="text-white font-bold">{soldPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-lm-terminal-darkgray border border-lm-terminal-gray">
            <div
              className={`h-full transition-all ${isFinalized ? "bg-lm-green" : "bg-lm-orange"}`}
              style={{ width: `${Math.min(100, soldPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-lm-terminal-lightgray">
            <span><span className="text-white lm-mono">{fmtTokens(sold, tokenDecimals)}</span> sold</span>
            <span><span className="text-white lm-mono">{fmtTokens(remaining, tokenDecimals)}</span> remaining</span>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray">Price per Token</div>
            <div className="text-white lm-mono font-bold">{fmtPrice(priceWeiPerToken)}</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray">Total Raised</div>
            <div className="text-white lm-mono font-bold">{fmtEth(ethRaised)} ETH</div>
          </div>
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-2">
            <div className="text-lm-terminal-lightgray">Your Balance</div>
            <div className="text-white lm-mono font-bold">{fmtTokens(tokenBalance, tokenDecimals)} ${tokenSymbol}</div>
          </div>
        </div>

        {/* Contract links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
          {memeToken && (
            <div>
              <div className="text-lm-terminal-lightgray">Token</div>
              <a href={explorerAddr(memeToken)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                {short(memeToken)}
              </a>
            </div>
          )}
          {isFinalized && pool && (
            <div>
              <div className="text-lm-terminal-lightgray">Trading Pool</div>
              <a href={explorerAddr(pool)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                {short(pool)}
              </a>
            </div>
          )}
          {feeSplitter && feeSplitter !== ZERO_ADDR && (
            <div>
              <div className="text-lm-terminal-lightgray">Fee Splitter</div>
              <a href={explorerAddr(feeSplitter)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                {short(feeSplitter)}
              </a>
            </div>
          )}
          {stakingVault && stakingVault !== ZERO_ADDR && (
            <div>
              <div className="text-lm-terminal-lightgray">Staking Vault</div>
              <a href={explorerAddr(stakingVault)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                {short(stakingVault)}
              </a>
            </div>
          )}
        </div>

        {/* Quick action links */}
        {isFinalized && (
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-lm-terminal-gray">
            <Link href={`/exchange?in=ETH&out=${memeToken}`} className="text-[10px] px-2 py-1 border border-lm-green text-lm-green hover:bg-lm-green/5 transition-colors">
              Trade on DEX
            </Link>
            {feeSplitter && feeSplitter !== ZERO_ADDR && (
              <button
                type="button"
                onClick={async () => {
                  if (!address || !walletClient) { setStatus("Connect wallet."); setStatusType("error"); return; }
                  setBusy(true); setLastTxHash("");
                  try {
                    await requireCorrectChain();
                    setStatus("Collecting & splitting LP fees..."); setStatusType("info");
                    const tx = await walletClient.writeContract({
                      address: feeSplitter, abi: StonkLpFeeSplitterAbi, functionName: "collectAndSplit", args: [],
                      chain: robinhoodTestnet, account: address
                    });
                    setLastTxHash(tx);
                    await publicClient.waitForTransactionReceipt({ hash: tx });
                    setStatus("Fees collected & distributed!"); setStatusType("success");
                  } catch (e: any) {
                    setStatus(String(e?.shortMessage || e?.message || e)); setStatusType("error");
                  } finally { setBusy(false); }
                }}
                disabled={busy}
                className="text-[10px] px-2 py-1 border border-lm-terminal-gray text-lm-terminal-lightgray hover:border-lm-orange hover:text-lm-orange transition-colors"
              >
                Collect & Split LP Fees
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Buy ── */}
      {!isFinalized && (
        <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
          <div className="text-white font-bold text-sm lm-upper">Buy ${tokenSymbol}</div>
          <div className="text-lm-terminal-lightgray text-xs">
            Send ETH to receive ${tokenSymbol} at the fixed sale price of <span className="text-white font-bold">{fmtPrice(priceWeiPerToken)}</span>.
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <div className="text-lm-terminal-lightgray text-xs">ETH to Spend</div>
              <Input value={buyEth} onValueChange={setBuyEth} placeholder="0.01" />
            </div>
            <Button onClick={buy} loading={busy} disabled={busy} variant="primary" className="h-8 px-4">
              {busy ? "Buying..." : "Buy"}
            </Button>
          </div>
          {buyEstimate && (
            <div className="text-[10px] text-lm-terminal-lightgray">
              You&apos;ll receive ≈ <span className="text-white font-bold">{buyEstimate} ${tokenSymbol}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Stake / Yield ── */}
      {isFinalized && (
        <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
          <div className="text-white font-bold text-sm lm-upper">Stake & Earn</div>
          <div className="text-lm-terminal-lightgray text-xs">
            Stake your ${tokenSymbol} tokens to earn a share of DEX trading fees. There is a 2-week minimum lock period.
          </div>

          {/* Your position */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-lm-terminal-darkgray p-2 border border-lm-terminal-gray">
            <div>
              <div className="text-lm-terminal-lightgray">Your Stake</div>
              <div className="text-white lm-mono font-bold">{fmtTokens(userStaked, tokenDecimals)} ${tokenSymbol}</div>
            </div>
            <div>
              <div className="text-lm-terminal-lightgray">Lock Status</div>
              <div className={isLocked ? "text-lm-red font-bold" : "text-lm-green font-bold"}>
                {formatUnlockTime(unlockTime)}
              </div>
            </div>
            <div>
              <div className="text-lm-terminal-lightgray">Rewards ({reward0Symbol})</div>
              <div className="text-lm-orange lm-mono font-bold">{fmtEth(pending0)}</div>
            </div>
            <div>
              <div className="text-lm-terminal-lightgray">Rewards ({reward1Symbol})</div>
              <div className="text-lm-orange lm-mono font-bold">{fmtEth(pending1)}</div>
            </div>
          </div>

          {/* Stake amount */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-lm-terminal-lightgray text-xs">Amount to Stake / Unstake</div>
              <div className="flex items-center gap-2">
                {tokenBalance > 0n && (
                  <button
                    type="button"
                    className="text-[10px] text-lm-orange hover:underline"
                    onClick={() => setStakeAmt(formatUnits(tokenBalance, tokenDecimals))}
                  >
                    MAX WALLET ({fmtTokens(tokenBalance, tokenDecimals)})
                  </button>
                )}
                {userStaked > 0n && (
                  <button
                    type="button"
                    className="text-[10px] text-lm-orange hover:underline"
                    onClick={() => setStakeAmt(formatUnits(userStaked, tokenDecimals))}
                  >
                    MAX STAKED ({fmtTokens(userStaked, tokenDecimals)})
                  </button>
                )}
              </div>
            </div>
            <Input value={stakeAmt} onValueChange={setStakeAmt} placeholder="0.0" />
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={stake} loading={busyAction === "stake"} disabled={busy} variant="primary">
              {busyAction === "stake" ? "Staking..." : "Stake"}
            </Button>
            <Button onClick={claim} loading={busyAction === "claim"} disabled={busy || !hasPending}>
              {busyAction === "claim" ? "Claiming..." : "Claim Rewards"}
            </Button>
            <Button onClick={unstake} loading={busyAction === "unstake"} disabled={busy || isLocked}>
              {busyAction === "unstake" ? "Unstaking..." : "Unstake"}
            </Button>
          </div>
        </div>
      )}

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
