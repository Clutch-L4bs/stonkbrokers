import Link from "next/link";
import { LaunchView } from "./ui/LaunchView";

export default async function LaunchPage({ params }: { params: Promise<{ launch: string }> }) {
  const { launch } = await params;
  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="bg-lm-terminal-darkgray border border-lm-terminal-gray p-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-white font-bold text-sm">Launch Terminal</div>
          <div className="text-lm-terminal-lightgray text-xs lm-mono lm-break">{launch}</div>
        </div>
        <Link href="/launcher" className="text-xs px-3 py-1 border border-lm-orange text-lm-orange hover:bg-lm-orange/5 transition-colors">
          ← All Launches
        </Link>
      </div>
      <LaunchView launch={launch} />
    </div>
  );
}
