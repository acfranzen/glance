'use client';

import { useEffect, useState, useCallback } from 'react';
import { Zap, AlertCircle, RefreshCw, Clock, DollarSign } from 'lucide-react';
import type { Widget } from '@/types/api';

interface ClaudeMaxUsageData {
  session?: {
    percentUsed?: number;
    resetsAt?: string | null;
  };
  weekAll?: {
    percentUsed?: number;
    resetsAt?: string | null;
  };
  weekSonnet?: {
    percentUsed?: number;
    resetsAt?: string | null;
  };
  extra?: {
    spent?: number | string; // Can be number or formatted string like "$165.84 / $200.00"
    limit?: number;
    percentUsed?: number;
    resetsAt?: string | null;
  };
  capturedAt?: string;
  lastUpdated?: string;
  error?: string;
  isDemo?: boolean;
}

interface ClaudeMaxUsageWidgetProps {
  widget?: Widget;
}

/**
 * Safely get a numeric percentage, with fallback
 */
function safePercent(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return Math.max(0, Math.min(value, 100));
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) return Math.max(0, Math.min(parsed, 100));
  }
  return fallback;
}

/**
 * Format the "spent" field which can be:
 * - A number (e.g., 165.84)
 * - A formatted string (e.g., "$165.84 / $200.00")
 * - Undefined/null
 */
function formatSpent(spent: unknown, limit: unknown): string {
  // If spent is already a formatted string, use it directly
  if (typeof spent === 'string' && spent.includes('/')) {
    return spent;
  }
  
  // If spent is a number, format it with limit
  if (typeof spent === 'number' && !isNaN(spent)) {
    const spentStr = `$${spent.toFixed(2)}`;
    if (typeof limit === 'number' && !isNaN(limit)) {
      return `${spentStr} / $${limit.toFixed(2)}`;
    }
    return `${spentStr} spent`;
  }
  
  // If spent is a numeric string
  if (typeof spent === 'string') {
    const parsed = parseFloat(spent.replace(/[$,]/g, ''));
    if (!isNaN(parsed)) {
      const spentStr = `$${parsed.toFixed(2)}`;
      if (typeof limit === 'number' && !isNaN(limit)) {
        return `${spentStr} / $${limit.toFixed(2)}`;
      }
      return `${spentStr} spent`;
    }
  }
  
  // Fallback
  return '—';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ClaudeMaxUsageWidget({ widget }: ClaudeMaxUsageWidgetProps) {
  const [data, setData] = useState<ClaudeMaxUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else if (!data) setLoading(true); // Only show loading on initial fetch

    try {
      const url = forceRefresh 
        ? '/api/widgets/claude-max/data?refresh=true'
        : '/api/widgets/claude-max/data';
      
      const response = await fetch(url);
      if (response.ok) {
        const usageData = await response.json();
        // Only update state if data actually changed (check capturedAt)
        setData(prev => {
          if (prev?.capturedAt === usageData?.capturedAt) return prev;
          return usageData;
        });
      }
    } catch (error) {
      console.error('Failed to fetch Claude Max usage:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    fetchData();
    // Poll every 30 seconds - it's just a cache read, cheap operation
    // Widget will only re-render if data actually changed
    const interval = setInterval(() => fetchData(false), 30 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <Zap className="w-8 h-8 text-blue-500/50" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (data?.error && !data?.capturedAt) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <div className="text-sm text-center text-muted-foreground">
          {data.error}
        </div>
        <button
          onClick={() => fetchData(true)}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground">No data available</span>
      </div>
    );
  }

  const getProgressColor = (percent: number) => {
    if (percent > 90) return 'bg-red-500';
    if (percent > 75) return 'bg-amber-500';
    if (percent > 50) return 'bg-blue-500';
    return 'bg-emerald-500';
  };

  const formatTimestamp = (isoString: string | undefined | null) => {
    if (!isoString) return 'unknown';
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'unknown';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return date.toLocaleDateString();
    } catch {
      return 'unknown';
    }
  };

  // Safely extract percentages with fallbacks
  const sessionPercent = safePercent(data.session?.percentUsed);
  const weekAllPercent = safePercent(data.weekAll?.percentUsed);
  const weekSonnetPercent = safePercent(data.weekSonnet?.percentUsed);
  const extraPercent = safePercent(data.extra?.percentUsed);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-medium text-muted-foreground">Claude Max</span>
          {data.isDemo && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-500 rounded font-medium">
              DEMO
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh usage data"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Usage sections */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {/* Session usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Current Session</span>
            </div>
            <span className="text-xs font-semibold text-foreground">
              {sessionPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(sessionPercent)} transition-all duration-500`}
              style={{ width: `${sessionPercent}%` }}
            />
          </div>
          {data.session?.resetsAt && (
            <div className="text-[10px] text-muted-foreground">
              Resets at {data.session.resetsAt}
            </div>
          )}
        </div>

        {/* Weekly (all models) usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Week (All Models)</span>
            <span className="text-xs font-semibold text-foreground">
              {weekAllPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(weekAllPercent)} transition-all duration-500`}
              style={{ width: `${weekAllPercent}%` }}
            />
          </div>
          {data.weekAll?.resetsAt && (
            <div className="text-[10px] text-muted-foreground">
              Resets {data.weekAll.resetsAt}
            </div>
          )}
        </div>

        {/* Weekly (Sonnet) usage */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Week (Sonnet)</span>
            <span className="text-xs font-semibold text-foreground">
              {weekSonnetPercent}%
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(weekSonnetPercent)} transition-all duration-500`}
              style={{ width: `${weekSonnetPercent}%` }}
            />
          </div>
          {data.weekSonnet?.resetsAt && (
            <div className="text-[10px] text-muted-foreground">
              Resets {data.weekSonnet.resetsAt}
            </div>
          )}
        </div>

        {/* Extra usage */}
        {data.extra && (
          <div className="space-y-1 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Extra Usage</span>
              </div>
              <span className="text-xs font-semibold text-foreground">
                {extraPercent}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor(extraPercent)} transition-all duration-500`}
                style={{ width: `${extraPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {formatSpent(data.extra.spent, data.extra.limit)}
              {data.extra.resetsAt && ` · Resets ${data.extra.resetsAt}`}
            </div>
          </div>
        )}
      </div>

      {/* Last updated timestamp */}
      <div className="text-[10px] text-muted-foreground/60 text-center">
        Updated {formatTimestamp(data.capturedAt)}
      </div>
    </div>
  );
}
