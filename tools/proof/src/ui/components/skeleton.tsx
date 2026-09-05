import { cn } from '../lib/utils';

/**
 * A gray pulsing placeholder shown in place of content that hasn't finished loading yet.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
