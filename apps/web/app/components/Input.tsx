"use client";

import React, { ChangeEvent } from "react";
import { twMerge } from "tailwind-merge";

const numericRegex = /^-?\d*(?:\.\d*)?$/;

type Props = {
  disabled?: boolean;
  value?: string | number;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** When false, accepts any text (addresses, URIs, names). Default true. */
  numeric?: boolean;
  /** Optional label displayed above the input */
  label?: string;
  /** Error message — shows red border + message */
  error?: string;
  /** Hint text below input */
  hint?: string;
  /** Right-side suffix element (e.g. token symbol, unit) */
  suffix?: React.ReactNode;
};

export function Input({
  value = "",
  onValueChange,
  placeholder,
  disabled,
  className,
  numeric = true,
  label,
  error,
  hint,
  suffix,
}: Props) {
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    if (!onValueChange) return;
    if (!numeric) {
      onValueChange(e.target.value);
      return;
    }
    let next = e.target.value.replace(/,/g, ".");
    if (next === ".") next = "0.";
    if (next === "-") { onValueChange(next); return; }
    if (next === "" || numericRegex.test(next)) {
      onValueChange(next);
    }
  }

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-[10px] text-lm-terminal-lightgray lm-upper font-bold tracking-wider block">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          disabled={disabled}
          type="text"
          inputMode={numeric ? "decimal" : "text"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={twMerge(
            "lm-input",
            numeric ? "text-right" : "text-left",
            error && "lm-input-error",
            suffix && "pr-12",
            className
          )}
        />
        {suffix && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-lm-terminal-lightgray text-xs lm-mono pointer-events-none">
            {suffix}
          </div>
        )}
      </div>
      {error && (
        <div className="text-lm-red text-[10px] flex items-center gap-1">
          <span className="lm-dot lm-dot-red flex-shrink-0" style={{ width: 4, height: 4 }} />
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="text-lm-terminal-lightgray text-[10px]">{hint}</div>
      )}
    </div>
  );
}
