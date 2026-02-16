import { NextRequest, NextResponse } from "next/server";

// Subdomain routing:
// - stonkbrokers.cash -> /
// - nft.stonkbrokers.cash -> /nft
// - market.stonkbrokers.cash -> /marketplace
// - launch.stonkbrokers.cash -> /launcher
// - exchange.stonkbrokers.cash -> /exchange
// - options.stonkbrokers.cash -> /options
//
// Still supports path routing for local dev.

const SUBDOMAIN_TO_PATH: Record<string, string> = {
  nft: "/nft",
  market: "/marketplace",
  launch: "/launcher",
  exchange: "/exchange",
  options: "/options"
};

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // Ignore localhost/dev hosts.
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    return NextResponse.next();
  }

  const parts = hostname.split(".");
  if (parts.length < 3) return NextResponse.next(); // not a subdomain

  const sub = parts[0];
  const base = SUBDOMAIN_TO_PATH[sub];
  if (!base) return NextResponse.next();

  const url = req.nextUrl.clone();
  // If already on the target base path, do nothing.
  if (url.pathname === base || url.pathname.startsWith(base + "/")) return NextResponse.next();

  url.pathname = base + (url.pathname === "/" ? "" : url.pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"]
};

