import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getCustomWidget, getCustomWidgetBySlug } from '@/lib/db';
import { executeServerCode, validateServerCode } from '@/lib/widget-sdk/server-executor';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Helper to find widget by ID or slug
function findCustomWidget(idOrSlug: string) {
  // Try by ID first (starts with 'cw_')
  if (idOrSlug.startsWith('cw_')) {
    return getCustomWidget(idOrSlug);
  }
  // Try by slug
  return getCustomWidgetBySlug(idOrSlug);
}

// POST /api/custom-widgets/[slug]/execute - Execute server-side code for a widget
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const widget = findCustomWidget(slug);

    if (!widget) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    // Check if server code is enabled
    if (!widget.server_code_enabled) {
      return NextResponse.json(
        { error: 'Server code is not enabled for this widget' },
        { status: 400 }
      );
    }

    // Check if server code exists
    if (!widget.server_code) {
      return NextResponse.json(
        { error: 'No server code defined for this widget' },
        { status: 400 }
      );
    }

    // Parse request body for params
    let params: Record<string, unknown> = {};
    try {
      const body = await request.json();
      params = body.params || {};
    } catch {
      // No body or invalid JSON - use empty params
    }

    // Validate the server code patterns
    const validation = validateServerCode(widget.server_code);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid server code: ${validation.error}` },
        { status: 400 }
      );
    }

    // Execute the server code
    const result = await executeServerCode(widget.server_code, {
      params,
      timeout: 5000,
      fetchConfig: widget.fetch,
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error('Failed to execute server code:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute server code' },
      { status: 500 }
    );
  }
}
