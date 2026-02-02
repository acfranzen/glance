'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Re-export shadcn UI components for widget sandbox
export { Button } from '@/components/ui/button';
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Separator } from '@/components/ui/separator';
export { Switch } from '@/components/ui/switch';
export { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

// Re-export lucide icons (subset for widgets)
import {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp,
  BarChart2, Check, ChevronRight, Clock, Code, Coffee,
  ExternalLink, FileText, GitPullRequest, Globe, Heart, Home,
  Info, Loader2, Mail, MessageSquare, Package, RefreshCw,
  Search, Settings, Star, TrendingDown, TrendingUp, User, Zap,
  Plus, Minus, X, MoreHorizontal, MoreVertical, Edit, Trash,
  Copy, Download, Upload, Eye, EyeOff, Lock, Unlock
} from 'lucide-react';

export const Icons = {
  Activity, AlertCircle, AlertTriangle, ArrowDown, ArrowUp,
  BarChart2, Check, ChevronRight, Clock, Code, Coffee,
  ExternalLink, FileText, GitPullRequest, Globe, Heart, Home,
  Info, Loader2, Mail, MessageSquare, Package, RefreshCw,
  Search, Settings, Star, TrendingDown, TrendingUp, User, Zap,
  Plus, Minus, X, MoreHorizontal, MoreVertical, Edit, Trash,
  Copy, Download, Upload, Eye, EyeOff, Lock, Unlock
};

// Simple utility components for widgets

/** Flex container with common layouts */
export interface StackProps {
  direction?: 'row' | 'column';
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Stack: React.FC<StackProps> = ({
  direction = 'column',
  gap = 2,
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className,
  children,
}) => {
  const alignMap = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' };
  const justifyMap = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' };

  return (
    <div
      className={cn(
        'flex',
        direction === 'row' ? 'flex-row' : 'flex-col',
        alignMap[align],
        justifyMap[justify],
        wrap && 'flex-wrap',
        className
      )}
      style={{ gap: `${gap * 4}px` }}
    >
      {children}
    </div>
  );
};

/** Grid layout */
export interface GridProps {
  cols?: number;
  gap?: number;
  className?: string;
  children?: React.ReactNode;
}

export const Grid: React.FC<GridProps> = ({ cols = 2, gap = 2, className, children }) => (
  <div className={cn('grid', className)} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${gap * 4}px` }}>
    {children}
  </div>
);

/** Badge for status/labels */
export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children }) => {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variants[variant])}>{children}</span>;
};

/** Progress bar */
export interface ProgressProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

export const Progress: React.FC<ProgressProps> = ({ value, max = 100, showLabel = false, variant = 'default', size = 'md' }) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const variants = { default: 'bg-primary', success: 'bg-green-500', warning: 'bg-yellow-500', error: 'bg-red-500' };
  const sizes = { sm: 'h-1', md: 'h-2', lg: 'h-3' };

  return (
    <div className="w-full">
      <div className={cn('w-full rounded-full bg-secondary', sizes[size])}>
        <div className={cn('rounded-full transition-all', sizes[size], variants[variant])} style={{ width: `${percent}%` }} />
      </div>
      {showLabel && <p className="mt-1 text-xs text-muted-foreground text-right">{percent.toFixed(0)}%</p>}
    </div>
  );
};

/** Stat display */
export interface StatProps {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  suffix?: string;
  prefix?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, change, trend, suffix, prefix }) => {
  const trendColors = { up: 'text-green-600', down: 'text-red-600', neutral: 'text-muted-foreground' };
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="text-lg text-muted-foreground">{prefix}</span>}
        <span className="text-2xl font-semibold">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {(change !== undefined || trend) && (
        <div className={cn('flex items-center gap-1 text-xs', trend && trendColors[trend])}>
          {TrendIcon && <TrendIcon className="h-3 w-3" />}
          {change !== undefined && <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>}
        </div>
      )}
    </div>
  );
};

/** Simple list */
export interface ListItem {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: BadgeProps['variant'];
}

export interface ListProps {
  items: ListItem[];
  emptyMessage?: string;
}

export const List: React.FC<ListProps> = ({ items, emptyMessage = 'No items' }) => {
  if (items.length === 0) {
    return <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">{emptyMessage}</div>;
  }
  return (
    <div className="divide-y">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium truncate">{item.title}</span>
              {item.badge && <Badge variant={item.badgeVariant}>{item.badge}</Badge>}
            </div>
            {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>
      ))}
    </div>
  );
};

/** Loading state */
export interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading...' }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
  </div>
);

/** Error state */
export interface ErrorDisplayProps {
  message: string;
  retry?: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, retry }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
    <p className="text-sm text-red-600 text-center">{message}</p>
    {retry && (
      <button onClick={retry} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <RefreshCw className="h-3 w-3" /> Retry
      </button>
    )}
  </div>
);

/** Empty state */
export interface EmptyProps {
  message?: string;
}

export const Empty: React.FC<EmptyProps> = ({ message = 'No data available' }) => (
  <div className="flex flex-col items-center justify-center py-8">
    <Info className="h-8 w-8 text-muted-foreground mb-2" />
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

// Export cn utility for custom styling
export { cn };

// SDK namespace for DynamicWidget error boundary usage
export const SDK = {
  Error: ErrorDisplay,
  Loading,
  Empty,
  Stack,
  Grid,
  Badge,
  Progress,
  Stat,
  List,
  Icons,
};
