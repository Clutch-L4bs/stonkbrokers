"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Address, createWalletClient, custom, WalletClient } from "viem";
import { robinhoodTestnet } from "../providers";
import { config } from "../lib/config";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: {
    (event: "accountsChanged", listener: (accounts: string[]) => void): void;
    (event: "chainChanged", listener: (chainIdHex: string) => void): void;
    (event: string, listener: (...args: unknown[]) => void): void;
  };
  removeListener?: {
    (event: "accountsChanged", listener: (accounts: string[]) => void): void;
    (event: "chainChanged", listener: (chainIdHex: string) => void): void;
    (event: string, listener: (...args: unknown[]) => void): void;
  };
};

type WalletState = {
  address?: Address;
  chainId?: number;
  walletClient?: WalletClient;
  ethereum?: Eip1193Provider;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToRobinhood: () => Promise<void>;
  requireCorrectChain: () => Promise<void>;
};

const Ctx = createContext<WalletState | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<Address | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [ethereum, setEthereum] = useState<Eip1193Provider | undefined>(undefined);

  // Detect window.ethereum on mount + retry once (some wallets inject late)
  useEffect(() => {
    function detect() {
      if (typeof window !== "undefined") {
        // Some wallet extensions (or multiple providers fighting) can leave a throwing getter
        // on `window.ethereum`. Never let that crash hydration.
        try {
          const eth = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
          if (eth) { setEthereum(eth); return true; }
        } catch {
          return false;
        }
      }
      return false;
    }
    if (detect()) return;
    // Retry after a short delay for wallets that inject asynchronously
    const t = setTimeout(() => { detect(); }, 500);
    return () => clearTimeout(t);
  }, []);

  const walletClient = useMemo(() => {
    if (!ethereum) return undefined;
    return createWalletClient({
      chain: robinhoodTestnet,
      transport: custom(ethereum)
    });
  }, [ethereum]);

  const refresh = useCallback(async () => {
    if (!ethereum) return;
    const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
    const cidHex = (await ethereum.request({ method: "eth_chainId" })) as string;
    setChainId(Number.parseInt(cidHex, 16));
    setAddress(accounts?.[0] ? (accounts[0] as Address) : undefined);
  }, [ethereum]);

  const connect = useCallback(async () => {
    if (!ethereum) {
      throw new Error("No wallet detected. Install MetaMask or another browser wallet.");
    }
    await ethereum.request({ method: "eth_requestAccounts" });
    await refresh();
  }, [ethereum, refresh]);

  const switchToRobinhood = useCallback(async () => {
    if (!ethereum) throw new Error("No wallet detected.");
    const hexChainId = `0x${config.chainId.toString(16)}`;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }]
      });
    } catch (e: any) {
      if (e?.code !== 4902) throw e;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexChainId,
            chainName: "Robinhood Testnet",
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [config.rpcUrl],
            blockExplorerUrls: [config.blockExplorerUrl]
          }
        ]
      });
    } finally {
      await refresh();
    }
  }, [ethereum, refresh]);

  const disconnect = useCallback(() => {
    setAddress(undefined);
  }, []);

  // Listen for account/chain changes
  useEffect(() => {
    if (!ethereum) return;
    refresh().catch(() => {});
    if (!ethereum.on) return;

    const onAccounts = (accs: string[]) => setAddress(accs?.[0] ? (accs[0] as Address) : undefined);
    const onChain = (cidHex: string) => setChainId(Number.parseInt(cidHex, 16));
    ethereum.on("accountsChanged", onAccounts);
    ethereum.on("chainChanged", onChain);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccounts);
      ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [ethereum, refresh]);

  const value: WalletState = {
    address,
    chainId,
    walletClient,
    ethereum,
    hasWallet: Boolean(ethereum),
    connect,
    disconnect,
    switchToRobinhood,
    requireCorrectChain: async () => {
      if (!ethereum) throw new Error("No wallet detected.");
      if (chainId && chainId === config.chainId) return;
      await switchToRobinhood();
    }
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used within WalletProvider");
  return v;
}
