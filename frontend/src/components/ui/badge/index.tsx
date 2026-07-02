import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-surface-elevated text-gray-200',
        accent: 'border-transparent bg-accent-muted text-accent-light',
        outline: 'border-surface-border text-gray-300 bg-transparent',
        success: 'border-green-800 bg-green-950 text-green-400',
        warning: 'border-amber-800 bg-amber-950 text-amber-400',
        destructive: 'border-red-800 bg-red-950 text-red-400',
        tag: 'border-surface-border bg-surface-elevated text-gray-300 hover:border-accent hover:text-accent-light cursor-pointer transition-colors',
        'tag-active': 'border-accent bg-accent-muted text-accent-light cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 *
 */
/** Status and tag badge with multiple visual variants. */
function Badge({ className, variant, ...props }: BadgeProps): React.JSX.Element {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
export type { BadgeProps };
