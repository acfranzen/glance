import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { exec } from "child_process";
import { promisify } from "util";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import {
  createCustomWidget,
  getAllCustomWidgets,
  getWidgetSetup,
  createWidget,
  CredentialRequirement,
} from "@/lib/db";
import {
  decodeWidgetPackage,
  validateWidgetPackage,
  packageToWidget,
  generateUniqueSlug,
  WidgetPackage,
} from "@/lib/widget-package";
import { validateServerCode } from "@/lib/widget-sdk/server-executor";
import { hasCredential, type Provider } from "@/lib/credentials";

const execAsync = promisify(exec);

interface CredentialStatus {
  id: string;
  type: "api_key" | "local_software" | "oauth" | "agent";
  name: string;
  status: "configured" | "missing" | "installed" | "not_installed" | "agent_required";
  description: string;
  obtain_url?: string;
  obtain_instructions?: string;
  install_url?: string;
  install_instructions?: string;
  check_command?: string;
  // Agent credential fields
  agent_tool?: string;
  agent_auth_check?: string;
  agent_auth_instructions?: string;
}

interface SetupStatus {
  status: "configured" | "not_configured" | "not_required";
  description?: string;
  agent_skill?: string;
  verification?: {
    type: "command_succeeds" | "endpoint_responds" | "cache_populated";
    target: string;
  };
  estimated_time?: string;
}

interface FetchStatus {
  type: string;
  status: "ready" | "not_ready";
  webhook_path?: string;
  instructions?: string;
}

interface CronScheduleInfo {
  expression: string;
  instructions: string;
  slug: string;
}

interface ImportResponse {
  valid: boolean;
  widget_preview?: {
    name: string;
    slug: string;
    description?: string;
  };
  status?: {
    credentials: CredentialStatus[];
    setup: SetupStatus;
    fetch: FetchStatus;
  };
  ready_to_import: boolean;
  blocking_issues: string[];
  message: string;
  // Only present when actually imported (dry_run: false)
  widget?: {
    id: string;
    name: string;
    slug: string;
  };
  instance_id?: string;
  validation?: {
    errors: string[];
    warnings: string[];
  };
  // Present when widget has agent_refresh with schedule - OpenClaw should register cron
  cronSchedule?: CronScheduleInfo;
}

/**
 * Check if a local software credential is installed
 */
