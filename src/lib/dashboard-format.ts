/**
 * Shared types and utilities for dashboard export/import
 */

import type {
  FetchConfig,
  CacheConfig,
  SetupConfig,
  DataSchema,
  CredentialRequirement,
} from "@/lib/db";

/**
 * Dashboard export format v1
 * Used for .glance.json files
 */
export interface DashboardExportFormat {
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
    desktop: Array<{
      widget: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
    tablet?: Array<{
      widget: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
    mobile?: Array<{
      widget: string;
      x: number;
      y: number;
      w: number;
      h: number;
    }>;
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
 * Validates the structure of a dashboard export file
 */
/**
 * Shared types for dashboard import/export API responses
 */

export interface WidgetPreviewDetail {
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

export interface CredentialPreviewDetail {
  id: string;
  type: "api_key" | "local_software" | "oauth" | "agent";
  name: string;
  description: string;
  obtain_url?: string;
  install_url?: string;
  is_configured: boolean;
}

export interface ThemePreviewDetail {
  name: string;
  lightCss?: string;
  darkCss?: string;
  lightCss_lines: number;
  darkCss_lines: number;
}

export interface WidgetConflict {
  slug: string;
  existing_name: string;
  incoming_name: string;
  action: "will_overwrite" | "will_rename" | "will_skip";
}

export interface ImportPreviewResponse {
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

export interface ImportResponse {
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

/**
 * Validates the structure of a dashboard export file
 */
export function validateDashboardFormat(data: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid JSON structure"] };
  }

  const dashboard = data as Record<string, unknown>;

  if (dashboard.version !== 1) {
    errors.push(
      `Unsupported version: ${dashboard.version}. Expected version 1.`
    );
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
        errors.push(
          `Widget ${widget.slug || i + 1}: missing or invalid source_code`
        );
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
