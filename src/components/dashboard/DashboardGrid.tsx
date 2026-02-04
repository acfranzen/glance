"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import ReactGridLayout from "react-grid-layout/legacy";
import { useWidgetStore } from "@/lib/store/widget-store";
import { CustomWidgetWrapper } from "@/components/widgets/CustomWidgetWrapper";
import { WidgetContainer } from "@/components/widgets/WidgetContainer";
import { WidgetExportModal } from "./WidgetExportModal";
import { WidgetAboutModal } from "./WidgetAboutModal";
import { WidgetInfoModal } from "./WidgetInfoModal";
import type { Widget } from "@/types/api";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

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
    mobileLayout,
    isEditing,
    updateLayout,
    removeWidget,
    initialize,
    isLoading,
  } = useWidgetStore();
  // Width measurement (SSR-safe)
  // Use window.innerWidth on client for immediate mobile detection
  const [width, setWidth] = useState(1200);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Set mounted and initial width from window on client hydration
  useEffect(() => {
    setMounted(true);
    // Use window width for initial mobile detection
    if (typeof window !== 'undefined') {
      setWidth(window.innerWidth);
    }
  }, []);
  
  // Refine width with ResizeObserver once container is in DOM
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Measure container
    const measure = () => {
      const w = container.offsetWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  });
  
  // Derive mobile state from width
  const isMobile = width < 640;
  
  const [exportModal, setExportModal] = useState<{
    open: boolean;
    slug: string;
    name: string;
  }>({
    open: false,
    slug: "",
    name: "",
  });
  const [aboutModal, setAboutModal] = useState<{
    open: boolean;
    slug: string;
    name: string;
  }>({
    open: false,
    slug: "",
    name: "",
  });
  const [settingsModal, setSettingsModal] = useState<{
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

  // Width management handled by ResizeObserver effect above

  // Track pending layout changes (only saved when exiting edit mode)
  // Separate refs for desktop and mobile layouts
  const pendingDesktopLayoutRef = useRef<LayoutItem[] | null>(null);
  const pendingMobileLayoutRef = useRef<LayoutItem[] | null>(null);
  const prevEditingRef = useRef(isEditing);
  // Track which viewport was being edited
  const editingViewportRef = useRef<'desktop' | 'mobile'>('desktop');

  // Save layouts when exiting edit mode (clicking Done)
  useEffect(() => {
    if (prevEditingRef.current && !isEditing) {
      // Was editing, now not editing -> save pending layouts
      if (pendingDesktopLayoutRef.current) {
        updateLayout(pendingDesktopLayoutRef.current, false);
        pendingDesktopLayoutRef.current = null;
      }
      if (pendingMobileLayoutRef.current) {
        updateLayout(pendingMobileLayoutRef.current, true);
        pendingMobileLayoutRef.current = null;
      }
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, updateLayout]);

  // Update which viewport is being edited when isMobile changes during edit
  useEffect(() => {
    if (isEditing) {
      editingViewportRef.current = isMobile ? 'mobile' : 'desktop';
    }
  }, [isMobile, isEditing]);

  const handleLayoutChange = useCallback(
    (newLayout: readonly LayoutItem[]) => {
      if (!Array.isArray(newLayout)) return;

      // Only track changes when in edit mode
      // Copy to mutable array for storage
      if (isEditing) {
        if (isMobile) {
          pendingMobileLayoutRef.current = [...newLayout];
        } else {
          pendingDesktopLayoutRef.current = [...newLayout];
        }
      }
    },
    [isEditing, isMobile],
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
        <CustomWidgetWrapper
          widget={widget}
          isEditing={isEditing}
          onRemove={() => handleRemoveWidget(widget.id)}
          onOpenAbout={() =>
            setAboutModal({
              open: true,
              slug: widget.custom_widget_id!,
              name: widget.title,
            })
          }
          onOpenSettings={() =>
            setSettingsModal({
              open: true,
              slug: widget.custom_widget_id!,
              name: widget.title,
            })
          }
          onOpenExport={() =>
            setExportModal({
              open: true,
              slug: widget.custom_widget_id!,
              name: widget.title,
            })
          }
        />
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

  // Don't render grid until we have a valid width measurement
  // Skip this check if we have any reasonable width (prevents infinite loading)
  if (width < 100) {
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

  // Use appropriate layout based on viewport
  // Mobile: 2 columns, stored mobile layout
  // Desktop: 12 columns, stored desktop layout
  const activeLayout = isMobile ? mobileLayout : layout;
  const responsiveLayout = activeLayout.map((item) => ({
    ...item,
    minW: isMobile ? 1 : 2,
    minH: 2,
    static: !isEditing,
  }));

  // Grid configuration - double-check mobile detection at render time
  const cols = isMobile ? 2 : 12;
  // Responsive margins: smaller on mobile
  const gridMargin: [number, number] = isMobile ? [8, 8] : [16, 16];
  // Responsive row height: slightly smaller on mobile for better density
  const rowHeight = isMobile ? 90 : 100;

  // On mobile, bypass react-grid-layout entirely - it has fundamental issues
  // with width calculations. Use a simple flexbox stack instead.
  // On mobile, use simple flexbox stack (RGL has issues with very small widths)
  if (isMobile) {
    return (
      <>
        <div ref={containerRef} id="dashboard-container" className="w-full">
          <div className="flex flex-col gap-4">
            {widgets.map((widget) => (
              <div key={widget.id} className="w-full min-h-[200px]">
                {renderWidget(widget)}
              </div>
            ))}
          </div>
        </div>

        <WidgetExportModal
          open={exportModal.open}
          onOpenChange={(open) => setExportModal({ ...exportModal, open })}
          widgetSlug={exportModal.slug}
          widgetName={exportModal.name}
        />
        <WidgetAboutModal
          open={aboutModal.open}
          onOpenChange={(open) => setAboutModal({ ...aboutModal, open })}
          widgetSlug={aboutModal.slug}
          widgetName={aboutModal.name}
        />
        <WidgetInfoModal
          open={settingsModal.open}
          onOpenChange={(open) => setSettingsModal({ ...settingsModal, open })}
          widgetSlug={settingsModal.slug}
          widgetName={settingsModal.name}
        />
      </>
    );
  }

  return (
    <>
      <div ref={containerRef} id="dashboard-container" className={`w-full ${isEditing ? 'select-none' : ''}`}>
        <ReactGridLayout
          className="layout"
          layout={responsiveLayout}
          cols={cols}
          rowHeight={rowHeight}
          width={width}
          onLayoutChange={handleLayoutChange}
          isDraggable={isEditing}
          isResizable={isEditing}
          margin={gridMargin}
          containerPadding={[0, 0]}
          useCSSTransforms={true}
          compactType="vertical"
        >
          {widgets.map((widget) => (
            <div key={widget.id} className="h-full">
              {renderWidget(widget)}
            </div>
          ))}
        </ReactGridLayout>
      </div>

      <WidgetExportModal
        open={exportModal.open}
        onOpenChange={(open) => setExportModal({ ...exportModal, open })}
        widgetSlug={exportModal.slug}
        widgetName={exportModal.name}
      />

      <WidgetAboutModal
        open={aboutModal.open}
        onOpenChange={(open) => setAboutModal({ ...aboutModal, open })}
        widgetSlug={aboutModal.slug}
        widgetName={aboutModal.name}
      />

      <WidgetInfoModal
        open={settingsModal.open}
        onOpenChange={(open) => setSettingsModal({ ...settingsModal, open })}
        widgetSlug={settingsModal.slug}
        widgetName={settingsModal.name}
      />
    </>
  );
}
