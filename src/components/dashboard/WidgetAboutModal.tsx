'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Zap, User, Calendar, RefreshCw } from 'lucide-react';

interface WidgetAboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetSlug: string;
  widgetName: string;
}

interface WidgetBasicInfo {
  name: string;
  slug: string;
  description?: string;
  author?: string;
  created_at: string;
  updated_at: string;
  refresh_interval: number;
  default_size: { w: number; h: number };
}

export function WidgetAboutModal({ open, onOpenChange, widgetSlug, widgetName }: WidgetAboutModalProps) {
  const [info, setInfo] = useState<WidgetBasicInfo | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && widgetSlug) {
      setLoading(true);
      fetch(`/api/widgets/${widgetSlug}`)
        .then(res => res.json())
        .then(data => {
          setInfo(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, widgetSlug]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    return `${Math.floor(seconds / 3600)} hours`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {widgetName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : info ? (
          <div className="space-y-4">
            {info.description ? (
              <p className="text-sm text-muted-foreground">{info.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No description available.</p>
            )}

            <div className="space-y-2 text-sm">
              {info.author && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Created by {info.author}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Added {formatDate(info.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                <span>Refreshes every {formatDuration(info.refresh_interval)}</span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {info.slug}
              </code>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Could not load widget info
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
