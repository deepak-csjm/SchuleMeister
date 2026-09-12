import type * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-4 sm:p-5', className)} {...props} />;
}

/**
 * Renders an `<h2>` by default. Pass `as="h1"` when the card *is* the page's
 * main subject (the sign-in screens, for example) - a page with no level-1
 * heading leaves screen reader users without an entry point.
 */
export function CardTitle({
  className,
  as: Component = 'h2',
  ...props
}: React.ComponentProps<'h2'> & { as?: 'h1' | 'h2' | 'h3' }) {
  return (
    <Component className={cn('text-lg font-semibold leading-snug tracking-tight', className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 p-4 pt-0 sm:p-5 sm:pt-0', className)} {...props} />
  );
}
