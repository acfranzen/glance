'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import useSWR from 'swr';
import type { CustomWidgetDefinition, WidgetConfig } from '@/lib/widget-sdk/types';
import type { FreshnessStatus } from '@/components/widgets/WidgetRefreshFooter';

export interface UseWidgetDataResult {
  data: unknown;
  isLoading: boolean;
  fetchedAt: string | null;
  freshness: FreshnessStatus;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  pendingRefresh: { requestedAt: string } | null;
  isRefreshQueued: boolean;
}

interface FetchConfig {
  type: 'server_code' | 'webhook' | 'agent_refresh';
  refresh_endpoint?: string;
}

// Cache API response shape
interface CacheResponse {
  has_cache: boolean;
  data?: unknown;
  fetched_at?: string;
  cachedAt?: string; // Legacy field
  expires_at?: string;
  age_seconds?: number;
  freshness?: FreshnessStatus;
  pending_refresh?: {
    requested_at: string;
  } | null;
  message?: string;
}

// Fetcher for cache endpoint (GET) - just reads from SQLite
async function cacheFetcher(url: string): Promise<CacheResponse> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cache fetch failed: ${response.status}`);
  }
  return response.json();
}

// Execute server code (POST) - runs server code and updates cache
async function executeServerCode(
  slug: string,
  config: WidgetConfig,
  widgetInstanceId: string,
  forceRefresh = false
) {
  const response = await fetch(`/api/widgets/${slug}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      params: config,
      widget_instance_id: widgetInstanceId,
      force_refresh: forceRefresh,
    }),
  });
  if (!response.ok) {
    throw new Error(`Execute failed: ${response.status}`);
  }
  return response.json();
}

export function useWidgetData(
  definition: CustomWidgetDefinition | null,
  widgetInstanceId: string,
  config: WidgetConfig = {}
): UseWidgetDataResult {
  // Stabilize config reference
  const configRef = useRef(config);
  const configKey = JSON.stringify(config);
  const prevConfigKey = useRef(configKey);

  if (prevConfigKey.current !== configKey) {
    configRef.current = config;
    prevConfigKey.current = configKey;
  }

  // Determine fetch type
  const fetchConfig: FetchConfig | null = definition?.fetch
    ? (typeof definition.fetch === 'string'
        ? JSON.parse(definition.fetch)
        : definition.fetch)
    : null;

  const isAgentRefresh = fetchConfig?.type === 'agent_refresh';
  const isWebhook = fetchConfig?.type === 'webhook';
  const hasServerCode = definition?.server_code_enabled;
  const shouldFetchData = definition?.slug && (isAgentRefresh || hasServerCode || isWebhook);

  // SWR polls the cache endpoint every 5s for ALL widget types
  // This just reads from SQLite - lightweight
  const cacheUrl = shouldFetchData && definition?.slug
    ? `/api/widgets/${definition.slug}/cache`
    : null;

  const {
    data: cacheResponse,
    isLoading: cacheLoading,
    mutate,
  } = useSWR(
    cacheUrl,
    cacheFetcher,
    {
      refreshInterval: 5000, // Poll every 5s
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // For server_code widgets: execute once on mount to populate cache if empty
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!definition?.slug || !hasServerCode || isAgentRefresh || isWebhook) return;
    if (hasInitialized.current) return;

    // Check if cache is empty/missing, if so trigger initial execute
    if (cacheResponse === undefined) return; // Still loading

    hasInitialized.current = true;

    if (!cacheResponse?.data) {
      // No cached data, execute to populate
      executeServerCode(definition.slug, configRef.current, widgetInstanceId, false)
        .then(() => mutate()) // Refresh cache after execute
        .catch(console.error);
    }
  }, [definition?.slug, hasServerCode, isAgentRefresh, isWebhook, cacheResponse, widgetInstanceId, mutate]);

  // Refreshing state for manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh - triggers actual data fetch
  const refresh = useCallback(async () => {
    if (!definition?.slug) return;

    setIsRefreshing(true);
    try {
      if (hasServerCode && !isAgentRefresh && !isWebhook) {
        // server_code: Execute with force_refresh to update cache
        await executeServerCode(definition.slug, configRef.current, widgetInstanceId, true);
        await mutate(); // Refresh SWR cache from SQLite
      } else if (isAgentRefresh) {
        // agent_refresh: Signal agent to fetch new data
        await fetch(`/api/widgets/${definition.slug}/refresh`, {
          method: 'POST',
        });
        // Immediately refresh to show queued state
        await mutate();
      } else if (isWebhook) {
        // webhook: Call external refresh endpoint if configured
        if (fetchConfig?.refresh_endpoint) {
          try {
            await fetch(fetchConfig.refresh_endpoint, { method: 'POST' });
          } catch (err) {
            console.error('Failed to call refresh endpoint:', err);
          }
        }
        await mutate(); // Refresh from cache
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [definition?.slug, hasServerCode, isAgentRefresh, isWebhook, fetchConfig?.refresh_endpoint, widgetInstanceId, mutate]);

  // Extract data from cache response
  const data = cacheResponse?.data ?? null;
  const fetchedAt = cacheResponse?.cachedAt || cacheResponse?.fetched_at || null;
  const freshness: FreshnessStatus = cacheResponse?.freshness || null;

  // Extract pending refresh state from cache response
  const pendingRefresh = cacheResponse?.pending_refresh
    ? { requestedAt: cacheResponse.pending_refresh.requested_at }
    : null;
  const isRefreshQueued = !!pendingRefresh;

  return {
    data,
    isLoading: cacheLoading,
    fetchedAt,
    freshness,
    refresh,
    isRefreshing,
    pendingRefresh,
    isRefreshQueued,
  };
}
