"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Address, formatEther } from "viem";
import { TerminalShell } from "./components/Terminal";

import { publicClient } from "./providers";
import { config } from "./lib/config";
import { ERC721EnumerableAbi, StonkExpandedNftMintAbi } from "./lib/abis";

/* ═══════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════ */

/* Animated counter — counts up with ease-out cubic */
function useAnimatedNumber(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const raf = useRef(0);
  const started = useRef(false);

  const start = useCallback(() => {
    if (started.current || target <= 0) return;
    started.current = true;
    const t0 = performance.now();
    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
  }, [target, duration]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return { value, start };
}

/* IntersectionObserver — triggers once when element enters viewport */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* Typewriter text — reveals characters one at a time */
function useTypewriter(text: string, speed = 40, startTyping = false) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    if (!startTyping) return;
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, startTyping]);

  return displayed;
}

/* Mouse parallax on a container */
function useParallax() {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    function handleMove(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setOffset({
        x: (e.clientX - cx) / rect.width * 12,
        y: (e.clientY - cy) / rect.height * 8,
      });
    }
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  return { ref, offset };
}

/* ═══════════════════════════════════════════
   ICONS (larger, thinner for landing page)
   ═══════════════════════════════════════════ */
const ICONS: Record<string, React.ReactNode> = {
  nft: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-9 h-9">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  marketplace: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-9 h-9">
      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 01-8 0" />
    </svg>
  ),
  launcher: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-9 h-9">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  exchange: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-9 h-9">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  ),
  options: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-9 h-9">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
};

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */
const FEATURES = [
  {
    href: "/nft", title: "NFT Collection", key: "nft",
    desc: "Mint Stonk Brokers with ERC-6551 wallets. Each NFT comes funded with stock tokens you can trade, stake, or sell.",
    tag: "ACTIVE",
    highlight: "ERC-6551 Token-Bound Accounts"
  },
  {
    href: "/marketplace", title: "Marketplace", key: "marketplace",
    desc: "List brokers for ETH or propose broker-for-broker swaps. Fully on-chain order book with instant settlement.",
    tag: "LIVE",
    highlight: "On-Chain Listings & Swaps"
  },
  {
    href: "/launcher", title: "Stonk Launcher", key: "launcher",
    desc: "Create meme coins in one click. Automatic Uniswap V3 LP, 50/50 fee splitting, staking rewards, and public sales.",
    tag: "LIVE",
    highlight: "One-Click Token Launch"
  },
  {
    href: "/exchange", title: "Stonk Exchange", key: "exchange",
    desc: "Swap any pair including native ETH. Create concentrated liquidity pools. Manage range-based LP positions.",
    tag: "LIVE",
    highlight: "Uniswap V3 Concentrated LP"
  },
  {
    href: "/options", title: "Options Platform", key: "options",
    desc: "Write covered calls, buy them as tradeable NFTs. TWAP oracle pricing. Exercise anytime the option is in-the-money.",
    tag: "LIVE",
    highlight: "NFT-Based Options Trading"
  }
];

const ECOSYSTEM = [
  { label: "Robinhood Chain", sub: "L2 Testnet" },
  { label: "Uniswap V3", sub: "AMM Protocol" },
  { label: "ERC-6551", sub: "Token-Bound Accounts" },
  { label: "ERC-721", sub: "NFT Standard" },
  { label: "Covered Calls", sub: "Options Engine" },
  { label: "TWAP Oracle", sub: "On-Chain Pricing" },
];

/* ═══════════════════════════════════════════
   SECTION LABEL (reusable heading pattern)
   ═══════════════════════════════════════════ */
