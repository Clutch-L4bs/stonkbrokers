"use client";

import React, { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { twMerge } from "tailwind-merge";

type Variant = "default" | "primary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  loading?: boolean;
  variant?: Variant;
  size?: Size;
};

const variantClass: Record<Variant, string> = {
  default: "",
  primary: "lm-btn-primary",
  ghost: "lm-btn-ghost",
  danger: "lm-btn-danger",
};

const sizeClass: Record<Size, string> = {
  sm: "lm-btn-sm",
  md: "",
  lg: "lm-btn-lg",
};

export function Button({ className, loading, variant = "default", size = "md", children, disabled, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={twMerge(
        "lm-btn",
        variantClass[variant],
        sizeClass[size],
        className
      )}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="lm-spinner" aria-hidden="true" />
          <span>{children}</span>
        </span>
      ) : children}
    </button>
  );
}
