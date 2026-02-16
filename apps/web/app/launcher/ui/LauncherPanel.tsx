"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Address, decodeEventLog, formatUnits, parseEther, parseUnits } from "viem";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { useWallet } from "../../wallet/WalletProvider";
import { publicClient, robinhoodTestnet } from "../../providers";
import { config } from "../../lib/config";
import { StonkLaunchAbi, StonkLauncherFactoryAbi } from "../../lib/abis";
import { useIntentListener, IntentAction } from "../../components/IntentTerminal";

function sqrtBigInt(n: bigint): bigint {
  if (n < 0n) throw new Error("sqrt of negative");
  if (n < 2n) return n;
  let x0 = n;
  let x1 = (x0 + 1n) >> 1n;
  while (x1 < x0) { x0 = x1; x1 = (x1 + n / x1) >> 1n; }
  return x0;
}

function clampStr(s: string, maxLen: number): string {
  return (s || "").trim().slice(0, maxLen);
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
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  return raw;
}

function fmtEth(wei: bigint): string {
  const raw = formatUnits(wei, 18);
  const num = Number(raw);
  if (num === 0) return "0";
  if (num >= 1) return num.toFixed(4);
  if (num >= 0.001) return num.toFixed(6);
  return num.toExponential(2);
}

const FEE_OPTIONS = [
  { label: "0.05%", value: "500", hint: "Stablecoins" },
  { label: "0.30%", value: "3000", hint: "Recommended" },
  { label: "1.00%", value: "10000", hint: "Exotic pairs" }
];