async function checkLocalSoftware(cred: CredentialRequirement): Promise<boolean> {
  if (!cred.check_command) {
    return false;
  }

  try {
    await execAsync(cred.check_command, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check credential status for all requirements
 */
async function checkCredentials(
  credentials: CredentialRequirement[],
): Promise<CredentialStatus[]> {
  const statuses: CredentialStatus[] = [];

  for (const cred of credentials) {
    if (cred.type === "api_key" || cred.type === "oauth") {
      const configured = hasCredential(cred.id as Provider);
      statuses.push({
        id: cred.id,
        type: cred.type,
        name: cred.name,
        status: configured ? "configured" : "missing",
        description: cred.description,
        obtain_url: cred.obtain_url,
        obtain_instructions: cred.obtain_instructions,
      });
    } else if (cred.type === "local_software") {
      const installed = await checkLocalSoftware(cred);
      statuses.push({
        id: cred.id,
        type: cred.type,
        name: cred.name,
        status: installed ? "installed" : "not_installed",
        description: cred.description,
        install_url: cred.install_url,
        install_instructions: cred.install_instructions,
        check_command: cred.check_command,
      });
    } else if (cred.type === "agent") {
      // Agent credentials can't be verified by Glance server-side
      // They require the OpenClaw agent to have the tool authenticated
      statuses.push({
        id: cred.id,
        type: cred.type,
        name: cred.name,
        status: "agent_required",
        description: cred.description,
        agent_tool: cred.agent_tool,
        agent_auth_check: cred.agent_auth_check,
        agent_auth_instructions: cred.agent_auth_instructions,
      });
    }
  }

  return statuses;
}

/**
 * Check setup status
 */
async function checkSetupStatus(
  pkg: WidgetPackage,
): Promise<SetupStatus> {
  if (!pkg.setup) {
    return { status: "not_required" };
  }

  // Check if there's a stored setup record
  const setupRecord = getWidgetSetup(pkg.meta.slug);
  if (setupRecord && setupRecord.status === "configured") {
    return { status: "configured" };
  }

  // Check verification
  let isConfigured = false;
  if (pkg.setup.verification) {
    const { type, target } = pkg.setup.verification;

    if (type === "command_succeeds") {
      try {
        await execAsync(target, { timeout: 5000 });
        isConfigured = true;
      } catch {
        isConfigured = false;
      }
    }
    // cache_populated checks if widget has cached data in DB
    // endpoint_responds would need HTTP checking
  }

  return {
    status: isConfigured ? "configured" : "not_configured",
    description: pkg.setup.description,
    agent_skill: pkg.setup.agent_skill,
    verification: pkg.setup.verification,
    estimated_time: pkg.setup.estimated_time,
  };
}

/**
 * Check fetch status
 */
function checkFetchStatus(pkg: WidgetPackage, setupStatus: SetupStatus): FetchStatus {
  const { fetch } = pkg;

  let ready = false;

  switch (fetch.type) {
    case "server_code":
      // Ready if credentials are configured
      ready = true; // Will be determined by credentials check
      break;
    case "webhook":
      // Ready if setup is configured
      ready = setupStatus.status === "configured" || setupStatus.status === "not_required";
      break;
    case "agent_refresh":
      // Ready if setup is configured (agent will populate cache via API)
      ready = setupStatus.status === "configured" || setupStatus.status === "not_required";
      break;
  }

  return {
    type: fetch.type,
    status: ready ? "ready" : "not_ready",
    webhook_path: fetch.webhook_path,
    instructions: fetch.instructions,
  };
}

/**
 * POST /api/widgets/import - Import a widget from a package string
 *
 * Body:
 * - package: The encoded widget package string (!GW1!...)
 * - dry_run: If true, only validate and check requirements without importing
 * - auto_add_to_dashboard: If true, also create a widget instance
 * - config_overrides: Config to pass to the widget instance
 */
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { package: packageString, dry_run = false, auto_add_to_dashboard = false, config_overrides = {} } = body;

    if (!packageString || typeof packageString !== "string") {
      return NextResponse.json(
        { error: "Package string is required" },
        { status: 400 },
      );
    }

    // Decode the package
    let pkg: WidgetPackage;
    try {
      pkg = decodeWidgetPackage(packageString);
    } catch (error) {
      return NextResponse.json(
        {
          valid: false,
          ready_to_import: false,
          blocking_issues: ["decode_failed"],
          message: error instanceof Error ? error.message : "Failed to decode package",
        } satisfies ImportResponse,
        { status: 400 },
      );
    }

    // Validate the package structure
    const validation = validateWidgetPackage(pkg);
    if (!validation.valid) {
      return NextResponse.json(
        {
          valid: false,
          widget_preview: {
            name: pkg.meta?.name || "Unknown",
            slug: pkg.meta?.slug || "unknown",
            description: pkg.meta?.description,
          },
          ready_to_import: false,
          blocking_issues: ["validation_failed"],
          message: `Package validation failed: ${validation.errors.join(", ")}`,
          validation: {
            errors: validation.errors,
            warnings: validation.warnings,
          },
        } satisfies ImportResponse,
        { status: 400 },
      );
    }

    // Validate server code if present
    if (pkg.widget.server_code_enabled && pkg.widget.server_code) {
      const serverCodeValidation = validateServerCode(pkg.widget.server_code);
      if (!serverCodeValidation.valid) {
        return NextResponse.json(
          {
            valid: false,
            widget_preview: {
              name: pkg.meta.name,
              slug: pkg.meta.slug,
              description: pkg.meta.description,
            },
            ready_to_import: false,
            blocking_issues: ["server_code_invalid"],
            message: `Server code validation failed: ${serverCodeValidation.error}`,
          } satisfies ImportResponse,
          { status: 400 },
        );
      }
    }

    // Check requirements
    const credentialStatuses = await checkCredentials(pkg.credentials || []);
    const setupStatus = await checkSetupStatus(pkg);
    const fetchStatus = checkFetchStatus(pkg, setupStatus);

    // Determine blocking issues
    const blockingIssues: string[] = [];

    // Missing credentials are warnings, not blocking (user can import and configure later)
    const missingCredentials = credentialStatuses.filter(
      (c) => c.status === "missing" || c.status === "not_installed",
    );

    // Agent credentials require OpenClaw agent to have the tool authenticated
    const agentCredentials = credentialStatuses.filter(
      (c) => c.status === "agent_required",
    );

    // Setup not configured is a warning for dry_run, but widget can still be imported
    if (setupStatus.status === "not_configured" && !dry_run) {
      // Not blocking - widget can be imported, setup done later
    }

    const readyToImport = validation.valid;

    // Build message
    let message = "Widget is ready to import.";
    if (missingCredentials.length > 0) {
      message = `Widget can be imported. ${missingCredentials.length} credential(s) need to be configured.`;
    }
    if (agentCredentials.length > 0) {
      const agentTools = agentCredentials
        .map(c => c.agent_tool || c.name)
        .join(", ");
      message += ` Requires ${agentTools} on OpenClaw agent.`;
    }
    if (setupStatus.status === "not_configured") {
      message += " Local setup is required for full functionality.";
    }

    // Build agent credential warnings
    const agentWarnings = agentCredentials.map(c => 
      `This widget requires ${c.agent_tool || c.name} authenticated on your OpenClaw agent${c.agent_auth_check ? ` (check: ${c.agent_auth_check})` : ""}`
    );

    const response: ImportResponse = {
      valid: true,
      widget_preview: {
        name: pkg.meta.name,
        slug: pkg.meta.slug,
        description: pkg.meta.description,
      },
      status: {
        credentials: credentialStatuses,
        setup: setupStatus,
        fetch: fetchStatus,
      },
      ready_to_import: readyToImport,
      blocking_issues: blockingIssues,
      message,
      validation: {
        errors: validation.errors,
        warnings: [...validation.warnings, ...agentWarnings],
      },
    };

    // If dry_run, return status without importing
    if (dry_run) {
      return NextResponse.json(response);
    }

    // Actually import the widget
    const existingSlugs = getAllCustomWidgets(true).map((w) => w.slug);
    const uniqueSlug = generateUniqueSlug(pkg.meta.slug, existingSlugs);
    const widgetData = packageToWidget(pkg);
    const widgetId = `cw_${nanoid(12)}`;

    // Use cache config from package, or create default based on fetch type
    const cacheConfig = widgetData.cache ?? (
      widgetData.fetch.type === 'agent_refresh'
        ? {
            ttl_seconds: widgetData.fetch.expected_freshness_seconds ?? 300,
            max_staleness_seconds: widgetData.fetch.max_staleness_seconds ?? 900,
            on_error: 'use_stale' as const,
          }
        : null
    );

    createCustomWidget(
      widgetId,
      widgetData.name,
      uniqueSlug,
      widgetData.description,
      widgetData.source_code,
      null, // compiled_code
      widgetData.default_size,
      widgetData.min_size,
      [], // data_providers (legacy field)
      widgetData.refresh_interval,
      widgetData.enabled,
      widgetData.server_code,
      widgetData.server_code_enabled,
      widgetData.credentials,
      widgetData.setup,
      widgetData.fetch,
      cacheConfig,
      widgetData.author,
      widgetData.data_schema,
    );

    response.widget = {
      id: widgetId,
      name: widgetData.name,
      slug: uniqueSlug,
    };
    response.message = `Widget "${widgetData.name}" imported successfully!`;
    if (uniqueSlug !== pkg.meta.slug) {
      response.message += ` (slug changed to "${uniqueSlug}" to avoid conflict)`;
    }

    // Include cron schedule info for OpenClaw to register
    if (widgetData.fetch.type === "agent_refresh" && widgetData.fetch.schedule) {
      response.cronSchedule = {
        expression: widgetData.fetch.schedule,
        instructions: widgetData.fetch.instructions || `Refresh widget data for ${widgetData.name}. POST to /api/widgets/${uniqueSlug}/cache with { data: {...} }`,
        slug: uniqueSlug,
      };
      response.message += " Cron schedule returned for OpenClaw registration.";
    }

    // Optionally add to dashboard
    if (auto_add_to_dashboard) {
      const instanceId = `widget_${nanoid(12)}`;
      createWidget(
        instanceId,
        "custom",
        widgetData.name,
        config_overrides,
        { x: 0, y: 0, ...widgetData.default_size },
        undefined,
        widgetId,
      );
      response.instance_id = instanceId;
      response.message += " Widget added to dashboard.";
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Failed to import widget package:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import widget package",
      },
      { status: 500 },
    );
  }
}
