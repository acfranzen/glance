'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { DataQuery, UseDataResult, UseWidgetStateResult, WidgetConfig } from './types';

export interface UseDataOptions {
  widgetId: string;
  refreshInterval: number;
  customWidgetSlug?: string;
  serverCodeEnabled?: boolean;
}

/**
 * Hook for fetching data from providers (proxied through /api/widget-data)
 * When serverCodeEnabled is true, it calls the execute endpoint instead.
 *
 * Usage in widget code:
 * const { data, loading, error, refresh } = useData('github', {
 *   endpoint: '/repos/{owner}/{repo}/pulls',
 *   params: { owner: 'anthropics', repo: 'claude-code', state: 'open' }
 * });
 */
export function createUseData(options: UseDataOptions) {
  const { widgetId, refreshInterval, customWidgetSlug, serverCodeEnabled } = options;

  return function useData<T = unknown>(
    provider: string,
    query: DataQuery
  ): UseDataResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const mountedRef = useRef(true);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
      if (!mountedRef.current) return;

      try {
        setLoading(true);
        setError(null);

        let response: Response;

        // If server code is enabled, call the execute endpoint instead
        if (serverCodeEnabled && customWidgetSlug) {
          response = await fetch(`/api/widgets/${customWidgetSlug}/execute`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              params: {
                provider,
                ...query.params,
                endpoint: query.endpoint,
                method: query.method,
                body: query.body,
              },
            }),
          });
        } else {
          // Normal data provider flow
          response = await fetch('/api/widget-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              widget_id: widgetId,
              provider,
              query,
            }),
          });
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Request failed: ${response.status}`);
        }

        const result = await response.json();

        if (mountedRef.current) {
          setData(result.data as T);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, [provider, JSON.stringify(query), widgetId, serverCodeEnabled, customWidgetSlug]);

    const refresh = useCallback(() => {
      fetchData();
    }, [fetchData]);

    useEffect(() => {
      mountedRef.current = true;
      fetchData();

      // Set up refresh interval if specified
      if (refreshInterval > 0) {
        intervalRef.current = setInterval(fetchData, refreshInterval * 1000);
      }

      return () => {
        mountedRef.current = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, [fetchData, refreshInterval]);

    return { data, loading, error, refresh };
  };
}

/**
 * Hook for accessing widget configuration
 * 
 * Usage in widget code:
 * const config = useConfig();
 * const owner = config.owner || 'anthropics';
 */
export function createUseConfig(config: WidgetConfig) {
  return function useConfig(): WidgetConfig {
    return config;
  };
}

/**
 * Hook for widget-local state (persisted in memory only during render)
 * 
 * Usage in widget code:
 * const { state, setState } = useWidgetState<number>(0);
 */
export function createUseWidgetState() {
  // This creates a closure for widget-specific state
  const stateMap = new Map<string, unknown>();
  
  return function useWidgetState<T>(
    key: string,
    initialValue: T
  ): UseWidgetStateResult<T> {
    const [, forceUpdate] = useState({});
    
    // Initialize state if not exists
    if (!stateMap.has(key)) {
      stateMap.set(key, initialValue);
    }

    const state = stateMap.get(key) as T;

    const setState = useCallback((value: T | ((prev: T) => T)) => {
      const currentValue = stateMap.get(key) as T;
      const newValue = typeof value === 'function' 
        ? (value as (prev: T) => T)(currentValue) 
        : value;
      stateMap.set(key, newValue);
      forceUpdate({});
    }, [key]);

    return { state, setState };
  };
}

export interface CreateWidgetHooksOptions {
  widgetId: string;
  config: WidgetConfig;
  refreshInterval: number;
  customWidgetSlug?: string;
  serverCodeEnabled?: boolean;
}

/**
 * Factory function to create all hooks bound to a specific widget context
 */
export function createWidgetHooks(options: CreateWidgetHooksOptions) {
  const { widgetId, config, refreshInterval, customWidgetSlug, serverCodeEnabled } = options;
  return {
    useData: createUseData({ widgetId, refreshInterval, customWidgetSlug, serverCodeEnabled }),
    useConfig: createUseConfig(config),
    useWidgetState: createUseWidgetState(),
  };
}
