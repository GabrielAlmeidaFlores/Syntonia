import * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Full-height skeleton card displayed at the end of the feed while JIT generation runs.
 * Mimics the visual structure of a PostCard to avoid layout shift.
 */
export function LoadingSkeleton(): React.JSX.Element {
  return (
    <div className="snap-card relative flex-shrink-0 flex flex-col justify-end p-6">
      <div className="absolute inset-0 bg-surface-elevated animate-pulse" />
      <div className="relative flex flex-col gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-3/4" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="mt-2 h-3 w-32" />
      </div>
    </div>
  );
}
