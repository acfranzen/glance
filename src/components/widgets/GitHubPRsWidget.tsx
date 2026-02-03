'use client';

import { useEffect, useState, useCallback } from 'react';
import { GitPullRequest, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import type { Widget } from '@/types/api';

interface PullRequest {
  number: number;
  title: string;
  author: string;
  repo: string;
  url: string;
  createdAt: string;
  state: string;
}

interface GitHubPRsData {
  prs: PullRequest[];
  totalCount: number;
  fetchedAt: string;
  fromCache?: boolean;
  error?: string;
}

interface GitHubPRsWidgetProps {
  widget?: Widget;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function GitHubPRsWidget({ widget }: GitHubPRsWidgetProps) {
  const [data, setData] = useState<GitHubPRsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading((prev) => prev); // Don't change loading if already set

    try {
      const url = forceRefresh
        ? '/api/widgets/github-prs/data?refresh=true'
        : '/api/widgets/github-prs/data';

      const response = await fetch(url);
      if (response.ok) {
        const prData = await response.json();
        // Only update if data actually changed (compare fetchedAt)
        setData((prev) => {
          if (prev?.fetchedAt === prData.fetchedAt) return prev;
          return prData;
        });
      }
    } catch (error) {
      console.error('Failed to fetch PRs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []); // No dependencies - stable callback

  useEffect(() => {
    setLoading(true);
    fetchData();
    // Poll every 5 minutes
    const interval = setInterval(() => fetchData(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /**
   * Truncate text with ellipsis
   */
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
  };

  /**
   * Get repo color badge
   */
  const getRepoColor = (repo: string): string => {
    if (repo === 'libra') return 'bg-purple-500/20 text-purple-500';
    if (repo === 'glance') return 'bg-blue-500/20 text-blue-500';
    return 'bg-gray-500/20 text-gray-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <GitPullRequest className="w-8 h-8 text-purple-500/50" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (data?.error && data.prs.length === 0) {
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

  if (!data || data.prs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <GitPullRequest className="w-8 h-8 text-emerald-500" />
        <span className="text-sm text-muted-foreground">No open PRs! 🎉</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-medium text-muted-foreground">GitHub PRs</span>
          {data.totalCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-500 rounded-full font-medium">
              {data.totalCount}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh PRs"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* PR list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {data.prs.map((pr) => (
          <a
            key={`${pr.repo}-${pr.number}`}
            href={pr.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 rounded-md hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getRepoColor(pr.repo)}`}>
                    {pr.repo}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70">
                    #{pr.number}
                  </span>
                </div>
                <div className="text-xs font-medium text-foreground truncate">
                  {truncate(pr.title, 50)}
                </div>
                <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                  by {pr.author} · {pr.createdAt}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                <ExternalLink className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      {data.error && (
        <div className="text-[10px] text-amber-500 text-center mt-2">
          ⚠️ {data.error}
        </div>
      )}
    </div>
  );
}
