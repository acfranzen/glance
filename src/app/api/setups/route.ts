import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";

// Prevent static generation - this route requires runtime database access
export const dynamic = "force-dynamic";

import { validateAuthOrInternal } from "@/lib/auth";
import {
  getWidgetSetup,
  getAllWidgetSetups,
  upsertWidgetSetup,
  deleteWidgetSetup,
  WidgetSetup,
} from "@/lib/db";

/**
 * GET /api/setups - List all setup records or get a specific one
 *
 * Query params:
 * - widget_slug: Get setup for a specific widget
 */
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const widgetSlug = request.nextUrl.searchParams.get("widget_slug");

    if (widgetSlug) {
      // Get specific setup
      const setup = getWidgetSetup(widgetSlug);
      if (!setup) {
        return NextResponse.json(
          { error: "Setup record not found" },
          { status: 404 },
        );
      }
      return NextResponse.json(setup);
    }

    // Get all setups
    const setups = getAllWidgetSetups();
    return NextResponse.json({ setups });
  } catch (error) {
    console.error("Failed to get setup records:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get setup records",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/setups - Create or update a setup record
 *
 * Body:
 * - widget_slug: The widget slug this setup is for
 * - status: "configured" | "not_configured" | "failed"
 * - verified_at: ISO timestamp when verification passed (optional)
 * - notes: Any notes about the setup (optional)
 */
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { widget_slug, status, verified_at, notes } = body;

    if (!widget_slug || typeof widget_slug !== "string") {
      return NextResponse.json(
        { error: "widget_slug is required" },
        { status: 400 },
      );
    }

    if (!status || !["configured", "not_configured", "failed"].includes(status)) {
      return NextResponse.json(
        { error: "status must be one of: configured, not_configured, failed" },
        { status: 400 },
      );
    }

    // Check if a setup record already exists for this widget
    const existing = getWidgetSetup(widget_slug);
    const id = existing?.id || `setup_${nanoid(12)}`;

    upsertWidgetSetup(
      id,
      widget_slug,
      status as WidgetSetup["status"],
      verified_at || (status === "configured" ? new Date().toISOString() : null),
      notes || null,
    );

    const updated = getWidgetSetup(widget_slug);

    return NextResponse.json(updated, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Failed to create/update setup record:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create/update setup record",
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/setups - Delete a setup record
 *
 * Query params:
 * - id: The setup record ID to delete
 */
export async function DELETE(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const id = request.nextUrl.searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 },
      );
    }

    deleteWidgetSetup(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete setup record:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete setup record",
      },
      { status: 500 },
    );
  }
}
