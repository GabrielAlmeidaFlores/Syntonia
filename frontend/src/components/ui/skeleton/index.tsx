import * as React from "react";

import { cn } from "@/lib/utils";

/** Animated shimmer placeholder block styled for the dark theme. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-surface-elevated shimmer-base",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
