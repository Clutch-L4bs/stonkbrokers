import React from "react";
import { cn } from "./cn";

export function TerminalShell({
  title,
  subtitle,
  right,
  children,
  className
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative z-10 p-4 md:p-6", className)}>
      <div className="max-w-6xl mx-auto space-y-4">
        <div
          className="bg-lm-terminal-darkgray border-4 border-lm-orange border-dashed p-4"
          style={{ boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="text-white font-bold text-xl md:text-2xl lm-upper">
                {title}
                <span className="caret" aria-hidden="true" />
              </div>
              {subtitle ? <div className="text-lm-gray text-sm mt-1.5">{subtitle}</div> : null}
            </div>
            {/* On mobile, stack/wrap "right" controls to avoid overflow. */}
            {right ? (
              <div className="w-full sm:w-auto max-w-full min-w-0 flex justify-start sm:justify-end">
                {right}
              </div>
            ) : null}
          </div>
        </div>
        {children}
        <div className="text-[10px] text-lm-terminal-lightgray border-t border-lm-terminal-gray pt-3 flex items-center justify-between">
          <span className="lm-upper tracking-wider">Stonkbrokers.cash · Robinhood Testnet</span>
          <span className="flex items-center gap-1.5">
            <span className="lm-dot lm-dot-green lm-dot-pulse" style={{ width: 5, height: 5 }} />
            <span className="lm-upper tracking-wider">Online</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function Panel({
  title,
  hint,
  right,
  children
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lm-panel">
      <div className="lm-panel-header">
        <div className="min-w-0">
          <div className="lm-panel-title">{title}</div>
          {hint ? <div className="lm-panel-hint">{hint}</div> : null}
        </div>
        {/* On mobile, let header controls wrap within panel border. */}
        {right ? (
          <div className="w-full sm:w-auto max-w-full min-w-0 flex justify-start sm:justify-end">
            {right}
          </div>
        ) : null}
      </div>
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}
