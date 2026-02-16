import { TerminalShell } from "../components/Terminal";
import { MarketplacePanel } from "./ui/MarketplacePanel";
import { MarketplaceBootstrap } from "./ui/MarketplaceBootstrap";

export default function MarketplacePage() {
  return (
    <TerminalShell
      title="Marketplace"
      subtitle="On-chain listings and swap offers. Feed loads without wallet."
    >
      <MarketplaceBootstrap MarketplacePanel={MarketplacePanel} />
    </TerminalShell>
  );
}
