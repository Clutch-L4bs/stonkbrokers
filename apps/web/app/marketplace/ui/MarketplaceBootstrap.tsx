"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Panel } from "../../components/Terminal";
import { TerminalTabs } from "../../components/Tabs";
import { FeedTab, ListTab, SwapTab, MyActivityTab } from "./MarketplacePanel";
import { IntentTerminal, IntentAction } from "../../components/IntentTerminal";

export function MarketplaceBootstrap({ MarketplacePanel }: { MarketplacePanel: React.ComponentType }) {
  const tabs = useMemo(
    () => [
      { id: "feed", label: "Browse", hint: "Active listings + swap offers" },
      { id: "list", label: "Sell", hint: "List broker for ETH" },
      { id: "swap", label: "Swap", hint: "Trade broker for broker" },
      { id: "activity", label: "My Activity", hint: "Manage your listings + swaps" }
    ],
    []
  );
  const [active, setActive] = useState("feed");

  const handleIntent = useCallback((intent: IntentAction) => {
    if (intent.type === "buy_listing" || intent.type === "accept_swap") setActive("feed");
    else if (intent.type === "list_nft") setActive("list");
    else if (intent.type === "create_swap_offer") setActive("swap");
    else if (intent.type === "cancel_listing" || intent.type === "cancel_swap") setActive("activity");
    else if (intent.type === "switch_tab") {
      const map: Record<string, string> = { browse: "feed", sell: "list", swap: "swap", activity: "activity" };
      if (map[intent.tab]) setActive(map[intent.tab]);
    }
  }, []);

  return (
    <div className="space-y-4">
      <IntentTerminal
        context="marketplace"
        onIntent={handleIntent}
        placeholder="list broker #10 for 0.5 ETH · buy listing #3 · swap broker #10 for #20 · help"
      />
      <Panel
        title="Marketplace"
        hint="On-chain escrow marketplace. NFTs are secured in the contract until sold, swapped, or cancelled."
        right={<TerminalTabs tabs={tabs} active={active} onChange={setActive} />}
      >
        {active === "feed" ? <FeedTab /> : null}
        {active === "list" ? <ListTab /> : null}
        {active === "swap" ? <SwapTab /> : null}
        {active === "activity" ? <MyActivityTab /> : null}
      </Panel>
    </div>
  );
}
