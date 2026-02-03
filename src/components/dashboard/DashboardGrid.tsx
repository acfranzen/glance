"use client";

import { useCallback, useState, useEffect, useRef, ComponentType } from "react";
import dynamic from "next/dynamic";
import { useWidgetStore } from "@/lib/store/widget-store";
import { DynamicWidgetLoader } from "@/components/widgets/DynamicWidget";
import { WidgetContainer } from "@/components/widgets/WidgetContainer";
import { WidgetExportModal } from "./WidgetExportModal";
import { WidgetAboutModal } from "./WidgetAboutModal";
import { WidgetInfoModal } from "./WidgetInfoModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Info, Settings, Download } from "lucide-react";
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
    mobileLayout,
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

  useEffect(() => {
    setMounted(true);
    const updateWidth = () => {
      const container = document.getElementById("dashboard-container");
      if (container) {
        setWidth(container.offsetWidth);
      }
      // Use 640px (sm breakpoint) for mobile detection
      setIsMobile(window.innerWidth < 640);
    };

    // Use ResizeObserver for accurate width tracking
    const container = document.getElementById("dashboard-container");
    let resizeObserver: ResizeObserver | null = null;
    
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateWidth();
      });
      resizeObserver.observe(container);
    }

    // Initial update with slight delay to ensure layout is complete
    updateWidth();
    setTimeout(updateWidth, 100);
    
    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
      resizeObserver?.disconnect();
    };
  }, []);

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
    (newLayout: LayoutItem[]) => {
      if (!Array.isArray(newLayout)) return;

      // Only track changes when in edit mode
      if (isEditing) {
        if (isMobile) {
          pendingMobileLayoutRef.current = newLayout;
        } else {
          pendingDesktopLayoutRef.current = newLayout;
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
        <WidgetContainer
          title={widget.title}
          isEditing={isEditing}
          onRemove={() => handleRemoveWidget(widget.id)}
          action={
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
                <DropdownMenuItem
                  onClick={() =>
                    setAboutModal({
                      open: true,
                      slug: widget.custom_widget_id!,
                      name: widget.title,
                    })
                  }
                >
                  <Info className="mr-2 h-4 w-4" />
                  Widget Info
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setSettingsModal({
                      open: true,
                      slug: widget.custom_widget_id!,
                      name: widget.title,
                    })
                  }
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    setExportModal({
                      open: true,
                      slug: widget.custom_widget_id!,
                      name: widget.title,
                    })
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

  // Grid configuration
  const cols = isMobile ? 2 : 12;
  // Responsive margins: smaller on mobile
  const gridMargin: [number, number] = isMobile ? [8, 8] : [16, 16];
  // Responsive row height: slightly smaller on mobile for better density
  const rowHeight = isMobile ? 90 : 100;

  return (
    <>
      <div id="dashboard-container" className={`w-full ${isEditing ? 'select-none' : ''}`}>
        <GridLayout
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
        </GridLayout>
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
