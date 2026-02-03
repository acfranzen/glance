import { NextRequest, NextResponse } from "next/server";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import { getCustomWidget, getCustomWidgetBySlug } from "@/lib/db";
import { encodeWidgetPackage, validateWidgetPackage } from "@/lib/widget-package";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Helper to find widget by ID or slug
function findCustomWidget(idOrSlug: string) {
  // Try by ID first (starts with 'cw_')
  if (idOrSlug.startsWith("cw_")) {
    return getCustomWidget(idOrSlug);
  }
  // Try by slug
  return getCustomWidgetBySlug(idOrSlug);
}

/**
 * GET /api/widgets/[slug]/export - Export a custom widget as a package string
 *
 * Returns:
 * - package: The encoded widget package string (!GW1!...)
 * - meta: Widget metadata for preview
 * - validation: Any warnings about the package
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const widget = findCustomWidget(slug);

    if (!widget) {
      return NextResponse.json(
        { error: "Custom widget not found" },
        { status: 404 },
      );
    }

    // Get author from query param (optional)
    const author =
      request.nextUrl.searchParams.get("author") || widget.author || undefined;

    // Encode the widget to a package string
    const packageString = encodeWidgetPackage(widget, author);

    // Decode and validate for warnings
    const pkg = {
      version: 1 as const,
      type: "glance-widget" as const,
      meta: {
        name: widget.name,
        slug: widget.slug,
        description: widget.description || undefined,
        author,
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
      data_schema: widget.data_schema || undefined,
    };

    const validation = validateWidgetPackage(pkg);

    return NextResponse.json({
      package: packageString,
      meta: pkg.meta,
      credentials_count: widget.credentials.length,
      has_setup: !!widget.setup,
      has_data_schema: !!widget.data_schema,
      fetch_type: widget.fetch.type,
      validation: {
        valid: validation.valid,
        warnings: validation.warnings,
      },
    });
  } catch (error) {
    console.error("Failed to export widget package:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to export widget package",
      },
      { status: 500 },
    );
  }
}
