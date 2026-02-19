"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";
import { useWallet } from "../wallet/WalletProvider";
import { config } from "../lib/config";

/* ─────────────────────── Clean SVG Icons ─────────────────────── */

function SvgWrap({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <SvgWrap>
      <path d="M3 9.5L12 3l9 6.5" />
      <path d="M19 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6" />
    </SvgWrap>
  );
}

function NftIcon() {
  return (
    <SvgWrap>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </SvgWrap>
  );
}

function MarketIcon() {
  return (
    <SvgWrap>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </SvgWrap>
  );
}

function RocketIcon() {
  return (
    <SvgWrap>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </SvgWrap>
  );
}

function SwapIcon() {
  return (
    <SvgWrap>
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </SvgWrap>
  );
}

function ChartIcon() {
  return (
    <SvgWrap>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-8 4 4 5-9" />
    </SvgWrap>
  );
}

function DocsIcon() {
  return (
    <SvgWrap>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </SvgWrap>
  );
}

function MenuIcon() {
  return (
    <SvgWrap>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </SvgWrap>
  );
}

function CloseIcon() {
  return (
    <SvgWrap>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </SvgWrap>
  );
}

function WalletIcon() {
  return (
    <SvgWrap>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="17" cy="14" r="1" fill="currentColor" stroke="none" />
    </SvgWrap>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
    </svg>
  );
}

/* ─────────────────────── Data ─────────────────────── */

const NAV = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/nft", label: "NFT", Icon: NftIcon },
  { href: "/marketplace", label: "Marketplace", Icon: MarketIcon },
  { href: "/launcher", label: "Launcher", Icon: RocketIcon },
  { href: "/exchange", label: "Exchange", Icon: SwapIcon },
  { href: "/options", label: "Options", Icon: ChartIcon },
  { href: "/docs", label: "Docs", Icon: DocsIcon },
];

const SOCIALS = [
  { href: "https://x.com/ClutchMarkets", label: "X / Twitter", Icon: XIcon },
  { href: "https://stonkbrokers.cash", label: "stonkbrokers.cash", Icon: GlobeIcon },
];

/* ─────────────────────── Label helper ─────────────────────── */
/* Shows text on mobile always, on desktop only when sidebar is hovered. */
function SideLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap overflow-hidden text-sm font-semibold lm-upper",
        "lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200"
      )}
    >
      {children}
    </span>
  );
}

function SideLabelXs({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap overflow-hidden text-xs",
        "lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200"
      )}
    >
      {children}
    </span>
  );
}