function SectionLabel({ label, visible }: { label: string; visible: boolean }) {
  return (
    <div className="flex items-center gap-3 justify-center mb-2">
      <div className={`h-px bg-lm-orange/30 transition-all duration-700 ${visible ? "w-8" : "w-0"}`} />
      <div className="text-lm-orange text-[10px] font-bold lm-upper tracking-[0.2em]">{label}</div>
      <div className={`h-px bg-lm-orange/30 transition-all duration-700 ${visible ? "w-8" : "w-0"}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════ */
export default function Page() {
  const [mintedCount, setMintedCount] = useState<string>("...");
  const [mintedRaw, setMintedRaw] = useState<number>(0);
  const [mintPrice, setMintPrice] = useState<string>("...");

  useEffect(() => {
    (async () => {
      try {
        let total = 444n;
        if (config.expandedNft) {
          const s = (await publicClient.readContract({ address: config.expandedNft as Address, abi: ERC721EnumerableAbi, functionName: "totalSupply" })) as bigint;
          total += s;
        }
        if (config.legacyExpandedNft) {
          const s = (await publicClient.readContract({ address: config.legacyExpandedNft as Address, abi: ERC721EnumerableAbi, functionName: "totalSupply" })) as bigint;
          total += s;
        }
        setMintedRaw(Number(total));
        setMintedCount(`${total.toString()} / 4,444`);
      } catch { setMintedCount("—"); }
      try {
        if (config.expandedNft) {
          const p = (await publicClient.readContract({ address: config.expandedNft as Address, abi: StonkExpandedNftMintAbi, functionName: "MINT_PRICE" })) as bigint;
          setMintPrice(`${formatEther(p)} ETH`);
        }
      } catch { setMintPrice("—"); }
    })();
  }, []);

  const mintPct = mintedRaw > 0 ? Number((BigInt(mintedRaw) * 10000n) / 4444n) / 100 : 0;

  /* ── Animated counters (start when stats section enters view) ── */
  const cMinted = useAnimatedNumber(mintedRaw);
  const cFeatures = useAnimatedNumber(5);
  const cContracts = useAnimatedNumber(12);

  /* ── Section observers ── */
  const heroObs = useInView(0.05);
  const statsObs = useInView(0.2);
  const featuresObs = useInView(0.08);
  const ecosystemObs = useInView(0.15);
  const mintObs = useInView(0.15);
  const stepsObs = useInView(0.1);
  const communityObs = useInView(0.15);

  /* Start counters when stats section is visible */
  useEffect(() => {
    if (statsObs.visible) { cMinted.start(); cFeatures.start(); cContracts.start(); }
  }, [statsObs.visible, cMinted, cFeatures, cContracts]);

  /* ── Hero typewriter ── */
  const HERO_TEXT = "NFT collection with token-bound wallets, decentralized exchange, meme coin launcher, and covered call options.";
  const subtitle = useTypewriter(
    HERO_TEXT,
    25,
    heroObs.visible
  );

  /* ── Mouse parallax for hero ── */
  const parallax = useParallax();

  return (
    <TerminalShell
      title="The Stonk Exchange"
      subtitle="DeFi suite on Robinhood Chain"
    >
      <div className="space-y-0 overflow-hidden">

        {/* ════════════════════════════════════════════════════════
            SECTION 1 — HERO
            Full-screen centered hero with floating glow orbs,
            typewriter subtitle, mouse parallax brand mark
            ════════════════════════════════════════════════════════ */}
        <section
          ref={heroObs.ref}
          className="relative overflow-hidden"
        >
          <div ref={parallax.ref} className="relative py-16 md:py-24 lg:py-28 px-6 md:px-10 text-center">
            {/* Floating glow orbs */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-lm-orange/[0.035] rounded-full blur-[120px] pointer-events-none lm-orb-1" />
            <div className="absolute bottom-0 left-[15%] w-[400px] h-[300px] bg-lm-green/[0.025] rounded-full blur-[100px] pointer-events-none lm-orb-2" />
            <div className="absolute top-[30%] right-[10%] w-[250px] h-[250px] bg-lm-orange/[0.02] rounded-full blur-[80px] pointer-events-none lm-orb-3" />

            {/* Tagline — staggered word reveal */}
            <h1
              className={`relative text-white font-bold text-3xl md:text-5xl lg:text-6xl lm-upper leading-tight max-w-4xl mx-auto transition-all duration-1000 delay-200 ${heroObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transform: `translate(${parallax.offset.x * 0.2}px, ${heroObs.visible ? parallax.offset.y * 0.2 : 32}px)` }}
            >
              The <span className="text-lm-orange lm-glow">Stonk Broker</span> Terminal
            </h1>

            {/* Typewriter subtitle */}
            <div className={`relative mt-5 md:mt-7 max-w-2xl mx-auto min-h-[3em] transition-opacity duration-700 delay-500 ${heroObs.visible ? "opacity-100" : "opacity-0"}`}>
              <p className="text-lm-terminal-lightgray text-base md:text-lg leading-relaxed">
                A full DeFi suite on Robinhood Chain —{" "}
                <span className="text-white/80">{subtitle}</span>
                {subtitle.length < HERO_TEXT.length && <span className="lm-type-cursor" />}
              </p>
            </div>

            {/* CTA buttons */}
            <div className={`relative flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 md:mt-12 transition-all duration-700 delay-700 ${heroObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Link
                href="/exchange"
                className="lm-btn lm-btn-primary lm-btn-lg px-8 font-bold lm-upper flex items-center gap-2 w-full sm:w-auto justify-center lm-glow-pulse"
              >
                Launch App
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-60"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" /></svg>
              </Link>
              <Link
                href="/nft"
                className="lm-btn lm-btn-lg px-8 font-bold lm-upper flex items-center gap-2 w-full sm:w-auto justify-center"
              >
                Mint NFT
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-40"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" /></svg>
              </Link>
            </div>

            {/* Scroll indicator */}
            <div className={`relative mt-16 transition-opacity duration-700 delay-1000 ${heroObs.visible ? "opacity-100" : "opacity-0"}`}>
              <div className="flex flex-col items-center gap-2 text-lm-terminal-gray">
                <div className="text-[10px] lm-upper tracking-widest">Scroll to explore</div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 lm-bounce">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 2 — STATS BANNER
            Big animated numbers that count up when visible
            ════════════════════════════════════════════════════════ */}
        <section ref={statsObs.ref} className="relative">
          {/* Animated divider line */}
          <div className={`h-px bg-gradient-to-r from-transparent via-lm-orange/30 to-transparent transition-all duration-1000 ${statsObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />

          <div className="bg-lm-terminal-darkgray/50 py-10 md:py-14 px-6">
            <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
              {[
                { value: cMinted.value.toLocaleString(), label: "NFTs Minted", sub: "of 4,444" },
                { value: cFeatures.value.toString(), label: "DeFi Products", sub: "Live on testnet" },
                { value: cContracts.value.toString(), label: "Smart Contracts", sub: "Deployed" },
                { value: "1", label: "Chain", sub: "Robinhood Testnet" },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={`text-center transition-all duration-700 ${statsObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
                  style={{ transitionDelay: `${200 + i * 120}ms` }}
                >
                  <div className={`text-white font-bold text-4xl md:text-5xl lm-mono ${statsObs.visible ? "lm-glow" : ""}`}>
                    {stat.value}
                  </div>
                  <div className="text-lm-orange text-[10px] font-bold lm-upper tracking-wider mt-2">{stat.label}</div>
                  <div className="text-lm-terminal-lightgray text-[10px] mt-0.5">{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={`h-px bg-gradient-to-r from-transparent via-lm-terminal-gray/50 to-transparent transition-all duration-1000 delay-300 ${statsObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 3 — PRODUCTS
            Feature cards with hover lift, staggered reveal, icon glow
            ════════════════════════════════════════════════════════ */}
        <section
          ref={featuresObs.ref}
          className="py-14 md:py-20 px-4"
        >
          <div className="max-w-5xl mx-auto">
            <div className={`text-center mb-10 md:mb-14 transition-all duration-700 ${featuresObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <SectionLabel label="Products" visible={featuresObs.visible} />
              <h2 className="text-white font-bold text-2xl md:text-4xl lm-upper mt-1">Everything You Need</h2>
              <p className="text-lm-terminal-lightgray text-sm mt-3 max-w-lg mx-auto leading-relaxed">
                A complete DeFi ecosystem — from NFT minting to token launches, trading, and options — all on one chain.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f, i) => (
                <Link
                  key={f.href}
                  href={f.href}
                  className={`group block relative bg-lm-terminal-darkgray border border-lm-terminal-gray p-6 lm-card-hover lm-card-lift transition-all duration-700 ${featuresObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                  style={{ transitionDelay: `${300 + i * 100}ms` }}
                >
                  {/* Gradient accent line */}
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-lm-orange/0 to-transparent group-hover:via-lm-orange/40 transition-all duration-500" />

                  {/* Icon area with glow on hover */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="text-lm-orange/60 group-hover:text-lm-orange transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(207,255,4,0.3)]">
                      {ICONS[f.key]}
                    </div>
                    <span className={`lm-badge text-[9px] ${f.tag === "ACTIVE" ? "lm-badge-filled-green" : "lm-badge-filled-orange"}`}>{f.tag}</span>
                  </div>

                  <h3 className="text-white font-bold text-base lm-upper mb-1.5 group-hover:text-lm-orange transition-colors duration-300">{f.title}</h3>
                  <div className="text-lm-orange/50 text-[10px] font-bold lm-upper tracking-wider mb-3">{f.highlight}</div>
                  <div className="text-lm-terminal-lightgray text-xs leading-relaxed mb-5">{f.desc}</div>

                  <div className="flex items-center justify-between pt-3 border-t border-lm-terminal-gray/40">
                    <span className="text-[10px] text-lm-terminal-gray lm-mono group-hover:text-lm-terminal-lightgray transition-colors">{f.href}</span>
                    <span className="text-lm-terminal-gray group-hover:text-lm-orange group-hover:translate-x-1.5 transition-all duration-300 text-sm">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 4 — ECOSYSTEM
            Tech grid with staggered scale-in
            ════════════════════════════════════════════════════════ */}
        <section ref={ecosystemObs.ref} className="relative">
          <div className={`h-px bg-gradient-to-r from-transparent via-lm-terminal-gray/40 to-transparent transition-all duration-1000 ${ecosystemObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />

          <div className="py-12 md:py-16 px-4 bg-lm-terminal-darkgray/20">
            <div className="max-w-4xl mx-auto">
              <div className={`text-center mb-10 transition-all duration-700 ${ecosystemObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                <SectionLabel label="Built With" visible={ecosystemObs.visible} />
                <h2 className="text-white font-bold text-2xl md:text-3xl lm-upper mt-1">Battle-Tested Infrastructure</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                {ECOSYSTEM.map((item, i) => (
                  <div
                    key={item.label}
                    className={`bg-lm-black border border-lm-terminal-gray p-5 md:p-6 text-center lm-card-lift group transition-all duration-600 ${ecosystemObs.visible ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
                    style={{ transitionDelay: `${200 + i * 80}ms` }}
                  >
                    <div className="text-white font-bold text-sm lm-upper group-hover:text-lm-orange transition-colors duration-300">{item.label}</div>
                    <div className="text-lm-terminal-lightgray text-[10px] mt-1.5">{item.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`h-px bg-gradient-to-r from-transparent via-lm-terminal-gray/40 to-transparent transition-all duration-1000 delay-300 ${ecosystemObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 5 — MINT PROGRESS
            Dedicated card with animated progress bar shimmer
            ════════════════════════════════════════════════════════ */}
        <section ref={mintObs.ref} className="py-14 md:py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className={`relative overflow-hidden border border-lm-terminal-gray p-8 md:p-12 transition-all duration-800 ${mintObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
              {/* Animated background glow */}
              <div className="absolute -top-24 -right-24 w-56 h-56 bg-lm-orange/[0.04] rounded-full blur-[80px] pointer-events-none lm-orb-2" />
              <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-lm-green/[0.03] rounded-full blur-[60px] pointer-events-none lm-orb-3" />

              <div className={`relative text-center mb-8 transition-all duration-700 delay-200 ${mintObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <SectionLabel label="Collection" visible={mintObs.visible} />
                <h2 className="text-white font-bold text-2xl md:text-3xl lm-upper mt-1">4,444 Pixel Stock Brokers</h2>
                <p className="text-lm-terminal-lightgray text-sm mt-2 max-w-md mx-auto">
                  100% on-chain. Each broker has a token-bound wallet funded with stock tokens at mint.
                </p>
              </div>

              {/* Animated progress bar */}
              <div className={`relative space-y-2.5 mb-8 transition-all duration-700 delay-400 ${mintObs.visible ? "opacity-100" : "opacity-0"}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-lm-terminal-lightgray font-bold lm-upper tracking-wider">Minted</span>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold lm-mono text-sm">{mintedCount}</span>
                    {mintPct > 0 && <span className="lm-badge lm-badge-filled-green text-[9px]">{mintPct.toFixed(1)}%</span>}
                  </div>
                </div>
                <div className="h-3.5 bg-lm-black border border-lm-terminal-gray overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-lm-orange to-lm-green/80 transition-all duration-[2000ms] ease-out relative"
                    style={{ width: mintObs.visible ? `${mintPct}%` : "0%" }}
                  >
                    {/* Shimmer sweep overlay */}
                    <div className="absolute inset-0 lm-progress-shimmer" />
                  </div>
                </div>
              </div>

              {/* Stats row — staggered */}
              <div className="relative grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                {[
                  { label: "Mint Price", value: mintPrice },
                  { label: "Wallet Type", value: "ERC-6551" },
                  { label: "Supply", value: "4,444" },
                  { label: "Standard", value: "ERC-721" },
                ].map((s, i) => (
                  <div
                    key={s.label}
                    className={`bg-lm-black border border-lm-terminal-gray p-3 text-center transition-all duration-600 ${mintObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
                    style={{ transitionDelay: `${500 + i * 100}ms` }}
                  >
                    <div className="text-lm-terminal-lightgray text-[10px] lm-upper font-bold tracking-wider">{s.label}</div>
                    <div className="text-white font-bold text-sm lm-mono mt-1">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className={`relative transition-all duration-700 delay-700 ${mintObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                <Link
                  href="/nft"
                  className="lm-btn lm-btn-primary lm-btn-lg w-full font-bold lm-upper flex items-center justify-center gap-2 lm-glow-pulse"
                >
                  Mint a Stonk Broker
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 opacity-60"><path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" /></svg>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 6 — HOW IT WORKS
            Step cards with animated connecting lines
            ════════════════════════════════════════════════════════ */}
        <section ref={stepsObs.ref} className="relative">
          <div className={`h-px bg-gradient-to-r from-transparent via-lm-terminal-gray/40 to-transparent transition-all duration-1000 ${stepsObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />

          <div className="py-14 md:py-18 px-4">
            <div className="max-w-4xl mx-auto">
              <div className={`text-center mb-10 transition-all duration-700 ${stepsObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                <SectionLabel label="Getting Started" visible={stepsObs.visible} />
                <h2 className="text-white font-bold text-2xl md:text-3xl lm-upper mt-1">Join the Terminal</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 relative">
                {/* Connecting line behind cards (desktop) */}
                <div className={`hidden md:block absolute top-[44px] left-[16%] right-[16%] h-px border-t border-dashed border-lm-orange/20 transition-all duration-1000 delay-500 ${stepsObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />

                {[
                  {
                    step: 1, title: "Get Testnet ETH",
                    content: (
                      <>Visit the <a href="https://faucet.testnet.chain.robinhood.com" target="_blank" rel="noreferrer" className="text-lm-orange hover:underline font-bold">Robinhood Faucet</a> to fund your wallet with testnet ETH.</>
                    )
                  },
                  {
                    step: 2, title: "Mint a Broker",
                    content: (
                      <><Link href="/nft" className="text-lm-orange hover:underline font-bold">Mint a Stonk Broker</Link> NFT. Each comes with a funded wallet of stock tokens.</>
                    )
                  },
                  {
                    step: 3, title: "Explore DeFi",
                    content: (
                      <>Trade on the <Link href="/exchange" className="text-lm-orange hover:underline font-bold">DEX</Link>, launch coins on the <Link href="/launcher" className="text-lm-orange hover:underline font-bold">Launcher</Link>, or write <Link href="/options" className="text-lm-orange hover:underline font-bold">Options</Link>.</>
                    )
                  }
                ].map((s, i) => (
                  <div
                    key={s.step}
                    className={`relative bg-lm-terminal-darkgray border border-lm-terminal-gray p-6 lm-card-lift transition-all duration-700 ${stepsObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                    style={{ transitionDelay: `${300 + i * 150}ms` }}
                  >
                    {/* Step number with glow */}
                    <div
                      className={`relative w-11 h-11 border-2 border-lm-orange flex items-center justify-center mb-5 transition-all duration-700 ${stepsObs.visible ? "lm-brand-breathe" : ""}`}
                      style={{ transitionDelay: `${400 + i * 150}ms` }}
                    >
                      <span className="text-lm-orange font-bold text-lg">{s.step}</span>
                    </div>
                    <h3 className="text-white font-bold text-sm lm-upper mb-2">{s.title}</h3>
                    <div className="text-lm-terminal-lightgray text-xs leading-relaxed">{s.content}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════
            SECTION 7 — COMMUNITY CTA
            Final section with social links and credits
            ════════════════════════════════════════════════════════ */}
        <section ref={communityObs.ref} className="relative">
          <div className={`h-px bg-gradient-to-r from-transparent via-lm-terminal-gray/40 to-transparent transition-all duration-1000 ${communityObs.visible ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"}`} />

          <div className="py-16 md:py-20 px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className={`transition-all duration-700 ${communityObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                <SectionLabel label="Community" visible={communityObs.visible} />
                <h2 className="text-white font-bold text-2xl md:text-3xl lm-upper mt-1 mb-3">Join the Stonk Brokers</h2>
                <p className="text-lm-terminal-lightgray text-sm mb-10 max-w-lg mx-auto leading-relaxed">
                  The terminal is live and growing. Follow us for updates, new features, and ecosystem announcements.
                </p>
              </div>

              <div className={`flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-700 delay-300 ${communityObs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                <a
                  href="https://x.com/ClutchMarkets"
                  target="_blank"
                  rel="noreferrer"
                  className="lm-btn lm-btn-lg px-7 font-bold flex items-center gap-2.5 w-full sm:w-auto justify-center group"
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" className="shrink-0 group-hover:scale-110 transition-transform">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Follow on X
                </a>
                <a
                  href="https://stonkbrokers.cash"
                  target="_blank"
                  rel="noreferrer"
                  className="lm-btn lm-btn-lg px-7 font-bold flex items-center gap-2.5 w-full sm:w-auto justify-center group"
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0 group-hover:rotate-12 transition-transform">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                  </svg>
                  stonkbrokers.cash
                </a>
              </div>

              <div className={`mt-14 flex items-center justify-center gap-3 text-lm-terminal-gray text-[10px] lm-upper tracking-wider transition-all duration-700 delay-500 ${communityObs.visible ? "opacity-100" : "opacity-0"}`}>
                <div className={`h-px bg-lm-terminal-gray/30 transition-all duration-1000 delay-600 ${communityObs.visible ? "w-12" : "w-0"}`} />
                <span>Built by <span className="text-lm-terminal-lightgray">Clutch Labs</span> · Powered by <span className="text-lm-terminal-lightgray">Robinhood Chain</span></span>
                <div className={`h-px bg-lm-terminal-gray/30 transition-all duration-1000 delay-600 ${communityObs.visible ? "w-12" : "w-0"}`} />
              </div>
            </div>
          </div>
        </section>

      </div>
    </TerminalShell>
  );
}
