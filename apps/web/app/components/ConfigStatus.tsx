"use client";

import React, { useMemo, useState } from "react";
import { config } from "../lib/config";
import { Panel } from "./Terminal";
import { Button } from "./Button";

type Item = { key: string; value: string; required?: boolean };

export function ConfigStatus() {
  const [open, setOpen] = useState(false);

  const items: Item[] = useMemo(
    () => [
      { key: "RPC", value: config.rpcUrl, required: true },
      { key: "CHAIN_ID", value: String(config.chainId), required: true },
      { key: "TOKEN_REGISTRY", value: config.tokenRegistry || "-", required: true },
      { key: "LAUNCHER_FACTORY", value: config.launcherFactory || "-", required: true },
      { key: "V3_FACTORY", value: config.uniFactory || "-", required: true },
      { key: "ROUTER", value: config.swapRouter || "-", required: true },
      { key: "QUOTER_V2", value: config.quoterV2 || "-", required: true },
      { key: "POSITION_MANAGER", value: config.positionManager || "-", required: true },
      { key: "OPTIONS_VAULT", value: config.coveredCallVault || "-", required: false },
      { key: "ORIGINAL_NFT", value: config.originalNft || "-", required: false },
      { key: "LEGACY_EXPANDED_NFT", value: config.legacyExpandedNft || "-", required: false },
      { key: "EXPANDED_NFT", value: config.expandedNft || "-", required: false },
      { key: "MARKETPLACE", value: config.marketplace || "-", required: false }
    ],
    []
  );

  const missingRequired = items.filter((i) => i.required && (!i.value || i.value === "-"));

  return (
    <div>
      <Button
        className={missingRequired.length ? "text-lm-red" : "text-lm-orange"}
        onClick={() => setOpen((v) => !v)}
      >
        {missingRequired.length ? `CONFIG MISSING (${missingRequired.length})` : "CONFIG OK"}
      </Button>
      {open ? (
        <div className="mt-3">
          <Panel title="Runtime Config" hint="These values come from NEXT_PUBLIC_* env vars.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {items.map((i) => (
                <div
                  key={i.key}
                  className="border border-lm-terminal-gray bg-lm-black p-2"
                >
                  <div className="text-lm-terminal-lightgray">{i.key}</div>
                  <div className={i.required && (i.value === "-" || !i.value) ? "text-lm-red break-all" : "text-white break-all"}>
                    {i.value || "-"}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

