import * as React from "react";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  /** Visual size. Defaults to 'md' (h-6 w-6). */
  readonly size?: "sm" | "md" | "lg";
  readonly className?: string;
}

const SIZE_MAP: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * Decorative loading spinner using the design system accent token.
 * Aria-hidden by default — the surrounding context conveys the loading state.
 */
export function Spinner({
  size = "md",
  className,
}: SpinnerProps): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-spin rounded-full border-2 border-surface-elevated border-t-accent",
        SIZE_MAP[size],
        className,
      )}
    />
  );
}
