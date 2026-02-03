"use client";

import { useCallback, useState, useEffect, useRef, ComponentType } from "react";
import dynamic from "next/dynamic";
import { useWidgetStore } from "@/lib/store/widget-store";
import { DynamicWidgetLoader } from "@/components/widgets/DynamicWidget";
import { WidgetContainer } from "@/components/widgets/WidgetContainer";
import { WidgetExportModal } from "./WidgetExportModal";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Widget } from "@/types/api";

// Dynamic import to avoid SSR issues with react-grid-layout
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout: ComponentType<any> = dynamic(
  () => import("react-grid-layout").then((mod) => mod.default),
  { ssr: false },
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
  const {
    widgets,
    layout,
    isEditing,
    updateLayout,
    removeWidget,
    initialize,
    isLoading,
  } = useWidgetStore();
  const [width, setWidth] = useState(1200);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exportModal, setExportModal] = useState<{
    open: boolean;
    slug: string;
    name: string;
  }>({
    open: false,
    slug: "",
    name: "",
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    setMounted(true);
    const updateWidth = () => {
      const container = document.getElementById("dashboard-container");
      if (container) {
        // On mobile, use full container width with minimal adjustment
        const isMobileView = window.innerWidth < 640;
        setWidth(container.offsetWidth - (isMobileView ? 0 : 16));
      }
      // Use 640px (sm breakpoint) for mobile detection
      setIsMobile(window.innerWidth < 640);
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
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
    [isEditing],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      removeWidget(widgetId);
    },
    [removeWidget],
  );

  const renderWidget = (widget: Widget) => {
    // Handle custom widgets
    if (widget.type === "custom" && widget.custom_widget_id) {
      return (
        <WidgetContainer
          title={widget.title}
          isEditing={isEditing}
          onRemove={() => handleRemoveWidget(widget.id)}
          action={
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setExportModal({
                  open: true,
                  slug: widget.custom_widget_id!,
                  name: widget.title,
                })
              }
              title="Export widget"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          }
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
          <p className="text-sm">Click &quot;Add Widget&quot; to get started</p>
        </div>
      </div>
    );
  }

  // Mobile: single column, stacked vertically
  // Tablet/Desktop: use stored layout
  const responsiveLayout = isMobile
    ? layout.map((item, index) => ({
        ...item,
        x: 0,
        y: index * 2, // Reduced vertical spacing for mobile
        w: 1,
        h: Math.max(item.h, 2),
        minW: 1,
        minH: 2,
        static: !isEditing,
      }))
    : layout.map((item) => ({
        ...item,
        static: !isEditing,
      }));

  // Responsive margins: smaller on mobile
  const gridMargin: [number, number] = isMobile ? [8, 8] : [16, 16];
  // Responsive row height: slightly smaller on mobile for better density
  const rowHeight = isMobile ? 90 : 100;

  return (
    <>
      <div id="dashboard-container" className="w-full">
        <GridLayout
          className="layout"
          layout={responsiveLayout}
          cols={isMobile ? 1 : 12}
          rowHeight={rowHeight}
          width={width}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditing && !isMobile}
          isResizable={isEditing && !isMobile}
          margin={gridMargin}
          containerPadding={[0, 0]}
          useCSSTransforms={true}
          compactType="vertical"
        >
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className="bg-card rounded-lg border shadow-sm overflow-hidden min-w-0"
            >
              {renderWidget(widget)}
            </div>
          ))}
        </GridLayout>
      </div>

      <WidgetExportModal
        open={exportModal.open}
        onOpenChange={(open) => setExportModal({ ...exportModal, open })}
        widgetSlug={exportModal.slug}
        widgetName={exportModal.name}
      />
    </>
  );
}
