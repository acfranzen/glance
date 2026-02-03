import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  getCustomWidget,
  getCustomWidgetBySlug,
  updateCustomWidget,
  deleteCustomWidget
} from '@/lib/db';
import { validateServerCode } from '@/lib/widget-sdk/server-executor';

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

// GET /api/widgets/[slug] - Get a custom widget by ID or slug
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const customWidget = findCustomWidget(slug);

    if (!customWidget) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(customWidget);
  } catch (error) {
    console.error('Failed to fetch custom widget:', error);
    return NextResponse.json(
      { error: 'Failed to fetch custom widget' },
      { status: 500 }
    );
  }
}

// PATCH /api/widgets/[slug] - Update a custom widget
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const existing = findCustomWidget(slug);

    if (!existing) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Merge with existing values
    const name = body.name ?? existing.name;
    const description = body.description !== undefined ? body.description : existing.description;
    const sourceCode = body.source_code ?? existing.source_code;
    const compiledCode = body.compiled_code !== undefined ? body.compiled_code : existing.compiled_code;
    const defaultSize = body.default_size ?? existing.default_size;
    const minSize = body.min_size ?? existing.min_size;
    const dataProviders = body.data_providers !== undefined
      ? (Array.isArray(body.data_providers) ? body.data_providers : [])
      : existing.data_providers;
    const refreshInterval = body.refresh_interval ?? existing.refresh_interval;
    const enabled = body.enabled !== undefined ? body.enabled : existing.enabled;
    const serverCode = body.server_code !== undefined ? body.server_code : existing.server_code;
    const serverCodeEnabled = body.server_code_enabled !== undefined ? body.server_code_enabled : existing.server_code_enabled;
    const credentials = body.credentials !== undefined ? body.credentials : existing.credentials;
    const setup = body.setup !== undefined ? body.setup : existing.setup;
    const fetch = body.fetch !== undefined ? body.fetch : existing.fetch;
    const cache = body.cache !== undefined ? body.cache : existing.cache;
    const author = body.author !== undefined ? body.author : existing.author;

    // Validate server code if provided and enabled
    if (serverCode && serverCodeEnabled) {
      const validation = validateServerCode(serverCode);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Invalid server code: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    // Update the widget
    updateCustomWidget(
      existing.id,
      name,
      description,
      sourceCode,
      compiledCode,
      defaultSize,
      minSize,
      dataProviders,
      refreshInterval,
      enabled,
      serverCode,
      serverCodeEnabled,
      credentials,
      setup,
      fetch,
      cache,
      author
    );

    // Fetch and return the updated widget
    const updated = getCustomWidget(existing.id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update custom widget:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update custom widget' },
      { status: 500 }
    );
  }
}

// DELETE /api/widgets/[slug] - Delete a custom widget
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const existing = findCustomWidget(slug);

    if (!existing) {
      return NextResponse.json(
        { error: 'Custom widget not found' },
        { status: 404 }
      );
    }

    deleteCustomWidget(existing.id);

    return NextResponse.json({ success: true, deleted_id: existing.id });
  } catch (error) {
    console.error('Failed to delete custom widget:', error);
    return NextResponse.json(
      { error: 'Failed to delete custom widget' },
      { status: 500 }
    );
  }
}
