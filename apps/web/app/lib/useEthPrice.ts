"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
const CACHE_KEY = "stonk.ethUsdPrice";
const CACHE_TTL_MS = 60_000;
const FALLBACK_PRICE = 2500;

type CachedPrice = { usd: number; ts: number };

function readCache(): CachedPrice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPrice;
    if (typeof parsed.usd !== "number" || typeof parsed.ts !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(usd: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ usd, ts: Date.now() }));
  } catch { /* best-effort */ }
}

let globalPrice = FALLBACK_PRICE;
let globalFetching = false;
let globalLastFetch = 0;
const listeners = new Set<(p: number) => void>();

async function fetchPrice() {
  if (globalFetching) return;
  if (Date.now() - globalLastFetch < CACHE_TTL_MS) return;

  globalFetching = true;
  try {
    const cached = readCache();
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      globalPrice = cached.usd;
      globalLastFetch = cached.ts;
      listeners.forEach((fn) => fn(globalPrice));
      return;
    }

    const res = await fetch(COINGECKO_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const usd = data?.ethereum?.usd;
    if (typeof usd === "number" && usd > 0) {
      globalPrice = usd;
      globalLastFetch = Date.now();
      writeCache(usd);
      listeners.forEach((fn) => fn(globalPrice));
    }
  } catch {
    const cached = readCache();
    if (cached && cached.usd > 0) {
      globalPrice = cached.usd;
    }
  } finally {
    globalFetching = false;
  }
}

/**
 * React hook returning the current ETH/USD price.
 * Fetches from CoinGecko, caches in localStorage for 60s,
 * falls back to 2500 if offline. All component instances
 * share a single fetch (deduped via module-level state).
 */
export function useEthPrice(): number {
  const [price, setPrice] = useState(globalPrice);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const handler = (p: number) => { if (mounted.current) setPrice(p); };
    listeners.add(handler);
    fetchPrice();
    const iv = setInterval(fetchPrice, CACHE_TTL_MS);
    return () => {
      mounted.current = false;
      listeners.delete(handler);
      clearInterval(iv);
    };
  }, []);

  return price;
}

/**
 * Format a USD value cleanly with subscript notation for tiny amounts.
 */
export function fmtUsd(usd: number): string {
  if (!usd || !Number.isFinite(usd) || usd <= 0) return "—";
  if (usd >= 1e12) return `$${(usd / 1e12).toFixed(2)}T`;
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  if (usd >= 0.0001) return `$${usd.toFixed(6)}`;
  const s = usd.toFixed(20);
  const match = s.match(/^0\.(0+)(\d{2,4})/);
  if (match) {
    const zeros = match[1].length;
    const sig = match[2].replace(/0+$/, "") || match[2].slice(0, 2);
    const sub = String(zeros).split("").map((d: string) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)]).join("");
    return `$0.0${sub}${sig}`;
  }
  return `$${usd.toFixed(8)}`;
}

/**
 * Convert an ETH amount to a formatted USD string.
 */
export function ethToUsd(ethAmount: number, ethUsd: number): string {
  return fmtUsd(ethAmount * ethUsd);
}

/**
 * Inline USD tag: returns a short string like "≈ $1,234.56"
 * for use next to ETH values.
 */
export function usdTag(ethAmount: number, ethUsd: number): string {
  const usd = ethAmount * ethUsd;
  if (!usd || !Number.isFinite(usd) || usd <= 0) return "";
  return `≈ ${fmtUsd(usd)}`;
}
