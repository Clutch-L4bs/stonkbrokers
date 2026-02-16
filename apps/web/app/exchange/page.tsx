import React, { Suspense } from "react";
import { TerminalShell } from "../components/Terminal";
import { SwapPanel } from "./swap/SwapPanel";
import { PoolsPanel } from "./pools/PoolsPanel";
import { ExchangeBootstrap } from "./ui/ExchangeBootstrap";

export default function ExchangePage() {
  return (
    <TerminalShell
      title="Stonk Exchange"
      subtitle="Swap any token pair (including native ETH). Create pools and mint LP positions."
    >
      <Suspense fallback={<div className="text-lm-gray text-sm p-4">Loading exchange...</div>}>
        <ExchangeBootstrap SwapPanel={SwapPanel} PoolsPanel={PoolsPanel} />
      </Suspense>
    </TerminalShell>
  );
}
