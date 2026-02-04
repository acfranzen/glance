import { NextRequest, NextResponse } from "next/server";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import { getAllCustomWidgets } from "@/lib/db";
import { hasCredential, type Provider } from "@/lib/credentials";

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

interface WidgetConflict {
  slug: string;
  existing_name: string;
  incoming_name: string;
  action: "will_overwrite" | "will_rename" | "will_skip";
}

interface ImportPreviewResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dashboard: {
    name: string;
    description?: string;
    author?: string;
    exported_at: string;
    glance_version: string;
  };
  widget_count: number;
  widgets: Array<{
    slug: string;
    name: string;
    has_conflict: boolean;
  }>;
  conflicts: WidgetConflict[];
  layout: {
    desktop_items: number;
    tablet_items: number;
    mobile_items: number;
  };
  has_theme: boolean;
  credentials_needed: string[];
  credentials_missing: string[];
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
 * POST /api/dashboard/import/preview
 *
 * Preview what will happen during import (dry run)
 *
 * Body: The .glance.json content
 */
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Validate structure
    const validation = validateDashboardFormat(body);
    if (!validation.valid) {
      const response: ImportPreviewResponse = {
        valid: false,
        errors: validation.errors,
        warnings: [],
        dashboard: {
          name: (body as any)?.name || "Unknown",
          exported_at: (body as any)?.exported_at || "Unknown",
          glance_version: (body as any)?.glance_version || "Unknown",
        },
        widget_count: 0,
        widgets: [],
        conflicts: [],
        layout: { desktop_items: 0, tablet_items: 0, mobile_items: 0 },
        has_theme: false,
        credentials_needed: [],
        credentials_missing: [],
      };
      return NextResponse.json(response, { status: 400 });
    }
    
    const dashboard = body as DashboardExportFormat;
    const warnings: string[] = [];
    
    // Get existing widgets for conflict detection
    const existingWidgets = getAllCustomWidgets(true);
    const existingSlugs = new Map(existingWidgets.map(w => [w.slug, w.name]));
    
    // Check for conflicts
    const conflicts: WidgetConflict[] = [];
    const widgetPreviews: Array<{ slug: string; name: string; has_conflict: boolean }> = [];
    
    for (const widget of dashboard.widgets) {
      const hasConflict = existingSlugs.has(widget.slug);
      
      widgetPreviews.push({
        slug: widget.slug,
        name: widget.name,
        has_conflict: hasConflict,
      });
      
      if (hasConflict) {
        conflicts.push({
          slug: widget.slug,
          existing_name: existingSlugs.get(widget.slug)!,
          incoming_name: widget.name,
          action: "will_overwrite", // Default action (can be changed in import options)
        });
      }
    }
    
    // Check credentials
    const credentialsNeeded: string[] = [];
    const credentialsMissing: string[] = [];
    
    if (dashboard.credentials_needed) {
      for (const cred of dashboard.credentials_needed) {
        credentialsNeeded.push(cred.provider);
        
        // Check if credential is configured
        const isConfigured = hasCredential(cred.provider as Provider);
        if (!isConfigured) {
          credentialsMissing.push(cred.provider);
        }
      }
    }
    
    // Also scan widget credentials
    for (const widget of dashboard.widgets) {
      if (widget.credentials && Array.isArray(widget.credentials)) {
        for (const cred of widget.credentials) {
          const credId = (cred as any).id || (cred as any).provider;
          if (credId && !credentialsNeeded.includes(credId)) {
            credentialsNeeded.push(credId);
            const isConfigured = hasCredential(credId as Provider);
            if (!isConfigured && !credentialsMissing.includes(credId)) {
              credentialsMissing.push(credId);
            }
          }
        }
      }
    }
    
    // Layout info
    const layout = {
      desktop_items: dashboard.layout.desktop?.length || 0,
      tablet_items: dashboard.layout.tablet?.length || 0,
      mobile_items: dashboard.layout.mobile?.length || 0,
    };
    
    // Theme info
    const hasTheme = !!dashboard.theme && (!!dashboard.theme.lightCss || !!dashboard.theme.darkCss);
    
    // Warnings
    if (conflicts.length > 0) {
      warnings.push(`${conflicts.length} widget(s) already exist and will be affected`);
    }
    if (credentialsMissing.length > 0) {
      warnings.push(`${credentialsMissing.length} credential(s) need to be configured`);
    }
    if (!hasTheme && dashboard.theme?.name) {
      warnings.push("Theme has name but no CSS content");
    }
    
    const response: ImportPreviewResponse = {
      valid: true,
      errors: [],
      warnings,
      dashboard: {
        name: dashboard.name,
        description: dashboard.description,
        author: dashboard.author,
        exported_at: dashboard.exported_at,
        glance_version: dashboard.glance_version,
      },
      widget_count: dashboard.widgets.length,
      widgets: widgetPreviews,
      conflicts,
      layout,
      has_theme: hasTheme,
      credentials_needed: credentialsNeeded,
      credentials_missing: credentialsMissing,
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to preview dashboard import:", error);
    return NextResponse.json(
      {
        valid: false,
        errors: [error instanceof Error ? error.message : "Failed to parse dashboard file"],
        warnings: [],
        dashboard: { name: "Unknown", exported_at: "Unknown", glance_version: "Unknown" },
        widget_count: 0,
        widgets: [],
        conflicts: [],
        layout: { desktop_items: 0, tablet_items: 0, mobile_items: 0 },
        has_theme: false,
        credentials_needed: [],
        credentials_missing: [],
      } satisfies ImportPreviewResponse,
      { status: 400 }
    );
  }
}
