/**
 * Widget Package Import/Export System
 *
 * Enables WeakAuras-style sharing of custom widgets via compressed base64 strings.
 * Format: !GW1!<base64-zlib-compressed-json>
 */

import { deflate, inflate } from "pako";
import {
  CustomWidget,
  CredentialRequirement,
  SetupConfig,
  FetchConfig,
  CacheConfig,
} from "./db";

// Re-export types for convenience
export type { CredentialRequirement, SetupConfig, FetchConfig, CacheConfig };

// Magic prefix for widget packages (Glance Widget v1)
export const MAGIC_PREFIX = "!GW1!";

/**
 * Widget Package structure - the portable format for sharing widgets
 */
export interface WidgetPackage {
  // Header
  version: 1;
  type: "glance-widget";

  // Metadata
  meta: {
    name: string;
    slug: string;
    description?: string;
    author?: string;
    info?: string;                    // AI agent context for the overall widget
    created_at: string;
    exported_at: string;
  };

  // Widget Code
  widget: {
    source_code: string;
    server_code?: string;
    server_code_enabled: boolean;
    default_size: { w: number; h: number };
    min_size: { w: number; h: number };
    refresh_interval: number;
    info?: string;                    // AI agent context for display/rendering
  };

  // Requirements (top-level)
  credentials: CredentialRequirement[];
  setup?: SetupConfig;
  fetch: FetchConfig;
  cache?: CacheConfig;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Encode a CustomWidget into a portable package string
 */
export function encodeWidgetPackage(
  widget: CustomWidget,
  author?: string,
): string {
  const pkg: WidgetPackage = {
    version: 1,
    type: "glance-widget",
    meta: {
      name: widget.name,
      slug: widget.slug,
      description: widget.description || undefined,
      author: author || widget.author || undefined,
      created_at: widget.created_at,
      exported_at: new Date().toISOString(),
    },
    widget: {
      source_code: widget.source_code,
      server_code: widget.server_code || undefined,
      server_code_enabled: widget.server_code_enabled,
      default_size: widget.default_size,
      min_size: widget.min_size,
      refresh_interval: widget.refresh_interval,
    },
    credentials: widget.credentials,
    setup: widget.setup || undefined,
    fetch: widget.fetch,
    cache: widget.cache || undefined,
  };

  const json = JSON.stringify(pkg);
  const compressed = deflate(json);
  const base64 = Buffer.from(compressed).toString("base64");
  return MAGIC_PREFIX + base64;
}

/**
 * Decode a package string into a WidgetPackage
 */
export function decodeWidgetPackage(encoded: string): WidgetPackage {
  // Trim whitespace
  const trimmed = encoded.trim();

  if (!trimmed.startsWith(MAGIC_PREFIX)) {
    throw new Error(
      "Invalid widget package format: missing magic prefix (!GW1!)",
    );
  }

  const base64 = trimmed.slice(MAGIC_PREFIX.length);

  if (!base64) {
    throw new Error("Invalid widget package format: empty payload");
  }

  try {
    const compressed = Buffer.from(base64, "base64");
    const json = inflate(compressed, { to: "string" });
    const pkg = JSON.parse(json) as WidgetPackage;

    // Validate basic structure
    if (pkg.version !== 1) {
      throw new Error(`Unsupported widget package version: ${pkg.version}`);
    }

    if (pkg.type !== "glance-widget") {
      throw new Error(`Invalid package type: ${pkg.type}`);
    }

    return pkg;
  } catch (error) {
    if (error instanceof Error && error.message.includes("version")) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("type")) {
      throw error;
    }
    throw new Error(
      `Failed to decode widget package: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validate a decoded widget package
 */
export function validateWidgetPackage(pkg: WidgetPackage): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!pkg.meta?.name) {
    errors.push("Missing widget name");
  }
  if (!pkg.meta?.slug) {
    errors.push("Missing widget slug");
  }
  if (!pkg.widget?.source_code) {
    errors.push("Missing widget source code");
  }

  // Validate slug format
  if (pkg.meta?.slug && !/^[a-z0-9-]+$/.test(pkg.meta.slug)) {
    warnings.push(
      "Widget slug should only contain lowercase letters, numbers, and hyphens",
    );
  }

  // Validate credentials
  if (pkg.credentials) {
    for (const cred of pkg.credentials) {
      if (!cred.id) {
        errors.push("Credential requirement missing id");
      }
      if (!cred.type) {
        errors.push(`Credential ${cred.id || "unknown"} missing type`);
      }
      if (!cred.name) {
        errors.push(`Credential ${cred.id || "unknown"} missing name`);
      }
      if (
        cred.type &&
        !["api_key", "local_software", "oauth"].includes(cred.type)
      ) {
        errors.push(`Credential ${cred.id || "unknown"} has invalid type`);
      }
    }
  }

  // Validate setup
  if (pkg.setup) {
    if (!pkg.setup.description) {
      warnings.push("Setup missing description");
    }
    if (!pkg.setup.agent_skill) {
      errors.push("Setup missing agent_skill instructions");
    }
    if (!pkg.setup.verification) {
      warnings.push("Setup missing verification config");
    }
  }

  // Validate fetch
  if (!pkg.fetch?.type) {
    errors.push("Missing fetch type");
  } else {
    const validFetchTypes = [
      "server_code",
      "webhook",
      "agent_refresh",
    ];
    if (!validFetchTypes.includes(pkg.fetch.type)) {
      errors.push(`Invalid fetch type: ${pkg.fetch.type}`);
    }

    // Type-specific validation
    if (pkg.fetch.type === "webhook" && !pkg.fetch.webhook_path) {
      errors.push("webhook fetch type requires webhook_path");
    }
    if (pkg.fetch.type === "agent_refresh") {
      if (!pkg.fetch.instructions) {
        warnings.push("agent_refresh should have instructions for the agent");
      }
      if (!pkg.fetch.schedule) {
        warnings.push("agent_refresh without schedule requires manual agent triggering");
      } else {
        // Validate cron expression format (basic check for 5 space-separated fields)
        const cronParts = pkg.fetch.schedule.trim().split(/\s+/);
        if (cronParts.length !== 5) {
          errors.push(`Invalid cron schedule: expected 5 fields (minute hour day month weekday), got ${cronParts.length}`);
        } else {
          // Basic validation of cron field values
          const cronRegex = /^(\*|[0-9,\-\/\*]+)$/;
          const invalidFields = cronParts.filter(part => !cronRegex.test(part));
          if (invalidFields.length > 0) {
            errors.push(`Invalid cron schedule: invalid field values "${invalidFields.join(", ")}"`);
          }
        }
      }
    }
  }

  // Validate server code if enabled
  if (pkg.widget?.server_code_enabled && !pkg.widget?.server_code) {
    warnings.push("server_code_enabled is true but no server_code provided");
  }

  // Validate cache config if provided
  if (pkg.cache) {
    if (typeof pkg.cache.ttl_seconds !== "number" || pkg.cache.ttl_seconds < 0) {
      errors.push("cache.ttl_seconds must be a non-negative number");
    }
    if (pkg.cache.max_staleness_seconds !== undefined && 
        (typeof pkg.cache.max_staleness_seconds !== "number" || pkg.cache.max_staleness_seconds < 0)) {
      errors.push("cache.max_staleness_seconds must be a non-negative number");
    }
    if (pkg.cache.storage !== undefined && 
        !["memory", "sqlite"].includes(pkg.cache.storage)) {
      errors.push("cache.storage must be 'memory' or 'sqlite'");
    }
    if (pkg.cache.on_error !== undefined && 
        !["use_stale", "show_error"].includes(pkg.cache.on_error)) {
      errors.push("cache.on_error must be 'use_stale' or 'show_error'");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a string looks like a widget package
 */
export function isWidgetPackage(str: string): boolean {
  return str.trim().startsWith(MAGIC_PREFIX);
}

/**
 * Convert a WidgetPackage to a CustomWidget-compatible object (for import)
 * Note: Does not include id, created_at, updated_at - those are set during import
 */
export function packageToWidget(pkg: WidgetPackage): Omit<
  CustomWidget,
  "id" | "created_at" | "updated_at" | "compiled_code" | "data_providers"
> {
  return {
    name: pkg.meta.name,
    slug: pkg.meta.slug,
    description: pkg.meta.description || null,
    source_code: pkg.widget.source_code,
    server_code: pkg.widget.server_code || null,
    server_code_enabled: pkg.widget.server_code_enabled,
    default_size: pkg.widget.default_size,
    min_size: pkg.widget.min_size,
    refresh_interval: pkg.widget.refresh_interval,
    enabled: true,
    credentials: pkg.credentials || [],
    setup: pkg.setup || null,
    fetch: pkg.fetch,
    cache: pkg.cache || null,
    author: pkg.meta.author || null,
  };
}

/**
 * Generate a unique slug by appending a suffix if needed
 */
export function generateUniqueSlug(
  baseSlug: string,
  existingSlugs: string[],
): string {
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  let counter = 1;
  let newSlug = `${baseSlug}-${counter}`;
  while (existingSlugs.includes(newSlug)) {
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }
  return newSlug;
}
