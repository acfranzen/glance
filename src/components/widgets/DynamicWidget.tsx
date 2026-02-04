'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { transpileJSX } from '@/lib/widget-sdk/transpiler';
import { createWidgetContext, executeWidgetCode } from '@/lib/widget-sdk/context';
import { Loading, ErrorDisplay } from '@/lib/widget-sdk/components';
import { WidgetRefreshFooter, type FreshnessStatus } from '@/components/widgets/WidgetRefreshFooter';
import type { CustomWidgetDefinition, WidgetConfig } from '@/lib/widget-sdk/types';

interface DynamicWidgetProps {
  customWidgetId: string;
  config?: WidgetConfig;
  widgetId: string;
  // Props for data passed from wrapper (when used with CustomWidgetWrapper)
  serverData?: unknown;
  isLoadingServerData?: boolean;
  fetchedAt?: string | null;
  freshness?: FreshnessStatus;
  // Pending refresh state for agent_refresh widgets
  pendingRefresh?: { requestedAt: string } | null;
  // Optional pre-fetched definition to avoid duplicate fetch
  definition?: CustomWidgetDefinition | null;
}

interface CustomWidgetState {
  definition: CustomWidgetDefinition | null;
  loading: boolean;
  error: Error | null;
}

// Error boundary component for catching runtime errors in widgets
class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay
          message={this.state.error?.message || 'Widget crashed'}
          retry={() => this.setState({ hasError: false, error: null })}
        />
      );
    }
    return this.props.children;
  }
}

export function DynamicWidget({
  customWidgetId,
  config = {},
  widgetId,
  serverData: externalServerData,
  isLoadingServerData: _isLoadingServerData,
  fetchedAt,
  freshness,
  pendingRefresh,
  definition: externalDefinition,
}: DynamicWidgetProps) {
  const [state, setState] = useState<CustomWidgetState>({
    definition: externalDefinition ?? null,
    loading: !externalDefinition,
    error: null,
  });

  // Update state if external definition changes
  useEffect(() => {
    if (externalDefinition) {
      setState({ definition: externalDefinition, loading: false, error: null });
    }
  }, [externalDefinition]);

  // Fetch the custom widget definition only if not provided externally
  useEffect(() => {
    if (externalDefinition) return; // Skip fetch if definition provided

    let mounted = true;

    async function fetchDefinition() {
      try {
        const response = await fetch(`/api/widgets/${customWidgetId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch widget: ${response.status}`);
        }
        const definition = await response.json() as CustomWidgetDefinition;

        if (mounted) {
          setState({ definition, loading: false, error: null });
        }
      } catch (error) {
        if (mounted) {
          setState({
            definition: null,
            loading: false,
            error: error instanceof Error ? error : new Error('Unknown error')
          });
        }
      }
    }

    fetchDefinition();

    return () => {
      mounted = false;
    };
  }, [customWidgetId, externalDefinition]);

  // Determine if widget has server-side data
  const hasServerData = state.definition?.server_code_enabled ||
    state.definition?.fetch?.type === 'agent_refresh' ||
    state.definition?.fetch?.type === 'webhook';

  // Memoize the transpiled code and widget component
  const { Widget, transpileError } = useMemo(() => {
    if (!state.definition) {
      return { Widget: null, transpileError: null };
    }

    try {
      // Use cached compiled code if available, otherwise transpile
      let code = state.definition.compiled_code;

      if (!code) {
        const result = transpileJSX(state.definition.source_code);
        if (result.error) {
          return { Widget: null, transpileError: result.error };
        }
        code = result.code;
      }

      // Create the sandboxed context
      const context = createWidgetContext({
        widgetId,
        config,
        refreshInterval: state.definition.refresh_interval,
        customWidgetSlug: state.definition.slug,
        serverCodeEnabled: state.definition.server_code_enabled,
      });

      // Execute the widget code
      const WidgetComponent = executeWidgetCode(code, context);

      return { Widget: WidgetComponent, transpileError: null };
    } catch (error) {
      return {
        Widget: null,
        transpileError: error instanceof Error ? error : new Error('Failed to create widget')
      };
    }
  }, [state.definition, config, widgetId]);

  const handleError = useCallback((error: Error) => {
    console.error('Widget runtime error:', error);
  }, []);

  // Loading state
  if (state.loading) {
    return <Loading message="Loading widget..." />;
  }

  // Fetch error
  if (state.error) {
    return <ErrorDisplay message={state.error.message} />;
  }

  // Transpile error
  if (transpileError) {
    return <ErrorDisplay message={`Transpile error: ${transpileError.message}`} />;
  }

  // Widget not available
  if (!Widget) {
    return <ErrorDisplay message="Widget component not available" />;
  }

  // Render the widget with error boundary and refresh footer
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-auto">
        <WidgetErrorBoundary onError={handleError}>
          <Widget config={config} serverData={externalServerData} />
        </WidgetErrorBoundary>
      </div>
      {hasServerData && (fetchedAt || pendingRefresh) && (
        <WidgetRefreshFooter
          fetchedAt={fetchedAt ?? null}
          freshness={freshness ?? null}
          queuedAt={pendingRefresh?.requestedAt ?? null}
        />
      )}
    </div>
  );
}

// Loader component that handles the case where customWidgetId might change
export function DynamicWidgetLoader({
  customWidgetId,
  config,
  widgetId,
  serverData,
  isLoadingServerData,
  fetchedAt,
  freshness,
  pendingRefresh,
  definition,
}: DynamicWidgetProps) {
  // Key forces remount when customWidgetId changes
  return (
    <DynamicWidget
      key={customWidgetId}
      customWidgetId={customWidgetId}
      config={config}
      widgetId={widgetId}
      serverData={serverData}
      isLoadingServerData={isLoadingServerData}
      fetchedAt={fetchedAt}
      freshness={freshness}
      pendingRefresh={pendingRefresh}
      definition={definition}
    />
  );
}

export default DynamicWidget;
