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
} from "@/lib/db";
import { hasCredential, type Provider } from "@/lib/credentials";
import { generateUniqueSlug } from "@/lib/widget-package";
import {
  validateDashboardFormat,
  type DashboardExportFormat,
  type ImportResponse,
} from "@/lib/dashboard-format";

// Maximum import file size (5MB) to prevent DoS
const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

interface ImportOptions {
  import_widgets: boolean;
  import_theme: boolean;
  import_layout: boolean;
  conflict_resolution: "overwrite" | "rename" | "skip";
  clear_existing_layout?: boolean;
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

  // Check content length to prevent oversized uploads
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_IMPORT_SIZE) {
    return NextResponse.json(
      {
        success: false,
        errors: [`File too large. Maximum size is ${MAX_IMPORT_SIZE / 1024 / 1024}MB`],
        imported: {
          widgets: [],
          widgets_skipped: [],
          widgets_renamed: [],
          theme: false,
          layout: false,
          layout_items: 0,
        },
        credentials_missing: [],
        warnings: [],
      } satisfies ImportResponse,
      { status: 413 }
    );
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
          imported: {
            widgets: [],
            widgets_skipped: [],
            widgets_renamed: [],
            theme: false,
            layout: false,
            layout_items: 0,
          },
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

    // Map of actual slug -> custom widget id (for layout creation)
    const slugToWidgetId = new Map<string, string>();

    // Import widgets
    if (options.import_widgets) {
      const existingWidgets = getAllCustomWidgets(true);
      // Track all existing slugs AND slugs we create during import
      const existingSlugs = new Set(existingWidgets.map((w) => w.slug));

      // Pre-populate slugToWidgetId with existing widgets
      for (const w of existingWidgets) {
        slugToWidgetId.set(w.slug, w.id);
      }

      for (const widget of dashboard.widgets) {
        // Check conflict against our tracked set, not the database
        // This prevents false conflicts with just-renamed widgets
        const hasConflict = existingSlugs.has(widget.slug);

        if (hasConflict) {
          // Handle conflict
          switch (options.conflict_resolution) {
            case "skip":
              skippedWidgets.push(widget.slug);
              slugMap.set(widget.slug, widget.slug); // Keep original slug reference
              continue;

            case "rename": {
              const newSlug = generateUniqueSlug(
                widget.slug,
                Array.from(existingSlugs)
              );
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
                widget.data_schema
              );

              existingSlugs.add(newSlug);
              slugToWidgetId.set(newSlug, newId);
              renamedWidgets.push({ original: widget.slug, renamed: newSlug });
              slugMap.set(widget.slug, newSlug);
              importedWidgets.push(newSlug);
              break;
            }

            case "overwrite":
            default: {
              // Update existing widget
              const existingWidget = getCustomWidgetBySlug(widget.slug);
              if (existingWidget) {
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
                  widget.data_schema
                );

                slugMap.set(widget.slug, widget.slug);
                slugToWidgetId.set(widget.slug, existingWidget.id);
                importedWidgets.push(widget.slug);
              }
              break;
            }
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

          existingSlugs.add(widget.slug);
          slugToWidgetId.set(widget.slug, widgetId);
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
      // Important: We create ALL instances, allowing multiple instances of the same widget
      for (const layoutItem of dashboard.layout.desktop) {
        // Get the actual slug (may have been renamed)
        const actualSlug = slugMap.get(layoutItem.widget) || layoutItem.widget;

        // Get widget id from our map first (handles just-imported widgets)
        // Fall back to database query for widgets that weren't in the import
        let customWidgetId = slugToWidgetId.get(actualSlug);
        if (!customWidgetId) {
          const customWidget = getCustomWidgetBySlug(actualSlug);
          if (customWidget) {
            customWidgetId = customWidget.id;
          }
        }

        if (!customWidgetId) {
          warnings.push(
            `Layout references widget "${layoutItem.widget}" which was not imported`
          );
          continue;
        }

        // Get widget name for the instance
        const customWidget = getCustomWidgetBySlug(actualSlug);
        const widgetName = customWidget?.name || actualSlug;

        // Create widget instance - always create, allowing multiple instances
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
          widgetName,
          {}, // config
          position,
          undefined, // dataSource
          customWidgetId
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
      warnings.push(
        `${credentialsMissing.length} credential(s) need to be configured for full functionality`
      );
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
        errors: [
          error instanceof Error ? error.message : "Failed to import dashboard",
        ],
        imported: {
          widgets: [],
          widgets_skipped: [],
          widgets_renamed: [],
          theme: false,
          layout: false,
          layout_items: 0,
        },
        credentials_missing: [],
        warnings: [],
      } satisfies ImportResponse,
      { status: 500 }
    );
  }
}