/* ─────────────────────── Sidebar ─────────────────────── */

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const [walletStatus, setWalletStatus] = useState<string>("");
  const pathname = usePathname();
  const { address, chainId, connect, disconnect, switchToRobinhood, hasWallet } = useWallet();
  const okChain = chainId ? chainId === config.chainId : false;

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleConnect() {
    setWalletStatus("");
    try {
      await connect();
    } catch (e: any) {
      setWalletStatus(String(e?.message || "Failed to connect wallet."));
    }
  }

  return (
    <>
      {/* Hamburger toggle (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed top-3 left-3 z-[60] lg:hidden lm-btn p-1.5"
        aria-label="Toggle menu"
        aria-expanded={open}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Backdrop (mobile only — smoother) */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[49] lg:hidden transition-all duration-300",
          open ? "bg-black/70 backdrop-blur-sm opacity-100 pointer-events-auto" : "bg-black/0 opacity-0 pointer-events-none"
        )}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar (smoother width transition) */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-[50] flex flex-col",
          "bg-lm-dark-gray border-r border-lm-terminal-gray",
          "overflow-y-auto overflow-x-hidden",
          // Mobile: slide in/out with smoother easing
          open ? "translate-x-0 w-56" : "-translate-x-full w-56",
          "transition-[transform,width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          // Desktop: always visible, narrow strip expanding on hover
          "lg:translate-x-0 lg:w-14 lg:hover:w-56 group/sidebar"
        )}
      >
        {/* ── Brand ── */}
        <Link href="/" className="flex items-center gap-3 px-3 h-14 shrink-0 border-b border-lm-terminal-gray hover:bg-lm-black/20 transition-colors">
          <div className="w-7 h-7 border border-lm-orange flex items-center justify-center shrink-0 bg-lm-black">
            <img
              src="/stonk-broker.png"
              alt="Stonk Brokers"
              className="w-6 h-6 object-contain"
              loading="eager"
              decoding="async"
            />
          </div>
          <SideLabel>
            <span className="text-lm-orange">STONK</span>{" "}
            <span className="text-white">BROKERS</span>
          </SideLabel>
        </Link>

        {/* ── Chain status ── */}
        <div className="flex items-center gap-3 px-4 h-9 shrink-0 border-b border-lm-terminal-gray">
          <span
            className={cn(
              "lm-dot shrink-0",
              chainId ? (okChain ? "lm-dot-green lm-dot-pulse" : "lm-dot-red") : "lm-dot-gray"
            )}
          />
          <SideLabelXs>
            <span className={cn(
              chainId ? (okChain ? "text-lm-green" : "text-lm-red") : "text-lm-terminal-lightgray"
            )}>
              {chainId ? (okChain ? `Robinhood (${config.chainId})` : "WRONG CHAIN") : "DISCONNECTED"}
            </span>
          </SideLabelXs>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 py-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center gap-3 h-10 px-4 transition-all relative",
                  active
                    ? "text-lm-orange bg-lm-black border-r-2 border-lm-orange shadow-[inset_0_0_20px_rgba(207,255,4,0.04)]"
                    : "text-lm-gray hover:text-lm-orange hover:bg-lm-black/40"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-lm-orange shadow-[0_0_6px_rgba(207,255,4,0.5)]" />
                )}
                <item.Icon />
                <SideLabel>{item.label}</SideLabel>
              </Link>
            );
          })}
        </nav>

        {/* ── Wallet ── */}
        <div className="border-t border-lm-terminal-gray px-3 py-3 space-y-2">
          {address ? (
            <>
              <div className="flex items-center gap-3">
                <WalletIcon />
                <SideLabelXs>
                  <span className="lm-mono text-lm-gray">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                </SideLabelXs>
              </div>
              <div className="flex gap-1.5 flex-wrap lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200">
                {!okChain && (
                  <button
                    type="button"
                    onClick={() => switchToRobinhood().catch((e: any) => { const msg = e?.message || ""; if (!msg.includes("rejected") && !msg.includes("denied")) setWalletStatus("Failed to switch network."); })}
                    className="lm-btn lm-btn-primary lm-btn-sm text-xs"
                  >
                    Switch Chain
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => disconnect()}
                  className="lm-btn lm-btn-ghost lm-btn-sm text-xs"
                >
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleConnect}
                className="lm-btn w-full text-xs h-8 flex items-center gap-3 justify-center"
              >
                <WalletIcon />
                <SideLabelXs>Connect Wallet</SideLabelXs>
              </button>
              {!hasWallet && (
                <div className="text-[10px] text-lm-red leading-tight lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity">
                  No wallet detected.{" "}
                  <a
                    href="https://metamask.io/download/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-lm-orange"
                  >
                    Install MetaMask
                  </a>
                </div>
              )}
              {walletStatus && (
                <div className="text-[10px] text-lm-red leading-tight lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity">
                  {walletStatus}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Socials ── */}
        <div className="border-t border-lm-terminal-gray px-3 py-3 flex items-center gap-4">
          {SOCIALS.map((s) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="text-lm-terminal-lightgray hover:text-lm-orange transition-colors"
              title={s.label}
            >
              <s.Icon />
            </a>
          ))}
          <span
            className={cn(
              "text-[9px] text-lm-terminal-gray whitespace-nowrap",
              "lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-200"
            )}
          >
            Clutch Labs
          </span>
        </div>
      </aside>
    </>
  );
}
