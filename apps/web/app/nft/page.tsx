import { TerminalShell } from "../components/Terminal";
import { NftPanel } from "./ui/NftPanel";
import { NftBootstrap } from "./ui/NftBootstrap";

export default function NftPage() {
  return (
    <TerminalShell
      title="NFT Collection"
      subtitle="Mint from the expanded collection. View brokers across all collections."
    >
      <NftBootstrap NftPanel={NftPanel} />
    </TerminalShell>
  );
}
