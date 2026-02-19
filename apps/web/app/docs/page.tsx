"use client";

import React, { useState } from "react";
import Link from "next/link";
import { TerminalShell } from "../components/Terminal";
import { cn } from "../components/cn";

/* ═══════════════════════════════════════════
   COPY BUTTON
   ═══════════════════════════════════════════ */
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={cn(
        "absolute top-2 right-2 text-[10px] lm-upper tracking-wider px-2 py-0.5 border transition-all",
        copied
          ? "border-lm-green/50 text-lm-green bg-lm-green/10"
          : "border-lm-terminal-gray text-lm-terminal-lightgray hover:text-lm-orange hover:border-lm-orange/40"
      )}
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/* ═══════════════════════════════════════════
   CODE BLOCK
   ═══════════════════════════════════════════ */
function Code({ children, lang }: { children: string; lang?: string }) {
  return (
    <div className="relative group my-3">
      <CopyBtn text={children.trim()} />
      {lang && (
        <div className="absolute top-2 left-3 text-[9px] text-lm-terminal-gray lm-upper tracking-widest">
          {lang}
        </div>
      )}
      <pre className="bg-lm-black border border-lm-terminal-gray p-4 pt-8 overflow-x-auto text-xs leading-relaxed">
        <code className="text-lm-terminal-lightgray lm-mono">{children.trim()}</code>
      </pre>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION HEADING
   ═══════════════════════════════════════════ */
function SectionH({ id, label, title }: { id: string; label: string; title: string }) {
  return (
    <div id={id} className="scroll-mt-20 pt-10 pb-4 first:pt-0">
      <div className="flex items-center gap-3 mb-1">
        <div className="h-px w-6 bg-lm-orange/40" />
        <div className="text-lm-orange text-[10px] font-bold lm-upper tracking-[0.2em]">{label}</div>
      </div>
      <h2 className="text-white font-bold text-xl md:text-2xl lm-upper">{title}</h2>
    </div>
  );
}

function SubH({ children }: { children: React.ReactNode }) {
  return <h3 className="text-white font-bold text-sm lm-upper mt-6 mb-2">{children}</h3>;
}

/* ═══════════════════════════════════════════
   ADDRESS TABLE
   ═══════════════════════════════════════════ */
function AddressRow({ name, addr, explorer }: { name: string; addr: string; explorer?: string }) {
  const href = explorer || `https://explorer.testnet.chain.robinhood.com/address/${addr}`;
  return (
    <tr className="border-b border-lm-terminal-gray/30 hover:bg-lm-terminal-darkgray/60 transition-colors">
      <td className="py-2.5 pr-4 text-xs text-lm-terminal-lightgray font-semibold lm-upper whitespace-nowrap">{name}</td>
      <td className="py-2.5 text-xs">
        <a href={href} target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono break-all">
          {addr}
        </a>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════
   INLINE TABLE OF CONTENTS
   ═══════════════════════════════════════════ */
const TOC = [
  { id: "apeclaw", label: "ApeClaw Skill & Agent Access" },
  { id: "cli", label: "CLI Installation & Usage" },
  { id: "tracking", label: "Agent Activity Tracking" },
  { id: "network", label: "Network Details" },
  { id: "contracts", label: "Contract Addresses" },
  { id: "faucet", label: "Faucet" },
  { id: "nft", label: "NFT Collection" },
  { id: "marketplace", label: "Marketplace" },
  { id: "launcher", label: "Token Launcher" },
  { id: "exchange", label: "Exchange & Swaps" },
  { id: "pools", label: "Pools & Liquidity" },
  { id: "options", label: "Covered Call Options" },
  { id: "registry", label: "Token Registry" },
  { id: "agent-flow", label: "Suggested Agent Flow" },
  { id: "abi", label: "ABI Quick Reference" },
];

/* ═══════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════ */
export default function DocsPage() {
  return (
    <TerminalShell
      title="Documentation"
      subtitle="Complete reference for the StonkBrokers DeFi suite and ApeClaw agent integration."
    >
      <div className="space-y-0">

        {/* ── Table of Contents ── */}
        <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-5 md:p-6 mb-6">
          <div className="text-lm-orange text-[10px] font-bold lm-upper tracking-[0.2em] mb-3">Table of Contents</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {TOC.map((t, i) => (
              <a key={t.id} href={`#${t.id}`} className="text-xs text-lm-terminal-lightgray hover:text-lm-orange transition-colors flex items-center gap-2 py-0.5">
                <span className="text-lm-terminal-gray lm-mono text-[10px] w-4 text-right">{(i + 1).toString().padStart(2, "0")}</span>
                {t.label}
              </a>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: APECLAW SKILL & AGENT ACCESS
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel">
          <SectionH id="apeclaw" label="Agent Integration" title="ApeClaw SkillCard — ClawdBot Access" />

          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              StonkBrokers is available as an <a href="https://apeclaw.ai/skills#install=stonkbrokers-launcher" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline font-bold">ApeClaw SkillCard</a> — a structured, machine-readable instruction set that lets any ACP-compatible agent (ClawdBot, autonomous pod, custom solver) interact with the full StonkBrokers protocol via CLI or programmatic calls.
            </p>

            <div className="bg-lm-black border border-lm-orange/30 p-4 md:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-lm-terminal-gray lm-upper tracking-wider text-[10px] mb-1">Skill Name</div>
                  <div className="text-white font-bold">StonkBrokers — Full DeFi Suite (Robinhood Chain)</div>
                </div>
                <div>
                  <div className="text-lm-terminal-gray lm-upper tracking-wider text-[10px] mb-1">Slug</div>
                  <div className="text-white lm-mono">stonkbrokers-launcher</div>
                </div>
                <div>
                  <div className="text-lm-terminal-gray lm-upper tracking-wider text-[10px] mb-1">Version</div>
                  <div className="text-white lm-mono">1.0.0</div>
                </div>
                <div>
                  <div className="text-lm-terminal-gray lm-upper tracking-wider text-[10px] mb-1">Risk Tier</div>
                  <div className="flex items-center gap-2">
                    <span className="lm-badge lm-badge-filled-orange text-[9px]">Medium</span>
                    <span className="text-lm-terminal-lightgray">Writes / Automation with safety gates</span>
                  </div>
                </div>
                <div>
                  <div className="text-lm-terminal-gray lm-upper tracking-wider text-[10px] mb-1">SkillNFT ID</div>
                  <div className="text-white lm-mono">
                    #10890{" "}
                    <a href="https://apescan.io/token/0x.../10890" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline text-[10px]">
                      View on ApeScan
                    </a>
                  </div>
                </div>
                <div>
                  <div className="text-lm-terminal-gray lm-upper tracking-wider text-[10px] mb-1">Source</div>
                  <div>
                    <a href="https://github.com/Clutch-L4bs/stonkbrokers" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                      Clutch-L4bs/stonkbrokers
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-lm-black border border-lm-terminal-gray p-4 md:p-5">
              <div className="text-[10px] text-lm-terminal-gray lm-upper tracking-widest mb-2">Onchain Identity</div>
              <div className="space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-lm-terminal-lightgray font-semibold w-24 shrink-0">Network:</span>
                  <span className="text-white">ApeChain (Chain ID 33139)</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-lm-terminal-lightgray font-semibold w-24 shrink-0">Mint TX:</span>
                  <a href="https://apescan.io/tx/0xac9742fa7382df19daea6d9bea2f4f950fb0546226d8502cf069ab02fbd0bc3f" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono break-all">
                    0xac9742fa...fbd0bc3f
                  </a>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="text-lm-terminal-lightgray font-semibold w-24 shrink-0">Publish TX:</span>
                  <a href="https://apescan.io/tx/0xfb5e432dc501665716d82293a265a1561cbd901ea2246633d67b4eb85f41166f" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono break-all">
                    0xfb5e432d...f41166f
                  </a>
                </div>
              </div>
            </div>

            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The SkillCard is hashed, published onchain, and referenced immutably on ApeChain. This means the skill definition can never be altered retroactively — agents and auditors can verify the exact instructions their bot executed against the onchain content hash.
            </p>

            <SubH>What Can an Agent Do?</SubH>
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              With this skill installed, an ACP-compatible agent (ClawdBot) has full access to every StonkBrokers module:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {[
                { action: "faucet_claim", desc: "Claim testnet ETH from the StonkEthFaucet" },
                { action: "launch_create", desc: "Deploy a new ERC-20 token + sale contract" },
                { action: "launch_buy", desc: "Buy tokens from an active fixed-price sale" },
                { action: "launch_finalize", desc: "Finalize a launch → create Uniswap V3 pool + LP" },
                { action: "swap", desc: "Swap any token pair through Uniswap V3" },
                { action: "wrap_eth", desc: "Wrap native ETH to WETH" },
                { action: "unwrap_weth", desc: "Unwrap WETH back to native ETH" },
                { action: "pool_create", desc: "Create and initialize a Uniswap V3 pool" },
                { action: "pool_mint_lp", desc: "Mint a concentrated or full-range LP position" },
                { action: "option_write", desc: "Write a covered call option (escrow collateral)" },
                { action: "option_buy", desc: "Buy an option, receive an ERC-721 option NFT" },
                { action: "option_exercise", desc: "Exercise an ITM option before expiry" },
                { action: "option_reclaim", desc: "Reclaim collateral from an expired, unexercised option" },
              ].map((a) => (
                <div key={a.action} className="bg-lm-black border border-lm-terminal-gray/40 px-3 py-2 flex items-start gap-2.5">
                  <code className="text-lm-orange text-[11px] lm-mono shrink-0 mt-0.5">{a.action}</code>
                  <span className="text-lm-terminal-lightgray text-[11px] leading-snug">{a.desc}</span>
                </div>
              ))}
            </div>

            <SubH>Required Permissions</SubH>
            <div className="flex flex-wrap gap-2">
              {["onchain_execute", "onchain_read", "market_data"].map((p) => (
                <span key={p} className="lm-badge text-[10px] border border-lm-terminal-gray text-lm-terminal-lightgray px-2 py-0.5 lm-mono">{p}</span>
              ))}
            </div>
            <p className="text-xs text-lm-terminal-gray mt-1">
              Agents must have these permissions enabled in their ACP runtime to execute StonkBrokers actions.
            </p>

            <SubH>Safety Constraints</SubH>
            <ul className="space-y-1.5 text-xs text-lm-terminal-lightgray list-none">
              {[
                "Never log or persist private keys.",
                "All transactions are on Robinhood Chain TESTNET only — tokens have no real value.",
                "Verify contract addresses before sending transactions.",
                "Use slippage protection on all swaps.",
                "Check faucet cooldown before calling claim().",
                "Ensure token approvals before interacting with vault or position manager.",
                "High-risk skills are strict opt-in. Pod default is dry-run with a kill switch, runtime cap, and auditable logs.",
              ].map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-lm-orange mt-0.5">&#x25B8;</span>
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: CLI INSTALLATION
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="cli" label="Setup" title="CLI Installation & Usage" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              Install the StonkBrokers skill into any ACP-compatible agent with a single command. The skill JSON contains all contract addresses, ABIs, input schemas, and execution bindings needed for autonomous operation.
            </p>

            <SubH>1. Install the SkillCard</SubH>
            <Code lang="bash">{`curl -fsSL "https://apeclaw.ai/api/skills/stonkbrokers-launcher" | jq .card > ./skills/stonkbrokers-launcher.json`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              This downloads the vetted SkillCard JSON from the ApeClaw API and saves it to your agent&apos;s skill directory. Works with any ACP-compatible agent runtime.
            </p>

            <SubH>2. Or Fetch Directly from GitHub</SubH>
            <Code lang="bash">{`curl -fsSL "https://raw.githubusercontent.com/simplefarmer69/ape-claw/main/skillcards/seed/stonkbrokers-launcher.v1.json" \\
  | jq .card > ./skills/stonkbrokers-launcher.json`}</Code>

            <SubH>3. View the Skill on ApeClaw</SubH>
            <p className="text-xs text-lm-terminal-lightgray">
              Browse the full skill definition, risk tier, and onchain identity at:
            </p>
            <Code lang="text">{`https://apeclaw.ai/skills#install=stonkbrokers-launcher`}</Code>

            <SubH>4. Verify Onchain (Optional)</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              The skill is minted as <strong className="text-white">SkillNFT #10890</strong> on ApeChain. The publish transaction anchors an immutable version with a <code className="text-lm-orange">contentHash</code> and <code className="text-lm-orange">uri</code>. You can verify the skill your agent is running matches the onchain version:
            </p>
            <Code lang="bash">{`# Verify the skill matches the onchain published version
ape-claw v2 skill verify --skillId 10890 --file ./skills/stonkbrokers-launcher.json --json`}</Code>

            <SubH>5. Configure Your Agent</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              Your agent needs a funded wallet on Robinhood Chain Testnet. Set the private key as an environment variable (never hardcode it):
            </p>
            <Code lang="bash">{`export ROBINHOOD_TESTNET_PRIVATE_KEY="0x..."
export ROBINHOOD_TESTNET_RPC="https://rpc.testnet.chain.robinhood.com"`}</Code>
            <p className="text-xs text-lm-terminal-gray">
              Get testnet ETH from the <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline">official Robinhood Faucet</a> (0.05 ETH per request, once per 24h).
            </p>

            <SubH>6. Example: Launch a Token via CLI</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              Once installed, your agent can execute any supported action. Here is a full lifecycle example:
            </p>
            <Code lang="json">{`{
  "action": "launch_create",
  "rpcUrl": "https://rpc.testnet.chain.robinhood.com",
  "privateKey": "$ROBINHOOD_TESTNET_PRIVATE_KEY",
  "launch": {
    "name": "Agent Meme Coin",
    "symbol": "AGENTM",
    "totalSupplyWei": "1000000000000000000000000",
    "creatorAllocationBps": 1000,
    "saleBpsOfRemaining": 5000,
    "priceWeiPerToken": "10000000000000"
  }
}`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Expected output includes <code className="text-lm-orange">tokenAddress</code>, <code className="text-lm-orange">launchAddress</code>, and <code className="text-lm-orange">txHash</code>.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: AGENT ACTIVITY TRACKING
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="tracking" label="Monitoring" title="Agent Activity Tracking" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              Every action your ClawdBot executes on-chain is fully transparent. Track agent-created tokens, trades, and LP positions using the Robinhood Chain block explorer or the StonkBrokers UI directly.
            </p>

            <SubH>Tracking Token Launches</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              All tokens launched via the <code className="text-lm-orange">StonkLauncherFactory</code> emit a <code className="text-lm-orange">LaunchCreated</code> event. The StonkBrokers UI automatically indexes every launch from the factory start block and displays them in the{" "}
              <Link href="/launcher" className="text-lm-orange hover:underline font-bold">Launcher</Link> tab — including those created by agents.
            </p>
            <Code lang="solidity">{`event LaunchCreated(
    address indexed creator,
    address token,
    address launch,
    string name,
    string symbol,
    string metadataURI,
    string imageURI
);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Filter by <code className="text-lm-orange">creator</code> address to see all tokens launched by a specific agent wallet.
            </p>

            <SubH>Tracking Swaps & Trades</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              Uniswap V3 pool swaps emit standard <code className="text-lm-orange">Swap</code> events. Query the pool contract directly or use the block explorer to see every trade:
            </p>
            <Code lang="text">{`https://explorer.testnet.chain.robinhood.com/address/<POOL_ADDRESS>#events`}</Code>

            <SubH>Tracking LP Positions</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              LP positions are ERC-721 NFTs minted by the NonfungiblePositionManager. Query <code className="text-lm-orange">balanceOf(agentAddress)</code> and <code className="text-lm-orange">tokenOfOwnerByIndex</code> to enumerate an agent&apos;s positions, or view them in the <Link href="/exchange" className="text-lm-orange hover:underline font-bold">Exchange → Pools</Link> tab.
            </p>

            <SubH>Tracking Options Activity</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              The <code className="text-lm-orange">CoveredCallVault</code> emits events for every offer created, option bought, exercised, or reclaimed. Option NFTs are ERC-721 tokens — query the vault or check the{" "}
              <Link href="/options" className="text-lm-orange hover:underline font-bold">Options</Link> tab to see all active and historical options.
            </p>

            <SubH>Onchain Receipts (ApeClaw)</SubH>
            <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
              For full audit trails, ApeClaw supports onchain receipts via the <code className="text-lm-orange">ReceiptRegistry</code>. Agents can anchor immutable records of every action:
            </p>
            <Code lang="bash">{`ape-claw v2 receipt record \\
  --traceId "token_launch_abc123" \\
  --subject "agent:my-clawdbot" \\
  --payload '{"kind":"launch.create","token":"0x...","chain":"robinhood-testnet"}' \\
  --json`}</Code>
            <p className="text-xs text-lm-terminal-gray">
              Receipts are append-only — once recorded, they cannot be modified or deleted. The <code className="text-lm-orange">traceIdHash</code> + <code className="text-lm-orange">contentHash</code> pair is the onchain truth.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: NETWORK DETAILS
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="network" label="Network" title="Robinhood Chain Testnet" />
          <div className="px-1 pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {[
                { k: "Chain ID", v: "46630" },
                { k: "Currency", v: "ETH" },
                { k: "RPC", v: "https://rpc.testnet.chain.robinhood.com", link: true },
                { k: "Explorer", v: "https://explorer.testnet.chain.robinhood.com", link: true },
                { k: "Faucet", v: "https://faucet.testnet.chain.robinhood.com", link: true },
                { k: "Type", v: "L2 Testnet" },
              ].map((r) => (
                <div key={r.k} className="bg-lm-black border border-lm-terminal-gray/40 px-4 py-3">
                  <div className="text-[10px] text-lm-terminal-gray lm-upper tracking-widest mb-1">{r.k}</div>
                  {r.link ? (
                    <a href={r.v} target="_blank" rel="noreferrer" className="text-lm-orange text-xs lm-mono hover:underline break-all">{r.v}</a>
                  ) : (
                    <div className="text-white text-xs lm-mono font-bold">{r.v}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: CONTRACT ADDRESSES
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="contracts" label="Reference" title="Contract Addresses" />
          <div className="px-1 pb-6">
            <SubH>Core Infrastructure</SubH>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  <AddressRow name="WETH9" addr="0x37E402B8081eFcE1D82A09a066512278006e4691" />
                  <AddressRow name="Uniswap V3 Factory" addr="0xFECCB63CD759d768538458Ea56F47eA8004323c1" />
                  <AddressRow name="SwapRouter" addr="0x1b32F47434a7EF83E97d0675C823E547F9266725" />
                  <AddressRow name="QuoterV2" addr="0x126f1c1F29A0f49c5D33e0139a5Da1FE25590dB1" />
                  <AddressRow name="PositionManager" addr="0xBc82a9aA33ff24FCd56D36a0fB0a2105B193A327" />
                </tbody>
              </table>
            </div>

            <SubH>Stonk Contracts</SubH>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  <AddressRow name="Token Registry" addr="0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b" />
                  <AddressRow name="Launcher Factory" addr="0x631f9371Fd6B2C85F8f61d19A90547eE67Fa61A2" />
                  <AddressRow name="Covered Call Vault" addr="0x055d84908672b9be53275963862614aEA9CDB98B" />
                </tbody>
              </table>
            </div>

            <SubH>NFT + Marketplace</SubH>
            <div className="overflow-x-auto">
              <table className="w-full">
                <tbody>
                  <AddressRow name="Original NFT (444)" addr="0x2Bb22c9E3394272351FEffEDbEa079Be4FB10a8d" />
                  <AddressRow name="Expanded NFT" addr="0x5fDAeBE166490c69B4C34F99E049b4e16c9EF80a" />
                  <AddressRow name="Marketplace" addr="0x5a091dB1c58686f4625c14eD204BE85d83BD4aA6" />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: FAUCET
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="faucet" label="Module" title="Faucet — Claim Testnet ETH" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The <code className="text-lm-orange">StonkEthFaucet</code> contract dispenses testnet ETH with a 24-hour cooldown per address. This is the simplest way to get gas for testing.
            </p>

            <SubH>Steps</SubH>
            <ol className="space-y-2 text-xs text-lm-terminal-lightgray list-none">
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">1.</span>
                Check eligibility: call <code className="text-lm-orange">canClaim(address)</code> — returns <code className="text-white">true</code> if cooldown has elapsed.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">2.</span>
                Claim: call <code className="text-lm-orange">claim()</code> — sends <code className="text-white">claimAmountWei</code> ETH to <code className="text-white">msg.sender</code>.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">3.</span>
                Check next eligible time: <code className="text-lm-orange">nextClaimTime(address)</code> returns the UNIX timestamp.
              </li>
            </ol>

            <SubH>ABI</SubH>
            <Code lang="solidity">{`function canClaim(address user) external view returns (bool);
function nextClaimTime(address user) external view returns (uint256);
function claim() external; // cooldown-gated, sends claimAmountWei to caller`}</Code>

            <SubH>Alternative: Robinhood Official Faucet</SubH>
            <p className="text-xs text-lm-terminal-lightgray">
              Visit <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline font-bold">faucet.testnet.chain.robinhood.com</a> — 0.05 ETH per request (requires 0.005 mainnet ETH) or 0.025 ETH otherwise. Once per 24 hours. You can also bridge Sepolia ETH.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: NFT COLLECTION
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="nft" label="Module" title="NFT Collection — Stonk Brokers" />
          <div className="px-1 pb-6 space-y-4">
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="lm-badge lm-badge-filled-green text-[9px]">FULLY MINTED</span>
              <span className="lm-badge text-[9px] border border-lm-terminal-gray text-lm-terminal-lightgray">ERC-721</span>
              <span className="lm-badge text-[9px] border border-lm-terminal-gray text-lm-terminal-lightgray">ERC-6551</span>
            </div>
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The Stonk Brokers NFT collection features <strong className="text-white">4,444 unique pixel art stock brokers</strong>, each with a distinct personality, wardrobe, and backstory. Every NFT comes with an <strong className="text-white">ERC-6551 Token-Bound Account</strong> — a smart contract wallet owned by the NFT itself, funded with stock tokens at mint time.
            </p>
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              This strategy was implemented to create an initial community and user base: by minting an NFT, users automatically receive tokens they can trade, stake, or provide liquidity with — creating immediate engagement with the full DeFi suite from day one.
            </p>

            <SubH>Collection Details</SubH>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { k: "Total Supply", v: "4,444" },
                { k: "Original Batch", v: "444" },
                { k: "Expanded Batch", v: "4,000" },
                { k: "Standard", v: "ERC-721" },
                { k: "Wallet", v: "ERC-6551 TBA" },
                { k: "Chain", v: "Robinhood Testnet" },
                { k: "Status", v: "Fully Minted" },
                { k: "Funded With", v: "Stock Tokens" },
              ].map((s) => (
                <div key={s.k} className="bg-lm-black border border-lm-terminal-gray/40 px-3 py-2 text-center">
                  <div className="text-[10px] text-lm-terminal-gray lm-upper tracking-wider">{s.k}</div>
                  <div className="text-white text-xs font-bold lm-mono mt-0.5">{s.v}</div>
                </div>
              ))}
            </div>

            <SubH>How It Works</SubH>
            <ol className="space-y-2 text-xs text-lm-terminal-lightgray list-none">
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">1.</span>
                User mints a Stonk Broker NFT via the <Link href="/nft" className="text-lm-orange hover:underline font-bold">NFT page</Link>.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">2.</span>
                An ERC-6551 token-bound account (TBA) is created for the NFT automatically.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">3.</span>
                The TBA is funded with stock tokens — the NFT now has its own wallet with assets.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange font-bold lm-mono w-5 shrink-0">4.</span>
                The holder can trade, stake, or provide liquidity with these tokens across the platform.
              </li>
            </ol>

            <SubH>Contracts</SubH>
            <ul className="space-y-1 text-xs text-lm-terminal-lightgray list-none">
              <li className="flex items-start gap-2">
                <span className="text-lm-orange">&#x25B8;</span>
                <strong className="text-white">Original NFT (444):</strong>{" "}
                <a href="https://explorer.testnet.chain.robinhood.com/address/0x2Bb22c9E3394272351FEffEDbEa079Be4FB10a8d" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono break-all">0x2Bb22c...0a8d</a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange">&#x25B8;</span>
                <strong className="text-white">Expanded NFT (4,000):</strong>{" "}
                <a href="https://explorer.testnet.chain.robinhood.com/address/0x5fDAeBE166490c69B4C34F99E049b4e16c9EF80a" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono break-all">0x5fDAe...f80a</a>
              </li>
            </ul>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: MARKETPLACE
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="marketplace" label="Module" title="Marketplace — Trade Brokers" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              A fully on-chain NFT marketplace where Stonk Broker holders can list their brokers for sale in ETH or propose broker-for-broker swaps. Instant settlement, no off-chain order book.
            </p>

            <SubH>Features</SubH>
            <ul className="space-y-1.5 text-xs text-lm-terminal-lightgray list-none">
              {[
                "List brokers for sale at a fixed ETH price.",
                "Propose broker-for-broker swaps (on-chain bartering).",
                "Browse all active listings with metadata previews.",
                "Instant settlement — no intermediary, no escrow delays.",
                "Cancel listings anytime before they're fulfilled.",
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-lm-orange mt-0.5">&#x25B8;</span>{f}
                </li>
              ))}
            </ul>

            <SubH>Contract</SubH>
            <p className="text-xs text-lm-terminal-lightgray">
              Marketplace:{" "}
              <a href="https://explorer.testnet.chain.robinhood.com/address/0x5a091dB1c58686f4625c14eD204BE85d83BD4aA6" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">0x5a091dB1c58686f4625c14eD204BE85d83BD4aA6</a>
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: TOKEN LAUNCHER
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="launcher" label="Module" title="Token Launcher — Create & Launch Tokens" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The Stonk Launcher lets anyone deploy a new ERC-20 token with a built-in fixed-price sale, then finalize it into a Uniswap V3 liquidity pool — all in a few clicks (or one agent action).
            </p>

            <SubH>Lifecycle</SubH>
            <div className="flex flex-col md:flex-row gap-3 mt-2">
              {[
                { step: "1", title: "Create", desc: "Deploy a new ERC-20 token + StonkLaunch sale contract via the factory." },
                { step: "2", title: "Buy", desc: "Users send ETH to buy tokens at a fixed price during the sale window." },
                { step: "3", title: "Finalize", desc: "Wraps raised ETH into WETH, creates a Uniswap V3 pool, and mints a full-range LP position." },
              ].map((s) => (
                <div key={s.step} className="flex-1 bg-lm-black border border-lm-terminal-gray/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-7 h-7 border border-lm-orange flex items-center justify-center text-lm-orange font-bold text-sm">{s.step}</span>
                    <span className="text-white font-bold text-sm lm-upper">{s.title}</span>
                  </div>
                  <p className="text-xs text-lm-terminal-lightgray leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <SubH>Create a Launch</SubH>
            <Code lang="solidity">{`struct CreateLaunchParams {
    string name;                  // Token name (e.g. "My Token")
    string symbol;                // Token symbol (e.g. "MTKN")
    string metadataURI;           // JSON metadata URI
    string imageURI;              // Token icon URI
    uint256 totalSupplyWei;       // Total supply in wei (e.g. 1_000_000e18)
    uint256 creatorAllocationBps; // Creator's share in bps (e.g. 1000 = 10%)
    uint256 saleBpsOfRemaining;   // Portion for sale in bps (e.g. 5000 = 50%)
    uint256 priceWeiPerToken;     // Fixed ETH price per whole token in wei
}

function createLaunch(CreateLaunchParams calldata p)
    external returns (address token, address launch);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Emits <code className="text-lm-orange">LaunchCreated(creator, token, launch, name, symbol, metadataURI, imageURI)</code>.
            </p>

            <SubH>Buy from the Sale</SubH>
            <Code lang="solidity">{`function buy() external payable; // send ETH, receive tokens at priceWeiPerToken
function remainingForSale() external view returns (uint256);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Emits <code className="text-lm-orange">Bought(buyer, ethIn, tokensOut)</code>. Also supports <code className="text-lm-orange">receive()</code> — just send ETH directly.
            </p>

            <SubH>Finalize the Launch</SubH>
            <Code lang="solidity">{`function finalizeLaunch(address launch, uint160 sqrtPriceX96, uint24 fee) external payable;`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              <code className="text-lm-orange">sqrtPriceX96</code> sets the initial pool price. <code className="text-lm-orange">fee</code> is the Uniswap V3 fee tier (e.g. <code className="text-white">3000</code> for 0.3%, <code className="text-white">10000</code> for 1%). Emits <code className="text-lm-orange">LaunchFinalized(creator, launch, pool, lpTokenId)</code>. Also sets up a fee splitter and staking vault.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: EXCHANGE & SWAPS
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="exchange" label="Module" title="Exchange — Swap Tokens" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              Swap any token pair through Uniswap V3 SwapRouter. The UI supports direct <strong className="text-white">ETH ↔ WETH</strong> wrapping and automatic fee-tier detection — if a swap quote fails with the default fee, the system tries all available tiers automatically.
            </p>

            <SubH>Quote a Swap</SubH>
            <Code lang="solidity">{`// QuoterV2 at 0x126f1c1F29A0f49c5D33e0139a5Da1FE25590dB1
function quoteExactInputSingle(
    address tokenIn,
    address tokenOut,
    uint24 fee,
    uint256 amountIn,
    uint160 sqrtPriceLimitX96
) external returns (uint256 amountOut, ...);`}</Code>

            <SubH>Execute a Swap</SubH>
            <Code lang="solidity">{`// SwapRouter at 0x1b32F47434a7EF83E97d0675C823E547F9266725
struct ExactInputSingleParams {
    address tokenIn;
    address tokenOut;
    uint24 fee;
    address recipient;
    uint256 deadline;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint160 sqrtPriceLimitX96;
}
function exactInputSingle(ExactInputSingleParams calldata params)
    external payable returns (uint256 amountOut);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              For native ETH swaps, send <code className="text-lm-orange">msg.value</code> and set <code className="text-lm-orange">tokenIn = WETH9</code>.
            </p>

            <SubH>ETH ↔ WETH Wrap / Unwrap</SubH>
            <Code lang="solidity">{`// WETH9 at 0x37E402B8081eFcE1D82A09a066512278006e4691
function deposit() external payable;    // ETH → WETH
function withdraw(uint256 wad) external; // WETH → ETH`}</Code>

            <SubH>Fee Tiers</SubH>
            <div className="grid grid-cols-3 gap-3">
              {[
                { tier: "500", pct: "0.05%", use: "Stable pairs" },
                { tier: "3000", pct: "0.3%", use: "Standard pairs" },
                { tier: "10000", pct: "1.0%", use: "Exotic / low-liquidity" },
              ].map((t) => (
                <div key={t.tier} className="bg-lm-black border border-lm-terminal-gray/40 px-3 py-2 text-center">
                  <div className="text-white font-bold text-sm lm-mono">{t.tier}</div>
                  <div className="text-lm-orange text-[10px] font-bold">{t.pct}</div>
                  <div className="text-lm-terminal-gray text-[10px] mt-0.5">{t.use}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-lm-terminal-gray">
              Fee tier mismatches are the #1 cause of &quot;No liquidity&quot; errors. The UI auto-detects the correct tier by trying all options.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: POOLS & LIQUIDITY
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="pools" label="Module" title="Pools — Create Pools & Mint LP Positions" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              Create Uniswap V3 concentrated liquidity pools and mint LP positions with fine-grained tick ranges. Supports native ETH on either side — the PositionManager wraps it to WETH automatically.
            </p>

            <SubH>Create and Initialize a Pool</SubH>
            <Code lang="solidity">{`// PositionManager at 0xBc82a9aA33ff24FCd56D36a0fB0a2105B193A327
function createAndInitializePoolIfNecessary(
    address token0,
    address token1,
    uint24 fee,
    uint160 sqrtPriceX96
) external payable returns (address pool);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              <code className="text-lm-orange">token0</code> must be &lt; <code className="text-lm-orange">token1</code> (sorted by address).
            </p>

            <SubH>Mint an LP Position</SubH>
            <Code lang="solidity">{`struct MintParams {
    address token0;
    address token1;
    uint24 fee;
    int24 tickLower;
    int24 tickUpper;
    uint256 amount0Desired;
    uint256 amount1Desired;
    uint256 amount0Min;
    uint256 amount1Min;
    address recipient;
    uint256 deadline;
}
function mint(MintParams calldata params)
    external payable returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );`}</Code>

            <SubH>Key Parameters</SubH>
            <ul className="space-y-1.5 text-xs text-lm-terminal-lightgray list-none">
              <li className="flex items-start gap-2">
                <span className="text-lm-orange">&#x25B8;</span>
                <strong className="text-white">Full-range:</strong> <code className="text-lm-orange">tickLower = -887272</code>, <code className="text-lm-orange">tickUpper = 887272</code>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange">&#x25B8;</span>
                <strong className="text-white">Native ETH:</strong> Send <code className="text-lm-orange">msg.value</code> and use WETH9 as the token address. The PositionManager wraps automatically.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-lm-orange">&#x25B8;</span>
                <strong className="text-white">Refund:</strong> Include <code className="text-lm-orange">refundETH()</code> in a multicall to return unused native ETH.
              </li>
            </ul>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: OPTIONS
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="options" label="Module" title="Covered Call Options" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The options module enables <strong className="text-white">covered call writing and trading</strong>. Writers escrow underlying tokens and set a strike price. Buyers pay a premium and receive an <strong className="text-white">ERC-721 option NFT</strong> they can exercise anytime the option is in-the-money (verified via TWAP oracle).
            </p>

            <div className="bg-lm-black border border-lm-orange/20 p-4 mt-2">
              <div className="text-lm-orange text-[10px] font-bold lm-upper tracking-[0.15em] mb-2">Market Incentive Design</div>
              <p className="text-xs text-lm-terminal-lightgray leading-relaxed">
                <strong className="text-white">Call options incentivize users to pump token prices higher</strong> — option holders profit when the underlying token goes up, creating natural buying pressure. Meanwhile, <strong className="text-white">other users lock tokens in LP positions to earn yield from trading fees</strong>. The lockup requirement for LP ensures tokens are removed from circulating supply, reducing sell pressure while generating passive income from swap fees. This creates a dual flywheel: options push price up, LPs lock supply and earn yield.
              </p>
            </div>

            <SubH>Write a Covered Call</SubH>
            <Code lang="solidity">{`// CoveredCallVault at 0x055d84908672b9be53275963862614aEA9CDB98B
function createOffer(
    address underlying,        // token to escrow
    address quote,             // settlement token (usually WETH)
    address pool,              // Uniswap V3 pool for TWAP
    uint32 twapSeconds,        // TWAP window (min 15 minutes / 900s)
    int24 strikeTick,          // strike price as a Uni V3 tick
    uint256 underlyingAmount,  // how many underlying tokens to escrow
    uint256 strikeQuoteAmount, // quote tokens received if exercised
    uint256 premiumQuoteAmount,// premium the buyer pays upfront
    uint256 expiry             // UNIX timestamp for expiration
) external returns (uint256 offerId);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              The writer must <code className="text-lm-orange">approve(vault, underlyingAmount)</code> before calling.
            </p>

            <SubH>Buy an Option</SubH>
            <Code lang="solidity">{`function buyOption(uint256 offerId) external returns (uint256 optionTokenId);`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Buyer must <code className="text-lm-orange">approve(vault, premiumQuoteAmount)</code> of the quote token. Receives an ERC-721 option NFT.
            </p>

            <SubH>Exercise an Option</SubH>
            <Code lang="solidity">{`function exercise(uint256 optionTokenId) external;`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Only works if <strong className="text-white">in-the-money per TWAP oracle</strong> and before expiry. Buyer sends <code className="text-lm-orange">strikeQuoteAmount</code> and receives the escrowed underlying tokens.
            </p>

            <SubH>Reclaim Expired Collateral</SubH>
            <Code lang="solidity">{`function reclaimExpired(uint256 optionTokenId) external;`}</Code>
            <p className="text-xs text-lm-terminal-lightgray">
              Writer can reclaim escrowed collateral after expiry if the option was never exercised.
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: TOKEN REGISTRY
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="registry" label="Module" title="Token Registry" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The <code className="text-lm-orange">StonkTokenRegistry</code> maintains an on-chain list of all known tokens with metadata (name, symbol, icon, description). The exchange UI reads this registry to display token information in dropdowns and swap panels.
            </p>
            <p className="text-xs text-lm-terminal-lightgray">
              Contract:{" "}
              <a href="https://explorer.testnet.chain.robinhood.com/address/0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">
                0xA4954EF8A679B13b1875Bb508E84F563c27A9D5b
              </a>
            </p>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: SUGGESTED AGENT FLOW
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="agent-flow" label="Automation" title="Suggested Agent Flow (End-to-End)" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              A ClawdBot can go from a fresh wallet to a fully launched token with trading and options activity in minutes. Here is the recommended sequence:
            </p>

            <div className="space-y-2">
              {[
                { n: "1", act: "faucet_claim", desc: "Claim testnet ETH from the faucet or use the Robinhood official faucet." },
                { n: "2", act: "launch_create", desc: "Deploy a new token with name, symbol, supply, and sale parameters." },
                { n: "3", act: "launch_buy", desc: "Send ETH to the sale contract to acquire tokens at the fixed price." },
                { n: "4", act: "launch_finalize", desc: "Finalize the launch — creates a Uniswap V3 pool with full-range LP." },
                { n: "5", act: "swap", desc: "Trade the new token against ETH/WETH via the SwapRouter." },
                { n: "6", act: "pool_mint_lp", desc: "Provide additional liquidity in a concentrated or full-range position." },
                { n: "7", act: "option_write", desc: "Write a covered call — escrow tokens and set a strike price." },
                { n: "8", act: "option_buy", desc: "Another agent or user buys the option, paying the premium." },
                { n: "9", act: "option_exercise / option_reclaim", desc: "Exercise if ITM, or reclaim collateral after expiry." },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3 bg-lm-black border border-lm-terminal-gray/30 px-4 py-3">
                  <span className="text-lm-orange font-bold lm-mono text-sm w-5 shrink-0">{s.n}</span>
                  <div>
                    <code className="text-lm-orange text-[11px] lm-mono">{s.act}</code>
                    <p className="text-xs text-lm-terminal-lightgray mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION: ABI QUICK REFERENCE
            ════════════════════════════════════════════════════════════ */}
        <div className="lm-panel mt-6">
          <SectionH id="abi" label="Reference" title="ABI Quick Reference" />
          <div className="px-1 pb-6 space-y-4">
            <p className="text-sm text-lm-terminal-lightgray leading-relaxed">
              The full SkillCard JSON at <a href="https://apeclaw.ai/api/skills/stonkbrokers-launcher" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-mono">apeclaw.ai/api/skills/stonkbrokers-launcher</a> contains complete ABI definitions, input schemas, and execution bindings for every module. Below is a summary of the key entry points:
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-lm-terminal-gray/50">
                    <th className="py-2 pr-3 text-left text-[10px] text-lm-terminal-gray lm-upper tracking-wider">Contract</th>
                    <th className="py-2 pr-3 text-left text-[10px] text-lm-terminal-gray lm-upper tracking-wider">Function</th>
                    <th className="py-2 text-left text-[10px] text-lm-terminal-gray lm-upper tracking-wider">Purpose</th>
                  </tr>
                </thead>
                <tbody className="text-lm-terminal-lightgray">
                  {[
                    { c: "StonkEthFaucet", f: "claim()", p: "Get testnet ETH" },
                    { c: "LauncherFactory", f: "createLaunch(params)", p: "Deploy token + sale" },
                    { c: "StonkLaunch", f: "buy()", p: "Buy tokens in sale" },
                    { c: "LauncherFactory", f: "finalizeLaunch(launch, price, fee)", p: "Seed Uni V3 pool" },
                    { c: "QuoterV2", f: "quoteExactInputSingle(...)", p: "Get swap quote" },
                    { c: "SwapRouter", f: "exactInputSingle(params)", p: "Execute swap" },
                    { c: "WETH9", f: "deposit() / withdraw(wad)", p: "ETH ↔ WETH" },
                    { c: "PositionManager", f: "createAndInitializePoolIfNecessary(...)", p: "Create pool" },
                    { c: "PositionManager", f: "mint(params)", p: "Mint LP position" },
                    { c: "CoveredCallVault", f: "createOffer(...)", p: "Write covered call" },
                    { c: "CoveredCallVault", f: "buyOption(offerId)", p: "Buy option NFT" },
                    { c: "CoveredCallVault", f: "exercise(tokenId)", p: "Exercise ITM option" },
                    { c: "CoveredCallVault", f: "reclaimExpired(tokenId)", p: "Reclaim expired" },
                  ].map((r, i) => (
                    <tr key={i} className="border-b border-lm-terminal-gray/20 hover:bg-lm-terminal-darkgray/40 transition-colors">
                      <td className="py-2 pr-3 text-white font-semibold whitespace-nowrap">{r.c}</td>
                      <td className="py-2 pr-3 lm-mono text-lm-orange whitespace-nowrap">{r.f}</td>
                      <td className="py-2">{r.p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <SubH>Full Skill JSON</SubH>
            <Code lang="bash">{`# Download the complete skill definition with all ABIs and schemas
curl -fsSL "https://apeclaw.ai/api/skills/stonkbrokers-launcher" | jq . > stonkbrokers-full.json

# Or from GitHub
curl -fsSL "https://raw.githubusercontent.com/simplefarmer69/ape-claw/main/skillcards/seed/stonkbrokers-launcher.v1.json" > stonkbrokers-full.json`}</Code>
          </div>
        </div>

        {/* ── Footer links ── */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs py-6">
          <Link href="/" className="text-lm-orange hover:underline lm-upper font-bold tracking-wider">Back to Home</Link>
          <span className="text-lm-terminal-gray hidden sm:inline">|</span>
          <a href="https://apeclaw.ai/skills#install=stonkbrokers-launcher" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-upper font-bold tracking-wider">ApeClaw Skill Page</a>
          <span className="text-lm-terminal-gray hidden sm:inline">|</span>
          <a href="https://github.com/Clutch-L4bs/stonkbrokers" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-upper font-bold tracking-wider">GitHub</a>
          <span className="text-lm-terminal-gray hidden sm:inline">|</span>
          <a href="https://explorer.testnet.chain.robinhood.com" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline lm-upper font-bold tracking-wider">Block Explorer</a>
        </div>

      </div>
    </TerminalShell>
  );
}
