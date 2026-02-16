import { TerminalShell } from "../components/Terminal";
import { LauncherPanel } from "./ui/LauncherPanel";
import { LauncherBootstrap } from "./ui/LauncherBootstrap";

export default function LauncherPage() {
  return (
    <TerminalShell
      title="Stonk Launcher"
      subtitle="Launch meme coins with IPFS metadata, Uniswap v3 LP, fee splitting, and staking yield."
    >
      <LauncherBootstrap LauncherPanel={LauncherPanel} />
    </TerminalShell>
  );
}
