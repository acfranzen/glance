import { NextRequest, NextResponse } from "next/server";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import { getAllCustomWidgets } from "@/lib/db";
import { hasCredential, type Provider } from "@/lib/credentials";
import {
  validateDashboardFormat,
  type DashboardExportFormat,
} from "@/lib/dashboard-format";

// Maximum import file size (5MB) to prevent DoS
const MAX_IMPORT_SIZE = 5 * 1024 * 1024;

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

  // Check content length to prevent oversized uploads
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_IMPORT_SIZE) {
    return NextResponse.json(
      {
        valid: false,
        errors: [`File too large. Maximum size is ${MAX_IMPORT_SIZE / 1024 / 1024}MB`],
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
      { status: 413 }
    );
  }

  try {
    const body = await request.json();

    // Validate structure
    const validation = validateDashboardFormat(body);
    if (!validation.valid) {
      // Extract safe fields from unknown body for error response
      const bodyObj =
        body && typeof body === "object"
          ? (body as Record<string, unknown>)
          : {};
      const response: ImportPreviewResponse = {
        valid: false,
        errors: validation.errors,
        warnings: [],
        dashboard: {
          name: typeof bodyObj.name === "string" ? bodyObj.name : "Unknown",
          exported_at:
            typeof bodyObj.exported_at === "string"
              ? bodyObj.exported_at
              : "Unknown",
          glance_version:
            typeof bodyObj.glance_version === "string"
              ? bodyObj.glance_version
              : "Unknown",
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
    const existingSlugs = new Map(existingWidgets.map((w) => [w.slug, w.name]));

    // Check for conflicts
    const conflicts: WidgetConflict[] = [];
    const widgetPreviews: Array<{
      slug: string;
      name: string;
      has_conflict: boolean;
    }> = [];

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
          const credId = cred.id;
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
    const hasTheme =
      !!dashboard.theme &&
      (!!dashboard.theme.lightCss || !!dashboard.theme.darkCss);

    // Warnings
    if (conflicts.length > 0) {
      warnings.push(
        `${conflicts.length} widget(s) already exist and will be affected`
      );
    }
    if (credentialsMissing.length > 0) {
      warnings.push(
        `${credentialsMissing.length} credential(s) need to be configured`
      );
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
        errors: [
          error instanceof Error
            ? error.message
            : "Failed to parse dashboard file",
        ],
        warnings: [],
        dashboard: {
          name: "Unknown",
          exported_at: "Unknown",
          glance_version: "Unknown",
        },
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
