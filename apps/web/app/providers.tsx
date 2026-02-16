"use client";

import React from "react";
import { createPublicClient, http, defineChain } from "viem";
import { config as appConfig } from "./lib/config";
import { WalletProvider } from "./wallet/WalletProvider";

export const robinhoodTestnet = defineChain({
  id: appConfig.chainId,
  name: "Robinhood Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [appConfig.rpcUrl] } }
});

export const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(appConfig.rpcUrl)
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}

