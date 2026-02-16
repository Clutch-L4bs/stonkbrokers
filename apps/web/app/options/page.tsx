import { TerminalShell } from "../components/Terminal";
import { OptionsPanel } from "./ui/OptionsPanel";
import { OptionsBootstrap } from "./ui/OptionsBootstrap";

export default function OptionsPage() {
  return (
    <TerminalShell
      title="Options"
      subtitle="Covered calls with TWAP ITM checks. Each purchased option is an ERC-721 position NFT."
    >
      <OptionsBootstrap OptionsPanel={OptionsPanel} />
    </TerminalShell>
  );
}
