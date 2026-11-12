import React from 'react';
import { cn } from '../../lib/utils';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ className, count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse bg-canvas-muted rounded-md h-4 w-full',
            className
          )}
          aria-hidden="true"
        />
      ))}
    </>
  );
};

interface LoadingStateProps {
  title?: string;
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading verified records from Neon PostgreSQL...',
  rows = 5,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-5 rounded-xl border border-line-subtle bg-canvas-surface space-y-3',
        className
      )}
      aria-busy="true"
      aria-label={title}
    >
      <div className="flex items-center justify-between">
        <LoadingSkeleton className="h-4 w-48" />
        <LoadingSkeleton className="h-4 w-24" />
      </div>
      <div className="space-y-2.5 pt-2">
        <LoadingSkeleton count={rows} className="h-9" />
      </div>
    </div>
  );
};

