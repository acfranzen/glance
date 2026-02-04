'use client';

import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export type FreshnessStatus = 'fresh' | 'stale' | 'expired' | null;

interface WidgetRefreshFooterProps {
  fetchedAt: string | null;
  freshness: FreshnessStatus;
}

export function WidgetRefreshFooter({ fetchedAt, freshness }: WidgetRefreshFooterProps) {
  if (!fetchedAt) {
    return null;
  }

  const timeAgo = formatDistanceToNow(new Date(fetchedAt), { addSuffix: true });

  // Freshness indicator colors
  const freshnessColors: Record<string, string> = {
    fresh: 'bg-green-500',
    stale: 'bg-yellow-500',
    expired: 'bg-red-500',
  };

  const freshnessColor = freshness ? freshnessColors[freshness] : 'bg-muted-foreground';

  return (
    <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-border/50">
      <span
        className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', freshnessColor)}
        title={freshness ? `Data is ${freshness}` : 'Unknown freshness'}
      />
      <span className="text-[10px] text-muted-foreground truncate">
        Updated {timeAgo}
      </span>
    </div>
  );
}
