"use client";

import React, { useState } from "react";
import { Button } from "./Button";
import { useWallet } from "../wallet/WalletProvider";
import { config } from "../lib/config";

export function ConnectWallet() {
  const { address, chainId, connect, disconnect, switchToRobinhood } = useWallet();
  const isConnected = Boolean(address);
  const okChain = chainId ? chainId === config.chainId : false;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConnect() {
    setBusy(true);
    setError("");
    try {
      await connect();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes("rejected") && !msg.includes("denied")) {
        setError("Failed to connect wallet.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitch() {
    setBusy(true);
    setError("");
    try {
      await switchToRobinhood();
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (!msg.includes("rejected") && !msg.includes("denied")) {
        setError("Failed to switch network.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-lm-gray text-sm">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
        {!okChain ? (
          <Button variant="primary" onClick={handleSwitch} loading={busy} disabled={busy}>
            Switch Network
          </Button>
        ) : null}
        <Button variant="ghost" onClick={() => disconnect()}>
          Disconnect
        </Button>
        {error && <span className="text-lm-red text-xs">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={handleConnect} loading={busy} disabled={busy} className="text-lm-orange">
        Connect Wallet
      </Button>
      {error && <span className="text-lm-red text-xs">{error}</span>}
    </div>
  );
}
