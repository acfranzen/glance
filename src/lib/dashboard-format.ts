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
    credentials: CredentialRequirement[];
    setup?: SetupConfig;
    cache?: CacheConfig;
    data_schema: DataSchema;
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
/**
 * Validates a size object has positive w and h integers
 */
function validateSize(
  size: unknown,
  fieldName: string,
  widgetId: string
): string[] {
  const errors: string[] = [];
  if (!size || typeof size !== "object") {
    errors.push(`Widget ${widgetId}: missing or invalid ${fieldName}`);
    return errors;
  }
  const s = size as Record<string, unknown>;
  if (typeof s.w !== "number" || !Number.isInteger(s.w) || s.w < 1) {
    errors.push(`Widget ${widgetId}: ${fieldName}.w must be a positive integer`);
  }
  if (typeof s.h !== "number" || !Number.isInteger(s.h) || s.h < 1) {
    errors.push(`Widget ${widgetId}: ${fieldName}.h must be a positive integer`);
  }
  return errors;
}

/**
 * Validates fetch configuration
 */
function validateFetch(
  fetch: unknown,
  widgetId: string
): string[] {
  const errors: string[] = [];
  if (!fetch || typeof fetch !== "object") {
    errors.push(`Widget ${widgetId}: missing or invalid fetch configuration`);
    return errors;
  }
  const f = fetch as Record<string, unknown>;

  const validTypes = ["server_code", "webhook", "agent_refresh"];
  if (!f.type || !validTypes.includes(f.type as string)) {
    errors.push(
      `Widget ${widgetId}: fetch.type must be one of: ${validTypes.join(", ")}`
    );
    return errors;
  }

  // agent_refresh requires instructions and schedule
  if (f.type === "agent_refresh") {
    if (!f.instructions || typeof f.instructions !== "string" || f.instructions.length < 10) {
      errors.push(
        `Widget ${widgetId}: fetch.instructions is required for agent_refresh widgets (min 10 chars)`
      );
    }
    if (!f.schedule || typeof f.schedule !== "string") {
      errors.push(
        `Widget ${widgetId}: fetch.schedule (cron expression) is required for agent_refresh widgets`
      );
    }
  }

  return errors;
}

/**
 * Validates data_schema configuration
 */
function validateDataSchema(
  schema: unknown,
  widgetId: string
): string[] {
  const errors: string[] = [];
  if (!schema || typeof schema !== "object") {
    errors.push(`Widget ${widgetId}: missing or invalid data_schema`);
    return errors;
  }
  const s = schema as Record<string, unknown>;

  if (s.type !== "object") {
    errors.push(`Widget ${widgetId}: data_schema.type must be "object"`);
  }

  if (!s.properties || typeof s.properties !== "object") {
    errors.push(`Widget ${widgetId}: data_schema.properties is required`);
  }

  if (!Array.isArray(s.required)) {
    errors.push(`Widget ${widgetId}: data_schema.required must be an array`);
  } else if (!s.required.includes("fetchedAt")) {
    errors.push(
      `Widget ${widgetId}: data_schema.required must include "fetchedAt"`
    );
  }

  return errors;
}

/**
 * Validates credentials array
 */
function validateCredentials(
  credentials: unknown,
  widgetId: string
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(credentials)) {
    errors.push(`Widget ${widgetId}: credentials must be an array (use [] if none needed)`);
    return errors;
  }

  const validTypes = ["api_key", "local_software", "oauth", "agent"];
  for (let i = 0; i < credentials.length; i++) {
    const cred = credentials[i] as Record<string, unknown>;
    if (!cred.id || typeof cred.id !== "string") {
      errors.push(`Widget ${widgetId}: credentials[${i}].id is required`);
    }
    if (!cred.type || !validTypes.includes(cred.type as string)) {
      errors.push(
        `Widget ${widgetId}: credentials[${i}].type must be one of: ${validTypes.join(", ")}`
      );
    }
    if (!cred.name || typeof cred.name !== "string") {
      errors.push(`Widget ${widgetId}: credentials[${i}].name is required`);
    }
    if (!cred.description || typeof cred.description !== "string") {
      errors.push(`Widget ${widgetId}: credentials[${i}].description is required`);
    }
  }

  return errors;
}

export function validateDashboardFormat(data: unknown): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid JSON structure"], warnings: [] };
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
      const widgetId = (widget.slug as string) || `#${i + 1}`;

      // Basic required fields
      if (!widget.slug || typeof widget.slug !== "string") {
        errors.push(`Widget ${i + 1}: missing or invalid slug`);
      } else if (!/^[a-z][a-z0-9-]*[a-z0-9]$|^[a-z]$/.test(widget.slug as string)) {
        errors.push(`Widget ${widgetId}: slug must be lowercase with hyphens only`);
      }

      if (!widget.name || typeof widget.name !== "string") {
        errors.push(`Widget ${widgetId}: missing or invalid name`);
      }

      if (!widget.source_code || typeof widget.source_code !== "string") {
        errors.push(`Widget ${widgetId}: missing or invalid source_code`);
      } else if ((widget.source_code as string).length < 10) {
        errors.push(`Widget ${widgetId}: source_code is too short`);
      }

      // Size validation
      errors.push(...validateSize(widget.default_size, "default_size", widgetId));
      errors.push(...validateSize(widget.min_size, "min_size", widgetId));

      // Fetch configuration validation
      errors.push(...validateFetch(widget.fetch, widgetId));

      // Data schema validation (REQUIRED)
      errors.push(...validateDataSchema(widget.data_schema, widgetId));

      // Credentials validation (REQUIRED, can be empty array)
      errors.push(...validateCredentials(widget.credentials, widgetId));
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

  return { valid: errors.length === 0, errors, warnings };
}
