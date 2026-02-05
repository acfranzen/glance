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

interface WidgetPreviewDetail {
  slug: string;
  name: string;
  description?: string;
  has_conflict: boolean;
  source_code: string;
  server_code?: string;
  server_code_enabled: boolean;
  source_code_lines: number;
  server_code_lines?: number;
  credentials: Array<{ id: string; name: string; type: string }>;
}

interface CredentialPreviewDetail {
  id: string;
  type: "api_key" | "local_software" | "oauth" | "agent";
  name: string;
  description: string;
  obtain_url?: string;
  install_url?: string;
  is_configured: boolean;
}

interface ThemePreviewDetail {
  name: string;
  lightCss?: string;
  darkCss?: string;
  lightCss_lines: number;
  darkCss_lines: number;
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
  widgets: WidgetPreviewDetail[];
  conflicts: WidgetConflict[];
  layout: {
    desktop_items: number;
    tablet_items: number;
    mobile_items: number;
  };
  has_theme: boolean;
  theme_details?: ThemePreviewDetail;
  credentials_needed: string[];
  credentials_missing: string[];
  credentials_details: CredentialPreviewDetail[];
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
        credentials_details: [],
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
        credentials_details: [],
      };
      return NextResponse.json(response, { status: 400 });
    }

    const dashboard = body as DashboardExportFormat;
    const warnings: string[] = [];

    // Get existing widgets for conflict detection
    const existingWidgets = getAllCustomWidgets(true);
    const existingSlugs = new Map(existingWidgets.map((w) => [w.slug, w.name]));

    // Helper to count lines
    const countLines = (str?: string): number => {
      if (!str) return 0;
      return str.split("\n").length;
    };

    // Check for conflicts and build detailed widget previews
    const conflicts: WidgetConflict[] = [];
    const widgetPreviews: WidgetPreviewDetail[] = [];

    for (const widget of dashboard.widgets) {
      const hasConflict = existingSlugs.has(widget.slug);

      // Extract credential info for this widget
      const widgetCredentials = (widget.credentials || []).map((cred) => ({
        id: cred.id,
        name: cred.name,
        type: cred.type,
      }));

      widgetPreviews.push({
        slug: widget.slug,
        name: widget.name,
        description: widget.description,
        has_conflict: hasConflict,
        source_code: widget.source_code,
        server_code: widget.server_code,
        server_code_enabled: widget.server_code_enabled,
        source_code_lines: countLines(widget.source_code),
        server_code_lines: widget.server_code
          ? countLines(widget.server_code)
          : undefined,
        credentials: widgetCredentials,
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

    // Check credentials and build detailed credential info
    const credentialsNeeded: string[] = [];
    const credentialsMissing: string[] = [];
    const credentialsDetails: CredentialPreviewDetail[] = [];
    const seenCredentialIds = new Set<string>();

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

    // Also scan widget credentials and build detailed list
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

          // Add to detailed list if not seen
          if (credId && !seenCredentialIds.has(credId)) {
            seenCredentialIds.add(credId);
            const isConfigured = hasCredential(credId as Provider);
            credentialsDetails.push({
              id: credId,
              type: cred.type,
              name: cred.name,
              description: cred.description,
              obtain_url: cred.obtain_url,
              install_url: cred.install_url,
              is_configured: isConfigured,
            });
          }
        }
      }
    }

    // Also add credentials from credentials_needed that weren't in widgets
    if (dashboard.credentials_needed) {
      for (const cred of dashboard.credentials_needed) {
        if (!seenCredentialIds.has(cred.provider)) {
          seenCredentialIds.add(cred.provider);
          const isConfigured = hasCredential(cred.provider as Provider);
          credentialsDetails.push({
            id: cred.provider,
            type: "api_key", // Default type for credentials_needed entries
            name: cred.provider,
            description: cred.description,
            is_configured: isConfigured,
          });
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

    // Build theme details
    const themeDetails: ThemePreviewDetail | undefined = hasTheme
      ? {
          name: dashboard.theme!.name,
          lightCss: dashboard.theme!.lightCss,
          darkCss: dashboard.theme!.darkCss,
          lightCss_lines: countLines(dashboard.theme!.lightCss),
          darkCss_lines: countLines(dashboard.theme!.darkCss),
        }
      : undefined;

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
      theme_details: themeDetails,
      credentials_needed: credentialsNeeded,
      credentials_missing: credentialsMissing,
      credentials_details: credentialsDetails,
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
        credentials_details: [],
      } satisfies ImportPreviewResponse,
      { status: 400 }
    );
  }
}
