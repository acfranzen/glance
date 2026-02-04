'use client';

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export type FreshnessStatus = 'fresh' | 'stale' | 'expired' | null;

interface WidgetRefreshFooterProps {
  fetchedAt: string | null;
  freshness: FreshnessStatus;
  queuedAt?: string | null;
}

export function WidgetRefreshFooter({ fetchedAt, freshness, queuedAt }: WidgetRefreshFooterProps) {
  // Show queued state even without fetchedAt
  if (!fetchedAt && !queuedAt) {
    return null;
  }

  const timeAgo = fetchedAt ? formatDistanceToNow(new Date(fetchedAt), { addSuffix: true }) : null;
  const queuedTimeAgo = queuedAt ? formatDistanceToNow(new Date(queuedAt), { addSuffix: true }) : null;

  // Freshness indicator colors
  const freshnessColors: Record<string, string> = {
    fresh: 'bg-green-500',
    stale: 'bg-yellow-500',
    expired: 'bg-red-500',
  };

  const freshnessColor = freshness ? freshnessColors[freshness] : 'bg-muted-foreground';

  return (
    <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-border/50">
      {/* Freshness indicator for last update */}
      <span
        className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', freshnessColor)}
        title={freshness ? `Data is ${freshness}` : 'Unknown freshness'}
      />
      <span className="text-[10px] text-muted-foreground truncate">
        {fetchedAt ? <>Updated {timeAgo}</> : <>No data yet</>}
      </span>

      {/* Queued refresh indicator */}
      {queuedAt && (
        <>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-yellow-500 animate-pulse"
            title="Refresh queued"
          />
          <span className="text-[10px] text-yellow-600 dark:text-yellow-500 truncate">
            Refreshing... (queued {queuedTimeAgo})
          </span>
        </>
      )}
    </div>
  );
}
