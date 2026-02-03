'use client';

import { useCallback, useState, useEffect, useRef, ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { useWidgetStore } from '@/lib/store/widget-store';
import { ClaudeMaxUsageWidget } from '@/components/widgets/ClaudeMaxUsageWidget';
import { UnreadEmailsWidget } from '@/components/widgets/UnreadEmailsWidget';
import { DynamicWidgetLoader } from '@/components/widgets/DynamicWidget';
import { WidgetContainer } from '@/components/widgets/WidgetContainer';
import type { Widget } from '@/types/api';

// Dynamic import to avoid SSR issues with react-grid-layout
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout: ComponentType<any> = dynamic(
  () => import('react-grid-layout').then((mod) => mod.default),
  { ssr: false }
);

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export function DashboardGrid() {
  const { widgets, layout, isEditing, updateLayout, removeWidget, initialize, isLoading } = useWidgetStore();
  const [width, setWidth] = useState(1200);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setMounted(true);
    const updateWidth = () => {
      const container = document.getElementById('dashboard-container');
      if (container) {
        setWidth(container.offsetWidth - 32);
      }
      setIsMobile(window.innerWidth < 768);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Track pending layout changes (only saved when exiting edit mode)
  const pendingLayoutRef = useRef<LayoutItem[] | null>(null);
  const prevEditingRef = useRef(isEditing);

  // Save layout when exiting edit mode (clicking Done)
  useEffect(() => {
    if (prevEditingRef.current && !isEditing && pendingLayoutRef.current) {
      // Was editing, now not editing -> save pending layout
      updateLayout(pendingLayoutRef.current);
      pendingLayoutRef.current = null;
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, updateLayout]);

  const handleLayoutChange = useCallback(
    (newLayout: LayoutItem[]) => {
      if (!Array.isArray(newLayout)) return;
      
      // Only track changes when in edit mode
      if (isEditing) {
        pendingLayoutRef.current = newLayout;
      }
    },
    [isEditing]
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      removeWidget(widgetId);
    },
    [removeWidget]
  );

  const renderWidget = (widget: Widget) => {
    // Handle custom widgets
    if (widget.type === 'custom' && widget.custom_widget_id) {
      return (
        <WidgetContainer
          title={widget.title}
          isEditing={isEditing}
          onRemove={() => handleRemoveWidget(widget.id)}
        >
          <DynamicWidgetLoader
            customWidgetId={widget.custom_widget_id}
            config={widget.config}
            widgetId={widget.id}
          />
        </WidgetContainer>
      );
    }

    switch (widget.type) {
      case 'claude_max_usage':
        return (
          <WidgetContainer
            title="Claude Max Usage"
            isEditing={isEditing}
            onRemove={() => handleRemoveWidget(widget.id)}
          >
            <ClaudeMaxUsageWidget widget={widget} />
          </WidgetContainer>
        );
      case 'unread_emails':
        return (
          <WidgetContainer
            title="Unread Emails"
            isEditing={isEditing}
            onRemove={() => handleRemoveWidget(widget.id)}
          >
            <UnreadEmailsWidget widget={widget} />
          </WidgetContainer>
        );
      default:
        return (
          <WidgetContainer
            title={widget.title || widget.type}
            isEditing={isEditing}
            onRemove={() => handleRemoveWidget(widget.id)}
          >
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Widget type &quot;{widget.type}&quot; not implemented
            </div>
          </WidgetContainer>
        );
    }
  };

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="animate-pulse">Fetching widgets...</div>
      </div>
    );
  }

  if (widgets.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium font-serif">No widgets yet</p>
          <p className="text-sm">
            Click &quot;Add Widget&quot; to get started
          </p>
        </div>
      </div>
    );
  }

  const responsiveLayout = isMobile
    ? layout.map((item, index) => ({
        ...item,
        x: 0,
        y: index * 3,
        w: 1,
        h: Math.max(item.h, 2),
        static: !isEditing,
      }))
    : layout.map(item => ({
        ...item,
        static: !isEditing,
      }));

  return (
    <div id="dashboard-container" className="w-full">
      <GridLayout
        className="layout"
        layout={responsiveLayout}
        cols={isMobile ? 1 : 12}
        rowHeight={100}
        width={width}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        useCSSTransforms={true}
        compactType="vertical"
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
            {renderWidget(widget)}
          </div>
        ))}
      </GridLayout>
    </div>
  );
}
