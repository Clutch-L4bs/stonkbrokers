"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./cn";
import { ConnectWallet } from "./ConnectWallet";
import { useWallet } from "../wallet/WalletProvider";
import { config } from "../lib/config";

const links = [
  { href: "/", label: "Home" },
  { href: "/nft", label: "NFT" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/launcher", label: "Launcher" },
  { href: "/exchange", label: "Exchange" },
  { href: "/options", label: "Options" }
];

export function TopNav() {
  const pathname = usePathname();
  const { chainId } = useWallet();
  const okChain = chainId ? chainId === config.chainId : false;
  return (
    <div className="relative z-10 w-full border-b-4 border-lm-orange border-dashed bg-[rgba(17,17,17,0.75)] backdrop-blur">
      <div className="p-4 max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="border-2 border-lm-orange border-dashed px-2 py-1 bg-lm-terminal-darkgray">
            <span className="text-lm-orange text-base font-bold">STONK</span>{" "}
            <span className="text-white text-base font-bold">BROKERS</span>
          </div>
          <div className="text-xs text-lm-gray">
            CHAIN {config.chainId}{" "}
            <span className={cn("ml-2", okChain ? "text-lm-green" : "text-lm-red")}>
              {chainId ? (okChain ? "OK" : "WRONG") : "DISCONNECTED"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-2 gap-y-2 text-sm items-center">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "lm-tab",
              pathname === l.href && "lm-tab-active"
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>
        <ConnectWallet />
      </div>
    </div>
  );
}

