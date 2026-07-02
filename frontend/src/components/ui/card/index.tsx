import * as React from 'react';

import { cn } from '@/lib/utils';

/** Card container with dark-theme surface background and border. */
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn('rounded-xl border border-surface-border bg-surface-card shadow-card', className)}
      {...props}
    />
  );
}

/** Padded header section within a Card. */
function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

/** Title element inside a CardHeader. */
function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={cn('text-base font-semibold leading-none text-white', className)} {...props} />
  );
}

/** Muted description text inside a CardHeader. */
function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-sm text-gray-400', className)} {...props} />;
}

/** Main content area within a Card, with top padding removed. */
function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}

/** Footer row within a Card, aligned and padded. */
function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex items-center p-6 pt-0', className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
