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
