import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import {
  getAllCustomWidgets,
  getCustomWidgetBySlug,
  createCustomWidget,
  updateCustomWidget,
  getAllWidgets,
  createWidget,
  deleteWidget,
  setSetting,
  getSetting,
  logEvent,
  type CredentialRequirement,
  type SetupConfig,
  type FetchConfig,
  type CacheConfig,
  type DataSchema,
} from "@/lib/db";
import { hasCredential, type Provider } from "@/lib/credentials";
import { generateUniqueSlug } from "@/lib/widget-package";

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
    fetch: FetchConfig;
    credentials?: CredentialRequirement[];
    setup?: SetupConfig;
    cache?: CacheConfig;
    data_schema?: DataSchema;
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

interface ImportOptions {
  import_widgets: boolean;
  import_theme: boolean;
  import_layout: boolean;
  conflict_resolution: "overwrite" | "rename" | "skip";
  clear_existing_layout?: boolean;
}

interface ImportResponse {
  success: boolean;
  imported: {
    widgets: string[];
    widgets_skipped: string[];
    widgets_renamed: Array<{ original: string; renamed: string }>;
    theme: boolean;
    layout: boolean;
    layout_items: number;
  };
  credentials_missing: string[];
  errors: string[];
  warnings: string[];
}

function validateDashboardFormat(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid JSON structure"] };
  }
  
  const dashboard = data as Record<string, unknown>;
  
  if (dashboard.version !== 1) {
    errors.push(`Unsupported version: ${dashboard.version}. Expected version 1.`);
  }
  
  if (!dashboard.name || typeof dashboard.name !== "string") {
    errors.push("Missing or invalid dashboard name");
  }
  
  if (!Array.isArray(dashboard.widgets)) {
    errors.push("Missing or invalid widgets array");
  } else {
    const widgets = dashboard.widgets as Array<Record<string, unknown>>;
    for (let i = 0; i < widgets.length; i++) {
      const widget = widgets[i];
      if (!widget.slug || typeof widget.slug !== "string") {
        errors.push(`Widget ${i + 1}: missing or invalid slug`);
      }
      if (!widget.name || typeof widget.name !== "string") {
        errors.push(`Widget ${i + 1}: missing or invalid name`);
      }
      if (!widget.source_code || typeof widget.source_code !== "string") {
        errors.push(`Widget ${widget.slug || i + 1}: missing or invalid source_code`);
      }
    }
  }
  
  if (!dashboard.layout || typeof dashboard.layout !== "object") {
    errors.push("Missing or invalid layout object");
  } else {
    const layout = dashboard.layout as Record<string, unknown>;
    if (!Array.isArray(layout.desktop)) {
      errors.push("Missing or invalid layout.desktop array");
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * POST /api/dashboard/import
 *
 * Import a dashboard from .glance.json format
 *
 * Body:
 * - dashboard: The .glance.json content
 * - options: Import options (what to import, how to handle conflicts)
 */
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { dashboard: dashboardData, options: rawOptions } = body;
    
    // Default options
    const options: ImportOptions = {
      import_widgets: rawOptions?.import_widgets ?? true,
      import_theme: rawOptions?.import_theme ?? true,
      import_layout: rawOptions?.import_layout ?? true,
      conflict_resolution: rawOptions?.conflict_resolution ?? "overwrite",
      clear_existing_layout: rawOptions?.clear_existing_layout ?? false,
    };
    
    // Validate structure
    const validation = validateDashboardFormat(dashboardData);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.errors,
          imported: { widgets: [], widgets_skipped: [], widgets_renamed: [], theme: false, layout: false, layout_items: 0 },
          credentials_missing: [],
          warnings: [],
        } satisfies ImportResponse,
        { status: 400 }
      );
    }
    
    const dashboard = dashboardData as DashboardExportFormat;
    const errors: string[] = [];
    const warnings: string[] = [];
    const importedWidgets: string[] = [];
    const skippedWidgets: string[] = [];
    const renamedWidgets: Array<{ original: string; renamed: string }> = [];
    
    // Map of original slug -> actual slug (for renamed widgets)
    const slugMap = new Map<string, string>();
    
    // Import widgets
    if (options.import_widgets) {
      const existingWidgets = getAllCustomWidgets(true);
      const existingSlugs = existingWidgets.map(w => w.slug);
      
      for (const widget of dashboard.widgets) {
        const existingWidget = getCustomWidgetBySlug(widget.slug);
        
        if (existingWidget) {
          // Handle conflict
          switch (options.conflict_resolution) {
            case "skip":
              skippedWidgets.push(widget.slug);
              slugMap.set(widget.slug, widget.slug); // Keep original slug reference
              continue;
              
            case "rename":
              const newSlug = generateUniqueSlug(widget.slug, existingSlugs);
              const newId = `cw_${nanoid(12)}`;
              
              createCustomWidget(
                newId,
                widget.name,
                newSlug,
                widget.description || null,
                widget.source_code,
                null, // compiled_code
                widget.default_size,
                widget.min_size,
                [], // data_providers (legacy)
                widget.refresh_interval,
                true, // enabled
                widget.server_code || null,
                widget.server_code_enabled,
                widget.credentials || [],
                widget.setup || null,
                widget.fetch || { type: "agent_refresh" },
                widget.cache || null,
                null, // author
                widget.data_schema || null
              );
              
              existingSlugs.push(newSlug);
              renamedWidgets.push({ original: widget.slug, renamed: newSlug });
              slugMap.set(widget.slug, newSlug);
              importedWidgets.push(newSlug);
              break;
              
            case "overwrite":
            default:
              // Update existing widget
              updateCustomWidget(
                existingWidget.id,
                widget.name,
                widget.description || null,
                widget.source_code,
                null, // compiled_code
                widget.default_size,
                widget.min_size,
                [], // data_providers (legacy)
                widget.refresh_interval,
                true, // enabled
                widget.server_code || null,
                widget.server_code_enabled,
                widget.credentials || [],
                widget.setup || null,
                widget.fetch || { type: "agent_refresh" },
                widget.cache || null,
                null, // author
                widget.data_schema || null
              );
              
              slugMap.set(widget.slug, widget.slug);
              importedWidgets.push(widget.slug);
              break;
          }
        } else {
          // New widget - create it
          const widgetId = `cw_${nanoid(12)}`;
          
          createCustomWidget(
            widgetId,
            widget.name,
            widget.slug,
            widget.description || null,
            widget.source_code,
            null, // compiled_code
            widget.default_size,
            widget.min_size,
            [], // data_providers (legacy)
            widget.refresh_interval,
            true, // enabled
            widget.server_code || null,
            widget.server_code_enabled,
            widget.credentials || [],
            widget.setup || null,
            widget.fetch || { type: "agent_refresh" },
            widget.cache || null,
            null, // author
            widget.data_schema || null
          );
          
          existingSlugs.push(widget.slug);
          slugMap.set(widget.slug, widget.slug);
          importedWidgets.push(widget.slug);
        }
      }
    }
    
    // Import layout
    let layoutImported = false;
    let layoutItemsImported = 0;
    
    if (options.import_layout && dashboard.layout?.desktop) {
      // Optionally clear existing layout
      if (options.clear_existing_layout) {
        const existingWidgetInstances = getAllWidgets();
        for (const instance of existingWidgetInstances) {
          // Only delete custom widget instances
          if (instance.custom_widget_id) {
            deleteWidget(instance.id);
          }
        }
      }
      
      // Create widget instances from layout
      for (const layoutItem of dashboard.layout.desktop) {
        // Get the actual slug (may have been renamed)
        const actualSlug = slugMap.get(layoutItem.widget) || layoutItem.widget;
        const customWidget = getCustomWidgetBySlug(actualSlug);
        
        if (!customWidget) {
          warnings.push(`Layout references widget "${layoutItem.widget}" which was not imported`);
          continue;
        }
        
        // Check if this widget is already on the dashboard
        const existingInstances = getAllWidgets();
        const existingInstance = existingInstances.find((w) => {
          return w.custom_widget_id === customWidget.id;
        });
        
        if (existingInstance) {
          // Update position instead of creating duplicate
          warnings.push(`Widget "${actualSlug}" already on dashboard, skipping duplicate`);
          continue;
        }
        
        // Create widget instance
        const instanceId = `widget_${nanoid(12)}`;
        const position = {
          x: layoutItem.x,
          y: layoutItem.y,
          w: layoutItem.w,
          h: layoutItem.h,
        };
        
        createWidget(
          instanceId,
          "custom",
          customWidget.name,
          {}, // config
          position,
          undefined, // dataSource
          customWidget.id
        );
        
        layoutItemsImported++;
      }
      
      layoutImported = true;
    }
    
    // Import theme
    let themeImported = false;
    
    if (options.import_theme && dashboard.theme) {
      if (dashboard.theme.lightCss || dashboard.theme.darkCss) {
        const existingThemeJson = getSetting("custom_theme");
        const now = new Date().toISOString();
        
        const theme = {
          name: dashboard.theme.name,
          lightCss: dashboard.theme.lightCss || "",
          darkCss: dashboard.theme.darkCss || "",
          createdAt: existingThemeJson
            ? JSON.parse(existingThemeJson).createdAt
            : now,
          updatedAt: now,
        };
        
        setSetting("custom_theme", JSON.stringify(theme));
        themeImported = true;
        
        logEvent("theme_imported", { name: dashboard.theme.name });
      }
    }
    
    // Check for missing credentials
    const credentialsMissing: string[] = [];
    
    if (dashboard.credentials_needed) {
      for (const cred of dashboard.credentials_needed) {
        const isConfigured = hasCredential(cred.provider as Provider);
        if (!isConfigured) {
          credentialsMissing.push(cred.provider);
        }
      }
    }
    
    // Also check individual widget credentials
    for (const widget of dashboard.widgets) {
      if (widget.credentials && Array.isArray(widget.credentials)) {
        for (const cred of widget.credentials) {
          const credId = cred.id;
          if (credId && !credentialsMissing.includes(credId)) {
            const isConfigured = hasCredential(credId as Provider);
            if (!isConfigured) {
              credentialsMissing.push(credId);
            }
          }
        }
      }
    }
    
    // Add warning about missing credentials
    if (credentialsMissing.length > 0) {
      warnings.push(`${credentialsMissing.length} credential(s) need to be configured for full functionality`);
    }
    
    // Log the import
    logEvent("dashboard_imported", {
      name: dashboard.name,
      widgets_imported: importedWidgets.length,
      widgets_skipped: skippedWidgets.length,
      widgets_renamed: renamedWidgets.length,
      theme: themeImported,
      layout_items: layoutItemsImported,
    });
    
    const response: ImportResponse = {
      success: true,
      imported: {
        widgets: importedWidgets,
        widgets_skipped: skippedWidgets,
        widgets_renamed: renamedWidgets,
        theme: themeImported,
        layout: layoutImported,
        layout_items: layoutItemsImported,
      },
      credentials_missing: credentialsMissing,
      errors,
      warnings,
    };
    
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to import dashboard:", error);
    return NextResponse.json(
      {
        success: false,
        errors: [error instanceof Error ? error.message : "Failed to import dashboard"],
        imported: { widgets: [], widgets_skipped: [], widgets_renamed: [], theme: false, layout: false, layout_items: 0 },
        credentials_missing: [],
        warnings: [],
      } satisfies ImportResponse,
      { status: 500 }
    );
  }
}
