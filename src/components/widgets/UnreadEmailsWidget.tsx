'use client';

import { useEffect, useState, useCallback } from 'react';
import { Mail, RefreshCw, AlertCircle, ExternalLink } from 'lucide-react';
import type { Widget } from '@/types/api';

interface EmailItem {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  labels: string[];
  url: string;
  summary?: string;
}

interface UnreadEmailsData {
  emails: EmailItem[];
  fetchedAt: string;
  fromCache?: boolean;
  error?: string;
}

interface UnreadEmailsWidgetProps {
  widget?: Widget;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function UnreadEmailsWidget({ widget }: UnreadEmailsWidgetProps) {
  const [data, setData] = useState<UnreadEmailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else if (!data) setLoading(true);

    try {
      const url = forceRefresh
        ? '/api/widgets/unread-emails/data?refresh=true'
        : '/api/widgets/unread-emails/data';

      const response = await fetch(url);
      if (response.ok) {
        const emailData = await response.json();
        setData(emailData);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    fetchData();
    // Poll every 2 minutes
    const interval = setInterval(() => fetchData(false), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /**
   * Format date to relative time (e.g., "2h ago", "Yesterday")
   */
  const formatRelativeTime = (dateStr: string): string => {
    try {
      // Parse "2026-02-01 23:51" format
      const [datePart, timePart] = dateStr.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      const date = new Date(year, month - 1, day, hour, minute);
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;

      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;

      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  /**
   * Truncate text with ellipsis
   */
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <Mail className="w-8 h-8 text-blue-500/50" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (data?.error && data.emails.length === 0) {
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

  if (!data || data.emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <Mail className="w-8 h-8 text-emerald-500" />
        <span className="text-sm text-muted-foreground">Inbox zero! 🎉</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-medium text-muted-foreground">Unread Emails</span>
          {data.emails.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-500 rounded-full font-medium">
              {data.emails.length}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Refresh emails"
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Email list */}
      <div className="flex-1 overflow-y-auto space-y-1.5">
        {data.emails.map((email) => (
          <a
            key={email.id}
            href={email.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-2 rounded-md hover:bg-muted/50 transition-colors group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground truncate">
                    {truncate(email.fromName, 25)}
                  </span>
                  {email.labels.includes('UNREAD') && (
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {truncate(email.subject, 45)}
                </div>
                {email.summary && (
                  <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5 italic">
                    {truncate(email.summary, 60)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground/70">
                  {formatRelativeTime(email.date)}
                </span>
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
