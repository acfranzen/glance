'use client';

import { useState, useEffect } from 'react';
import { DynamicWidgetLoader } from '@/components/widgets/DynamicWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import { ErrorDisplay } from '@/lib/widget-sdk/components';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Info, Settings, Download, RefreshCw, Loader2 } from 'lucide-react';
import { useWidgetData } from '@/hooks/useWidgetData';
import type { Widget } from '@/types/api';
import type { CustomWidgetDefinition } from '@/lib/widget-sdk/types';

interface CustomWidgetWrapperProps {
  widget: Widget;
  isEditing: boolean;
  onRemove: () => void;
  onOpenAbout: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
}

export function CustomWidgetWrapper({
  widget,
  isEditing,
  onRemove,
  onOpenAbout,
  onOpenSettings,
  onOpenExport,
}: CustomWidgetWrapperProps) {
  // Fetch widget definition
  const [definition, setDefinition] = useState<CustomWidgetDefinition | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);

  useEffect(() => {
    if (!widget.custom_widget_id) return;

    setDefinitionError(null);
    fetch(`/api/widgets/${widget.custom_widget_id}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch widget: ${res.status}`);
        return res.json();
      })
      .then((data) => setDefinition(data))
      .catch((err) => {
        console.error('Failed to fetch widget definition:', err);
        setDefinitionError(err instanceof Error ? err.message : 'Failed to load widget');
      });
  }, [widget.custom_widget_id]);

  // Get widget data with refresh capability
  const { data, isLoading, fetchedAt, freshness, refresh, isRefreshing } = useWidgetData(
    definition,
    widget.id,
    widget.config
  );

  // Determine if widget has server-side data (should show refresh button)
  const hasServerData = definition?.server_code_enabled ||
    definition?.fetch?.type === 'agent_refresh' ||
    definition?.fetch?.type === 'webhook';

  return (
    <WidgetContainer
      title={widget.title}
      isEditing={isEditing}
      onRemove={onRemove}
      action={
        <div className="flex items-center gap-0.5">
          {hasServerData && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={refresh}
              disabled={isRefreshing}
              title="Refresh widget data"
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Widget options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpenAbout}>
                <Info className="mr-2 h-4 w-4" />
                Widget Info
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSettings}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {definitionError ? (
        <ErrorDisplay message={definitionError} />
      ) : (
        <DynamicWidgetLoader
          customWidgetId={widget.custom_widget_id!}
          config={widget.config}
          widgetId={widget.id}
          serverData={data}
          isLoadingServerData={isLoading}
          fetchedAt={fetchedAt}
          freshness={freshness}
          definition={definition}
        />
      )}
    </WidgetContainer>
  );
}
