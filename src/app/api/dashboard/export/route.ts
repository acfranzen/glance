import { NextRequest, NextResponse } from "next/server";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import {
  getAllWidgets,
  getAllCustomWidgets,
  getCustomWidget,
  getSetting,
} from "@/lib/db";

interface DashboardExportFormat {
  version: 1;
  name: string;
  description?: string;
  author?: string;
  exported_at: string;
  glance_version: string;
  widgets: Array<{
    slug: string;
    name: string;
    description?: string;
    source_code: string;
    server_code?: string;
    server_code_enabled: boolean;
    default_size: { w: number; h: number };
    min_size: { w: number; h: number };
    refresh_interval: number;
    fetch: unknown;
    credentials?: unknown[];
    setup?: unknown;
    cache?: unknown;
    data_schema?: unknown;
  }>;
  layout: {
    desktop: Array<{ widget: string; x: number; y: number; w: number; h: number }>;
    tablet?: Array<{ widget: string; x: number; y: number; w: number; h: number }>;
    mobile?: Array<{ widget: string; x: number; y: number; w: number; h: number }>;
  };
  theme?: {
    name: string;
    lightCss?: string;
    darkCss?: string;
  };
  credentials_needed: Array<{
    provider: string;
    description: string;
    required: boolean;
  }>;
}

/**
 * POST /api/dashboard/export
 *
 * Export the dashboard configuration to .glance.json format
 *
 * Body:
 * - widgets: ["all"] | ["slug1", "slug2"] - which widgets to export
 * - include_theme: boolean - include theme in export
 * - include_layout: boolean - include layout in export
 * - breakpoints: ["desktop", "tablet", "mobile"] - which breakpoints to include
 */
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      widgets: widgetFilter = ["all"],
      include_theme = true,
      include_layout = true,
      breakpoints = ["desktop", "tablet", "mobile"],
      name = "My Dashboard",
      description,
      author,
    } = body;

    // Get all widget instances
    const allWidgetInstances = getAllWidgets();
    
    // Get all custom widgets
    const allCustomWidgets = getAllCustomWidgets();
    
    // Filter custom widgets based on what's actually on the dashboard
    const customWidgetIdsOnDashboard = new Set(
      allWidgetInstances
        .map(w => (w as any).custom_widget_id)
        .filter(Boolean)
    );
    
    // Determine which widgets to export
    let widgetsToExport = allCustomWidgets.filter(w => 
      customWidgetIdsOnDashboard.has(w.id)
    );
    
    if (widgetFilter[0] !== "all") {
      // Filter by specified slugs
      widgetsToExport = widgetsToExport.filter(w =>
        widgetFilter.includes(w.slug)
      );
    }

    // Build widgets array
    const exportWidgets = widgetsToExport.map(widget => ({
      slug: widget.slug,
      name: widget.name,
      description: widget.description || undefined,
      source_code: widget.source_code,
      server_code: widget.server_code || undefined,
      server_code_enabled: widget.server_code_enabled,
      default_size: widget.default_size,
      min_size: widget.min_size,
      refresh_interval: widget.refresh_interval,
      fetch: widget.fetch,
      credentials: widget.credentials.length > 0 ? widget.credentials : undefined,
      setup: widget.setup || undefined,
      cache: widget.cache || undefined,
      data_schema: widget.data_schema || undefined,
    }));

    // Build layout
    const layout: DashboardExportFormat["layout"] = {
      desktop: [],
      tablet: [],
      mobile: [],
    };

    if (include_layout) {
      const exportedSlugs = new Set(widgetsToExport.map(w => w.slug));
      
      // Build desktop layout from widget positions
      for (const instance of allWidgetInstances) {
        const customWidgetId = (instance as any).custom_widget_id;
        if (!customWidgetId) continue;
        
        const customWidget = getCustomWidget(customWidgetId);
        if (!customWidget || !exportedSlugs.has(customWidget.slug)) continue;
        
        const position = JSON.parse(instance.position);
        const layoutItem = {
          widget: customWidget.slug,
          x: position.x,
          y: position.y,
          w: position.w,
          h: position.h,
        };
        
        layout.desktop.push(layoutItem);
      }

      // For now, tablet and mobile use the same layout as desktop
      // (responsive layouts could be added later from mobile_position column)
      if (breakpoints.includes("tablet")) {
        layout.tablet = [...layout.desktop];
      }
      if (breakpoints.includes("mobile")) {
        layout.mobile = [...layout.desktop];
      }
      
      // Remove empty breakpoints
      if (!breakpoints.includes("tablet")) {
        delete layout.tablet;
      }
      if (!breakpoints.includes("mobile")) {
        delete layout.mobile;
      }
    }

    // Get theme
    let theme: DashboardExportFormat["theme"] | undefined;
    if (include_theme) {
      const themeJson = getSetting("custom_theme");
      if (themeJson) {
        const customTheme = JSON.parse(themeJson);
        theme = {
          name: customTheme.name,
          lightCss: customTheme.lightCss || undefined,
          darkCss: customTheme.darkCss || undefined,
        };
      }
    }

    // Collect all unique credentials needed
    const credentialsNeeded = new Map<string, { description: string; required: boolean }>();
    
    for (const widget of widgetsToExport) {
      if (widget.credentials && Array.isArray(widget.credentials)) {
        for (const cred of widget.credentials) {
          const credId = (cred as any).id || (cred as any).provider;
          if (credId && !credentialsNeeded.has(credId)) {
            credentialsNeeded.set(credId, {
              description: (cred as any).description || (cred as any).name || credId,
              required: true,
            });
          }
        }
      }
    }

    // Build final export
    const exportData: DashboardExportFormat = {
      version: 1,
      name,
      description,
      author,
      exported_at: new Date().toISOString(),
      glance_version: process.env.npm_package_version || "0.5.2",
      widgets: exportWidgets,
      layout,
      theme,
      credentials_needed: Array.from(credentialsNeeded.entries()).map(([provider, info]) => ({
        provider,
        description: info.description,
        required: info.required,
      })),
    };

    // Return as downloadable file
    const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.glance.json`;
    
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Failed to export dashboard:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export dashboard",
      },
      { status: 500 }
    );
  }
}