export function LauncherPanel() {
  const { address, walletClient, requireCorrectChain, connect } = useWallet();

  /* ── Step 1 state ── */
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [imageURI, setImageURI] = useState("");
  const [totalSupply, setTotalSupply] = useState("1000000");
  const [creatorPct, setCreatorPct] = useState("5");
  const [salePct, setSalePct] = useState("60");
  const [priceEthPerToken, setPriceEthPerToken] = useState("0.000001");

  /* ── Step 2 state ── */
  const [launchAddr, setLaunchAddr] = useState<Address | "">("");
  const [initialPriceEthPerToken, setInitialPriceEthPerToken] = useState("0.000001");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sqrtPriceX96Override, setSqrtPriceX96Override] = useState("");
  const [finalizeEthTopUp, setFinalizeEthTopUp] = useState("");
  const [fee, setFee] = useState("3000");
  const [memeTokenAddr, setMemeTokenAddr] = useState<Address | "">("");
  const [launchEthBalance, setLaunchEthBalance] = useState<bigint>(0n);

  /* ── Shared state ── */
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");
  const [createdLaunch, setCreatedLaunch] = useState<{ launch: Address; token: Address; symbol: string } | null>(null);

  const factoryAddress = config.launcherFactory;
  const totalSupplyWei = useMemo(() => { try { return parseUnits(totalSupply || "0", 18); } catch { return 0n; } }, [totalSupply]);

  /* ── Intent listener — auto-fill from IntentTerminal ── */
  useIntentListener(useCallback((intent: IntentAction) => {
    if (intent.type === "launch_token") {
      if (intent.name) setName(intent.name);
      if (intent.symbol) setSymbol(intent.symbol);
      if (intent.supply) setTotalSupply(intent.supply);
      if (intent.creatorPct) setCreatorPct(intent.creatorPct);
      if (intent.salePct) setSalePct(intent.salePct);
      if (intent.price) setPriceEthPerToken(intent.price);
    } else if (intent.type === "finalize_launch") {
      if (intent.address) setLaunchAddr(intent.address as any);
      if (intent.price) setInitialPriceEthPerToken(intent.price);
      if (intent.fee) setFee(intent.fee);
    }
  }, []));
  const priceWeiPerToken = useMemo(() => { try { return parseEther(priceEthPerToken || "0"); } catch { return 0n; } }, [priceEthPerToken]);

  const creatorBps = useMemo(() => Math.round(Number(creatorPct || "0") * 100), [creatorPct]);
  const saleBps = useMemo(() => Math.round(Number(salePct || "0") * 100), [salePct]);

  /* ── Distribution math ── */
  const distribution = useMemo(() => {
    if (totalSupplyWei <= 0n) return null;
    const cb = BigInt(Math.max(0, Math.min(5000, creatorBps)));
    const sb = BigInt(Math.max(0, Math.min(10000, saleBps)));
    const creatorTokens = (totalSupplyWei * cb) / 10000n;
    const afterCreator = totalSupplyWei - creatorTokens;
    const saleTokens = (afterCreator * sb) / 10000n;
    const lpTokens = afterCreator - saleTokens;
    const creatorPctNum = Number(cb) / 100;
    const salePctOfTotal = totalSupplyWei > 0n ? Number((saleTokens * 10000n) / totalSupplyWei) / 100 : 0;
    const lpPctOfTotal = totalSupplyWei > 0n ? Number((lpTokens * 10000n) / totalSupplyWei) / 100 : 0;
    const totalSaleCostEth = priceWeiPerToken > 0n ? (saleTokens * priceWeiPerToken) / (10n ** 18n) : 0n;
    return { creatorTokens, saleTokens, lpTokens, creatorPctNum, salePctOfTotal, lpPctOfTotal, totalSaleCostEth };
  }, [totalSupplyWei, creatorBps, saleBps, priceWeiPerToken]);

  const computedSqrtPriceX96 = useMemo(() => {
    try {
      const pWei = parseEther(initialPriceEthPerToken || "0");
      if (pWei <= 0n || !config.weth || !memeTokenAddr) return "";
      const meme = memeTokenAddr as string;
      const weth = config.weth as string;
      const token0 = meme.toLowerCase() < weth.toLowerCase() ? meme : weth;
      let pScaled = pWei;
      if (token0.toLowerCase() === weth.toLowerCase()) {
        pScaled = (10n ** 36n) / pWei;
        if (pScaled <= 0n) return "";
      }
      const Q96 = 2n ** 96n;
      const x = (pScaled * (Q96 * Q96)) / 10n ** 18n;
      return sqrtBigInt(x).toString();
    } catch { return ""; }
  }, [initialPriceEthPerToken, memeTokenAddr]);

  const sqrtPriceX96 = useMemo(
    () => (sqrtPriceX96Override.trim() ? sqrtPriceX96Override.trim() : computedSqrtPriceX96),
    [computedSqrtPriceX96, sqrtPriceX96Override]
  );

  async function refreshMemeTokenForLaunch(addr: Address) {
    try {
      const token = (await publicClient.readContract({ address: addr, abi: StonkLaunchAbi, functionName: "memeToken" })) as Address;
      setMemeTokenAddr(token);
    } catch { setMemeTokenAddr(""); }
  }

  async function createLaunch() {
    if (!address) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!walletClient) { setStatus("No wallet client."); setStatusType("error"); return; }
    if (!factoryAddress) { setStatus("Missing factory address in config."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    setCreatedLaunch(null);
    try {
      const sym = clampStr(symbol, 11);
      if (!sym) throw new Error("Symbol is required.");
      if (!name.trim()) throw new Error("Name is required.");
      const cb = BigInt(creatorBps);
      const sb = BigInt(saleBps);
      if (cb > 5000n) throw new Error("Creator allocation cannot exceed 50%.");
      if (sb > 10000n) throw new Error("Sale portion cannot exceed 100%.");
      if (cb + sb > 10000n) throw new Error("Creator + sale allocation cannot exceed 100%.");
      if (priceWeiPerToken <= 0n) throw new Error("Sale price must be greater than 0.");
      if (totalSupplyWei <= 0n) throw new Error("Total supply must be greater than 0.");

      setStatus(`Launching ${sym} (${totalSupply} supply)...`);
      setStatusType("info");
      await requireCorrectChain();

      setStatus("Awaiting wallet signature...");
      const txHash = await walletClient.writeContract({
        address: factoryAddress,
        abi: StonkLauncherFactoryAbi,
        functionName: "createLaunch",
        args: [{
          name: name.trim(), symbol: sym, metadataURI: metadataURI.trim(), imageURI: imageURI.trim(),
          totalSupplyWei, creatorAllocationBps: cb, saleBpsOfRemaining: sb, priceWeiPerToken
        }],
        chain: robinhoodTestnet,
        account: address
      });
      setLastTxHash(txHash);
      setStatus("Confirming on-chain...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: StonkLauncherFactoryAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "LaunchCreated") {
            const args = decoded.args as any;
            const la = args.launch as Address;
            setLaunchAddr(la);
            setMemeTokenAddr(args.token as Address);
            setInitialPriceEthPerToken(priceEthPerToken);
            setCreatedLaunch({ launch: la, token: args.token as Address, symbol: String(args.symbol) });
            refreshMemeTokenForLaunch(la).catch(() => {});
            setStatus(`${String(args.symbol)} launched! Token: ${short(args.token)}. Proceed to Step 2 (Finalize) to seed DEX liquidity.`);
            setStatusType("success");
            return;
          }
        } catch { /* ignore non-matching */ }
      }
      setStatus("Transaction confirmed but no LaunchCreated event found.");
      setStatusType("info");
    } catch (e: any) {
      const msg = String(e?.shortMessage || e?.message || e);
      if (msg.includes("user rejected") || msg.includes("User denied")) {
        setStatus("Transaction cancelled by user.");
      } else {
        setStatus(`Launch failed: ${msg}`);
      }
      setStatusType("error");
    } finally { setBusy(false); }
  }

  async function finalize() {
    if (!address) { setStatus("Connect wallet."); setStatusType("error"); return; }
    if (!walletClient) { setStatus("No wallet client."); setStatusType("error"); return; }
    if (!factoryAddress) { setStatus("Missing factory address."); setStatusType("error"); return; }
    if (!launchAddr) { setStatus("Enter or create a launch first."); setStatusType("error"); return; }
    setBusy(true);
    setLastTxHash("");
    try {
      setStatus("Preparing finalization..."); setStatusType("info");
      await requireCorrectChain();
      const sp = BigInt(sqrtPriceX96 || "0");
      const feeNum = Number(fee || "0");
      if (!sp) throw new Error("Set initial price to compute pool price");
      let topUp = 0n;
      try {
        topUp = parseEther((finalizeEthTopUp || "0").trim() || "0");
      } catch {
        throw new Error("Extra ETH for liquidity is invalid. Enter a valid number (or 0).");
      }
      // If the launch has not raised any ETH yet, finalization needs some ETH to seed the pool.
      if (launchEthBalance === 0n && topUp === 0n) {
        throw new Error("This launch has 0 ETH raised so far. Add a small ETH top-up (or run a sale first) to seed liquidity.");
      }

      setStatus("Awaiting wallet signature...");
      const txHash = await walletClient.writeContract({
        address: factoryAddress,
        abi: StonkLauncherFactoryAbi,
        functionName: "finalizeLaunch",
        args: [launchAddr, sp, feeNum],
        value: topUp,
        chain: robinhoodTestnet,
        account: address
      });
      setLastTxHash(txHash);
      setStatus("Confirming finalization...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status === "success") {
        setStatus("Launch finalized! Pool created, LP minted, staking vault live.");
        setStatusType("success");
      } else {
        setStatus("Finalize transaction reverted.");
        setStatusType("error");
      }
    } catch (e: any) {
      setStatus(String(e?.shortMessage || e?.message || e));
      setStatusType("error");
    } finally { setBusy(false); }
  }

  // Track ETH available to seed liquidity (sale proceeds sit on the launch contract).
  useEffect(() => {
    let cancelled = false;
    async function refreshLaunchEth() {
      if (!launchAddr || !/^0x[0-9a-fA-F]{40}$/.test(String(launchAddr))) {
        setLaunchEthBalance(0n);
        return;
      }
      try {
        const b = await publicClient.getBalance({ address: launchAddr as Address });
        if (!cancelled) setLaunchEthBalance(b);
      } catch {
        if (!cancelled) setLaunchEthBalance(0n);
      }
    }
    refreshLaunchEth().catch(() => {});
    return () => { cancelled = true; };
  }, [launchAddr]);

  const statusColor = statusType === "success" ? "text-lm-green" : statusType === "error" ? "text-lm-red" : "text-lm-gray";

  return (
    <div className="space-y-4">
      {/* ── Step 1: Create Launch ── */}
      <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center bg-lm-orange text-black font-bold text-xs rounded-full">1</span>
          <span className="text-white font-bold text-sm lm-upper">Create Your Token</span>
        </div>
        <div className="text-lm-terminal-lightgray text-xs">
          Define your meme coin&apos;s name, supply, and tokenomics. Tokens are created instantly on-chain.
        </div>

        {/* Name & Symbol */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Token Name</div>
            <Input value={name} onValueChange={setName} numeric={false} placeholder="e.g. Stonk Coin" />
          </div>
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Ticker Symbol</div>
            <Input value={symbol} onValueChange={setSymbol} numeric={false} placeholder="e.g. STONK" />
            <div className="text-lm-terminal-lightgray text-[10px]">Max 11 characters</div>
          </div>
        </div>

        {/* Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Description / Metadata URI <span className="text-lm-gray">(optional)</span></div>
            <Input value={metadataURI} onValueChange={setMetadataURI} numeric={false} placeholder="ipfs://..." />
          </div>
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Token Image URL <span className="text-lm-gray">(optional)</span></div>
            <Input value={imageURI} onValueChange={setImageURI} numeric={false} placeholder="https://... or ipfs://..." />
          </div>
        </div>

        {/* Supply & Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Total Supply</div>
            <Input value={totalSupply} onValueChange={setTotalSupply} placeholder="1000000" />
            <div className="text-lm-terminal-lightgray text-[10px]">How many tokens to create (e.g. 1,000,000)</div>
          </div>
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Sale Price per Token (in ETH)</div>
            <Input value={priceEthPerToken} onValueChange={setPriceEthPerToken} placeholder="0.000001" />
            <div className="text-lm-terminal-lightgray text-[10px]">How much ETH buyers pay per token</div>
          </div>
        </div>

        {/* Tokenomics — percentage sliders */}
        <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-3">
          <div className="text-white font-bold text-xs lm-upper">Tokenomics</div>

          {/* Creator % */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-lm-terminal-lightgray text-xs">Your Share (creator allocation)</div>
              <div className="text-lm-orange font-bold text-sm lm-mono">{creatorPct || "0"}%</div>
            </div>
            <input
              type="range"
              min={0} max={50} step={1}
              value={Number(creatorPct) || 0}
              onChange={(e) => setCreatorPct(String(e.target.value))}
              className="w-full h-1.5 bg-lm-terminal-gray rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-lm-orange [&::-webkit-slider-thumb]:rounded-none"
            />
            <div className="text-lm-terminal-lightgray text-[10px]">Tokens sent to your wallet on creation. Max 50%.</div>
          </div>

          {/* Sale % */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-lm-terminal-lightgray text-xs">Public Sale</div>
              <div className="text-lm-green font-bold text-sm lm-mono">{salePct || "0"}%</div>
            </div>
            <input
              type="range"
              min={0} max={100} step={1}
              value={Number(salePct) || 0}
              onChange={(e) => setSalePct(String(e.target.value))}
              className="w-full h-1.5 bg-lm-terminal-gray rounded-none appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-lm-green [&::-webkit-slider-thumb]:rounded-none"
            />
            <div className="text-lm-terminal-lightgray text-[10px]">
              Percentage of remaining tokens (after creator share) offered for public sale. The rest goes to DEX liquidity.
            </div>
          </div>
        </div>

        {/* Token Distribution Preview */}
        {distribution && (
          <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 space-y-2">
            <div className="text-white font-bold text-xs lm-upper">Distribution Preview</div>

            {/* Visual bar */}
            <div className="flex gap-0.5 h-3 rounded-sm overflow-hidden">
              {distribution.creatorPctNum > 0 && (
                <div className="bg-lm-orange transition-all" style={{ width: `${distribution.creatorPctNum}%` }} />
              )}
              {distribution.salePctOfTotal > 0 && (
                <div className="bg-lm-green transition-all" style={{ width: `${distribution.salePctOfTotal}%` }} />
              )}
              {distribution.lpPctOfTotal > 0 && (
                <div className="bg-white/20 transition-all" style={{ width: `${distribution.lpPctOfTotal}%` }} />
              )}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-lm-orange flex-shrink-0" />
                  <span className="text-lm-terminal-lightgray">You (creator)</span>
                </div>
                <div className="text-white font-bold lm-mono ml-4">{fmtTokens(distribution.creatorTokens)}</div>
                <div className="text-lm-terminal-lightgray text-[10px] ml-4">{distribution.creatorPctNum}%</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-lm-green flex-shrink-0" />
                  <span className="text-lm-terminal-lightgray">Public Sale</span>
                </div>
                <div className="text-white font-bold lm-mono ml-4">{fmtTokens(distribution.saleTokens)}</div>
                <div className="text-lm-terminal-lightgray text-[10px] ml-4">{distribution.salePctOfTotal.toFixed(1)}%</div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-white/20 flex-shrink-0" />
                  <span className="text-lm-terminal-lightgray">DEX Liquidity</span>
                </div>
                <div className="text-white font-bold lm-mono ml-4">{fmtTokens(distribution.lpTokens)}</div>
                <div className="text-lm-terminal-lightgray text-[10px] ml-4">{distribution.lpPctOfTotal.toFixed(1)}%</div>
              </div>
            </div>

            {distribution.totalSaleCostEth > 0n && (
              <div className="text-xs text-lm-terminal-lightgray pt-1 border-t border-lm-terminal-gray">
                If every token sells: <span className="text-white font-bold lm-mono">{fmtEth(distribution.totalSaleCostEth)} ETH</span> raised
              </div>
            )}
          </div>
        )}

        <Button onClick={address ? createLaunch : connect} loading={busy} disabled={busy || (!!address && (!name.trim() || !symbol.trim()))} variant="primary" size="lg" className="w-full">
          {busy ? "Creating Token..." : !address ? "Connect Wallet" : `Launch $${symbol.toUpperCase() || "TOKEN"}`}
        </Button>

        {/* Created launch result */}
        {createdLaunch && (
          <div className="bg-lm-terminal-darkgray border border-lm-green p-3 space-y-1.5">
            <div className="text-lm-green font-bold text-xs lm-upper">Token Created Successfully</div>
            <div className="text-xs text-lm-gray">
              <span className="text-white font-bold">${createdLaunch.symbol}</span> is live. Now finalize below to create the DEX pool.
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-lm-terminal-lightgray">Token</div>
                <a href={explorerAddr(createdLaunch.token)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                  {short(createdLaunch.token)}
                </a>
              </div>
              <div>
                <div className="text-lm-terminal-lightgray">Launch Contract</div>
                <a href={explorerAddr(createdLaunch.launch)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                  {short(createdLaunch.launch)}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Step 2: Finalize Launch ── */}
      <div className="bg-lm-black border border-lm-terminal-gray p-3 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center bg-lm-orange text-black font-bold text-xs rounded-full">2</span>
          <span className="text-white font-bold text-sm lm-upper">Go Live on DEX</span>
        </div>
        <div className="text-lm-terminal-lightgray text-xs">
          Creates a Uniswap V3 trading pool, adds initial liquidity, and sets up fee splitting + staking rewards.
          {createdLaunch && <span className="text-lm-green"> Auto-filled from your newly created token above.</span>}
        </div>

        {/* Launch Address */}
        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-xs">Launch Contract Address</div>
          <Input
            value={launchAddr}
            numeric={false}
            placeholder="0x... (auto-filled after creation)"
            onValueChange={(v) => {
              const next = v as Address;
              setLaunchAddr(next);
              if (/^0x[0-9a-fA-F]{40}$/.test(String(next))) {
                refreshMemeTokenForLaunch(next).catch(() => {});
              } else { setMemeTokenAddr(""); }
            }}
          />
        </div>

        {memeTokenAddr && (
          <div className="flex items-center gap-2 text-xs bg-lm-terminal-darkgray border border-lm-green/20 p-2">
            <span className="lm-dot lm-dot-green lm-dot-pulse" />
            <span className="text-lm-green font-bold">Token detected</span>
            <a href={explorerAddr(memeTokenAddr)} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
              {short(memeTokenAddr)} →
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Pool Price */}
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Starting Price (ETH per token)</div>
            <Input value={initialPriceEthPerToken} onValueChange={setInitialPriceEthPerToken} placeholder="0.000001" />
            <div className="text-lm-terminal-lightgray text-[10px]">Should match the sale price you set above</div>
          </div>
          {/* Fee Tier */}
          <div className="space-y-1">
            <div className="text-lm-terminal-lightgray text-xs">Trading Fee Tier</div>
            <div className="flex gap-1">
              {FEE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFee(o.value)}
                  className={`flex-1 text-center py-1.5 border transition-colors ${
                    fee === o.value
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
        </div>

        {/* Extra ETH for LP */}
        <div className="space-y-1">
          <div className="text-lm-terminal-lightgray text-xs">
            Extra ETH for Liquidity <span className="text-lm-gray">(optional)</span>
          </div>
          <Input value={finalizeEthTopUp} onValueChange={setFinalizeEthTopUp} placeholder="0.0" />
          <div className="text-lm-terminal-lightgray text-[10px]">
            ETH raised from sales is automatically added to the pool. Add more here to deepen liquidity.
            {launchAddr ? (
              <span className="block mt-1">
                ETH currently in launch contract: <span className="text-white lm-mono font-bold">{fmtEth(launchEthBalance)} ETH</span>
              </span>
            ) : null}
            {launchAddr && launchEthBalance === 0n ? (
              <span className="block mt-1 text-lm-orange">
                If this is 0, you must top up some ETH (or sell tokens first) or finalization will revert.
              </span>
            ) : null}
          </div>
        </div>

        {/* Advanced section */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-lm-terminal-lightgray text-[10px] hover:text-lm-orange transition-colors"
        >
          {showAdvanced ? "▾ Hide developer settings" : "▸ Developer settings"}
        </button>
        {showAdvanced && (
          <div className="space-y-1.5 text-[10px]">
            <div className="text-lm-terminal-lightgray">
              sqrtPriceX96 (auto-computed: <span className="text-lm-gray lm-mono">{computedSqrtPriceX96 || "—"}</span>)
            </div>
            <Input
              value={sqrtPriceX96Override}
              onValueChange={setSqrtPriceX96Override}
              placeholder="Leave blank for automatic computation"
              numeric={false}
              className="text-left text-xs"
            />
          </div>
        )}

        <Button onClick={address ? finalize : connect} loading={busy} disabled={busy || (!!address && (!launchAddr || !sqrtPriceX96))} variant="primary" size="lg" className="w-full">
          {busy ? "Finalizing..." : !address ? "Connect Wallet" : "Finalize & Create Trading Pool"}
        </Button>
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
