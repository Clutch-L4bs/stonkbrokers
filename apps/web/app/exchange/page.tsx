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
      <ExchangeBootstrap SwapPanel={SwapPanel} PoolsPanel={PoolsPanel} />
    </TerminalShell>
  );
}
