"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "./cn";

export type Tab = { id: string; label: string; hint?: string; badge?: string | number };

export function TerminalTabs({
  tabs,
  active,
  onChange
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.id === active);
    let next = idx;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = (idx + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = (idx - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      next = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      next = tabs.length - 1;
    }
    if (next !== idx) {
      onChange(tabs[next].id);
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
      buttons?.[next]?.focus();
    }
  }, [tabs, active, onChange]);

  return (
    <div
      ref={tabListRef}
      className="flex flex-wrap gap-1.5"
      role="tablist"
      aria-label="Sections"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${t.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "lm-tab",
              isActive && "lm-tab-active"
            )}
            title={t.hint || t.label}
          >
            <span className="flex items-center gap-1.5">
              {t.label}
              {t.badge !== undefined && (
                <span className={cn(
                  "text-[9px] px-1 py-px border leading-none",
                  isActive ? "border-lm-orange/40 text-lm-orange" : "border-lm-terminal-gray text-lm-terminal-lightgray"
                )}>
                  {t.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
