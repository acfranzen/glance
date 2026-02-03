'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { transpileJSX } from '@/lib/widget-sdk/transpiler';
import { createWidgetContext, executeWidgetCode } from '@/lib/widget-sdk/context';
import { Loading, ErrorDisplay } from '@/lib/widget-sdk/components';
import type { CustomWidgetDefinition, WidgetConfig } from '@/lib/widget-sdk/types';

interface DynamicWidgetProps {
  customWidgetId: string;
  config?: WidgetConfig;
  widgetId: string;
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

export function DynamicWidget({ customWidgetId, config = {}, widgetId }: DynamicWidgetProps) {
  const [state, setState] = useState<CustomWidgetState>({
    definition: null,
    loading: true,
    error: null,
  });
  const [serverData, setServerData] = useState<unknown>(null);
  const [serverDataLoading, setServerDataLoading] = useState(false);

  // Fetch the custom widget definition
  useEffect(() => {
    let mounted = true;

    async function fetchDefinition() {
      try {
        const response = await fetch(`/api/custom-widgets/${customWidgetId}`);
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
  }, [customWidgetId]);

  // Fetch server data if server_code_enabled OR agent_refresh
  useEffect(() => {
    const fetchType = state.definition?.fetch?.type;
    const needsServerData = state.definition?.server_code_enabled || fetchType === 'agent_refresh';
    const slug = state.definition?.slug;
    
    if (!needsServerData || !slug) {
      return;
    }

    let mounted = true;
    setServerDataLoading(true);

    async function fetchServerData() {
      try {
        const response = await fetch(`/api/custom-widgets/${slug}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            params: config,
            widget_instance_id: widgetId  // Required for agent_refresh
          }),
        });
        const result = await response.json();
        
        if (mounted) {
          if (result.error) {
            setServerData({ error: result.error });
          } else {
            setServerData(result.data);
          }
          setServerDataLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setServerData({ error: error instanceof Error ? error.message : 'Failed to fetch server data' });
          setServerDataLoading(false);
        }
      }
    }

    fetchServerData();

    return () => {
      mounted = false;
    };
  }, [state.definition, config, widgetId]);

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

  // Render the widget with error boundary
  return (
    <WidgetErrorBoundary onError={handleError}>
      <Widget config={config} serverData={serverData} />
    </WidgetErrorBoundary>
  );
}

// Loader component that handles the case where customWidgetId might change
export function DynamicWidgetLoader({ 
  customWidgetId, 
  config,
  widgetId 
}: DynamicWidgetProps) {
  // Key forces remount when customWidgetId changes
  return (
    <DynamicWidget 
      key={customWidgetId}
      customWidgetId={customWidgetId} 
      config={config}
      widgetId={widgetId}
    />
  );
}

export default DynamicWidget;
